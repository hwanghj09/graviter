globalThis.G = globalThis.G || {};
var G = globalThis.G;

// G.Physics.update(dt, world) — core simulation step.
// world = { stageGrid, width, height, player, blocks, coins, portalPos }
// portalPos is {x: col, y: row} in grid coordinates (found by scanning the
// stage grid for the PORTAL tile).

const BASE_SPEED = 200;      // px/s
const JUMP_SPEED = 480;      // px/s
const GRAVITY_ACCEL = 900;   // px/s^2
const GRAB_MAX_TILES = 2;
const GROUNDED_PROBE = 1;    // px, how far to probe along gravityVec for grounded check
const MAX_DT = 0.05;         // clamp to avoid tunneling on frame hitches

function aabbIntersects(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x &&
         a.y < b.y + b.h && a.y + a.h > b.y;
}

function tileRangeCoveredByAabb(aabb, TILE_SIZE) {
  return {
    minCol: Math.floor(aabb.x / TILE_SIZE),
    maxCol: Math.floor((aabb.x + aabb.w - 0.001) / TILE_SIZE),
    minRow: Math.floor(aabb.y / TILE_SIZE),
    maxRow: Math.floor((aabb.y + aabb.h - 0.001) / TILE_SIZE)
  };
}

function aabbOverlapsSolidTiles(aabb, stageGrid, width, height) {
  const TILE_SIZE = G.Grid.TILE_SIZE;
  const r = tileRangeCoveredByAabb(aabb, TILE_SIZE);
  for (let row = r.minRow; row <= r.maxRow; row++) {
    for (let col = r.minCol; col <= r.maxCol; col++) {
      if (G.Grid.isSolidAt(stageGrid, width, height, col, row)) return true;
    }
  }
  return false;
}

function aabbOverlapsAnyBlock(aabb, blocks, excludeBlock) {
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b === excludeBlock) continue;
    if (b.heldBy) continue;
    if (aabbIntersects(aabb, b.getAABB())) return true;
  }
  return false;
}

function isGrounded(entityAabb, gVec, stageGrid, width, height, blocks, excludeBlock) {
  const probe = {
    x: entityAabb.x + gVec.x * GROUNDED_PROBE,
    y: entityAabb.y + gVec.y * GROUNDED_PROBE,
    w: entityAabb.w,
    h: entityAabb.h
  };
  return aabbOverlapsSolidTiles(probe, stageGrid, width, height) ||
         aabbOverlapsAnyBlock(probe, blocks, excludeBlock);
}

// Resolves movement for one axis ('x' or 'y') on an entity that exposes
// px/py, vx/vy and getAABB(). Mutates the entity's position and, on
// collision, zeroes the velocity component along this axis.
function resolveAxis(entity, axis, delta, stageGrid, width, height, blocks, excludeBlock) {
  if (delta === 0) return;
  const TILE_SIZE = G.Grid.TILE_SIZE;

  if (axis === 'x') entity.px += delta;
  else entity.py += delta;

  const aabb = entity.getAABB();
  let correction = null; // corrected aabb.x or aabb.y

  if (axis === 'x') {
    const rowMin = Math.floor(aabb.y / TILE_SIZE);
    const rowMax = Math.floor((aabb.y + aabb.h - 0.001) / TILE_SIZE);
    if (delta > 0) {
      const col = Math.floor((aabb.x + aabb.w - 0.001) / TILE_SIZE);
      for (let row = rowMin; row <= rowMax; row++) {
        if (G.Grid.isSolidAt(stageGrid, width, height, col, row)) {
          correction = col * TILE_SIZE - aabb.w;
          break;
        }
      }
    } else {
      const col = Math.floor(aabb.x / TILE_SIZE);
      for (let row = rowMin; row <= rowMax; row++) {
        if (G.Grid.isSolidAt(stageGrid, width, height, col, row)) {
          correction = (col + 1) * TILE_SIZE;
          break;
        }
      }
    }
    // Block collision (excluding held blocks and self)
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      if (b === excludeBlock || b.heldBy) continue;
      const bAabb = b.getAABB();
      if (!aabbIntersects(aabb, bAabb)) continue;
      const cand = (delta > 0) ? (bAabb.x - aabb.w) : (bAabb.x + bAabb.w);
      if (correction === null) correction = cand;
      else correction = (delta > 0) ? Math.min(correction, cand) : Math.max(correction, cand);
    }
    if (correction !== null) {
      entity.px = correction + aabb.w / 2;
      entity.vx = 0;
    }
  } else {
    const colMin = Math.floor(aabb.x / TILE_SIZE);
    const colMax = Math.floor((aabb.x + aabb.w - 0.001) / TILE_SIZE);
    if (delta > 0) {
      const row = Math.floor((aabb.y + aabb.h - 0.001) / TILE_SIZE);
      for (let col = colMin; col <= colMax; col++) {
        if (G.Grid.isSolidAt(stageGrid, width, height, col, row)) {
          correction = row * TILE_SIZE - aabb.h;
          break;
        }
      }
    } else {
      const row = Math.floor(aabb.y / TILE_SIZE);
      for (let col = colMin; col <= colMax; col++) {
        if (G.Grid.isSolidAt(stageGrid, width, height, col, row)) {
          correction = (row + 1) * TILE_SIZE;
          break;
        }
      }
    }
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      if (b === excludeBlock || b.heldBy) continue;
      const bAabb = b.getAABB();
      if (!aabbIntersects(aabb, bAabb)) continue;
      const cand = (delta > 0) ? (bAabb.y - aabb.h) : (bAabb.y + bAabb.h);
      if (correction === null) correction = cand;
      else correction = (delta > 0) ? Math.min(correction, cand) : Math.max(correction, cand);
    }
    if (correction !== null) {
      entity.py = correction + aabb.h / 2;
      entity.vy = 0;
    }
  }
}

