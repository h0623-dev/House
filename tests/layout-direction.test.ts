import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceTime, beginHunt, createGame, loadGame, performAction, SAVE_KEY, saveGame, tick,
  type GameState, type SaveStorage } from '../src/game.ts';
import { claimGrowthQuest } from '../src/growth-quests.ts';
import { cloneLayoutDirectionFields, getLayoutDirection, rotateLayoutTarget, validateLayoutDirections,
  type LayoutDirections, type LayoutTarget } from '../src/layout-direction.ts';
import { buildFacility, buildTruckFloor, collectProduction, getSettlement, moveFacility, moveHome,
  replaceFacility, startProduction } from '../src/settlement.ts';
import { fulfillVillageOrder, getVillageOrder } from '../src/village-orders.ts';

function storage(): SaveStorage {
  const values = new Map<string, string>();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); } };
}
function funded(level = 1): GameState {
  let state = createGame('male');
  state.resources.wood = state.resources.scrap = state.resources.food = state.resources.water = 10_000;
  for (let current = 1; current < level; current++) {
    if (state.energy < 15) state = performAction(state, 'rest').state;
    const expanded = performAction(state, 'expand'); assert.equal(expanded.ok, true, expanded.message); state = expanded.state;
  }
  return state;
}
function withoutDirections(state: GameState) {
  const { layoutDirections: _directions, ...rest } = state;
  return rest;
}
function rotated(state: GameState, target: LayoutTarget): GameState {
  const before = structuredClone(state), result = rotateLayoutTarget(state, target);
  assert.equal(result.ok, true, result.message); assert.deepEqual(state, before);
  assert.deepEqual(withoutDirections(result.state), withoutDirections(before), 'visual rotation changes no simulation data');
  return result.state;
}

test('old saves keep their original directions and receive no new layout or rewards', () => {
  const state = createGame(), before = structuredClone(state), memory = storage();
  assert.equal(getLayoutDirection(state, { kind: 'home' }), 0);
  for (const plot of state.plots) assert.equal(getLayoutDirection(state, { kind: 'plot', id: plot.id }), 0);
  assert.deepEqual(cloneLayoutDirectionFields(state), {});
  assert.equal(saveGame(state, memory), true); const loaded = loadGame(memory)!;
  assert.equal(Object.hasOwn(loaded, 'layoutDirections'), false);
  assert.deepEqual(withoutDirections(loaded), { ...before, lastSaved: loaded.lastSaved });
  assert.deepEqual(state, before);
});

test('free directions survive save/reload while crops and an active production batch retain their exact clocks', () => {
  let state = buildFacility(funded(), 'waterworks', 0).state;
  state = startProduction(state, 1).state;
  const original = structuredClone(state), targets: LayoutTarget[] = [
    { kind: 'home' }, { kind: 'facility', id: 1 }, { kind: 'plot', id: 1 }, { kind: 'plot', id: 2 }, { kind: 'plot', id: 3 },
  ];
  for (const target of targets) {
    state = rotated(state, target); assert.equal(getLayoutDirection(state, target), 1);
  }
  assert.deepEqual(withoutDirections(state), withoutDirections(original));
  const memory = storage(); assert.equal(saveGame(state, memory), true); const loaded = loadGame(memory)!;
  assert.deepEqual(loaded.layoutDirections, state.layoutDirections);
  assert.deepEqual(loaded.plots, original.plots);
  assert.deepEqual(getSettlement(loaded).buildings, getSettlement(original).buildings);
  const ready = advanceTime(loaded, 90), collected = collectProduction(ready, 1);
  assert.equal(collected.ok, true, collected.message);
  assert.equal(collected.state.resources.water, loaded.resources.water + 4);
  assert.deepEqual(collected.state.layoutDirections, state.layoutDirections);
  const harvested = performAction(loaded, 'harvest', 1);
  assert.equal(harvested.ok, true, harvested.message);
  assert.equal(getLayoutDirection(harvested.state, { kind: 'plot', id: 1 }), 1);
  assert.equal(harvested.state.plots[0].plantedAt, null, 'rotating did not invalidate an already ripe crop');
});

test('directions follow stable home, legacy facility and upper facility identities through relocation and replacement', () => {
  let state = funded(7);
  state = buildTruckFloor(state).state; state = buildTruckFloor(state).state;
  state = buildFacility(state, 'waterworks', 0).state;
  const upper = buildFacility(state, 'petHouse', 32); assert.equal(upper.ok, true); state = upper.state;
  state = rotated(rotated(rotated(state, { kind: 'home' }), { kind: 'facility', id: 1 }), { kind: 'facility', id: 17 });
  let result = moveHome(state, { floor: 3, slot: 1 }); assert.equal(result.ok, true, result.message); state = result.state;
  result = moveFacility(state, 1, 17); assert.equal(result.ok, true, result.message); state = result.state;
  result = moveFacility(state, 17, 33); assert.equal(result.ok, true, result.message); state = result.state;
  result = replaceFacility(state, 17, 'kitchen'); assert.equal(result.ok, true, result.message); state = result.state;
  assert.equal(getLayoutDirection(state, { kind: 'home' }), 1);
  assert.equal(getLayoutDirection(state, { kind: 'facility', id: 1 }), 1);
  assert.equal(getLayoutDirection(state, { kind: 'facility', id: 17 }), 1);
  assert.deepEqual(getSettlement(state).buildings.map(building => [building.id, building.slot]), [[1,17],[17,33]]);
  const memory = storage(); assert.equal(saveGame(state, memory), true);
  assert.deepEqual(loadGame(memory)!.layoutDirections, state.layoutDirections);
});

