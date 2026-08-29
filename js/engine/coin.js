globalThis.G = globalThis.G || {};
var G = globalThis.G;

// G.Coin — fixed position, unaffected by gravity, collected automatically
// on AABB overlap with the player. Position (px, py) is the CENTER of the
// coin in world pixel coordinates, same convention as Player/Block.

const Coin = function (opts) {
  opts = opts || {};
  this.px = opts.px || 0;
  this.py = opts.py || 0;
  this.collected = false;
};

// Returns the coin's axis-aligned hitbox in world pixel coords as
// {x, y, w, h} where (x,y) is the TOP-LEFT corner. Uses a TILE_SIZE square
// footprint so overlap tests against the player/blocks are straightforward.
Coin.prototype.getAABB = function () {
  const TILE_SIZE = G.TILE_SIZE;
  return {
    x: this.px - TILE_SIZE / 2,
    y: this.py - TILE_SIZE / 2,
    w: TILE_SIZE,
    h: TILE_SIZE
  };
};

G.Coin = Coin;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = G.Coin;
}
