import { CROP_IDS, CROPS, type CropId } from './crops';
import { getSeedInventory, grantQuests, questList, type ActionResult, type GameState } from './game';
import { GAME_MINUTES_PER_SECOND } from './game-time';
import { GROUND_RESOURCE_NODES, getGroundResourceNode, getGroundResourceZone, type GroundResourceId } from './ground-resources';
import { ROADSIDE_RULES, validateRoadsideProgress } from './roadside';
import { validateFarmEconomy } from './farm-economy';
import { validateShopProgress } from './shop';

export interface GatheringProgress {
  version: 1;
  nodes: Record<GroundResourceId, { visits: number; readyAtMs: number }>;
}
export interface GatheringFields { gathering?: GatheringProgress }

/** 마을 시간과 별도로, 채집한 자원은 실제 3분 뒤 다시 자라요. */
export const GATHERING_REGENERATION_MS = 180_000;
const LIMIT = 100_000_000;
const MAX_DEVICE_TIME = 100_000_000_000_000;
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const integer = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= LIMIT;
const deviceTime = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= MAX_DEVICE_TIME;
const seedNodeIds = GROUND_RESOURCE_NODES.filter(node => node.resource === 'seeds').map(node => node.id);
type LegacyGatheringState = GatheringFields & Pick<GameState, 'roadside' | 'totalMinutes' | 'lastSaved'>;

/** 조회는 보상이나 저장 기록을 만들지 않고, 반환한 각 기록도 원본과 분리해요. */
export function getGatheringProgress(state: GatheringFields): GatheringProgress {
  return { version: 1, nodes: Object.fromEntries(GROUND_RESOURCE_NODES.map(node => [node.id,
    state.gathering ? { ...state.gathering.nodes[node.id] } : { visits: 0, readyAtMs: 0 }])) as GatheringProgress['nodes'] };
}

export function cloneGatheringFields(state: GatheringFields): GatheringFields {
  return state.gathering ? { gathering: getGatheringProgress(state) } : {};
}

export function validateGatheringProgress(value: unknown): value is GatheringProgress {
  return record(value) && Object.keys(value).length === 2 && Object.hasOwn(value, 'version') && Object.hasOwn(value, 'nodes')
    && value.version === 1 && record(value.nodes)
    && Object.keys(value.nodes).length === GROUND_RESOURCE_NODES.length && GROUND_RESOURCE_NODES.every(node => {
      const row = (value.nodes as Record<string, unknown>)[node.id];
      return record(row) && Object.keys(row).length === 2 && Object.hasOwn(row, 'visits') && Object.hasOwn(row, 'readyAtMs')
        && integer(row.visits) && deviceTime(row.readyAtMs)
        && (row.visits > 0 || row.readyAtMs === 0);
    });
}

/**
 * 이전 장소의 횟수와 남은 대기만 대표 자원 하나로 옮겨요. 물자나 보상을
 * 지급하지 않고 roadside 기록도 그대로 두며, 새 자원들은 처음부터 준비돼요.
 * 로드할 때 한 번 저장 구조에 넣어야 오프라인 동안의 실제 시간도 이어져요.
 */
export function migrateLegacyGatheringFields(state: LegacyGatheringState, now = Date.now()): GatheringFields {
  if (Object.hasOwn(state, 'gathering') || !state.roadside || !validateRoadsideProgress(state.roadside)
    || !deviceTime(now) || !deviceTime(state.lastSaved) || !Number.isFinite(state.totalMinutes)
    || state.totalMinutes < 0 || state.totalMinutes > 1_440_000_000) return {};
  const progress = getGatheringProgress({});
  const baseline = state.lastSaved > 0 ? state.lastSaved : now;
  for (const node of GROUND_RESOURCE_NODES) {
    if (!node.legacySiteId) continue;
    const previous = state.roadside.sites[node.legacySiteId];
    const remainingMs = Math.max(0, previous.readyAt - state.totalMinutes) / GAME_MINUTES_PER_SECOND * 1000;
    progress.nodes[node.id] = { visits: previous.visits, readyAtMs: remainingMs > 0 ? Math.ceil(baseline + remainingMs) : 0 };
  }
  return validateGatheringProgress(progress) ? { gathering: progress } : {};
}

export function getGatheringNode(state: LegacyGatheringState, id: unknown, now = Date.now()) {
  const node = getGroundResourceNode(id);
  if (!node) return undefined;
  const source = state.gathering ? state : migrateLegacyGatheringFields(state, now);
  const progress = source.gathering?.nodes[node.id] ?? { visits: 0, readyAtMs: 0 };
  const rule = ROADSIDE_RULES[node.siteId];
  const remainingMs = deviceTime(now) && (!state.roadside || source.gathering)
    ? Math.max(0, progress.readyAtMs - now) : GATHERING_REGENERATION_MS;
  return { node, ready: remainingMs === 0, remainingSeconds: Math.ceil(remainingMs / 1000),
    yieldAmount: rule.amount, energyCost: rule.energy, visits: progress.visits,
    cropId: node.resource === 'seeds' ? CROP_IDS[(progress.visits + seedNodeIds.indexOf(node.id)) % CROP_IDS.length] : undefined };
}

