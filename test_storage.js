const assert = require('node:assert/strict');

const values = new Map([['graviter:keybinds', JSON.stringify({ left: 'KeyA', right: 'KeyD', jump: 'KeyW', crouch: 'KeyS' })]]);
globalThis.localStorage = {
  getItem: key => values.get(key) || null,
  setItem: (key, value) => values.set(key, value)
};

const Storage = require('./js/state/storage.js');
assert.deepEqual(Storage.getKeybinds(), {
  left: 'ArrowLeft', right: 'ArrowRight', jump: 'ArrowUp', crouch: 'ArrowDown',
  rotate: 'KeyZ', grab: 'ShiftLeft'
});
assert.equal(values.get('graviter:keybindsMigratedToArrowDefaults'), 'true');
Storage.setKeybinds({ left: 'KeyF' });
assert.equal(Storage.getKeybinds().left, 'KeyF');
