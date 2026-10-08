import { chromium } from '@playwright/test';
import strictAssert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

// Exercise the seed-selection and queued planting flow with actual touch input
// and browser time. Mature-crop fixtures only skip the crop-growing wait.
const startedAt = new Date();
const appVersion = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')).version;
const baseUrl = process.env.TEST_BASE_URL || 'http://127.0.0.1:5173';
const crops = [
 { id: 'carrot', name: '당근', minutes: 180, food: 4 },
 { id: 'potato', name: '감자', minutes: 240, food: 5 },
 { id: 'tomato', name: '토마토', minutes: 270, food: 6 },
 { id: 'corn', name: '옥수수', minutes: 300, food: 7 },
 { id: 'strawberry', name: '딸기', minutes: 360, food: 8 },
 { id: 'pumpkin', name: '호박', minutes: 420, food: 10 },
];
await mkdir('artifacts', { recursive: true });
let assertionsExecuted = 0;
const assert = new Proxy(strictAssert, {
 get(target, key) {
  const value = Reflect.get(target, key);
  return typeof value === 'function' ? (...args) => { assertionsExecuted++; return value(...args); } : value;
 },
});
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
const errors = [], failedAssets = [], timings = [], screenshots = [], cases = [], cropImageSources = new Set();
const successfulImages = new Set(), canceledImageRequests = [];
let page;
const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('road-haven-save-v1')));
const quick = action => page.locator(`[data-quick="${action}"]`);
const nav = section => page.locator(`[data-nav="${section}"]`);
const plantingMode = () => page.locator('#planting-toolbar');
async function touch(locator) {
 if (!await locator.isVisible() && await locator.evaluate(element => Boolean(element.closest('#farm-tray')))) await touch(page.locator('[data-farm-toggle]'));
 await locator.scrollIntoViewIfNeeded();
 const box = await locator.boundingBox();
 assert.ok(box, 'the intended touch target is rendered');
 const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
 assert.equal(await locator.evaluate((button, point) => button === document.elementFromPoint(point.x, point.y)?.closest('button'), point), true, 'the intended touch must reach this button');
 await page.touchscreen.tap(point.x, point.y);
}
async function shot(name) {
 const path = `artifacts/v${appVersion}-seeds-${name}.png`;
 await page.screenshot({ path, fullPage: true });
 screenshots.push(path);
}
async function pauseWorld() {
 const pause = page.getByRole('button', { name: '시간 일시정지', exact: true });
 if (await pause.count()) await touch(pause);
}
async function fixture(state) {
 await page.evaluate(state => localStorage.setItem('road-haven-seed-fixture', JSON.stringify(state)), state);
 await page.reload();
 await page.locator('#resident-name').getByText(state.name, { exact: true }).waitFor();
 await pauseWorld();
}
function lateFixture(fresh, overrides = {}) {
 const state = structuredClone(fresh);
 state.deckLevel = 6;
 state.stats.expansions = 5;
 state.stats.harvests = 3;
 state.energy = 100;
 state.seedInventory = Object.fromEntries(crops.map(crop => [crop.id, 4]));
 state.resources.seeds = 24;
 state.plots = Array.from({ length: 8 }, (_, index) => ({ id: index + 1, plantedAt: null, watered: false }));
 // Harvest rewards are measured separately from the once-only first-harvest quest.
 state.quests = [...new Set([...state.quests, 'first-harvest', 'bigger-home'])];
 return Object.assign(state, overrides);
}
async function openInventory(button = quick('plant')) {
 if (await plantingMode().isVisible() && await plantingMode().getAttribute('data-farm-mode') === 'plant') await touch(plantingMode().locator('[data-seed-change]'));
 else await touch(button);
 if (!await page.locator('#modal-root [data-select-seed]').first().isVisible()) {
  await touch(plantingMode().locator('[data-seed-change]'));
 }
 await page.locator('#modal-root [data-select-seed]').first().waitFor();
 assert.equal(await page.locator('#modal-root [data-select-seed]').count(), 6, 'inventory contains six distinct seed choices');
}
async function chooseSeed(id, button = quick('plant')) {
 await openInventory(button);
 const before = await saved();
 await touch(page.locator(`[data-select-seed="${id}"]`));
 assert.equal(await page.locator('#modal-root').isVisible(), false, 'selecting a seed returns to the actual farm');
 assert.equal(await plantingMode().isVisible(), true, 'the selected seed stays active for continuous planting');
 assert.equal((await saved()).resources.seeds, before.resources.seeds, 'selection never consumes a seed');
 assert.equal((await saved()).energy, before.energy, 'selection never costs energy');
 assert.equal(await page.locator('#app').getAttribute('aria-busy'), null, 'selection alone does not start a chore');
 assert.match(await page.locator('#planting-seed-name').innerText(), new RegExp(crops.find(crop => crop.id === id).name));
 // Allow the real camera animation to reach its stable farm view.
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
 assert.equal(await page.evaluate(point => document.elementFromPoint(point.x, point.y)?.id === 'world', point), true, `painted plot ${id} stays clear of the mobile HUD`);
 await page.touchscreen.tap(point.x, point.y);
}
async function waitBusy() {
 await page.waitForFunction(() => document.querySelector('#app').getAttribute('aria-busy') === 'true', null, { timeout: 1500 });
 assert.equal(await page.locator('.chore-status').isVisible(), true, 'the character visibly performs planting');
}
async function waitIdle(label, started, timeout = 30000) {
 await page.waitForFunction(() => !document.querySelector('#app').hasAttribute('aria-busy'), null, { timeout });
 const elapsedMs = Date.now() - started;
 timings.push({ name: label, elapsedMs });
 assert.ok(elapsedMs < timeout, `${label} finishes in real browser time`);
 assert.equal(await page.locator('.chore-status').isVisible(), false, 'completed work releases the chore indicator');
}
async function cancelMode() {
 if (await plantingMode().isVisible()) await touch(page.locator('[data-plant-cancel]'));
}
async function selectPlot(id) {
 await touch(nav('farm'));
 for (let attempt = 0; attempt < 9; attempt++) {
  if (await page.locator('#plot-action').getAttribute('data-plot') === String(id)) return;
  await touch(page.locator('[data-plot-step="1"]'));
 }
 assert.fail(`Cannot select plot ${id}`);
}
async function assertInventoryLayout(width, height) {
 assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${width}×${height}: inventory does not overflow horizontally`);
 const paintedFrames = [];
 for (const crop of crops) {
  const card = page.locator(`[data-select-seed="${crop.id}"]`);
  await card.scrollIntoViewIfNeeded();
  const box = await card.boundingBox();
  assert.ok(box && box.width >= 44 && box.height >= 44, `${crop.name} seed has a finger-sized target`);
  assert.ok(box.x >= 0 && box.x + box.width <= width + 1 && box.y >= 0 && box.y + box.height <= height + 1, `${crop.name} card is reachable by scrolling the inventory`);
  assert.match(await card.innerText(), new RegExp(crop.name));
  assert.match(await card.innerText(), new RegExp(String(crop.minutes)));
  const sources = await card.locator('img, svg image').evaluateAll(images => images.map(image => image.getAttribute('src') || image.getAttribute('href')).filter(Boolean));
  assert.ok(sources.length, `${crop.name} has illustrated seed art`);
  assert.equal(await card.locator('.crop-icon').getAttribute('aria-label'), `${crop.name} 씨앗`, 'crop art describes the actual chosen species');
  paintedFrames.push(await card.locator('.crop-icon').getAttribute('viewBox'));
  sources.forEach(source => cropImageSources.add(source));
 }
 assert.equal(new Set(paintedFrames).size, 6, 'all six choices use their own illustrated seed packets');
}
async function assertPlantingLayout(width, height) {
 assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight + 1), true, `${width}×${height}: planting mode fits the main game without scrolling`);
 for (const selector of ['[data-plant-all]', '[data-seed-change]', '[data-plant-cancel]']) {
  const box = await page.locator(selector).boundingBox();
  assert.ok(box && box.width >= 44 && box.height >= 44 && box.x >= 0 && box.y >= 0 && box.x + box.width <= width + 1 && box.y + box.height <= height + 1, `${selector} remains reachable`);
 }
}

try {
 for (const width of [360, 390]) {
  const height = width === 360 ? 740 : 844;
  const context = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true });
  await context.addInitScript(() => {
   const fixture = localStorage.getItem('road-haven-seed-fixture');
   if (fixture) { localStorage.setItem('road-haven-save-v1', fixture); localStorage.removeItem('road-haven-seed-fixture'); localStorage.removeItem('road-haven-selected-seed-v1'); }
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
  await page.goto(baseUrl);
  await page.waitForLoadState('networkidle');
  await touch(page.locator('[data-start]'));
  await pauseWorld();
  const fresh = await saved();
  assert.equal(fresh.resources.seeds, 23);
  assert.deepEqual(fresh.seedInventory, { carrot: 8, potato: 3, tomato: 3, corn: 3, strawberry: 3, pumpkin: 3 });
  await openInventory();
  await assertInventoryLayout(width, height);
  await shot(`inventory-${width}`);
  await touch(page.locator('#modal-root [data-close]').first());

  const empty = lateFixture(fresh);
  await fixture(empty);
  await chooseSeed('corn');
  await assertPlantingLayout(width, height);
  const queueStart = Date.now();
  await touchPlot(1);
  await waitBusy();
  await touchPlot(2);
  await touchPlot(2); // The same queued plot may be selected only once.
  await touchPlot(3);
  await touchPlot(1); // The currently worked plot also may not be queued again.
  await page.waitForTimeout(350);
  assert.equal((await saved()).resources.seeds, 24, 'queued planting does not give an early resource commit');
  assert.equal((await saved()).plots.every(plot => plot.plantedAt === null), true);
  await shot(`queued-working-${width}`);
  await waitIdle(`three-corn-plots-${width}`, queueStart);
  let state = await saved();
  assert.deepEqual(state.plots.slice(0, 3).map(plot => plot.cropId), ['corn', 'corn', 'corn']);
  assert.equal(state.plots.slice(3).every(plot => plot.plantedAt === null), true);
  assert.equal(state.seedInventory.corn, 1);
  assert.equal(state.resources.seeds, 21);
  assert.equal(state.energy, 88, 'three queued plots cost exactly three planting actions');
  assert.equal(await plantingMode().isVisible(), true, 'the same seed stays selected after the queue completes');
  await touchPlot(1);
  assert.match(await page.locator('#toast').innerText(), /옥수수|자라고/, 'occupied plots explain why another seed cannot be planted');
  assert.equal((await saved()).resources.seeds, 21, 'an occupied plot consumes no extra seed');
  assert.equal((await saved()).energy, 88);
  const continueStart = Date.now();
  await touchPlot(8);
  await waitBusy();
  await waitIdle(`continued-plot-eight-${width}`, continueStart, 14000);
  state = await saved();
  assert.equal(state.plots[7].cropId, 'corn', 'the eighth painted plot accepts a continuous-mode touch');
  assert.equal(state.seedInventory.corn, 0);
  assert.equal(state.resources.seeds, 20);
  assert.equal(state.energy, 84);
  await touchPlot(5);
  assert.match(await page.locator('.activity-block-reason').innerText(), /옥수수 씨앗/, 'depleted selected variety has a visible recovery choice');
  assert.equal((await saved()).resources.seeds, 20);
  assert.equal((await saved()).plots[4].plantedAt, null);
  await touch(page.locator('#modal-root [data-seed-change]'));
  await touch(page.locator('[data-select-seed="corn"]'));
  assert.equal(await page.locator('#modal-root').isVisible(), true, 'an empty variety cannot silently start planting');
  assert.match(await page.locator('#toast').innerText(), /옥수수 씨앗.*없어요/);
  await touch(page.locator('[data-select-seed="tomato"]'));
  assert.equal((await saved()).seedInventory.tomato, 4, 'choosing a replacement variety costs nothing');
  await cancelMode();
  await page.reload();
  await page.locator('#resident-name').getByText(fresh.name, { exact: true }).waitFor();
  await pauseWorld();
  state = await saved();
  assert.equal(state.plots[7].cropId, 'corn', 'selected crop species survives reload');
  assert.equal(state.seedInventory.corn, 0, 'depleted selected seeds survive reload');
  assert.equal(state.resources.seeds, Object.values(state.seedInventory).reduce((sum, count) => sum + count, 0));
  cases.push(`Actual canvas selection and continued sowing at ${width}×${height}; duplicate current/queued targets ignored; plot eight reachable; reload preserved crop and counts`);

  await fixture(empty);
  await chooseSeed('potato');
  const cancelStart = Date.now();
  await touchPlot(1);
  await waitBusy();
  await touchPlot(2);
  await touchPlot(3);
  await touch(page.locator('[data-plant-cancel]'));
  await waitIdle(`cancel-only-future-work-${width}`, cancelStart, 14000);
  state = await saved();
  assert.equal(state.plots[0].cropId, 'potato');
  assert.equal(state.plots.slice(1).every(plot => plot.plantedAt === null), true, 'cancel discards every queued planting after the current visible job');
  assert.equal(state.seedInventory.potato, 3);
  assert.equal(state.energy, 96);
  assert.equal(await plantingMode().isVisible(), false);

  if (width === 360) {
   await fixture(empty);
   await chooseSeed('potato');
   const changeStart = Date.now();
   await touchPlot(1);
   await waitBusy();
   await touchPlot(2);
   await touch(plantingMode().locator('[data-seed-change]'));
   assert.equal((await page.locator('[data-seed-count="potato"]').innerText()).trim(), '3', 'the old queued plot releases its seed reservation while the current job keeps one');
   await touch(page.locator('[data-select-seed="strawberry"]'));
   // Opening seed selection lets the actor camera move while work continues.
   // Wait for the displayed farm camera to settle before translating plot three.
   await page.waitForTimeout(1300);
   await touchPlot(3);
   await waitIdle('seed-change-finishes-current-and-uses-new-seed', changeStart);
   state = await saved();
   assert.equal(state.plots[0].cropId, 'potato', 'changing seeds preserves the crop of the current job');
   assert.equal(state.plots[1].plantedAt, null, 'changing seeds discards the old pending queue');
   assert.equal(state.plots[2].cropId, 'strawberry');
   assert.equal(state.seedInventory.potato, 3);
   assert.equal(state.seedInventory.strawberry, 3);
   await cancelMode();

   await fixture(empty);
   await chooseSeed('tomato');
   const navStart = Date.now();
   await touchPlot(1);
   await waitBusy();
   await touchPlot(2);
   await touch(nav('home'));
   await waitIdle('navigation-stops-future-planting', navStart, 14000);
   state = await saved();
   assert.equal(state.plots[0].cropId, 'tomato');
   assert.equal(state.plots[1].plantedAt, null);
   assert.equal(state.seedInventory.tomato, 3);
   assert.equal(await plantingMode().isVisible(), false);
   assert.equal(await nav('home').getAttribute('aria-current'), 'page', 'requested navigation happens after the current chore');

   const tired = lateFixture(fresh, { energy: 0 });
   await fixture(tired);
   await chooseSeed('pumpkin');
   await touchPlot(1);
   assert.equal(await page.locator('.activity-block-reason').isVisible(), true);
   assert.match(await page.locator('.activity-block-reason').innerText(), /기력|기운/);
   assert.equal((await saved()).seedInventory.pumpkin, 4, 'blocked work consumes no seed');
   assert.equal((await saved()).plots[0].plantedAt, null);
   const recoveryStart = Date.now();
   await touch(page.locator('[data-rest-retry="plant"]'));
   await waitBusy();
   await waitIdle('rest-and-plant-selected-pumpkin', recoveryStart, 14000);
   state = await saved();
   assert.equal(state.plots[0].cropId, 'pumpkin', 'recovery keeps the user-selected seed');
   assert.equal(state.seedInventory.pumpkin, 3);
   assert.equal(state.resources.food, tired.resources.food - 1);
   assert.equal(state.resources.water, tired.resources.water - 1);
   assert.equal(state.energy, 51, 'one paid rest and one planting commit exactly once');
   await cancelMode();
   cases.push('Changing seeds and navigation discard pending work; cancel preserves the current job; low-energy recovery keeps the selected crop and commits once');
  }

  if (width === 390) {
   await fixture(empty);
   await chooseSeed('carrot');
   const allStart = Date.now();
   await touch(page.locator('[data-plant-all]'));
   await waitBusy();
   await touch(page.locator('[data-plant-all]'));
   await waitIdle('plant-all-reserves-only-available-seeds', allStart, 60000);
   state = await saved();
   assert.equal(state.plots.filter(plot => plot.cropId === 'carrot').length, 4);
   assert.equal(state.plots.slice(4).every(plot => plot.plantedAt === null), true);
   assert.equal(state.seedInventory.carrot, 0);
   assert.equal(state.resources.seeds, 20);
   assert.equal(state.energy, 84, 'repeated all-plant touches cannot reserve extra seeds or energy');
   await cancelMode();
   await page.setViewportSize({ width: 844, height: 390 });
   await fixture(empty);
   await openInventory();
   await assertInventoryLayout(844, 390);
   await shot('inventory-landscape');
   await touch(page.locator('[data-select-seed="carrot"]'));
   await page.waitForTimeout(1300);
   await assertPlantingLayout(844, 390);
   await shot('planting-landscape');
   await cancelMode();
   await page.setViewportSize({ width: 390, height: 844 });

   const growing = lateFixture(fresh);
   growing.plots = crops.map((crop, index) => ({ id: index + 1, cropId: crop.id, plantedAt: growing.totalMinutes - 90, watered: true }));
   growing.plots.push({ id: 7, plantedAt: null, watered: false }, { id: 8, plantedAt: null, watered: false });
   await fixture(growing);
   await touch(nav('farm'));
   await touch(page.locator('#farm-context [data-open="farm"]'));
   for (let index = 0; index < crops.length; index++) {
    const crop = crops[index], card = page.locator(`[data-plot-card="${index + 1}"]`);
    assert.match(await card.innerText(), new RegExp(crop.name), 'each growing plot identifies its actual crop');
    const percentage = await card.locator('.quest-progress > span').evaluate(element => parseFloat(element.style.width));
    assert.ok(Math.abs(percentage - 90 / crop.minutes * 100) < .05, `${crop.name} uses its own growing duration`);
   }
   await shot('six-growing-crops');
   await touch(page.locator('#modal-root [data-close]').first());

   const mature = lateFixture(fresh);
   mature.plots = crops.map((crop, index) => ({ id: index + 1, cropId: crop.id, plantedAt: mature.totalMinutes - crop.minutes, watered: true }));
   mature.plots.push({ id: 7, plantedAt: null, watered: false }, { id: 8, plantedAt: null, watered: false });
   await fixture(mature);
   await touch(nav('farm'));
   await page.waitForTimeout(1300);
   await shot('six-mature-crops-world');
   for (let index = 0; index < crops.length; index++) {
    const crop = crops[index];
    await selectPlot(index + 1);
    assert.match(await page.locator('#context-state').innerText(), new RegExp(crop.name));
    const before = await saved(), harvestStart = Date.now();
    await touch(page.locator('#plot-action'));
    await waitBusy();
    await page.waitForTimeout(250);
    assert.equal((await saved()).resources.food, before.resources.food, 'harvest waits for visible work before awarding food');
    await waitIdle(`harvest-${crop.id}`, harvestStart, 14000);
    state = await saved();
    assert.equal(state.resources.food, before.resources.food + crop.food, `${crop.name} awards its documented food amount`);
    assert.equal(state.seedInventory[crop.id], before.seedInventory[crop.id] + 2, `${crop.name} returns its own seeds`);
    assert.equal(state.resources.seeds, before.resources.seeds + 2);
    assert.equal(state.plots[index].plantedAt, null);
    assert.equal(state.plots[index].cropId, undefined, 'harvest leaves a reusable empty plot');
   }
   state = await saved();
   assert.equal(state.stats.harvests, mature.stats.harvests + 6);
   assert.equal(state.resources.food, mature.resources.food + 40);
   assert.equal(state.resources.seeds, mature.resources.seeds + 12);
   assert.equal(state.energy, 76);
   await page.reload();
   await page.locator('#resident-name').getByText(fresh.name, { exact: true }).waitFor();
   await pauseWorld();
   assert.deepEqual((await saved()).seedInventory, state.seedInventory, 'all returned seed varieties persist after reload');
   cases.push('All six crops render their names and individual growth duration, harvest individual food and two seeds of their own variety, and persist all returned inventory counts');

   const legacy = structuredClone(fresh);
   legacy.name = '이전 농부';
   delete legacy.seedInventory;
   legacy.resources.seeds = 11;
   legacy.plots = [{ id: 1, plantedAt: 240, watered: true }, { id: 2, plantedAt: 420, watered: false }, { id: 3, plantedAt: null, watered: false }];
   await fixture(legacy);
   await openInventory();
   for (const crop of crops) assert.equal((await page.locator(`[data-seed-count="${crop.id}"]`).innerText()).trim(), String(crop.id === 'carrot' ? 11 : 0), 'legacy migration keeps the original seed total without granting free varieties');
   await touch(page.locator('#modal-root [data-close]').first());
   // A normal reload saves the migrated state through the app's pagehide path.
   await page.reload();
   await page.locator('#resident-name').getByText(legacy.name, { exact: true }).waitFor();
   await pauseWorld();
   state = await saved();
   assert.deepEqual(state.seedInventory, { carrot: 11, potato: 0, tomato: 0, corn: 0, strawberry: 0, pumpkin: 0 });
   assert.equal(state.resources.seeds, 11);
   assert.equal(state.plots[0].cropId, 'carrot');
   assert.equal(state.plots[1].cropId, 'carrot');
   assert.equal(state.plots[0].plantedAt, 240);
   assert.equal(state.plots[1].plantedAt, 420);
   assert.equal(state.resources.food, legacy.resources.food);
   await page.reload();
   await page.locator('#resident-name').getByText(legacy.name, { exact: true }).waitFor();
   assert.equal((await saved()).resources.seeds, 11, 'a second reload never repeats a migration grant');
   assert.deepEqual((await saved()).seedInventory, state.seedInventory);
   cases.push('v0.5 saves preserve seed total and planted carrots; repeated reload grants no extra seeds');
  }
  await context.close();
 }
 assert.ok(cropImageSources.size, 'seed inventory requested crop illustration assets');
 assert.equal(canceledImageRequests.every(url => successfulImages.has(url)), true, 'canceled SVG-image requests are allowed only for the same image URL that also loaded successfully');
 const artContext = await browser.newContext();
 const artPage = await artContext.newPage();
 await artPage.goto(baseUrl);
 const decoded = await artPage.evaluate(async sources => Promise.all(sources.map(async source => {
  const image = new Image(); image.src = source; await image.decode();
  return { source, width: image.naturalWidth, height: image.naturalHeight };
 })), [...new Set([...cropImageSources, ...canceledImageRequests])]);
 assert.equal(decoded.every(image => image.width > 0 && image.height > 0), true, 'every displayed crop illustration decodes');
 await artContext.close();
 assert.deepEqual(errors, []);
 assert.deepEqual(failedAssets, []);
 await writeFile(`artifacts/seed-inventory-v${appVersion}-verification.json`, JSON.stringify({
  version: appVersion, status: 'passed', baseUrl,
  input: 'Actual touchscreen tap coordinates in mobile browser contexts',
  clock: 'Real browser timers and requestAnimationFrame; no page.clock',
  growthFixtures: 'Only crop-growing wait is skipped using valid half-grown and mature saved plots',
  viewports: ['360×740', '390×844', '844×390'],
  startedAt: startedAt.toISOString(), finishedAt: new Date().toISOString(), elapsedMs: Date.now() - startedAt.getTime(),
  assertionsExecuted, cases, timings,
  decodedCropIllustrations: decoded.filter(image => cropImageSources.has(image.source)),
  canceledImageRequests, canceledImagesDecoded: decoded.filter(image => canceledImageRequests.includes(image.source)),
  screenshots, errors, failedAssets,
 }, null, 2) + '\n');
 console.log(`PASS: ${assertionsExecuted} real-touch seed-inventory assertions; ${timings.length} real-time work sequences; six varieties, continued canvas planting, queue/cancel/change/navigation, resource recovery, crop-specific growth/harvest and legacy save migration.`);
} catch (error) {
 if (page && !page.isClosed()) await shot('failure').catch(() => {});
  await writeFile(`artifacts/seed-inventory-v${appVersion}-verification.json`, JSON.stringify({ version: appVersion, status: 'failed', baseUrl, assertionsExecuted, cases, timings, screenshots, errors, failedAssets, canceledImageRequests, failure: String(error) }, null, 2) + '\n');
 throw error;
} finally {
 await browser.close();
}
