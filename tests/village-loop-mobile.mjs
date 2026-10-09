import { chromium } from '@playwright/test';
import strictAssert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

// Real touchscreen taps, CDP finger drags and natural browser time. Save fixtures
// declare earned facilities/resources explicitly; they never call game functions.
const version = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')).version;
const baseUrl = process.env.TEST_BASE_URL || 'http://127.0.0.1:5173';
const startedAt = new Date();
const expectedGameMinutesPerSecond = 4;
const expectedSpeedMultiplier = 2;
await mkdir('artifacts', { recursive: true });
let assertionsExecuted = 0;
const assert = new Proxy(strictAssert, { get(target, key) { const value = Reflect.get(target, key); return typeof value === 'function' ? (...args) => { assertionsExecuted++; return value(...args); } : value; } });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
const errors = [], failedAssets = [], screenshots = [], cases = [], fixtures = [], timings = [];
let context, page;
const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('road-haven-save-v1')));
const geometry = () => page.locator('#world').evaluate(canvas => JSON.parse(canvas.dataset.sceneGeometry));
async function touchPointFor(locator) {
 // One DOM measurement keeps phone taps responsive at the actual 2x chore
 // speed. Modal scrolling remains real; no game calls or fake clock are used.
 const measure = element => {
  const rect = element.getBoundingClientRect(), x = rect.x + rect.width / 2, y = rect.y + rect.height / 2;
  return { x, y, width: rect.width, height: rect.height, onScreen: rect.x >= 0 && rect.y >= 0 && rect.right <= innerWidth + 1 && rect.bottom <= innerHeight + 1,
   farmTray: Boolean(element.closest('#farm-tray')), reached: document.elementFromPoint(x, y)?.closest('button') === element };
 };
 let point = await locator.evaluate(measure);
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
async function setPaused(shouldPause) {
 const isPaused = await page.locator('.time-button').getAttribute('aria-label') === '시간 계속';
 if (isPaused === shouldPause) return;
 await touch(page.locator('[data-open="menu"]'));
 await touch(page.locator('#modal-root [data-open="settings"]'));
 await touch(page.locator('#modal-root [data-pause]'));
 await touch(page.locator('#modal-root [data-save]'));
 await closeModal();
}
async function pauseWorld() { await setPaused(true); }
async function resumeWorld() { await setPaused(false); }
async function closeModal() { if (await page.locator('#modal-root').isVisible()) await touch(page.locator('#modal-root [data-close]').first()); }
async function shot(name) { await page.waitForTimeout(200); const path = `artifacts/v${version}-village-loop-${name}.png`; await page.screenshot({ path, fullPage: true }); screenshots.push(path); }
async function freshContext(width, height) {
 context = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true });
 await context.addInitScript(() => {
  const fixture = localStorage.getItem('village-loop-qa-fixture');
  if (fixture) { localStorage.setItem('road-haven-save-v1', fixture); localStorage.removeItem('village-loop-qa-fixture'); localStorage.removeItem('road-haven-selected-seed-v1'); }
 });
 page = await context.newPage();
 page.on('pageerror', error => errors.push(error.message));
 page.on('response', response => { if (response.status() >= 400 && ['image', 'font', 'script', 'stylesheet'].includes(response.request().resourceType())) failedAssets.push(`${response.status()} ${response.url()}`); });
 await page.goto(baseUrl); await page.locator('[data-start]').waitFor(); await touch(page.locator('[data-start]')); await pauseWorld();
 await page.waitForTimeout(400);
 return saved();
}
async function loadFixture(state, label, { offline = false } = {}) {
 const loadingAt = Date.now();
 fixtures.push({ label, deckLevel: state.deckLevel, plots: state.plots.length, offlineBaseline: state.lastSaved, villageOrders: state.villageOrders ?? 'absent' });
 await page.evaluate(state => localStorage.setItem('village-loop-qa-fixture', JSON.stringify(state)), state); await page.reload();
 await page.locator('#resident-name').getByText(state.name, { exact: true }).waitFor(); await pauseWorld();
 const loaded = await saved();
 for (const key of ['resources', 'plots', 'seedInventory', 'settlement', 'growthQuests', 'facilityHistory', 'stats', 'energy', 'xp']) {
  assert.deepEqual(loaded[key], state[key], `${label}: ${key} persists without gifts or automatic collection`);
 }
 if (!offline) assert.ok(loaded.totalMinutes >= state.totalMinutes && (loaded.totalMinutes - state.totalMinutes) / expectedGameMinutesPerSecond <= Math.ceil((Date.now() - loadingAt) / 1000) + 1, `${label}: a zero baseline creates no offline jump beyond actual loading and user navigation time`);
 await page.waitForTimeout(650);
 return loaded;
}
function productionFixture(fresh, remaining = 18) {
 const state = structuredClone(fresh);
 state.name = '움직이는 트럭 마을'; state.lastSaved = 0;
 state.resources = { ...state.resources, wood: 120, scrap: 80, food: 50, water: 0 };
 state.energy = 100;
 state.settlement = { buildings: [{ id: 1, type: 'waterworks', slot: 0, level: 1, startedAt: state.totalMinutes + remaining - 90, readyAt: state.totalMinutes + remaining }], nextBuildingId: 2, stats: { productions: 1, collections: 0 } };
 state.facilityHistory = { builtTypes: ['waterworks'], upgradedFacilityIds: [] };
 state.growthQuests = { claimed: [] };
 delete state.villageOrders;
 return state;
}
function lateFixture(fresh) {
 const state = productionFixture(fresh, 0);
 state.name = '열여덟 밭 마을'; state.deckLevel = 6; state.stats.expansions = 5;
 state.stats.gathers = 1; state.stats.harvests = 1;
 state.resources = { ...state.resources, wood: 400, scrap: 200, water: 80, food: 80 };
 state.plots = Array.from({ length: 18 }, (_, index) => index < 2 ? { ...fresh.plots[index] } : { id: index + 1, plantedAt: null, watered: false });
 state.growthQuests = { claimed: ['road-supplies', 'first-carrot', 'rainwater-home'] };
 state.villageOrders = { completed: 3 };
 state.quests = ['bigger-home'];
 return state;
}
async function waitBusy() { await page.waitForFunction(() => document.querySelector('#app').hasAttribute('aria-busy'), null, { timeout: 2500 }); }
async function waitIdle(label, started = Date.now()) {
 await page.waitForFunction(() => !document.querySelector('#app').hasAttribute('aria-busy'), null, { timeout: 45000 });
 timings.push({ label, elapsedMs: Date.now() - started });
}
async function readyPoint(id = 1) {
 return page.locator('#world').evaluate((canvas, id) => {
  const slot = JSON.parse(canvas.dataset.settlementSlots).find(slot => slot.buildingId === id), rect = canvas.getBoundingClientRect();
  if (!slot) throw Error(`Facility ${id} is absent from the rendered map`);
  return { x: rect.left + slot.readyX, y: rect.top + slot.readyY };
 }, id);
}
async function tapMap(point, label) {
 assert.equal(await page.evaluate(point => document.elementFromPoint(point.x, point.y)?.id === 'world', point), true, `${label}: a real finger reaches the painted world`);
 await page.touchscreen.tap(point.x, point.y);
}
async function drag(points) {
 for (const point of points) assert.equal(await page.evaluate(point => document.elementFromPoint(point.x, point.y)?.id === 'world', point), true, 'the finger drag stays on the painted world');
 const session = await context.newCDPSession(page);
 await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...points[0], id: 1 }] });
 for (const point of points.slice(1)) { await page.waitForTimeout(70); await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...point, id: 1 }] }); }
 await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await session.detach();
}
async function controlsFit(label) {
 const { width, height } = page.viewportSize();
 assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight + 1), true, `${label}: the game page itself never scrolls`);
 assert.equal(await page.locator('button#resources').count(), 1, `${label}: the resource bar is one inventory touch target`);
 assert.equal(await page.locator('#resources .resource').count(), 5, `${label}: all five quantities remain visible`);
 assert.equal(await page.locator('#resources button').count(), 0, `${label}: the resource bar has no nested buttons`);
 for (const selector of ['#resources', '[data-open="orders"]', '[data-camera-toggle]', '#settlement-objective']) {
  const control = page.locator(selector), box = await control.boundingBox();
  assert.ok(box && box.width >= 44 && box.height >= 44 && box.x >= 0 && box.y >= 0 && box.x + box.width <= width + 1 && box.y + box.height <= height + 1, `${label}: ${selector} is finger sized and on screen`);
  assert.equal(await control.evaluate((button, box) => document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)?.closest('button') === button, box), true, `${label}: ${selector} is unobstructed`);
 }
 assert.equal(await page.locator('[data-map-zoom="1"]').isVisible(), false, `${label}: zoom controls stay behind the camera flyout`);
 await touch(page.locator('[data-camera-toggle]'));
 for (const selector of ['[data-map-zoom="1"]', '[data-map-zoom="-1"]', '[data-map-move]', '[data-map-reset]']) {
  const control = page.locator(selector), box = await control.boundingBox();
  assert.ok(box && box.width >= 44 && box.height >= 44 && box.x >= 0 && box.y >= 0 && box.x + box.width <= width + 1 && box.y + box.height <= height + 1, `${label}: flyout ${selector} is finger sized and on screen`);
  assert.equal(await control.evaluate((button, box) => document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)?.closest('button') === button, box), true, `${label}: flyout ${selector} is unobstructed`);
 }
 await shot(`${label}-camera`);
 await touch(page.locator('[data-camera-toggle]'));
}
async function exchange(expectedId, expected) {
 const before = await saved(), button = page.locator(`[data-order-deliver="${expectedId}"]`);
 assert.equal(await button.isDisabled(), false, `${expectedId}: stocked request is deliverable`);
 await touch(button); const after = await saved();
 assert.equal(after.villageOrders.completed, (before.villageOrders?.completed ?? 0) + 1, `${expectedId}: one paid delivery is recorded`);
 for (const [resource, delta] of Object.entries(expected.resources)) assert.equal(after.resources[resource], before.resources[resource] + delta, `${expectedId}: exact ${resource} exchange`);
 assert.equal(after.xp, before.xp + expected.xp, `${expectedId}: exact XP reward`);
 assert.equal(after.energy, before.energy, `${expectedId}: no invented gathering or energy charge`);
 assert.equal(after.totalMinutes, before.totalMinutes, `${expectedId}: paused delivery does not secretly advance time`);
 assert.equal(await page.locator(`[data-order-deliver="${expectedId}"]`).count(), 0, `${expectedId}: stale confirmation is removed`);
 await page.waitForTimeout(600);
 return after;
}

