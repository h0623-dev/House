import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceTime, beginHunt, cancelHunt, createGame, getCropProgress, getSeedInventory, loadGame, performAction, SAVE_KEY, saveGame, tick, type ActionResult, type GameState, type SaveStorage } from '../src/game.ts';
import { CROP_IDS, CROPS, type CropId } from '../src/crops.ts';
import { GAME_MINUTES_PER_SECOND } from '../src/game-time.ts';
import { buildFacility, startProduction } from '../src/settlement.ts';
import { claimGrowthQuest } from '../src/growth-quests.ts';
import { fulfillVillageOrder, getVillageOrder } from '../src/village-orders.ts';
import { rotateLayoutTarget } from '../src/layout-direction.ts';
import { getShop, sellShopResource } from '../src/shop.ts';
import { cloneFarmEconomyFields, FARM_FERTILIZER_BONUS, FARM_FERTILIZER_COST, fulfillFarmOrder, getFarmCropInventory, getFarmEconomy, getFarmOrder, getFarmPlotCare, validateFarmEconomy } from '../src/farm-economy.ts';

function storage(): SaveStorage {
  const values = new Map<string, string>();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); } };
}
function reload(state: GameState): GameState {
  const memory = storage(); assert.equal(saveGame(state, memory), true);
  const loaded = loadGame(memory); assert.ok(loaded); return loaded;
}
function success(result: ActionResult): GameState { assert.equal(result.ok, true, result.message); return result.state; }
function refused(state: GameState, run: () => ActionResult): void {
  const before = structuredClone(state), result = run();
  assert.equal(result.ok, false); assert.equal(result.state, state); assert.deepEqual(state, before);
}
function planted(state = createGame(), cropId: CropId = 'carrot'): GameState {
  return success(performAction(state, 'plant', 3, cropId, { advanceClock: false }));
}
function harvestCrop(state: GameState, cropId: CropId, fertilized = false): GameState {
  let next = planted(state, cropId);
  next = success(performAction(next, 'water', 3, cropId, { advanceClock: false }));
  if (fertilized) next = success(performAction(next, 'fertilize', 3, cropId, { advanceClock: false }));
  next = tick(next, CROPS[cropId].growMinutes / GAME_MINUTES_PER_SECOND);
  assert.equal(getCropProgress(next, next.plots.find(plot => plot.id === 3)!), 1);
  return success(performAction(next, 'harvest', 3, cropId, { advanceClock: false }));
}
function backedFoodOnly(): GameState {
  // The starter crop is actually harvested; selling its old general provisions
  // leaves only four real carrots, so every subsequent food debit is observable.
  let state = success(performAction(createGame(), 'harvest', 1, undefined, { advanceClock: false }));
  state = success(sellShopResource(state, 'food', 8));
  assert.equal(state.resources.food, 4); assert.equal(getFarmCropInventory(state).carrot, 4);
  return state;
}
function assertBacking(state: GameState): void {
  const stock = getFarmCropInventory(state);
  assert.ok(CROP_IDS.reduce((sum, id) => sum + stock[id], 0) <= state.resources.food);
  assert.equal(validateFarmEconomy(state.farmEconomy, state), true);
}

test('legacy food and production migrate without invented crop types, coins, orders, or care', () => {
  const old = createGame('male'), before = structuredClone(old);
  const memory = storage(); memory.setItem(SAVE_KEY, JSON.stringify(old));
  const loaded = loadGame(memory)!; assert.deepEqual(loaded, before); assert.equal(Object.hasOwn(loaded, 'farmEconomy'), false);
  const farm = getFarmEconomy(loaded);
  assert.deepEqual(farm.crops, { carrot: 0, potato: 0, tomato: 0, corn: 0, strawberry: 0, pumpkin: 0 });
  assert.equal(farm.completedOrders, 0); assert.deepEqual(farm.fertilizedPlots, []); assert.equal(getShop(loaded).coins, 0);
  farm.crops.carrot = 99; farm.fertilizedPlots.push({ plotId: 1, plantedAt: 240, cropId: 'carrot' });
  assert.deepEqual(cloneFarmEconomyFields(loaded), {}); assert.deepEqual(loaded, before);
  assert.equal(getFarmOrder(loaded).ready, false);
  refused(loaded, () => fulfillFarmOrder(loaded, getFarmOrder(loaded).id));
});

