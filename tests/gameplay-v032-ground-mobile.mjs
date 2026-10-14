import { chromium } from '@playwright/test';
import strictAssert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { captureExecutionInputs } from './release-execution-inputs.mjs';

// Ordinary saved games are the only startup fixtures. All subsequent actions,
// countdowns, energy recovery, map hits and respawns use the real browser clock.
const version = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')).version;
const baseUrl = process.env.TEST_BASE_URL ?? 'http://127.0.0.1:5173/';
const snapshotId = process.env.TEST_SNAPSHOT_ID ?? 'mutable-development-diagnostic';
const finalSnapshot = process.env.TEST_FINAL_SNAPSHOT === '1';
const diagnosticOnly = process.env.TEST_V032_DIAGNOSTIC === '1';
if (finalSnapshot === diagnosticOnly) throw Error('Choose immutable final snapshot or mutable development diagnostic.');
const visualOnly = process.env.TEST_V032_VISUAL_ONLY === '1';
if (visualOnly && finalSnapshot) throw Error('Visual-only inspection is a development diagnostic, never final release QA.');
const receiptTag = process.env.TEST_RECEIPT_TAG ?? `run-${Date.now()}`;
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(receiptTag)) throw Error('Receipt tag must be a safe unique suffix.');
const sha = value => createHash('sha256').update(value).digest('hex');
let assertionsExecuted = 0;
const assert = new Proxy(strictAssert, { get(target, key) { const value = Reflect.get(target, key); return typeof value === 'function' ? (...args) => { assertionsExecuted++; return value(...args); } : value; } });
const previousReceiptPath = 'artifacts/v031-gathering-final-r1-verification.json';
const revisionPaths = [];
const executionInputs = await captureExecutionInputs(import.meta.url, { snapshotId, finalSnapshot, dependencies: [previousReceiptPath, ...revisionPaths] });
const executedTestBackupPath = `artifacts/diagnostics/v032-${receiptTag}/executed-harness.mjs`;
await mkdir(`artifacts/diagnostics/v032-${receiptTag}`, { recursive: true });
const executedTestBytes = await readFile(executionInputs.testPath);
await writeFile(executedTestBackupPath, executedTestBytes, { flag: 'wx' });
const executedTestBackup = { path: executedTestBackupPath, bytes: executedTestBytes.length, sha256: sha(executedTestBytes) };
assert.equal(executedTestBackup.sha256, executionInputs.testSha256, 'preserve the exact executed harness before any diagnostic can fail');
async function sourceHashes() {
  const list = spawnSync('rg', ['--files', '--hidden', '--no-ignore', 'src', 'public', 'scripts', 'index.html', 'package.json', 'package-lock.json', 'release-version.json', 'content-release.json', 'capacitor.config.ts', 'vite.config.ts', 'tsconfig.json'], { encoding: 'utf8' });
  if (list.status !== 0) throw Error(list.stderr);
  return Object.fromEntries(await Promise.all(list.stdout.trim().split('\n').sort().map(async path => [path, sha(await readFile(path))])));
}
const receipt = { schemaVersion: 1, version, baseUrl, snapshotId, finalSnapshot, diagnosticOnly, receiptTag,
  executionInputs, executedTestBackup, sourceHashesAtStart: await sourceHashes(), status: 'running', startedAt: new Date().toISOString(),
  visualOnly, scope: 'Chromium mobile emulation; native touches, natural RAF, exact ordinary saved-game startup, genuine 180000ms node regeneration and 20000ms energy recovery. No timer, clock, route, position, energy or economic grants after startup.',
  fixtures: [], inputs: [], focuses: [], collections: [], depletion: [], regenerations: [], recovery: [], walks: [], blockedInputs: [], collisions: [], reloads: [], screenshots: [], visualGround: [], httpIdentity: [], errors: [], failedAssets: [] };
