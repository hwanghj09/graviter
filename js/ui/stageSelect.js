globalThis.G = globalThis.G || {};
var G = globalThis.G;

// 스테이지 선택 화면: G.Stages를 번호가 매겨진 정사각형 타일 그리드로,
// 등록된 모든 스테이지를 한 번에 렌더링.
// - 1번 스테이지, 또는 (정렬 순서상) 바로 앞 스테이지가 클리어된 스테이지만
//   잠금 해제됨.
// - 클리어됨 / 열려있음(미클리어) / 잠김을 시각적으로 구분.
// - 잠기지 않은 스테이지를 클릭하면 G.Main.init(stageData) 후 PLAYING으로 전환.
//
// G.Stages may legitimately be empty/undefined at the time this runs (stage
// data is populated by a separate task) — always treat it defensively.

function sortedStages() {
  return (G.Stages || []).slice().sort(function (a, b) { return a.id - b.id; });
}

function render() {
  if (typeof document === 'undefined' || !document.getElementById) return;
  const grid = document.getElementById('stage-grid');
  if (!grid) return;

  const stages = sortedStages();
  const cleared = (G.Storage ? G.Storage.getClearedStages() : []) || [];
  grid.innerHTML = '';
  stages.forEach(function (stage) {
    const idx = stages.indexOf(stage);
    const unlocked = (idx === 0) || (cleared.indexOf(stages[idx - 1].id) !== -1);
    const isCleared = cleared.indexOf(stage.id) !== -1;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'stage-tile ' + (isCleared ? 'stage-cleared' : (unlocked ? 'stage-unlocked' : 'stage-locked'));
    btn.textContent = String(stage.id);
    btn.title = stage.name || ('스테이지 ' + stage.id);
    btn.disabled = !unlocked;

    if (unlocked) {
      btn.addEventListener('click', function () {
        G.Main.init(stage);
        G.State.goTo(G.State.SCREENS.PLAYING);
      });
    }

    grid.appendChild(btn);
  });

}

function bindStageSelect() {
  if (typeof document === 'undefined' || !document.getElementById) return;
  const backBtn = document.getElementById('stage-select-back');
  if (backBtn) {
    backBtn.addEventListener('click', function () {
      G.State.goTo(G.State.SCREENS.MAIN_MENU);
    });
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindStageSelect);
  } else {
    bindStageSelect();
  }
}

G.StageSelect = { bind: bindStageSelect, render: render };

if (typeof module !== 'undefined' && module.exports) {
  module.exports = G.StageSelect;
}
