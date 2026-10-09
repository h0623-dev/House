import test from 'node:test';
import assert from 'node:assert/strict';
import { applyOfflineProgress, createGame, getCropProgress, loadGame, MAX_OFFLINE_SECONDS, performAction, SAVE_KEY, saveGame, type SaveStorage } from '../src/game.ts';
import { buildFacility, collectProduction, startProduction } from '../src/settlement.ts';

function memoryStorage(): SaveStorage {
  const values = new Map<string, string>();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); } };
}

test('resuming advances existing crops and paid production without auto-harvest or free resources', () => {
  assert.equal(MAX_OFFLINE_SECONDS, 105, 'the twofold clock keeps the former 420-game-minute offline ceiling');
  let state = createGame();
  state = performAction(state, 'plant', 3, 'pumpkin').state;
  state = performAction(state, 'water', 3).state;
  state = buildFacility(state, 'waterworks', 0).state;
  state = startProduction(state, 1).state;
  state.lastSaved = 100_000;
  const before = JSON.stringify(state);
  const resumed = applyOfflineProgress(state, 400_000);
  assert.equal(resumed.secondsApplied, MAX_OFFLINE_SECONDS);
  assert.equal(resumed.state.totalMinutes, state.totalMinutes + 420);
  assert.equal(resumed.state.lastSaved, 400_000);
  assert.equal(JSON.stringify(state), before);
  assert.equal(getCropProgress(resumed.state, resumed.state.plots[2]), 1);
  assert.deepEqual(resumed.state.resources, state.resources);
  assert.equal(resumed.state.stats.harvests, state.stats.harvests);
  assert.equal(resumed.state.settlement!.stats!.collections, 0);
  assert.equal(collectProduction(resumed.state, 1).ok, true);
  assert.equal(performAction(resumed.state, 'harvest', 3).ok, true);
  const repeated = applyOfflineProgress(resumed.state, 400_000);
  assert.equal(repeated.secondsApplied, 0);
  assert.equal(repeated.state.totalMinutes, resumed.state.totalMinutes);
  assert.deepEqual(repeated.state.resources, state.resources);
  assert.equal(saveGame(resumed.state, memoryStorage()), true);
});

test('small absences use whole real seconds, while very long absences cross at most one midnight', () => {
  const state = createGame();
  state.lastSaved = 100_000;
  const short = applyOfflineProgress(state, 102_999);
  assert.equal(short.secondsApplied, 2);
  assert.equal(short.state.totalMinutes, state.totalMinutes + 8);
  assert.equal(short.state.lastSaved, 102_999);
  const repeated = applyOfflineProgress(short.state, 103_999);
  assert.equal(repeated.secondsApplied, 1);
  state.totalMinutes = 1430;
  state.minutes = 1430;
  const long = applyOfflineProgress(state, 100_000 + 20 * 86_400_000);
  assert.equal(long.secondsApplied, 105);
  assert.equal(long.state.day, 2);
  assert.equal(long.state.minutes, 410);
  assert.equal(long.state.resources.food, state.resources.food - 2);
  assert.equal(long.state.resources.water, state.resources.water - 3);
  assert.equal(long.state.truckHealth, state.truckHealth - 7);
  assert.equal(saveGame(long.state, memoryStorage()), true);
});

test('an unsaved new village establishes a baseline without applying the epoch as elapsed time', () => {
  const state = createGame();
  const resumed = applyOfflineProgress(state, 1_900_000_000_000);
  assert.equal(resumed.secondsApplied, 0);
  assert.equal(resumed.state.totalMinutes, state.totalMinutes);
  assert.equal(resumed.state.lastSaved, 1_900_000_000_000);
  assert.deepEqual(resumed.state.resources, state.resources);
});

test('invalid and backwards clocks are ignored and a paused expedition consumes no village time', () => {
  const state = createGame();
  state.lastSaved = 100_000;
  for (const invalid of [NaN, Infinity, -1, 1.5, 100_000_000_000_001, 99_999]) {
    const resumed = applyOfflineProgress(state, invalid);
    assert.equal(resumed.secondsApplied, 0);
    assert.equal(resumed.state, state);
  }
  state.expedition = { id: 1, stage: 1 };
  const paused = applyOfflineProgress(state, 500_000);
  assert.equal(paused.secondsApplied, 0);
  assert.equal(paused.state.totalMinutes, state.totalMinutes);
  assert.equal(paused.state.lastSaved, 500_000);
  assert.deepEqual(paused.state.resources, state.resources);
  paused.state.expedition = null;
  const again = applyOfflineProgress(paused.state, 500_000);
  assert.equal(again.secondsApplied, 0);
  assert.equal(again.state.totalMinutes, state.totalMinutes);
});

test('loading itself still leaves old saves and timestamps unchanged until the explicit resume step', () => {
  const state = createGame();
  state.lastSaved = 100_000;
  delete state.villageOrders;
  const storage = memoryStorage();
  storage.setItem(SAVE_KEY, JSON.stringify(state));
  const loaded = loadGame(storage)!;
  assert.deepEqual(loaded, state);
  assert.equal(loaded.villageOrders, undefined);
  const resumed = applyOfflineProgress(loaded, 101_000);
  assert.equal(resumed.secondsApplied, 1);
  assert.equal(resumed.state.villageOrders, undefined);
});

test('offline clock headroom keeps supported maximum-day saves valid', () => {
  const state = createGame();
  state.day = 1_000_000;
  state.minutes = 1439;
  state.totalMinutes = (state.day - 1) * 1440 + state.minutes;
  state.lastSaved = 100_000;
  const resumed = applyOfflineProgress(state, 500_000);
  assert.equal(resumed.secondsApplied, 0);
  assert.equal(resumed.state.totalMinutes, state.totalMinutes);
  assert.equal(saveGame(resumed.state, memoryStorage()), true);
});
