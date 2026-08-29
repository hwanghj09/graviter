globalThis.G = globalThis.G || {};
var G = globalThis.G;

G.Stages = G.Stages || [];

// Stage 1 — Tutorial corridor.
// Sealed horizontal corridor. Pure left/right movement only, no jump
// required, no gravity rotation needed, no interactive blocks. 1 coin.
// (An earlier draft had a 1-tile floor gap meant to be cleared with a single
// jump, but under this game's grid-approximated movement model a vertical
// jump can never produce net horizontal progress on a block-free map — any
// jump falls straight back to its start tile — so stepping into that gap
// was an inescapable dead end. The gap was removed; the floor is solid.)
const stage01 = {
  id: 1,
  name: '튜토리얼: 첫 걸음',
  width: 18,
  height: 7,
  grid: [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  ],
  coins: [
    { x: 6, y: 4 }
  ],
  blocks: [],
  playerStart: { x: 2, y: 3, gravity: 0 }
};

G.Stages.push(stage01);

if (typeof module !== 'undefined' && module.exports) {
  module.exports = stage01;
}
