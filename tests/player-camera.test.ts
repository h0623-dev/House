import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { createGame, type GameState } from '../src/game.ts';
import { buildTruckFloor } from '../src/settlement.ts';
import { frameHomeOverview, getHomeOverviewBounds } from '../src/player-camera.ts';
import { createNavigationWorld, defaultHeroLocation, getRoadBounds, planNavigation, sampleNavigation, type NavigationLocation, type NavigationPath } from '../src/scene-navigation.ts';
import { getFloorBounds, projectTruckPoint, FLOOR_HEIGHT, type TruckFloor } from '../src/truck-layout.ts';
import { getPetPassageGeometry } from '../src/pet-passage.ts';
import { OUTDOOR_SITES } from '../src/outdoor-sites.ts';

const usableViewports = [[344, 390], [360, 440], [390, 470], [844, 112]] as const;
function expanded(level: number) {
  let state = createGame(); state.deckLevel = level;
  if (level >= 4) {
    state.resources.wood = state.resources.scrap = 10_000;
    state = buildTruckFloor(state).state;
    if (level >= 7) state = buildTruckFloor(state).state;
  }
  return state;
}
function inside(point: readonly number[], frame: ReturnType<typeof frameHomeOverview>, width: number, height: number) {
  const scale = Math.min(width / frame.width, height / frame.height);
  const x = width / 2 + (point[0] - frame.x) * scale, y = height / 2 + (point[1] - frame.y) * scale;
  assert.ok(x >= 15.999999 && x <= width - 15.999999 && y >= 15.999999 && y <= height - 15.999999,
    `complete map point ${point} stays between the HUDs at ${width}×${height}`);
}

test('the default first-floor view fits the complete truck, playable road, outdoor places and full animal passage', () => {
  for (const level of [1, 4, 8]) {
    const state = expanded(level), before = structuredClone(state), deck = getFloorBounds(level), road = getRoadBounds(level),
      bounds = getHomeOverviewBounds(state, 1), passage = getPetPassageGeometry(level),
      points = [[deck.left, deck.back], [deck.end, deck.back], [deck.end, deck.front], [deck.left, deck.front]]
        .map(point => projectTruckPoint(point));
    for (const x of [road.left, road.right]) for (const y of [road.top, road.bottom]) points.push([x, y - 81.92], [x, y]);
    for (const point of passage.points) points.push([point[0] - passage.width / 2, point[1] - passage.width / 2],
      [point[0] + passage.width / 2, point[1] + passage.width / 2]);
    for (const site of OUTDOOR_SITES) points.push(site.point, ...site.approaches, [site.point[0], site.point[1] - (site.id === 'grove' ? 178 : 105)]);
    const cabin = projectTruckPoint([deck.end + 95, (deck.back + deck.front) / 2], 1, -107);
    points.push([cabin[0] - 126, cabin[1] - 147], [cabin[0] + 134, cabin[1] + 61]);
    for (const [width, height] of usableViewports) {
      const frame = frameHomeOverview(bounds, width, height);
      assert.ok(Object.values(frame).every(Number.isFinite));
      for (const point of points) inside(point, frame, width, height);
    }
    assert.deepEqual(state, before, 'a camera fit cannot purchase land or rewrite player progress');
  }
});

test('upper-floor overview excludes the ground and other storeys while keeping the entire selected deck', () => {
  const state = expanded(8), second = getHomeOverviewBounds(state, 2), third = getHomeOverviewBounds(state, 3);
  assert.equal(third.left, second.left); assert.equal(third.right, second.right);
  assert.ok(Math.abs(third.top - second.top + FLOOR_HEIGHT) < 1e-9);
  assert.ok(Math.abs(third.bottom - second.bottom + FLOOR_HEIGHT) < 1e-9);
  assert.ok(third.bottom < getRoadBounds(state.deckLevel).top, 'the third-floor fit never includes the distant road');
  for (const floor of [2, 3] as const) {
    const bounds = getHomeOverviewBounds(state, floor), deck = getFloorBounds(state.deckLevel, floor);
    for (const [width, height] of usableViewports) {
      const frame = frameHomeOverview(bounds, width, height);
      for (const point of [[deck.left, deck.back], [deck.end, deck.back], [deck.end, deck.front], [deck.left, deck.front]])
        inside(projectTruckPoint(point, floor), frame, width, height);
    }
  }
});

test('ordinary real walking and human-ladder travel use the same complete-map frame', () => {
  const state = createGame(), world = createNavigationWorld(1, 3, []),
    route = planNavigation(world, defaultHeroLocation(), { surface: 'road', point: [490, 620] });
  assert.ok(route); assert.ok(route.climbSegments.length);
  const before = structuredClone(route), surfaces = new Set<string>(), bounds = getHomeOverviewBounds(state, 1);
  for (const [width, height] of usableViewports) {
    const frame = frameHomeOverview(bounds, width, height);
    for (let step = 0; step <= 100; step++) {
      const sample = sampleNavigation(route, route.motion.duration * step / 100); surfaces.add(sample.location.surface);
      inside(sample.point, frame, width, height); inside([sample.point[0], sample.point[1] - 81.92], frame, width, height);
      assert.deepEqual(frameHomeOverview(getHomeOverviewBounds(state, 1), width, height), frame,
        'a destination and the physical surface cannot zoom the map in or out');
    }
  }
  assert.ok(surfaces.has('deck') && surfaces.has('ladder') && surfaces.has('road'));
  assert.deepEqual(route, before, 'framing never changes an accepted physical route');
});

