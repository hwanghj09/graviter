globalThis.G = globalThis.G || {};
var G = globalThis.G;

// 엔딩 화면: 마지막 스테이지 클리어 후 표시.

function bindEnding() {
  if (typeof document === 'undefined' || !document.getElementById) return;
  const btn = document.getElementById('ending-menu');
  if (btn) {
    btn.addEventListener('click', function () {
      G.State.goTo(G.State.SCREENS.MAIN_MENU);
    });
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindEnding);
  } else {
    bindEnding();
  }
}

G.Ending = { bind: bindEnding };

if (typeof module !== 'undefined' && module.exports) {
  module.exports = G.Ending;
}
