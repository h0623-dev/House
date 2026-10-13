import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceTime, applyOfflineProgress, beginHunt, createGame, loadGame, performAction, SAVE_KEY, saveGame, setCompanionTeam, tick, type ActionResult, type GameState, type SaveStorage } from '../src/game.ts';
import { clonePetPassageFields, getPetPassage, setPetPassageOpen, validatePetPassage } from '../src/pet-passage.ts';
import { buildFacility, collectProduction, getProductionMinutes, startProduction } from '../src/settlement.ts';
import { claimGrowthQuest } from '../src/growth-quests.ts';
import { fulfillVillageOrder, getVillageOrder } from '../src/village-orders.ts';
import { fulfillFarmOrder, getFarmOrder } from '../src/farm-economy.ts';
import { rotateLayoutTarget } from '../src/layout-direction.ts';
import { performRoadsideAction } from '../src/roadside.ts';
import { buyShopOutfit, buyShopPet, buyShopSeed, equipShopOutfit, sellShopResource } from '../src/shop.ts';

function storage(): SaveStorage {
  const values = new Map<string, string>();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); } };
}
function success(result: ActionResult): GameState { assert.equal(result.ok, true, result.message); return result.state; }
function refused(state: GameState, run: () => ActionResult): void {
  const before = structuredClone(state), result = run();
  assert.equal(result.ok, false); assert.equal(result.state, state); assert.deepEqual(state, before);
}
function reload(state: GameState): GameState {
  const memory = storage(); assert.equal(saveGame(state, memory), true);
  const loaded = loadGame(memory); assert.ok(loaded); return loaded;
}
function withoutGate(state: GameState): Omit<GameState, 'petPassage'> {
  const { petPassage: _gate, ...rest } = state;
  return rest;
}
function actualVillage(gender: GameState['gender'] = 'female'): GameState {
  let state = success(performAction(createGame(gender), 'harvest', 1, undefined, { advanceClock: false }));
  state = success(performAction(state, 'fertilize', 2, undefined, { advanceClock: false }));
  state = success(performRoadsideAction(state, 'salvage'));
  state = success(sellShopResource(state, 'food', 3));
  state = success(buyShopSeed(state, 'corn', 1));
  return success(rotateLayoutTarget(state, { kind: 'plot', id: 1 }));
}

test('old saves keep a closed absent gate without grants, timestamps, or other saved changes', () => {
  for (const gender of ['female', 'male'] as const) {
    const old = actualVillage(gender), before = structuredClone(old), memory = storage();
    memory.setItem(SAVE_KEY, JSON.stringify(old));
    const loaded = loadGame(memory); assert.ok(loaded); assert.deepEqual(loaded, before);
    assert.equal(Object.hasOwn(loaded, 'petPassage'), false);
    const view = getPetPassage(loaded); assert.deepEqual(view, { version: 1, open: false });
    view.open = true;
    assert.deepEqual(getPetPassage(loaded), { version: 1, open: false });
    assert.deepEqual(clonePetPassageFields(loaded), {}); assert.deepEqual(loaded, before);
    assert.equal(Object.hasOwn(reload(loaded), 'petPassage'), false);
  }
});

test('only an explicit gate change is saved and opening or closing pays no resources or growth', () => {
  for (const gender of ['female', 'male'] as const) {
    const state = actualVillage(gender), before = structuredClone(state);
    const opened = success(setPetPassageOpen(state, true));
    assert.deepEqual(state, before); assert.deepEqual(opened.petPassage, { version: 1, open: true });
    assert.deepEqual(withoutGate(opened), before);
    const openedBefore = structuredClone(opened), closed = success(setPetPassageOpen(opened, false));
    assert.deepEqual(opened, openedBefore); assert.deepEqual(closed.petPassage, { version: 1, open: false });
    assert.deepEqual(withoutGate(closed), before); assert.notEqual(closed.petPassage, opened.petPassage);
    assert.equal(closed.lastSaved, state.lastSaved); assert.equal(closed.totalMinutes, state.totalMinutes);
    assert.deepEqual(reload(opened).petPassage, opened.petPassage);
    assert.deepEqual(reload(closed).petPassage, closed.petPassage);
  }
});

