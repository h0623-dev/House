import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceTime, beginHunt, createGame, expansionCost, loadGame, performAction, saveGame,
  type GameState, type SaveStorage } from '../src/game.ts';
import { claimGrowthQuest, getActiveGrowthQuest } from '../src/growth-quests.ts';
import { BUILDINGS, buildFacility, buildTruckFloor, collectProduction, getFloorSlots, getSettlement,
  isFacilitySlotAvailable, startProduction } from '../src/settlement.ts';
import { getVillageHub, type VillageAdvice } from '../src/village-guide.ts';

function claimCurrent(state: GameState): GameState {
  const quest = getActiveGrowthQuest(state)!;
  assert.equal(quest.status, 'ready', quest.id);
  const result = claimGrowthQuest(state, quest.id);
  assert.equal(result.ok, true, result.message);
  return result.state;
}
function action(state: GameState, kind: 'gather' | 'harvest' | 'plant' | 'water' | 'expand', plotId?: number): GameState {
  const result = performAction(state, kind, plotId);
  assert.equal(result.ok, true, result.message);
  return result.state;
}
function availableSlot(state: GameState, floor: 1 | 2 | 3 = 1): number {
  const slot = getFloorSlots(state, floor).find(candidate => isFacilitySlotAvailable(state, candidate));
  assert.notEqual(slot, undefined);
  return slot!;
}
function reachedWaterworks(): GameState {
  let state = claimCurrent(action(createGame(), 'gather'));
  return claimCurrent(action(state, 'harvest', 1));
}
function reachedProduction(): GameState {
  let state = reachedWaterworks();
  const result = buildFacility(state, 'waterworks', availableSlot(state));
  assert.equal(result.ok, true);
  return claimCurrent(result.state);
}
function reachedExpansion(): GameState {
  let state = reachedProduction();
  state = startProduction(state, 1).state;
  state = collectProduction(advanceTime(state, BUILDINGS.waterworks.minutes), 1).state;
  state = claimCurrent(state);
  state = action(action(state, 'plant', 1), 'plant', 3);
  state = claimCurrent(state);
  state = action(action(state, 'water', 1), 'water', 3);
  state = claimCurrent(state);
  state.resources.wood = 500; state.resources.scrap = 500;
  const result = buildFacility(state, 'kitchen', availableSlot(state));
  assert.equal(result.ok, true);
  return claimCurrent(result.state);
}
function fundedGame(deckLevel: number): GameState {
  let state = createGame();
  state.resources.wood = 10_000; state.resources.scrap = 10_000;
  state.resources.food = 10_000; state.resources.water = 10_000;
  while (state.deckLevel < deckLevel) {
    if (state.energy < 15) state = performAction(state, 'rest').state;
    state = action(state, 'expand');
  }
  return state;
}
function targetKinds(advice: VillageAdvice[]): string[] { return advice.map(item => item.target.kind); }

test('the new village hub is a read-only view of real progress and current objective', () => {
  const state = createGame(), before = JSON.stringify(state), hub = getVillageHub(state);
  assert.deepEqual(hub.primary.target, { kind: 'quest', questId: 'road-supplies' });
  assert.deepEqual(hub.investment.target, { kind: 'build', buildingType: 'waterworks' });
  assert.equal(hub.summary.readyPlots, 1); assert.equal(hub.summary.floorCount, 1);
  assert.equal(hub.summary.totalFacilities, 0); assert.equal(hub.summary.freeSlots, 2);
  assert.ok(hub.activities.length <= 3);
  assert.equal(JSON.stringify(state), before);
  hub.primary.progress!.current = 90;
  assert.equal(getVillageHub(state).primary.progress!.current, 0);
});

