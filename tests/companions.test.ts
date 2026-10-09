import test from 'node:test';
import assert from 'node:assert/strict';
import { COMPANION_IDS, getCompanionLevel, getCompanionMaxHealth, getCompanions, MAX_COMPANION_XP, validateCompanions } from '../src/companions.ts';
import { advanceTime, applyOfflineProgress, beginHunt, cancelHunt, createGame, finishHunt, loadGame, performAction, SAVE_KEY, saveGame, tick, type GameState, type HuntResult, type SaveStorage } from '../src/game.ts';
import { claimGrowthQuest } from '../src/growth-quests.ts';
import { buildFacility, collectProduction, moveFacility, replaceFacility, startProduction, upgradeFacility } from '../src/settlement.ts';
import { fulfillVillageOrder, getVillageOrder } from '../src/village-orders.ts';

function storage(): SaveStorage {
  const values = new Map<string, string>();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); } };
}
function result(stage = 1, outcome: HuntResult['outcome'] = 'victory'): HuntResult {
  return { outcome, stage, remainingHealth: 1, companionHealth: { dog: 61.25, cat: 0 }, reserveHealth: { rabbit: 100, fox: 100, boar: 100, owl: 100 }, enemiesDefeated: 8, duration: 7.5 };
}
function assertDetached(before: GameState, after: GameState) {
  assert.notEqual(after, before);
  assert.deepEqual(after.companions, before.companions);
  assert.notEqual(after.companions, before.companions);
  for (const id of COMPANION_IDS) {
    assert.notEqual(after.companions![id], before.companions![id]);
    const health = before.companions![id].health;
    after.companions![id].health = health / 2;
    assert.equal(before.companions![id].health, health);
  }
}

test('both animals start independently and percentage health preserves damage through derived levels', () => {
  const state = createGame(), other = createGame();
  assert.deepEqual(getCompanions(state), { dog: { health: 100, xp: 0 }, cat: { health: 100, xp: 0 } });
  const read = getCompanions(state);
  read.dog.health = 0;
  read.cat.xp = 720;
  assert.deepEqual(state.companions, other.companions);
  state.companions!.dog.health = 31;
  assert.equal(other.companions!.dog.health, 100);
  for (const [xp, level] of [[0, 1], [79, 1], [80, 2], [719, 9], [720, 10]]) {
    const progress = { health: 31, xp };
    assert.equal(getCompanionLevel(progress), level);
    assert.equal(getCompanionMaxHealth('dog', progress), 120 + (level - 1) * 8);
    assert.equal(getCompanionMaxHealth('cat', progress), 90 + (level - 1) * 6);
    assert.equal(progress.health, 31);
  }
});

test('legacy saves discover a detached roster without resources, XP, health or offline gifts', () => {
  const old = createGame();
  delete old.companions;
  old.health = 3;
  old.resources.food = 2;
  const before = JSON.stringify(old), memory = storage();
  memory.setItem(SAVE_KEY, before);
  const loaded = loadGame(memory)!;
  assert.deepEqual(loaded, old);
  assert.equal(Object.hasOwn(loaded, 'companions'), false);
  assert.deepEqual(getCompanions(loaded), { dog: { health: 100, xp: 0 }, cat: { health: 100, xp: 0 } });
  assert.equal(Object.hasOwn(loaded, 'companions'), false);
  const started = beginHunt(loaded, 1);
  assert.equal(started.ok, true);
  assert.equal(started.state.health, 3);
  assert.deepEqual(started.state.resources, old.resources);
  assert.equal(started.state.xp, old.xp);
  assert.equal(started.state.energy, old.energy - 16);
  assert.equal(started.state.totalMinutes, old.totalMinutes);
  assert.deepEqual(started.state.expedition?.unitParticipantIds, ['dog', 'cat']);
  assert.equal(JSON.stringify(old), before);
  assert.equal(saveGame(started.state, memory), true);
  const reloaded = loadGame(memory)!;
  assert.deepEqual(reloaded.companions, started.state.companions);
});

