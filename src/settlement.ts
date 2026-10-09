import type { ActionResult, GameState, Resource } from './game';
import { formatGameDuration } from './game-time';
import { cloneCompanions } from './companions';

export const BUILDING_TYPES = ['waterworks', 'kitchen', 'workshop', 'petHouse', 'greenhouse', 'watchtower'] as const;
export type BuildingType = typeof BUILDING_TYPES[number];
export interface Building {
  id: number;
  type: BuildingType;
  /** Zero-based deck building slot. Farm plots use separate coordinates. */
  slot: number;
  level: number;
  startedAt: number | null;
  readyAt: number | null;
}
export interface Settlement {
  buildings: Building[];
  nextBuildingId: number;
  /** Missing in early facility states; materialized as zero without granting resources. */
  stats?: { productions: number; collections: number };
}
/** Kept at GameState's top level so the original Android8 fallback preserves it. */
export interface FacilityHistory { builtTypes: BuildingType[]; upgradedFacilityIds: number[] }
export type SettlementResult = ActionResult;
export interface BuildingDefinition {
  name: string;
  description: string;
  resource: Resource;
  icon: string;
  wood: number;
  scrap: number;
  /** Deck level required to place this facility. */
  unlockLevel: number;
  /** Production time in game minutes. */
  minutes: number;
  yieldResource: Resource;
  yieldAmount: number;
  maxLevel: number;
  sprite: BuildingType;
  /** Input quantities and output both scale with the facility level. */
  recipe?: Partial<Record<Resource, number>>;
}
export const BUILDINGS: Record<BuildingType, BuildingDefinition> = {
  waterworks: { name: '빗물 정수소', description: '빗물을 모아 텃밭과 생활에 쓸 깨끗한 물을 만들어요.', resource: 'water', icon: 'water', wood: 12, scrap: 4, unlockLevel: 1, minutes: 90, yieldResource: 'water', yieldAmount: 4, maxLevel: 3, sprite: 'waterworks' },
  kitchen: { name: '트럭 부엌', description: '물을 사용해 따뜻한 식량을 준비해요.', resource: 'food', icon: 'food', wood: 16, scrap: 6, unlockLevel: 1, minutes: 120, yieldResource: 'food', yieldAmount: 5, maxLevel: 3, sprite: 'kitchen', recipe: { water: 2 } },
  workshop: { name: '재활용 공방', description: '모아 온 목재로 버려진 부품을 손질해 고철을 얻어요.', resource: 'scrap', icon: 'hammer', wood: 22, scrap: 10, unlockLevel: 2, minutes: 150, yieldResource: 'scrap', yieldAmount: 4, maxLevel: 3, sprite: 'workshop', recipe: { wood: 3 } },
  petHouse: { name: '보리의 오두막', description: '보리에게 간식을 주면 주변에서 작은 나뭇가지를 모아 와요.', resource: 'wood', icon: 'paw', wood: 18, scrap: 6, unlockLevel: 2, minutes: 120, yieldResource: 'wood', yieldAmount: 6, maxLevel: 3, sprite: 'petHouse', recipe: { food: 1 } },
  greenhouse: { name: '작은 온실', description: '물을 공급해 정성껏 돌본 작물을 식량으로 거둬요.', resource: 'food', icon: 'seeds', wood: 28, scrap: 12, unlockLevel: 3, minutes: 240, yieldResource: 'food', yieldAmount: 6, maxLevel: 3, sprite: 'greenhouse', recipe: { water: 2 } },
  watchtower: { name: '도로 감시소', description: '도로 스캐너로 쓸 만한 폐부품을 찾아 고철을 모아요.', resource: 'scrap', icon: 'shield', wood: 26, scrap: 14, unlockLevel: 3, minutes: 180, yieldResource: 'scrap', yieldAmount: 3, maxLevel: 3, sprite: 'watchtower' },
};
const labels: Record<Resource, string> = { wood: '목재', scrap: '고철', food: '식량', water: '물', seeds: '씨앗' };
const MAX_SLOTS = 12;
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isNumber = (value: unknown, min: number, max: number): value is number => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const isInteger = (value: unknown, min: number, max: number): value is number => isNumber(value, min, max) && Number.isInteger(value);
export function isBuildingType(value: unknown): value is BuildingType {
  return typeof value === 'string' && (BUILDING_TYPES as readonly string[]).includes(value);
}
export function getUnlockedSlots(state: Pick<GameState, 'deckLevel'>): number { return state.deckLevel * 2; }
export function getSettlement(state: Pick<GameState, 'settlement'>): Settlement {
  return state.settlement ? {
    buildings: state.settlement.buildings.map(building => ({ ...building })),
    nextBuildingId: state.settlement.nextBuildingId,
    stats: state.settlement.stats ? { ...state.settlement.stats } : { productions: 0, collections: 0 },
  } : { buildings: [], nextBuildingId: 1, stats: { productions: 0, collections: 0 } };
}

