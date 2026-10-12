import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { createGame, type GameState } from '../src/game';
import { GAME_SPEED_MULTIPLIER } from '../src/game-speed';
import { buildFacility, getSettlement, moveFacility, moveHome, startProduction } from '../src/settlement';
import { actorIntersectsPlacement, planPlacementPetRelocations } from '../src/scene-placement';
import { blocksActorStep, createNavigationWorld, defaultHeroLocation, groundLocation, projectDeckPoint,
  HERO_BODY_RADIUS, type NavigationActor, type NavigationLocation, type NavigationWorld } from '../src/scene-navigation';
import type { PetPatrolState } from '../src/scene-patrol';
import type { TruckFloor } from '../src/truck-layout';
import type { UnitId } from '../src/units';

type PlacementScene = {
  state: GameState; heroLocation: NavigationLocation; activeFloor: TruckFloor; reducedMotion: boolean;
  canvas: { dataset: Record<string, string> }; petMotion: Map<UnitId, PetPatrolState>; petYields: Map<UnitId, unknown>;
  setState(state: GameState): void; ensurePets(): void; advancePets(delta: number): void;
  canPlaceHome(floor: TruckFloor, slot: number): boolean; canPlaceFacility(slot: number): boolean;
  relocatePetsForPlacement(state: GameState): boolean; physicalActors(): NavigationActor[];
  navigationWorld(radius?: number, actors?: NavigationActor[]): NavigationWorld;
};
const copy = <T>(value: T): T => structuredClone(value);
const distance = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0] - b[0], a[1] - b[1]);

