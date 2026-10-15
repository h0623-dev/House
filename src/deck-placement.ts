import type { GameState } from './game';
import type { Building, BuildingType } from './settlement';
import { getPetPassageGeometry } from './pet-passage';
import { FARM_POSITIONS, SETTLEMENT_POSITIONS, getFloorBounds, getFloorStairs,
  getSlotFloor, getSlotLocalIndex, getTruckFloorCount, type TruckFloor, type TruckRect } from './truck-layout';

export const DECK_CELL_SIZE = 32;
export type PlacementRotation = 0 | 1;
/** x/y are the facility's centre in deck UV coordinates, not screen pixels. */
export interface FacilityPlacement { floor: TruckFloor; x: number; y: number; rotation: PlacementRotation }
export interface DeckPlacements { version: 1; facilities: (FacilityPlacement & { id: number })[] }
export type DeckPlacementState = Pick<GameState, 'deckLevel' | 'plots' | 'settlement' | 'truckLayout' | 'layoutDirections' | 'deckPlacements'>;
export interface BuildingFootprint { columns: number; rows: number; width: number; depth: number }
export interface PlacementCheck { ok: boolean; message: string }
const footprints: Record<BuildingType, readonly [number, number]> = {
  waterworks: [4, 4], kitchen: [4, 3], workshop: [4, 4], petHouse: [3, 3], greenhouse: [5, 4], watchtower: [3, 3],
};
const overlaps = (a: TruckRect, b: TruckRect) => a.left < b.right - .001 && a.right > b.left + .001
  && a.top < b.bottom - .001 && a.bottom > b.top + .001;
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const animalLandings = new Map<number, TruckRect>();
function animalLanding(level: number): TruckRect {
  const cached = animalLandings.get(level);
  if (cached) return cached;
  const { entryUV, hingeUV } = getPetPassageGeometry(level);
  const bounds = { left: hingeUV[0] - 16, right: entryUV[0] + 32,
    top: entryUV[1] - 48, bottom: entryUV[1] + 48 };
  animalLandings.set(level, bounds);
  return bounds;
}

