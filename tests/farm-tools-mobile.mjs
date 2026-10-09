import { chromium } from '@playwright/test';
import strictAssert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

// The controls are exercised through real phone-style taps and drag gestures.
// No browser clock is faked; saved mature crops only avoid the growing wait.
const startedAt = new Date();
const appVersion = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')).version;
const baseUrl = process.env.TEST_BASE_URL || 'http://127.0.0.1:5173';
const crops = [
 { id: 'carrot', minutes: 180, food: 4 }, { id: 'potato', minutes: 240, food: 5 },
 { id: 'tomato', minutes: 270, food: 6 }, { id: 'corn', minutes: 300, food: 7 },
 { id: 'strawberry', minutes: 360, food: 8 }, { id: 'pumpkin', minutes: 420, food: 10 },
];
await mkdir('artifacts', { recursive: true });
let assertionsExecuted = 0;
const assert = new Proxy(strictAssert, { get(target, key) {
 const value = Reflect.get(target, key);
 return typeof value === 'function' ? (...args) => { assertionsExecuted++; return value(...args); } : value;
} });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
const errors = [], failedAssets = [], canceledImageRequests = [], timings = [], screenshots = [], cases = [];
const successfulImages = new Set();
let page;
const save = () => page.evaluate(() => JSON.parse(localStorage.getItem('road-haven-save-v1')));
const quick = action => page.locator(`[data-quick="${action}"]`);
const nav = section => page.locator(`[data-nav="${section}"]`);
const toolbar = () => page.locator('#planting-toolbar');
async function touch(button) {
 if (!await button.isVisible() && await button.evaluate(element => Boolean(element.closest('#farm-tray')))) await touch(nav('farm'));
 await button.scrollIntoViewIfNeeded();
 const box = await button.boundingBox();
 assert.ok(box, 'a touch control must be rendered');
 const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
 assert.equal(await button.evaluate((button, point) => document.elementFromPoint(point.x, point.y)?.closest('button') === button, point), true, 'the actual finger coordinate reaches the intended control');
 await page.touchscreen.tap(point.x, point.y);
}
async function pauseWorld() {
 // Pause through the visible menu, retaining real animation timers.
 await touch(page.locator('[data-open="menu"]'));
 await touch(page.locator('#modal-root [data-open="settings"]'));
 await touch(page.locator('#modal-root [data-pause]'));
 assert.match(await page.locator('#modal-root [data-pause]').innerText(), /계속하기/);
 // Persist the visible paused state so exact-cost checks do not read an
 // earlier autosave from before the menu was opened.
 await touch(page.locator('#modal-root [data-save]'));
 await touch(page.locator('#modal-root [data-close]').first());
}
async function shot(name) {
 const path = `artifacts/v${appVersion}-farm-tools-${name}.png`;
 await page.screenshot({ path, fullPage: true }); screenshots.push(path);
}
async function fixture(state) {
 // Declared fixtures contain no absence interval; offline catch-up is tested separately.
 state = { ...state, lastSaved: Date.now() };
 await page.evaluate(state => localStorage.setItem('farm-tools-fixture', JSON.stringify(state)), state);
 await page.reload();
 await page.locator('#resident-name').getByText(state.name, { exact: true }).waitFor();
 await pauseWorld();
 assert.equal((await save()).deckLevel, state.deckLevel, 'the valid fixture was loaded instead of a new game');
}
function lateFixture(fresh, kind = 'empty', count = 8) {
 const state = structuredClone(fresh);
 state.name = `농사 검사 ${kind}`;
 state.deckLevel = 6; state.energy = 100;
 state.stats.expansions = 5; state.stats.harvests = 3;
 state.quests = [...new Set([...state.quests, 'bigger-home', 'first-harvest'])];
 state.seedInventory = Object.fromEntries(crops.map(crop => [crop.id, 4])); state.resources.seeds = 24;
 state.plots = Array.from({ length: 8 }, (_, index) => {
  const crop = crops[index % crops.length];
  return kind === 'empty' || index >= count ? { id: index + 1, plantedAt: null, watered: false }
   : { id: index + 1, cropId: crop.id, plantedAt: kind === 'ready' ? state.totalMinutes - crop.minutes : state.totalMinutes, watered: kind === 'ready' };
 });
 return state;
}
async function waitBusy() {
 await page.waitForFunction(() => document.querySelector('#app').getAttribute('aria-busy') === 'true', null, { timeout: 1500 });
 assert.equal(await page.locator('.chore-status').isVisible(), true, 'a character visibly performs the farming work');
}
async function waitIdle(name, started, timeout = 70000) {
 await page.waitForFunction(() => !document.querySelector('#app').hasAttribute('aria-busy'), null, { timeout });
 timings.push({ name, elapsedMs: Date.now() - started });
 assert.ok(Date.now() - started < timeout, `${name} finishes in bounded real browser time`);
 assert.equal(await page.locator('.chore-status').isVisible(), false);
}
async function mode(action) {
 assert.equal(await toolbar().isVisible(), true, `${action} stays selected after work`);
 assert.equal(await toolbar().getAttribute('data-farm-mode'), action);
}
async function stop() { if (await toolbar().isVisible()) await touch(toolbar().locator('[data-plant-cancel]')); }
async function chooseSeed(id) {
 if (await toolbar().isVisible() && await toolbar().getAttribute('data-farm-mode') === 'plant') await touch(toolbar().locator('[data-seed-change]'));
 else await touch(quick('plant'));
 if (!await page.locator('#modal-root [data-select-seed]').first().isVisible()) await touch(toolbar().locator('[data-seed-change]'));
 const before = await save();
 await touch(page.locator(`[data-select-seed="${id}"]`));
 await mode('plant');
 assert.equal((await save()).resources.seeds, before.resources.seeds);
 assert.equal((await save()).energy, before.energy);
 await page.waitForTimeout(1300);
}
async function plotPoint(id) {
 return page.locator('#world').evaluate((canvas, id) => {
  const positions = [[-116, 42], [-33, 42], [50, 42], [133, 42], [-116, 122], [-33, 122], [50, 122], [133, 122]];
  const [u, v] = positions[id - 1], p = (u, v, z = 0) => [480 + u * .91 - v * .67, 420 + u * .34 + v * .47 - z];
  const [x, y] = p(u + 35, v + 36, 112), rect = canvas.getBoundingClientRect(), geometry = JSON.parse(canvas.dataset.sceneGeometry);
  return { x: rect.left + geometry.dx + x * geometry.scale, y: rect.top + geometry.dy + y * geometry.scale };
 }, id);
}
async function touchPlot(id) {
 const point = await plotPoint(id);
 assert.equal(await page.evaluate(point => document.elementFromPoint(point.x, point.y)?.id === 'world', point), true, `plot ${id} is reachable on the actual painted map`);
 await page.touchscreen.tap(point.x, point.y);
}
async function dragPlots(context, ids) {
 const points = await Promise.all(ids.map(plotPoint)), session = await context.newCDPSession(page);
 for (const point of points) assert.equal(await page.evaluate(point => document.elementFromPoint(point.x, point.y)?.id === 'world', point), true, 'every drag point stays on the actual map');
 await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [points[0]] });
 for (const point of points.slice(1)) {
  await page.waitForTimeout(70);
  await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point] });
 }
 await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
 await session.detach();
}
async function selectPlot(id) {
 await touch(nav('farm'));
 for (let attempt = 0; attempt < 9; attempt++) {
  if (await page.locator('#plot-action').getAttribute('data-plot') === String(id)) return;
  await touch(page.locator('[data-plot-step="1"]'));
 }
 assert.fail(`Could not select plot ${id}`);
}
async function assertFits(width, height) {
 assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight + 1), true, `${width}×${height} has no main-screen scrolling`);
 for (const action of ['water', 'harvest', 'plant']) {
  const box = await quick(action).boundingBox();
  assert.ok(box && box.width >= 44 && box.height >= 44 && box.y >= 0 && box.y + box.height <= height + 1, `${action} keeps a finger-sized target`);
 }
 await touch(page.locator('[data-camera-toggle]'));
 for (const selector of ['[data-map-zoom="1"]', '[data-map-zoom="-1"]', '[data-map-reset]', '[data-next-goal]']) {
  const control = page.locator(selector), box = await control.boundingBox(); assert.ok(box && box.width >= 44 && box.height >= 44 && box.x >= 0 && box.x + box.width <= width + 1 && box.y >= 0 && box.y + box.height <= height + 1, `${selector} stays visible beside the open farming tools`);
  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 }; assert.equal(await control.evaluate((button, point) => document.elementFromPoint(point.x, point.y)?.closest('button') === button, point), true, `${selector} is not covered by another farming HUD control`);
 }
 await touch(page.locator('[data-camera-toggle]'));
 for (const selector of ['[data-plant-all]', '[data-plant-cancel]']) {
  const box = await toolbar().locator(selector).boundingBox();
  assert.ok(box && box.width >= 44 && box.height >= 44 && box.x >= 0 && box.x + box.width <= width + 1 && box.y >= 0 && box.y + box.height <= height + 1, `${selector} stays reachable`);
 }
}
async function createContext(width, height, slowFrames = false) {
 const context = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true });
 await context.addInitScript(() => {
  const fixture = localStorage.getItem('farm-tools-fixture');
  if (fixture) { localStorage.setItem('road-haven-save-v1', fixture); localStorage.removeItem('farm-tools-fixture'); localStorage.removeItem('road-haven-selected-seed-v1'); }
 });
 if (slowFrames) await context.addInitScript(() => {
  const nativeRequest = requestAnimationFrame.bind(window), nativeCancel = cancelAnimationFrame.bind(window), pending = new Map(); let next = 0;
  window.requestAnimationFrame = callback => { const id = ++next, item = { timer: 0, frame: 0 }; item.timer = setTimeout(() => { item.frame = nativeRequest(timestamp => { pending.delete(id); callback(timestamp); }); }, 350); pending.set(id, item); return id; };
  window.cancelAnimationFrame = id => { const item = pending.get(id); if (!item) return; clearTimeout(item.timer); if (item.frame) nativeCancel(item.frame); pending.delete(id); };
 });
 page = await context.newPage();
 page.on('pageerror', error => errors.push(`${width}: ${error.message}`));
 page.on('response', response => {
  if (response.status() >= 400 && ['image', 'font', 'script', 'stylesheet'].includes(response.request().resourceType())) failedAssets.push(`${response.status()} ${response.url()}`);
  if (response.ok() && response.request().resourceType() === 'image') successfulImages.add(response.url());
 });
 page.on('requestfailed', request => {
  if (!['image', 'font', 'script', 'stylesheet'].includes(request.resourceType())) return;
  const reason = request.failure()?.errorText || 'request failed';
  if (request.resourceType() === 'image' && reason === 'net::ERR_ABORTED') canceledImageRequests.push(request.url());
  else failedAssets.push(`${reason} ${request.url()}`);
 });
 await page.goto(baseUrl); await page.waitForLoadState('networkidle');
 await touch(page.locator('[data-start]')); await pauseWorld();
 return context;
}

