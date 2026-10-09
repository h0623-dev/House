import { formatGameDuration } from './game-time';
import { resourceLabels, type GameState, type Resource } from './game';
import { BUILDINGS, BUILDING_TYPES, getSettlement, getUnlockedSlots, type Building, type BuildingType } from './settlement';
import { icon } from './icons';
import { facilityIcon } from './settlement-art';

export const buildingNames:Record<BuildingType,string>={workshop:'도로 공방',kitchen:'마을 주방',waterworks:'빗물 정수소',greenhouse:'씨앗 온실',watchtower:'도로 관측소',petHouse:'보리의 쉼터'};
const amount=(state:GameState,r:Resource,n:number)=>`<span class="${state.resources[r]<n?'insufficient':''}">${icon(r)} ${n}</span>`;
export function buildingCatalog(state:GameState){
 const settlement=getSettlement(state),used=settlement.buildings.length,slots=getUnlockedSlots(state);
 return `<p class="modal-description">시설을 고르고 트럭 위 빈 자리에 놓아 주세요.<br>생산하고 수령하며 우리만의 마을을 키워요.</p><div class="build-capacity">${icon('truck')} 데크 Lv.${state.deckLevel}<strong>시설 ${used} / ${slots}</strong><button data-open="expand">자리 늘리기 ${icon('arrow')}</button></div><div class="building-catalog">${BUILDING_TYPES.map(type=>{const b=BUILDINGS[type],locked=state.deckLevel<b.unlockLevel;return `<button class="building-card ${locked?'locked':''}" data-build-type="${type}" aria-label="${b.name} 건설 ${locked?`데크 ${b.unlockLevel}레벨 필요`:''}"><span class="building-card-art">${facilityIcon(type)}</span><span class="building-unlock">${locked?`데크 Lv.${b.unlockLevel}`:'건설 가능'}</span><strong>${b.name}</strong><span class="building-description">${b.description}</span><span class="building-output">${icon(b.yieldResource)} ${resourceLabels[b.yieldResource]} +${b.yieldAmount}<small> · ${formatGameDuration(b.minutes)}</small></span><span class="building-cost">${amount(state,'wood',b.wood)}${amount(state,'scrap',b.scrap)}</span><span class="building-select">${locked?'미리 보기':'트럭 위에 배치'} ${icon('chevron')}</span></button>`;}).join('')}</div><p class="fine-print">빈 자리와 미리 보기를 확인한 후 건설 확정으로 재료를 사용해요.<br>생산 시간은 초 단위예요. 다른 일을 하는 동안에도 생산해요. 잠시 앱을 닫아도 생산 시간이 이어져요. 전투·일시정지 중에는 쉬어 갑니다.</p><button class="button button-light full-width activity-secondary" data-action="gather">${icon('map')} 부족한 건설 재료 찾기</button>`;
}
export function facilitySheet(state:GameState,building:Building){
 const b=BUILDINGS[building.type];
 return `<div class="facility-sheet-heading"><span class="facility-sheet-art">${facilityIcon(building.type)}</span><div><small>우리 트럭의 ${building.slot+1}번 자리</small><h3>${b.name} <span data-facility-level>Lv.${building.level}</span></h3></div><button class="sheet-close" data-facility-close aria-label="시설 선택 닫기">${icon('close')}</button></div><div class="facility-production"><span data-production-status></span><strong data-production-reward>${icon(b.yieldResource)} +${b.yieldAmount*building.level}</strong><div class="facility-progress"><i></i></div></div><div class="facility-sheet-actions"><button class="facility-primary" data-facility-start="${building.id}">${icon(b.yieldResource)}<span>생산 시작</span></button><button class="facility-primary collect" data-facility-collect="${building.id}" hidden>${icon('bag')}<span>생산품 수령</span></button><button class="facility-secondary" data-facility-upgrade="${building.id}"><span>${icon('hammer')}</span><small>레벨 올리기</small></button><button class="facility-secondary" data-facility-move="${building.id}"><span>${icon('expand')}</span><small>옮기기</small></button><button class="facility-secondary" data-facility-replace="${building.id}"><span>${icon('truck')}</span><small>시설 교체</small></button></div><p class="facility-recipe">${b.recipe?Object.entries(b.recipe).map(([r,n])=>`${resourceLabels[r as Resource]} ${Number(n)*building.level}`).join(' · ')+' 사용':'재료 사용 없이 생산해요'} · 최대 Lv.${b.maxLevel}</p>`;
}
export function productionState(state:GameState,building:Building){
 const ready=building.readyAt!==null&&state.totalMinutes>=building.readyAt;
 const running=building.readyAt!==null&&!ready;
 const progress=building.readyAt===null||building.startedAt===null?0:Math.min(1,Math.max(0,(state.totalMinutes-building.startedAt)/(building.readyAt-building.startedAt)));
 const remaining=Math.max(0,(building.readyAt??state.totalMinutes)-state.totalMinutes);
 return {ready,running,progress,remaining};
}
