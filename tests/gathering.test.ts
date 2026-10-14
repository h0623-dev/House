import test from 'node:test';
import assert from 'node:assert/strict';
import { applyOfflineProgress, createGame, getSeedInventory, loadGame, performAction, SAVE_KEY, saveGame, tick, type ActionResult, type GameState, type SaveStorage } from '../src/game.ts';
import { CROP_IDS } from '../src/crops.ts';
import { GAME_MINUTES_PER_SECOND } from '../src/game-time.ts';
import { GROUND_RESOURCE_NODES, type GroundResourceId } from '../src/ground-resources.ts';
import { getRoadsideProgress, performRoadsideAction, ROADSIDE_RULES } from '../src/roadside.ts';
import { cloneGatheringFields, GATHERING_REGENERATION_MS, getGatheringArea, getGatheringNode, getGatheringProgress, migrateLegacyGatheringFields, performGatheringAction, validateGatheringProgress, type GatheringFields } from '../src/gathering.ts';

const NOW = 1_800_000_000_000;
const PRIMARY_IDS = ['tree-01', 'scrap-01', 'seed-01', 'water-01'] as const;
function storage(): SaveStorage {
  const values = new Map<string, string>();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); } };
}
function success(result: ActionResult): GameState & GatheringFields {
  assert.equal(result.ok, true, result.message);
  return result.state;
}
function refused(state: GameState, id: unknown, now = NOW): void {
  const before = structuredClone(state), result = performGatheringAction(state, id, now);
  assert.equal(result.ok, false, result.message); assert.equal(result.state, state); assert.deepEqual(state, before);
}
function reload(state: GameState): GameState & GatheringFields {
  const memory = storage(); assert.equal(saveGame(state, memory), true);
  const loaded = loadGame(memory); assert.ok(loaded); return loaded;
}

test('old villages and read-only node queries receive no materials, visits, cooldowns, or saved fields', () => {
  const state = createGame(), before = structuredClone(state), memory = storage();
  memory.setItem(SAVE_KEY, JSON.stringify(state)); const loaded = loadGame(memory)!;
  assert.deepEqual(loaded, before); assert.equal(Object.hasOwn(loaded, 'gathering'), false);
  for (const node of GROUND_RESOURCE_NODES) {
    const view = getGatheringNode(loaded, node.id, NOW)!;
    assert.equal(view.ready, true); assert.equal(view.remainingSeconds, 0); assert.equal(view.visits, 0);
    assert.equal(view.yieldAmount, ROADSIDE_RULES[node.siteId].amount); assert.equal(view.energyCost, ROADSIDE_RULES[node.siteId].energy);
  }
  const progress = getGatheringProgress({}); progress.nodes['tree-01'].visits = 99;
  assert.deepEqual(cloneGatheringFields({}), {}); assert.deepEqual(migrateLegacyGatheringFields(state, NOW), {});
  assert.deepEqual(state, before); assert.deepEqual(loaded, before);
});

for (const id of PRIMARY_IDS) {
  test(`${id} grants its existing exact reward once and regenerates at exactly 180 real seconds`, () => {
    const state = createGame(), before = structuredClone(state), view = getGatheringNode(state, id, NOW)!, node = view.node;
    const rule = ROADSIDE_RULES[node.siteId], metric = node.resource === 'wood' ? 'chops' : 'gathers';
    const next = success(performGatheringAction(state, id, NOW));
    assert.deepEqual(state, before); assert.deepEqual(next.resources, { ...state.resources, [node.resource]: state.resources[node.resource] + rule.amount });
    assert.equal(next.energy, state.energy - rule.energy); assert.equal(next.xp, state.xp + rule.xp);
    assert.equal(next.stats[metric], 1); assert.equal(next.totalMinutes, state.totalMinutes);
    assert.equal(next.day, state.day); assert.equal(next.minutes, state.minutes);
    assert.deepEqual(next.gathering!.nodes[id], { visits: 1, readyAtMs: NOW + 180_000 });
    assert.equal(Object.hasOwn(next, 'roadside'), false);
    if (node.resource === 'seeds') assert.deepEqual(getSeedInventory(next), { ...getSeedInventory(state), carrot: getSeedInventory(state).carrot + rule.amount });
    else assert.deepEqual(getSeedInventory(next), getSeedInventory(state));
    refused(next, id, NOW); refused(next, id, NOW + 179_999);
    assert.equal(getGatheringNode(next, id, NOW + 179_999)!.remainingSeconds, 1);
    assert.equal(getGatheringNode(next, id, NOW + 180_000)!.ready, true);
    const second = success(performGatheringAction(next, id, NOW + 180_000));
    assert.equal(second.gathering!.nodes[id].visits, 2);
    assert.equal(second.gathering!.nodes[id].readyAtMs, NOW + 360_000);
    refused(second, id, NOW + 180_000);
  });
}

