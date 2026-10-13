import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceTime, beginHunt, createGame, getSeedInventory, loadGame, performAction, SAVE_KEY, saveGame, tick, type ActionResult, type GameState, type SaveStorage } from '../src/game.ts';
import { CROP_IDS } from '../src/crops.ts';
import { GAME_MINUTES_PER_SECOND } from '../src/game-time.ts';
import { getFarmCropInventory } from '../src/farm-economy.ts';
import { buyShopSeed, getShop, sellShopResource } from '../src/shop.ts';
import { buildFacility } from '../src/settlement.ts';
import { claimGrowthQuest } from '../src/growth-quests.ts';
import { fulfillVillageOrder, getVillageOrder } from '../src/village-orders.ts';
import { rotateLayoutTarget } from '../src/layout-direction.ts';
import { OUTDOOR_SITES, type OutdoorSiteId } from '../src/outdoor-sites.ts';
import { cloneRoadsideFields, getRoadsideProgress, getRoadsideSite, performRoadsideAction, ROADSIDE_RULES, validateRoadsideProgress } from '../src/roadside.ts';

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

test('old villages read four available outdoor sites without adding saved cooldowns or rewards', () => {
  const old = createGame('male'), before = structuredClone(old), memory = storage(); memory.setItem(SAVE_KEY, JSON.stringify(old));
  const loaded = loadGame(memory)!; assert.deepEqual(loaded, before); assert.equal(Object.hasOwn(loaded, 'roadside'), false);
  for (const site of OUTDOOR_SITES) {
    const view = getRoadsideSite(loaded, site.id);
    assert.equal(view.ready, true); assert.equal(view.remainingSeconds, 0); assert.equal(view.visits, 0);
  }
  const progress = getRoadsideProgress(loaded); progress.sites.spring.visits = 99; progress.sites.spring.readyAt = 999;
  assert.deepEqual(cloneRoadsideFields(loaded), {}); assert.deepEqual(loaded, before);
  assert.equal(Object.hasOwn(reload(loaded), 'roadside'), false);
});

test('the four real site actions pay their own exact resources, energy, experience, metric, and cooldown', () => {
  for (const site of OUTDOOR_SITES) {
    const state = createGame(), before = structuredClone(state), rule = ROADSIDE_RULES[site.id];
    const next = success(performRoadsideAction(state, site.id));
    assert.deepEqual(state, before);
    assert.deepEqual(next.resources, { ...state.resources, [site.resource]: state.resources[site.resource] + rule.amount });
    assert.equal(next.energy, state.energy - rule.energy); assert.equal(next.xp, state.xp + rule.xp);
    assert.equal(next.totalMinutes, state.totalMinutes); assert.equal(next.day, state.day); assert.equal(next.minutes, state.minutes);
    assert.equal(next.stats[site.kind === 'chop' ? 'chops' : 'gathers'], 1);
    assert.equal(next.stats[site.kind === 'chop' ? 'gathers' : 'chops'], 0);
    assert.deepEqual(next.roadside!.sites[site.id], { visits: 1, readyAt: state.totalMinutes + rule.cooldownSeconds * GAME_MINUTES_PER_SECOND });
    const view = getRoadsideSite(next, site.id); assert.equal(view.ready, false); assert.equal(view.remainingSeconds, rule.cooldownSeconds);
    for (const other of OUTDOOR_SITES.filter(item => item.id !== site.id)) assert.equal(getRoadsideSite(next, other.id).ready, true);
    if (site.resource === 'seeds') assert.deepEqual(getSeedInventory(next), { ...getSeedInventory(state), carrot: getSeedInventory(state).carrot + 3 });
    else assert.deepEqual(getSeedInventory(next), getSeedInventory(state));
    assert.deepEqual(next.plots, state.plots); assert.deepEqual(next.companions, state.companions); assert.deepEqual(next.animalReserve, state.animalReserve);
    assert.deepEqual(reload(next).roadside, next.roadside);
  }
});

