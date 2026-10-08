import { CROPS, CROP_IDS, questList, resourceLabels, type GameState, type Resource } from './game';
import { GROWTH_CHAPTERS, getActiveGrowthQuest, getGrowthQuests } from './growth-quests';
import { cropIcon } from './crop-art';
import { icon } from './icons';

export type GrowthQuestView = ReturnType<typeof getGrowthQuests>[number];
export type GrowthQuestReward = GrowthQuestView['reward'];
export type GrowthQuestStatus = GrowthQuestView['status'];

const escape = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!));
const hidden = (value: boolean) => value ? ' hidden' : '';
const count = (value: number) => String(Math.max(0, Math.floor(Number.isFinite(value) ? value : 0)));
const destinationIcons: Record<GrowthQuestView['destination']['kind'], string> = {
 gather: 'map', harvest: 'food', plant: 'seeds', water: 'water', build: 'hammer',
 collect: 'bag', upgrade: 'hammer', chop: 'axe', hunt: 'hunt', expand: 'expand',
};

export function growthQuestStatusLabel(status: GrowthQuestStatus): string {
 return { active: '진행 중', ready: '보상 받기', claimed: '완료', locked: '예정' }[status];
}

export function renderGrowthQuestRewards(reward: GrowthQuestReward): string {
 const resources = (Object.keys(resourceLabels) as Resource[])
  .filter(resource => (reward.resources?.[resource] ?? 0) > 0)
  .map(resource => `<span class="growth-reward" title="${resourceLabels[resource]} ${count(reward.resources![resource]!)}개">${icon(resource)}<span>${resourceLabels[resource]} <b>+${count(reward.resources![resource]!)}</b></span></span>`);
 const seeds = CROP_IDS.filter(cropId => (reward.seeds?.[cropId] ?? 0) > 0)
  .map(cropId => `<span class="growth-reward seed" title="${CROPS[cropId].seedName} ${count(reward.seeds![cropId]!)}개">${cropIcon(cropId, 'seed')}<span>${CROPS[cropId].name} 씨앗 <b>+${count(reward.seeds![cropId]!)}</b></span></span>`);
 if (reward.xp > 0) seeds.push(`<span class="growth-reward xp" title="경험치 ${count(reward.xp)}">${icon('sparkle')}<span>경험치 <b>+${count(reward.xp)}</b></span></span>`);
 return `<div class="growth-rewards" aria-label="목표 보상">${[...resources, ...seeds].join('')}</div>`;
}

/** The current action comes before rewards so it stays visible on small phones. */
export function renderGrowthQuestCard(quest: GrowthQuestView, position = 1): string {
 const current = Math.min(Math.max(0, quest.current), quest.target);
 const progress = quest.target > 0 ? Math.min(100, current / quest.target * 100) : 0;
 return `<article class="growth-quest-card ${quest.status}" data-growth-quest="${escape(quest.id)}" data-quest-state="${quest.status}" aria-label="${escape(quest.title)}">
  <div class="growth-current-label"><span>지금 할 일</span><span class="growth-quest-status" data-quest-status>${growthQuestStatusLabel(quest.status)}</span></div>
  <h3 class="growth-current-instruction">${escape(quest.description)}</h3>
  <div class="growth-quest-progress"><div class="quest-progress" data-quest-progress role="progressbar" aria-label="${escape(quest.title)} 진행도" aria-valuemin="0" aria-valuemax="${count(quest.target)}" aria-valuenow="${count(current)}"><span style="width:${progress}%"></span></div><span class="growth-quest-count" data-quest-count>${count(current)} / ${count(quest.target)}</span></div>
  <div class="growth-quest-actions" data-quest-actions>
   <button class="button full-width growth-quest-goto" data-quest-goto="${escape(quest.id)}" aria-label="${escape(quest.title)} 하러 가기"${hidden(quest.status !== 'active')}>${icon(destinationIcons[quest.destination.kind])}<span>하러 가기</span>${icon('arrow')}</button>
   <button class="button full-width growth-quest-claim" data-quest-claim="${escape(quest.id)}" aria-label="${escape(quest.title)} 보상 받기"${hidden(quest.status !== 'ready')}>${icon('bag')}<span>보상 받기</span></button>
   <p class="growth-quest-lock" data-quest-locked${hidden(quest.status !== 'locked')}>앞 목표를 완료하면 시작할 수 있어요.</p>
   <p class="growth-quest-done" data-quest-claimed${hidden(quest.status !== 'claimed')}>${icon('check')} 받은 보상이 마을에 더해졌어요.</p>
  </div>
  <div class="growth-current-reward"><span class="growth-reward-label">받을 보상</span>${renderGrowthQuestRewards(quest.reward)}</div>
  <details class="growth-help" data-quest-help><summary>진행 방법 ${icon('chevron')}</summary><p data-quest-hint>${escape(quest.hint)}</p></details>
  <span class="growth-accessible-position">${position}번째 성장 목표</span>
 </article>`;
}

