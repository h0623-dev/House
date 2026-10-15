import { resourceLabels, type GameState, type Resource } from './game';
import { BUILDINGS, getSettlement, getProductionCost, formatProductionDuration, type Building } from './settlement';
import { facilityLocationLabel, productionState } from './settlement-ui';
import { formatGameDuration } from './game-time';
import { facilityIcon } from './settlement-art';
import { icon } from './icons';
import { cropIcon } from './crop-art';
import { renderFarmDeliveryPreview, updateFarmDeliveryPreview } from './farm-economy-ui';
import { getOutdoorSite } from './outdoor-sites';
import type { VillageAdvice, VillageHubModel } from './village-guide';

const escape = (value: string | number): string => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
const activityKey = (advice: VillageAdvice): string => `activity:${advice.id}`;
const progressText = (advice: VillageAdvice): string => advice.progress ? `${advice.progress.current} / ${advice.progress.max}` : '';

/** Small map cards name an action; the complete narrative stays in their accessible label. */
function activityLabel(advice: VillageAdvice): string {
  const target = advice.target;
  switch (target.kind) {
    case 'farm': return target.mode === 'harvest' ? '수확하기' : target.mode === 'water' ? '물 주기' : '씨앗 심기';
    case 'facility': return target.operation === 'collect' ? '생산품 받기' : target.operation === 'start' ? '생산 시작' : '시설 개선';
    case 'orders': return '이웃 납품';
    case 'farm-delivery': return '농산물 납품';
    case 'roadside': {
      const resource = getOutdoorSite(target.siteId)!.resource;
      return resource === 'wood' ? '나무 베기' : resource === 'scrap' ? '고철 모으기' : resource === 'water' ? '물 길어오기' : '씨앗 찾기';
    }
    case 'build': return '시설 건설';
    case 'gather': return '물자 탐색';
    case 'chop': return '나무 베기';
    case 'rest': return '동료 돌보기';
    case 'energy': return '기력 회복';
    case 'expand': return '데크 확장';
    case 'floors': return '층 증축';
    case 'farm-expand': return '밭 확장';
    case 'hunt': return '동물 탐험';
    case 'companions': return '동료 편성';
    case 'quest': return advice.cta.includes('보상') ? '보상 받기' : '성장 목표';
  }
}

function adviceButton(advice: VillageAdvice, key: string, className = 'village-activity'): string {
  const title = className === 'village-activity' ? activityLabel(advice) : advice.title;
  return `<button class="${className}" data-village-advice="${escape(key)}" data-village-advice-identity="${escape(advice.id)}" aria-label="${escape(`${advice.title} · ${advice.cta}`)}"><span class="village-advice-art" data-village-advice-icon="${escape(advice.cropId ? `crop:${advice.cropId}` : advice.icon)}">${advice.cropId ? cropIcon(advice.cropId, 'produce') : icon(advice.icon)}</span><span class="village-advice-copy"><small data-village-advice-tag>${escape(advice.tag ?? advice.cta)}</small><strong data-village-advice-title>${escape(title)}</strong><span data-village-advice-detail>${escape(advice.detail)}</span></span><span class="village-advice-progress" data-village-advice-progress>${escape(progressText(advice))}</span>${icon('chevron', 'village-advice-chevron')}</button>`;
}

/** Render once; clock updates patch existing buttons rather than replacing the dock. */
export function renderVillageHub(model: VillageHubModel): string {
  const activities = model.activities.slice(0, 3);
  return `<section class="village-hub-dock" aria-label="지금 할 수 있는 마을 활동" data-village-activity-count="${activities.length}"><div class="village-hub-heading"><span><b data-village-hub-ready>${model.summary.readyFacilities}</b>개 생산 완료 <span class="village-hub-working">· <b data-village-hub-working>${model.summary.workingFacilities}</b>개 생산 중</span></span><button data-open="village" aria-label="마을 생산과 성장 운영 열기">${icon('truck')}<strong>마을 운영</strong>${icon('chevron')}</button></div><div class="village-activity-list">${activities.map(advice => adviceButton(advice, activityKey(advice))).join('')}</div></section>`;
}

