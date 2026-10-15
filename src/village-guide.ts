import { expansionCost, farmExpansionCost, getCropProgress, getFarmCapacity, getSeedCount,
  MAX_DECK_LEVEL, resourceLabels, type GameState, type Resource } from './game';
import { CROP_IDS, CROPS, type CropId } from './crops';
import { getActiveGrowthQuest, type GrowthQuestView } from './growth-quests';
import { BUILDINGS, BUILDING_TYPES, getBuiltTypes, getFacilityHistory, getProductionCost, getSettlement,
  getTruckFloorCost, getTruckFloorCount, getUpgradeCost,
  type Building, type BuildingType } from './settlement';
import { findFreeFacilityPlacement, getBuildingFootprint, isNextFarmPlotClear } from './deck-placement';
import { gameMinutesToSeconds } from './game-time';
import { getVillageOrder } from './village-orders';
import { getReadyTeam } from './units';
import { getFarmCropInventory, getFarmOrder } from './farm-economy';
import { getGatheringArea } from './gathering';
import { type OutdoorSiteId } from './outdoor-sites';

export type VillageTarget =
  | { kind: 'quest'; questId: string }
  | { kind: 'facility'; id: number; operation: 'collect' | 'start' | 'upgrade' }
  | { kind: 'build'; buildingType: BuildingType }
  | { kind: 'farm'; mode: 'harvest' | 'water' | 'plant'; cropId?: CropId }
  | { kind: 'roadside'; siteId: OutdoorSiteId }
  | { kind: 'gather' | 'chop' | 'rest' | 'energy' | 'orders' | 'farm-delivery' | 'expand' | 'floors' | 'farm-expand' | 'hunt' | 'companions' };

export interface VillageAdvice {
  id: string;
  title: string;
  detail: string;
  cta: string;
  icon: string;
  cropId?: CropId;
  target: VillageTarget;
  tag?: string;
  progress?: { current: number; max: number };
}
export interface VillageHubModel {
  primary: VillageAdvice;
  activities: VillageAdvice[];
  investment: VillageAdvice;
  summary: { readyFacilities: number; workingFacilities: number; totalFacilities: number;
    readyPlots: number; floorCount: number; freeSlots: number };
}
type Cost = Partial<Record<Resource, number>>;
const isReady = (state: GameState, building: Building) => building.readyAt !== null && building.readyAt <= state.totalMinutes;
const isWorking = (state: GameState, building: Building) => building.readyAt !== null && building.readyAt > state.totalMinutes;
const affordable = (state: GameState, cost: Cost) => Object.entries(cost).every(([key, amount]) => state.resources[key as Resource] >= amount!);
const constructionCost = (type: BuildingType): Cost => ({ wood: BUILDINGS[type].wood, scrap: BUILDINGS[type].scrap });
const canCollect = (state: GameState, building: Building) => isReady(state, building)
  && (state.settlement?.stats?.collections ?? 0) < 100_000_000
  && state.resources[BUILDINGS[building.type].yieldResource] <= 100_000_000 - BUILDINGS[building.type].yieldAmount * building.level;
const canStart = (state: GameState, building: Building) => building.readyAt === null
  && (state.settlement?.stats?.productions ?? 0) < 100_000_000 && affordable(state, getProductionCost(building));
const facilityTarget = (building: Building, operation: 'collect' | 'start' | 'upgrade'): VillageTarget => ({ kind: 'facility', id: building.id, operation });
const targetKey = (target: VillageTarget) => target.kind === 'facility' ? `${target.kind}:${target.id}:${target.operation}`
  : target.kind === 'roadside' ? `${target.kind}:${target.siteId}`
  : target.kind === 'build' ? `${target.kind}:${target.buildingType}` : target.kind === 'farm' ? `${target.kind}:${target.mode}`
  : target.kind === 'quest' ? `${target.kind}:${target.questId}` : target.kind;

