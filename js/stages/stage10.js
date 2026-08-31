globalThis.G = globalThis.G || {};
var G = globalThis.G;

if (!G.createPuzzleStage && typeof require === 'function') G.createPuzzleStage = require('./puzzleStage.js');
G.Stages = G.Stages || [];

const stage10 = G.createPuzzleStage({
  id: 10, name: '사중력 관문', puzzleType: '종합 관문', type: 'gauntlet'
});

G.Stages.push(stage10);

if (typeof module !== 'undefined' && module.exports) module.exports = stage10;
