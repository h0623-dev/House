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
const chapterIcons = ['sun', 'axe', 'hammer', 'seeds', 'shield', 'home'];
const destinationIcons: Record<GrowthQuestView['destination']['kind'], string> = {
 gather: 'map', harvest: 'food', plant: 'seeds', water: 'water', build: 'hammer',
 collect: 'bag', upgrade: 'hammer', chop: 'axe', hunt: 'hunt', expand: 'expand',
};

export function growthQuestStatusLabel(status: GrowthQuestStatus): string {
 return { active: '진행 중', ready: '보상 받기', claimed: '수령 완료', locked: '다음 목표' }[status];
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

/** All action targets remain mounted so ticks can update a card in place. */
export function renderGrowthQuestCard(quest: GrowthQuestView, position = 1): string {
 const current = Math.min(Math.max(0, quest.current), quest.target);
 const progress = quest.target > 0 ? Math.min(100, current / quest.target * 100) : 0;
 const ready = quest.status === 'ready', active = quest.status === 'active';
 return `<article class="growth-quest-card ${quest.status}" data-growth-quest="${escape(quest.id)}" data-quest-state="${quest.status}">
  <div class="growth-quest-heading"><span class="growth-quest-number" aria-hidden="true">${String(position).padStart(2, '0')}</span><h3>${escape(quest.title)}</h3><span class="growth-quest-status" data-quest-status>${growthQuestStatusLabel(quest.status)}</span></div>
  <p class="growth-quest-description">${escape(quest.description)}</p>
  <div class="growth-quest-progress"><div class="quest-progress" data-quest-progress role="progressbar" aria-label="${escape(quest.title)} 진행도" aria-valuemin="0" aria-valuemax="${count(quest.target)}" aria-valuenow="${count(current)}"><span style="width:${progress}%"></span></div><span class="growth-quest-count" data-quest-count>${count(current)} / ${count(quest.target)}</span></div>
  ${renderGrowthQuestRewards(quest.reward)}
  <p class="growth-quest-hint" data-quest-hint${hidden(!active)}>${escape(quest.hint)}</p>
  <div class="growth-quest-actions" data-quest-actions>
   <button class="button button-light full-width growth-quest-goto" data-quest-goto="${escape(quest.id)}" aria-label="${escape(quest.title)} 하러 가기"${hidden(!active)}>${icon(destinationIcons[quest.destination.kind])}<span>하러 가기</span>${icon('arrow')}</button>
   <button class="button full-width growth-quest-claim" data-quest-claim="${escape(quest.id)}" aria-label="${escape(quest.title)} 보상 받기"${hidden(!ready)}>${icon('bag')}<span>보상 받기</span></button>
   <p class="growth-quest-lock" data-quest-locked${hidden(quest.status !== 'locked')}>${icon('flag')} 앞 목표의 보상을 받으면 시작해요</p>
   <p class="growth-quest-done" data-quest-claimed${hidden(quest.status !== 'claimed')}>${icon('check')} 보상을 받았어요</p>
  </div>
 </article>`;
}

export function renderLegacyGrowthGoals(state: GameState): string {
 return `<details class="growth-legacy-goals"><summary>${icon('book')} 이전 생존 목표 기록 ${icon('chevron')}</summary><p class="growth-legacy-note">기존 생존 목표의 진행과 보상 기록도 그대로 이어져요. 달성 보상은 자동으로 지급돼요.</p><div class="growth-legacy-list">${questList(state).map(quest => {
  const earned = state.quests.includes(quest.id);
  return `<article class="growth-legacy-row ${earned ? 'claimed' : quest.complete ? 'ready' : 'active'}" data-growth-legacy="${escape(quest.id)}"><div class="growth-legacy-title"><strong>${escape(quest.title)}</strong><span data-legacy-status>${earned ? '보상 지급 완료' : quest.complete ? '달성' : '진행 중'}</span></div><p>${escape(quest.description)}</p><span class="growth-legacy-count" data-legacy-count>${count(quest.current)} / ${count(quest.target)}</span><small>${escape(quest.reward)}</small></article>`;
 }).join('')}</div></details>`;
}

export function renderGrowthQuestBoard(state: GameState, selectedChapter?: number): string {
 const quests = getGrowthQuests(state), active = getActiveGrowthQuest(state);
 const selected = GROWTH_CHAPTERS.find(chapter => chapter.id === selectedChapter)
  ?? GROWTH_CHAPTERS.find(chapter => chapter.id === active?.chapter)
  ?? GROWTH_CHAPTERS[GROWTH_CHAPTERS.length - 1];
 const claimed = quests.filter(quest => quest.status === 'claimed').length;
 const chapterQuests = quests.filter(quest => quest.chapter === selected.id);
 const chapterClaimed = chapterQuests.filter(quest => quest.status === 'claimed').length;
 const locked = chapterQuests.every(quest => quest.status === 'locked');
 return `<section class="growth-quest-board" data-growth-board data-selected-chapter="${selected.id}" aria-label="트럭 마을 성장 목표">
  <div class="growth-overview"><span class="growth-overview-art">${icon('flag')}</span><div class="growth-overview-copy"><small>트럭 위에서 함께 만드는 내일</small><strong data-growth-overview-title>${claimed === quests.length ? '우리 마을의 모든 이야기를 완성했어요' : '목표를 달성하고 보상을 받아요'}</strong><p>보상을 받으면 다음 이야기가 시작돼요.</p></div><b class="growth-overview-count"><span data-growth-claimed-count>${claimed}</span><small>/ ${quests.length}</small></b></div>
  <nav class="growth-chapter-tabs" aria-label="성장 이야기 챕터">${GROWTH_CHAPTERS.map(chapter => {
   const items = quests.filter(quest => quest.chapter === chapter.id);
   const complete = items.every(quest => quest.status === 'claimed');
   const chapterLocked = items.every(quest => quest.status === 'locked');
   const status = complete ? '완료' : chapterLocked ? '미리 보기' : '진행 중';
   return `<button class="growth-chapter-tab ${chapter.id === selected.id ? 'selected' : ''} ${complete ? 'completed' : chapterLocked ? 'locked' : 'unlocked'}" data-quest-chapter="${chapter.id}" aria-pressed="${chapter.id === selected.id}" aria-label="${chapter.id}장 ${escape(chapter.title)} ${status}"><span class="growth-chapter-number">${complete ? icon('check') : String(chapter.id).padStart(2, '0')}</span><strong>${escape(chapter.title)}</strong><small data-growth-chapter-status>${status}</small></button>`;
  }).join('')}</nav>
  <div class="growth-chapter-story ${locked ? 'locked' : ''}"><span class="growth-story-art">${icon(chapterIcons[selected.id - 1] ?? 'book')}</span><div><small>CHAPTER ${String(selected.id).padStart(2, '0')}${locked ? ' · 다음 이야기' : ''}</small><strong>${escape(selected.title)}</strong><p>${escape(selected.story)}</p></div><b class="growth-chapter-count" data-growth-chapter-count>${chapterClaimed} / ${chapterQuests.length}</b></div>
  <p class="growth-chapter-description">${escape(selected.description)}</p>
  <div class="growth-quest-list">${chapterQuests.map((quest, index) => renderGrowthQuestCard(quest, index + 1)).join('')}</div>
  ${renderLegacyGrowthGoals(state)}
 </section>`;
}
