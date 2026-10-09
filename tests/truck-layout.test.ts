import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceTime, beginHunt, createGame, loadGame, performAction, saveGame, tick, type GameState, type SaveStorage } from '../src/game.ts';
import { buildFacility, buildTruckFloor, collectProduction, getFacilityHistory, getLegacySettlement, getSettlement,
  getUpgradedFacilityRecord, isFacilitySlotAvailable, isHomeSlotAvailable, moveFacility, moveHome, replaceFacility,
  startProduction, upgradeFacility, validateFacilityHistory, validateSettlement, validateTruckLayout } from '../src/settlement.ts';
import { FARM_POSITIONS, HOME_RAIL_MARGIN, SETTLEMENT_POSITIONS, getAllUnlockedSlots, getFloorBounds, getFloorSlots,
  getFloorStairs, getHomeLocation, getHomeSlots, getHouseFootprint, getTruckFloorCost, getTruckFloorCount,
  getTruckLayout, projectTruckPoint, unprojectTruckPoint } from '../src/truck-layout.ts';
import { claimGrowthQuest } from '../src/growth-quests.ts';
import { fulfillVillageOrder, getVillageOrder } from '../src/village-orders.ts';
import { getUnitBattleBonuses } from '../src/units.ts';

function funded(level = 1): GameState {
  let state = createGame();
  state.resources.wood = state.resources.scrap = state.resources.food = state.resources.water = 10_000;
  for (let current = 1; current < level; current++) {
    if (state.energy < 15) state = performAction(state, 'rest').state;
    const expanded = performAction(state, 'expand'); assert.equal(expanded.ok, true, expanded.message); state = expanded.state;
  }
  return state;
}
function storage(): SaveStorage {
  const values = new Map<string, string>(); return { getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); } };
}
function paidFloors(level: number, count: number): GameState {
  let state = funded(level);
  for (let floor = 1; floor < count; floor++) { const result = buildTruckFloor(state); assert.equal(result.ok, true, result.message); state = result.state; }
  return state;
}

test('an untouched old save has a detached default home and no free floors or materials', () => {
  const state = createGame(), before = structuredClone(state), target = storage();
  const home = getHomeLocation(state), layout = getTruckLayout(state);
  home.slot = 4; layout.placements.push({ id: 1, slot: 16 });
  assert.equal(getTruckFloorCount(state), 1); assert.equal(getAllUnlockedSlots(state), 2);
  assert.deepEqual(getFloorSlots(state, 2), []); assert.deepEqual(state, before);
  assert.equal(saveGame(state, target), true); const loaded = loadGame(target)!;
  assert.equal(Object.hasOwn(loaded, 'truckLayout'), false);
  assert.deepEqual(loaded.resources, before.resources); assert.deepEqual(loaded.settlement, before.settlement);
});

test('each platform charges once and obeys the sequential Lv4/Lv7 gate', () => {
  const early = funded(3), snapshot = structuredClone(early);
  assert.strictEqual(buildTruckFloor(early).state, early); assert.deepEqual(early, snapshot);
  let state = funded(4); const before = structuredClone(state); const second = buildTruckFloor(state);
  assert.equal(second.ok, true); state = second.state;
  assert.equal(state.resources.wood, before.resources.wood - 100); assert.equal(state.resources.scrap, before.resources.scrap - 50);
  assert.deepEqual(state.stats, before.stats); assert.equal(state.totalMinutes, before.totalMinutes);
  assert.deepEqual(getFloorSlots(state, 2), [16,17,18,19,20,21,22,23]); assert.equal(getAllUnlockedSlots(state), 16);
  assert.deepEqual(getTruckFloorCost(state), { floor: 3, unlockLevel: 7, wood: 160, scrap: 80 });
  assert.strictEqual(buildTruckFloor(state).state, state);
  const max = paidFloors(8, 3); assert.equal(getAllUnlockedSlots(max), 48);
  assert.deepEqual(getFloorSlots(max, 3), Array.from({ length: 16 }, (_, index) => 32 + index));
  assert.equal(getTruckFloorCost(max), null); assert.strictEqual(buildTruckFloor(max).state, max);
  const battle = beginHunt(funded(4), 1); assert.equal(battle.ok, true); assert.strictEqual(buildTruckFloor(battle.state).state, battle.state);
});

