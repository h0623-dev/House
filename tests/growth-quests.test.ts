import test from 'node:test';
import assert from 'node:assert/strict';
import { beginHunt, createGame, getSeedInventory, loadGame, performAction, SAVE_KEY, saveGame, tick, type ActionResult, type GameState, type SaveStorage } from '../src/game.ts';
import { CROP_IDS } from '../src/crops.ts';
import { BUILDING_TYPES, buildFacility, collectProduction, getBuiltTypes, getSettlement, getUpgradedFacilityRecord, moveFacility, replaceFacility, startProduction, upgradeFacility } from '../src/settlement.ts';
import { GROWTH_CHAPTERS, GROWTH_QUESTS, claimGrowthQuest, getActiveGrowthQuest, getGrowthQuests, validateGrowthQuests } from '../src/growth-quests.ts';

const resources = ['wood', 'scrap', 'food', 'water', 'seeds'] as const;
function memoryStorage(): SaveStorage {
  const entries = new Map<string, string>();
  return { getItem: key => entries.get(key) ?? null, setItem: (key, value) => { entries.set(key, value); } };
}
function requireSuccess(result: ActionResult): GameState {
  assert.equal(result.ok, true, result.message);
  return result.state;
}
function loadRaw(value: unknown): GameState | null {
  const storage = memoryStorage(); storage.setItem(SAVE_KEY, JSON.stringify(value));
  return loadGame(storage);
}
function checkSeedTotal(state: GameState): void {
  assert.equal(CROP_IDS.reduce((total, crop) => total + getSeedInventory(state)[crop], 0), state.resources.seeds);
}
function claimCurrent(state: GameState, expectedId: string): GameState {
  const definition = getActiveGrowthQuest(state)!;
  assert.equal(definition.id, expectedId);
  assert.equal(definition.status, 'ready');
  const before = JSON.stringify(state), originalSeeds = getSeedInventory(state);
  const next = requireSuccess(claimGrowthQuest(state, expectedId));
  assert.equal(JSON.stringify(state), before, `${expectedId} mutates its input`);
  for (const resource of resources) {
    const amount = resource === 'seeds'
      ? Object.values(definition.reward.seeds ?? {}).reduce((sum, value) => sum + value!, 0)
      : definition.reward.resources?.[resource] ?? 0;
    assert.equal(next.resources[resource] - state.resources[resource], amount, `${expectedId}/${resource}`);
  }
  for (const crop of CROP_IDS) assert.equal(getSeedInventory(next)[crop] - originalSeeds[crop], definition.reward.seeds?.[crop] ?? 0);
  assert.equal(next.xp, state.xp + definition.reward.xp);
  assert.equal(next.level, Math.floor(next.xp / 120) + 1);
  assert.equal(next.energy, state.energy); assert.equal(next.totalMinutes, state.totalMinutes);
  assert.deepEqual(next.quests, state.quests, 'growth rewards must not grant separate survival rewards');
  assert.deepEqual(next.growthQuests!.claimed, [...(state.growthQuests?.claimed ?? []), expectedId]);
  checkSeedTotal(next);
  return next;
}
/** A validated imported late-game history: real expansion/build/upgrade actions plus recorded lifetime work. */
function achievedGame(): GameState {
  let state = createGame(); state.resources.wood = 10_000; state.resources.scrap = 10_000;
  for (let level = 1; level < 6; level++) state = requireSuccess(performAction(state, 'expand'));
  for (const [slot, type] of BUILDING_TYPES.entries()) state = requireSuccess(buildFacility(state, type, slot));
  for (const id of [1, 2, 3]) state = requireSuccess(upgradeFacility(state, id));
  Object.assign(state.stats, { gathers: 1, harvests: 8, chops: 3, hunts: 1, battlesWon: 1, defeatedEnemies: 6, plantings: 2, waterings: 2 });
  state.settlement!.stats!.productions = 12; state.settlement!.stats!.collections = 12;
  assert.equal(saveGame(state, memoryStorage()), true, 'late-game fixture must satisfy real save validation');
  return state;
}