test('each of six real crops records its actual harvest and keeps the shared food backing', () => {
  let state = createGame();
  for (const cropId of CROP_IDS) {
    const before = structuredClone(state), stock = getFarmCropInventory(state), seeds = getSeedInventory(state);
    state = harvestCrop(state, cropId);
    assert.equal(getFarmCropInventory(state)[cropId], stock[cropId] + CROPS[cropId].food);
    assert.equal(getSeedInventory(state)[cropId], seeds[cropId] - 1 + CROPS[cropId].seedReturn);
    assert.equal(state.stats.harvests, before.stats.harvests + 1);
    assert.equal(state.totalMinutes, before.totalMinutes + CROPS[cropId].growMinutes);
    assertBacking(state);
  }
  assert.deepEqual(reload(state).farmEconomy, state.farmEconomy);
});

test('paid nutrition applies once to one batch, preserves growth clocks, and adds exactly two harvest units', () => {
  let state = planted(createGame(), 'corn');
  const before = structuredClone(state), plot = state.plots.find(item => item.id === 3)!;
  assert.equal(getFarmPlotCare(state, plot).yieldAmount, CROPS.corn.food);
  const result = performAction(state, 'fertilize', 3, undefined, { advanceClock: false }); state = success(result);
  assert.deepEqual(before.plots, state.plots); assert.equal(state.totalMinutes, before.totalMinutes);
  assert.equal(state.resources.food, before.resources.food - FARM_FERTILIZER_COST.food);
  assert.equal(state.energy, before.energy - FARM_FERTILIZER_COST.energy); assert.equal(state.xp, before.xp);
  assert.equal(getFarmPlotCare(state, state.plots[2]).yieldAmount, CROPS.corn.food + FARM_FERTILIZER_BONUS);
  assert.equal(getFarmPlotCare(state, state.plots[2]).canFertilize, false);
  refused(state, () => performAction(state, 'fertilize', 3, undefined, { advanceClock: false }));
  state = reload(state); state = success(performAction(state, 'water', 3, undefined, { advanceClock: false }));
  const plantedAt = state.plots[2].plantedAt, readyAt = plantedAt! + CROPS.corn.growMinutes;
  state = advanceTime(state, readyAt - state.totalMinutes);
  const ready = structuredClone(state), seeds = getSeedInventory(state).corn;
  refused(state, () => performAction(state, 'fertilize', 3, undefined, { advanceClock: false }));
  state = success(performAction(state, 'harvest', 3, undefined, { advanceClock: false }));
  assert.equal(state.resources.food, ready.resources.food + CROPS.corn.food + 2);
  assert.equal(getFarmCropInventory(state).corn, CROPS.corn.food + 2);
  assert.equal(getSeedInventory(state).corn, seeds + CROPS.corn.seedReturn);
  assert.equal(state.xp, ready.xp + CROPS.corn.xp);
  assert.deepEqual(state.farmEconomy!.fertilizedPlots, []); assert.equal(state.plots[2].plantedAt, null);
  state = planted(state, 'potato'); assert.equal(getFarmPlotCare(state, state.plots[2]).fertilized, false);
  assert.equal(getFarmPlotCare(state, state.plots[2]).yieldAmount, CROPS.potato.food);
  assertBacking(state);
});

test('nutrition refuses empty, ready, poor, exhausted, expedition, and corrupt batches atomically', () => {
  const empty = createGame(); refused(empty, () => performAction(empty, 'fertilize', 3));
  const ready = createGame(); refused(ready, () => performAction(ready, 'fertilize', 1));
  const poor = planted(); poor.resources.food = 0; refused(poor, () => performAction(poor, 'fertilize', 3));
  const tired = planted(); tired.energy = 1; refused(tired, () => performAction(tired, 'fertilize', 3));
  const away = success(beginHunt(planted(), 1)); refused(away, () => performAction(away, 'fertilize', 3));
  const bad = planted(); bad.farmEconomy = getFarmEconomy(bad); bad.farmEconomy.fertilizedPlots = [{ plotId: 3, plantedAt: 0, cropId: 'carrot' }];
  refused(bad, () => performAction(bad, 'fertilize', 3));
});

test('six crop requests consume exact stock and food and pay their shown construction, coin, and XP rewards once', () => {
  let state = createGame(), paidCoins = 0;
  for (const cropId of CROP_IDS) {
    state = harvestCrop(state, cropId);
    const order = getFarmOrder(state); assert.equal(order.progress[0].cropId, cropId); assert.equal(order.ready, true);
    const input = state, before = structuredClone(state), result = fulfillFarmOrder(state, order.id); state = success(result);
    const amount = order.costs[cropId]!;
    assert.equal(getFarmCropInventory(state)[cropId], getFarmCropInventory(before)[cropId] - amount);
    assert.equal(state.resources.food, before.resources.food - amount);
    assert.equal(state.resources.wood, before.resources.wood + order.rewards.wood);
    assert.equal(state.resources.scrap, before.resources.scrap + order.rewards.scrap);
    assert.equal(state.xp, before.xp + order.rewards.xp); assert.equal(state.level, Math.floor(state.xp / 120) + 1);
    paidCoins += order.rewards.coins; assert.equal(getShop(state).coins, paidCoins);
    assert.equal(state.farmEconomy!.completedOrders, order.sequence); assert.deepEqual(input, before);
    assert.deepEqual(state.plots, before.plots); assert.equal(state.totalMinutes, before.totalMinutes);
    refused(state, () => fulfillFarmOrder(state, order.id)); assertBacking(state); state = reload(state);
  }
  assert.equal(getFarmOrder(state).id, 'farm-order-7'); assert.equal(getFarmOrder(state).progress[0].cropId, 'carrot');
  refused(state, () => fulfillFarmOrder(state, 'farm-order-1'));
});

