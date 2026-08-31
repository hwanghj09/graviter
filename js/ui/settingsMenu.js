globalThis.G = globalThis.G || {};
var G = globalThis.G;

// 설정 화면: SETTINGS(허브) → SETTINGS_CONTROLS(조작 설정) / SETTINGS_SOUND(사운드
// 설정) 두 하위 화면으로 분리되어 있음(화면 전환은 gameState.js가 담당).
// - 조작 설정: 재설정 버튼(left/right/jump/crouch/rotate/grab)을 클릭하면 다음
//   키 입력을 기다렸다가 G.Input.setKeybind로 반영(및 영속화)함.
// - 사운드 설정: 마스터 슬라이더(soundVolume) + 카테고리별 슬라이더
//   (categoryVolumes: music/effects/interaction)로 나뉘며, 각각 G.Storage에 바로
//   반영/저장되고 G.Audio의 해당 게인 노드에도 즉시 반영됨.

// Maps each volume slider's element id to how it reads/writes G.Storage and
// applies to G.Audio's gain graph. 'master' is the top-level soundVolume;
// the rest are per-category multipliers under it.
const VOLUME_SLIDERS = [
  {
    id: 'volume-master',
    get: function () { return G.Storage ? G.Storage.getSoundVolume() : 0.5; },
    set: function (vol) {
      if (G.Storage) G.Storage.setSoundVolume(vol);
      if (G.Audio && typeof G.Audio.setMasterVolume === 'function') G.Audio.setMasterVolume(vol);
    }
  },
  {
    id: 'volume-music',
    category: 'music'
  },
  {
    id: 'volume-effects',
    category: 'effects'
  },
  {
    id: 'volume-interaction',
    category: 'interaction'
  }
].map(function (entry) {
  if (!entry.category) return entry;
  const category = entry.category;
  return {
    id: entry.id,
    get: function () {
      const vols = G.Storage ? G.Storage.getCategoryVolumes() : {};
      return (category in vols) ? vols[category] : 1;
    },
    set: function (vol) {
      if (G.Storage) G.Storage.setCategoryVolume(category, vol);
      if (G.Audio && typeof G.Audio.setCategoryVolume === 'function') G.Audio.setCategoryVolume(category, vol);
    }
  };
});

const ACTIONS = ['left', 'right', 'jump', 'crouch', 'rotate', 'grab'];
// Labels cover every action that can appear in a keybinds object, used for
// both the button rows and readable names in conflict messages.
const ACTION_LABELS = {
  left: '왼쪽', right: '오른쪽', jump: '점프', crouch: '웅크리기',
  rotate: '중력 회전', grab: '블럭 잡기'
};
let _awaiting = null; // action currently waiting for the next keypress

function buttonForAction(action) {
  if (typeof document === 'undefined' || !document.getElementById) return null;
  return document.getElementById('keybind-' + action);
}

// left/right/jump/crouch always also respond to their arrow-key equivalent
// (see js/input/input.js), regardless of the configured primary bind, so a
// rebind that lands on an arrow key already "owned" by another action is a
// real conflict even though it never touches that action's primary code.
function activeCodesForAction(action, binds) {
  const codes = [];
  const primary = binds[action];
  if (primary) codes.push(primary);
  const arrowMap = (G.Input && G.Input.ARROW_EQUIVALENTS) || {};
  const arrow = arrowMap[action];
  if (arrow && codes.indexOf(arrow) === -1) codes.push(arrow);
  return codes;
}

// Groups every action in `binds` (including fixed rotate/grab, and the
// always-on arrow equivalents for movement actions) by key code and returns
// { action: [otherConflictingActions...] } for any code shared by 2+ actions.
function computeConflicts(binds) {
  const byCode = Object.create(null);
  Object.keys(binds).forEach(function (action) {
    activeCodesForAction(action, binds).forEach(function (code) {
      if (!byCode[code]) byCode[code] = [];
      if (byCode[code].indexOf(action) === -1) byCode[code].push(action);
    });
  });
  const conflicts = Object.create(null);
  Object.keys(byCode).forEach(function (code) {
    const actions = byCode[code];
    if (actions.length < 2) return;
    actions.forEach(function (action) {
      if (!conflicts[action]) conflicts[action] = [];
      actions.forEach(function (other) {
        if (other !== action && conflicts[action].indexOf(other) === -1) {
          conflicts[action].push(other);
        }
      });
    });
  });
  return conflicts;
}

function refreshConflictWarning(conflicts) {
  if (typeof document === 'undefined' || !document.getElementById) return;
  const el = document.getElementById('keybind-warning');
  if (!el) return;
  const seen = Object.create(null);
  const pairs = [];
  ACTIONS.forEach(function (action) {
    if (!conflicts[action]) return;
    conflicts[action].forEach(function (other) {
      const key = [action, other].sort().join('|');
      if (seen[key]) return;
      seen[key] = true;
      pairs.push((ACTION_LABELS[action] || action) + ' ↔ ' + (ACTION_LABELS[other] || other));
    });
  });
  if (pairs.length === 0) {
    el.hidden = true;
    el.textContent = '';
    return;
  }
  el.hidden = false;
  el.textContent = '⚠ 조작키가 겹칩니다: ' + pairs.join(', ');
}

