import { getCropProgress, getPlotCropId, getSeedCount, type GameState } from './game';
import { CROP_IDS, CROPS, type CropId } from './crops';
import { cropIcon } from './crop-art';
import { icon } from './icons';
import { getFarmCropInventory, getFarmEconomy, getFarmOrder, getFarmPlotCare,
  FARM_FERTILIZER_BONUS, FARM_FERTILIZER_COST, type FarmOrder } from './farm-economy';

const escape = (value: string | number): string => String(value).replace(/[&<>"']/g,
  character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
const count = (value: number): string => value.toLocaleString('ko-KR');

function coinIcon(): string {
  return '<svg class="icon farm-coin-icon" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><ellipse cx="18" cy="22" rx="10" ry="6" fill="#bf974d" stroke="#927642"/><circle cx="14" cy="13" r="10" fill="#e4bf6b" stroke="#927642" stroke-width="1.1"/><circle cx="14" cy="13" r="7" fill="none" stroke="#f9df9e" stroke-width="1.4"/><path d="M14 7L16 11L20 12L17 15L17 19L14 17L11 19L11 15L8 12L12 11Z" fill="#ffe7aa" stroke="#a17e3d" stroke-width=".7"/></svg>';
}

function rewardMarkup(order: FarmOrder): string {
  return `<div class="farm-delivery-rewards" aria-label="납품 보상"><span>${coinIcon()}<b>${count(order.rewards.coins)}</b><small>코인</small></span><span>${icon('star')}<b>${count(order.rewards.xp)}</b><small>경험치</small></span>${order.rewards.wood ? `<span>${icon('wood')}<b>${count(order.rewards.wood)}</b><small>목재</small></span>` : ''}${order.rewards.scrap ? `<span>${icon('scrap')}<b>${count(order.rewards.scrap)}</b><small>고철</small></span>` : ''}</div>`;
}

function requestedCrop(order: FarmOrder): CropId {
  return order.progress[0].cropId;
}

function nextFarmStep(state: GameState, order: FarmOrder): { label: string; detail: string; attributes: string; art: string } {
  const cropId = requestedCrop(order), crop = CROPS[cropId];
  const matching = state.plots.filter(plot => plot.plantedAt !== null && getPlotCropId(plot) === cropId);
  if (matching.some(plot => getCropProgress(state, plot) >= 1)) {
    return { label: `${crop.name} 수확하기`, detail: '익은 밭을 수확하면 작물 보관함에 들어가요.',
      attributes: 'data-farm-all="harvest"', art: cropIcon(cropId, 'produce') };
  }
  if (matching.some(plot => !plot.watered)) {
    return { label: '밭에 물 주기', detail: `${crop.name} 새싹을 돌보고 다음 수확을 준비해요.`,
      attributes: 'data-farm-all="water"', art: icon('water') };
  }
  if (matching.length && !state.plots.some(plot => plot.plantedAt === null)) {
    return { label: '자라는 밭 확인하기', detail: '수확을 기다리며 영양을 주거나 마을 시설을 돌봐요.',
      attributes: 'data-open="farm"', art: cropIcon(cropId, 'plant') };
  }
  if (getSeedCount(state, cropId) > 0) {
    return { label: `${crop.name} 씨앗 고르기`, detail: '이 씨앗을 골라 빈 밭에 이어 심어요.',
      attributes: `data-farm-seed="${cropId}"`, art: cropIcon(cropId, 'seed') };
  }
  return { label: `${crop.name} 씨앗 구하기`, detail: '상점에서 요청한 작물의 씨앗을 준비해요.',
    attributes: 'data-shop-tab="seeds"', art: cropIcon(cropId, 'seed') };
}

/** One real request leads to a single next step; viewing it changes no progress. */
export function renderFarmDelivery(state: GameState): string {
  const order = getFarmOrder(state), stock = getFarmCropInventory(state), cropId = requestedCrop(order);
  const crop = CROPS[cropId], target = order.costs[cropId]!, next = nextFarmStep(state, order);
  const cared = state.plots.filter(plot => plot.plantedAt !== null && getFarmPlotCare(state, plot).fertilized).length;
  return `<section class="farm-economy" data-farm-delivery-panel data-farm-order="${escape(order.id)}"><div class="farm-delivery-heading"><span>${icon('truck')}</span><div><small>이웃 트럭의 ${count(order.sequence)}번째 요청</small><h3>${escape(order.name)}</h3></div><span class="farm-delivery-state ${order.ready ? 'ready' : ''}">${order.ready ? '보낼 수 있어요' : '작물을 준비해요'}</span></div><div class="farm-delivery-request"><div class="farm-delivery-crop">${cropIcon(cropId, 'produce')}</div><div><small>요청한 수확물</small><h4>${crop.name} <b>${target}개</b></h4><p>보관 중 <strong data-farm-order-stock>${count(stock[cropId])}</strong>개</p><div class="farm-delivery-track" role="progressbar" aria-label="${crop.name} 납품 준비" aria-valuemin="0" aria-valuemax="${target}" aria-valuenow="${Math.min(stock[cropId], target)}"><i style="width:${Math.min(1, stock[cropId] / target) * 100}%"></i></div><span class="farm-delivery-shortage">${order.ready ? `보내면 ${crop.name} ${target}개와 전체 식량 ${target}개가 줄어요.` : `${crop.name} ${Math.max(0, target - stock[cropId])}개를 더 수확해 주세요.`}</span></div></div><div class="farm-delivery-reward-heading"><strong>작물을 보내면 받아요</strong><span>씨앗 구매와 다음 건설에 보태요</span></div>${rewardMarkup(order)}<button class="farm-deliver-button" data-farm-deliver="${escape(order.id)}" ${order.ready ? '' : 'disabled'} aria-label="${crop.name} ${target}개 보내고 코인 ${order.rewards.coins}개, 경험치 ${order.rewards.xp}, 목재 ${order.rewards.wood}개${order.rewards.scrap ? `, 고철 ${order.rewards.scrap}개` : ''} 받기">${icon(order.ready ? 'truck' : 'seeds')}${order.ready ? '작물 보내고 보상 받기' : '수확물을 준비해 주세요'}</button>${!order.ready ? `<button class="farm-next-step" ${next.attributes}>${next.art}<span><strong>${next.label}</strong><small>${next.detail}</small></span>${icon('chevron')}</button>` : ''}<details class="farm-care-help"><summary>${icon('leaf')}영양을 주면 한 밭에서 +${FARM_FERTILIZER_BONUS}개${icon('chevron')}</summary><p>자라는 밭에 한 번 영양을 주면 수확량이 늘어요.<br>한 밭마다 식량 ${FARM_FERTILIZER_COST.food}개와 기력 ${FARM_FERTILIZER_COST.energy}를 사용해요.</p><span>지금 영양을 준 밭 ${cared}곳</span><button data-open="farm">텃밭에서 돌보기 ${icon('arrow')}</button></details>${renderFarmCropLedger(state)}<div class="farm-growth-links"><button data-open="build">${icon('hammer')}받은 재료로 건설</button><button data-shop-tab="seeds">${icon('seeds')}다음 씨앗 준비</button></div></section>`;
}

/** Typed crop units are a readable subset of food, never a second food balance. */
export function renderFarmCropLedger(state: GameState): string {
  const stock = getFarmCropInventory(state), total = CROP_IDS.reduce((sum, id) => sum + stock[id], 0);
  const completed = getFarmEconomy(state).completedOrders;
  return `<section class="farm-crop-ledger" data-farm-crop-ledger><div class="farm-ledger-heading"><h3>수확물 보관함</h3><span>납품 ${count(completed)}회 완료</span></div><div class="farm-crop-stock-grid">${CROP_IDS.map(id => `<article data-farm-crop-stock="${id}">${cropIcon(id, 'produce')}<strong>${CROPS[id].name}</strong><span><b data-farm-crop-count="${id}">${count(stock[id])}</b>개</span></article>`).join('')}</div><p class="farm-ledger-total">전체 식량 <b>${count(state.resources.food)}</b>개에 포함된 수확물 <b>${count(total)}</b>개</p><p class="farm-ledger-note">직접 수확한 작물만 종류별로 기록돼요. 기존 식량은 그대로 보관해요.<br>휴식·판매·영양 주기로 식량을 쓰면 일반 식량부터 사용하고, 부족하면 위 작물 순서대로 사용해요.</p></section>`;
}

/** Compact entry to the harvest → delivery → seed/building loop. */
export function renderFarmDeliveryPreview(state: GameState): string {
  const order = getFarmOrder(state), cropId = requestedCrop(order), stock = getFarmCropInventory(state);
  return `<button class="farm-delivery-preview" data-open="farm-delivery" data-farm-delivery-preview aria-label="농산물 납품 · ${escape(order.name)}"><span class="farm-delivery-preview-art" data-farm-preview-crop="${cropId}">${cropIcon(cropId, 'produce')}</span><span class="farm-delivery-preview-copy"><small data-farm-preview-state>${order.ready ? '납품 보상 받기' : '수확해서 트럭 키우기'}</small><strong data-farm-preview-title>${CROPS[cropId].name} ${order.costs[cropId]}개 · <b>${stock[cropId]}개 보유</b></strong><span data-farm-preview-reward>코인 ${order.rewards.coins} · 목재 ${order.rewards.wood}${order.rewards.scrap ? ` · 고철 ${order.rewards.scrap}` : ''}</span></span>${icon('chevron')}</button>`;
}

function setText(root: ParentNode, selector: string, value: string | number): void {
  const element = root.querySelector<HTMLElement>(selector);
  if (element && element.textContent !== String(value)) element.textContent = String(value);
}

/** Clock ticks update facts in place, preserving an active native pointer. */
export function updateFarmDeliveryPreview(root: HTMLElement, state: GameState): void {
  const button = root.querySelector<HTMLButtonElement>('[data-farm-delivery-preview]');
  if (!button) return;
  const order = getFarmOrder(state), cropId = requestedCrop(order), stock = getFarmCropInventory(state);
  const label = `농산물 납품 · ${order.name}`;
  if (button.getAttribute('aria-label') !== label) button.setAttribute('aria-label', label);
  setText(button, '[data-farm-preview-state]', order.ready ? '납품 보상 받기' : '수확해서 트럭 키우기');
  setText(button, '[data-farm-preview-title]', `${CROPS[cropId].name} ${order.costs[cropId]}개 · ${stock[cropId]}개 보유`);
  setText(button, '[data-farm-preview-reward]', `코인 ${order.rewards.coins} · 목재 ${order.rewards.wood}${order.rewards.scrap ? ` · 고철 ${order.rewards.scrap}` : ''}`);
  const art = button.querySelector<HTMLElement>('[data-farm-preview-crop]')!;
  if (art.dataset.farmPreviewCrop !== cropId) { art.dataset.farmPreviewCrop = cropId; art.innerHTML = cropIcon(cropId, 'produce'); }
}