function energyAdvice(): VillageAdvice {
  return { id: 'prepare-energy', title: '기력이 자동으로 회복되고 있어요', detail: '기력은 실제 시간 20초마다 1씩, 1분에 3씩 자동 회복돼요.',
    cta: '회복 시간 보기', icon: 'bolt', target: { kind: 'energy' }, tag: '자동 회복' };
}
function companionAdvice(): VillageAdvice {
  return { id: 'prepare-companions', title: '동료를 돌봐 주세요', detail: '동료 화면에서 체력과 편성을 확인해요. 함께 쉬면 동물 체력을 회복할 수 있어요.',
    cta: '동료 돌보기', icon: 'paw', target: { kind: 'companions' }, tag: '동료 체력' };
}
function readyAdvice(building: Building): VillageAdvice {
  const definition = BUILDINGS[building.type];
  return { id: `collect-${building.id}`, title: `${definition.name} 물자 도착`,
    detail: `${resourceLabels[definition.yieldResource]} ${definition.yieldAmount * building.level}개를 받아 다음 성장을 준비해요.`,
    cta: '물자 받기', icon: definition.yieldResource, target: facilityTarget(building, 'collect'), tag: '수령 가능' };
}
function startAdvice(building: Building): VillageAdvice {
  const definition = BUILDINGS[building.type];
  return { id: `start-${building.id}`, title: `${definition.name} 다시 가동`,
    detail: `${resourceLabels[definition.yieldResource]}를 만들어 농사와 마을 성장에 보태요.`,
    cta: '생산 시작', icon: definition.yieldResource, target: facilityTarget(building, 'start'), tag: '생산 준비' };
}
function workingAdvice(state: GameState, building: Building): VillageAdvice {
  const definition = BUILDINGS[building.type];
  return { id: `working-${building.id}`, title: `${definition.name}에서 준비 중`,
    detail: `${gameMinutesToSeconds(building.readyAt! - state.totalMinutes)}초 뒤 물자를 받아요. 기다리는 동안 다른 마을 일을 할 수 있어요.`,
    cta: '생산 확인', icon: definition.yieldResource, target: facilityTarget(building, 'collect'), tag: '생산 중' };
}
function farmAdvice(state: GameState, mode: 'harvest' | 'water' | 'plant'): VillageAdvice {
  const ready = state.plots.filter(plot => getCropProgress(state, plot) >= 1).length;
  const thirsty = state.plots.filter(plot => plot.plantedAt !== null && !plot.watered).length;
  const requested = getFarmOrder(state).progress[0].cropId;
  const cropId = getSeedCount(state, requested) > 0 ? requested : CROP_IDS.find(id => getSeedCount(state, id) > 0);
  return mode === 'harvest' ? { id: 'farm-harvest', title: '텃밭에 작물이 익었어요', detail: `${ready}밭을 수확해 납품할 작물과 다음 씨앗을 모아요.`, cta: '수확하기', icon: 'food', target: { kind: 'farm', mode }, tag: '수확 가능' }
    : mode === 'water' ? { id: 'farm-water', title: '새싹에 물을 주세요', detail: `${thirsty}밭을 돌보면 작물이 잘 자라요. 한 밭마다 물 1개를 사용해요.`, cta: '물 주기', icon: 'water', target: { kind: 'farm', mode }, tag: '텃밭 돌보기' }
    : { id: 'farm-plant', title: '빈 밭에 새 씨앗을 심어요', detail: cropId ? `${CROPS[cropId].seedName}을 골라 다음 수확을 준비해요.` : '도로에서 씨앗을 구한 뒤 빈 밭에 심어요.', cta: '씨앗 고르기', icon: 'seeds', target: { kind: 'farm', mode, ...(cropId ? { cropId } : {}) }, tag: '다음 수확' };
}

