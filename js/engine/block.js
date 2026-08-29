globalThis.G = globalThis.G || {};
var G = globalThis.G;

// G.Block — interactive gray block. Position (px, py) is the CENTER of the
// block in world pixel coordinates, same convention as Player. Always
// TILE_SIZE square. Carries its OWN gravityIndex, independent of the
// player's — this is preserved while held and re-applied on drop.

const Block = function (opts) {
  opts = opts || {};
  this.px = opts.px || 0;
  this.py = opts.py || 0;
  this.vx = 0;
  this.vy = 0;
  this.gravityIndex = (opts.gravityIndex !== undefined) ? opts.gravityIndex : 0;
  this.heldBy = null; // ref to the Player holding this block, or null
  this.grounded = false;
};

// Returns the current axis-aligned hitbox in world pixel coords as
// {x, y, w, h} where (x,y) is the TOP-LEFT corner. Always TILE_SIZE square.
Block.prototype.getAABB = function () {
  const TILE_SIZE = G.TILE_SIZE;
  return {
    x: this.px - TILE_SIZE / 2,
    y: this.py - TILE_SIZE / 2,
    w: TILE_SIZE,
    h: TILE_SIZE
  };
};

G.Block = Block;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = G.Block;
}