test('earned growth rewards remain the primary action without being granted by rendering', () => {
  const state = action(createGame(), 'gather'), before = JSON.stringify(state), hub = getVillageHub(state);
  assert.equal(hub.primary.cta, '보상 받기');
  assert.deepEqual(hub.primary.target, { kind: 'quest', questId: 'road-supplies' });
  assert.equal(JSON.stringify(state), before);
  assert.deepEqual(state.growthQuests!.claimed, []);
});

test('a construction objective routes to its actual missing material and restores the objective when funded', () => {
  const state = reachedWaterworks();
  state.resources.wood = 0; state.resources.scrap = BUILDINGS.waterworks.scrap;
  assert.equal(getVillageHub(state).primary.target.kind, 'chop');
  assert.match(getVillageHub(state).primary.detail, /목재 12개/);
  state.resources.wood = BUILDINGS.waterworks.wood;
  assert.deepEqual(getVillageHub(state).primary.target, { kind: 'quest', questId: 'rainwater-home' });
  state.resources.wood = 0; state.energy = 9;
  assert.equal(getVillageHub(state).primary.target.kind, 'rest');
});

test('a collection objective starts an idle facility, shows the saved running clock, then offers its earned output', () => {
  let state = reachedProduction();
  assert.deepEqual(getVillageHub(state).primary.target, { kind: 'facility', id: 1, operation: 'start' });
  state = startProduction(state, 1).state;
  const before = JSON.stringify(state), working = getVillageHub(state);
  assert.deepEqual(working.primary.target, { kind: 'facility', id: 1, operation: 'collect' });
  assert.equal(working.primary.cta, '생산 확인'); assert.match(working.primary.detail, /12초/);
  assert.equal(working.summary.workingFacilities, 1);
  assert.ok(!working.activities.some(item => item.target.kind === 'facility' && item.target.id === 1));
  assert.equal(JSON.stringify(state), before);
  state = advanceTime(state, BUILDINGS.waterworks.minutes);
  assert.equal(getVillageHub(state).primary.cta, '물자 받기');
  assert.equal(getVillageHub(state).summary.readyFacilities, 1);
});

test('a harvest objective with unwatered growing crops recommends caring for those actual crops', () => {
  let state = claimCurrent(action(createGame(), 'gather'));
  state.plots[0].plantedAt = state.totalMinutes;
  state.plots[0].watered = false;
  const hub = getVillageHub(state);
  assert.deepEqual(hub.primary.target, { kind: 'farm', mode: 'water' });
  state.resources.water = 0;
  assert.equal(getVillageHub(state).primary.target.kind, 'gather');
});

test('an unaffordable deck objective directs to missing supplies or recovery before reopening expansion', () => {
  let state = reachedExpansion();
  const cost = expansionCost(state);
  state.resources.wood = cost.wood; state.resources.scrap = 0;
  assert.equal(getVillageHub(state).primary.target.kind, 'gather');
  state.energy = 14;
  assert.equal(getVillageHub(state).primary.target.kind, 'rest');
  state.energy = 85; state.resources.scrap = cost.scrap;
  assert.deepEqual(getVillageHub(state).primary.target, { kind: 'quest', questId: 'wider-deck' });
});

test('a water shortage uses an earned matching facility batch before sending the player out to gather', () => {
  let state = claimCurrent(action(createGame(), 'gather'));
  state = buildFacility(state, 'waterworks', availableSlot(state)).state;
  state = startProduction(state, 1).state;
  state = advanceTime(state, BUILDINGS.waterworks.minutes);
  state.plots[0].plantedAt = state.totalMinutes; state.plots[0].watered = false;
  state.resources.water = 0;
  const advice = getVillageHub(state).primary;
  assert.deepEqual(advice.target, { kind: 'facility', id: 1, operation: 'collect' });
  assert.match(advice.detail, /물 1개/);
});

