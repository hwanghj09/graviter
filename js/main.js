globalThis.G = globalThis.G || {};
var G = globalThis.G;

// G.Main — requestAnimationFrame game loop. Builds a world object from a
// stage-format object (see js/engine/grid.js for the exact stage format),
// and drives G.Physics.update / G.Camera.update / G.Renderer.draw each
// frame while not paused.
//
// Does NOT auto-start any real gameplay on normal page load — a later
// phase owns the menu-first bootstrap and will call G.Main.init itself.
// The only exception is the ?debug=1 self-test path at the bottom of this
// file, for engine verification during development.

let _world = null;
let _camera = null;
let _ctx = null;
let _animHandle = null;
let _paused = false;
let _lastTime = null;
let _canvasEl = null;
let _resizeBound = false;

function resizeCanvas() {
  if (!_canvasEl) return;
  const width = Math.round(_canvasEl.clientWidth);
  const height = Math.round(_canvasEl.clientHeight);
  if (width && height && (_canvasEl.width !== width || _canvasEl.height !== height)) {
    _canvasEl.width = width;
    _canvasEl.height = height;
  }
}

// Player spawn placement: playerStart {x,y} is the TOP-LEFT grid cell of
// the player's bounding box in its spawn gravity orientation (not its
// center tile) — this matters because the player's footprint is 1x2 or
// 2x1 tiles, not 1x1 like blocks/coins. Centering on a single tile's
// center would make the box straddle three tile-rows/cols instead of
// aligning cleanly to two, silently embedding the player in whatever is
// adjacent. The formula below (coord*TILE_SIZE + size/2) reduces to the
// familiar (coord+0.5)*TILE_SIZE on the 1-tile axis and to a proper
// two-tile span on the 2-tile axis.
function playerSpawnPixels(playerStart) {
  const TILE_SIZE = G.Grid.TILE_SIZE;
  const gravityIndex = playerStart.gravity || 0;
  const vertical = (gravityIndex === 0 || gravityIndex === 2);
  const w = vertical ? TILE_SIZE : TILE_SIZE * 2;
  const h = vertical ? TILE_SIZE * 2 : TILE_SIZE;
  return {
    px: playerStart.x * TILE_SIZE + w / 2,
    py: playerStart.y * TILE_SIZE + h / 2
  };
}

function buildWorld(stageData) {
  const TILE_SIZE = G.Grid.TILE_SIZE;

  const spawnPx = playerSpawnPixels(stageData.playerStart);
  const player = new G.Player({
    px: spawnPx.px,
    py: spawnPx.py,
    gravityIndex: stageData.playerStart.gravity || 0
  });

  const blocks = (stageData.blocks || []).map(function (b) {
    return new G.Block({
      px: (b.x + 0.5) * TILE_SIZE,
      py: (b.y + 0.5) * TILE_SIZE,
      gravityIndex: b.gravity || 0
    });
  });

  const coins = (stageData.coins || []).map(function (c) {
    return new G.Coin({
      px: (c.x + 0.5) * TILE_SIZE,
      py: (c.y + 0.5) * TILE_SIZE
    });
  });

  let portalPos = null;
  for (let row = 0; row < stageData.height && !portalPos; row++) {
    for (let col = 0; col < stageData.width; col++) {
      if (stageData.grid[row][col] === G.Grid.TILE.PORTAL) {
        portalPos = { x: col, y: row };
        break;
      }
    }
  }

  return {
    stageGrid: stageData.grid,
    width: stageData.width,
    height: stageData.height,
    player: player,
    blocks: blocks,
    coins: coins,
    portalPos: portalPos,
    stageId: stageData.id,
    isTutorial: !!stageData.isTutorial,
    cleared: false
  };
}

function loop(now) {
  if (typeof globalThis.requestAnimationFrame === 'function') {
    _animHandle = globalThis.requestAnimationFrame(loop);
  }
  if (_lastTime === null) _lastTime = now;
  const dt = (now - _lastTime) / 1000;
  _lastTime = now;

  if (_paused || !_world) return;

  const result = G.Physics.update(dt, _world);
  if (G.Tutorial && typeof G.Tutorial.update === 'function') G.Tutorial.update(_world);
  _camera.update(dt);
  if (_ctx) {
    G.Renderer.draw(_ctx, _world, _camera, dt);
  }

  if (result.cleared && !_world.cleared) {
    _world.cleared = true;
    if (typeof G.Main.onStageClear === 'function') {
      G.Main.onStageClear(_world.stageId);
    }
  }
}

function init(stageData) {
  _world = buildWorld(stageData);
  _camera = new G.Camera(_world.player);
  _paused = false;
  _lastTime = null;

  _ctx = null;
  if (typeof document !== 'undefined' && document.getElementById) {
    _canvasEl = document.getElementById('game-canvas');
    if (_canvasEl && _canvasEl.getContext) {
      _ctx = _canvasEl.getContext('2d');
      resizeCanvas();
      if (!_resizeBound && globalThis.addEventListener) {
        globalThis.addEventListener('resize', resizeCanvas);
        _resizeBound = true;
      }
    }
  }

  if (_animHandle !== null && typeof globalThis.cancelAnimationFrame === 'function') {
    globalThis.cancelAnimationFrame(_animHandle);
    _animHandle = null;
  }
  if (typeof globalThis.requestAnimationFrame === 'function') {
    _animHandle = globalThis.requestAnimationFrame(loop);
  }

  return _world;
}

function pause() {
  _paused = true;
}

function resume() {
  _paused = false;
  _lastTime = null; // avoid a huge dt spike across the paused gap
}

G.Main = {
  init: init,
  pause: pause,
  resume: resume,
  onStageClear: null,
  _getWorld: function () { return _world; },
  _getCamera: function () { return _camera; }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = G.Main;
}

// ---------------------------------------------------------------------
// Debug self-test: only runs when the page URL contains ?debug=1.
// Builds a small inline stage (matching the stage format) purely for
// manual end-to-end verification; this is NOT saved as a stage file.
// ---------------------------------------------------------------------
(function maybeAutoStartDebug() {
  if (typeof globalThis.location === 'undefined' || !globalThis.location.search) return;
  if (globalThis.location.search.indexOf('debug=1') === -1) return;
  if (typeof G.Grid === 'undefined') return;

  const TILE = G.Grid.TILE;
  const W = 12, H = 8;
  const grid = [];
  for (let row = 0; row < H; row++) {
    const r = [];
    for (let col = 0; col < W; col++) {
      const border = (row === 0 || row === H - 1 || col === 0 || col === W - 1);
      r.push(border ? TILE.WALL : TILE.EMPTY);
    }
    grid.push(r);
  }
  // a small ledge to jump onto, and the portal on top of it
  grid[H - 2][8] = TILE.WALL;
  grid[H - 3][8] = TILE.PORTAL;

  const debugStage = {
    id: 0,
    name: '디버그 테스트',
    width: W,
    height: H,
    grid: grid,
    coins: [
      { x: 3, y: H - 2 },
      { x: 6, y: H - 2 }
    ],
    blocks: [
      { x: 5, y: 3, gravity: 0 }
    ],
    // y is the TOP row of the player's 1x2 spawn bounding box (see
    // playerSpawnPixels above) — H-3/H-2 puts its feet exactly on the
    // floor (row H-1).
    playerStart: { x: 1, y: H - 3, gravity: 0 }
  };

  G.Main.init(debugStage);
})();
