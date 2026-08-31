globalThis.G = globalThis.G || {};
var G = globalThis.G;

if (!G.createPuzzleStage && typeof require === 'function') G.createPuzzleStage = require('./puzzleStage.js');
G.Stages = G.Stages || [];

const stage09 = G.createPuzzleStage({
  id: 9, name: '이중 중력 릴레이', puzzleType: '블럭 릴레이', type: 'relay'
});

G.Stages.push(stage09);

if (typeof module !== 'undefined' && module.exports) module.exports = stage09;