test('a watering objective with all plots already tended opens a real planting opportunity through harvest', () => {
  let state = reachedProduction();
  state = startProduction(state, 1).state;
  state = claimCurrent(collectProduction(advanceTime(state, BUILDINGS.waterworks.minutes), 1).state);
  state = claimCurrent(action(action(state, 'plant', 1), 'plant', 3));
  // The current watering objective has no newly recorded waterings yet; imported crops may already be cared for.
  state.plots.forEach(plot => { plot.watered = true; });
  state = advanceTime(state, 500);
  assert.equal(getActiveGrowthQuest(state)!.id, 'tender-watering');
  assert.deepEqual(getVillageHub(state).primary.target, { kind: 'farm', mode: 'harvest' });
});

test('activities expose only affordable starts and paid deliveries, never a second claim for running facilities', () => {
  let state = reachedProduction();
  state = buildFacility(state, 'kitchen', availableSlot(state)).state;
  state.resources.water = 0; state.resources.food = 0;
  const kitchen = getSettlement(state).buildings.find(building => building.type === 'kitchen')!;
  const hub = getVillageHub(state);
  assert.ok(!hub.activities.some(item => item.target.kind === 'facility' && item.target.id === kitchen.id && item.target.operation === 'start'));
  assert.ok(!targetKinds(hub.activities).includes('orders'));
  assert.ok(!targetKinds(hub.activities).includes('water'));
  state.resources.water = 3;
  assert.ok(targetKinds(getVillageHub(state).activities).includes('orders'));
});

test('floor investment follows actual deck unlock and completed paid floors without preselecting a third floor', () => {
  const level3 = getVillageHub(fundedGame(3));
  assert.notEqual(level3.investment.target.kind, 'floors');
  let state = fundedGame(4);
  let hub = getVillageHub(state);
  assert.equal(hub.investment.target.kind, 'floors'); assert.match(hub.investment.title, /2층/);
  state = buildTruckFloor(state).state;
  hub = getVillageHub(state);
  assert.equal(hub.summary.floorCount, 2); assert.notEqual(hub.investment.target.kind, 'floors');
  while (state.deckLevel < 7) {
    if (state.energy < 15) state = performAction(state, 'rest').state;
    state = action(state, 'expand');
  }
  assert.match(getVillageHub(state).investment.title, /3층/);
});

test('free facility slots exclude buildings, home foundations and reserved stairs on all purchased floors', () => {
  let state = buildTruckFloor(fundedGame(4)).state;
  const first = availableSlot(state), upper = availableSlot(state, 2);
  const before = getVillageHub(state).summary.freeSlots;
  state = buildFacility(state, 'waterworks', first).state;
  state = buildFacility(state, 'waterworks', upper).state;
  assert.equal(getVillageHub(state).summary.freeSlots, before - 2);
  assert.equal(getVillageHub(state).summary.totalFacilities, 2);
});

test('an expedition suppresses village mutations and directs the player back to their active battle', () => {
  const state = beginHunt(createGame(), 1).state, hub = getVillageHub(state);
  assert.equal(hub.primary.target.kind, 'hunt');
  assert.deepEqual(hub.activities, []);
});

test('viewing recommendations preserves paid floors, identities, seed quantities and saved production across reload', () => {
  let state = buildTruckFloor(fundedGame(4)).state;
  state = buildFacility(state, 'waterworks', availableSlot(state, 2)).state;
  const id = getSettlement(state).buildings[0].id;
  state = startProduction(state, id).state;
  const before = JSON.stringify(state);
  getVillageHub(state); getVillageHub(advanceTime(state, 5));
  assert.equal(JSON.stringify(state), before);
  let saved = '';
  const storage: SaveStorage = { getItem: () => saved || null, setItem: (_key, value) => { saved = value; } };
  assert.equal(saveGame(state, storage), true);
  const loaded = loadGame(storage)!;
  assert.equal(getVillageHub(loaded).summary.floorCount, 2);
  assert.deepEqual(getSettlement(loaded), getSettlement(state));
  assert.deepEqual(loaded.seedInventory, state.seedInventory);
  assert.deepEqual(loaded.companions, state.companions);
});
