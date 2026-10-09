import test from 'node:test';
import assert from 'node:assert/strict';
import { BattleSimulation, SKILL_COOLDOWNS } from '../src/battle.ts';
import { GAME_SPEED_MULTIPLIER, realDuration } from '../src/game-speed.ts';
import { readFileSync } from 'node:fs';

function runFor(battle: BattleSimulation, seconds: number): void {
  for (let i = 0; i < seconds * 60; i++) battle.tick(1 / 60);
}
function runUntilFinished(battle: BattleSimulation): void {
  for (let i = 0; i < 240 * 60 && !battle.state.result; i++) battle.tick(1 / 60);
  assert.ok(battle.state.result, 'battle must reach an outcome in bounded active time');
}

test('first expedition can be won with basic attacks and visits all three waves including a boss', () => {
  const battle = new BattleSimulation({ level: 1, health: 100, stage: 1 });
  const waves = new Set<number>();
  let sawBoss = false;
  for (let i = 0; i < 150 * 60 && !battle.state.result; i++) {
    waves.add(battle.state.wave);
    sawBoss ||= battle.state.enemies.some(enemy => enemy.kind === 'boss');
    battle.tick(1 / 60);
  }
  assert.deepEqual([...waves], [1, 2, 3]);
  assert.equal(sawBoss, true);
  assert.equal(battle.state.result?.outcome, 'victory');
  assert.equal(battle.state.result?.enemiesDefeated, 8);
  assert.ok(battle.state.result!.remainingHealth > 1);
  assert.ok(battle.state.result!.duration >= 15 && battle.state.result!.duration <= 34);
});

test('injured survivor can lose and defeat terminates all further damage and skills', () => {
  const battle = new BattleSimulation({ level: 1, health: 3, stage: 3 });
  runUntilFinished(battle);
  assert.equal(battle.state.result?.outcome, 'defeat');
  assert.equal(battle.state.result?.remainingHealth, 1, 'return home always allows recovery');
  const snapshot = JSON.stringify(battle.state);
  runFor(battle, 5);
  assert.equal(battle.useSkill('heal'), false);
  assert.equal(JSON.stringify(battle.state), snapshot);
});

test('manual skills consume their cooldown, damage all targets and heal without overheal', () => {
  const battle = new BattleSimulation({ level: 1, health: 91, stage: 1 });
  assert.equal(battle.useSkill('sweep'), false, 'arrival transition is not interactive');
  runFor(battle, realDuration(1.5));
  const hp = battle.state.enemies.map(enemy => enemy.health);
  assert.equal(battle.useSkill('sweep'), true);
  assert.equal(battle.state.cooldowns.sweep, SKILL_COOLDOWNS.sweep);
  battle.state.enemies.forEach((enemy, index) => assert.equal(enemy.health, hp[index] - 25));
  assert.equal(battle.useSkill('sweep'), false);
  assert.equal(battle.useSkill('heal'), true);
  assert.equal(battle.state.health, 100);
  assert.equal(battle.useSkill('heal'), false);
  runFor(battle, realDuration(1));
  assert.ok(battle.state.cooldowns.sweep < SKILL_COOLDOWNS.sweep);
  assert.equal(battle.useSkill('dash'), true);
  assert.equal(battle.useSkill('dash'), false);
});

test('pause freezes time, cooldowns, health and movement; long frames do not catch up', () => {
  const battle = new BattleSimulation({ level: 1, health: 80, stage: 1 });
  runFor(battle, 3);
  battle.useSkill('sweep');
  battle.setPaused(true);
  const snapshot = JSON.stringify(battle.state);
  runFor(battle, 30);
  assert.equal(battle.useSkill('dash'), false);
  assert.equal(JSON.stringify(battle.state), snapshot);
  battle.setPaused(false);
  const previous = battle.state.time;
  battle.tick(120);
  assert.ok(battle.state.time - previous <= 0.1 * GAME_SPEED_MULTIPLIER + 0.00001);
});