export function getBuildingFootprint(type: BuildingType, rotation: PlacementRotation = 0): BuildingFootprint {
  const size = footprints[type], [columns, rows] = rotation === 1 ? [size[1], size[0]] : size;
  return { columns, rows, width: columns * DECK_CELL_SIZE, depth: rows * DECK_CELL_SIZE };
}
/** A fixed world grid lets neighbouring rectangular buildings share an exact edge. */
export function getDeckGridBounds(state: Pick<GameState, 'deckLevel'>, floor: TruckFloor = 1): TruckRect {
  const d = getFloorBounds(state.deckLevel, floor), size = DECK_CELL_SIZE, rail = 14;
  return { left: Math.ceil((d.left + rail) / size) * size, top: Math.ceil((d.back + rail) / size) * size,
    right: Math.floor((d.end - rail) / size) * size, bottom: Math.floor((d.front - rail) / size) * size };
}
export function getFacilityPlacement(state: DeckPlacementState, building: Building): FacilityPlacement {
  const saved = state.deckPlacements?.facilities.find(item => item.id === building.id);
  if (saved) return { floor: saved.floor, x: saved.x, y: saved.y, rotation: saved.rotation };
  const [x, y] = SETTLEMENT_POSITIONS[getSlotLocalIndex(building.slot)] ?? SETTLEMENT_POSITIONS[0];
  const rotation = state.layoutDirections?.facilities.find(item => item.id === building.id)?.direction ?? 0;
  return { floor: getSlotFloor(building.slot), x, y, rotation };
}
export function getPlacementBounds(type: BuildingType, placement: FacilityPlacement): TruckRect {
  const size = getBuildingFootprint(type, placement.rotation);
  return { left: placement.x - size.width / 2, top: placement.y - size.depth / 2,
    right: placement.x + size.width / 2, bottom: placement.y + size.depth / 2 };
}
export function getFacilityBounds(state: DeckPlacementState, building: Building): TruckRect {
  return getPlacementBounds(building.type, getFacilityPlacement(state, building));
}
export function snapFacilityPlacement(_state: Pick<GameState, 'deckLevel'>, type: BuildingType, placement: FacilityPlacement): FacilityPlacement {
  const size = getBuildingFootprint(type, placement.rotation), cell = DECK_CELL_SIZE;
  return { floor: placement.floor, rotation: placement.rotation,
    x: Math.round((placement.x - size.width / 2) / cell) * cell + size.width / 2,
    y: Math.round((placement.y - size.depth / 2) / cell) * cell + size.depth / 2 };
}
function buildingsIn(state: DeckPlacementState): Building[] {
  const overrides = new Map(state.truckLayout?.placements.map(item => [item.id, item.slot]) ?? []);
  return [...state.settlement?.buildings.map(item => ({ ...item, slot: overrides.get(item.id) ?? item.slot })) ?? [],
    ...state.truckLayout?.upperBuildings ?? []];
}
interface PlacementObstacle { bounds: TruckRect; message: string }
/** Prepare once for a search, then compare many candidate rectangles cheaply. */
function placementObstacles(state: DeckPlacementState, floor: TruckFloor, exceptId?: number): PlacementObstacle[] {
  const obstacles: PlacementObstacle[] = [];
  if (floor === 1) {
    for (const [x, y] of FARM_POSITIONS.slice(0, state.plots.length)) {
      obstacles.push({ bounds: { left: x, top: y, right: x + 96, bottom: y + 96 },
        message: '밭과 겹쳐요. 빈 데크 쪽으로 옮겨 주세요.' });
    }
  }
  for (let upper = 2; upper <= getTruckFloorCount(state); upper += 1) {
    const stairs = getFloorStairs(state, upper as 2 | 3);
    if (floor === stairs.lowerFloor || floor === stairs.upperFloor) obstacles.push({ bounds: {
      left: Math.min(stairs.reserved.left, stairs.lowerEntryUV[0] - 22, stairs.upperEntryUV[0] - 22),
      right: Math.max(stairs.reserved.right, stairs.lowerEntryUV[0] + 22, stairs.upperEntryUV[0] + 22),
      top: Math.min(stairs.reserved.top, stairs.lowerEntryUV[1] - 22, stairs.upperEntryUV[1] - 22),
      bottom: Math.max(stairs.reserved.bottom, stairs.lowerEntryUV[1] + 22, stairs.upperEntryUV[1] + 22),
    }, message: '층을 오가는 계단과 입구는 비워 주세요.' });
  }
  if (floor === 1) {
    const d = getFloorBounds(state.deckLevel);
    obstacles.push({ bounds: { left: -251, right: -197, top: d.front - 90, bottom: d.front },
      message: '사다리 앞에는 오르내릴 공간을 남겨 주세요.' });
    obstacles.push({ bounds: animalLanding(state.deckLevel), message: '동물 문과 통로 입구는 비워 주세요.' });
  }
  for (const building of buildingsIn(state)) {
    if (building.id === exceptId) continue;
    const placement = getFacilityPlacement(state, building);
    if (placement.floor === floor) obstacles.push({ bounds: getPlacementBounds(building.type, placement),
      message: '다른 시설과 겹쳐요. 빈 칸에 놓아 주세요.' });
  }
  return obstacles;
}
export function checkFacilityPlacement(state: DeckPlacementState, type: BuildingType, placement: FacilityPlacement, exceptId?: number): PlacementCheck {
  if (!footprints[type] || !placement || !Number.isInteger(placement.floor) || placement.floor < 1
    || placement.floor > getTruckFloorCount(state) || !Number.isFinite(placement.x) || !Number.isFinite(placement.y)
    || placement.rotation !== 0 && placement.rotation !== 1) return { ok: false, message: '시설을 놓을 층과 위치를 골라 주세요.' };
  const bounds = getPlacementBounds(type, placement), deck = getDeckGridBounds(state, placement.floor);
  if (bounds.left < deck.left || bounds.top < deck.top || bounds.right > deck.right || bounds.bottom > deck.bottom) {
    return { ok: false, message: '시설의 모든 칸이 난간 안쪽 데크에 들어와야 해요.' };
  }
  const blocked = placementObstacles(state, placement.floor, exceptId).find(obstacle => overlaps(bounds, obstacle.bounds));
  if (blocked) return { ok: false, message: blocked.message };
  return { ok: true, message: '이 위치에 건설할 수 있어요.' };
}
/** The next purchased bed must not silently grow through a freely placed building. */
export function isNextFarmPlotClear(state: DeckPlacementState): boolean {
  const position = FARM_POSITIONS[state.plots.length];
  if (!position) return false;
  const [x, y] = position, bed = { left: x, top: y, right: x + 96, bottom: y + 96 };
  return !buildingsIn(state).some(building => getFacilityPlacement(state, building).floor === 1
    && overlaps(bed, getFacilityBounds(state, building)));
}
export function findFreeFacilityPlacement(state: DeckPlacementState, type: BuildingType, floor: TruckFloor = 1, exceptId?: number): FacilityPlacement | null {
  if (!Number.isInteger(floor) || floor < 1 || floor > getTruckFloorCount(state)) return null;
  const deck = getDeckGridBounds(state, floor), obstacles = placementObstacles(state, floor, exceptId);
  for (const rotation of [0, 1] as const) {
    const size = getBuildingFootprint(type, rotation);
    for (let y = deck.top + size.depth / 2; y <= deck.bottom - size.depth / 2; y += DECK_CELL_SIZE) {
      for (let x = deck.left + size.width / 2; x <= deck.right - size.width / 2; x += DECK_CELL_SIZE) {
        const placement = { floor, x, y, rotation };
        const bounds = getPlacementBounds(type, placement);
        if (!obstacles.some(obstacle => overlaps(bounds, obstacle.bounds))) return placement;
      }
    }
  }
  return null;
}
export function cloneDeckPlacementFields(state: Pick<GameState, 'deckPlacements'>): Pick<GameState, 'deckPlacements'> {
  return state.deckPlacements ? { deckPlacements: { version: 1, facilities: state.deckPlacements.facilities.map(item => ({ ...item })) } } : {};
}
/** Geometry metadata is optional in old villages; it never creates or repairs paid buildings. */
export function validateDeckPlacements(value: unknown, state: DeckPlacementState): value is DeckPlacements {
  if (!isRecord(value) || Object.keys(value).length !== 2 || value.version !== 1 || !Array.isArray(value.facilities)) return false;
  const buildings = buildingsIn(state), ids = new Set<number>();
  if (value.facilities.length > buildings.length) return false;
  for (const item of value.facilities) {
    if (!isRecord(item) || Object.keys(item).length !== 5 || typeof item.id !== 'number' || !Number.isInteger(item.id) || ids.has(item.id)
      || typeof item.floor !== 'number' || !Number.isInteger(item.floor) || typeof item.x !== 'number' || !Number.isFinite(item.x)
      || typeof item.y !== 'number' || !Number.isFinite(item.y)
      || item.rotation !== 0 && item.rotation !== 1) return false;
    if (!buildings.some(building => building.id === item.id)) return false;
    ids.add(item.id);
  }
  const candidate = { ...state, deckPlacements: value as unknown as DeckPlacements };
  for (const item of (value as unknown as DeckPlacements).facilities) {
    const building = buildings.find(building => building.id === item.id)!;
    if (!checkFacilityPlacement(candidate, building.type, item, building.id).ok) return false;
    const snapped = snapFacilityPlacement(candidate, building.type, item as unknown as FacilityPlacement);
    if (Math.abs(snapped.x - Number(item.x)) > .001 || Math.abs(snapped.y - Number(item.y)) > .001) return false;
  }
  return true;
}
