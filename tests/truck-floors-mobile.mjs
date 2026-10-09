import { chromium } from '@playwright/test';
import strictAssert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { captureExecutionInputs } from './release-execution-inputs.mjs';
import { installBirdForegroundOpacityObserver } from './bird-foreground-paint-observer.mjs';

// Actual mobile touches and naturally rendered frames. Fresh villages earn
// their initial materials. Later floor-unlock setup is explicitly recorded;
// it never counts as earned progression or substitutes for an actual purchase.
// No private game/planner/render methods, synthetic readiness or driven clock.
const version = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')).version;
if (Number(version.split('.')[1]) < 21) throw Error('Truck floors require v0.21; earlier release receipts remain untouched.');
const baseUrl = process.env.TEST_BASE_URL || 'http://127.0.0.1:5173/';
const snapshotId = process.env.TEST_SNAPSHOT_ID || 'mutable-development-diagnostic';
const finalSnapshot = process.env.TEST_FINAL_SNAPSHOT === '1';
const diagnosticOnly = process.env.TEST_TRUCK_FLOORS_DIAGNOSTIC === '1';
if (diagnosticOnly && finalSnapshot) throw Error('A mutable diagnostic cannot be recorded as final verification.');
const startedAt = new Date();
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const executionInputs = await captureExecutionInputs(import.meta.url, { snapshotId, finalSnapshot, dependencies: ['tests/bird-foreground-paint-observer.mjs'] });
const receiptSuffix = diagnosticOnly ? '-diagnostic' : '';
let assertionsExecuted = 0;
const assert = new Proxy(strictAssert, { get(target, key) { const value = Reflect.get(target, key); return typeof value === 'function' ? (...args) => { assertionsExecuted++; return value(...args); } : value; } });
const cameraProofs = [], groundCandidateReadiness = [];
const freshFlows = [], fixtures = [], houseMoves = [], facilityMoves = [], floorPurchases = [], floorViews = [], upperFloorJobs = [], stairJourneys = [], observations = [], collisionProofs = [], birdProofs = [], placementGuards = [], offlineProofs = [], screenshots = [], cases = [], errors = [], failedAssets = [];
let browser, context, page, legacyMigration, failureEvidence, paidFloorSave;
await mkdir('artifacts', { recursive: true });
const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('road-haven-save-v1')));
const stableSave = value => { const result = structuredClone(value); delete result.lastSaved; return result; };
const point = value => Array.isArray(value) ? { x: value[0], y: value[1] } : value;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const effectiveBuildings = state => {
 const placements = new Map((state.truckLayout?.placements || []).map(item => [item.id, item.slot]));
 return [...(state.settlement?.buildings || []).map(building => ({ ...building, slot: placements.get(building.id) ?? building.slot })), ...(state.truckLayout?.upperBuildings || [])];
};
function inside(p, polygon) {
 let value = false;
 for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
  const a = point(polygon[i]), b = point(polygon[j]);
  if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) value = !value;
 }
 return value;
}
function edgeDistance(p, polygon) {
 return Math.min(...polygon.map((vertex, i) => {
  const a = point(vertex), b = point(polygon[(i + 1) % polygon.length]), vx = b.x - a.x, vy = b.y - a.y;
  const along = Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / (vx * vx + vy * vy)));
  return Math.hypot(p.x - a.x - along * vx, p.y - a.y - along * vy);
 }));
}
async function rendered() {
 return page.locator('#world').evaluate(canvas => {
  const d = canvas.dataset, r = canvas.getBoundingClientRect();
  return { at: performance.now(), movement: JSON.parse(d.freeMovement), action: JSON.parse(d.sceneAction),
   pets: JSON.parse(d.petMotion || '[]'), birds: JSON.parse(d.skyBirds || 'null'),
   geometry: JSON.parse(d.sceneGeometry), hits: JSON.parse(d.sceneHits || '[]'), slots: JSON.parse(d.settlementSlots || '[]'),
   houseSlots: JSON.parse(d.houseSlots || '[]'), rect: { left: r.left, top: r.top, width: r.width, height: r.height } };
 });
}
async function touch(locator) {
 await locator.scrollIntoViewIfNeeded(); const box = await locator.boundingBox(); assert.ok(box, 'the intended control is rendered');
 const p = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
 assert.equal(await locator.evaluate((button, p) => document.elementFromPoint(p.x, p.y)?.closest('button') === button, p), true, 'a finger reaches the intended button');
 const input = { at: Date.now(), client: p, bounds: box, label: await locator.getAttribute('aria-label') || await locator.innerText(), kind: 'actual-touchscreen-tap', targetConfirmed: true };
 await page.touchscreen.tap(p.x, p.y); return input;
}
async function closeModal() { if (await page.locator('#modal-root').isVisible()) await touch(page.locator('#modal-root [data-close]').first()); }
async function closeFacility() { if (await page.locator('#facility-sheet').isVisible()) await touch(page.locator('[data-facility-close]')); }
async function home() { await closeModal(); await closeFacility(); await touch(page.locator('[data-nav="home"]')); }
async function menu(kind) { await closeModal(); await closeFacility(); await touch(page.locator('[data-open="menu"]')); if (kind) await touch(page.locator(`#modal-root [data-open="${kind}"]`)); }
async function pauseWorld(paused = true) {
 if ((await page.locator('.time-button').getAttribute('aria-label') === '시간 계속') === paused) return;
 await menu('settings'); await touch(page.locator('#modal-root [data-pause]')); await touch(page.locator('#modal-root [data-save]')); await closeModal();
}
async function cameraSettled() {
 await page.evaluate(() => { window.__truckCameraSettling = { samples: [], stable: 0 }; });
 await page.waitForFunction(() => {
  const canvas = document.querySelector('#world'), g = JSON.parse(canvas.dataset.sceneGeometry), m = JSON.parse(canvas.dataset.freeMovement), r = canvas.getBoundingClientRect(), proof = window.__truckCameraSettling;
  const sample = { frameAt: m.frameAt, at: performance.now(), dx: g.dx, dy: g.dy, scale: g.scale, rect: [r.left, r.top, r.width, r.height] }, previous = proof.samples.at(-1);
  if (previous?.frameAt === sample.frameAt) return false;
  proof.samples.push(sample);
  proof.stable = previous && Math.abs(sample.dx - previous.dx) < .25 && Math.abs(sample.dy - previous.dy) < .25 && Math.abs(sample.scale - previous.scale) < .0005 && JSON.stringify(sample.rect) === JSON.stringify(previous.rect) ? proof.stable + 1 : 0;
  return proof.stable >= 3;
 }, null, { timeout: 5000 });
 return page.evaluate(() => window.__truckCameraSettling);
}
function toScreen(p, frame) { return { x: frame.rect.left + frame.geometry.dx + p.x * frame.geometry.scale, y: frame.rect.top + frame.geometry.dy + p.y * frame.geometry.scale }; }
async function canvasArea(p, clearance = 22) {
 return page.evaluate(({ p, clearance }) => [-clearance, 0, clearance].every(dx => [-clearance, 0, clearance].every(dy => document.elementFromPoint(p.x + dx, p.y + dy)?.id === 'world')), { p, clearance });
}
async function tapWorld(p) {
 assert.equal(await canvasArea(p), true, 'the released finger has a clear 44px canvas area');
 await page.locator('#world').evaluate(canvas => {
  window.__lastTruckTouch = null;
  canvas.addEventListener('pointerup', event => {
   const g = JSON.parse(canvas.dataset.sceneGeometry), r = canvas.getBoundingClientRect();
   window.__lastTruckTouch = { at: performance.now(), eventAt: event.timeStamp, client: { x: event.clientX, y: event.clientY },
    geometry: g, rect: { left: r.left, top: r.top, width: r.width, height: r.height },
    world: { x: (event.clientX - r.left - g.dx) / g.scale, y: (event.clientY - r.top - g.dy) / g.scale } };
  }, { once: true, capture: true });
 });
 await page.touchscreen.tap(p.x, p.y);
 const actual = await page.evaluate(() => window.__lastTruckTouch);
 assert.ok(actual, 'the actual native canvas pointer release is observed'); return actual;
}
async function drag(dx, dy) {
 const origin = await page.locator('#world').evaluate(canvas => {
  const r = canvas.getBoundingClientRect(), candidates = [];
  for (let y = r.top + 35; y < r.bottom - 35; y += 16) for (let x = r.left + 35; x < r.right - 35; x += 16)
   if ([-22, 0, 22].every(a => [-22, 0, 22].every(b => document.elementFromPoint(x + a, y + b) === canvas))) candidates.push({ x, y, rank: Math.hypot(x - r.left - r.width / 2, y - r.top - r.height / 2) });
  return candidates.sort((a, b) => a.rank - b.rank)[0];
 });
 assert.ok(origin, 'the readable map provides physical space for dragging');
 await page.locator('#world').evaluate(canvas => {
  window.__truckDragRelease = null;
  canvas.addEventListener('pointerup', event => {
   window.__truckDragRelease = { at: performance.now(), eventAt: event.timeStamp, isTrusted: event.isTrusted,
    client: { x: event.clientX, y: event.clientY }, geometry: JSON.parse(canvas.dataset.sceneGeometry) };
  }, { once: true, capture: true });
 });
 const cdp = await context.newCDPSession(page), viewport = await page.viewportSize(), packets = [];
 const dispatch = async packet => {
  for (const finger of packet.touchPoints) assert.ok(finger.x >= 0 && finger.x <= viewport.width && finger.y >= 0 && finger.y <= viewport.height, 'every actual drag packet stays on the phone screen');
  await cdp.send('Input.dispatchTouchEvent', packet);
  packets.push({ ...packet, acknowledged: true, at: Date.now() });
 };
 try {
  await dispatch({ type: 'touchStart', touchPoints: [{ x: origin.x, y: origin.y, id: 1 }] });
  for (let step = 1; step <= 5; step++) { await dispatch({ type: 'touchMove', touchPoints: [{ x: origin.x + dx * step / 5, y: origin.y + dy * step / 5, id: 1 }] }); await page.waitForTimeout(30); }
  await dispatch({ type: 'touchEnd', touchPoints: [] });
 } finally { await cdp.detach(); }
 await cameraSettled();
 const release = await page.evaluate(() => window.__truckDragRelease);
 assert.ok(release?.isTrusted, 'map exploration observes an actual native pointer release');
 assert.ok(release.client.x >= 0 && release.client.x <= viewport.width && release.client.y >= 0 && release.client.y <= viewport.height, 'the actual drag releases inside the phone screen');
 return { origin, delta: { x: dx, y: dy }, release, viewport, packets, kind: 'actual-CDP-native-touch-drag' };
}
async function cameraTools(operation) {
 const control = page.locator('[data-camera-toggle]');
 if (await control.getAttribute('aria-expanded') !== 'true') await touch(control);
 await operation();
 if (await control.getAttribute('aria-expanded') === 'true') await touch(control);
}
async function visibleHit(kind, id) {
 // Use actual draw/hit coordinates. Exploring a distant slot uses ordinary
 // zoom/pan controls, with the same input rules as a player.
 await cameraSettled();
 for (let attempt = 0; attempt < 12; attempt++) {
  const frame = await rendered(), hits = frame.hits.filter(hit => hit.kind === kind && (id === undefined || hit.plotId === id));
  assert.ok(hits.length, `${kind} ${id ?? ''}: the intended object exists in rendered hit telemetry`);
  for (const hit of hits) {
   const points = [point(hit)];
   if (kind === 'house' && hit.bounds) {
    const [left, top, right, bottom] = hit.bounds;
    for (const y of [.25, .5, .75]) for (const x of [.25, .5, .75]) points.push({ x: left + (right - left) * x, y: top + (bottom - top) * y });
   }
   for (const world of points) {
    if (kind === 'house' && frame.hits.some(other => ['pet', 'character', 'facility', 'facility-start', 'facility-collect', 'farm', 'grove-work'].includes(other.kind) && (other.bounds
     ? world.x >= other.bounds[0] && world.x <= other.bounds[2] && world.y >= other.bounds[1] && world.y <= other.bounds[3]
     : distance(world, other) < Math.max(other.radius, 22 / frame.geometry.scale)))) continue;
    const p = toScreen(world, frame); if (await canvasArea(p)) return { hit, world, screen: p, frame };
   }
  }
  if (attempt < 3) { await cameraTools(() => touch(page.locator('[data-map-zoom="-1"]'))); await cameraSettled(); continue; }
  const hit = hits[0], p = toScreen(hit, frame), centre = { x: frame.rect.left + frame.rect.width / 2, y: frame.rect.top + frame.rect.height * .55 };
  await cameraTools(async () => { if (!frame.geometry.mapMoveMode) await touch(page.locator('[data-map-move]')); });
  await drag(Math.max(-110, Math.min(110, centre.x - p.x)), Math.max(-110, Math.min(110, centre.y - p.y)));
  await cameraTools(async () => { if ((await rendered()).geometry.mapMoveMode) await touch(page.locator('[data-map-move]')); });
 }
 throw Error(`${kind} ${id ?? ''}: no 44px clear touch area after actual map exploration`);
}
async function actualHit(kind, id) { const target = await visibleHit(kind, id); const input = await tapWorld(target.screen); const proof = { target, input }; await page.evaluate(proof => { window.__lastTruckHit = proof; }, proof); return proof; }
async function observe(label) {
 await page.evaluate(label => {
  const canvas = document.querySelector('#world'), geometries = [], frames = [], ids = new Map();
  const capture = () => {
   const d = canvas.dataset, movement = JSON.parse(d.freeMovement), worldKey = JSON.stringify(movement.world);
   let geometryId = ids.get(worldKey);
   if (geometryId === undefined) { geometryId = geometries.length; ids.set(worldKey, geometryId); geometries.push({ id: geometryId, world: movement.world }); }
   delete movement.world;
   const g = JSON.parse(d.sceneGeometry), r = canvas.getBoundingClientRect();
   const birdOverlayBounds = label.startsWith('natural-collisions-and-eight-birds') ? [...document.querySelectorAll('.scene-label,.scene-weather,.truck-floor-controls,.scene-tools,.settlement-objective,.village-order-tool,.camera-tool,.map-controls,#toast')].flatMap(element => {
    const box = element.getBoundingClientRect(), style = getComputedStyle(element);
    if (!box.width || !box.height || style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) < .2) return [];
    return [{ selector: element.id ? `#${element.id}` : `.${element.classList[0]}`, left: box.left - r.left, top: box.top - r.top, right: box.right - r.left, bottom: box.bottom - r.top }];
   }) : undefined;
   const frame = { at: performance.now(), geometryId, movement, action: JSON.parse(d.sceneAction), pets: JSON.parse(d.petMotion || '[]'), birds: JSON.parse(d.skyBirds || 'null'),
    camera: { dx: g.dx, dy: g.dy, scale: g.scale, activeFloor: g.activeFloor, rect: { left: r.left, top: r.top, width: r.width, height: r.height } }, ...(birdOverlayBounds ? { birdOverlayBounds, birdForeground: window.__birdForegroundOpacity.sample() } : {}) };
   if (frames.at(-1)?.movement.frameAt === movement.frameAt) frames[frames.length - 1] = frame; else frames.push(frame);
  };
  window.__truckObservation = { label, geometries, frames }; capture();
  window.__truckObserver = new MutationObserver(capture);
  window.__truckObserver.observe(canvas, { attributes: true, attributeFilter: ['data-free-movement', 'data-scene-action', 'data-pet-motion', 'data-sky-birds'] });
 }, label);
}
async function stopObserve() { const value = await page.evaluate(() => { window.__truckObserver.disconnect(); return window.__truckObservation; }); value.id = observations.length; observations.push(value); return value; }
const observedProof = proof => { const { observation, ...rest } = proof; return { ...rest, observationId: observation.id }; };
async function clearPlacement(kind, floor, slot, restart) {
 const initial = await rendered(), target = (kind === 'house' ? initial.houseSlots : initial.slots).find(item => item.slot === slot && item.floor === floor);
 assert.ok(target && Array.isArray(target.polygon), 'placement uses the actual complete target footprint');
 const overlaps = body => body.surface === 'deck' && body.floor === floor && (inside(body, target.polygon) || edgeDistance(body, target.polygon) < body.radius);
 if (target.blockedReason === 'actor' && overlaps(initial.movement.body)) {
  const before = await saved(), button = page.locator(kind === 'house' ? '[data-home-move-confirm]' : '[data-construction-confirm]'), disabled = await button.isDisabled();
  const input = await touch(button); await page.waitForTimeout(80); const after = await saved();
  assert.deepEqual(stableSave(after), stableSave(before), 'an actor-occupied placement confirmation neither spends materials nor relocates a building');
  placementGuards.push({ kind, floor, slot, before, after, target, bodies: [initial.movement.body, ...initial.pets.map(pet => pet.body)], input, disabled });
  if (overlaps(initial.movement.body)) {
   await touch(page.locator('[data-construction-cancel]'));
   await walkFloor(`leave-occupied-${kind}-placement-${floor}-${slot}`, floor, { avoidPolygon: target.polygon, minDistance: 30 });
   await restart();
  }
 }
 await waitPlacementClear(kind, floor, slot);
 return rendered();
}
async function waitPlacementClear(kind, floor, slot) {
 await page.waitForFunction(({ kind, floor, slot }) => {
  const canvas = document.querySelector('#world'), entries = JSON.parse(kind === 'house' ? canvas.dataset.houseSlots : canvas.dataset.settlementSlots), target = entries.find(item => item.slot === slot && item.floor === floor);
  if (!target?.available) return false;
  const m = JSON.parse(canvas.dataset.freeMovement), pets = JSON.parse(canvas.dataset.petMotion), polygon = target.polygon;
  const xy = value => Array.isArray(value) ? { x: value[0], y: value[1] } : value;
  const contains = p => { let result = false; for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) { const a = xy(polygon[i]), b = xy(polygon[j]); if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) result = !result; } return result; };
  const edge = p => Math.min(...polygon.map((v, i) => { const a = xy(v), b = xy(polygon[(i + 1) % polygon.length]), vx = b.x - a.x, vy = b.y - a.y, t = Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / (vx * vx + vy * vy))); return Math.hypot(p.x - a.x - t * vx, p.y - a.y - t * vy); }));
  return [m.body, ...pets.map(pet => pet.body)].every(body => body.surface !== 'deck' || body.floor !== floor || !contains(body) && edge(body) > body.radius + 2);
 }, { kind, floor, slot }, { timeout: 20000 });
}
async function confirmPlacement(kind, floor, slot, { buildingId, work = false } = {}) {
 const selector = kind === 'house' ? '[data-home-move-confirm]' : '[data-construction-confirm]';
 const deadline = Date.now() + 20000;
 for (let attempt = 0; attempt < 5 && Date.now() < deadline; attempt++) {
  await waitPlacementClear(kind, floor, slot);
  const before = await saved(), button = page.locator(selector);
  await button.evaluate((element, target) => {
   window.__truckPlacementRelease = null;
   element.addEventListener('pointerup', event => {
    const canvas = document.querySelector('#world'), m = JSON.parse(canvas.dataset.freeMovement), pets = JSON.parse(canvas.dataset.petMotion);
    const slots = JSON.parse(target.kind === 'house' ? canvas.dataset.houseSlots : canvas.dataset.settlementSlots);
    window.__truckPlacementRelease = { at: performance.now(), eventAt: event.timeStamp, client: { x: event.clientX, y: event.clientY },
     target: slots.find(item => item.floor === target.floor && item.slot === target.slot), bodies: [m.body, ...pets.map(pet => pet.body)] };
   }, { once: true, capture: true });
  }, { kind, floor, slot });
  const input = await touch(button), release = await page.evaluate(() => window.__truckPlacementRelease);
  assert.ok(release?.target, 'the genuine placement release captures its actual full footprint and actors');
  const result = await page.waitForFunction(({ kind, floor, slot, buildingId, work }) => {
   const app = document.querySelector('#app'), state = JSON.parse(localStorage.getItem('road-haven-save-v1'));
   if (work && app.getAttribute('aria-busy') === 'true' && JSON.parse(document.querySelector('#world').dataset.sceneAction).kind === 'build') return 'accepted';
   if (!work && kind === 'house' && state.truckLayout?.home.floor === floor && state.truckLayout.home.slot === slot) return 'accepted';
   if (!work && kind === 'facility') {
    const legacy = state.settlement.buildings.find(item => item.id === buildingId), upper = state.truckLayout?.upperBuildings.find(item => item.id === buildingId);
    const override = state.truckLayout?.placements.find(item => item.id === buildingId);
    if ((upper?.slot ?? override?.slot ?? legacy?.slot) === slot) return 'accepted';
   }
   if (document.querySelector('#toast').textContent === '캐릭터나 동물이 지나가는 자리예요. 잠시 뒤 다시 확정해 주세요.') return 'actor-rejected';
   return false;
  }, { kind, floor, slot, buildingId, work }, { timeout: 1500 });
  if (await result.jsonValue() === 'accepted') return { ...input, release, attempts: attempt + 1 };
  const after = await saved();
  assert.deepEqual(stableSave(after), stableSave(before), 'a moving actor entering before confirmation preserves the complete paid save');
  assert.equal(await page.locator('#app').getAttribute('aria-busy'), null, 'an occupied target starts no construction work');
  assert.ok(release.bodies.some(body => body.surface === 'deck' && body.floor === floor && (inside(body, release.target.polygon) || edgeDistance(body, release.target.polygon) < body.radius)), 'the rejected genuine release independently overlaps an actual body');
  placementGuards.push({ kind, floor, slot, before, after, target: release.target, bodies: release.bodies, input: { ...input, release }, disabled: false, reason: 'moving-actor-entered-before-confirm' });
 }
 throw Error(`Actual ${kind} confirmation remained actor-occupied after bounded natural retries.`);
}
async function shot(label) {
 await page.waitForTimeout(350); const filename = `artifacts/v${version}-truck-floors${receiptSuffix}-${label}.png`;
 await page.screenshot({ path: filename, fullPage: true }); screenshots.push(filename); return filename;
}
async function begin(width, height, setup) {
 context = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
 await context.addInitScript(installBirdForegroundOpacityObserver);
 if (setup) {
  // A one-time, declared input save. Reloads subsequently exercise the real
  // persisted state instead of silently reinstalling the original fixture.
  await context.addInitScript(({ save, origin }) => {
   if (location.origin !== origin || sessionStorage.getItem('truck-floors-qa-applied')) return;
   const value = structuredClone(save); value.lastSaved = Date.now();
   localStorage.setItem('road-haven-save-v1', JSON.stringify(value));
   sessionStorage.setItem('truck-floors-qa-applied', 'true');
  }, { save: setup.save, origin: new URL(baseUrl).origin });
 }
 page = await context.newPage();
 page.on('pageerror', error => errors.push(error.message));
 page.on('response', response => { if (response.status() >= 400 && ['image', 'font', 'script', 'stylesheet'].includes(response.request().resourceType())) failedAssets.push(`${response.status()} ${response.url()}`); });
 await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
 if (!setup) { await page.locator('[data-start]').waitFor(); await page.locator('#player-name').fill(`층생활${width}`); await touch(page.locator('[data-start]')); }
 await page.locator('#resident-name').waitFor();
 // Saved-name DOM can exist while first-install startup still holds the app inert.
 await page.waitForFunction(() => document.querySelector('#app')?.inert === false, null, { timeout: 10000 });
 await pauseWorld();
 await page.waitForFunction(() => document.querySelector('#world')?.dataset.freeMovement && JSON.parse(document.querySelector('#world').dataset.freeMovement).enabled, null, { timeout: 10000 });
 await cameraSettled();
 assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight + 1), true, `${width}×${height}: the game does not overflow the viewport`);
 if (setup) { assert.equal((await saved()).name, setup.save.name, 'the declared valid save loads without resetting the village'); fixtures.push({ viewport: { width, height }, ...setup, appliedSave: await saved(), lastSavedPolicy: 'Only lastSaved is set to the real loading time to isolate migration from unrelated absence progress.' }); }
}
async function chore(label, kind, trigger) {
 const before = await saved(), from = (await rendered()).movement; await observe(label); const input = await trigger();
 await page.waitForFunction(kind => { const d = document.querySelector('#world').dataset, action = JSON.parse(d.sceneAction); return document.querySelector('#app').getAttribute('aria-busy') === 'true' && action.kind === kind && action.from; }, kind, { timeout: 1500 });
 const first = (await rendered()).action;
 await page.waitForFunction(() => !document.querySelector('#app').hasAttribute('aria-busy'), null, { timeout: 20000 });
 const observation = await stopObserve(), final = (await rendered()).movement, after = await saved();
 const working = observation.frames.filter(frame => frame.action.kind === kind && frame.action.phase === 'working');
 assert.ok(working.length >= 2, `${label}: the actual work pose lasts for multiple natural frames`);
 assert.ok(distance(point(first.from), from.position) < 2, `${label}: work starts at the preceding actual feet`);
 assert.ok(distance(final.position, first.returnPoint) < 2, `${label}: work returns to its actual safe return point`);
 const proof = { label, kind, before, after, from, first, final, input, observation };
 collisionCheck(observation, label); upperFloorJobs.push(observedProof(proof)); return proof;
}
async function gather() {
 await menu('grove');
 const result = await chore('earned-road-materials', 'gather', () => touch(page.locator('#modal-root [data-action="gather"]')));
 assert.equal(result.after.stats.gathers, result.before.stats.gathers + 1);
 const scoutReward = !result.before.quests.includes('road-scout') && result.after.quests.includes('road-scout');
 if (scoutReward) { assert.equal(result.after.stats.gathers, 3); assert.match(result.after.log[0], /도로 위의 보물찾기/); }
 assert.equal(result.after.resources.wood, result.before.resources.wood + 10 + (scoutReward ? 12 : 0));
 assert.equal(result.after.resources.scrap, result.before.resources.scrap + 5 + (scoutReward ? 6 : 0)); await home(); return result;
}
async function expandDeck() {
 await menu('expand');
 const result = await chore('actual-paid-deck-expansion', 'expand', () => touch(page.locator('#modal-root [data-action="expand"]')));
 const cost = { wood: 20 + (result.before.deckLevel - 1) * 14, scrap: 10 + (result.before.deckLevel - 1) * 7 };
 assert.equal(result.after.deckLevel, result.before.deckLevel + 1);
 assert.equal(result.after.resources.wood, result.before.resources.wood - cost.wood);
 assert.equal(result.after.resources.scrap, result.before.resources.scrap - cost.scrap);
 await home(); return result;
}
async function build(type, slot) {
 await closeFacility(); await touch(page.locator('[data-nav="build"]')); await touch(page.locator(`[data-build-type="${type}"]`));
 const before = await saved(), input = await actualHit('build-slot', slot);
 assert.equal(await page.locator('[data-construction-confirm]').isDisabled(), false, 'a real selected slot enables construction confirmation');
 assert.deepEqual(stableSave(await saved()), stableSave(before), 'construction preview leaves the paid save unchanged');
 await clearPlacement('facility', Math.floor(slot / 16) + 1, slot, async () => { await touch(page.locator('[data-nav="build"]')); await touch(page.locator(`[data-build-type="${type}"]`)); await actualHit('build-slot', slot); });
 const result = await chore(`build-${type}-slot-${slot}`, 'build', () => confirmPlacement('facility', Math.floor(slot / 16) + 1, slot, { work: true }));
 const building = effectiveBuildings(result.after).find(item => !effectiveBuildings(before).some(existing => existing.id === item.id));
 assert.ok(building, 'actual construction adds one identified building'); assert.equal(building.type, type); assert.equal(building.slot, slot);
 const costs = { waterworks: { wood: 12, scrap: 4 }, kitchen: { wood: 16, scrap: 6 } };
 assert.equal(result.after.resources.wood, before.resources.wood - costs[type].wood);
 assert.equal(result.after.resources.scrap, before.resources.scrap - costs[type].scrap);
 result.selectedSlotInput = input; await closeFacility(); await home(); return building;
}
async function startProduction(id) {
 await actualHit('facility', id); await page.locator(`#facility-sheet[data-facility="${id}"]`).waitFor();
 const before = await saved(); await touch(page.locator(`[data-facility-start="${id}"]`));
 const after = await saved(), building = effectiveBuildings(after).find(item => item.id === id);
 assert.ok(building.readyAt > after.totalMinutes, 'actual production has a future saved deadline');
 assert.equal(after.settlement.stats.productions, before.settlement.stats.productions + 1);
 await closeFacility(); return { before, after, building };
}
async function relocateFacility(id, slot, invalidId) {
 const before = await saved(), facility = effectiveBuildings(before).find(item => item.id === id);
 await touch(page.locator(`[data-truck-floor="${Math.floor(facility.slot / 16) + 1}"]`));
 await actualHit('facility', id); await touch(page.locator(`[data-facility-move="${id}"]`));
 if (invalidId !== undefined) {
  const invalidInput = await actualHit('facility', invalidId);
  assert.equal(await page.locator('[data-construction-confirm]').isDisabled(), true, 'an occupied footprint cannot become a relocation target');
  assert.deepEqual(stableSave(await saved()), stableSave(before), 'an invalid relocation cannot mutate resources, deadlines or identity');
  facilityMoves.push({ kind: 'invalid-occupied', id, invalidId, before, after: await saved(), input: invalidInput });
 }
 const floor = Math.floor(slot / 16) + 1;
 await touch(page.locator(`[data-truck-floor="${floor}"]`));
 const previewInput = await actualHit('build-slot', slot); await touch(page.locator('[data-construction-cancel]'));
 assert.deepEqual(stableSave(await saved()), stableSave(before), 'cancelling a valid preview leaves the save unchanged');
 facilityMoves.push({ kind: 'cancelled-preview', id, slot, before, after: await saved(), input: previewInput });
 await touch(page.locator(`[data-truck-floor="${Math.floor(facility.slot / 16) + 1}"]`));
 await actualHit('facility', id); await touch(page.locator(`[data-facility-move="${id}"]`));
 await touch(page.locator(`[data-truck-floor="${floor}"]`));
 const input = await actualHit('build-slot', slot);
 await clearPlacement('facility', floor, slot, async () => { await touch(page.locator(`[data-truck-floor="${Math.floor(facility.slot / 16) + 1}"]`)); await actualHit('facility', id); await touch(page.locator(`[data-facility-move="${id}"]`)); await touch(page.locator(`[data-truck-floor="${floor}"]`)); await actualHit('build-slot', slot); });
 await observe(`confirm-facility-move-${id}-${slot}`); await confirmPlacement('facility', floor, slot, { buildingId: id }); await page.waitForTimeout(450);
 collisionCheck(await stopObserve(), `confirm-facility-move-${id}-${slot}`);
 const after = await saved(), moved = effectiveBuildings(after).find(item => item.id === id);
 assert.deepEqual(moved, { ...facility, slot }, 'moving a finished facility preserves its identity, level and active batch');
 assert.deepEqual(after.resources, before.resources, 'relocation charges and refunds no resources');
 assert.deepEqual(after.companions, before.companions, 'relocation preserves earned animal XP and health');
 facilityMoves.push({ kind: 'confirmed', id, from: facility.slot, to: slot, before, after, input });
 await closeFacility(); return moved;
}
function physicalFloor(world, floor) {
 const result = world.floors?.find(item => item.id === floor);
 assert.ok(result && Array.isArray(result.outerPolygon) && result.outerPolygon.length >= 4, `floor ${floor}: the actual physical railing polygon is observable`); return result;
}
function houseInside(frame, label) {
 const house = frame.movement.world.obstacles.find(item => item.kind === 'house'), home = house && physicalFloor(frame.movement.world, house.floor);
 assert.ok(house && Array.isArray(house.polygon), `${label}: the complete house ground footprint is rendered`);
 const clearances = house.polygon.map(vertex => { const p = point(vertex); assert.equal(inside(p, home.outerPolygon), true, `${label}: every house footprint corner lies inside its deck`); const clearance = edgeDistance(p, home.outerPolygon); assert.ok(clearance > .2, `${label}: the full house footprint clears the railing`); return clearance; });
 return { label, floor: house.floor, housePolygon: house.polygon, deckPolygon: home.outerPolygon, clearances };
}
async function relocateHouse(floor, slot, { cancelFirst = true, invalidFacility } = {}) {
 const before = await saved();
 const currentFloor = before.truckLayout?.home.floor ?? 1;
 await touch(page.locator(`[data-truck-floor="${currentFloor}"]`)); await actualHit('house'); await touch(page.locator('[data-home-move]'));
 if (invalidFacility !== undefined) {
  const input = await actualHit('facility', invalidFacility);
  assert.equal(await page.locator('[data-home-move-confirm]').isDisabled(), true, 'a finished facility cannot become a house placement');
  assert.deepEqual(stableSave(await saved()), stableSave(before), 'an invalid house position leaves the complete save unchanged');
  houseMoves.push({ kind: 'invalid-occupied', before, after: await saved(), invalidFacility, input });
 }
 await touch(page.locator(`[data-truck-floor="${floor}"]`)); const preview = await actualHit('house-slot', slot);
 assert.equal(await page.locator('[data-home-move-confirm]').isDisabled(), false);
 assert.deepEqual(stableSave(await saved()), stableSave(before), 'a house preview spends nothing and grants no progress');
 if (cancelFirst) {
  await touch(page.locator('[data-construction-cancel]')); assert.deepEqual(stableSave(await saved()), stableSave(before), 'cancelling house movement restores the original paid layout');
  houseMoves.push({ kind: 'cancelled-preview', before, after: await saved(), floor, slot, input: preview });
  await touch(page.locator(`[data-truck-floor="${currentFloor}"]`)); await actualHit('house'); await touch(page.locator('[data-home-move]')); await touch(page.locator(`[data-truck-floor="${floor}"]`)); await actualHit('house-slot', slot);
 }
 await clearPlacement('house', floor, slot, async () => { await touch(page.locator(`[data-truck-floor="${currentFloor}"]`)); await actualHit('house'); await touch(page.locator('[data-home-move]')); await touch(page.locator(`[data-truck-floor="${floor}"]`)); await actualHit('house-slot', slot); });
 await observe(`confirm-home-move-${floor}-${slot}`); const input = await confirmPlacement('house', floor, slot); await page.waitForTimeout(450);
 collisionCheck(await stopObserve(), `confirm-home-move-${floor}-${slot}`); const after = await saved();
 assert.deepEqual(after.truckLayout.home, { floor, slot }); assert.deepEqual(after.resources, before.resources, 'the finished house moves for free');
 for (const key of ['companions', 'animalReserve', 'plots', 'stats', 'xp', 'health', 'energy', 'settlement']) assert.deepEqual(after[key], before[key], `house movement preserves ${key}`);
 await cameraSettled(); const footprint = houseInside(await rendered(), `moved-home-${floor}-${slot}`);
 houseMoves.push({ kind: 'confirmed', before, after, floor, slot, preview, input, footprint }); return after;
}
function collisionCheck(observation, label) {
 let pairsChecked = 0, bodiesChecked = 0, pawContactsChecked = 0, minPairClearance = Infinity, blockedFrames = 0;
 const nearPairs = [], blocked = [];
 for (let index = 0; index < observation.frames.length; index++) {
  const frame = observation.frames[index], world = observation.geometries[frame.geometryId].world;
  const actors = [{ id: 'hero', body: frame.movement.body, contacts: null, blockedReason: frame.movement.blockedReason }, ...frame.pets.map(pet => ({ id: pet.id, body: pet.body, contacts: pet.contacts, blockedReason: pet.blockedReason }))];
  assert.ok(Number.isFinite(frame.movement.frameAt), `${label}: collisions are sampled from actual natural scene frames`);
  for (const actor of actors) {
   const b = actor.body;
   assert.ok(b && Number.isFinite(b.x) && Number.isFinite(b.y) && Number.isFinite(b.radius) && b.radius > 0, `${label}/${actor.id}: the actual ground body circle is observable`);
   if (actor.blockedReason) { blockedFrames++; if (blocked.length < 80) blocked.push({ frame: index, id: actor.id, body: b, reason: actor.blockedReason }); }
   // Stair surfaces use their reserved link; a tall isometric sprite may
   // overlap another depth layer without its physical ground body colliding.
   if (b.surface === 'ladder') continue;
   bodiesChecked++;
   const polygon = b.surface === 'deck' ? physicalFloor(world, b.floor).outerPolygon : [
    { x: world.roadOuterBounds.left, y: world.roadOuterBounds.top }, { x: world.roadOuterBounds.right, y: world.roadOuterBounds.top },
    { x: world.roadOuterBounds.right, y: world.roadOuterBounds.bottom }, { x: world.roadOuterBounds.left, y: world.roadOuterBounds.bottom }];
   assert.equal(inside(b, polygon), true, `${label}/${actor.id}: feet stay on their physical floor`);
   assert.ok(edgeDistance(b, polygon) + .2 >= b.radius, `${label}/${actor.id}: the complete body clears the railing`);
   const obstacles = world.obstacles.filter(o => o.surface === b.surface && (b.surface === 'road' || o.floor === b.floor));
   for (const obstacle of obstacles) {
    assert.equal(inside(b, obstacle.polygon), false, `${label}/${actor.id}: body does not enter ${obstacle.kind}`);
    assert.ok(edgeDistance(b, obstacle.polygon) + .2 >= b.radius, `${label}/${actor.id}: body clears the entire ${obstacle.kind} footprint`);
   }
   for (const [paw, contact] of Object.entries(actor.contacts || {})) if (contact.planted) {
    pawContactsChecked++;
    assert.ok(distance(contact, b) <= b.radius + .2, `${label}/${actor.id}/${paw}: the collision envelope contains the actual planted paw`);
    assert.equal(inside(contact, polygon), true, `${label}/${actor.id}/${paw}: the planted paw stays inside the railing`);
    for (const obstacle of obstacles) assert.equal(inside(contact, obstacle.polygon), false, `${label}/${actor.id}/${paw}: the actual planted paw avoids ${obstacle.kind}`);
   }
  }
  for (let a = 0; a < actors.length; a++) for (let b = a + 1; b < actors.length; b++) {
   const first = actors[a], second = actors[b], x = first.body, y = second.body;
   if (x.surface !== y.surface || x.floor !== y.floor || x.surface === 'ladder' && x.link !== y.link) continue;
   const clearance = distance(x, y) - x.radius - y.radius; pairsChecked++; minPairClearance = Math.min(minPairClearance, clearance);
   assert.ok(clearance >= -.2, `${label}: ${first.id} and ${second.id} have distinct physical bodies`);
   if (clearance < 12 && nearPairs.length < 80) nearPairs.push({ frame: index, ids: [first.id, second.id], bodies: [x, y], clearance });
  }
 }
 const compatiblePairsExpected = observation.frames.reduce((sum, frame) => {
  const bodies = [frame.movement.body, ...frame.pets.map(pet => pet.body)];
  return sum + bodies.reduce((count, body, index) => count + bodies.slice(index + 1).filter(other => body.surface === other.surface && body.floor === other.floor && (body.surface !== 'ladder' || body.link === other.link)).length, 0);
 }, 0);
 assert.ok(bodiesChecked > 0, `${label}: actual static physical collision checks executed`);
 assert.equal(pairsChecked, compatiblePairsExpected, `${label}: every physically compatible actor pair was checked`);
 const proof = { label, observationId: observation.id, bodiesChecked, pairsChecked, compatiblePairsExpected, pawContactsChecked, minPairClearance: Number.isFinite(minPairClearance) ? minPairClearance : null, nearPairs, blockedFrames, blocked };
 collisionProofs.push(proof); return proof;
}
async function groundCandidateAttempt(floor, { near, minDistance = 60, insidePolygon, avoidPolygon } = {}, proof) {
 const frame = await rendered(), floorInfo = physicalFloor(frame.movement.world, floor), polygon = floorInfo.deckPolygon, candidates = [];
 const bounds = { left: Math.min(...polygon.map(p => point(p).x)), right: Math.max(...polygon.map(p => point(p).x)), top: Math.min(...polygon.map(p => point(p).y)), bottom: Math.max(...polygon.map(p => point(p).y)) };
 const attempt = { at: Date.now(), frame, bounds, rejected: [], candidates, domProbes: [] }; proof.attempts.push(attempt);
 const rejected = (world, reason) => attempt.rejected.push({ world, reason });
 for (let y = bounds.top; y <= bounds.bottom; y += 12) for (let x = bounds.left; x <= bounds.right; x += 12) {
  const p = { x, y };
  if (!inside(p, polygon) || edgeDistance(p, polygon) < 12 || distance(p, frame.movement.position) < minDistance) { rejected(p, 'deck-or-hero-clearance'); continue; }
  if (insidePolygon && (!inside(p, insidePolygon) || edgeDistance(p, insidePolygon) < 9)) { rejected(p, 'requested-polygon'); continue; }
  if (avoidPolygon && (inside(p, avoidPolygon) || edgeDistance(p, avoidPolygon) < 40)) { rejected(p, 'avoid-polygon'); continue; }
  if (frame.pets.some(pet => pet.body.surface === 'deck' && pet.body.floor === floor && distance(p, pet.body) < pet.body.radius + frame.movement.body.radius + 12)) { rejected(p, 'pet-body'); continue; }
  if (frame.movement.world.obstacles.some(o => o.surface === 'deck' && o.floor === floor && (inside(p, o.polygon) || edgeDistance(p, o.polygon) < 12))) { rejected(p, 'static-obstacle'); continue; }
  if (frame.hits.some(hit => {
   if (hit.kind === 'truck') return false;
   if (hit.bounds) return x >= hit.bounds[0] - 7 && x <= hit.bounds[2] + 7 && y >= hit.bounds[1] - 7 && y <= hit.bounds[3] + 7;
   return distance(p, hit) < Math.max(hit.radius, 22 / frame.geometry.scale) + 12;
  })) { rejected(p, 'scene-hit'); continue; }
  candidates.push({ world: p, screen: toScreen(p, frame), rank: near ? distance(p, near) : -distance(p, frame.movement.position) });
 }
 candidates.sort((a, b) => a.rank - b.rank);
 for (const candidate of candidates) {
  const samples = await page.evaluate(p => [-22, 0, 22].flatMap(dx => [-22, 0, 22].map(dy => {
   const x = p.x + dx, y = p.y + dy, element = document.elementFromPoint(x, y);
   return { x, y, id: element?.id || null, tag: element?.tagName || null };
  })), candidate.screen);
  const valid = samples.every(sample => sample.id === 'world'); attempt.domProbes.push({ screen: candidate.screen, samples, valid });
  if (valid) { attempt.selected = candidate; attempt.finishedAt = Date.now(); return { ...candidate, floor, geometry: frame.geometry }; }
 }
 attempt.finishedAt = Date.now(); return null;
}
async function groundCandidate(floor, options = {}) {
 await cameraSettled();
 const proof = { floor, options, budgetMs: 3500, startedAt: Date.now(), attempts: [] }; groundCandidateReadiness.push(proof);
 const deadline = proof.startedAt + proof.budgetMs;
 do {
  const candidate = await groundCandidateAttempt(floor, options, proof);
  if (candidate) { proof.finishedAt = Date.now(); proof.selected = candidate; return candidate; }
  const remaining = deadline - Date.now(); if (remaining <= 0) break;
  await page.waitForTimeout(Math.min(50, remaining));
 } while (Date.now() < deadline);
 proof.finishedAt = Date.now(); proof.timedOut = true;
 throw Error(`floor ${floor}: no visible empty terrain with a clear physical finger area`);
}
async function walkFloor(label, floor, options) {
 await closeFacility(); await closeModal(); await touch(page.locator(`[data-truck-floor="${floor}"]`));
 const before = await saved(), from = (await rendered()).movement, destination = await groundCandidate(floor, options);
 await observe(label); const input = await tapWorld(destination.screen);
 await page.waitForFunction(() => JSON.parse(document.querySelector('#world').dataset.freeMovement).moving, null, { timeout: 1200 });
 const accepted = (await rendered()).movement;
 assert.equal(accepted.target.floor, floor); assert.ok(distance(accepted.target, input.world) < 8, `${label}: destination is the floor under the actual released finger`);
 await page.waitForFunction(() => !JSON.parse(document.querySelector('#world').dataset.freeMovement).moving, null, { timeout: 20000 });
 const observation = await stopObserve(), final = (await rendered()).movement, after = await saved();
 assert.ok(distance(final.position, accepted.target) < 2); assert.equal(final.floor, floor);
 assert.deepEqual(stableSave(after), stableSave(before), `${label}: walking spends and awards no resources or progress`);
 for (let i = 1; i < observation.frames.length; i++) {
  const a = observation.frames[i - 1].movement, b = observation.frames[i].movement, seconds = (b.frameAt - a.frameAt) / 1000;
  assert.ok(Number.isFinite(seconds) && seconds >= 0, `${label}: natural frame time is monotonic`);
  assert.ok(distance(a.position, b.position) <= seconds * 420 + 1.5, `${label}: feet never teleport across stairs or collisions`);
 }
 collisionCheck(observation, label);
 const proof = { label, floor, from, destination, input, accepted, final, before, after, observation };
 stairJourneys.push(observedProof(proof)); return proof;
}
async function naturalAnimalsAndBirds(width) {
 await home(); await touch(page.locator('[data-truck-floor="1"]')); await cameraSettled();
 let cameraSetupId = null;
 const viewport = await page.viewportSize();
 if (viewport.width > viewport.height || viewport.height <= 740) {
  // Landscape and short portrait views can hide the background flock behind
  // foreground trees and the opaque deck. Explore the actual map before judging
  // a visible sky observation, using the same genuine zoom/pan controls.
  const before = await rendered(), beforeSave = await saved(), inputs = [];
  const defaultScreenshot = await shot(`default-deck-occluded-sky-${width}`);
  await cameraTools(async () => { for (let step = 0; step < 3; step++) inputs.push(await touch(page.locator('[data-map-zoom="-1"]'))); });
  await cameraTools(async () => { if (!(await rendered()).geometry.mapMoveMode) inputs.push(await touch(page.locator('[data-map-move]'))); });
  inputs.push(await drag(0, 80));
  inputs.push(await drag(viewport.width > viewport.height ? 320 : Math.floor(viewport.width * .35), 0));
  inputs.push(await drag(60, 0));
  await cameraTools(async () => { if ((await rendered()).geometry.mapMoveMode) inputs.push(await touch(page.locator('[data-map-move]'))); });
  let originalExploration = null, groveReveal = null;
  if (viewport.width > viewport.height) {
   await cameraSettled(); originalExploration = {frame:await rendered(),save:await saved()};
   const beforeReveal = await rendered(), beforeRevealSave = await saved(), revealInputs = [];
   for (const selector of ['[data-open="menu"]', '#modal-root [data-open="grove"]', '#modal-root [data-look-grove]']) {
    const input = {selector,...await touch(page.locator(selector))}; revealInputs.push(input); inputs.push(input);
   }
   const settling = await cameraSettled(), revealed = await rendered(), revealedSave = await saved();
   assert.equal(revealed.geometry.zone, 'grove', 'ordinary look-around reveals the wide road view');
   assert.equal(revealed.movement.moving, false); assert.ok(distance(revealed.movement.position,beforeReveal.movement.position)<.1);
   assert.deepEqual(revealed.movement.target,beforeReveal.movement.target); assert.deepEqual(revealed.movement.body,beforeReveal.movement.body);
   assert.deepEqual(revealed.movement.world,beforeReveal.movement.world);
   assert.equal(beforeReveal.action.kind,null); assert.equal(revealed.action.kind,null); assert.equal(revealed.action.phase,'idle');
   assert.deepEqual(stableSave(revealedSave),stableSave(beforeRevealSave),'looking around the grove preserves the complete paid save');
   groveReveal = {before:beforeReveal,after:revealed,beforeSave:beforeRevealSave,afterSave:revealedSave,inputs:revealInputs,settling};
   await cameraTools(async () => { if (!(await rendered()).geometry.mapMoveMode) inputs.push(await touch(page.locator('[data-map-move]'))); });
   inputs.push(await drag(0,80)); inputs.push(await drag(320,0)); inputs.push(await drag(60,0));
   await cameraTools(async () => { if ((await rendered()).geometry.mapMoveMode) inputs.push(await touch(page.locator('[data-map-move]'))); });
  }
  await cameraSettled(); const after = await rendered(), afterSave = await saved();
  if (viewport.width > viewport.height) {
   assert.deepEqual(after.movement.target,before.movement.target); assert.deepEqual(after.movement.body,before.movement.body);
   assert.deepEqual(after.movement.world,before.movement.world); assert.equal(after.action.kind,null); assert.equal(after.action.phase,'idle');
  }
  assert.deepEqual(stableSave(afterSave), stableSave(beforeSave), 'actual sky exploration preserves the complete paid save');
  assert.equal(after.movement.moving, false, 'camera gestures never initiate walking');
  assert.ok(distance(after.movement.position, before.movement.position) < 2, 'camera exploration keeps the same physical hero feet');
  const deck = before.movement.world.floors.find(floor => floor.id === before.geometry.activeFloor);
  const defaultDeckVisibleIds = before.birds.filter(bird => {
   const x = before.geometry.dx + bird.x * before.geometry.scale, y = before.geometry.dy + bird.y * before.geometry.scale;
   return bird.alpha > .2 && x > 0 && y > 0 && x < before.rect.width && y < before.rect.height && !inside(bird, deck.outerPolygon);
  }).map(bird => bird.id);
  cameraSetupId = cameraProofs.length;
  cameraProofs.push({ id: cameraSetupId, width, before, after, inputs, beforeSave, afterSave, originalExploration, groveReveal, defaultScreenshot, defaultDeckVisibleIds,
   defaultVisibilityScope: 'One actual default-camera frame after opaque selected-deck exclusion; the later natural proof also excludes actual DOM overlays.' });
 }
 const label = `natural-collisions-and-eight-birds-${width}`; await observe(label);
 const observationStarted = Date.now();
 await page.waitForFunction(() => {
  const canvas = document.querySelector('#world'), proof = window.__birdForegroundOpacity.sample(), birds = JSON.parse(canvas.dataset.skyBirds), r = canvas.getBoundingClientRect();
  if (!proof.ready || proof.errors.length) return false;
  const overlays = [...document.querySelectorAll('.scene-label,.scene-weather,.truck-floor-controls,.scene-tools,.settlement-objective,.village-order-tool,.camera-tool,.map-controls,#toast')].flatMap(element => {
   const b = element.getBoundingClientRect(), style = getComputedStyle(element);
   return b.width && b.height && style.visibility !== 'hidden' && style.display !== 'none' && Number(style.opacity) >= .2 ? [{left:b.left-r.left,top:b.top-r.top,right:b.right-r.left,bottom:b.bottom-r.top}] : [];
  });
  const visible = proof.birds.filter(item => {
   const box = item.glyph, bird = birds.find(b => b.id === item.id);
   return bird.alpha > .2 && item.unoccluded && box.left >= 0 && box.top >= 0 && box.right <= r.width && box.bottom <= r.height
    && !overlays.some(o => box.left <= o.right && box.right >= o.left && box.top <= o.bottom && box.bottom >= o.top);
  });
  if (visible.length < 5) return false;
  window.__unoccludedSkyScreenshotFrame = {proof,visibleIds:visible.map(item=>item.id),overlays}; return true;
 }, null, { timeout: 22000 });
 const naturalScreenshotFrame = await page.evaluate(() => window.__unoccludedSkyScreenshotFrame);
 const naturalScreenshot = `artifacts/v${version}-truck-floors${receiptSuffix}-five-unoccluded-silhouettes-${width}.png`;
 await page.screenshot({path:naturalScreenshot,fullPage:true}); screenshots.push(naturalScreenshot);
 const naturalScreenshotProof = {filename:naturalScreenshot,...naturalScreenshotFrame};
 await page.waitForTimeout(Math.max(0,22000-(Date.now()-observationStarted)));
 const observation = await stopObserve(), collision = collisionCheck(observation, label), animalProofs = [], ids = new Set();
 assert.ok(collision.pairsChecked > 0, 'natural roaming covers actual dynamic actor pairs');
 assert.ok(observation.frames.length >= 100, 'animal and bird motion spans naturally rendered frames');
 for (const id of ['dog', 'cat']) {
  const frames = observation.frames.map(frame => ({ frameAt: frame.movement.frameAt, pet: frame.pets.find(pet => pet.id === id) })).filter(frame => frame.pet);
  assert.ok(frames.length >= 100, `${id}: the actual animal is drawn throughout the natural observation`);
  const movingFrames = frames.filter(frame => frame.pet.pose === 'walk');
  assert.ok(movingFrames.length >= 5, `${id}: the patrol has real walking poses`);
  const travelled = frames.at(-1).pet.gait.distance - frames[0].pet.gait.distance;
  assert.ok(travelled > 15, `${id}: the patrol advances naturally around physical obstacles`);
  animalProofs.push({ id, travelled, movingFrames: movingFrames.length, blockedFrames: frames.filter(frame => frame.pet.blockedReason).length });
 }
 let maxVisible = 0;
 const visibleFrames = [];
 for (const frame of observation.frames) {
  assert.ok(Array.isArray(frame.birds) && frame.birds.length >= 5 && frame.birds.length <= 8, 'the actual drawn flock has five to eight birds');
  const unique = new Set(frame.birds.map(bird => bird.id)); assert.equal(unique.size, frame.birds.length, 'each actual bird has a separate stable identity');
  assert.equal(frame.birdForeground.ready, true, 'the actual post-flock foreground observer is ready');
  assert.equal(frame.birdForeground.frameAt, frame.movement.frameAt, 'foreground and bird draws share the same natural frame');
  assert.deepEqual(frame.birdForeground.errors, [], 'the read-only draw observer has no capture errors');
  const visible = frame.birds.filter(bird => {
   const camera = frame.camera, x = camera.dx + bird.x * camera.scale, y = camera.dy + bird.y * camera.scale;
   const world = observation.geometries[frame.geometryId].world, deck = world.floors.find(floor => floor.id === camera.activeFloor);
   return bird.alpha > .2 && x > 0 && y > 0 && x < camera.rect.width && y < camera.rect.height
    && !inside(bird, deck.outerPolygon)
    && (() => { const proof = frame.birdForeground.birds.find(item => item.id === bird.id), box = proof?.glyph;
     return proof?.unoccluded === true && box.left >= 0 && box.top >= 0 && box.right <= camera.rect.width && box.bottom <= camera.rect.height
      && !frame.birdOverlayBounds.some(overlay => box.left <= overlay.right && box.right >= overlay.left && box.top <= overlay.bottom && box.bottom >= overlay.top); })();
  });
 if (visible.length > maxVisible) { maxVisible = visible.length; visibleFrames.push({ frameAt: frame.movement.frameAt, visibleIds: visible.map(bird => bird.id), birds: frame.birds, camera: frame.camera, birdOverlayBounds: frame.birdOverlayBounds, birdForeground: frame.birdForeground, geometryId: frame.geometryId }); }
  for (const bird of frame.birds) { ids.add(bird.id); for (const key of ['x', 'y', 'wing', 'alpha', 'size']) assert.ok(Number.isFinite(bird[key]), `bird ${bird.id}: ${key} belongs to an actual draw`); }
 }
 assert.equal(ids.size, 8, 'all eight original silhouettes have stable IDs');
 assert.ok(maxVisible >= 5, `${width}: at least five silhouettes are visible together on the real canvas`);
 const birds = [...ids].map(id => {
  const samples = observation.frames.map(frame => frame.birds.find(bird => bird.id === id)), wings = samples.map(bird => bird.wing);
  const wingRange = Math.max(...wings) - Math.min(...wings), movementRange = Math.max(...samples.map(bird => distance(bird, samples[0])));
  assert.ok(wingRange > 1, `bird ${id}: wings have distinct natural up/down frames`);
  assert.ok(movementRange > 15, `bird ${id}: natural flight changes position`);
  return { id, wingRange, movementRange, glidingFrames: samples.filter(bird => bird.gliding).length };
 });
 assert.ok(observation.frames.some(frame => new Set(frame.birds.map(bird => Math.round(bird.wing * 100))).size >= 4), 'independent wing rhythms avoid a synchronized flock');
 birdProofs.push({ width, cameraSetupId, naturalScreenshot: naturalScreenshotProof, observationId: observation.id, maxVisible, visibleFrames, birds, animalProofs, collisionProofLabel: collision.label });
 await shot(`natural-animals-and-birds-${width}`);
 if (cameraSetupId !== null) await home();
}
async function floorGate(expectedFloor, requiredDeckLevel) {
 const before = await saved(); await touch(page.locator(`[data-truck-floor="${expectedFloor}"]`));
 assert.equal(await page.locator('[data-truck-floor-build]').isDisabled(), true, `floor ${expectedFloor}: purchase is gated before deck level ${requiredDeckLevel}`);
 assert.match(await page.locator('#modal-root').innerText(), new RegExp(`Lv\\.${requiredDeckLevel}`));
 assert.deepEqual(stableSave(await saved()), stableSave(before), 'viewing a locked upper platform does not grant it or spend materials');
 floorPurchases.push({ kind: 'locked-gate', floor: expectedFloor, requiredDeckLevel, before, after: await saved() }); await closeModal();
}
async function purchaseFloor(floor, requiredDeckLevel, cost) {
 const before = await saved();
 const sheetOpener = page.locator('#modal-root [data-open="floors"]');
 await touch(await sheetOpener.isVisible() ? sheetOpener : page.locator('.truck-floor-controls [data-open="floors"]'));
 await page.locator('[data-truck-floor-build]').waitFor();
 assert.equal(before.truckLayout?.floors ?? 1, floor - 1); assert.ok(before.deckLevel >= requiredDeckLevel);
 assert.equal(await page.locator('[data-truck-floor-build]').isDisabled(), false);
 const input = await touch(page.locator('[data-truck-floor-build]')), after = await saved();
 assert.equal(after.truckLayout.floors, floor); assert.equal(after.resources.wood, before.resources.wood - cost.wood); assert.equal(after.resources.scrap, before.resources.scrap - cost.scrap);
 for (const key of ['food', 'water', 'seeds']) assert.equal(after.resources[key], before.resources[key]);
 for (const key of ['companions', 'animalReserve', 'plots', 'xp', 'stats', 'health', 'energy', 'settlement']) assert.deepEqual(after[key], before[key], `paid floor purchase preserves ${key}`);
 assert.equal(await page.locator(`[data-truck-floor="${floor}"]`).getAttribute('aria-pressed'), 'true', 'the newly paid floor becomes the selected map');
 await cameraSettled(); const frame = await rendered(); assert.equal(frame.geometry.activeFloor, floor); physicalFloor(frame.movement.world, floor);
 const purchase = { kind: 'paid', floor, requiredDeckLevel, cost, before, after, input, selectedView: frame.geometry };
 floorPurchases.push(purchase); return purchase;
}
async function writePaidSave(name, setup) {
 const save = await saved(), wrapper = { version, snapshotId, finalSnapshot, baseUrl, executionInputs, save, setup, paidPurchases: floorPurchases.filter(item => item.kind === 'paid'), sha256OfSave: sha(JSON.stringify(save)) };
 const filename = `artifacts/truck-floors-v${version}-${name}${receiptSuffix}.json`; await writeFile(filename, JSON.stringify(wrapper, null, 2) + '\n'); return { filename, sha256: sha(await readFile(filename)), wrapper };
}
async function legacyInput() {
 const sourceReceipt = 'artifacts/pwa-upgrade-v0.19.0-to-v0.20.0-verification.json', bytes = await readFile(sourceReceipt), receipt = JSON.parse(bytes);
 assert.equal(receipt.status, 'passed'); assert.equal(receipt.version, '0.20.0'); assert.equal(receipt.finalSnapshot, true); assert.equal(receipt.snapshotId, 'v020-r1');
 return { sourceReceipt, sourceReceiptSha256: sha(bytes), sourceSnapshotId: receipt.snapshotId, save: structuredClone(receipt.saveAfter) };
}
async function checkLegacyMigration(input) {
 await begin(390, 844, { kind: 'genuine-v20-save', earned: true, ...input });
 const loaded = await saved();
 for (const key of ['name', 'gender', 'resources', 'companions', 'animalReserve', 'companionTeam', 'maxCompanionTeamSize', 'plots', 'stats', 'xp', 'level', 'health', 'energy', 'settlement', 'facilityHistory', 'growthQuests', 'villageOrders']) assert.deepEqual(loaded[key], input.save[key], `v20 migration preserves genuine earned ${key}`);
 const footprint = houseInside(await rendered(), 'legacy-migrated-house');
 legacyMigration = { ...input, loaded, footprint, clock: 'Only real loading/pausing time may advance; original paid facility timestamps are unchanged.' };
 await context.close();
}
async function freshViewport(width, height) {
 await begin(width, height); const initial = await saved(), initialFootprint = houseInside(await rendered(), `fresh-home-${width}`);
 await shot(`fresh-contained-house-${width}`); console.log(`START ${width}×${height}: fresh house and natural placement`);
 // The first deck has an actual alternative house position; no unlock fixture
 // or resource purchase is needed to demonstrate the completed-home feature.
 await relocateHouse(1, 4); await relocateHouse(1, 0, { cancelFirst: false });
 const earned = [];
 for (let i = 0; i < 3; i++) earned.push(await gather());
 await expandDeck();
 console.log(`PASS ${width}: real resources gathered and deck expanded`);
 const plannedSlot = (await rendered()).slots.find(slot => slot.slot === 0);
 await walkFloor(`deliberate-hero-occupied-placement-${width}`, 1, { insidePolygon: plannedSlot.polygon, minDistance: 15 });
 const waterworks = await build('waterworks', 0), kitchen = await build('kitchen', 1);
 console.log(`PASS ${width}: actor-occupied target rejected, two facilities built`);
 const production = await startProduction(waterworks.id);
 const moved = await relocateFacility(waterworks.id, 2, kitchen.id);
 assert.equal(moved.startedAt, production.building.startedAt); assert.equal(moved.readyAt, production.building.readyAt);
 await relocateHouse(1, 1, { invalidFacility: kitchen.id });
 await home(); await naturalAnimalsAndBirds(width);
 const pets = (await rendered()).pets, near = { x: pets.reduce((sum, pet) => sum + pet.body.x, 0) / pets.length, y: pets.reduce((sum, pet) => sum + pet.body.y, 0) / pets.length };
 await walkFloor(`fresh-hero-crosses-patrol-${width}`, 1, { near });
 await walkFloor(`fresh-hero-returns-around-buildings-${width}`, 1);
 freshFlows.push({ viewport: { width, height }, initial, initialFootprint, earned: earned.map(job => ({ label: job.label, before: job.before, after: job.after, observationId: job.observation.id })), production, completed: await saved(), earnedProgression: true });
 cases.push(`${width}×${height}: fresh paid construction, completed house movement, producing facility movement and invalid/cancel integrity, full physical actor footprints, independent flying birds.`);
 console.log(`PASS fresh truck-floor flow ${width}×${height}`); await context.close();
}
async function upgradeFacility(id) {
 const facility = effectiveBuildings(await saved()).find(item => item.id === id);
 await touch(page.locator(`[data-truck-floor="${Math.floor(facility.slot / 16) + 1}"]`)); await actualHit('facility', id);
 await touch(page.locator(`[data-facility-upgrade="${id}"]`));
 const result = await chore(`upgrade-upper-building-${id}`, 'upgrade', () => touch(page.locator(`[data-upgrade-confirm="${id}"]`)));
 const upgraded = effectiveBuildings(result.after).find(item => item.id === id); assert.equal(upgraded.level, facility.level + 1); assert.equal(upgraded.slot, facility.slot);
 assert.equal(result.after.resources.wood, result.before.resources.wood - 24); assert.equal(result.after.resources.scrap, result.before.resources.scrap - 8);
 await closeFacility(); return upgraded;
}
async function offlineReload(label) {
 if (diagnosticOnly) { offlineProofs.push({ label, actualOfflineReload: false, unrunReason: 'Mutable Vite diagnostic has no production service worker; the immutable final suite must execute this case.' }); return; }
 await home(); await pauseWorld(); const before = await saved();
 await page.waitForFunction(() => navigator.serviceWorker.getRegistration().then(registration => registration?.active?.state === 'activated'), null, { timeout: 30000 });
 const controllerBefore = await page.locator('#app').evaluate(app => JSON.parse(app.dataset.webUpdateDiagnostics));
 const renderedBuildId = await page.locator('meta[name="road-haven-build"]').getAttribute('content');
 assert.ok(renderedBuildId && /^[0-9a-f]{64}$/.test(renderedBuildId));
 const firstInstallWasUncontrolled = controllerBefore.controllerBuildId == null;
 if (!firstInstallWasUncontrolled) assert.equal(controllerBefore.controllerBuildId, renderedBuildId);
 await context.setOffline(true); await page.reload({ waitUntil: 'domcontentloaded' }); await page.locator('#resident-name').getByText(before.name, { exact: true }).waitFor(); await pauseWorld();
 const after = await saved(), controllerAfter = await page.locator('#app').evaluate(app => JSON.parse(app.dataset.webUpdateDiagnostics));
 for (const key of ['resources', 'companions', 'animalReserve', 'plots', 'stats', 'xp', 'health', 'energy', 'settlement', 'truckLayout', 'facilityHistory', 'growthQuests', 'villageOrders']) assert.deepEqual(after[key], before[key], `offline restart preserves ${key}`);
 assert.equal(controllerAfter.controllerBuildId, renderedBuildId, 'the cached offline navigation is controlled by the exact loaded release'); assert.equal(controllerAfter.applying, false);
 await walkFloor(`${label}-offline-upper-walk`, 3); await shot(`${label}-offline-upper-floor`);
 offlineProofs.push({ label, before, after, renderedBuildId, firstInstallWasUncontrolled, controllerBefore, controllerAfter, actualOfflineReload: true }); await context.setOffline(false);
}
async function paidUpperFloors(input) {
 const save = structuredClone(input.save), setup = {
  kind: 'declared-late-deck-setup', earnedByGameplay: false, sourceReceipt: input.sourceReceipt, sourceReceiptSha256: input.sourceReceiptSha256, sourceSnapshotId: input.sourceSnapshotId, earned: false,
  reason: 'Isolate late platform unlocks without claiming that injected materials or deck progress were earned.',
  changes: [{ field: 'deckLevel', from: save.deckLevel, to: 3 }, { field: 'stats.expansions', from: save.stats.expansions, to: 2 }, { field: 'plots', from: structuredClone(save.plots), to: [...structuredClone(save.plots), { id: 4, plantedAt: null, watered: false }, { id: 5, plantedAt: null, watered: false }] }, { field: 'resources', from: structuredClone(save.resources), to: { ...save.resources, wood: 650, scrap: 350 } }],
 };
 save.deckLevel = 3; save.stats.expansions = 2; save.plots.push({ id: 4, plantedAt: null, watered: false }, { id: 5, plantedAt: null, watered: false }); save.resources = { ...save.resources, wood: 650, scrap: 350 };
 await begin(390, 844, { ...setup, save }); await floorGate(2, 4); await expandDeck(); console.log('PASS declared late setup: actual Lv4 unlock');
 await purchaseFloor(2, 4, { wood: 100, scrap: 50 });
 await shot('actual-paid-second-floor'); console.log('PASS actual paid floor2');
 const firstStairs = await walkFloor('actual-first-floor-to-second-floor', 2);
 assert.ok(firstStairs.observation.frames.some(frame => frame.movement.body.surface === 'ladder' && frame.movement.body.link === '1-2'), 'the hero physically climbs the paid first-to-second-floor stairs');
 const upper = await build('waterworks', 16); assert.ok(upper.id >= 17 && upper.id <= 48, 'upper facilities use compatibility sidecar identities');
 await upgradeFacility(upper.id); const production = await startProduction(upper.id);
 await relocateFacility(1, 17); const moved = await relocateFacility(upper.id, 18, 1);
 assert.equal(moved.level, 2); assert.equal(moved.readyAt, production.building.readyAt); assert.equal(moved.startedAt, production.building.startedAt);
 await floorGate(3, 7);
 while ((await saved()).deckLevel < 7) await expandDeck();
 const floor2State = await writePaidSave('paid-floor2-save', setup);
 await purchaseFloor(3, 7, { wood: 160, scrap: 80 });
 await shot('actual-paid-third-floor'); console.log('PASS actual paid floor3');
 await walkFloor('second-floor-to-first-floor', 1);
 const bothStairs = await walkFloor('first-floor-through-both-stairs-to-third', 3);
 const links = new Set(bothStairs.observation.frames.filter(frame => frame.movement.body.surface === 'ladder').map(frame => frame.movement.body.link));
 assert.ok(links.has('1-2') && links.has('2-3'), 'the actual journey traverses both paid stair links');
 await relocateHouse(3, 1); await relocateFacility(upper.id, 33);
 const kitchen = await build('kitchen', 32); assert.ok(kitchen.id >= 17 && kitchen.id <= 48 && kitchen.id !== upper.id);
 // Production uses the real game clock, which prior placement assertions
 // deliberately paused. Resume through the visible UI and wait for the saved
 // batch deadline before collecting; chores do not silently advance it.
 await pauseWorld(false);
 await page.waitForFunction(id => {
  const slot = JSON.parse(document.querySelector('#world').dataset.settlementSlots).find(item => item.buildingId === id);
  return slot?.action === 'facility-collect' && slot.remainingSeconds <= 0;
 }, upper.id, { timeout: 15000 });
 await pauseWorld(true);
 const beforeCollection = await saved(); await actualHit('facility', upper.id);
 const readyBuilding = beforeCollection.truckLayout.upperBuildings.find(item => item.id === upper.id);
 assert.equal(readyBuilding.startedAt, production.building.startedAt, 'natural production keeps its original start through relocation');
 assert.equal(readyBuilding.readyAt, production.building.readyAt, 'natural production keeps its original deadline through relocation');
 assert.ok(beforeCollection.totalMinutes >= readyBuilding.readyAt, 'the live ready indicator agrees with the real saved game clock after pausing');
 assert.equal(await page.locator(`[data-facility-collect="${upper.id}"]`).isEnabled(), true, 'the natural production deadline exposes a ready collection control');
 await touch(page.locator(`[data-facility-collect="${upper.id}"]`)); const collected = await saved();
 assert.equal(collected.resources.water, beforeCollection.resources.water + 8, 'the moved upgraded waterworks pays its original earned batch once');
 await closeFacility(); await startProduction(upper.id); await closeFacility();
 await walkFloor('third-floor-manual-walk-around-moved-home', 3);
 const upperBeforeFarmNavigation = (await rendered()).movement;
 const farmNavigationInput = await touch(page.locator('[data-nav="farm"]'));
 await cameraSettled();
 const farmNavigation = await rendered();
 assert.equal(farmNavigation.geometry.activeFloor, 1, 'the actual farming navigation shows the first-floor plots automatically');
 assert.equal(farmNavigation.movement.floor, 3, 'showing the farm preserves the hero on its physical upper floor');
 assert.ok(distance(farmNavigation.movement.position, upperBeforeFarmNavigation.position) < 2, 'farm navigation changes the camera without teleporting the hero');
 if ((await saved()).energy < 4) await touch(page.locator('[data-quick="rest"]'));
 const farm = await chore('third-floor-to-first-floor-harvest-and-return', 'harvest', () => actualHit('farm', 1));
 farm.farmNavigation = { input: farmNavigationInput, before: upperBeforeFarmNavigation, after: farmNavigation.movement, geometry: farmNavigation.geometry };
 upperFloorJobs.at(-1).farmNavigation = farm.farmNavigation;
 assert.equal(farm.after.stats.harvests, farm.before.stats.harvests + 1);
 assert.equal(farm.after.resources.food, farm.before.resources.food + 4);
 assert.equal(farm.from.floor, 3); assert.equal(farm.final.floor, 3);
 assert.ok(farm.observation.frames.some(frame => frame.action.climbing === 'down') && farm.observation.frames.some(frame => frame.action.climbing === 'up'), 'actual farming descends from the upper home and physically returns by stairs');
 await home();
 const completed = await saved(); assert.deepEqual(completed.settlement.buildings, input.save.settlement.buildings, 'cross-floor legacy relocation leaves the backward-compatible paid records intact');
 assert.ok(completed.truckLayout.placements.some(item => item.id === 1 && item.slot === 17));
 assert.equal(completed.truckLayout.upperBuildings.length, 2); assert.equal(new Set(effectiveBuildings(completed).map(item => item.id)).size, effectiveBuildings(completed).length);
 paidFloorSave = await writePaidSave('paid-save', setup);
 paidFloorSave.intermediate = { filename: floor2State.filename, sha256: floor2State.sha256 };
 await shot('three-paid-floors-home-and-upper-buildings'); await offlineReload('paid-three-floor-village');
 cases.push('Declared late setup: genuine paid deck upgrades, Lv4/Lv7 platform resource purchases, physical stairs both directions, upper construction and upgrade, producing cross-floor relocation, completed-home third-floor relocation, sidecar identity integrity and cached offline continuity.');
 await context.close(); return completed;
}
async function upperFloorViewport(width, height, save, source) {
 await begin(width, height, { kind: 'copy-of-actual-ui-paid-late-state', earned: false, sourceReceipt: source.filename, sourceReceiptSha256: source.sha256, changes: [], save });
 for (const floor of [1, 2, 3]) {
  const before = await saved(), input = await touch(page.locator(`[data-truck-floor="${floor}"]`)); await cameraSettled(); const frame = await rendered();
  assert.equal(frame.geometry.activeFloor, floor); assert.equal(await page.locator(`[data-truck-floor="${floor}"]`).getAttribute('aria-pressed'), 'true');
  assert.ok(frame.slots.length > 0 && frame.slots.every(slot => Math.floor(slot.slot / 16) + 1 === floor), `${width}: only the selected floor's physical facility slots are exposed`);
  assert.deepEqual(stableSave(await saved()), stableSave(before), 'floor map selection changes no paid save data');
  floorViews.push({ width, height, floor, before, after: await saved(), geometry: frame.geometry, slots: frame.slots, input });
  await shot(`floor-${floor}-view-${width}`);
 }
 await walkFloor(`upper-third-floor-real-walk-${width}`, 3);
 const down = await walkFloor(`upper-third-to-first-floor-${width}`, 1);
 assert.ok(down.observation.frames.some(frame => frame.movement.body.link === '2-3') && down.observation.frames.some(frame => frame.movement.body.link === '1-2'), 'the small viewport retains both real staircase segments');
 await walkFloor(`upper-first-to-second-floor-${width}`, 2); await walkFloor(`upper-second-to-third-floor-${width}`, 3);
 await shot(`upper-real-feet-${width}`); cases.push(`${width}×${height}: all three purchased floor maps and slots, construction IDs and natural physical stairs remain usable.`); await context.close();
}
async function saveReceipt(status, error) {
 await writeFile(`artifacts/truck-floors-v${version}${receiptSuffix}-verification.json`, JSON.stringify({ version, status, baseUrl, snapshotId, finalSnapshot, diagnosticOnly, executionInputs, assertionsExecuted,
  startedAt: startedAt.toISOString(), finishedAt: new Date().toISOString(), input: 'Actual mobile touchscreen/CDP gestures; read-only native pointer release and rendered telemetry',
  clock: 'Natural browser timers/RAF; no page.clock, source function calls or synthesized workers', deviceLimit: 'Chromium phone/landscape emulation; physical Android and iPhone are not claimed',
  observations, cameraProofs, groundCandidateReadiness, freshFlows, legacyMigration, fixtures, houseMoves, facilityMoves, floorPurchases, floorViews, upperFloorJobs, stairJourneys, collisionProofs, birdProofs, placementGuards, offlineProofs, paidFloorSave, screenshots, cases, errors, failedAssets, failureEvidence,
  ...(error ? { failure: String(error), stack: error.stack } : {}) }, null, 2) + '\n');
}
try {
 browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
 for (const [width, height] of diagnosticOnly ? [[390, 844]] : [[390, 844], [360, 740], [844, 390]]) await freshViewport(width, height);
 const legacy = await legacyInput(); await checkLegacyMigration(legacy); const completed = await paidUpperFloors(legacy);
 if (!diagnosticOnly) { await upperFloorViewport(360, 740, completed, paidFloorSave); await upperFloorViewport(844, 390, completed, paidFloorSave); }
 assert.deepEqual(errors, []); assert.deepEqual(failedAssets, []); await saveReceipt(finalSnapshot ? 'passed' : 'diagnostic-passed');
 console.log(`PASS truck floors: ${assertionsExecuted} assertions; ${floorPurchases.filter(item => item.kind === 'paid').length} actual platform purchases; ${stairJourneys.length} natural journeys.`);
} catch (error) {
 if (page && !page.isClosed()) { failureEvidence = await page.evaluate(() => ({ observation: window.__truckObservation, actualTouch: window.__lastTruckTouch, actualHit: window.__lastTruckHit, openModal: document.querySelector('#modal-root')?.innerText, cameraSettling: window.__truckCameraSettling,
  freeMovement: JSON.parse(document.querySelector('#world')?.dataset.freeMovement || 'null'), sceneAction: JSON.parse(document.querySelector('#world')?.dataset.sceneAction || 'null'), sceneGeometry: JSON.parse(document.querySelector('#world')?.dataset.sceneGeometry || 'null'),
  slots: JSON.parse(document.querySelector('#world')?.dataset.settlementSlots || 'null'), saved: JSON.parse(localStorage.getItem('road-haven-save-v1')) })).catch(() => null); await shot('failure').catch(() => {}); }
 await saveReceipt('failed', error); throw error;
} finally { if (browser) await browser.close(); }
