globalThis.G = globalThis.G || {};
var G = globalThis.G;

G.Stages = G.Stages || [];

// A winding ant-nest route that alternates between upper and lower chambers.
const STAGE04_WIDTH = 75;
const STAGE04_HEIGHT = 26;
const stage04Grid = Array.from({ length: STAGE04_HEIGHT }, function () {
  return Array(STAGE04_WIDTH).fill(1);
});

function carveStage04(x1, y1, x2, y2) {
  for (let y = y1; y <= y2; y++) stage04Grid[y].fill(0, x1, x2 + 1);
}

carveStage04(2, 20, 16, 24);
carveStage04(10, 14, 14, 21);
carveStage04(12, 14, 34, 18);
carveStage04(30, 12, 44, 20);
carveStage04(37, 6, 41, 13);
carveStage04(25, 3, 49, 8);
carveStage04(4, 2, 28, 6);
carveStage04(43, 9, 64, 13);
carveStage04(60, 7, 72, 18);
carveStage04(65, 17, 70, 24);
carveStage04(48, 21, 72, 24);
carveStage04(50, 14, 56, 22);
stage04Grid[23][70] = 2;

const stage04 = {
  id: 4,
  name: '중력 개미굴: 나선층',
  width: STAGE04_WIDTH,
  height: STAGE04_HEIGHT,
  grid: stage04Grid,
  coins: [
    { x: 6, y: 4 },
    { x: 38, y: 5 },
    { x: 63, y: 10 },
    { x: 53, y: 18 },
    { x: 15, y: 16 }
  ],
  blocks: [
    { x: 8, y: 24, gravity: 0 },
    { x: 35, y: 20, gravity: 0 },
    { x: 68, y: 24, gravity: 0 }
  ],
  playerStart: { x: 4, y: 23, gravity: 0 }
};

G.Stages.push(stage04);

if (typeof module !== 'undefined' && module.exports) {
  module.exports = stage04;
}
