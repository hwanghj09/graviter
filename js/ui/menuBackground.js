globalThis.G = globalThis.G || {};
var G = globalThis.G;

// Decorative falling-objects background for the main menu — purely visual,
// independent of the game's own physics/state machine. Runs its own light
// requestAnimationFrame loop and simply skips drawing whenever #main-menu
// isn't the visible screen, so it never needs to hook into screen
// transitions elsewhere (gameState.js, mainMenu.js, ...).
//
// Wrapped in an IIFE: plain <script> tags share one global lexical scope,
// so top-level const/let/function names here would otherwise collide with
// same-named declarations in other files (this bit twice already — once
// project-wide with `const G`, then again with GRAVITY_ACCEL/ctx colliding
// with physics.js/audio.js). Scoping everything to this function avoids the
// whole class of bug regardless of what other files declare.
(function () {
  const PARTICLE_COUNT = 20;
  const GRAVITY_ACCEL = 140; // px/s^2 — gentler than in-game gravity, for a slow drift
  const MAX_FALL_SPEED = 260; // px/s
  const COLORS = ['#3a3d42', '#4a4d52', '#58d6ff', '#8f9dab', '#1fb9e9'];
  const COIN_COLOR = '#ffd400';

  // Easter eggs, rolled roughly once a second while the menu is visible:
  // 1% chance to switch the whole rain to coins-only for 3 seconds, 2%
  // chance to drop a single falling player cameo.
  const ROLL_INTERVAL = 1.0; // seconds between rolls
  const COIN_RAIN_CHANCE = 0.01;
  const COIN_RAIN_DURATION = 3.0; // seconds
  const PLAYER_DROP_CHANCE = 0.02;

  // The player cameo falls apart into a grid of shards (cut sprite pieces)
  // rather than dropping as one intact image — each shard gets its own
  // outward drift + spin so it reads as shattering, not just falling.
  const SHARD_COLS = 3;
  const SHARD_ROWS = 4;
  const PLAYER_DISPLAY_W = 36;
  const PLAYER_DISPLAY_H = 72;

  // Clicking the background creates a brief gravity well at the cursor —
  // nearby falling objects (particles, coins, shards alike) get pulled
  // toward it while it lasts, instead of just falling straight down.
  const ATTRACT_RADIUS = 110; // px — objects farther than this feel nothing
  const ATTRACT_STRENGTH = 900; // px/s^2 at the very center, falls off linearly to 0 at the radius
  const ATTRACT_DURATION = 1.5; // seconds the pull lasts after a click

  // A square ("block") particle hit hard enough shatters into a few small
  // fragments instead of just bouncing. Fragments never shatter again
  // (isFragment) and don't get recycled — they just fall until they exit
  // the screen, same as player shards.
  const BREAK_IMPACT_SPEED = 150; // px/s of closing speed needed to break on impact
  const MIN_BREAK_SIZE = 18; // blocks smaller than this just bounce, never shatter
  const FRAGMENT_COUNT = 3;
  const FRAGMENT_SIZE_FACTOR = 0.45;

  let canvas = null;
  let ctx = null;
  let particles = [];
  let fragments = []; // broken-block pieces; grows/shrinks independently of the main pool
  let lastTime = null;
  let rollAccum = 0;
  let coinRainUntil = 0; // now-timestamp (ms) until which spawns are coin-only
  let playerShards = []; // [] when no cameo is falling
  let playerImg = null;
  let attractors = []; // [] when nothing was recently clicked
  let interactionAttached = false;
  let brokenThisFrame = []; // particles flagged for breaking during this frame's collision pass

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function spawnParticle(w, h, atTop, forceCoin) {
    if (forceCoin) {
      const size = rand(16, 24);
      return {
        x: rand(0, w),
        y: atTop ? rand(-h * 0.3, 0) : rand(0, h),
        size: size,
        radius: size / 2,
        mass: size * size,
        rotation: rand(0, Math.PI * 2),
        spin: rand(2.5, 5) * (rand(0, 1) < 0.5 ? -1 : 1),
        vx: 0,
        vy: rand(20, 60),
        gravityMult: 1 + rand(-1, 1),
        color: COIN_COLOR,
        shape: 'circle',
        isCoin: true
      };
    }
    const size = rand(10, 34);
    return {
      x: rand(0, w),
      y: atTop ? rand(-h * 0.3, 0) : rand(0, h),
      size: size,
      radius: size / 2,
      mass: size * size,
      rotation: rand(0, Math.PI * 2),
      spin: rand(-1.2, 1.2),
      vx: 0,
      vy: rand(20, 60),
      gravityMult: 1 + rand(-1, 1),
      color: COLORS[Math.floor(rand(0, COLORS.length))],
      shape: rand(0, 1) < 0.7 ? 'rect' : 'circle'
    };
  }

  // Elastic-ish bounce (with restitution) between any two circular-ish
  // falling objects — used for both the regular rain and the player shards,
  // since both now carry {x, y, vx, vy, radius, mass}. Heavier objects (see
  // the per-object `mass` set at spawn) push lighter ones around more than
  // the reverse, and barely move themselves.
  const RESTITUTION = 0.7;

  function resolveCollisions(objs) {
    for (let i = 0; i < objs.length; i++) {
      for (let j = i + 1; j < objs.length; j++) {
        const a = objs[i], b = objs[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const minDist = a.radius + b.radius;
        const distSq = dx * dx + dy * dy;
        if (distSq >= minDist * minDist) continue;
        const dist = Math.sqrt(distSq) || 0.01;
        const nx = dx / dist, ny = dy / dist;

        // Push the pair apart along the contact normal, split by mass so
        // the lighter one gives way more.
        const overlap = minDist - dist;
        const totalMass = a.mass + b.mass;
        const aPush = overlap * (b.mass / totalMass);
        const bPush = overlap * (a.mass / totalMass);
        a.x -= nx * aPush; a.y -= ny * aPush;
        b.x += nx * bPush; b.y += ny * bPush;

        // Skip the impulse if they're already moving apart (would otherwise
        // add energy instead of removing it). A genuine impact (closing,
        // not separating) fast enough to count as "hard" flags any block
        // ("rect") involved to shatter once this pass finishes.
        const relVx = b.vx - a.vx, relVy = b.vy - a.vy;
        const velAlongNormal = relVx * nx + relVy * ny;
        if (velAlongNormal < 0 && -velAlongNormal > BREAK_IMPACT_SPEED) {
          // Each side shatters away from the OTHER object, not from a
          // uniformly random direction, so the burst reads as a response
          // to this specific hit.
          if (a.shape === 'rect' && !a.isFragment && a.size >= MIN_BREAK_SIZE) {
            brokenThisFrame.push({ obj: a, dirX: -nx, dirY: -ny });
          }
          if (b.shape === 'rect' && !b.isFragment && b.size >= MIN_BREAK_SIZE) {
            brokenThisFrame.push({ obj: b, dirX: nx, dirY: ny });
          }
        }
        if (velAlongNormal > 0) continue;

        const impulse = -(1 + RESTITUTION) * velAlongNormal / (1 / a.mass + 1 / b.mass);
        const ix = impulse * nx, iy = impulse * ny;
        a.vx -= ix / a.mass; a.vy -= iy / a.mass;
        b.vx += ix / b.mass; b.vy += iy / b.mass;

        // A bit of extra tumble on impact, purely cosmetic.
        a.spin = (a.spin || 0) + rand(-1, 1);
        b.spin = (b.spin || 0) + rand(-1, 1);
      }
    }
  }

  // Shatters one "block" (rect) particle into a few small pieces that
  // inherit its velocity plus an outward scatter, biased away from the
  // impact (dirX, dirY is the unit direction pointing away from whatever it
  // hit). Pushed into the separate `fragments` pool — see its declaration
  // for why that's kept apart from the main recycling particle pool.
  function spawnFragmentsFrom(obj, dirX, dirY) {
    const baseAngle = Math.atan2(dirY, dirX);
    for (let k = 0; k < FRAGMENT_COUNT; k++) {
      // Fan out mostly away from the hit (+/- ~60deg), not a fully random
      // direction, and each piece keeps a bit of where it sat in the
      // original block instead of all spawning from one exact point.
      const angle = baseAngle + rand(-1.05, 1.05);
      const speed = rand(35, 110);
      const fragSize = Math.max(4, obj.size * FRAGMENT_SIZE_FACTOR * rand(0.7, 1.3));
      const offset = obj.size * 0.2;
      fragments.push({
        x: obj.x + rand(-offset, offset),
        y: obj.y + rand(-offset, offset),
        size: fragSize,
        radius: fragSize / 2,
        mass: fragSize * fragSize,
        rotation: rand(0, Math.PI * 2),
        spin: rand(-5, 5),
        vx: obj.vx + Math.cos(angle) * speed,
        vy: obj.vy + Math.sin(angle) * speed,
        gravityMult: 1 + rand(-1, 1),
        color: obj.color,
        shape: 'rect',
        isFragment: true
      });
    }
  }

  function isCoinRainActive(now) {
    return now < coinRainUntil;
  }

  function triggerCoinRain(now) {
    // Only affects future spawns (see the recycle check in step()) —
    // whatever's already mid-fall keeps falling as itself and finishes
    // naturally instead of snapping into a coin mid-air.
    coinRainUntil = now + COIN_RAIN_DURATION * 1000;
  }

  function ensurePlayerImg() {
    if (playerImg) return playerImg;
    if (typeof globalThis.Image !== 'function') return null;
    playerImg = new globalThis.Image();
    playerImg.src = 'assets/sprites/player.png';
    return playerImg;
  }

  function triggerPlayerDrop(w) {
    if (playerShards.length > 0) return; // one cameo at a time
    ensurePlayerImg();
    const shardW = PLAYER_DISPLAY_W / SHARD_COLS;
    const shardH = PLAYER_DISPLAY_H / SHARD_ROWS;
    const originX = rand(w * 0.15, w * 0.85);
    const originY = -80;
    const midCol = (SHARD_COLS - 1) / 2;
    for (let row = 0; row < SHARD_ROWS; row++) {
      for (let col = 0; col < SHARD_COLS; col++) {
        // Start each shard at its correct spot within the intact sprite so
        // the very first frame still reads as one figure, then let its own
        // velocity carry it apart from there.
        const x = originX + (col - midCol) * shardW;
        const y = originY + row * shardH;
        const outward = (col - midCol) || rand(-0.4, 0.4);
        playerShards.push({
          col: col, row: row,
          x: x, y: y,
          radius: (shardW + shardH) / 4,
          mass: shardW * shardH * rand(0.6, 1.4),
          vx: outward * rand(18, 36),
          vy: rand(20, 60) + row * rand(0, 15),
          gravityMult: 1 + rand(-1, 1),
          rotation: 0,
          spin: rand(-3, 3),
          shardW: shardW, shardH: shardH
        });
      }
    }
  }

  function rollEasterEggs(now, w, h) {
    if (Math.random() < COIN_RAIN_CHANCE) triggerCoinRain(now);
    if (Math.random() < PLAYER_DROP_CHANCE) triggerPlayerDrop(w);
  }

  function canvasPointFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width ? canvas.width / rect.width : 1;
    const scaleY = rect.height ? canvas.height / rect.height : 1;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }

  function onCanvasPointerDown(e) {
    if (!isMenuVisible()) return;
    const pt = canvasPointFromEvent(e);
    const now = (typeof globalThis.performance !== 'undefined') ? globalThis.performance.now() : Date.now();
    attractors.push({ x: pt.x, y: pt.y, start: now, until: now + ATTRACT_DURATION * 1000 });
  }

  function attachInteraction() {
    if (interactionAttached || !canvas) return;
    interactionAttached = true;
    canvas.addEventListener('pointerdown', onCanvasPointerDown);
  }

  // Pulls every object within ATTRACT_RADIUS of each still-active attractor
  // toward it — strongest at the center, fading to nothing at the edge.
  function applyAttractors(objs, now, dt) {
    if (attractors.length === 0) return;
    for (let a = 0; a < attractors.length; a++) {
      const well = attractors[a];
      if (now >= well.until) continue;
      for (let i = 0; i < objs.length; i++) {
        const o = objs[i];
        const dx = well.x - o.x, dy = well.y - o.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 1 || dist > ATTRACT_RADIUS) continue;
        const strength = ATTRACT_STRENGTH * (1 - dist / ATTRACT_RADIUS);
        o.vx += (dx / dist) * strength * dt;
        o.vy += (dy / dist) * strength * dt;
      }
    }
  }

  function pruneAndDrawAttractors(now) {
    const alive = [];
    for (let i = 0; i < attractors.length; i++) {
      const well = attractors[i];
      if (now >= well.until) continue;
      alive.push(well);
      const lifeFrac = 1 - (now - well.start) / (well.until - well.start);
      ctx.save();
      ctx.globalAlpha = Math.max(0, lifeFrac) * 0.5;
      ctx.strokeStyle = '#58d6ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(well.x, well.y, ATTRACT_RADIUS * (1 - lifeFrac * 0.3), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    attractors = alive;
  }

  function ensureCanvas() {
    if (canvas) return canvas;
    if (typeof document === 'undefined' || !document.getElementById) return null;
    const el = document.getElementById('menu-bg-canvas');
    if (!el || !el.getContext) return null;
    canvas = el;
    ctx = canvas.getContext('2d');
    attachInteraction();
    return canvas;
  }

  function resizeIfNeeded() {
    const parent = canvas.parentElement;
    const w = Math.max(1, parent ? parent.clientWidth : canvas.width);
    const h = Math.max(1, parent ? parent.clientHeight : canvas.height);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      particles = [];
      for (let i = 0; i < PARTICLE_COUNT; i++) particles.push(spawnParticle(w, h, false));
    }
  }

  function isMenuVisible() {
    if (typeof document === 'undefined' || !document.getElementById) return false;
    const el = document.getElementById('main-menu');
    return !!(el && el.classList.contains('visible'));
  }

  function drawParticle(p) {
    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.isCoin) {
      // A flat-colored circle spun with ctx.rotate shows no visible change,
      // so fake the classic "flipping coin" look instead: squash the width
      // with the rotation angle so it narrows to an edge and back out.
      ctx.scale(Math.max(0.12, Math.abs(Math.cos(p.rotation))), 1);
    } else {
      ctx.rotate(p.rotation);
    }
    ctx.fillStyle = p.color;
    ctx.globalAlpha = 0.5;
    if (p.shape === 'circle') {
      ctx.beginPath();
      ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
    }
    ctx.restore();
  }

  function drawPlayerShard(shard) {
    const imgReady = playerImg && playerImg.complete && playerImg.naturalWidth;
    ctx.save();
    ctx.translate(shard.x, shard.y);
    ctx.rotate(shard.rotation);
    ctx.globalAlpha = 0.9;
    if (imgReady) {
      const sw = playerImg.naturalWidth / SHARD_COLS;
      const sh = playerImg.naturalHeight / SHARD_ROWS;
      ctx.drawImage(
        playerImg, shard.col * sw, shard.row * sh, sw, sh,
        -shard.shardW / 2, -shard.shardH / 2, shard.shardW, shard.shardH
      );
    } else {
      ctx.fillStyle = (shard.row + shard.col) % 2 === 0 ? '#58d6ff' : '#1fb9e9';
      ctx.fillRect(-shard.shardW / 2, -shard.shardH / 2, shard.shardW, shard.shardH);
    }
    ctx.restore();
  }

  function step(now) {
    if (typeof globalThis.requestAnimationFrame === 'function') {
      globalThis.requestAnimationFrame(step);
    }
    if (lastTime === null) lastTime = now;
    const dt = Math.min(Math.max((now - lastTime) / 1000, 0), 0.05);
    lastTime = now;

    if (!ensureCanvas() || !isMenuVisible()) return;
    resizeIfNeeded();

    const w = canvas.width, h = canvas.height;

    rollAccum += dt;
    while (rollAccum >= ROLL_INTERVAL) {
      rollAccum -= ROLL_INTERVAL;
      rollEasterEggs(now, w, h);
    }

    ctx.clearRect(0, 0, w, h);
    pruneAndDrawAttractors(now);
    applyAttractors(particles.concat(playerShards, fragments), now, dt);

    // Integrate gravity/position for everything first (particles, then
    // shards, then fragments), so the collision pass below sees where they
    // actually are this frame regardless of which list they came from.
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.vy = Math.min(p.vy + GRAVITY_ACCEL * p.gravityMult * dt, MAX_FALL_SPEED);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.98; // mild damping so a bounce settles instead of drifting forever
      p.rotation += p.spin * dt;
    }
    for (let i = 0; i < playerShards.length; i++) {
      const shard = playerShards[i];
      shard.vy = Math.min(shard.vy + GRAVITY_ACCEL * shard.gravityMult * dt, MAX_FALL_SPEED);
      shard.x += shard.vx * dt;
      shard.y += shard.vy * dt;
      shard.vx *= 0.98;
      shard.rotation += shard.spin * dt;
    }
    for (let i = 0; i < fragments.length; i++) {
      const f = fragments[i];
      f.vy = Math.min(f.vy + GRAVITY_ACCEL * f.gravityMult * dt, MAX_FALL_SPEED);
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.vx *= 0.98;
      f.rotation += f.spin * dt;
    }

    // Everything currently falling can bump into everything else falling —
    // regular rain, coins, player shards, and broken fragments alike (all
    // objects carry {x, y, vx, vy, radius, mass} for exactly this purpose).
    // A hard enough impact between two blocks flags them in
    // brokenThisFrame, processed just below.
    brokenThisFrame = [];
    resolveCollisions(particles.concat(playerShards, fragments));

    if (brokenThisFrame.length > 0) {
      const alreadyBroken = new Set();
      for (let k = 0; k < brokenThisFrame.length; k++) {
        const entry = brokenThisFrame[k];
        if (alreadyBroken.has(entry.obj)) continue;
        alreadyBroken.add(entry.obj);
        const idx = particles.indexOf(entry.obj);
        if (idx === -1) continue; // already replaced earlier this same frame
        spawnFragmentsFrom(entry.obj, entry.dirX, entry.dirY);
        particles[idx] = spawnParticle(w, h, true, isCoinRainActive(now));
      }
    }

    const coinRain = isCoinRainActive(now);
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      if (p.y - p.size > h) {
        particles[i] = spawnParticle(w, h, true, coinRain);
        continue;
      }
      drawParticle(p);
    }

    if (playerShards.length > 0) {
      const remaining = [];
      for (let i = 0; i < playerShards.length; i++) {
        const shard = playerShards[i];
        if (shard.y - shard.shardH > h) continue; // this piece has fallen off screen
        remaining.push(shard);
        drawPlayerShard(shard);
      }
      playerShards = remaining;
    }

    if (fragments.length > 0) {
      const remainingFragments = [];
      for (let i = 0; i < fragments.length; i++) {
        const f = fragments[i];
        if (f.y - f.size > h) continue; // this fragment has fallen off screen
        remainingFragments.push(f);
        drawParticle(f);
      }
      fragments = remainingFragments;
    }
  }

  if (typeof globalThis.requestAnimationFrame === 'function') {
    globalThis.requestAnimationFrame(step);
  }

  G.MenuBackground = {
    _isMenuVisible: isMenuVisible,
    // Manual test hooks — force an easter egg immediately instead of waiting
    // on its real (1%/2% per second) odds. Call from the browser console
    // while the main menu is showing.
    debugDropPlayer: function () { if (ensureCanvas()) triggerPlayerDrop(canvas.width); },
    debugCoinRain: function () { triggerCoinRain((typeof globalThis.performance !== 'undefined') ? globalThis.performance.now() : Date.now()); }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = G.MenuBackground;
  }
})();
