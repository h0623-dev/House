import type { ActionResult, GameState } from './game';
import { getDeckGridBounds, getFacilityBounds, getFacilityPlacement, type DeckPlacementState } from './deck-placement';
import { FARM_POSITIONS, getFloorStairs, getTruckFloorCount, type TruckFloor, type TruckRect } from './truck-layout';
import { getTruckAccessGeometry } from './truck-access';
import { getShop, validateShopProgress } from './shop';
import { reconcileFarmEconomyFood, validateFarmEconomy } from './farm-economy';
import { COZY_DECOR_IDS, COZY_DECOR_ITEMS, DECOR_CELL_SIZE, decorRectOverlaps, emptyDecorInventory, getDecorFootprint,
  getDecorInventoryCount, getDecorOverlap, getDecorPlacementBounds, isCozyDecorId, type CozyDecorId, type CozyDecorProgress,
  type CozyDecorStateView, type DecorPosition } from './cozy-decor-geometry';
export * from './cozy-decor-geometry';

export type CozyDecorState = DeckPlacementState & CozyDecorStateView;
export interface DecorPlacementCheck { ok: boolean; message: string; reason?: string }
const LIMIT = 999;
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const integer = (value: unknown, min = 0, max = LIMIT): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
const refusal = (message: string): DecorPlacementCheck => ({ ok: false, message, reason: message });
const fail = (state: GameState, message: string): ActionResult => ({ state, ok: false, message });
export function getCozyDecorProgress(state: CozyDecorStateView): CozyDecorProgress {
  const current = state.cozyDecor;
  return current ? { version: 1, nextPlacementId: current.nextPlacementId, inventory: { ...current.inventory }, crafted: { ...current.crafted }, placements: current.placements.map(item => ({ ...item })) }
    : { version: 1, nextPlacementId: 1, inventory: emptyDecorInventory(), crafted: emptyDecorInventory(), placements: [] };
}
export function cloneCozyDecorFields(state: CozyDecorStateView): CozyDecorStateView { return state.cozyDecor ? { cozyDecor: getCozyDecorProgress(state) } : {}; }
function obstacles(state: CozyDecorState, floor: TruckFloor): { bounds: TruckRect; message: string }[] {
  const result: { bounds: TruckRect; message: string }[] = [];
  if (floor === 1) {
    FARM_POSITIONS.slice(0, state.plots.length).forEach(([x, y]) => result.push({ bounds: { left: x, top: y, right: x + 96, bottom: y + 96 }, message: '밭이 있는 칸은 비워 주세요.' }));
    result.push({ bounds: getTruckAccessGeometry(state.deckLevel).reserved, message: '사람과 동물이 오가는 입구는 비워 주세요.' });
  }
  const overrides = new Map(state.truckLayout?.placements.map(item => [item.id, item.slot]) ?? []);
  const buildings = [...state.settlement?.buildings.map(item => ({ ...item, slot: overrides.get(item.id) ?? item.slot })) ?? [], ...state.truckLayout?.upperBuildings ?? []];
  buildings.forEach(building => { if (getFacilityPlacement(state, building).floor === floor) result.push({ bounds: getFacilityBounds(state, building), message: '시설과 겹치지 않는 빈 칸을 골라 주세요.' }); });
  for (let upper = 2; upper <= getTruckFloorCount(state); upper++) {
    const stair = getFloorStairs(state, upper as 2 | 3);
    if (floor !== stair.lowerFloor && floor !== stair.upperFloor) continue;
    result.push({ bounds: { left: Math.min(stair.reserved.left, stair.lowerEntryUV[0] - 22, stair.upperEntryUV[0] - 22),
      right: Math.max(stair.reserved.right, stair.lowerEntryUV[0] + 22, stair.upperEntryUV[0] + 22),
      top: Math.min(stair.reserved.top, stair.lowerEntryUV[1] - 22, stair.upperEntryUV[1] - 22),
      bottom: Math.max(stair.reserved.bottom, stair.lowerEntryUV[1] + 22, stair.upperEntryUV[1] + 22) }, message: '층 사이 계단과 입구는 비워 주세요.' });
  }
  return result;
}
export function snapDecorPlacement(_state: Pick<GameState, 'deckLevel'>, item: CozyDecorId, position: DecorPosition): DecorPosition {
  const size = getDecorFootprint(item, position.rotation);
  return { floor: position.floor, rotation: position.rotation,
    x: Math.round((position.x - size.width / 2) / DECOR_CELL_SIZE) * DECOR_CELL_SIZE + size.width / 2,
    y: Math.round((position.y - size.depth / 2) / DECOR_CELL_SIZE) * DECOR_CELL_SIZE + size.depth / 2 };
}
export function checkDecorPlacement(state: CozyDecorState, item: CozyDecorId, position: DecorPosition, exceptId?: number): DecorPlacementCheck {
  if (!isCozyDecorId(item) || !position || !integer(position.floor, 1, getTruckFloorCount(state)) || !Number.isFinite(position.x)
    || !Number.isFinite(position.y) || position.rotation !== 0 && position.rotation !== 1) return refusal('꾸밀 층과 데크 안쪽의 칸을 골라 주세요.');
  const bounds = getDecorPlacementBounds({ ...position, item }), deck = getDeckGridBounds(state, position.floor);
  if (bounds.left < deck.left || bounds.top < deck.top || bounds.right > deck.right || bounds.bottom > deck.bottom) return refusal('장식의 모든 칸이 난간 안쪽에 들어와야 해요.');
  const snapped = snapDecorPlacement(state, item, position);
  if (Math.abs(snapped.x - position.x) > .001 || Math.abs(snapped.y - position.y) > .001) return refusal('데크의 격자 칸에 맞춰 놓아 주세요.');
  const blocked = obstacles(state, position.floor).find(obstacle => decorRectOverlaps(bounds, obstacle.bounds));
  if (blocked) return refusal(blocked.message);
  if (getDecorOverlap(state, position.floor, bounds, exceptId)) return refusal('다른 장식이 있는 칸이에요. 빈 칸으로 옮겨 주세요.');
  return { ok: true, message: '여기에 놓을 수 있어요.' };
}
export function findFreeDecorPlacement(state: CozyDecorState, item: CozyDecorId, floor: TruckFloor = 1, exceptId?: number): DecorPosition | null {
  if (!isCozyDecorId(item) || !integer(floor, 1, getTruckFloorCount(state))) return null;
  const deck = getDeckGridBounds(state, floor), occupied = [...obstacles(state, floor).map(obstacle => obstacle.bounds),
    ...(state.cozyDecor?.placements ?? []).filter(placement => placement.floor === floor && placement.id !== exceptId).map(getDecorPlacementBounds)];
  for (const rotation of [0, 1] as const) {
    const size = getDecorFootprint(item, rotation);
    for (let y = deck.top + size.depth / 2; y <= deck.bottom - size.depth / 2; y += DECOR_CELL_SIZE) {
      for (let x = deck.left + size.width / 2; x <= deck.right - size.width / 2; x += DECOR_CELL_SIZE) {
        const position = { floor, x, y, rotation }, candidateBounds = getDecorPlacementBounds({ ...position, item });
        if (!occupied.some(bounds => decorRectOverlaps(candidateBounds, bounds))) return position;
      }
    }
  }
  return null;
}
function actionBlock(state: GameState): string | null {
  if (state.expedition) return '탐험을 마친 뒤 우리 트럭을 꾸며 주세요.';
  if (!record(state.resources) || !['wood', 'scrap', 'food', 'water'].every(resource => integer(state.resources[resource as 'wood' | 'scrap' | 'food' | 'water'], 0, 100_000_000))) return '보관 중인 재료의 저장 기록을 읽을 수 없어요.';
  if (state.cozyDecor && !validateCozyDecorProgress(state.cozyDecor, state)) return '장식 보관 기록을 읽을 수 없어요.';
  if (state.shop && !validateShopProgress(state.shop)) return '코인 지갑의 저장 기록을 읽을 수 없어요.';
  if (state.farmEconomy && !validateFarmEconomy(state.farmEconomy, state)) return '수확물의 보관 기록을 읽을 수 없어요.';
  return null;
}
export function canCraftCozyDecoration(state: GameState, item: CozyDecorId): DecorPlacementCheck {
  const reason = actionBlock(state); if (reason) return refusal(reason);
  if (!isCozyDecorId(item)) return refusal('만들 장식을 골라 주세요.');
  if ((state.cozyDecor?.crafted[item] ?? 0) >= LIMIT) return refusal('이 장식의 보관 수가 가득해요.');
  const cost = COZY_DECOR_ITEMS[item].cost;
  if (['wood', 'scrap', 'food', 'water'].some(resource => state.resources[resource as 'wood' | 'scrap' | 'food' | 'water'] < cost[resource as 'wood' | 'scrap' | 'food' | 'water'])) return refusal('재료가 부족해요. 채집·수확·생산으로 모아 주세요.');
  if (getShop(state).coins < cost.coins) return refusal('코인이 부족해요. 상점에서 남는 수확물을 판매해 보세요.');
  return { ok: true, message: '모은 재료로 만들 수 있어요.' };
}
/** Craft once, then freely place, turn, move and store the same owned furniture. */
export function craftCozyDecoration(state: GameState, item: unknown): ActionResult {
  if (!isCozyDecorId(item)) return fail(state, '만들 장식을 골라 주세요.');
  const check = canCraftCozyDecoration(state, item); if (!check.ok) return fail(state, check.message);
  const next = structuredClone(state), cost = COZY_DECOR_ITEMS[item].cost;
  next.cozyDecor = getCozyDecorProgress(state); next.shop = getShop(state);
  next.resources.wood -= cost.wood; next.resources.scrap -= cost.scrap; next.resources.food -= cost.food; next.resources.water -= cost.water; next.shop.coins -= cost.coins;
  if (cost.food) reconcileFarmEconomyFood(next);
  next.cozyDecor.inventory[item]++; next.cozyDecor.crafted[item]++;
  return { state: next, ok: true, message: `${COZY_DECOR_ITEMS[item].name}를 만들었어요. 원하는 칸에 놓아 보세요.` };
}
export function placeCozyDecoration(state: GameState, item: unknown, position: DecorPosition): ActionResult {
  const blocked = actionBlock(state); if (blocked) return fail(state, blocked);
  if (!isCozyDecorId(item) || getDecorInventoryCount(state, item) < 1) return fail(state, '보관 중인 장식을 골라 주세요.');
  if ((state.cozyDecor?.placements.length ?? 0) >= 120) return fail(state, '장식을 120개 놓았어요. 일부를 보관한 뒤 놓아 주세요.');
  const check = checkDecorPlacement(state, item, position); if (!check.ok) return fail(state, check.message);
  const next = structuredClone(state); next.cozyDecor = getCozyDecorProgress(state);
  if (next.cozyDecor.nextPlacementId >= 1_000_000_000) return fail(state, '장식 배치 기록이 가득해요.');
  next.cozyDecor.placements.push({ ...position, item, id: next.cozyDecor.nextPlacementId++ }); next.cozyDecor.inventory[item]--;
  return { state: next, ok: true, message: `${COZY_DECOR_ITEMS[item].name}를 놓았어요. 다시 눌러 옮기거나 보관할 수 있어요.` };
}
export function moveCozyDecoration(state: GameState, id: number, position: DecorPosition): ActionResult {
  const blocked = actionBlock(state); if (blocked) return fail(state, blocked);
  const placement = state.cozyDecor?.placements.find(item => item.id === id);
  if (!placement) return fail(state, '옮길 장식을 골라 주세요.');
  const check = checkDecorPlacement(state, placement.item, position, id); if (!check.ok) return fail(state, check.message);
  const next = structuredClone(state); next.cozyDecor = getCozyDecorProgress(state);
  const moving = next.cozyDecor.placements.find(item => item.id === id)!; Object.assign(moving, position);
  return { state: next, ok: true, message: `${COZY_DECOR_ITEMS[placement.item].name}의 위치를 바꿨어요.` };
}
export function storeCozyDecoration(state: GameState, id: number): ActionResult {
  const blocked = actionBlock(state); if (blocked) return fail(state, blocked);
  const placement = state.cozyDecor?.placements.find(item => item.id === id);
  if (!placement) return fail(state, '보관할 장식을 골라 주세요.');
  const next = structuredClone(state); next.cozyDecor = getCozyDecorProgress(state);
  next.cozyDecor.placements = next.cozyDecor.placements.filter(item => item.id !== id); next.cozyDecor.inventory[placement.item]++;
  return { state: next, ok: true, message: `${COZY_DECOR_ITEMS[placement.item].name}를 보관했어요. 다시 놓을 때 재료가 들지 않아요.` };
}
/** Old saves simply have no furniture: migration never grants material or coins. */
export function validateCozyDecorProgress(value: unknown, state: CozyDecorState): value is CozyDecorProgress {
  if (!record(value) || Object.keys(value).length !== 5 || value.version !== 1 || !integer(value.nextPlacementId, 1, 1_000_000_000)
    || !record(value.inventory) || !record(value.crafted) || Object.keys(value.inventory).length !== COZY_DECOR_IDS.length
    || Object.keys(value.crafted).length !== COZY_DECOR_IDS.length || !Array.isArray(value.placements) || value.placements.length > 120
    || !COZY_DECOR_IDS.every(id => integer((value.inventory as Record<string, unknown>)[id]) && integer((value.crafted as Record<string, unknown>)[id]))) return false;
  const ids = new Set<number>();
  for (const placement of value.placements) {
    if (!record(placement) || Object.keys(placement).length !== 6 || !integer(placement.id, 1, value.nextPlacementId - 1) || ids.has(placement.id)
      || !isCozyDecorId(placement.item) || !integer(placement.floor, 1, getTruckFloorCount(state)) || typeof placement.x !== 'number'
      || !Number.isFinite(placement.x) || typeof placement.y !== 'number' || !Number.isFinite(placement.y) || placement.rotation !== 0 && placement.rotation !== 1) return false;
    ids.add(placement.id);
  }
  const candidate = { ...state, cozyDecor: value as unknown as CozyDecorProgress };
  for (const item of COZY_DECOR_IDS) {
    if (Number(value.inventory[item]) + candidate.cozyDecor.placements.filter(placement => placement.item === item).length !== value.crafted[item]) return false;
  }
  return candidate.cozyDecor.placements.every(placement => checkDecorPlacement(candidate, placement.item, placement, placement.id).ok);
}