test('actual Scene makes room for placed buildings without changing ordinary physical bodies', async t => {
  // Only image loading is stubbed. Actual Scene placement, navigation,
  // patrol, domain costs and save records run unchanged; painting is not invoked.
  const priorImage = Object.getOwnPropertyDescriptor(globalThis, 'Image');
  Object.defineProperty(globalThis, 'Image', { value: class {}, configurable: true, writable: true });
  const hook = registerHooks({ load(url, context, next) {
    if (/\.(png|webp|jpg|svg)$/.test(url)) return { format: 'module', source: `export default ${JSON.stringify(url)};`, shortCircuit: true };
    return next(url, context);
  } });
  let Scene: typeof import('../src/scene').Scene;
  try { ({ Scene } = await import('../src/scene')); } finally {
    hook.deregister();
    if (priorImage) Object.defineProperty(globalThis, 'Image', priorImage); else Reflect.deleteProperty(globalThis, 'Image');
  }
  function freshScene(state = createGame()): PlacementScene {
    const scene = Object.assign(Object.create(Scene.prototype), { state, heroLocation: defaultHeroLocation(), action: null,
      activeFloor: 1, reducedMotion: true, petMotion: new Map(), petYields: new Map(), placementRelocationSequence: 0,
      canvas: { dataset: {} }, selectedPlotId: null, selectedFacilityId: null }) as PlacementScene;
    scene.ensurePets();
    assert.equal(scene.petMotion.size, 2);
    return scene;
  }
  function fundedState(level = 2) {
    const state = createGame(); state.deckLevel = level; state.resources.wood = 200; state.resources.scrap = 100;
    state.companions.dog.xp = 25; state.companions.cat.xp = 40;
    return state;
  }
  function assertFullBodiesClear(scene: PlacementScene) {
    const actors = scene.physicalActors();
    const movedIds = new Set(receipt(scene).moved.map(pet => pet.id));
    for (const pet of scene.petMotion.values()) {
      // An untouched resident keeps its actual accepted feet. New landings add
      // 2px to the original full-body clearance rather than moving bystanders.
      const world = scene.navigationWorld(pet.radius + (movedIds.has(pet.id) ? 2 : 0), actors.filter(actor => actor.id !== pet.id));
      assert.ok(groundLocation(world, pet.location.point, pet.location.floor ?? 1), `${pet.id} clears all buildings, deck edges and complete other bodies`);
      assert.equal(pet.radius, pet.id === 'dog' ? 25.740000000000002 : 24.82);
    }
  }
  function receipt(scene: PlacementScene) {
    return JSON.parse(scene.canvas.dataset.placementPetRelocation) as { sequence: number; moved: { id: UnitId; from: NavigationLocation; to: NavigationLocation; radius: number }[] };
  }

  await t.test('the real fresh-game dog and cat can occupy slot 0 while one paid building lands safely', () => {
    const scene = freshScene(), before = copy(scene.state), hero = copy(scene.heroLocation), pets = copy([...scene.petMotion.values()]);
    const result = buildFacility(scene.state, 'waterworks', 0); assert.equal(result.ok, true);
    const obstacle = createNavigationWorld(1, 3, [0]).obstacles.find(value => value.kind === 'facility')!;
    assert.ok(pets.every(pet => actorIntersectsPlacement({ id: pet.id, radius: pet.radius, location: pet.location }, [obstacle])),
      'this fixture uses the real initial patrol spawns, rather than a synthetic pet overlap');
    assert.equal(scene.canPlaceFacility(0), true, 'pets never mark an otherwise valid placement as unavailable');
    // Retain gait distance and direction; jumping must not pretend to walk.
    for (const pet of scene.petMotion.values()) { pet.distance = 123; pet.turnRemaining = .2; pet.retryRemaining = .45; pet.blockedReason = 'actor:hero'; scene.petYields.set(pet.id, {}); }
    assert.equal(scene.relocatePetsForPlacement(result.state), true);
    assert.deepEqual(scene.state, before, 'transaction preparation never publishes or mutates either save');
    assert.deepEqual(scene.heroLocation, hero);
    scene.setState(result.state);
    const moved = receipt(scene).moved; assert.equal(receipt(scene).sequence, 1);
    assert.deepEqual(new Set(moved.map(pet => pet.id)), new Set(['dog', 'cat']));
    assertFullBodiesClear(scene);
    for (const pet of scene.petMotion.values()) {
      const original = pets.find(value => value.id === pet.id)!;
      assert.equal(pet.location.floor, 1); assert.ok(distance(pet.location.point, original.location.point) > pet.radius);
      assert.ok(distance(pet.location.point, original.location.point) < 180, 'a nearby clear landing is preferred to a fixed distant spawn');
      assert.equal(pet.distance, 123); assert.equal(pet.facing, original.facing); assert.equal(pet.facingBlend, pet.facing);
      assert.equal(pet.route, null); assert.equal(pet.elapsed, 0); assert.equal(pet.speed, 0); assert.equal(pet.blend, 0);
      assert.equal(pet.turnRemaining, 0); assert.equal(pet.retryRemaining, 0); assert.equal(pet.blockedReason, null);
      assert.equal(scene.petYields.has(pet.id), false);
    }
    assert.equal(scene.state.resources.wood, before.resources.wood - 12); assert.equal(scene.state.resources.scrap, before.resources.scrap - 4);
    assert.deepEqual(scene.state.companions, before.companions); assert.equal(getSettlement(scene.state).buildings.length, 1);
  });

  await t.test('only the intersecting cat jumps; ordinary 2× patrol resumes with original collision checks', () => {
    const scene = freshScene(fundedState()), dog = scene.petMotion.get('dog')!, cat = scene.petMotion.get('cat')!;
    const beforeDog = copy(dog), beforeHero = copy(scene.heroLocation), beforeSave = copy(scene.state);
    const result = buildFacility(scene.state, 'waterworks', 0); assert.equal(result.ok, true);
    assert.equal(scene.relocatePetsForPlacement(result.state), true);
    assert.deepEqual(receipt(scene).moved.map(value => value.id), ['cat']); assert.deepEqual(dog, beforeDog);
    assert.deepEqual(scene.heroLocation, beforeHero); assert.deepEqual(scene.state, beforeSave);
    scene.setState(result.state); assertFullBodiesClear(scene); scene.reducedMotion = false;
    let travel = 0;
    for (let frame = 0; frame < 200; frame++) {
      const actors = copy(scene.physicalActors()), before = copy([...scene.petMotion.values()]); scene.advancePets(.032);
      for (const prior of before) {
        const current = scene.petMotion.get(prior.id)!, moved = distance(prior.location.point, current.location.point);
        assert.ok(moved <= 44 * .032 + 1e-6, 'teleportation cannot change normal patrol speed');
        assert.equal(blocksActorStep(prior.location, current.location, current.radius, actors.filter(actor => actor.id !== prior.id)), undefined);
        assert.ok(Math.abs(current.distance - prior.distance - moved) < 1e-6);
        actors.find(actor => actor.id === prior.id)!.location = copy(current.location);
        if (prior.id === cat.id) travel += moved;
      }
    }
    assert.ok(travel > 15, 'the relocated cat leaves its brief landing pause and actually patrols');
    assert.equal(GAME_SPEED_MULTIPLIER, 2); assert.deepEqual(scene.heroLocation, beforeHero);
    assert.deepEqual(scene.state.companions, beforeSave.companions);
    assert.equal(receipt(scene).sequence, 1, 'routine patrol cannot trigger further jumps');
  });

  await t.test('an overlapping hero still rejects the complete placement transaction', () => {
    const scene = freshScene(), result = buildFacility(scene.state, 'waterworks', 0); assert.equal(result.ok, true);
    scene.heroLocation = { surface: 'deck', floor: 1, point: projectDeckPoint([-42, -106]) };
    const beforePets = copy([...scene.petMotion.values()]), beforeSave = copy(scene.state), beforeHero = copy(scene.heroLocation);
    assert.equal(scene.canPlaceFacility(0), false); assert.equal(scene.relocatePetsForPlacement(result.state), false);
    assert.deepEqual([...scene.petMotion.values()], beforePets); assert.deepEqual(scene.state, beforeSave); assert.deepEqual(scene.heroLocation, beforeHero);
    assert.equal(scene.canvas.dataset.placementPetRelocation, undefined);
  });

  await t.test('a moved house clears its new footprint while retaining the companion progress and untouched cat', () => {
    const scene = freshScene(fundedState()), dog = scene.petMotion.get('dog')!, cat = scene.petMotion.get('cat')!;
    dog.location = { surface: 'deck', floor: 1, point: projectDeckPoint([-206, -274]) };
    assert.ok(groundLocation(scene.navigationWorld(dog.radius, []), dog.location.point));
    dog.distance = 314; const beforeDog = copy(dog), beforeCat = copy(cat), beforeHero = copy(scene.heroLocation), beforeSave = copy(scene.state);
    const result = moveHome(scene.state, { floor: 1, slot: 1 }); assert.equal(result.ok, true);
    assert.equal(scene.canPlaceHome(1, 1), true); assert.equal(scene.relocatePetsForPlacement(result.state), true);
    scene.setState(result.state);
    assert.deepEqual(receipt(scene).moved.map(value => value.id), ['dog']); assert.deepEqual(cat, beforeCat);
    assert.equal(dog.distance, beforeDog.distance); assertFullBodiesClear(scene); assert.deepEqual(scene.heroLocation, beforeHero);
    assert.deepEqual(scene.state.companions, beforeSave.companions); assert.deepEqual(scene.state.resources, beforeSave.resources);
    assert.deepEqual(scene.state.truckLayout!.home, { floor: 1, slot: 1 });
  });

  await t.test('relocating a producing facility preserves its exact batch clocks and clears only the target pet', () => {
    const built = buildFacility(fundedState(), 'waterworks', 0); assert.equal(built.ok, true);
    const started = startProduction(built.state, 1); assert.equal(started.ok, true);
    const scene = freshScene(started.state), dog = scene.petMotion.get('dog')!, cat = scene.petMotion.get('cat')!;
    dog.location = { surface: 'deck', floor: 1, point: projectDeckPoint([-42, -278]) };
    assert.ok(groundLocation(scene.navigationWorld(dog.radius, []), dog.location.point));
    const beforeCat = copy(cat), beforeBuilding = copy(getSettlement(scene.state).buildings[0]), beforeSave = copy(scene.state);
    const moved = moveFacility(scene.state, 1, 2); assert.equal(moved.ok, true);
    assert.equal(scene.canPlaceFacility(2), true); assert.equal(scene.relocatePetsForPlacement(moved.state), true); scene.setState(moved.state);
    assert.deepEqual(receipt(scene).moved.map(value => value.id), ['dog']); assert.deepEqual(cat, beforeCat); assertFullBodiesClear(scene);
    assert.deepEqual(getSettlement(scene.state).buildings[0], { ...beforeBuilding, slot: 2 });
    assert.deepEqual(scene.state.resources, beforeSave.resources); assert.deepEqual(scene.state.companions, beforeSave.companions);
  });

  await t.test('floor-specific footprints never jump a pet on a different built deck', () => {
    const state = fundedState(4); state.truckLayout = { version: 1, floors: 2, home: { floor: 1, slot: 0 }, placements: [], upperBuildings: [], nextBuildingId: 17 };
    const scene = freshScene(state), dog = scene.petMotion.get('dog')!, cat = scene.petMotion.get('cat')!;
    dog.location = { surface: 'deck', floor: 1, point: projectDeckPoint([-42, -106]) };
    cat.location = { surface: 'deck', floor: 2, point: projectDeckPoint([-42, -106], 2) };
    const beforeCat = copy(cat), beforeHero = copy(scene.heroLocation);
    const result = buildFacility(scene.state, 'waterworks', 0); assert.equal(result.ok, true);
    assert.equal(scene.relocatePetsForPlacement(result.state), true); scene.setState(result.state);
    assert.deepEqual(receipt(scene).moved.map(value => value.id), ['dog']); assert.deepEqual(cat, beforeCat);
    assert.equal(dog.location.floor, 1, 'the intersecting pet uses the same deck when it has clear space');
    assertFullBodiesClear(scene); assert.deepEqual(scene.heroLocation, beforeHero);
  });

  await t.test('a downed large companion is moved safely from an upper-floor placement without healing or losing experience', () => {
    const state = fundedState(4); state.truckLayout = { version: 1, floors: 2, home: { floor: 1, slot: 0 }, placements: [], upperBuildings: [], nextBuildingId: 17 };
    const scene = freshScene(state);
    state.companionTeam = ['dog', 'cat', 'boar']; state.maxCompanionTeamSize = 3;
    state.animalReserve!.boar = { health: 0, xp: 123 }; scene.ensurePets();
    const boar = scene.petMotion.get('boar')!; assert.ok(boar);
    boar.location = { surface: 'deck', floor: 2, point: projectDeckPoint([-42, -106], 2) };
    const beforeDog = copy(scene.petMotion.get('dog')), beforeCat = copy(scene.petMotion.get('cat')),
      beforeHero = copy(scene.heroLocation), beforeSave = copy(scene.state);
    const result = buildFacility(state, 'waterworks', 16); assert.equal(result.ok, true);
    assert.equal(scene.canPlaceFacility(16), true); assert.equal(scene.relocatePetsForPlacement(result.state), true); scene.setState(result.state);
    assert.deepEqual(receipt(scene).moved.map(value => value.id), ['boar']); assert.equal(boar.location.floor, 2);
    assert.equal(boar.radius, 44 * .7);
    assert.ok(groundLocation(scene.navigationWorld(boar.radius + 2, scene.physicalActors().filter(actor => actor.id !== 'boar')), boar.location.point, 2));
    assert.deepEqual(scene.petMotion.get('dog'), beforeDog); assert.deepEqual(scene.petMotion.get('cat'), beforeCat);
    assert.deepEqual(scene.heroLocation, beforeHero); assert.deepEqual(scene.state.animalReserve, beforeSave.animalReserve);
    assert.deepEqual(scene.state.companions, beforeSave.companions); assert.equal(scene.state.animalReserve!.boar.health, 0);
  });
});

test('placement planner refuses a footprint with no safe deck landing instead of using the road or shrinking a body', () => {
  // An explicitly declared pathological geometry exercises the all-or-nothing
  // fallback. It uses actual NavigationWorld ground checks, not an accepted-position stub.
  const actor: NavigationActor = { id: 'dog', radius: 25.74, location: { surface: 'deck', floor: 1, point: projectDeckPoint([-42, -106]) } };
  const actors = [actor, { id: 'hero', radius: HERO_BODY_RADIUS, location: defaultHeroLocation() }], before = copy(actors);
  const footprint = createNavigationWorld(1, 3, [0]).obstacles.find(value => value.kind === 'facility')!;
  const plan = planPlacementPetRelocations([footprint], actors, (radius, reserved) => {
    const world = createNavigationWorld(1, 3, [0], { radius, actors: reserved });
    const bounds = world.floors[0].outer;
    world.obstacles.push({ surface: 'deck', floor: 1, kind: 'declared-fully-occupied-deck', bounds: { ...bounds } });
    return world;
  });
  assert.equal(plan, undefined); assert.deepEqual(actors, before); assert.equal(actor.radius, 25.74);
});