test('six chapters expose four sequential goals each, with isolated reward and shortcut views', () => {
  const state = createGame(), before = JSON.stringify(state), views = getGrowthQuests(state);
  assert.equal(GROWTH_CHAPTERS.length, 6); assert.equal(GROWTH_QUESTS.length, 24);
  assert.equal(new Set(GROWTH_QUESTS.map(quest => quest.id)).size, 24);
  for (const chapter of GROWTH_CHAPTERS) assert.equal(views.filter(quest => quest.chapter === chapter.id).length, 4);
  assert.equal(getActiveGrowthQuest(state)!.id, 'road-supplies');
  assert.equal(views[0].status, 'active');
  assert.equal(views.slice(1).every(quest => quest.status === 'locked'), true);
  views[0].reward.resources!.wood = 999; views[0].destination.kind = 'hunt';
  assert.equal(GROWTH_QUESTS[0].reward.resources!.wood, 6);
  assert.equal(getGrowthQuests(state)[0].destination.kind, 'gather');
  assert.equal(JSON.stringify(state), before);
  assert.equal(state.stats.plantings, 0); assert.equal(state.stats.waterings, 0);
});

test('only successful actual planting and watering work increases plot counters', () => {
  const initial = createGame();
  const planted = requireSuccess(performAction(initial, 'plant', 3, 'potato'));
  assert.equal(planted.stats.plantings, 1); assert.equal(initial.stats.plantings, 0);
  const duplicate = performAction(planted, 'plant', 3, 'tomato');
  assert.equal(duplicate.ok, false); assert.equal(duplicate.state, planted);
  const watered = requireSuccess(performAction(planted, 'water'));
  assert.equal(watered.stats.waterings, 2, 'only the two unwatered planted plots count');
  assert.equal(watered.resources.water, planted.resources.water - 2);
  assert.equal(watered.stats.plantings, 1);
  for (const result of [performAction(watered, 'water'), performAction(watered, 'water', 99), performAction(watered, 'plant', 99)]) {
    assert.equal(result.ok, false); assert.equal(result.state, watered);
  }
  const empty = createGame(); empty.seedInventory!.potato = 0; empty.resources.seeds -= 3;
  assert.equal(performAction(empty, 'plant', 3, 'potato').state, empty);
  assert.equal(empty.stats.plantings, 0); assert.equal(empty.stats.waterings, 0);
});

test('new players can finish the first two chapters using real actions and the awarded materials', () => {
  let state = requireSuccess(performAction(createGame(), 'gather'));
  state = claimCurrent(state, 'road-supplies');
  state = requireSuccess(performAction(state, 'harvest', 1));
  state = claimCurrent(state, 'first-carrot');
  state = requireSuccess(buildFacility(state, 'waterworks', 0));
  state = claimCurrent(state, 'rainwater-home');
  state = requireSuccess(startProduction(state, 1));
  state = requireSuccess(performAction(state, 'rest'));
  assert.equal(state.totalMinutes >= getSettlement(state).buildings[0].readyAt!, true);
  state = requireSuccess(collectProduction(state, 1));
  state = claimCurrent(state, 'first-delivery');
  state = requireSuccess(performAction(state, 'plant', 1, 'carrot'));
  state = requireSuccess(performAction(state, 'plant', 3, 'potato'));
  state = claimCurrent(state, 'new-seeds');
  state = requireSuccess(performAction(state, 'water', 1));
  state = requireSuccess(performAction(state, 'water', 3));
  state = claimCurrent(state, 'tender-watering');
  state = requireSuccess(buildFacility(state, 'kitchen', 1));
  state = claimCurrent(state, 'warm-kitchen');
  state = requireSuccess(performAction(state, 'expand'));
  state = claimCurrent(state, 'wider-deck');
  assert.equal(state.deckLevel, 2); assert.equal(state.stats.plantings, 2); assert.equal(state.stats.waterings, 2);
  assert.equal(state.growthQuests!.claimed.length, 8);
  assert.equal(getActiveGrowthQuest(state)!.id, 'forest-logs');
  assert.deepEqual(state.quests, ['bigger-home']);
  assert.equal(state.resources.wood > 0 && state.resources.scrap > 0, true);
  const storage = memoryStorage(); assert.equal(saveGame(state, storage), true);
  const loaded = loadGame(storage)!;
  assert.deepEqual(loaded.growthQuests, state.growthQuests);
  assert.deepEqual(loaded.resources, state.resources); assert.deepEqual(loaded.seedInventory, state.seedInventory);
  assert.equal(loaded.xp, state.xp); assert.equal(getActiveGrowthQuest(loaded)!.id, 'forest-logs');
});

