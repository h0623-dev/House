import test from 'node:test';
import assert from 'node:assert/strict';
import { GAME_MINUTES_PER_SECOND, gameMinutesToSeconds, formatGameDuration } from '../src/game-time.ts';
import { GAME_SPEED_MULTIPLIER, realDuration } from '../src/game-speed.ts';
import { createGame, CROPS, CROP_IDS, getCropProgress, performAction, tick } from '../src/game.ts';
import { BUILDINGS, BUILDING_TYPES, buildFacility, collectProduction, getProductionMinutes, formatProductionDuration, startProduction } from '../src/settlement.ts';

test('game durations display remaining real seconds, rounded up and never negative', () => {
  assert.equal(GAME_SPEED_MULTIPLIER, 2);
  assert.equal(GAME_MINUTES_PER_SECOND, 4);
  for (const [minutes, seconds] of [[90, 23], [76, 19], [75.9, 19], [1, 1], [0.1, 1], [0, 0], [-3, 0]]) {
    assert.equal(gameMinutesToSeconds(minutes), seconds);
    assert.equal(formatGameDuration(minutes), `${seconds}초`);
  }
});

test('all six facility messages show their twofold-pace preview and collect at the exact fractional completion boundary', () => {
  const expectedSeconds = { waterworks: 11.25, kitchen: 15, workshop: 18.75, petHouse: 15, greenhouse: 30, watchtower: 22.5 };
  const expectedPreview = { waterworks: '11.3초', kitchen: '15초', workshop: '18.8초', petHouse: '15초', greenhouse: '30초', watchtower: '22.5초' };
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
    const duration = getProductionMinutes(production);
    const seconds = duration / GAME_MINUTES_PER_SECOND;
    assert.equal(seconds, expectedSeconds[type], `${type}: the v17 batch improvement remains at the twofold shared pace`);
    assert.equal(formatProductionDuration(production), expectedPreview[type]);
    assert.equal(production.startedAt, built.state.totalMinutes);
    assert.equal(production.readyAt, built.state.totalMinutes + duration);
    assert.ok(started.message.includes(`${expectedPreview[type]} 뒤`), started.message);
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

test('an existing 76-game-minute rainwater batch displays 19 seconds and completes at its unchanged stored boundary', () => {
  const built = buildFacility(createGame(), 'waterworks', 0);
  const started = startProduction(built.state, 1).state;
  // Explicit earlier v16 paid batch; updating never shortens its stored readyAt.
  started.settlement!.buildings[0].readyAt = started.settlement!.buildings[0].startedAt! + 90;
  const state = tick(started, realDuration(7));
  const remaining = state.settlement!.buildings[0].readyAt! - state.totalMinutes;
  assert.equal(remaining, 76);
  assert.equal(formatGameDuration(remaining), '19초');
  assert.equal(collectProduction(tick(state, 18.75), 1).ok, false);
  assert.equal(collectProduction(tick(state, remaining / GAME_MINUTES_PER_SECOND), 1).ok, true);
});

test('all six watered crops ripen at the exact twofold deadline with a rounded seconds display and unchanged stored growth minutes', () => {
  const expectedSeconds = { carrot: 45, potato: 60, tomato: 67.5, corn: 75, strawberry: 90, pumpkin: 105 };
  for (const cropId of CROP_IDS) {
    const state = createGame();
    const plot = state.plots[2];
    plot.cropId = cropId;
    plot.plantedAt = state.totalMinutes;
    plot.watered = true;
    const before = JSON.stringify(state);
    const seconds = CROPS[cropId].growMinutes / GAME_MINUTES_PER_SECOND;
    assert.equal(seconds, expectedSeconds[cropId], `${cropId}: growth needs half its original real time`);
    assert.equal(gameMinutesToSeconds(CROPS[cropId].growMinutes), Math.ceil(expectedSeconds[cropId]));
    const almost = tick(state, seconds - 1);
    assert.ok(getCropProgress(almost, almost.plots[2]) < 1, cropId);
    const ripe = tick(almost, 1);
    assert.equal(getCropProgress(ripe, ripe.plots[2]), 1, cropId);
    assert.equal(ripe.totalMinutes - plot.plantedAt, CROPS[cropId].growMinutes);
    assert.equal(JSON.stringify(state), before);
  }
});