function setText(root: ParentNode, selector: string, value: string | number): void {
  const element = root.querySelector<HTMLElement>(selector);
  if (element && element.textContent !== String(value)) element.textContent = String(value);
}

function updateAdvice(button: HTMLButtonElement, advice: VillageAdvice): void {
  const label = `${advice.title} · ${advice.cta}`;
  if (button.getAttribute('aria-label') !== label) button.setAttribute('aria-label', label);
  button.removeAttribute('aria-disabled');
  delete button.dataset.villageRetired;
  button.dataset.villageAdviceIdentity = advice.id;
  setText(button, '[data-village-advice-title]', button.classList.contains('village-activity') ? activityLabel(advice) : advice.title);
  setText(button, '[data-village-advice-tag]', advice.tag ?? advice.cta);
  setText(button, '[data-village-advice-detail]', advice.detail);
  setText(button, '[data-village-advice-progress]', progressText(advice));
  const art = button.querySelector<HTMLElement>('[data-village-advice-icon]');
  const artKey = advice.cropId ? `crop:${advice.cropId}` : advice.icon;
  if (art && art.dataset.villageAdviceIcon !== artKey) {
    art.dataset.villageAdviceIcon = artKey;
    art.innerHTML = advice.cropId ? cropIcon(advice.cropId, 'produce') : icon(advice.icon);
  }
}

/** Preserve the focused card through a completion tick; its retired target is inert. */
export function updateVillageHub(root: HTMLElement, model: VillageHubModel): void {
  if (!root.querySelector('.village-hub-dock')) {
    root.innerHTML = renderVillageHub(model);
    return;
  }
  setText(root, '[data-village-hub-ready]', model.summary.readyFacilities);
  setText(root, '[data-village-hub-working]', model.summary.workingFacilities);
  const list = root.querySelector<HTMLElement>('.village-activity-list')!;
  const existing = Array.from(list.querySelectorAll<HTMLButtonElement>('[data-village-advice]'));
  const focused = existing.find(button => button === button.ownerDocument.activeElement);
  const activities = model.activities.slice(0, 3);
  const focusedRetired = focused && !activities.some(advice => activityKey(advice) === focused.dataset.villageAdvice);
  const visible = focusedRetired ? activities.slice(0, 2) : activities;
  const wanted = new Set(visible.map(activityKey));
  for (const button of existing) {
    if (wanted.has(button.dataset.villageAdvice!)) continue;
    if (button === focused && focusedRetired) {
      button.dataset.villageRetired = 'true';
      button.setAttribute('aria-disabled', 'true');
      setText(button, '[data-village-advice-tag]', '완료한 활동');
      setText(button, '[data-village-advice-detail]', '다음 활동을 선택해 주세요.');
      continue;
    }
    button.remove();
  }
  for (const advice of visible) {
    let button = Array.from(list.querySelectorAll<HTMLButtonElement>('[data-village-advice]')).find(element => element.dataset.villageAdvice === activityKey(advice));
    if (!button) {
      const template = root.ownerDocument.createElement('template');
      template.innerHTML = adviceButton(advice, activityKey(advice));
      button = template.content.firstElementChild as HTMLButtonElement;
      list.append(button);
    }
    updateAdvice(button, advice);
  }
  root.querySelector<HTMLElement>('.village-hub-dock')!.dataset.villageActivityCount = String(list.childElementCount);
}