test('each cooldown uses actual shared clock ticks and permits a second collection only at its exact boundary', () => {
  for (const site of OUTDOOR_SITES) {
    let state = success(performRoadsideAction(createGame(), site.id));
    const rule = ROADSIDE_RULES[site.id], paid = structuredClone(state);
    refused(state, () => performRoadsideAction(state, site.id));
    state = tick(state, rule.cooldownSeconds - 0.125);
    assert.equal(state.totalMinutes, paid.totalMinutes + (rule.cooldownSeconds - 0.125) * GAME_MINUTES_PER_SECOND);
    assert.equal(getRoadsideSite(state, site.id).remainingSeconds, 1); assert.equal(getRoadsideSite(state, site.id).ready, false);
    refused(state, () => performRoadsideAction(state, site.id));
    state = tick(state, 0.125);
    assert.equal(state.totalMinutes, paid.roadside!.sites[site.id].readyAt); assert.equal(getRoadsideSite(state, site.id).ready, true);
    const next = success(performRoadsideAction(state, site.id)); assert.equal(next.roadside!.sites[site.id].visits, 2);
    assert.equal(getRoadsideSite(next, site.id).remainingSeconds, rule.cooldownSeconds);
    assert.deepEqual(paid.roadside!.sites[site.id], { visits: 1, readyAt: paid.totalMinutes + rule.cooldownSeconds * GAME_MINUTES_PER_SECOND });
  }
});

test('three actual roadside gathers grant the legacy supply quest once without delaying its real reward', () => {
  let state = createGame(); const before = structuredClone(state);
  for (const siteId of ['salvage', 'seed-meadow', 'spring'] as const) state = success(performRoadsideAction(state, siteId));
  assert.equal(state.stats.gathers, 3); assert.equal(state.quests.filter(id => id === 'road-scout').length, 1);
  assert.equal(state.resources.wood, before.resources.wood + 12);
  assert.equal(state.resources.scrap, before.resources.scrap + 9 + 6);
  assert.equal(state.resources.water, before.resources.water + 12); assert.equal(state.resources.seeds, before.resources.seeds + 3);
  assert.equal(state.xp, 12 + 10 + 10); assert.equal(state.totalMinutes, before.totalMinutes);
  assert.equal(state.log.filter(entry => entry.includes('목표 달성! 도로 위의 보물찾기')).length, 1);
  state = tick(state, ROADSIDE_RULES.salvage.cooldownSeconds);
  const earned = structuredClone(state); state = success(performRoadsideAction(state, 'salvage'));
  assert.equal(state.resources.wood, earned.resources.wood); assert.equal(state.resources.scrap, earned.resources.scrap + 9);
  assert.equal(state.quests.filter(id => id === 'road-scout').length, 1);
  assert.equal(state.log.filter(entry => entry.includes('목표 달성! 도로 위의 보물찾기')).length, 1);
});

test('the seed meadow rotates one real variety per visit and preserves its aggregate total through six crops and repetition', () => {
  let state = createGame(); const original = getSeedInventory(state), initialTotal = state.resources.seeds;
  for (let visit = 0; visit < 7; visit += 1) {
    const id = CROP_IDS[visit % CROP_IDS.length], stock = getSeedInventory(state), view = getRoadsideSite(state, 'seed-meadow');
    assert.equal(view.cropId, id); assert.equal(view.ready, true);
    state = success(performRoadsideAction(state, 'seed-meadow'));
    for (const cropId of CROP_IDS) assert.equal(getSeedInventory(state)[cropId], stock[cropId] + (cropId === id ? 3 : 0));
    assert.equal(state.resources.seeds, initialTotal + (visit + 1) * 3);
    assert.equal(CROP_IDS.reduce((sum, cropId) => sum + getSeedInventory(state)[cropId], 0), state.resources.seeds);
    state = reload(state);
    if (visit < 6) state = tick(state, ROADSIDE_RULES['seed-meadow'].cooldownSeconds);
  }
  assert.deepEqual(getSeedInventory(state), { carrot: original.carrot + 6, potato: original.potato + 3, tomato: original.tomato + 3,
    corn: original.corn + 3, strawberry: original.strawberry + 3, pumpkin: original.pumpkin + 3 });
  assert.equal(state.roadside!.sites['seed-meadow'].visits, 7);
});

