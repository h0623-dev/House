import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceTime, beginHunt, createGame, loadGame, performAction, SAVE_KEY, saveGame, tick, type GameState, type SaveStorage } from '../src/game.ts';
import { BUILDINGS, BUILDING_TYPES, buildFacility, collectProduction, getBuiltTypes, getUpgradedFacilityRecord, getFacilityHistory, validateFacilityHistory, getProductionCost, getSettlement, getSettlementGoals, getUnlockedSlots, getUpgradeCost, moveFacility, replaceFacility, startProduction, upgradeFacility, validateSettlement, type BuildingType } from '../src/settlement.ts';
import { GAME_MINUTES_PER_SECOND } from '../src/game-time.ts';

function memoryStorage(): SaveStorage {
  const values = new Map<string, string>();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); } };
}
function fundedGame(deckLevel = 1): GameState {
  let state = createGame();
  state.resources.wood = 10_000; state.resources.scrap = 10_000;
  for (let level = 1; level < deckLevel; level++) state = performAction(state, 'expand').state;
  return state;
}
function withBuilding(type: BuildingType = 'waterworks'): GameState {
  const result = buildFacility(fundedGame(BUILDINGS[type].unlockLevel), type, 0);
  assert.equal(result.ok, true);
  return result.state;
}

test('new settlements have two independent building slots per deck level and read-only snapshots', () => {
  const state = createGame();
  assert.deepEqual(getSettlement(state), { buildings: [], nextBuildingId: 1, stats: { productions: 0, collections: 0 } });
  assert.equal(getUnlockedSlots(state), 2);
  assert.equal(getUnlockedSlots(fundedGame(6)), 12);
  const snapshot = getSettlement(state);
  snapshot.nextBuildingId = 8; snapshot.stats!.productions = 20;
  assert.equal(getSettlement(state).nextBuildingId, 1);
  assert.equal(getSettlement(state).stats!.productions, 0);
});

test('paid replacement keeps its slot and identity, resets level, and charges only the new facility cost', () => {
  let original = withBuilding();
  original = upgradeFacility(original, 1).state;
  const before = JSON.stringify(original), result = replaceFacility(original, 1, 'kitchen');
  assert.equal(result.ok, true);
  assert.deepEqual(getSettlement(result.state).buildings, [{ id: 1, slot: 0, type: 'kitchen', level: 1, startedAt: null, readyAt: null }]);
  assert.equal(result.state.settlement!.nextBuildingId, original.settlement!.nextBuildingId);
  assert.equal(result.state.resources.wood, original.resources.wood - BUILDINGS.kitchen.wood);
  assert.equal(result.state.resources.scrap, original.resources.scrap - BUILDINGS.kitchen.scrap);
  assert.deepEqual(getBuiltTypes(result.state), ['waterworks', 'kitchen']);
  assert.equal(getUpgradedFacilityRecord(result.state), 1);
  assert.equal(JSON.stringify(original), before);
  const duplicate = replaceFacility(result.state, 1, 'kitchen');
  assert.equal(duplicate.ok, false); assert.equal(duplicate.state, result.state);
  const storage = memoryStorage(); assert.equal(saveGame(result.state, storage), true);
  const loaded = loadGame(storage)!;
  assert.deepEqual(getBuiltTypes(loaded), ['waterworks', 'kitchen']);
  assert.equal(getUpgradedFacilityRecord(loaded), 1);
});

test('replacement rejects locked types, missing facilities, insufficient materials and uncollected batches without mutation', () => {
  const original = withBuilding(), states = [startProduction(original, 1).state];
  states.push(advanceTime(states[0], BUILDINGS.waterworks.minutes));
  for (const state of states) {
    const before = JSON.stringify(state), result = replaceFacility(state, 1, 'kitchen');
    assert.equal(result.ok, false); assert.equal(result.state, state); assert.equal(JSON.stringify(state), before);
  }
  const empty = { ...original, resources: { ...original.resources, wood: 0, scrap: 0 } };
  for (const [state, id, type] of [[original, 1, 'workshop'], [original, 2, 'kitchen'], [original, 1, 'unknown'], [empty, 1, 'kitchen']] as const) {
    const before = JSON.stringify(state), result = replaceFacility(state, id, type as BuildingType);
    assert.equal(result.ok, false); assert.equal(result.state, state); assert.equal(JSON.stringify(state), before);
  }
  const collected = collectProduction(states[1], 1).state;
  assert.equal(replaceFacility(collected, 1, 'kitchen').ok, true);
});

