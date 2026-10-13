import test from 'node:test';
import assert from 'node:assert/strict';
import { recoverEnergy, secondsUntilEnergyRecovery, validateEnergyRecovery } from '../src/energy-recovery.ts';
import { applyOfflineProgress, beginHunt, createGame, loadGame, performAction, SAVE_KEY, saveGame, tick, type GameState, type SaveStorage } from '../src/game.ts';
import { buildFacility } from '../src/settlement.ts';
import { claimGrowthQuest } from '../src/growth-quests.ts';
import { fulfillVillageOrder, getVillageOrder } from '../src/village-orders.ts';
import { rotateLayoutTarget } from '../src/layout-direction.ts';

const start = 1_000_000;
function storage(): SaveStorage {
  const values = new Map<string, string>();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); } };
}
function atEnergy(energy: number): GameState {
  return recoverEnergy({ ...createGame(), energy }, start);
}
function withoutRecovery(state: GameState) {
  const { energy: _energy, energyRecovery: _recovery, ...other } = state;
  return other;
}

test('energy recovers one point every 20 real seconds, independently of the village clock', () => {
  const initial = atEnergy(10), snapshot = structuredClone(initial);
  let state = recoverEnergy(initial, start + 19_999);
  assert.equal(state.energy, 10);
  assert.equal(secondsUntilEnergyRecovery(state, start + 19_999), 1);
  state = recoverEnergy(state, start + 20_000);
  assert.equal(state.energy, 11);
  assert.equal(state.energyRecovery!.carryMs, 0);
  state = recoverEnergy(state, start + 60_000);
  assert.equal(state.energy, 13);
  assert.equal(secondsUntilEnergyRecovery(state, start + 60_000), 20);
  assert.deepEqual(withoutRecovery(state), withoutRecovery(initial));
  assert.deepEqual(initial, snapshot);
  assert.equal(tick(initial, 60).energy, 10, 'accelerated game seconds alone cannot award real recovery');
});

test('partial recovery survives save and reload without being replayed', () => {
  const memory = storage(), partial = recoverEnergy(atEnergy(30), start + 19_500);
  assert.equal(saveGame(partial, memory), true);
  const loaded = loadGame(memory)!;
  assert.deepEqual(loaded.energyRecovery, partial.energyRecovery);
  const once = recoverEnergy(loaded, start + 20_000);
  assert.equal(once.energy, 31);
  assert.equal(once.energyRecovery!.carryMs, 0);
  assert.strictEqual(recoverEnergy(once, start + 20_000), once);
  assert.equal(recoverEnergy(once, start + 39_999).energy, 31);
  assert.equal(recoverEnergy(once, start + 40_000).energy, 32);
});

test('offline recovery uses the same actual time even beyond the separate crop absence ceiling', () => {
  const initial = atEnergy(0);
  initial.lastSaved = start;
  const short = applyOfflineProgress(initial, start + 60_000);
  assert.equal(short.state.energy, 3);
  assert.equal(applyOfflineProgress(short.state, start + 60_000).state.energy, 3);
  const long = applyOfflineProgress(initial, start + 600_000);
  assert.equal(long.state.energy, 30, 'energy is not limited by the 105-second village absence ceiling');
  assert.equal(long.secondsApplied, 105);
  assert.deepEqual(long.state.resources, initial.resources);
  assert.deepEqual(long.state.stats, initial.stats);
  assert.equal(long.state.xp, initial.xp);
});

test('recovery continues during an expedition without advancing or rewarding the battle', () => {
  const expedition = beginHunt(atEnergy(30), 1).state;
  const recovered = recoverEnergy(expedition, start + 60_000);
  assert.equal(recovered.energy, expedition.energy + 3);
  assert.deepEqual(withoutRecovery(recovered), withoutRecovery(expedition));
  const offline = applyOfflineProgress(expedition, start + 60_000);
  assert.equal(offline.state.energy, expedition.energy + 3);
  assert.equal(offline.secondsApplied, 0);
  assert.deepEqual(offline.state.expedition, expedition.expedition);
  assert.equal(offline.state.totalMinutes, expedition.totalMinutes);
  assert.deepEqual(offline.state.resources, expedition.resources);
});

test('full energy discards surplus time and starts a new 20-second interval after spending', () => {
  const full = recoverEnergy(atEnergy(99), start + 40_001);
  assert.equal(full.energy, 100);
  assert.equal(full.energyRecovery!.carryMs, 0);
  const stillFull = recoverEnergy(full, start + 600_000);
  assert.equal(stillFull.energyRecovery!.checkedAt, start + 600_000);
  assert.equal(stillFull.energyRecovery!.carryMs, 0);
  assert.equal(secondsUntilEnergyRecovery(stillFull), 0);
  const spent = performAction(stillFull, 'plant', 3, 'carrot', { advanceClock: false }).state;
  assert.equal(spent.energy, 96);
  assert.equal(recoverEnergy(spent, start + 619_999).energy, 96);
  assert.equal(recoverEnergy(spent, start + 620_000).energy, 97);
});