export function getBuiltTypes(state: Pick<GameState, 'settlement' | 'facilityHistory'>): BuildingType[] {
  return [...new Set([
    ...(state.facilityHistory?.builtTypes ?? []),
    ...(state.settlement?.buildings.map(building => building.type) ?? []),
  ])];
}
export function getFacilityHistory(state: Pick<GameState, 'settlement' | 'facilityHistory'>): FacilityHistory {
  return { builtTypes: getBuiltTypes(state), upgradedFacilityIds: [...new Set([
    ...(state.facilityHistory?.upgradedFacilityIds ?? []),
    ...(state.settlement?.buildings.filter(building => building.level >= 2).map(building => building.id) ?? []),
  ])] };
}
export function getUpgradedFacilityRecord(state: Pick<GameState, 'settlement' | 'facilityHistory'>): number {
  return getFacilityHistory(state).upgradedFacilityIds.length;
}
function recordFacilityProgress(state: GameState) {
  state.facilityHistory = getFacilityHistory(state);
}
export function validateFacilityHistory(value: unknown, state: Pick<GameState, 'deckLevel' | 'settlement'>): value is FacilityHistory {
  if (!isRecord(value) || Object.keys(value).length !== 2 || !Array.isArray(value.builtTypes)
    || !Array.isArray(value.upgradedFacilityIds)) return false;
  const types = value.builtTypes, upgradedIds = value.upgradedFacilityIds;
  const ids = new Set(state.settlement?.buildings.map(building => building.id) ?? []);
  return types.length <= BUILDING_TYPES.length && new Set(types).size === types.length
    && types.every(type => isBuildingType(type) && BUILDINGS[type].unlockLevel <= state.deckLevel)
    && upgradedIds.length <= ids.size && new Set(upgradedIds).size === upgradedIds.length
    && upgradedIds.every(id => isInteger(id, 1, MAX_SLOTS) && ids.has(id));
}

