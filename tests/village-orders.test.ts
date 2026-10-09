import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceTime, createGame, loadGame, performAction, setCompanionTeam, SAVE_KEY, saveGame, type GameState, type SaveStorage } from '../src/game.ts';
import { buildFacility, collectProduction, getHighestFacilityLevel, replaceFacility, startProduction, upgradeFacility } from '../src/settlement.ts';
import { fulfillVillageOrder, getVillageOrder } from '../src/village-orders.ts';

function memoryStorage(): SaveStorage {
  const values = new Map<string, string>();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); } };
}

test('older saves reveal the first request without granting materials or invented delivery records', () => {
  const old = createGame();
  delete old.villageOrders;
  const storage = memoryStorage();
  storage.setItem(SAVE_KEY, JSON.stringify(old));
  const loaded = loadGame(storage)!;
  assert.ok(loaded);
  assert.equal(loaded.villageOrders, undefined);
  assert.deepEqual(loaded.resources, old.resources);
  assert.equal(loaded.xp, old.xp);
  const order = getVillageOrder(loaded);
  assert.equal(order.id, 'village-order-1');
  assert.equal(order.sequence, 1);
  assert.deepEqual(order.costs, { water: 3 });
  assert.deepEqual(getVillageOrder(loaded), order);
  assert.deepEqual(loaded, old);
});

test('an earned production batch funds exactly one request exchange and a new sequence', () => {
  let state = createGame();
  state.resources.water = 0;
  state = buildFacility(state, 'waterworks', 0).state;
  state = startProduction(state, 1).state;
  const current = getVillageOrder(state);
  assert.equal(current.ready, false);
  assert.deepEqual(current.progress, [{ resource: 'water', current: 0, target: 3 }]);
  const refused = fulfillVillageOrder(state, current.id);
  assert.equal(refused.ok, false);
  assert.equal(refused.state, state);
  state = collectProduction(advanceTime(state, 90), 1).state;
  assert.equal(state.resources.water, 4);
  const before = JSON.stringify(state);
  const delivered = fulfillVillageOrder(state, current.id);
  assert.equal(delivered.ok, true);
  assert.equal(JSON.stringify(state), before);
  assert.equal(delivered.state.resources.water, 1);
  assert.equal(delivered.state.resources.wood, state.resources.wood + 8);
  assert.equal(delivered.state.resources.scrap, state.resources.scrap + 3);
  assert.equal(delivered.state.xp, state.xp + 12);
  assert.equal(delivered.state.villageOrders!.completed, 1);
  assert.equal(getVillageOrder(delivered.state).id, 'village-order-2');
  assert.deepEqual(getVillageOrder(delivered.state).costs, { food: 5 });
  const stale = fulfillVillageOrder(delivered.state, current.id);
  assert.equal(stale.ok, false);
  assert.equal(stale.state, delivered.state);
  assert.equal(saveGame(delivered.state, memoryStorage()), true);
});

test('all three requests pay their exact costs, repeat with new tokens, and carry counter through reload', () => {
  let state = createGame();
  state.resources.wood = 100;
  state.resources.food = 100;
  state.resources.water = 100;
  state.xp = 110;
  const initial = structuredClone(state);
  const tokens: string[] = [];
  for (let index = 0; index < 3; index++) {
    const order = getVillageOrder(state);
    tokens.push(order.id);
    const delivered = fulfillVillageOrder(state, order.id);
    assert.equal(delivered.ok, true);
    state = delivered.state;
  }
  assert.equal(state.resources.water, initial.resources.water - 5);
  assert.equal(state.resources.food, initial.resources.food - 5);
  assert.equal(state.resources.wood, initial.resources.wood + 8 + 10 - 12);
  assert.equal(state.resources.scrap, initial.resources.scrap + 3 + 5 + 8);
  assert.equal(state.xp, initial.xp + 47);
  assert.equal(state.level, 2);
  assert.equal(state.totalMinutes, initial.totalMinutes);
  assert.equal(state.energy, initial.energy);
  const repeat = getVillageOrder(state);
  assert.equal(repeat.name, getVillageOrder(initial).name);
  assert.equal(repeat.id, 'village-order-4');
  assert.equal(fulfillVillageOrder(state, tokens[0]).ok, false);
  const storage = memoryStorage();
  assert.equal(saveGame(state, storage), true);
  const loaded = loadGame(storage)!;
  assert.equal(loaded.villageOrders!.completed, 3);
  assert.equal(getVillageOrder(loaded).id, repeat.id);
  assert.equal(fulfillVillageOrder(loaded, repeat.id).ok, true);
});

test('requests refuse insufficient second ingredients, expeditions, stale tokens, and full reward storage atomically', () => {
  const state = createGame();
  state.villageOrders = { completed: 2 };
  state.resources.wood = 12;
  state.resources.water = 1;
  const order = getVillageOrder(state);
  const before = JSON.stringify(state);
  assert.equal(fulfillVillageOrder(state, order.id).state, state);
  assert.equal(fulfillVillageOrder(state, 'village-order-999').state, state);
  assert.equal(JSON.stringify(state), before);
  state.resources.water = 2;
  state.expedition = { id: 1, stage: 1 };
  assert.equal(fulfillVillageOrder(state, order.id).state, state);
  state.expedition = null;
  state.resources.scrap = 100_000_000;
  assert.equal(fulfillVillageOrder(state, order.id).state, state);
  state.resources.scrap = 0;
  state.xp = 100_000_000;
  assert.equal(fulfillVillageOrder(state, order.id).state, state);
});

