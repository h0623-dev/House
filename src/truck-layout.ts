import type { Building, FacilityHistory } from './settlement';

export type TruckFloor = 1 | 2 | 3;
export type TruckPoint = [number, number];
export interface TruckRect { left: number; top: number; right: number; bottom: number }
export interface HomeLocation { floor: TruckFloor; slot: number }
/** Legacy records stay in settlement; only their actual locations are overridden. */
export interface TruckLayout {
  version: 1;
  floors: TruckFloor;
  home: HomeLocation;
  placements: { id: number; slot: number }[];
  upperBuildings: Building[];
  nextBuildingId: number;
  facilityHistory?: FacilityHistory;
}
export interface TruckLayoutState { deckLevel: number; truckLayout?: TruckLayout }
export const SLOTS_PER_FLOOR = 16;
export const MAX_TRUCK_FLOORS = 3;
export const FLOOR_HEIGHT = 176;
export const DEFAULT_HOME_LOCATION: HomeLocation = { floor: 1, slot: 0 };
export const HOME_POSITIONS: readonly TruckPoint[] = [[-206,-102],[-206,-274],[-206,-446],[-206,-618],[156,-102]];
export const HOME_HALF_WIDTH = 58, HOME_HALF_DEPTH = 57, HOME_RAIL_MARGIN = 14;
export const FARM_POSITIONS: TruckPoint[] = [[-132,40],[-36,40],[60,40],[156,40],[-132,136],[-36,136],[60,136],[156,136],
  [252,40],[252,136],[348,40],[348,136],[-132,232],[-36,232],[60,232],[156,232],[252,232],[348,232],
  [-132,328],[-36,328],[60,328],[156,328],[252,328],[348,328]];
export const SETTLEMENT_POSITIONS: TruckPoint[] = [[-42,-106],[124,-106],[-42,-278],[124,-278],[-42,-450],[124,-450],[290,-106],[456,-106],
  [290,-278],[456,-278],[290,-450],[456,-450],[-42,-622],[124,-622],[290,-622],[456,-622]];
