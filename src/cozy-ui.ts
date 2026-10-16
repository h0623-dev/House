import type { GameState, Resource } from './game';
import { resourceLabels } from './game';
import { companionPortrait } from './companion-art';
import { icon } from './icons';
import { UNIT_IDS, type UnitId } from './units';
import { getAnimalLifeView, getCozyDayGoals } from './cozy-life';
import { COZY_DECOR_IDS, COZY_DECOR_ITEMS, canCraftCozyDecoration, getDecorInventoryCount } from './cozy-decor';
import { cozyDecorIcon } from './cozy-decor-art';
import { getShop } from './shop';
import './cozy-ui.css';

export type CozyLifeTab = 'today' | 'friends' | 'decor';
const tabs: readonly CozyLifeTab[] = ['today', 'friends', 'decor'];
const tabNames: Record<CozyLifeTab, string> = { today: '오늘의 일상', friends: '동물 친구', decor: '트럭 꾸미기' };
const tabIcons: Record<CozyLifeTab, string> = { today: 'book', friends: 'paw', decor: 'sparkle' };
const clean = (value: string): string => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
const number = (value: number): string => value.toLocaleString('ko-KR');
const coinIcon = (): string => '<svg class="icon cozy-coin" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.3" fill="#eac575" stroke="#a87c37" stroke-width="1.2"/><circle cx="12" cy="12" r="6.5" fill="none" stroke="#fff0b7" stroke-width="1.2"/><path d="m12 6 1.8 3.8 4.2.6-3 3 .7 4.2-3.7-2-3.7 2 .7-4.2-3-3 4.2-.6Z" fill="#fff0b7"/></svg>';

function costChips(costs: Partial<Record<Resource | 'coins', number>>, state?: GameState): string {
  return Object.entries(costs).filter(([, amount]) => amount! > 0).map(([key, amount]) => {
    const resource = key as Resource | 'coins';
    const available = !state || (resource === 'coins' ? getShop(state).coins : state.resources[resource]) >= amount!;
    const label = resource === 'coins' ? '코인' : resourceLabels[resource];
    return `<span class="cozy-cost ${available ? '' : 'cozy-cost-short'}" aria-label="${label} ${amount}개${available ? '' : ' 부족'}">${resource === 'coins' ? coinIcon() : icon(resource)}<b>${number(amount!)}</b><span class="cozy-sr-only">${label}</span></span>`;
  }).join('');
}

function hearts(view: ReturnType<typeof getAnimalLifeView>, compact = false): string {
  return `<div class="cozy-affinity ${compact ? 'cozy-affinity-compact' : ''}"><div><span class="cozy-hearts" aria-label="친밀도 ${view.affinity} / 100">${Array.from({ length: 5 }, (_, index) => `<span class="${index < view.heartLevel ? 'cozy-heart-filled' : ''}">${icon('heart')}</span>`).join('')}</span><strong>${clean(view.affinityLabel)}</strong></div><div class="cozy-affinity-track" role="progressbar" aria-label="${clean(view.name)}와 친밀도" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${view.affinity}"><i style="width:${view.affinity}%"></i></div></div>`;
}

function animalActions(state: GameState, id: UnitId, now: number, compact = false): string {
  const view = getAnimalLifeView(state, id, now), gift = view.gift, request = view.request;
  const giftLabel = gift.done ? '오늘 선물 완료' : gift.ready ? '선물 주기' : '선물 재료 부족';
  const requestLabel = request.done ? '오늘 부탁 완료' : request.ready ? '부탁 들어주기' : '부탁 재료 부족';
  const affinityReward = Math.min(request.rewardAffinity, 100 - view.affinity);
  return `<div class="cozy-friend-actions ${compact ? 'cozy-actions-compact' : ''}"><div class="cozy-friend-action"><div class="cozy-action-copy"><strong>${icon('heart')}${clean(gift.label)}</strong><span>${costChips({ [gift.resource]: gift.amount }, state)}<small>${gift.done ? '마음이 전해졌어요' : '하루 한 번, 좋아하는 선물'}</small></span></div><button class="cozy-action-button cozy-button-soft" data-cozy-gift="${id}" ${gift.ready && !gift.done ? '' : 'disabled'} aria-label="${clean(view.name)}에게 ${giftLabel}">${gift.done ? icon('check') : ''}${giftLabel}</button></div><div class="cozy-friend-action cozy-request"><div class="cozy-action-copy"><strong>${clean(request.title)}</strong>${compact ? '' : `<p>${clean(request.description)}</p>`}<span>${costChips(request.costs, state)}<small>보답 ${coinIcon()} ${number(request.rewardCoins)} · ${affinityReward ? `친밀도 +${affinityReward}` : '친밀도 가득'}</small></span></div><button class="cozy-action-button" data-cozy-request="${id}" data-cozy-request-id="${clean(request.id)}" ${request.ready && !request.done ? '' : 'disabled'} aria-label="${clean(view.name)} ${requestLabel}">${request.done ? icon('check') : ''}${requestLabel}</button></div></div>`;
}

