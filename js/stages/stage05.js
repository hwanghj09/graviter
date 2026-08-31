globalThis.G = globalThis.G || {};
var G = globalThis.G;

if (!G.createPuzzleStage && typeof require === 'function') G.createPuzzleStage = require('./puzzleStage.js');
G.Stages = G.Stages || [];

const stage05 = G.createPuzzleStage({
  id: 5, name: '저상 화물관', puzzleType: '웅크림 운반', type: 'crawl'
});

G.Stages.push(stage05);

if (typeof module !== 'undefined' && module.exports) module.exports = stage05;