/** Validate optional saved facilities without repairing paid costs or inventing production. */
export function validateSettlement(value: unknown, state: Pick<GameState, 'deckLevel' | 'totalMinutes'>): value is Settlement {
  if (!isRecord(value) || !Array.isArray(value.buildings) || value.buildings.length > getUnlockedSlots(state)) return false;
  if (!isInteger(value.nextBuildingId, 1, MAX_SLOTS + 1) || value.nextBuildingId !== value.buildings.length + 1) return false;
  if (Object.hasOwn(value, 'stats') && (!isRecord(value.stats) || Object.keys(value.stats).length !== 2
    || !isInteger(value.stats.productions, 0, 100_000_000) || !isInteger(value.stats.collections, 0, 100_000_000))) return false;
  const ids = new Set<number>(), slots = new Set<number>();
  for (const building of value.buildings) {
    if (!isRecord(building) || !isInteger(building.id, 1, value.buildings.length) || ids.has(building.id)
      || !isBuildingType(building.type) || !isInteger(building.slot, 0, getUnlockedSlots(state) - 1) || slots.has(building.slot)) return false;
    const definition = BUILDINGS[building.type];
    if (definition.unlockLevel > state.deckLevel || !isInteger(building.level, 1, definition.maxLevel)) return false;
    if (building.startedAt === null || building.readyAt === null) {
      if (building.startedAt !== null || building.readyAt !== null) return false;
    } else if (!isNumber(building.startedAt, 0, state.totalMinutes)
      || !isNumber(building.readyAt, 0, 1_440_000_000 + definition.minutes)
      || Math.abs(building.readyAt - building.startedAt - definition.minutes) > 0.0001) return false;
    ids.add(building.id); slots.add(building.slot);
  }
  return true;
}
function copy(state: GameState): GameState {
  return {
    ...state, resources: { ...state.resources }, plots: state.plots.map(plot => ({ ...plot })),
    ...(state.seedInventory ? { seedInventory: { ...state.seedInventory } } : {}),
    quests: [...state.quests], log: [...state.log], stats: { ...state.stats },
    ...(state.growthQuests ? { growthQuests: { claimed: [...state.growthQuests.claimed] } } : {}),
    ...(state.villageOrders ? { villageOrders: { ...state.villageOrders } } : {}),
    ...(state.companions ? { companions: cloneCompanions(state.companions) } : {}),
    ...(state.facilityHistory ? { facilityHistory: getFacilityHistory(state) } : {}),
    expedition: state.expedition ? { ...state.expedition, ...(state.expedition.participantIds ? { participantIds: [...state.expedition.participantIds] } : {}) } : null,
    settlement: getSettlement(state),
  };
}
function fail(state: GameState, message: string): SettlementResult { return { state, ok: false, message }; }
function success(state: GameState, message: string): SettlementResult {
  state.log = [`${state.day}일차 · ${message}`, ...state.log].slice(0, 30);
  return { state, ok: true, message };
}
function blocked(state: GameState): SettlementResult | null {
  if (state.expedition) return fail(state, '사냥을 마친 뒤 트럭의 생활 시설을 돌봐 주세요.');
  if (Object.hasOwn(state, 'settlement') && !validateSettlement(state.settlement, state)) return fail(state, '생활 시설 정보를 확인할 수 없어요. 저장 상태를 확인해 주세요.');
  if (Object.hasOwn(state, 'facilityHistory') && !validateFacilityHistory(state.facilityHistory, state)) return fail(state, '시설 성장 기록을 확인할 수 없어요. 저장 상태를 확인해 주세요.');
  return null;
}
function slotAvailable(state: GameState, slot: number, exceptId?: number): boolean {
  return isInteger(slot, 0, getUnlockedSlots(state) - 1)
    && !getSettlement(state).buildings.some(building => building.slot === slot && building.id !== exceptId);
}
export function getUpgradeCost(building: Building): { wood: number; scrap: number } {
  const definition = BUILDINGS[building.type], level = building.level + 1;
  return { wood: definition.wood * level, scrap: definition.scrap * level };
}
export function getProductionCost(building: Building): Partial<Record<Resource, number>> {
  const recipe: Partial<Record<Resource, number>> = {};
  for (const [resource, amount] of Object.entries(BUILDINGS[building.type].recipe ?? {})) recipe[resource as Resource] = amount! * building.level;
  return recipe;
}

