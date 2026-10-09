import test from 'node:test';
import assert from 'node:assert/strict';
import { BattleSimulation, canUseSkill, getBattleEnemyTarget } from '../src/battle.ts';
import { MAX_COMPANION_XP } from '../src/companions.ts';
import { advanceTime, beginHunt, cancelHunt, createGame, expansionCost, finishHunt, getFarmCapacity, loadGame, MAX_DECK_LEVEL, performAction, saveGame, SAVE_KEY, setCompanionTeam, type GameState, type HuntResult, type SaveStorage } from '../src/game.ts';
import { UNIT_IDS, RESERVE_UNIT_IDS, UNITS, cloneUnitProgressFields, getMaxTeamSize, getReadyTeam, getSelectedTeam, getUnitBattleBonuses, getUnitLevel, getUnitMaxHealth, getUnitRoster, getUnlockedUnitIds, validateAnimalReserve, validateCompanionTeam, type UnitId } from '../src/units.ts';
import { realDuration } from '../src/game-speed.ts';
import { buildFacility, upgradeFacility } from '../src/settlement.ts';

function storage(): SaveStorage {
  const values = new Map<string, string>();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); } };
}
function deck(level: number): GameState {
  const state = createGame();
  state.deckLevel = level; state.stats.expansions = level - 1;
  if (level > 1) { state.quests = ['bigger-home']; state.xp = 35 * (level - 1) + 30; state.level = Math.floor(state.xp / 120) + 1; }
  while (state.plots.length < level + 2) state.plots.push({ id: state.plots.length + 1, plantedAt: null, watered: false });
  return state;
}
function runFor(battle: BattleSimulation, simulationSeconds: number): void {
  for (let i = 0; i < Math.round(realDuration(simulationSeconds) * 60); i++) battle.tick(1 / 60);
}
function runUntilFinished(battle: BattleSimulation): void {
  for (let frame = 0; frame < 180 * 60 && !battle.state.result; frame++) battle.tick(1 / 60);
  assert.ok(battle.state.result, 'a selected party reaches an actual outcome');
}
function resultFor(state: GameState, changes: Partial<HuntResult> = {}): HuntResult {
  const roster = getUnitRoster(state);
  return { outcome: 'victory', stage: state.expedition!.stage, remainingHealth: 75, enemiesDefeated: 8, duration: 10,
    companionHealth: { dog: roster.dog.health, cat: roster.cat.health },
    reserveHealth: Object.fromEntries(RESERVE_UNIT_IDS.map(id => [id, roster[id].health])) as NonNullable<HuntResult['reserveHealth']>, ...changes };
}
const close = (actual: number, expected: number): void => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} should equal ${expected}`);

test('a genuine v16 two-animal save retains its exact progress while reserve reads and default team are detached', () => {
  const old = deck(3); delete old.animalReserve; delete old.companionTeam; delete old.maxCompanionTeamSize;
  old.companions = { dog: { health: 61.25, xp: 85 }, cat: { health: 0, xp: 319 } };
  const memory = storage(), snapshot = JSON.stringify(old);
  memory.setItem(SAVE_KEY, snapshot);
  const loaded = loadGame(memory)!;
  assert.deepEqual(loaded, old);
  assert.equal(Object.hasOwn(loaded, 'animalReserve'), false);
  assert.deepEqual(getSelectedTeam(loaded), ['dog', 'cat']);
  assert.deepEqual(getReadyTeam(loaded), ['dog']);
  const roster = getUnitRoster(loaded);
  assert.equal(Object.keys(roster).length, 6);
  for (const id of RESERVE_UNIT_IDS) assert.deepEqual(roster[id], { health: 100, xp: 0 });
  roster.dog.health = 0; roster.rabbit.xp = 720;
  assert.equal(JSON.stringify(old), snapshot);
  assert.equal(getUnitRoster(loaded).dog.health, 61.25);
  assert.equal(getUnitRoster(loaded).rabbit.xp, 0);
  const team = getSelectedTeam(loaded); team.pop();
  assert.deepEqual(getSelectedTeam(loaded), ['dog', 'cat']);
  assert.deepEqual(loaded.resources, old.resources);
  assert.equal(loaded.xp, old.xp);
});

test('truck expansion actually unlocks four new roles without awarding XP, materials or changing old animal health', () => {
  let state = createGame(); state.resources.wood = state.resources.scrap = 10000;
  const unlocked = [['dog', 'cat'], ['dog', 'cat', 'rabbit'], ['dog', 'cat', 'rabbit', 'fox'], ['dog', 'cat', 'rabbit', 'fox', 'boar'], [...UNIT_IDS]];
  for (let level = 1; level <= 5; level++) {
    assert.deepEqual(getUnlockedUnitIds(state), unlocked[level - 1]);
    const before = getUnitRoster(state);
    for (const id of UNIT_IDS) assert.deepEqual(before[id], { health: 100, xp: 0 });
    if (level < 5) { state.energy = 100; state = performAction(state, 'expand', undefined, undefined, { advanceClock: false }).state; }
    assert.deepEqual(getUnitRoster(state), before, 'unlocks preserve saved health and XP');
  }
  assert.deepEqual(Object.keys(state.companions!), ['dog', 'cat'], 'legacy two-key companion schema remains strict');
  assert.deepEqual(Object.keys(state.animalReserve!), RESERVE_UNIT_IDS);
});

test('each role has separate level-derived HP and leveling preserves its stored health percentage', () => {
  assert.deepEqual(UNIT_IDS.map(id => UNITS[id].role), ['frontguard', 'fastattack', 'support', 'ranged', 'tank', 'mage']);
  assert.equal(new Set(UNIT_IDS.map(id => UNITS[id].skillId)).size, 6);
  for (const id of UNIT_IDS) {
    for (const [xp, level] of [[0, 1], [79, 1], [80, 2], [720, 10]]) {
      const progress = { health: 23.75, xp };
      assert.equal(getUnitLevel(progress), level);
      assert.equal(getUnitMaxHealth(id, progress), UNITS[id].baseMaxHealth + (level - 1) * UNITS[id].healthPerLevel);
      assert.equal(progress.health, 23.75);
    }
  }
});

test('formation accepts one to three unlocked distinct animals atomically and records lifetime team size', () => {
  const initial = deck(5), before = JSON.stringify(initial);
  const selected = setCompanionTeam(initial, ['rabbit', 'fox', 'boar']);
  assert.equal(selected.ok, true);
  assert.deepEqual(selected.state.companionTeam, ['rabbit', 'fox', 'boar']);
  assert.equal(getMaxTeamSize(selected.state), 3);
  assert.deepEqual(getUnitRoster(selected.state), getUnitRoster(initial));
  assert.deepEqual(selected.state.resources, initial.resources);
  assert.equal(selected.state.energy, initial.energy);
  assert.equal(JSON.stringify(initial), before);
  const reduced = setCompanionTeam(selected.state, ['owl']);
  assert.equal(reduced.ok, true);
  assert.equal(getMaxTeamSize(reduced.state), 3, 'reducing the team cannot invalidate a completed formation quest');
  assert.deepEqual(getSelectedTeam(reduced.state), ['owl']);
  const outside = ['dog', 'cat'];
  const separate = setCompanionTeam(initial, outside).state;
  outside.pop(); assert.deepEqual(separate.companionTeam, ['dog', 'cat']);
  for (const invalid of [null, [], ['dog', 'dog'], ['dog', 'cat', 'rabbit', 'fox'], ['human'], [1], ['constructor'], { 0: 'dog' }]) {
    const rejected = setCompanionTeam(initial, invalid); assert.equal(rejected.ok, false); assert.equal(rejected.state, initial);
  }
  for (const id of RESERVE_UNIT_IDS) assert.equal(setCompanionTeam(createGame(), [id]).ok, false, 'locked animals cannot be selected');
});

test('entry persists only chosen healthy participants, charges once, blocks mid-battle edits and reserves unchosen progress', () => {
  const state = deck(5); state.companionTeam = ['rabbit', 'fox', 'boar']; state.maxCompanionTeamSize = 3;
  state.animalReserve!.fox.health = 0;
  const started = beginHunt(state, 2);
  assert.equal(started.ok, true);
  assert.deepEqual(started.state.expedition!.unitParticipantIds, ['rabbit', 'boar']);
  assert.equal(started.state.expedition!.unitParty, true);
  assert.equal(Object.hasOwn(started.state.expedition!, 'animalParty'), false);
  assert.equal(started.state.energy, state.energy - 16);
  assert.deepEqual(started.state.companionTeam, ['rabbit', 'fox', 'boar']);
  assert.deepEqual(getUnitRoster(started.state), getUnitRoster(state));
  assert.equal(beginHunt(started.state, 1).state, started.state);
  assert.equal(setCompanionTeam(started.state, ['dog']).state, started.state);
  assert.deepEqual(cancelHunt(started.state).state.animalReserve, state.animalReserve);
  const down = { ...state, companionTeam: ['fox'] as UnitId[] };
  assert.equal(beginHunt(down, 1).state, down);
});

test('selection alone cannot grant rest or progress, and meal or resource-free rest heals only unlocked animals', () => {
  const state = deck(3);
  for (const id of UNIT_IDS) {
    if (id === 'dog' || id === 'cat') state.companions![id] = { health: 0, xp: 81 };
    else state.animalReserve![id] = { health: 0, xp: 81 };
  }
  const selected = setCompanionTeam(state, ['rabbit', 'fox']).state;
  assert.deepEqual(getUnitRoster(selected), getUnitRoster(state));
  const meal = performAction(selected, 'rest', undefined, undefined, { advanceClock: false }).state;
  const napSource = { ...selected, resources: { ...selected.resources, food: 0, water: 0 } };
  const nap = performAction(napSource, 'rest', undefined, undefined, { advanceClock: false }).state;
  for (const id of UNIT_IDS) {
    const unlocked = ['dog', 'cat', 'rabbit', 'fox'].includes(id);
    assert.equal(getUnitRoster(meal)[id].health, unlocked ? 35 : 0);
    assert.equal(getUnitRoster(nap)[id].health, unlocked ? 10 : 0);
    assert.equal(getUnitRoster(meal)[id].xp, 81); assert.equal(getUnitRoster(nap)[id].xp, 81);
  }
  assert.equal(meal.resources.food, selected.resources.food - 1);
  assert.equal(meal.resources.water, selected.resources.water - 1);
  assert.deepEqual(nap.resources, napSource.resources);
});

test('v16 pending dog-cat expeditions still load and cancel without conversion, experience or recovery', () => {
  const old = createGame(); delete old.animalReserve; delete old.companionTeam; delete old.maxCompanionTeamSize;
  old.companions = { dog: { health: 41.25, xp: 80 }, cat: { health: 0, xp: 120 } };
  old.stats.hunts = 1; old.energy -= 16; old.expedition = { id: 1, stage: 2, animalParty: true, participantIds: ['dog'] };
  const memory = storage(); memory.setItem(SAVE_KEY, JSON.stringify(old));
  const loaded = loadGame(memory)!; assert.ok(loaded); assert.deepEqual(loaded, old);
  const returned = cancelHunt(loaded); assert.equal(returned.ok, true); assert.equal(returned.state.expedition, null);
  for (const key of ['companions', 'health', 'resources', 'energy', 'stats', 'xp', 'totalMinutes'] as const) assert.deepEqual(returned.state[key], old[key]);
  assert.equal(Object.hasOwn(returned.state, 'animalReserve'), false);
  const won = finishHunt(loaded, { outcome: 'victory', stage: 2, remainingHealth: 23, companionHealth: { dog: 23, cat: 0 }, enemiesDefeated: 8, duration: 10 }, 1);
  assert.equal(won.ok, true); assert.equal(won.state.companions!.dog.xp, 105); assert.equal(won.state.companions!.cat.xp, 120);
  assert.equal(Object.hasOwn(won.state, 'animalReserve'), false);
});

test('v17 formation and progress survive save/reload and interrupted expeditions recover without gifts', () => {
  const state = deck(5); state.companionTeam = ['rabbit', 'fox', 'owl']; state.maxCompanionTeamSize = 3;
  state.animalReserve!.rabbit = { health: 61.25, xp: 79 }; state.animalReserve!.owl = { health: 35.75, xp: 719 };
  const before = JSON.stringify(state), memory = storage(); assert.equal(saveGame(state, memory), true);
  const loaded = loadGame(memory)!; assert.deepEqual(loaded, { ...state, lastSaved: loaded.lastSaved });
  const started = beginHunt(loaded, 3).state; assert.equal(saveGame(started, memory), true);
  const pending = loadGame(memory)!; const returned = cancelHunt(pending); assert.equal(returned.ok, true);
  for (const key of ['companions', 'animalReserve', 'companionTeam', 'health', 'resources', 'stats', 'xp', 'totalMinutes'] as const) assert.deepEqual(returned.state[key], started[key]);
  assert.equal(returned.state.energy, state.energy - 16); assert.equal(cancelHunt(returned.state).state, returned.state);
  assert.equal(JSON.stringify(state), before);
});

test('selected-unit victory awards only real participants stage-specific XP, preserves percentage on level-up and rejects duplicates', () => {
  for (const stage of [1, 2, 3]) {
    const initial = deck(5); initial.companionTeam = ['rabbit', 'fox', 'boar']; initial.maxCompanionTeamSize = 3;
    initial.animalReserve!.rabbit.xp = 79; initial.animalReserve!.fox.xp = 719; initial.animalReserve!.boar.health = 0;
    const started = beginHunt(initial, stage).state;
    const result = resultFor(started); result.reserveHealth!.rabbit = 61.25; result.reserveHealth!.fox = 0;
    const won = finishHunt(started, result, started.expedition!.id);
    assert.equal(won.ok, true); assert.equal(won.state.health, initial.health);
    assert.equal(won.state.animalReserve!.rabbit.xp, 79 + 20 + (stage - 1) * 5);
    assert.equal(won.state.animalReserve!.fox.xp, MAX_COMPANION_XP, 'participation counts even when the animal falls during victory');
    assert.equal(won.state.animalReserve!.rabbit.health, 61.25, 'level-up changes derived max HP, never the saved remaining percentage');
    for (const id of ['dog', 'cat', 'boar', 'owl'] as const) assert.deepEqual(getUnitRoster(won.state)[id], getUnitRoster(initial)[id]);
    assert.equal(won.state.stats.battlesWon, 1); assert.equal(won.state.stats.defeatedEnemies, 8);
    assert.equal(finishHunt(won.state, result, 1).state, won.state);
    assert.equal(getUnitRoster(started).rabbit.health, 100);
  }
});

test('nonparticipant damage, malformed reserve snapshots, false victories and mismatched tokens are rejected atomically', () => {
  const state = deck(5); state.companionTeam = ['fox'];
  const started = beginHunt(state, 1).state, before = JSON.stringify(started), base = resultFor(started);
  const wrong: HuntResult[] = [
    { ...base, reserveHealth: undefined }, { ...base, reserveHealth: { ...base.reserveHealth!, rabbit: -1 } },
    { ...base, reserveHealth: { ...base.reserveHealth!, rabbit: 99 } },
    { ...base, companionHealth: { dog: 99, cat: 100 } }, { ...base, reserveHealth: { ...base.reserveHealth!, fox: 0 } },
    { ...base, enemiesDefeated: 7 }, { ...base, outcome: 'defeat' }, { ...base, stage: 2 },
  ];
  for (const result of wrong) { const rejected = finishHunt(started, result, 1); assert.equal(rejected.ok, false); assert.equal(rejected.state, started); assert.equal(JSON.stringify(started), before); }
  assert.equal(finishHunt(started, base, 2).state, started);
  const defeat = finishHunt(started, { ...base, outcome: 'defeat', enemiesDefeated: 3, reserveHealth: { ...base.reserveHealth!, fox: 0 } }, 1);
  assert.equal(defeat.ok, true, 'unselected living pets cannot prevent defeat of the actual selected party');
  assert.equal(defeat.state.companions!.dog.health, 100); assert.equal(defeat.state.animalReserve!.fox.health, 0);
  assert.deepEqual(defeat.state.resources, state.resources);
});

test('every new animal fights alone with its own actual basic attack and selected skill, without using unselected owners', () => {
  for (const id of RESERVE_UNIT_IDS) {
    const roster = getUnitRoster(deck(5)); roster[id].health = 50;
    const battle = new BattleSimulation({ level: 99, health: 0, stage: 1, units: roster, teamIds: [id] });
    runFor(battle, 1.5);
    assert.deepEqual(battle.state.teamIds, [id]); assert.equal(battle.state.allies[id].level, 1);
    assert.equal(canUseSkill(battle.state, UNITS[id].skillId), true);
    assert.equal(battle.useSkill(UNITS[id].skillId), true);
    for (const other of UNIT_IDS.filter(other => other !== id)) assert.equal(battle.useSkill(UNITS[other].skillId), false);
    const owned = [...battle.state.events];
    for (let frame = 0; frame < 120; frame++) { battle.tick(1 / 60); owned.push(...battle.state.events); }
    assert.ok(owned.some(event => event.kind === 'attack' && event.actor === id), `${id} performs a genuine independent basic attack`);
    assert.ok(owned.some(event => event.kind === UNITS[id].skillId && event.actor === id), `${id} owns its selected skill`);
    assert.equal(owned.some(event => event.actor && event.actor !== id), false);
    const result = battle.retreat();
    for (const other of UNIT_IDS.filter(other => other !== id)) assert.equal(other === 'dog' || other === 'cat' ? result.companionHealth[other] : result.reserveHealth![other], 100, 'unselected health remains untouched');
  }
});

test('rabbit healing protects actual living teammates by HP and neither revives nor touches unselected animals', () => {
  const roster = getUnitRoster(deck(5)); roster.rabbit.health = 50; roster.dog.health = 50; roster.fox.health = 0; roster.cat.health = 10;
  const battle = new BattleSimulation({ level: 1, health: 100, stage: 1, units: roster, teamIds: ['rabbit', 'dog', 'fox'] });
  runFor(battle, 1.5);
  const beforeRabbit = battle.state.allies.rabbit.health, beforeDog = battle.state.allies.dog.health;
  assert.equal(battle.useSkill('mend'), true);
  assert.equal(battle.state.allies.rabbit.health, beforeRabbit + 31); assert.equal(battle.state.allies.dog.health, beforeDog + 31);
  assert.equal(battle.state.allies.fox.health, 0); assert.equal(battle.state.allies.cat.health, 9);
  assert.ok(battle.state.allies.dog.guardUntil > battle.state.time);
  assert.equal(battle.state.events.filter(event => event.kind === 'heal').every(event => event.actor === 'rabbit' && ['rabbit', 'dog'].includes(event.target as string)), true);
});

test('fox concentrated volley hits the strongest enemy exactly three times with its own damage ownership', () => {
  const battle = new BattleSimulation({ level: 1, health: 100, stage: 1, units: getUnitRoster(deck(5)), teamIds: ['fox'] });
  runFor(battle, 1.5); battle.state.enemies[1].health = battle.state.enemies[1].maxHealth = 200;
  const first = battle.state.enemies[0].health;
  assert.equal(battle.useSkill('volley'), true);
  assert.equal(battle.state.enemies[0].health, first); assert.equal(battle.state.enemies[1].health, 140);
  const hits = battle.state.events.filter(event => event.kind === 'damage' && event.actor === 'fox');
  assert.equal(hits.length, 3); assert.equal(hits.every(event => event.target === battle.state.enemies[1].id && event.amount === 20), true);
});

test('boar protects each selected living teammate and taunts a runner away from a fragile rear support', () => {
  const battle = new BattleSimulation({ level: 1, health: 100, stage: 1, units: getUnitRoster(deck(5)), teamIds: ['rabbit', 'cat', 'boar'] });
  runFor(battle, 1.5);
  battle.state.enemies[0].kind = 'runner';
  assert.equal(getBattleEnemyTarget(battle.state, battle.state.enemies[0])?.id, 'rabbit');
  assert.equal(battle.useSkill('fortify'), true);
  assert.equal(getBattleEnemyTarget(battle.state, battle.state.enemies[0])?.id, 'boar');
  for (const id of battle.state.teamIds) close(battle.state.allies[id].guardUntil - battle.state.time, 4.5);
  const target = battle.state.allies.boar, before = target.health;
  battle.state.enemies = [battle.state.enemies[0]]; battle.state.enemies[0].x = 0; battle.state.enemies[0].attackIn = 0;
  battle.tick(1 / 60); close(target.health, before - 2.3 * .45);
  assert.equal(battle.state.enemies[0].attackTarget, 'boar');
  runFor(battle, 5);
  assert.equal(getBattleEnemyTarget(battle.state, battle.state.enemies[0])?.id, 'rabbit', 'taunt expires in active simulation time');
});

test('owl magic damages the whole wave and slows actual approach compared with identical natural simulation steps', () => {
  const options = { level: 1, health: 100, stage: 1, units: getUnitRoster(deck(5)), teamIds: ['owl'] as UnitId[] };
  const magic = new BattleSimulation(options), control = new BattleSimulation(options);
  runFor(magic, 1.5); runFor(control, 1.5);
  const health = magic.state.enemies.map(enemy => enemy.health);
  assert.equal(magic.useSkill('burst'), true);
  magic.state.enemies.forEach((enemy, index) => assert.equal(enemy.health, health[index] - 30));
  const beforeMagic = magic.state.enemies[0].x, beforeControl = control.state.enemies[0].x;
  magic.tick(1 / 60); control.tick(1 / 60);
  close(beforeMagic - magic.state.enemies[0].x, (beforeControl - control.state.enemies[0].x) / 2);
  assert.equal(magic.state.events.find(event => event.kind === 'burst')?.actor, 'owl');
});

test('three-animal role composition wins all stages with AUTO and all results settle against the exact selected expedition', () => {
  for (const team of [['dog', 'cat', 'rabbit'], ['boar', 'fox', 'owl']] as UnitId[][]) {
    for (const stage of [1, 2, 3]) {
      const initial = deck(5); initial.companionTeam = team; initial.maxCompanionTeamSize = 3;
      initial.companions!.dog.health = 61.25; initial.companions!.cat.health = 79.75;
      const started = beginHunt(initial, stage).state;
      const battle = new BattleSimulation({ level: initial.level, health: initial.health, stage, units: getUnitRoster(started), teamIds: started.expedition!.unitParticipantIds, bonuses: started.expedition!.unitBattleBonuses });
      battle.setAuto(true); runUntilFinished(battle);
      assert.equal(battle.state.result!.outcome, 'victory'); assert.equal(battle.state.result!.enemiesDefeated, 8);
      const won = finishHunt(started, battle.state.result!, started.expedition!.id);
      assert.equal(won.ok, true, won.message);
      for (const id of UNIT_IDS) assert.equal(getUnitRoster(won.state)[id].xp, team.includes(id) ? 20 + (stage - 1) * 5 : 0);
      assert.equal(won.state.health, initial.health);
      assert.equal(finishHunt(won.state, battle.state.result!, 1).state, won.state);
    }
  }
});

test('a down skill owner cannot cast, the remaining selected team fights on and three downed participants cause defeat', () => {
  const roster = getUnitRoster(deck(5)); roster.rabbit.health = 0;
  const battle = new BattleSimulation({ level: 1, health: 100, stage: 1, units: roster, teamIds: ['rabbit', 'fox', 'boar'] });
  runFor(battle, 1.5); assert.equal(battle.useSkill('mend'), false); assert.equal(battle.state.cooldowns.mend, 0);
  const observed = [];
  for (let frame = 0; frame < 120; frame++) { battle.tick(1 / 60); observed.push(...battle.state.events); }
  assert.equal(observed.some(event => event.actor === 'rabbit'), false);
  assert.ok(observed.some(event => event.actor === 'fox' && event.kind === 'attack'));
  for (const id of ['rabbit', 'fox', 'boar'] as const) roster[id].health = 0;
  const down = new BattleSimulation({ level: 1, health: 100, stage: 1, units: roster, teamIds: ['rabbit', 'fox', 'boar'] });
  assert.equal(down.state.result!.outcome, 'defeat'); assert.equal(down.state.result!.remainingHealth, 0);
  assert.equal(down.state.result!.companionHealth.dog, 100, 'nonparticipants do not determine defeat');
});

test('paid pet-house and watchtower levels snapshot capped nonstacking battle effects and change actual damage', () => {
  let state = deck(5); state.resources.wood = state.resources.scrap = 100000;
  state = buildFacility(state, 'petHouse', 0).state; state = buildFacility(state, 'watchtower', 1).state;
  for (let level = 1; level < 5; level++) { state = upgradeFacility(state, 1).state; state = upgradeFacility(state, 2).state; }
  state = buildFacility(state, 'petHouse', 2).state; state = buildFacility(state, 'watchtower', 3).state;
  assert.deepEqual(getUnitBattleBonuses(state), { attackMultiplier: 1.2, enemyDamageMultiplier: .85 });
  const started = beginHunt(state, 1).state, bonuses = started.expedition!.unitBattleBonuses!;
  assert.deepEqual(bonuses, { attackMultiplier: 1.2, enemyDamageMultiplier: .85 });
  state.settlement!.buildings[0].level = 1; assert.equal(bonuses.attackMultiplier, 1.2);
  const battle = new BattleSimulation({ level: 1, health: 100, stage: 1, units: getUnitRoster(started), teamIds: ['dog', 'cat'], bonuses });
  runFor(battle, 1.5); const before = battle.state.enemies.map(enemy => enemy.health);
  assert.equal(battle.useSkill('sweep'), true);
  battle.state.enemies.forEach((enemy, index) => assert.equal(enemy.health, before[index] - 30, '25HP cat skill gains the paid20% attack buff'));
  battle.state.enemies = [battle.state.enemies[0]]; battle.state.enemies[0].x = 0; battle.state.enemies[0].attackIn = 0;
  battle.tick(1 / 60); close(battle.state.allies.dog.health, 120 - 2.3 * .85);
  bonuses.attackMultiplier = 1; assert.equal(battle.state.bonuses.attackMultiplier, 1.2, 'constructor detaches expedition bonus snapshots');
});

test('clone helpers and game time mutations detach all four reserve records, team arrays and expedition bonus snapshots', () => {
  const state = deck(5); state.companionTeam = ['rabbit', 'fox', 'boar']; state.maxCompanionTeamSize = 3;
  state.animalReserve!.fox.health = 61.25;
  const fields = cloneUnitProgressFields(state); fields.animalReserve!.fox.health = 0; fields.companionTeam!.pop();
  assert.equal(state.animalReserve!.fox.health, 61.25); assert.equal(state.companionTeam.length, 3);
  assert.equal(fields.maxCompanionTeamSize, 3);
  for (const copy of [advanceTime(state, 1), performAction(state, 'gather', undefined, undefined, { advanceClock: false }).state]) {
    assert.notEqual(copy.animalReserve, state.animalReserve); assert.notEqual(copy.companionTeam, state.companionTeam);
    for (const id of RESERVE_UNIT_IDS) { assert.notEqual(copy.animalReserve![id], state.animalReserve![id]); assert.deepEqual(copy.animalReserve![id], state.animalReserve![id]); }
  }
  const pending = beginHunt(state, 1).state, copy = advanceTime(pending, 1);
  assert.notEqual(copy.expedition!.unitParticipantIds, pending.expedition!.unitParticipantIds);
  assert.notEqual(copy.expedition!.unitBattleBonuses, pending.expedition!.unitBattleBonuses);
});

test('present malformed reserves, locked or duplicate teams and incompatible expedition markers reject saves without repair', () => {
  const memory = storage(), valid = deck(5);
  const badReserves: unknown[] = [null, [], {}, { ...valid.animalReserve, rabbit: { health: 101, xp: 0 } },
    { ...valid.animalReserve, fox: { health: 100, xp: .5 } }, { ...valid.animalReserve, owl: { health: 100, xp: 721 } },
    { ...valid.animalReserve, boar: { health: 100, xp: 0, level: 1 } }, { ...valid.animalReserve, dog: { health: 100, xp: 0 } }];
  for (const animalReserve of badReserves) {
    assert.equal(validateAnimalReserve(animalReserve), false); memory.setItem(SAVE_KEY, JSON.stringify({ ...valid, animalReserve })); assert.equal(loadGame(memory), null);
  }
  for (const companionTeam of [[], ['dog', 'dog'], ['dog', 'cat', 'rabbit', 'fox'], ['human'], null]) {
    assert.equal(validateCompanionTeam(companionTeam, valid), false); memory.setItem(SAVE_KEY, JSON.stringify({ ...valid, companionTeam })); assert.equal(loadGame(memory), null);
  }
  memory.setItem(SAVE_KEY, JSON.stringify({ ...createGame(), companionTeam: ['owl'] })); assert.equal(loadGame(memory), null);
  const pending = beginHunt(valid, 1).state;
  for (const patch of [{ unitParty: false }, { unitParticipantIds: [] }, { unitParticipantIds: ['dog', 'dog'] },
    { unitParticipantIds: ['owl'] }, { animalParty: true }, { participantIds: ['dog'] }, { unitBattleBonuses: { attackMultiplier: 1.21, enemyDamageMultiplier: .85 } }]) {
    memory.setItem(SAVE_KEY, JSON.stringify({ ...pending, expedition: { ...pending.expedition, ...patch } })); assert.equal(loadGame(memory), null);
  }
  for (const maxCompanionTeamSize of [0, 4, .5, null]) { memory.setItem(SAVE_KEY, JSON.stringify({ ...valid, maxCompanionTeamSize })); assert.equal(loadGame(memory), null); }
});

test('eight earned deck levels use the eased exact prices, preserve old quantities and support24 paid farm plots', () => {
  let state = createGame(); state.resources.wood = state.resources.scrap = 100000;
  let wood = 0, scrap = 0;
  for (const [level, expectedWood, expectedScrap] of [[1, 20, 10], [2, 34, 17], [3, 48, 24], [4, 62, 31], [5, 76, 38], [6, 90, 45], [7, 104, 52]]) {
    assert.equal(state.deckLevel, level); assert.deepEqual(expansionCost(state), { wood: expectedWood, scrap: expectedScrap });
    wood += expectedWood; scrap += expectedScrap; state.energy = 100;
    const before = state.resources, next = performAction(state, 'expand', undefined, undefined, { advanceClock: false }); assert.equal(next.ok, true);
    assert.equal(next.state.resources.wood, before.wood - expectedWood); assert.equal(next.state.resources.scrap, before.scrap - expectedScrap); state = next.state;
  }
  assert.equal(wood, 434); assert.equal(scrap, 217); assert.equal(MAX_DECK_LEVEL, 8); assert.equal(getFarmCapacity(state), 24);
  while (state.plots.length < 24) { state.energy = 100; const next = performAction(state, 'expandFarm', undefined, undefined, { advanceClock: false }); assert.equal(next.ok, true); state = next.state; }
  assert.equal(performAction(state, 'expandFarm').state, state); assert.equal(performAction(state, 'expand').state, state);
  assert.equal(saveGame(state, storage()), true);
  const ninth = { ...state, deckLevel: 9, stats: { ...state.stats, expansions: 8 } }; assert.equal(saveGame(ninth, storage()), false);
});
