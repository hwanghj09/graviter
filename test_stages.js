const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const context = { globalThis: { G: {} } };
vm.createContext(context);
['stage01.js', 'stage02.js', 'stage03.js'].forEach(function (file) {
  vm.runInContext(fs.readFileSync('js/stages/' + file, 'utf8'), context, { filename: file });
});
assert.deepEqual(Array.from(context.globalThis.G.Stages, function (stage) { return stage.id; }), [1, 2, 3]);