test('outdoor commits retain and detach paid shop records, exact crop backing, batch care, and animal progress', () => {
  let state = success(performAction(createGame(), 'harvest', 1, undefined, { advanceClock: false }));
  state = success(performAction(state, 'fertilize', 2, undefined, { advanceClock: false }));
  state = success(sellShopResource(state, 'food', 3)); state = success(buyShopSeed(state, 'tomato', 1));
  const before = structuredClone(state), crops = getFarmCropInventory(state), coins = getShop(state).coins;
  for (const site of OUTDOOR_SITES) {
    const next = success(performRoadsideAction(state, site.id));
    assert.deepEqual(next.farmEconomy, state.farmEconomy); assert.deepEqual(next.shop, state.shop);
    assert.deepEqual(getFarmCropInventory(next), crops); assert.equal(next.resources.food, state.resources.food); assert.equal(getShop(next).coins, coins);
    assert.notEqual(next.farmEconomy!.crops, state.farmEconomy!.crops); assert.notEqual(next.farmEconomy!.fertilizedPlots[0], state.farmEconomy!.fertilizedPlots[0]);
    next.farmEconomy!.crops.carrot = 999; next.farmEconomy!.fertilizedPlots[0].cropId = 'corn'; next.shop!.coins = 999;
    next.shop!.equippedOutfits.female = 'garden'; next.companions!.dog.health = 1; next.animalReserve!.owl.health = 1;
    assert.deepEqual(state, before);
  }
});

test('roadside counters are deeply copied by actual clock, farm, facility, quest, delivery, and facing commits', () => {
  let state = success(performRoadsideAction(createGame(), 'salvage')); const before = structuredClone(state);
  const nextStates = [tick(state, 1), success(performAction(state, 'harvest', 1, undefined, { advanceClock: false })),
    success(buildFacility(state, 'waterworks', 0)), success(claimGrowthQuest(state, 'road-supplies')),
    success(fulfillVillageOrder(state, getVillageOrder(state).id)), success(rotateLayoutTarget(state, { kind: 'plot', id: 1 })),
    success(sellShopResource(state, 'wood', 1))];
  for (const next of nextStates) {
    assert.deepEqual(next.roadside, state.roadside); assert.notEqual(next.roadside, state.roadside);
    assert.notEqual(next.roadside!.sites.salvage, state.roadside!.sites.salvage);
    next.roadside!.sites.salvage.visits = 999; next.roadside!.sites.salvage.readyAt = 999;
    assert.deepEqual(state, before);
  }
});

test('invalid targets, exhausted characters, expeditions, current cooldowns, and corrupt site records refuse without mutation', () => {
  const state = createGame();
  for (const id of ['water', '__proto__', 'constructor', '', null, 1, {}, ['spring']]) refused(state, () => performRoadsideAction(state, id));
  for (const site of OUTDOOR_SITES) {
    const tired = createGame(); tired.energy = ROADSIDE_RULES[site.id].energy - 1;
    refused(tired, () => performRoadsideAction(tired, site.id));
    const away = success(beginHunt(createGame(), 1)); refused(away, () => performRoadsideAction(away, site.id));
    const cooling = success(performRoadsideAction(createGame(), site.id)); refused(cooling, () => performRoadsideAction(cooling, site.id));
  }
  const bad = createGame(); bad.roadside = getRoadsideProgress(bad); bad.roadside.sites.grove.visits = -1;
  refused(bad, () => performRoadsideAction(bad, 'grove'));
});