function facingVecFor(player) {
  const idx = player.gravityIndex;
  return (player.facing === -1) ? G.Gravity.getLeftVec(idx) : G.Gravity.getRightVec(idx);
}

function tryGrab(player, blocks) {
  const TILE_SIZE = G.Grid.TILE_SIZE;
  const originCol = Math.floor(player.px / TILE_SIZE);
  const originRow = Math.floor(player.py / TILE_SIZE);
  const fVec = facingVecFor(player);
  for (let dist = 1; dist <= GRAB_MAX_TILES; dist++) {
    const targetCol = originCol + fVec.x * dist;
    const targetRow = originRow + fVec.y * dist;
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      if (b.heldBy) continue;
      const bCol = Math.floor(b.px / TILE_SIZE);
      const bRow = Math.floor(b.py / TILE_SIZE);
      if (bCol === targetCol && bRow === targetRow) {
        return b;
      }
    }
  }
  return null;
}

function dropBlock(player, block) {
  const TILE_SIZE = G.Grid.TILE_SIZE;
  const originCol = Math.floor(player.px / TILE_SIZE);
  const originRow = Math.floor(player.py / TILE_SIZE);
  const fVec = facingVecFor(player);
  const targetCol = originCol + fVec.x;
  const targetRow = originRow + fVec.y;
  block.px = (targetCol + 0.5) * TILE_SIZE;
  block.py = (targetRow + 0.5) * TILE_SIZE;
  block.heldBy = null;
  block.vx = 0;
  block.vy = 0;
}