receipt.testRevisions = await Promise.all(revisionPaths.map(async path => { const bytes = await readFile(path); return { path, sha256: sha(bytes), explanation: JSON.parse(bytes) }; }));
let browser, currentPage, currentContext, currentCase = 'preflight', currentStep = 'preflight';
const stable = state => { const copy = structuredClone(state); delete copy.lastSaved; return copy; };
const economy = state => ({ resources: state.resources, seedInventory: state.seedInventory, xp: state.xp, stats: state.stats, quests: state.quests, gathering: state.gathering, roadside: state.roadside });
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
// Match the scene's selectable kinds while feet are outdoors. Deck-only hits
// must not exclude an otherwise empty real ground walking target.
const roadInteractiveKinds = ['road-entry', 'pet-gate', 'outdoor-site', 'ground-resource', 'pet', 'character', 'grove-work', 'grove'];
function domain(operation, input = {}) {
  const script = `import {createGame,loadGame,advanceTime} from './src/game.ts';
import {recoverEnergy} from './src/energy-recovery.ts';
import {performGatheringAction,getGatheringNode,migrateLegacyGatheringFields,GATHERING_REGENERATION_MS} from './src/gathering.ts';
import {GROUND_RESOURCE_NODES,GROUND_RESOURCE_ZONES} from './src/ground-resources.ts';
import {ROADSIDE_RULES} from './src/roadside.ts';
import {GROUND_LANDSCAPE_BOUNDS,GROUND_BACKGROUND_BOUNDS,GROUND_BACKGROUND_TILES,getGroundResourceVisual,getGroundVisualBounds,getGroundVisualPolygon} from './src/ground-visuals.ts';
const op=process.argv[1],input=JSON.parse(process.argv[2]);
if(op==='fresh')console.log(JSON.stringify(createGame('female','개별 숲 나무 검수')));
else if(op==='load'){const s=loadGame({getItem:()=>JSON.stringify(input)});console.log(JSON.stringify({...s,...migrateLegacyGatheringFields(s)}));}
else if(op==='clock')console.log(JSON.stringify(advanceTime(input.state,input.minutes)));
else if(op==='recover')console.log(JSON.stringify(recoverEnergy(input.state,input.now)));
else if(op==='collect')console.log(JSON.stringify(performGatheringAction(input.state,input.id,input.now)));
else if(op==='view')console.log(JSON.stringify(getGatheringNode(input.state,input.id,input.now)));
else if(op==='catalog')console.log(JSON.stringify({nodes:GROUND_RESOURCE_NODES,zones:GROUND_RESOURCE_ZONES,rules:ROADSIDE_RULES,regenMs:GATHERING_REGENERATION_MS}));
else if(op==='visualCatalog')console.log(JSON.stringify({landscapeBounds:GROUND_LANDSCAPE_BOUNDS,backgroundBounds:GROUND_BACKGROUND_BOUNDS,tiles:GROUND_BACKGROUND_TILES,nodes:GROUND_RESOURCE_NODES.map(node=>({id:node.id,art:getGroundResourceVisual(node),bounds:getGroundVisualBounds(node),polygon:getGroundVisualPolygon(node),...(node.kind==='tree'?{stump:{art:getGroundResourceVisual(node,'stump'),bounds:getGroundVisualBounds(node,'stump')}}:{depleted:{art:getGroundResourceVisual(node,'depleted'),bounds:getGroundVisualBounds(node,'depleted')}})}))}));`;
  const result = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script, operation, JSON.stringify(input)], { encoding: 'utf8' });
  assert.equal(result.status, 0, `actual domain is executable: ${result.stderr}`);
  return JSON.parse(result.stdout);
}
const catalog = domain('catalog');
assert.equal(catalog.regenMs, 180000);
assert.equal(catalog.nodes.length, 28);
assert.deepEqual(catalog.nodes.filter(n => n.kind === 'tree').map(n => n.id), Array.from({ length: 16 }, (_, i) => `tree-${String(i + 1).padStart(2, '0')}`));
for (const kind of ['scrap', 'seed', 'water']) assert.equal(catalog.nodes.filter(n => n.kind === kind).length, 4);
receipt.catalog = catalog;
receipt.visualCatalog = domain('visualCatalog');
async function fixture(paid = false) {
  if (!paid) return { save: domain('fresh'), paid: false, provenance: { kind: 'actual-createGame', declaration: 'Exact ordinary new game; no resources, progress or timestamps edited.' } };
  const bytes = await readFile(previousReceiptPath), prior = JSON.parse(bytes);
  assert.equal(sha(bytes), '3007ddeaa7675255bb996eb2b26d099d0bb41551d1b036a6856a7c5c891ad69a');
  assert.equal(prior.status, 'passed'); assert.equal(prior.finalSnapshot, true);
  const save = structuredClone(prior.fixtures[2].after);
  assert.equal(sha(JSON.stringify(save)), '10df471d187647d6bb02588438d777fc8b37c99e3d0b933bded78a0201a9e186');
  assert.equal(save.deckLevel, 7); assert.equal(save.truckLayout.floors, 3);
  return { save, paid: true, provenance: { kind: 'immutable-v031-observed-paid-final-save', path: previousReceiptPath, receiptSha256: sha(bytes), jsonPointer: '/fixtures/2/after', saveJsonSha256: sha(JSON.stringify(save)), declaration: 'Exact earlier paid village without economic edits; normal production startup applies genuine absence and old gathering migration.' } };
}
const saved = () => currentPage.evaluate(() => JSON.parse(localStorage.getItem('road-haven-save-v1')));
async function frame(capturePng = false) {
  return currentPage.locator('#world').evaluate((canvas, capturePng) => {
    const matrix = canvas.getContext('2d').getTransform();
    return { realAt: Date.now(), at: performance.now(), renderTransform: { a: matrix.a, b: matrix.b, c: matrix.c, d: matrix.d, e: matrix.e, f: matrix.f, dpr: Math.min(devicePixelRatio || 1, 2) },
      geometry: JSON.parse(canvas.dataset.sceneGeometry), movement: JSON.parse(canvas.dataset.freeMovement), action: JSON.parse(canvas.dataset.sceneAction),
      hits: JSON.parse(canvas.dataset.sceneHits), outdoor: JSON.parse(canvas.dataset.outdoorGround), pets: JSON.parse(canvas.dataset.petMotion || '[]'), canvasPixels: { width: canvas.width, height: canvas.height }, rect: canvas.getBoundingClientRect().toJSON(), ...(capturePng ? { canvasPng: canvas.toDataURL('image/png') } : {}) };
  }, capturePng);
}
async function touch(locator) {
  await locator.scrollIntoViewIfNeeded();
  await locator.evaluate(async element => { const list = []; for (let node = element; node; node = node.parentElement) list.push(...node.getAnimations().filter(a => a.effect?.getComputedTiming().iterations !== Infinity)); await Promise.all(list.map(a => a.finished.catch(() => {}))); });
  const bounds = await locator.boundingBox();
  assert.ok(bounds && bounds.width >= 44 && bounds.height >= 44, `actual touch control is at least44px: ${JSON.stringify(bounds)}`);
  const point = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  assert.equal(await locator.evaluate((button, p) => document.elementFromPoint(p.x, p.y)?.closest('button') === button, point), true, 'native touch reaches intended control');
  const viewport = currentPage.viewportSize();
  assert.ok(bounds.x >= -1 && bounds.y >= -1 && bounds.x + bounds.width <= viewport.width + 1 && bounds.y + bounds.height <= viewport.height + 1, 'whole button fits after ordinary scrolling');
  receipt.inputs.push({ case: currentCase, step: currentStep, kind: 'native-touchscreen', bounds, point, label: await locator.getAttribute('aria-label') ?? await locator.innerText() });
  await currentPage.touchscreen.tap(point.x, point.y);
  return { bounds, point };
}
async function closeModal() { if (await currentPage.locator('#modal-root').isVisible()) await touch(currentPage.locator('#modal-root [data-close]').first()); }
async function pause() {
  await closeModal(); await touch(currentPage.locator('[data-open="menu"]')); await touch(currentPage.locator('#modal-root [data-open="settings"]'));
  if (await currentPage.locator('.time-button').getAttribute('aria-label') !== '시간 계속') await touch(currentPage.locator('#modal-root [data-pause]'));
  await touch(currentPage.locator('#modal-root [data-save]')); await closeModal();
  assert.equal(await currentPage.locator('.time-button').getAttribute('aria-label'), '시간 계속');
}
async function settled() {
  await currentPage.evaluate(() => { window.__v032CameraPrevious = null; window.__v032CameraStable = 0; });
  await currentPage.waitForFunction(() => { const c = document.querySelector('#world'); if (!c?.dataset.sceneGeometry) return false; const g = JSON.parse(c.dataset.sceneGeometry), m = JSON.parse(c.dataset.freeMovement), old = window.__v032CameraPrevious; if (old?.at === m.frameAt) return false; window.__v032CameraPrevious = { at: m.frameAt, dx: g.dx, dy: g.dy, scale: g.scale }; window.__v032CameraStable = old && Math.abs(g.dx - old.dx) < .25 && Math.abs(g.dy - old.dy) < .25 && Math.abs(g.scale - old.scale) < .0005 ? window.__v032CameraStable + 1 : 0; return window.__v032CameraStable >= 3; }, null, { timeout: 7000 });
}
async function shot(label) {
  const path = `artifacts/v032-ground-${receiptTag}-${String(receipt.screenshots.length + 1).padStart(2, '0')}-${label}.png`;
  await currentPage.screenshot({ path, fullPage: true }); const bytes = await readFile(path);
  receipt.screenshots.push({ case: currentCase, path, bytes: bytes.length, sha256: sha(bytes) });
}
async function groundShot(label) {
  await closeModal();
  await currentPage.waitForFunction(() => { const raw = document.querySelector('#world')?.dataset.outdoorGround; return raw && JSON.parse(raw).terrain?.ready === true; }, null, { timeout: 15000 });
  await settled();
  const { canvasPng, ...f } = await frame(true), path = `artifacts/v032-ground-${receiptTag}-${String(receipt.screenshots.length + 1).padStart(2, '0')}-${label}-raw-canvas.png`;
  assert.deepEqual(f.outdoor.terrain.fixedWorldBounds, receipt.visualCatalog.landscapeBounds, 'new terrain stays attached to exact world bounds through every real camera change');
  assert.equal(f.outdoor.terrain.style, 'painted-continuous-ground');
  assert.equal(f.outdoor.terrain.asset, 'ground-landscape');
  assert.equal(f.outdoor.terrain.cameraIndependent, true);
  assert.deepEqual(f.outdoor.terrain.coverageWorldBounds, receipt.visualCatalog.backgroundBounds);
  assert.equal(f.outdoor.terrain.tileMode, 'fixed-mirrored-background');
  const matrix = f.renderTransform, determinant = matrix.a * matrix.d - matrix.b * matrix.c, coverage = f.outdoor.terrain.coverageWorldBounds;
  assert.ok(Math.abs(determinant) > 0);
  const worldCorners = [[0, 0], [f.canvasPixels.width, 0], [f.canvasPixels.width, f.canvasPixels.height], [0, f.canvasPixels.height]].map(([x, y]) => ({ x: (matrix.d * (x - matrix.e) - matrix.c * (y - matrix.f)) / determinant, y: (matrix.a * (y - matrix.f) - matrix.b * (x - matrix.e)) / determinant }));
  for (const p of worldCorners) assert.ok(p.x >= coverage.left - .002 && p.x <= coverage.right + .002 && p.y >= coverage.top - .002 && p.y <= coverage.bottom + .002, `fixed background covers the actual rendered canvas corner ${JSON.stringify(p)}`);
  assert.deepEqual(f.outdoor.terrain.paintedTrailIds, ['grove']);
  assert.equal(f.outdoor.terrain.capsulePaths, false, 'four parallel capsule paths are absent from the actual render');
  assert.equal(f.outdoor.terrain.actorDepth, 'foot-y', 'ground actors and props use painted foot depth');
  assert.equal(f.outdoor.terrain.treeVariants, 3);
  for (const rendered of f.outdoor.nodes) {
    const canonical = receipt.visualCatalog.nodes.find(n => n.id === rendered.id), node = catalog.nodes.find(n => n.id === rendered.id), art = rendered.art;
    assert.equal(art.ready, true, 'new atlas asset loaded in the actual browser');
    assert.equal(art.painted, true, 'actual resource sprite drawing completed');
    assert.equal(art.sourceAtlas, 'ground-props');
    assert.deepEqual(art.anchor, { x: node.point[0], y: node.point[1] }, 'painted foot contact stays at the canonical solid resource point');
    assert.deepEqual(rendered.spriteBounds, canonical.bounds, 'painted resource bounds use measured original atlas contact');
    const visual = rendered.visual === 'stump' ? canonical.stump : rendered.visual === 'depleted' ? canonical.depleted : canonical;
    const expected = visual.art;
    assert.deepEqual(art.bounds, visual.bounds, 'actual depleted and ready sprites retain their measured foot contact');
    for (const key of ['sprite', 'variant', 'width', 'height']) assert.equal(art[key], expected[key]);
  }
  assert.deepEqual([...new Set(f.outdoor.nodes.filter(n => n.kind === 'tree').map(n => n.art.variant))].sort(), [0, 1, 2], 'the actual rendered forest contains three different tree silhouettes');
  const selectedSite = f.geometry.resourceFocus?.siteId;
  if (selectedSite) {
    const v = f.geometry.viewport, visible = f.outdoor.nodes.filter(n => n.siteId === selectedSite && v.safeLeft <= n.x && n.x <= v.width - v.safeRight && v.safeTop <= n.y && n.y <= v.height - v.safeBottom);
    assert.ok(visible.length);
    for (const n of visible) { const [left, top, right, bottom] = n.screenBounds; assert.ok(right - left >= 30 && bottom - top >= 17, 'focused painted resource is readable in real screen pixels'); }
  }
  const bytes = Buffer.from(canvasPng.split(',')[1], 'base64');
  await writeFile(path, bytes);
  const evidence = { case: currentCase, label, capture: 'actual-world-canvas-toDataURL', path, bytes: bytes.length, sha256: sha(bytes), canvasPixels: f.canvasPixels, coverageProof: { worldCorners, coverageBounds: coverage }, frame: f };
  receipt.screenshots.push({ case: currentCase, capture: evidence.capture, path, bytes: bytes.length, sha256: evidence.sha256 });
  receipt.visualGround.push(evidence); return evidence;
}
async function fullGroundShot() {
  await closeModal(); const originalViewport = currentPage.viewportSize(), before = await saved();
  await currentPage.setViewportSize({ width: 1680, height: 1120 });
  await touch(currentPage.locator('.road-controls [data-camera-player]')); await settled();
  await groundShot('1680-full-ground-actual-scene'); await shot('1680-full-ground-app');
  await currentPage.setViewportSize(originalViewport); await settled();
  automaticOnly(before, await saved(), 'large actual canvas capture changes only normal recovery');
}
function recoveryProof(before, after, label) {
  const a = before.energyRecovery, b = after.energyRecovery;
  assert.ok(a && b && a.version === 1 && b.version === 1, `${label}: real recovery anchors exist`);
  const elapsed = b.checkedAt - a.checkedAt + a.carryMs;
  assert.ok(elapsed >= 0);
  const gain = Math.floor(elapsed / 20000), expected = Math.min(100, before.energy + gain);
  assert.equal(after.energy, expected, `${label}: energy recovers exactly3 per real minute`);
  assert.equal(b.carryMs, expected === 100 ? 0 : elapsed % 20000);
  return { label, before: a, after: b, actualElapsedMs: b.checkedAt - a.checkedAt, energyBefore: before.energy, energyAfter: after.energy, gained: after.energy - before.energy };
}
function automaticOnly(before, after, label) {
  const proof = recoveryProof(before, after, label), expected = structuredClone(before);
  expected.energy = after.energy; expected.energyRecovery = after.energyRecovery;
  assert.deepEqual(stable(after), stable(expected), `${label}: all non-recovery saved fields remain exact`);
  return proof;
}
function pointSegment(p, a, b) { const x = b.x - a.x, y = b.y - a.y, n = x * x + y * y, t = n ? Math.max(0, Math.min(1, ((p.x - a.x) * x + (p.y - a.y) * y) / n)) : 0; return Math.hypot(p.x - a.x - x * t, p.y - a.y - y * t); }
function clearance(p, polygon) { let inside = false; for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) { const a = polygon[i], b = polygon[j]; if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside; } const edge = Math.min(...polygon.map((a, i) => pointSegment(p, a, polygon[(i + 1) % polygon.length]))); return inside ? -edge : edge; }
function segmentDistance(a, b, c, d) {
  const cross = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  if (cross(a, b, c) * cross(a, b, d) <= 0 && cross(c, d, a) * cross(c, d, b) <= 0 && Math.max(Math.min(a.x, b.x), Math.min(c.x, d.x)) <= Math.min(Math.max(a.x, b.x), Math.max(c.x, d.x)) + 1e-8 && Math.max(Math.min(a.y, b.y), Math.min(c.y, d.y)) <= Math.min(Math.max(a.y, b.y), Math.max(c.y, d.y)) + 1e-8) return 0;
  return Math.min(pointSegment(a, c, d), pointSegment(b, c, d), pointSegment(c, a, b), pointSegment(d, a, b));
}
function sweepClearance(a, b, polygon) { if (clearance(a, polygon) < 0 || clearance(b, polygon) < 0) return -1; return Math.min(...polygon.map((c, i) => segmentDistance(a, b, c, polygon[(i + 1) % polygon.length]))); }
async function observe(label) {
  await currentPage.evaluate(label => {
    window.__v032Frames = []; window.__v032World = null; window.__v032Continuous = { frames: 0, roadCircles: 0, violations: [] }; window.__v032Observing = true; let last = -Infinity;
    const clearance = (p, polygon) => { let inside = false, closest = Infinity; for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) { const a = polygon[i], b = polygon[j], dx = b.x - a.x, dy = b.y - a.y, n = dx * dx + dy * dy, t = n ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / n)) : 0; closest = Math.min(closest, Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy)); if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside; } return inside ? -closest : closest; };
    const capture = () => { if (!window.__v032Observing) return; const c = document.querySelector('#world'), m = JSON.parse(c.dataset.freeMovement), a = JSON.parse(c.dataset.sceneAction), o = JSON.parse(c.dataset.outdoorGround), pets = JSON.parse(c.dataset.petMotion || '[]'), polygon = m.world.obstacles.find(o => o.kind === 'truck-body').polygon, continuous = window.__v032Continuous;
      continuous.frames++; for (const body of [m.body, ...pets.map(p => p.body)]) if (body?.surface === 'road') { continuous.roadCircles++;
        for (const obstacle of m.world.obstacles.filter(o => o.surface === 'road')) { const separation = clearance(body, obstacle.polygon); if (separation < body.radius - .012 && continuous.violations.length < 20) continuous.violations.push({ kind: obstacle.kind === 'truck-body' ? 'under-truck' : 'ground-resource-overlap', obstacleKind: obstacle.kind, body, separation, realAt: Date.now() }); }
      }
      if ((o.truckOpacity !== 1 || o.cutaway !== false) && continuous.violations.length < 20) continuous.violations.push({ kind: 'truck-transparency', o });
      if (m.frameAt - last >= 100) { last = m.frameAt; const state = JSON.parse(localStorage.getItem('road-haven-save-v1')), { world, ...movement } = m, g = JSON.parse(c.dataset.sceneGeometry); window.__v032World ??= world;
        window.__v032Frames.push({ label, realAt: Date.now(), at: performance.now(), frameAt: m.frameAt, movement, action: a,
          outdoor: { truckOpacity: o.truckOpacity, cutaway: o.cutaway, groundPolicy: o.groundPolicy, nodes: o.nodes?.map(n => ({ id: n.id, ready: n.ready, remainingSeconds: n.remainingSeconds, visual: n.visual })) },
          pets: pets.map(p => ({ id: p.id, x: p.x, y: p.y, body: p.body, surface: p.surface, link: p.link, pose: p.pose })),
          geometry: { scale: g.scale, dx: g.dx, dy: g.dy, cameraMode: g.cameraMode, resourceFocus: g.resourceFocus },
          account: { resources: state.resources, seedInventory: state.seedInventory, xp: state.xp, stats: state.stats, quests: state.quests, gathering: state.gathering, roadside: state.roadside }, energy: state.energy, recovery: state.energyRecovery }); }
      requestAnimationFrame(capture);
    }; requestAnimationFrame(capture);
  }, label);
}
async function stopObserve() { return currentPage.evaluate(() => { window.__v032Observing = false; return { frames: window.__v032Frames ?? [], world: window.__v032World, continuous: window.__v032Continuous }; }); }
function physicalProof(observed, label) {
  assert.ok(observed.frames.length >= 3, `${label}: natural rendered frames exist`);
  assert.deepEqual(observed.continuous.violations, [], `${label}: every observed RAF keeps all ground feet outside opaque truck`);
  let circles = 0, routeSweeps = 0;
  for (let i = 0; i < observed.frames.length; i++) { const f = observed.frames[i], m = f.movement, body = observed.world.obstacles.find(o => o.kind === 'truck-body');
    const roadObstacles = observed.world.obstacles.filter(o => o.surface === 'road');
    for (const actor of [m.body, ...f.pets.map(p => p.body)]) if (actor?.surface === 'road') for (const obstacle of roadObstacles) { assert.ok(clearance(actor, obstacle.polygon) >= actor.radius - .012, `${label}: full actor body clears ${obstacle.kind}`); circles++; }
    for (let j = 1; j < m.route.length; j++) if (m.route[j].surface === 'road') for (const obstacle of roadObstacles) { assert.ok(sweepClearance(m.route[j - 1], m.route[j], obstacle.polygon) >= m.body.radius - .012, `${label}: entire accepted road sweep clears ${obstacle.kind}`); routeSweeps++; }
    if (f.action.from?.surface === 'road' && f.action.climbSegments.length === 0) for (let j = 1; j < f.action.route.length; j++) for (const obstacle of roadObstacles) { assert.ok(sweepClearance(f.action.route[j - 1], f.action.route[j], obstacle.polygon) >= m.body.radius - .012, `${label}: entire accepted ground work route clears ${obstacle.kind}`); routeSweeps++; }
    if (i) { const previous = observed.frames[i - 1], dt = (m.frameAt - previous.movement.frameAt) / 1000; assert.ok(dt >= 0); assert.ok(distance(m.position, previous.movement.position) <= dt * 420 + 1.6, `${label}: hero does not teleport`); }
  }
  const proof = { case: currentCase, label, sampledFrames: observed.frames.length, naturalFrames: observed.continuous.frames, circles, routeSweeps };
  receipt.collisions.push(proof); return proof;
}
async function begin(width, height, input) {
  currentCase = `${width}x${height}`; currentStep = 'exact-save-startup';
  currentContext = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, reducedMotion: 'no-preference' });
  await currentContext.addInitScript(save => { if (sessionStorage.getItem('v032-installed')) return; const raw = JSON.stringify(save); localStorage.setItem('road-haven-save-v1', raw); window.__v032Installed = { raw, at: Date.now() }; sessionStorage.setItem('v032-installed', '1'); }, input.save);
  currentPage = await currentContext.newPage(); const pageCase = currentCase;
  currentPage.on('pageerror', e => receipt.errors.push({ case: pageCase, message: e.message }));
  currentPage.on('response', r => { if (r.status() >= 400 && ['script', 'stylesheet', 'image', 'font'].includes(r.request().resourceType())) receipt.failedAssets.push({ case: pageCase, status: r.status(), url: r.url() }); });
  await currentPage.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await currentPage.waitForFunction(() => document.querySelector('#world')?.dataset.freeMovement && !document.querySelector('[data-startup-patch]') && !document.querySelector('#app')?.inert, null, { timeout: 20000 });
  await pause(); await settled();
  const installed = await currentPage.evaluate(() => window.__v032Installed), loaded = await saved(), f = await frame();
  assert.equal(installed.raw, JSON.stringify(input.save), 'startup fixture is installed byte-exact without timestamp edits');
  const initialLoaded = domain('load', input.save), delta = loaded.totalMinutes - initialLoaded.totalMinutes;
  assert.ok(delta >= 0 && Number.isInteger(delta / 4), 'only normal village-clock ticks happened before pause');
  const expected = domain('clock', { state: initialLoaded, minutes: delta }); expected.energy = loaded.energy; expected.energyRecovery = loaded.energyRecovery;
  assert.deepEqual(stable(loaded), stable(expected), 'startup applies only standard migration, actual village progress and real recovery');
  assert.equal(await currentPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'mobile layout has no horizontal overflow');
  assert.equal(f.outdoor.truckOpacity, 1); assert.equal(f.outdoor.cutaway, false);
  assert.equal(f.outdoor.nodes.length, 28, 'all28 real ground resources render on every truck size');
  for (const node of catalog.nodes) assert.ok(distance(f.outdoor.nodes.find(n => n.id === node.id).point, { x: node.point[0], y: node.point[1] }) < .002, 'individual resource stays at canonical fixed ground coordinates');
  assert.deepEqual(f.outdoor.trails.map(z => z.id).sort(), catalog.zones.map(z => z.id).sort(), 'all four actual walking corridors retain authored geometry');
  assert.deepEqual(f.outdoor.terrain.paintedTrailIds, ['grove'], 'only the forest has a painted natural walking path');
  const row = { viewport: { width, height }, ...input, installed: { at: installed.at, sha256: sha(installed.raw) }, loaded, initialFrame: f };
  receipt.fixtures.push(row); await shot(`${width}-whole-map`); await groundShot(`${width}-overview`); return { context: currentContext, page: currentPage, case: currentCase, row };
}
async function openSite(siteId) {
  await closeModal(); await touch(currentPage.locator('.road-controls [data-open="roadside"]'));
  await touch(currentPage.locator(`[data-outdoor-site="${siteId}"]`));
}
async function focus(siteId) {
  currentStep = `focus-${siteId}`; await openSite(siteId); const before = await saved(), prior = await frame();
  await touch(currentPage.locator(`[data-outdoor-walk="${siteId}"]`)); await settled();
  const f = await frame(), zone = catalog.zones.find(z => z.id === siteId), v = f.geometry.viewport;
  assert.ok(f.geometry.scale > prior.geometry.scale || f.geometry.cameraMode !== 'overview', 'explicit area focus makes individual world nodes usable');
  assert.equal(f.geometry.resourceFocus?.siteId, siteId, 'explicit area focus selects the requested authored ground zone');
  assert.ok(f.geometry.scale >= .38 - .001, 'explicit focus keeps ground resources legible on short and tall screens');
  const visible = f.outdoor.nodes.filter(n => n.siteId === siteId && n.x >= v.safeLeft && n.x <= v.width - v.safeRight && n.y >= v.safeTop && n.y <= v.height - v.safeBottom);
  assert.ok(visible.length, 'focused area exposes actual individual targets inside the usable map');
  const after = await saved(); automaticOnly(before, after, currentStep);
  receipt.focuses.push({ case: currentCase, siteId, before: prior, after: f, zone, visibleNodeIds: visible.map(n => n.id) }); await shot(`${currentPage.viewportSize().width}-${siteId}-focus`);
  await groundShot(`${currentPage.viewportSize().width}-${siteId}-focused`);
  return f;
}
async function mapNode(id) {
  currentStep = `native-map-select-${id}`; await panelNode(id); const focusBefore = await saved(), prior = await frame();
  await touch(currentPage.locator(`[data-ground-focus="${id}"]`)); await settled(); const focusAfter = await frame();
  assert.equal(focusAfter.geometry.resourceFocus?.nodeId, id, 'explicit individual focus exposes the requested real node');
  assert.ok(focusAfter.geometry.scale >= .38 - .001); assert.ok(distance(prior.movement.position, focusAfter.movement.position) < .002, 'individual camera focus never moves feet');
  automaticOnly(focusBefore, await saved(), 'explicit individual focus changes no economic or node record');
  receipt.inputs.push({ case: currentCase, kind: 'explicit-node-focus', id, before: prior, after: focusAfter });
  currentStep = `native-map-select-${id}`; const index = catalog.nodes.findIndex(n => n.id === id), f = await frame();
  const hit = f.hits.find(h => h.kind === 'ground-resource' && (h.index === index || h.plotId === index || h.groundResourceId === id || h.nodeId === id || h.id === id));
  assert.ok(hit, `${id}: individual live canvas hit exists`);
  const world = { x: hit.x, y: hit.y }, t = f.renderTransform, point = { x: f.rect.x + (t.a * world.x + t.c * world.y + t.e) / t.dpr, y: f.rect.y + (t.b * world.x + t.d * world.y + t.f) / t.dpr };
  assert.equal(await currentPage.evaluate(p => document.elementFromPoint(p.x, p.y)?.id === 'world', point), true, `${id}: actual painted node is reachable on canvas`);
  const before = await saved();
  await currentPage.locator('#world').evaluate(canvas => { window.__v032LastPointer = null; canvas.addEventListener('pointerup', e => {
    const r = canvas.getBoundingClientRect(), t = canvas.getContext('2d').getTransform(), dpr = Math.min(devicePixelRatio || 1, 2), px = (e.clientX - r.x) * dpr - t.e, py = (e.clientY - r.y) * dpr - t.f, determinant = t.a * t.d - t.b * t.c;
    window.__v032LastPointer = { realAt: Date.now(), isTrusted: e.isTrusted, client: { x: e.clientX, y: e.clientY }, renderTransform: { a: t.a, b: t.b, c: t.c, d: t.d, e: t.e, f: t.f, dpr }, world: { x: (t.d * px - t.c * py) / determinant, y: (-t.b * px + t.a * py) / determinant } };
  }, { capture: true, once: true }); });
  await currentPage.touchscreen.tap(point.x, point.y);
  await currentPage.locator(`[data-ground-collect="${id}"]`).waitFor({ state: 'visible', timeout: 5000 });
  const actual = await currentPage.evaluate(() => window.__v032LastPointer);
  assert.ok(actual?.isTrusted); assert.ok(distance(actual.world, world) < .002, 'native finger maps to the intended individual canvas hit through the exact painted transform');
  automaticOnly(before, await saved(), 'node selection spends no resources');
  receipt.inputs.push({ case: currentCase, kind: 'native-map-node', id, index, hit, point, actual, frame: f }); return f;
}
async function panelNode(id) {
  const node = catalog.nodes.find(n => n.id === id); await openSite(node.siteId);
  await touch(currentPage.locator(`[data-ground-node="${id}"]`));
  await currentPage.locator(`[data-ground-collect="${id}"]`).waitFor({ state: 'visible' });
}
async function collect(id, { nativeMap = false, duplicateTap = false } = {}) {
  currentStep = `collect-${id}`;
  if (nativeMap) await mapNode(id); else await panelNode(id);
  currentStep = `collect-${id}`; const before = await saved(), node = catalog.nodes.find(n => n.id === id), rule = catalog.rules[node.siteId];
  assert.ok(before.energy >= rule.energy); assert.equal(await currentPage.locator(`[data-ground-collect="${id}"]`).isEnabled(), true);
  await observe(currentStep); const realStartedAt = Date.now(), finger = await touch(currentPage.locator(`[data-ground-collect="${id}"]`));
  if (duplicateTap) await currentPage.touchscreen.tap(finger.point.x, finger.point.y);
  await currentPage.waitForFunction(id => { const a = JSON.parse(document.querySelector('#world').dataset.sceneAction); return a.groundResourceId === id && a.phase === 'working'; }, id, { timeout: 45000 });
  const working = await frame(); assert.equal(working.movement.surface, 'road');
  await shot(`${currentPage.viewportSize().width}-${id}-working`);
  await currentPage.waitForFunction(() => !document.querySelector('#app')?.hasAttribute('aria-busy') && JSON.parse(document.querySelector('#world').dataset.sceneAction).phase === 'idle', null, { timeout: 45000 });
  await settled(); const after = await saved(), afterFrame = await frame(), observation = await stopObserve(), realEndedAt = Date.now();
  const row = after.gathering.nodes[id], old = before.gathering?.nodes[id] ?? { visits: 0, readyAtMs: 0 }, commitAt = row.readyAtMs - 180000;
  assert.ok(commitAt >= realStartedAt && commitAt <= realEndedAt, 'regeneration begins at the real observed work commit');
  assert.equal(row.visits, old.visits + 1, 'one real work action commits one node visit');
  // Full energy has no banked fractional recovery. Observe its actual cost
  // anchor separately from the node commit's subsequent Date.now() call.
  const costAt = before.energy === 100 ? after.energyRecovery.checkedAt - after.energyRecovery.carryMs : commitAt;
  assert.ok(costAt >= realStartedAt && costAt <= realEndedAt);
  if (before.energy === 100) assert.ok(Math.abs(costAt - commitAt) <= 1000, 'the full-energy cost anchor occurs in the actual final work commit');
  const recovered = domain('recover', { state: before, now: costAt }), result = domain('collect', { state: recovered, id, now: commitAt });
  assert.equal(result.ok, true); const expected = domain('recover', { state: result.state, now: after.energyRecovery.checkedAt });
  assert.deepEqual(stable(after), stable(expected), 'resources, typed seeds, XP, stats, quests, node cooldown and energy are one exact domain transaction');
  const signatures = observation.frames.map(f => JSON.stringify(f.account)), transitions = signatures.slice(1).filter((value, i) => value !== signatures[i]).length;
  assert.equal(transitions, 1, 'economic records change atomically once during actual work');
  for (const f of observation.frames.filter(f => f.action.groundResourceId === id && ['outbound', 'working'].includes(f.action.phase))) assert.deepEqual(f.account, economy(before), 'walking and work grant no early reward');
  const active = observation.frames.filter(f => f.action.groundResourceId === id);
  for (const phase of ['outbound', 'working']) assert.ok(active.some(f => f.action.phase === phase), `${id}: actual ${phase} animation is observed`);
  assert.equal(working.action.returnWalk, 0, 'node work finishes at the actual resource rather than automatically returning');
  assert.ok(node.approaches.some(([x, y]) => distance(afterFrame.movement.position, { x, y }) < 3), 'after collecting the hero remains at this individual node approach');
  const proof = physicalProof(observation, currentStep);
  receipt.collections.push({ case: currentCase, id, nativeMap, duplicateTap, before, after, node, rule, realStartedAt, realEndedAt, commitAt, costAt, working, afterFrame, economicTransitions: transitions, observation, proof });
  console.log(`PASS ${currentCase} ${id}: native work, one exact atomic reward, real180-second deadline.`);
  return receipt.collections.at(-1);
}
function renderedNode(f, id) { return (f.outdoor.resources ?? f.outdoor.nodes ?? f.outdoor.resourceNodes ?? []).find(n => n.id === id); }
async function depletion(id, ready = false) {
  currentStep = `${ready ? 'regrown' : 'depleted'}-${id}`;
  const f = await frame(), state = await saved(), now = f.realAt, view = domain('view', { state, id, now }), rendered = renderedNode(f, id);
  assert.equal(view.ready, ready); assert.ok(rendered, 'read-only scene publishes individual rendered node');
  assert.equal(rendered.ready, ready, 'rendered node agrees with real wall-clock readiness');
  if (catalog.nodes.find(n => n.id === id).kind === 'tree') assert.equal(rendered.visual, ready ? 'tree' : 'stump', 'only this harvested tree renders as a stump');
  await panelNode(id); const button = currentPage.locator(`[data-ground-collect="${id}"]`), text = await currentPage.locator('#modal-root').innerText();
  assert.equal(await button.isEnabled(), ready);
  if (!ready) { assert.ok(view.remainingSeconds > 0 && view.remainingSeconds <= 180); assert.match(text, /\d+초/, 'real seconds remaining are displayed'); }
  receipt.depletion.push({ case: currentCase, id, ready, now, view, rendered, text, frame: f }); await shot(`${currentPage.viewportSize().width}-${id}-${ready ? 'regrown' : 'stump-countdown'}`);
  await closeModal(); return { f, state, view, rendered };
}
async function reloadProof() {
  currentStep = 'save-reentry'; const before = await saved(); await currentPage.reload({ waitUntil: 'domcontentloaded' });
  await currentPage.waitForFunction(() => document.querySelector('#world')?.dataset.freeMovement && !document.querySelector('[data-startup-patch]') && !document.querySelector('#app')?.inert, null, { timeout: 20000 });
  await pause(); await settled(); const after = await saved(), delta = after.totalMinutes - before.totalMinutes;
  assert.ok(delta >= 0 && Number.isInteger(delta / 4));
  const expected = domain('clock', { state: before, minutes: delta }); expected.energy = after.energy; expected.energyRecovery = after.energyRecovery;
  assert.deepEqual(stable(after), stable(expected), 'reentry applies only normal startup ticks and real recovery');
  recoveryProof(before, after, currentStep); assert.deepEqual(after.gathering, before.gathering, 'save/reentry preserves every independent visits/deadline record exactly');
  assert.equal(await currentPage.locator('.time-button').getAttribute('aria-label'), '시간 계속');
  receipt.reloads.push({ case: currentCase, before, after, clockMinutesApplied: delta, frame: await frame() });
}
async function walkTrail() {
  await focus('grove'); currentStep = 'native-forest-trail'; await closeModal(); await settled(); const before = await saved(), f = await frame(), zone = catalog.zones.find(z => z.id === 'grove');
  const polygonHit = (p, poly) => { let inside = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > p.y) !== (b[1] > p.y) && p.x < (b[0] - a[0]) * (p.y - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside; } return inside; };
  const t = f.renderTransform, v = f.geometry.viewport;
  const trailPoints = [zone.path[1], zone.path[0], ...zone.path.slice(2)].filter(Boolean);
  const candidates = trailPoints.flatMap(([x, y]) => [0, 26, -26, 40, -40].map(offset => ({ x: x + offset, y, trailCenterOffset: Math.abs(offset) })));
  let point;
  for (const candidate of candidates) {
    const client = { x: f.rect.x + (t.a * candidate.x + t.c * candidate.y + t.e) / t.dpr, y: f.rect.y + (t.b * candidate.x + t.d * candidate.y + t.f) / t.dpr };
    if (client.x < f.rect.x + v.safeLeft + 8 || client.x > f.rect.right - v.safeRight - 8 || client.y < f.rect.y + v.safeTop + 8 || client.y > f.rect.bottom - v.safeBottom - 8) continue;
    if (f.hits.filter(h => roadInteractiveKinds.includes(h.kind)).some(h => h.polygon ? polygonHit(candidate, h.polygon) : h.bounds ? candidate.x >= h.bounds[0] && candidate.x <= h.bounds[2] && candidate.y >= h.bounds[1] && candidate.y <= h.bounds[3] : Math.hypot(candidate.x - h.x, candidate.y - h.y) < Math.max(h.radius, 22 / f.geometry.scale))) continue;
    if (await currentPage.evaluate(p => document.elementFromPoint(p.x, p.y)?.id === 'world', client)) { point = candidate; break; }
  }
  assert.ok(point, 'authored132px forest trail contains a genuine empty native walking target');
  assert.ok(point.trailCenterOffset + f.movement.body.radius <= zone.pathWidth / 2, 'full hero feet fit inside authored trail width');
  const client = { x: f.rect.x + (t.a * point.x + t.c * point.y + t.e) / t.dpr, y: f.rect.y + (t.b * point.x + t.d * point.y + t.f) / t.dpr };
  assert.equal(await currentPage.evaluate(p => document.elementFromPoint(p.x, p.y)?.id === 'world', client), true, 'forest trail is visible and touchable');
  await observe(currentStep); await currentPage.touchscreen.tap(client.x, client.y);
  await currentPage.waitForFunction(() => JSON.parse(document.querySelector('#world').dataset.freeMovement).moving, null, { timeout: 3000 });
  await currentPage.waitForFunction(() => !JSON.parse(document.querySelector('#world').dataset.freeMovement).moving, null, { timeout: 45000 });
  await settled(); const after = await saved(), final = await frame(), observation = await stopObserve();
  assert.equal(final.movement.surface, 'road'); assert.ok(distance(final.movement.position, point) < 3, 'hero reaches the actual authored walkable forest trail');
  const proof = physicalProof(observation, currentStep); automaticOnly(before, after, currentStep);
  receipt.walks.push({ case: currentCase, label: currentStep, point, client, before: f, after: final, observation, proof }); await shot(`${currentPage.viewportSize().width}-actual-forest-trail`);
}
async function buttonsDoNotOverlap() {
  const buttons = await currentPage.locator('#modal-root button').evaluateAll(buttons => buttons.filter(b => { const r = b.getBoundingClientRect(); return r.width && r.height && getComputedStyle(b).visibility !== 'hidden'; }).map(b => ({ text: b.innerText, rect: b.getBoundingClientRect().toJSON() })));
  for (let i = 0; i < buttons.length; i++) for (let j = i + 1; j < buttons.length; j++) { const a = buttons[i].rect, b = buttons[j].rect; assert.ok(Math.min(a.right, b.right) - Math.max(a.left, b.left) <= 1 || Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) <= 1, 'modal controls do not overlap'); }
  receipt.inputs.push({ case: currentCase, kind: 'modal-button-layout', buttons });
}
async function blockedTruck() {
  currentStep = 'native-truck-interior-rejection'; await closeModal(); await touch(currentPage.locator('.road-controls [data-camera-player]')); await settled();
  const before = await saved(), f = await frame(); assert.equal(f.movement.surface, 'road', 'blocked ground input is tested from real outside-truck ground feet');
  const body = f.movement.world.obstacles.find(o => o.kind === 'truck-body'), t = f.renderTransform, v = f.geometry.viewport;
  const pointInsideHit = (p, h) => h.polygon ? clearance(p, h.polygon.map(([x, y]) => ({ x, y }))) <= 0 : h.bounds ? p.x >= h.bounds[0] && p.x <= h.bounds[2] && p.y >= h.bounds[1] && p.y <= h.bounds[3] : distance(p, h) < Math.max(h.radius, 22 / f.geometry.scale);
  // Native road pointer handling ignores deck-only farm, facility and truck
  // hits. Exclude precisely the kinds it can select from outside ground.
  const groundHits = f.hits.filter(h => roadInteractiveKinds.includes(h.kind));
  const candidates = [];
  for (let x = Math.ceil(body.bounds.left / 15) * 15; x <= body.bounds.right; x += 15) for (let y = Math.ceil(body.bounds.top / 15) * 15; y <= body.bounds.bottom; y += 15) {
    const world = { x, y }, bodyClearance = clearance(world, body.polygon);
    if (bodyClearance > -(f.movement.body.radius + 10) || groundHits.some(h => pointInsideHit(world, h))) continue;
    const client = { x: f.rect.x + (t.a * x + t.c * y + t.e) / t.dpr, y: f.rect.y + (t.b * x + t.d * y + t.f) / t.dpr };
    if (client.x < f.rect.x + v.safeLeft + 8 || client.x > f.rect.right - v.safeRight - 8 || client.y < f.rect.y + v.safeTop + 8 || client.y > f.rect.bottom - v.safeBottom - 8) continue;
    candidates.push({ world, client, bodyClearance });
  }
  candidates.sort((a, b) => a.bodyClearance - b.bodyClearance);
  let chosen;
  for (const candidate of candidates) if (await currentPage.evaluate(p => document.elementFromPoint(p.x, p.y)?.id === 'world', candidate.client)) { chosen = candidate; break; }
  assert.ok(chosen, 'an actual visible truck-body interior misses every object selectable from outside ground');
  await currentPage.locator('#world').evaluate(canvas => { window.__v032BlockedTouch = null; canvas.addEventListener('pointerup', e => { window.__v032BlockedTouch = { isTrusted: e.isTrusted, realAt: Date.now(), point: { x: e.clientX, y: e.clientY }, canvasHit: document.elementFromPoint(e.clientX, e.clientY) === canvas }; }, { once: true, capture: true }); });
  await observe(currentStep); await currentPage.touchscreen.tap(chosen.client.x, chosen.client.y); await currentPage.waitForTimeout(450);
  const observation = await stopObserve(), after = await frame(), actual = await currentPage.evaluate(() => window.__v032BlockedTouch);
  assert.ok(actual?.isTrusted && actual.canvasHit, 'trusted native finger actually released inside the opaque truck body');
  for (const row of observation.frames) { assert.equal(row.movement.moving, false); assert.equal(row.movement.target, null); assert.ok(distance(row.movement.position, f.movement.position) < .002, 'truck interior input cannot move real ground feet'); }
  assert.equal(after.movement.target, null); assert.equal(await currentPage.locator('#modal-root').isVisible(), false);
  automaticOnly(before, await saved(), currentStep); const proof = physicalProof(observation, currentStep);
  receipt.blockedInputs.push({ case: currentCase, chosen, actual, before: f, after, observation, proof }); await shot(`${currentPage.viewportSize().width}-blocked-opaque-truck-interior`);
}

