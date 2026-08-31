const assert = require('node:assert/strict');

const inputState = Object.create(null);
globalThis.G = {
  Input: {
    isDown: function (action) { return !!inputState[action]; },
    consumePressed: function () { return false; }
  }
};
require('../js/stages/puzzleStage.js');
const stages = Array.from({ length: 10 }, function (_, index) {
  return require('../js/stages/stage' + String(index + 1).padStart(2, '0') + '.js');
});
require('../js/engine/grid.js');
require('../js/engine/gravity.js');
require('../js/engine/player.js');
require('../js/engine/block.js');
require('../js/engine/coin.js');
require('../js/engine/physics.js');
require('../js/render/camera.js');
require('../js/main.js');

const DIRECTIONS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const MAX_JUMP_TILES = G.Physics.JUMP_SPEED * G.Physics.JUMP_SPEED /
  (2 * G.Physics.GRAVITY_ACCEL * G.Grid.TILE_SIZE);

function key(x, y) {
  return x + ',' + y;
}

function fits(stage, x, y, width, height) {
  for (let row = y; row < y + height; row++) {
    for (let col = x; col < x + width; col++) {
      if (row < 0 || row >= stage.height || col < 0 || col >= stage.width || stage.grid[row][col] === 1) return false;
    }
  }
  return true;
}

function flood(stage, start, width, height) {
  width = width || 1;
  height = height || width;
  const seen = new Map();
  const queue = [start];
  seen.set(key(start.x, start.y), 0);
  for (let i = 0; i < queue.length; i++) {
    const point = queue[i];
    const distance = seen.get(key(point.x, point.y));
    DIRECTIONS.forEach(function (direction) {
      const x = point.x + direction[0];
      const y = point.y + direction[1];
      const nextKey = key(x, y);
      if (!seen.has(nextKey) && fits(stage, x, y, width, height)) {
        seen.set(nextKey, distance + 1);
        queue.push({ x: x, y: y });
      }
    });
  }
  return seen;
}

function findPortal(stage) {
  for (let y = 0; y < stage.height; y++) {
    for (let x = 0; x < stage.width; x++) {
      if (stage.grid[y][x] === 2) return { x: x, y: y };
    }
  }
  return null;
}

function minimumRoute(stage, points) {
  const distances = points.map(function (point) { return flood(stage, point); });
  let best = Infinity;
  const portalIndex = points.length - 1;

  function visit(remaining, current, total) {
    if (total >= best) return;
    if (!remaining.length) {
      best = Math.min(best, total + distances[current].get(key(points[portalIndex].x, points[portalIndex].y)));
      return;
    }
    remaining.forEach(function (next, index) {
      visit(
        remaining.slice(0, index).concat(remaining.slice(index + 1)),
        next,
        total + distances[current].get(key(points[next].x, points[next].y))
      );
    });
  }

  visit(points.slice(1, -1).map(function (_, index) { return index + 1; }), 0, 0);
  return best;
}

