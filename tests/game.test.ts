import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceTime, beginHunt, cancelHunt, createGame, expansionCost, finishHunt, getCropProgress, loadGame, MAX_DECK_LEVEL, performAction, questList, SAVE_KEY, saveGame, tick, type Action, type GameState, type HuntResult, type SaveStorage } from '../src/game.ts';

function memoryStorage(): SaveStorage {
  const values = new Map<string, string>();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); } };
}

test('both characters start with playable plots and an independent state', () => {
  const female = createGame('female');
  const male = createGame('male', '  하늘  ');
  assert.equal(male.name, '하늘');
  assert.equal(male.gender, 'male');
  assert.equal(female.gender, 'female');
  assert.equal(getCropProgress(female, female.plots[0]), 1);
  assert.equal(female.plots[2].plantedAt, null);
  male.resources.wood = 0;
  assert.equal(female.resources.wood, 24);
});

test('plant, water, wait, and harvest is a sustainable, immutable crop cycle', () => {
  const initial = createGame();
  const original = JSON.stringify(initial);
  const planted = performAction(initial, 'plant', 3);
  assert.equal(planted.ok, true);
  assert.equal(planted.state.resources.seeds, initial.resources.seeds - 1);
  const dry = advanceTime(planted.state, 400);
  assert.equal(getCropProgress(dry, dry.plots[2]), 0.7);
  assert.equal(performAction(dry, 'harvest', 3).ok, false);
  const wet = performAction(dry, 'water', 3);
  assert.equal(wet.ok, true);
  const harvested = performAction(wet.state, 'harvest', 3);
  assert.equal(harvested.ok, true);
  assert.equal(harvested.state.resources.food, initial.resources.food + 4);
  assert.equal(harvested.state.resources.seeds, initial.resources.seeds + 1);
  assert.equal(harvested.state.plots[2].plantedAt, null);
  assert.equal(JSON.stringify(initial), original);
});

test('unaffordable actions never spend resources, time, or energy', () => {
  const state = createGame();
  state.resources.wood = 0;
  const result = performAction(state, 'expand');
  assert.equal(result.ok, false);
  assert.equal(result.state, state);
  assert.equal(state.energy, 85);
  assert.equal(state.totalMinutes, 480);
  assert.equal(performAction(state, 'plant', 99).ok, false);
});

test('expanding consumes its displayed cost, adds a plot, and rewards its quest only once', () => {
  const state = createGame();
  const cost = expansionCost(state);
  const expanded = performAction(state, 'expand').state;
  assert.equal(expanded.resources.wood, state.resources.wood - cost.wood);
  assert.equal(expanded.resources.scrap, state.resources.scrap - cost.scrap);
  assert.equal(expanded.deckLevel, 2);
  assert.equal(expanded.plots.length, 4);
  assert.equal(expanded.resources.water, state.resources.water + 8);
  assert.equal(expanded.xp, 65);
  assert.equal(questList(expanded).find(quest => quest.id === 'bigger-home')?.complete, true);
  const petted = performAction(expanded, 'pet').state;
  assert.equal(petted.resources.water, expanded.resources.water);
  assert.equal(petted.quests.filter(id => id === 'bigger-home').length, 1);
});

test('gathering provides materials and only awards the scout goal once', () => {
  let state = createGame();
  for (let i = 0; i < 3; i++) state = performAction(state, 'gather').state;
  assert.equal(state.resources.wood, 24 + 30 + 12);
  assert.equal(state.resources.scrap, 12 + 15 + 6);
  assert.equal(state.stats.gathers, 3);
  const fourth = performAction(state, 'gather').state;
  assert.equal(fourth.resources.wood - state.resources.wood, 10);
});