test('general food is spent first, and sold typed crops cannot also satisfy a delivery', () => {
  let state = success(performAction(createGame(), 'harvest', 1, undefined, { advanceClock: false }));
  const before = structuredClone(state);
  state = success(sellShopResource(state, 'food', 8)); assert.deepEqual(getFarmCropInventory(state), getFarmCropInventory(before));
  assert.equal(getFarmOrder(state).ready, true);
  state = success(sellShopResource(state, 'food', 2));
  assert.equal(state.resources.food, 2); assert.equal(getFarmCropInventory(state).carrot, 2); assert.equal(getFarmOrder(state).ready, false);
  const coins = getShop(state).coins; refused(state, () => fulfillFarmOrder(state, getFarmOrder(state).id));
  state = success(sellShopResource(state, 'food', 2)); assert.equal(state.resources.food, 0); assert.equal(getFarmCropInventory(state).carrot, 0);
  assert.equal(getShop(state).coins, coins + 6); assertBacking(state); assert.deepEqual(reload(state).farmEconomy, state.farmEconomy);
});

test('rest, day provisions, nutrition, village delivery, and facility input reconcile real crop backing', () => {
  const base = backedFoodOnly(), before = structuredClone(base);
  const rested = success(performAction(base, 'rest', undefined, undefined, { advanceClock: false }));
  assert.equal(rested.resources.food, 3); assert.equal(getFarmCropInventory(rested).carrot, 3); assertBacking(rested);
  const morning = advanceTime(base, 1440 - base.totalMinutes);
  assert.equal(morning.resources.food, 2); assert.equal(getFarmCropInventory(morning).carrot, 2); assertBacking(morning);
  const cared = success(performAction(base, 'fertilize', 2, undefined, { advanceClock: false }));
  assert.equal(cared.resources.food, 3); assert.equal(getFarmCropInventory(cared).carrot, 3); assertBacking(cared);
  let village = harvestCrop(base, 'potato'); village.villageOrders = { completed: 1 };
  const stock = getFarmCropInventory(village), sent = success(fulfillVillageOrder(village, getVillageOrder(village).id));
  assert.equal(sent.resources.food, village.resources.food - 5); assert.equal(getFarmCropInventory(sent).carrot, 0);
  assert.equal(getFarmCropInventory(sent).potato, stock.potato - 1); assertBacking(sent);
  // Explicit advanced construction fixture; all crop units still came from a real harvest.
  const advanced = { ...base, deckLevel: 2, stats: { ...base.stats, expansions: 1 }, plots: [...base.plots, { id: 4, plantedAt: null, watered: false }] };
  let facility = success(buildFacility(advanced, 'petHouse', 0));
  facility = success(startProduction(facility, 1));
  assert.equal(facility.resources.food, 3); assert.equal(getFarmCropInventory(facility).carrot, 3); assertBacking(facility);
  assert.deepEqual(base, before);
});

test('actual delivery coins can buy seeds while crop output cannot be spent as two inventories', async () => {
  const { buyShopSeed } = await import('../src/shop.ts');
  let state = backedFoodOnly(); const order = getFarmOrder(state);
  state = success(fulfillFarmOrder(state, order.id)); assert.equal(state.resources.food, 1); assert.equal(getFarmCropInventory(state).carrot, 1);
  assert.equal(getShop(state).coins, 38); // 24 from selling old food + 14 from the actual delivery.
  const seedBefore = getSeedInventory(state).potato;
  state = success(buyShopSeed(state, 'potato', 5)); assert.equal(getSeedInventory(state).potato, seedBefore + 5); assert.equal(getShop(state).coins, 23);
  state = success(sellShopResource(state, 'food', 1)); assert.equal(getFarmCropInventory(state).carrot, 0); assert.equal(getShop(state).coins, 26);
  refused(state, () => fulfillFarmOrder(state, order.id)); assertBacking(state);
});