test('late-game achievements allow catch-up but never unlock future rewards before explicit claims', () => {
  let state = achievedGame(); const before = JSON.stringify(state), initialXp = state.xp;
  const views = getGrowthQuests(state);
  assert.equal(views[0].status, 'ready');
  assert.equal(views.slice(1).every(quest => quest.current === quest.target && quest.status === 'locked'), true);
  assert.equal(JSON.stringify(state), before);
  const skipped = claimGrowthQuest(state, 'road-haven');
  assert.equal(skipped.ok, false); assert.equal(skipped.state, state);
  for (const definition of GROWTH_QUESTS) state = claimCurrent(state, definition.id);
  assert.equal(state.xp, initialXp + GROWTH_QUESTS.reduce((sum, quest) => sum + quest.reward.xp, 0));
  assert.equal(getActiveGrowthQuest(state), null);
  assert.equal(getGrowthQuests(state).every(quest => quest.status === 'claimed'), true);
  const twice = claimGrowthQuest(state, 'road-haven');
  assert.equal(twice.ok, false); assert.equal(twice.state, state);
  const storage = memoryStorage(); assert.equal(saveGame(state, storage), true);
  const loaded = loadGame(storage)!;
  assert.deepEqual(loaded.growthQuests, state.growthQuests);
  assert.deepEqual(loaded.resources, state.resources); assert.equal(loaded.xp, state.xp);
});

test('legacy saves keep earned achievements and every resource, while missing farming counters start at zero', () => {
  const original = achievedGame();
  delete original.growthQuests; delete original.stats.plantings; delete original.stats.waterings;
  const before = JSON.stringify(original), loaded = loadRaw(original)!;
  assert.notEqual(loaded, null);
  assert.equal(Object.hasOwn(loaded, 'growthQuests'), false);
  assert.equal(loaded.stats.plantings, 0); assert.equal(loaded.stats.waterings, 0);
  assert.deepEqual(loaded.resources, original.resources); assert.deepEqual(loaded.seedInventory, original.seedInventory);
  assert.equal(loaded.xp, original.xp); assert.equal(JSON.stringify(original), before);
  let state = loaded;
  for (const id of ['road-supplies', 'first-carrot', 'rainwater-home', 'first-delivery']) state = claimCurrent(state, id);
  assert.equal(getActiveGrowthQuest(state)!.id, 'new-seeds');
  assert.equal(getActiveGrowthQuest(state)!.status, 'active');
  assert.equal(getActiveGrowthQuest(state)!.current, 0);
  state = requireSuccess(performAction(requireSuccess(performAction(state, 'rest')), 'plant', 3, 'pumpkin'));
  assert.equal(state.stats.plantings, 1);
  state = requireSuccess(performAction(state, 'water', 3));
  assert.equal(state.stats.waterings, 1);
});

test('old aggregate-only seeds are preserved exactly when a growth reward materializes the inventory', () => {
  const original = createGame(); delete original.growthQuests; delete original.seedInventory;
  original.resources.seeds = 17; original.stats.gathers = 1;
  const state = claimCurrent(original, 'road-supplies');
  assert.deepEqual(state.seedInventory, { carrot: 17, potato: 0, tomato: 0, corn: 0, strawberry: 0, pumpkin: 0 });
  assert.equal(state.resources.seeds, 17); assert.equal(original.seedInventory, undefined);
  assert.equal(saveGame(state, memoryStorage()), true);
});

test('malformed, forged, duplicated and skipped claim history is rejected on load and claim', () => {
  const achieved = achievedGame();
  const cases: unknown[] = [null, [], {}, { claimed: null }, { claimed: ['unknown'] },
    { claimed: ['first-carrot'] }, { claimed: ['road-supplies', 'road-supplies'] },
    { claimed: ['road-supplies', 'rainwater-home'] }, { claimed: ['road-supplies'], extra: true },
    { claimed: GROWTH_QUESTS.map(quest => quest.id).concat('road-haven') }];
  for (const invalid of cases) {
    const bad = { ...achieved, growthQuests: invalid } as GameState;
    const before = JSON.stringify(bad);
    assert.equal(validateGrowthQuests(invalid, bad), false, JSON.stringify(invalid));
    assert.equal(loadRaw(bad), null); assert.equal(saveGame(bad, memoryStorage()), false);
    const result = claimGrowthQuest(bad, 'road-supplies');
    assert.equal(result.ok, false); assert.equal(result.state, bad); assert.equal(JSON.stringify(bad), before);
  }
  const unmet = createGame(); unmet.growthQuests = { claimed: ['road-supplies'] };
  assert.equal(loadRaw(unmet), null); assert.equal(saveGame(unmet, memoryStorage()), false);
  const counterForgery = achievedGame(); counterForgery.growthQuests = { claimed: GROWTH_QUESTS.slice(0, 5).map(quest => quest.id) };
  counterForgery.stats.plantings = 1;
  assert.equal(loadRaw(counterForgery), null);
});

