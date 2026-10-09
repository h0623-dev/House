import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceTime, beginHunt, createGame, loadGame, performAction, SAVE_KEY, saveGame, tick, type GameState, type Resource, type SaveStorage } from '../src/game.ts';
import { BUILDINGS, BUILDING_TYPES, buildFacility, collectProduction, getBuiltTypes, getUpgradedFacilityRecord, getFacilityHistory, getHighestFacilityLevel, validateFacilityHistory, getProductionCost, getProductionMinutes, getSettlement, getSettlementGoals, getUnlockedSlots, getUpgradeCost, moveFacility, replaceFacility, startProduction, upgradeFacility, validateSettlement, type BuildingType } from '../src/settlement.ts';
import { GAME_MINUTES_PER_SECOND } from '../src/game-time.ts';

function memoryStorage(): SaveStorage {
  const values = new Map<string, string>();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); } };
}
function fundedGame(deckLevel = 1): GameState {
  let state = createGame();
  state.resources.wood = 10_000; state.resources.scrap = 10_000;
  state.resources.food = 10_000; state.resources.water = 10_000;
  for (let level = 1; level < deckLevel; level++) {
    if (state.energy < 15) state = performAction(state, 'rest').state;
    const expanded = performAction(state, 'expand');
    assert.equal(expanded.ok, true, expanded.message);
    state = expanded.state;
  }
  return state;
}
function withBuilding(type: BuildingType = 'waterworks'): GameState {
  const result = buildFacility(fundedGame(BUILDINGS[type].unlockLevel), type, 0);
  assert.equal(result.ok, true);
  return result.state;
}
function withBuildingLevel(type: BuildingType, level: number): GameState {
  let state = withBuilding(type);
  for (let current = 1; current < level; current++) {
    const upgraded = upgradeFacility(state, 1);
    assert.equal(upgraded.ok, true, `${type}: upgrade to Lv.${current + 1}`);
    state = upgraded.state;
  }
  return state;
}

const FACILITY_EXPECTATIONS = {
  waterworks: { minutes: 90, wood: 12, scrap: 4, resource: 'water', amount: 4, recipe: {} },
  kitchen: { minutes: 120, wood: 16, scrap: 6, resource: 'food', amount: 5, recipe: { water: 2 } },
  workshop: { minutes: 150, wood: 22, scrap: 10, resource: 'scrap', amount: 4, recipe: { wood: 3 } },
  petHouse: { minutes: 120, wood: 18, scrap: 6, resource: 'wood', amount: 6, recipe: { food: 1 } },
  greenhouse: { minutes: 240, wood: 28, scrap: 12, resource: 'food', amount: 6, recipe: { water: 2 } },
  watchtower: { minutes: 180, wood: 26, scrap: 14, resource: 'scrap', amount: 3, recipe: {} },
} as const;