/** Guide the one current crop request from actual stock and planted batches. */
export function getFarmDeliveryAdvice(state: GameState): VillageAdvice {
  const order = getFarmOrder(state), cropId = order.progress[0].cropId;
  const crop = CROPS[cropId], stock = getFarmCropInventory(state)[cropId], target = order.costs[cropId]!;
  const base: VillageAdvice = { id: `crop-delivery-${order.id}`, title: `${crop.name} ${target}개를 이웃에게 보내요`,
    detail: `보관 ${stock}개 · 납품 보상 코인 ${order.rewards.coins}, 목재 ${order.rewards.wood}${order.rewards.scrap ? `, 고철 ${order.rewards.scrap}` : ''}로 다음 씨앗과 건설을 준비해요.`,
    cta: '농산물 납품', icon: 'food', cropId, target: { kind: 'farm-delivery' }, tag: order.ready ? '납품 가능' : '농장 성장',
    progress: { current: Math.min(stock, target), max: target } };
  if (order.ready || state.expedition) return base;
  const matching = state.plots.filter(plot => plot.plantedAt !== null && (plot.cropId ?? 'carrot') === cropId);
  const recovery = { ...energyAdvice(), progress: base.progress };
  if (matching.some(plot => getCropProgress(state, plot) >= 1) && state.energy < 4) return recovery;
  if (matching.some(plot => getCropProgress(state, plot) >= 1) && state.energy >= 4) {
    return { ...base, id: `${base.id}-harvest`, title: `${crop.name}을 수확해 납품을 준비해요`,
      cta: '수확하기', target: { kind: 'farm', mode: 'harvest' }, tag: '수확 가능' };
  }
  if (matching.some(plot => !plot.watered) && state.resources.water > 0 && state.energy < 3) return recovery;
  if (matching.some(plot => !plot.watered) && state.energy >= 3 && state.resources.water > 0) {
    return { ...base, id: `${base.id}-water`, title: `${crop.name} 새싹에 물을 주세요`,
      cta: '물 주기', target: { kind: 'farm', mode: 'water' }, tag: '다음 납품 준비' };
  }
  if (state.plots.some(plot => plot.plantedAt === null) && getSeedCount(state, cropId) > 0 && state.energy < 4) return recovery;
  if (state.plots.some(plot => plot.plantedAt === null) && getSeedCount(state, cropId) > 0 && state.energy >= 4) {
    return { ...base, id: `${base.id}-plant`, title: `이번에는 ${crop.name}을 심어요`,
      detail: `${crop.seedName}을 골라 빈 밭에 이어 심어요. 수확물을 납품하면 코인 ${order.rewards.coins}와 건설 재료를 받아요.`,
      cta: '씨앗 고르기', target: { kind: 'farm', mode: 'plant', cropId }, tag: '요청한 작물' };
  }
  return base;
}
function supplyAdvice(state: GameState, cost: Cost, purpose: string, now: number): VillageAdvice | null {
  const shortage = Object.entries(cost).map(([resource, amount]) => ({ resource: resource as Resource, missing: Math.max(0, amount! - state.resources[resource as Resource]) }))
    .filter(item => item.missing > 0).sort((a, b) => b.missing - a.missing)[0];
  if (!shortage) return null;
  const facilities = getSettlement(state).buildings.filter(building => BUILDINGS[building.type].yieldResource === shortage.resource);
  const ready = facilities.find(building => canCollect(state, building));
  const prefix = `${purpose}에 ${resourceLabels[shortage.resource]} ${shortage.missing}개가 더 필요해요.`;
  if (ready) return { ...readyAdvice(ready), detail: `${prefix} 완성된 생산품부터 받아요.` };
  if (shortage.resource === 'food' && state.plots.some(plot => getCropProgress(state, plot) >= 1)) {
    return state.energy < 4 ? energyAdvice() : { ...farmAdvice(state, 'harvest'), detail: `${prefix} 익은 작물을 수확해요.` };
  }
  const idle = facilities.find(building => canStart(state, building));
  if (idle) return { ...startAdvice(idle), detail: `${prefix} 시설을 가동해 물자를 만들어요.` };
  if (shortage.resource === 'food') {
    if (state.energy < 4) return energyAdvice();
    if (state.plots.some(plot => plot.plantedAt !== null && !plot.watered) && state.resources.water > 0) return farmAdvice(state, 'water');
    if (state.plots.some(plot => plot.plantedAt === null) && CROP_IDS.some(id => getSeedCount(state, id) > 0)) return farmAdvice(state, 'plant');
    const working = facilities.find(building => isWorking(state, building));
    if (working) return { ...workingAdvice(state, working), detail: `${prefix} ${gameMinutesToSeconds(working.readyAt! - state.totalMinutes)}초 뒤 식량을 받아요.` };
    if (state.energy < 16) return energyAdvice();
    if (!getReadyTeam(state).length) return companionAdvice();
    return { id: 'prepare-food', title: '동물 친구들과 보급품을 찾아요', detail: `${prefix} 건강한 친구들을 편성해 도로로 나가요.`, cta: '탐험 준비', icon: 'hunt', target: { kind: 'hunt' }, tag: '식량 보급' };
  }
  const siteIds: Record<Exclude<Resource, 'food'>, OutdoorSiteId> = {
    wood: 'grove', scrap: 'salvage', water: 'spring', seeds: 'seed-meadow',
  };
  const area = getGatheringArea(state, siteIds[shortage.resource], now)!, view = area.next;
  if (state.energy < view.energyCost) return energyAdvice();
  const reward = view.cropId ? `${CROPS[view.cropId].seedName} ${view.yieldAmount}개` : `${resourceLabels[shortage.resource]} ${view.yieldAmount}개`;
  return { id: `prepare-${shortage.resource}`, title: `${resourceLabels[shortage.resource]}를 먼저 모아요`,
    detail: `${prefix} ${area.zone.name}에서 ${view.ready ? `${view.node.name}을 골라 ${reward}를 채집해요.` : `모든 채집물이 다시 자라는 중이에요. ${area.remainingSeconds}초 뒤 ${view.node.name}에서 ${reward}를 채집할 수 있어요.`}`,
    cta: `${area.zone.name} 가기`, icon: shortage.resource,
    target: { kind: 'roadside', siteId: area.zone.id }, tag: view.ready ? '성장 준비' : '현장 준비 중' };
}
function prepareInvestment(state: GameState, advice: VillageAdvice, cost: Cost, now: number): VillageAdvice {
  const energy = advice.target.kind === 'expand' ? 15 : advice.target.kind === 'farm-expand' ? 8 : 0;
  const supply = state.energy < energy ? energyAdvice() : supplyAdvice(state, cost, advice.title, now);
  return supply ? { ...supply, id: `investment-${supply.id}`, tag: '다음 성장 준비' } : advice;
}
function investmentAdvice(state: GameState, placeableTypes: BuildingType[], now: number): VillageAdvice {
  const facilities = getSettlement(state).buildings;
  const floor = getTruckFloorCost(state);
  if (floor && state.deckLevel >= floor.unlockLevel) {
    return prepareInvestment(state, { id: `investment-floor-${floor.floor}`, title: `${floor.floor}층에 새 마을을 열어요`,
      detail: `목재 ${floor.wood} · 고철 ${floor.scrap}으로 새 플랫폼과 연결 계단을 지어요.`, cta: `${floor.floor}층 증축`, icon: 'expand', target: { kind: 'floors' }, tag: '새 공간' }, { wood: floor.wood, scrap: floor.scrap }, now);
  }
  if (placeableTypes.length > 0) {
    const missing = placeableTypes.find(type => !facilities.some(building => building.type === type));
    if (missing) {
      const definition = BUILDINGS[missing], size = getBuildingFootprint(missing);
      return prepareInvestment(state, { id: `investment-build-${missing}`, title: `${definition.name}으로 마을을 키워요`,
        detail: `${size.columns}×${size.rows}칸을 비우고 원하는 위치에 놓아요. ${definition.description}`, cta: '시설 짓기', icon: definition.icon, target: { kind: 'build', buildingType: missing }, tag: '새 시설' }, constructionCost(missing), now);
    }
  }
  if (state.plots.length < getFarmCapacity(state) && facilities.length >= 2 && isNextFarmPlotClear(state)) {
    return prepareInvestment(state, { id: 'investment-farm', title: '새 텃밭을 마련해요',
      detail: `${state.plots.length} / ${getFarmCapacity(state)}밭 사용 중. 빈 농사 공간에 밭을 더 만들어요.`,
      cta: '밭 늘리기', icon: 'seeds', target: { kind: 'farm-expand' }, tag: '농장 성장' }, farmExpansionCost(state), now);
  }
  if (state.deckLevel < MAX_DECK_LEVEL) {
    const cost = expansionCost(state);
    return prepareInvestment(state, { id: 'investment-deck', title: `데크 Lv.${state.deckLevel + 1}로 넓혀요`,
      detail: '데크 면적과 재배 공간이 늘어나요. 새 공간에 원하는 크기의 시설을 배치해요.', cta: '데크 확장',
      icon: 'expand', target: { kind: 'expand' }, tag: '마을 확장' }, cost, now);
  }
  const upgrade = facilities.filter(building => building.level < BUILDINGS[building.type].maxLevel).sort((a, b) => a.level - b.level)[0];
  if (upgrade) {
    if (isReady(state, upgrade)) return { ...readyAdvice(upgrade), tag: '개선 준비' };
    if (isWorking(state, upgrade)) return { ...workingAdvice(state, upgrade), tag: '개선 준비' };
    return prepareInvestment(state, { id: `investment-upgrade-${upgrade.id}`, title: `${BUILDINGS[upgrade.type].name} Lv.${upgrade.level + 1}`,
      detail: '생산량을 늘리고 다음 묶음의 생산 시간을 줄여요.', cta: '레벨 올리기', icon: 'hammer',
      target: facilityTarget(upgrade, 'upgrade'), tag: '시설 성장' }, getUpgradeCost(upgrade), now);
  }
  return { id: 'investment-neighbors', title: '풍성한 마을 물자를 나눠요', detail: '이웃 의뢰로 생산품을 보내고 다음 마을 일을 이어가요.', cta: '이웃 의뢰', icon: 'bag', target: { kind: 'orders' }, tag: '마을 생활' };
}
function primaryAdvice(state: GameState, quest: GrowthQuestView | null, investment: VillageAdvice, placeableTypes: BuildingType[], now: number): VillageAdvice {
  if (!quest) return investment;
  const base: VillageAdvice = { id: `quest-${quest.id}`, title: quest.title, detail: quest.description,
    cta: quest.status === 'ready' ? '보상 받기' : '하러 가기', icon: 'flag', target: { kind: 'quest', questId: quest.id },
    tag: quest.status === 'ready' ? '목표 달성' : `${quest.chapter}장 성장 목표`, progress: { current: quest.current, max: quest.target } };
  if (quest.status === 'ready') return base;
  const facilities = getSettlement(state).buildings, kind = quest.destination.kind;
  let preparation: VillageAdvice | null = null;
  if (kind === 'build') {
    const type = quest.destination.buildingType ?? BUILDING_TYPES.find(type => !getBuiltTypes(state).includes(type));
    if (type && BUILDINGS[type].unlockLevel > state.deckLevel) preparation = supplyAdvice(state, expansionCost(state), '데크 확장', now)
      ?? { ...investment, id: 'prepare-unlock', title: '데크를 넓혀 새 시설을 열어요', target: { kind: 'expand' } };
    else if (type) preparation = supplyAdvice(state, constructionCost(type), BUILDINGS[type].name, now);
    if (!preparation && type && !placeableTypes.includes(type)) {
      const size = getBuildingFootprint(type);
      preparation = { ...investment, id: `prepare-space-${type}`,
        detail: `${BUILDINGS[type].name}에 ${size.columns}×${size.rows}칸이 필요해요. 기존 시설을 옮기거나 데크를 넓혀 공간을 마련해요.` };
    }
  } else if (kind === 'expand') {
    preparation = state.energy < 15 ? energyAdvice() : supplyAdvice(state, expansionCost(state), '데크 확장', now);
  } else if (kind === 'collect') {
    const facility = facilities.find(building => canCollect(state, building))
      ?? facilities.find(building => canStart(state, building))
      ?? facilities.find(building => isWorking(state, building));
    if (facility) preparation = isReady(state, facility) ? readyAdvice(facility)
      : isWorking(state, facility) ? workingAdvice(state, facility) : startAdvice(facility);
    else if (facilities.length) preparation = supplyAdvice(state, getProductionCost(facilities[0]), '시설 생산', now);
  } else if (kind === 'upgrade') {
    const targetLevel = quest.metric === 'highestFacilityLevel' ? quest.target : 2;
    const upgraded = new Set(getFacilityHistory(state).upgradedFacilityIds);
    const eligible = facilities.filter(building => building.level < targetLevel && (targetLevel > 2 || !upgraded.has(building.id)))
      .sort((a, b) => b.level - a.level);
    const facility = eligible.find(building => building.readyAt === null) ?? eligible[0];
    if (facility) preparation = isReady(state, facility) ? readyAdvice(facility) : isWorking(state, facility) ? workingAdvice(state, facility)
      : supplyAdvice(state, getUpgradeCost(facility), '시설 개선', now);
  } else if (kind === 'harvest' || kind === 'plant' || kind === 'water') {
    const ready = state.plots.some(plot => getCropProgress(state, plot) >= 1);
    const thirsty = state.plots.some(plot => plot.plantedAt !== null && !plot.watered);
    const empty = state.plots.some(plot => plot.plantedAt === null);
    const seeds = CROP_IDS.some(id => getSeedCount(state, id) > 0);
    if (state.energy < (kind === 'water' ? 3 : 4)) preparation = energyAdvice();
    else if (kind === 'harvest' && !ready || kind === 'water' && !thirsty) {
      if (thirsty) preparation = supplyAdvice(state, { water: 1 }, '텃밭 돌보기', now) ?? farmAdvice(state, 'water');
      else if (empty && seeds) preparation = farmAdvice(state, 'plant');
      else if (kind === 'water' && ready) preparation = farmAdvice(state, 'harvest');
      else if (!seeds && empty) preparation = supplyAdvice(state, { seeds: 1 }, '씨앗 심기', now);
      else preparation = { ...investment, id: 'prepare-crops', detail: '작물이 자라는 동안 시설과 다음 마을 성장을 준비해요.' };
    } else if (kind === 'plant' && (!empty || !seeds)) preparation = ready ? farmAdvice(state, 'harvest')
      : !seeds ? supplyAdvice(state, { seeds: 1 }, '씨앗 심기', now)
      : { ...investment, id: 'prepare-crop-space', detail: '밭의 작물이 자라는 동안 다음 마을 일을 준비해요.' };
    else if (kind === 'water') preparation = supplyAdvice(state, { water: 1 }, '텃밭 돌보기', now);
  } else if (kind === 'hunt') {
    if (state.energy < 16) preparation = energyAdvice();
    else if (!getReadyTeam(state).length) preparation = companionAdvice();
  } else if ((kind === 'gather' || kind === 'chop') && state.energy < 10) preparation = energyAdvice();
  return preparation ? { ...preparation, id: `quest-prepare-${quest.id}-${preparation.id}`,
    detail: `${quest.title} 준비 · ${preparation.detail}`, tag: '목표 준비', progress: base.progress } : base;
}

