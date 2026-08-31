globalThis.G = globalThis.G || {};
var G = globalThis.G;

// DOMContentLoaded bootstrap — shows MAIN_MENU by default instead of
// auto-starting gameplay. Runs after every synchronous <script> (including
// js/main.js) has already executed, so G.State/G.Main are fully set up.

function shouldStartTutorial() {
  const debugging = typeof globalThis.location !== 'undefined' &&
    globalThis.location.search && globalThis.location.search.indexOf('debug=1') !== -1;
  return !debugging && G.Storage && !G.Storage.isTutorialComplete();
}

function bootstrap() {
  if (!G.State) return;
  if (shouldStartTutorial()) {
    G.State.goTo(G.State.SCREENS.TUTORIAL_PROMPT);
    return;
  }
  G.State.goTo(G.State.SCREENS.MAIN_MENU);
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
}

G.Bootstrap = { run: bootstrap, shouldStartTutorial: shouldStartTutorial };

if (typeof module !== 'undefined' && module.exports) {
  module.exports = G.Bootstrap;
}