test('present farming counters reject malformed values rather than receiving legacy defaults', () => {
  for (const key of ['plantings', 'waterings'] as const) {
    for (const value of [null, -1, 1.5, '2', 100_000_001]) {
      const bad = createGame(); (bad.stats as unknown as Record<string, unknown>)[key] = value;
      assert.equal(loadRaw(bad), null, `${key}/${value}`);
      assert.equal(saveGame(bad, memoryStorage()), false);
    }
  }
  const legacy = createGame(); delete legacy.stats.plantings; delete legacy.stats.waterings;
  assert.equal(saveGame(legacy, memoryStorage()), true);
  const loaded = loadRaw(legacy)!; assert.equal(loaded.stats.plantings, 0); assert.equal(loaded.stats.waterings, 0);
});

test('unmet, unknown, already claimed and battle-time reward requests preserve the original state', () => {
  const initial = createGame();
  for (const id of ['road-supplies', 'missing', 'first-carrot']) {
    const before = JSON.stringify(initial), result = claimGrowthQuest(initial, id);
    assert.equal(result.ok, false); assert.equal(result.state, initial); assert.equal(JSON.stringify(initial), before);
  }
  const ready = requireSuccess(performAction(initial, 'gather'));
  const battle = requireSuccess(beginHunt(ready, 1)), blocked = claimGrowthQuest(battle, 'road-supplies');
  assert.equal(blocked.ok, false); assert.equal(blocked.state, battle);
  const claimed = claimCurrent(ready, 'road-supplies'), repeated = claimGrowthQuest(claimed, 'road-supplies');
  assert.equal(repeated.ok, false); assert.equal(repeated.state, claimed);
});

test('reward additions reject resource, XP and seed overflow without partial payment', () => {
  const resourceFull = createGame(); resourceFull.stats.gathers = 1; resourceFull.resources.wood = 100_000_000;
  const xpFull = createGame(); xpFull.stats.gathers = 1; xpFull.xp = 100_000_000; xpFull.level = Math.floor(xpFull.xp / 120) + 1;
  const seedFull = createGame(); seedFull.stats.gathers = 1; seedFull.stats.harvests = 1;
  seedFull.growthQuests = { claimed: ['road-supplies'] };
  seedFull.seedInventory = { carrot: 100_000_000, potato: 0, tomato: 0, corn: 0, strawberry: 0, pumpkin: 0 };
  seedFull.resources.seeds = 100_000_000;
  const inconsistent = createGame(); inconsistent.stats.gathers = 1; inconsistent.resources.seeds++;
  for (const [state, id] of [[resourceFull, 'road-supplies'], [xpFull, 'road-supplies'], [seedFull, 'first-carrot'], [inconsistent, 'road-supplies']] as const) {
    const before = JSON.stringify(state), result = claimGrowthQuest(state, id);
    assert.equal(result.ok, false); assert.equal(result.state, state); assert.equal(JSON.stringify(state), before);
  }
  const exact = createGame(); exact.stats.gathers = 1;
  exact.resources.wood = 100_000_000 - 6; exact.resources.scrap = 100_000_000 - 3;
  exact.xp = 100_000_000 - 10; exact.level = Math.floor(exact.xp / 120) + 1;
  const claimed = claimCurrent(exact, 'road-supplies');
  assert.equal(claimed.resources.wood, 100_000_000); assert.equal(claimed.resources.scrap, 100_000_000);
  assert.equal(claimed.xp, 100_000_000); assert.equal(saveGame(claimed, memoryStorage()), true);
});

test('planting and multi-plot watering counter caps reject work atomically', () => {
  const plantsFull = createGame(); plantsFull.stats.plantings = 100_000_000;
  const planted = performAction(plantsFull, 'plant', 3, 'pumpkin');
  assert.equal(planted.ok, false); assert.equal(planted.state, plantsFull);
  const watersFull = requireSuccess(performAction(createGame(), 'plant', 3));
  watersFull.stats.waterings = 99_999_999;
  const before = JSON.stringify(watersFull), watered = performAction(watersFull, 'water');
  assert.equal(watered.ok, false); assert.equal(watered.state, watersFull); assert.equal(JSON.stringify(watersFull), before);
  const targeted = requireSuccess(performAction(watersFull, 'water', 3));
  assert.equal(targeted.stats.waterings, 100_000_000);
  assert.equal(targeted.plots.find(plot => plot.id === 2)!.watered, false);
});

