globalThis.G = globalThis.G || {};
var G = globalThis.G;

// 메인 화면: 시작하기 -> 스테이지 선택, 설정 -> 설정 화면.

function bindMainMenu() {
  if (typeof document === 'undefined' || !document.getElementById) return;

  const startBtn = document.getElementById('btn-start');
  if (startBtn) {
    startBtn.addEventListener('click', function () {
      G.State.goTo(G.State.SCREENS.STAGE_SELECT);
    });
  }

  const tutorialBtn = document.getElementById('btn-tutorial');
  if (tutorialBtn) {
    tutorialBtn.addEventListener('click', function () {
      if (G.Tutorial) G.Tutorial.launch();
    });
  }

  const settingsBtn = document.getElementById('btn-settings');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', function () {
      G.State.goTo(G.State.SCREENS.SETTINGS);
    });
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindMainMenu);
  } else {
    bindMainMenu();
  }
}

G.MainMenu = { bind: bindMainMenu };

if (typeof module !== 'undefined' && module.exports) {
  module.exports = G.MainMenu;
}