function facilityView(state: GameState, building: Building) {
  const definition = BUILDINGS[building.type], production = productionState(state, building);
  const output = definition.yieldAmount * building.level, recipe = getProductionCost(building);
  const affordable = Object.entries(recipe).every(([resource, amount]) => state.resources[resource as Resource] >= amount!);
  const canRestart = Object.entries(recipe).every(([resource, amount]) => state.resources[resource as Resource] + (resource === definition.yieldResource ? output : 0) >= amount!);
  const phase = production.ready ? 'ready' : production.running ? 'working' : 'idle';
  const status = production.ready ? '수령 가능' : production.running ? `${formatGameDuration(production.remaining)} 남음` : affordable ? '생산 대기' : '재료 부족';
  return { definition, production, output, recipe, affordable, canRestart, phase, status };
}

function recipeText(state: GameState, building: Building): string {
  const recipe = getProductionCost(building);
  return Object.entries(recipe).map(([resource, amount]) => `${resourceLabels[resource as Resource]} ${amount} 사용 · 보유 ${state.resources[resource as Resource]}`).join(' / ') || '재료 없이 생산';
}

function facilityRow(state: GameState, building: Building): string {
  const view = facilityView(state, building);
  return `<article class="village-production-row" data-village-production="${building.id}" data-village-phase="${view.phase}"><button class="village-production-main" data-facility-select="${building.id}" aria-label="${escape(view.definition.name)} Lv.${building.level} 현장에서 확인"><span class="village-production-art" data-village-production-art="${building.type}:${building.level}">${facilityIcon(building.type, building.level)}</span><span class="village-production-copy"><strong><span data-village-production-name>${escape(view.definition.name)}</span> <small data-village-production-level>Lv.${building.level}</small></strong><span data-village-production-location>${facilityLocationLabel(state, building)}</span><span class="village-production-state" data-village-production-status>${view.status}</span></span><span class="village-production-yield">${icon(view.definition.yieldResource)}<b data-village-production-yield>+${view.output}</b><small data-village-production-duration>${formatProductionDuration(building)}</small></span></button><div class="village-production-track" aria-hidden="true"><i style="width:${view.production.progress * 100}%"></i></div><p class="village-production-recipe" data-village-production-recipe>${escape(recipeText(state, building))}</p><div class="village-production-actions"><button class="village-production-detail" data-facility-select="${building.id}">${icon('pin')}<span data-village-production-cta>${view.production.ready ? '생산품 받기' : view.production.running ? '현장에서 확인' : view.affordable ? '생산 시작하기' : '재료 확인하기'}</span></button><button class="village-production-repeat" data-facility-collect-repeat="${building.id}" ${view.production.ready ? '' : 'hidden'}>${icon('refresh')}받고 다시 생산</button></div><p class="village-repeat-hint" data-village-repeat-hint ${view.production.ready && !view.canRestart ? '' : 'hidden'}>생산품은 받아요. 부족한 재료를 모으면 다시 생산할 수 있어요.</p></article>`;
}

/** Production facts come from the existing domain, including saved batch timestamps. */
export function renderVillageManagement(state: GameState, model: VillageHubModel): string {
  const facilities = getSettlement(state).buildings;
  const goals = `<details class="village-management-goals" ${facilities.length ? '' : 'open'}><summary>성장 목표와 다음 투자 ${icon('chevron')}</summary><h3>지금의 성장 목표</h3>${adviceButton(model.primary, 'primary', 'village-plan-card')}<h3>다음 마을 투자</h3>${adviceButton(model.investment, 'investment', 'village-plan-card village-investment-card')}</details>`;
  const production = `<div class="village-production-heading"><h3>마을 생산</h3><small>지도에서 시설을 보고 생산을 이어가요.</small></div><div class="village-production-list">${facilities.map(building => facilityRow(state, building)).join('')}</div><div class="village-production-empty" ${facilities.length ? 'hidden' : ''}>${icon('hammer')}<strong>첫 생활 시설을 지어 보세요</strong><span>물과 식량을 생산해 이웃에게 보내고 트럭을 키워요.</span><button data-open="build">시설 고르기 ${icon('chevron')}</button></div>`;
  return `<div class="village-management" data-village-management><div class="village-management-summary"><span><b data-management-ready>${model.summary.readyFacilities}</b>수령 가능</span><span><b data-management-working>${model.summary.workingFacilities}</b>생산 중</span><span><b data-management-total>${model.summary.totalFacilities}</b>생활 시설</span></div>${renderFarmDeliveryPreview(state)}${facilities.length ? production + goals : goals + production}<p class="village-management-note">완성품을 받은 뒤 다음 생산을 시작해요. ‘받고 다시 생산’은 표시된 재료를 사용해 한 번 생산해요.</p></div>`;
}

