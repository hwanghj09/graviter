globalThis.G = globalThis.G || {};
var G = globalThis.G;

if (!G.createPuzzleStage && typeof require === 'function') G.createPuzzleStage = require('./puzzleStage.js');
G.Stages = G.Stages || [];

const stage03 = G.createPuzzleStage({
  id: 3, name: '봉인 미로', puzzleType: '정통 미로', type: 'maze', seed: 0x3c4d5e63
});

G.Stages.push(stage03);

if (typeof module !== 'undefined' && module.exports) module.exports = stage03;
