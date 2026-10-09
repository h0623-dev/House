import type { ActionResult, GameState, Resource } from './game';
import { getSettlement } from './settlement';
import { cloneUnitProgressFields } from './units';

/** Optional in older saves. A counter stores only deliveries actually paid for. */
export interface VillageOrderProgress { completed: number }
export interface VillageOrder {
  /** A lifetime sequence token, so returning to the same recipe cannot replay an old claim. */
  id: string;
  sequence: number;
  name: string;
  description: string;
  costs: Partial<Record<Resource, number>>;
  rewards: { resources: Partial<Record<Resource, number>>; xp: number };
  progress: { resource: Resource; current: number; target: number }[];
  sourceHint: string;
  ready: boolean;
}

const MAX_COUNTER = 100_000_000;
const MAX_RESOURCE = 100_000_000;
const ORDER_RECIPES = [
  {
    name: '깨끗한 물 나누기', description: '이웃 트럭에 식수를 보내고 데크를 넓힐 재료를 받아요.',
    costs: { water: 3 }, rewards: { resources: { wood: 8, scrap: 3 }, xp: 12 },
    sourceHint: '빗물 정수소에서 물을 생산하거나 도로를 탐색해 보세요.',
  },
  {
    name: '따뜻한 한 끼 배달', description: '수확한 식량을 나누고 새 시설을 지을 재료를 받아요.',
    costs: { food: 5 }, rewards: { resources: { wood: 10, scrap: 5 }, xp: 15 },
    sourceHint: '텃밭을 수확하거나 트럭 부엌에서 식량을 생산해 보세요.',
  },
  {
    name: '도로 쉼터 수리', description: '목재와 물로 쉼터를 고쳐 고철과 성장 경험치를 받아요.',
    costs: { wood: 12, water: 2 }, rewards: { resources: { scrap: 8 }, xp: 20 },
    sourceHint: '벌목장에서 목재를 모으고 빗물 정수소에서 물을 생산해 보세요.',
  },
] satisfies Omit<VillageOrder, 'id' | 'sequence' | 'progress' | 'ready'>[];

export function validateVillageOrders(value: unknown): value is VillageOrderProgress {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    && Object.keys(value).length === 1 && Object.hasOwn(value, 'completed')
    && Number.isInteger((value as VillageOrderProgress).completed)
    && (value as VillageOrderProgress).completed >= 0 && (value as VillageOrderProgress).completed <= MAX_COUNTER;
}

export function getVillageOrder(state: GameState): VillageOrder {
  const completed = state.villageOrders?.completed ?? 0;
  const recipe = ORDER_RECIPES[completed % ORDER_RECIPES.length];
  const costs = { ...recipe.costs };
  const progress = Object.entries(costs).map(([resource, target]) => ({
    resource: resource as Resource, current: Math.min(state.resources[resource as Resource], target), target,
  }));
  return {
    ...recipe, id: `village-order-${completed + 1}`, sequence: completed + 1,
    costs, rewards: { resources: { ...recipe.rewards.resources }, xp: recipe.rewards.xp }, progress,
    ready: !state.expedition && completed < MAX_COUNTER && progress.every(item => item.current >= item.target),
  };
}

/** Delivering is an atomic exchange. Refused or stale calls return the untouched input. */
export function fulfillVillageOrder(state: GameState, expectedId: string): ActionResult {
  const fail = (message: string): ActionResult => ({ state, ok: false, message });
  if (state.expedition) return fail('사냥을 마친 뒤 이웃에게 물자를 보내 주세요.');
  if (Object.hasOwn(state, 'villageOrders') && !validateVillageOrders(state.villageOrders)) {
    return fail('물자 요청 기록을 확인할 수 없어요. 저장 상태를 확인해 주세요.');
  }
  const completed = state.villageOrders?.completed ?? 0;
  if (completed >= MAX_COUNTER) return fail('물자 요청 기록이 가득해요. 저장 상태를 확인해 주세요.');
  const order = getVillageOrder(state);
  if (expectedId !== order.id) return fail('이미 보냈거나 현재 요청과 다른 물자예요. 새 요청을 확인해 주세요.');
  if (!order.ready) return fail('요청한 물자가 부족해요. 생산하거나 채집해서 모아 주세요.');
  if (state.xp > MAX_RESOURCE - order.rewards.xp
    || Object.entries(order.rewards.resources).some(([resource, amount]) => state.resources[resource as Resource] > MAX_RESOURCE - amount!)) {
    return fail('물자나 성장 기록이 가득해요. 물자를 사용한 뒤 보내 주세요.');
  }
  const next: GameState = {
    ...state, resources: { ...state.resources },
    ...(state.seedInventory ? { seedInventory: { ...state.seedInventory } } : {}),
    ...(state.settlement ? { settlement: getSettlement(state) } : {}),
    ...(state.facilityHistory ? { facilityHistory: { ...state.facilityHistory, builtTypes: [...state.facilityHistory.builtTypes], upgradedFacilityIds: [...state.facilityHistory.upgradedFacilityIds] } } : {}),
    ...(state.growthQuests ? { growthQuests: { claimed: [...state.growthQuests.claimed] } } : {}),
    ...cloneUnitProgressFields(state),
    plots: state.plots.map(plot => ({ ...plot })), quests: [...state.quests], log: [...state.log], stats: { ...state.stats },
    expedition: null,
    villageOrders: { completed: completed + 1 },
  };
  for (const [resource, amount] of Object.entries(order.costs)) next.resources[resource as Resource] -= amount!;
  for (const [resource, amount] of Object.entries(order.rewards.resources)) next.resources[resource as Resource] += amount!;
  next.xp += order.rewards.xp;
  next.level = Math.floor(next.xp / 120) + 1;
  const message = `${order.name} 완료! 이웃에게 물자를 보내고 건설 재료와 경험치 +${order.rewards.xp}을 받았어요.`;
  next.log = [`${next.day}일차 · ${message}`, ...next.log].slice(0, 30);
  return { state: next, ok: true, message };
}