function todayContent(state: GameState, now: number): string {
  const goals = getCozyDayGoals(state, now), completed = goals.filter(goal => goal.claimed).length;
  const day = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', weekday: 'short' }).format(new Date(now));
  return `<section class="cozy-dayboard"><header class="cozy-day-heading"><span class="cozy-day-art">${icon('book')}</span><div><small>${day}</small><h3>오늘도, 우리 트럭에서</h3><p>친구와 인사하고, 작은 집을 가꿔요.</p></div><span class="cozy-day-stamp" aria-label="오늘 보상 ${completed} / ${goals.length}개 받음"><b>${completed}<small> / ${goals.length}</small></b><span>작은 추억</span></span></header><div class="cozy-day-goals">${goals.map(goal => {
    const progress = Math.min(goal.target, goal.current), ready = goal.complete && !goal.claimed;
    const goalArt = goal.id === 'friend' ? 'paw' : goal.id === 'forage' ? 'wood' : 'sparkle';
    return `<article class="cozy-day-goal ${goal.claimed ? 'cozy-goal-claimed' : ready ? 'cozy-goal-ready' : ''}"><span class="cozy-goal-art">${icon(goalArt)}</span><div class="cozy-goal-copy"><div><h4>${clean(goal.title)}</h4><b>${progress} / ${goal.target}</b></div><p>${clean(goal.description)}</p><div class="cozy-goal-progress" role="progressbar" aria-label="${clean(goal.title)}" aria-valuemin="0" aria-valuemax="${goal.target}" aria-valuenow="${progress}"><i style="width:${Math.min(100, progress / goal.target * 100)}%"></i></div><div class="cozy-goal-reward"><small>작은 보상</small>${costChips(goal.rewards)}</div></div><button class="cozy-action-button" data-cozy-claim="${goal.id}" data-cozy-day="${clean(goal.day)}" ${ready ? '' : 'disabled'}>${goal.claimed ? icon('check') : ready ? icon('bag') : ''}<span>${goal.claimed ? '받았어요' : ready ? '보상 받기' : '함께해요'}</span></button></article>`;
  }).join('')}</div><div class="cozy-day-links"><button data-cozy-tab="friends"><span>${icon('paw')}</span><div><strong>친구의 오늘이 궁금해요</strong><small>마음에 드는 선물 · 작은 부탁</small></div>${icon('chevron')}</button><button data-cozy-tab="decor"><span>${icon('sparkle')}</span><div><strong>우리 집에 취향을 더해요</strong><small>직접 만드는 장식 · 자유로운 배치</small></div>${icon('chevron')}</button></div><p class="cozy-note">${icon('sun')}오늘의 일상과 선물·부탁은 매일 새로 시작해요. 쌓은 친밀도와 장식은 그대로 남아요.</p></section>`;
}

