import { chromium } from '@playwright/test';
import strictAssert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { GAME_SPEED_MULTIPLIER, realDuration } from '../src/game-speed.ts';

// Physical touch streams and real animation time; no fabricated pointer events,
// browser clock advancement, direct game calls, or reward-producing saved fixtures.
const version = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')).version;
const baseUrl = process.env.TEST_BASE_URL || 'http://127.0.0.1:5173';
const startedAt = new Date();
await mkdir('artifacts', { recursive: true });
let assertionsExecuted = 0;
const assert = new Proxy(strictAssert, { get(target, key) { const value = Reflect.get(target, key); return typeof value === 'function' ? (...args) => { assertionsExecuted++; return value(...args); } : value; } });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
const errors = [], failedAssets = [], screenshots = [], timings = [], cases = [], motionRuns = [], navigations = [];
let page, context;
const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('road-haven-save-v1')));
const geometry = () => page.locator('#world').evaluate(canvas => JSON.parse(canvas.dataset.sceneGeometry));
const quick = action => page.locator(`[data-quick="${action}"]`);
async function touch(locator) {
 if (!await locator.isVisible() && await locator.evaluate(element => element.matches('[data-map-zoom],[data-map-reset],[data-map-move]'))) await touch(page.locator('[data-camera-toggle]'));
 if (!await locator.isVisible() && await locator.evaluate(element => Boolean(element.closest('#farm-tray')))) await touch(page.locator('[data-nav="farm"]'));
 await locator.scrollIntoViewIfNeeded(); const box = await locator.boundingBox(); assert.ok(box);
 const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
 assert.equal(await locator.evaluate((button, point) => document.elementFromPoint(point.x, point.y)?.closest('button') === button, point), true, 'a physical finger reaches the intended button');
 await page.touchscreen.tap(point.x, point.y);
}
async function shot(name) { const path = `artifacts/v${version}-scene-${name}.png`; await page.screenshot({ path, fullPage: true }); screenshots.push(path); }
async function pauseWorld() {
 await touch(page.locator('[data-open="menu"]')); await touch(page.locator('#modal-root [data-open="settings"]'));
 const button = page.locator('#modal-root [data-pause]'); if ((await button.innerText()).trim() === '잠시 멈춤') await touch(button);
 await touch(page.locator('#modal-root .modal-close'));
}
async function resetZoom() { await touch(page.locator('[data-map-reset]')); await page.waitForTimeout(450); assert.equal((await geometry()).mapZoom, 1); }
async function zoomControls(label) {
 const before = await geometry(); await touch(page.locator('[data-map-zoom="1"]')); await page.waitForTimeout(450); const bigger = await geometry();
 assert.ok(bigger.mapZoom > before.mapZoom, `${label}: plus changes the camera multiplier`); assert.ok(bigger.scale > before.scale * 1.05, `${label}: painted objects actually get larger`);
 await touch(page.locator('[data-map-zoom="-1"]')); await page.waitForTimeout(450); assert.ok((await geometry()).scale < bigger.scale, `${label}: minus visibly reduces the scene`);
 await resetZoom();
}
async function plotPoint(id) {
 return page.locator('#world').evaluate((canvas, id) => { const positions = [[-116, 42], [-33, 42], [50, 42], [133, 42], [-116, 122], [-33, 122], [50, 122], [133, 122]], [u, v] = positions[id - 1], g = JSON.parse(canvas.dataset.sceneGeometry), r = canvas.getBoundingClientRect(); return { x: r.left + g.dx + (480 + (u + 35) * .91 - (v + 36) * .67) * g.scale, y: r.top + g.dy + (420 + (u + 35) * .34 + (v + 36) * .47 - 112) * g.scale }; }, id);
}
async function canvasCenter() { const box = await page.locator('#world').boundingBox(); return { x: box.x + box.width * .45, y: box.y + box.height * .52 }; }
async function worldAt(point) { assert.equal(await page.evaluate(point => document.elementFromPoint(point.x, point.y)?.id === 'world', point), true, 'the gesture contacts the actual painted map'); }
async function pinch(origin, ratio, cancel = false) {
 const session = await context.newCDPSession(page), width = page.viewportSize().width;
 // Add the second finger before the 120 ms farm gesture disambiguation expires.
 const direction = origin.x < width / 2 ? 1 : -1;
 const a = { ...origin, id: 1 }, b = { x: origin.x + direction * 48, y: origin.y + 15, id: 2 };
 await worldAt(a); await worldAt(b);
 await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [a] });
 await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [a, b] });
 for (let step = 1; step <= 6; step++) {
  const amount = 1 + (ratio - 1) * step / 6;
  await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [a, { ...b, x: a.x + (b.x - a.x) * amount, y: a.y + (b.y - a.y) * amount }] });
  await page.waitForTimeout(24);
 }
 await session.send('Input.dispatchTouchEvent', { type: cancel ? 'touchCancel' : 'touchEnd', touchPoints: [] }); await session.detach(); await page.waitForTimeout(400);
}
async function recordMotion(action, width) {
 const before = await saved();
 await page.evaluate(() => {
  window.__sceneMotion = []; const record = () => {
   const canvas = document.querySelector('#world'), encoded = canvas?.dataset.sceneAction;
   const frame = encoded ? JSON.parse(encoded) : null;
   window.__sceneMotion.push({ at: performance.now(), frame, state: JSON.parse(localStorage.getItem('road-haven-save-v1')), busy: document.querySelector('#app')?.getAttribute('aria-busy') === 'true' });
  };
  record(); window.__sceneMotionTimer = setInterval(record, 70);
 });
 const start = Date.now(); await touch(quick(action)); await page.waitForFunction(() => document.querySelector('#app')?.getAttribute('aria-busy') === 'true', null, { timeout: 1500 });
 await page.waitForFunction(() => { const frame = JSON.parse(document.querySelector('#world')?.dataset.sceneAction || 'null'); return frame?.climbing === 'down' && frame.progress > .4; }, null, { timeout: 12000 }); await shot(`${action}-ladder-down-${width}`);
 await page.waitForFunction(() => JSON.parse(document.querySelector('#world')?.dataset.sceneAction || 'null')?.phase === 'working', null, { timeout: 16000 });
 assert.deepEqual((await saved()).resources, before.resources, 'arriving at the worksite has not granted the materials');
 // Observe the return while exercising UI controls. The ladder can otherwise
 // pass during a screenshot or menu check before a later sequential wait starts.
 await Promise.all([
  (async () => {
   assert.equal(await page.locator('[data-nav="bag"]').isDisabled(), false, 'inventory remains available while the resident works');
   await touch(page.locator('[data-open="menu"]')); assert.equal(await page.locator('#modal-root [data-open="settlement-goals"]').isVisible(), true, 'growth planning remains reachable during a chore');
   await touch(page.locator('#modal-root .modal-close'));
   await shot(`${action}-work-${width}`); await zoomControls(`${action} while working`);
  })(),
  (async () => { await page.waitForFunction(() => { const frame = JSON.parse(document.querySelector('#world')?.dataset.sceneAction || 'null'); return frame?.climbing === 'up' && frame.progress > .4; }, null, { timeout: 16000 }); await shot(`${action}-ladder-up-${width}`); })(),
 ]);
 await page.waitForFunction(() => !document.querySelector('#app')?.hasAttribute('aria-busy'), null, { timeout: 30000 });
 const elapsedMs = Date.now() - start, after = await saved();
 const samples = await page.evaluate(() => { clearInterval(window.__sceneMotionTimer); return window.__sceneMotion; });
 const frames = samples.filter(sample => sample.frame?.kind === action), work = frames.filter(sample => sample.frame.phase === 'working');
 assert.ok(frames.length > Math.ceil(70 / GAME_SPEED_MULTIPLIER), 'the faster route remains observable over genuine animation frames');
 assert.ok(work.length >= Math.ceil(30 / GAME_SPEED_MULTIPLIER), 'the gathering work phase has multiple70ms observations across its1.2-second duration');
 assert.ok(elapsedMs > realDuration(9000) && elapsedMs < realDuration(32000), 'the road journey and gathering finish within the faster real-time bounds');
 assert.ok(work.at(-1).at - work[0].at >= realDuration(2100), 'the work animation remains visible for at least1.05 real seconds, allowing70ms sample boundaries');
 assert.ok(work.every(sample => Math.abs(sample.frame.work - (action === 'gather' ? 2.4 : 2.55) / 2) < .002), 'the current chore work duration uses the shared2× pace');
 assert.deepEqual([...new Set(frames.map(sample => sample.frame.phase))], ['outbound', 'working', 'returning'], 'the full journey has departure, sustained work, and return');
 assert.ok(work.every(sample => sample.frame.pose === action), 'the work phase uses its specific gathering or chopping pose');
 assert.ok(new Set(work.map(sample => sample.frame.progress)).size >= Math.ceil(25 / GAME_SPEED_MULTIPLIER), 'the work pose advances through a visible animation cycle');
 assert.ok(work.every(sample => Math.abs(sample.frame.gaitTime - (sample.frame.elapsed - sample.frame.walk) * 2) < .005), 'the work pose clock runs at twice elapsed real time');
 for (const direction of ['down', 'up']) {
  const steps = frames.filter(sample => sample.frame.climbing === direction);
  assert.ok(steps.length > Math.ceil(15 / GAME_SPEED_MULTIPLIER), `the ${direction} ladder trip has multiple visible foot placements`);
  assert.ok(steps.every(sample => sample.frame.pose === 'climb'), 'ladder travel has a dedicated climbing pose');
  assert.ok(steps.at(-1).at - steps[0].at > realDuration(1100), 'the faster ladder trip remains continuous between its ends');
  assert.ok(direction === 'down' ? steps.at(-1).frame.y > steps[0].frame.y : steps.at(-1).frame.y < steps[0].frame.y, 'ladder direction agrees with the drawn feet');
 }
 for (let index = 1; index < frames.length; index++) {
  const previous = frames[index - 1].frame, current = frames[index].frame, seconds = current.elapsed - previous.elapsed;
  assert.ok(seconds >= 0, 'animation time progresses monotonically');
  const speed = (previous.climbing && previous.climbing === current.climbing ? 60 : 100) * GAME_SPEED_MULTIPLIER * 2;
  assert.ok(Math.hypot(current.x - previous.x, current.y - previous.y) <= seconds * speed + .4, 'world-position samples stay continuous at walking or climbing speed');
 }

 for (const sample of samples.filter(sample => sample.busy)) assert.deepEqual(sample.state.resources, before.resources, 'resources remain unchanged through departure, ladder, work, and return');
 assert.equal(after.stats[action === 'gather' ? 'gathers' : 'chops'], before.stats[action === 'gather' ? 'gathers' : 'chops'] + 1);
 assert.equal(after.resources.wood, before.resources.wood + (action === 'gather' ? 10 : 18));
 assert.equal(after.resources.scrap, before.resources.scrap + (action === 'gather' ? 5 : 0));
 assert.equal(after.resources.water, before.resources.water + (action === 'gather' ? 4 : 0));
 assert.equal(after.resources.seeds, before.resources.seeds + 3); assert.equal(after.energy, before.energy - 10);
 await page.waitForTimeout(350); assert.deepEqual((await saved()).resources, after.resources, 'completion never pays a second time');
 timings.push({ name: `${action}-${width}`, elapsedMs, workVisibleMs: Math.round(work.at(-1).at - work[0].at) });
 motionRuns.push({ action, width, elapsedMs, frames: frames.map(({ at, frame }) => ({ at, ...frame })) });
 return frames;
}

