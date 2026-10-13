import type { ActionResult, GameState, Plot } from './game';
import { getCropProgress } from './game';
import { CROP_IDS, CROPS, isCropId, type CropId } from './crops';
import { getShop, validateShopProgress } from './shop';

/** Each crop unit is backed by one unit of the existing food resource. */
export interface FertilizedFarmPlot { plotId: number; plantedAt: number; cropId: CropId }
export interface FarmEconomyProgress {
  version: 1;
  crops: Record<CropId, number>;
  completedOrders: number;
  /** Care belongs to one paid planting batch, rather than permanently to a plot. */
  fertilizedPlots: FertilizedFarmPlot[];
}
export interface FarmPlotCare {
  fertilized: boolean;
  baseYield: number;
  yieldAmount: number;
  canFertilize: boolean;
  cost: { food: number; energy: number };
  bonus: number;
}
export interface FarmOrder {
  id: string;
  sequence: number;
  name: string;
  description: string;
  costs: Partial<Record<CropId, number>>;
  progress: { cropId: CropId; current: number; target: number }[];
  rewards: { coins: number; xp: number; wood: number; scrap: number };
  ready: boolean;
  sourceHint: string;
}

export const FARM_FERTILIZER_COST = { food: 1, energy: 2 } as const;
export const FARM_FERTILIZER_BONUS = 2;
const LIMIT = 100_000_000;
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const integer = (value: unknown, min = 0, max = LIMIT): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
const emptyCrops = (): Record<CropId, number> => ({ carrot: 0, potato: 0, tomato: 0, corn: 0, strawberry: 0, pumpkin: 0 });

/** Older food remains general provisions; reading never assigns it a crop type. */
export function getFarmEconomy(state: Pick<GameState, 'farmEconomy'>): FarmEconomyProgress {
  const farm = state.farmEconomy;
  return farm ? { version: 1, crops: { ...farm.crops }, completedOrders: farm.completedOrders, fertilizedPlots: farm.fertilizedPlots.map(item => ({ ...item })) }
    : { version: 1, crops: emptyCrops(), completedOrders: 0, fertilizedPlots: [] };
}
export function getFarmCropInventory(state: Pick<GameState, 'farmEconomy'>): Record<CropId, number> { return getFarmEconomy(state).crops; }
export function cloneFarmEconomyFields(state: Pick<GameState, 'farmEconomy'>): Pick<GameState, 'farmEconomy'> {
  return state.farmEconomy ? { farmEconomy: getFarmEconomy(state) } : {};
}

/** Damaged crop backing and care for missing or replaced batches reject a save. */
export function validateFarmEconomy(value: unknown, state: Pick<GameState, 'resources' | 'plots'>): value is FarmEconomyProgress {
  if (!record(value) || Object.keys(value).length !== 4 || !['version', 'crops', 'completedOrders', 'fertilizedPlots'].every(key => Object.hasOwn(value, key))
    || value.version !== 1 || !integer(value.completedOrders) || !record(value.crops) || Object.keys(value.crops).length !== CROP_IDS.length
    || !CROP_IDS.every(id => integer((value.crops as Record<string, unknown>)[id])) || !Array.isArray(value.fertilizedPlots)
    || value.fertilizedPlots.length > state.plots.length || !integer(state.resources.food)) return false;
  const stock = value.crops as Record<CropId, number>;
  if (CROP_IDS.reduce((sum, id) => sum + stock[id], 0) > state.resources.food) return false;
  const plotIds = new Set<number>();
  for (const care of value.fertilizedPlots) {
    if (!record(care) || Object.keys(care).length !== 3 || !integer(care.plotId, 1, 100)
      || typeof care.plantedAt !== 'number' || !Number.isFinite(care.plantedAt) || care.plantedAt < 0 || !isCropId(care.cropId)
      || plotIds.has(care.plotId)) return false;
    const plot = state.plots.find(item => item.id === care.plotId);
    if (!plot || plot.plantedAt === null || plot.plantedAt !== care.plantedAt || (plot.cropId ?? 'carrot') !== care.cropId) return false;
    plotIds.add(care.plotId);
  }
  return true;
}

/**
 * Mutates an already detached successful state after generic food is spent.
 * General provisions are consumed first; if they run out, crop units are used
 * in the displayed inventory order. This never adds food or typed crops.
 */
export function reconcileFarmEconomyFood(state: GameState): void {
  if (!state.farmEconomy) return;
  const stock = state.farmEconomy.crops;
  let shortage = Math.max(0, CROP_IDS.reduce((sum, id) => sum + stock[id], 0) - state.resources.food);
  for (const id of CROP_IDS) {
    const used = Math.min(shortage, stock[id]);
    stock[id] -= used; shortage -= used;
  }
}

export function getFarmPlotCare(state: GameState, plot: Plot): FarmPlotCare {
  const cropId = plot.cropId ?? 'carrot';
  const fertilized = plot.plantedAt !== null && (state.farmEconomy?.fertilizedPlots.some(item => item.plotId === plot.id && item.plantedAt === plot.plantedAt && item.cropId === cropId) ?? false);
  const baseYield = CROPS[cropId].food;
  return { fertilized, baseYield, yieldAmount: baseYield + (fertilized ? FARM_FERTILIZER_BONUS : 0),
    canFertilize: !state.expedition && plot.plantedAt !== null && !fertilized && getCropProgress(state, plot) < 1
      && state.resources.food >= FARM_FERTILIZER_COST.food && state.energy >= FARM_FERTILIZER_COST.energy,
    cost: { ...FARM_FERTILIZER_COST }, bonus: FARM_FERTILIZER_BONUS };
}