test('a full legacy deck can recover every facility type without new slots or losing past upgrades', () => {
  let state = fundedGame(6);
  for (let slot = 0; slot < 12; slot++) state = buildFacility(state, 'waterworks', slot).state;
  for (let id = 1; id <= 3; id++) state = upgradeFacility(state, id).state;
  delete state.facilityHistory;
  const storage = memoryStorage(); assert.equal(saveGame(state, storage), true);
  state = loadGame(storage)!;
  const legacyResources = { ...state.resources };
  assert.equal(state.facilityHistory, undefined);
  assert.deepEqual(state.resources, legacyResources);
  for (let index = 1; index < BUILDING_TYPES.length; index++) {
    const replaced = replaceFacility(state, index, BUILDING_TYPES[index]);
    assert.equal(replaced.ok, true); state = replaced.state;
  }
  assert.equal(state.settlement!.buildings.length, 12);
  assert.equal(state.settlement!.nextBuildingId, 13);
  assert.equal(getBuiltTypes(state).length, 6);
  assert.equal(getUpgradedFacilityRecord(state), 3);
  assert.equal(saveGame(state, storage), true);
  assert.equal(getUpgradedFacilityRecord(loadGame(storage)!), 3);
});

test('lifetime facility history is deep copied and rejects contradictory or forged fields', () => {
  const original = upgradeFacility(withBuilding(), 1).state;
  const snapshot = getFacilityHistory(original);
  snapshot.builtTypes.push('kitchen'); snapshot.upgradedFacilityIds.push(2);
  assert.deepEqual(getBuiltTypes(original), ['waterworks']);
  assert.equal(getUpgradedFacilityRecord(original), 1);
  const mutations: Array<(state: GameState) => void> = [
    state => { (state.facilityHistory! as unknown as Record<string, unknown>).extra = 1; },
    state => { state.facilityHistory!.builtTypes = ['waterworks', 'waterworks']; },
    state => { state.facilityHistory!.builtTypes = ['waterworks', 'greenhouse']; },
    state => { (state.facilityHistory! as unknown as Record<string, unknown>).builtTypes = null; },
    state => { state.facilityHistory!.upgradedFacilityIds = [1, 1]; },
    state => { state.facilityHistory!.upgradedFacilityIds = [1, 2]; },
  ];
  for (const mutate of mutations) {
    const bad = structuredClone(original); mutate(bad);
    assert.equal(validateFacilityHistory(bad.facilityHistory, bad), false);
    assert.equal(saveGame(bad, memoryStorage()), false);
  }
});

test('a first rainwater facility is affordable, charges its exact cost once, and preserves input state', () => {
  const initial = createGame(), before = JSON.stringify(initial);
  const built = buildFacility(initial, 'waterworks', 0);
  assert.equal(built.ok, true);
  assert.equal(built.state.resources.wood, 24 - 12);
  assert.equal(built.state.resources.scrap, 12 - 4);
  assert.equal(built.state.energy, initial.energy);
  assert.equal(built.state.totalMinutes, initial.totalMinutes);
  assert.deepEqual(getSettlement(built.state).buildings, [{ id: 1, type: 'waterworks', slot: 0, level: 1, startedAt: null, readyAt: null }]);
  assert.equal(getSettlement(built.state).nextBuildingId, 2);
  assert.equal(JSON.stringify(initial), before);
  const duplicate = buildFacility(built.state, 'waterworks', 0);
  assert.equal(duplicate.ok, false); assert.equal(duplicate.state, built.state);
  assert.equal(saveGame(built.state, memoryStorage()), true);
});