try {
 for (const [width, height] of [[360, 740], [390, 844]]) {
  context = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true }); page = await context.newPage();
  page.on('framenavigated', frame => { if (frame === page.mainFrame()) navigations.push({ width, url: frame.url(), at: new Date().toISOString() }); });
  page.on('pageerror', error => errors.push(error.message)); page.on('response', response => { if (response.status() >= 400 && ['image', 'font', 'script', 'stylesheet'].includes(response.request().resourceType())) failedAssets.push(`${response.status()} ${response.url()}`); });
  await page.goto(baseUrl); await page.waitForLoadState('networkidle'); await touch(page.locator(`[data-gender="${width === 360 ? 'female' : 'male'}"]`)); await touch(page.locator('[data-start]')); await pauseWorld();
  await page.waitForTimeout(600); const freshPlots = await page.locator('#world').evaluate(canvas => JSON.parse(canvas.dataset.farmPlots));
  assert.ok(Math.hypot(freshPlots[1].x - freshPlots[0].x, freshPlots[1].y - freshPlots[0].y) >= 41, 'the starting beds stay readable on the narrow phone');
  await zoomControls(`home-${width}`); await pinch(await canvasCenter(), 1.4); assert.ok((await geometry()).mapZoom > 1.2, 'two fingers also zoom the settlement home'); await resetZoom();
  if (width === 390) { const point = await canvasCenter(); await worldAt(point); await page.mouse.move(point.x, point.y); await page.mouse.wheel(0, -180); await page.waitForTimeout(450); assert.ok((await geometry()).mapZoom > 1.25, 'a mouse wheel zooms the same painted map'); await page.mouse.wheel(0, 180); await page.waitForTimeout(450); assert.ok(Math.abs((await geometry()).mapZoom - 1) < .02); assert.equal(await page.evaluate(() => scrollY), 0); await resetZoom(); }
  for (let index = 0; index < 10; index++) await touch(page.locator('[data-map-zoom="-1"]'));
  assert.equal((await geometry()).mapZoom, .75); assert.equal(await page.locator('[data-map-zoom="-1"]').isDisabled(), true);
  for (let index = 0; index < 15; index++) await touch(page.locator('[data-map-zoom="1"]'));
  assert.equal((await geometry()).mapZoom, 2.5); assert.equal(await page.locator('[data-map-zoom="1"]').isDisabled(), true); await resetZoom();
  await touch(page.locator('[data-nav="farm"]')); await touch(quick('plant')); await touch(page.locator('[data-select-seed="potato"]')); await page.waitForTimeout(1300);
  const beforePinch = await saved(), origin = await plotPoint(3), initial = await geometry(); await pinch(origin, 1.7);
  assert.ok((await geometry()).mapZoom > initial.mapZoom * 1.25, 'spreading two real fingers zooms the farm');
  assert.equal(await page.locator('#app').getAttribute('aria-busy'), null, 'the first pinch contact on an empty plot never queues planting'); assert.deepEqual(await saved(), beforePinch); assert.equal(await page.locator('#planting-toolbar').getAttribute('data-farm-mode'), 'plant', 'a camera gesture keeps the chosen farm tool active');
  await resetZoom(); await pinch(await plotPoint(3), .62, true); assert.ok((await geometry()).mapZoom < 1, 'bringing fingers together zooms out');
  assert.equal(await page.locator('#app').getAttribute('aria-busy'), null, 'a canceled pinch does not plant on release'); assert.deepEqual(await saved(), beforePinch); assert.equal(await page.locator('#planting-toolbar').getAttribute('data-farm-mode'), 'plant', 'a camera gesture keeps the chosen farm tool active'); await resetZoom();
  const session = await context.newCDPSession(page), canceledPoint = await plotPoint(3); await worldAt(canceledPoint);
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...canceledPoint, id: 1 }] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }); await session.detach(); await page.waitForTimeout(220);
  assert.equal(await page.locator('#app').getAttribute('aria-busy'), null, 'a canceled pending single touch produces no phantom planting'); assert.deepEqual(await saved(), beforePinch); assert.equal(await page.locator('#planting-toolbar').getAttribute('data-farm-mode'), 'plant', 'a camera gesture keeps the chosen farm tool active');
  await zoomControls(`selected farm tool-${width}`); const point = await plotPoint(3); await worldAt(point); const start = Date.now(); await page.touchscreen.tap(point.x, point.y);
  await page.waitForFunction(() => document.querySelector('#app')?.getAttribute('aria-busy') === 'true', null, { timeout: 1500 });
  await page.waitForFunction(() => !document.querySelector('#app')?.hasAttribute('aria-busy'), null, { timeout: 14000 });
  const planted = await saved(); assert.equal(planted.stats.plantings, beforePinch.stats.plantings + 1); assert.equal(planted.seedInventory.potato, beforePinch.seedInventory.potato - 1); assert.equal(planted.energy, beforePinch.energy - 4); assert.equal(planted.plots[2].cropId, 'potato');
  timings.push({ name: `tap-after-pinch-and-cancel-${width}`, elapsedMs: Date.now() - start }); await touch(page.locator('[data-plant-cancel]'));
  await touch(page.locator('[data-nav="hunt"]')); await touch(page.locator('[data-zone="grove"]')); await page.waitForTimeout(1100); await zoomControls(`grove-${width}`); await pinch(await canvasCenter(), 1.4); assert.ok((await geometry()).mapZoom > 1.2, 'the grove accepts the same two-finger gesture'); await resetZoom();
  await recordMotion('gather', width); await recordMotion('chop', width);
  await touch(page.locator('[data-nav="home"]')); await page.waitForTimeout(700); await resetZoom();
  if (width === 390) {
   await page.setViewportSize({ width: 844, height: 390 }); await page.waitForTimeout(700);
   for (const selector of ['[data-map-zoom="1"]', '[data-map-zoom="-1"]', '[data-map-reset]']) { const box = await page.locator(selector).boundingBox(); assert.ok(box && box.width >= 44 && box.height >= 44 && box.x >= 0 && box.y >= 0 && box.x + box.width <= 844 && box.y + box.height <= 390, 'zoom and reset controls remain reachable in landscape'); }
   await zoomControls('landscape'); await shot('landscape-zoom-controls');
  }
  cases.push(`${width}px: readable starting beds, expandable +/-/reset in home/farm/grove/work, clamp .75–2.5, actual two-finger home/farm/grove pinch and farm cancel without queued work, subsequent single planting charged once, growth menu access during actual road gathering and chopping.`);
  await context.close();
 }
 assert.equal(navigations.length, 2, 'each phone context loaded once without hidden reloads'); assert.deepEqual(errors, []); assert.deepEqual(failedAssets, []);
 await writeFile(`artifacts/scene-interaction-v${version}-verification.json`, JSON.stringify({ version, status: 'passed', baseUrl, assertionsExecuted, input: 'Actual touchscreen taps and CDP two-finger touchStart/touchMove/touchEnd/touchCancel', clock: 'Real browser timers; no page.clock or fabricated native events', startedAt: startedAt.toISOString(), finishedAt: new Date().toISOString(), viewports: ['360×740', '390×844', '844×390'], cases, timings, motionRuns, navigations, screenshots, errors, failedAssets }, null, 2) + '\n');
 console.log(`PASS: ${assertionsExecuted} scene interaction assertions, real pinch/cancel and ${motionRuns.length} complete road animation samples.`);
} catch (error) {
 if (page && !page.isClosed()) await shot('failure').catch(() => {});
 const failedMotionSamples = page && !page.isClosed() ? await page.evaluate(() => (window.__sceneMotion ?? []).map(({ at, frame, busy }) => ({ at, frame, busy }))).catch(() => []) : [];
 await writeFile(`artifacts/scene-interaction-v${version}-verification.json`, JSON.stringify({ version, status: 'failed', baseUrl, assertionsExecuted, cases, timings, motionRuns, failedMotionSamples, navigations, screenshots, errors, failedAssets, failure: String(error) }, null, 2) + '\n'); throw error;
} finally { await browser.close(); }