test('gate changes detach actual paid stock, crop batches, site cooldowns, layout, animals, and counters', () => {
  const state = actualVillage(), before = structuredClone(state), next = success(setPetPassageOpen(state, true));
  assert.deepEqual(withoutGate(next), state);
  for (const key of ['resources', 'seedInventory', 'settlement', 'layoutDirections', 'shop', 'farmEconomy', 'roadside', 'companions', 'animalReserve', 'plots', 'stats', 'log', 'quests', 'growthQuests', 'villageOrders'] as const) {
    assert.notEqual(next[key], state[key], `${key} is detached`);
  }
  next.resources.wood += 1; next.seedInventory!.corn += 1; next.shop!.coins += 1;
  next.farmEconomy!.crops.carrot += 1; next.farmEconomy!.fertilizedPlots[0].cropId = 'pumpkin';
  next.roadside!.sites.salvage.visits += 1; next.layoutDirections!.plots[0].direction = 0;
  next.companions!.dog.health = 1; next.animalReserve!.rabbit.xp = 10;
  next.plots[1].plantedAt = 0; next.stats.gathers += 1; next.log.push('detached only');
  next.growthQuests!.claimed.push('road-supplies'); next.villageOrders!.completed += 1;
  assert.deepEqual(state, before);
});

test('game clocks, farms, facilities, orders, quests, directions, roadside work, and battle commits preserve a detached gate', () => {
  const state = success(setPetPassageOpen(actualVillage(), true));
  const built = success(buildFacility(state, 'waterworks', 0));
  const started = success(startProduction(built, 1));
  const ready = advanceTime(started, getProductionMinutes(started.settlement!.buildings[0]));
  const operations: [string, GameState, (input: GameState) => GameState][] = [
    ['clock tick', state, input => tick(input, 1)],
    ['clock advance', state, input => advanceTime(input, 1)],
    ['offline baseline', state, input => applyOfflineProgress(input, 1).state],
    ['water', state, input => success(performAction(input, 'water', 2, undefined, { advanceClock: false }))],
    ['plant', state, input => success(performAction(input, 'plant', 3, 'corn', { advanceClock: false }))],
    ['facility build', state, input => success(buildFacility(input, 'waterworks', 0))],
    ['facility production', built, input => success(startProduction(input, 1))],
    ['facility collection', ready, input => success(collectProduction(input, 1))],
    ['growth reward', state, input => success(claimGrowthQuest(input, 'road-supplies'))],
    ['village delivery', state, input => success(fulfillVillageOrder(input, getVillageOrder(input).id))],
    ['crop delivery', state, input => success(fulfillFarmOrder(input, getFarmOrder(input).id))],
    ['plot direction', state, input => success(rotateLayoutTarget(input, { kind: 'plot', id: 1 }))],
    ['roadside gathering', state, input => success(performRoadsideAction(input, 'grove'))],
    ['formation', state, input => success(setCompanionTeam(input, ['cat']))],
    ['battle departure', state, input => success(beginHunt(input, 1))],
  ];
  for (const [label, input, run] of operations) {
    const before = structuredClone(input), next = run(input);
    assert.deepEqual(input, before, `${label} preserves its input`);
    assert.deepEqual(next.petPassage, input.petPassage, `${label} preserves the gate`);
    assert.notEqual(next.petPassage, input.petPassage, `${label} detaches the gate`);
    next.petPassage!.open = false; assert.deepEqual(input, before, `${label} cannot mutate the earlier gate`);
  }
});

