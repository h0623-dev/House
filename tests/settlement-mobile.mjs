import { chromium } from '@playwright/test';
import strictAssert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

// Physical browser touch coordinates and real timers. Saved ready batches are
// explicitly identified fixtures; the first waterworks cycle grows naturally.
const startedAt = new Date();
const version = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')).version;
const versionCode = JSON.parse(await readFile(new URL('../release-version.json', import.meta.url), 'utf8')).versionCode;
const baseUrl = process.env.TEST_BASE_URL || 'http://127.0.0.1:5173';
const updateUrl = process.env.TEST_UPDATE_BASE_URL;
await mkdir('artifacts', { recursive: true });
let assertionsExecuted = 0;
const assert = new Proxy(strictAssert, { get(target, key) { const value = Reflect.get(target, key); return typeof value === 'function' ? (...args) => { assertionsExecuted++; return value(...args); } : value; } });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
const errors = [], failedAssets = [], canceledImages = [], screenshots = [], timings = [], cases = [];
const successfulImages = new Set();
let page, previousEngineSave;
const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('road-haven-save-v1')));
const nav = section => page.locator(`[data-nav="${section}"]`);
const buildings = state => state.settlement?.buildings || [];
async function touch(locator) {
 if (!await locator.isVisible() && await locator.evaluate(element => Boolean(element.closest('#farm-tray')))) await touch(page.locator('[data-farm-toggle]'));
 await locator.scrollIntoViewIfNeeded();
 const box = await locator.boundingBox(); assert.ok(box, 'the touch target is rendered');
 const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
 assert.equal(await locator.evaluate((button, point) => document.elementFromPoint(point.x, point.y)?.closest('button') === button, point), true, 'the finger reaches the intended button');
 await page.touchscreen.tap(point.x, point.y);
}
async function pauseWorld() { const button = page.getByRole('button', { name: '시간 일시정지', exact: true }); if (await button.count()) await touch(button); }
async function shot(name) { const path = `artifacts/v${version}-settlement-${name}.png`; await page.screenshot({ path, fullPage: true }); screenshots.push(path); }
async function reload(state) {
 if (state) await page.evaluate(state => localStorage.setItem('settlement-qa-fixture', JSON.stringify(state)), state);
 await page.reload(); await page.locator('#resident-name').waitFor(); await pauseWorld();
 if (state) assert.equal((await saved()).name, state.name, 'the valid saved fixture loads instead of silently resetting');
}
async function context(width, height) {
 const result = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true });
 await result.addInitScript(() => { const fixture = localStorage.getItem('settlement-qa-fixture'); if (fixture) { localStorage.setItem('road-haven-save-v1', fixture); localStorage.removeItem('settlement-qa-fixture'); } });
 page = await result.newPage(); attachErrors(page); await page.goto(baseUrl); await page.waitForLoadState('networkidle');
 await touch(page.locator('[data-start]')); await pauseWorld();
 return result;
}
function attachErrors(target) {
 target.on('pageerror', error => errors.push(error.message));
 target.on('response', response => { const kind = response.request().resourceType(); if (response.status() >= 400 && ['image', 'font', 'script', 'stylesheet'].includes(kind)) failedAssets.push(`${response.status()} ${response.url()}`); if (response.ok() && kind === 'image') successfulImages.add(response.url()); });
 target.on('requestfailed', request => { if (!['image', 'font', 'script', 'stylesheet'].includes(request.resourceType())) return; const reason = request.failure()?.errorText || 'request failed'; if (request.resourceType() === 'image' && reason === 'net::ERR_ABORTED') canceledImages.push(request.url()); else failedAssets.push(`${reason} ${request.url()}`); });
}
async function geometry() { return page.locator('#world').evaluate(canvas => JSON.parse(canvas.dataset.sceneGeometry)); }
async function slots() { return page.locator('#world').evaluate(canvas => JSON.parse(canvas.dataset.settlementSlots)); }
async function tapSlot(slot, facility = false) {
 const target = await page.locator('#world').evaluate((canvas, args) => {
  const slot = JSON.parse(canvas.dataset.settlementSlots).find(slot => slot.slot === args.slot), rect = canvas.getBoundingClientRect();
  return { x: rect.left + (args.facility ? slot.facilityX : slot.x), y: rect.top + (args.facility ? slot.facilityY : slot.y) };
 }, { slot, facility });
 assert.equal(await page.evaluate(point => document.elementFromPoint(point.x, point.y)?.id === 'world', target), true, `slot ${slot} is reachable on the visible map`);
 await page.touchscreen.tap(target.x, target.y);
}
async function home() { await touch(nav('home')); await page.waitForTimeout(1100); }
async function catalog(type) { await touch(nav('build')); await touch(page.locator(`[data-build-type="${type}"]`)); await page.locator('#construction-bar').waitFor(); await page.waitForTimeout(1100); }
async function build(type, slot, wood, scrap) {
 const before = await saved(); await catalog(type); assert.equal(await page.locator('[data-construction-confirm]').isDisabled(), true);
 await tapSlot(slot); assert.deepEqual((await saved()).resources, before.resources, 'the placement preview never spends materials');
 await touch(page.locator('[data-construction-confirm]')); const after = await saved();
 assert.equal(buildings(after).length, buildings(before).length + 1); assert.equal(after.resources.wood, before.resources.wood - wood); assert.equal(after.resources.scrap, before.resources.scrap - scrap);
 assert.equal(buildings(after).at(-1).slot, slot); assert.equal(buildings(after).at(-1).type, type);
 return buildings(after).at(-1).id;
}
async function selectFacility(id) { await home(); const slot = (await slots()).find(slot => slot.buildingId === id); assert.ok(slot); await tapSlot(slot.slot, true); await page.locator(`#facility-sheet[data-facility="${id}"]`).waitFor(); }
async function move(id, slot) {
 const before = await saved(), facility = structuredClone(buildings(before).find(building => building.id === id));
 await touch(page.locator(`[data-facility-move="${id}"]`)); await page.waitForTimeout(1100); await tapSlot(slot); assert.deepEqual((await saved()).resources, before.resources);
 await touch(page.locator('[data-construction-confirm]')); const after = await saved();
 assert.deepEqual(after.resources, before.resources, 'moving never refunds or charges construction materials'); assert.deepEqual(buildings(after).find(building => building.id === id), { ...facility, slot }, 'moving preserves id, level and production timer');
}
async function chore(action) {
 const before = Date.now(); await touch(page.locator(`[data-quick="${action}"]`));
 await page.waitForFunction(() => document.querySelector('#app').getAttribute('aria-busy') === 'true', null, { timeout: 1500 });
 assert.equal(await page.locator('.chore-status').isVisible(), true);
 await page.waitForFunction(() => !document.querySelector('#app').hasAttribute('aria-busy'), null, { timeout: 30000 });
 timings.push({ name: action, elapsedMs: Date.now() - before }); assert.ok(Date.now() - before >= 2500, 'ordinary resource work uses visible real-time animation');
}
async function fit(width, height, selectors) {
 assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight + 1), true, `${width}×${height} has no main-screen overflow`);
 for (const selector of selectors) { const control = page.locator(selector), box = await control.boundingBox(); assert.ok(box && box.width >= 44 && box.height >= 44 && box.x >= 0 && box.x + box.width <= width + 1 && box.y >= 0 && box.y + box.height <= height + 1, `${selector} stays finger sized and in the viewport`); const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 }; assert.equal(await control.evaluate((button, point) => document.elementFromPoint(point.x, point.y)?.closest('button') === button, point), true, `${selector} remains physically reachable without another HUD control covering it`); }
}
function matureProduction(state) {
 const next = structuredClone(state), ready = Math.max(...buildings(next).map(building => building.readyAt || next.totalMinutes));
 next.totalMinutes = ready; next.day = Math.floor(ready / 1440) + 1; next.minutes = ready % 1440;
 return next;
}
async function claim(id, resource, amount) {
 await selectFacility(id); const before = await saved(); await touch(page.locator(`[data-facility-collect="${id}"]`)); const after = await saved();
 assert.equal(after.resources[resource], before.resources[resource] + amount); assert.equal(after.settlement.stats.collections, before.settlement.stats.collections + 1);
 assert.equal(buildings(after).find(building => building.id === id).startedAt, null); assert.equal(buildings(after).find(building => building.id === id).readyAt, null);
 assert.equal(await page.locator(`[data-facility-collect="${id}"]`).isVisible(), false, 'a claimed batch cannot be claimed again');
 await reload(); assert.deepEqual((await saved()).resources, after.resources, 'reload never duplicates a collected batch');
}