test('every node stays independent, including trees and deposits of the same resource', () => {
  let state = success(performGatheringAction(createGame(), 'tree-01', NOW));
  for (const node of GROUND_RESOURCE_NODES.filter(item => item.id !== 'tree-01')) {
    const view = getGatheringNode(state, node.id, NOW)!;
    assert.equal(view.ready, true); assert.equal(view.visits, 0); assert.equal(view.remainingSeconds, 0);
  }
  state = success(performGatheringAction(state, 'tree-02', NOW + 1_000));
  assert.equal(getGatheringNode(state, 'tree-01', NOW + 180_000)!.ready, true);
  assert.equal(getGatheringNode(state, 'tree-02', NOW + 180_000)!.ready, false);
  assert.equal(getGatheringNode(state, 'tree-02', NOW + 180_000)!.remainingSeconds, 1);
  assert.equal(getGatheringNode(state, 'tree-03', NOW + 180_000)!.ready, true);
  assert.equal(getGatheringNode(state, 'tree-02', NOW + 181_000)!.ready, true);
});

test('faster game ticks, pause, offline advancement, and save reload cannot shorten a real resource timer', () => {
  const paid = success(performGatheringAction(createGame(), 'scrap-01', NOW)), original = structuredClone(paid);
  assert.equal(GATHERING_REGENERATION_MS, 180_000);
  const fast = tick(paid, 180);
  assert.equal(fast.totalMinutes, paid.totalMinutes + 180 * GAME_MINUTES_PER_SECOND);
  assert.deepEqual(fast.gathering, paid.gathering); refused(fast, 'scrap-01', NOW + 90_000);
  paid.lastSaved = NOW; const resumed = applyOfflineProgress(paid, NOW + 179_999).state;
  refused(resumed, 'scrap-01', NOW + 179_999);
  const loaded = reload(resumed); assert.deepEqual(loaded.gathering, paid.gathering);
  refused(loaded, 'scrap-01', NOW + 179_999);
  assert.equal(getGatheringNode(loaded, 'scrap-01', NOW + 180_000)!.ready, true);
  assert.equal(getGatheringNode(original, 'scrap-01', NOW + 180_000)!.ready, true, 'a paused village needs no game tick to regenerate');
  assert.equal(success(performGatheringAction(loaded, 'scrap-01', NOW + 180_000)).gathering!.nodes['scrap-01'].visits, 2);
});

