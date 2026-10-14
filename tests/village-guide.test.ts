import { waitForEnergy } from './fixtures/energy-recovery.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceTime, beginHunt, createGame, expansionCost, loadGame, performAction, saveGame,
  type GameState, type SaveStorage } from '../src/game.ts';
import { claimGrowthQuest, getActiveGrowthQuest, GROWTH_QUESTS } from '../src/growth-quests.ts';
import { BUILDINGS, buildFacility, buildTruckFloor, collectProduction, getFloorSlots, getSettlement,
  isFacilitySlotAvailable, startProduction } from '../src/settlement.ts';
import { getVillageHub, getFarmDeliveryAdvice, type VillageAdvice } from '../src/village-guide.ts';
import { fulfillFarmOrder, getFarmCropInventory, getFarmOrder, reconcileFarmEconomyFood } from '../src/farm-economy.ts';
import { getGatheringArea, getGatheringNode, performGatheringAction } from '../src/gathering.ts';

const GATHER_NOW = 1_800_000_000_000;

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
    if (state.energy < 15) state = waitForEnergy(state);
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
  assert.deepEqual(getVillageHub(state).primary.target, { kind: 'roadside', siteId: 'grove' });
  assert.match(getVillageHub(state).primary.detail, /목재 12개/);
  state.resources.wood = BUILDINGS.waterworks.wood;
  assert.deepEqual(getVillageHub(state).primary.target, { kind: 'quest', questId: 'rainwater-home' });
  state.resources.wood = 0; state.energy = 9;
  assert.equal(getVillageHub(state).primary.target.kind, 'energy');
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
  assert.deepEqual(getVillageHub(state).primary.target, { kind: 'roadside', siteId: 'spring' });
});