// This deliberately private browser bridge fixture verifies UI decisions only.
// It does not download an APK, apply a signed bundle or invoke Android itself.
async function updateFixture(contentOnly = false, web = false, failActivation = false, previousEngine = false) {
 const current = { version, versionCode, minimumNativeVersionCode: versionCode, apkUrl: 'https://example.invalid/private-current.apk', sha256: 'a'.repeat(64), notes: 'Private current-version QA fixture', publishedAt: '2026-10-08T00:00:00Z' };
 if (previousEngine) current.minimumNativeVersionCode = 8;
 const [major, minor] = version.split('.').map(Number), futureVersion = `${major}.${minor + 1}.0`;
 const future = { ...current, version: futureVersion, versionCode: versionCode + 1, minimumNativeVersionCode: contentOnly ? versionCode : versionCode + 1, apkUrl: 'https://example.invalid/private-future.apk', notes: 'PRIVATE QA ONLY: future release is not published' };
 const result = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
 const manifest = release => route => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(release) });
 await result.route('**/update.json*', manifest(contentOnly ? future : current));
 if (!web) await result.addInitScript(({ version, versionCode, contentVersion, contentCode, failActivation, legacy }) => {
  if (legacy) localStorage.setItem('road-haven-save-v1', JSON.stringify(legacy));
  const calls = [], listeners = {}, state = { native: { status: 'idle', progress: 0, revision: 0, message: 'Private fixture idle' }, content: { status: 'idle', progress: 0, version: contentVersion, contentVersion: contentCode, message: 'Private content fixture idle' } };
  window.__updateFixture = { calls, state, emit(plugin, value) { state[plugin === 'Updater' ? 'native' : 'content'] = value; listeners[plugin]?.(value); } };
  window.CapacitorCustomPlatform = { name: 'android' };
  window.Capacitor = {
   PluginHeaders: ['Updater', 'ContentUpdater'].map(name => ({ name, methods: (name === 'Updater' ? ['getVersion', 'getUpdateState', 'prepareUpdate', 'installUpdate', 'cancelUpdate'] : ['getState', 'check', 'activate', 'acknowledge']).map(name => ({ name, rtype: 'promise' })).concat([{ name: 'addListener', rtype: 'callback' }, { name: 'removeListener', rtype: 'promise' }]) })),
   nativeCallback(plugin, method, args, callback) { calls.push({ plugin, method, args }); if (method === 'addListener') listeners[plugin] = callback; return Promise.resolve(`private-${plugin}-listener`); },
   async nativePromise(plugin, method, args) {
    calls.push({ plugin, method, args, saved: Boolean(localStorage.getItem('road-haven-save-v1')) });
    if (plugin === 'ContentUpdater') { if (method === 'getState' || method === 'check') return state.content; if (method === 'activate') { await new Promise(resolve => setTimeout(resolve, 2800)); if (failActivation) throw Error('Private fixture activation failure'); } return {}; }
    if (method === 'getVersion') return { version, versionCode };
    if (method === 'prepareUpdate') return state.native = { status: 'downloading', progress: 0, revision: state.native.revision + 1, version: args.version, versionCode: args.versionCode, message: 'Private fixture downloading' };
    if (method === 'installUpdate') return state.native = { ...state.native, status: 'permission', revision: state.native.revision + 1, message: 'Private fixture installation permission' };
    return state.native;
   },
  };
 }, { version: previousEngine ? '0.8.0' : version, versionCode: previousEngine ? 8 : versionCode, contentVersion: version, contentCode: versionCode, failActivation, legacy: previousEngine ? previousEngineSave : null });
 page = await result.newPage(); attachErrors(page); await page.goto(updateUrl); await page.waitForLoadState('networkidle');
 const emit = (plugin, state) => page.evaluate(({ plugin, state }) => window.__updateFixture.emit(plugin, state), { plugin, state });
 if (await page.locator('[data-start]').count()) await touch(page.locator('[data-start]')); await pauseWorld();
 if (previousEngine) {
  await page.waitForFunction(() => window.__updateFixture.calls.some(call => call.plugin === 'Updater' && call.method === 'getVersion'));
  assert.equal(await page.evaluate(() => window.__updateFixture.calls.filter(call => call.method === 'prepareUpdate').length), 0, 'new content on the previous compatible native engine does not request an APK');
  assert.equal(await page.evaluate(() => window.__updateFixture.state.content.contentVersion), versionCode);
  const legacyLoaded = await saved(); assert.equal(legacyLoaded.name, previousEngineSave.name); assert.deepEqual(legacyLoaded.resources, previousEngineSave.resources); assert.deepEqual(legacyLoaded.seedInventory, previousEngineSave.seedInventory); assert.equal(legacyLoaded.xp, previousEngineSave.xp); assert.equal(legacyLoaded.level, previousEngineSave.level);
  await touch(page.locator('[data-next-goal]')); assert.equal(await page.locator('[data-quest-chapter]').count(), 0); assert.equal(await page.locator('[data-growth-quest]').count(), 1); assert.equal(await page.locator('[data-growth-history]').count(), 24); assert.equal(await page.locator('[data-growth-all-goals]').evaluate(details => details.open), false); assert.deepEqual((await saved()).resources, previousEngineSave.resources); assert.equal((await saved()).growthQuests?.claimed.length ?? 0, 0);
  cases.push(`Private loaded content${versionCode} on native engine8: minimum native8 skips APK, new quest UI renders and previous save gains no resource/XP/seed gifts`);
  await result.close(); return;
 }
 if (web) {
  await touch(nav('settings')); await touch(page.locator('[data-update]')); assert.match(await page.locator('[data-native-update-message]').innerText(), /최신/);
  await result.unroute('**/update.json*'); await result.route('**/update.json*', manifest(future));
  await touch(page.locator('[data-update]')); await page.locator('[data-download]').waitFor(); assert.equal((await page.locator('[data-native-update-message]').innerText()).includes(future.version), true); assert.equal(await page.locator('[data-install-update]').isVisible(), false);
  await shot('private-web-future-release'); await result.close(); return;
 }
 await page.waitForFunction(() => window.__updateFixture.calls.some(call => call.plugin === 'ContentUpdater' && call.method === 'acknowledge'));
 assert.equal(await page.evaluate(() => window.__updateFixture.calls.some(call => call.method === 'installUpdate')), false, 'installation never opens automatically');
 if (contentOnly) {
  await page.waitForFunction(() => window.__updateFixture.calls.some(call => call.plugin === 'Updater' && call.method === 'getVersion'));
  assert.equal(await page.evaluate(() => window.__updateFixture.calls.filter(call => call.method === 'prepareUpdate').length), 0, 'compatible content updates do not force an APK download');
  await touch(page.getByRole('button', { name: '시간 계속', exact: true }));
  if (failActivation) {
   await emit('ContentUpdater', { status: 'ready', progress: 100, contentVersion: future.versionCode, version: future.version, message: 'Private failure fixture ready' });
   await page.waitForFunction(() => window.__updateFixture.calls.some(call => call.method === 'activate'));
   assert.equal(await page.locator('#app').evaluate(app => app.inert), true); await page.locator('.content-applying-notice').waitFor();
   await page.waitForFunction(() => !document.querySelector('#app').inert, null, { timeout: 6000 });
   assert.equal(await page.locator('.content-applying-notice').isVisible(), false, 'failed content activation restores the normal screen');
   await pauseWorld(); const beforeRecovery = await saved(); await chore('gather'); assert.equal((await saved()).stats.gathers, beforeRecovery.stats.gathers + 1);
   cases.push('Private mocked delayed content activation failure unlocks the screen and ordinary resource work remains usable');
   await result.close(); return;
  }
  await touch(nav('farm')); await touch(page.locator('[data-quick="plant"]')); await touch(page.locator('[data-select-seed="potato"]')); await page.waitForTimeout(1100);
  const point = await page.locator('#world').evaluate(canvas => { const g = JSON.parse(canvas.dataset.sceneGeometry), r = canvas.getBoundingClientRect(); const u = 85, v = 78; return { x: r.left + g.dx + (480 + u * .91 - v * .67) * g.scale, y: r.top + g.dy + (420 + u * .34 + v * .47 - 112) * g.scale }; });
  await page.touchscreen.tap(point.x, point.y); await page.waitForFunction(() => document.querySelector('#app').hasAttribute('aria-busy'));
  await emit('ContentUpdater', { status: 'downloading', progress: 45, contentVersion: future.versionCode, version: future.version, message: 'Private content 45%' });
  assert.match(await page.locator('#update-badge strong').innerText(), /45%/);
  await emit('ContentUpdater', { status: 'ready', progress: 100, contentVersion: future.versionCode, version: future.version, message: 'Private content ready' });
  assert.equal(await page.evaluate(() => window.__updateFixture.calls.filter(call => call.method === 'activate').length), 0, 'content waits while the character is working');
  await page.waitForFunction(() => !document.querySelector('#app').hasAttribute('aria-busy'), null, { timeout: 14000 });
  assert.equal((await saved()).plots[2].cropId, 'potato'); assert.equal(await page.evaluate(() => window.__updateFixture.calls.filter(call => call.method === 'activate').length), 0, 'persistent farm mode also holds activation');
  await touch(nav('hunt')); assert.equal(await page.evaluate(() => window.__updateFixture.calls.filter(call => call.method === 'activate').length), 0, 'an open modal holds content activation');
  await touch(page.locator('[data-start-hunt]')); await page.locator('.battle-screen').waitFor(); assert.equal(await page.evaluate(() => window.__updateFixture.calls.filter(call => call.method === 'activate').length), 0, 'an active battle holds content activation');
  await touch(page.locator('[data-battle="retreat"]')); await touch(page.locator('[data-battle="confirm-retreat"]')); await page.locator('[data-battle="finish"]').waitFor(); assert.equal(await page.evaluate(() => window.__updateFixture.calls.filter(call => call.method === 'activate').length), 0, 'battle results hold activation until returning home');
  await touch(page.locator('[data-battle="finish"]')); await page.waitForFunction(() => window.__updateFixture.calls.some(call => call.method === 'activate'));
  assert.equal(await page.evaluate(() => window.__updateFixture.calls.filter(call => call.method === 'activate').length), 1); assert.equal(await page.evaluate(() => window.__updateFixture.calls.find(call => call.method === 'activate').saved), true, 'progress is saved before activation');
  assert.equal(await page.locator('#app').evaluate(app => app.inert), true); assert.equal(await page.locator('.content-applying-notice').isVisible(), true);
  const applyingScreenshot = `artifacts/v${version}-ui-update-applying-360.png`; await page.setViewportSize({ width: 360, height: 740 }); await page.screenshot({ path: applyingScreenshot, fullPage: true }); screenshots.push(applyingScreenshot); await page.setViewportSize({ width: 390, height: 844 });
  const lockedClock = await page.locator('#clock').innerText(), lockedSave = await saved();
  for (const selector of ['[data-nav="farm"]', '[data-nav="hunt"]', '[data-open="build"]', '[data-farm-toggle]']) { const box = await page.locator(selector).boundingBox(); assert.ok(box); await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2); }
  const lockedCanvas = await page.locator('#world').boundingBox(); await page.touchscreen.tap(lockedCanvas.x + lockedCanvas.width / 2, lockedCanvas.y + lockedCanvas.height / 2);
  await page.waitForTimeout(1600); assert.equal(await page.locator('#clock').innerText(), lockedClock, 'game time stops while asynchronous activation is pending'); assert.deepEqual((await saved()).resources, lockedSave.resources); assert.equal(await page.locator('#modal-root').isVisible(), false); assert.equal(await page.locator('.chore-status').isVisible(), false);
  await page.waitForTimeout(1600); assert.equal(await page.locator('#app').evaluate(app => app.inert), true, 'successful activation keeps input locked until Android reloads'); assert.equal(await page.evaluate(() => window.__updateFixture.calls.filter(call => call.method === 'activate').length), 1);
  cases.push('Private mocked content bridge: compatible release skips APK, progress notification, active chore, persistent tool, modal and battle block activation, idle home saves then activates exactly once');
 } else {
  await result.unroute('**/update.json*'); await result.route('**/update.json*', manifest(future));
  await touch(nav('settings')); await touch(page.locator('[data-update]')); await page.waitForFunction(() => window.__updateFixture.calls.some(call => call.method === 'prepareUpdate'));
  assert.equal(await page.evaluate(() => window.__updateFixture.calls.filter(call => call.method === 'prepareUpdate').length), 1);
  await emit('Updater', { status: 'downloading', progress: 25, revision: 2, version: future.version, versionCode: future.versionCode, message: 'Private fixture 25%' });
  assert.equal(await page.locator('[data-native-update-progress]').isVisible(), true); assert.equal(await page.locator('[data-native-update-progress] i').evaluate(element => element.style.width), '25%');
  assert.equal(await page.locator('[data-install-update]').isVisible(), false);
  await page.evaluate(() => window.__updateFixture.emit('Updater', { status: 'error', progress: 0, revision: 3, message: 'Private fixture recoverable failure' }));
  await touch(page.locator('[data-retry-native-update]')); assert.equal(await page.evaluate(() => window.__updateFixture.calls.filter(call => call.method === 'prepareUpdate').length), 2);
  await emit('Updater', { status: 'ready', progress: 100, revision: 5, version: future.version, versionCode: future.versionCode, message: 'Private fixture verified and ready' });
  await page.locator('[data-install-update]').waitFor(); await shot('private-native-install-ready');
  assert.equal(await page.evaluate(() => window.__updateFixture.calls.filter(call => call.method === 'installUpdate').length), 0);
  await touch(page.locator('[data-install-update]')); assert.equal(await page.evaluate(() => window.__updateFixture.calls.filter(call => call.method === 'installUpdate').length), 1);
  await touch(nav('settings')); assert.match(await page.locator('[data-install-update]').innerText(), /허용/);
  await page.evaluate(() => window.__updateFixture.emit('Updater', { status: 'installing', progress: 100, revision: 7, message: 'Private fixture Android confirmation' }));
  assert.equal(await page.locator('[data-install-update]').isDisabled(), true);
  await page.evaluate(() => window.__updateFixture.emit('Updater', { status: 'downloading', progress: 2, revision: 6, message: 'Private stale event' }));
  assert.equal(await page.locator('[data-install-update]').isDisabled(), true, 'older progress cannot replace the newer install state');
  cases.push('Private mocked APK bridge: current release does nothing, future release downloads automatically, progress/error/retry/ready states, explicit installation request, permission continuation and stale revision guard');
 }
 await result.close();
}

