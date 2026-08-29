globalThis.G = globalThis.G || {};
var G = globalThis.G;

G.Stages = G.Stages || [];

// A large ant-nest layout: chambers and branching tunnels connect every
// mechanic in one stage.
const WIDTH = 60;
const HEIGHT = 22;
const grid = Array.from({ length: HEIGHT }, function () {
  return Array(WIDTH).fill(1);
});

function carve(x1, y1, x2, y2) {
  for (let y = y1; y <= y2; y++) grid[y].fill(0, x1, x2 + 1);
}

carve(2, 16, 18, 20);
carve(15, 12, 27, 20);
carve(23, 6, 27, 13);
carve(7, 3, 27, 7);
carve(5, 6, 9, 17);
carve(26, 10, 45, 14);
carve(31, 5, 38, 7);
carve(34, 7, 38, 11);
carve(42, 7, 57, 16);
carve(49, 3, 53, 8);
carve(42, 2, 57, 5);
carve(52, 14, 57, 20);
grid[20][56] = 2;

const stage01 = {
  id: 1,
  name: '중력 개미굴',
  width: WIDTH,
  height: HEIGHT,
  grid: grid,
  coins: [
    { x: 7, y: 9 },
    { x: 18, y: 5 },
    { x: 35, y: 6 },
    { x: 55, y: 3 },
    { x: 47, y: 14 }
  ],
  blocks: [
    { x: 12, y: 20, gravity: 0 },
    { x: 20, y: 20, gravity: 0 },
    { x: 46, y: 16, gravity: 0 }
  ],
  playerStart: { x: 3, y: 19, gravity: 0 }
};

G.Stages.push(stage01);

if (typeof module !== 'undefined' && module.exports) {
  module.exports = stage01;
}