test('zero supplies and energy still allow resting, gathering, and recovery', () => {
  let state = createGame();
  state.energy = 0;
  state.health = 1;
  for (const key of Object.keys(state.resources) as (keyof typeof state.resources)[]) state.resources[key] = 0;
  assert.equal(performAction(state, 'gather').ok, false);
  const rested = performAction(state, 'rest');
  assert.equal(rested.ok, true);
  assert.equal(rested.state.energy, 35);
  assert.equal(rested.state.health, 4);
  const gathered = performAction(rested.state, 'gather');
  assert.equal(gathered.ok, true);
  assert.ok(gathered.state.resources.seeds > 0);
  assert.ok(gathered.state.resources.water > 0);
});

test('midnight consistently consumes provisions and damages the truck once', () => {
  const state = createGame();
  const beforeMidnight = advanceTime(state, 959);
  assert.equal(beforeMidnight.day, 1);
  assert.equal(beforeMidnight.truckHealth, 100);
  const midnight = advanceTime(beforeMidnight, 1);
  assert.equal(midnight.day, 2);
  assert.equal(midnight.minutes, 0);
  assert.equal(midnight.resources.food, 6);
  assert.equal(midnight.resources.water, 13);
  assert.equal(midnight.truckHealth, 93);
  assert.equal(tick(midnight).truckHealth, 93);
  const repaired = performAction(midnight, 'repair');
  assert.equal(repaired.ok, true);
  assert.equal(repaired.state.truckHealth, 100);
  assert.equal(repaired.state.resources.scrap, 8);
});

test('time ticks reject invalid elapsed time and aggregate multi-day costs', () => {
  const state = createGame();
  assert.equal(tick(state, NaN), state);
  assert.equal(advanceTime(state, Infinity), state);
  assert.equal(advanceTime(state, -1), state);
  assert.equal(tick(state, 0.5).totalMinutes, state.totalMinutes + 1);
  const jump = advanceTime(state, 1440 * 8);
  assert.equal(jump.day, 9);
  assert.equal(jump.resources.food, 0);
  assert.equal(jump.resources.water, 0);
  assert.ok(jump.health >= 1);
  assert.equal(jump.truckHealth, 44);
});

test('saved progress round trips without applying surprise offline decay', () => {
  const storage = memoryStorage();
  const state = performAction(createGame('male', '하늘'), 'expand').state;
  assert.equal(saveGame(state, storage), true);
  const loaded = loadGame(storage);
  assert.ok(loaded);
  assert.ok(loaded.lastSaved > 0);
  assert.deepEqual({ ...loaded, lastSaved: 0 }, state);
  assert.equal(state.lastSaved, 0);
});

test('corrupt saves and inconsistent or dangerous field values are rejected', () => {
  const storage = memoryStorage();
  for (const raw of ['{broken', 'null', '[]', '{"version":2}', '"text"']) {
    storage.setItem(SAVE_KEY, raw);
    assert.equal(loadGame(storage), null);
  }
  const mutations: Array<(state: GameState) => void> = [
    state => { state.resources.food = -5; },
    state => { state.energy = 999; },
    state => { state.day += 1; },
    state => { state.level = 100; },
    state => { state.plots[1].id = state.plots[0].id; },
    state => { state.plots[0].plantedAt = state.totalMinutes + 1; },
    state => { state.quests = ['bigger-home']; },
    state => { state.resources.wood = 1.5; },
    state => { state.stats.expansions = 6; },
    state => { state.plots.pop(); },
  ];
  for (const mutate of mutations) {
    const state = createGame();
    mutate(state);
    storage.setItem(SAVE_KEY, JSON.stringify(state));
    assert.equal(loadGame(storage), null);
  }
});

test('unavailable or quota-limited storage does not crash the game', () => {
  const storage: SaveStorage = {
    getItem() { throw new Error('disabled'); },
    setItem() { throw new Error('quota'); },
  };
  assert.equal(saveGame(createGame(), storage), false);
  assert.equal(loadGame(storage), null);
});

