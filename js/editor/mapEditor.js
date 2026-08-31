// Graviter map editor — a standalone tool, separate from the actual game.
// Paints a stage grid (wall/empty/portal), places coins/blocks/player start,
// and exports a stageXX.js file in exactly the format js/stages/*.js already
// uses, so the output can be dropped straight into that folder.
(function () {
  'use strict';

  const TILE = { EMPTY: 0, WALL: 1, PORTAL: 2 };
  const GRAVITY_ARROWS = ['↓', '←', '↑', '→']; // down, left, up, right
  const ZOOM_LEVELS = [6, 8, 10, 14, 18, 24, 32, 40, 50, 64];
  const DEFAULT_ZOOM_INDEX = 4; // 18px
  const MAX_HISTORY = 100;

  let width = 20;
  let height = 12;
  let grid = makeAllWall(width, height);
  let coins = [];
  let blocks = [];
  let playerStart = null;

  let currentTool = 'wall';
  let currentGravity = 0;
  let zoomIndex = DEFAULT_ZOOM_INDEX;
  let cellSize = ZOOM_LEVELS[DEFAULT_ZOOM_INDEX];
  let painting = false;

  let history = [];
  let redoStack = [];

  let canvas, ctx;

  function makeAllWall(w, h) {
    const g = [];
    for (let y = 0; y < h; y++) {
      const row = [];
      for (let x = 0; x < w; x++) row.push(TILE.WALL);
      g.push(row);
    }
    return g;
  }

  function inBounds(x, y) {
    return x >= 0 && y >= 0 && x < width && y < height;
  }

  function clampCoord(v, max) {
    return Math.max(0, Math.min(max - 1, v));
  }

  function findCoinAt(x, y) {
    return coins.findIndex(function (c) { return c.x === x && c.y === y; });
  }

  function findBlockAt(x, y) {
    return blocks.findIndex(function (b) { return b.x === x && b.y === y; });
  }

  // ---- undo/redo ----
  // One snapshot per discrete edit — a whole drag stroke (mousedown to
  // mouseup) counts as one, not one per cell — see strokeSaved below.
  function snapshotState() {
    return {
      width: width,
      height: height,
      grid: grid.map(function (row) { return row.slice(); }),
      coins: coins.map(function (c) { return { x: c.x, y: c.y }; }),
      blocks: blocks.map(function (b) { return { x: b.x, y: b.y, gravity: b.gravity }; }),
      playerStart: playerStart ? { x: playerStart.x, y: playerStart.y, gravity: playerStart.gravity } : null
    };
  }

  function restoreState(snap) {
    width = snap.width;
    height = snap.height;
    grid = snap.grid.map(function (row) { return row.slice(); });
    coins = snap.coins.map(function (c) { return { x: c.x, y: c.y }; });
    blocks = snap.blocks.map(function (b) { return { x: b.x, y: b.y, gravity: b.gravity }; });
    playerStart = snap.playerStart ? { x: snap.playerStart.x, y: snap.playerStart.y, gravity: snap.playerStart.gravity } : null;
    document.getElementById('grid-width').value = width;
    document.getElementById('grid-height').value = height;
    resizeCanvas();
    render();
    updateStats();
  }

  function pushHistory() {
    history.push(snapshotState());
    if (history.length > MAX_HISTORY) history.shift();
    redoStack = [];
  }

  function undo() {
    if (history.length === 0) return;
    redoStack.push(snapshotState());
    restoreState(history.pop());
  }

  function redo() {
    if (redoStack.length === 0) return;
    history.push(snapshotState());
    restoreState(redoStack.pop());
  }

  // ---- zoom ----
  function applyZoom() {
    cellSize = ZOOM_LEVELS[zoomIndex];
    const label = document.getElementById('zoom-label');
    if (label) label.textContent = cellSize + 'px';
    resizeCanvas();
    render();
  }

  function zoomIn() {
    zoomIndex = Math.min(ZOOM_LEVELS.length - 1, zoomIndex + 1);
    applyZoom();
  }

  function zoomOut() {
    zoomIndex = Math.max(0, zoomIndex - 1);
    applyZoom();
  }

  // Only base-tile tools support drag-painting a whole area; the
  // one-per-cell toggles (coin/block/player/portal) are click-only, since
  // dragging over them would just flip them back and forth.
  function isDraggableTool(tool) {
    return tool === 'wall' || tool === 'empty';
  }

  function applyTool(x, y) {
    if (!inBounds(x, y)) return;

    // Painting a base tile (wall/empty/portal) over a cell also clears any
    // coin or block sitting there — otherwise the eraser tool didn't
    // actually erase anything placed on top of the tile, and a wall could
    // end up with a coin/block silently buried inside it.
    function clearMarkersAt(cx, cy) {
      const coinIdx = findCoinAt(cx, cy);
      if (coinIdx !== -1) coins.splice(coinIdx, 1);
      const blockIdx = findBlockAt(cx, cy);
      if (blockIdx !== -1) blocks.splice(blockIdx, 1);
      if (playerStart && playerStart.x === cx && playerStart.y === cy) playerStart = null;
    }

    switch (currentTool) {
      case 'wall':
        grid[y][x] = TILE.WALL;
        clearMarkersAt(x, y);
        break;
      case 'empty':
        grid[y][x] = TILE.EMPTY;
        clearMarkersAt(x, y);
        break;
      case 'portal':
        // Keep it a single portal: clear any previous one first.
        for (let ry = 0; ry < height; ry++) {
          for (let rx = 0; rx < width; rx++) {
            if (grid[ry][rx] === TILE.PORTAL) grid[ry][rx] = TILE.EMPTY;
          }
        }
        grid[y][x] = TILE.PORTAL;
        clearMarkersAt(x, y);
        break;
      case 'coin': {
        const idx = findCoinAt(x, y);
        if (idx === -1) coins.push({ x: x, y: y }); else coins.splice(idx, 1);
        break;
      }
      case 'block': {
        const idx = findBlockAt(x, y);
        if (idx === -1) blocks.push({ x: x, y: y, gravity: currentGravity }); else blocks.splice(idx, 1);
        break;
      }
      case 'player':
        playerStart = { x: x, y: y, gravity: currentGravity };
        break;
      default:
        break;
    }
    render();
    updateStats();
  }

  function resizeGrid(newW, newH) {
    pushHistory();
    const newGrid = makeAllWall(newW, newH);
    const copyW = Math.min(width, newW);
    const copyH = Math.min(height, newH);
    for (let y = 0; y < copyH; y++) {
      for (let x = 0; x < copyW; x++) {
        newGrid[y][x] = grid[y][x];
      }
    }
    grid = newGrid;
    width = newW;
    height = newH;
    coins = coins.filter(function (c) { return c.x < newW && c.y < newH; });
    blocks = blocks.filter(function (b) { return b.x < newW && b.y < newH; });
    if (playerStart && (playerStart.x >= newW || playerStart.y >= newH)) playerStart = null;
    resizeCanvas();
    render();
    updateStats();
  }

  function clearGrid() {
    pushHistory();
    grid = makeAllWall(width, height);
    coins = [];
    blocks = [];
    playerStart = null;
    render();
    updateStats();
  }

  // Room-based maze (recursive backtracker over a grid of rooms, not single
  // tiles) fit to the CURRENT width/height exactly as set above. Each maze
  // "node" is a ROOM_SIZE x ROOM_SIZE open room spaced CELL_SIZE apart
  // (CELL_SIZE - ROOM_SIZE = 1 tile of wall between neighbors); connecting
  // two rooms opens the FULL seam between them, not just a narrow doorway,
  // so linked rooms read as one big open space. Same room/gap proportions
  // the game's own generated stages use (js/stages/puzzleStage.js).
  const CELL_SIZE = 5;
  const ROOM_SIZE = 4;

  function generateRandomMaze() {
    const nodeCols = Math.max(1, Math.floor((width - 1) / CELL_SIZE));
    const nodeRows = Math.max(1, Math.floor((height - 1) / CELL_SIZE));

    function nodeOrigin(i, j) {
      return { x: i * CELL_SIZE + 1, y: j * CELL_SIZE + 1 }; // room's top-left corner
    }
    function nodeCenter(i, j) {
      // Clamped to whatever actually got carved for this room — on a grid
      // too small to fit a full ROOM_SIZE room, carveRoom below silently
      // clips at the border, and the naive center would otherwise land
      // outside the grid entirely (and outside that clipped carve).
      const o = nodeOrigin(i, j);
      const lastCarvedX = Math.min(o.x + ROOM_SIZE, width - 1) - 1;
      const lastCarvedY = Math.min(o.y + ROOM_SIZE, height - 1) - 1;
      return {
        x: Math.max(o.x, Math.min(o.x + Math.floor(ROOM_SIZE / 2), lastCarvedX)),
        y: Math.max(o.y, Math.min(o.y + Math.floor(ROOM_SIZE / 2), lastCarvedY))
      };
    }

    const newGrid = makeAllWall(width, height);
    const visited = [];
    const dist = [];
    for (let j = 0; j < nodeRows; j++) {
      visited.push(new Array(nodeCols).fill(false));
      dist.push(new Array(nodeCols).fill(-1));
    }

    function carveRoom(i, j) {
      const o = nodeOrigin(i, j);
      for (let ry = o.y; ry < o.y + ROOM_SIZE && ry < height - 1; ry++) {
        for (let rx = o.x; rx < o.x + ROOM_SIZE && rx < width - 1; rx++) {
          newGrid[ry][rx] = TILE.EMPTY;
        }
      }
    }

    // Opens the whole wall seam between two adjacent rooms (not a narrow
    // doorway), merging them into one continuous space.
    function carveSeam(i1, j1, i2, j2) {
      const a = nodeOrigin(i1, j1);
      if (j1 === j2) {
        // horizontal neighbors: seam is the single column right after the
        // left room, spanning that room's full height.
        const leftI = Math.min(i1, i2);
        const seamX = nodeOrigin(leftI, j1).x + ROOM_SIZE;
        if (seamX >= width - 1) return;
        for (let dy = 0; dy < ROOM_SIZE && a.y + dy < height - 1; dy++) newGrid[a.y + dy][seamX] = TILE.EMPTY;
      } else {
        const topJ = Math.min(j1, j2);
        const seamY = nodeOrigin(i1, topJ).y + ROOM_SIZE;
        if (seamY >= height - 1) return;
        for (let dx = 0; dx < ROOM_SIZE && a.x + dx < width - 1; dx++) newGrid[seamY][a.x + dx] = TILE.EMPTY;
      }
    }

    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    carveRoom(0, 0);
    visited[0][0] = true;
    dist[0][0] = 0;
    const stack = [[0, 0]];
    while (stack.length) {
      const cur = stack[stack.length - 1];
      const ci = cur[0], cj = cur[1];
      const choices = [];
      dirs.forEach(function (d) {
        const ni = ci + d[0], nj = cj + d[1];
        if (ni >= 0 && ni < nodeCols && nj >= 0 && nj < nodeRows && !visited[nj][ni]) choices.push([ni, nj]);
      });
      if (choices.length === 0) { stack.pop(); continue; }
      const pick = choices[Math.floor(Math.random() * choices.length)];
      const ni = pick[0], nj = pick[1];
      visited[nj][ni] = true;
      dist[nj][ni] = dist[cj][ci] + 1;
      carveRoom(ni, nj);
      carveSeam(ci, cj, ni, nj);
      stack.push([ni, nj]);
    }

    let farthest = { i: 0, j: 0, d: 0 };
    const allNodes = [];
    for (let j = 0; j < nodeRows; j++) {
      for (let i = 0; i < nodeCols; i++) {
        if (dist[j][i] < 0) continue;
        allNodes.push({ i: i, j: j, d: dist[j][i] });
        if (dist[j][i] > farthest.d) farthest = { i: i, j: j, d: dist[j][i] };
      }
    }
    const portalPos = nodeCenter(farthest.i, farthest.j);
    newGrid[portalPos.y][portalPos.x] = TILE.PORTAL;

    // Spread coins across the maze by distance rank (not purely random) so
    // they don't clump near the start, then a couple of blocks on whatever
    // is left over.
    const used = new Set(['0,0', farthest.i + ',' + farthest.j]);
    allNodes.sort(function (a, b) { return a.d - b.d; });
    let candidates = allNodes.filter(function (n) { return !used.has(n.i + ',' + n.j); });

    const newCoins = [];
    // Rooms are much coarser than the old thin-corridor nodes were, so aim
    // for roughly half the available rooms getting a coin (still capped at
    // 5) instead of the old /4 ratio, which starved small room-mazes down
    // to a single coin.
    const coinCount = candidates.length > 0 ? Math.max(1, Math.min(5, Math.ceil(candidates.length / 2))) : 0;
    for (let k = 0; k < coinCount && candidates.length > 0; k++) {
      const idx = Math.min(candidates.length - 1, Math.floor((k + 0.5) * candidates.length / coinCount));
      const n = candidates[idx];
      used.add(n.i + ',' + n.j);
      const p = nodeCenter(n.i, n.j);
      newCoins.push({ x: p.x, y: p.y });
    }
    candidates = candidates.filter(function (n) { return !used.has(n.i + ',' + n.j); });

    const newBlocks = [];
    const blockCount = Math.min(2, Math.floor(candidates.length / 6));
    for (let k = 0; k < blockCount && candidates.length > 0; k++) {
      const pickIdx = Math.floor(Math.random() * candidates.length);
      const n = candidates.splice(pickIdx, 1)[0];
      const p = nodeCenter(n.i, n.j);
      newBlocks.push({ x: p.x, y: p.y, gravity: 0 });
    }

    const startPos = nodeCenter(0, 0);
    pushHistory();
    grid = newGrid;
    coins = newCoins;
    blocks = newBlocks;
    playerStart = { x: startPos.x, y: startPos.y, gravity: 0 };
    resizeCanvas();
    render();
    updateStats();
  }

  function resizeCanvas() {
    canvas.width = width * cellSize;
    canvas.height = height * cellSize;
  }

  function drawGravityArrow(x, y, gravity, color) {
    ctx.fillStyle = color;
    ctx.font = Math.max(8, Math.floor(cellSize * 0.6)) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(GRAVITY_ARROWS[gravity] || GRAVITY_ARROWS[0], (x + 0.5) * cellSize, (y + 0.5) * cellSize);
  }

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const t = grid[y][x];
        ctx.fillStyle = t === TILE.WALL ? '#111318' : (t === TILE.PORTAL ? '#2f6fb3' : '#2a2e35');
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
      }
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= width; x++) {
      ctx.beginPath();
      ctx.moveTo(x * cellSize + 0.5, 0);
      ctx.lineTo(x * cellSize + 0.5, height * cellSize);
      ctx.stroke();
    }
    for (let y = 0; y <= height; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * cellSize + 0.5);
      ctx.lineTo(width * cellSize, y * cellSize + 0.5);
      ctx.stroke();
    }

    ctx.fillStyle = '#ffd400';
    coins.forEach(function (c) {
      ctx.beginPath();
      ctx.arc((c.x + 0.5) * cellSize, (c.y + 0.5) * cellSize, cellSize * 0.28, 0, Math.PI * 2);
      ctx.fill();
    });

    blocks.forEach(function (b) {
      const pad = cellSize * 0.12;
      ctx.fillStyle = '#8a8a8a';
      ctx.fillRect(b.x * cellSize + pad, b.y * cellSize + pad, cellSize - pad * 2, cellSize - pad * 2);
      drawGravityArrow(b.x, b.y, b.gravity, '#111318');
    });

    if (playerStart) {
      ctx.fillStyle = '#4fb8e8';
      ctx.beginPath();
      ctx.arc((playerStart.x + 0.5) * cellSize, (playerStart.y + 0.5) * cellSize, cellSize * 0.38, 0, Math.PI * 2);
      ctx.fill();
      drawGravityArrow(playerStart.x, playerStart.y, playerStart.gravity, '#04202b');
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function updateStats() {
    let portalCount = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (grid[y][x] === TILE.PORTAL) portalCount++;
      }
    }

    const list = document.getElementById('stats-list');
    list.innerHTML =
      '<li>크기: <b>' + width + ' x ' + height + '</b></li>' +
      '<li>코인: <b>' + coins.length + '</b>개</li>' +
      '<li>블럭: <b>' + blocks.length + '</b>개</li>' +
      '<li>포탈: <b>' + portalCount + '</b>개</li>' +
      '<li>플레이어 시작: <b>' + (playerStart ? ('(' + playerStart.x + ', ' + playerStart.y + ')') : '미설정') + '</b></li>';

    const warnings = [];
    if (portalCount === 0) warnings.push('포탈이 없어요.');
    if (portalCount > 1) warnings.push('포탈이 2개 이상이에요. 1개만 있어야 해요.');
    if (!playerStart) warnings.push('플레이어 시작 지점이 없어요.');
    if (playerStart && grid[playerStart.y][playerStart.x] === TILE.WALL) {
      warnings.push('플레이어 시작 지점이 벽 위에 있어요.');
    }
    coins.forEach(function (c, i) {
      if (grid[c.y][c.x] === TILE.WALL) warnings.push('코인 #' + (i + 1) + '이 벽 위에 있어요.');
    });
    blocks.forEach(function (b, i) {
      if (grid[b.y][b.x] === TILE.WALL) warnings.push('블럭 #' + (i + 1) + '이 벽 위에 있어요.');
    });

    document.getElementById('warnings').innerHTML = warnings
      .map(function (w) { return '<div class="warn-item">⚠ ' + escapeHtml(w) + '</div>'; })
      .join('');
  }

  // Basic tile-adjacency flood fill from the player start — the same
  // approximation used elsewhere in this project's map-testing workflow.
  // Deliberately NOT a full solvability check: it ignores the real 2-tile
  // player hitbox, jump height/gravity direction, and crouch-only gaps, so
  // a stage can pass this and still need a crouch or a rotation to actually
  // finish. Treat it as "definitely broken" vs "worth playtesting", not
  // "guaranteed clearable".
  function checkConnectivity() {
    const resultEl = document.getElementById('connectivity-result');
    if (!playerStart) {
      resultEl.className = 'warn';
      resultEl.textContent = '플레이어 시작 지점을 먼저 설정하세요.';
      return;
    }

    const seen = new Set();
    const startKey = playerStart.x + ',' + playerStart.y;
    seen.add(startKey);
    const queue = [[playerStart.x, playerStart.y]];
    let qi = 0;
    while (qi < queue.length) {
      const cur = queue[qi++];
      const x = cur[0], y = cur[1];
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
        const nx = x + d[0], ny = y + d[1];
        if (!inBounds(nx, ny)) return;
        if (grid[ny][nx] === TILE.WALL) return;
        const key = nx + ',' + ny;
        if (seen.has(key)) return;
        seen.add(key);
        queue.push([nx, ny]);
      });
    }

    const unreachableCoins = coins.filter(function (c) { return !seen.has(c.x + ',' + c.y); });
    let portalReachable = false;
    for (let y = 0; y < height && !portalReachable; y++) {
      for (let x = 0; x < width; x++) {
        if (grid[y][x] === TILE.PORTAL && seen.has(x + ',' + y)) { portalReachable = true; break; }
      }
    }

    const lines = [];
    lines.push('도달 가능한 빈 칸: ' + seen.size + '개');
    lines.push(portalReachable ? '포탈: 도달 가능 ✓' : '포탈: 도달 불가 ✗');
    if (unreachableCoins.length > 0) lines.push('도달 불가능한 코인: ' + unreachableCoins.length + '개');
    lines.push('⚠ 이 체크는 타일이 서로 붙어 있는지만 봐요 (2칸 히트박스, 점프 높이, 웅크리기 통로는 반영 안 됨) — 실제로 클리어 가능한지의 보증은 아니에요.');

    resultEl.className = (portalReachable && unreachableCoins.length === 0) ? 'ok' : 'warn';
    resultEl.innerHTML = lines.map(escapeHtml).join('<br>');
  }

  function pad2(n) {
    const s = String(n);
    return s.length < 2 ? '0' + s : s;
  }

  function generateCode() {
    const id = parseInt(document.getElementById('stage-id').value, 10) || 1;
    const varName = 'stage' + pad2(id);
    const code =
      'globalThis.G = globalThis.G || {};\n' +
      'var G = globalThis.G;\n\n' +
      'G.Stages = G.Stages || [];\n\n' +
      'const ' + varName + ' = {\n' +
      '  id: ' + id + ',\n' +
      '  width: ' + width + ',\n' +
      '  height: ' + height + ',\n' +
      '  grid: ' + JSON.stringify(grid) + ',\n' +
      '  coins: ' + JSON.stringify(coins) + ',\n' +
      '  blocks: ' + JSON.stringify(blocks) + ',\n' +
      '  playerStart: ' + JSON.stringify(playerStart || { x: 0, y: 0, gravity: 0 }) + '\n' +
      '};\n\n' +
      'G.Stages.push(' + varName + ');\n\n' +
      'if (typeof module !== \'undefined\' && module.exports) {\n' +
      '  module.exports = ' + varName + ';\n' +
      '}\n';
    document.getElementById('export-code').value = code;
    return { code: code, id: id };
  }

  function downloadCode() {
    const generated = generateCode();
    const blob = new Blob([generated.code], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'stage' + pad2(generated.id) + '.js';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function fallbackCopy(text) {
    const ta = document.getElementById('export-code');
    ta.value = text;
    ta.focus();
    ta.select();
    try { document.execCommand('copy'); } catch (e) { /* best-effort only */ }
  }

  function copyCode() {
    const generated = generateCode();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(generated.code).catch(function () { fallbackCopy(generated.code); });
    } else {
      fallbackCopy(generated.code);
    }
  }

  // Runs the whole pasted file in an isolated scope (own fake `globalThis`)
  // rather than regex-extracting the object literal, since real stage files
  // vary — some inline the grid array, some build it in a separate
  // `const fooGrid = [...]` referenced by name — and only actually running
  // the code handles both correctly.
  function importFromText(text) {
    const resultEl = document.getElementById('import-result');
    try {
      const fakeGlobalThis = {};
      const runner = new Function('globalThis', text);
      runner(fakeGlobalThis);
      const stages = fakeGlobalThis.G && fakeGlobalThis.G.Stages;
      if (!stages || !stages.length) throw new Error('G.Stages에 스테이지가 push되지 않았어요.');
      const obj = stages[stages.length - 1];
      if (!obj || !Array.isArray(obj.grid) || !obj.grid.length) throw new Error('grid 배열을 찾을 수 없어요.');

      pushHistory();
      width = obj.width || obj.grid[0].length;
      height = obj.height || obj.grid.length;
      grid = obj.grid.map(function (row) { return row.slice(); });
      coins = Array.isArray(obj.coins) ? obj.coins.map(function (c) { return { x: c.x, y: c.y }; }) : [];
      blocks = Array.isArray(obj.blocks)
        ? obj.blocks.map(function (b) { return { x: b.x, y: b.y, gravity: b.gravity || 0 }; })
        : [];
      playerStart = obj.playerStart
        ? { x: obj.playerStart.x, y: obj.playerStart.y, gravity: obj.playerStart.gravity || 0 }
        : null;

      if (typeof obj.id === 'number') document.getElementById('stage-id').value = obj.id;
      document.getElementById('grid-width').value = width;
      document.getElementById('grid-height').value = height;

      resizeCanvas();
      render();
      updateStats();
      resultEl.className = 'ok';
      resultEl.textContent = '불러오기 성공 (' + width + ' x ' + height + ', 코인 ' + coins.length + '개, 블럭 ' + blocks.length + '개).';
    } catch (err) {
      resultEl.className = 'warn';
      resultEl.textContent = '불러오기 실패: ' + err.message;
    }
  }

  function cellFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    return {
      x: clampCoord(Math.floor(px / cellSize), width),
      y: clampCoord(Math.floor(py / cellSize), height)
    };
  }

  function setActiveButton(groupSelector, attr, value) {
    document.querySelectorAll(groupSelector).forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute(attr) === String(value));
    });
  }

  function init() {
    canvas = document.getElementById('editor-canvas');
    ctx = canvas.getContext('2d');
    resizeCanvas();
    render();
    updateStats();
    setActiveButton('.tool-btn', 'data-tool', currentTool);
    setActiveButton('.gravity-btn', 'data-gravity', currentGravity);

    canvas.addEventListener('mousedown', function (e) {
      painting = true;
      pushHistory(); // one snapshot for the whole stroke, taken before its first cell
      const cell = cellFromEvent(e);
      applyTool(cell.x, cell.y);
    });
    canvas.addEventListener('mousemove', function (e) {
      if (!painting || !isDraggableTool(currentTool)) return;
      const cell = cellFromEvent(e);
      applyTool(cell.x, cell.y);
    });
    window.addEventListener('mouseup', function () { painting = false; });
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    document.querySelectorAll('.tool-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        currentTool = btn.getAttribute('data-tool');
        setActiveButton('.tool-btn', 'data-tool', currentTool);
      });
    });

    document.querySelectorAll('.gravity-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        currentGravity = parseInt(btn.getAttribute('data-gravity'), 10);
        setActiveButton('.gravity-btn', 'data-gravity', currentGravity);
      });
    });

    document.getElementById('btn-resize').addEventListener('click', function () {
      const newW = Math.max(3, parseInt(document.getElementById('grid-width').value, 10) || width);
      const newH = Math.max(3, parseInt(document.getElementById('grid-height').value, 10) || height);
      resizeGrid(newW, newH);
    });

    document.getElementById('btn-clear').addEventListener('click', function () {
      if (globalThis.confirm && !globalThis.confirm('현재 맵을 전부 지우고 벽으로 초기화할까요?')) return;
      clearGrid();
    });

    document.getElementById('btn-random-maze').addEventListener('click', function () {
      if (globalThis.confirm && !globalThis.confirm('현재 맵을 지우고 랜덤 미로를 생성할까요?')) return;
      generateRandomMaze();
    });

    document.getElementById('btn-undo').addEventListener('click', undo);
    document.getElementById('btn-redo').addEventListener('click', redo);
    document.getElementById('btn-zoom-in').addEventListener('click', zoomIn);
    document.getElementById('btn-zoom-out').addEventListener('click', zoomOut);
    applyZoom(); // sync the zoom-label text to the initial cellSize

    document.getElementById('btn-check').addEventListener('click', checkConnectivity);
    document.getElementById('btn-generate').addEventListener('click', generateCode);
    document.getElementById('btn-download').addEventListener('click', downloadCode);
    document.getElementById('btn-copy').addEventListener('click', copyCode);
    document.getElementById('btn-import').addEventListener('click', function () {
      importFromText(document.getElementById('import-code').value);
    });

    document.addEventListener('keydown', handleKeydown);
  }

  function isTypingTarget(el) {
    if (!el) return false;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  }

  const TOOL_KEYS = { '1': 'wall', '2': 'empty', '3': 'portal', '4': 'coin', '5': 'block', '6': 'player' };
  const GRAVITY_KEYS = { ArrowDown: 0, ArrowLeft: 1, ArrowUp: 2, ArrowRight: 3 };

  function handleKeydown(e) {
    // Ctrl/Cmd+S — save (download) — intercepted even while typing, so it
    // never triggers the browser's native "save page" dialog.
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      downloadCode();
      return;
    }

    if (isTypingTarget(document.activeElement)) return; // let every other shortcut fall through to normal typing

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) redo(); else undo();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      redo();
      return;
    }

    if ((e.key === '+' || e.key === '=') ) {
      e.preventDefault();
      zoomIn();
      return;
    }
    if (e.key === '-' || e.key === '_') {
      e.preventDefault();
      zoomOut();
      return;
    }

    if (TOOL_KEYS[e.key]) {
      currentTool = TOOL_KEYS[e.key];
      setActiveButton('.tool-btn', 'data-tool', currentTool);
      return;
    }

    if (GRAVITY_KEYS[e.key] !== undefined) {
      e.preventDefault(); // avoid scrolling the page/grid-wrap container
      currentGravity = GRAVITY_KEYS[e.key];
      setActiveButton('.gravity-btn', 'data-gravity', currentGravity);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
