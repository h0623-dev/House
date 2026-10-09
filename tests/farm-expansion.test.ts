import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceTime, beginHunt, createGame, CROPS, farmExpansionCost, getFarmCapacity,
  loadGame, MAX_DECK_LEVEL, performAction, SAVE_KEY, saveGame, type GameState, type SaveStorage,
} from '../src/game.ts';

function memoryStorage(): SaveStorage {
  const values = new Map<string, string>();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); } };
}

/** A valid pre-expansion-feature save with only the automatically granted plots. */
function legacyDeck(level: number): GameState {
  const state = createGame();
  state.deckLevel = level;
  state.stats.expansions = level - 1;
  for (let id = 4; id <= level + 2; id++) state.plots.push({ id, plantedAt: null, watered: false });
  state.resources.wood = 10_000;
  state.resources.scrap = 10_000;
  return state;
}

function assertRejectedWithoutMutation(state: GameState, expectedMessage: RegExp) {
  const before = JSON.stringify(state);
  const result = performAction(state, 'expandFarm');
  assert.equal(result.ok, false);
  assert.equal(result.state, state);
  assert.match(result.message, expectedMessage);
  assert.equal(JSON.stringify(state), before);
}

test('farm capacity grows from three to eighteen while each deck expansion still grants one plot', () => {
  let state = legacyDeck(1);
  for (let level = 1; level <= MAX_DECK_LEVEL; level++) {
    assert.equal(state.deckLevel, level);
    assert.equal(getFarmCapacity(state), level * 3);
    while (state.plots.length < getFarmCapacity(state)) {
      state.energy = 100;
      const expanded = performAction(state, 'expandFarm');
      assert.equal(expanded.ok, true);
      assert.equal(expanded.state.plots.length, state.plots.length + 1);
      state = expanded.state;
      assert.equal(saveGame(state, memoryStorage()), true);
    }
    assertRejectedWithoutMutation(state, level < MAX_DECK_LEVEL ? /트럭을 확장/ : /18칸/);
    if (level < MAX_DECK_LEVEL) {
      state.energy = 100;
      const previous = state;
      const cost = farmExpansionCost(previous);
      const expandedDeck = performAction(previous, 'expand');
      assert.equal(expandedDeck.ok, true);
      state = expandedDeck.state;
      assert.equal(state.plots.length, previous.plots.length + 1);
      assert.deepEqual(state.plots.slice(0, -1), previous.plots);
      assert.equal(getFarmCapacity(state) - state.plots.length, 2);
      assert.deepEqual(farmExpansionCost(state), cost);
    }
  }
  assert.equal(state.plots.length, 18);
  assert.equal(new Set(state.plots.map(plot => plot.id)).size, 18);
});

test('one farm purchase charges the displayed cost once and never counts as a deck or farming quest', () => {
  const state = performAction(createGame(), 'expand').state;
  state.resources.wood = 100;
  state.resources.scrap = 100;
  const before = JSON.stringify(state);
  const firstCost = farmExpansionCost(state);
  assert.deepEqual(firstCost, { wood: 12, scrap: 6 });
  const first = performAction(state, 'expandFarm');
  assert.equal(first.ok, true);
  assert.equal(first.state.resources.wood, state.resources.wood - firstCost.wood);
  assert.equal(first.state.resources.scrap, state.resources.scrap - firstCost.scrap);
  assert.equal(first.state.energy, state.energy - 8);
  assert.equal(first.state.totalMinutes, state.totalMinutes + 25);
  assert.equal(first.state.xp, state.xp + 10);
  assert.equal(first.state.level, Math.floor(first.state.xp / 120) + 1);
  assert.equal(first.state.deckLevel, state.deckLevel);
  assert.deepEqual(first.state.stats, state.stats);
  assert.deepEqual(first.state.growthQuests, state.growthQuests);
  assert.deepEqual(first.state.quests, state.quests);
  assert.deepEqual(first.state.seedInventory, state.seedInventory);
  assert.deepEqual(first.state.settlement, state.settlement);
  assert.deepEqual(first.state.plots.slice(0, -1), state.plots);
  assert.deepEqual(first.state.plots.at(-1), { id: 5, plantedAt: null, watered: false });
  assert.equal(JSON.stringify(state), before);

  const secondCost = farmExpansionCost(first.state);
  assert.deepEqual(secondCost, { wood: 18, scrap: 9 });
  const second = performAction(first.state, 'expandFarm');
  assert.equal(second.ok, true);
  assert.equal(second.state.resources.wood, state.resources.wood - firstCost.wood - secondCost.wood);
  assert.equal(second.state.resources.scrap, state.resources.scrap - firstCost.scrap - secondCost.scrap);
  assert.equal(second.state.plots.length, 6);
  assertRejectedWithoutMutation(second.state, /트럭을 확장/);
});

test('insufficient wood, scrap, energy, full decks and active expeditions fail atomically', () => {
  for (const resource of ['wood', 'scrap'] as const) {
    const state = legacyDeck(2);
    state.resources[resource] = farmExpansionCost(state)[resource] - 1;
    assertRejectedWithoutMutation(state, /목재 12 · 고철 6/);
  }
  const tired = legacyDeck(2);
  tired.energy = 7;
  assertRejectedWithoutMutation(tired, /기운이 부족/);
  assertRejectedWithoutMutation(legacyDeck(1), /트럭을 확장/);
  const hunt = beginHunt(legacyDeck(2), 1);
  assert.equal(hunt.ok, true);
  assertRejectedWithoutMutation(hunt.state, /사냥을 마친 뒤/);
});