test('legacy site migration preserves its visits, seed rotation, remaining cooldown, resources, stats, and sidecar exactly', () => {
  let old = createGame();
  for (const id of ['grove', 'salvage', 'seed-meadow', 'spring'] as const) old = success(performRoadsideAction(old, id));
  old = tick(old, 5.25); old.lastSaved = NOW;
  const before = structuredClone(old), fields = migrateLegacyGatheringFields(old, NOW + 2_000);
  assert.ok(fields.gathering); assert.deepEqual(old, before);
  const migrated = { ...old, ...fields };
  assert.deepEqual(migrated.resources, before.resources); assert.deepEqual(migrated.stats, before.stats);
  assert.deepEqual(migrated.roadside, before.roadside); assert.deepEqual(getSeedInventory(migrated), getSeedInventory(before));
  for (const id of PRIMARY_IDS) {
    const node = getGatheringNode(migrated, id, NOW)!.node;
    assert.deepEqual(migrated.gathering!.nodes[id], { visits: 1, readyAtMs: NOW + (ROADSIDE_RULES[node.siteId].cooldownSeconds - 5.25) * 1000 });
    refused(migrated, id, migrated.gathering!.nodes[id].readyAtMs - 1);
    assert.equal(getGatheringNode(migrated, id, migrated.gathering!.nodes[id].readyAtMs)!.ready, true);
  }
  assert.equal(getGatheringNode(migrated, 'seed-01', NOW)!.cropId, 'potato');
  assert.equal(getGatheringNode(migrated, 'seed-02', NOW)!.cropId, 'potato');
  assert.equal(getGatheringNode(migrated, 'tree-02', NOW)!.ready, true);
  const at = migrated.gathering!.nodes['seed-01'].readyAtMs;
  const next = success(performGatheringAction(migrated, 'seed-01', at));
  assert.equal(next.seedInventory!.potato, migrated.seedInventory!.potato + 3);
  assert.equal(next.gathering!.nodes['seed-01'].readyAtMs, at + 180_000);
  assert.deepEqual(next.roadside, before.roadside);
  const memory = storage(); memory.setItem(SAVE_KEY, JSON.stringify(old));
  const loaded = loadGame(memory)! as GameState & GatheringFields;
  assert.deepEqual(loaded, old, 'load stays a pure roundtrip; startup applies migration before offline advancement');
  const prepared = { ...loaded, ...migrateLegacyGatheringFields(loaded, NOW + 99_000) };
  assert.deepEqual(prepared.gathering, fields.gathering); assert.deepEqual(prepared.roadside, old.roadside);
  assert.deepEqual(migrateLegacyGatheringFields(prepared, NOW + 199_000), {}, 'resuming never restarts an established timer');
});

test('legacy cooldown migration uses a new baseline only when the save has no wall time', () => {
  const old = success(performRoadsideAction(createGame(), 'grove')), before = structuredClone(old);
  const fields = migrateLegacyGatheringFields(old, NOW), migrated = { ...old, ...fields };
  assert.equal(fields.gathering!.nodes['tree-01'].readyAtMs, NOW + 45_000);
  refused(migrated, 'tree-01', NOW + 44_999);
  assert.equal(getGatheringNode(migrated, 'tree-01', NOW + 45_000)!.ready, true);
  assert.deepEqual(old, before);
});

test('individual seed nodes rotate their own real varieties and keep exact aggregate inventory through reload', () => {
  let state = createGame() as GameState & GatheringFields;
  const original = getSeedInventory(state), total = state.resources.seeds;
  for (let visit = 0; visit < 7; visit += 1) {
    const at = NOW + visit * 180_000, crop = CROP_IDS[visit % CROP_IDS.length], inventory = getSeedInventory(state);
    assert.equal(getGatheringNode(state, 'seed-01', at)!.cropId, crop);
    assert.equal(getGatheringNode(state, 'seed-02', at)!.cropId, 'potato');
    state = success(performGatheringAction(state, 'seed-01', at));
    for (const id of CROP_IDS) assert.equal(getSeedInventory(state)[id], inventory[id] + (id === crop ? 3 : 0));
    assert.equal(state.resources.seeds, total + (visit + 1) * 3);
    assert.equal(CROP_IDS.reduce((sum, id) => sum + getSeedInventory(state)[id], 0), state.resources.seeds);
    state = reload(state);
  }
  assert.equal(state.gathering!.nodes['seed-01'].visits, 7);
  assert.equal(state.gathering!.nodes['seed-02'].visits, 0);
  assert.deepEqual(getSeedInventory(state), { carrot: original.carrot + 6, potato: original.potato + 3, tomato: original.tomato + 3,
    corn: original.corn + 3, strawberry: original.strawberry + 3, pumpkin: original.pumpkin + 3 });
});