test('modern results preserve the farmer and award participating animals once including an animal downed in victory', () => {
  const initial = createGame();
  initial.health = 7;
  initial.companions!.dog.xp = 75;
  initial.companions!.cat.xp = 719;
  const started = beginHunt(initial, 2).state, snapshot = JSON.stringify(started);
  const won = finishHunt(started, result(2), started.expedition!.id);
  assert.equal(won.ok, true);
  assert.equal(won.state.health, 7);
  assert.deepEqual(won.state.companions, { dog: { health: 61.25, xp: 100 }, cat: { health: 0, xp: MAX_COMPANION_XP } });
  assert.equal(getCompanionLevel(won.state.companions!.dog), 2);
  assert.equal(won.state.totalMinutes, initial.totalMinutes + 30);
  assert.equal(JSON.stringify(started), snapshot);
  const duplicate = finishHunt(won.state, result(2), 1);
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.state, won.state);
  const second = beginHunt(won.state, 2).state;
  assert.deepEqual(second.expedition?.unitParticipantIds, ['dog']);
  assert.equal(finishHunt(second, result(2), 1).state, second);
  const secondWon = finishHunt(second, result(2), 2);
  assert.equal(secondWon.ok, true);
  assert.equal(secondWon.state.companions!.dog.xp, 125);
  assert.equal(secondWon.state.companions!.cat.xp, 720);
});

test('either healthy animal can explore alone while depleted partners cannot receive health or XP from results', () => {
  for (const solo of COMPANION_IDS) {
    const state = createGame(), other = solo === 'dog' ? 'cat' : 'dog';
    state.health = 0;
    state.energy = 16;
    state.companions![solo] = { health: 0.01, xp: 80 };
    state.companions![other] = { health: 0, xp: 160 };
    const started = beginHunt(state, 1);
    assert.equal(started.ok, true);
    assert.deepEqual(started.state.expedition!.unitParticipantIds, [solo]);
    assert.equal(started.state.energy, 0);
    const wrong = { ...result(), companionHealth: { dog: 50, cat: 50 } };
    assert.equal(finishHunt(started.state, wrong, 1).state, started.state);
    const valid = { ...result(), companionHealth: { dog: 0, cat: 0, [solo]: 0.01 } };
    const finished = finishHunt(started.state, valid, 1);
    assert.equal(finished.ok, true);
    assert.equal(finished.state.health, 0);
    assert.equal(finished.state.companions![solo].xp, 100);
    assert.deepEqual(finished.state.companions![other], state.companions![other]);
  }
});

test('rest recovers all animals with the existing meal cost and zero supplies cannot lock exploration forever', () => {
  const down = createGame();
  down.companions = { dog: { health: 0, xp: 100 }, cat: { health: 0, xp: 180 } };
  const before = JSON.stringify(down);
  assert.equal(beginHunt(down, 1).state, down);
  const meal = performAction(down, 'rest', undefined, undefined, { advanceClock: false });
  assert.equal(meal.ok, true);
  assert.deepEqual(meal.state.companions, { dog: { health: 35, xp: 100 }, cat: { health: 35, xp: 180 } });
  assert.equal(meal.state.resources.food, down.resources.food - 1);
  assert.equal(meal.state.resources.water, down.resources.water - 1);
  assert.equal(beginHunt(meal.state, 1).ok, true);
  assert.equal(JSON.stringify(down), before);
  down.resources.food = 0;
  down.resources.water = 0;
  down.energy = 0;
  const nap = performAction(down, 'rest', undefined, undefined, { advanceClock: false });
  assert.deepEqual(nap.state.companions, { dog: { health: 10, xp: 100 }, cat: { health: 10, xp: 180 } });
  assert.deepEqual(nap.state.resources, down.resources);
  assert.equal(nap.state.energy, 35);
  assert.equal(beginHunt(nap.state, 1).ok, true);
  const full = performAction(createGame(), 'rest', undefined, undefined, { advanceClock: false });
  assert.equal(full.state.companions!.dog.health, 100);
  assert.equal(full.state.companions!.cat.health, 100);
});

test('retreat, defeat, reload and interrupted expedition grant no companion experience or surprise recovery', () => {
  for (const outcome of ['retreat', 'defeat'] as const) {
    const initial = createGame();
    initial.companions = { dog: { health: 41.5, xp: 81 }, cat: { health: 22, xp: 319 } };
    const started = beginHunt(initial, 3).state;
    const snapshot = outcome === 'defeat' ? { dog: 0, cat: 0 } : { dog: 18.25, cat: 0 };
    const returned = finishHunt(started, { ...result(3, outcome), companionHealth: snapshot }, 1).state;
    assert.deepEqual(returned.companions, { dog: { health: snapshot.dog, xp: 81 }, cat: { health: snapshot.cat, xp: 319 } });
    assert.deepEqual(returned.resources, initial.resources);
    const memory = storage();
    assert.equal(saveGame(returned, memory), true);
    assert.deepEqual(loadGame(memory)!.companions, returned.companions);
  }
  const state = createGame();
  state.companions = { dog: { health: 40, xp: 100 }, cat: { health: 0, xp: 719 } };
  const started = beginHunt(state, 2).state, memory = storage();
  assert.equal(saveGame(started, memory), true);
  const loaded = loadGame(memory)!;
  const cancelled = cancelHunt(loaded);
  assert.equal(cancelled.ok, true);
  assert.deepEqual(cancelled.state.companions, state.companions);
  assert.deepEqual(cancelled.state.resources, state.resources);
  assert.equal(cancelled.state.health, state.health);
  assert.equal(cancelled.state.totalMinutes, state.totalMinutes);
  assert.equal(cancelled.state.energy, state.energy - 16);
  assert.equal(cancelled.state.expedition, null);
  assert.equal(cancelHunt(cancelled.state).state, cancelled.state);
});