type CameraScene = {
  state: GameState; activeFloor: TruckFloor; heroLocation: NavigationLocation; freeWalk: null | { navigation: NavigationPath };
  action: null | { elapsed: number; walk: number; work: number; resolve(): void }; camera: { x: number; y: number; zoom: number };
  scale: number; mapPan: [number, number]; mapZoom: number; cameraMode: string; manualViewport: [number, number] | null;
  updateCamera(): void; publishGeometry(): void; setState(state: GameState): void; setMapZoom(zoom: number): void;
  resumePlayerCamera(): void; walkOntoRoad(): void; stopWalking(): void; resetMapView(): void; showVillageOverview(): void;
  setActiveFloor(floor: TruckFloor): void; playPetPassageGate(open: boolean): Promise<void>; clearPetPassageGateOperation(): void;
};
test('actual Scene retains deliberate zoom and pan through road commands and gate work, and only an explicit overview resets it', async () => {
  const globals: Record<string, unknown> = {
    window: { matchMedia: () => ({ matches: false }), addEventListener() {}, devicePixelRatio: 1 },
    document: { hidden: false, addEventListener() {}, querySelector: () => null },
    Image: class { complete = false; naturalWidth = 0; }, ResizeObserver: class { observe() {} },
    requestAnimationFrame: () => 1, cancelAnimationFrame: () => {},
    getComputedStyle: () => ({ getPropertyValue: (name: string) => name === '--world-safe-top' ? '40' : name === '--world-safe-bottom' ? '70' : '0' }),
  };
  const descriptors = Object.fromEntries(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
  const hook = registerHooks({ load(url, context, next) {
    if (/\.(png|webp|jpg|svg)$/.test(url)) return { format: 'module', source: `export default ${JSON.stringify(url)};`, shortCircuit: true };
    return next(url, context);
  } });
  let restorePainting: (() => void) | undefined;
  try {
    const { Scene } = await import('../src/scene.ts'); hook.deregister();
    const prototype = Scene.prototype as unknown as { render(): void }, original = prototype.render;
    prototype.render = () => {}; restorePainting = () => { prototype.render = original; };
    const canvas = { getContext: () => ({}), style: {}, dataset: {} as Record<string, string>, setAttribute() {}, addEventListener() {}, dispatchEvent() {},
      getBoundingClientRect: () => ({ width: 390, height: 580, left: 0, top: 0 }), hasPointerCapture: () => false };
    const scene = new Scene(canvas as unknown as HTMLCanvasElement, () => {}) as unknown as CameraScene;
    scene.setState(expanded(8)); scene.updateCamera(); scene.publishGeometry();
    const initial = structuredClone(scene.camera), initialScale = scene.scale;
    assert.equal(scene.cameraMode, 'overview'); assert.equal(JSON.parse(canvas.dataset.sceneGeometry).playerFollowing, false);
    const retainedFeet = structuredClone(scene.heroLocation), before = structuredClone(scene.state);
    scene.walkOntoRoad(); assert.ok(scene.freeWalk); scene.updateCamera();
    assert.deepEqual(scene.camera, initial); assert.equal(scene.scale, initialScale);
    scene.stopWalking(); scene.setMapZoom(1.5); scene.updateCamera();
    // A deliberate native-camera equivalent pan is retained, including its
    // frozen base viewport. The tested calls are the real HUD/gate APIs.
    scene.mapPan = [27, -18]; scene.camera.x += 27; scene.camera.y -= 18;
    const manual = structuredClone(scene.camera), manualViewport = structuredClone(scene.manualViewport), manualScale = scene.scale;
    assert.equal(scene.cameraMode, 'manual'); scene.walkOntoRoad(); scene.updateCamera(); scene.resumePlayerCamera(); scene.updateCamera();
    assert.deepEqual(scene.camera, manual); assert.deepEqual(scene.manualViewport, manualViewport);
    assert.equal(scene.scale, manualScale); assert.equal(scene.mapZoom, 1.5); assert.deepEqual(scene.mapPan, [27, -18]);
    scene.stopWalking(); const gate = scene.playPetPassageGate(true);
    assert.ok(scene.action); scene.action.elapsed = scene.action.walk / 2; scene.updateCamera();
    assert.deepEqual(scene.camera, manual); assert.equal(scene.scale, manualScale);
    scene.action.elapsed = scene.action.walk + scene.action.work / 2; scene.updateCamera();
    assert.deepEqual(scene.camera, manual); assert.equal(scene.scale, manualScale);
    scene.action.resolve(); await gate; scene.action = null; scene.clearPetPassageGateOperation();
    scene.showVillageOverview(); scene.updateCamera(); scene.publishGeometry();
    assert.equal(scene.cameraMode, 'overview'); assert.equal(scene.mapZoom, 1); assert.equal(scene.manualViewport, null);
    assert.deepEqual(scene.camera, initial); assert.equal(scene.scale, initialScale);
    assert.deepEqual(scene.heroLocation, retainedFeet); assert.deepEqual(scene.state, before);
    scene.setActiveFloor(3); scene.updateCamera(); scene.showVillageOverview(); scene.updateCamera();
    assert.equal(scene.activeFloor, 3, 'explicit overview preserves the chosen work floor instead of following the resident downstairs');
    assert.deepEqual(scene.heroLocation, retainedFeet); assert.deepEqual(scene.state, before);
  } finally {
    hook.deregister(); restorePainting?.();
    for (const [key, descriptor] of Object.entries(descriptors)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete (globalThis as unknown as Record<string, unknown>)[key];
    }
  }
});