test('locked, occupied, invalid, and unaffordable construction never changes resources or progress', () => {
  const initial = createGame();
  for (const [type, slot] of [['workshop', 0], ['greenhouse', 1], ['unknown', 0], ['waterworks', -1], ['waterworks', 2], ['waterworks', 0.5], ['waterworks', NaN]] as const) {
    const before = JSON.stringify(initial);
    const result = buildFacility(initial, type as BuildingType, slot);
    assert.equal(result.ok, false); assert.equal(result.state, initial);
    assert.equal(JSON.stringify(initial), before);
  }
  const empty = { ...initial, resources: { ...initial.resources, wood: 11, scrap: 3 } };
  const result = buildFacility(empty, 'waterworks', 0);
  assert.equal(result.ok, false); assert.equal(result.state, empty);
});

test('moving a facility preserves its identity, paid costs, level, and in-flight production timer', () => {
  const initial = startProduction(withBuilding(), 1).state;
  const before = JSON.stringify(initial);
  const moved = moveFacility(initial, 1, 1);
  assert.equal(moved.ok, true);
  assert.deepEqual(moved.state.resources, initial.resources);
  assert.equal(moved.state.totalMinutes, initial.totalMinutes);
  assert.deepEqual(getSettlement(moved.state).buildings[0], { ...getSettlement(initial).buildings[0], slot: 1 });
  assert.equal(JSON.stringify(initial), before);
  const occupied = buildFacility(moved.state, 'kitchen', 0).state;
  const invalid = moveFacility(occupied, 1, 0);
  assert.equal(invalid.ok, false); assert.equal(invalid.state, occupied);
  for (const slot of [1, 2, -1, 0.5, NaN]) {
    const result = moveFacility(moved.state, 1, slot);
    assert.equal(result.ok, false); assert.equal(result.state, moved.state);
  }
  assert.equal(saveGame(moved.state, memoryStorage()), true);
});

test('each of the six facilities has a paid recipe or rain/scanning cycle and produces its stated resource', () => {
  for (const type of BUILDING_TYPES) {
    const initial = withBuilding(type), definition = BUILDINGS[type];
    const before = JSON.stringify(initial);
    const started = startProduction(initial, 1);
    assert.equal(started.ok, true, type);
    const building = getSettlement(started.state).buildings[0];
    assert.equal(building.startedAt, initial.totalMinutes);
    assert.equal(building.readyAt, initial.totalMinutes + definition.minutes);
    assert.equal(started.state.totalMinutes, initial.totalMinutes);
    for (const resource of ['wood', 'scrap', 'food', 'water', 'seeds'] as const) {
      assert.equal(started.state.resources[resource], initial.resources[resource] - (definition.recipe?.[resource] ?? 0), `${type}/${resource}`);
    }
    assert.equal(JSON.stringify(initial), before);
    const ready = advanceTime(started.state, definition.minutes);
    const collected = collectProduction(ready, 1);
    assert.equal(collected.ok, true, type);
    assert.equal(collected.state.resources[definition.yieldResource], ready.resources[definition.yieldResource] + definition.yieldAmount, type);
    assert.equal(getSettlement(collected.state).buildings[0].startedAt, null);
    assert.equal(getSettlement(collected.state).buildings[0].readyAt, null);
    assert.deepEqual(getSettlement(collected.state).stats, { productions: 1, collections: 1 });
    assert.equal(saveGame(collected.state, memoryStorage()), true, type);
  }
});

test('production is capped at one batch and can only be collected once at the exact ready boundary', () => {
  const initial = startProduction(withBuilding(), 1).state;
  const duplicate = startProduction(initial, 1);
  assert.equal(duplicate.ok, false); assert.equal(duplicate.state, initial);
  const almost = tick(initial, BUILDINGS.waterworks.minutes / GAME_MINUTES_PER_SECOND - 0.5);
  const tooEarly = collectProduction(almost, 1);
  assert.equal(tooEarly.ok, false); assert.equal(tooEarly.state, almost);
  const ready = tick(almost, 0.5);
  assert.equal(ready.totalMinutes, getSettlement(ready).buildings[0].readyAt);
  const stacked = startProduction(ready, 1);
  assert.equal(stacked.ok, false); assert.equal(stacked.state, ready);
  const collected = collectProduction(ready, 1);
  assert.equal(collected.ok, true);
  assert.equal(collected.state.resources.water, ready.resources.water + 4);
  const twice = collectProduction(collected.state, 1);
  assert.equal(twice.ok, false); assert.equal(twice.state, collected.state);
  assert.deepEqual(getSettlement(collected.state).stats, { productions: 1, collections: 1 });
  assert.equal(startProduction(collected.state, 1).ok, true);
});