test('home footprints and shared stairs stay inside every unlocked truck plane', () => {
  for (let level = 1; level <= 8; level++) {
    const state = funded(level), d = getFloorBounds(level);
    for (const slot of getHomeSlots(state, 1)) {
      const f = getHouseFootprint({ floor: 1, slot });
      assert.ok(f.left >= d.left + HOME_RAIL_MARGIN && f.right <= d.end - HOME_RAIL_MARGIN);
      assert.ok(f.top >= d.back + HOME_RAIL_MARGIN && f.bottom <= d.front - HOME_RAIL_MARGIN);
    }
    for (const [u,v] of FARM_POSITIONS.slice(0, level * 3)) {
      assert.ok(u >= d.left && u + 69 <= d.end && v >= d.back && v + 68 <= d.front, `Lv${level} paid farm fits`);
    }
  }
  assert.deepEqual(getHomeSlots(createGame(), 1), [0,4]);
  for (const floor of [2,3] as const) {
    const stairs = getFloorStairs(8, floor), unlockedFront = getFloorBounds(floor === 2 ? 4 : 7).front;
    assert.equal(stairs.bottomUV[1], unlockedFront - 114);
    assert.equal(stairs.lowerEntryUV[1], unlockedFront - 60);
    assert.equal(stairs.topUV[1], unlockedFront - 194);
    assert.equal(stairs.upperEntryUV[1], unlockedFront - 248);
    assert.ok(stairs.lowerEntryUV[1] - stairs.reserved.bottom >= 54);
    assert.ok(stairs.reserved.top - stairs.upperEntryUV[1] >= 54);
    assert.deepEqual(unprojectTruckPoint(projectTruckPoint([-206,-102], floor), floor).map(value => Math.round(value)), [-206,-102]);
    assert.equal(getFloorBounds(8, floor).height, (floor - 1) * 176);
  }
});

test('paid stairways stay at their built positions while later expansions keep homes, facilities and farms clear', () => {
  const bodyRadius = 30.8;
  const bodyMargin = { u: bodyRadius * Math.hypot(.47,.67) / .6555, v: bodyRadius * Math.hypot(.34,.91) / .6555 };
  const overlaps = (a: {left:number;right:number;top:number;bottom:number}, b: typeof a) =>
    a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  for (const upperFloor of [2,3] as const) {
    const unlockedLevel = upperFloor === 2 ? 4 : 7, built = getFloorStairs(unlockedLevel, upperFloor);
    assert.deepEqual(built.reserved, upperFloor === 2
      ? { left:-249, right:-158, top:60, bottom:140 }
      : { left:-249, right:-158, top:226, bottom:306 });
    for (let level = unlockedLevel; level <= 8; level++) {
      const state = paidFloors(level, upperFloor), stairs = getFloorStairs(state, upperFloor);
      assert.deepEqual(stairs, built, `Lv${level} preserves every actual ${upperFloor-1}→${upperFloor} foot and landing anchor`);
      for (const [floor, entry] of [[stairs.lowerFloor,stairs.lowerEntryUV],[stairs.upperFloor,stairs.upperEntryUV]] as const) {
        const d = getFloorBounds(level, floor);
        assert.ok(entry[0] >= d.left + 6 + bodyMargin.u && entry[0] <= d.end - 6 - bodyMargin.u
          && entry[1] >= d.back + 6 + bodyMargin.v && entry[1] <= d.front - 6 - bodyMargin.v,
          `Lv${level} floor${floor} landing fits the largest tested companion and rail inset`);
        for (const slot of getHomeSlots(state, floor)) {
          assert.equal(overlaps(stairs.reserved, getHouseFootprint({floor,slot})), false, `home${floor}:${slot} stays out of the stairwell`);
        }
        for (const slot of getFloorSlots(state, floor)) {
          const [u,v] = SETTLEMENT_POSITIONS[slot % 16];
          assert.equal(overlaps(stairs.reserved, {left:u-65,right:u+65,top:v-65,bottom:v+65}), false, `facility${slot} stays out of the stairwell`);
        }
        if (floor === 1) for (const [u,v] of FARM_POSITIONS.slice(0, level * 3)) {
          assert.equal(overlaps(stairs.reserved, {left:u,right:u+69,top:v,bottom:v+68}), false, `Lv${level} farm stays out of the stairwell`);
        }
      }
    }
  }
});

