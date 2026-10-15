import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { createGame, type GameState } from '../src/game.ts';
import { buildTruckFloor } from '../src/settlement.ts';
import { frameHomeOverview, getHomeOverviewBounds } from '../src/player-camera.ts';
import { createNavigationWorld, defaultHeroLocation, getRoadBounds, planNavigation, sampleNavigation, type NavigationLocation, type NavigationPath } from '../src/scene-navigation.ts';
import { getFloorBounds, projectTruckPoint, FLOOR_HEIGHT, type TruckFloor } from '../src/truck-layout.ts';
import { getPetPassageGeometry } from '../src/pet-passage.ts';
import { GROUND_RESOURCE_NODES, GROUND_RESOURCE_ZONES, getGroundResourceNode, getGroundResourceZone, type GroundResourceId } from '../src/ground-resources.ts';
import { GROUND_REGIONS, getGroundRegion, type GroundRegionId } from '../src/ground-regions.ts';

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
    for (const node of GROUND_RESOURCE_NODES) points.push(node.point, ...node.approaches,
      [node.point[0], node.point[1] - (node.kind === 'tree' ? 146 * node.scale : 66 * node.scale)]);
    for (const zone of GROUND_RESOURCE_ZONES) points.push([zone.bounds.left,zone.bounds.top],[zone.bounds.right,zone.bounds.bottom]);
    for (const region of GROUND_REGIONS) points.push([region.bounds.left,region.bounds.top],[region.bounds.right,region.bounds.bottom]);
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
  assert.ok(third.bottom < getGroundRegion('grove')!.bounds.top, 'the third-floor fit never includes the distant southern road');
  assert.ok(third.bottom-third.top < getHomeOverviewBounds(state,1).bottom-getHomeOverviewBounds(state,1).top,
    'adding distant northern ground cannot enlarge the upper-floor camera to cover the whole world');
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
    document: { hidden: false, addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] },
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