/** Internal commit helper. Caller pays the cost and validates this current batch. */
export function markFarmPlotFertilized(state: GameState, plot: Plot): void {
  if (plot.plantedAt === null) return;
  const farm = state.farmEconomy ??= getFarmEconomy(state);
  farm.fertilizedPlots.push({ plotId: plot.id, plantedAt: plot.plantedAt, cropId: plot.cropId ?? 'carrot' });
}

/** Internal harvest commit: one typed crop unit per food unit, then retire care. */
export function recordFarmHarvest(state: GameState, plot: Plot, amount: number): void {
  const farm = state.farmEconomy ??= getFarmEconomy(state);
  farm.crops[plot.cropId ?? 'carrot'] += amount;
  farm.fertilizedPlots = farm.fertilizedPlots.filter(item => item.plotId !== plot.id);
}

const ORDER_RECIPES = [
  { cropId: 'carrot', quantity: 3, name: '당근 바구니를 이웃에게', rewards: { coins: 14, xp: 12, wood: 2, scrap: 0 } },
  { cropId: 'potato', quantity: 4, name: '든든한 감자 한 끼', rewards: { coins: 19, xp: 15, wood: 3, scrap: 1 } },
  { cropId: 'tomato', quantity: 4, name: '싱싱한 토마토 배달', rewards: { coins: 22, xp: 18, wood: 3, scrap: 2 } },
  { cropId: 'corn', quantity: 5, name: '노란 옥수수 바구니', rewards: { coins: 28, xp: 20, wood: 4, scrap: 2 } },
  { cropId: 'strawberry', quantity: 5, name: '달콤한 딸기 선물', rewards: { coins: 34, xp: 24, wood: 4, scrap: 3 } },
  { cropId: 'pumpkin', quantity: 6, name: '풍성한 호박 수프', rewards: { coins: 42, xp: 28, wood: 5, scrap: 3 } },
] as const;

export function getFarmOrder(state: GameState): FarmOrder {
  const farm = getFarmEconomy(state), recipe = ORDER_RECIPES[farm.completedOrders % ORDER_RECIPES.length];
  const progress = [{ cropId: recipe.cropId, current: Math.min(farm.crops[recipe.cropId], recipe.quantity), target: recipe.quantity }];
  return { id: `farm-order-${farm.completedOrders + 1}`, sequence: farm.completedOrders + 1, name: recipe.name,
    description: '직접 수확한 작물을 이웃 트럭에 보내고 코인·성장 경험치·건설 재료를 받아요.',
    costs: { [recipe.cropId]: recipe.quantity }, progress, rewards: { ...recipe.rewards },
    ready: !state.expedition && farm.completedOrders < LIMIT && progress.every(item => item.current >= item.target),
    sourceHint: `${CROPS[recipe.cropId].seedName}을 심고 물을 준 뒤 수확해요. 영양을 주면 한 밭에서 ${FARM_FERTILIZER_BONUS}개를 더 얻어요.` };
}

/** Only the explicit current order can spend stock and pay its reward once. */
export function fulfillFarmOrder(state: GameState, expectedId: string): ActionResult {
  const fail = (message: string): ActionResult => ({ state, ok: false, message });
  if (state.expedition) return fail('탐험을 마친 뒤 이웃 트럭에 작물을 보내 주세요.');
  if (Object.hasOwn(state, 'farmEconomy') && !validateFarmEconomy(state.farmEconomy, state)) return fail('수확물과 영양 관리 기록을 확인할 수 없어요. 저장 상태를 확인해 주세요.');
  if (Object.hasOwn(state, 'shop') && !validateShopProgress(state.shop)) return fail('코인 지갑 기록을 확인할 수 없어요. 저장 상태를 확인해 주세요.');
  const order = getFarmOrder(state);
  if (state.farmEconomy?.completedOrders === LIMIT) return fail('작물 배달 기록이 가득해요. 저장 상태를 확인해 주세요.');
  if (expectedId !== order.id) return fail('이미 보냈거나 현재 요청과 다른 작물이에요. 새 요청을 확인해 주세요.');
  if (!order.ready) return fail('요청한 작물이 부족해요. 씨앗을 심고 물을 주어 직접 수확해 주세요.');
  if (![state.xp, state.resources.food, state.resources.wood, state.resources.scrap].every(value => integer(value))
    || !integer(state.xp + order.rewards.xp) || !integer(state.resources.wood + order.rewards.wood)
    || !integer(state.resources.scrap + order.rewards.scrap) || !integer(getShop(state).coins + order.rewards.coins)) {
    return fail('물자·코인·성장 기록이 가득해요. 보유 물자를 사용한 뒤 배달해 주세요.');
  }
  const next = structuredClone(state);
  next.farmEconomy = getFarmEconomy(state); next.shop = getShop(state);
  for (const [cropId, amount] of Object.entries(order.costs)) {
    next.farmEconomy.crops[cropId as CropId] -= amount!;
    next.resources.food -= amount!;
  }
  next.farmEconomy.completedOrders += 1;
  next.shop.coins += order.rewards.coins;
  next.resources.wood += order.rewards.wood; next.resources.scrap += order.rewards.scrap;
  next.xp += order.rewards.xp; next.level = Math.floor(next.xp / 120) + 1;
  const message = `${order.name} 완료! 코인 +${order.rewards.coins} · 경험치 +${order.rewards.xp} · 목재 +${order.rewards.wood}${order.rewards.scrap ? ` · 고철 +${order.rewards.scrap}` : ''}`;
  next.log = [`${next.day}일차 · ${message}`, ...next.log].slice(0, 30);
  return { state: next, ok: true, message };
}