test('deep copies isolate crop stock and batch care through clocks, facilities, quests, village, and facing edits', () => {
  let state = success(performAction(createGame(), 'harvest', 1, undefined, { advanceClock: false }));
  state = success(performAction(state, 'fertilize', 2, undefined, { advanceClock: false }));
  const original = structuredClone(state);
  const gather = success(performAction(state, 'gather', undefined, undefined, { advanceClock: false }));
  const results = [tick(state, 1), success(buildFacility(state, 'waterworks', 0)), success(rotateLayoutTarget(state, { kind: 'plot', id: 1 })),
    success(fulfillVillageOrder(state, getVillageOrder(state).id)), success(claimGrowthQuest(gather, 'road-supplies')), success(cancelHunt(success(beginHunt(state, 1))))];
  for (const next of results) {
    assert.notEqual(next.farmEconomy, state.farmEconomy); assert.notEqual(next.farmEconomy!.crops, state.farmEconomy!.crops);
    assert.notEqual(next.farmEconomy!.fertilizedPlots, state.farmEconomy!.fertilizedPlots);
    next.farmEconomy!.crops.carrot = 999; next.farmEconomy!.fertilizedPlots[0].cropId = 'pumpkin';
    assert.deepEqual(state, original);
  }
});

test('save validation rejects unbacked crops, extra species, counters, and orphaned or duplicate batch care', () => {
  const state = success(performAction(planted(), 'fertilize', 3, undefined, { advanceClock: false }));
  const invalid = [
    (next: GameState) => { next.farmEconomy!.crops.carrot = next.resources.food + 1; },
    (next: GameState) => { (next.farmEconomy!.crops as Record<string, unknown>).apple = 1; },
    (next: GameState) => { next.farmEconomy!.crops.carrot = -1; },
    (next: GameState) => { next.farmEconomy!.completedOrders = 0.5; },
    (next: GameState) => { next.farmEconomy!.fertilizedPlots.push({ ...next.farmEconomy!.fertilizedPlots[0] }); },
    (next: GameState) => { next.farmEconomy!.fertilizedPlots[0].plotId = 1; },
    (next: GameState) => { next.farmEconomy!.fertilizedPlots[0].plantedAt -= 1; },
    (next: GameState) => { next.farmEconomy!.fertilizedPlots[0].cropId = 'pumpkin'; },
    (next: GameState) => { (next.farmEconomy as unknown as Record<string, unknown>).bonus = 99; },
  ];
  for (const mutate of invalid) {
    const next = structuredClone(state); mutate(next); const memory = storage(); memory.setItem(SAVE_KEY, JSON.stringify(next));
    assert.equal(loadGame(memory), null); assert.equal(validateFarmEconomy(next.farmEconomy, next), false);
    refused(next, () => fulfillFarmOrder(next, getFarmOrder(state).id));
  }
  assert.deepEqual(reload(state).farmEconomy, state.farmEconomy);
});

test('delivery refuses missing crops, forged or stale IDs, expeditions, limits, and overflowing rewards unchanged', () => {
  const base = backedFoodOnly();
  refused(base, () => fulfillFarmOrder(base, 'farm-order-0')); refused(base, () => fulfillFarmOrder(base, 'farm-order-2'));
  const away = success(beginHunt(base, 1)); refused(away, () => fulfillFarmOrder(away, 'farm-order-1'));
  const poor = createGame(); refused(poor, () => fulfillFarmOrder(poor, 'farm-order-1'));
  for (const field of ['coins', 'xp', 'wood', 'scrap'] as const) {
    const next = structuredClone(base);
    if (field === 'coins') next.shop!.coins = 100_000_000;
    else if (field === 'xp') next.xp = 100_000_000;
    else next.resources[field] = 100_000_000;
    // First order has no scrap reward, so advance its saved request to potato
    // using a declared stock fixture rather than pretending a delivery occurred.
    if (field === 'scrap') { next.farmEconomy!.completedOrders = 1; next.farmEconomy!.crops = { carrot: 0, potato: 4, tomato: 0, corn: 0, strawberry: 0, pumpkin: 0 }; }
    refused(next, () => fulfillFarmOrder(next, getFarmOrder(next).id));
  }
  const full = structuredClone(base); full.farmEconomy!.completedOrders = 100_000_000;
  refused(full, () => fulfillFarmOrder(full, getFarmOrder(full).id));
});

test('harvest cannot overflow food and retains ripe crops, care, seed stock, and energy on refusal', () => {
  let state = success(performAction(planted(), 'fertilize', 3, undefined, { advanceClock: false }));
  state = success(performAction(state, 'water', 3, undefined, { advanceClock: false }));
  state = advanceTime(state, CROPS.carrot.growMinutes); state.resources.food = 100_000_000;
  refused(state, () => performAction(state, 'harvest', 3, undefined, { advanceClock: false }));
  assert.equal(getFarmPlotCare(state, state.plots[2]).fertilized, true);
});