test('animal result snapshots are complete bounded records and malformed results reject atomically', () => {
  const started = beginHunt(createGame(), 1).state;
  const snapshot = JSON.stringify(started);
  for (const companionHealth of [undefined, null, [], {}, { dog: 50 }, { dog: 50, cat: 50, fox: 50 },
    { dog: -0.01, cat: 40 }, { dog: 100.01, cat: 40 }, { dog: NaN, cat: 40 }, { dog: 40, cat: Infinity }, { dog: 40, cat: '40' }]) {
    const finished = finishHunt(started, { ...result(), companionHealth } as HuntResult, 1);
    assert.equal(finished.ok, false);
    assert.equal(finished.state, started);
    assert.equal(JSON.stringify(started), snapshot);
  }
});

test('modern victories require the eight defeated enemies and a surviving participant, while defeats require both animals down', () => {
  const started = beginHunt(createGame(), 1).state;
  const before = JSON.stringify(started);
  const wrongResults: HuntResult[] = [
    { ...result(), enemiesDefeated: 0, duration: 0, companionHealth: { dog: 0, cat: 0 } },
    { ...result(), companionHealth: { dog: 0, cat: 0 } },
    { ...result(), enemiesDefeated: 7 },
    { ...result(), enemiesDefeated: 9 },
    { ...result(), enemiesDefeated: 1000 },
    { ...result(), remainingHealth: -0.01 },
    { ...result(), remainingHealth: 100.01 },
    { ...result(), outcome: 'defeat', companionHealth: { dog: 0.01, cat: 0 } },
    { ...result(), outcome: 'defeat', companionHealth: { dog: 0, cat: 0.01 } },
    { ...result(), outcome: 'retreat', enemiesDefeated: 9 },
  ];
  for (const wrong of wrongResults) {
    const returned = finishHunt(started, wrong, 1);
    assert.equal(returned.ok, false);
    assert.equal(returned.state, started);
    assert.equal(JSON.stringify(started), before, 'rejection never clears the expedition, alters HP, or pays any loot/XP');
  }
  const won = finishHunt(started, result(), 1);
  assert.equal(won.ok, true);
  assert.equal(won.state.stats.defeatedEnemies, 8);
  const defeated = finishHunt(started, { ...result(), outcome: 'defeat', companionHealth: { dog: 0, cat: 0 }, remainingHealth: 0, enemiesDefeated: 5 }, 1);
  assert.equal(defeated.ok, true);
  assert.deepEqual(defeated.state.resources, started.resources);
  assert.deepEqual(defeated.state.companions, { dog: { health: 0, xp: 0 }, cat: { health: 0, xp: 0 } });
});

