globalThis.G = globalThis.G || {};
var G = globalThis.G;

// G.Renderer.draw(ctx, world, camera) — draws one frame.
//
// Transform: translate to canvas center, rotate by camera.currentAngle,
// translate by minus the player's center. Every world object is then drawn
// in plain world pixel coordinates under that single transform, which keeps
// the player fixed at screen center while the camera rotates around them.
// The player sprite itself is additionally counter-rotated by
// -camera.currentAngle (in its own local save/restore) so it always reads
// as upright on screen regardless of the current gravity orientation.

const BG_COLOR = '#202225';
const WALL_COLOR = '#000000';
const PORTAL_FILL = '#3aa0ff';
const PORTAL_OUTLINE = '#0b4f8a';
const BLOCK_COLOR = '#888888';
const BLOCK_HELD_OUTLINE = '#ffd400';
const COIN_COLOR = '#ffd400';
const PLAYER_COLOR = '#111111';
const COIN_SPRITE = typeof globalThis.Image === 'function' ? new globalThis.Image() : null;
if (COIN_SPRITE) COIN_SPRITE.src = 'assets/sprites/coin.png';
const PLAYER_SPRITE = typeof globalThis.Image === 'function' ? new globalThis.Image() : null;
if (PLAYER_SPRITE) PLAYER_SPRITE.src = 'assets/sprites/player.png';
const PLAYER_HOLDING_SPRITE = typeof globalThis.Image === 'function' ? new globalThis.Image() : null;
if (PLAYER_HOLDING_SPRITE) PLAYER_HOLDING_SPRITE.src = 'assets/sprites/player-holding.png';

// Player sprite drawn smaller than its actual hitbox (collision/physics are
// untouched — every stage was validated against the real hitbox size).
// Scaled from the feet up, so the character still stands on the same floor
// line, just shorter. See the pose reference for the size comparison.
const VISUAL_SCALE = 0.9;

// Walk frames advance by distance traveled, so cadence follows actual speed.
const STRIDE_LENGTH = 120; // px of travel per full walk cycle
const WALK_AMPLITUDE = 0.7; // fraction of legSpan/armSpan at full swing
const WALK_MIN_SPEED = 5; // px/s below which the player reads as standing still
const WALK_FRAMES = [0, 2, 0, 3];
let _walkPhase = 0;
let _idlePhase = 0;
let _coinFloatPhase = 0;

function drawTiles(ctx, world) {
  const TILE_SIZE = G.Grid.TILE_SIZE;
  const TILE = G.Grid.TILE;
  const grid = world.stageGrid;
  for (let row = 0; row < world.height; row++) {
    const rowArr = grid[row];
    if (!rowArr) continue;
    for (let col = 0; col < world.width; col++) {
      const t = rowArr[col];
      const x = col * TILE_SIZE;
      const y = row * TILE_SIZE;
      if (t === TILE.WALL) {
        ctx.fillStyle = WALL_COLOR;
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      } else if (t === TILE.PORTAL) {
        ctx.fillStyle = PORTAL_FILL;
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        ctx.strokeStyle = PORTAL_OUTLINE;
        ctx.lineWidth = 3;
        ctx.strokeRect(x + 1.5, y + 1.5, TILE_SIZE - 3, TILE_SIZE - 3);
      }
    }
  }
}

function drawBlocks(ctx, world) {
  const blocks = world.blocks || [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const aabb = b.getAABB();
    ctx.fillStyle = BLOCK_COLOR;
    ctx.fillRect(aabb.x, aabb.y, aabb.w, aabb.h);
    const gravity = G.Gravity.getGravityVec(b.gravityIndex);
    const cx = b.px;
    const cy = b.py;
    const length = G.Grid.TILE_SIZE * 0.24;
    const tipX = cx + gravity.x * length;
    const tipY = cy + gravity.y * length;
    ctx.strokeStyle = '#7cddff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - gravity.x * length, cy - gravity.y * length);
    ctx.lineTo(tipX, tipY);
    ctx.lineTo(tipX - gravity.x * 6 + gravity.y * 6, tipY - gravity.y * 6 - gravity.x * 6);
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(tipX - gravity.x * 6 - gravity.y * 6, tipY - gravity.y * 6 + gravity.x * 6);
    ctx.stroke();
    if (b.heldBy) {
      ctx.strokeStyle = BLOCK_HELD_OUTLINE;
      ctx.lineWidth = 3;
      ctx.strokeRect(aabb.x + 1.5, aabb.y + 1.5, aabb.w - 3, aabb.h - 3);
    }
  }
}