/** 같은 실제 시각으로 구역을 읽고, 준비된 자원이나 가장 먼저 재생될 자원을 안내해요. */
export function getGatheringArea(state: LegacyGatheringState, id: unknown, now = Date.now()) {
  const zone = getGroundResourceZone(id);
  if (!zone) return undefined;
  const prepared = state.gathering ? state : { ...state, ...migrateLegacyGatheringFields(state, now) };
  const views = GROUND_RESOURCE_NODES.filter(node => node.siteId === zone.id).map(node => getGatheringNode(prepared, node.id, now)!);
  const ready = views.filter(view => view.ready);
  const next = ready[0] ?? [...views].sort((a, b) =>
    (prepared.gathering?.nodes[a.node.id].readyAtMs ?? 0) - (prepared.gathering?.nodes[b.node.id].readyAtMs ?? 0))[0];
  return { zone, views, ready, next, readyCount: ready.length, totalCount: views.length,
    remainingSeconds: ready.length ? 0 : next.remainingSeconds };
}

/** 캐릭터가 해당 자원에 도착해 일을 마쳤을 때만, 보상과 재생 시간을 함께 확정해요. */
export function performGatheringAction(state: GameState, id: unknown, now = Date.now()): ActionResult {
  const fail = (message: string): ActionResult => ({ state, ok: false, message });
  const node = getGroundResourceNode(id);
  if (!node) return fail('땅 위에서 채집할 자원을 골라 주세요.');
  if (state.expedition) return fail('동물 탐험을 마친 뒤 주변 자원을 채집해 주세요.');
  if (!deviceTime(now) || !deviceTime(now + GATHERING_REGENERATION_MS)) return fail('자원이 다시 자라는 시간을 확인할 수 없어요.');
  const fields = state as GameState & GatheringFields;
  if (!Number.isFinite(state.energy) || state.energy < 0 || state.energy > 100
    || !record(state.resources) || Object.keys(state.resources).length !== 5
    || !['wood', 'scrap', 'food', 'water', 'seeds'].every(key => integer(state.resources[key as keyof typeof state.resources]))
    || !integer(state.xp) || !record(state.stats)
    || !['harvests', 'gathers', 'hunts', 'expansions', 'chops', 'battlesWon', 'defeatedEnemies'].every(key => integer(state.stats[key as keyof typeof state.stats]))
    || !['plantings', 'waterings'].every(key => !Object.hasOwn(state.stats, key) || integer(state.stats[key as keyof typeof state.stats]))
    || !Array.isArray(state.quests) || state.quests.length > 3 || new Set(state.quests).size !== state.quests.length
    || !state.quests.every(id => questList(state).some(quest => quest.id === id && quest.complete))
    || !Array.isArray(state.log) || state.log.length > 30
    || !state.log.every(entry => typeof entry === 'string' && entry.length > 0 && entry.length <= 400)
    || Object.hasOwn(state, 'farmEconomy') && !validateFarmEconomy(state.farmEconomy, state)
    || Object.hasOwn(state, 'shop') && !validateShopProgress(state.shop)) return fail('보유 물자와 생활 기록을 확인해 주세요.');
  if (Object.hasOwn(state, 'seedInventory') && !record(state.seedInventory)) return fail('보유 씨앗의 기록을 확인해 주세요.');
  const inventory = getSeedInventory(state);
  if (Object.keys(inventory).length !== CROP_IDS.length || !CROP_IDS.every(crop => integer(inventory[crop]))
    || CROP_IDS.reduce((sum, crop) => sum + inventory[crop], 0) !== state.resources.seeds) return fail('보유 씨앗의 기록을 확인해 주세요.');
  if (Object.hasOwn(state, 'roadside') && !validateRoadsideProgress(state.roadside)
    || Object.hasOwn(fields, 'gathering') && !validateGatheringProgress(fields.gathering)) return fail('주변 자원의 채집 기록을 확인할 수 없어요.');
  const prepared = fields.gathering ? fields : migrateLegacyGatheringFields(fields, now);
  if (state.roadside && !prepared.gathering) return fail('이전 채집 기록의 시간을 확인할 수 없어요.');
  const view = getGatheringNode(fields, node.id, now)!;
  const rule = ROADSIDE_RULES[node.siteId];
  if (!view.ready) return fail(`${node.name}은 다시 준비 중이에요. ${view.remainingSeconds}초 뒤 채집할 수 있어요.`);
  if (state.energy < rule.energy) return fail(`기력 ${rule.energy}이 필요해요. 기력은 1분에 3씩 자동 회복돼요.`);
  const metric = node.resource === 'wood' ? 'chops' : 'gathers';
  if (state.stats[metric] >= LIMIT || view.visits >= LIMIT || !integer(state.xp + rule.xp)) return fail('채집 기록이나 보관량이 가득해요.');
  const next = structuredClone(state) as GameState & GatheringFields;
  next.gathering = getGatheringProgress(prepared);
  next.gathering.nodes[node.id] = { visits: view.visits + 1, readyAtMs: now + GATHERING_REGENERATION_MS };
  next.energy -= rule.energy;
  next.resources[node.resource] += rule.amount;
  if (node.resource === 'seeds') {
    next.seedInventory = inventory;
    next.seedInventory[view.cropId as CropId] += rule.amount;
  }
  next.stats[metric] += 1;
  next.xp += rule.xp;
  const name = node.resource === 'seeds' ? CROPS[view.cropId!].seedName : ({ wood: '목재', scrap: '고철', water: '물' } as const)[node.resource];
  const message = `${node.name} 채집 완료! ${name} +${rule.amount} · 180초 뒤 다시 채집해요.`;
  next.log = [`${next.day}일차 · ${message}`, ...next.log].slice(0, 30);
  grantQuests(next);
  if (!Object.values(next.resources).every(integer) || !integer(next.xp)
    || next.seedInventory && !CROP_IDS.every(crop => integer(next.seedInventory![crop]))) return fail('물자 보관량이 가득해요. 먼저 사용해 주세요.');
  return { state: next, ok: true, message };
}
