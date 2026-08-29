globalThis.G = globalThis.G || {};
var G = globalThis.G;

G.Stages = G.Stages || [];

// The widest ant nest, built around a central chamber with long side branches.
const STAGE05_WIDTH = 80;
const STAGE05_HEIGHT = 28;
const stage05Grid = Array.from({ length: STAGE05_HEIGHT }, function () {
  return Array(STAGE05_WIDTH).fill(1);
});

function carveStage05(x1, y1, x2, y2) {
  for (let y = y1; y <= y2; y++) stage05Grid[y].fill(0, x1, x2 + 1);
}

carveStage05(31, 21, 48, 26);
carveStage05(38, 13, 42, 22);
carveStage05(27, 10, 53, 15);
carveStage05(9, 12, 30, 16);
carveStage05(2, 8, 12, 20);
carveStage05(6, 3, 10, 9);
carveStage05(2, 2, 29, 6);
carveStage05(25, 4, 55, 8);
carveStage05(35, 2, 45, 5);
carveStage05(51, 2, 77, 7);
carveStage05(69, 6, 74, 14);
carveStage05(58, 11, 77, 20);
carveStage05(47, 18, 63, 23);
carveStage05(16, 18, 34, 23);
carveStage05(10, 17, 20, 21);
carveStage05(20, 6, 24, 13);
stage05Grid[3][40] = 2;

const stage05 = {
  id: 5,
  name: '중력 개미굴: 여왕층',
  width: STAGE05_WIDTH,
  height: STAGE05_HEIGHT,
  grid: stage05Grid,
  coins: [
    { x: 7, y: 4 },
    { x: 23, y: 10 },
    { x: 40, y: 12 },
    { x: 70, y: 5 },
    { x: 67, y: 18 }
  ],
  blocks: [
    { x: 40, y: 26, gravity: 0 },
    { x: 7, y: 20, gravity: 0 },
    { x: 72, y: 20, gravity: 0 }
  ],
  playerStart: { x: 39, y: 25, gravity: 0 }
};

G.Stages.push(stage05);

if (typeof module !== 'undefined' && module.exports) {
  module.exports = stage05;
}