function crossesGate(stage, gate, withBlock) {
  const world = G.Main.init(stage);
  const tileSize = G.Grid.TILE_SIZE;
  const gravity = gate.gravity;
  const block = world.blocks.find(function (candidate) { return candidate.gravityIndex === gravity; });
  let moveAction;
  let crossed;

  world.player.gravityIndex = gravity;
  world.player.vx = 0;
  world.player.vy = 0;

  if (gate.axis === 'vertical') {
    world.player.px = (gate.divider - 4.5) * tileSize;
    world.player.py = (gravity === 0 ? gate.y + 11 : gate.y + 2) * tileSize;
    moveAction = gravity === 0 ? 'right' : 'left';
    crossed = function () {
      return world.player.getAABB().x > gate.divider * tileSize &&
        world.player.py > (gate.y + 1) * tileSize && world.player.py < (gate.y + 12) * tileSize;
    };
    if (withBlock) {
      block.px = (gate.divider - 0.5) * tileSize;
      block.py = (gravity === 0 ? gate.y + 11.5 : gate.y + 1.5) * tileSize;
    }
  } else {
    world.player.px = (gravity === 1 ? gate.x + 2 : gate.x + 11) * tileSize;
    world.player.py = (gate.divider - 4.5) * tileSize;
    moveAction = gravity === 1 ? 'right' : 'left';
    crossed = function () {
      return world.player.getAABB().y > gate.divider * tileSize &&
        world.player.px > (gate.x + 1) * tileSize && world.player.px < (gate.x + 12) * tileSize;
    };
    if (withBlock) {
      block.px = (gravity === 1 ? gate.x + 1.5 : gate.x + 11.5) * tileSize;
      block.py = (gate.divider - 0.5) * tileSize;
    }
  }

  if (withBlock) {
    assert.ok(block);
    block.vx = 0;
    block.vy = 0;
    world.blocks = [block];
  } else {
    world.blocks = [];
  }

  inputState[moveAction] = true;
  inputState.jump = true;
  let didCross = false;
  for (let frame = 0; frame < 1200; frame++) {
    G.Physics.update(1 / 120, world);
    if (crossed()) {
      didCross = true;
      break;
    }
  }
  inputState[moveAction] = false;
  inputState.jump = false;
  return didCross;
}

function entityOverlapsWall(stage, entity) {
  const aabb = entity.getAABB();
  const minX = Math.floor(aabb.x / G.Grid.TILE_SIZE);
  const maxX = Math.floor((aabb.x + aabb.w - 0.001) / G.Grid.TILE_SIZE);
  const minY = Math.floor(aabb.y / G.Grid.TILE_SIZE);
  const maxY = Math.floor((aabb.y + aabb.h - 0.001) / G.Grid.TILE_SIZE);
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (G.Grid.isSolidAt(stage.grid, stage.width, stage.height, x, y)) return true;
    }
  }
  return false;
}

