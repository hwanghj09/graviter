globalThis.G = globalThis.G || {};
var G = globalThis.G;

// 일시정지: PLAYING 도중 ESC를 누르거나, 탭이 백그라운드로 가거나(visibilitychange
// -> hidden) 창이 blur되면 표시됨. 버튼: 계속하기 / 설정 / 나가기.

function isPlaying() {
  return !!(G.State && G.State.getCurrent() === G.State.SCREENS.PLAYING);
}

function openPause() {
  if (isPlaying()) {
    G.State.goTo(G.State.SCREENS.PAUSE);
  }
}

function bindPauseMenu() {
  if (typeof document === 'undefined') return;

  document.addEventListener('keydown', function (e) {
    if (e.code === 'Escape') openPause();
  });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) openPause();
  });

  if (typeof globalThis.addEventListener === 'function') {
    globalThis.addEventListener('blur', function () {
      openPause();
    });
  }

  if (!document.getElementById) return;

  const resumeBtn = document.getElementById('pause-resume');
  if (resumeBtn) {
    resumeBtn.addEventListener('click', function () {
      G.State.goTo(G.State.SCREENS.PLAYING);
    });
  }

  const settingsBtn = document.getElementById('pause-settings');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', function () {
      G.State.goTo(G.State.SCREENS.SETTINGS);
    });
  }

  const exitBtn = document.getElementById('pause-exit');
  if (exitBtn) {
    exitBtn.addEventListener('click', function () {
      G.State.goTo(G.State.SCREENS.MAIN_MENU);
    });
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindPauseMenu);
  } else {
    bindPauseMenu();
  }
}

G.PauseMenu = { bind: bindPauseMenu };

if (typeof module !== 'undefined' && module.exports) {
  module.exports = G.PauseMenu;
}
