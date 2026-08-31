globalThis.G = globalThis.G || {};
var G = globalThis.G;

if (!G.createPuzzleStage && typeof require === 'function') G.createPuzzleStage = require('./puzzleStage.js');
G.Stages = G.Stages || [];

const stage06 = G.createPuzzleStage({
  id: 6, name: '중력 슬라럼', puzzleType: '교대 중력', type: 'slalom'
});

G.Stages.push(stage06);

if (typeof module !== 'undefined' && module.exports) module.exports = stage06;