test('legacy saves initialize recovery once without inferred offline gifts or invented resources', () => {
  const old = createGame(), memory = storage();
  old.energy = 2;
  old.lastSaved = 1;
  const snapshot = structuredClone(old);
  memory.setItem(SAVE_KEY, JSON.stringify(old));
  const loaded = loadGame(memory)!;
  assert.equal(Object.hasOwn(loaded, 'energyRecovery'), false);
  assert.equal(secondsUntilEnergyRecovery(loaded, start), 20);
  assert.equal(Object.hasOwn(loaded, 'energyRecovery'), false, 'a UI read never initializes old saves');
  const resumed = applyOfflineProgress(loaded, start).state;
  assert.equal(resumed.energy, 2);
  assert.deepEqual(resumed.energyRecovery, { version: 1, checkedAt: start, carryMs: 0 });
  assert.equal(recoverEnergy(resumed, start + 20_000).energy, 3);
  assert.deepEqual(old, snapshot);
});

test('clock rollback and malformed recovery fields never award energy', () => {
  const partial = recoverEnergy(atEnergy(10), start + 15_000);
  assert.strictEqual(recoverEnergy(partial, start - 1), partial);
  assert.strictEqual(recoverEnergy(partial, start + 15_000), partial);
  assert.equal(recoverEnergy(partial, start + 19_999).energy, 10);
  assert.equal(recoverEnergy(partial, start + 20_000).energy, 11);
  for (const now of [NaN, Infinity, -1, 1.5, 100_000_000_000_001]) {
    assert.strictEqual(recoverEnergy(partial, now), partial);
  }
  const memory = storage();
  for (const field of [null, {}, { version: 2, checkedAt: start, carryMs: 0 },
    { version: 1, checkedAt: NaN, carryMs: 0 }, { version: 1, checkedAt: start, carryMs: 20_000 },
    { version: 1, checkedAt: start, carryMs: -1 }, { version: 1, checkedAt: start, carryMs: 0.5 },
    { version: 1, checkedAt: start, carryMs: 0, bonus: 20 }]) {
    assert.equal(validateEnergyRecovery(field), false);
    const malformed = { ...createGame(), energyRecovery: field } as GameState;
    assert.strictEqual(recoverEnergy(malformed, start + 60_000), malformed);
    assert.equal(saveGame(malformed, memory), false);
    memory.setItem(SAVE_KEY, JSON.stringify(malformed));
    assert.equal(loadGame(memory), null);
  }
});

test('rest and petting preserve their health or morale benefits without manual energy rewards', () => {
  const initial = atEnergy(0);
  initial.health = 1;
  initial.companions!.dog.health = 0;
  initial.companions!.cat.health = 0;
  const rested = performAction(initial, 'rest', undefined, undefined, { advanceClock: false }).state;
  assert.equal(rested.energy, 0);
  assert.equal(rested.health, 13);
  assert.equal(rested.companions!.dog.health, 35);
  assert.equal(rested.companions!.cat.health, 35);
  assert.equal(rested.resources.food, initial.resources.food - 1);
  assert.equal(rested.resources.water, initial.resources.water - 1);
  assert.deepEqual(rested.energyRecovery, initial.energyRecovery);
  const petted = performAction(initial, 'pet', undefined, undefined, { advanceClock: false }).state;
  assert.equal(petted.energy, 0);
  assert.equal(petted.morale, 100);
  assert.deepEqual(petted.energyRecovery, initial.energyRecovery);
});

test('paid actions, construction, rotation, quests and orders retain detached recovery fields without grants', () => {
  const initial = recoverEnergy(atEnergy(80), start + 17_000);
  const gathered = performAction(initial, 'gather').state;
  const operations = [performAction(initial, 'plant', 3), buildFacility(initial, 'waterworks', 0),
    rotateLayoutTarget(initial, { kind: 'plot', id: 1 }),
    claimGrowthQuest(gathered, 'road-supplies'), fulfillVillageOrder(initial, getVillageOrder(initial).id)];
  for (const result of operations) {
    assert.equal(result.ok, true, result.message);
    assert.deepEqual(result.state.energyRecovery, initial.energyRecovery);
    assert.notEqual(result.state.energyRecovery, initial.energyRecovery);
    result.state.energyRecovery!.carryMs = 0;
    assert.equal(initial.energyRecovery!.carryMs, 17_000);
  }
  const recovered = recoverEnergy(initial, start + 20_000);
  recovered.resources.wood = 0;
  recovered.companions!.dog.health = 0;
  assert.equal(initial.resources.wood, 24);
  assert.equal(initial.companions!.dog.health, 100);
});