function drawCoins(ctx, world, camera, dt) {
  const TILE_SIZE = G.Grid.TILE_SIZE;
  const coins = world.coins || [];
  const size = TILE_SIZE * 0.78;
  const angle = camera ? camera.currentAngle : 0;
  _coinFloatPhase = (_coinFloatPhase + Math.min(Math.max(dt, 0), 0.1) * 2.4) % (Math.PI * 2);

  for (let i = 0; i < coins.length; i++) {
    const c = coins[i];
    if (c.collected) continue;
    const bob = Math.sin(_coinFloatPhase + i * 1.1) * TILE_SIZE * 0.06;
    const x = c.px + Math.sin(angle) * bob;
    const y = c.py + Math.cos(angle) * bob;

    if (COIN_SPRITE && COIN_SPRITE.complete && COIN_SPRITE.naturalWidth) {
      ctx.drawImage(COIN_SPRITE, x - size / 2, y - size / 2, size, size);
    } else {
      ctx.fillStyle = COIN_COLOR;
      ctx.beginPath();
      ctx.arc(x, y, size * 0.38, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawPlayerSprite(ctx, w, h, frame, sprite) {
  if (!sprite || !sprite.complete || !sprite.naturalWidth) sprite = PLAYER_SPRITE;
  if (sprite && sprite.complete && sprite.naturalWidth) {
    const frameW = sprite.naturalWidth / 3;
    const frameH = sprite.naturalHeight / 2;
    const col = frame % 3;
    const row = Math.floor(frame / 3);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sprite, col * frameW, row * frameH, frameW, frameH, -w / 2, -h / 2, w, h);
    return;
  }

  ctx.fillStyle = PLAYER_COLOR;
  ctx.fillRect(-w * 0.35, -h / 2, w * 0.7, h);
}

// Chooses idle, walk, or airborne jump poses. Walk cadence follows distance;
// idle gets a subtle breathing bob.
function poseNameFor(grounded, moveSpeed) {
  if (!grounded) return 'jump';
  return moveSpeed >= WALK_MIN_SPEED ? 'walk' : 'idle';
}

function animationFor(player, dt) {
  if (player.crouching) return { name: 'crouch', frame: 5, bob: 0 };

  const gVec = G.Gravity.getGravityVec(player.gravityIndex);
  const moveSpeed = (gVec.x !== 0) ? Math.abs(player.vy) : Math.abs(player.vx);
  const name = poseNameFor(player.grounded, moveSpeed);

  if (name === 'jump') {
    return { name: name, frame: 4, bob: -2 };
  }
  if (name === 'idle') {
    _idlePhase = (_idlePhase + dt * 0.75) % 1;
    return { name: name, frame: 0, bob: Math.sin(_idlePhase * Math.PI * 2) * 0.5 };
  }

  _walkPhase += (moveSpeed / STRIDE_LENGTH) * dt;
  _walkPhase -= Math.floor(_walkPhase);
  const offset = Math.sin(_walkPhase * Math.PI * 2) * WALK_AMPLITUDE;
  return { name: name, frame: WALK_FRAMES[Math.floor(_walkPhase * WALK_FRAMES.length)], bob: Math.abs(offset) * 2 };
}

function drawPlayer(ctx, world, camera, dt) {
  const player = world.player;
  // Upright size for the sprite itself: since we counter-rotate this local
  // frame back to screen-upright, use the canonical portrait dimensions
  // (crouch collapses both to a single tile) rather than the possibly
  // swapped world-space w/h.
  const TILE_SIZE = G.Grid.TILE_SIZE;
  const w = TILE_SIZE;
  const h = player.crouching ? TILE_SIZE : TILE_SIZE * 2;
  const animation = animationFor(player, dt);

  ctx.save();
  ctx.translate(player.px, player.py);
  ctx.rotate(-camera.currentAngle);
  // Scale down from the feet (local y = +h/2) up, so the hitbox/collision
  // footprint is untouched — only the drawn sprite shrinks toward the floor
  // line it's standing on.
  ctx.translate(0, h / 2);
  ctx.scale((player.facing < 0 ? -1 : 1) * VISUAL_SCALE, VISUAL_SCALE);
  ctx.translate(0, -h / 2);
  ctx.translate(0, animation.bob);
  drawPlayerSprite(ctx, w, h, animation.frame, player.holdingBlock ? PLAYER_HOLDING_SPRITE : PLAYER_SPRITE);
  ctx.restore();
}

// Coin-count HUD, top-right corner. Drawn in plain screen space (after the
// camera transform is restored) so it stays fixed in the corner and never
// rotates with gravity.
function drawCoinHud(ctx, world, canvasW) {
  const coins = world.coins || [];
  if (coins.length === 0) return;

  let collected = 0;
  for (let i = 0; i < coins.length; i++) {
    if (coins[i].collected) collected++;
  }
  const text = collected + ' / ' + coins.length;

  const iconSize = 28;
  const marginX = 16;
  const marginY = 14;
  const panelPaddingX = 14;
  const panelPaddingY = 8;
  const gap = 8;

  ctx.save();
  ctx.font = 'bold 20px sans-serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  const textWidth = ctx.measureText(text).width;

  const panelHeight = Math.max(iconSize, 20) + panelPaddingY * 2;
  const panelWidth = iconSize + gap + textWidth + panelPaddingX * 2;
  const panelX = canvasW - marginX - panelWidth;
  const panelY = marginY;
  const r = 10;

  ctx.fillStyle = 'rgba(10, 10, 12, 0.55)';
  ctx.beginPath();
  ctx.moveTo(panelX + r, panelY);
  ctx.arcTo(panelX + panelWidth, panelY, panelX + panelWidth, panelY + panelHeight, r);
  ctx.arcTo(panelX + panelWidth, panelY + panelHeight, panelX, panelY + panelHeight, r);
  ctx.arcTo(panelX, panelY + panelHeight, panelX, panelY, r);
  ctx.arcTo(panelX, panelY, panelX + panelWidth, panelY, r);
  ctx.closePath();
  ctx.fill();

  const iconX = panelX + panelPaddingX;
  const iconY = panelY + panelHeight / 2 - iconSize / 2;
  if (COIN_SPRITE && COIN_SPRITE.complete && COIN_SPRITE.naturalWidth) {
    ctx.drawImage(COIN_SPRITE, iconX, iconY, iconSize, iconSize);
  } else {
    ctx.fillStyle = COIN_COLOR;
    ctx.beginPath();
    ctx.arc(iconX + iconSize / 2, iconY + iconSize / 2, iconSize * 0.42, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, iconX + iconSize + gap, panelY + panelHeight / 2 + 1);
  ctx.restore();
}

function draw(ctx, world, camera, dt) {
  const canvas = ctx.canvas;
  const w = canvas ? canvas.width : 0;
  const h = canvas ? canvas.height : 0;
  if (typeof dt !== 'number' || isNaN(dt)) dt = 0;

  ctx.save();
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, w, h);

  ctx.translate(w / 2, h / 2);
  ctx.rotate(camera.currentAngle);
  ctx.translate(-world.player.px, -world.player.py);

  drawTiles(ctx, world);
  drawBlocks(ctx, world);
  drawCoins(ctx, world, camera, dt);
  drawPlayer(ctx, world, camera, dt);

  ctx.restore();

  drawCoinHud(ctx, world, w);
}

G.Renderer = {
  draw: draw,
  _poseNameFor: poseNameFor
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = G.Renderer;
}
