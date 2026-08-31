globalThis.G = globalThis.G || {};
var G = globalThis.G;

(function () {
  function makeGrid(width, height) {
    return Array.from({ length: height }, function () { return Array(width).fill(1); });
  }

  function carve(grid, x1, y1, x2, y2) {
    for (let y = y1; y <= y2; y++) grid[y].fill(0, x1, x2 + 1);
  }

  function wall(grid, x1, y1, x2, y2) {
    for (let y = y1; y <= y2; y++) grid[y].fill(1, x1, x2 + 1);
  }

  function stepGate(grid, x, y, gravity) {
    if (gravity === 0 || gravity === 2) {
      carve(grid, x + 1, y + 1, x + 6, y + 11);
      carve(grid, x + 8, y + 1, x + 11, y + 11);
      carve(grid, x + 7, y + 5, x + 7, y + 7);
      return { axis: 'vertical', x: x, y: y, divider: x + 7, gravity: gravity };
    }
    carve(grid, x + 1, y + 1, x + 11, y + 6);
    carve(grid, x + 1, y + 8, x + 11, y + 11);
    carve(grid, x + 5, y + 7, x + 7, y + 7);
    return { axis: 'horizontal', x: x, y: y, divider: y + 7, gravity: gravity };
  }

  function setPortal(grid, point) {
    grid[point.y][point.x] = 2;
    return point;
  }

  function finish(config, data) {
    data.id = config.id;
    data.name = config.name;
    data.puzzleType = config.puzzleType;
    data.puzzle.type = config.type;
    return data;
  }

  function platformStage(config) {
    const width = 72;
    const height = 20;
    const grid = makeGrid(width, height);
    carve(grid, 1, 4, 57, 18);
    wall(grid, 13, 16, 21, 18);
    wall(grid, 34, 14, 41, 18);
    const gate = stepGate(grid, 58, 6, 0);
    carve(grid, 57, 15, 59, 17);
    const portal = setPortal(grid, { x: 69, y: 17 });
    return finish(config, {
      width: width, height: height, grid: grid,
      coins: [{ x: 17, y: 15 }, { x: 37, y: 13 }, { x: 67, y: 17 }],
      blocks: [{ x: 6, y: 18, gravity: 0 }],
      playerStart: { x: 3, y: 17, gravity: 0 },
      puzzle: { gates: [gate], portal: portal, features: ['platforms'] }
    });
  }

  function tutorialStage(config) {
    const width = 60;
    const height = 18;
    const grid = makeGrid(width, height);
    carve(grid, 1, 1, 45, 16);
    wall(grid, 10, 15, 12, 16);
    wall(grid, 28, 7, 31, 16);
    const gate = stepGate(grid, 46, 5, 0);
    carve(grid, 45, 14, 47, 16);
    const portal = setPortal(grid, { x: 57, y: 16 });
    const stage = finish(config, {
      width: width, height: height, grid: grid,
      coins: [{ x: 17, y: 16 }, { x: 55, y: 16 }],
      blocks: [{ x: 22, y: 16, gravity: 0 }],
      playerStart: { x: 3, y: 15, gravity: 0 },
      puzzle: { gates: [gate], portal: portal, features: ['tutorial'] }
    });
    stage.isTutorial = true;
    return stage;
  }

  function dropStage(config) {
    const width = 30;
    const height = 92;
    const grid = makeGrid(width, height);
    carve(grid, 1, 1, 28, 77);
    [14, 27, 40, 53, 66].forEach(function (y, index) {
      wall(grid, 1, y, 28, y);
      if (index % 2 === 0) carve(grid, 24, y, 27, y);
      else carve(grid, 2, y, 5, y);
    });
    const gate = stepGate(grid, 16, 78, 0);
    carve(grid, 18, 77, 20, 79);
    const portal = setPortal(grid, { x: 27, y: 89 });
    return finish(config, {
      width: width, height: height, grid: grid,
      coins: [
        { x: 25, y: 16 }, { x: 4, y: 29 }, { x: 25, y: 42 },
        { x: 4, y: 55 }, { x: 25, y: 89 }
      ],
      blocks: [{ x: 19, y: 89, gravity: 0 }],
      playerStart: { x: 4, y: 12, gravity: 0 },
      puzzle: { gates: [gate], portal: portal, features: ['drop'], baffles: 5 }
    });
  }

  function mazeStage(config) {
    const cols = 17;
    const rows = 9;
    const routeWidth = cols * 5 + 1;
    const height = rows * 5 + 1;
    const width = routeWidth + 13;
    const grid = makeGrid(width, height);
    const visited = new Set(['0,' + (rows - 1)]);
    const edges = [];
    const stack = [{ x: 0, y: rows - 1 }];
    let seed = config.seed >>> 0;

    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) carve(grid, cx * 5 + 1, cy * 5 + 1, cx * 5 + 4, cy * 5 + 4);
    }
    while (stack.length) {
      const current = stack[stack.length - 1];
      const choices = [[1, 0], [0, -1], [-1, 0], [0, 1]].map(function (d) {
        return { x: current.x + d[0], y: current.y + d[1] };
      }).filter(function (next) {
        return next.x >= 0 && next.x < cols && next.y >= 0 && next.y < rows &&
          !visited.has(next.x + ',' + next.y);
      });
      if (!choices.length) {
        stack.pop();
        continue;
      }
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const next = choices[seed % choices.length];
      edges.push([current, next]);
      if (current.y === next.y) {
        const x = (Math.min(current.x, next.x) + 1) * 5;
        carve(grid, x, current.y * 5 + 2, x, current.y * 5 + 4);
      } else {
        const y = (Math.min(current.y, next.y) + 1) * 5;
        carve(grid, current.x * 5 + 2, y, current.x * 5 + 4, y);
      }
      visited.add(next.x + ',' + next.y);
      stack.push(next);
    }

    const gate = stepGate(grid, routeWidth - 1, height - 13, 0);
    carve(grid, routeWidth - 1, height - 4, routeWidth, height - 2);
    const portal = setPortal(grid, { x: width - 2, y: height - 2 });
    const degree = new Map();
    edges.forEach(function (edge) {
      edge.forEach(function (cell) {
        const key = cell.x + ',' + cell.y;
        degree.set(key, (degree.get(key) || 0) + 1);
      });
    });
    return finish(config, {
      width: width, height: height, grid: grid,
      coins: [
        { x: 2, y: 2 }, { x: cols * 5 - 3, y: 2 },
        { x: Math.floor(cols / 2) * 5 + 2, y: Math.floor(rows / 2) * 5 + 2 },
        { x: cols * 5 - 3, y: height - 3 }, { x: width - 4, y: height - 2 }
      ],
      blocks: [{ x: 1, y: height - 2, gravity: 0 }],
      playerStart: { x: 3, y: height - 3, gravity: 0 },
      puzzle: {
        gates: [gate], portal: portal, features: ['maze'],
        deadEnds: Array.from(degree.values()).filter(function (value) { return value === 1; }).length
      }
    });
  }

  function ceilingStage(config) {
    const width = 84;
    const height = 22;
    const grid = makeGrid(width, height);
    carve(grid, 1, 1, 69, 20);
    wall(grid, 16, 7, 19, 20);
    wall(grid, 32, 5, 35, 20);
    wall(grid, 48, 8, 51, 20);
    const gate = stepGate(grid, 70, 4, 2);
    carve(grid, 69, 5, 71, 7);
    const portal = setPortal(grid, { x: 81, y: 5 });
    return finish(config, {
      width: width, height: height, grid: grid,
      coins: [{ x: 12, y: 3 }, { x: 27, y: 3 }, { x: 43, y: 3 }, { x: 60, y: 3 }, { x: 79, y: 5 }],
      blocks: [{ x: 6, y: 1, gravity: 2 }],
      playerStart: { x: 3, y: 19, gravity: 0 },
      puzzle: { gates: [gate], portal: portal, features: ['ceiling'], baffles: 3 }
    });
  }

  function crawlStage(config) {
    const width = 88;
    const height = 20;
    const grid = makeGrid(width, height);
    carve(grid, 1, 5, 14, 18);
    carve(grid, 15, 18, 66, 18);
    carve(grid, 67, 5, 73, 18);
    const gate = stepGate(grid, 74, 6, 0);
    carve(grid, 73, 15, 75, 17);
    const portal = setPortal(grid, { x: 85, y: 17 });
    return finish(config, {
      width: width, height: height, grid: grid,
      coins: [{ x: 25, y: 18 }, { x: 40, y: 18 }, { x: 55, y: 18 }, { x: 83, y: 17 }],
      blocks: [{ x: 6, y: 18, gravity: 0 }],
      playerStart: { x: 3, y: 17, gravity: 0 },
      puzzle: {
        gates: [gate], portal: portal, features: ['crawl'],
        narrowPassage: { startX: 15, endX: 66, y: 18, targetX: 67 }
      }
    });
  }

  function slalomStage(config) {
    const width = 112;
    const height = 30;
    const grid = makeGrid(width, height);
    carve(grid, 1, 1, 97, 28);
    [16, 32, 48, 64, 80].forEach(function (x, index) {
      if (index % 2 === 0) wall(grid, x, 1, x + 2, 21);
      else wall(grid, x, 8, x + 2, 28);
    });
    const gate = stepGate(grid, 98, 16, 0);
    carve(grid, 97, 25, 99, 27);
    const portal = setPortal(grid, { x: 109, y: 27 });
    return finish(config, {
      width: width, height: height, grid: grid,
      coins: [
        { x: 22, y: 25 }, { x: 38, y: 4 }, { x: 54, y: 25 },
        { x: 70, y: 4 }, { x: 107, y: 27 }
      ],
      blocks: [{ x: 6, y: 28, gravity: 0 }],
      playerStart: { x: 3, y: 27, gravity: 0 },
      puzzle: { gates: [gate], portal: portal, features: ['slalom'], baffles: 5 }
    });
  }

  function orbitStage(config) {
    const width = 110;
    const height = 64;
    const grid = makeGrid(width, height);
    carve(grid, 2, 2, 93, 6);
    carve(grid, 2, 57, 93, 61);
    carve(grid, 2, 2, 6, 61);
    carve(grid, 89, 2, 93, 61);
    carve(grid, 20, 15, 75, 19);
    carve(grid, 20, 44, 75, 48);
    carve(grid, 20, 15, 24, 48);
    carve(grid, 71, 15, 75, 48);
    carve(grid, 6, 44, 20, 48);
    carve(grid, 75, 15, 89, 19);
    carve(grid, 37, 27, 58, 36);
    carve(grid, 24, 29, 37, 33);
    const gate = stepGate(grid, 95, 49, 0);
    carve(grid, 89, 58, 96, 60);
    const portal = setPortal(grid, { x: 106, y: 60 });
    return finish(config, {
      width: width, height: height, grid: grid,
      coins: [
        { x: 90, y: 4 }, { x: 47, y: 17 }, { x: 48, y: 31 },
        { x: 22, y: 46 }, { x: 104, y: 60 }
      ],
      blocks: [{ x: 8, y: 61, gravity: 0 }],
      playerStart: { x: 4, y: 60, gravity: 0 },
      puzzle: { gates: [gate], portal: portal, features: ['orbit'], rings: 2 }
    });
  }

  function constructionStage(config) {
    const width = 62;
    const height = 15;
    const grid = makeGrid(width, height);
    const gates = [1, 16, 31, 46].map(function (x) { return stepGate(grid, x, 1, 0); });
    for (let index = 0; index < gates.length - 1; index++) {
      carve(grid, gates[index].x + 12, 10, gates[index + 1].x + 1, 12);
    }
    const portal = setPortal(grid, { x: 57, y: 12 });
    return finish(config, {
      width: width, height: height, grid: grid,
      coins: [{ x: 10, y: 12 }, { x: 25, y: 12 }, { x: 40, y: 12 }, { x: 55, y: 12 }],
      blocks: [5, 20, 35, 50].map(function (x) { return { x: x, y: 12, gravity: 0 }; }),
      playerStart: { x: 3, y: 11, gravity: 0 },
      puzzle: { gates: gates, portal: portal, features: ['construction'] }
    });
  }

  function relayStage(config) {
    const width = 41;
    const height = 34;
    const grid = makeGrid(width, height);
    const firstGate = stepGate(grid, 1, 1, 2);
    const secondGate = stepGate(grid, 27, 20, 1);
    carve(grid, 12, 5, 37, 7);
    carve(grid, 34, 5, 37, 22);
    const portal = setPortal(grid, { x: 28, y: 31 });
    return finish(config, {
      width: width, height: height, grid: grid,
      coins: [{ x: 10, y: 2 }, { x: 35, y: 14 }, { x: 30, y: 30 }],
      blocks: [{ x: 4, y: 2, gravity: 2 }, { x: 28, y: 23, gravity: 1 }],
      playerStart: { x: 3, y: 11, gravity: 0 },
      puzzle: { gates: [firstGate, secondGate], portal: portal, features: ['relay'] }
    });
  }

  function gauntletStage(config) {
    const width = 50;
    const height = 34;
    const grid = makeGrid(width, height);
    const gates = [
      stepGate(grid, 1, 1, 0),
      stepGate(grid, 18, 4, 1),
      stepGate(grid, 18, 18, 2),
      stepGate(grid, 35, 18, 3)
    ];
    carve(grid, 12, 2, 25, 3);
    carve(grid, 23, 2, 25, 5);
    carve(grid, 16, 14, 20, 16);
    carve(grid, 15, 14, 17, 28);
    carve(grid, 17, 26, 20, 28);
    carve(grid, 29, 21, 37, 23);
    const portal = setPortal(grid, { x: 46, y: 29 });
    return finish(config, {
      width: width, height: height, grid: grid,
      coins: [{ x: 10, y: 12 }, { x: 20, y: 14 }, { x: 27, y: 19 }, { x: 46, y: 28 }],
      blocks: [
        { x: 5, y: 12, gravity: 0 }, { x: 19, y: 10, gravity: 1 },
        { x: 19, y: 19, gravity: 2 }, { x: 46, y: 24, gravity: 3 }
      ],
      playerStart: { x: 3, y: 11, gravity: 0 },
      puzzle: { gates: gates, portal: portal, features: ['gauntlet'] }
    });
  }

  const BUILDERS = {
    tutorial: tutorialStage,
    platform: platformStage,
    drop: dropStage,
    maze: mazeStage,
    ceiling: ceilingStage,
    crawl: crawlStage,
    slalom: slalomStage,
    orbit: orbitStage,
    construction: constructionStage,
    relay: relayStage,
    gauntlet: gauntletStage
  };

  function createPuzzleStage(config) {
    if (!BUILDERS[config.type]) throw new Error('Unknown puzzle type: ' + config.type);
    return BUILDERS[config.type](config);
  }

  G.createPuzzleStage = createPuzzleStage;
  if (typeof module !== 'undefined' && module.exports) module.exports = createPuzzleStage;
})();