test('resource-funded shop seed, animal, outfit, sale, and equip commits retain and detach the gate', () => {
  let funded = success(setPetPassageOpen(actualVillage(), true));
  // All coins come from existing provisions and the actual salvage action above.
  funded = success(sellShopResource(funded, 'food', funded.resources.food));
  funded = success(sellShopResource(funded, 'wood', funded.resources.wood));
  funded = success(sellShopResource(funded, 'scrap', funded.resources.scrap));
  const dressed = success(buyShopOutfit(funded, 'garden'));
  const operations: [string, GameState, (input: GameState) => ActionResult][] = [
    ['seed', funded, input => buyShopSeed(input, 'potato', 5)],
    ['pet', funded, input => buyShopPet(input, 'rabbit')],
    ['outfit', funded, input => buyShopOutfit(input, 'garden')],
    ['equip', dressed, input => equipShopOutfit(input, 'garden')],
    ['sale', dressed, input => sellShopResource(input, 'food', 1)],
  ];
  // Retain one legitimately planted crop to get sale stock through an actual harvest.
  let sale = success(performAction(dressed, 'water', 2, undefined, { advanceClock: false }));
  sale = advanceTime(sale, 200); sale = success(performAction(sale, 'harvest', 2, undefined, { advanceClock: false }));
  operations[4][1] = sale;
  for (const [label, input, run] of operations) {
    const before = structuredClone(input), next = success(run(input));
    assert.deepEqual(input, before); assert.deepEqual(next.petPassage, input.petPassage, label);
    assert.notEqual(next.petPassage, input.petPassage, label);
    next.petPassage!.open = false; assert.deepEqual(input, before);
  }
});

test('invalid gate requests, already-set states, damaged metadata, and expeditions refuse atomically', () => {
  const state = actualVillage();
  for (const value of [undefined, null, 0, 1, '', 'true', 'false', [], {}, NaN]) refused(state, () => setPetPassageOpen(state, value));
  refused(state, () => setPetPassageOpen(state, false));
  const opened = success(setPetPassageOpen(state, true)); refused(opened, () => setPetPassageOpen(opened, true));
  const closed = success(setPetPassageOpen(opened, false)); refused(closed, () => setPetPassageOpen(closed, false));
  const away = success(beginHunt(state, 1)); refused(away, () => setPetPassageOpen(away, true));
  const bad = structuredClone(state); bad.petPassage = { version: 1, open: 'yes' } as unknown as GameState['petPassage'];
  refused(bad, () => setPetPassageOpen(bad, true));
});

test('only the two exact gate keys with version one and boolean open are accepted by both save paths', () => {
  const state = actualVillage();
  const invalid = [undefined, null, false, [], {}, { version: 1 }, { open: true }, { version: 2, open: true },
    { version: '1', open: true }, { version: 1, open: 0 }, { version: 1, open: 1 }, { version: 1, open: 'false' },
    { version: 1, open: null }, { version: 1, open: NaN }, { version: 1, open: true, rewards: 1 },
    { version: 1, closed: false }, { version: 1, open: true, readyAt: 0 }];
  for (const value of invalid) {
    assert.equal(validatePetPassage(value), false);
    const next = { ...state, petPassage: value } as unknown as GameState, memory = storage();
    memory.setItem(SAVE_KEY, 'unchanged-before-refusal');
    assert.equal(saveGame(next, memory), false); assert.equal(memory.getItem(SAVE_KEY), 'unchanged-before-refusal');
    if (value !== undefined) { memory.setItem(SAVE_KEY, JSON.stringify(next)); assert.equal(loadGame(memory), null); }
    refused(next, () => setPetPassageOpen(next, true));
  }
  for (const open of [true, false]) {
    const valid = { version: 1 as const, open }; assert.equal(validatePetPassage(valid), true);
    const next = { ...state, petPassage: valid }; assert.deepEqual(reload(next).petPassage, valid);
    const copy = clonePetPassageFields(next); assert.deepEqual(copy.petPassage, valid); assert.notEqual(copy.petPassage, valid);
  }
});
