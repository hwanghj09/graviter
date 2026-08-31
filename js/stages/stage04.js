globalThis.G = globalThis.G || {};
var G = globalThis.G;

if (!G.createPuzzleStage && typeof require === 'function') G.createPuzzleStage = require('./puzzleStage.js');
G.Stages = G.Stages || [];

const stage04 = G.createPuzzleStage({
  id: 4, name: '천장 보행로', puzzleType: '역중력 등반', type: 'ceiling'
});

G.Stages.push(stage04);

if (typeof module !== 'undefined' && module.exports) module.exports = stage04;