/** Keep management cards and focus stable while their production clocks advance. */
export function updateVillageManagement(root: HTMLElement, state: GameState, model: VillageHubModel): void {
  const management = root.querySelector<HTMLElement>('[data-village-management]');
  if (!management) { root.innerHTML = renderVillageManagement(state, model); return; }
  setText(management, '[data-management-ready]', model.summary.readyFacilities);
  setText(management, '[data-management-working]', model.summary.workingFacilities);
  setText(management, '[data-management-total]', model.summary.totalFacilities);
  updateFarmDeliveryPreview(management, state);
  for (const [key, advice] of [['primary', model.primary], ['investment', model.investment]] as const) {
    const button = management.querySelector<HTMLButtonElement>(`[data-village-advice="${key}"]`);
    if (button) updateAdvice(button, advice);
  }
  const facilities = getSettlement(state).buildings, list = management.querySelector<HTMLElement>('.village-production-list')!;
  const ids = new Set(facilities.map(building => String(building.id)));
  for (const row of Array.from(list.querySelectorAll<HTMLElement>('[data-village-production]'))) if (!ids.has(row.dataset.villageProduction!)) row.remove();
  for (const building of facilities) {
    let row = Array.from(list.querySelectorAll<HTMLElement>('[data-village-production]')).find(element => element.dataset.villageProduction === String(building.id));
    if (!row) {
      const template = root.ownerDocument.createElement('template'); template.innerHTML = facilityRow(state, building);
      row = template.content.firstElementChild as HTMLElement; list.append(row);
    }
    const view = facilityView(state, building);
    row.dataset.villagePhase = view.phase;
    setText(row, '[data-village-production-name]', view.definition.name);
    setText(row, '[data-village-production-level]', `Lv.${building.level}`);
    setText(row, '[data-village-production-duration]', formatProductionDuration(building));
    const art = row.querySelector<HTMLElement>('[data-village-production-art]')!;
    const artKey = `${building.type}:${building.level}`;
    if (art.dataset.villageProductionArt !== artKey) { art.dataset.villageProductionArt = artKey; art.innerHTML = facilityIcon(building.type, building.level); }
    const label = `${view.definition.name} Lv.${building.level} 현장에서 확인`;
    const main = row.querySelector<HTMLButtonElement>('.village-production-main')!;
    if (main.getAttribute('aria-label') !== label) main.setAttribute('aria-label', label);
    setText(row, '[data-village-production-location]', `${facilityLocationLabel(state, building)}`);
    setText(row, '[data-village-production-status]', view.status);
    setText(row, '[data-village-production-yield]', `+${view.output}`);
    setText(row, '[data-village-production-recipe]', recipeText(state, building));
    setText(row, '[data-village-production-cta]', view.production.ready ? '생산품 받기' : view.production.running ? '현장에서 확인' : view.affordable ? '생산 시작하기' : '재료 확인하기');
    row.querySelector<HTMLElement>('.village-production-track>i')!.style.width = `${view.production.progress * 100}%`;
    row.querySelector<HTMLButtonElement>('[data-facility-collect-repeat]')!.hidden = !view.production.ready;
    row.querySelector<HTMLElement>('[data-village-repeat-hint]')!.hidden = !view.production.ready || view.canRestart;
  }
  management.querySelector<HTMLElement>('.village-production-empty')!.hidden = facilities.length > 0;
}