test('an unaffordable deck objective directs to missing supplies or recovery before reopening expansion', () => {
  let state = reachedExpansion();
  const cost = expansionCost(state);
  state.resources.wood = cost.wood; state.resources.scrap = 0;
  assert.deepEqual(getVillageHub(state).primary.target, { kind: 'roadside', siteId: 'salvage' });
  state.energy = 14;
  assert.equal(getVillageHub(state).primary.target.kind, 'energy');
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
  // The shortage fixture spends all food, including any actual typed harvest.
  reconcileFarmEconomyFood(state);
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
    if (state.energy < 15) state = waitForEnergy(state);
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

test('farm delivery recommendations follow actual harvest, paid current delivery and the next requested seed', () => {
  let state = createGame();
  const fresh = getFarmDeliveryAdvice(state), freshBefore = JSON.stringify(state);
  assert.deepEqual(fresh.target, { kind: 'farm', mode: 'harvest' });
  assert.equal(fresh.cropId, 'carrot');
  assert.equal(getFarmOrder(state).ready, false);
  assert.ok(getVillageHub(state).activities.some(advice => advice.cropId === 'carrot' && advice.target.kind === 'farm'));
  assert.equal(JSON.stringify(state), freshBefore);
  state = action(state, 'harvest', 1);
  const ready = getFarmDeliveryAdvice(state);
  assert.deepEqual(ready.target, { kind: 'farm-delivery' });
  assert.equal(ready.tag, '납품 가능');
  assert.equal(getVillageHub(state).activities[0].target.kind, 'farm-delivery');
  const beforeDelivery = JSON.stringify(state);
  getVillageHub(state);
  assert.equal(JSON.stringify(state), beforeDelivery);
  const sent = fulfillFarmOrder(state, getFarmOrder(state).id);
  assert.equal(sent.ok, true, sent.message);
  state = sent.state;
  const next = getFarmDeliveryAdvice(state);
  assert.deepEqual(next.target, { kind: 'farm', mode: 'plant', cropId: 'potato' });
  assert.equal(next.cropId, 'potato');
  assert.match(next.title, /감자/);
  assert.equal(getFarmCropInventory(state).potato, 0);
  assert.equal(getVillageHub(state).primary.target.kind, 'quest');
});

test('legacy food and growing crops never masquerade as delivery stock or cause recommendation grants', () => {
  const state = createGame();
  delete state.farmEconomy;
  state.resources.food = 100;
  state.plots[0].plantedAt = state.totalMinutes;
  state.plots[0].watered = false;
  const before = JSON.stringify(state);
  const advice = getFarmDeliveryAdvice(state);
  assert.deepEqual(advice.target, { kind: 'farm', mode: 'water' });
  assert.equal(advice.progress!.current, 0);
  assert.equal(getFarmOrder(state).ready, false);
  assert.ok(Object.values(getFarmCropInventory(state)).every(quantity => quantity === 0));
  getVillageHub(state); getVillageHub(advanceTime(state, 5));
  assert.equal(JSON.stringify(state), before);
  assert.equal(state.farmEconomy, undefined);
});

test('crop guidance preserves the required order when its seed is absent instead of suggesting another seed', () => {
  let state = action(createGame(), 'harvest', 1);
  state = fulfillFarmOrder(state, getFarmOrder(state).id).state;
  state.seedInventory!.potato = 0;
  state.resources.seeds = Object.values(state.seedInventory!).reduce((sum, quantity) => sum + quantity, 0);
  const before = JSON.stringify(state), advice = getFarmDeliveryAdvice(state);
  assert.equal(advice.cropId, 'potato');
  assert.deepEqual(advice.target, { kind: 'farm-delivery' });
  assert.equal(advice.progress!.current, 0);
  assert.match(advice.detail, /코인 19/);
  assert.equal(JSON.stringify(state), before);
});

test('seed shortages target the actual seed meadow and its paid rotating harvest resolves the seed shortage', () => {
  let state = reachedProduction();
  state = startProduction(state, 1).state;
  state = claimCurrent(collectProduction(advanceTime(state, BUILDINGS.waterworks.minutes), 1).state);
  state.seedInventory = { carrot: 0, potato: 0, tomato: 0, corn: 0, strawberry: 0, pumpkin: 0 };
  state.resources.seeds = 0;
  state.plots.forEach(plot => { plot.plantedAt = null; plot.watered = false; });
  const before = JSON.stringify(state), advice = getVillageHub(state, GATHER_NOW).primary;
  assert.deepEqual(advice.target, { kind: 'roadside', siteId: 'seed-meadow' });
  assert.match(advice.detail, /씨앗 풀밭/);
  assert.match(advice.detail, /씨앗 풀 1.*당근 씨앗 3개/);
  assert.equal(JSON.stringify(state), before);
  const gathered = performGatheringAction(state, getGatheringArea(state, 'seed-meadow', GATHER_NOW)!.next.node.id, GATHER_NOW);
  assert.equal(gathered.ok, true, gathered.message);
  state = gathered.state;
  assert.equal(state.resources.seeds, 3);
  assert.equal(state.seedInventory!.carrot, 3);
  assert.deepEqual(getVillageHub(state).primary.target, { kind: 'quest', questId: 'new-seeds' });
});

test('water advice uses each spring node energy cost, another ready node, and the real earliest regeneration without inventing water', () => {
  let state = claimCurrent(action(createGame(), 'gather'));
  state.plots[0].plantedAt = state.totalMinutes;
  state.plots[0].watered = false;
  state.resources.water = 0;
  state.energy = 8;
  const before = JSON.stringify(state), advice = getVillageHub(state, GATHER_NOW).primary;
  assert.deepEqual(advice.target, { kind: 'roadside', siteId: 'spring' });
  assert.match(advice.detail, /숲 샘터.*샘물 웅덩이 1.*물 12개/);
  assert.equal(JSON.stringify(state), before);
  const gathered = performGatheringAction(state, 'water-01', GATHER_NOW);
  assert.equal(gathered.ok, true, gathered.message);
  state = gathered.state;
  assert.equal(state.resources.water, 12);
  assert.equal(state.energy, 0);
  assert.equal(getGatheringNode(state, 'water-01', GATHER_NOW)!.ready, false);
  assert.equal(getVillageHub(state, GATHER_NOW).primary.target.kind, 'energy');
  // Consumed-water fixtures retain every real paid node's own cooldown.
  state.resources.water = 0; state.energy = 8;
  const another = getVillageHub(state, GATHER_NOW).primary;
  assert.match(another.detail, /샘물 웅덩이 2.*물 12개/);
  assert.doesNotMatch(another.detail, /초 뒤/);
  state.energy = 32;
  for (const [index, id] of ['water-02', 'water-03', 'water-04'].entries()) {
    const result = performGatheringAction(state, id, GATHER_NOW + (index + 1) * 1_000);
    assert.equal(result.ok, true, result.message); state = result.state;
  }
  state.resources.water = 0;
  const depleted = JSON.stringify(state), waiting = getVillageHub(state, GATHER_NOW + 3_000).primary;
  assert.deepEqual(waiting.target, { kind: 'roadside', siteId: 'spring' });
  assert.equal(waiting.tag, '목표 준비');
  assert.match(waiting.detail, /모든 채집물.*177초 뒤 샘물 웅덩이 1/);
  assert.match(getVillageHub(state, GATHER_NOW + 179_999).primary.detail, /1초 뒤/);
  assert.match(getVillageHub(state, GATHER_NOW + 180_000).primary.detail, /샘물 웅덩이 1을 골라 물 12개/);
  assert.doesNotMatch(getVillageHub(state, GATHER_NOW + 180_000).primary.detail, /초 뒤/);
  assert.equal(JSON.stringify(state), depleted, 'wall-time guidance never advances or pays the village');
  state.energy = 7;
  assert.equal(getVillageHub(state, GATHER_NOW + 180_000).primary.target.kind, 'energy');
});

test('seed supply guidance names the ready individual variety while preserving crop delivery requirements', () => {
  let state = reachedProduction();
  state = startProduction(state, 1).state;
  state = claimCurrent(collectProduction(advanceTime(state, BUILDINGS.waterworks.minutes), 1).state);
  state.seedInventory = { carrot: 0, potato: 0, tomato: 0, corn: 0, strawberry: 0, pumpkin: 0 }; state.resources.seeds = 0;
  state.plots.forEach(plot => { plot.plantedAt = null; plot.watered = false; });
  const collected = performGatheringAction(state, 'seed-01', GATHER_NOW); assert.equal(collected.ok, true, collected.message);
  state = collected.state;
  state.seedInventory!.carrot = 0; state.resources.seeds = 0;
  const before = JSON.stringify(state), hub = getVillageHub(state, GATHER_NOW), area = getGatheringArea(state, 'seed-meadow', GATHER_NOW)!;
  assert.equal(area.next.node.id, 'seed-02'); assert.equal(area.next.cropId, 'potato');
  assert.match(hub.primary.detail, /씨앗 풀 2을 골라 감자 씨앗 3개/);
  assert.deepEqual(hub.primary.target, { kind: 'roadside', siteId: 'seed-meadow' });
  assert.equal(getFarmDeliveryAdvice(state).cropId, 'carrot', 'aggregate seed supply does not replace the requested delivery crop');
  assert.equal(JSON.stringify(state), before);
  const next = performGatheringAction(state, area.next.node.id, GATHER_NOW); assert.equal(next.ok, true, next.message);
  assert.equal(next.state.seedInventory!.potato, 3); assert.equal(next.state.seedInventory!.carrot, 0);
});

test('low energy guidance shows automatic real-time recovery without spending food or changing saved progress', () => {
  const state = createGame();
  state.energy = 0;
  state.energyRecovery = { version: 1, checkedAt: 1_000_000, carryMs: 7_500 };
  const before = JSON.stringify(state), hub = getVillageHub(state), delivery = getFarmDeliveryAdvice(state);
  assert.equal(hub.primary.target.kind, 'energy');
  assert.equal(hub.primary.icon, 'bolt');
  assert.equal(hub.primary.cta, '회복 시간 보기');
  assert.match(hub.primary.detail, /20초마다 1씩, 1분에 3씩 자동 회복/);
  assert.ok(![hub.primary, hub.investment, ...hub.activities].some(advice => advice.target.kind === 'rest'));
  assert.deepEqual(delivery.target, { kind: 'energy' });
  assert.equal(delivery.cropId, undefined); // Recovery uses the bolt icon, rather than a produce icon.
  assert.equal(delivery.icon, 'bolt');
  assert.deepEqual(delivery.progress, { current: 0, max: 3 });
  assert.equal(JSON.stringify(state), before);
});

test('hunt preparation distinguishes depleted energy from injured companions without granting either recovery', () => {
  const state = createGame();
  // Imported objective fixture: claims only select the current view; this test does not earn battle rewards.
  const index = GROWTH_QUESTS.findIndex(quest => quest.id === 'safe-road');
  state.growthQuests = { claimed: GROWTH_QUESTS.slice(0, index).map(quest => quest.id) };
  state.companions!.dog.health = 0; state.companions!.cat.health = 0;
  state.energy = 15;
  let before = JSON.stringify(state), advice = getVillageHub(state).primary;
  assert.deepEqual(advice.target, { kind: 'energy' });
  assert.equal(JSON.stringify(state), before);
  state.energy = 16;
  before = JSON.stringify(state); advice = getVillageHub(state).primary;
  assert.deepEqual(advice.target, { kind: 'companions' });
  assert.equal(advice.cta, '동료 돌보기');
  assert.match(advice.detail, /동물 체력을 회복/);
  assert.equal(JSON.stringify(state), before);
  state.companions!.dog.health = 1;
  assert.deepEqual(getVillageHub(state).primary.target, { kind: 'quest', questId: 'safe-road' });
});

test('crop delivery stays executable at zero energy and a valid watering task keeps its priority at three energy', () => {
  let state = action(createGame(), 'harvest', 1);
  state.energy = 0;
  const before = JSON.stringify(state);
  assert.deepEqual(getFarmDeliveryAdvice(state).target, { kind: 'farm-delivery' });
  assert.equal(JSON.stringify(state), before);
  state = fulfillFarmOrder(state, getFarmOrder(state).id).state;
  state.plots[0].plantedAt = state.totalMinutes; state.plots[0].cropId = 'potato'; state.plots[0].watered = false;
  state.energy = 3;
  assert.deepEqual(getFarmDeliveryAdvice(state).target, { kind: 'farm', mode: 'water' });
  state.energy = 2;
  assert.deepEqual(getFarmDeliveryAdvice(state).target, { kind: 'energy' });
});