test('site and save schemas reject unknown sites, extra fields, invalid visits, nonfinite clocks, and unearned cooldowns', () => {
  const state = success(performRoadsideAction(createGame(), 'grove'));
  const corruptions = [
    (next: GameState) => { next.roadside!.version = 2 as 1; },
    (next: GameState) => { (next.roadside as unknown as Record<string, unknown>).rewards = 99; },
    (next: GameState) => { (next.roadside!.sites as Record<string, unknown>).mine = { visits: 0, readyAt: 0 }; },
    (next: GameState) => { delete (next.roadside!.sites as Partial<Record<OutdoorSiteId, unknown>>).spring; },
    (next: GameState) => { next.roadside!.sites.grove.visits = 0.5; },
    (next: GameState) => { next.roadside!.sites.grove.visits = 100_000_001; },
    (next: GameState) => { next.roadside!.sites.grove.readyAt = -1; },
    (next: GameState) => { next.roadside!.sites.grove.readyAt = Infinity; },
    (next: GameState) => { next.roadside!.sites.grove.readyAt = 1_440_000_001; },
    (next: GameState) => { next.roadside!.sites.grove.visits = 0; },
    (next: GameState) => { (next.roadside!.sites.grove as Record<string, unknown>).bonus = 99; },
  ];
  for (const corrupt of corruptions) {
    const next = structuredClone(state); corrupt(next);
    assert.equal(validateRoadsideProgress(next.roadside), false); const memory = storage(); memory.setItem(SAVE_KEY, JSON.stringify(next));
    assert.equal(loadGame(memory), null); refused(next, () => performRoadsideAction(next, 'grove'));
  }
  assert.deepEqual(reload(state).roadside, state.roadside);
});

test('resource, seed, XP, statistic, visit, and clock limits roll back the entire roadside transaction', () => {
  for (const site of OUTDOOR_SITES) {
    const full = createGame(); full.resources[site.resource] = 100_000_000;
    if (site.resource === 'seeds') { full.seedInventory = { carrot: 100_000_000, potato: 0, tomato: 0, corn: 0, strawberry: 0, pumpkin: 0 }; }
    refused(full, () => performRoadsideAction(full, site.id));
    const xp = createGame(); xp.xp = 100_000_000; refused(xp, () => performRoadsideAction(xp, site.id));
    const stats = createGame(); stats.stats[site.kind === 'chop' ? 'chops' : 'gathers'] = 100_000_000;
    refused(stats, () => performRoadsideAction(stats, site.id));
    const visits = createGame(); visits.roadside = getRoadsideProgress(visits); visits.roadside.sites[site.id].visits = 100_000_000;
    refused(visits, () => performRoadsideAction(visits, site.id));
    const clock = advanceTime(createGame(), 1_440_000_000 - 480);
    refused(clock, () => performRoadsideAction(clock, site.id));
  }
});

test('legacy quest rewards that would overflow storage roll back the new third gather and its cooldown', () => {
  let state = createGame(); state = success(performRoadsideAction(state, 'salvage')); state = success(performRoadsideAction(state, 'seed-meadow'));
  state.resources.wood = 100_000_000 - 11;
  const before = structuredClone(state); refused(state, () => performRoadsideAction(state, 'spring'));
  assert.deepEqual(state, before); assert.equal(getRoadsideSite(state, 'spring').ready, true); assert.equal(state.stats.gathers, 2);
  assert.equal(state.quests.includes('road-scout'), false);
});

test('damaged energy, resource schemas, seed backing, and paid sidecars cannot receive outdoor rewards', () => {
  const base = success(sellShopResource(success(performAction(createGame(), 'harvest', 1, undefined, { advanceClock: false })), 'food', 1));
  const corruptions = [
    (next: GameState) => { next.energy = NaN; },
    (next: GameState) => { next.energy = -1; },
    (next: GameState) => { next.energy = 101; },
    (next: GameState) => { delete (next.resources as Partial<GameState['resources']>).food; },
    (next: GameState) => { (next.resources as Record<string, unknown>).apple = 1; },
    (next: GameState) => { next.resources.wood = NaN; },
    (next: GameState) => { next.seedInventory!.corn += 1; },
    (next: GameState) => { next.seedInventory!.carrot = -1; },
    (next: GameState) => { next.farmEconomy!.crops.carrot = next.resources.food + 1; },
    (next: GameState) => { next.shop!.coins = -1; },
  ];
  for (const corrupt of corruptions) {
    const next = structuredClone(base); corrupt(next);
    for (const site of OUTDOOR_SITES) refused(next, () => performRoadsideAction(next, site.id));
  }
  const legacy = createGame(); delete (legacy.resources as Partial<GameState['resources']>).food;
  refused(legacy, () => performRoadsideAction(legacy, 'spring'));
});
