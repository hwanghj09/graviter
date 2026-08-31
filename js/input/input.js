globalThis.G = globalThis.G || {};
var G = globalThis.G;

// Keyboard input tracking. Loads keybinds from G.Storage (must be loaded
// first). Movement actions (left/right/jump/crouch) also always accept the
// arrow-key equivalent regardless of the configured keybind; rotate/grab
// have no arrow equivalent. Arrow equivalents are not persisted anywhere,
// only the configurable primary bind is.

const ARROW_EQUIVALENTS = {
  left: 'ArrowLeft',
  right: 'ArrowRight',
  jump: 'ArrowUp',
  crouch: 'ArrowDown'
};

// currently-held key codes
const pressedCodes = Object.create(null);
// codes that transitioned up->down since the last consumePressed() check
// for that code (one-shot / "just pressed")
const justPressedCodes = Object.create(null);

let keybinds = (G.Storage ? G.Storage.getKeybinds() : null) || {
  left: 'ArrowLeft', right: 'ArrowRight', jump: 'ArrowUp', crouch: 'ArrowDown',
  rotate: 'KeyZ', grab: 'KeyX'
};

function codesForAction(action) {
  const codes = [];
  const bound = keybinds[action];
  if (bound) codes.push(bound);
  const arrow = ARROW_EQUIVALENTS[action];
  if (arrow && codes.indexOf(arrow) === -1) codes.push(arrow);
  return codes;
}

function handleKeyDown(code) {
  if (!pressedCodes[code]) {
    justPressedCodes[code] = true;
  }
  pressedCodes[code] = true;
}

function handleKeyUp(code) {
  pressedCodes[code] = false;
  justPressedCodes[code] = false;
}

function isDown(action) {
  const codes = codesForAction(action);
  for (let i = 0; i < codes.length; i++) {
    if (pressedCodes[codes[i]]) return true;
  }
  return false;
}

// One-shot check: returns true at most once per physical key press, even if
// the caller polls every frame while the key is held down.
function consumePressed(action) {
  const codes = codesForAction(action);
  for (let i = 0; i < codes.length; i++) {
    const code = codes[i];
    if (justPressedCodes[code]) {
      justPressedCodes[code] = false;
      return true;
    }
  }
  return false;
}

function setKeybind(action, code) {
  keybinds[action] = code;
  if (G.Storage) {
    keybinds = G.Storage.setKeybinds(keybinds);
  }
  return keybinds;
}

function getKeybinds() {
  return Object.assign({}, keybinds);
}

// Attach browser listeners only when a DOM is present, so this file can also
// be require()'d under Node without throwing.
if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('keydown', function (e) {
    handleKeyDown(e.code);
  });
  document.addEventListener('keyup', function (e) {
    handleKeyUp(e.code);
  });
}

G.Input = {
  isDown: isDown,
  consumePressed: consumePressed,
  setKeybind: setKeybind,
  getKeybinds: getKeybinds,
  // Exposed so other modules (e.g. the settings screen's conflict check) can
  // account for the always-on arrow-key aliases without duplicating this map.
  ARROW_EQUIVALENTS: ARROW_EQUIVALENTS,
  // exposed for tests / manual simulation without real DOM events
  _handleKeyDown: handleKeyDown,
  _handleKeyUp: handleKeyUp
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = G.Input;
}
