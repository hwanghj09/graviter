globalThis.G = globalThis.G || {};
var G = globalThis.G;

G.Stages = G.Stages || [];

// A crossing ant-nest layout with rooms linked from the lower-right start
// to the upper-left exit.
const STAGE02_WIDTH = 60;
const STAGE02_HEIGHT = 22;
const stage02Grid = Array.from({ length: STAGE02_HEIGHT }, function () {
  return Array(STAGE02_WIDTH).fill(1);
});

function carveStage02(x1, y1, x2, y2) {
  for (let y = y1; y <= y2; y++) stage02Grid[y].fill(0, x1, x2 + 1);
}

carveStage02(42, 16, 57, 20);
carveStage02(50, 8, 55, 17);
carveStage02(36, 4, 57, 9);
carveStage02(22, 8, 40, 12);
carveStage02(20, 10, 32, 18);
carveStage02(10, 16, 24, 20);
carveStage02(2, 12, 14, 20);
carveStage02(5, 5, 9, 13);
carveStage02(2, 2, 21, 7);
carveStage02(27, 3, 34, 6);
carveStage02(29, 5, 33, 10);
stage02Grid[3][3] = 2;

const stage02 = {
  id: 2,
  name: '중력 개미굴: 교차층',
  width: STAGE02_WIDTH,
  height: STAGE02_HEIGHT,
  grid: stage02Grid,
  coins: [
    { x: 54, y: 18 },
    { x: 52, y: 10 },
    { x: 43, y: 6 },
    { x: 29, y: 4 },
    { x: 7, y: 6 }
  ],
  blocks: [
    { x: 46, y: 20, gravity: 0 },
    { x: 25, y: 18, gravity: 0 },
    { x: 8, y: 20, gravity: 0 }
  ],
  playerStart: { x: 55, y: 19, gravity: 0 }
};

G.Stages.push(stage02);

if (typeof module !== 'undefined' && module.exports) {
  module.exports = stage02;
}