test('retreat is final, returns actual health, and cannot later turn into a reward', () => {
  const battle = new BattleSimulation({ level: 1, health: 78, stage: 2 });
  runFor(battle, realDuration(5));
  const result = battle.retreat();
  assert.equal(result.outcome, 'retreat');
  assert.equal(result.remainingHealth, 78);
  assert.equal(result.stage, 2);
  result.outcome = 'victory';
  assert.equal(battle.state.result?.outcome, 'retreat', 'caller receives a separate result');
  runFor(battle, 90);
  assert.equal(battle.retreat().outcome, 'retreat');
});

test('auto skills beat the harder stage and replay has identical combat events and result', () => {
  const first = new BattleSimulation({ level: 1, health: 100, stage: 3 });
  const second = new BattleSimulation({ level: 1, health: 100, stage: 3 });
  first.setAuto(true); second.setAuto(true);
  runUntilFinished(first); runUntilFinished(second);
  assert.equal(first.state.result?.outcome, 'victory');
  assert.deepEqual(first.state, second.state);
});

test('invalid inputs and frame deltas remain finite and bounded', () => {
  const battle = new BattleSimulation({ level: NaN, health: Infinity, stage: -5 });
  assert.equal(battle.state.stage, 1);
  assert.equal(battle.state.level, 1);
  assert.equal(battle.state.health, 100);
  const snapshot = JSON.stringify(battle.state);
  for (const delta of [NaN, Infinity, -5, 0]) battle.tick(delta);
  assert.equal(JSON.stringify(battle.state), snapshot);
});

test('threefold combat reaches the recorded original battle states in one third of the real time', () => {
  const baseline = JSON.parse(readFileSync(new URL('./fixtures/battle-v014-reference.json', import.meta.url), 'utf8'));
  const battle = new BattleSimulation(baseline.options);
  battle.setAuto(baseline.auto);
  let frames = 0;
  for (const checkpoint of baseline.checkpoints) {
    const targetFrames = Math.round(checkpoint.simulationSeconds * 60 / GAME_SPEED_MULTIPLIER);
    while (frames < targetFrames) { battle.tick(1 / 60); frames++; }
    const expected = structuredClone(checkpoint.state);
    // Keep the former integer display policy, but round after converting to real seconds.
    if (expected.result) expected.result.duration = Math.round(realDuration(expected.time));
    assert.deepEqual(battle.state, expected, `original simulation checkpoint ${checkpoint.simulationSeconds}s retains all health, damage, movement, events and cooldowns`);
    assert.ok(Math.abs(frames / 60 - realDuration(checkpoint.simulationSeconds)) < 1 / 60, 'the same combat state needs exactly one third of the previous wall time');
  }
  assert.equal(battle.state.result?.outcome, 'victory');
  assert.equal(battle.state.result?.duration, 20);
  assert.equal(battle.state.result?.remainingHealth, baseline.checkpoints.at(-1).state.result.remainingHealth);
  assert.equal(battle.state.result?.enemiesDefeated, baseline.checkpoints.at(-1).state.result.enemiesDefeated);
});

test('skill cooldowns expire in one third of their original real duration without changing their combat values', () => {
  const battle = new BattleSimulation({ level: 1, health: 80, stage: 3 });
  runFor(battle, realDuration(1.5));
  assert.equal(battle.useSkill('sweep'), true);
  assert.equal(battle.state.cooldowns.sweep, 12);
  assert.equal(Math.ceil(realDuration(battle.state.cooldowns.sweep)), 4, 'the countdown initially displays four real seconds');
  runFor(battle, realDuration(11.5));
  assert.ok(battle.state.cooldowns.sweep > 0 && battle.state.cooldowns.sweep < 0.51);
  assert.equal(Math.ceil(realDuration(battle.state.cooldowns.sweep)), 1, 'a running countdown cannot prematurely show zero');
  runFor(battle, realDuration(0.6));
  assert.equal(battle.state.cooldowns.sweep, 0);
  assert.equal(battle.useSkill('sweep'), true);
  const result = battle.retreat();
  assert.equal(result.duration, Math.round(realDuration(battle.state.time)));
});