export function renderLegacyGrowthGoals(state: GameState): string {
 return `<details class="growth-legacy-goals"><summary>이전 생존 목표 기록 ${icon('chevron')}</summary><p class="growth-legacy-note">이 목표는 달성하면 보상이 자동 지급돼요.</p><div class="growth-legacy-list">${questList(state).map(quest => {
  const earned = state.quests.includes(quest.id);
  return `<article class="growth-legacy-row ${earned ? 'claimed' : quest.complete ? 'ready' : 'active'}" data-growth-legacy="${escape(quest.id)}"><div class="growth-legacy-title"><strong>${escape(quest.title)}</strong><span data-legacy-status>${earned ? '보상 지급 완료' : quest.complete ? '달성' : '진행 중'}</span></div><p>${escape(quest.description)}</p><span class="growth-legacy-count" data-legacy-count>${count(quest.current)} / ${count(quest.target)}</span><small>${escape(quest.reward)}</small></article>`;
 }).join('')}</div></details>`;
}

function renderHistoryRow(quest: GrowthQuestView, position: number): string {
 return `<details class="growth-history-row ${quest.status}" data-growth-history="${escape(quest.id)}" data-quest-state="${quest.status}">
  <summary><span class="growth-history-number">${String(position).padStart(2, '0')}</span><span class="growth-history-title">${escape(quest.title)}</span><span class="growth-history-status" data-history-status>${growthQuestStatusLabel(quest.status)}</span>${icon('chevron')}</summary>
  <div class="growth-history-content"><p>${escape(quest.description)} <span data-history-count>${count(quest.current)} / ${count(quest.target)}</span></p>${renderGrowthQuestRewards(quest.reward)}<small data-history-note>${quest.status === 'claimed' ? '이 보상은 이미 받았어요.' : quest.status === 'locked' ? '앞 목표의 보상을 받으면 시작해요.' : '위의 지금 할 일에서 진행할 수 있어요.'}</small></div>
 </details>`;
}

function renderAllComplete(): string {
 return `<article class="growth-all-complete" data-growth-complete>${icon('check')}<h3>24개 목표를 모두 완료했어요!</h3><p>가장 넓어진 트럭 마을에서<br>농사와 생산, 꾸미기를 이어 가요.</p><button class="button full-width" data-close>마을로 돌아가기</button></article>`;
}

export function renderGrowthQuestBoard(state: GameState, selectedChapter?: number): string {
 const quests = getGrowthQuests(state), active = getActiveGrowthQuest(state);
 const claimed = quests.filter(quest => quest.status === 'claimed').length;
 const chapter = GROWTH_CHAPTERS.find(chapter => chapter.id === active?.chapter) ?? GROWTH_CHAPTERS[GROWTH_CHAPTERS.length - 1];
 return `<section class="growth-quest-board growth-simple" data-growth-board data-selected-chapter="${selectedChapter ?? chapter.id}" data-current-quest="${active?.id ?? ''}" aria-label="마을 성장 목표">
  <div class="growth-simple-overview"><span data-growth-overview-title>${active ? `${chapter.id}장 · ${escape(chapter.title)}` : '마을 성장 완료'}</span><span class="growth-total"><b data-growth-claimed-count>${claimed}</b> / ${quests.length} 완료</span></div>
  <div class="growth-current" data-growth-current>${active ? renderGrowthQuestCard(active, claimed + 1) : renderAllComplete()}</div>
  <details class="growth-all-goals" data-growth-all-goals><summary><span>전체 목표</span><span class="growth-all-caption">진행 순서와 받은 보상</span>${icon('chevron')}</summary>
   <div class="growth-history">${GROWTH_CHAPTERS.map(chapter => `<section class="growth-history-chapter" data-growth-history-chapter="${chapter.id}"><h4>${chapter.id}장 · ${escape(chapter.title)}<span data-growth-chapter-count>${quests.filter(quest => quest.chapter === chapter.id && quest.status === 'claimed').length} / 4</span></h4>${quests.map((quest, index) => ({ quest, index })).filter(({ quest }) => quest.chapter === chapter.id).map(({ quest, index }) => renderHistoryRow(quest, index + 1)).join('')}</section>`).join('')}</div>
  </details>
  ${renderLegacyGrowthGoals(state)}
 </section>`;
}

