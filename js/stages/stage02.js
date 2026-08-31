globalThis.G = globalThis.G || {};
var G = globalThis.G;

if (!G.createPuzzleStage && typeof require === 'function') G.createPuzzleStage = require('./puzzleStage.js');
G.Stages = G.Stages || [];

const stage02 = G.createPuzzleStage({
  id: 2, name: '심층 낙하정', puzzleType: '낙하 수집', type: 'drop'
});

G.Stages.push(stage02);

if (typeof module !== 'undefined' && module.exports) module.exports = stage02;