try {
  await mkdir('artifacts', { recursive: true });
  if (finalSnapshot) { const manifest = JSON.parse(await readFile(executionInputs.snapshotManifestPath, 'utf8')); assert.equal(manifest.snapshotId, snapshotId); assert.equal(manifest.version, version); for (const [path, expected] of Object.entries(manifest.files)) { const url = new URL(path, new URL('/', baseUrl)), response = await fetch(url); assert.equal(response.status, 200); const bytes = Buffer.from(await response.arrayBuffer()); assert.equal(sha(bytes), expected); receipt.httpIdentity.push({ path, url: String(url), bytes: bytes.length, sha256: expected }); } }
  const fresh = await fixture(), paid = await fixture(true);
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  if (visualOnly) {
    for (const [width, height, input] of [[390, 844, fresh], [344, 740, fresh], [844, 390, paid]]) {
      const mobile = await begin(width, height, input);
      if (width === 390) await fullGroundShot();
      for (const siteId of ['grove', 'seed-meadow', 'salvage', 'spring']) await focus(siteId);
      await mobile.context.close();
    }
  } else {
  const primary = await begin(390, 844, fresh);
  await fullGroundShot();
  await focus('grove');
  const first = await collect('tree-01', { nativeMap: true, duplicateTap: true });
  await depletion('tree-01');
  const second = await collect('tree-02', { nativeMap: true });
  assert.equal(second.before.gathering.nodes['tree-01'].readyAtMs, first.after.gathering.nodes['tree-01'].readyAtMs, 'second tree leaves the first independent deadline untouched');
  assert.equal(second.after.gathering.nodes['tree-01'].visits, first.after.gathering.nodes['tree-01'].visits);
  assert.ok(second.commitAt > first.commitAt, 'two independent tree deadlines have different real work completion times');
  await depletion('tree-01'); await depletion('tree-02'); await depletion('tree-03', true);
  await reloadProof(); await focus('grove'); await depletion('tree-01'); await depletion('tree-02');
  const treeDeadlines = structuredClone((await saved()).gathering.nodes);
  await focus('spring'); await collect('water-03');
  const whileWaiting = await saved();
  for (const id of ['tree-01', 'tree-02']) assert.deepEqual(whileWaiting.gathering.nodes[id], treeDeadlines[id], 'other real activity in the same village preserves each tree regeneration');
  await blockedTruck();
  const regenerationBaseline = await saved();
  currentContext = primary.context; currentPage = primary.page; currentCase = primary.case; currentStep = 'real180-second-independent-regeneration';
  await currentPage.bringToFront();
  await focus('grove'); currentStep = 'real180-second-independent-regeneration';
  const target = second.after.gathering.nodes['tree-02'].readyAtMs;
  const firstTarget = first.after.gathering.nodes['tree-01'].readyAtMs; let independentBoundaryObserved = false;
  while (Date.now() < target + 1200) {
    const remaining = target + 1200 - Date.now(); console.log(`PROGRESS real regeneration: ${Math.ceil(remaining / 1000)}seconds left; ordinary activities completed.`);
    const firstBoundaryWait = Date.now() < firstTarget + 600 ? firstTarget + 600 - Date.now() : Infinity;
    await currentPage.waitForTimeout(Math.min(15000, remaining, firstBoundaryWait));
    const f = await frame(), state = await saved();
    receipt.regenerations.push({ realAt: f.realAt, elapsedSinceFirstCommitMs: f.realAt - first.commitAt, elapsedSinceSecondCommitMs: f.realAt - second.commitAt, first: renderedNode(f, 'tree-01'), second: renderedNode(f, 'tree-02'), visits: state.gathering.nodes });
    if (f.realAt < first.after.gathering.nodes['tree-01'].readyAtMs) assert.equal(domain('view', { state, id: 'tree-01', now: f.realAt }).ready, false, 'first tree cannot regrow early');
    if (f.realAt < target) assert.equal(domain('view', { state, id: 'tree-02', now: f.realAt }).ready, false, 'second tree cannot borrow the first tree deadline');
    if (f.realAt >= firstTarget && f.realAt < target) { assert.equal(domain('view', { state, id: 'tree-01', now: f.realAt }).ready, true); assert.equal(renderedNode(f, 'tree-01').ready, true); assert.equal(renderedNode(f, 'tree-02').ready, false); if (!independentBoundaryObserved) await shot('390-first-regrown-second-still-cooling'); independentBoundaryObserved = true; receipt.regenerations.at(-1).independentBoundary = true; }
  }
  assert.equal(independentBoundaryObserved, true, 'a real rendered interval shows first tree regenerated while second is still cooling down');
  await settled(); const regrown = await saved();
  receipt.recovery.push(automaticOnly(regenerationBaseline, regrown, 'paused gameplay keeps real3-per-minute recovery and no repeated reward'));
  await focus('grove'); await depletion('tree-01', true); await depletion('tree-02', true);
  assert.ok(Date.now() - first.commitAt >= 180000 && Date.now() - second.commitAt >= 180000, 'both regenerations waited a genuine full180000ms');
  await collect('tree-01', { nativeMap: true });
  const final = await saved(); assert.equal(final.gathering.nodes['tree-01'].visits, first.after.gathering.nodes['tree-01'].visits + 1); assert.equal(final.gathering.nodes['tree-02'].visits, second.after.gathering.nodes['tree-02'].visits);
  await reloadProof(); primary.row.after = await saved();
  // Complete genuine regeneration evidence before checking other viewports,
  // so a later mobile-layout diagnostic cannot lose the elapsed-time proof.
  for (const [width, height, input] of [[344, 740, fresh], [844, 390, paid]]) {
    const mobile = await begin(width, height, input);
    for (const siteId of ['grove', 'salvage', 'seed-meadow', 'spring']) { await focus(siteId); await openSite(siteId); await buttonsDoNotOverlap(); const id = catalog.nodes.find(n => n.siteId === siteId && n.id.endsWith('-02')).id; await touch(currentPage.locator(`[data-ground-node="${id}"]`)); await buttonsDoNotOverlap(); await closeModal(); }
    await focus('grove'); await mapNode('tree-04'); await closeModal(); await walkTrail(); await blockedTruck();
    if (input.paid) for (const id of ['scrap-02', 'seed-02', 'water-02']) { await collect(id); await depletion(id); }
    await reloadProof(); mobile.row.after = await saved();
    assert.equal(mobile.row.after.deckLevel, input.save.deckLevel); assert.deepEqual(mobile.row.after.truckLayout, input.save.truckLayout);
    await mobile.context.close(); console.log(`PASS ${width}x${height}: four explicit area focuses, touch layout, individual canvas node and natural forest trail.`);
  }
  }
  assert.equal(receipt.fixtures.length, 3); if (!visualOnly) { assert.equal(receipt.collections.length, 7); assert.equal(receipt.blockedInputs.length, 3); } assert.deepEqual(receipt.errors, []); assert.deepEqual(receipt.failedAssets, []);
  receipt.sourceHashesAtEnd = await sourceHashes(); assert.deepEqual(receipt.sourceHashesAtEnd, receipt.sourceHashesAtStart, 'product sources stay stable throughout successful development and final QA');
  assert.equal(sha(await readFile(executionInputs.testPath)), executionInputs.testSha256, 'the executed QA harness stays unchanged throughout a successful run');
  receipt.status = visualOnly ? 'visual-captured' : 'passed';
} catch (error) {
  receipt.status = 'failed'; receipt.failure = { case: currentCase, step: currentStep, message: String(error), stack: error.stack }; process.exitCode = 1;
  if (currentPage) try { receipt.failure.save = await saved(); receipt.failure.frame = await frame(); receipt.failure.observation = await stopObserve(); await shot('failure'); } catch (captureError) { receipt.failure.captureError = String(captureError); }
} finally {
  if (browser) await browser.close();
  receipt.sourceHashesAtEnd ??= await sourceHashes(); receipt.testSha256AtEnd = sha(await readFile(executionInputs.testPath));
  receipt.finishedAt = new Date().toISOString(); receipt.assertionsExecuted = assertionsExecuted;
  const path = `artifacts/v032-ground-${receiptTag}-verification.json`; await writeFile(path, JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify({ status: receipt.status, assertionsExecuted, receipt: path, error: receipt.failure?.message }));
}
