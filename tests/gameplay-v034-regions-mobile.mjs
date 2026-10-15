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
const snapshotId = process.env.TEST_SNAPSHOT_ID ?? (process.env.TEST_FINAL_SNAPSHOT === '1' ? 'v034-r2' : 'mutable-development-diagnostic');
const finalSnapshot = process.env.TEST_FINAL_SNAPSHOT === '1';
const diagnosticOnly = process.env.TEST_V034_DIAGNOSTIC === '1';
if (finalSnapshot === diagnosticOnly) throw Error('Choose immutable final snapshot or mutable development diagnostic.');
const visualOnly = process.env.TEST_V034_VISUAL_ONLY === '1';
if (visualOnly && finalSnapshot) throw Error('Visual-only inspection is a development diagnostic, never final release QA.');
const visualCompact = visualOnly && process.env.TEST_V034_VISUAL_COMPACT === '1';
const receiptTag = process.env.TEST_RECEIPT_TAG ?? `run-${Date.now()}`;
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(receiptTag)) throw Error('Receipt tag must be a safe unique suffix.');
const sha = value => createHash('sha256').update(value).digest('hex');
let assertionsExecuted = 0;
const assert = new Proxy(strictAssert, { get(target, key) { const value = Reflect.get(target, key); return typeof value === 'function' ? (...args) => { assertionsExecuted++; return value(...args); } : value; } });
const previousReceiptPath = 'artifacts/v033-direct-gather-final-r1-verification.json';
const timingReceiptPath = 'artifacts/v032-ground-final-r1-verification.json';
const priorTimingSourcePath = 'artifacts/v034-prior-gathering-source.ts';
const revisionPaths = [];
const executionInputs = await captureExecutionInputs(import.meta.url, { snapshotId, finalSnapshot, dependencies: [previousReceiptPath, timingReceiptPath, priorTimingSourcePath, ...revisionPaths] });
const executedTestBackupPath = `artifacts/diagnostics/v034-${receiptTag}/executed-harness.mjs`;
await mkdir(`artifacts/diagnostics/v034-${receiptTag}`, { recursive: true });
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
  visualOnly, visualCompact, scope: 'Chromium mobile emulation; native touches, natural RAF, exact ordinary saved-game startup, direct one-tap ground work, geographically separated mixed-resource regions, native one-tap ground work and real energy recovery. Regeneration timing explicitly reuses v32 real wall-clock evidence only for byte-identical timing/readiness/commit declarations; new catalog, routes and migration are verified in the current version. No timer, clock, route, position, energy or economic grants after startup.',
  fixtures: [], inputs: [], focuses: [], collections: [], rejections: [], markers: [], construction: [], recovery: [], walks: [], blockedInputs: [], collisions: [], reloads: [], screenshots: [], visualGround: [], httpIdentity: [], errors: [], failedAssets: [] };
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
import fs from 'node:fs';import ts from 'typescript';import {createHash} from 'node:crypto';
import {recoverEnergy} from './src/energy-recovery.ts';
import {performGatheringAction,getGatheringNode,getGatheringProgress,migrateLegacyGatheringFields,GATHERING_REGENERATION_MS} from './src/gathering.ts';
import {GROUND_RESOURCE_NODES,GROUND_RESOURCE_ZONES,LEGACY_GROUND_RESOURCE_IDS} from './src/ground-resources.ts';
import {GROUND_REGIONS} from './src/ground-regions.ts';
import {ROADSIDE_RULES} from './src/roadside.ts';
import {GROUND_LANDSCAPE_BOUNDS,GROUND_BACKGROUND_BOUNDS,GROUND_BACKGROUND_TILES,getGroundResourceVisual,getGroundVisualBounds,getGroundVisualPolygon} from './src/ground-visuals.ts';
const op=process.argv[1],input=JSON.parse(process.argv[2]);
if(op==='fresh')console.log(JSON.stringify(createGame('female','개별 숲 나무 검수')));
else if(op==='load'){const s=loadGame({getItem:()=>JSON.stringify(input)});console.log(JSON.stringify({...s,...migrateLegacyGatheringFields(s)}));}
else if(op==='clock')console.log(JSON.stringify(advanceTime(input.state,input.minutes)));
else if(op==='recover')console.log(JSON.stringify(recoverEnergy(input.state,input.now)));
else if(op==='collect')console.log(JSON.stringify(performGatheringAction(input.state,input.id,input.now)));
else if(op==='view')console.log(JSON.stringify(getGatheringNode(input.state,input.id,input.now)));
else if(op==='progress')console.log(JSON.stringify(getGatheringProgress(input)));
else if(op==='catalog')console.log(JSON.stringify({nodes:GROUND_RESOURCE_NODES,zones:GROUND_RESOURCE_ZONES,regions:GROUND_REGIONS,legacyIds:LEGACY_GROUND_RESOURCE_IDS,rules:ROADSIDE_RULES,regenMs:GATHERING_REGENERATION_MS}));
else if(op==='timingCore'){
const names=['GATHERING_REGENERATION_MS','MAX_DEVICE_TIME','deviceTime','getGatheringNode','performGatheringAction'],hash=b=>createHash('sha256').update(b).digest('hex');
const declarations=text=>{const ast=ts.createSourceFile('gathering.ts',text,ts.ScriptTarget.Latest,true),out={};for(const statement of ast.statements){if(ts.isFunctionDeclaration(statement)&&statement.name&&names.includes(statement.name.text))out[statement.name.text]=hash(statement.getText(ast));if(ts.isVariableStatement(statement))for(const d of statement.declarationList.declarations)if(ts.isIdentifier(d.name)&&names.includes(d.name.text))out[d.name.text]=hash(d.getText(ast));}return out;};const current=fs.readFileSync('src/gathering.ts'),prior=fs.readFileSync('artifacts/v034-prior-gathering-source.ts');console.log(JSON.stringify({names,currentFileSha256:hash(current),priorFileSha256:hash(prior),currentDeclarationHashes:declarations(current.toString()),priorDeclarationHashes:declarations(prior.toString())}));}
else if(op==='visualCatalog')console.log(JSON.stringify({landscapeBounds:GROUND_LANDSCAPE_BOUNDS,backgroundBounds:GROUND_BACKGROUND_BOUNDS,tiles:GROUND_BACKGROUND_TILES,nodes:GROUND_RESOURCE_NODES.map(node=>({id:node.id,art:getGroundResourceVisual(node),bounds:getGroundVisualBounds(node),polygon:getGroundVisualPolygon(node),...(node.kind==='tree'?{stump:{art:getGroundResourceVisual(node,'stump'),bounds:getGroundVisualBounds(node,'stump')}}:{depleted:{art:getGroundResourceVisual(node,'depleted'),bounds:getGroundVisualBounds(node,'depleted')}})}))}));`;
  const result = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script, operation, JSON.stringify(input)], { encoding: 'utf8' });
  assert.equal(result.status, 0, `actual domain is executable: ${result.stderr}`);
  return JSON.parse(result.stdout);
}
const catalog = domain('catalog');
assert.equal(catalog.regenMs, 180000);
assert.equal(catalog.nodes.length, 52);
assert.equal(catalog.legacyIds.length,28);assert.equal(catalog.regions.length,7);
assert.deepEqual(catalog.nodes.slice(0,28).map(n=>n.id),catalog.legacyIds);
assert.deepEqual(catalog.nodes.filter(n => n.kind === 'tree').map(n => n.id), Array.from({ length: 22 }, (_, i) => `tree-${String(i + 1).padStart(2, '0')}`));
for (const kind of ['scrap', 'seed', 'water']) assert.equal(catalog.nodes.filter(n => n.kind === kind).length, 10);
receipt.catalog = catalog;
receipt.visualCatalog = domain('visualCatalog');
async function fixture(paid = false) {
  if (!paid) return { save: domain('fresh'), paid: false, provenance: { kind: 'actual-createGame', declaration: 'Exact ordinary new game; no resources, progress or timestamps edited.' } };
  const bytes = await readFile(previousReceiptPath), prior = JSON.parse(bytes);
  assert.equal(sha(bytes), 'c4fa972c7bd74411c7e6b2054cee34413c96a4fdd1a7a2a474a942a513e062e2');
  assert.equal(prior.status, 'passed'); assert.equal(prior.finalSnapshot, true);
  const save = structuredClone(prior.fixtures[2].after);
  assert.equal(sha(JSON.stringify(save)), '018f7070e8b2507e3b28276b8bac4fe6b1089f11fe61b5541c624e88b76db213');
  assert.equal(save.deckLevel, 7); assert.equal(save.truckLayout.floors, 3);
  return { save, paid: true, provenance: { kind: 'immutable-v033-observed-paid-final-save', path: previousReceiptPath, receiptSha256: sha(bytes), jsonPointer: '/fixtures/2/after', saveJsonSha256: sha(JSON.stringify(save)), declaration: 'Exact earlier paid village without economic edits; normal production startup applies genuine absence and old gathering migration.' } };
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
  await currentPage.evaluate(() => { window.__v034CameraPrevious = null; window.__v034CameraStable = 0; });
  await currentPage.waitForFunction(() => { const c = document.querySelector('#world'); if (!c?.dataset.sceneGeometry) return false; const g = JSON.parse(c.dataset.sceneGeometry), m = JSON.parse(c.dataset.freeMovement), old = window.__v034CameraPrevious; if (old?.at === m.frameAt) return false; window.__v034CameraPrevious = { at: m.frameAt, dx: g.dx, dy: g.dy, scale: g.scale }; window.__v034CameraStable = old && Math.abs(g.dx - old.dx) < .25 && Math.abs(g.dy - old.dy) < .25 && Math.abs(g.scale - old.scale) < .0005 ? window.__v034CameraStable + 1 : 0; return window.__v034CameraStable >= 3; }, null, { timeout: 7000 });
}
async function shot(label) {
  const path = `artifacts/v034-regions-${receiptTag}-${String(receipt.screenshots.length + 1).padStart(2, '0')}-${label}.png`;
  await currentPage.screenshot({ path, fullPage: true }); const bytes = await readFile(path);
  receipt.screenshots.push({ case: currentCase, path, bytes: bytes.length, sha256: sha(bytes) });
}
async function groundShot(label) {
  await closeModal(); await currentPage.waitForFunction(()=>{const raw=document.querySelector('#world')?.dataset.outdoorGround;return raw&&JSON.parse(raw).terrain?.ready===true;},null,{timeout:15000});await settled();
  const {canvasPng,...f}=await frame(true),path=`artifacts/v034-regions-${receiptTag}-${String(receipt.screenshots.length+1).padStart(2,'0')}-${label}-raw-canvas.png`;
  assert.equal(f.outdoor.nodes.length,52);assert.deepEqual(f.outdoor.regions.map(r=>r.id),catalog.regions.map(r=>r.id));
  for(const region of f.outdoor.regions){const canonical=catalog.regions.find(r=>r.id===region.id),ids=catalog.nodes.filter(n=>n.regionId===region.id).map(n=>n.id);for(const key of ['id','name','description','bounds','path','pathWidth'])assert.deepEqual(region[key],canonical[key]);assert.deepEqual(region.nodeIds,ids);assert.equal(region.totalCount,ids.length);assert.equal(region.readyCount,ids.filter(id=>f.outdoor.nodes.find(n=>n.id===id)?.ready).length);}
  for(const rendered of f.outdoor.nodes){const node=catalog.nodes.find(n=>n.id===rendered.id),canonical=receipt.visualCatalog.nodes.find(n=>n.id===rendered.id),visual=rendered.visual==='stump'?canonical.stump:rendered.visual==='depleted'?canonical.depleted:canonical;assert.equal(rendered.regionId,node.regionId);assert.deepEqual(rendered.point,{x:node.point[0],y:node.point[1]});assert.equal(rendered.art.ready,true);assert.equal(rendered.art.painted,true);assert.equal(rendered.art.sourceAtlas,'ground-props');assert.deepEqual(rendered.art.bounds,visual.bounds);for(const key of ['sprite','variant','width','height'])assert.equal(rendered.art[key],visual.art[key]);}
  const bytes=Buffer.from(canvasPng.split(',')[1],'base64');await writeFile(path,bytes);const evidence={case:currentCase,label,capture:'actual-world-canvas-toDataURL',path,bytes:bytes.length,sha256:sha(bytes),canvasPixels:f.canvasPixels,frame:f};receipt.screenshots.push({case:currentCase,capture:evidence.capture,path,bytes:bytes.length,sha256:evidence.sha256});receipt.visualGround.push(evidence);return evidence;
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
    window.__v034Frames = []; window.__v034World = null; window.__v034Continuous = { frames: 0, roadCircles: 0, violations: [] }; window.__v034Observing = true; let last = -Infinity;
    const clearance = (p, polygon) => { let inside = false, closest = Infinity; for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) { const a = polygon[i], b = polygon[j], dx = b.x - a.x, dy = b.y - a.y, n = dx * dx + dy * dy, t = n ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / n)) : 0; closest = Math.min(closest, Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy)); if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside; } return inside ? -closest : closest; };
    const capture = () => { if (!window.__v034Observing) return; const c = document.querySelector('#world'), m = JSON.parse(c.dataset.freeMovement), a = JSON.parse(c.dataset.sceneAction), o = JSON.parse(c.dataset.outdoorGround), pets = JSON.parse(c.dataset.petMotion || '[]'), polygon = m.world.obstacles.find(o => o.kind === 'truck-body').polygon, continuous = window.__v034Continuous;
      continuous.frames++; for (const body of [m.body, ...pets.map(p => p.body)]) if (body?.surface === 'road') { continuous.roadCircles++;
        for (const obstacle of m.world.obstacles.filter(o => o.surface === 'road')) { const separation = clearance(body, obstacle.polygon); if (separation < body.radius - .012 && continuous.violations.length < 20) continuous.violations.push({ kind: obstacle.kind === 'truck-body' ? 'under-truck' : 'ground-resource-overlap', obstacleKind: obstacle.kind, body, separation, realAt: Date.now() }); }
      }
      if ((o.truckOpacity !== 1 || o.cutaway !== false) && continuous.violations.length < 20) continuous.violations.push({ kind: 'truck-transparency', o });
      if (m.frameAt - last >= 100) { last = m.frameAt; const state = JSON.parse(localStorage.getItem('road-haven-save-v1')), { world, ...movement } = m, g = JSON.parse(c.dataset.sceneGeometry); window.__v034World ??= world;
        window.__v034Frames.push({ label, realAt: Date.now(), at: performance.now(), frameAt: m.frameAt, movement, action: a,
          outdoor: { truckOpacity: o.truckOpacity, cutaway: o.cutaway, groundPolicy: o.groundPolicy, nodes: o.nodes?.map(n => ({ id: n.id, ready: n.ready, remainingSeconds: n.remainingSeconds, visual: n.visual })) },
          pets: pets.map(p => ({ id: p.id, x: p.x, y: p.y, body: p.body, surface: p.surface, link: p.link, pose: p.pose })),
          geometry: { scale: g.scale, dx: g.dx, dy: g.dy, cameraMode: g.cameraMode, resourceFocus: g.resourceFocus },
          account: { resources: state.resources, seedInventory: state.seedInventory, xp: state.xp, stats: state.stats, quests: state.quests, gathering: state.gathering, roadside: state.roadside }, energy: state.energy, recovery: state.energyRecovery }); }
      requestAnimationFrame(capture);
    }; requestAnimationFrame(capture);
  }, label);
}
async function stopObserve() { return currentPage.evaluate(() => { window.__v034Observing = false; return { frames: window.__v034Frames ?? [], world: window.__v034World, continuous: window.__v034Continuous }; }); }
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
  await currentContext.addInitScript(save => { if (sessionStorage.getItem('v034-installed')) return; const raw = JSON.stringify(save); localStorage.setItem('road-haven-save-v1', raw); window.__v034Installed = { raw, at: Date.now() }; sessionStorage.setItem('v034-installed', '1'); }, input.save);
  currentPage = await currentContext.newPage(); const pageCase = currentCase;
  currentPage.on('pageerror', e => receipt.errors.push({ case: pageCase, message: e.message }));
  currentPage.on('response', r => { if (r.status() >= 400 && ['script', 'stylesheet', 'image', 'font'].includes(r.request().resourceType())) receipt.failedAssets.push({ case: pageCase, status: r.status(), url: r.url() }); });
  await currentPage.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await currentPage.waitForFunction(() => document.querySelector('#world')?.dataset.freeMovement && !document.querySelector('[data-startup-patch]') && !document.querySelector('#app')?.inert, null, { timeout: 20000 });
  await pause(); await settled();
  const installed = await currentPage.evaluate(() => window.__v034Installed), loaded = await saved(), f = await frame();
  assert.equal(installed.raw, JSON.stringify(input.save), 'startup fixture is installed byte-exact without timestamp edits');
  const initialLoaded = domain('load', input.save), delta = loaded.totalMinutes - initialLoaded.totalMinutes;
  assert.ok(delta >= 0 && Number.isInteger(delta / 4), 'only normal village-clock ticks happened before pause');
  const expected = domain('clock', { state: initialLoaded, minutes: delta }); expected.energy = loaded.energy; expected.energyRecovery = loaded.energyRecovery;
  assert.deepEqual(stable(loaded), stable(expected), 'startup applies only standard migration, actual village progress and real recovery');
  assert.equal(await currentPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'mobile layout has no horizontal overflow');
  assert.equal(f.outdoor.truckOpacity, 1); assert.equal(f.outdoor.cutaway, false);
  assert.equal(f.outdoor.nodes.length,52,'all52 actual ground resources render on every truck size');
  for (const node of catalog.nodes) assert.ok(distance(f.outdoor.nodes.find(n => n.id === node.id).point, { x: node.point[0], y: node.point[1] }) < .002, 'individual resource stays at canonical fixed ground coordinates');
  assert.deepEqual(f.outdoor.regions.map(r=>r.id),catalog.regions.map(r=>r.id),'seven geographic places retain their stable identity');
  const row = { viewport: { width, height }, ...input, installed: { at: installed.at, sha256: sha(installed.raw) }, loaded, initialFrame: f };
  receipt.fixtures.push(row); await shot(`${width}-whole-map`); await groundShot(`${width}-overview`); return { context: currentContext, page: currentPage, case: currentCase, row };
}
async function openRegionMap(){await closeModal();await touch(currentPage.locator('.road-controls [data-open="roadside"]'));}
async function openSite(regionId){await openRegionMap();await touch(currentPage.locator(`[data-ground-region="${regionId}"]`));await currentPage.locator('#modal-root [data-ground-node]').first().waitFor({state:'visible'});}
async function focus(regionId,capture=false){
  currentStep=`focus-region-${regionId}`;await openRegionMap();const before=await saved(),prior=await frame();await touch(currentPage.locator(`[data-region-focus="${regionId}"]`));await currentPage.locator('#modal-root').waitFor({state:'hidden'});await settled();
  const f=await frame(),region=catalog.regions.find(r=>r.id===regionId);assert.equal(f.geometry.resourceFocus?.regionId,regionId,'explicit area button selects the actual geographic region');assert.ok(distance(prior.movement.position,f.movement.position)<.002,'regional camera focus never teleports feet');assert.ok(f.geometry.scale>=.38-.001,'explicit focus keeps the real resources readable');automaticOnly(before,await saved(),currentStep);await noModal(currentStep);
  const views=f.outdoor.nodes.filter(n=>n.regionId===regionId);assert.equal(views.length,catalog.nodes.filter(n=>n.regionId===regionId).length);receipt.focuses.push({case:currentCase,regionId,region,before:prior,after:f});await markerProof(`region-${regionId}`);if(capture)await groundShot(`${currentPage.viewportSize().width}-${regionId}`);return f;
}
const markerRows = f => (f.outdoor.markers ?? f.outdoor.nodes.flatMap(n => n.marker ? [{ id: n.id, ...n.marker }] : [])).map(m=>({ ...m,id:m.id??m.nodeId,icon:m.icon??m.resource }));
const overlap = (a, b) => Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
function worldClient(f, p) { const t = f.renderTransform; return { x: f.rect.x + (t.a*p.x+t.c*p.y+t.e)/t.dpr, y: f.rect.y+(t.b*p.x+t.d*p.y+t.f)/t.dpr }; }
function clientWorld(f, p) { const t=f.renderTransform, x=(p.x-f.rect.x)*t.dpr-t.e, y=(p.y-f.rect.y)*t.dpr-t.f, determinant=t.a*t.d-t.b*t.c; return {x:(t.d*x-t.c*y)/determinant,y:(-t.b*x+t.a*y)/determinant}; }
async function noModal(label) { assert.equal(await currentPage.locator('#modal-root').isVisible(), false, `${label}: direct work opens no full-screen gathering window`); assert.equal(await currentPage.locator('[data-ground-collect]').count(), 0, `${label}: removed confirmation CTA is absent`); }
async function markerProof(label) {
  const f=await frame(), rows=markerRows(f), visible=rows.filter(r=>r.visible!==false), v=f.geometry.viewport;
  const hudControls=await currentPage.locator('.scene-card button').evaluateAll((buttons,rect)=>buttons.map(b=>({label:b.getAttribute('aria-label')??b.innerText,rect:b.getBoundingClientRect()})).filter(({rect:r})=>r.width&&r.height).map(({label,rect:r})=>({label,screenBounds:[r.left-rect.x,r.top-rect.y,r.right-rect.x,r.bottom-rect.y]})),f.rect);
  assert.ok(visible.length, `${label}: real map paints at least one compact resource marker`);
  assert.ok(visible.length<=4,`${label}: map keeps at most four clear resource-kind badges`);
  for(const m of visible) {
    const n=catalog.nodes.find(n=>n.id===m.id); assert.ok(n, 'marker belongs to a real individual resource');
    if(f.geometry.resourceFocus?.regionId)assert.ok(m.nodeIds.every(id=>catalog.nodes.find(n=>n.id===id)?.regionId===f.geometry.resourceFocus.regionId),'focused markers belong only to the explicitly chosen geographical place');
    assert.ok(m.label && /나무|고철|씨앗|샘물|물/.test(m.label), 'Korean resource name identifies the actual collectible');
    assert.equal(m.icon,n.resource,'marker shows the matching recognizable resource picture');
    assert.equal(m.itemArt?.asset,'items-anime');assert.equal(m.itemArt?.decoded,true,'actual marker icon source decoded in browser');assert.equal(m.itemArt?.drawn,true,'actual marker atlas picture painted in browser');
    assert.equal(m.count,m.nodeIds.length);assert.ok(m.nodeIds.includes(m.id));
    assert.ok(m.nodeIds.every(id=>catalog.nodes.find(n=>n.id===id)?.kind===n.kind),'group contains only the named resource kind');
    if(!m.nodeIds.includes(f.action.groundResourceId))assert.equal(m.readyCount,m.nodeIds.filter(id=>f.outdoor.nodes.find(n=>n.id===id)?.ready).length,'ready count describes current independent resource stocks');
    assert.ok(m.screenBounds?.length===4, 'marker exposes exact painted screen bounds');
    const b=m.screenBounds; assert.ok(b[2]>b[0]&&b[3]>b[1]);
    assert.ok(b[2]-b[0]<=140&&b[3]-b[1]<=64, 'resource marker stays compact on the map');
    assert.ok(b[0]>=v.safeLeft-1&&b[1]>=v.safeTop-1&&b[2]<=v.width-v.safeRight+1&&b[3]<=v.height-v.safeBottom+1, 'whole marker fits the usable scene');
    assert.ok(m.hitScreenBounds[2]-m.hitScreenBounds[0]>=44-1e-6&&m.hitScreenBounds[3]-m.hitScreenBounds[1]>=44-1e-6,'map label has a real minimum44px finger target');
    for(const hud of hudControls)assert.ok(overlap(m.hitScreenBounds,hud.screenBounds)<=1,`${label}: whole resource touch target clears the actual HUD control ${hud.label}`);
    assert.ok(['ready','working','cooldown','unaffordable','busy'].includes(m.status), `clear readiness status: ${m.status}`);
  }
  for(let i=0;i<visible.length;i++)for(let j=i+1;j<visible.length;j++){assert.ok(overlap(visible[i].screenBounds,visible[j].screenBounds)<=1, `${label}: visible marker labels do not overlap`);assert.ok(overlap(visible[i].hitScreenBounds,visible[j].hitScreenBounds)<=1,`${label}: finger targets do not ambiguously overlap`);}
  const row={case:currentCase,label,frame:f,visible,hudControls};receipt.markers.push(row);return row;
}
async function nativeNodePoint(id, mode='label') {
  const f=await frame(), index=catalog.nodes.findIndex(n=>n.id===id), marker=markerRows(f).find(m=>m.id===id&&m.visible!==false);
  const hudRects=mode==='body'?await currentPage.locator('.scene-card button').evaluateAll(buttons=>buttons.map(b=>({label:b.getAttribute('aria-label')??b.innerText,bounds:b.getBoundingClientRect().toJSON()})).filter(({bounds:b})=>b.width&&b.height)):[];
  const hudClearance=p=>Math.min(...hudRects.map(({bounds:b})=>Math.hypot(Math.max(b.left-p.x,p.x-b.right,0),Math.max(b.top-p.y,p.y-b.bottom,0))));
  let point,world,hit;
  if(mode==='label') {
    assert.ok(marker, `${id}: visible compact label is directly tappable`);const b=marker.screenBounds;
    point={x:f.rect.x+(b[0]+b[2])/2,y:f.rect.y+(b[1]+b[3])/2};world=clientWorld(f,point);
    hit=f.hits.find(h=>h.nodeId===id&&h.marker)??f.hits.find(h=>h.nodeId===id&&h.kind==='ground-resource');
  } else {
    const own=f.hits.find(h=>h.kind==='ground-resource'&&h.nodeId===id&&!h.marker); assert.ok(own, `${id}: actual resource body has an individual native canvas hit`);
    const bounds=f.outdoor.nodes.find(n=>n.id===id)?.art.bounds??own.bounds, candidates=[{x:(bounds[0]+bounds[2])/2,y:(bounds[1]+bounds[3])/2}];
    for(let yi=1;yi<10;yi++)for(let xi=1;xi<10;xi++)candidates.push({x:bounds[0]+(bounds[2]-bounds[0])*xi/10,y:bounds[1]+(bounds[3]-bounds[1])*yi/10});
    const inside=(p,h)=>h.polygon?clearance(p,h.polygon.map(([x,y])=>({x,y})))<=0:h.bounds?p.x>=h.bounds[0]&&p.x<=h.bounds[2]&&p.y>=h.bounds[1]&&p.y<=h.bounds[3]:distance(p,h)<h.radius;
    const v=f.geometry.viewport;
    for(const candidate of candidates) {
      if(!inside(candidate,own))continue; const p=worldClient(f,candidate);
      if(p.x<f.rect.x+v.safeLeft+3||p.x>f.rect.right-v.safeRight-3||p.y<f.rect.y+v.safeTop+3||p.y>f.rect.bottom-v.safeBottom-3)continue;
      if(hudClearance(p)<14)continue;
      if(markerRows(f).some(m=>{const b=m.hitScreenBounds;return m.visible!==false&&p.x-f.rect.x>=b[0]&&p.x-f.rect.x<=b[2]&&p.y-f.rect.y>=b[1]&&p.y-f.rect.y<=b[3];}))continue;
      const resource=f.hits.filter(h=>h.kind==='ground-resource'&&inside(candidate,h)).at(-1);
      if(resource?.nodeId!==id||f.hits.some(h=>['pet','character','pet-gate','road-entry','outdoor-site'].includes(h.kind)&&inside(candidate,h)))continue;
      if(await currentPage.evaluate(p=>document.elementFromPoint(p.x,p.y)?.id==='world',p)){world=candidate;point=p;hit=own;break;}
    }
    assert.ok(point, `${id}: unoccluded resource art body has a genuine native touch point outside every label`);
  }
  assert.equal(await currentPage.evaluate(p=>document.elementFromPoint(p.x,p.y)?.id==='world',point),true, `${id}: finger lands on the actual world canvas`);
  return {id,index,mode,marker,point,world,hit,frame:f,...(mode==='body'?{hudRects,hudClearance:hudClearance(point)}:{})};
}
async function tapNode(id, mode='label') {
  const input=await nativeNodePoint(id,mode);
  const domBefore=await currentPage.evaluate(p=>{
    const describe=e=>e?{tag:e.tagName,id:e.id,className:e.className,button:e.closest('button')?{label:e.closest('button').getAttribute('aria-label'),dataset:{...e.closest('button').dataset},bounds:e.closest('button').getBoundingClientRect().toJSON()}:null}:null;
    return {point:p,target:describe(document.elementFromPoint(p.x,p.y)),scroll:{x:scrollX,y:scrollY},visualViewport:visualViewport?{scale:visualViewport.scale,offsetLeft:visualViewport.offsetLeft,offsetTop:visualViewport.offsetTop,pageLeft:visualViewport.pageLeft,pageTop:visualViewport.pageTop,width:visualViewport.width,height:visualViewport.height}:null,
      nearbyButtons:[...document.querySelectorAll('button')].map(b=>({label:b.getAttribute('aria-label')??b.innerText,dataset:{...b.dataset},bounds:b.getBoundingClientRect().toJSON()})).filter(b=>Math.hypot(Math.max(b.bounds.left-p.x,p.x-b.bounds.right,0),Math.max(b.bounds.top-p.y,p.y-b.bounds.bottom,0))<25)};
  },input.point);
  assert.equal(domBefore.target.id,'world','just-before-touch DOM hit is the actual canvas');
  const row={case:currentCase,step:currentStep,kind:'native-direct-node',...input,domBefore};receipt.inputs.push(row);
  await currentPage.evaluate(()=>{window.__v034DocumentEvents=[];const listener=e=>{const b=e.target.closest?.('button');window.__v034DocumentEvents.push({type:e.type,isTrusted:e.isTrusted,realAt:Date.now(),client:{x:e.clientX,y:e.clientY},target:{tag:e.target.tagName,id:e.target.id,className:e.target.className},button:b?{label:b.getAttribute('aria-label'),dataset:{...b.dataset},bounds:b.getBoundingClientRect().toJSON()}:null,path:e.composedPath().slice(0,5).map(n=>({tag:n.tagName,id:n.id,className:typeof n.className==='string'?n.className:null}))});};
    for(const type of ['pointerdown','pointerup','pointercancel','touchstart','touchend','click'])document.addEventListener(type,listener,{once:true,capture:true});
  });
  await currentPage.locator('#world').evaluate(canvas=>{window.__v034LastPointer=null;canvas.addEventListener('pointerup',e=>{
    const r=canvas.getBoundingClientRect(),t=canvas.getContext('2d').getTransform(),dpr=Math.min(devicePixelRatio||1,2),x=(e.clientX-r.x)*dpr-t.e,y=(e.clientY-r.y)*dpr-t.f,det=t.a*t.d-t.b*t.c;
    window.__v034LastPointer={isTrusted:e.isTrusted,realAt:Date.now(),client:{x:e.clientX,y:e.clientY},renderTransform:{a:t.a,b:t.b,c:t.c,d:t.d,e:t.e,f:t.f,dpr},world:{x:(t.d*x-t.c*y)/det,y:(-t.b*x+t.a*y)/det}};
  },{once:true,capture:true});});
  await currentPage.touchscreen.tap(input.point.x,input.point.y);
  await currentPage.waitForFunction(()=>window.__v034DocumentEvents.some(e=>e.type==='pointerup'||e.type==='pointercancel'),null,{timeout:3000});
  const actual=await currentPage.evaluate(()=>window.__v034LastPointer);
  row.actual=actual;row.nativeEvents=await currentPage.evaluate(()=>window.__v034DocumentEvents);
  assert.equal(actual?.isTrusted,true);assert.ok(distance(actual.world,input.world)<.002,'native finger resolves through the exact actual Canvas2D transform');
  return row;
}
async function beginModalAudit() { await currentPage.evaluate(()=>{window.__v034ModalAudit={events:[],frames:0,openedFrames:0};window.__v034ModalAuditing=true;
  const el=document.querySelector('#modal-root'),note=()=>{if(!el.hidden)window.__v034ModalAudit.events.push({at:performance.now(),text:el.innerText});};window.__v034ModalObserver=new MutationObserver(note);window.__v034ModalObserver.observe(el,{attributes:true,attributeFilter:['hidden','class'],childList:true,subtree:true});
  const step=()=>{if(!window.__v034ModalAuditing)return;window.__v034ModalAudit.frames++;if(!el.hidden)window.__v034ModalAudit.openedFrames++;requestAnimationFrame(step);};requestAnimationFrame(step);
}); }
async function endModalAudit(label) { const audit=await currentPage.evaluate(()=>{window.__v034ModalAuditing=false;window.__v034ModalObserver.disconnect();return window.__v034ModalAudit;});assert.deepEqual(audit.events,[],`${label}: no gathering modal even briefly opens`);assert.equal(audit.openedFrames,0);assert.ok(audit.frames>0);return audit; }
async function collect(id,{mode='label',duplicateTap=false,list=false}={}) {
  currentStep=`direct-collect-${id}`;
  if(list)await openSite(catalog.nodes.find(n=>n.id===id).regionId);else await closeModal();
  const before=await saved(),node=catalog.nodes.find(n=>n.id===id),rule=catalog.rules[node.siteId],beforeFrame=await frame();assert.ok(before.energy>=rule.energy);
  if(!list)await beginModalAudit();await observe(currentStep);const realStartedAt=Date.now();
  const input=list?await touch(currentPage.locator(`[data-ground-node="${id}"]`)):await tapNode(id,mode);
  if(list){await noModal('area-list direct action');await beginModalAudit();}
  await currentPage.waitForFunction(id=>{const a=JSON.parse(document.querySelector('#world').dataset.sceneAction);return a.groundResourceId===id&&['outbound','working'].includes(a.phase);},id,{timeout:5000});
  await noModal('one tap starts physical movement');
  const started=await frame();assert.equal(started.geometry.resourceFocus?.regionId,beforeFrame.geometry.resourceFocus?.regionId,'tap keeps the current explicit map view');
  if(duplicateTap){const duplicate=await tapNode(id,mode);await noModal('duplicate tap');assert.equal((await frame()).action.groundResourceId,id);receipt.inputs.push({case:currentCase,kind:'duplicate-direct-node',id,input:duplicate});}
  await currentPage.waitForFunction(id=>{const a=JSON.parse(document.querySelector('#world').dataset.sceneAction);return a.groundResourceId===id&&a.phase==='working';},id,{timeout:45000});
  const working=await frame();assert.equal(working.movement.surface,'road');const workingMarker=markerRows(working).find(m=>m.nodeIds.includes(id));assert.ok(workingMarker,'active real resource has a visible status marker');assert.equal(workingMarker.status,'working','busy marker explains that work is underway');await markerProof(`${id}-working`);await shot(`${currentPage.viewportSize().width}-${id}-direct-working`);
  await currentPage.waitForFunction(()=>!document.querySelector('#app')?.hasAttribute('aria-busy')&&JSON.parse(document.querySelector('#world').dataset.sceneAction).phase==='idle',null,{timeout:45000});
  await settled();const after=await saved(),afterFrame=await frame(),observation=await stopObserve(),realEndedAt=Date.now(),modalAudit=await endModalAudit(id);await noModal('completed direct work');
  const row=after.gathering.nodes[id],old=before.gathering?.nodes[id]??{visits:0,readyAtMs:0},commitAt=row.readyAtMs-180000;assert.ok(commitAt>=realStartedAt&&commitAt<=realEndedAt);assert.equal(row.visits,old.visits+1,'one direct touch commits one visit');
  const costAt=before.energy===100?after.energyRecovery.checkedAt-after.energyRecovery.carryMs:commitAt;assert.ok(costAt>=realStartedAt&&costAt<=realEndedAt);
  const recovered=domain('recover',{state:before,now:costAt}),result=domain('collect',{state:recovered,id,now:commitAt});assert.equal(result.ok,true);const expected=domain('recover',{state:result.state,now:after.energyRecovery.checkedAt});assert.deepEqual(stable(after),stable(expected),'one exact atomic resource/typed-seed/XP/quest/cooldown/energy transaction');
  const signatures=observation.frames.map(f=>JSON.stringify(f.account)),transitions=signatures.slice(1).filter((v,i)=>v!==signatures[i]).length;assert.equal(transitions,1);
  for(const f of observation.frames.filter(f=>f.action.groundResourceId===id&&['outbound','working'].includes(f.action.phase)))assert.deepEqual(f.account,economy(before),'walking and work grant no early reward');
  const active=observation.frames.filter(f=>f.action.groundResourceId===id);for(const phase of ['outbound','working'])assert.ok(active.some(f=>f.action.phase===phase));assert.equal(working.action.returnWalk,0);assert.ok(node.approaches.some(([x,y])=>distance(afterFrame.movement.position,{x,y})<3));
  assert.ok(Math.abs(afterFrame.geometry.scale-beforeFrame.geometry.scale)<.002,'direct work never automatically zooms the camera');
  const proof=physicalProof(observation,currentStep);receipt.collections.push({case:currentCase,id,mode,list,duplicateTap,input,before,after,node,rule,beforeFrame,started,realStartedAt,realEndedAt,commitAt,costAt,working,afterFrame,economicTransitions:transitions,modalAudit,observation,proof});
  console.log(`PASS ${currentCase} ${id}: ${list?'area-list':mode} one tap, no modal, one exact transaction.`);return receipt.collections.at(-1);
}
async function rejected(id,reason,mode='label') {
  currentStep=`${reason}-direct-${id}`;await closeModal();if(mode==='list')await openSite(catalog.nodes.find(n=>n.id===id).regionId);const before=await saved(),beforeFrame=await frame(),view=domain('view',{state:before,id,now:Date.now()});
  assert.equal(reason==='cooldown'?!view.ready:before.energy<catalog.rules[catalog.nodes.find(n=>n.id===id).siteId].energy,true);
  let input;if(mode==='list'){input=await touch(currentPage.locator(`[data-ground-node="${id}"]`));await currentPage.locator('#modal-root').waitFor({state:'hidden'});await beginModalAudit();}else{await beginModalAudit();input=await tapNode(id,mode);}await currentPage.waitForTimeout(350);const after=await saved(),f=await frame(),text=await currentPage.locator('#toast').innerText(),modalAudit=await endModalAudit(currentStep);await noModal(currentStep);
  assert.equal(f.action.phase,'idle');assert.ok(distance(f.movement.position,beforeFrame.movement.position)<.002);automaticOnly(before,after,currentStep);
  if(reason==='cooldown')assert.match(text,/\d+초/);else assert.match(text,/기력/);
  assert.ok(Math.abs(f.geometry.scale-beforeFrame.geometry.scale)<.002);receipt.rejections.push({case:currentCase,id,reason,mode,before,after,beforeFrame,afterFrame:f,view,text,input,modalAudit});await markerProof(currentStep);await shot(`${currentPage.viewportSize().width}-${reason}-toast`);
}
async function constructionProof() {currentStep='construction-keeps-large-sheet';await closeModal();const before=await saved();await touch(currentPage.locator('.game-nav [data-nav="build"]'));assert.equal(await currentPage.locator('#modal-root').isVisible(),true);const text=await currentPage.locator('#modal-root').innerText(),bounds=await currentPage.locator('#modal-root .modal').boundingBox();assert.match(text,/건설|시설/);assert.ok(bounds&&bounds.height>150);receipt.construction.push({case:currentCase,text,bounds});await shot(`${currentPage.viewportSize().width}-construction-sheet-retained`);await closeModal();automaticOnly(before,await saved(),currentStep);}
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
  await focus('grove'); currentStep = 'native-forest-trail'; await closeModal(); await settled(); const before = await saved(), f = await frame(), zone = catalog.regions.find(z => z.id === 'grove');
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
  receipt.walks.push({ case: currentCase, label: currentStep, point, client, before: f, after: final, observation, proof }); 
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
  await currentPage.locator('#world').evaluate(canvas => { window.__v034BlockedTouch = null; canvas.addEventListener('pointerup', e => { window.__v034BlockedTouch = { isTrusted: e.isTrusted, realAt: Date.now(), point: { x: e.clientX, y: e.clientY }, canvasHit: document.elementFromPoint(e.clientX, e.clientY) === canvas }; }, { once: true, capture: true }); });
  await observe(currentStep); await currentPage.touchscreen.tap(chosen.client.x, chosen.client.y); await currentPage.waitForTimeout(450);
  const observation = await stopObserve(), after = await frame(), actual = await currentPage.evaluate(() => window.__v034BlockedTouch);
  assert.ok(actual?.isTrusted && actual.canvasHit, 'trusted native finger actually released inside the opaque truck body');
  for (const row of observation.frames) { assert.equal(row.movement.moving, false); assert.equal(row.movement.target, null); assert.ok(distance(row.movement.position, f.movement.position) < .002, 'truck interior input cannot move real ground feet'); }
  assert.equal(after.movement.target, null); assert.equal(await currentPage.locator('#modal-root').isVisible(), false);
  automaticOnly(before, await saved(), currentStep); const proof = physicalProof(observation, currentStep);
  receipt.blockedInputs.push({ case: currentCase, chosen, actual, before: f, after, observation, proof }); 
}

async function preserveSourceInputs(){
  const priorBytes=await readFile(previousReceiptPath);assert.equal(sha(priorBytes),'c4fa972c7bd74411c7e6b2054cee34413c96a4fdd1a7a2a474a942a513e062e2');const prior=JSON.parse(priorBytes),rows={};
  for(const[path,digest]of Object.entries(receipt.sourceHashesAtStart)){
    const bytes=await readFile(path);assert.equal(sha(bytes),digest);const binary=/\.(png|jpe?g|webp|ico|woff2?)$/i.test(path);
    if(binary&&prior.sourceHashesAtStart[path]===digest)rows[path]={kind:'immutable-v033-git-binary',commit:'eaf4d075ff01aaca05373b4ad9c4728cfd77f376',path,bytes:bytes.length,sha256:digest};
    else{const backup=`artifacts/diagnostics/v034-${receiptTag}/source-inputs/${path}`;await mkdir(backup.slice(0,backup.lastIndexOf('/')),{recursive:true});await writeFile(backup,bytes,{flag:'wx'});rows[path]={kind:'copied-source-input',path:backup,bytes:bytes.length,sha256:digest};}
  }
  const path=`artifacts/diagnostics/v034-${receiptTag}/source-preservation.json`,bytes=Buffer.from(JSON.stringify({sourceHashes:receipt.sourceHashesAtStart,files:rows,executedTestBackup},null,2));await writeFile(path,bytes,{flag:'wx'});receipt.executedSourceBackup={path,sha256:sha(bytes),files:rows};
}
async function regionMapProof(){
  currentStep='seven-region-map';await openRegionMap();const before=await saved(),cards=await currentPage.locator('[data-ground-region-card]').evaluateAll(cards=>cards.map(c=>({id:c.dataset.groundRegionCard,text:c.innerText,resources:[...c.querySelectorAll('.ground-region-resources span')].map(s=>s.innerText),focus:c.querySelector('[data-region-focus]')?.getAttribute('data-region-focus'),list:c.querySelector('[data-ground-region]')?.getAttribute('data-ground-region')})));
  assert.deepEqual(cards.map(c=>c.id).sort(),catalog.regions.map(r=>r.id).sort());for(const c of cards){assert.ok(c.text.includes(catalog.regions.find(r=>r.id===c.id).name));assert.equal(c.focus,c.id);assert.equal(c.list,c.id);if(['west-grove','north-ruins','east-creek'].includes(c.id))for(const label of['나무','고철','씨앗','샘물'])assert.ok(c.resources.some(r=>r.includes(label)),`${c.id} map card identifies all four actual resource kinds`);}
  receipt.regionMaps??=[];receipt.regionMaps.push({case:currentCase,cards});await shot(`${currentPage.viewportSize().width}-seven-region-map`);await closeModal();automaticOnly(before,await saved(),currentStep);
}
try{
  await preserveSourceInputs();const previousBytes=await readFile(previousReceiptPath),previous=JSON.parse(previousBytes),timingBytes=await readFile(timingReceiptPath),timing=JSON.parse(timingBytes);assert.equal(sha(timingBytes),'ba821b52f63a90468b142550ef1dd00fc33e57595407f74df459c38e838de4ae');assert.equal(timing.status,'passed');assert.equal(timing.finalSnapshot,true);
  for(const old of previous.catalog.nodes){const current=catalog.nodes.find(n=>n.id===old.id),{regionId,...withoutRegion}=current;assert.deepEqual(withoutRegion,old,'original28 nodes retain all coordinates, order, approaches, seed family and collisions');assert.equal(regionId,old.siteId);}
  for(const id of['west-grove','north-ruins','east-creek']){const nodes=catalog.nodes.filter(n=>n.regionId===id);assert.equal(nodes.length,8);for(const kind of['tree','scrap','seed','water'])assert.equal(nodes.filter(n=>n.kind===kind).length,2);}
  const core=domain('timingCore');assert.equal(core.priorFileSha256,'bead5be998965ec30810f2b3071b417ade63d94df9f7909ebcd3ece93e4bb553');assert.deepEqual(Object.keys(core.currentDeclarationHashes).sort(),core.names.toSorted());assert.deepEqual(core.currentDeclarationHashes,core.priorDeclarationHashes,'past real180s timing evidence applies only to byte-identical actual clock/readiness/commit declarations');assert.equal(receipt.sourceHashesAtStart['src/energy-recovery.ts'],timing.sourceHashesAtStart['src/energy-recovery.ts']);
  receipt.reusedRegeneration={path:timingReceiptPath,sha256:sha(timingBytes),priorSourcePath:priorTimingSourcePath,priorSourceSha256:core.priorFileSha256,algorithm:core,priorBoundaryRows:timing.regenerations.filter(r=>r.independentBoundary).map(r=>({realAt:r.realAt,elapsedSinceFirstCommitMs:r.elapsedSinceFirstCommitMs,elapsedSinceSecondCommitMs:r.elapsedSinceSecondCommitMs,firstReady:r.first.ready,secondReady:r.second.ready})),scope:'Only exact device-clock/readiness/commit declarations reuse earlier real180s measurement. New52-node catalog/migration/routes are current unit/browser evidence; this run makes no claim that a new node waited180 seconds.'};assert.ok(receipt.reusedRegeneration.priorBoundaryRows.length);
  if(finalSnapshot){const manifest=JSON.parse(await readFile(executionInputs.snapshotManifestPath,'utf8'));assert.equal(manifest.snapshotId,snapshotId);assert.equal(manifest.version,version);for(const[path,expected]of Object.entries(manifest.files)){const url=new URL(path,new URL('/',baseUrl)),response=await fetch(url);assert.equal(response.status,200);const bytes=Buffer.from(await response.arrayBuffer());assert.equal(sha(bytes),expected);receipt.httpIdentity.push({path,url:String(url),bytes:bytes.length,sha256:expected});}}
  const fresh=await fixture(),paid=await fixture(true);browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  for(const[width,height,input]of[[390,844,fresh],[344,740,fresh],[844,390,paid]]){
    const mobile=await begin(width,height,input);await markerProof('ordinary-overview');await regionMapProof();
    if(input.paid){const loaded=await saved(),normalized=domain('progress',loaded);assert.equal(Object.keys(input.save.gathering.nodes).length,28);assert.equal(Object.keys(normalized.nodes).length,52);for(const[id,row]of Object.entries(input.save.gathering.nodes))assert.deepEqual(normalized.nodes[id],row,'old paid deadline and visits survive migration before any work');for(const id of catalog.nodes.slice(28).map(n=>n.id))assert.deepEqual(normalized.nodes[id],{visits:0,readyAtMs:0});mobile.row.migration={original:input.save.gathering,stored:loaded.gathering,normalized};}
    const captures=visualOnly?['west-grove','north-ruins','east-creek']:width===390?['grove','west-grove','north-ruins','east-creek']:['west-grove','north-ruins','east-creek'];
    for(const region of catalog.regions)await focus(region.id,captures.includes(region.id));
    if(!visualOnly){
      await constructionProof();
      if(width===390){
        await focus('west-grove');const tree=markerRows(await frame()).find(m=>m.icon==='wood')?.id;assert.ok(tree);await collect(tree,{duplicateTap:true});await rejected(tree,'cooldown','list');
        await collect('seed-05',{mode:'body'});await focus('north-ruins');await collect('scrap-07',{mode:'body'});await rejected('scrap-07','cooldown','body');await focus('east-creek');const water=markerRows(await frame()).find(m=>m.icon==='water')?.id;assert.ok(water);await collect(water);
      }else if(width===344){await focus('north-ruins');const seed=markerRows(await frame()).find(m=>m.icon==='seeds')?.id;assert.ok(seed);await collect(seed,{duplicateTap:true});}
      else{await focus('east-creek');const water=markerRows(await frame()).find(m=>m.icon==='water')?.id;assert.ok(water);await collect(water,{list:true});for(const[id,row]of Object.entries(input.save.gathering.nodes))assert.deepEqual((await saved()).gathering.nodes[id],row,'new-region work never resets an original paid node');}
      await walkTrail();await blockedTruck();await reloadProof();mobile.row.after=await saved();assert.equal(mobile.row.after.deckLevel,input.save.deckLevel);assert.deepEqual(mobile.row.after.truckLayout,input.save.truckLayout);
    }
    await mobile.context.close();
  }
  assert.equal(receipt.fixtures.length,3);assert.equal(receipt.focuses.filter(f=>f.regionId).length>=21,true);if(!visualOnly){assert.equal(receipt.collections.length,6);assert.deepEqual([...new Set(receipt.collections.map(c=>c.node.regionId))].sort(),['east-creek','north-ruins','west-grove']);assert.deepEqual([...new Set(receipt.collections.map(c=>c.node.kind))].sort(),['scrap','seed','tree','water']);assert.equal(receipt.reloads.length,3);assert.equal(receipt.blockedInputs.length,3);assert.equal(receipt.construction.length,3);assert.equal(receipt.rejections.length,2);}
  assert.deepEqual(receipt.errors,[]);assert.deepEqual(receipt.failedAssets,[]);receipt.sourceHashesAtEnd=await sourceHashes();assert.deepEqual(receipt.sourceHashesAtEnd,receipt.sourceHashesAtStart);assert.equal(sha(await readFile(executionInputs.testPath)),executionInputs.testSha256);receipt.status=visualOnly?'visual-captured':'passed';
}catch(error){receipt.status='failed';receipt.failure={case:currentCase,step:currentStep,message:String(error),stack:error.stack};process.exitCode=1;if(currentPage)try{receipt.failure.save=await saved();receipt.failure.frame=await frame();receipt.failure.observation=await stopObserve();await shot('failure');}catch(captureError){receipt.failure.captureError=String(captureError);}}
finally{if(browser)await browser.close();receipt.sourceHashesAtEnd??=await sourceHashes();receipt.testSha256AtEnd=sha(await readFile(executionInputs.testPath));receipt.finishedAt=new Date().toISOString();receipt.assertionsExecuted=assertionsExecuted;const path=`artifacts/v034-regions-${receiptTag}-verification.json`;await writeFile(path,JSON.stringify(receipt));console.log(JSON.stringify({status:receipt.status,assertionsExecuted,receipt:path,error:receipt.failure?.message}));}
