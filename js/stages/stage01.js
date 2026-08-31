globalThis.G = globalThis.G || {};
var G = globalThis.G;

if (!G.createPuzzleStage && typeof require === 'function') G.createPuzzleStage = require('./puzzleStage.js');
G.Stages = G.Stages || [];

const stage01 = G.createPuzzleStage({
  id: 1, name: '발판 도약장', puzzleType: '발판 도약', type: 'platform'
});

G.Stages.push(stage01);

if (typeof module !== 'undefined' && module.exports) module.exports = stage01;