test('new plots support planting, watering and harvesting the selected seed through a save round trip', () => {
  const original = legacyDeck(2);
  original.plots[1].cropId = 'potato';
  const expanded = performAction(original, 'expandFarm');
  assert.equal(expanded.ok, true);
  const plotId = expanded.state.plots.at(-1)!.id;
  const planted = performAction(expanded.state, 'plant', plotId, 'pumpkin');
  assert.equal(planted.ok, true);
  const watered = performAction(planted.state, 'water', plotId);
  assert.equal(watered.ok, true);
  assert.deepEqual(watered.state.plots.slice(0, -1), original.plots);
  const storage = memoryStorage();
  assert.equal(saveGame(watered.state, storage), true);
  const loaded = loadGame(storage)!;
  assert.ok(loaded);
  assert.deepEqual(loaded, { ...watered.state, lastSaved: loaded.lastSaved });
  const grown = advanceTime(loaded, CROPS.pumpkin.growMinutes);
  const harvested = performAction(grown, 'harvest', plotId);
  assert.equal(harvested.ok, true);
  assert.equal(harvested.state.resources.food, grown.resources.food + CROPS.pumpkin.food);
  assert.equal(harvested.state.seedInventory!.pumpkin, grown.seedInventory!.pumpkin + CROPS.pumpkin.seedReturn);
  assert.equal(harvested.state.plots.at(-1)!.plantedAt, null);
  assert.deepEqual(harvested.state.plots.slice(0, -1), original.plots);
  assert.equal(saveGame(harvested.state, storage), true);
  assert.equal(loadGame(storage)!.plots.length, 5);
});

test('old saves at every deck level retain their exact plots, crops and quantities without free additions', () => {
  for (let level = 1; level <= MAX_DECK_LEVEL; level++) {
    const original = legacyDeck(level);
    original.plots[1].cropId = 'tomato';
    const storage = memoryStorage();
    storage.setItem(SAVE_KEY, JSON.stringify(original));
    const loaded = loadGame(storage)!;
    assert.deepEqual(loaded, original);
    assert.equal(loaded.plots.length, level + 2);
    assert.deepEqual(farmExpansionCost(loaded), { wood: 12, scrap: 6 });
  }

  const oldest = legacyDeck(4);
  delete oldest.seedInventory;
  for (const plot of oldest.plots) delete plot.cropId;
  const storage = memoryStorage();
  storage.setItem(SAVE_KEY, JSON.stringify(oldest));
  const migrated = loadGame(storage)!;
  assert.ok(migrated);
  assert.deepEqual(migrated.resources, oldest.resources);
  assert.deepEqual(migrated.stats, oldest.stats);
  assert.deepEqual(migrated.plots, oldest.plots.map(plot => plot.plantedAt === null ? plot : { ...plot, cropId: 'carrot' }));
  assert.equal(saveGame(migrated, storage), true);
  assert.deepEqual(loadGame(storage)!.plots, migrated.plots);
});

test('save validation accepts every earned plot count and rejects missing, over-capacity and duplicate plots', () => {
  for (let level = 1; level <= MAX_DECK_LEVEL; level++) {
    for (let count = level + 2; count <= level * 3; count++) {
      const valid = legacyDeck(level);
      for (let id = valid.plots.length + 1; id <= count; id++) valid.plots.push({ id, plantedAt: null, watered: false });
      const storage = memoryStorage();
      assert.equal(saveGame(valid, storage), true, `level ${level}, plots ${count}`);
      assert.deepEqual(loadGame(storage)!.plots, valid.plots);
    }
    const missing = legacyDeck(level);
    missing.plots.pop();
    const excessive = legacyDeck(level);
    while (excessive.plots.length <= getFarmCapacity(excessive)) {
      excessive.plots.push({ id: excessive.plots.length + 1, plantedAt: null, watered: false });
    }
    const duplicate = legacyDeck(level);
    duplicate.plots[1].id = duplicate.plots[0].id;
    for (const invalid of [missing, excessive, duplicate]) {
      const storage = memoryStorage();
      const savedBefore = JSON.stringify(createGame());
      storage.setItem(SAVE_KEY, savedBefore);
      assert.equal(saveGame(invalid, storage), false);
      assert.equal(storage.getItem(SAVE_KEY), savedBefore);
      storage.setItem(SAVE_KEY, JSON.stringify(invalid));
      assert.equal(loadGame(storage), null);
    }
  }
});

test('sparse imported plot IDs remain stable and future farm and deck additions remain saveable', () => {
  let state = legacyDeck(2);
  state.plots.forEach((plot, index) => { plot.id = [10, 30, 70, 100][index]; });
  const originalPlots = structuredClone(state.plots);
  assert.equal(saveGame(state, memoryStorage()), true);
  const farm = performAction(state, 'expandFarm');
  assert.equal(farm.ok, true);
  assert.deepEqual(farm.state.plots.slice(0, 4), originalPlots);
  assert.equal(saveGame(farm.state, memoryStorage()), true);
  const deck = performAction(farm.state, 'expand');
  assert.equal(deck.ok, true);
  state = deck.state;
  assert.deepEqual(state.plots.slice(0, 4), originalPlots);
  assert.equal(state.plots.length, 6);
  assert.equal(new Set(state.plots.map(plot => plot.id)).size, 6);
  assert.equal(saveGame(state, memoryStorage()), true);
});