test('fresh players can move home for free and the home and facility previews share occupancy', () => {
  const state = funded(), before = structuredClone(state), moved = moveHome(state, { floor: 1, slot: 4 });
  assert.equal(moved.ok, true); assert.deepEqual(moved.state.resources, state.resources); assert.deepEqual(state, before);
  assert.equal(isFacilitySlotAvailable(moved.state, 1), false); assert.strictEqual(buildFacility(moved.state, 'kitchen', 1).state, moved.state);
  const back = moveHome(moved.state, { floor: 1, slot: 0 }); assert.equal(back.ok, true);
  const facility = buildFacility(back.state, 'kitchen', 1); assert.equal(facility.ok, true);
  assert.equal(isHomeSlotAvailable(facility.state, { floor: 1, slot: 4 }), false);
  assert.strictEqual(moveHome(facility.state, { floor: 1, slot: 4 }).state, facility.state);
  assert.strictEqual(moveHome(state, { floor: 2, slot: 0 }).state, state);
  assert.strictEqual(moveHome(state, { floor: 1, slot: 99 }).state, state);
});

test('upper facilities start at ID17 while legacy IDs, slots and allocation remain readable', () => {
  let state = paidFloors(4, 2); state = buildFacility(state, 'waterworks', 0).state;
  const before = structuredClone(state); const built = buildFacility(state, 'petHouse', 16);
  assert.equal(built.ok, true); state = built.state;
  assert.deepEqual(state.settlement, before.settlement);
  assert.equal(state.truckLayout!.upperBuildings[0].id, 17); assert.equal(state.truckLayout!.nextBuildingId, 18);
  assert.deepEqual(getSettlement(state).buildings.map(building => [building.id, building.slot]), [[1,0],[17,16]]);
  assert.equal(validateSettlement(state.settlement, state), true); assert.equal(validateTruckLayout(state.truckLayout, state), true);
  const copied = getSettlement(state); copied.buildings[0].slot = 47; copied.buildings[1].level = 5;
  assert.deepEqual(state.settlement, before.settlement); assert.equal(state.truckLayout!.upperBuildings[0].level, 1);
  const same = buildFacility(state, 'waterworks', 16); assert.equal(same.ok, false); assert.strictEqual(same.state, state);
});

test('moving producing legacy and upper buildings across floors preserves clocks and awards exactly once', () => {
  let state = paidFloors(7, 3); state = buildFacility(state, 'waterworks', 0).state;
  state = upgradeFacility(state, 1).state; state = startProduction(state, 1).state;
  const base = structuredClone(state), job = state.settlement!.buildings[0];
  const moved = moveFacility(state, 1, 32); assert.equal(moved.ok, true); state = moved.state;
  assert.deepEqual(state.settlement!.buildings[0], job); assert.deepEqual(base.resources, state.resources);
  assert.equal(getSettlement(state).buildings[0].slot, 32);
  state = buildFacility(state, 'kitchen', 16).state; state = startProduction(state, 17).state;
  const upperJob = structuredClone(state.truckLayout!.upperBuildings[0]);
  const movedUpper = moveFacility(state, 17, 0); assert.equal(movedUpper.ok, true); state = movedUpper.state;
  assert.deepEqual(state.truckLayout!.upperBuildings[0], { ...upperJob, slot: 0 });
  assert.equal(validateSettlement(state.settlement, state), true); assert.equal(validateTruckLayout(state.truckLayout, state), true);
  state = advanceTime(state, Math.max(job.readyAt!, upperJob.readyAt!) - state.totalMinutes);
  const before = structuredClone(state.resources);
  state = collectProduction(state, 1).state; state = collectProduction(state, 17).state;
  assert.equal(state.resources.water, before.water + 8); assert.equal(state.resources.food, before.food + 5);
  assert.strictEqual(collectProduction(state, 17).state, state); assert.strictEqual(collectProduction(state, 1).state, state);
});

