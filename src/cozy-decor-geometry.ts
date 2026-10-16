import type { TruckFloor, TruckRect } from './truck-layout';

export const COZY_DECOR_IDS = ['flowerPlanter', 'oakBench', 'warmLamp', 'picnicRug', 'birdbath', 'buntingArch'] as const;
export type CozyDecorId = typeof COZY_DECOR_IDS[number];
export type DecorType = CozyDecorId;
export interface DecorPosition { floor: TruckFloor; x: number; y: number; rotation: 0 | 1 }
export interface CozyDecorPlacement extends DecorPosition { id: number; item: CozyDecorId }
export interface CozyDecorProgress {
  version: 1;
  nextPlacementId: number;
  inventory: Record<CozyDecorId, number>;
  /** Lifetime paid crafting; storing furniture does not count as crafting again. */
  crafted: Record<CozyDecorId, number>;
  placements: CozyDecorPlacement[];
}
export interface CozyDecorStateView { cozyDecor?: CozyDecorProgress }
export interface CozyDecorCost { wood: number; scrap: number; food: number; water: number; coins: number }
export interface CozyDecorDefinition {
  id: CozyDecorId; name: string; description: string; columns: number; rows: number; solid: boolean; cost: CozyDecorCost;
}
export const COZY_DECOR_ITEMS: Readonly<Record<CozyDecorId, CozyDecorDefinition>> = {
  flowerPlanter: { id: 'flowerPlanter', name: '꽃 상자', description: '되살아난 도로의 꽃을 담은 작은 나무 화분이에요.', columns: 1, rows: 1, solid: true, cost: { wood: 4, scrap: 0, food: 0, water: 2, coins: 0 } },
  oakBench: { id: 'oakBench', name: '참나무 벤치', description: '동물 친구와 나란히 쉬어 가는 따뜻한 자리를 만들어요.', columns: 2, rows: 1, solid: true, cost: { wood: 8, scrap: 2, food: 0, water: 0, coins: 3 } },
  warmLamp: { id: 'warmLamp', name: '별빛 가로등', description: '손질한 고철에 작은 등불을 달아 저녁을 밝혀요.', columns: 1, rows: 1, solid: true, cost: { wood: 4, scrap: 4, food: 0, water: 0, coins: 4 } },
  picnicRug: { id: 'picnicRug', name: '소풍 러그', description: '발걸음을 막지 않는 포근한 체크 러그와 소풍 바구니예요.', columns: 2, rows: 2, solid: false, cost: { wood: 4, scrap: 0, food: 2, water: 0, coins: 2 } },
  birdbath: { id: 'birdbath', name: '새들의 물그릇', description: '깨끗한 물과 재활용 그릇으로 새들이 쉬어 갈 곳을 만들어요.', columns: 1, rows: 1, solid: true, cost: { wood: 3, scrap: 3, food: 0, water: 4, coins: 2 } },
  buntingArch: { id: 'buntingArch', name: '환영 가랜드', description: '함께 모은 천 조각과 작은 꽃으로 우리 트럭을 꾸며요.', columns: 2, rows: 1, solid: true, cost: { wood: 7, scrap: 2, food: 0, water: 1, coins: 3 } },
};
export const DECOR_CELL_SIZE = 32;
export function isCozyDecorId(value: unknown): value is CozyDecorId { return typeof value === 'string' && COZY_DECOR_IDS.includes(value as CozyDecorId); }
export function emptyDecorInventory(): Record<CozyDecorId, number> { return { flowerPlanter: 0, oakBench: 0, warmLamp: 0, picnicRug: 0, birdbath: 0, buntingArch: 0 }; }
export function getDecorPlacements(state: CozyDecorStateView): CozyDecorPlacement[] { return state.cozyDecor?.placements.map(placement => ({ ...placement })) ?? []; }
export function getDecorInventoryCount(state: CozyDecorStateView, item: CozyDecorId): number { return state.cozyDecor?.inventory[item] ?? 0; }
export function getDecorFootprint(item: CozyDecorId, rotation: 0 | 1 = 0) {
  const definition = COZY_DECOR_ITEMS[item], columns = rotation ? definition.rows : definition.columns,
    rows = rotation ? definition.columns : definition.rows;
  return { columns, rows, width: columns * DECOR_CELL_SIZE, depth: rows * DECOR_CELL_SIZE };
}
export function getDecorPlacementBounds(placement: Omit<CozyDecorPlacement, 'id'>): TruckRect {
  const { width, depth } = getDecorFootprint(placement.item, placement.rotation);
  return { left: placement.x - width / 2, top: placement.y - depth / 2, right: placement.x + width / 2, bottom: placement.y + depth / 2 };
}
export function getDecorBounds(_state: CozyDecorStateView, placement: Omit<CozyDecorPlacement, 'id'>): TruckRect { return getDecorPlacementBounds(placement); }
export function decorRectOverlaps(a: TruckRect, b: TruckRect): boolean {
  return a.left < b.right - .001 && a.right > b.left + .001 && a.top < b.bottom - .001 && a.bottom > b.top + .001;
}
/** Facilities and beds also reserve walkable rugs: paid decoration is never overwritten. */
export function getDecorOverlap(state: CozyDecorStateView, floor: TruckFloor, bounds: TruckRect, exceptId?: number): CozyDecorPlacement | null {
  return state.cozyDecor?.placements.find(item => item.id !== exceptId && item.floor === floor && decorRectOverlaps(bounds, getDecorPlacementBounds(item))) ?? null;
}
/** The rug is a floor covering; every other decoration is a physical navigation obstacle. */
export function getDecorCollisionBounds(state: CozyDecorStateView, floor: TruckFloor): { id: number; floor: TruckFloor; bounds: TruckRect }[] {
  return (state.cozyDecor?.placements ?? []).filter(item => item.floor === floor && COZY_DECOR_ITEMS[item.item].solid)
    .map(item => ({ id: item.id, floor: item.floor, bounds: getDecorPlacementBounds(item) }));
}
