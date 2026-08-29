globalThis.G = globalThis.G || {};
var G = globalThis.G;

// Gravity direction table, indexed by gravityIndex (0-3).
// 0=down, 1=left, 2=up, 3=right. Rotation via Z is clockwise: index = (index+1) % 4,
// which cycles down -> left -> up -> right -> down.
const GRAVITY_VECTORS = [
  { x: 0, y: 1 },  // 0 down
  { x: -1, y: 0 }, // 1 left
  { x: 0, y: -1 }, // 2 up
  { x: 1, y: 0 }   // 3 right
];

function negate(vec) {
  return { x: -vec.x, y: -vec.y };
}

function rotateIndex(index) {
  return (index + 1) % 4;
}

function getGravityVec(i) {
  return GRAVITY_VECTORS[((i % 4) + 4) % 4];
}

function getJumpVec(i) {
  return negate(getGravityVec(i));
}

function getRightVec(i) {
  return GRAVITY_VECTORS[(((i + 3) % 4) + 4) % 4];
}

function getLeftVec(i) {
  return GRAVITY_VECTORS[((i + 1) % 4 + 4) % 4];
}

G.GRAVITY_VECTORS = GRAVITY_VECTORS;
G.Gravity = {
  GRAVITY_VECTORS: GRAVITY_VECTORS,
  rotateIndex: rotateIndex,
  getGravityVec: getGravityVec,
  getJumpVec: getJumpVec,
  getRightVec: getRightVec,
  getLeftVec: getLeftVec
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = G.Gravity;
}
