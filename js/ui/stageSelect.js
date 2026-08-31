globalThis.G = globalThis.G || {};
var G = globalThis.G;

// 스테이지 선택 화면: G.Stages를 번호가 매겨진 정사각형 타일 그리드로,
// 등록된 스테이지를 번호순으로 6개씩 렌더링.
// - 1번 스테이지, 또는 (정렬 순서상) 바로 앞 스테이지가 클리어된 스테이지만
//   잠금 해제됨.
// - 클리어됨 / 열려있음(미클리어) / 잠김을 시각적으로 구분.
// - 잠기지 않은 스테이지를 클릭하면 G.Main.init(stageData) 후 PLAYING으로 전환.
//
// G.Stages may legitimately be empty/undefined at the time this runs (stage
// data is populated by a separate task) — always treat it defensively.

const PAGE_SIZE = 6;
let currentPage = 0;

function sortedStages() {
  return (G.Stages || []).slice().sort(function (a, b) { return a.id - b.id; });
}

function render() {
  if (typeof document === 'undefined' || !document.getElementById) return;
  const grid = document.getElementById('stage-grid');
  if (!grid) return;

  const stages = sortedStages();
  const cleared = (G.Storage ? G.Storage.getClearedStages() : []) || [];
  const pageCount = Math.max(1, Math.ceil(stages.length / PAGE_SIZE));
  currentPage = Math.min(currentPage, pageCount - 1);
  const pageStart = currentPage * PAGE_SIZE;
  grid.innerHTML = '';
  stages.slice(pageStart, pageStart + PAGE_SIZE).forEach(function (stage, pageIndex) {
    const idx = pageStart + pageIndex;
    const unlocked = (idx === 0) || (cleared.indexOf(stages[idx - 1].id) !== -1);
    const isCleared = cleared.indexOf(stage.id) !== -1;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'stage-tile ' + (isCleared ? 'stage-cleared' : (unlocked ? 'stage-unlocked' : 'stage-locked'));
    const status = document.createElement('span');
    status.className = 'stage-status';
    status.textContent = isCleared ? 'CLEAR' : (unlocked ? 'AVAILABLE' : 'LOCKED');
    const number = document.createElement('span');
    number.className = 'stage-number';
    number.textContent = String(stage.id).padStart(2, '0');
    const name = document.createElement('span');
    name.className = 'stage-name';
    name.textContent = stage.name || ('스테이지 ' + stage.id);
    const label = '스테이지 ' + stage.id + ', ' + name.textContent;
    btn.append(status, number, name);
    btn.title = label;
    btn.setAttribute('aria-label', label + ', ' + status.textContent);
    btn.disabled = !unlocked;

    if (unlocked) {
      btn.addEventListener('click', function () {
        G.Main.init(stage);
        G.State.goTo(G.State.SCREENS.PLAYING);
      });
    }

    grid.appendChild(btn);
  });

  const pagination = document.getElementById('stage-pagination');
  const prevBtn = document.getElementById('stage-page-prev');
  const nextBtn = document.getElementById('stage-page-next');
  const pageLabel = document.getElementById('stage-page-label');
  if (pagination) pagination.hidden = pageCount <= 1;
  if (prevBtn) prevBtn.disabled = currentPage === 0;
  if (nextBtn) nextBtn.disabled = currentPage === pageCount - 1;
  if (pageLabel) pageLabel.textContent = (currentPage + 1) + ' / ' + pageCount;
}

function changePage(offset) {
  const lastPage = Math.max(0, Math.ceil(sortedStages().length / PAGE_SIZE) - 1);
  currentPage = Math.max(0, Math.min(lastPage, currentPage + offset));
  render();
}

function bindStageSelect() {
  if (typeof document === 'undefined' || !document.getElementById) return;
  const backBtn = document.getElementById('stage-select-back');
  if (backBtn) {
    backBtn.addEventListener('click', function () {
      G.State.goTo(G.State.SCREENS.MAIN_MENU);
    });
  }
  const prevBtn = document.getElementById('stage-page-prev');
  const nextBtn = document.getElementById('stage-page-next');
  if (prevBtn) prevBtn.addEventListener('click', function () { changePage(-1); });
  if (nextBtn) nextBtn.addEventListener('click', function () { changePage(1); });
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