try {
 for (const width of [360, 390]) {
  const height = width === 360 ? 740 : 844, context = await createContext(width, height), fresh = await save();
  assert.equal(fresh.seedInventory.potato, 3, 'a normal new game can plant a chosen non-carrot variety repeatedly');
  await chooseSeed('potato');
  let start = Date.now(); await touchPlot(3); await waitBusy(); await waitIdle(`normal-potato-first-${width}`, start, 14000);
  assert.equal((await save()).seedInventory.potato, 2); await mode('plant'); await stop();
  start = Date.now(); await touch(quick('harvest')); await waitBusy(); await waitIdle(`normal-carrot-harvest-${width}`, start, 14000); await stop();
  await page.reload(); await page.locator('#resident-name').getByText(fresh.name, { exact: true }).waitFor(); await pauseWorld();
  await touch(quick('plant')); await mode('plant');
  assert.equal(await page.locator('#modal-root').isVisible(), false, 'reusing the remembered seed avoids another inventory selection');
  assert.match(await page.locator('#planting-seed-name').innerText(), /감자/);
  await page.waitForTimeout(1300); start = Date.now(); await touchPlot(1); await waitBusy(); await waitIdle(`remembered-potato-second-${width}`, start, 14000);
  assert.equal((await save()).plots[0].cropId, 'potato'); assert.equal((await save()).seedInventory.potato, 1); await stop();
  cases.push(`Normal starter potato stock supports repeated sowing; cancel and reload retain selected seed at ${width}×${height}`);

  const dry = lateFixture(fresh, 'dry', width === 360 ? 8 : 3);
  await fixture(dry); start = Date.now(); await touch(quick('water')); await waitBusy();
  await mode('water');
  await touch(quick('water')); // Repeat the global control during work.
  await page.waitForTimeout(300); assert.equal((await save()).resources.water, dry.resources.water, 'global watering still waits for visible work');
  await assertFits(width, height);
  await shot(`global-water-${width}`);
  await waitIdle(`global-water-all-${width}`, start);
  let state = await save(), expected = width === 360 ? 8 : 3;
  assert.equal(state.plots.filter(plot => plot.watered).length, expected);
  assert.equal(state.resources.water, dry.resources.water - expected);
  assert.equal(state.energy, 100 - expected * 3); await mode('water'); await stop();

  const ready = lateFixture(fresh, 'ready', width === 360 ? 8 : 3);
  await fixture(ready); start = Date.now(); await touch(quick('harvest')); await waitBusy(); await mode('harvest');
  await touch(quick('harvest')); await page.waitForTimeout(300); assert.equal((await save()).stats.harvests, ready.stats.harvests);
  await waitIdle(`global-harvest-all-${width}`, start);
  state = await save();
  assert.equal(state.plots.filter(plot => plot.plantedAt === null).length, 8);
  assert.equal(state.stats.harvests, ready.stats.harvests + expected);
  assert.equal(state.resources.food, ready.resources.food + Array.from({ length: expected }, (_, index) => crops[index % 6].food).reduce((sum, food) => sum + food, 0));
  assert.equal(state.resources.seeds, ready.resources.seeds + expected * 2);
  assert.equal(state.energy, 100 - expected * 4); await mode('harvest'); await shot(`harvest-finished-${width}`); await stop();
  cases.push(`One global water/harvest selection processes all eligible plots sequentially, keeps the tool active and deduplicates repeated global presses at ${width}×${height}`);

  if (width === 360) {
   const manual = lateFixture(fresh, 'dry'); await fixture(manual); await selectPlot(4); await page.waitForTimeout(1300);
   start = Date.now(); await touch(page.locator('#plot-action')); await waitBusy(); await mode('water');
   await touchPlot(1); await touchPlot(2); await dragPlots(context, [3, 5, 6, 5, 3]);
   await shot('manual-water-paint-queue'); await waitIdle('context-single-then-touch-and-drag-water', start);
   state = await save();
   assert.deepEqual(state.plots.map(plot => plot.watered), [true, true, true, true, true, true, false, false]);
   assert.equal(state.resources.water, manual.resources.water - 6); assert.equal(state.energy, 82); await mode('water'); await stop();

   const empty = lateFixture(fresh); await fixture(empty); await chooseSeed('tomato');
   start = Date.now(); await touchPlot(1); await waitBusy(); await touchPlot(2); await touch(quick('water'));
   await waitIdle('plant-to-water-switch-includes-current-plant', start, 25000); state = await save();
   assert.equal(state.plots[0].cropId, 'tomato'); assert.equal(state.plots[0].watered, true, 'deferred global water includes the just-finished planting');
   assert.equal(state.plots[1].plantedAt, null, 'switching tools cancels future planting');
   assert.equal(state.seedInventory.tomato, 3); assert.equal(state.resources.water, empty.resources.water - 1); assert.equal(state.energy, 93);
   await mode('water'); await stop();

   const canceled = lateFixture(fresh, 'dry'); await fixture(canceled); start = Date.now();
   await touch(quick('water')); await waitBusy(); await touch(toolbar().locator('[data-plant-cancel]'));
   await waitIdle('cancel-global-water-after-current', start, 25000); state = await save();
   assert.equal(state.plots.filter(plot => plot.watered).length, 1); assert.equal(state.resources.water, canceled.resources.water - 1); assert.equal(state.energy, 97);
   assert.equal(await toolbar().isVisible(), false, 'cancel ends the tool after completing only its current job');

   const tired = lateFixture(fresh, 'dry'); tired.energy = 0; await fixture(tired); await selectPlot(1);
   await touch(page.locator('#plot-action')); assert.match(await page.locator('.activity-block-reason').innerText(), /기력|기운/);
   assert.equal((await save()).resources.water, tired.resources.water); assert.equal((await save()).plots[0].watered, false);
   start = Date.now(); await touch(page.locator('[data-rest-retry="water"]')); await waitBusy(); await waitIdle('rest-retry-context-water-single', start, 14000);
   state = await save(); assert.equal(state.plots.filter(plot => plot.watered).length, 1); assert.equal(state.energy, 52);
   assert.equal(state.resources.water, tired.resources.water - 2); assert.equal(state.resources.food, tired.resources.food - 1); await mode('water');
   await page.waitForTimeout(1300); start = Date.now(); await touchPlot(2); await waitBusy(); await waitIdle('continue-water-after-recovery', start, 14000);
   assert.equal((await save()).plots.filter(plot => plot.watered).length, 2); assert.equal((await save()).energy, 49); await stop();

   const existing = lateFixture(fresh); existing.seedInventory = { carrot: 3, potato: 1, tomato: 1, corn: 1, strawberry: 1, pumpkin: 1 }; existing.resources.seeds = 8;
   await fixture(existing); assert.equal((await save()).seedInventory.potato, 1, 'a v0.6 save receives no unsolicited inventory grant');
   await chooseSeed('potato'); start = Date.now(); await touchPlot(1); await waitBusy(); await touchPlot(2); await waitIdle('existing-one-potato-seed-respects-stock', start, 14000);
   assert.equal((await save()).seedInventory.potato, 0); assert.equal((await save()).plots[1].plantedAt, null);
   await page.waitForTimeout(1300); await touchPlot(2); assert.match(await page.locator('.activity-block-reason').innerText(), /감자 씨앗/);
   start = Date.now(); await touch(page.locator('#modal-root [data-action="gather"]')); await waitBusy(); await waitIdle('existing-player-discovers-three-potato-seeds', start, 30000);
   assert.equal((await save()).seedInventory.potato, 3); await chooseSeed('potato');
   start = Date.now(); await touch(quick('plant')); await waitBusy(); await touch(quick('plant')); await waitIdle('remembered-plant-all-uses-three-seed-pack-once', start, 30000);
   state = await save(); assert.equal(state.plots.filter(plot => plot.cropId === 'potato').length, 4); assert.equal(state.seedInventory.potato, 0);
   assert.equal(state.resources.seeds, 7); assert.equal(state.energy, 74); await mode('plant'); await stop();
   cases.push('Actual touch drag adds distinct dry plots once; context tools remain selected; tool switching finishes the current planting and then waters it; cancel drops future work; explicit rest resumes a persistent water tool');
  } else {
   const limited = lateFixture(fresh, 'dry'); limited.resources.water = 2; await fixture(limited); start = Date.now();
   await touch(quick('water')); await waitBusy(); await touch(quick('water')); await waitIdle('water-reservations-respect-two-litres', start, 14000);
   state = await save(); assert.equal(state.plots.filter(plot => plot.watered).length, 2); assert.equal(state.resources.water, 0); assert.equal(state.energy, 94); await mode('water');
   await page.waitForTimeout(1300); await touchPlot(3); assert.match(await page.locator('.activity-block-reason').innerText(), /물/);
   assert.equal((await save()).energy, 94); assert.equal((await save()).plots[2].watered, false);
   start = Date.now(); await touch(page.locator('#modal-root [data-action="gather"]')); await waitBusy(); await waitIdle('gather-water-and-three-seed-pack', start, 30000);
   state = await save(); assert.equal(state.resources.water, 4); assert.equal(state.resources.seeds, limited.resources.seeds + 3);
   assert.equal(state.seedInventory.potato, limited.seedInventory.potato + 3);
   start = Date.now(); await touch(quick('water')); await waitBusy(); await waitIdle('continue-global-water-after-resupply', start, 45000);
   state = await save(); assert.equal(state.plots.filter(plot => plot.watered).length, 6); assert.equal(state.resources.water, 0); assert.equal(state.energy, 72); await mode('water'); await stop();

   await page.setViewportSize({ width: 844, height: 390 }); const landscape = lateFixture(fresh, 'dry', 2); await fixture(landscape);
   start = Date.now(); await touch(quick('water')); await waitBusy(); await assertFits(844, 390); await shot('landscape-water');
   await waitIdle('landscape-two-plot-water', start, 14000); assert.equal((await save()).plots.filter(plot => plot.watered).length, 2); await stop();
   await page.setViewportSize({ width: 390, height: 844 });

   const interrupted = lateFixture(fresh, 'dry'); await fixture(interrupted); await touch(quick('water')); await waitBusy(); await page.waitForTimeout(250);
   await page.reload(); await page.locator('#resident-name').getByText(interrupted.name, { exact: true }).waitFor(); await pauseWorld(); state = await save();
   assert.equal(state.resources.water, interrupted.resources.water, 'reload before completion gives no phantom water charge'); assert.equal(state.energy, 100);
   assert.equal(state.plots.every(plot => !plot.watered), true); assert.equal(await page.locator('#app').getAttribute('aria-busy'), null);
   cases.push('Limited water reserves only affordable jobs, missing-water help charges nothing, exploration supplies water and a three-seed pack, landscape controls fit, interrupted reload has no phantom commit');
  }
  await context.close();
 }
 const slowContext = await createContext(360, 740, true), fresh = await save(), slow = lateFixture(fresh, 'dry', 3); await fixture(slow);
 const slowStart = Date.now(); await touch(quick('water')); await waitBusy(); await waitIdle('three-watering-jobs-at-350ms-visible-frames', slowStart, 35000);
 const state = await save(); assert.equal(state.plots.filter(plot => plot.watered).length, 3); assert.equal(state.resources.water, slow.resources.water - 3); assert.equal(state.energy, 91);
 await slowContext.close();
 assert.equal(canceledImageRequests.every(url => successfulImages.has(url)), true, 'every canceled redundant SVG image also loaded successfully');
 const imageContext = await browser.newContext(), imagePage = await imageContext.newPage(); await imagePage.goto(baseUrl);
 const decodedCanceledImages = await imagePage.evaluate(async sources => Promise.all(sources.map(async source => { const image = new Image(); image.src = source; await image.decode(); return { source, width: image.naturalWidth, height: image.naturalHeight }; })), [...new Set(canceledImageRequests)]);
 assert.equal(decodedCanceledImages.every(image => image.width > 0 && image.height > 0), true); await imageContext.close();
 assert.deepEqual(errors, []); assert.deepEqual(failedAssets, []);
 await writeFile(`artifacts/farm-tools-v${appVersion}-verification.json`, JSON.stringify({ version: appVersion, status: 'passed', baseUrl,
  input: 'Actual touchscreen tap coordinates and CDP touchStart/touchMove/touchEnd gestures in mobile browser contexts',
  clock: 'Real browser timers and requestAnimationFrame; no page.clock', viewports: ['360×740', '390×844', '844×390'],
  slowRenderingCase: 'Actual RAF callbacks delayed 350 ms with original browser timestamps',
  startedAt: startedAt.toISOString(), finishedAt: new Date().toISOString(), elapsedMs: Date.now() - startedAt.getTime(), assertionsExecuted,
  cases, timings, screenshots, errors, failedAssets, canceledImageRequests, decodedCanceledImages,
 }, null, 2) + '\n');
 console.log(`PASS: ${assertionsExecuted} real-touch continuous farming assertions; ${timings.length} real-time sequences; global batches, persistent context tools, actual drag selection, switching/cancel, resource reservation, remembered seeds, recovery, landscape and slow rendering.`);
} catch (error) {
 if (page && !page.isClosed()) await shot('failure').catch(() => {});
 await writeFile(`artifacts/farm-tools-v${appVersion}-verification.json`, JSON.stringify({ version: appVersion, status: 'failed', baseUrl, assertionsExecuted, cases, timings, screenshots, errors, failedAssets, canceledImageRequests, failure: String(error) }, null, 2) + '\n');
 throw error;
} finally { await browser.close(); }