test('save validation rejects malformed optional progress instead of silently resetting paid history', () => {
  const storage = memoryStorage();
  for (const invalid of [null, [], {}, { completed: -1 }, { completed: 1.5 }, { completed: '1' }, { completed: 100_000_001 }, { completed: 1, extra: true }]) {
    const value = { ...createGame(), villageOrders: invalid };
    storage.setItem(SAVE_KEY, JSON.stringify(value));
    assert.equal(loadGame(storage), null, JSON.stringify(invalid));
    assert.equal(saveGame(value as GameState, storage), false, JSON.stringify(invalid));
  }
});

test('request descriptions and costs can be rendered without granting mutation access to shared recipes', () => {
  const state = createGame();
  const order = getVillageOrder(state);
  order.costs.water = 999;
  order.rewards.resources.wood = 999;
  order.progress[0].target = 999;
  const fresh = getVillageOrder(state);
  assert.equal(fresh.costs.water, 3);
  assert.equal(fresh.rewards.resources.wood, 8);
  assert.equal(fresh.progress[0].target, 3);
  assert.match(fresh.sourceHint, /정수소/);
  const action = performAction(state, 'pet').state;
  action.villageOrders!.completed = 8;
  assert.equal(state.villageOrders!.completed, 0);
});

test('a paid delivery preserves replaced Lv5 history, three-member formation records and detached animal progress through reload', () => {
  let state = createGame();
  state.resources.wood = 10_000; state.resources.scrap = 10_000;
  state.resources.food = 1_000; state.resources.water = 1_000;
  for (let deck = 1; deck < 5; deck++) {
    const expanded = performAction(state, 'expand');
    assert.equal(expanded.ok, true, expanded.message);
    state = expanded.state;
  }
  const built = buildFacility(state, 'waterworks', 0);
  assert.equal(built.ok, true); state = built.state;
  for (const level of [2, 3, 4, 5]) {
    const improved = upgradeFacility(state, 1);
    assert.equal(improved.ok, true);
    state = improved.state;
    assert.equal(getHighestFacilityLevel(state), level);
  }
  const replaced = replaceFacility(state, 1, 'kitchen');
  assert.equal(replaced.ok, true); state = replaced.state;
  assert.equal(state.settlement!.buildings[0].level, 1);
  assert.equal(getHighestFacilityLevel(state), 5, 'the lifetime Lv5 record survives paid replacement');
  state.companions = { dog: { health: 46, xp: 79 }, cat: { health: 71, xp: 159 } };
  state.animalReserve = { rabbit: { health: 31, xp: 80 }, fox: { health: 0, xp: 160 }, boar: { health: 65, xp: 240 }, owl: { health: 12, xp: 320 } };
  const three = setCompanionTeam(state, ['dog', 'cat', 'rabbit']);
  assert.equal(three.ok, true); state = three.state;
  const two = setCompanionTeam(state, ['fox', 'owl']);
  assert.equal(two.ok, true); state = two.state;
  assert.equal(state.maxCompanionTeamSize, 3);
  const before = JSON.stringify(state), order = getVillageOrder(state);
  const delivery = fulfillVillageOrder(state, order.id);
  assert.equal(delivery.ok, true);
  const next = delivery.state;
  assert.equal(JSON.stringify(state), before, 'fulfilling a request cannot alter the original village');
  assert.equal(next.resources.water, state.resources.water - 3);
  assert.equal(next.resources.wood, state.resources.wood + 8);
  assert.equal(next.resources.scrap, state.resources.scrap + 3);
  assert.equal(next.xp, state.xp + 12);
  assert.equal(next.totalMinutes, state.totalMinutes);
  assert.equal(next.energy, state.energy);
  for (const key of ['facilityHistory', 'companions', 'animalReserve', 'companionTeam'] as const) {
    assert.deepEqual(next[key], state[key], `${key} retains every earned value`);
    assert.notEqual(next[key], state[key], `${key} is copied independently`);
  }
  assert.equal(next.facilityHistory!.highestFacilityLevel, 5);
  assert.equal(next.maxCompanionTeamSize, 3);
  assert.notEqual(next.facilityHistory!.builtTypes, state.facilityHistory!.builtTypes);
  assert.notEqual(next.facilityHistory!.upgradedFacilityIds, state.facilityHistory!.upgradedFacilityIds);
  for (const id of ['dog', 'cat'] as const) assert.notEqual(next.companions![id], state.companions![id]);
  for (const id of ['rabbit', 'fox', 'boar', 'owl'] as const) assert.notEqual(next.animalReserve![id], state.animalReserve![id]);
  const storage = memoryStorage();
  assert.equal(saveGame(next, storage), true);
  const reloaded = loadGame(storage)!;
  assert.ok(reloaded);
  for (const key of ['facilityHistory', 'maxCompanionTeamSize', 'companions', 'animalReserve', 'companionTeam', 'villageOrders', 'resources', 'xp'] as const) {
    assert.deepEqual(reloaded[key], next[key], `${key} survives delivery and reload without healing or XP gifts`);
  }
  assert.equal(getHighestFacilityLevel(reloaded), 5);
  assert.equal(fulfillVillageOrder(reloaded, order.id).state, reloaded, 'the saved delivery token cannot award twice');
  next.facilityHistory!.highestFacilityLevel = 4;
  next.facilityHistory!.builtTypes.push('watchtower');
  next.companionTeam!.pop();
  next.companions!.dog.health = 0;
  next.animalReserve!.rabbit.xp = 720;
  assert.equal(JSON.stringify(state), before, 'changing the returned nested records cannot alter the input');
  assert.equal(reloaded.facilityHistory!.highestFacilityLevel, 5);
  assert.equal(reloaded.animalReserve!.rabbit.xp, 80);
});
