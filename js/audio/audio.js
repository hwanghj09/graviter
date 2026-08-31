globalThis.G = globalThis.G || {};
var G = globalThis.G;

// G.Audio — sound via the Web Audio API. Everything here is synthesized
// (oscillators), not audio asset files, since there are no shipped sound
// assets in this project.
//
// Gain graph: each category (music / effects / interaction) has its own
// gain node, which feeds into one master gain node before the destination.
// A sound's audible volume is therefore masterVolume * categoryVolume, so
// the settings screen can offer both an overall slider and independent
// per-category sliders. Volumes are read from G.Storage (soundVolume for
// master, categoryVolumes for the rest).
//
// Deliberately limited to a few meaningful moments (background music, coin
// pickup, stage clear, ending, blocked actions, UI button clicks) —
// no sound is attached to every input action (grabbing/dropping a block,
// jumping, crouching).

let ctx = null;
let masterGain = null;
const categoryGains = { music: null, effects: null, interaction: null };
let musicTimer = null;
let musicStarted = false;
let startupListenerAttached = false;

function currentMasterVolume() {
  return G.Storage ? G.Storage.getSoundVolume() : 0.5;
}

function currentCategoryVolumes() {
  return G.Storage ? G.Storage.getCategoryVolumes() : { music: 1, effects: 1, interaction: 1 };
}

function ensureContext() {
  if (ctx) return ctx;
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  masterGain = ctx.createGain();
  masterGain.gain.value = currentMasterVolume();
  masterGain.connect(ctx.destination);

  const catVolumes = currentCategoryVolumes();
  Object.keys(categoryGains).forEach(function (category) {
    const gain = ctx.createGain();
    gain.gain.value = catVolumes[category];
    gain.connect(masterGain);
    categoryGains[category] = gain;
  });

  return ctx;
}

function setMasterVolume(vol) {
  if (masterGain) masterGain.gain.value = vol;
}

function setCategoryVolume(category, vol) {
  const gain = categoryGains[category];
  if (gain) gain.gain.value = vol;
}

// One short tone: freq in Hz, startOffset/duration in seconds (offset is
// relative to "now"), waveform type, peak volume (0-1, scaled by the
// category gain and master gain), routed through the given category.
function tone(freq, startOffset, duration, type, peak, category) {
  const destGain = categoryGains[category];
  if (!ctx || !destGain) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type || 'sine';
  osc.frequency.value = freq;
  const t0 = ctx.currentTime + startOffset;
  const t1 = t0 + duration;
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(peak, t0 + Math.min(0.015, duration * 0.3));
  gain.gain.linearRampToValueAtTime(0, t1);
  osc.connect(gain);
  gain.connect(destGain);
  osc.start(t0);
  osc.stop(t1 + 0.02);
}

function playCoin() {
  if (!ensureContext()) return;
  tone(880.0, 0, 0.08, 'triangle', 0.5, 'effects');
  tone(1318.5, 0.06, 0.12, 'triangle', 0.45, 'effects');
}

function playStageClear() {
  if (!ensureContext()) return;
  [523.25, 659.25, 783.99, 1046.5].forEach(function (freq, i) {
    tone(freq, i * 0.11, 0.18, 'square', 0.35, 'effects');
  });
}

function playClick() {
  if (!ensureContext()) return;
  tone(720.0, 0, 0.05, 'square', 0.25, 'interaction');
}

// Shared "action failed" cue — reused for both a blocked gravity rotation
// (too narrow to rotate) and a grab attempt with no block in reach.
function playActionBlocked() {
  if (!ensureContext()) return;
  tone(110.0, 0, 0.16, 'triangle', 0.5, 'interaction');
}