test('fresh seed nodes show four different varieties and each commit grants the displayed crop', () => {
  let state = createGame(); const before = getSeedInventory(state);
  for (const [index, id] of ['seed-01', 'seed-02', 'seed-03', 'seed-04'].entries()) {
    const crop = CROP_IDS[index], stock = getSeedInventory(state);
    assert.equal(getGatheringNode(state, id, NOW)!.cropId, crop);
    state = success(performGatheringAction(state, id, NOW));
    for (const other of CROP_IDS) assert.equal(getSeedInventory(state)[other], stock[other] + (other === crop ? 3 : 0));
  }
  for (let index = 0; index < CROP_IDS.length; index += 1) {
    assert.equal(getSeedInventory(state)[CROP_IDS[index]], before[CROP_IDS[index]] + (index < 4 ? 3 : 0));
  }
});

test('three individual gathers retain the existing quest reward exactly once', () => {
  let state = createGame(); const before = structuredClone(state);
  for (const id of ['scrap-01', 'seed-01', 'water-01'] as const) state = success(performGatheringAction(state, id, NOW));
  assert.equal(state.stats.gathers, 3); assert.equal(state.quests.filter(id => id === 'road-scout').length, 1);
  assert.equal(state.resources.wood, before.resources.wood + 12); assert.equal(state.resources.scrap, before.resources.scrap + 9 + 6);
  assert.equal(state.resources.water, before.resources.water + 12); assert.equal(state.resources.seeds, before.resources.seeds + 3);
  assert.equal(state.xp, 32); assert.equal(state.totalMinutes, before.totalMinutes);
  const earned = structuredClone(state); state = success(performGatheringAction(state, 'scrap-02', NOW));
  assert.equal(state.resources.wood, earned.resources.wood); assert.equal(state.resources.scrap, earned.resources.scrap + 9);
  assert.equal(state.quests.filter(id => id === 'road-scout').length, 1);
  assert.equal(state.log.filter(entry => entry.includes('목표 달성! 도로 위의 보물찾기')).length, 1);
});

test('existing action copies and returned node progress deeply detach the original state', () => {
  const state = success(performGatheringAction(createGame(), 'tree-01', NOW)), before = structuredClone(state);
  const copies = [tick(state, 1), success(performAction(state, 'harvest', 1, undefined, { advanceClock: false }))] as (GameState & GatheringFields)[];
  for (const next of copies) {
    assert.deepEqual(next.gathering, state.gathering); assert.notEqual(next.gathering, state.gathering);
    assert.notEqual(next.gathering!.nodes['tree-01'], state.gathering!.nodes['tree-01']);
    next.gathering!.nodes['tree-01'].visits = 99; assert.deepEqual(state, before);
  }
  const fields = cloneGatheringFields(state), progress = getGatheringProgress(state);
  fields.gathering!.nodes['tree-01'].visits = 98; progress.nodes['tree-01'].visits = 97;
  const next = success(performGatheringAction(state, 'scrap-01', NOW));
  next.resources.wood = 99; next.seedInventory!.carrot = 99; next.companions!.dog.health = 1;
  next.gathering!.nodes['tree-01'].visits = 96; assert.deepEqual(state, before);
});

test('unknown nodes, insufficient energy, expeditions, invalid device times, and wall clock rollback refuse atomically', () => {
  const state = createGame();
  for (const id of ['grove', '__proto__', 'constructor', 'tree-00', 'tree-17', '', null, 1, {}, ['tree-01']]) refused(state, id);
  for (const at of [-1, NaN, Infinity, NOW + 0.5, 100_000_000_000_000 - 179_999, 100_000_000_000_001]) refused(state, 'tree-01', at);
  const tired = createGame(); tired.energy = 9; refused(tired, 'tree-01');
  const away = createGame(); away.expedition = { id: 1, stage: 1 }; refused(away, 'tree-01');
  const paid = success(performGatheringAction(state, 'tree-01', NOW)); refused(paid, 'tree-01', NOW - 1);
  assert.equal(getGatheringNode(paid, 'tree-01', NOW - 1)!.remainingSeconds, 181);
});