export function buildFacility(state: GameState, type: BuildingType, slot: number): SettlementResult {
  const unavailable = blocked(state); if (unavailable) return unavailable;
  if (!isBuildingType(type)) return fail(state, '건설할 생활 시설을 선택해 주세요.');
  const definition = BUILDINGS[type];
  if (state.deckLevel < definition.unlockLevel) return fail(state, `${definition.name}은 트럭 데크 ${definition.unlockLevel}단계부터 건설할 수 있어요.`);
  if (!slotAvailable(state, slot)) return fail(state, '열려 있는 빈 건설 자리를 선택해 주세요.');
  if (state.resources.wood < definition.wood || state.resources.scrap < definition.scrap) return fail(state, `${definition.name} 건설에 목재 ${definition.wood} · 고철 ${definition.scrap}이 필요해요.`);
  const next = copy(state), settlement = next.settlement!;
  next.resources.wood -= definition.wood; next.resources.scrap -= definition.scrap;
  settlement.buildings.push({ id: settlement.nextBuildingId++, type, slot, level: 1, startedAt: null, readyAt: null });
  recordFacilityProgress(next);
  return success(next, `${definition.name}을 건설했어요. 생산을 시작해 우리집의 생활 물자를 모아 보세요!`);
}
/** Paid same-slot replacement keeps lifetime quest progress and never discards an active batch. */
export function replaceFacility(state: GameState, id: number, type: BuildingType): SettlementResult {
  const unavailable = blocked(state); if (unavailable) return unavailable;
  const building = getSettlement(state).buildings.find(item => item.id === id);
  if (!building || !isBuildingType(type)) return fail(state, '교체할 시설과 새 생활 시설을 선택해 주세요.');
  if (building.type === type) return fail(state, '이미 같은 시설이에요. 다른 종류를 선택해 주세요.');
  const definition = BUILDINGS[type];
  if (definition.unlockLevel > state.deckLevel) return fail(state, `${definition.name}은 트럭 데크 ${definition.unlockLevel}단계부터 사용할 수 있어요.`);
  if (building.readyAt !== null) return fail(state, '생산 중인 물자를 먼저 수령한 뒤 시설을 교체해 주세요.');
  if (state.resources.wood < definition.wood || state.resources.scrap < definition.scrap) return fail(state, `시설 교체에 목재 ${definition.wood} · 고철 ${definition.scrap}이 필요해요.`);
  const next = copy(state);
  recordFacilityProgress(next);
  const target = next.settlement!.buildings.find(item => item.id === id)!;
  next.resources.wood -= definition.wood; next.resources.scrap -= definition.scrap;
  target.type = type; target.level = 1;
  recordFacilityProgress(next);
  return success(next, `${BUILDINGS[building.type].name} 자리에 ${definition.name} Lv.1을 새로 지었어요. 이전 마을 성장 실적은 유지돼요.`);
}
export function moveFacility(state: GameState, id: number, slot: number): SettlementResult {
  const unavailable = blocked(state); if (unavailable) return unavailable;
  const building = getSettlement(state).buildings.find(item => item.id === id);
  if (!building) return fail(state, '이동할 생활 시설을 선택해 주세요.');
  if (building.slot === slot) return fail(state, '시설이 이미 이 자리에 있어요. 다른 빈 자리를 선택해 주세요.');
  if (!slotAvailable(state, slot, id)) return fail(state, '열려 있는 빈 건설 자리로 시설을 옮겨 주세요.');
  const next = copy(state); next.settlement!.buildings.find(item => item.id === id)!.slot = slot;
  return success(next, `${BUILDINGS[building.type].name}을 새 자리로 옮겼어요. 진행 중인 생산은 그대로 이어져요.`);
}
export function upgradeFacility(state: GameState, id: number): SettlementResult {
  const unavailable = blocked(state); if (unavailable) return unavailable;
  const building = getSettlement(state).buildings.find(item => item.id === id);
  if (!building) return fail(state, '개선할 생활 시설을 선택해 주세요.');
  const definition = BUILDINGS[building.type];
  if (building.level >= definition.maxLevel) return fail(state, '이미 가장 높은 단계의 생활 시설이에요.');
  if (building.readyAt !== null) return fail(state, '진행 중인 생산을 마치고 물자를 받은 뒤 시설을 개선해 주세요.');
  const cost = getUpgradeCost(building);
  if (state.resources.wood < cost.wood || state.resources.scrap < cost.scrap) return fail(state, `시설 개선에 목재 ${cost.wood} · 고철 ${cost.scrap}이 필요해요.`);
  const next = copy(state); next.resources.wood -= cost.wood; next.resources.scrap -= cost.scrap;
  next.settlement!.buildings.find(item => item.id === id)!.level += 1;
  recordFacilityProgress(next);
  return success(next, `${definition.name}을 ${building.level + 1}단계로 개선했어요. 한 번에 더 많은 물자를 생산해요!`);
}
export function startProduction(state: GameState, id: number): SettlementResult {
  const unavailable = blocked(state); if (unavailable) return unavailable;
  const building = getSettlement(state).buildings.find(item => item.id === id);
  if (!building) return fail(state, '생산을 시작할 생활 시설을 선택해 주세요.');
  const definition = BUILDINGS[building.type];
  if (building.readyAt !== null) return fail(state, state.totalMinutes >= building.readyAt ? '완성된 물자를 먼저 받아 주세요.' : '이미 생산 중이에요. 조금만 기다려 주세요.');
  const recipe = getProductionCost(building);
  if ((state.settlement?.stats?.productions ?? 0) >= 100_000_000) return fail(state, '생산 기록이 가득해요. 저장 상태를 확인해 주세요.');
  for (const [resource, amount] of Object.entries(recipe)) {
    if (state.resources[resource as Resource] < amount!) return fail(state, `${definition.name} 생산에 ${labels[resource as Resource]} ${amount}개가 필요해요.`);
  }
  const next = copy(state);
  for (const [resource, amount] of Object.entries(recipe)) next.resources[resource as Resource] -= amount!;
  const target = next.settlement!.buildings.find(item => item.id === id)!;
  target.startedAt = next.totalMinutes; target.readyAt = next.totalMinutes + definition.minutes;
  next.settlement!.stats!.productions += 1;
  return success(next, `${definition.name} 생산을 시작했어요. ${formatGameDuration(definition.minutes)} 뒤 ${labels[definition.yieldResource]} ${definition.yieldAmount * building.level}개를 받을 수 있어요.`);
}
export function collectProduction(state: GameState, id: number): SettlementResult {
  const unavailable = blocked(state); if (unavailable) return unavailable;
  const building = getSettlement(state).buildings.find(item => item.id === id);
  if (!building || building.readyAt === null) return fail(state, '아직 받을 물자가 없어요. 먼저 생산을 시작해 주세요.');
  if (state.totalMinutes < building.readyAt) return fail(state, '아직 생산 중이에요. 완성되면 물자를 받을 수 있어요.');
  const definition = BUILDINGS[building.type], amount = definition.yieldAmount * building.level;
  if ((state.settlement?.stats?.collections ?? 0) >= 100_000_000) return fail(state, '수령 기록이 가득해요. 저장 상태를 확인해 주세요.');
  if (state.resources[definition.yieldResource] > 100_000_000 - amount) return fail(state, '보관 공간에 물자가 가득해요. 물자를 사용한 뒤 받아 주세요.');
  const next = copy(state), target = next.settlement!.buildings.find(item => item.id === id)!;
  next.resources[definition.yieldResource] += amount; target.startedAt = null; target.readyAt = null;
  next.settlement!.stats!.collections += 1;
  return success(next, `${definition.name}에서 ${labels[definition.yieldResource]} +${amount}을 받았어요. 다음 생산을 시작할 수 있어요!`);
}
export interface SettlementGoal { id: string; title: string; description: string; current: number; target: number; complete: boolean }
export function getSettlementGoals(state: GameState): SettlementGoal[] {
  const settlement = getSettlement(state), buildings = settlement.buildings;
  const goals = [
    { id: 'first-facility', title: '우리 마을의 첫 시설', description: '생활 시설 1개 건설하기', current: buildings.length, target: 1 },
    { id: 'first-production', title: '움직이기 시작한 우리집', description: '생활 시설에서 생산 1번 시작하기', current: Math.max(settlement.stats!.productions, settlement.stats!.collections), target: 1 },
    { id: 'first-collection', title: '우리 손으로 만든 물자', description: '완성된 생산 물자 1번 받기', current: settlement.stats!.collections, target: 1 },
    { id: 'different-facilities', title: '서로 돕는 작은 마을', description: '서로 다른 생활 시설 3종 건설하기', current: new Set(buildings.map(building => building.type)).size, target: 3 },
    { id: 'better-facility', title: '정성이 쌓인 우리집', description: '생활 시설을 2단계로 개선하기', current: Math.max(0, ...buildings.map(building => building.level)), target: 2 },
    { id: 'wider-settlement', title: '넓어지는 트럭 마을', description: '트럭 데크를 3단계까지 확장하기', current: state.deckLevel, target: 3 },
  ];
  return goals.map(goal => ({ ...goal, current: Math.min(goal.current, goal.target), complete: goal.current >= goal.target }));
}
