globalThis.G = globalThis.G || {};
var G = globalThis.G;

// localStorage wrapper with safe JSON parsing and defaults.
// Falls back gracefully when localStorage is unavailable (e.g. required
// under Node for testing) or when stored data is missing/corrupt.

const STORAGE_PREFIX = 'graviter:';

const KEYS = {
  clearedStages: STORAGE_PREFIX + 'clearedStages',
  keybinds: STORAGE_PREFIX + 'keybinds',
  keybindsMigratedToArrowDefaults: STORAGE_PREFIX + 'keybindsMigratedToArrowDefaults',
  soundVolume: STORAGE_PREFIX + 'soundVolume'
};

const DEFAULT_KEYBINDS = {
  left: 'ArrowLeft',
  right: 'ArrowRight',
  jump: 'ArrowUp',
  crouch: 'ArrowDown',
  rotate: 'KeyZ',
  grab: 'ShiftLeft'
};

const DEFAULT_SOUND_VOLUME = 0.5;

function getLocalStorage() {
  try {
    if (typeof globalThis.localStorage !== 'undefined' && globalThis.localStorage) {
      return globalThis.localStorage;
    }
  } catch (e) {
    // accessing localStorage can throw in some sandboxed contexts
  }
  return null;
}

function safeParse(raw, fallback) {
  if (raw === null || raw === undefined) return fallback;
  try {
    const parsed = JSON.parse(raw);
    if (parsed === null || parsed === undefined) return fallback;
    return parsed;
  } catch (e) {
    return fallback;
  }
}

function readKey(key, fallback) {
  const ls = getLocalStorage();
  if (!ls) return fallback;
  let raw = null;
  try {
    raw = ls.getItem(key);
  } catch (e) {
    return fallback;
  }
  return safeParse(raw, fallback);
}

function writeKey(key, value) {
  const ls = getLocalStorage();
  if (!ls) return false;
  try {
    ls.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    return false;
  }
}

function getClearedStages() {
  const val = readKey(KEYS.clearedStages, []);
  return Array.isArray(val) ? val : [];
}

function setClearedStages(arr) {
  const clean = Array.isArray(arr) ? arr : [];
  writeKey(KEYS.clearedStages, clean);
  return clean;
}

function addClearedStage(stageId) {
  const cleared = getClearedStages();
  if (cleared.indexOf(stageId) === -1) {
    cleared.push(stageId);
    setClearedStages(cleared);
  }
  return cleared;
}

function migrateKeybindsToArrowDefaults() {
  if (readKey(KEYS.keybindsMigratedToArrowDefaults, false)) return;
  writeKey(KEYS.keybinds, DEFAULT_KEYBINDS);
  writeKey(KEYS.keybindsMigratedToArrowDefaults, true);
}

function getKeybinds() {
  migrateKeybindsToArrowDefaults();
  const val = readKey(KEYS.keybinds, null);
  if (!val || typeof val !== 'object') {
    return Object.assign({}, DEFAULT_KEYBINDS);
  }
  // Merge with defaults so a partially-corrupt/older object still yields
  // a complete keybind set.
  return Object.assign({}, DEFAULT_KEYBINDS, val);
}

function setKeybinds(binds) {
  const merged = Object.assign({}, getKeybinds(), binds || {});
  writeKey(KEYS.keybinds, merged);
  return merged;
}

function getSoundVolume() {
  const val = readKey(KEYS.soundVolume, DEFAULT_SOUND_VOLUME);
  const num = typeof val === 'number' ? val : parseFloat(val);
  if (isNaN(num)) return DEFAULT_SOUND_VOLUME;
  return Math.min(1, Math.max(0, num));
}

function setSoundVolume(vol) {
  const num = typeof vol === 'number' ? vol : parseFloat(vol);
  const clamped = isNaN(num) ? DEFAULT_SOUND_VOLUME : Math.min(1, Math.max(0, num));
  writeKey(KEYS.soundVolume, clamped);
  return clamped;
}

G.Storage = {
  DEFAULT_KEYBINDS: DEFAULT_KEYBINDS,
  DEFAULT_SOUND_VOLUME: DEFAULT_SOUND_VOLUME,
  getClearedStages: getClearedStages,
  setClearedStages: setClearedStages,
  addClearedStage: addClearedStage,
  getKeybinds: getKeybinds,
  setKeybinds: setKeybinds,
  getSoundVolume: getSoundVolume,
  setSoundVolume: setSoundVolume
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = G.Storage;
}
