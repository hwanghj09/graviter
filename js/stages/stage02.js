globalThis.G = globalThis.G || {};
var G = globalThis.G;

G.Stages = G.Stages || [];

// Stage 2 — Gravity rotation.
// Introduces the Z gravity-rotation mechanic. A tall vertical shaft with a
// solid left-hand wall (col 1) blocks any path deeper into it — except for a
// 2-tile-tall notch carved near the very top of that wall, far above the
// ~3.2-tile jump apex, so it cannot be reached by jumping under normal
// (down) gravity. The player must first collect the easy floor-level coin,
// then return to the base of the wall, land (required — rotating mid-air is
// not allowed), and rotate gravity once (down -> left). With gravity now
// pulling toward that wall, the player can walk "up" along its face (using
// the same left/right movement keys, now vertical relative to the world)
// past the solid section and settle into the notch once the wall opens up,
// collecting the second coin. Walking back down the wall face returns the
// player to the portal at the wall's base. 2 coins.
const stage02 = {
  id: 2,
  name: '중력 회전: 벽 틈 코인',
  width: 8,
  height: 14,
  grid: [
    [1, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 1],
    [1, 1, 0, 0, 0, 0, 0, 1],
    [1, 1, 0, 0, 0, 0, 0, 1],
    [1, 1, 0, 0, 0, 0, 0, 1],
    [1, 1, 0, 0, 0, 0, 0, 1],
    [1, 1, 0, 0, 0, 0, 0, 1],
    [1, 1, 0, 0, 0, 0, 0, 1],
    [1, 1, 0, 0, 0, 0, 0, 1],
    [1, 1, 2, 0, 0, 0, 0, 1],
    [1, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 1]
  ],
  coins: [
    { x: 4, y: 11 },
    { x: 1, y: 2 }
  ],
  blocks: [],
  playerStart: { x: 2, y: 10, gravity: 0 }
};

G.Stages.push(stage02);

if (typeof module !== 'undefined' && module.exports) {
  module.exports = stage02;
}