const expectedTypes = [
  'platform', 'drop', 'maze', 'ceiling', 'crawl',
  'slalom', 'orbit', 'construction', 'relay', 'gauntlet'
];
const puzzleKinds = new Set();
const puzzleTypes = new Set();
stages.forEach(function (stage, index) {
  assert.equal(stage.id, index + 1);
  assert.equal(stage.grid.length, stage.height);
  assert.ok(stage.grid.every(function (row) { return row.length === stage.width; }));
  assert.ok(stage.coins.length >= 1 && stage.coins.length <= 5);
  assert.ok(stage.blocks.length >= 1 && stage.blocks.length <= 4);
  assert.equal(stage.puzzle.type, expectedTypes[index]);
  assert.ok(!puzzleKinds.has(stage.puzzle.type));
  assert.ok(!puzzleTypes.has(stage.puzzleType));
  puzzleKinds.add(stage.puzzle.type);
  puzzleTypes.add(stage.puzzleType);
  assert.ok(stage.grid[0].every(function (tile) { return tile === 1; }));
  assert.ok(stage.grid[stage.height - 1].every(function (tile) { return tile === 1; }));
  assert.ok(stage.grid.every(function (row) { return row[0] === 1 && row[stage.width - 1] === 1; }));

  const portal = findPortal(stage);
  assert.ok(portal);
  const reachable = flood(stage, { x: stage.playerStart.x, y: stage.playerStart.y });
  const openTileCount = stage.grid.flat().filter(function (tile) { return tile !== 1; }).length;
  assert.equal(reachable.size, openTileCount);
  stage.coins.concat([portal]).forEach(function (target) {
    assert.ok(reachable.has(key(target.x, target.y)));
  });
  stage.coins.forEach(function (coin, coinIndex) {
    stage.coins.slice(coinIndex + 1).forEach(function (other) {
      assert.ok(Math.abs(coin.x - other.x) + Math.abs(coin.y - other.y) >= 3);
    });
  });

  stage.puzzle.gates.forEach(function (gate) {
    assert.ok(stage.blocks.some(function (block) { return block.gravity === gate.gravity; }));
    const opening = [];
    if (gate.axis === 'vertical') {
      for (let y = gate.y; y <= gate.y + 12; y++) {
        if (stage.grid[y][gate.divider] !== 1) opening.push(y);
      }
    } else {
      for (let x = gate.x; x <= gate.x + 12; x++) {
        if (stage.grid[gate.divider][x] !== 1) opening.push(x);
      }
    }
    assert.equal(opening.length, 3, 'stage ' + stage.id + ' gravity ' + gate.gravity + ' opening');
    assert.equal(opening[2] - opening[0], 2);
    const support = gate.gravity === 0 ? gate.y + 12 :
      gate.gravity === 1 ? gate.x :
        gate.gravity === 2 ? gate.y : gate.x + 12;
    const riseWithoutBlock = gate.gravity === 0 || gate.gravity === 3 ?
      support - (opening[2] + 1) : opening[0] - (support + 1);
    assert.ok(riseWithoutBlock > MAX_JUMP_TILES);
    assert.ok(riseWithoutBlock - 1 <= MAX_JUMP_TILES);
    assert.equal(crossesGate(stage, gate, false), false, 'stage ' + stage.id + ' gravity ' + gate.gravity + ' bypass');
    assert.equal(crossesGate(stage, gate, true), true, 'stage ' + stage.id + ' gravity ' + gate.gravity + ' blocked');
  });

  if (stage.puzzle.narrowPassage) {
    const standing = flood(stage, stage.playerStart, 1, 2);
    assert.ok(!Array.from(standing.keys()).some(function (position) {
      return Number(position.split(',')[0]) >= stage.puzzle.narrowPassage.targetX;
    }));
    const crouchedCarry = flood(stage, {
      x: stage.playerStart.x,
      y: stage.puzzle.narrowPassage.y
    }, 2, 1);
    assert.ok(Array.from(crouchedCarry.keys()).some(function (position) {
      return Number(position.split(',')[0]) >= stage.puzzle.narrowPassage.targetX;
    }));
  }

  const score = minimumRoute(stage, [
    { x: stage.playerStart.x, y: stage.playerStart.y }
  ].concat(stage.coins, [portal]));
  assert.ok(Number.isFinite(score) && score > 20);

  const world = G.Main.init(stage);
  for (let frame = 0; frame < 240; frame++) G.Physics.update(1 / 60, world);
  assert.equal(world.player.grounded, true);
  assert.equal(entityOverlapsWall(stage, world.player), false);
  world.blocks.forEach(function (block) { assert.equal(entityOverlapsWall(stage, block), false); });

  if (stage.puzzle.type === 'drop') {
    assert.ok(stage.height >= 90 && stage.playerStart.y < 15 && portal.y > 80);
    assert.equal(stage.puzzle.baffles, 5);
  } else if (stage.puzzle.type === 'maze') {
    assert.ok(stage.puzzle.deadEnds >= 10);
  } else if (stage.puzzle.type === 'ceiling') {
    assert.equal(stage.blocks[0].gravity, 2);
  } else if (stage.puzzle.type === 'slalom') {
    assert.equal(stage.puzzle.baffles, 5);
    assert.ok(stage.coins.some(function (coin) { return coin.y < 6; }));
    assert.ok(stage.coins.some(function (coin) { return coin.y > 20; }));
  } else if (stage.puzzle.type === 'orbit') {
    assert.equal(stage.puzzle.rings, 2);
  } else if (stage.puzzle.type === 'construction') {
    assert.equal(stage.puzzle.gates.length, 4);
    assert.equal(stage.blocks.length, 4);
  } else if (stage.puzzle.type === 'relay') {
    assert.deepEqual(stage.puzzle.gates.map(function (gate) { return gate.gravity; }), [2, 1]);
  } else if (stage.puzzle.type === 'gauntlet') {
    assert.deepEqual(stage.puzzle.gates.map(function (gate) { return gate.gravity; }), [0, 1, 2, 3]);
  }

  console.log('stage ' + stage.id + ': ' + stage.puzzleType + ', route ' + score + ', gates ' + stage.puzzle.gates.length);
});

assert.equal(puzzleKinds.size, stages.length);
assert.equal(puzzleTypes.size, stages.length);
console.log('all gameplay types are distinct and every block gate is solvable');