function refreshKeybindLabels() {
  const binds = G.Storage ? G.Storage.getKeybinds() : {};
  const conflicts = computeConflicts(binds);
  ACTIONS.forEach(function (action) {
    const btn = buttonForAction(action);
    if (!btn) return;
    const isAwaitingThis = (_awaiting === action);
    btn.textContent = isAwaitingThis ? '키 입력 대기...' : (binds[action] || '-');
    btn.classList.toggle('conflict', !isAwaitingThis && !!conflicts[action]);
  });
  refreshConflictWarning(conflicts);
}

function refreshVolumeSliders() {
  if (typeof document === 'undefined' || !document.getElementById) return;
  VOLUME_SLIDERS.forEach(function (entry) {
    const slider = document.getElementById(entry.id);
    if (!slider) return;
    slider.value = String(entry.get());
  });
}

function beginRebind(action) {
  _awaiting = action;
  refreshKeybindLabels();
}

function showRejectedRebind(action, otherActions) {
  if (typeof document === 'undefined' || !document.getElementById) return;
  const el = document.getElementById('keybind-warning');
  if (!el) return;
  const otherLabels = otherActions.map(function (a) { return ACTION_LABELS[a] || a; }).join(', ');
  el.hidden = false;
  el.textContent = '⚠ 이미 사용 중인 키입니다 (' + (ACTION_LABELS[action] || action) + ' ↔ ' + otherLabels + ') — 저장되지 않았습니다.';
}

function handleRebindKeydown(e) {
  if (!_awaiting) return;
  e.preventDefault();
  const action = _awaiting;
  _awaiting = null;

  // Check the candidate key against every action's currently *saved* binds
  // (including arrow equivalents) before writing anything, so a conflicting
  // choice never reaches storage — the previous binding stays in effect.
  const currentBinds = G.Storage ? G.Storage.getKeybinds() : ((G.Input && G.Input.getKeybinds()) || {});
  const candidateBinds = Object.assign({}, currentBinds);
  candidateBinds[action] = e.code;
  const wouldConflict = computeConflicts(candidateBinds)[action];

  if (wouldConflict && wouldConflict.length > 0) {
    refreshKeybindLabels();
    showRejectedRebind(action, wouldConflict);
    return;
  }

  if (G.Input && typeof G.Input.setKeybind === 'function') {
    G.Input.setKeybind(action, e.code);
  } else if (G.Storage) {
    const binds = G.Storage.getKeybinds();
    binds[action] = e.code;
    G.Storage.setKeybinds(binds);
  }
  refreshKeybindLabels();
}

function bindSettingsMenu() {
  if (typeof document === 'undefined' || !document.getElementById) return;

  ACTIONS.forEach(function (action) {
    const btn = buttonForAction(action);
    if (btn) {
      btn.addEventListener('click', function () {
        beginRebind(action);
      });
    }
  });

  document.addEventListener('keydown', handleRebindKeydown);

  VOLUME_SLIDERS.forEach(function (entry) {
    const slider = document.getElementById(entry.id);
    if (!slider) return;
    slider.addEventListener('input', function () {
      entry.set(parseFloat(slider.value));
    });
  });

  const openControlsBtn = document.getElementById('settings-open-controls');
  if (openControlsBtn) {
    openControlsBtn.addEventListener('click', function () {
      G.State.goTo(G.State.SCREENS.SETTINGS_CONTROLS);
    });
  }

  const openSoundBtn = document.getElementById('settings-open-sound');
  if (openSoundBtn) {
    openSoundBtn.addEventListener('click', function () {
      G.State.goTo(G.State.SCREENS.SETTINGS_SOUND);
    });
  }

  const backBtn = document.getElementById('settings-back');
  if (backBtn) {
    backBtn.addEventListener('click', function () {
      G.State.exitSettings();
    });
  }

  const controlsBackBtn = document.getElementById('settings-controls-back');
  if (controlsBackBtn) {
    controlsBackBtn.addEventListener('click', function () {
      _awaiting = null;
      G.State.goTo(G.State.SCREENS.SETTINGS);
    });
  }

  const soundBackBtn = document.getElementById('settings-sound-back');
  if (soundBackBtn) {
    soundBackBtn.addEventListener('click', function () {
      G.State.goTo(G.State.SCREENS.SETTINGS);
    });
  }
}

// Called by gameState.js each time SETTINGS_CONTROLS / SETTINGS_SOUND
// becomes active, so the displayed labels/sliders always reflect current
// storage.
function renderControls() {
  _awaiting = null;
  refreshKeybindLabels();
}

function renderSound() {
  refreshVolumeSliders();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindSettingsMenu);
  } else {
    bindSettingsMenu();
  }
}

G.SettingsMenu = { bind: bindSettingsMenu, renderControls: renderControls, renderSound: renderSound };

if (typeof module !== 'undefined' && module.exports) {
  module.exports = G.SettingsMenu;
}