test('maximum deck expansion cannot charge the player or create invalid extra plots', () => {
  let state = createGame();
  state.resources.wood = 10_000;
  state.resources.scrap = 10_000;
  for (let level = 1; level < MAX_DECK_LEVEL; level++) {
    const result = performAction(state, 'expand');
    assert.equal(result.ok, true);
    state = result.state;
  }
  assert.equal(state.deckLevel, MAX_DECK_LEVEL);
  assert.equal(state.plots.length, MAX_DECK_LEVEL + 2);
  assert.equal(new Set(state.plots.map(plot => plot.id)).size, state.plots.length);
  const blocked = performAction(state, 'expand');
  assert.equal(blocked.ok, false);
  assert.equal(blocked.state, state);
  assert.equal(saveGame(state, memoryStorage()), true);
});

test('all starter goals can be completed through normal play and persisted', () => {
  let state = performAction(createGame(), 'expand').state;
  state = performAction(state, 'harvest').state;
  state = performAction(state, 'plant').state;
  state = performAction(state, 'water').state;
  for (let i = 0; i < 3; i++) state = performAction(state, 'gather').state;
  state = performAction(state, 'rest').state;
  state = performAction(state, 'harvest').state;
  assert.ok(questList(state).every(quest => quest.complete));
  assert.equal(state.quests.length, 3);
  assert.ok(state.level >= 2);
  const storage = memoryStorage();
  assert.equal(saveGame(state, storage), true);
  assert.equal(loadGame(storage)?.quests.length, 3);
});

test('extended mixed play keeps resources, stats, crop IDs, and save state consistent', () => {
  let state = createGame();
  const storage = memoryStorage();
  const activities: Action[] = ['gather', 'plant', 'water', 'chop', 'harvest', 'expand', 'repair', 'pet', 'rest'];
  for (let i = 0; i < 1200; i++) {
    const previous = JSON.stringify(state);
    const activity = state.energy < 16 ? 'rest' : activities[(i * 7) % activities.length];
    const result = performAction(state, activity);
    assert.equal(JSON.stringify(state), previous, `input mutated at action ${i}`);
    state = tick(result.state, (i % 4) * 0.5);
    assert.ok(Object.values(state.resources).every(value => Number.isInteger(value) && value >= 0));
    assert.ok([state.health, state.energy, state.morale, state.truckHealth].every(value => value >= 0 && value <= 100));
    assert.equal(state.plots.length, state.deckLevel + 2);
    assert.equal(state.stats.expansions, state.deckLevel - 1);
    assert.equal(state.day, Math.floor(state.totalMinutes / 1440) + 1);
    assert.equal(state.level, Math.floor(state.xp / 120) + 1);
    assert.equal(saveGame(state, storage), true, `invalid save at action ${i}`);
    if (i % 100 === 0) assert.ok(loadGame(storage));
  }
  assert.ok(state.day > 10);
  assert.equal(state.deckLevel, MAX_DECK_LEVEL);
  assert.ok(state.stats.harvests > 10);
});

test('chopping uses an independent action, produces logs, and enforces energy costs', () => {
  const state = createGame();
  const chopped = performAction(state, 'chop');
  assert.equal(chopped.ok, true);
  assert.equal(chopped.state.resources.wood, state.resources.wood + 18);
  assert.equal(chopped.state.resources.seeds, state.resources.seeds + 1);
  assert.equal(chopped.state.resources.scrap, state.resources.scrap);
  assert.equal(chopped.state.energy, state.energy - 10);
  assert.equal(chopped.state.stats.chops, 1);
  assert.equal(chopped.state.stats.gathers, 0);
  assert.match(chopped.state.log[0], /도끼/);
  assert.equal(state.stats.chops, 0);
  const tired = { ...state, energy: 9 };
  assert.equal(performAction(tired, 'chop').state, tired);
});