export const DECK_FRONTS = [141,228,228,254,324,344,420,448];
export const TRUCK_FLOOR_COSTS = {
  2: { floor: 2 as const, unlockLevel: 4, wood: 100, scrap: 50 },
  3: { floor: 3 as const, unlockLevel: 7, wood: 160, scrap: 80 },
};
export function getTruckFloorCount(state: Pick<TruckLayoutState, 'truckLayout'>): TruckFloor { return state.truckLayout?.floors ?? 1; }
export function getTruckFloorCost(state: Pick<TruckLayoutState, 'truckLayout'>) {
  const next = getTruckFloorCount(state) + 1;
  return next === 2 || next === 3 ? { ...TRUCK_FLOOR_COSTS[next] } : null;
}
export function getSlotFloor(slot: number): TruckFloor { return (Math.floor(slot / SLOTS_PER_FLOOR) + 1) as TruckFloor; }
export function getSlotLocalIndex(slot: number): number { return slot % SLOTS_PER_FLOOR; }
export function getFloorSlots(state: TruckLayoutState, floor: TruckFloor): number[] {
  if (!Number.isInteger(floor) || floor < 1 || floor > getTruckFloorCount(state)) return [];
  return Array.from({ length: Math.min(SLOTS_PER_FLOOR, state.deckLevel * 2) }, (_, index) => (floor - 1) * SLOTS_PER_FLOOR + index);
}
export function getAllUnlockedSlots(state: TruckLayoutState): number {
  return Math.min(SLOTS_PER_FLOOR, state.deckLevel * 2) * getTruckFloorCount(state);
}
export function getFloorBounds(level: number, floor: TruckFloor = 1) {
  const step = Math.max(0, Math.min(7, level - 1)), lower = Math.floor(step), upper = Math.ceil(step), amount = step - lower;
  const ends = [234,282,350,558,582,606,634,662], backs = [-184,-356,-528,-544,-560,-576,-744,-768];
  return { level, floor, height: (floor - 1) * FLOOR_HEIGHT, left: -318 - step * 14,
    end: ends[lower] + (ends[upper] - ends[lower]) * amount,
    back: backs[lower] + (backs[upper] - backs[lower]) * amount,
    front: DECK_FRONTS[lower] + (DECK_FRONTS[upper] - DECK_FRONTS[lower]) * amount };
}
export function projectTruckPoint([u,v]: readonly number[], floor: TruckFloor = 1, height = 0): TruckPoint {
  return [480 + u * .91 - v * .67, 325 + u * .34 + v * .47 - (floor - 1) * FLOOR_HEIGHT - height];
}
export function unprojectTruckPoint([x,y]: readonly number[], floor: TruckFloor = 1): TruckPoint {
  const adjustedY = y + (floor - 1) * FLOOR_HEIGHT;
  return [(.47 * (x - 480) + .67 * (adjustedY - 325)) / .6555,
    (-.34 * (x - 480) + .91 * (adjustedY - 325)) / .6555];
}
export function getHomeLocation(state: Pick<TruckLayoutState, 'truckLayout'>): HomeLocation {
  return state.truckLayout ? { ...state.truckLayout.home } : { ...DEFAULT_HOME_LOCATION };
}
export function getHousePosition(value: TruckLayoutState | HomeLocation = DEFAULT_HOME_LOCATION): TruckPoint {
  const location = 'floor' in value ? value : getHomeLocation(value);
  return [...HOME_POSITIONS[location.slot]];
}
export function getHouseFootprint(value: TruckLayoutState | HomeLocation = DEFAULT_HOME_LOCATION): TruckRect {
  const [u,v] = getHousePosition(value);
  return { left: u - HOME_HALF_WIDTH, top: v - HOME_HALF_DEPTH, right: u + HOME_HALF_WIDTH, bottom: v + HOME_HALF_DEPTH };
}
export function getHomeSlots(state: TruckLayoutState, floor: TruckFloor): number[] {
  if (!getFloorSlots(state, floor).length) return [];
  const d = getFloorBounds(state.deckLevel, floor);
  return HOME_POSITIONS.flatMap((_, slot) => {
    const f = getHouseFootprint({ floor, slot });
    return f.left >= d.left + HOME_RAIL_MARGIN && f.right <= d.end - HOME_RAIL_MARGIN
      && f.top >= d.back + HOME_RAIL_MARGIN && f.bottom <= d.front - HOME_RAIL_MARGIN ? [slot] : [];
  });
}
export function getFloorStairs(value: number | Pick<TruckLayoutState, 'deckLevel'>, upperFloor: 2 | 3) {
  const level = typeof value === 'number' ? value : value.deckLevel;
  // Expansion grows around built stairs rather than moving feet already on their route.
  const anchorLevel = TRUCK_FLOOR_COSTS[upperFloor].unlockLevel;
  const lowerFloor = (upperFloor - 1) as TruckFloor, d = getFloorBounds(Math.min(level, anchorLevel));
  const bottomUV: TruckPoint = [-225, d.front - 114], topUV: TruckPoint = [-180, d.front - 194];
  const lowerEntryUV: TruckPoint = [-225, d.front - 60], upperEntryUV: TruckPoint = [-180, d.front - 248];
  return { lowerFloor, upperFloor, bottomUV, topUV, lowerEntryUV, upperEntryUV,
    reserved: { left: -249, right: -158, top: d.front - 194, bottom: d.front - 114 },
    bottom: projectTruckPoint(bottomUV, lowerFloor), top: projectTruckPoint(topUV, upperFloor),
    lowerEntry: projectTruckPoint(lowerEntryUV, lowerFloor), upperEntry: projectTruckPoint(upperEntryUV, upperFloor) };
}
export function getTruckLayout(state: Pick<TruckLayoutState, 'truckLayout'>): TruckLayout {
  const layout = state.truckLayout;
  return layout ? { ...layout, home: { ...layout.home }, placements: layout.placements.map(item => ({ ...item })),
    upperBuildings: layout.upperBuildings.map(item => ({ ...item })),
    ...(layout.facilityHistory ? { facilityHistory: { ...layout.facilityHistory,
      builtTypes: [...layout.facilityHistory.builtTypes], upgradedFacilityIds: [...layout.facilityHistory.upgradedFacilityIds] } } : {}) }
    : { version: 1, floors: 1, home: { ...DEFAULT_HOME_LOCATION }, placements: [], upperBuildings: [], nextBuildingId: 17 };
}
export function cloneTruckLayoutFields(state: Pick<TruckLayoutState, 'truckLayout'>): Pick<TruckLayoutState, 'truckLayout'> {
  return state.truckLayout ? { truckLayout: getTruckLayout(state) } : {};
}
