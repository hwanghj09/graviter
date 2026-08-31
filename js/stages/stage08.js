globalThis.G = globalThis.G || {};
var G = globalThis.G;

if (!G.createPuzzleStage && typeof require === 'function') G.createPuzzleStage = require('./puzzleStage.js');
G.Stages = G.Stages || [];

const stage08 = G.createPuzzleStage({
  id: 8, name: '발판 조립장', puzzleType: '블럭 조립', type: 'construction'
});

G.Stages.push(stage08);

if (typeof module !== 'undefined' && module.exports) module.exports = stage08;