function update(dt, world) {
  if (dt > MAX_DT) dt = MAX_DT;
  if (dt < 0) dt = 0;

  const stageGrid = world.stageGrid;
  const width = world.width;
  const height = world.height;
  const player = world.player;
  const blocks = world.blocks || [];
  const coins = world.coins || [];
  const Input = G.Input;
  const Gravity = G.Gravity;
  const TILE_SIZE = G.Grid.TILE_SIZE;

  // 1. crouch toggle (held state, not one-shot)
  player.crouching = Input.isDown('crouch');

  // 2. grounded check (based on position/orientation carried over from the
  //    end of the previous frame)
  const gVec = Gravity.getGravityVec(player.gravityIndex);
  const heldBlock = player.holdingBlock;
  player.grounded = isGrounded(
    player.getAABB(), gVec, stageGrid, width, height, blocks, heldBlock
  );

  // 3. rotate gravity (Z) — grounded only, one-shot
  if (Input.consumePressed('rotate') && player.grounded) {
    player.gravityIndex = Gravity.rotateIndex(player.gravityIndex);
  }

  // 4. grab / drop (SHIFT) — one-shot
  if (Input.consumePressed('grab')) {
    if (player.holdingBlock) {
      dropBlock(player, player.holdingBlock);
      player.holdingBlock = null;
    } else {
      const found = tryGrab(player, blocks);
      if (found) {
        found.heldBy = player;
        found.vx = 0;
        found.vy = 0;
        player.holdingBlock = found;
      }
    }
  }

  // 5. facing + horizontal movement input
  const rVec = Gravity.getRightVec(player.gravityIndex);
  const lVec = Gravity.getLeftVec(player.gravityIndex);
  const movingRight = Input.isDown('right');
  const movingLeft = Input.isDown('left');

  const speedMult = 1 - (player.holdingBlock ? 0.2 : 0) - (player.crouching ? 0.2 : 0);
  const speed = BASE_SPEED * speedMult;

  let moveDir = null;
  if (movingRight && !movingLeft) {
    moveDir = rVec;
    player.facing = 1;
  } else if (movingLeft && !movingRight) {
    moveDir = lVec;
    player.facing = -1;
  }

  // Movement axis is orthogonal to the gravity axis; rVec/lVec only ever
  // carry a nonzero component on that orthogonal axis, so this only ever
  // touches the correct velocity component.
  if (gVec.x !== 0) {
    // gravity acts on vx; movement acts on vy
    player.vy = moveDir ? moveDir.y * speed : 0;
  } else {
    player.vx = moveDir ? moveDir.x * speed : 0;
  }

  // 6. jump — grounded only
  if (Input.isDown('jump') && player.grounded) {
    const jVec = Gravity.getJumpVec(player.gravityIndex);
    if (gVec.x !== 0) player.vx = jVec.x * JUMP_SPEED;
    else player.vy = jVec.y * JUMP_SPEED;
  }

  // 7. gravity acceleration
  if (!player.grounded) {
    player.vx += gVec.x * GRAVITY_ACCEL * dt;
    player.vy += gVec.y * GRAVITY_ACCEL * dt;
  }
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.heldBy) continue;
    const bgVec = Gravity.getGravityVec(b.gravityIndex);
    b.vx += bgVec.x * GRAVITY_ACCEL * dt;
    b.vy += bgVec.y * GRAVITY_ACCEL * dt;
  }

  // 8. integrate + resolve collisions (separate axis), player first
  resolveAxis(player, 'x', player.vx * dt, stageGrid, width, height, blocks, heldBlock);
  resolveAxis(player, 'y', player.vy * dt, stageGrid, width, height, blocks, heldBlock);

  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.heldBy) continue;
    resolveAxis(b, 'x', b.vx * dt, stageGrid, width, height, blocks, b);
    resolveAxis(b, 'y', b.vy * dt, stageGrid, width, height, blocks, b);
  }

  // 9. held block follows the player at a fixed facing offset
  if (player.holdingBlock) {
    const fVec = facingVecFor(player);
    player.holdingBlock.px = player.px + fVec.x * TILE_SIZE;
    player.holdingBlock.py = player.py + fVec.y * TILE_SIZE;
  }

  // 10. coin collection
  const playerAabb = player.getAABB();
  for (let i = 0; i < coins.length; i++) {
    const c = coins[i];
    if (c.collected) continue;
    if (aabbIntersects(playerAabb, c.getAABB())) {
      c.collected = true;
    }
  }

  // 11. clear condition
  let allCoinsCollected = true;
  for (let i = 0; i < coins.length; i++) {
    if (!coins[i].collected) { allCoinsCollected = false; break; }
  }
  let onPortal = false;
  if (world.portalPos) {
    const portalAabb = {
      x: world.portalPos.x * TILE_SIZE,
      y: world.portalPos.y * TILE_SIZE,
      w: TILE_SIZE,
      h: TILE_SIZE
    };
    onPortal = aabbIntersects(player.getAABB(), portalAabb);
  }

  return { cleared: allCoinsCollected && onPortal };
}

G.Physics = {
  update: update,
  BASE_SPEED: BASE_SPEED,
  JUMP_SPEED: JUMP_SPEED,
  GRAVITY_ACCEL: GRAVITY_ACCEL,
  GRAB_MAX_TILES: GRAB_MAX_TILES
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = G.Physics;
}