function friendsContent(state: GameState, now: number): string {
  return `<div class="cozy-section-intro"><h3>저마다 다른, 우리 친구들</h3><p>좋아하는 것을 기억해 주세요. 함께할수록 조금씩 가까워져요.</p></div><div class="cozy-friend-grid">${UNIT_IDS.map(id => {
    const view = getAnimalLifeView(state, id, now);
    return `<article class="cozy-friend-card"><header><button class="cozy-friend-portrait" data-animal-focus="${id}" aria-label="${clean(view.name)} 만나러 가기">${companionPortrait(id)}</button><div><small>${clean(view.speciesLabel)} · ${clean(view.personality)}</small><h3>${clean(view.name)}<button data-animal-focus="${id}" aria-label="${clean(view.name)} 만나러 가기">만나기 ${icon('chevron')}</button></h3><span class="cozy-friend-activity">${clean(view.periodLabel)} · ${clean(view.activity)}</span></div></header>${hearts(view)}<p class="cozy-dialogue">“${clean(view.dialogue)}”</p><p class="cozy-likes">${icon('heart')}좋아해요 <strong>${clean(view.likes)}</strong></p>${animalActions(state, id, now)}</article>`;
  }).join('')}</div><p class="cozy-note">${icon('paw')}동물을 직접 만나 쓰다듬어도 친밀도가 쌓여요. 큰 친구는 트럭이 충분히 넓어질 때까지 지상에서 지내요.</p>`;
}

function decorContent(state: GameState): string {
  return `<div class="cozy-section-intro cozy-decor-intro"><div><h3>버려진 재료로, 포근한 우리 집</h3><p>직접 만든 장식을 원하는 층과 위치에 놓아 보세요.</p></div><span class="cozy-wallet">${coinIcon()}<b>${number(getShop(state).coins)}</b><small>보유 코인</small></span></div><div class="cozy-decor-grid">${COZY_DECOR_IDS.map(id => {
    const item = COZY_DECOR_ITEMS[id], count = getDecorInventoryCount(state, id), craft = canCraftCozyDecoration(state, id);
    return `<article class="cozy-decor-card"><div class="cozy-decor-art">${cozyDecorIcon(id)}<span>${item.columns} × ${item.rows}칸</span></div><div class="cozy-decor-copy"><h3>${clean(item.name)}</h3><p>${clean(item.description)}</p><div class="cozy-decor-costs" aria-label="제작 재료">${costChips(item.cost, state)}</div></div><footer><button class="cozy-action-button cozy-button-soft" data-decor-craft="${id}" ${craft.ok ? '' : 'disabled'} ${craft.ok ? '' : `title="${clean(craft.message)}"`}>${icon('hammer')}<span>${craft.ok ? '만들기' : '재료 부족'}</span></button><button class="cozy-action-button" data-decor-place="${id}" ${count > 0 ? '' : 'disabled'}>${icon('plus')}<span>놓기 <small>${count}개</small></span></button></footer></article>`;
  }).join('')}</div><p class="cozy-note">${icon('move')}장식은 놓은 뒤에도 옮기거나 보관할 수 있어요. 러그 위로는 친구들이 걸어 다닐 수 있어요.</p>`;
}

/** Pure markup; only committed game progress controls completed actions and inventory. */
export function renderCozyLife(state: GameState, tab: CozyLifeTab = 'today', now = Date.now()): string {
  const content = tab === 'friends' ? friendsContent(state, now) : tab === 'decor' ? decorContent(state) : todayContent(state, now);
  return `<section class="cozy-life" data-cozy-panel="${tab}"><nav class="cozy-tabs" aria-label="우리 트럭의 일상">${tabs.map(id => `<button data-cozy-tab="${id}" aria-pressed="${tab === id}">${icon(tabIcons[id])}<span>${tabNames[id]}</span></button>`).join('')}</nav><div class="cozy-content">${content}</div></section>`;
}

/** Compact companion subsection for the existing in-world animal menu. */
export function renderAnimalLifeDetails(state: GameState, id: UnitId, now = Date.now()): string {
  const view = getAnimalLifeView(state, id, now);
  return `<section class="cozy-animal-details" aria-label="${clean(view.name)}와 일상">${hearts(view, true)}<p class="cozy-dialogue">“${clean(view.dialogue)}”</p><p class="cozy-likes">${icon('heart')}좋아해요 <strong>${clean(view.likes)}</strong></p>${animalActions(state, id, now, true)}<button class="cozy-detail-link" data-open="cozy-life">${icon('book')}오늘의 일상 보기 ${icon('chevron')}</button></section>`;
}
