import test from 'node:test';
import assert from 'node:assert/strict';
import { BattleSimulation, SKILL_COOLDOWNS, canUseSkill, getBattleSkillAvailability } from '../src/battle.ts';
import { GAME_SPEED_MULTIPLIER, realDuration } from '../src/game-speed.ts';
import type { CompanionRoster } from '../src/companions.ts';

const fullParty = (): CompanionRoster => ({ dog: { health: 100, xp: 0 }, cat: { health: 100, xp: 0 } });
function runFor(battle: BattleSimulation, seconds: number): void {
  for (let i = 0; i < Math.round(seconds * 60); i++) battle.tick(1 / 60);
}
function runUntilFinished(battle: BattleSimulation): void {
  for (let i = 0; i < 240 * 60 && !battle.state.result; i++) battle.tick(1 / 60);
  assert.ok(battle.state.result, 'battle must reach an outcome in bounded active time');
}
function forceReadyEnemy(battle: BattleSimulation, kind: 'moss' | 'runner' | 'boss' = 'moss'): void {
  const s = battle.state;
  s.transition = 0;
  s.enemies = [s.enemies[0]];
  const enemy = s.enemies[0];
  enemy.kind = kind;
  enemy.health = enemy.maxHealth = 100000;
  enemy.x = 0;
  enemy.attackIn = 0;
}
const closeTo = (actual: number, expected: number): void => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} should equal ${expected}`);

test('only animals fight; the saved roster determines each animal independently of survivor attributes', () => {
  const roster = { dog: { health: 50, xp: 80 }, cat: { health: 75, xp: 160 } };
  const battle = new BattleSimulation({ level: 99, health: 1, stage: 1, companions: roster });
  assert.deepEqual(battle.state.teamIds, ['dog', 'cat']);
  assert.equal(battle.state.allies.dog.name, '보리');
  assert.equal(battle.state.allies.cat.name, '나비');
  assert.equal(battle.state.allies.dog.level, 2);
  assert.equal(battle.state.allies.cat.level, 3);
  assert.equal(battle.state.allies.dog.maxHealth, 128);
  assert.equal(battle.state.allies.cat.maxHealth, 102);
  assert.equal(battle.state.allies.dog.health, 64);
  assert.equal(battle.state.allies.cat.health, 76.5);
  assert.ok(battle.state.allies.dog.x > battle.state.allies.cat.x, 'guardian stands ahead of the cat');
  roster.dog.health = 0;
  assert.equal(battle.state.allies.dog.health, 64, 'battle does not borrow mutable saved progress');
  const actors = new Set<string>();
  for (let i = 0; i < 5 * 60; i++) {
    battle.tick(1 / 60);
    for (const event of battle.state.events) if (event.kind === 'attack' || event.kind === 'dog') {
      assert.ok(event.actor === 'dog' || event.actor === 'cat');
      actors.add(event.actor);
    }
  }
  assert.deepEqual([...actors].sort(), ['cat', 'dog']);
  assert.equal('heroAttackUntil' in battle.state, false);
  assert.equal(battle.state.events.some(event => (event.target as string) === 'hero'), false);
});

test('healthy animals win the first expedition with basic attacks across all three waves and a boss', () => {
  const battle = new BattleSimulation({ level: 1, health: 1, stage: 1, companions: fullParty() });
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
  assert.ok(battle.state.result!.companionHealth.dog > 0);
  assert.ok(battle.state.result!.companionHealth.cat > 0);
  assert.ok(battle.state.result!.duration >= 30 && battle.state.result!.duration <= 53);
});

test('normal enemies strike the front dog while runners independently flank the rear cat', () => {
  const battle = new BattleSimulation({ level: 1, health: 100, stage: 1, companions: fullParty() });
  forceReadyEnemy(battle, 'moss');
  battle.tick(1 / 60);
  closeTo(battle.state.allies.dog.health, 117.7);
  assert.equal(battle.state.allies.cat.health, 90);
  assert.equal(battle.state.enemies[0].attackTarget, 'dog');
  assert.equal(battle.state.events.at(-1)?.target, 'dog');
  battle.state.enemies[0].kind = 'runner';
  battle.state.enemies[0].attackIn = 0;
  battle.tick(1 / 60);
  closeTo(battle.state.allies.dog.health, 117.7);
  closeTo(battle.state.allies.cat.health, 87.7);
  assert.equal(battle.state.enemies[0].attackTarget, 'cat');
  assert.equal(battle.state.events.at(-1)?.target, 'cat');
});

test('a downed front animal stops fighting but its survivor continues and enemies retarget', () => {
  const battle = new BattleSimulation({ level: 1, health: 100, stage: 1, companions: fullParty() });
  forceReadyEnemy(battle);
  battle.state.allies.dog.health = 1;
  battle.tick(1 / 60);
  assert.equal(battle.state.allies.dog.health, 0);
  assert.ok(battle.state.allies.dog.downAt !== null);
  assert.equal(battle.state.enemies[0].attackTarget, 'dog', 'lethal animation remains aimed at the downed dog');
  assert.equal(battle.state.result, null, 'one surviving animal keeps the battle going');
  assert.equal(getBattleSkillAvailability(battle.state, 'dash').reason, 'down');
  assert.equal(canUseSkill(battle.state, 'sweep'), true);
  const downAt = battle.state.allies.dog.downAt!;
  runFor(battle, realDuration(6));
  assert.ok(battle.state.events.some(event => event.kind === 'attack' && event.actor === 'cat'));
  assert.equal(battle.state.events.some(event => event.at > downAt && event.actor === 'dog'), false);
  assert.ok(battle.state.allies.cat.health < 90, 'ordinary enemies switch to the surviving cat');
  assert.equal(battle.state.enemies[0].attackTarget, 'cat');
});

test('runners hit the surviving dog when the rear animal is already down', () => {
  const roster = fullParty();
  roster.cat.health = 0;
  const battle = new BattleSimulation({ level: 1, health: 100, stage: 1, companions: roster });
  forceReadyEnemy(battle, 'runner');
  battle.tick(1 / 60);
  closeTo(battle.state.allies.dog.health, 117.7);
  assert.equal(battle.state.allies.cat.health, 0);
  assert.equal(battle.state.enemies[0].attackTarget, 'dog');
  assert.equal(getBattleSkillAvailability(battle.state, 'sweep').reason, 'down');
  assert.equal(battle.useSkill('sweep'), false);
  assert.equal(battle.useSkill('dash'), true);
});

test('both animals falling ends the battle, returns zero animal health and freezes further damage or skills', () => {
  const battle = new BattleSimulation({ level: 1, health: 3, stage: 3 });
  runUntilFinished(battle);
  assert.equal(battle.state.result?.outcome, 'defeat');
  assert.equal(battle.state.result?.remainingHealth, 0);
  assert.deepEqual(battle.state.result?.companionHealth, { dog: 0, cat: 0 });
  const snapshot = JSON.stringify(battle.state);
  runFor(battle, 5);
  assert.equal(battle.useSkill('heal'), false);
  assert.equal(JSON.stringify(battle.state), snapshot);
  const alreadyDown = new BattleSimulation({ level: 1, health: 100, stage: 1, companions: { dog: { health: 0, xp: 0 }, cat: { health: 0, xp: 0 } } });
  assert.equal(alreadyDown.state.result?.outcome, 'defeat');
  assert.equal(alreadyDown.state.result?.duration, 0);
});

test('cat sweep damages every living enemy and dog charge protects the guardian and staggers enemies', () => {
  const battle = new BattleSimulation({ level: 100, health: 100, stage: 1, companions: fullParty() });
  assert.equal(battle.useSkill('sweep'), false, 'arrival transition is not interactive');
  runFor(battle, realDuration(1.5));
  const hp = battle.state.enemies.map(enemy => enemy.health);
  assert.equal(battle.useSkill('sweep'), true);
  assert.equal(battle.state.cooldowns.sweep, SKILL_COOLDOWNS.sweep);
  battle.state.enemies.forEach((enemy, index) => assert.equal(enemy.health, hp[index] - 25));
  assert.equal(battle.state.events.find(event => event.kind === 'sweep')?.actor, 'cat');
  assert.equal(battle.useSkill('sweep'), false);
  const beforeDash = battle.state.enemies[0].health;
  assert.equal(battle.useSkill('dash'), true);
  assert.equal(battle.state.enemies[0].health, beforeDash - 36);
  assert.equal(battle.state.events.find(event => event.kind === 'dash')?.actor, 'dog');
  closeTo(battle.state.allies.dog.guardUntil - battle.state.time, 2.2);
  assert.ok(battle.state.enemies.every(enemy => enemy.attackIn >= 2.2));
  assert.equal(battle.useSkill('dash'), false);
  // A strike landing inside the protection window does less actual damage.
  battle.state.enemies = [battle.state.enemies[1]];
  battle.state.enemies[0].x = 0;
  battle.state.enemies[0].attackIn = 0;
  battle.tick(1 / 60);
  closeTo(battle.state.allies.dog.health, 120 - 2.3 * 0.45);
});

test('shared healing restores each living animal by actual HP, clamps independently and never revives', () => {
  const battle = new BattleSimulation({ level: 1, health: 100, stage: 1, companions: fullParty() });
  runFor(battle, realDuration(1.5));
  battle.state.allies.dog.health = 115;
  battle.state.allies.cat.health = 30;
  assert.equal(battle.useSkill('heal'), true);
  assert.equal(battle.state.allies.dog.health, 120);
  assert.equal(battle.state.allies.cat.health, 59);
  assert.deepEqual(battle.state.events.filter(event => event.kind === 'heal').map(({ target, amount }) => ({ target, amount })), [{ target: 'dog', amount: 5 }, { target: 'cat', amount: 29 }]);
  assert.equal(battle.state.cooldowns.heal, 23);
  assert.equal(battle.useSkill('heal'), false);
  const roster = fullParty();
  roster.dog.health = 0;
  roster.cat.health = 90;
  const oneAlive = new BattleSimulation({ level: 1, health: 100, stage: 1, companions: roster });
  runFor(oneAlive, realDuration(1.5));
  assert.equal(oneAlive.useSkill('heal'), true);
  assert.equal(oneAlive.state.allies.dog.health, 0);
  assert.equal(oneAlive.state.allies.dog.downAt, 0);
  assert.equal(oneAlive.state.allies.cat.health, 90);
  assert.equal(oneAlive.state.events.filter(event => event.kind === 'heal').length, 1);
});

test('availability rejects unknown skills, owner-down actions, full health and empty enemy targets without mutation', () => {
  const battle = new BattleSimulation({ level: 1, health: 100, stage: 1, companions: fullParty() });
  runFor(battle, realDuration(1.5));
  assert.equal(getBattleSkillAvailability(battle.state, 'heal').reason, 'full');
  const snapshot = JSON.stringify(battle.state);
  for (const skill of ['constructor', '__proto__', '', null, undefined, 3]) {
    assert.equal(getBattleSkillAvailability(battle.state, skill).reason, 'invalid');
    assert.equal(battle.useSkill(skill), false);
  }
  assert.equal(JSON.stringify(battle.state), snapshot);
  battle.state.allies.cat.health = 0;
  assert.equal(battle.useSkill('sweep'), false);
  assert.equal(battle.state.cooldowns.sweep, 0);
  battle.state.enemies.forEach(enemy => { enemy.health = 0; });
  assert.equal(getBattleSkillAvailability(battle.state, 'dash').reason, 'no-targets');
  assert.equal(battle.useSkill('dash'), false);
});

test('pause freezes time, animal states, cooldowns and movement; long frames do not catch up', () => {
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

test('retreat returns independently copied health for each animal, and no later reward replaces it', () => {
  const roster = { dog: { health: 78, xp: 0 }, cat: { health: 46, xp: 0 } };
  const battle = new BattleSimulation({ level: 1, health: 100, stage: 2, companions: roster });
  runFor(battle, realDuration(5));
  const result = battle.retreat();
  assert.equal(result.outcome, 'retreat');
  assert.equal(result.stage, 2);
  closeTo(result.companionHealth.dog, 78);
  closeTo(result.companionHealth.cat, 46);
  result.outcome = 'victory';
  result.companionHealth.dog = 0;
  assert.equal(battle.state.result?.outcome, 'retreat');
  closeTo(battle.state.result!.companionHealth.dog, 78);
  runFor(battle, 90);
  assert.equal(battle.retreat().outcome, 'retreat');
});

test('auto companion skills beat the hardest stage and deterministic replay yields identical events and result', () => {
  const first = new BattleSimulation({ level: 1, health: 100, stage: 3, companions: fullParty() });
  const second = new BattleSimulation({ level: 1, health: 100, stage: 3, companions: fullParty() });
  first.setAuto(true); second.setAuto(true);
  runUntilFinished(first); runUntilFinished(second);
  assert.equal(first.state.result?.outcome, 'victory');
  assert.equal(first.state.result?.enemiesDefeated, 8);
  assert.deepEqual(first.state, second.state);
});

test('invalid constructor numbers and frame deltas remain finite and bounded', () => {
  const battle = new BattleSimulation({ level: NaN, health: Infinity, stage: -5 });
  assert.equal(battle.state.stage, 1);
  assert.equal(battle.state.level, 1);
  assert.equal(battle.state.health, 100);
  assert.equal(battle.state.allies.dog.level, 1);
  const snapshot = JSON.stringify(battle.state);
  for (const delta of [NaN, Infinity, -5, 0]) battle.tick(delta);
  assert.equal(JSON.stringify(battle.state), snapshot);
});

test('animal skill cooldowns preserve twofold real-time pace and result duration excludes virtual acceleration', () => {
  const battle = new BattleSimulation({ level: 1, health: 80, stage: 3 });
  runFor(battle, realDuration(1.5));
  assert.equal(battle.useSkill('sweep'), true);
  assert.equal(battle.state.cooldowns.sweep, 12);
  assert.equal(Math.ceil(realDuration(battle.state.cooldowns.sweep)), 6);
  runFor(battle, realDuration(11.5));
  assert.ok(battle.state.cooldowns.sweep > 0 && battle.state.cooldowns.sweep < 0.51);
  assert.equal(Math.ceil(realDuration(battle.state.cooldowns.sweep)), 1);
  runFor(battle, realDuration(0.6));
  assert.equal(battle.state.cooldowns.sweep, 0);
  assert.equal(battle.useSkill('sweep'), true);
  const result = battle.retreat();
  assert.equal(result.duration, Math.round(realDuration(battle.state.time)));
  closeTo(battle.state.time, 13.6);
});
