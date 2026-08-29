globalThis.G = globalThis.G || {};
var G = globalThis.G;

// G.Audio — sound via the Web Audio API. Everything here is synthesized
// (oscillators), not audio asset files, since there are no shipped sound
// assets in this project. All output routes through one master gain node
// kept at G.Storage's soundVolume, so the settings slider controls both
// music and effects together.
//
// Deliberately limited to a few meaningful moments (background music, coin
// pickup, stage clear, ending) — no sound is attached to every input action
// (grabbing/dropping a block, jumping, crouching, rotating gravity).

let ctx = null;
let masterGain = null;
let musicTimer = null;
let musicStarted = false;
let startupListenerAttached = false;

function currentVolume() {
  return G.Storage ? G.Storage.getSoundVolume() : 0.5;
}

function ensureContext() {
  if (ctx) return ctx;
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  masterGain = ctx.createGain();
  masterGain.gain.value = currentVolume();
  masterGain.connect(ctx.destination);
  return ctx;
}

function setVolume(vol) {
  if (masterGain) masterGain.gain.value = vol;
}

// One short tone: freq in Hz, startOffset/duration in seconds (offset is
// relative to "now"), waveform type, peak volume (0-1, scaled by master).
function tone(freq, startOffset, duration, type, peak) {
  if (!ctx || !masterGain) return;
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
  gain.connect(masterGain);
  osc.start(t0);
  osc.stop(t1 + 0.02);
}

function playCoin() {
  if (!ensureContext()) return;
  tone(880.0, 0, 0.08, 'triangle', 0.5);
  tone(1318.5, 0.06, 0.12, 'triangle', 0.45);
}

function playStageClear() {
  if (!ensureContext()) return;
  [523.25, 659.25, 783.99, 1046.5].forEach(function (freq, i) {
    tone(freq, i * 0.11, 0.18, 'square', 0.35);
  });
}

function playEnding() {
  if (!ensureContext()) return;
  [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach(function (freq, i) {
    tone(freq, i * 0.14, 0.28, 'square', 0.35);
  });
}

// Background music: a short, gentle repeating arpeggio, scheduled via the
// audio clock itself (look-ahead scheduling) rather than setInterval, so it
// never drifts out of time.
const MUSIC_NOTES = [392.0, 523.25, 466.16, 587.33]; // G4, C5, Bb4, D5
const MUSIC_NOTE_DURATION = 0.9;
const MUSIC_LOOKAHEAD = 1.0; // seconds of schedule kept queued at a time
let musicNoteIndex = 0;
let nextNoteTime = 0;

function scheduleMusic() {
  if (!musicStarted || !ctx || !masterGain) return;
  while (nextNoteTime < ctx.currentTime + MUSIC_LOOKAHEAD) {
    const freq = MUSIC_NOTES[musicNoteIndex % MUSIC_NOTES.length];
    tone(freq, nextNoteTime - ctx.currentTime, MUSIC_NOTE_DURATION * 0.9, 'sine', 0.12);
    nextNoteTime += MUSIC_NOTE_DURATION;
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

attachStartupUnlock();

G.Audio = {
  playCoin: playCoin,
  playStageClear: playStageClear,
  playEnding: playEnding,
  startMusic: startMusic,
  stopMusic: stopMusic,
  setVolume: setVolume
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = G.Audio;
}