test('present corrupt rosters and invalid participation markers never receive legacy defaults', () => {
  const memory = storage();
  const invalid: unknown[] = [null, {}, [], { dog: { health: 100, xp: 0 } },
    { dog: { health: 100, xp: 0 }, cat: { health: 100, xp: 0 }, fox: { health: 100, xp: 0 } },
    { dog: { health: 101, xp: 0 }, cat: { health: 100, xp: 0 } },
    { dog: { health: -1, xp: 0 }, cat: { health: 100, xp: 0 } },
    { dog: { health: 100, xp: 0.5 }, cat: { health: 100, xp: 0 } },
    { dog: { health: 100, xp: 721 }, cat: { health: 100, xp: 0 } },
    { dog: { health: 100, xp: 0, level: 1 }, cat: { health: 100, xp: 0 } }];
  for (const companions of invalid) {
    assert.equal(validateCompanions(companions), false);
    memory.setItem(SAVE_KEY, JSON.stringify({ ...createGame(), companions }));
    assert.equal(loadGame(memory), null);
    assert.equal(saveGame({ ...createGame(), companions } as GameState, memory), false);
    const malformed = { ...createGame(), companions } as GameState;
    assert.equal(beginHunt(malformed, 1).state, malformed);
  }
  const pending = beginHunt(createGame(), 1).state;
  pending.expedition = { id: 1, stage: 1, animalParty: true, participantIds: ['dog', 'cat'] };
  for (const patch of [{ animalParty: false }, { animalParty: 1 }, { participantIds: [] }, { participantIds: ['dog', 'dog'] },
    { participantIds: ['fox'] }, { participantIds: undefined }]) {
    memory.setItem(SAVE_KEY, JSON.stringify({ ...pending, expedition: { ...pending.expedition, ...patch } }));
    assert.equal(loadGame(memory), null);
  }
  const legacyMarker = { ...pending, expedition: { id: 1, stage: 1, participantIds: ['dog'] } };
  memory.setItem(SAVE_KEY, JSON.stringify(legacyMarker));
  assert.equal(loadGame(memory), null);
  const missingRoster = { ...pending };
  delete missingRoster.companions;
  memory.setItem(SAVE_KEY, JSON.stringify(missingRoster));
  assert.equal(loadGame(memory), null);
  pending.companions!.dog.health = 0;
  memory.setItem(SAVE_KEY, JSON.stringify(pending));
  assert.equal(loadGame(memory), null);
});

test('pending legacy battles settle with their original farmer health protocol and cannot award new animal XP', () => {
  const old = createGame();
  delete old.companions;
  old.stats.hunts = 1;
  old.energy -= 16;
  old.expedition = { id: 1, stage: 2 };
  const memory = storage();
  memory.setItem(SAVE_KEY, JSON.stringify(old));
  const loaded = loadGame(memory)!;
  assert.ok(loaded);
  const won = finishHunt(loaded, { outcome: 'victory', stage: 2, remainingHealth: 31, enemiesDefeated: 9, duration: 7 }, 1);
  assert.equal(won.ok, true);
  assert.equal(won.state.health, 31);
  assert.equal(Object.hasOwn(won.state, 'companions'), false);
  assert.deepEqual(getCompanions(won.state), { dog: { health: 100, xp: 0 }, cat: { health: 100, xp: 0 } });
  const retreat = cancelHunt(loaded);
  assert.equal(retreat.ok, true);
  assert.equal(retreat.state.health, old.health);
  assert.equal(Object.hasOwn(retreat.state, 'companions'), false);
  const historicalWin = finishHunt(loaded, { outcome: 'victory', stage: 2, remainingHealth: 101, enemiesDefeated: 12, duration: 7 }, 1);
  assert.equal(historicalWin.ok, true, 'new animal result bounds do not change the legacy protocol');
  assert.equal(historicalWin.state.health, 100);
  assert.equal(historicalWin.state.stats.defeatedEnemies, 12);
  assert.equal(Object.hasOwn(historicalWin.state, 'companions'), false);
});

test('every village mutation detaches animal progress without healing or experience gifts', () => {
  const state = createGame();
  state.resources.wood = 1_000;
  state.resources.scrap = 1_000;
  state.companions = { dog: { health: 48.5, xp: 95 }, cat: { health: 12, xp: 210 } };
  for (const next of [tick(state, 1), advanceTime(state, 10), applyOfflineProgress(state, 10).state,
    performAction(state, 'gather', undefined, undefined, { advanceClock: false }).state,
    beginHunt(state, 1).state,
    buildFacility(state, 'waterworks', 0).state,
    fulfillVillageOrder(state, getVillageOrder(state).id).state]) assertDetached(state, next);
  const gathered = performAction(state, 'gather').state;
  assertDetached(gathered, claimGrowthQuest(gathered, 'road-supplies').state);
  const built = buildFacility(state, 'waterworks', 0).state;
  for (const next of [startProduction(built, 1).state, moveFacility(built, 1, 1).state,
    upgradeFacility(built, 1).state, replaceFacility(built, 1, 'kitchen').state]) assertDetached(built, next);
  const ready = advanceTime(startProduction(built, 1).state, 90);
  assertDetached(ready, collectProduction(ready, 1).state);
  const pending = beginHunt(state, 1).state;
  const cancelled = cancelHunt(pending).state;
  assertDetached(pending, cancelled);
  const outside = pending.expedition!.unitParticipantIds!;
  const copied = applyOfflineProgress(pending, 10).state;
  assert.notEqual(copied.expedition!.unitParticipantIds, outside);
  copied.expedition!.unitParticipantIds!.pop();
  assert.deepEqual(outside, ['dog', 'cat']);
});
