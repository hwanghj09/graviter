globalThis.G = globalThis.G || {};
var G = globalThis.G;

// G.State — top-level screen/state machine. Owns which DOM overlay (from
// the UI_SCREENS markers in index.html) is visible, whether the gameplay
// canvas is shown, and pauses/resumes G.Main's loop across screen changes.
//
// PLAYING has no overlay div of its own (the canvas *is* the PLAYING
// screen); every other screen name maps 1:1 to an element id inserted
// between UI_SCREENS_START/END in index.html.

const SCREENS = {
  MAIN_MENU: 'MAIN_MENU',
  STAGE_SELECT: 'STAGE_SELECT',
  SETTINGS: 'SETTINGS',
  PAUSE: 'PAUSE',
  PLAYING: 'PLAYING',
  STAGE_CLEAR: 'STAGE_CLEAR',
  ENDING: 'ENDING'
};

const SCREEN_ELEMENT_IDS = {
  MAIN_MENU: 'main-menu',
  STAGE_SELECT: 'stage-select',
  SETTINGS: 'settings',
  PAUSE: 'pause-menu',
  STAGE_CLEAR: 'stage-clear',
  ENDING: 'ending'
};

// Screens during which the gameplay canvas stays visible behind (or as) the
// overlay, so pausing mid-game doesn't hide the frozen scene.
const CANVAS_VISIBLE_SCREENS = {
  PLAYING: true,
  PAUSE: true,
  STAGE_CLEAR: true
};

let _current = null;
// Which screen SETTINGS should return to (MAIN_MENU normally, PAUSE when
// opened from the pause menu) — captured the moment we navigate *into*
// SETTINGS from somewhere else.
let _settingsReturnTo = SCREENS.MAIN_MENU;

function getElement(id) {
  if (typeof document === 'undefined' || !document.getElementById) return null;
  return document.getElementById(id);
}

function applyDom(screen) {
  Object.keys(SCREEN_ELEMENT_IDS).forEach(function (key) {
    const el = getElement(SCREEN_ELEMENT_IDS[key]);
    if (el) el.classList.toggle('visible', key === screen);
  });

  const canvas = getElement('game-canvas');
  if (canvas) {
    canvas.style.visibility = CANVAS_VISIBLE_SCREENS[screen] ? 'visible' : 'hidden';
  }
}

function goTo(screen) {
  if (!SCREENS[screen]) return;

  if (screen === SCREENS.SETTINGS && _current !== SCREENS.SETTINGS) {
    _settingsReturnTo = _current || SCREENS.MAIN_MENU;
  }

  const wasPlaying = (_current === SCREENS.PLAYING);
  const isPlaying = (screen === SCREENS.PLAYING);

  if (wasPlaying && !isPlaying && G.Main && typeof G.Main.pause === 'function') {
    G.Main.pause();
  }
  if (isPlaying && !wasPlaying && G.Main && typeof G.Main.resume === 'function') {
    G.Main.resume();
  }

  _current = screen;
  applyDom(screen);

  // Optional per-screen refresh hooks — kept as loose lookups (rather than
  // a hard dependency) so gameState.js does not need to know the UI
  // modules exist yet at load time.
  if (screen === SCREENS.STAGE_SELECT && G.StageSelect && typeof G.StageSelect.render === 'function') {
    G.StageSelect.render();
  }
  if (screen === SCREENS.SETTINGS && G.SettingsMenu && typeof G.SettingsMenu.render === 'function') {
    G.SettingsMenu.render();
  }
}

// Returns to whichever screen SETTINGS was opened from (MAIN_MENU or PAUSE).
function exitSettings() {
  goTo(_settingsReturnTo || SCREENS.MAIN_MENU);
}

function getCurrent() {
  return _current;
}

G.State = {
  SCREENS: SCREENS,
  goTo: goTo,
  exitSettings: exitSettings,
  getCurrent: getCurrent
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = G.State;
}