try {
 for (const width of [360, 390]) {
  const height = width === 360 ? 740 : 844, mobile = await context(width, height), fresh = await saved();
  assert.deepEqual(fresh.resources, { wood: 24, scrap: 12, food: 8, water: 16, seeds: 23 }); assert.equal(buildings(fresh).length, 0);
  assert.equal(await page.locator('#farm-tray').isVisible(), false, 'a new home emphasizes the truck settlement');
  await fit(width, height, ['[data-nav="home"]', '[data-nav="build"]', '[data-nav="farm"]', '[data-nav="hunt"]', '[data-nav="bag"]', '[data-nav="settings"]', '[data-map-zoom="1"]', '[data-map-zoom="-1"]', '[data-farm-toggle]']);
  await touch(nav('build')); assert.equal(await page.locator('[data-build-type]').count(), 6);
  const art = await page.locator('.building-card-art .facility-art').evaluateAll(async images => Promise.all(images.map(async image => { const source = image.querySelector('image').getAttribute('href'); const loaded = new Image(); loaded.src = source; await loaded.decode(); return { viewBox: image.getAttribute('viewBox'), width: loaded.naturalWidth, height: loaded.naturalHeight }; })));
  assert.equal(new Set(art.map(image => image.viewBox)).size, 6); assert.equal(art.every(image => image.width > 0 && image.height > 0), true, 'all six distinct facility graphics decode');
  await touch(page.locator('[data-build-type="workshop"]')); assert.equal(await page.locator('#construction-bar').isVisible(), false); assert.deepEqual((await saved()).resources, fresh.resources); assert.equal(buildings(await saved()).length, 0); await touch(page.locator('#modal-root [data-close]').first());
  await catalog('waterworks'); await tapSlot(2); assert.equal(await page.locator('[data-construction-confirm]').isDisabled(), true, 'a locked deck slot cannot be selected for construction'); assert.deepEqual((await saved()).resources, fresh.resources);
  await tapSlot(0); assert.deepEqual((await saved()).resources, fresh.resources); await fit(width, height, ['[data-construction-confirm]', '[data-construction-cancel]', '[data-map-zoom="1"]', '[data-map-zoom="-1"]', '[data-map-reset]', '[data-open="settlement-goals"]']); await shot(`preview-${width}`); await touch(page.locator('[data-construction-cancel]')); assert.equal(buildings(await saved()).length, 0);
  const waterworks = await build('waterworks', 1, 12, 4); assert.equal(waterworks, 1); await fit(width, height, ['[data-facility-start="1"]', '[data-facility-upgrade="1"]', '[data-facility-move="1"]', '[data-facility-close]', '[data-map-zoom="1"]', '[data-map-zoom="-1"]', '[data-map-reset]', '[data-open="settlement-goals"]']); await shot(`first-home-${width}`);
  await catalog('kitchen'); await tapSlot(1, true); assert.equal(await page.locator('[data-construction-confirm]').isDisabled(), true); assert.equal(buildings(await saved()).length, 1); await touch(page.locator('[data-construction-cancel]'));
  const insufficient = await saved(); await catalog('kitchen'); await tapSlot(0); await touch(page.locator('[data-construction-confirm]')); assert.equal(buildings(await saved()).length, 1, 'insufficient materials cannot confirm construction'); assert.deepEqual((await saved()).resources, insufficient.resources); assert.equal(await page.locator('#construction-bar').isVisible(), true); await touch(page.locator('[data-construction-cancel]'));
  await selectFacility(1); await move(1, 0); const beforeStart = await saved(); await touch(page.locator('[data-facility-start="1"]')); let state = await saved(), facility = buildings(state)[0];
  assert.deepEqual(state.resources, beforeStart.resources); assert.equal(facility.readyAt - facility.startedAt, 90); assert.equal(state.settlement.stats.productions, 1); assert.equal(await page.locator('[data-facility-start="1"]').isDisabled(), true);
  await touch(page.locator('[data-facility-start="1"]')); assert.deepEqual(buildings(await saved())[0], facility); assert.equal((await saved()).settlement.stats.productions, 1);
  await touch(page.locator('[data-facility-upgrade="1"]')); assert.equal(await page.locator('[data-upgrade-confirm]').count(), 0); assert.deepEqual((await saved()).resources, state.resources);
  await move(1, 1); await reload(); assert.deepEqual(buildings(await saved())[0], { ...facility, slot: 1 });
  if (width === 360) {
   await selectFacility(1); const cycleStart = Date.now(); await touch(page.getByRole('button', { name: '시간 계속', exact: true }));
   await page.locator('[data-facility-collect="1"]').waitFor({ state: 'visible', timeout: 55000 }); await pauseWorld();
   timings.push({ name: 'naturally-grown-waterworks-90-game-minutes', elapsedMs: Date.now() - cycleStart }); assert.ok(Date.now() - cycleStart >= 42000, 'one facility batch matures with genuine browser time');
  } else await reload(matureProduction(await saved()));
  const readyWater = (await saved()).resources.water; await reload(); state = await saved(); assert.ok(state.totalMinutes >= buildings(state)[0].readyAt); assert.equal(state.resources.water, readyWater, 'ready production is not silently awarded by loading');
  await claim(1, 'water', 4);
  if (width === 360) {
   await home(); const beforePan = await geometry(), canvas = await page.locator('#world').boundingBox(), session = await mobile.newCDPSession(page);
   const origin = { x: canvas.x + canvas.width * .4, y: canvas.y + canvas.height * .7 };
   await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [origin] }); await page.waitForTimeout(100); await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: origin.x + 42, y: origin.y - 28 }] }); await page.waitForTimeout(100); await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await session.detach(); await page.waitForTimeout(100);
   const afterPan = await geometry(); assert.ok(Math.abs(afterPan.dx - beforePan.dx) + Math.abs(afterPan.dy - beforePan.dy) > 15, 'a finger drag pans the home map');
   await touch(page.locator('[data-map-zoom="1"]')); await page.waitForTimeout(1500); assert.ok((await geometry()).mapZoom > beforePan.mapZoom); assert.ok((await geometry()).scale > beforePan.scale * 1.15, 'zoom enlarges the painted world');
   await touch(page.locator('[data-map-zoom="-1"]')); await page.waitForTimeout(1400); await home();
   await chore('gather'); await chore('chop'); const beforeExpand = await saved(), oldSlotCount = (await slots()).filter(slot => slot.unlocked).length; await shot('before-expansion');
   await touch(page.locator('[data-open="expand"]')); await touch(page.locator('#modal-root [data-action="expand"]'));
   await page.waitForFunction(() => document.querySelector('#app').hasAttribute('aria-busy'), null, { timeout: 1500 }); await page.waitForFunction(() => !document.querySelector('#app').hasAttribute('aria-busy'), null, { timeout: 30000 });
   state = await saved(); assert.equal(state.deckLevel, 2); assert.equal(state.plots.length, 4); assert.equal(state.resources.wood, beforeExpand.resources.wood - 24); assert.equal(state.resources.scrap, beforeExpand.resources.scrap - 12); await home();
   assert.equal((await slots()).filter(slot => slot.unlocked).length, oldSlotCount + 2); await shot('after-expansion');
   await chore('gather'); await chore('gather'); await home();
   const kitchen = await build('kitchen', 0, 16, 6); await touch(page.locator(`[data-facility-start="${kitchen}"]`)); const kitchenState = await saved(); assert.equal(kitchenState.resources.water, state.resources.water + 8 - 2);
   assert.equal(buildings(kitchenState).find(building => building.id === kitchen).readyAt - buildings(kitchenState).find(building => building.id === kitchen).startedAt, 120); await move(kitchen, 3);
   const workshop = await build('workshop', 2, 22, 10), beforeWorkshop = await saved(); await touch(page.locator(`[data-facility-start="${workshop}"]`)); assert.equal((await saved()).resources.wood, beforeWorkshop.resources.wood - 3);
   await reload(matureProduction(await saved())); await claim(kitchen, 'food', 5); await claim(workshop, 'scrap', 4);
   state = await saved(); state.name = '시설 개선 검사'; state.resources.wood = 100; state.resources.scrap = 100; await reload(state); await selectFacility(1); const beforeUpgrade = await saved();
   await touch(page.locator('[data-facility-upgrade="1"]')); await page.locator('[data-upgrade-confirm="1"]').waitFor(); await touch(page.locator('#modal-root [data-close]').first()); assert.deepEqual((await saved()).resources, beforeUpgrade.resources);
   await touch(page.locator('[data-facility-upgrade="1"]')); await touch(page.locator('[data-upgrade-confirm="1"]')); state = await saved(); assert.equal(buildings(state)[0].level, 2); assert.equal(state.resources.wood, beforeUpgrade.resources.wood - 24); assert.equal(state.resources.scrap, beforeUpgrade.resources.scrap - 8);
   await touch(page.locator('[data-facility-start="1"]')); await reload(matureProduction(await saved())); await claim(1, 'water', 8);
   await home(); const beforeGoals = await saved(); await touch(page.locator('[data-open="settlement-goals"]')); assert.equal(await page.locator('[data-quest-chapter]').count(), 0); assert.equal(await page.locator('[data-growth-quest]').count(), 1); assert.equal(await page.locator('[data-growth-history]').count(), 24); assert.equal(await page.locator('[data-growth-all-goals]').evaluate(details => details.open), false); assert.equal(await page.locator('[data-growth-legacy]').count(), 3); assert.deepEqual((await saved()).resources, beforeGoals.resources, 'opening the growth board and legacy records grants no reward'); await touch(page.locator('#modal-root [data-close]').first());
   cases.push('360px real-touch placement/cancel/cost once/occupied rejection, natural production, active timer-preserving relocation, normal resource gathering and animated expansion, kitchen/workshop inputs and claims, confirmed level-two upgrade and scaled yield');
  } else {
   const all = structuredClone(fresh); all.name = '여섯 시설 검사'; all.deckLevel = 3; all.stats.expansions = 2; all.plots.push({ id: 4, plantedAt: null, watered: false }, { id: 5, plantedAt: null, watered: false });
   all.settlement = { buildings: ['waterworks', 'kitchen', 'workshop', 'petHouse', 'greenhouse', 'watchtower'].map((type, index) => ({ id: index + 1, type, slot: index, level: 1, startedAt: index === 0 ? all.totalMinutes - 90 : null, readyAt: index === 0 ? all.totalMinutes : null })), nextBuildingId: 7, stats: { productions: 1, collections: 0 } };
   const dryKitchen = structuredClone(all); dryKitchen.name = '생산 재료 부족 검사'; dryKitchen.resources.water = 0; await reload(dryKitchen); await selectFacility(2); await touch(page.locator('[data-facility-start="2"]')); assert.deepEqual((await saved()).resources, dryKitchen.resources); assert.equal(buildings(await saved())[1].readyAt, null); assert.equal((await saved()).settlement.stats.productions, 1, 'missing recipe resources cannot start a batch or consume anything');
   await reload(all); await home(); assert.equal((await slots()).filter(slot => slot.unlocked).length, 6); assert.equal((await slots()).filter(slot => slot.buildingId !== null).length, 6); assert.deepEqual((await saved()).resources, all.resources, 'ready facilities do not grant a load reward'); await shot('all-six-facilities');
   for (const building of all.settlement.buildings) { await selectFacility(building.id); assert.equal(await page.locator('#facility-sheet').getAttribute('data-facility'), String(building.id)); await touch(page.locator('[data-facility-close]')); }
   const legacy = structuredClone(fresh); legacy.name = '기존 저장 검사'; delete legacy.settlement; delete legacy.growthQuests; delete legacy.stats.plantings; delete legacy.stats.waterings; previousEngineSave = structuredClone(legacy); await reload(legacy); assert.equal(buildings(await saved()).length, 0); assert.deepEqual((await saved()).resources, legacy.resources); assert.deepEqual((await saved()).plots, legacy.plots); await reload(); assert.deepEqual((await saved()).resources, legacy.resources);
   await page.setViewportSize({ width: 844, height: 390 }); await home(); await fit(844, 390, ['[data-nav="home"]', '[data-nav="build"]', '[data-farm-toggle]']); await build('kitchen', 0, 16, 6); await fit(844, 390, ['[data-facility-start="1"]', '[data-facility-move="1"]', '[data-facility-close]', '[data-map-zoom="1"]', '[data-map-zoom="-1"]', '[data-map-reset]', '[data-open="settlement-goals"]']); await shot('landscape-facility');
   cases.push('390px real-touch facility preview/build/move/start/ready/claim persistence, unchanged legacy save resources and crops, landscape facility controls');
  }
  await mobile.close();
 }
 if (updateUrl) { await updateFixture(false, true); await updateFixture(false); await updateFixture(true); await updateFixture(true, false, true); await updateFixture(false, false, false, true); }
 assert.equal(canceledImages.every(url => successfulImages.has(url)), true, 'every redundant canceled SVG image has a successful matching request');
 const verify = await browser.newContext(), imagePage = await verify.newPage(); await imagePage.goto(baseUrl);
 const decodedCanceledImages = await imagePage.evaluate(async sources => Promise.all(sources.map(async source => { const image = new Image(); image.src = source; await image.decode(); return { source, width: image.naturalWidth, height: image.naturalHeight }; })), [...new Set(canceledImages)]);
 assert.equal(decodedCanceledImages.every(image => image.width > 0 && image.height > 0), true); await verify.close(); assert.deepEqual(errors, []); assert.deepEqual(failedAssets, []);
 await writeFile(`artifacts/settlement-v${version}-verification.json`, JSON.stringify({ version, versionCode, status: 'passed', baseUrl, updateUrl: updateUrl || null, input: 'Actual mobile touchscreen coordinates and CDP home-map drag', clock: 'Real browser timers; first 90-game-minute production matured naturally; later ready-production fixtures explicitly advance saved game time', updateLimit: updateUrl ? 'Private mocked Capacitor bridge and private manifest only; no signed-bundle application, APK download or Android OS installation claimed' : 'Update fixture not provided; update bridge UI was not run', startedAt: startedAt.toISOString(), finishedAt: new Date().toISOString(), assertionsExecuted, cases, timings, screenshots, errors, failedAssets, canceledImages, decodedCanceledImages }, null, 2) + '\n');
 console.log(`PASS: ${assertionsExecuted} settlement and private-update assertions; ${timings.length} real-time sequences.`);
} catch (error) {
 if (page && !page.isClosed()) await shot('failure').catch(() => {});
 await writeFile(`artifacts/settlement-v${version}-verification.json`, JSON.stringify({ version, status: 'failed', baseUrl, updateUrl: updateUrl || null, assertionsExecuted, cases, timings, screenshots, errors, failedAssets, canceledImages, failure: String(error) }, null, 2) + '\n'); throw error;
} finally { await browser.close(); }
