import test from 'node:test';
import assert from 'node:assert/strict';
import { GAME_MINUTES_PER_SECOND, gameMinutesToSeconds, formatGameDuration } from '../src/game-time.ts';
import { createGame, CROPS, CROP_IDS, getCropProgress, performAction, tick } from '../src/game.ts';
import { BUILDINGS, BUILDING_TYPES, buildFacility, collectProduction, startProduction } from '../src/settlement.ts';

test('game durations display remaining real seconds, rounded up and never negative', () => {
  assert.equal(GAME_MINUTES_PER_SECOND, 2);
  for (const [minutes, seconds] of [[90, 45], [76, 38], [75.9, 38], [1, 1], [0.1, 1], [0, 0], [-3, 0]]) {
    assert.equal(gameMinutesToSeconds(minutes), seconds);
    assert.equal(formatGameDuration(minutes), `${seconds}초`);
  }
});

test('all six facility messages count real seconds until the unchanged production completion boundary', () => {
  for (const type of BUILDING_TYPES) {
    let state = createGame();
    state.resources.wood = 1_000;
    state.resources.scrap = 1_000;
    while (state.deckLevel < BUILDINGS[type].unlockLevel) state = performAction(state, 'expand').state;
    const built = buildFacility(state, type, 0);
    assert.equal(built.ok, true, type);
    const started = startProduction(built.state, 1);
    assert.equal(started.ok, true, type);
    const production = started.state.settlement!.buildings[0];
    const duration = BUILDINGS[type].minutes;
    const seconds = gameMinutesToSeconds(duration);
    assert.equal(production.startedAt, built.state.totalMinutes);
    assert.equal(production.readyAt, built.state.totalMinutes + duration);
    assert.ok(started.message.includes(`${seconds}초 뒤`), started.message);
    assert.equal(started.message.includes('게임 시간'), false);
    assert.equal(started.message.includes(`${duration}분`), false);

    const almost = tick(started.state, seconds - 0.5);
    assert.equal(formatGameDuration(production.readyAt! - almost.totalMinutes), '1초');
    const early = collectProduction(almost, 1);
    assert.equal(early.ok, false, type);
    assert.equal(early.state, almost);
    const ready = tick(almost, 0.5);
    assert.equal(ready.totalMinutes, production.readyAt);
    assert.equal(formatGameDuration(production.readyAt! - ready.totalMinutes), '0초');
    assert.equal(collectProduction(ready, 1).ok, true, type);
    assert.equal(started.state.totalMinutes, built.state.totalMinutes);
  }
});

test('a rainwater countdown showing 76 game minutes now shows 38 seconds with exactly 38 seconds left', () => {
  const built = buildFacility(createGame(), 'waterworks', 0);
  const started = startProduction(built.state, 1).state;
  const state = tick(started, 7);
  const remaining = state.settlement!.buildings[0].readyAt! - state.totalMinutes;
  assert.equal(remaining, 76);
  assert.equal(formatGameDuration(remaining), '38초');
  assert.equal(collectProduction(tick(state, 37), 1).ok, false);
  assert.equal(collectProduction(tick(state, 38), 1).ok, true);
});

test('all six watered crops ripen at the displayed seconds without changing stored growth minutes', () => {
  for (const cropId of CROP_IDS) {
    const state = createGame();
    const plot = state.plots[2];
    plot.cropId = cropId;
    plot.plantedAt = state.totalMinutes;
    plot.watered = true;
    const before = JSON.stringify(state);
    const seconds = gameMinutesToSeconds(CROPS[cropId].growMinutes);
    const almost = tick(state, seconds - 1);
    assert.ok(getCropProgress(almost, almost.plots[2]) < 1, cropId);
    const ripe = tick(almost, 1);
    assert.equal(getCropProgress(ripe, ripe.plots[2]), 1, cropId);
    assert.equal(ripe.totalMinutes - plot.plantedAt, CROPS[cropId].growMinutes);
    assert.equal(JSON.stringify(state), before);
  }
});
