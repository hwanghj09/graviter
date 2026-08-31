globalThis.G = globalThis.G || {};
var G = globalThis.G;

(function () {
  const INSTRUCTIONS = [
    '← → 방향키로 오른쪽으로 이동하세요.',
    '↑ 방향키로 장애물을 뛰어넘으세요.',
    '노란 코인에 닿아 수집하세요.',
    '블럭 가까이에서 X를 눌러 들어 올리세요.',
    '바닥에 선 상태에서 Z를 눌러 왼쪽 벽에 착지하세요.',
    '왼쪽 벽에서 Z를 한 번 더 눌러 천장으로 이동하세요.',
    '천장을 지난 뒤 Z를 두 번 더 눌러 아래 중력으로 돌아오고, 블럭을 발판으로 포탈에 도달하세요.'
  ];
  let active = false;
  let step = 0;
  let heldBlock = false;

  function elements() {
    if (typeof document === 'undefined') return {};
    return {
      hud: document.getElementById('tutorial-hud'),
      instruction: document.getElementById('tutorial-instruction')
    };
  }

  function render() {
    const ui = elements();
    if (ui.hud) ui.hud.hidden = !active;
    if (ui.instruction) ui.instruction.textContent = INSTRUCTIONS[step] || INSTRUCTIONS[INSTRUCTIONS.length - 1];
  }

  function start() {
    active = true;
    step = 0;
    heldBlock = false;
    render();
  }

  function launch() {
    if (!G.Main || !G.State || !G.createPuzzleStage) return;
    const stage = G.createPuzzleStage({
      id: 0, name: '중력 장비 훈련', puzzleType: '튜토리얼', type: 'tutorial'
    });
    start();
    G.Main.init(stage);
    G.State.goTo(G.State.SCREENS.PLAYING);
  }

  function update(world) {
    if (!active || !world || !world.isTutorial) return;
    const tile = G.Grid.TILE_SIZE;
    const previousStep = step;
    if (world.player.holdingBlock) heldBlock = true;

    if (step === 0 && world.player.px > tile * 8) step++;
    if (step === 1 && world.player.px > tile * 13) step++;
    if (step === 2 && world.coins[0] && world.coins[0].collected) step++;
    if (step === 3 && heldBlock) step++;
    if (step === 4 && world.player.gravityIndex === 1) step++;
    if (step === 5 && world.player.gravityIndex === 2) step++;
    if (step !== previousStep) render();
  }

  function finish() {
    active = false;
    render();
  }

  function bind() {
    const accept = document.getElementById('tutorial-accept');
    const decline = document.getElementById('tutorial-decline');
    if (accept) accept.addEventListener('click', launch);
    if (decline) {
      decline.addEventListener('click', function () {
        if (G.Storage) G.Storage.setTutorialComplete(true);
        G.State.goTo(G.State.SCREENS.MAIN_MENU);
      });
    }
  }

  G.Tutorial = { launch: launch, start: start, update: update, finish: finish };
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
    else bind();
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = G.Tutorial;
})();
