import { chromium } from '@playwright/test';
import strictAssert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { captureExecutionInputs } from './release-execution-inputs.mjs';

// New v35 art/regression evidence only. Old release harnesses and receipts remain intact.
// Startup installs only an exact createGame or an observed, unchanged paid save.
// All subsequent movement, gate changes, work, party choices and camera gestures use native input.
const baseUrl = process.env.TEST_BASE_URL ?? 'http://127.0.0.1:4302/House/';
const tag = process.env.TEST_RECEIPT_TAG ?? `development-${Date.now()}`;
const visualOnly = process.env.TEST_V035_VISUAL_ONLY === '1';
const finalSnapshot = process.env.TEST_FINAL_SNAPSHOT === '1';
const snapshotId = process.env.TEST_SNAPSHOT_ID ?? (finalSnapshot ? 'v035-r1' : 'mutable-development-diagnostic');
if (finalSnapshot && visualOnly) throw Error('Final QA must include the real interaction checks');
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tag)) throw Error('Use a unique safe evidence tag');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
let assertions = 0;
const assert = new Proxy(strictAssert, { get(t, k) { const v = Reflect.get(t, k); return typeof v === 'function' ? (...a) => { assertions++; return v(...a); } : v; } });
const testPath = 'tests/gameplay-v035-art-mobile.mjs', output = `artifacts/v035-art-${tag}`;
const executionInputs = await captureExecutionInputs(import.meta.url, { snapshotId, finalSnapshot, dependencies: ['artifacts/v033-direct-gather-final-r1-verification.json'] });
await mkdir(`${output}-inputs`, { recursive: true });
const testBytes = await readFile(testPath);
await writeFile(`${output}-inputs/executed-harness.mjs`, testBytes, { flag: 'wx' });
const sourceHashes = async () => {
  const r = spawnSync('rg', ['--files', '--hidden', '--no-ignore', 'src', 'public', 'scripts', 'index.html', 'package.json', 'package-lock.json', 'release-version.json', 'content-release.json', 'capacitor.config.ts', 'vite.config.ts', 'tsconfig.json'], { encoding: 'utf8' });
  if (r.status) throw Error(r.stderr);
  return Object.fromEntries(await Promise.all(r.stdout.trim().split('\n').sort().map(async p => [p, sha(await readFile(p))])));
};
function domain(op, input = {}) {
  const script = `import {createGame} from './src/game.ts';import {recoverEnergy} from './src/energy-recovery.ts';import {performGatheringAction} from './src/gathering.ts';import {getPetPassageGeometry,PET_PASSAGE_MAX_BODY_RADIUS} from './src/pet-passage.ts';
  const op=process.argv[1],x=JSON.parse(process.argv[2]);console.log(JSON.stringify(op==='fresh'?createGame('female','우리 숲 그림 검수'):op==='gather'?performGatheringAction(x.state,x.id,x.now):op==='recover'?recoverEnergy(x.state,x.now):Array.from({length:8},(_,i)=>({level:i+1,...getPetPassageGeometry(i+1),maximumRadius:PET_PASSAGE_MAX_BODY_RADIUS}))));`;
  const r = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script, op, JSON.stringify(input)], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr); return JSON.parse(r.stdout);
}
const receipt = { schemaVersion: 1, version: JSON.parse(await readFile('package.json')).version, tag, baseUrl, visualOnly, finalSnapshot, snapshotId, executionInputs,
  startedAt: new Date().toISOString(), status: 'running', testPath, testSha256: sha(testBytes), sourceHashesAtStart: await sourceHashes(),
  scope: 'Lean Chromium mobile/desktop art and native interaction checks. No clock, actor position, route, resources or progress injection after exact ordinary startup fixtures. Natural RAF records compact positions and summary counters only.',
  fixtures: [], screenshots: [], actions: [], observations: [], httpIdentity: [], errors: [], failedAssets: [] };
