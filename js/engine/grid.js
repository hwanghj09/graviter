globalThis.G = globalThis.G || {};
var G = globalThis.G;

/*
 * ============================================================================
 * STAGE OBJECT FORMAT (authoritative reference — copied from the project spec
 * so any file can be self-describing without re-reading external docs)
 * ============================================================================
 *
 * A stage file (e.g. js/stages/stage01.js) starts with the standard two-line
 * global header used by every JS file in this project:
 *
 *   globalThis.G = globalThis.G || {};
 *   const G = globalThis.G;
 *
 * Then it does:
 *
 *   G.Stages = G.Stages || [];
 *
 * ...and defines a stage object literal with these fields:
 *
 *   id          number          unique stage id
 *   name        string (KR)     display name for the stage
 *   width       number          grid columns
 *   height      number          grid rows
 *   grid        number[height][width]
 *                               row-major, row 0 is the TOP row.
 *                               Each cell is one of:
 *                                 0 = EMPTY
 *                                 1 = WALL
 *                                 2 = PORTAL
 *                               The outer border should normally be WALL so
 *                               the stage is sealed (no escaping the grid).
 *   coins       [{x, y}, ...]   1 to 5 entries. x=col, y=row, grid coords.
 *                               Coins are fixed in place, unaffected by
 *                               gravity, and auto-collected on overlap.
 *   blocks      [{x, y, gravity}, ...]
 *                               Interactive gray blocks. x=col, y=row (grid
 *                               coords), gravity = starting gravity index
 *                               (0-3, see gravity.js).
 *   playerStart {x, y, gravity}
 *                               Player spawn and starting gravity index
 *                               (normally 0 = down). Unlike coins/blocks
 *                               (always 1x1 tile), the player's footprint
 *                               is 1x2 or 2x1 tiles depending on gravity
 *                               orientation, so (x,y) is the TOP-LEFT grid
 *                               cell of that spawn bounding box, not its
 *                               center tile (see playerSpawnPixels in
 *                               js/main.js). E.g. for gravity=0 (down,
 *                               1 wide x 2 tall), (x,y) and (x,y+1) must
 *                               both be empty, with a solid tile at
 *                               (x,y+2) for the player to stand on.
 *
 * The stage object is then pushed onto G.Stages:
 *
 *   G.Stages.push(stageObject);
 *
 * Finally, to allow Node to require() the file directly (for automated
 * validation / testing scripts), every stage file ends with:
 *
 *   if (typeof module !== 'undefined' && module.exports) {
 *     module.exports = stageObject;
 *   }
 *
 * Grid coordinates are tile indices, NOT pixels. The engine converts to
 * pixels internally by multiplying by TILE_SIZE (see below).
 * ============================================================================
 */

const TILE_SIZE = 40;

const TILE = {
  EMPTY: 0,
  WALL: 1,
  PORTAL: 2
};

// Returns the tile type at grid coordinates (col, row), or WALL if out of
// bounds (treat out-of-bounds as solid so nothing can escape the grid).
function getTileAt(stageGrid, width, height, col, row) {
  if (row < 0 || row >= height || col < 0 || col >= width) {
    return TILE.WALL;
  }
  const rowArr = stageGrid[row];
  if (!rowArr) return TILE.WALL;
  const t = rowArr[col];
  if (t === undefined) return TILE.WALL;
  return t;
}

// Same lookup, but given pixel coordinates instead of grid coordinates.
function getTileAtPixel(stageGrid, width, height, px, py) {
  const col = Math.floor(px / TILE_SIZE);
  const row = Math.floor(py / TILE_SIZE);
  return getTileAt(stageGrid, width, height, col, row);
}

// True if the tile at (col,row) blocks movement (WALL). PORTAL and EMPTY are
// not solid.
function isSolidAt(stageGrid, width, height, col, row) {
  return getTileAt(stageGrid, width, height, col, row) === TILE.WALL;
}

G.TILE_SIZE = TILE_SIZE;
G.TILE = TILE;
G.Grid = {
  TILE_SIZE: TILE_SIZE,
  TILE: TILE,
  getTileAt: getTileAt,
  getTileAtPixel: getTileAtPixel,
  isSolidAt: isSolidAt
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = G.Grid;
}
