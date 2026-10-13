import type { ActionResult, GameState } from './game';
import { cloneShopFields } from './shop';
import { cloneFarmEconomyFields } from './farm-economy';
import { cloneRoadsideFields } from './roadside';

/** Two deck-aligned facing axes; crop rows turn within their existing bed. */
export type LayoutDirection = 0 | 1;
export type LayoutTarget = { kind: 'home' } | { kind: 'facility'; id: number } | { kind: 'plot'; id: number };
export interface LayoutDirectionEntry { id: number; direction: LayoutDirection }
/** Separate from legacy building records so old bundles retain the new metadata. */
export interface LayoutDirections {
  version: 1;
  home: LayoutDirection;
  facilities: LayoutDirectionEntry[];
  plots: LayoutDirectionEntry[];
}

type DirectionState = Pick<GameState, 'layoutDirections'>;
type TargetState = Pick<GameState, 'settlement' | 'truckLayout' | 'plots'>;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isDirection = (value: unknown): value is LayoutDirection => value === 0 || value === 1;
const facilityIds = (state: TargetState) => new Set([
  ...(state.settlement?.buildings.map(building => building.id) ?? []),
  ...(state.truckLayout?.upperBuildings.map(building => building.id) ?? []),
]);

/** An untouched old save keeps its original orientation without adding fields. */
export function getLayoutDirection(state: DirectionState, target: LayoutTarget): LayoutDirection {
  const directions = state.layoutDirections;
  if (!directions) return 0;
  if (target.kind === 'home') return directions.home;
  return (target.kind === 'facility' ? directions.facilities : directions.plots)
    .find(entry => entry.id === target.id)?.direction ?? 0;
}

/** Detached nested metadata for every action that already copies game state. */
export function cloneLayoutDirectionFields(state: DirectionState): DirectionState {
  const directions = state.layoutDirections;
  return directions ? { layoutDirections: {
    version: 1, home: directions.home,
    facilities: directions.facilities.map(entry => ({ ...entry })),
    plots: directions.plots.map(entry => ({ ...entry })),
  } } : {};
}

/** Present but damaged metadata rejects the save; absent metadata remains valid. */
export function validateLayoutDirections(value: unknown, state: TargetState): value is LayoutDirections {
  if (!isRecord(value) || Object.keys(value).length !== 4
    || !['version', 'home', 'facilities', 'plots'].every(key => Object.hasOwn(value, key))
    || value.version !== 1 || !isDirection(value.home)) return false;
  const validateEntries = (entries: unknown, ids: Set<number>): entries is LayoutDirectionEntry[] => {
    if (!Array.isArray(entries) || entries.length > ids.size) return false;
    const seen = new Set<number>();
    for (const entry of entries) {
      if (!isRecord(entry) || Object.keys(entry).length !== 2
        || !Object.hasOwn(entry, 'id') || !Object.hasOwn(entry, 'direction')
        || typeof entry.id !== 'number' || !Number.isInteger(entry.id)
        || !ids.has(entry.id) || seen.has(entry.id) || !isDirection(entry.direction)) return false;
      seen.add(entry.id);
    }
    return true;
  };
  return validateEntries(value.facilities, facilityIds(state))
    && validateEntries(value.plots, new Set(state.plots.map(plot => plot.id)));
}

/** A free, instantaneous visual edit that leaves paid layout and simulation intact. */
export function rotateLayoutTarget(state: GameState, target: LayoutTarget): ActionResult {
  const fail = (message: string): ActionResult => ({ state, ok: false, message });
  if (state.expedition) return fail('탐험을 마치고 트럭에서 방향을 바꿔 주세요.');
  if (Object.hasOwn(state, 'layoutDirections') && !validateLayoutDirections(state.layoutDirections, state)) {
    return fail('건물과 밭의 방향 정보를 확인할 수 없어요. 저장 상태를 확인해 주세요.');
  }
  if (!isRecord(target) || target.kind !== 'home' && target.kind !== 'facility' && target.kind !== 'plot'
    || target.kind !== 'home' && (typeof target.id !== 'number' || !Number.isInteger(target.id)
      || !(target.kind === 'facility' ? facilityIds(state) : new Set(state.plots.map(plot => plot.id))).has(target.id))) {
    return fail('방향을 바꿀 집, 시설 또는 밭을 선택해 주세요.');
  }
  const directions: LayoutDirections = cloneLayoutDirectionFields(state).layoutDirections
    ?? { version: 1, home: 0, facilities: [], plots: [] };
  const direction: LayoutDirection = getLayoutDirection(state, target) === 0 ? 1 : 0;
  if (target.kind === 'home') directions.home = direction;
  else {
    const entries = target.kind === 'facility' ? directions.facilities : directions.plots;
    const entry = entries.find(item => item.id === target.id);
    if (entry) entry.direction = direction;
    else entries.push({ id: target.id, direction });
  }
  const label = target.kind === 'home' ? '우리집' : target.kind === 'facility' ? '시설' : '밭고랑';
  return { state: { ...state, ...cloneShopFields(state), ...cloneFarmEconomyFields(state), ...cloneRoadsideFields(state), layoutDirections: directions }, ok: true, message: `${label}의 방향을 바꿨어요.` };
}
