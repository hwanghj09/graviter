globalThis.G = globalThis.G || {};
var G = globalThis.G;

G.Stages = G.Stages || [];

// Stage 3 — Stepping stone.
// Introduces block grab/carry/drop (SHIFT). A 4-tile-tall pillar blocks the
// floor-level path; the player's jump alone (~3.2 tile apex) cannot clear it,
// but grabbing the gray block, carrying it to the pillar's base and dropping
// it there adds exactly the 1 tile of height needed to jump the remainder
// onto the elevated shelf beyond. 2 coins.
const stage03 = {
  id: 3,
  name: '디딤돌 놓기',
  width: 17,
  height: 10,
  grid: [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  ],
  coins: [
    { x: 3, y: 7 },
    { x: 11, y: 3 }
  ],
  blocks: [
    { x: 5, y: 7, gravity: 0 }
  ],
  playerStart: { x: 2, y: 6, gravity: 0 }
};

G.Stages.push(stage03);

if (typeof module !== 'undefined' && module.exports) {
  module.exports = stage03;
}