test('malformed node rows and schema changes are rejected by actions and save loading', () => {
  const base = success(performGatheringAction(createGame(), 'tree-01', NOW));
  const corruptions = [
    (next: GameState & GatheringFields) => { next.gathering!.version = 2 as 1; },
    (next: GameState & GatheringFields) => { (next.gathering as unknown as Record<string, unknown>).rewards = 99; },
    (next: GameState & GatheringFields) => { (next.gathering!.nodes as Record<string, unknown>).mine = { visits: 0, readyAtMs: 0 }; },
    (next: GameState & GatheringFields) => { delete (next.gathering!.nodes as Partial<Record<GroundResourceId, unknown>>)['tree-02']; },
    (next: GameState & GatheringFields) => { next.gathering!.nodes['tree-01'].visits = 0.5; },
    (next: GameState & GatheringFields) => { next.gathering!.nodes['tree-01'].visits = -1; },
    (next: GameState & GatheringFields) => { next.gathering!.nodes['tree-01'].visits = 100_000_001; },
    (next: GameState & GatheringFields) => { next.gathering!.nodes['tree-01'].readyAtMs = -1; },
    (next: GameState & GatheringFields) => { next.gathering!.nodes['tree-01'].readyAtMs = Infinity; },
    (next: GameState & GatheringFields) => { next.gathering!.nodes['tree-01'].readyAtMs = NOW + 0.5; },
    (next: GameState & GatheringFields) => { next.gathering!.nodes['tree-01'].readyAtMs = 100_000_000_000_001; },
    (next: GameState & GatheringFields) => { next.gathering!.nodes['tree-01'].visits = 0; },
    (next: GameState & GatheringFields) => { (next.gathering!.nodes['tree-01'] as Record<string, unknown>).bonus = 99; },
  ];
  for (const corrupt of corruptions) {
    const state = structuredClone(base); corrupt(state);
    assert.equal(validateGatheringProgress(state.gathering), false); refused(state, 'tree-02');
    assert.equal(saveGame(state, storage()), false); const memory = storage(); memory.setItem(SAVE_KEY, JSON.stringify(state));
    assert.equal(loadGame(memory), null);
  }
  assert.deepEqual(reload(base).gathering, base.gathering);
});

test('material, seed, XP, statistic, and visit caps roll back all rewards and timers', () => {
  for (const id of PRIMARY_IDS) {
    const node = getGatheringNode(createGame(), id, NOW)!.node;
    const full = createGame(); full.resources[node.resource] = 100_000_000;
    if (node.resource === 'seeds') full.seedInventory = { carrot: 100_000_000, potato: 0, tomato: 0, corn: 0, strawberry: 0, pumpkin: 0 };
    refused(full, id);
    const xp = createGame(); xp.xp = 100_000_000; refused(xp, id);
    const stats = createGame(); stats.stats[node.resource === 'wood' ? 'chops' : 'gathers'] = 100_000_000; refused(stats, id);
    const visits = createGame() as GameState & GatheringFields; visits.gathering = getGatheringProgress({}); visits.gathering.nodes[id].visits = 100_000_000;
    refused(visits, id);
  }
  const seeds = createGame(); seeds.seedInventory!.corn += 1; refused(seeds, 'tree-01');
  const badStats = createGame(); badStats.stats.gathers = 0.5; refused(badStats, 'tree-01');
  const badResource = createGame(); badResource.resources.scrap = NaN; refused(badResource, 'tree-01');
});

test('an overflowing legacy quest reward leaves the third node available and grants no partial reward', () => {
  let state = success(performGatheringAction(createGame(), 'scrap-01', NOW));
  state = success(performGatheringAction(state, 'seed-01', NOW)); state.resources.wood = 100_000_000 - 11;
  refused(state, 'water-01'); assert.equal(state.stats.gathers, 2); assert.equal(state.quests.includes('road-scout'), false);
  assert.equal(getGatheringNode(state, 'water-01', NOW)!.ready, true);
  assert.deepEqual(state.gathering!.nodes['water-01'], { visits: 0, readyAtMs: 0 });
});