test('long in-game waits retain only one ready batch rather than accumulating automatic production', () => {
  const started = startProduction(withBuilding(), 1).state;
  const longWait = advanceTime(started, 1440 * 30);
  const result = collectProduction(longWait, 1);
  assert.equal(result.ok, true);
  assert.equal(result.state.resources.water, longWait.resources.water + 4);
  assert.equal(getSettlement(result.state).stats!.collections, 1);
  assert.equal(collectProduction(result.state, 1).ok, false);
});

test('recipes must be affordable and repeated start attempts never charge ingredients twice', () => {
  const state = withBuilding('kitchen');
  state.resources.water = 1;
  const unavailable = startProduction(state, 1);
  assert.equal(unavailable.ok, false); assert.equal(unavailable.state, state);
  assert.equal(getSettlement(state).buildings[0].readyAt, null);
  state.resources.water = 10;
  const started = startProduction(state, 1);
  assert.equal(started.ok, true);
  assert.equal(started.state.resources.water, 8);
  const twice = startProduction(started.state, 1);
  assert.equal(twice.ok, false); assert.equal(twice.state, started.state);
  assert.equal(started.state.resources.water, 8);
});

test('facility levels use exact upgrade costs and scale recipes and yield with a maximum level of three', () => {
  let state = withBuilding('kitchen');
  for (const level of [2, 3]) {
    const before = state;
    const cost = getUpgradeCost(getSettlement(state).buildings[0]);
    assert.deepEqual(cost, { wood: BUILDINGS.kitchen.wood * level, scrap: BUILDINGS.kitchen.scrap * level });
    const upgraded = upgradeFacility(state, 1);
    assert.equal(upgraded.ok, true);
    state = upgraded.state;
    assert.equal(getSettlement(state).buildings[0].level, level);
    assert.equal(state.resources.wood, before.resources.wood - cost.wood);
    assert.equal(state.resources.scrap, before.resources.scrap - cost.scrap);
  }
  const maxed = upgradeFacility(state, 1);
  assert.equal(maxed.ok, false); assert.equal(maxed.state, state);
  assert.deepEqual(getProductionCost(getSettlement(state).buildings[0]), { water: 6 });
  const started = startProduction(state, 1);
  assert.equal(started.ok, true);
  assert.equal(started.state.resources.water, state.resources.water - 6);
  const ready = advanceTime(started.state, BUILDINGS.kitchen.minutes);
  const collected = collectProduction(ready, 1);
  assert.equal(collected.ok, true);
  assert.equal(collected.state.resources.food, ready.resources.food + 15);
  assert.equal(saveGame(collected.state, memoryStorage()), true);
});

test('running and ready batches block upgrades until collected, preserving the recipe and output level', () => {
  const initial = startProduction(withBuilding(), 1).state;
  for (const state of [initial, advanceTime(initial, BUILDINGS.waterworks.minutes)]) {
    const upgraded = upgradeFacility(state, 1);
    assert.equal(upgraded.ok, false); assert.equal(upgraded.state, state);
  }
  const collected = collectProduction(advanceTime(initial, BUILDINGS.waterworks.minutes), 1).state;
  assert.equal(upgradeFacility(collected, 1).ok, true);
  const poor = { ...collected, resources: { ...collected.resources, wood: 0, scrap: 0 } };
  const result = upgradeFacility(poor, 1);
  assert.equal(result.ok, false); assert.equal(result.state, poor);
});

