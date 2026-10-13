import { CROP_IDS, CROPS, type CropId } from './crops';
import { getSeedInventory, grantQuests, type ActionResult, type GameState } from './game';
import { GAME_MINUTES_PER_SECOND, gameMinutesToSeconds } from './game-time';
import { getOutdoorSite, OUTDOOR_SITES, type OutdoorSiteId } from './outdoor-sites';
import { validateFarmEconomy } from './farm-economy';
import { validateShopProgress } from './shop';

export interface RoadsideProgress {
  version: 1;
  sites: Record<OutdoorSiteId, { visits: number; readyAt: number }>;
}
export const ROADSIDE_RULES = {
  grove: { amount: 18, energy: 10, xp: 14, cooldownSeconds: 45 },
  salvage: { amount: 9, energy: 10, xp: 12, cooldownSeconds: 30 },
  'seed-meadow': { amount: 3, energy: 8, xp: 10, cooldownSeconds: 30 },
  spring: { amount: 12, energy: 8, xp: 10, cooldownSeconds: 20 },
} as const;
const LIMIT = 100_000_000;
const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const integer = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v <= LIMIT;
export function getRoadsideProgress(state: Pick<GameState, 'roadside'>): RoadsideProgress {
  return { version: 1, sites: Object.fromEntries(OUTDOOR_SITES.map(site => [site.id,
    state.roadside ? { ...state.roadside.sites[site.id] } : { visits: 0, readyAt: 0 }])) as RoadsideProgress['sites'] };
}
export function cloneRoadsideFields(state: Pick<GameState, 'roadside'>): Pick<GameState, 'roadside'> {
  return state.roadside ? { roadside: getRoadsideProgress(state) } : {};
}
export function validateRoadsideProgress(value: unknown): value is RoadsideProgress {
  return record(value) && Object.keys(value).length === 2 && value.version === 1 && record(value.sites)
    && Object.keys(value.sites).length === OUTDOOR_SITES.length && OUTDOOR_SITES.every(site => {
      const row = (value.sites as Record<string, unknown>)[site.id];
      return record(row) && Object.keys(row).length === 2 && integer(row.visits)
        && typeof row.readyAt === 'number' && Number.isFinite(row.readyAt) && row.readyAt >= 0 && row.readyAt <= 1_440_000_000
        && (row.visits > 0 || row.readyAt === 0);
    });
}
export function getRoadsideSite(state: Pick<GameState, 'roadside' | 'totalMinutes'>, id: OutdoorSiteId) {
  const site = getOutdoorSite(id)!, rule = ROADSIDE_RULES[id], progress = getRoadsideProgress(state).sites[id];
  const remainingMinutes = Math.max(0, progress.readyAt - state.totalMinutes);
  return { site, ready: remainingMinutes === 0, remainingSeconds: gameMinutesToSeconds(remainingMinutes),
    yieldAmount: rule.amount, energyCost: rule.energy, visits: progress.visits,
    cropId: site.resource === 'seeds' ? CROP_IDS[progress.visits % CROP_IDS.length] : undefined };
}

/** Commit only after the character actually finishes walking and working on site. */
export function performRoadsideAction(state: GameState, id: unknown): ActionResult {
  const fail = (message: string): ActionResult => ({ state, ok: false, message });
  const site = getOutdoorSite(id);
  if (!site) return fail('도로에서 채집할 장소를 골라 주세요.');
  if (state.expedition) return fail('동물 탐험을 마친 뒤 도로에서 채집해 주세요.');
  if (!Number.isFinite(state.energy) || state.energy < 0 || state.energy > 100
    || !record(state.resources) || Object.keys(state.resources).length !== 5
    || !['wood','scrap','food','water','seeds'].every(key=>integer(state.resources[key as keyof typeof state.resources]))
    || !integer(state.xp) || Object.hasOwn(state, 'farmEconomy') && !validateFarmEconomy(state.farmEconomy, state)
    || Object.hasOwn(state, 'shop') && !validateShopProgress(state.shop)) return fail('보유 물자와 생활 기록을 확인해 주세요.');
  const inventory = getSeedInventory(state);
  if (Object.keys(inventory).length !== CROP_IDS.length || !CROP_IDS.every(crop => integer(inventory[crop]))
    || CROP_IDS.reduce((sum, crop) => sum + inventory[crop], 0) !== state.resources.seeds) return fail('보유 씨앗의 기록을 확인해 주세요.');
  if (Object.hasOwn(state, 'roadside') && !validateRoadsideProgress(state.roadside)) return fail('도로 채집 기록을 확인할 수 없어요.');
  const view = getRoadsideSite(state, site.id), rule = ROADSIDE_RULES[site.id];
  if (!view.ready) return fail(`${site.name}는 다시 준비 중이에요. ${view.remainingSeconds}초 뒤 다른 물자를 모아요.`);
  if (state.energy < rule.energy) return fail(`기력 ${rule.energy}이 필요해요. 기력은 1분에 3씩 자동 회복돼요.`);
  const readyAt = state.totalMinutes + rule.cooldownSeconds * GAME_MINUTES_PER_SECOND;
  const metric = site.kind === 'chop' ? 'chops' : 'gathers';
  if (!integer(state.stats[metric]) || state.stats[metric] >= LIMIT || view.visits >= LIMIT
    || !Number.isFinite(readyAt) || readyAt > 1_440_000_000 || !integer(state.xp + rule.xp)) return fail('채집 기록이나 보관량이 가득해요.');
  const next = structuredClone(state);
  next.roadside = getRoadsideProgress(state);
  next.roadside.sites[site.id] = { visits: view.visits + 1, readyAt };
  next.energy -= rule.energy;
  next.resources[site.resource] += rule.amount;
  if (site.resource === 'seeds') {
    next.seedInventory = getSeedInventory(state);
    next.seedInventory[view.cropId as CropId] += rule.amount;
  }
  next.stats[metric] += 1;
  next.xp += rule.xp;
  const name = site.resource === 'seeds' ? CROPS[view.cropId!].seedName : ({ wood: '목재', scrap: '고철', water: '물' } as const)[site.resource];
  const message = `${site.name} 채집 완료! ${name} +${rule.amount} · ${rule.cooldownSeconds}초 뒤 다시 채집해요.`;
  next.log = [`${next.day}일차 · ${message}`, ...next.log].slice(0, 30);
  grantQuests(next);
  if (!Object.values(next.resources).every(integer) || !integer(next.xp)
    || next.seedInventory && !CROP_IDS.every(crop => integer(next.seedInventory![crop]))) return fail('물자 보관량이 가득해요. 먼저 사용해 주세요.');
  return { state: next, ok: true, message };
}