test('game, settlement, growth reward and order actions deep copy saved nested direction records', () => {
  let state = buildFacility(funded(), 'waterworks', 0).state;
  state = rotated(rotated(rotated(state, { kind: 'home' }), { kind: 'facility', id: 1 }), { kind: 'plot', id: 1 });
  state = performAction(state, 'gather').state;
  const original = structuredClone(state), claimed = claimGrowthQuest(state, 'road-supplies');
  assert.equal(claimed.ok, true, claimed.message);
  const ordered = fulfillVillageOrder(state, getVillageOrder(state).id);
  assert.equal(ordered.ok, true, ordered.message);
  const copies = [tick(state, 1), startProduction(state, 1).state, claimed.state, ordered.state,
    { ...state, ...cloneLayoutDirectionFields(state) }];
  for (const copy of copies) {
    assert.deepEqual(copy.layoutDirections, original.layoutDirections);
    assert.notStrictEqual(copy.layoutDirections, state.layoutDirections);
    assert.notStrictEqual(copy.layoutDirections!.facilities, state.layoutDirections!.facilities);
    assert.notStrictEqual(copy.layoutDirections!.plots[0], state.layoutDirections!.plots[0]);
    copy.layoutDirections!.home = 0;
    copy.layoutDirections!.facilities[0].direction = 0;
    copy.layoutDirections!.plots[0].direction = 0;
    assert.deepEqual(state, original);
  }
});

test('two turns restore the original facing without changing purchased slots or crop ownership', () => {
  let state = buildFacility(funded(), 'waterworks', 0).state;
  for (const target of [{ kind: 'home' }, { kind: 'facility', id: 1 }, { kind: 'plot', id: 2 }] as LayoutTarget[]) {
    const first = rotated(state, target); assert.equal(getLayoutDirection(first, target), 1);
    const second = rotated(first, target); assert.equal(getLayoutDirection(second, target), 0);
    assert.equal(getLayoutDirection(first, target), 1, 'later edits do not mutate an earlier orientation snapshot');
    state = second;
  }
  assert.equal(validateLayoutDirections(state.layoutDirections, state), true);
});

test('invalid target and active combat edits leave the entire state unchanged', () => {
  const state = createGame(), before = structuredClone(state);
  for (const target of [null, { kind: 'road' }, { kind: 'facility', id: 1 }, { kind: 'plot', id: 0 },
    { kind: 'plot', id: 99 }, { kind: 'plot', id: '1' }, { kind: 'plot', id: 1.5 }, { kind: 'plot' }]) {
    const result = rotateLayoutTarget(state, target as LayoutTarget);
    assert.equal(result.ok, false); assert.strictEqual(result.state, state); assert.deepEqual(state, before);
  }
  const battle = beginHunt(state, 1); assert.equal(battle.ok, true);
  const pending = structuredClone(battle.state), result = rotateLayoutTarget(battle.state, { kind: 'home' });
  assert.equal(result.ok, false); assert.strictEqual(result.state, battle.state); assert.deepEqual(battle.state, pending);
});

test('malformed direction metadata cannot overwrite or load a save, including duplicate or nonexistent IDs', () => {
  const state = buildFacility(funded(), 'waterworks', 0).state;
  const valid: LayoutDirections = { version: 1, home: 0, facilities: [{ id: 1, direction: 1 }], plots: [{ id: 2, direction: 1 }] };
  assert.equal(validateLayoutDirections(valid, state), true);
  const malformed = [undefined, null, [], {}, { ...valid, version: 2 }, { ...valid, home: 2 }, { ...valid, home: '0' },
    { ...valid, extra: 0 }, { ...valid, facilities: null }, { ...valid, plots: {} },
    { ...valid, facilities: [{ id: 17, direction: 0 }] }, { ...valid, plots: [{ id: 99, direction: 0 }] },
    { ...valid, facilities: [valid.facilities[0], valid.facilities[0]] },
    { ...valid, plots: [valid.plots[0], valid.plots[0]] },
    { ...valid, plots: [{ id: '2', direction: 0 }] }, { ...valid, plots: [{ id: 2, direction: .5 }] },
    { ...valid, plots: [{ id: 2, direction: true }] }, { ...valid, plots: [{ id: 2, direction: 0, floor: 1 }] },
  ];
  for (const metadata of malformed) {
    const memory = storage(); assert.equal(saveGame(state, memory), true); const previous = memory.getItem(SAVE_KEY);
    const damaged = { ...state, layoutDirections: metadata } as GameState;
    assert.equal(validateLayoutDirections(metadata, state), false);
    assert.equal(saveGame(damaged, memory), false); assert.equal(memory.getItem(SAVE_KEY), previous);
    if (metadata !== undefined) {
      memory.setItem(SAVE_KEY, JSON.stringify(damaged)); assert.equal(loadGame(memory), null);
    }
    const result = rotateLayoutTarget(damaged, { kind: 'home' });
    assert.equal(result.ok, false); assert.strictEqual(result.state, damaged);
  }
});