test('vacated first-floor space can be rebuilt without corrupting a legacy shadow slot', () => {
  let state = paidFloors(4, 2); state = buildFacility(state, 'waterworks', 0).state;
  state = moveFacility(state, 1, 16).state; state = buildFacility(state, 'kitchen', 0).state;
  assert.deepEqual(getLegacySettlement(state).buildings.map(building => [building.id,building.slot]), [[1,0],[2,1]]);
  assert.deepEqual(getSettlement(state).buildings.map(building => [building.id,building.slot]), [[1,16],[2,0]]);
  state = moveFacility(state, 1, 1).state;
  assert.deepEqual(getSettlement(state).buildings.map(building => [building.id,building.slot]), [[1,1],[2,0]]);
  assert.equal(validateTruckLayout(state.truckLayout, state), true); assert.equal(validateSettlement(state.settlement, state), true);
  const target = storage(); assert.equal(saveGame(state, target), true); assert.deepEqual(loadGame(target)!.truckLayout, state.truckLayout);
});

test('all 48 paid places retain collision-free IDs and survive save/load at maximum expansion', () => {
  let state = paidFloors(8, 3);
  for (const floor of [1,2,3] as const) for (const slot of getFloorSlots(state, floor)) {
    const built = buildFacility(state, 'waterworks', slot); assert.equal(built.ok, true, `slot${slot}: ${built.message}`); state = built.state;
  }
  const buildings = getSettlement(state).buildings;
  assert.equal(buildings.length, 48); assert.equal(new Set(buildings.map(building => building.id)).size, 48);
  assert.equal(state.settlement!.buildings.length, 16); assert.equal(state.settlement!.nextBuildingId, 17);
  assert.equal(state.truckLayout!.upperBuildings.length, 32); assert.equal(state.truckLayout!.nextBuildingId, 49);
  const target = storage(); assert.equal(saveGame(state, target), true); assert.deepEqual(getSettlement(loadGame(target)!), getSettlement(state));
});

test('relocating one of 32 upper facilities leaves a paid reusable upper slot and preserves its running batch', () => {
  let state = paidFloors(8, 3);
  const target = storage();
  const roundtrip = () => {
    assert.equal(saveGame(state, target), true);
    const loaded = loadGame(target)!; assert.ok(loaded);
    assert.deepEqual(loaded.truckLayout, state.truckLayout); assert.deepEqual(loaded.settlement, state.settlement);
    state = loaded;
  };
  for (let slot = 16; slot < 48; slot++) {
    const built = buildFacility(state, 'waterworks', slot); assert.equal(built.ok, true, built.message); state = built.state;
  }
  for (let level = 1; level < 3; level++) {
    const upgraded = upgradeFacility(state, 17); assert.equal(upgraded.ok, true, upgraded.message); state = upgraded.state;
  }
  const producing = startProduction(state, 17); assert.equal(producing.ok, true, producing.message); state = producing.state;
  const relocated = moveFacility(state, 17, 0); assert.equal(relocated.ok, true, relocated.message); state = relocated.state; roundtrip();
  const before = structuredClone(state), upper = structuredClone(state.truckLayout!.upperBuildings);
  const rebuilt = buildFacility(state, 'waterworks', 16); assert.equal(rebuilt.ok, true, rebuilt.message);
  assert.deepEqual(state, before); state = rebuilt.state;
  assert.equal(state.resources.wood, before.resources.wood - 12); assert.equal(state.resources.scrap, before.resources.scrap - 4);
  assert.deepEqual(state.truckLayout!.upperBuildings, upper); assert.equal(state.truckLayout!.nextBuildingId, 49);
  assert.deepEqual(state.settlement!.buildings.map(building => [building.id, building.slot]), [[1,0]]);
  assert.deepEqual(state.truckLayout!.placements, [{ id: 1, slot: 16 }]);
  assert.deepEqual(getSettlement(state).buildings.find(building => building.id === 17), upper[0]); roundtrip();
  for (let slot = 1; slot < 16; slot++) {
    const built = buildFacility(state, 'waterworks', slot); assert.equal(built.ok, true, built.message); state = built.state; roundtrip();
  }
  const buildings = getSettlement(state).buildings;
  assert.equal(buildings.length, 48); assert.deepEqual(buildings.map(building => building.id).sort((a,b) => a-b), Array.from({length:48}, (_,i) => i+1));
  assert.deepEqual(buildings.map(building => building.slot).sort((a,b) => a-b), Array.from({length:48}, (_,i) => i));
  assert.equal(state.settlement!.nextBuildingId, 17); assert.deepEqual(state.truckLayout!.upperBuildings, upper);
  const full = structuredClone(state), rejected = buildFacility(state, 'kitchen', 16);
  assert.equal(rejected.ok, false); assert.strictEqual(rejected.state, state); assert.deepEqual(state, full);
});

