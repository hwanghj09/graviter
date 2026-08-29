globalThis.G = globalThis.G || {};
var G = globalThis.G;

// G.Player — position (px, py) is the CENTER of the player in world pixel
// coordinates (this convention is used consistently by physics.js,
// camera.js and renderer.js).

const Player = function (opts) {
  opts = opts || {};
  this.px = opts.px || 0;
  this.py = opts.py || 0;
  this.vx = 0;
  this.vy = 0;
  this.gravityIndex = opts.gravityIndex || 0;
  this.crouching = false;
  this.holdingBlock = null; // ref to a Block instance, or null
  this.facing = 1; // +1 or -1, along rightVec/leftVec axis
  this.grounded = false;
};

// Returns the current axis-aligned hitbox in world pixel coords as
// {x, y, w, h} where (x,y) is the TOP-LEFT corner.
Player.prototype.getAABB = function () {
  const TILE_SIZE = G.TILE_SIZE;
  const vertical = (this.gravityIndex === 0 || this.gravityIndex === 2);
  let w, h;
  if (this.crouching) {
    w = TILE_SIZE;
    h = TILE_SIZE;
  } else if (vertical) {
    w = TILE_SIZE;
    h = TILE_SIZE * 2;
  } else {
    w = TILE_SIZE * 2;
    h = TILE_SIZE;
  }
  return {
    x: this.px - w / 2,
    y: this.py - h / 2,
    w: w,
    h: h
  };
};

G.Player = Player;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = G.Player;
}
