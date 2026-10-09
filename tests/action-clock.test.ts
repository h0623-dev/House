import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, getCropProgress, performAction, saveGame, tick, type SaveStorage } from '../src/game.ts';
import { buildFacility, collectProduction, startProduction } from '../src/settlement.ts';
import { realDuration } from '../src/game-speed.ts';
import { GAME_MINUTES_PER_SECOND } from '../src/game-time.ts';

function memoryStorage(): SaveStorage {
  const values = new Map<string, string>();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); } };
}

test('an animated gathering commit awards one result without replaying elapsed time or finishing production early', () => {
  let state = createGame();
  state = buildFacility(state, 'waterworks', 0).state;
  state = startProduction(state, 1).state;
  state = tick(state, realDuration(10));
  const before = structuredClone(state);
  const completed = performAction(state, 'gather', undefined, 'carrot', { advanceClock: false });
  assert.equal(completed.ok, true);
  assert.deepEqual(state, before);
  assert.equal(completed.state.totalMinutes, state.totalMinutes);
  assert.equal(completed.state.minutes, state.minutes);
  assert.equal(completed.state.day, state.day);
  assert.equal(completed.state.resources.wood, state.resources.wood + 10);
  assert.equal(completed.state.resources.scrap, state.resources.scrap + 5);
  assert.equal(completed.state.resources.water, state.resources.water + 4);
  assert.equal(completed.state.resources.seeds, state.resources.seeds + 3);
  assert.equal(completed.state.xp, state.xp + 12);
  assert.equal(completed.state.energy, state.energy - 10);
  assert.equal(completed.state.stats.gathers, state.stats.gathers + 1);
  assert.equal(completed.state.settlement!.buildings[0].readyAt! - completed.state.totalMinutes, 25, 'new45-minute batch keeps its remaining25 minutes after20 elapsed');
  assert.equal(collectProduction(completed.state, 1).ok, false);
  const nearlyReady = tick(completed.state, 25 / GAME_MINUTES_PER_SECOND - .125);
  assert.equal(collectProduction(nearlyReady, 1).ok, false);
  const ready = tick(nearlyReady, .125);
  const collected = collectProduction(ready, 1);
  assert.equal(collected.ok, true);
  assert.equal(collected.state.resources.water, completed.state.resources.water + 4);
  assert.equal(collectProduction(collected.state, 1).ok, false);
  assert.equal(saveGame(collected.state, memoryStorage()), true);
});

test('finishing an animated chore cannot cross midnight before its real countdown or charge provisions twice', () => {
  const state = createGame();
  state.minutes = 1400;
  state.totalMinutes = 1400;
  const walking = tick(state, realDuration(10));
  assert.equal(walking.totalMinutes, 1420);
  const done = performAction(walking, 'gather', undefined, 'carrot', { advanceClock: false }).state;
  assert.equal(done.day, 1);
  assert.equal(done.resources.food, state.resources.food);
  assert.equal(done.resources.water, state.resources.water + 4);
  assert.equal(done.truckHealth, state.truckHealth);
  const morning = tick(done, realDuration(10));
  assert.equal(morning.day, 2);
  assert.equal(morning.minutes, 0);
  assert.equal(morning.resources.food, state.resources.food - 2);
  assert.equal(morning.resources.water, state.resources.water + 4 - 3);
  assert.equal(morning.truckHealth, state.truckHealth - 7);
  const anotherDone = performAction(morning, 'chop', undefined, 'carrot', { advanceClock: false }).state;
  assert.equal(anotherDone.totalMinutes, morning.totalMinutes);
  assert.equal(anotherDone.resources.food, morning.resources.food);
  assert.equal(anotherDone.resources.water, morning.resources.water);
  assert.equal(anotherDone.truckHealth, morning.truckHealth);
});

test('a planted seed records the actual completion clock and starts its own unchanged growth duration', () => {
  const started = createGame();
  const arrived = tick(started, realDuration(6));
  const planted = performAction(arrived, 'plant', 3, 'carrot', { advanceClock: false }).state;
  assert.equal(planted.plots[2].plantedAt, arrived.totalMinutes);
  assert.equal(planted.totalMinutes, arrived.totalMinutes);
  assert.equal(getCropProgress(planted, planted.plots[2]), 0);
  const watered = performAction(planted, 'water', 3, 'carrot', { advanceClock: false }).state;
  assert.equal(watered.totalMinutes, planted.totalMinutes);
  assert.equal(watered.resources.water, planted.resources.water - 1);
  assert.equal(getCropProgress(watered, watered.plots[2]), 0);
  const almost = tick(watered, realDuration(89));
  assert.ok(getCropProgress(almost, almost.plots[2]) < 1);
  const mature = tick(almost, realDuration(1));
  assert.equal(getCropProgress(mature, mature.plots[2]), 1);
  const harvested = performAction(mature, 'harvest', 3, 'carrot', { advanceClock: false });
  assert.equal(harvested.ok, true);
  assert.equal(harvested.state.totalMinutes, mature.totalMinutes);
  assert.equal(saveGame(harvested.state, memoryStorage()), true);
});

test('clock-aware commits preserve paused time, while older synchronous calls retain their original duration', () => {
  const state = createGame();
  const paused = performAction(state, 'gather', undefined, 'carrot', { advanceClock: false });
  assert.equal(paused.state.totalMinutes, state.totalMinutes);
  const legacy = performAction(state, 'gather');
  assert.equal(legacy.state.totalMinutes, state.totalMinutes + 35);
  assert.deepEqual(paused.state.resources, legacy.state.resources);
  assert.equal(paused.state.energy, legacy.state.energy);
  assert.equal(paused.state.xp, legacy.state.xp);
  const refusal = performAction({ ...state, energy: 0 }, 'gather', undefined, 'carrot', { advanceClock: false });
  assert.equal(refusal.ok, false);
  assert.equal(refusal.state.totalMinutes, state.totalMinutes);
});