/** Keep open details, reading position and focused controls intact during ticks. */
export function updateGrowthQuestBoard(board: HTMLElement, state: GameState): void {
 const quests = getGrowthQuests(state), active = quests.find(quest => quest.status === 'active' || quest.status === 'ready');
 const claimed = quests.filter(quest => quest.status === 'claimed').length;
 const chapter = GROWTH_CHAPTERS.find(chapter => chapter.id === active?.chapter);
 board.querySelector('[data-growth-claimed-count]')!.textContent = String(claimed);
 board.querySelector('[data-growth-overview-title]')!.textContent = chapter ? `${chapter.id}장 · ${chapter.title}` : '마을 성장 완료';
 if (board.dataset.currentQuest !== (active?.id ?? '')) {
  board.dataset.currentQuest = active?.id ?? '';
  board.querySelector('[data-growth-current]')!.innerHTML = active ? renderGrowthQuestCard(active, claimed + 1) : renderAllComplete();
 }
 if (active) {
  const card = board.querySelector<HTMLElement>('[data-growth-quest]')!;
  card.classList.toggle('active', active.status === 'active');
  card.classList.toggle('ready', active.status === 'ready');
  card.dataset.questState = active.status;
  card.querySelector('[data-quest-status]')!.textContent = growthQuestStatusLabel(active.status);
  card.querySelector('[data-quest-count]')!.textContent = `${count(active.current)} / ${count(active.target)}`;
  const progress = card.querySelector<HTMLElement>('[data-quest-progress]')!;
  progress.setAttribute('aria-valuenow', count(active.current));
  progress.querySelector<HTMLElement>('span')!.style.width = `${Math.min(100, active.current / active.target * 100)}%`;
  card.querySelector<HTMLElement>('[data-quest-goto]')!.hidden = active.status !== 'active';
  card.querySelector<HTMLElement>('[data-quest-claim]')!.hidden = active.status !== 'ready';
 }
 for (const quest of quests) {
  const row = board.querySelector<HTMLElement>(`[data-growth-history="${quest.id}"]`)!;
  if (row.dataset.questState !== quest.status) {
   row.classList.remove('active', 'ready', 'claimed', 'locked');
   row.classList.add(quest.status); row.dataset.questState = quest.status;
   row.querySelector('[data-history-status]')!.textContent = growthQuestStatusLabel(quest.status);
   row.querySelector('[data-history-note]')!.textContent = quest.status === 'claimed' ? '이 보상은 이미 받았어요.' : quest.status === 'locked' ? '앞 목표의 보상을 받으면 시작해요.' : '위의 지금 할 일에서 진행할 수 있어요.';
  }
  row.querySelector('[data-history-count]')!.textContent = `${count(quest.current)} / ${count(quest.target)}`;
 }
 board.querySelectorAll<HTMLElement>('[data-growth-history-chapter]').forEach(section => {
  const chapterQuests = quests.filter(quest => quest.chapter === Number(section.dataset.growthHistoryChapter));
  section.querySelector('[data-growth-chapter-count]')!.textContent = `${chapterQuests.filter(quest => quest.status === 'claimed').length} / ${chapterQuests.length}`;
 });
 for (const quest of questList(state)) {
  const row = board.querySelector<HTMLElement>(`[data-growth-legacy="${quest.id}"]`)!;
  const earned = state.quests.includes(quest.id);
  row.classList.toggle('claimed', earned); row.classList.toggle('ready', !earned && quest.complete); row.classList.toggle('active', !earned && !quest.complete);
  row.querySelector('[data-legacy-status]')!.textContent = earned ? '보상 지급 완료' : quest.complete ? '달성' : '진행 중';
  row.querySelector('[data-legacy-count]')!.textContent = `${count(quest.current)} / ${count(quest.target)}`;
 }
}