test('legacy saves keep their old quantities and absent settlement until a player chooses to build', () => {
  const legacy = createGame(); delete legacy.settlement;
  legacy.resources.wood = 27;
  const storage = memoryStorage(), original = JSON.stringify(legacy);
  storage.setItem(SAVE_KEY, original);
  const loaded = loadGame(storage);
  assert.ok(loaded);
  assert.deepEqual(loaded, legacy);
  assert.equal(Object.hasOwn(loaded, 'settlement'), false);
  assert.equal(getSettlement(loaded).buildings.length, 0);
  assert.equal(saveGame(loaded, storage), true);
  const twice = loadGame(storage);
  assert.ok(twice);
  assert.equal(Object.hasOwn(twice, 'settlement'), false);
  assert.equal(twice.resources.wood, 27);
  assert.equal(buildFacility(twice, 'waterworks', 0).state.resources.wood, 15);
  assert.equal(JSON.stringify(legacy), original);
});

test('active and ready production save and reload without applying offline time or changing ingredients', () => {
  const active = startProduction(withBuilding('kitchen'), 1).state;
  const storage = memoryStorage();
  for (const state of [active, advanceTime(active, BUILDINGS.kitchen.minutes)]) {
    assert.equal(saveGame(state, storage), true);
    const loaded = loadGame(storage);
    assert.ok(loaded);
    assert.deepEqual({ ...loaded, lastSaved: 0 }, state);
    assert.equal(loaded.totalMinutes, state.totalMinutes);
    assert.deepEqual(loaded.resources, state.resources);
  }
});

test('construction, production, and collection goals retain progress after claims, moves, and reloads', () => {
  let state = withBuilding();
  assert.equal(getSettlementGoals(state).find(goal => goal.id === 'first-facility')?.complete, true);
  assert.equal(getSettlementGoals(state).find(goal => goal.id === 'first-production')?.complete, false);
  state = startProduction(state, 1).state;
  assert.equal(getSettlementGoals(state).find(goal => goal.id === 'first-production')?.complete, true);
  state = collectProduction(advanceTime(state, BUILDINGS.waterworks.minutes), 1).state;
  state = moveFacility(state, 1, 1).state;
  const storage = memoryStorage(); assert.equal(saveGame(state, storage), true);
  const loaded = loadGame(storage)!;
  for (const id of ['first-facility', 'first-production', 'first-collection']) assert.equal(getSettlementGoals(loaded).find(goal => goal.id === id)?.complete, true, id);
  assert.deepEqual(getSettlement(loaded).stats, { productions: 1, collections: 1 });
});

test('missing optional production counters initialize without gifts or invalidating an existing active batch', () => {
  const state = startProduction(withBuilding(), 1).state;
  delete state.settlement!.stats;
  const storage = memoryStorage();
  storage.setItem(SAVE_KEY, JSON.stringify(state));
  const loaded = loadGame(storage);
  assert.ok(loaded);
  assert.deepEqual(getSettlement(loaded).stats, { productions: 0, collections: 0 });
  assert.deepEqual(loaded.resources, state.resources);
  const collected = collectProduction(advanceTime(loaded, BUILDINGS.waterworks.minutes), 1);
  assert.equal(collected.ok, true);
  assert.deepEqual(getSettlement(collected.state).stats, { productions: 0, collections: 1 });
  assert.equal(getSettlementGoals(collected.state).find(goal => goal.id === 'first-production')?.complete, true);
  assert.equal(saveGame(collected.state, storage), true);
});

test('normal farming and time advance deep-copy facilities while an expedition freezes their clock', () => {
  const state = startProduction(withBuilding(), 1).state;
  const before = JSON.stringify(state);
  const farmed = performAction(state, 'plant', 3, 'corn');
  assert.equal(farmed.ok, true);
  assert.deepEqual(getSettlement(farmed.state), getSettlement(state));
  assert.notEqual(farmed.state.settlement, state.settlement);
  assert.notEqual(farmed.state.settlement!.buildings[0], state.settlement!.buildings[0]);
  assert.notEqual(farmed.state.settlement!.stats, state.settlement!.stats);
  assert.equal(JSON.stringify(state), before);
  const hunting = beginHunt(state, 1).state;
  assert.equal(tick(hunting, 100), hunting);
  for (const result of [buildFacility(hunting, 'waterworks', 1), moveFacility(hunting, 1, 1), upgradeFacility(hunting, 1), startProduction(hunting, 1), collectProduction(hunting, 1)]) {
    assert.equal(result.ok, false); assert.equal(result.state, hunting);
  }
});