try {
 const fresh = await freshContext(390, 844);
 await controlsFit('390px');
 assert.equal(await page.locator('#settlement-objective').getAttribute('data-active-quest'), 'road-supplies');
 await touch(page.locator('[data-open="orders"]'));
 const beforeOpen = await saved();
 assert.equal(await page.locator('[data-order-deliver="village-order-1"]').count(), 1);
 assert.deepEqual((await saved()).resources, beforeOpen.resources, 'reading a request awards nothing');
 await shot('first-request'); await closeModal();

 const running = productionFixture(fresh, 12); await loadFixture(running, 'Declared older save: no delivery counter, paid rainwater batch declared with3 real seconds left at4 game minutes/second');
 await touch(page.locator('[data-open="orders"]'));
 assert.equal(await page.locator('[data-order-deliver="village-order-1"]').isDisabled(), true, 'a water request cannot send missing water');
 await touch(page.locator('[data-order-source]'));
 await page.locator('#facility-sheet[data-facility="1"]').waitFor();
 assert.equal(await page.locator('#modal-root').isVisible(), false, 'request source shortcut closes its board and reaches the existing producer');
 assert.equal((await saved()).villageOrders, undefined, 'an older save gets no paid-request counter merely by visiting it');
 await touch(page.locator('[data-facility-close]')); await resumeWorld();
 const gatheringBefore = await saved(), gatheringAt = Date.now(); await touch(page.locator('#settlement-objective')); await waitBusy();
 assert.equal(await page.locator('[data-quest-board]').count(), 0, 'the compact current objective sends the player directly to its work');
 await touch(page.locator('#resources')); await page.locator('[data-inventory-count="water"]').waitFor();
 assert.equal(await page.locator('#resources').isDisabled(), false, 'the inventory remains interactive during a walking chore');
 await closeModal(); await touch(page.locator('[data-open="orders"]'));
 await page.waitForFunction(() => JSON.parse(document.querySelector('#world').dataset.settlementSlots).find(slot => slot.buildingId === 1)?.action === 'facility-collect', null, { timeout: 12000 });
 assert.equal(await page.locator('#app').getAttribute('aria-busy'), 'true', 'real gathering continues behind request browsing');
 assert.equal(await page.locator('#world').evaluate(canvas => JSON.parse(canvas.dataset.settlementSlots).find(slot => slot.buildingId === 1)?.action), 'facility-collect', 'the paid production countdown reaches ready while the character is still gathering');
 assert.equal(await page.locator('[data-order-deliver="village-order-1"]').isDisabled(), true, 'production completing does not hand out uncollected water');
 await shot('requests-during-gather'); await closeModal();
 await waitIdle('Current goal gathering with live production and browseable menus', gatheringAt); await pauseWorld();
 const gathered = await saved();
 assert.equal(gathered.stats.gathers, running.stats.gathers + 1, 'the objective launches and commits exactly one actual gathering trip');
 const elapsedSeconds = (Date.now() - gatheringAt) / 1000, clockSeconds = (gathered.totalMinutes - gatheringBefore.totalMinutes) / expectedGameMinutesPerSecond;
 assert.ok(clockSeconds >= 1 && Math.abs(clockSeconds - elapsedSeconds) < 2.5, 'the facility clock tracks real time through a chore without an extra completion jump');
 timings.push({ label: 'Natural gathering clock versus real elapsed time', elapsedSeconds, clockSeconds });
 assert.equal(gathered.settlement.stats.collections, 0, 'a mature production batch still waits for a map collection');
 assert.equal(gathered.settlement.buildings[0].readyAt, running.settlement.buildings[0].readyAt);
 assert.equal(await page.locator('#settlement-objective').getAttribute('data-quest-state'), 'ready');
 const beforeReward = await saved(); await touch(page.locator('#settlement-objective')); const rewarded = await saved();
 assert.deepEqual(rewarded.growthQuests.claimed, ['road-supplies'], 'the same compact objective claims its ready reward directly');
 assert.equal(rewarded.resources.wood, beforeReward.resources.wood + 6);
 assert.equal(rewarded.resources.scrap, beforeReward.resources.scrap + 3);
 assert.equal(rewarded.xp, beforeReward.xp + 10);
 assert.equal(await page.locator('#settlement-objective').getAttribute('data-active-quest'), 'first-carrot');
 await page.waitForTimeout(650);
 await touch(page.locator('[data-nav="home"]')); await page.waitForTimeout(950);
 const waterBefore = (await saved()).resources.water;
 await tapMap(await readyPoint(), 'ready rainwater bubble');
 const collected = await saved();
 assert.equal(collected.resources.water, waterBefore + 4, 'one map bubble tap collects the stated batch directly');
 assert.equal(collected.settlement.stats.collections, 1);
 assert.equal(collected.settlement.buildings[0].readyAt, null);
 assert.equal(await page.locator('#facility-sheet').isVisible(), false, 'map collection does not require opening a facility sheet first');
 await page.waitForTimeout(500); assert.equal((await saved()).resources.water, collected.resources.water, 'the map collection is awarded once');
 cases.push('Actual current-goal gather and direct claim; production advances while walking, inventories/requests are browseable, and one visible map bubble pays one batch.');

 await touch(page.locator('[data-open="orders"]'));
 const orderStart = await saved(), firstButton = page.locator('[data-order-deliver="village-order-1"]');
 const firstPoint = await touch(firstButton); await page.touchscreen.tap(firstPoint.x, firstPoint.y);
 let ordered = await saved();
 assert.equal(ordered.villageOrders.completed, 1, 'a rapid second physical tap cannot unintentionally fulfill a different request');
 assert.equal(ordered.resources.water, orderStart.resources.water - 3);
 assert.equal(ordered.resources.wood, orderStart.resources.wood + 8);
 assert.equal(ordered.resources.scrap, orderStart.resources.scrap + 3);
 assert.equal(ordered.xp, orderStart.xp + 12);
 await page.waitForTimeout(650);
 await exchange('village-order-2', { resources: { food: -5, wood: 10, scrap: 5 }, xp: 15 });
 ordered = await exchange('village-order-3', { resources: { wood: -12, water: -2, scrap: 8 }, xp: 20 });
 assert.equal(await page.locator('[data-order-deliver="village-order-4"]').count(), 1, 'the first recipe repeats with a new lifetime confirmation token');
 assert.equal(await page.locator('[data-order-deliver="village-order-1"]').count(), 0, 'an old first-recipe confirmation is never reused');
 await shot('repeatable-request-growth'); await closeModal();
 await page.reload(); await page.locator('#resident-name').getByText(running.name, { exact: true }).waitFor(); await pauseWorld();
 const afterReload = await saved();
 assert.equal(afterReload.villageOrders.completed, 3);
 assert.deepEqual(afterReload.resources, ordered.resources, 'reloading does not replay delivery or collection rewards');
 assert.deepEqual(afterReload.growthQuests, ordered.growthQuests);
 cases.push('Water/food/repair exchanges consume exact costs, pay exact materials and XP, resist double taps, preserve paid sequence on reload, and repeat with fresh tokens.');

 const away = productionFixture(fresh, 6); away.name = '복귀 생산 검사'; away.lastSaved = Date.now() - 6000;
 const resumed = await loadFixture(away, 'Declared6-second absence for an existing paid production batch', { offline: true });
 assert.ok(resumed.totalMinutes >= away.totalMinutes + 6 * expectedGameMinutesPerSecond && (resumed.totalMinutes - away.totalMinutes) / expectedGameMinutesPerSecond <= (resumed.lastSaved - away.lastSaved) / 1000 + 1, 'the explicit saved absence advances real seconds at the expected4-minute rate');
 assert.deepEqual(resumed.resources, away.resources, 'a completed batch after absence is not automatically collected');
 assert.equal(resumed.settlement.stats.collections, 0);
 assert.equal(resumed.villageOrders, undefined);
 const held = await saved(); await page.waitForTimeout(1500);
 assert.equal((await saved()).totalMinutes, held.totalMinutes, 'user pause freezes time after the resume step');
 await page.reload(); await page.locator('#resident-name').getByText(away.name, { exact: true }).waitFor(); await pauseWorld();
 const resumedAgain = await saved();
 assert.ok((resumedAgain.totalMinutes - resumed.totalMinutes) / expectedGameMinutesPerSecond <= (resumedAgain.lastSaved - resumed.lastSaved) / 1000 + 1, 'a second reload cannot replay the original6-second absence');
 assert.deepEqual(resumedAgain.resources, resumed.resources, 'repeat resume does not collect or deliver anything');
 await shot('offline-ready-without-free-resources');
 const cappedAway = productionFixture(fresh, 18); cappedAway.name = '빠른 마을 복귀 한도'; cappedAway.lastSaved = Date.now() - 135000;
 const capStartedAt = Date.now();
 const cappedResume = await loadFixture(cappedAway, 'Declared135-second absence; only105 real seconds /420 game minutes of catch-up are allowed', { offline: true });
 const cappedProgress = cappedResume.totalMinutes - cappedAway.totalMinutes;
 assert.ok(cappedProgress >= 105 * expectedGameMinutesPerSecond, 'the offline cap preserves420 game minutes of mature-crop/production progress');
 assert.ok(cappedProgress <= 105 * expectedGameMinutesPerSecond + (Math.ceil((Date.now() - capStartedAt) / 1000) + 1) * expectedGameMinutesPerSecond, 'a135-second saved absence is capped at105 real seconds plus actual loading time');
 assert.equal(cappedResume.settlement.stats.collections, 0, 'capped offline production still waits for an explicit collection');
 assert.deepEqual(cappedResume.resources, cappedAway.resources, 'the faster capped absence invents no resources or delivery rewards');
 cases.push('Explicit saved absence progresses at4 game minutes/second with105-second /420-minute cap; no automatic resources, repeated baseline does not replay elapsed time, and pause holds the resumed village.');
 await context.close();

 for (const [width, height, label] of [[360, 800, '360px'], [844, 390, 'landscape']]) {
  const baseline = await freshContext(width, height);
  await controlsFit(label);
  await touch(page.locator('[data-open="orders"]'));
  assert.equal(await page.locator('[data-order-deliver="village-order-1"]').isVisible(), true, `${label}: current request is usable`);
  await shot(`${label}-request`); await closeModal();
  const late = lateFixture(baseline); await loadFixture(late, `${label}: declared earned18-plot village`);
  await controlsFit(`${label}-late`);
  await touch(page.locator('[data-nav="farm"]')); await page.waitForTimeout(1100);
  assert.equal(await page.locator('#world').evaluate(canvas => JSON.parse(canvas.dataset.farmPlots).length), 18, `${label}: the farm renders all18 earned plots`);
  await touch(page.locator('[data-camera-toggle]')); await touch(page.locator('[data-map-move]'));
  const point = await page.locator('#world').evaluate(canvas => { const rect = canvas.getBoundingClientRect(), plots = JSON.parse(canvas.dataset.farmPlots), visible = plots.find(plot => { const x = rect.left + plot.x, y = rect.top + plot.y; return x > rect.left + 25 && x < rect.right - 25 && y > rect.top + 20 && y < rect.bottom - 20 && document.elementFromPoint(x, y)?.id === 'world' && document.elementFromPoint(x - 20, y - 15)?.id === 'world'; }); if (!visible) throw Error('No unobstructed farm target for real drag'); return { x: rect.left + visible.x, y: rect.top + visible.y }; });
  const initial = await geometry(), beforePan = await saved();
  await drag([point, { x: point.x - 20, y: point.y - 15 }]); await page.waitForTimeout(650);
  const moved = await geometry(); assert.ok(Math.abs(moved.dx - initial.dx + 20) < 3 && Math.abs(moved.dy - initial.dy + 15) < 3, `${label}: hand mode drags the full farm`);
  assert.deepEqual((await saved()).resources, beforePan.resources, `${label}: panning consumes no farming resources`);
  assert.deepEqual((await saved()).plots, beforePan.plots, `${label}: panning creates no accidental farm work`);
  await touch(page.locator('[data-map-reset]')); await page.waitForTimeout(800);
  assert.equal((await geometry()).mapZoom, 1); assert.equal((await geometry()).mapMoveMode, false);
  await shot(`${label}-eighteen-plots`);
  await context.close();
 }
 cases.push('360px and landscape layouts retain44px unobstructed controls, one resource button and camera flyout;18-plot farms still pan/reset without resource use.');
 assert.deepEqual(errors, []); assert.deepEqual(failedAssets, []);
 await writeFile(`artifacts/village-loop-v${version}-verification.json`, JSON.stringify({ version, status: 'passed', speedMultiplier: expectedSpeedMultiplier, gameMinutesPerSecond: expectedGameMinutesPerSecond, baseUrl, assertionsExecuted, startedAt: startedAt.toISOString(), finishedAt: new Date().toISOString(), input: 'Actual mobile touchscreen taps and CDP finger drags', clock: 'Real browser time and declared saved baseline; no fake clock or direct game calls', deviceLimit: 'Chromium mobile emulation only; not a physical Android test', fixtures, cases, timings, screenshots, errors, failedAssets }, null, 2) + '\n');
 console.log(`PASS: ${assertionsExecuted} village loop assertions; direct goals, production during chores, map collection, paid requests, resume and mobile layout.`);
} catch (error) {
 if (page && !page.isClosed()) await shot('failure').catch(() => {});
 await writeFile(`artifacts/village-loop-v${version}-verification.json`, JSON.stringify({ version, status: 'failed', speedMultiplier: expectedSpeedMultiplier, gameMinutesPerSecond: expectedGameMinutesPerSecond, baseUrl, assertionsExecuted, startedAt: startedAt.toISOString(), fixtures, cases, timings, screenshots, errors, failedAssets, failure: String(error), stack: error.stack }, null, 2) + '\n');
 throw error;
} finally { await browser.close(); }
