globalThis.G = globalThis.G || {};
var G = globalThis.G;

if (!G.createPuzzleStage && typeof require === 'function') G.createPuzzleStage = require('./puzzleStage.js');
G.Stages = G.Stages || [];

const stage07 = G.createPuzzleStage({
  id: 7, name: '궤도 회수실', puzzleType: '순환 탐색', type: 'orbit'
});

G.Stages.push(stage07);

if (typeof module !== 'undefined' && module.exports) module.exports = stage07;