test('new settlements have two independent building slots per deck level and read-only snapshots', () => {
  const state = createGame();
  assert.deepEqual(getSettlement(state), { buildings: [], nextBuildingId: 1, stats: { productions: 0, collections: 0 } });
  assert.equal(getUnlockedSlots(state), 2);
  assert.equal(getUnlockedSlots(fundedGame(6)), 12);
  assert.equal(getUnlockedSlots(fundedGame(8)), 16);
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

test('all six facilities at levels 1–5 charge a batch once and complete at the faster level-specific boundary', () => {
  for (const type of BUILDING_TYPES) {
    const expected = FACILITY_EXPECTATIONS[type], recipe: Partial<Record<Resource, number>> = expected.recipe;
    assert.equal(BUILDINGS[type].minutes, expected.minutes, `${type}: preserve the legacy stored duration definition`);
    assert.equal(BUILDINGS[type].maxLevel, 5, type);
    for (const [level, denominator] of [[1, 2], [2, 2.5], [3, 3], [4, 3.5], [5, 4]]) {
      const initial = withBuildingLevel(type, level), before = JSON.stringify(initial);
      const duration = expected.minutes / denominator;
      const started = startProduction(initial, 1);
      assert.equal(started.ok, true, `${type}/Lv.${level}`);
      const building = getSettlement(started.state).buildings[0];
      assert.equal(building.startedAt, initial.totalMinutes);
      assert.equal(building.readyAt, initial.totalMinutes + duration);
      assert.equal(getProductionMinutes(building), duration);
      assert.equal(started.state.totalMinutes, initial.totalMinutes);
      assert.equal(started.state.energy, initial.energy);
      assert.equal(started.state.health, initial.health);
      for (const resource of ['wood', 'scrap', 'food', 'water', 'seeds'] as const) {
        assert.equal(started.state.resources[resource], initial.resources[resource] - (recipe[resource] ?? 0) * level, `${type}/Lv.${level}/${resource}`);
      }
      assert.equal(JSON.stringify(initial), before);
      const paid = JSON.stringify(started.state), duplicate = startProduction(started.state, 1);
      assert.equal(duplicate.ok, false);
      assert.equal(duplicate.state, started.state);
      assert.equal(JSON.stringify(started.state), paid, `${type}/Lv.${level}: retry does not charge the recipe again`);

      const almost = tick(started.state, duration / GAME_MINUTES_PER_SECOND - 0.125);
      assert.ok(almost.totalMinutes < building.readyAt!, `${type}/Lv.${level}: not ready 125ms early`);
      const early = collectProduction(almost, 1);
      assert.equal(early.ok, false);
      assert.equal(early.state, almost);
      const ready = tick(almost, (building.readyAt! - almost.totalMinutes) / GAME_MINUTES_PER_SECOND);
      assert.equal(ready.totalMinutes, building.readyAt, `${type}/Lv.${level}: exact completion boundary`);
      const collected = collectProduction(ready, 1);
      assert.equal(collected.ok, true, `${type}/Lv.${level}`);
      assert.equal(collected.state.resources[expected.resource], ready.resources[expected.resource] + expected.amount * level);
      assert.equal(collected.state.totalMinutes, ready.totalMinutes);
      assert.equal(collected.state.energy, ready.energy);
      assert.equal(getSettlement(collected.state).buildings[0].startedAt, null);
      assert.equal(getSettlement(collected.state).buildings[0].readyAt, null);
      assert.deepEqual(getSettlement(collected.state).stats, { productions: 1, collections: 1 });
      const twice = collectProduction(collected.state, 1);
      assert.equal(twice.ok, false); assert.equal(twice.state, collected.state);
      const storage = memoryStorage();
      assert.equal(saveGame(collected.state, storage), true, `${type}/Lv.${level}`);
      const loaded = loadGame(storage)!;
      assert.equal(getSettlement(loaded).buildings[0].level, level);
      assert.deepEqual(loaded.resources, collected.state.resources);
      assert.deepEqual(getSettlement(loaded).stats, { productions: 1, collections: 1 });
    }
  }
});

test('production is capped at one batch and can only be collected once at the exact ready boundary', () => {
  const initial = startProduction(withBuilding(), 1).state;
  const duplicate = startProduction(initial, 1);
  assert.equal(duplicate.ok, false); assert.equal(duplicate.state, initial);
  const almost = tick(initial, getProductionMinutes(getSettlement(initial).buildings[0]) / GAME_MINUTES_PER_SECOND - 0.5);
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

test('all facilities improve through level five using reduced exact costs and retain paid recipe scaling', () => {
  for (const type of BUILDING_TYPES) {
    let state = withBuilding(type);
    const expected = FACILITY_EXPECTATIONS[type];
    for (const [level, multiplier] of [[2, 2], [3, 2], [4, 3], [5, 3]]) {
      const before = state, snapshot = JSON.stringify(before);
      const cost = getUpgradeCost(getSettlement(state).buildings[0]);
      assert.deepEqual(cost, { wood: expected.wood * multiplier, scrap: expected.scrap * multiplier });
      const upgraded = upgradeFacility(state, 1);
      assert.equal(upgraded.ok, true);
      state = upgraded.state;
      assert.equal(getSettlement(state).buildings[0].level, level);
      assert.equal(state.resources.wood, before.resources.wood - cost.wood);
      assert.equal(state.resources.scrap, before.resources.scrap - cost.scrap);
      assert.equal(state.energy, before.energy);
      assert.equal(state.totalMinutes, before.totalMinutes);
      assert.equal(JSON.stringify(before), snapshot);
    }
    const maxed = upgradeFacility(state, 1);
    assert.equal(maxed.ok, false); assert.equal(maxed.state, state);
    const recipe = Object.fromEntries(Object.entries(expected.recipe).map(([resource, amount]) => [resource, amount * 5]));
    assert.deepEqual(getProductionCost(getSettlement(state).buildings[0]), recipe);
    assert.equal(getFacilityHistory(state).highestFacilityLevel, 5);
    assert.equal(saveGame(state, memoryStorage()), true);
  }
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
  const ready = advanceTime(started, getProductionMinutes(getSettlement(started).buildings[0]));
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
    state => { state.settlement!.buildings[0].level = 6; },
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

test('all paid v16 active and ready batches keep their absolute clocks and award one original-level batch', () => {
  for (const type of BUILDING_TYPES) for (const level of [1, 2, 3]) {
    const initial = withBuildingLevel(type, level), definition = BUILDINGS[type];
    const started = startProduction(initial, 1).state;
    const oldJob = started.settlement!.buildings[0];
    oldJob.readyAt = oldJob.startedAt! + definition.minutes;
    const exact = structuredClone(oldJob), beforeResources = { ...started.resources }, memory = memoryStorage();
    assert.equal(saveGame(started, memory), true, `${type} Lv.${level}: legacy active job is accepted`);
    const loaded = loadGame(memory)!;
    assert.deepEqual(loaded.settlement!.buildings[0], exact, 'loading does not replace paid legacy timestamps with the faster formula');
    assert.deepEqual(loaded.resources, beforeResources);
    const early = tick(loaded, definition.minutes / GAME_MINUTES_PER_SECOND - .125);
    assert.equal(collectProduction(early, 1).state, early, 'old job does not complete at the new shorter duration');
    const ready = tick(early, .125);
    assert.equal(ready.totalMinutes, exact.readyAt);
    assert.equal(saveGame(ready, memory), true);
    const collected = collectProduction(loadGame(memory)!, 1);
    assert.equal(collected.ok, true);
    assert.equal(collected.state.resources[definition.yieldResource], ready.resources[definition.yieldResource] + definition.yieldAmount * level);
    assert.equal(collectProduction(collected.state, 1).state, collected.state);
    const restarted = startProduction(collected.state, 1);
    assert.equal(restarted.ok, true);
    const job = restarted.state.settlement!.buildings[0];
    assert.equal(job.readyAt! - job.startedAt!, getProductionMinutes(job));
  }
});

test('completed finite paid batches are preserved without timestamp repair while malformed active clocks are rejected', () => {
  const state = startProduction(withBuildingLevel('kitchen', 3), 1).state;
  const building = state.settlement!.buildings[0];
  building.startedAt = state.totalMinutes - 17.5;
  building.readyAt = state.totalMinutes - .25;
  const before = JSON.stringify(state), memory = memoryStorage();
  assert.equal(saveGame(state, memory), true);
  const loaded = loadGame(memory)!;
  assert.deepEqual(loaded.settlement!.buildings[0], building);
  assert.deepEqual(loaded.resources, state.resources);
  const got = collectProduction(loaded, 1);
  assert.equal(got.ok, true);
  assert.equal(got.state.resources.food, state.resources.food + 15);
  assert.equal(JSON.stringify(state), before);
  for (const patch of [{ startedAt: building.readyAt }, { readyAt: -1 }, { readyAt: NaN }, { readyAt: Infinity },
    { startedAt: state.totalMinutes + 1 }, { readyAt: state.totalMinutes + 31 }]) {
    const invalid = structuredClone(state);
    Object.assign(invalid.settlement!.buildings[0], patch);
    assert.equal(validateSettlement(invalid.settlement, invalid), false);
    assert.equal(saveGame(invalid, memoryStorage()), false);
  }
});

test('sixteen paid slots and fifth-level facilities round trip while lifetime maximum survives replacement', () => {
  let state = fundedGame(8);
  for (let slot = 0; slot < 16; slot++) {
    const built = buildFacility(state, 'waterworks', slot);
    assert.equal(built.ok, true, built.message);
    state = built.state;
  }
  assert.equal(state.settlement!.nextBuildingId, 17);
  assert.equal(state.settlement!.buildings.length, 16);
  assert.equal(buildFacility(state, 'waterworks', 16).state, state);
  for (let level = 1; level < 5; level++) {
    const upgraded = upgradeFacility(state, 16);
    assert.equal(upgraded.ok, true);
    state = upgraded.state;
  }
  assert.equal(getHighestFacilityLevel(state), 5);
  assert.deepEqual(state.facilityHistory!.upgradedFacilityIds, [16]);
  const memory = memoryStorage();
  assert.equal(saveGame(state, memory), true);
  const loaded = loadGame(memory)!;
  assert.equal(getHighestFacilityLevel(loaded), 5);
  const replaced = replaceFacility(loaded, 16, 'kitchen');
  assert.equal(replaced.ok, true);
  assert.equal(replaced.state.settlement!.buildings[15].level, 1);
  assert.equal(getHighestFacilityLevel(replaced.state), 5);
  assert.equal(saveGame(replaced.state, memory), true);
  assert.equal(getHighestFacilityLevel(loadGame(memory)!), 5);
  for (const value of [null, 0, 6, 4.5, '5']) {
    const invalid = structuredClone(state);
    (invalid.facilityHistory as unknown as Record<string, unknown>).highestFacilityLevel = value;
    assert.equal(saveGame(invalid, memoryStorage()), false, String(value));
  }
  const contradiction = structuredClone(state);
  contradiction.facilityHistory!.highestFacilityLevel = 4;
  assert.equal(saveGame(contradiction, memoryStorage()), false, 'a recorded maximum cannot be below a current facility');
});