test('facilities relocated into newly unlocked first-floor slots cannot exhaust IDs before all 48 places are built', () => {
  let state = paidFloors(4, 2);
  for (const slot of [...Array.from({length:8}, (_,i) => i), ...Array.from({length:8}, (_,i) => i+16)]) {
    const built = buildFacility(state, 'waterworks', slot); assert.equal(built.ok, true, built.message); state = built.state;
  }
  while (state.deckLevel < 8) {
    if (state.energy < 15) state = performAction(state, 'rest').state;
    const expanded = performAction(state, 'expand'); assert.equal(expanded.ok, true, expanded.message); state = expanded.state;
  }
  const third = buildTruckFloor(state); assert.equal(third.ok, true, third.message); state = third.state;
  for (let id = 17; id < 25; id++) {
    const moved = moveFacility(state, id, id-9); assert.equal(moved.ok, true, moved.message); state = moved.state;
  }
  const target = storage();
  const roundtrip = () => {
    assert.equal(saveGame(state, target), true);
    const loaded = loadGame(target)!; assert.ok(loaded); assert.deepEqual(getSettlement(loaded), getSettlement(state));
    assert.deepEqual(loaded.truckLayout, state.truckLayout); assert.deepEqual(loaded.settlement, state.settlement); state = loaded;
  };
  for (let slot = 16; slot < 40; slot++) {
    const built = buildFacility(state, 'waterworks', slot); assert.equal(built.ok, true, built.message); state = built.state; roundtrip();
  }
  assert.equal(getSettlement(state).buildings.length, 40); assert.equal(state.settlement!.buildings.length, 8);
  const before = structuredClone(state), upper = structuredClone(state.truckLayout!.upperBuildings);
  const fortyFirst = buildFacility(state, 'waterworks', 40); assert.equal(fortyFirst.ok, true, fortyFirst.message); assert.deepEqual(state, before); state = fortyFirst.state;
  assert.deepEqual(state.truckLayout!.upperBuildings, upper); assert.equal(state.truckLayout!.nextBuildingId, 49);
  assert.deepEqual(state.truckLayout!.placements, [{id:9,slot:40}]);
  assert.equal(state.resources.wood, before.resources.wood - 12); assert.equal(state.resources.scrap, before.resources.scrap - 4); roundtrip();
  for (let slot = 41; slot < 48; slot++) {
    const built = buildFacility(state, 'waterworks', slot); assert.equal(built.ok, true, built.message); state = built.state; roundtrip();
  }
  const buildings = getSettlement(state).buildings;
  assert.equal(buildings.length, 48); assert.equal(new Set(buildings.map(building => building.id)).size, 48);
  assert.deepEqual(buildings.map(building => building.slot).sort((a,b) => a-b), Array.from({length:48}, (_,i) => i));
  assert.equal(state.settlement!.buildings.length, 16); assert.equal(state.settlement!.nextBuildingId, 17);
  assert.deepEqual(state.truckLayout!.upperBuildings, upper); assert.equal(state.truckLayout!.nextBuildingId, 49);
});