/** Read existing progress; no rewards, clocks, placements, or quest records are changed. */
export function getVillageHub(state: GameState, now = Date.now()): VillageHubModel {
  const facilities = getSettlement(state).buildings, floorCount = getTruckFloorCount(state);
  // A building's actual rectangular footprint determines space, rather than old numbered slots.
  const placeableTypes = BUILDING_TYPES.filter(type => BUILDINGS[type].unlockLevel <= state.deckLevel
    && ([1, 2, 3] as const).some(floor => floor <= floorCount && findFreeFacilityPlacement(state, type, floor) !== null));
  const freeSlots = placeableTypes.length;
  const ready = facilities.filter(building => isReady(state, building));
  const readyPlots = state.plots.filter(plot => getCropProgress(state, plot) >= 1).length;
  const investment = investmentAdvice(state, placeableTypes, now);
  const primary = state.expedition ? { id: 'return-from-expedition', title: '동물 친구들이 탐험 중이에요',
    detail: '현재 전투를 마무리하고 트럭 마을로 돌아와요.', cta: '탐험 확인', icon: 'hunt', target: { kind: 'hunt' } as VillageTarget, tag: '탐험 중' }
    : primaryAdvice(state, getActiveGrowthQuest(state), investment, placeableTypes, now);
  const candidates: VillageAdvice[] = [];
  if (!state.expedition) {
    const farmOrder = getFarmOrder(state), farmDelivery = getFarmDeliveryAdvice(state);
    if (farmOrder.ready) candidates.push(farmDelivery);
    candidates.push(...ready.filter(building => canCollect(state, building)).map(readyAdvice));
    if (!farmOrder.ready) candidates.push(farmDelivery);
    if (readyPlots && state.energy >= 4) candidates.push(farmAdvice(state, 'harvest'));
    const order = getVillageOrder(state);
    if (order.ready) candidates.push({ id: `order-${order.id}`, title: order.name,
      detail: '이웃에게 물자를 보내 데크와 시설에 쓸 건설 재료를 받아요.', cta: '물자 납품', icon: 'bag', target: { kind: 'orders' }, tag: '의뢰 완료 가능' });
    if (state.energy >= 3 && state.resources.water >= 1 && state.plots.some(plot => plot.plantedAt !== null && !plot.watered)) candidates.push(farmAdvice(state, 'water'));
    if (state.energy >= 4 && state.plots.some(plot => plot.plantedAt === null) && CROP_IDS.some(id => getSeedCount(state, id) > 0)) candidates.push(farmAdvice(state, 'plant'));
    candidates.push(...facilities.filter(building => canStart(state, building)).map(startAdvice));
    // A working production card is useful as a primary wait view, never an executable activity.
    if (!investment.id.includes('working-')) candidates.push(investment);
  }
  const seen = new Set([targetKey(primary.target)]), activities: VillageAdvice[] = [];
  for (const advice of candidates) {
    const key = targetKey(advice.target);
    if (seen.has(key)) continue;
    seen.add(key); activities.push(advice);
    if (activities.length === 3) break;
  }
  return { primary, activities, investment, summary: { readyFacilities: ready.length,
    workingFacilities: facilities.filter(building => isWorking(state, building)).length, totalFacilities: facilities.length,
    readyPlots, floorCount, freeSlots } };
}
