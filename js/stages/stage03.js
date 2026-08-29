globalThis.G = globalThis.G || {};
var G = globalThis.G;

G.Stages = G.Stages || [];

// The largest ant-nest layout, with mirrored branches around a deep center.
const STAGE03_WIDTH = 70;
const STAGE03_HEIGHT = 25;
const stage03Grid = Array.from({ length: STAGE03_HEIGHT }, function () {
  return Array(STAGE03_WIDTH).fill(1);
});

function carveStage03(x1, y1, x2, y2) {
  for (let y = y1; y <= y2; y++) stage03Grid[y].fill(0, x1, x2 + 1);
}

carveStage03(28, 19, 41, 23);
carveStage03(9, 17, 31, 21);
carveStage03(2, 12, 12, 20);
carveStage03(5, 5, 9, 13);
carveStage03(2, 2, 25, 7);
carveStage03(33, 7, 37, 20);
carveStage03(22, 4, 47, 9);
carveStage03(11, 12, 58, 15);
carveStage03(39, 17, 60, 21);
carveStage03(56, 10, 67, 21);
carveStage03(60, 4, 64, 11);
carveStage03(45, 2, 67, 6);
carveStage03(16, 6, 20, 12);
stage03Grid[3][66] = 2;
const stage03 = {
  id: 3,
  name: '중력 개미굴: 심층부',
  width: STAGE03_WIDTH,
  height: STAGE03_HEIGHT,
  grid: stage03Grid,
  coins: [
    { x: 4, y: 4 },
    { x: 18, y: 10 },
    { x: 34, y: 8 },
    { x: 52, y: 4 },
    { x: 63, y: 18 }
  ],
  blocks: [
    { x: 34, y: 23, gravity: 0 },
    { x: 7, y: 20, gravity: 0 },
    { x: 61, y: 21, gravity: 0 }
  ],
  playerStart: { x: 34, y: 22, gravity: 0 }
};

G.Stages.push(stage03);

if (typeof module !== 'undefined' && module.exports) {
  module.exports = stage03;
}
