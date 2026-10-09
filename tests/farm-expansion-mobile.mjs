import { chromium } from '@playwright/test';
import strictAssert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

// Actual touchscreen/CDP gestures and real animation time. Explicit saved fixtures
// provide later deck levels/materials and mature crops; no direct game calls are used.
const version = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')).version;
const baseUrl = process.env.TEST_BASE_URL || 'http://127.0.0.1:5173';
const legacyBaseUrl = process.env.LEGACY_TEST_BASE_URL || null;
const startedAt = new Date();
const expectedGameMinutesPerSecond = 4;
const expectedSpeedMultiplier = 2;
await mkdir('artifacts', { recursive: true });
let assertionsExecuted = 0;
const assert = new Proxy(strictAssert, { get(target, key) { const value = Reflect.get(target, key); return typeof value === 'function' ? (...args) => { assertionsExecuted++; return value(...args); } : value; } });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
const errors = [], failedAssets = [], screenshots = [], cases = [], timings = [], fixtures = [];
let page, context;
const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('road-haven-save-v1')));
const geometry = () => page.locator('#world').evaluate(canvas => JSON.parse(canvas.dataset.sceneGeometry));
const plots = () => page.locator('#world').evaluate(canvas => JSON.parse(canvas.dataset.farmPlots || '[]'));
const nav = section => page.locator(`[data-nav="${section}"]`);
async function shot(name) { await page.waitForTimeout(80); const path = `artifacts/v${version}-farm-expansion-${name}.png`; await page.screenshot({ path, fullPage: true }); screenshots.push(path); }
async function touchPointFor(locator) {
 // One DOM measurement keeps phone taps responsive at the actual 2x chore
 // speed. Modal scrolling remains real; no game calls or fake clock are used.
 const measure = element => {
  const rect = element.getBoundingClientRect(), x = rect.x + rect.width / 2, y = rect.y + rect.height / 2;
  return { x, y, width: rect.width, height: rect.height, onScreen: rect.x >= 0 && rect.y >= 0 && rect.right <= innerWidth + 1 && rect.bottom <= innerHeight + 1,
   farmTray: Boolean(element.closest('#farm-tray')), reached: document.elementFromPoint(x, y)?.closest('button') === element };
 };
 let point = await locator.evaluate(measure);
 if ((!point.width || !point.height) && point.farmTray) { await touch(nav('farm')); point = await locator.evaluate(measure); }
 if (!point.onScreen && point.width && point.height) { await locator.scrollIntoViewIfNeeded(); point = await locator.evaluate(measure); }
 assert.ok(point.width > 0 && point.height > 0, 'a touchscreen control is rendered');
 assert.equal(point.reached, true, 'the actual finger coordinate reaches its intended control');
 return { x: point.x, y: point.y };
}
async function touch(locator) {
 const point = await touchPointFor(locator);
 await page.touchscreen.tap(point.x, point.y);
 return point;
}
async function pauseWorld() {
 if (!await page.locator('[data-open="menu"]').count()) { const pause = page.getByRole('button', { name: '시간 일시정지', exact: true }); if (await pause.count()) await touch(pause); return; }
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
async function closeModal() { if (await page.locator('#modal-root').isVisible()) await touch(page.locator('#modal-root [data-close]').first()); }
async function waitBusy() { await page.waitForFunction(() => document.querySelector('#app').hasAttribute('aria-busy'), null, { timeout: 1500 }); }
async function waitIdle(label, start = Date.now(), timeout = 25000) {
 await page.waitForFunction(() => !document.querySelector('#app').hasAttribute('aria-busy'), null, { timeout });
 timings.push({ label, elapsedMs: Date.now() - start });
}
async function freshContext(width, height, url = baseUrl) {
 context = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true });
 await context.addInitScript(() => { const fixture = localStorage.getItem('farm-expansion-qa-fixture'); if (fixture) { localStorage.setItem('road-haven-save-v1', fixture); localStorage.removeItem('farm-expansion-qa-fixture'); localStorage.removeItem('road-haven-selected-seed-v1'); } });
 page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
 page.on('response', response => { if (response.status() >= 400 && ['image', 'font', 'script', 'stylesheet'].includes(response.request().resourceType())) failedAssets.push(`${response.status()} ${response.url()}`); });
 await page.goto(url); await page.locator('[data-start]').waitFor(); await touch(page.locator('[data-start]')); await pauseWorld();
 await page.waitForTimeout(800);
 return saved();
}
async function loadFixture(state, label) {
 // Declared fixtures contain no absence interval; offline catch-up is tested separately.
 state = { ...state, lastSaved: Date.now() };
 fixtures.push({ label, deckLevel: state.deckLevel, plotCount: state.plots.length, totalMinutes: state.totalMinutes });
 await page.evaluate(state => localStorage.setItem('farm-expansion-qa-fixture', JSON.stringify(state)), state); await page.reload();
 await page.locator('#resident-name').getByText(state.name, { exact: true }).waitFor(); await pauseWorld();
 const loaded = await saved();
 for (const key of ['deckLevel', 'plots', 'resources', 'seedInventory', 'settlement', 'facilityHistory', 'growthQuests', 'stats', 'xp', 'energy']) assert.deepEqual(loaded[key], state[key], `${label}: ${key} survives loading without gifts or a reset`);
 await page.waitForTimeout(800); return loaded;
}
function growthFixture(fresh, deckLevel = 2, count = deckLevel + 2) {
 const state = structuredClone(fresh);
 state.name = deckLevel === 2 ? '기존 농장 확장' : '최대 농장 검사'; state.deckLevel = deckLevel; state.stats.expansions = deckLevel - 1;
 state.energy = 100; state.resources = { ...state.resources, wood: 400, scrap: 200, food: 40, water: 40 };
 state.stats.gathers = 1; state.stats.harvests = 1; state.stats.plantings = 2; state.stats.waterings = 2;
 state.growthQuests = { claimed: ['road-supplies', 'first-carrot', 'rainwater-home'] };
 state.settlement = { buildings: [{ id: 1, type: 'waterworks', slot: 0, level: 1, startedAt: state.totalMinutes, readyAt: state.totalMinutes + 90 }], nextBuildingId: 2, stats: { productions: 1, collections: 0 } };
 state.facilityHistory = { builtTypes: ['waterworks'], upgradedFacilityIds: [] };
 state.quests = ['bigger-home']; state.xp = 45; state.level = 1;
 state.plots = Array.from({ length: count }, (_, index) => index < 2 ? { ...fresh.plots[index] } : { id: index + 1, plantedAt: null, watered: false });
 return state;
}
async function assertContinuity(before, after, label, originalPlots = before.plots.length) {
 assert.deepEqual(after.plots.slice(0, originalPlots), before.plots.slice(0, originalPlots), `${label}: growing crops retain ids, seed types, planting times and water`);
 for (const key of ['settlement', 'facilityHistory', 'growthQuests', 'quests', 'seedInventory']) assert.deepEqual(after[key], before[key], `${label}: ${key} is preserved`);
 assert.equal(after.deckLevel, before.deckLevel, `${label}: adding a planter does not silently upgrade the truck`);
 assert.deepEqual(after.stats, before.stats, `${label}: expansion does not fabricate farming/quest counters`);
}
async function openExpansion() {
 await touch(nav('farm'));
 await touch(page.locator('.farm-expand-tool[data-open="farm-expand"]'));
 await page.locator('[data-action="expandFarm"]').waitFor();
}
async function buyPlot(label, wood, scrap) {
 const before = await saved(), button = page.locator('[data-action="expandFarm"]');
 assert.equal(await button.isDisabled(), false); const start = Date.now(), box = await button.boundingBox();
 await touch(button); await waitBusy();
 // A second real touch at the original confirmation position cannot spend twice.
 await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
 assert.equal((await saved()).plots.length, before.plots.length, 'a visible construction animation completes before the new plot is committed');
 assert.deepEqual((await saved()).resources, before.resources, 'the animation does not charge before completion');
 await page.waitForFunction(() => JSON.parse(document.querySelector('#world').dataset.sceneAction || 'null')?.kind === 'expandFarm', null, { timeout: 1500 });
 await waitIdle(label, start);
 const after = await saved();
 assert.equal(after.plots.length, before.plots.length + 1, `${label}: exactly one new planter is built`);
 assert.equal(after.resources.wood, before.resources.wood - wood); assert.equal(after.resources.scrap, before.resources.scrap - scrap);
 assert.equal(after.energy, before.energy - 8); assert.equal(after.totalMinutes, before.totalMinutes, 'paused farm construction never jumps the village clock at completion');
 for (const resource of ['food', 'water', 'seeds']) assert.equal(after.resources[resource], before.resources[resource]);
 assert.deepEqual(after.plots.at(-1), { id: before.plots.length + 1, plantedAt: null, watered: false });
 await assertContinuity(before, after, label); await page.waitForTimeout(500); assert.deepEqual((await saved()).resources, after.resources, 'construction never charges a second time');
 assert.ok(Date.now() - start > 1000 / expectedSpeedMultiplier, 'farm construction keeps a visible work animation at the actual 2x speed');
 return after;
}
async function worldAt(point, label) { assert.equal(await page.evaluate(point => document.elementFromPoint(point.x, point.y)?.id === 'world', point), true, `${label}: a finger touches visible painted map`); }
async function plotPoint(id) { return page.locator('#world').evaluate((canvas, id) => { const plot = JSON.parse(canvas.dataset.farmPlots).find(plot => plot.id === id), rect = canvas.getBoundingClientRect(); if (!plot) throw Error(`Plot ${id} was not rendered`); return { x: rect.left + plot.x, y: rect.top + plot.y }; }, id); }
async function panToPlot(id) {
 // Keep the map at the readable game scale. A real two-finger translation
 // reveals distant beds without painting crops or using internal scene methods.
 for (let attempt = 0; attempt < 16; attempt++) {
  const point = await plotPoint(id);
  if (await page.evaluate(point => document.elementFromPoint(point.x, point.y)?.id === 'world', point)) return point;
  const stream = await page.locator('#world').evaluate((canvas, point) => {
   const rect = canvas.getBoundingClientRect();
   const target = { x: rect.left + rect.width * .48, y: rect.top + rect.height * .46 };
   let delta = { x: Math.max(-rect.width * .30, Math.min(rect.width * .30, target.x - point.x)), y: Math.max(-rect.height * .20, Math.min(rect.height * .20, target.y - point.y)) };
   // The landscape farm tray sits on the left. Pick a visible patch of map
   // for both fingers rather than dragging across buttons on that tray.
   for (let shrink = 0; shrink < 4; shrink++) {
    for (const fy of [.40, .30, .50, .60]) for (const fx of [.50, .65, .80, .35]) {
     const center = { x: rect.left + rect.width * fx, y: rect.top + rect.height * fy };
     const fingers = [{ x: center.x - 20, y: center.y, id: 1 }, { x: center.x + 20, y: center.y, id: 2 }];
     const end = fingers.map(finger => ({ ...finger, x: finger.x + delta.x, y: finger.y + delta.y }));
     if ([...fingers, ...end].every(p => document.elementFromPoint(p.x, p.y) === canvas)) return { fingers, end };
    }
    delta = { x: delta.x / 2, y: delta.y / 2 };
   }
   return null;
  }, point);
  assert.ok(stream, 'an unobstructed map area is available for a two-finger pan');
  const { fingers, end } = stream;
  for (const finger of fingers) await worldAt(finger, 'two-finger pan start');
  for (const finger of end) await worldAt(finger, 'two-finger pan end');
  const session = await context.newCDPSession(page);
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: fingers });
  await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: end });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await session.detach(); await page.waitForTimeout(100);
 }
 assert.fail(`plot ${id} cannot be reached by panning the visible map`);
}
async function touchPlot(id) { const point = await panToPlot(id); await worldAt(point, `plot ${id}`); await page.touchscreen.tap(point.x, point.y); }
async function farmView() { await touch(nav('farm')); await page.waitForTimeout(1100); }
async function drag(points) {
 for (const point of points) await worldAt(point, 'drag');
 const session = await context.newCDPSession(page);
 await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...points[0], id: 1 }] });
 for (const point of points.slice(1)) { await page.waitForTimeout(60); await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...point, id: 1 }] }); }
 await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await session.detach();
}
async function cameraCheck() {
 const before = await saved(); const point = await panToPlot(9);
 await touch(page.locator('[data-camera-toggle]'));
 const control = page.locator('[data-map-move]'); await touch(control);
 const initial = await geometry(); await drag([point, { x: point.x - 20, y: point.y - 15 }]); await page.waitForTimeout(650);
 const moved = await geometry(); assert.ok(Math.abs(moved.dx - initial.dx + 20) < 3 && Math.abs(moved.dy - initial.dy + 15) < 3, 'the full farm follows a real hand-mode drag');
 assert.deepEqual(await saved(), before, 'moving the new plots spends no resources');
 await touch(page.locator('[data-map-zoom="1"]')); await page.waitForTimeout(500); assert.ok((await geometry()).mapZoom > initial.mapZoom, 'the expanded farm still zooms');
 await touch(page.locator('[data-map-reset]')); await page.waitForTimeout(900); assert.equal((await geometry()).mapZoom, 1); assert.equal(await control.getAttribute('aria-pressed'), 'false');
 await touch(page.locator('[data-camera-toggle]'));
}
async function chooseCarrot() {
 await touch(page.locator('[data-quick="plant"]'));
 if (!await page.locator('#modal-root [data-select-seed]').first().isVisible()) await touch(page.locator('#planting-toolbar [data-seed-change]'));
 await touch(page.locator('[data-select-seed="carrot"]')); await page.waitForTimeout(1000);
}
async function selectSpecific(action, id) {
 await touch(page.locator('[data-open="farm"]').first());
 await touch(page.locator(`[data-plot-card="${id}"] [data-action="${action}"]`));
}
async function stopTool() { if (await page.locator('[data-plant-cancel]').isVisible()) await touch(page.locator('[data-plant-cancel]')); }
async function assertFarmDrawn(count) {
 const rendered = await plots(); assert.equal(rendered.length, count, 'every purchased plot has a rendered target');
 assert.equal(new Set(rendered.map(plot => plot.id)).size, count, 'rendered plot ids are unique');
 assert.equal(new Set(rendered.map(plot => `${plot.x},${plot.y}`)).size, count, 'new plots have distinct map positions');
 for (const id of Array.from({ length: count }, (_, index) => index + 1)) {
  const point = await panToPlot(id); await worldAt(point, `expanded plot ${id}`);
  const plot = (await plots()).find(plot => plot.id === id);
  assert.ok(Number.isFinite(plot.x) && Number.isFinite(plot.y), `expanded plot ${id} has a translated map target`);
 }
}
async function assertControlsFit(label) {
 const { width, height } = page.viewportSize();
 assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight + 1), true, `${label}: the phone page itself never scrolls`);
 await touch(page.locator('[data-camera-toggle]'));
 for (const selector of ['.farm-expand-tool', '[data-map-move]', '[data-map-zoom="1"]', '[data-map-reset]']) {
  const control = page.locator(selector), box = await control.boundingBox();
  assert.ok(box && box.width >= 44 && box.height >= 44 && box.x >= 0 && box.y >= 0 && box.x + box.width <= width + 1 && box.y + box.height <= height + 1, `${label}: ${selector} is finger sized and on screen`);
  assert.equal(await control.evaluate((button, box) => document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)?.closest('button') === button, box), true, `${label}: ${selector} is unobstructed`);
 }
 await touch(page.locator('[data-camera-toggle]'));
}
try {
 let legacyState;
 if (legacyBaseUrl) {
  const fresh = await freshContext(390, 844, legacyBaseUrl); legacyState = growthFixture(fresh); await loadFixture(legacyState, 'Declared Lv2 fixture accepted by immutable v0.12 build');
  legacyState = await saved(); await context.close();
 }
 const fresh = await freshContext(390, 844);
 await openExpansion(); assert.equal(await page.locator('[data-action="expandFarm"]').isDisabled(), true, 'the initial deck is full at three plots');
 await touch(page.locator('#modal-root [data-open="expand"]')); assert.equal(await page.locator('[data-action="expand"]').isVisible(), true, 'a full farm takes the player directly to truck expansion');
 const initial = await saved(), deckStart = Date.now(); await touch(page.locator('[data-action="expand"]')); await waitBusy(); await waitIdle('Initial deck opens more farm capacity', deckStart);
 const upgraded = await saved(); assert.equal(upgraded.deckLevel, 2); assert.equal(upgraded.plots.length, 4); assert.equal(upgraded.resources.wood, initial.resources.wood - 24); assert.equal(upgraded.resources.scrap, initial.resources.scrap - 12);
 await openExpansion(); assert.equal(await page.locator('[data-action="expandFarm"]').isDisabled(), false, 'the upgraded deck has room for a paid plot'); assert.equal(await page.locator('#modal-root .cost-row .insufficient').count(), 2, 'both missing building materials are visible before buying a plot'); await shot('unlocked-capacity-needs-materials'); await closeModal();
 cases.push('New game: capacity 3 shows direct deck upgrade; genuine paid deck upgrade creates plot4 and unlocks room for more farm plots.');

 const legacy = legacyState || growthFixture(fresh); await loadFixture(legacy, legacyBaseUrl ? 'v0.12 save opened by new content' : 'Declared v0.12-schema Lv2 farm fixture');
 await openExpansion(); await shot('first-paid-plot'); const fifth = await buyPlot('Build fifth plot', 12, 6);
 await farmView(); const next = await page.locator('#world').evaluate(canvas => { const point = JSON.parse(canvas.dataset.farmExpansion), rect = canvas.getBoundingClientRect(); return { ...point, x: rect.left + point.x, y: rect.top + point.y }; });
 assert.equal(next.available, true); await worldAt(next, 'next planter marker'); await page.touchscreen.tap(next.x, next.y); await page.locator('[data-action="expandFarm"]').waitFor();
 const sixth = await buyPlot('Build sixth plot from map marker', 18, 9); await assertContinuity(legacy, sixth, 'Two consecutive purchases', 4);
 await page.reload(); await page.locator('#resident-name').getByText(legacy.name, { exact: true }).waitFor(); await pauseWorld();
 const reloaded = await saved(); for (const key of ['plots', 'resources', 'energy', 'settlement', 'facilityHistory', 'growthQuests', 'stats', 'xp']) assert.deepEqual(reloaded[key], sixth[key], `reload preserves ${key} after paid expansion`);
 await openExpansion(); assert.equal(await page.locator('[data-action="expandFarm"]').isDisabled(), true, 'Lv2 farm stops at six plots'); assert.equal(await page.locator('#modal-root [data-open="expand"]').isVisible(), true);
 await closeModal(); await farmView(); await touch(page.locator('[data-open="farm"]').first()); assert.equal(await page.locator('[data-plot-card]').count(), 6); await touch(page.locator('#modal-root [data-open="farm-expand"]')); assert.equal(await page.locator('[data-action="expandFarm"]').isDisabled(), true); await closeModal();
 cases.push('Old growing crops, active facility production, three claimed growth goals and seed inventory survive paid plots5/6 and reload; exact costs12/6 then18/9, no double charge, scene marker and overview links.');

 const late = growthFixture(fresh, 6, 17); await loadFixture(late, 'Declared Lv6 seventeen-plot fixture'); await openExpansion(); const full = await buyPlot('Build eighteenth and final plot', 66, 33);
 await farmView(); await assertFarmDrawn(18); await assertControlsFit('390px farm'); await shot('eighteen-plots-portrait'); await cameraCheck();
 await openExpansion(); assert.equal(await page.locator('[data-action="expandFarm"]').isDisabled(), true); assert.equal(await page.locator('#modal-root [data-open="expand"]').count(), 0, 'maximum farm has no impossible deck upgrade offer'); await closeModal();
 await farmView(); await chooseCarrot(); const beforePlant = await saved(), plantingStart = Date.now(); await touchPlot(9); await waitBusy(); await touchPlot(18); await waitIdle('Continuous planting on plots9/18', plantingStart, 30000);
 let state = await saved(); assert.equal(state.stats.plantings, beforePlant.stats.plantings + 2); assert.equal(state.seedInventory.carrot, beforePlant.seedInventory.carrot - 2); assert.equal(state.energy, beforePlant.energy - 8); assert.equal(state.plots[8].cropId, 'carrot'); assert.equal(state.plots[17].cropId, 'carrot'); assert.equal(await page.locator('#planting-toolbar').getAttribute('data-farm-mode'), 'plant'); await stopTool();
 const beforeWater = await saved(), wateringStart = Date.now(); await selectSpecific('water', 9); await waitBusy(); await touchPlot(18); await waitIdle('Continuous watering on plots9/18', wateringStart, 30000);
 state = await saved(); assert.equal(state.stats.waterings, beforeWater.stats.waterings + 2); assert.equal(state.resources.water, beforeWater.resources.water - 2); assert.equal(state.energy, beforeWater.energy - 6); assert.equal(state.plots[8].watered, true); assert.equal(state.plots[17].watered, true); await stopTool();
 const mature = await saved(); for (const id of [9, 18]) mature.plots[id - 1].plantedAt = mature.totalMinutes - 180;
 await loadFixture(mature, 'Only plots9/18 planting timestamps advanced for mature-crop fixture'); await farmView();
 const beforeHarvest = await saved(), harvestStart = Date.now(); await selectSpecific('harvest', 9); await waitBusy(); await touchPlot(18); await waitIdle('Continuous harvest on plots9/18', harvestStart, 30000);
 state = await saved(); assert.equal(state.stats.harvests, beforeHarvest.stats.harvests + 2); assert.equal(state.plots[8].plantedAt, null); assert.equal(state.plots[17].plantedAt, null);
 // The third lifetime harvest also earns the existing first-harvest reward.
 assert.equal(state.resources.food, beforeHarvest.resources.food + 8 + 4); assert.equal(state.seedInventory.carrot, beforeHarvest.seedInventory.carrot + 4 + 5); assert.equal(state.energy, beforeHarvest.energy - 8); await stopTool();
 await chooseCarrot(); const beforeStroke = await saved(), strokeStart = Date.now(); await panToPlot(18); await drag([await plotPoint(17), await plotPoint(18)]); await waitBusy(); await waitIdle('One real drag plants adjacent extended plots17/18', strokeStart, 30000);
 state = await saved(); assert.equal(state.stats.plantings, beforeStroke.stats.plantings + 2); assert.equal(state.seedInventory.carrot, beforeStroke.seedInventory.carrot - 2); assert.equal(state.energy, beforeStroke.energy - 8); assert.equal(state.plots[16].cropId, 'carrot'); assert.equal(state.plots[17].cropId, 'carrot'); await stopTool();
 for (const key of ['settlement', 'facilityHistory', 'growthQuests']) assert.deepEqual(state[key], full[key], `${key} survives farming on the new plots`);
 await page.reload(); await page.locator('#resident-name').getByText(late.name, { exact: true }).waitFor(); await pauseWorld(); assert.deepEqual((await saved()).plots, state.plots, 'the eighteenth plot and its planted crop survive reload');
 await farmView(); await assertFarmDrawn(18); await shot('extended-crops-portrait');
 await page.setViewportSize({ width: 360, height: 740 }); await page.waitForTimeout(1000); await touch(page.locator('[data-camera-toggle]')); await touch(page.locator('[data-map-reset]')); await touch(page.locator('[data-camera-toggle]')); await page.waitForTimeout(700); await assertFarmDrawn(18); await assertControlsFit('360px farm'); await shot('eighteen-plots-small-phone');
 await page.setViewportSize({ width: 844, height: 390 }); await page.waitForTimeout(1000); await touch(page.locator('[data-camera-toggle]')); await touch(page.locator('[data-map-reset]')); await touch(page.locator('[data-camera-toggle]')); await page.waitForTimeout(700); await assertFarmDrawn(18); await assertControlsFit('844px landscape farm'); await shot('eighteen-plots-landscape');
 cases.push('Lv6: genuine paid plot18 at66/33, all18 distinct rendered targets; real continuous planting/watering/harvest of plots9/18, one-finger drag plants17/18; growth/facilities/reload/pan/zoom and 390/360/landscape checks.');
 assert.deepEqual(errors, []); assert.deepEqual(failedAssets, []);
 await writeFile(`artifacts/farm-expansion-v${version}-verification.json`, JSON.stringify({ version, status: 'passed', speedMultiplier: expectedSpeedMultiplier, gameMinutesPerSecond: expectedGameMinutesPerSecond, baseUrl, legacyBaseUrl, assertionsExecuted, startedAt: startedAt.toISOString(), finishedAt: new Date().toISOString(), input: 'Real mobile touchscreen taps and CDP touch streams; no direct game calls', clock: 'Real animation time; declared later-deck/resources/mature-crop saved fixtures', deviceLimit: 'Chromium mobile emulation only; no physical Android claim', fixtures, cases, timings, screenshots, errors, failedAssets }, null, 2) + '\n');
 console.log(`PASS: ${assertionsExecuted} farm expansion assertions; paid expansion, old save continuity and real extended-plot farming.`);
} catch (error) {
 if (page && !page.isClosed()) await shot('failure').catch(() => {});
 await writeFile(`artifacts/farm-expansion-v${version}-verification.json`, JSON.stringify({ version, status: 'failed', speedMultiplier: expectedSpeedMultiplier, gameMinutesPerSecond: expectedGameMinutesPerSecond, baseUrl, legacyBaseUrl, assertionsExecuted, fixtures, cases, timings, screenshots, errors, failedAssets, failure: String(error), stack: error.stack }, null, 2) + '\n'); throw error;
} finally { await browser.close(); }
