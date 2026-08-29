globalThis.G = globalThis.G || {};
var G = globalThis.G;

// G.Physics reports {cleared:true} to js/main.js's loop, which (only once
// per world, on the cleared:false -> true transition) calls
// G.Main.onStageClear(stageId). We hook that here: show a brief STAGE_CLEAR
// overlay, persist the cleared stage id, then auto-advance to the next
// stage in G.Stages (by ascending id) or to ENDING if this was the last one.
//
// NOTE on load order: index.html loads UI scripts (this file included)
// *before* js/main.js, but js/main.js assigns `G.Main = {...}` as a whole
// object (not a merge), which would wipe out an onStageClear set at this
// file's top-level eval time. To avoid that, the hook is attached from a
// DOMContentLoaded listener instead — by the time DOMContentLoaded fires,
// every synchronous <script> (including js/main.js) has already run, so
// G.Main already exists and our assignment sticks.

const CLEAR_DISPLAY_MS = 1500;
let _timer = null;

function sortedStages() {
  return (G.Stages || []).slice().sort(function (a, b) { return a.id - b.id; });
}

function advance(stageId) {
  const stages = sortedStages();
  const idx = stages.findIndex(function (s) { return s.id === stageId; });
  const next = (idx !== -1) ? stages[idx + 1] : undefined;

  if (next) {
    G.Main.init(next);
    G.State.goTo(G.State.SCREENS.PLAYING);
  } else {
    G.State.goTo(G.State.SCREENS.ENDING);
  }
}

function onStageClear(stageId) {
  if (G.Storage) G.Storage.addClearedStage(stageId);
  G.State.goTo(G.State.SCREENS.STAGE_CLEAR);

  if (_timer !== null && typeof globalThis.clearTimeout === 'function') {
    globalThis.clearTimeout(_timer);
    _timer = null;
  }

  if (typeof globalThis.setTimeout === 'function') {
    _timer = globalThis.setTimeout(function () {
      _timer = null;
      advance(stageId);
    }, CLEAR_DISPLAY_MS);
  } else {
    advance(stageId);
  }
}

function attachHook() {
  G.Main = G.Main || {};
  G.Main.onStageClear = onStageClear;
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachHook);
  } else {
    attachHook();
  }
} else {
  attachHook();
}

G.StageClear = { onStageClear: onStageClear };

if (typeof module !== 'undefined' && module.exports) {
  module.exports = G.StageClear;
}