test('corrupt legacy roadside counters cannot be hidden by a fresh gathering record or converted into rewards', () => {
  const state = createGame() as GameState & GatheringFields; state.roadside = getRoadsideProgress(state);
  state.roadside.sites.grove.visits = -1; state.gathering = getGatheringProgress({});
  assert.deepEqual(migrateLegacyGatheringFields(state, NOW), {}); refused(state, 'tree-01');
  delete state.gathering; refused(state, 'tree-02');
});

test('unrepresentable legacy wall deadlines and damaged clock baselines fail without resetting a cooldown', () => {
  const old = success(performRoadsideAction(createGame(), 'grove'));
  for (const baseline of [NaN, -1, 100_000_000_000_000]) {
    const state = structuredClone(old); state.lastSaved = baseline;
    assert.deepEqual(migrateLegacyGatheringFields(state, NOW), {}); refused(state, 'tree-01');
    assert.equal(getGatheringNode(state, 'tree-01', NOW)!.ready, false);
  }
});

test('malformed optional counters and unearned or repeated claimed quests cannot receive gathering rewards', () => {
  for (const key of ['plantings', 'waterings'] as const) {
    for (const value of [-1, 0.5, NaN, 100_000_001]) {
      const state = createGame(); state.stats[key] = value; refused(state, 'tree-01');
    }
  }
  const unknown = createGame(); unknown.quests = ['forest']; refused(unknown, 'tree-01');
  const unearned = createGame(); unearned.quests = ['road-scout']; refused(unearned, 'tree-01');
  const repeated = createGame(); repeated.stats.gathers = 3; repeated.quests = ['road-scout', 'road-scout']; refused(repeated, 'tree-01');
  const badLog = createGame(); badLog.log = [null as unknown as string]; refused(badLog, 'tree-01');
  const longLog = createGame(); longLog.log = ['가'.repeat(401)]; refused(longLog, 'tree-01');
});

test('production defaults use the real device wall clock without replacing Date.now', () => {
  const before = Date.now(), state = success(performGatheringAction(createGame(), 'tree-01')), after = Date.now();
  const deadline = state.gathering!.nodes['tree-01'].readyAtMs;
  assert.ok(deadline >= before + 180_000 && deadline <= after + 180_000);
  const view = getGatheringNode(state, 'tree-01')!;
  assert.equal(view.ready, false); assert.ok(view.remainingSeconds > 0 && view.remainingSeconds <= 180);
  const original = structuredClone(state), second = performGatheringAction(state, 'tree-01');
  assert.equal(second.ok, false); assert.equal(second.state, state); assert.deepEqual(state, original);
});

test('area views select another ready resource, then the exact earliest depleted node without granting or resetting progress', () => {
  let state = createGame(); const untouched = structuredClone(state);
  for (const [id, count] of [['grove', 16], ['salvage', 4], ['seed-meadow', 4], ['spring', 4]] as const) {
    const area = getGatheringArea(state, id, NOW)!;
    assert.equal(area.totalCount, count); assert.equal(area.readyCount, count); assert.equal(area.remainingSeconds, 0);
  }
  assert.equal(getGatheringArea(state, '__proto__', NOW), undefined); assert.deepEqual(state, untouched);
  state = success(performGatheringAction(state, 'water-01', NOW + 999));
  assert.equal(getGatheringArea(state, 'spring', NOW + 999)!.next.node.id, 'water-02');
  state = success(performGatheringAction(state, 'water-02', NOW + 1));
  state = success(performGatheringAction(state, 'water-03', NOW + 500));
  state = success(performGatheringAction(state, 'water-04', NOW + 750));
  const before = structuredClone(state), area = getGatheringArea(state, 'spring', NOW + 179_000)!;
  assert.equal(area.readyCount, 0); assert.equal(area.ready.length, 0); assert.equal(area.remainingSeconds, 2);
  assert.equal(area.next.node.id, 'water-02', 'raw millisecond deadlines resolve equal displayed seconds');
  const ready = getGatheringArea(state, 'spring', NOW + 180_001)!;
  assert.equal(ready.readyCount, 1); assert.equal(ready.next.node.id, 'water-02'); assert.equal(ready.remainingSeconds, 0);
  assert.deepEqual(state, before);
});