test('upper Lv5 achievements and battle bonuses survive replacement without invalidating legacy history', () => {
  let state = paidFloors(7, 3); state = buildFacility(state, 'petHouse', 16).state; state = buildFacility(state, 'watchtower', 32).state;
  for (let level = 1; level < 5; level++) { state = upgradeFacility(state, 17).state; state = upgradeFacility(state, 18).state; }
  assert.deepEqual(getUnitBattleBonuses(state), { attackMultiplier: 1.2, enemyDamageMultiplier: .85 });
  assert.equal(getUpgradedFacilityRecord(state), 2); assert.equal(getFacilityHistory(state).highestFacilityLevel, 5);
  assert.deepEqual(state.facilityHistory?.upgradedFacilityIds, []); assert.equal(validateFacilityHistory(state.facilityHistory, state), true);
  const replaced = replaceFacility(state, 17, 'waterworks'); assert.equal(replaced.ok, true); state = replaced.state;
  assert.equal(getFacilityHistory(state).highestFacilityLevel, 5); assert.equal(getUpgradedFacilityRecord(state), 2);
  assert.equal(getUnitBattleBonuses(state).attackMultiplier, 1);
  const target = storage(); assert.equal(saveGame(state, target), true); assert.deepEqual(loadGame(target)!.truckLayout, state.truckLayout);
});

test('time, resting, quest rewards and deliveries detach every sidecar record without merging it into legacy data', () => {
  let state = paidFloors(4, 2); state = buildFacility(state, 'petHouse', 16).state;
  state = upgradeFacility(state, 17).state; state = moveHome(state, { floor: 2, slot: 0 }).state;
  state = performAction(state, 'gather').state;
  const before = structuredClone(state);
  const results = [tick(state, .2), performAction(state, 'rest').state,
    claimGrowthQuest(state, 'road-supplies').state, fulfillVillageOrder(state, getVillageOrder(state).id).state];
  for (const next of results) {
    assert.notStrictEqual(next, state); assert.deepEqual(next.truckLayout, state.truckLayout);
    assert.deepEqual(next.settlement, state.settlement); assert.notStrictEqual(next.truckLayout, state.truckLayout);
    next.truckLayout!.home.slot = 4; next.truckLayout!.upperBuildings[0].level = 1;
    next.truckLayout!.facilityHistory!.upgradedFacilityIds.length = 0;
    assert.deepEqual(state, before);
  }
});

test('malformed floors, duplicates, locked slots and occupied home reject save atomically', () => {
  let state = paidFloors(4, 2); state = buildFacility(state, 'waterworks', 16).state;
  const target = storage(); assert.equal(saveGame(state, target), true);
  const invalids = [
    { ...state.truckLayout!, floors: 3 },
    { ...state.truckLayout!, home: { floor: 1, slot: 99 } },
    { ...state.truckLayout!, upperBuildings: [{ ...state.truckLayout!.upperBuildings[0], slot: 31 }] },
    { ...state.truckLayout!, placements: [{ id: 1, slot: 17 }] },
    { ...state.truckLayout!, upperBuildings: [{ ...state.truckLayout!.upperBuildings[0], readyAt: Infinity, startedAt: 0 }] },
    { ...state.truckLayout!, facilityHistory: { builtTypes: ['waterworks'], upgradedFacilityIds: [1] } },
  ];
  for (const layout of invalids) {
    assert.equal(saveGame({ ...state, truckLayout: layout as GameState['truckLayout'] }, target), false);
    assert.deepEqual(loadGame(target)!.truckLayout, state.truckLayout);
  }
  state = buildFacility(state, 'kitchen', 1).state;
  const occupied = { ...state.truckLayout!, home: { floor: 1 as const, slot: 4 } };
  assert.equal(saveGame({ ...state, truckLayout: occupied }, target), false);
});