test('a hunt starts with a single energy payment and no upfront loot or experience', () => {
  const state = createGame();
  const before = JSON.stringify(state);
  const started = beginHunt(state, 2);
  assert.equal(started.ok, true);
  assert.equal(started.state.energy, state.energy - 16);
  assert.deepEqual(started.state.resources, state.resources);
  assert.equal(started.state.xp, state.xp);
  assert.equal(started.state.health, state.health);
  assert.equal(started.state.stats.hunts, 1);
  assert.deepEqual(started.state.expedition, { id: 1, stage: 2 });
  assert.equal(JSON.stringify(state), before);
  assert.equal(beginHunt(started.state, 1).ok, false);
  assert.equal(performAction(started.state, 'rest').ok, false);
  assert.equal(tick(started.state, 30), started.state);
  const legacyAction = performAction(state, 'hunt');
  assert.equal(legacyAction.ok, false);
  assert.equal(legacyAction.state, state);
});

test('hunts validate stage, health, and energy before charging the player', () => {
  const state = createGame();
  for (const stage of [0, 4, 1.5, NaN, Infinity]) {
    assert.equal(beginHunt(state, stage).state, state);
    assert.equal(beginHunt(state, stage).ok, false);
  }
  for (const patch of [{ health: 14 }, { energy: 15 }]) {
    const unavailable = { ...state, ...patch };
    assert.equal(beginHunt(unavailable, 1).state, unavailable);
    assert.equal(beginHunt(unavailable, 1).ok, false);
  }
  assert.equal(beginHunt({ ...state, energy: 16, health: 15 }, 1).ok, true);
});

test('victories grant stage-specific loot once and record the actual health and kills', () => {
  const initial = createGame();
  const started = beginHunt(initial, 3).state;
  const result: HuntResult = { outcome: 'victory', stage: 3, remainingHealth: 63, enemiesDefeated: 12, duration: 42.5 };
  const won = finishHunt(started, result, started.expedition!.id);
  assert.equal(won.ok, true);
  assert.equal(won.state.expedition, null);
  assert.equal(won.state.resources.food, initial.resources.food + 12);
  assert.equal(won.state.resources.wood, initial.resources.wood + 2);
  assert.equal(won.state.resources.scrap, initial.resources.scrap + 6);
  assert.equal(won.state.xp, 50);
  assert.equal(won.state.energy, started.energy);
  assert.equal(won.state.health, 63);
  assert.equal(won.state.stats.hunts, 1);
  assert.equal(won.state.stats.battlesWon, 1);
  assert.equal(won.state.stats.defeatedEnemies, 12);
  assert.equal(won.state.totalMinutes, initial.totalMinutes + 85);
  assert.equal(started.expedition?.id, 1);
  assert.equal(finishHunt(won.state, result, 1).ok, false);
  assert.equal(finishHunt(won.state, result, 1).state, won.state);
  const later = beginHunt(won.state, 3).state;
  assert.equal(later.expedition?.id, 2);
  assert.equal(finishHunt(later, result, 1).state, later);
});

test('defeat and retreat retain combat damage, grant no loot, and let the player recover', () => {
  for (const outcome of ['defeat', 'retreat'] as const) {
    const initial = createGame();
    const started = beginHunt(initial, 1).state;
    const finished = finishHunt(started, {
      outcome, stage: 1, remainingHealth: outcome === 'defeat' ? 0 : 41, enemiesDefeated: 2, duration: 20,
    }, started.expedition!.id);
    assert.equal(finished.ok, true);
    assert.equal(finished.state.health, outcome === 'defeat' ? 1 : 41);
    assert.deepEqual(finished.state.resources, initial.resources);
    assert.equal(finished.state.xp, 0);
    assert.equal(finished.state.stats.battlesWon, 0);
    assert.equal(finished.state.stats.defeatedEnemies, 2);
    assert.equal(finished.state.expedition, null);
    assert.equal(performAction(finished.state, 'rest').ok, true);
  }
});

