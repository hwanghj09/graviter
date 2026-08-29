const assert = require('node:assert/strict');
const Renderer = require('./js/render/renderer.js');

assert.equal(Renderer._poseNameFor(true, 0), 'idle');
assert.equal(Renderer._poseNameFor(true, 5), 'walk');
assert.equal(Renderer._poseNameFor(false, 200), 'jump');