test('actual landscape resource focus keeps tree and prop hits readable inside an 88-pixel safe strip', async () => {
  type GroundPaint = { id: GroundResourceId; x: number; y: number; hit: string | null;
    screenBounds: number[]; spriteBounds: number[]; hitBounds: number[] };
  type ResourceScene = CameraScene & {
    dx: number; dy: number; hits: unknown[]; groundResourcePaint: GroundPaint[];
    resourceFocus: { siteId: string; nodeId?: GroundResourceId; regionId?:GroundRegionId } | null;
    groundMarkerPaint: {nodeId:GroundResourceId;nodeIds:GroundResourceId[]}[];
    focusResourceArea(id: 'grove'): void; focusGroundResource(id: GroundResourceId): void;
    focusGroundRegion(id:GroundRegionId):void;
    playGroundResourceAction(id: GroundResourceId): Promise<void>; groundResources(): void;
    groundMarkers():void;
    pointerHits(x: number, y: number): { candidates: { kind: string; nodeId?: GroundResourceId }[] };
  };
  const globals: Record<string, unknown> = {
    window: { matchMedia: () => ({ matches: false }), addEventListener() {}, devicePixelRatio: 1 },
    document: { hidden: false, addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] },
    Image: class { complete = false; naturalWidth = 0; }, ResizeObserver: class { observe() {} },
    requestAnimationFrame: () => 1, cancelAnimationFrame: () => {},
    getComputedStyle: () => ({ getPropertyValue: (name: string) => name === '--world-safe-top' ? '150' : name === '--world-safe-bottom' ? '152' : '0' }),
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
    // Camera framing, the ground painter and its real hit polygons stay live;
    // only the browser shell and Canvas calls are replaced by this harness.
    const context = new Proxy({ globalAlpha: 1 }, { get: (target, key) => Reflect.has(target, key) ? Reflect.get(target, key) : () => {} });
    const canvas = { getContext: () => context, style: {}, dataset: {} as Record<string, string>, setAttribute() {}, addEventListener() {}, dispatchEvent() {},
      getBoundingClientRect: () => ({ width: 844, height: 390, left: 0, top: 0, right: 844, bottom: 390 }), hasPointerCapture: () => false };
    const scene = new Scene(canvas as unknown as HTMLCanvasElement, () => {}) as unknown as ResourceScene;
    scene.setState(createGame());
    function paintGround() {
      scene.updateCamera(); scene.hits = []; scene.groundResourcePaint = [];scene.groundMarkerPaint=[];
      scene.groundResources();scene.groundMarkers(); scene.publishGeometry();
    }
    function safeHit(id: GroundResourceId, minWidth: number, completeProp = false) {
      const row = scene.groundResourcePaint.find(row => row.id === id)!;
      assert.ok(row && row.hit === 'ground-resource');
      assert.ok((row.hitBounds[2] - row.hitBounds[0]) * scene.scale >= minWidth,
        `${id} retains a readable native Canvas target`);
      assert.ok(row.x >= 0 && row.x <= 844 && row.y >= 150 && row.y <= 238,
        `${id}'s painted tap point stays between the actual landscape HUDs`);
      assert.ok(scene.pointerHits(row.x, row.y).candidates.some(hit => hit.kind === 'ground-resource' && hit.nodeId === id),
        'the visible tap point resolves through the real Scene hit test');
      if (completeProp) assert.ok(row.screenBounds[0] >= 0 && row.screenBounds[2] <= 844
        && row.screenBounds[1] >= 150 && row.screenBounds[3] <= 238,
      'explicit node focus displays the complete selected prop inside the safe strip');
      return row;
    }
    paintGround();
    const overview = structuredClone(scene.camera), overviewScale = scene.scale,
      feet = structuredClone(scene.heroLocation), before = structuredClone(scene.state);
    assert.equal(JSON.parse(canvas.dataset.sceneGeometry).viewport.usableHeight, 88);
    assert.ok(overviewScale < .38, 'the complete-map overview remains independent of explicit resource magnification');
    scene.focusResourceArea('grove'); paintGround();
    const zone = getGroundResourceZone('grove')!;
    assert.ok(Math.abs(scene.scale - .38) < 1e-9);
    assert.equal(scene.camera.x, (zone.bounds.left + zone.bounds.right) / 2);
    assert.ok(Math.abs(scene.camera.y - (zone.bounds.top + 88 / .38 / 2 + 16 / .38)) < 1e-9,
      'a short area view starts at the forest entrance instead of hiding the first trees below a centered fit');
    const entranceY = scene.dy + zone.path[0][1] * scene.scale;
    assert.ok(entranceY >= 150 && entranceY <= 238);
    safeHit('tree-01', 40);
    const focused = structuredClone(scene.camera), focusedScale = scene.scale;
    scene.walkOntoRoad(); scene.updateCamera();
    assert.deepEqual(scene.camera, focused); assert.equal(scene.scale, focusedScale);
    scene.stopWalking();
    const gathering = scene.playGroundResourceAction('tree-01');
    assert.ok(scene.action);
    scene.action.elapsed = scene.action.walk / 2; scene.updateCamera();
    assert.deepEqual(scene.camera, focused); assert.equal(scene.scale, focusedScale);
    scene.action.elapsed = scene.action.walk + scene.action.work / 2; scene.updateCamera();
    assert.deepEqual(scene.camera, focused); assert.equal(scene.scale, focusedScale);
    scene.action.resolve(); await gathering; scene.action = null;
    scene.setMapZoom(1.25); scene.updateCamera();
    scene.mapPan = [24, 55]; scene.camera.x += 24; scene.camera.y += 55;
    const manual = structuredClone(scene.camera), manualScale = scene.scale;
    scene.walkOntoRoad(); scene.updateCamera(); scene.stopWalking();
    assert.equal(scene.cameraMode, 'manual'); assert.deepEqual(scene.camera, manual); assert.equal(scene.scale, manualScale);
    assert.deepEqual(scene.mapPan, [24, 55], 'panning can explore later trees without an automatic return to the entrance');
    for (const [id, minimumScale, hitWidth] of [['tree-16', .38, 40], ['seed-02', .6, 44]] as const) {
      scene.focusGroundResource(id); paintGround();
      const node = getGroundResourceNode(id)!, row = safeHit(id, hitWidth, true);
      assert.deepEqual(scene.resourceFocus, { siteId: node.siteId, nodeId: id });
      assert.ok(scene.scale >= minimumScale - 1e-9);
      assert.ok(Math.abs(scene.camera.x - (row.spriteBounds[0] + row.spriteBounds[2]) / 2) < 1e-9,
        'the selected camera centers asymmetric painted crowns without moving their trunk contact');
      assert.ok(Math.abs(scene.camera.y - (row.spriteBounds[1] + row.spriteBounds[3]) / 2) < 1e-9,
        'the selected node is centered on its full painted object');
    }
    scene.showVillageOverview(); scene.updateCamera(); scene.publishGeometry();
    assert.equal(scene.resourceFocus, null); assert.equal(scene.cameraMode, 'overview');
    assert.deepEqual(scene.camera, overview); assert.equal(scene.scale, overviewScale);
    assert.equal(scene.mapZoom, 1); assert.equal(scene.manualViewport, null);
    assert.deepEqual(scene.heroLocation, feet, 'resource framing never moves the retained actor feet');
    assert.deepEqual(scene.state, before, 'camera and hit rendering never alter resource inventory or saved progress');
    for(const regionId of ['west-grove','north-ruins','east-creek'] as const){
      const region=getGroundRegion(regionId)!,nodes=GROUND_RESOURCE_NODES.filter(node=>node.regionId===regionId),first=nodes[0];
      scene.focusGroundRegion(regionId);paintGround();
      assert.deepEqual(scene.resourceFocus,{siteId:first.siteId,regionId},
        'an explicit regional camera uses its physical place rather than the shared resource family');
      assert.equal(scene.cameraMode,'focus');assert.ok(scene.scale>=.38-1e-9);
      assert.equal(scene.camera.x,(region.bounds.left+region.bounds.right)/2);
      assert.ok(Math.abs(scene.camera.y-(region.bounds.top+88/.38/2+16/.38))<1e-9,
        `${regionId}'s short landscape camera starts at its own entrance with a readable scale`);
      const readable=safeHit(first.id,40);
      assert.ok(readable.screenBounds[2]>0&&readable.screenBounds[0]<844,
        'the selected region starts on an actual local resource, rather than the former southern site');
      assert.ok(scene.groundMarkerPaint.length>0&&scene.groundMarkerPaint.length<=4);
      for(const marker of scene.groundMarkerPaint)assert.ok(marker.nodeIds.every(id=>getGroundResourceNode(id)!.regionId===regionId),
        'live Scene controls exclude same-family resources from another physical region');
      assert.deepEqual(scene.heroLocation,feet);assert.deepEqual(scene.state,before);
      const focus=structuredClone(scene.camera),focusScale=scene.scale;
      scene.walkOntoRoad();scene.updateCamera();scene.stopWalking();
      assert.deepEqual(scene.camera,focus);assert.equal(scene.scale,focusScale,
        'walking cannot replace an explicitly selected region with a whole-map fit');
      scene.setMapZoom(1.25);scene.updateCamera();scene.mapPan=[24,-35];scene.camera.x+=24;scene.camera.y-=35;
      const panned=structuredClone(scene.camera),pannedScale=scene.scale;
      scene.walkOntoRoad();scene.updateCamera();scene.stopWalking();
      assert.equal(scene.cameraMode,'manual');assert.deepEqual(scene.camera,panned);assert.equal(scene.scale,pannedScale);
      assert.deepEqual(scene.mapPan,[24,-35],'regional walking preserves deliberate exploration of later resources');
      scene.showVillageOverview();scene.updateCamera();scene.publishGeometry();
      assert.equal(scene.resourceFocus,null);assert.equal(scene.cameraMode,'overview');
      assert.deepEqual(scene.camera,overview);assert.equal(scene.scale,overviewScale);
      assert.equal(scene.mapZoom,1);assert.equal(scene.manualViewport,null);assert.deepEqual(scene.mapPan,[0,0]);
      assert.deepEqual(scene.heroLocation,feet,'neither selecting a distant place nor resetting it teleports the resident');
      assert.deepEqual(scene.state,before,'all regional camera and marker operations leave every economic field unchanged');
    }
  } finally {
    hook.deregister(); restorePainting?.();
    for (const [key, descriptor] of Object.entries(descriptors)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete (globalThis as unknown as Record<string, unknown>)[key];
    }
  }
});