test('interrupted expeditions survive saving and recover as unrewarded retreats', () => {
  const storage = memoryStorage();
  const started = beginHunt(createGame(), 2).state;
  assert.equal(saveGame(started, storage), true);
  const restored = loadGame(storage)!;
  assert.deepEqual(restored.expedition, started.expedition);
  const cancelled = cancelHunt(restored);
  assert.equal(cancelled.ok, true);
  assert.equal(cancelled.state.expedition, null);
  assert.equal(cancelled.state.energy, started.energy);
  assert.deepEqual(cancelled.state.resources, started.resources);
  assert.equal(cancelled.state.xp, started.xp);
  assert.equal(cancelled.state.stats.battlesWon, 0);
  assert.equal(cancelHunt(cancelled.state).state, cancelled.state);
  assert.equal(saveGame(cancelled.state, storage), true);
});

test('malformed or mismatched battle results never change the pending expedition', () => {
  const started = beginHunt(createGame(), 1).state;
  const valid: HuntResult = { outcome: 'victory', stage: 1, remainingHealth: 90, enemiesDefeated: 6, duration: 30 };
  const badResults: unknown[] = [
    null, {}, { ...valid, stage: 2 }, { ...valid, outcome: 'unknown' },
    { ...valid, remainingHealth: NaN }, { ...valid, remainingHealth: Infinity },
    { ...valid, enemiesDefeated: -1 }, { ...valid, enemiesDefeated: 1.5 }, { ...valid, enemiesDefeated: 1001 },
    { ...valid, duration: -1 }, { ...valid, duration: 3601 }, { ...valid, duration: Infinity },
  ];
  for (const result of badResults) {
    const settled = finishHunt(started, result as HuntResult, 1);
    assert.equal(settled.ok, false);
    assert.equal(settled.state, started);
  }
  for (const token of [0, 2, NaN, 1.5]) assert.equal(finishHunt(started, valid, token).state, started);
  assert.equal(finishHunt(started, { ...valid, remainingHealth: 101 }, 1).state.health, 100);
});

test('original version 1 saves migrate new counters without changing existing progress', () => {
  const storage = memoryStorage();
  const initial = performAction(createGame('male', '예전 생존자'), 'expand').state;
  initial.stats.hunts = 7;
  const legacy = JSON.parse(JSON.stringify(initial));
  delete legacy.expedition;
  delete legacy.stats.chops;
  delete legacy.stats.battlesWon;
  delete legacy.stats.defeatedEnemies;
  storage.setItem(SAVE_KEY, JSON.stringify(legacy));
  const restored = loadGame(storage);
  assert.ok(restored);
  assert.deepEqual(restored, initial);
  assert.equal(beginHunt(restored, 1).state.expedition?.id, 8);
  assert.equal(saveGame(restored, storage), true);
});

test('migration does not silently fix corrupt new counters or pending expedition data', () => {
  const storage = memoryStorage();
  const mutations: Array<(state: Record<string, any>) => void> = [
    state => { state.stats.chops = null; },
    state => { state.stats.battlesWon = -1; },
    state => { state.stats.defeatedEnemies = '0'; },
    state => { state.stats.battlesWon = 1; },
    state => { state.expedition = { id: 0, stage: 1 }; },
    state => { state.expedition = { id: 1, stage: 1 }; },
    state => { state.expedition = false; },
  ];
  for (const mutate of mutations) {
    const invalid = JSON.parse(JSON.stringify(createGame()));
    mutate(invalid);
    storage.setItem(SAVE_KEY, JSON.stringify(invalid));
    assert.equal(loadGame(storage), null);
  }
  const pending = beginHunt(createGame(), 2).state;
  for (const expedition of [{ id: 2, stage: 2 }, { id: 1, stage: 4 }]) {
    storage.setItem(SAVE_KEY, JSON.stringify({ ...pending, expedition }));
    assert.equal(loadGame(storage), null);
  }
});
