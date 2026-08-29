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

// Player sprite drawn smaller than its actual hitbox (collision/physics are
// untouched — every stage was validated against the real hitbox size).
// Scaled from the feet up, so the character still stands on the same floor
// line, just shorter. See the pose reference for the size comparison.
const VISUAL_SCALE = 0.8;

// Walk-cycle: the animation offset drives legs and arms in a contralateral
// swing (right foot forward <=> left hand forward).
// Phase advances by distance traveled, not by wall-clock time, so cadence
// naturally matches actual movement speed (slower while holding a block or
// crouching, frozen while not moving).
const STRIDE_LENGTH = 80; // px of travel per full walk cycle
const WALK_AMPLITUDE = 0.7; // fraction of legSpan/armSpan at full swing
const WALK_MIN_SPEED = 5; // px/s below which the player reads as standing still
let _walkPhase = 0;
let _idlePhase = 0;

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
    if (b.heldBy) {
      ctx.strokeStyle = BLOCK_HELD_OUTLINE;
      ctx.lineWidth = 3;
      ctx.strokeRect(aabb.x + 1.5, aabb.y + 1.5, aabb.w - 3, aabb.h - 3);
    }
  }
}

function drawCoins(ctx, world) {
  const TILE_SIZE = G.Grid.TILE_SIZE;
  const coins = world.coins || [];
  const r = TILE_SIZE * 0.3;
  ctx.fillStyle = COIN_COLOR;
  for (let i = 0; i < coins.length; i++) {
    const c = coins[i];
    if (c.collected) continue;
    ctx.beginPath();
    ctx.arc(c.px, c.py, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Simple "졸라맨" (stick figure) drawn upright, centered at local (0,0),
// sized by w/h (already reflecting crouch state). `offset` (-1..1) drives a
// contralateral walk swing — right foot/left hand forward at +1, the mirror
// at -1, and offset 0 reduces to the plain static idle stance.
function drawStickFigure(ctx, w, h, animation) {
  const offset = animation.offset;
  const jumping = animation.name === 'jump';
  const headR = Math.min(w, h) * 0.22;
  const top = -h / 2;
  const bottom = h / 2;
  const headCenterY = top + headR;
  const neckY = headCenterY + headR;
  const hipY = bottom - (bottom - neckY) * 0.35;

  ctx.strokeStyle = PLAYER_COLOR;
  ctx.fillStyle = PLAYER_COLOR;
  ctx.lineWidth = Math.max(2, w * 0.08);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // head
  ctx.beginPath();
  ctx.arc(0, headCenterY, headR, 0, Math.PI * 2);
  ctx.fill();

  // torso
  ctx.beginPath();
  ctx.moveTo(0, neckY);
  ctx.lineTo(0, hipY);
  ctx.stroke();

  // arms — left hand swings toward +offset, right hand toward -offset
  // (contralateral to the legs below), meeting at the same shoulder point.
  const armSpan = w * 0.45;
  const armY = neckY + (hipY - neckY) * 0.3;
  ctx.beginPath();
  if (jumping) {
    ctx.moveTo(-armSpan, neckY - headR * 0.4);
    ctx.lineTo(0, armY);
    ctx.lineTo(armSpan, neckY - headR * 0.4);
  } else {
    const armD = armSpan * offset;
    const armEndY = armY + (hipY - neckY) * 0.25;
    ctx.moveTo(-armSpan + armD, armEndY);
    ctx.lineTo(0, armY);
    ctx.lineTo(armSpan - armD, armEndY);
  }
  ctx.stroke();

  // legs — right foot swings toward +offset, left foot toward -offset.
  const legSpan = w * 0.4;
  ctx.beginPath();
  if (jumping) {
    const kneeY = hipY + (bottom - hipY) * 0.45;
    ctx.moveTo(-legSpan * 0.25, bottom - h * 0.1);
    ctx.lineTo(-legSpan * 0.85, kneeY);
    ctx.lineTo(0, hipY);
    ctx.lineTo(legSpan * 0.85, kneeY);
    ctx.lineTo(legSpan * 0.25, bottom - h * 0.1);
  } else {
    const legD = legSpan * offset;
    ctx.moveTo(-legSpan - legD, bottom);
    ctx.lineTo(0, hipY);
    ctx.lineTo(legSpan + legD, bottom);
  }
  ctx.stroke();
}

// Chooses idle, walk, or airborne jump poses. Walk cadence follows distance;
// idle gets a subtle breathing bob.
function poseNameFor(grounded, moveSpeed) {
  if (!grounded) return 'jump';
  return moveSpeed >= WALK_MIN_SPEED ? 'walk' : 'idle';
}

function animationFor(player, dt) {
  const gVec = G.Gravity.getGravityVec(player.gravityIndex);
  const moveSpeed = (gVec.x !== 0) ? Math.abs(player.vy) : Math.abs(player.vx);
  const name = poseNameFor(player.grounded, moveSpeed);

  if (name === 'jump') {
    return { name: name, offset: 0, bob: -2 };
  }
  if (name === 'idle') {
    _idlePhase = (_idlePhase + dt * 1.5) % 1;
    return { name: name, offset: 0, bob: Math.sin(_idlePhase * Math.PI * 2) };
  }

  _walkPhase += (moveSpeed / STRIDE_LENGTH) * dt;
  _walkPhase -= Math.floor(_walkPhase);
  const offset = Math.sin(_walkPhase * Math.PI * 2) * WALK_AMPLITUDE;
  return { name: name, offset: offset, bob: Math.abs(offset) * 2 };
}

function drawPlayer(ctx, world, camera, dt) {
  const player = world.player;
  // Upright size for the sprite itself: since we counter-rotate this local
  // frame back to screen-upright, use the canonical portrait dimensions
  // (crouch collapses both to a single tile) rather than the possibly
  // swapped world-space w/h.
  const TILE_SIZE = G.Grid.TILE_SIZE;
  const w = player.crouching ? TILE_SIZE : TILE_SIZE;
  const h = player.crouching ? TILE_SIZE : TILE_SIZE * 2;
  const animation = animationFor(player, dt);

  ctx.save();
  ctx.translate(player.px, player.py);
  ctx.rotate(-camera.currentAngle);
  // Scale down from the feet (local y = +h/2) up, so the hitbox/collision
  // footprint is untouched — only the drawn sprite shrinks toward the floor
  // line it's standing on.
  ctx.translate(0, h / 2);
  ctx.scale(VISUAL_SCALE, VISUAL_SCALE);
  ctx.translate(0, -h / 2);
  ctx.translate(0, animation.bob);
  drawStickFigure(ctx, w, h, animation);
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
  drawCoins(ctx, world);
  drawPlayer(ctx, world, camera, dt);

  ctx.restore();
}

G.Renderer = {
  draw: draw,
  _poseNameFor: poseNameFor
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = G.Renderer;
}