function playEnding() {
  if (!ensureContext()) return;
  [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach(function (freq, i) {
    tone(freq, i * 0.14, 0.28, 'square', 0.35, 'effects');
  });
}

// Background music: a short, repeating arpeggio per screen mood, scheduled
// via the audio clock itself (look-ahead scheduling) rather than
// setInterval, so it never drifts out of time. 'menu' is the gentle, slow
// loop for the main menu / stage select / settings / ending; 'game' is a
// faster, more driving loop for actual play (see gameState.js's goTo, which
// picks the theme per screen).
const MUSIC_THEMES = {
  menu: { notes: [392.0, 523.25, 466.16, 587.33], noteDuration: 0.9, waveform: 'sine', peak: 0.12 }, // G4 C5 Bb4 D5
  game: { notes: [293.66, 349.23, 392.0, 349.23, 440.0, 392.0, 349.23, 293.66], noteDuration: 0.42, waveform: 'triangle', peak: 0.1 } // D4 F4 G4 F4 A4 G4 F4 D4
};
const MUSIC_LOOKAHEAD = 1.0; // seconds of schedule kept queued at a time
let musicThemeName = 'menu';
let musicNoteIndex = 0;
let nextNoteTime = 0;

function scheduleMusic() {
  if (!musicStarted || !ctx) return;
  const theme = MUSIC_THEMES[musicThemeName] || MUSIC_THEMES.menu;
  while (nextNoteTime < ctx.currentTime + MUSIC_LOOKAHEAD) {
    const freq = theme.notes[musicNoteIndex % theme.notes.length];
    tone(freq, nextNoteTime - ctx.currentTime, theme.noteDuration * 0.9, theme.waveform, theme.peak, 'music');
    nextNoteTime += theme.noteDuration;
    musicNoteIndex++;
  }
  musicTimer = globalThis.setTimeout(scheduleMusic, 250);
}

function startMusic() {
  if (musicStarted) return;
  if (!ensureContext()) return;
  musicStarted = true;
  nextNoteTime = ctx.currentTime + 0.1;
  scheduleMusic();
}

// Switches the looping background theme (see MUSIC_THEMES). Restarts the
// beat on the next schedule tick rather than mid-phrase, so a screen change
// doesn't leave two themes' notes overlapping for long.
function setMusicTheme(theme) {
  if (!MUSIC_THEMES[theme] || musicThemeName === theme) return;
  musicThemeName = theme;
  musicNoteIndex = 0;
  if (ctx) nextNoteTime = ctx.currentTime + 0.05;
}

function stopMusic() {
  musicStarted = false;
  if (musicTimer !== null && typeof globalThis.clearTimeout === 'function') {
    globalThis.clearTimeout(musicTimer);
    musicTimer = null;
  }
}

// Browsers block audio until a user gesture; start music on the first
// click/keypress anywhere, whatever screen that happens on.
function attachStartupUnlock() {
  if (startupListenerAttached || typeof document === 'undefined') return;
  startupListenerAttached = true;
  function unlock() {
    const c = ensureContext();
    if (c && c.state === 'suspended' && typeof c.resume === 'function') {
      c.resume();
    }
    startMusic();
    document.removeEventListener('pointerdown', unlock);
    document.removeEventListener('keydown', unlock);
  }
  document.addEventListener('pointerdown', unlock);
  document.addEventListener('keydown', unlock);
}

// A single delegated listener covers every UI button (main menu, settings,
// pause, stage select, ending) without each screen wiring its own sound.
function attachButtonClickSound() {
  if (typeof document === 'undefined') return;
  document.addEventListener('click', function (e) {
    const btn = e.target.closest ? e.target.closest('button') : null;
    if (btn && !btn.disabled) playClick();
  });
}

attachStartupUnlock();
attachButtonClickSound();

G.Audio = {
  playCoin: playCoin,
  playActionBlocked: playActionBlocked,
  playStageClear: playStageClear,
  playEnding: playEnding,
  startMusic: startMusic,
  stopMusic: stopMusic,
  setMusicTheme: setMusicTheme,
  setMasterVolume: setMasterVolume,
  setCategoryVolume: setCategoryVolume
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = G.Audio;
}