test('paid facility replacement preserves claimed build and distinct-upgrade achievements on reload', () => {
  let state = achievedGame();
  for (const definition of GROWTH_QUESTS) state = claimCurrent(state, definition.id);
  const claimed = [...state.growthQuests!.claimed];
  state = requireSuccess(replaceFacility(state, 1, 'kitchen'));
  assert.equal(getSettlement(state).buildings[0].level, 1);
  assert.equal(getBuiltTypes(state).length, 6); assert.equal(getUpgradedFacilityRecord(state), 3);
  state = requireSuccess(upgradeFacility(state, 1));
  assert.equal(getUpgradedFacilityRecord(state), 3, 'improving one replaced ID twice must not satisfy another facility');
  assert.deepEqual(state.growthQuests!.claimed, claimed);
  const storage = memoryStorage(); assert.equal(saveGame(state, storage), true);
  const loaded = loadGame(storage)!;
  assert.deepEqual(loaded.growthQuests!.claimed, claimed); assert.equal(getActiveGrowthQuest(loaded), null);
});

test('growth claims, time advancement and facility mutations copy claimed arrays independently', () => {
  const ready = requireSuccess(buildFacility(requireSuccess(performAction(createGame(), 'gather')), 'waterworks', 0));
  const claimed = claimCurrent(ready, 'road-supplies');
  const timed = tick(claimed), built = requireSuccess(buildFacility(claimed, 'kitchen', 1));
  const moved = requireSuccess(moveFacility(claimed, 1, 1)), producing = requireSuccess(startProduction(claimed, 1));
  assert.notEqual(claimed.facilityHistory, ready.facilityHistory);
  assert.notEqual(claimed.facilityHistory!.builtTypes, ready.facilityHistory!.builtTypes);
  assert.notEqual(claimed.facilityHistory!.upgradedFacilityIds, ready.facilityHistory!.upgradedFacilityIds);
  for (const copy of [timed, built, moved, producing]) {
    assert.notEqual(copy.growthQuests, claimed.growthQuests);
    assert.notEqual(copy.growthQuests!.claimed, claimed.growthQuests!.claimed);
    copy.growthQuests!.claimed.push('test-only-mutation');
    assert.notEqual(copy.facilityHistory, claimed.facilityHistory);
    assert.notEqual(copy.facilityHistory!.builtTypes, claimed.facilityHistory!.builtTypes);
    assert.notEqual(copy.facilityHistory!.upgradedFacilityIds, claimed.facilityHistory!.upgradedFacilityIds);
    copy.facilityHistory!.builtTypes.push('watchtower'); copy.facilityHistory!.upgradedFacilityIds.push(12);
  }
  assert.deepEqual(claimed.growthQuests!.claimed, ['road-supplies']);
  assert.deepEqual(ready.growthQuests!.claimed, []);
  assert.deepEqual(claimed.facilityHistory, { builtTypes: ['waterworks'], upgradedFacilityIds: [] });
  assert.deepEqual(ready.facilityHistory, { builtTypes: ['waterworks'], upgradedFacilityIds: [] });
  const snapshot = getGrowthQuests(claimed); snapshot[1].reward.seeds!.carrot = 99;
  assert.equal(GROWTH_QUESTS[1].reward.seeds!.carrot, 3);
  assert.equal(claimed.resources.seeds, ready.resources.seeds);
});

test('optional top-level history admits facilities added by an older engine and unions their current achievements', () => {
  let state = requireSuccess(buildFacility(createGame(), 'waterworks', 0));
  const oldHistory = structuredClone(state.facilityHistory!);
  state.resources.wood = 200; state.resources.scrap = 100;
  state = requireSuccess(buildFacility(state, 'kitchen', 1));
  state = requireSuccess(upgradeFacility(state, 1));
  // The v0.8 engine preserves unknown top-level history but cannot update its newer fields.
  state.facilityHistory = oldHistory;
  assert.deepEqual(Object.keys(state.settlement!.stats!).sort(), ['collections', 'productions']);
  assert.deepEqual(getBuiltTypes(state), ['waterworks', 'kitchen']);
  assert.equal(getUpgradedFacilityRecord(state), 1);
  const storage = memoryStorage(); assert.equal(saveGame(state, storage), true);
  const loaded = loadGame(storage)!;
  assert.deepEqual(loaded.facilityHistory, oldHistory, 'load must not grant or fabricate records');
  assert.deepEqual(loaded.resources, state.resources);
  assert.deepEqual(getBuiltTypes(loaded), ['waterworks', 'kitchen']);
  assert.equal(getUpgradedFacilityRecord(loaded), 1);
  const legacy = createGame();
  assert.equal(Object.hasOwn(legacy, 'facilityHistory'), false);
  assert.equal(Object.hasOwn(loadRaw(legacy)!, 'facilityHistory'), false);
});