test('fractional game clocks keep an exact duration and can be saved at the readiness boundary', () => {
  const started = startProduction(tick(withBuilding(), 0.25), 1).state;
  const ready = advanceTime(started, BUILDINGS.waterworks.minutes);
  assert.equal(ready.totalMinutes, getSettlement(ready).buildings[0].readyAt);
  assert.equal(validateSettlement(ready.settlement, ready), true);
  assert.equal(saveGame(ready, memoryStorage()), true);
  assert.equal(collectProduction(ready, 1).ok, true);
});

test('full resource storage does not discard a ready batch or allow duplicate reward', () => {
  const state = advanceTime(startProduction(withBuilding(), 1).state, BUILDINGS.waterworks.minutes);
  state.resources.water = 100_000_000;
  const full = collectProduction(state, 1);
  assert.equal(full.ok, false); assert.equal(full.state, state);
  assert.notEqual(getSettlement(state).buildings[0].readyAt, null);
  state.resources.water -= 4;
  const collected = collectProduction(state, 1);
  assert.equal(collected.ok, true);
  assert.equal(collected.state.resources.water, 100_000_000);
  assert.equal(collectProduction(collected.state, 1).ok, false);
  assert.equal(saveGame(collected.state, memoryStorage()), true);
});

test('unknown facility IDs never change a settlement', () => {
  const state = withBuilding();
  for (const id of [0, 2, -1, 0.5, NaN, Infinity]) {
    for (const result of [moveFacility(state, id, 1), upgradeFacility(state, id), startProduction(state, id), collectProduction(state, id)]) {
      assert.equal(result.ok, false); assert.equal(result.state, state);
    }
  }
});

test('corrupt facility IDs, slots, levels, counters, and production times are rejected without repair', () => {
  const original = startProduction(buildFacility(withBuilding(), 'kitchen', 1).state, 1).state;
  const storage = memoryStorage();
  const mutations: Array<(state: GameState) => void> = [
    state => { (state as unknown as Record<string, unknown>).settlement = null; },
    state => { (state as unknown as Record<string, unknown>).settlement = []; },
    state => { state.settlement!.nextBuildingId = 99; },
    state => { state.settlement!.buildings[1].id = 1; },
    state => { state.settlement!.buildings[0].id = 0; },
    state => { state.settlement!.buildings[0].id = 0.5; },
    state => { state.settlement!.buildings[1].slot = 0; },
    state => { state.settlement!.buildings[0].slot = -1; },
    state => { state.settlement!.buildings[0].slot = 2; },
    state => { state.settlement!.buildings[0].slot = 0.5; },
    state => { state.settlement!.buildings[0].level = 4; },
    state => { state.settlement!.buildings[0].level = 0; },
    state => { state.settlement!.buildings[0].type = 'greenhouse'; },
    state => { (state.settlement!.buildings[0] as unknown as Record<string, unknown>).type = 'free-loot'; },
    state => { state.settlement!.buildings[0].startedAt = null; },
    state => { state.settlement!.buildings[0].readyAt = null; },
    state => { state.settlement!.buildings[0].startedAt = state.totalMinutes + 1; },
    state => { state.settlement!.buildings[0].readyAt! -= 1; },
    state => { state.settlement!.buildings[0].readyAt = -1; },
    state => { state.settlement!.stats!.productions = -1; },
    state => { state.settlement!.stats!.collections = 0.5; },
    state => { state.settlement!.stats!.collections = 100_000_001; },
    state => { (state.settlement as unknown as Record<string, unknown>).stats = null; },
    state => { (state.settlement!.stats as unknown as Record<string, unknown>).freeCoins = 1; },
  ];
  for (const mutate of mutations) {
    const state = structuredClone(original);
    mutate(state);
    const before = JSON.stringify(state);
    storage.setItem(SAVE_KEY, before);
    assert.equal(loadGame(storage), null, before);
    assert.equal(saveGame(state, storage), false, before);
    assert.equal(JSON.stringify(state), before);
  }
});
