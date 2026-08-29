globalThis.G = globalThis.G || {};
var G = globalThis.G;

// DOMContentLoaded bootstrap — shows MAIN_MENU by default instead of
// auto-starting gameplay. Runs after every synchronous <script> (including
// js/main.js) has already executed, so G.State/G.Main are fully set up.

function bootstrap() {
  if (G.State) {
    G.State.goTo(G.State.SCREENS.MAIN_MENU);
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
}

G.Bootstrap = { run: bootstrap };

if (typeof module !== 'undefined' && module.exports) {
  module.exports = G.Bootstrap;
}