let browser, context, page, currentCase = 'preflight', step = 'preflight';
const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('road-haven-save-v1')));
const stable = s => { s = structuredClone(s); delete s.lastSaved; return s; };
const scene = () => page.locator('#world').evaluate(c => { const t = c.getContext('2d').getTransform(); return { g: JSON.parse(c.dataset.sceneGeometry), m: JSON.parse(c.dataset.freeMovement), a: JSON.parse(c.dataset.sceneAction), pets: JSON.parse(c.dataset.petMotion ?? '[]'), passage: JSON.parse(c.dataset.petPassage), outdoor: JSON.parse(c.dataset.outdoorGround), hits: JSON.parse(c.dataset.sceneHits), rect: c.getBoundingClientRect().toJSON(), t: { a: t.a, b: t.b, c: t.c, d: t.d, e: t.e, f: t.f, dpr: Math.min(devicePixelRatio || 1, 2) } }; });
async function touch(locator) {
  await locator.scrollIntoViewIfNeeded();
  await locator.evaluate(async el => { const animations = []; for (let n = el; n; n = n.parentElement) animations.push(...n.getAnimations().filter(a => a.effect?.getComputedTiming().iterations !== Infinity)); await Promise.all(animations.map(a => a.finished.catch(() => {}))); });
  const b = await locator.boundingBox(); assert.ok(b && b.width >= 44 && b.height >= 44);
  const p = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  assert.equal(await locator.evaluate((el, p) => document.elementFromPoint(p.x, p.y)?.closest('button') === el, p), true);
  receipt.actions.push({ case: currentCase, step, kind: 'native-button', point: p, label: await locator.getAttribute('aria-label') ?? await locator.innerText() });
  if (currentCase.startsWith('desktop')) await page.mouse.click(p.x, p.y); else await page.touchscreen.tap(p.x, p.y);
}
async function closeModal() { if (await page.locator('#modal-root').isVisible()) await touch(page.locator('#modal-root [data-close]').first()); }
async function settle() { await page.waitForTimeout(650); }
async function picture(label, raw = false) {
  const path = `${output}-${String(receipt.screenshots.length + 1).padStart(2, '0')}-${currentCase}-${label}.png`;
  if (raw) { const data = await page.locator('#world').evaluate(c => c.toDataURL('image/png')); await writeFile(path, Buffer.from(data.split(',')[1], 'base64'), { flag: 'wx' }); }
  else await page.screenshot({ path, fullPage: true });
  const b = await readFile(path); const f = await scene();
  receipt.screenshots.push({ path, bytes: b.length, sha256: sha(b), case: currentCase, label, raw, camera: f.g, passage: { geometry: f.passage.geometry, open: f.passage.open, drawn: f.passage.drawn, painted: f.passage.painted }, terrain: f.outdoor.terrain });
}
async function beginObservation(label, noModal = false) {
  await page.evaluate(({ label, noModal }) => {
    window.__v035ObserverStop = false;
    const out = window.__v035Observation = { label, noModal, naturalFrames: 0, modalFrames: 0, modalEvents: [], samples: [], surfaces: {}, firstRamp: {}, maxHeroSpeed: 0, speedViolations: [] };
    const modal = document.querySelector('#modal-root');
    window.__v035ModalObserver = new MutationObserver(() => { if (noModal && !modal.hidden) out.modalEvents.push(modal.innerText.slice(0, 200)); });
    window.__v035ModalObserver.observe(modal, { attributes: true, childList: true, subtree: true });
    let last = 0, previous;
    const tick = now => {
      if (window.__v035ObserverStop || window.__v035Observation !== out) return;
      const c = document.querySelector('#world'), m = JSON.parse(c.dataset.freeMovement), pets = JSON.parse(c.dataset.petMotion ?? '[]'), a = JSON.parse(c.dataset.sceneAction);
      out.naturalFrames++; if (noModal && !modal.hidden) out.modalFrames++;
      for (const pet of pets) { out.surfaces[pet.id] ??= []; if (!out.surfaces[pet.id].includes(pet.surface)) out.surfaces[pet.id].push(pet.surface); if (pet.surface === 'ramp') out.firstRamp[pet.id] ??= { x: pet.x, y: pet.y, radius: pet.body.radius, link: pet.link, route: pet.passageLease?.points }; }
      if (now - last >= 200) {
        const sample = { at: now, frameAt: m.frameAt, hero: { ...m.position, surface: m.surface, pose: m.pose, moving: m.moving }, action: { phase: a.phase, kind: a.kind, node: a.groundResourceId }, pets: pets.map(p => ({ id: p.id, x: p.x, y: p.y, surface: p.surface, pose: p.pose, link: p.link })) };
        if (previous) { const distance = Math.hypot(sample.hero.x - previous.hero.x, sample.hero.y - previous.hero.y), dt = (sample.frameAt - previous.frameAt) / 1000, speed = dt > 0 ? distance / dt : distance > .002 ? 1e9 : 0; out.maxHeroSpeed = Math.max(out.maxHeroSpeed, speed); if (speed > 430) out.speedViolations.push({ previous, sample, distance, dt, observerDt: (sample.at - previous.at) / 1000, speed }); }
        out.samples.push(sample); previous = sample; last = now;
      }
      requestAnimationFrame(tick);
    }; requestAnimationFrame(tick);
  }, { label, noModal });
}
async function endObservation() {
  const o = await page.evaluate(() => { window.__v035ObserverStop = true; window.__v035ModalObserver.disconnect(); const c = document.querySelector('#world'), m = JSON.parse(c.dataset.freeMovement); window.__v035Observation.endHero = { ...m.position, surface: m.surface, moving: m.moving }; return window.__v035Observation; });
  receipt.observations.push({ case: currentCase, ...o });
  assert.ok(o.naturalFrames > 0); assert.ok(o.maxHeroSpeed < 430, `real hero traversal is continuous: ${JSON.stringify(o.speedViolations.slice(0, 2))}`);
  if (o.noModal) { assert.equal(o.modalFrames, 0); assert.deepEqual(o.modalEvents, []); }
  return o;
}
async function pause() {
  await touch(page.locator('[data-open="menu"]')); await touch(page.locator('#modal-root [data-open="settings"]'));
  if (await page.locator('.time-button').getAttribute('aria-label') !== '시간 계속') await touch(page.locator('#modal-root [data-pause]'));
  await touch(page.locator('#modal-root [data-save]')); await closeModal();
}
async function start(width, height, desktop = false) {
  currentCase = `${desktop ? 'desktop' : 'mobile'}-${width}x${height}`; step = 'startup';
  let save, provenance;
  if (desktop) { const path = 'artifacts/v033-direct-gather-final-r1-verification.json', bytes = await readFile(path); assert.equal(sha(bytes), 'c4fa972c7bd74411c7e6b2054cee34413c96a4fdd1a7a2a474a942a513e062e2'); save = JSON.parse(bytes).fixtures[2].after; assert.equal(sha(JSON.stringify(save)), '018f7070e8b2507e3b28276b8bac4fe6b1089f11fe61b5541c624e88b76db213'); provenance = { path, sha256: sha(bytes), pointer: '/fixtures/2/after' }; }
  else { save = domain('fresh'); provenance = { kind: 'exact-createGame' }; }
  context = await browser.newContext({ viewport: { width, height }, isMobile: !desktop, hasTouch: !desktop, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
  await context.addInitScript(save => { if (!sessionStorage.getItem('v035-installed')) { localStorage.setItem('road-haven-save-v1', JSON.stringify(save)); sessionStorage.setItem('v035-installed', 'yes'); } }, save);
  page = await context.newPage(); const caseName = currentCase;
  page.on('pageerror', e => receipt.errors.push({ case: caseName, message: e.message }));
  page.on('response', r => { if (r.status() >= 400 && ['script', 'stylesheet', 'image', 'font'].includes(r.request().resourceType())) receipt.failedAssets.push({ case: caseName, status: r.status(), url: r.url() }); });
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('#world')?.dataset.petPassage && !document.querySelector('[data-startup-patch]') && !document.querySelector('#app')?.inert, null, { timeout: 25000 });
  await pause(); await settle();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  const f = await scene(); assert.equal(f.outdoor.nodes.length, 52); assert.equal(f.outdoor.regions.length, 7); assert.equal(f.outdoor.truckOpacity, 1); assert.equal(f.outdoor.cutaway, false);
  receipt.fixtures.push({ case: currentCase, provenance, inputSha256: sha(JSON.stringify(save)), loaded: await saved(), passage: f.passage.geometry });
  await picture('default');
}
async function homeView() { if (!await page.locator('[data-map-reset]').isVisible()) await touch(page.locator('[data-camera-toggle]')); await touch(page.locator('[data-map-reset]')); await settle(); }
async function closeTruckView() {
  await homeView(); let steps = 0, deckWidth = 0;
  for (; steps < 8; steps++) {
    const f = await scene(), xs = f.m.world.deckPolygon.map(p => (f.t.a * p.x + f.t.c * p.y + f.t.e) / f.t.dpr);
    deckWidth = Math.max(...xs) - Math.min(...xs); if (deckWidth >= Math.min(280, page.viewportSize().width * .8)) break;
    await touch(page.locator('[data-map-zoom="1"]')); await settle();
  }
  receipt.actions.push({ case: currentCase, kind: 'native-truck-closeup-zoom', steps, deckWidth });
}
async function focus(region) {
  step = `focus-${region}`; await closeModal(); await touch(page.locator('.road-controls [data-open="roadside"]')); await touch(page.locator(`[data-region-focus="${region}"]`)); await settle();
  const f = await scene(); assert.equal(f.g.resourceFocus.regionId, region); assert.equal(await page.locator('#modal-root').isVisible(), false);
}
async function gate(open) {
  step = `gate-${open ? 'open' : 'close'}`; const before = await saved();
  if ((before.petPassage?.open ?? false) === open) return;
  await touch(page.locator('.road-controls [data-open="pet-passage"]')); await touch(page.locator(`[data-pet-passage-toggle="${open ? 'open' : 'close'}"]`));
  await page.waitForFunction(open => { const c = document.querySelector('#world'), a = JSON.parse(c.dataset.sceneAction), p = JSON.parse(c.dataset.petPassage); return p.open === open && a.phase === 'idle'; }, open, { timeout: 60000 });
  const after = await saved(); assert.equal(after.petPassage.open, open); assert.deepEqual(after.resources, before.resources); assert.deepEqual(after.gathering, before.gathering);
  await settle(); await picture(open ? 'integrated-ramp-open' : 'integrated-ramp-closed');
}
async function roadPets(desktop) {
  step = 'actual-pet-route';
  if (desktop) {
    await touch(page.locator('[data-open="menu"]')); await touch(page.locator('#modal-root [data-open="pet"]'));
    await touch(page.locator('[data-team-toggle="cat"]')); await touch(page.locator('[data-team-toggle="boar"]')); await closeModal();
    assert.deepEqual((await saved()).companionTeam, ['dog', 'boar']);
  }
  await closeTruckView(); if (desktop) await gate(false); await gate(true); await beginObservation('actual-pet-route');
  await touch(page.locator('.road-controls [data-road-walk]'));
  await page.waitForFunction(() => JSON.parse(document.querySelector('#world').dataset.petMotion).some(p => p.surface === 'ramp'), null, { timeout: 60000 });
  await picture('pet-actual-bridge-crossing');
  const ids = desktop ? ['dog', 'boar'] : ['dog', 'cat'];
  await page.waitForFunction(ids => ids.every(id => window.__v035Observation.surfaces[id]?.includes('ramp')) && ids.every(id => JSON.parse(document.querySelector('#world').dataset.petMotion).some(p => p.id === id && p.surface === 'road')), ids, { timeout: 90000 });
  const o = await endObservation(); for (const id of ids) { assert.ok(o.firstRamp[id]); assert.equal(o.firstRamp[id].link, 'pet-road-1'); }
  await page.waitForFunction(() => !JSON.parse(document.querySelector('#world').dataset.freeMovement).moving);
  await gate(false);
  assert.equal((await scene()).passage.activeCrossings.length, 0);
  await touch(page.locator('.road-controls [data-road-walk]'));
  await page.waitForFunction(() => { const m = JSON.parse(document.querySelector('#world').dataset.freeMovement); return m.surface === 'road' && !m.moving; }, null, { timeout: 60000 });
  await beginObservation('hero-return-human-stairs'); await touch(page.locator('.road-controls [data-road-return]'));
  await page.waitForFunction(() => { const m = JSON.parse(document.querySelector('#world').dataset.freeMovement); return m.surface === 'deck' && !m.moving; }, null, { timeout: 60000 });
  const up = await endObservation(); assert.ok(up.samples.some(s => s.hero.surface === 'ladder'), 'hero really uses the human stairs');
}
async function collect(region, resource) {
  await focus(region); step = `native-${region}-${resource}`; const before = await saved(), f = await scene();
  const marker = f.outdoor.markers.find(m => m.resource === resource && m.readyCount > 0); assert.ok(marker);
  const b = marker.hitScreenBounds, point = { x: f.rect.x + (b[0] + b[2]) / 2, y: f.rect.y + (b[1] + b[3]) / 2 };
  assert.equal(await page.evaluate(p => document.elementFromPoint(p.x, p.y)?.id === 'world', point), true);
  await beginObservation(step, true);
  await page.locator('#world').evaluate(c => { window.__v035Pointer = null; c.addEventListener('pointerup', e => { window.__v035Pointer = { isTrusted: e.isTrusted, x: e.clientX, y: e.clientY }; }, { once: true, capture: true }); });
  if (currentCase.startsWith('desktop')) await page.mouse.click(point.x, point.y); else await page.touchscreen.tap(point.x, point.y);
  await page.waitForFunction(() => window.__v035Pointer?.isTrusted === true, null, { timeout: 3000 });
  const id = marker.nodeId; await page.waitForFunction(id => { const a = JSON.parse(document.querySelector('#world').dataset.sceneAction); return a.groundResourceId === id && a.phase === 'working'; }, id, { timeout: 60000 });
  await picture(`${resource}-work-grounded`); await page.waitForFunction(() => JSON.parse(document.querySelector('#world').dataset.sceneAction).phase === 'idle', null, { timeout: 10000 });
  const after = await saved(), commit = after.gathering.nodes[id].readyAtMs - 180000, energyAt = before.energy === 100 ? after.energyRecovery.checkedAt - after.energyRecovery.carryMs : commit;
  const result = domain('gather', { state: domain('recover', { state: before, now: energyAt }), id, now: commit }); assert.equal(result.ok, true);
  assert.deepEqual(stable(after), stable(domain('recover', { state: result.state, now: after.energyRecovery.checkedAt })), 'one ordinary native click commits exactly one reward');
  receipt.actions.push({ case: currentCase, step, kind: 'native-resource', id, point, before, after });
  const o = await endObservation(); assert.ok(o.samples.some(s => s.action.phase === 'outbound')); assert.ok(o.samples.some(s => s.action.phase === 'working'));
}
async function cameraAndSave() {
  step = 'manual-camera-and-save'; await homeView(); const before = await scene();
  await touch(page.locator('[data-map-zoom="1"]')); await settle(); const zoomed = await scene(); assert.ok(zoomed.g.scale > before.g.scale);
  const p = await page.locator('#world').evaluate(c => { const r = c.getBoundingClientRect(), hud = [...document.querySelectorAll('button')].map(b => b.getBoundingClientRect()).filter(b => b.width && b.height), clear = p => document.elementFromPoint(p.x, p.y)?.id === 'world' && hud.every(b => Math.hypot(Math.max(b.left-p.x,p.x-b.right,0),Math.max(b.top-p.y,p.y-b.bottom,0))>=14); for (let y = r.top + 130; y < r.bottom - 110; y += 20) for (let x = r.left + 40; x < r.right - 100; x += 20) if (Array.from({length:8},(_,n)=>({x:x+80*n/7,y:y+10*n/7})).every(clear)) return { x, y }; throw Error('No HUD-clear native canvas drag path'); });
  const cameraProof = { case: currentCase, step, kind: 'native-camera-gesture', origin: p, zoomed: zoomed.g }; receipt.actions.push(cameraProof);
  await page.evaluate(() => { window.__v035CameraEvents = []; const capture = e => window.__v035CameraEvents.push({type:e.type,trusted:e.isTrusted,target:e.target.id,button:e.target.closest?.('button')?.getAttribute('aria-label')??null,x:e.clientX,y:e.clientY}); for (const type of ['pointerdown','pointermove','pointerup','pointercancel','touchstart','touchend']) document.addEventListener(type,capture,{capture:true,once:true}); });
  if (currentCase.startsWith('desktop')) { await page.mouse.move(p.x, p.y); await page.mouse.down(); await page.mouse.move(p.x + 80, p.y + 10, { steps: 7 }); await page.mouse.up(); }
  else { const cdp = await context.newCDPSession(page); await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...p, id: 1 }] }); for (let n = 1; n <= 7; n++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: p.x + 80 * n / 7, y: p.y + 10 * n / 7, id: 1 }] }); await page.waitForTimeout(30); } await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await cdp.detach(); }
  await settle(); const panned = await scene();
  cameraProof.events = await page.evaluate(() => window.__v035CameraEvents); cameraProof.panned = panned.g;
  assert.ok(cameraProof.events.some(e => e.type === 'pointerdown' && e.trusted && e.target === 'world')); assert.ok(cameraProof.events.some(e => e.type === 'pointerup' && e.trusted && e.target === 'world'));
  assert.ok(Math.abs(panned.g.dx - zoomed.g.dx) > 20, `native pan follows the finger: ${JSON.stringify(cameraProof)}`); assert.ok(Math.abs(panned.g.scale - zoomed.g.scale) < .002);
  await settle(); const retained = await scene(); assert.ok(Math.abs(retained.g.dx - panned.g.dx) < 2, 'manual view does not snap back');
  const s = await saved(); await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => document.querySelector('#world')?.dataset.outdoorGround && !document.querySelector('[data-startup-patch]'), null, { timeout: 25000 }); await pause();
  const after = await saved(); assert.deepEqual(after.resources, s.resources); assert.deepEqual(after.gathering, s.gathering); assert.deepEqual(after.petPassage, s.petPassage);
  receipt.actions.push({ case: currentCase, step, kind: 'native-camera-and-save', before: { camera: before.g }, zoomed: zoomed.g, panned: panned.g, retained: retained.g, savedResourceSha: sha(JSON.stringify(after.gathering)) });
}
try {
  if (finalSnapshot) {
    const manifest = JSON.parse(await readFile(executionInputs.snapshotManifestPath)); assert.equal(manifest.snapshotId, snapshotId);
    for (const [path, hash] of Object.entries(manifest.files)) { const response = await fetch(new URL(path, new URL('/', baseUrl))); assert.equal(response.status, 200); const bytes = Buffer.from(await response.arrayBuffer()); assert.equal(sha(bytes), hash); receipt.httpIdentity.push({ path, bytes: bytes.length, sha256: hash }); }
  }
  receipt.passageGeometry = domain('geometry'); for (const g of receipt.passageGeometry) assert.ok(g.width >= 2 * g.maximumRadius + 8, 'paint and navigation retain the largest existing pet paw width');
  browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, ignoreDefaultArgs: ['--disable-dev-shm-usage'], args: ['--no-sandbox'] });
  for (const [w, h, desktop] of [[390, 844, false], [1365, 900, true]]) {
    await start(w, h, desktop); await closeTruckView(); await picture('truck-ramp-detail', true);
    if (!visualOnly) await roadPets(desktop);
    for (const region of ['west-grove', 'north-ruins', 'east-creek']) { await focus(region); await picture(`${region}-environment`, true); }
    if (!visualOnly) { await collect('west-grove', 'wood'); await collect('east-creek', 'water'); await cameraAndSave(); }
    await context.close();
  }
  assert.deepEqual(receipt.errors, []); assert.deepEqual(receipt.failedAssets, []); receipt.status = visualOnly ? 'visual-captured' : 'passed';
} catch (e) {
  receipt.status = 'failed'; receipt.failure = { case: currentCase, step, message: String(e), stack: e.stack }; process.exitCode = 1;
  if (page && !page.isClosed()) try { await picture('failure'); receipt.failure.scene = await scene(); } catch (captureError) { receipt.failure.captureError = String(captureError); }
} finally {
  if (browser) await browser.close(); receipt.sourceHashesAtEnd = await sourceHashes(); receipt.testSha256AtEnd = sha(await readFile(testPath));
  if (!visualOnly) try { assert.deepEqual(receipt.sourceHashesAtEnd, receipt.sourceHashesAtStart, 'formal QA uses unchanged source'); assert.equal(receipt.testSha256AtEnd, receipt.testSha256); } catch (e) { receipt.status = 'failed'; receipt.failure ??= { case: currentCase, step: 'execution-input-stability', message: String(e), stack: e.stack }; process.exitCode = 1; }
  receipt.finishedAt = new Date().toISOString(); receipt.assertionsExecuted = assertions;
  await writeFile(`${output}-verification.json`, JSON.stringify(receipt), { flag: 'wx' });
  console.log(JSON.stringify({ status: receipt.status, assertions, receipt: `${output}-verification.json`, screenshots: receipt.screenshots.length, error: receipt.failure?.message }));
}
