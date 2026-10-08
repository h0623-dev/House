import { chromium } from '@playwright/test';
import strictAssert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

// The native bridge and release manifest below are private browser fixtures.
// They exercise the shipped startup integration, real timers and actual touches;
// they do not claim Android installation or signed native bundle application.
const startedAt = new Date();
const version = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')).version;
const versionCode = JSON.parse(await readFile(new URL('../release-version.json', import.meta.url), 'utf8')).versionCode;
const baseUrl = process.env.TEST_BASE_URL || 'http://127.0.0.1:5173';
const nativeUrl = process.env.TEST_UPDATE_BASE_URL;
if (!nativeUrl) throw Error('TEST_UPDATE_BASE_URL must point to the final build with its native update manifest configured.');
await mkdir('artifacts', { recursive: true });
let assertionsExecuted = 0;
const assert = new Proxy(strictAssert, { get(target, key) { const value = Reflect.get(target, key); return typeof value === 'function' ? (...args) => { assertionsExecuted++; return value(...args); } : value; } });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
const cases = [], timings = [], screenshots = [], errors = [], failedAssets = [], canceledImages = [], navigations = [];
const successfulImages = new Set();
let page, originalSave;
const stableSave = value => { const result = structuredClone(value); if (result) delete result.lastSaved; return result; };
const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('road-haven-save-v1')));
const bridgeCalls = () => page.evaluate(() => window.__startupFixture.calls);
const callsFor = async method => (await bridgeCalls()).filter(call => call.method === method);
async function shot(name) { const path = `artifacts/v${version}-startup-${name}.png`; await page.screenshot({ path, fullPage: true }); screenshots.push(path); }
function attachErrors(target) {
 target.on('framenavigated', frame => { if (frame === target.mainFrame()) navigations.push({ url: frame.url(), at: new Date().toISOString() }); });
 target.on('pageerror', error => errors.push(error.message));
 target.on('response', response => {
  const kind = response.request().resourceType();
  if (response.status() >= 400 && ['image', 'font', 'script', 'stylesheet'].includes(kind)) failedAssets.push(`${response.status()} ${response.url()}`);
  if (response.ok() && kind === 'image') successfulImages.add(response.url());
 });
 target.on('requestfailed', request => {
  if (!['image', 'font', 'script', 'stylesheet'].includes(request.resourceType())) return;
  const reason = request.failure()?.errorText || 'request failed';
  if (request.resourceType() === 'image' && reason === 'net::ERR_ABORTED') canceledImages.push(request.url());
  else failedAssets.push(`${reason} ${request.url()}`);
 });
}
async function touch(locator) {
 await locator.scrollIntoViewIfNeeded(); const box = await locator.boundingBox();
 assert.ok(box && box.width > 0 && box.height > 0, 'the touch target is rendered');
 const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
 assert.equal(await locator.evaluate((button, point) => document.elementFromPoint(point.x, point.y)?.closest('button') === button, point), true, 'the real finger reaches the requested button');
 await page.touchscreen.tap(point.x, point.y);
}
async function pauseWorld() { const button = page.getByRole('button', { name: '시간 일시정지', exact: true }); if (await button.count()) await touch(button); }
async function beginGame() { await page.locator('[data-start]').waitFor(); await touch(page.locator('[data-start]')); await pauseWorld(); }
async function waitPlayable() {
 await page.waitForFunction(() => !document.querySelector('[data-startup-patch]') && document.querySelector('#world')?.dataset.sceneGeometry && !document.querySelector('#app')?.inert, null, { timeout: 10000 });
}
async function assertBeforeGame() {
 assert.equal(await page.locator('[data-start]').count(), 0, 'character selection never appears beneath the startup patch');
 assert.equal(await page.locator('#app').evaluate(app => app.inert), true, 'startup blocks gameplay input');
 assert.equal(await page.locator('.chore-status').isVisible(), false, 'startup has no active character work behind the patch');
 assert.equal(await page.locator('[data-patch-continue]').isVisible(), false, 'applying cannot be bypassed');
}
async function noApk() {
 assert.equal((await callsFor('prepareUpdate')).length, 0, 'compatible content never downloads an APK');
 assert.equal((await callsFor('installUpdate')).length, 0, 'compatible content never opens an Android installer');
}
async function fixture(mode, { existing = false, width = 390, height = 844, storageFailure = false } = {}) {
 const context = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true });
 await context.route('**/update.json*', route => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ version, versionCode, minimumNativeVersionCode: 8, apkUrl: 'https://example.invalid/private-never-downloaded.apk', sha256: 'a'.repeat(64), notes: 'Private browser fixture only', publishedAt: '2026-10-08T00:00:00Z' }) }));
 await context.addInitScript(({ mode, existingSave, version, versionCode, storageFailure }) => {
  const saveKey = 'road-haven-save-v1', marker = 'startup-private-applied', callsKey = 'startup-private-calls';
  if (existingSave && !sessionStorage.getItem('startup-private-seeded')) {
   localStorage.setItem(saveKey, JSON.stringify(existingSave));
   localStorage.setItem('road-haven-selected-seed-v1', 'potato');
   sessionStorage.setItem('startup-private-seeded', 'true');
  }
  if (storageFailure) {
   const set = Storage.prototype.setItem;
   Storage.prototype.setItem = function(key, value) { if (this === localStorage && key === saveKey) throw new DOMException('Private full-storage fixture', 'QuotaExceededError'); return set.call(this, key, value); };
  }
  const applied = sessionStorage.getItem(marker) === 'true';
  const calls = JSON.parse(sessionStorage.getItem(callsKey) || '[]'), listeners = {};
  let activeMode = applied ? 'current' : mode;
  let content = { status: activeMode === 'cached' || activeMode === 'activation-error' ? 'ready' : 'idle', progress: activeMode === 'cached' || activeMode === 'activation-error' ? 100 : 0, contentVersion: ['current', 'cached', 'activation-error'].includes(activeMode) ? versionCode : versionCode - 1, version, message: 'Private startup bridge fixture' };
  const native = { status: 'idle', progress: 0, revision: 0, message: 'Private native idle' };
  function record(plugin, method, args) { calls.push({ plugin, method, args, at: Date.now(), boot: performance.timeOrigin, save: localStorage.getItem(saveKey) }); sessionStorage.setItem(callsKey, JSON.stringify(calls)); }
  function emit(value) { content = { ...content, ...value }; listeners.ContentUpdater?.(content); return content; }
  window.__startupFixture = {
   calls, emit, get content() { return content; },
   reconnect() { activeMode = 'download'; window.dispatchEvent(new Event('online')); },
   ready() { emit({ status: 'ready', progress: 100, contentVersion: versionCode }); },
  };
  window.CapacitorCustomPlatform = { name: 'android' };
  window.Capacitor = {
   PluginHeaders: ['Updater', 'ContentUpdater'].map(name => ({ name, methods: (name === 'Updater' ? ['getVersion', 'getUpdateState', 'prepareUpdate', 'installUpdate', 'cancelUpdate'] : ['getState', 'check', 'activate', 'acknowledge']).map(name => ({ name, rtype: 'promise' })).concat([{ name: 'addListener', rtype: 'callback' }, { name: 'removeListener', rtype: 'promise' }]) })),
   nativeCallback(plugin, method, args, callback) { record(plugin, method, args); if (method === 'addListener') listeners[plugin] = callback; return Promise.resolve(`startup-${plugin}-listener`); },
   async nativePromise(plugin, method, args) {
    record(plugin, method, args);
    if (plugin === 'Updater') { if (method === 'getVersion') return { version: '0.8.0', versionCode: 8 }; return native; }
    if (method === 'getState') { await new Promise(resolve => setTimeout(resolve, 60)); return content; }
    if (method === 'check') {
     if (activeMode === 'offline') throw Error('Private network-unavailable fixture');
     if (activeMode === 'download' || activeMode === 'slow' || activeMode === 'stale-ready') {
      emit({ status: 'checking', progress: 0 });
      setTimeout(() => emit({ status: 'downloading', progress: 43 }), 350);
      if (activeMode !== 'slow') {
       setTimeout(() => emit({ status: 'downloading', progress: 98 }), 1100);
       // The ordinary Android worker resolves check only after processing the
       // manifest/archive; progress arrives through listener callbacks meanwhile.
       return await new Promise(resolve => setTimeout(() => {
        const ready = emit({ status: 'ready', progress: 100, contentVersion: versionCode });
        // Native callbacks and an earlier busy snapshot can cross in the bridge.
        resolve(activeMode === 'stale-ready' ? { ...ready, status: 'downloading', progress: 70 } : ready);
       }, 1600));
      }
      // An already-running Android worker may return its current snapshot.
      return content;
     }
     return content;
    }
    if (method === 'activate') {
     await new Promise(resolve => setTimeout(resolve, 1300));
     if (activeMode === 'activation-error') throw Error('Private rejected activation fixture');
     sessionStorage.setItem(marker, 'true');
     return {};
    }
    return {};
   },
  };
 }, { mode, existingSave: existing ? originalSave : null, version, versionCode, storageFailure });
 page = await context.newPage(); attachErrors(page); await page.goto(nativeUrl);
 return context;
}
async function record(name) { await noApk(); cases.push(name); }

try {
 // A legitimate save produced through the actual welcome UI, not injected stats.
 const web = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
 page = await web.newPage(); attachErrors(page); await page.goto(baseUrl); await beginGame(); originalSave = await saved();
 assert.ok(originalSave); assert.equal(await page.locator('[data-startup-patch]').count(), 0, 'web launch remains immediately playable');
 await web.close();

 let context = await fixture('current');
 await waitPlayable(); assert.equal(await saved(), null, 'current-version launch does not create a save before character choice');
 await beginGame(); assert.deepEqual(stableSave(await saved()), stableSave(originalSave));
 await record('Current content on native8 opens character creation, then actual touch starts the game without APK activity'); await context.close();

 context = await fixture('download', { existing: true, width: 360, height: 740 });
 await page.locator('[data-patch-phase="downloading"]').waitFor();
 const startupClock = await page.locator('#clock').innerText();
 assert.equal(await page.locator('[data-patch-progress]').getAttribute('aria-valuenow'), '43');
 assert.deepEqual(stableSave(await saved()), stableSave(originalSave), 'checking/downloading cannot advance game time or alter the existing village');
 await assertBeforeGame(); await shot('download-360');
 await page.locator('[data-patch-phase="verifying"]').waitFor();
 await page.locator('[data-patch-phase="applying"]').waitFor(); await assertBeforeGame();
 await page.waitForTimeout(1700); assert.equal((await callsFor('activate')).length, 1);
 assert.equal(await page.locator('#clock').innerText(), startupClock, 'game time remains frozen throughout download and accepted activation');
 assert.deepEqual(stableSave(await saved()), stableSave(originalSave));
 assert.equal(await page.evaluate(() => localStorage.getItem('road-haven-selected-seed-v1')), 'potato');
 assert.equal(await page.locator('#app').evaluate(app => app.inert), true, 'accepted native activation remains locked until the native reload');
 await noApk(); await shot('applying-360');
 // The bridge cannot replace an Android bundle. This manual reload represents
 // the verified native reload boundary and checks subsequent normal boot only.
 await page.reload(); await waitPlayable(); await pauseWorld();
 assert.equal(await page.locator('[data-start]').count(), 0, 'an existing village bypasses new-player welcome after the simulated native reload');
 assert.deepEqual(stableSave(await saved()), stableSave(originalSave));
 assert.equal((await callsFor('activate')).length, 1); assert.ok((await callsFor('acknowledge')).length >= 2, 'both browser boots acknowledge content through the native bridge');
 await record('Real-time download and verification UI, exactly-once pre-play activation, untouched village and selected seed, manual second-boot boundary, compatible native8 has no APK activity'); await context.close();

 context = await fixture('stale-ready', { existing: true });
 await page.locator('[data-patch-phase="applying"]').waitFor({ timeout: 4000 });
 await page.waitForTimeout(1500); assert.equal((await callsFor('activate')).length, 1, 'a ready event supersedes an older downloading check response');
 assert.equal(await page.locator('#app').evaluate(app => app.inert), true);
 assert.deepEqual(stableSave(await saved()), stableSave(originalSave));
 await record('Native ready completion crossing an older busy snapshot activates once immediately, preserving the saved village without waiting for fallback'); await context.close();

 context = await fixture('cached');
 await page.locator('[data-patch-phase="applying"]').waitFor(); await assertBeforeGame();
 assert.equal(await saved(), null, 'first-launch patch never saves the default character');
 await page.evaluate(() => { window.dispatchEvent(new PageTransitionEvent('pagehide')); Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
 assert.equal(await saved(), null, 'backgrounding or pagehide during first-launch patch cannot persist an unchosen default character');
 assert.equal((await callsFor('check')).length, 0, 'a previously downloaded verified update applies before another network check');
 await page.waitForTimeout(1500); assert.equal((await callsFor('activate')).length, 1); assert.equal(await saved(), null);
 await page.reload(); await waitPlayable(); assert.equal(await saved(), null); await page.locator('[data-start]').waitFor();
 await touch(page.locator('[data-gender="male"]')); await page.locator('#player-name').fill('새 마을 여행자'); await beginGame();
 assert.equal((await saved()).gender, 'male'); assert.equal((await saved()).name, '새 마을 여행자');
 await record('Cached verified content applies before first welcome; simulated native reload preserves the actual new-player name and gender choice'); await context.close();

 context = await fixture('offline', { existing: true });
 await waitPlayable(); await pauseWorld(); assert.deepEqual(stableSave(await saved()), stableSave(originalSave));
 assert.equal((await callsFor('activate')).length, 0); await touch(page.locator('[data-nav="settings"]'));
 // Once offline fallback opens the village, real game time may advance before
 // the finger reaches pause. Save that legitimate paused state through the UI
 // and use it as the exact baseline for the subsequent background patch.
 await touch(page.locator('[data-save]')); const beforeReconnectSave = await saved(), reconnectClock = await page.locator('#clock').innerText();
 assert.ok(beforeReconnectSave.totalMinutes >= originalSave.totalMinutes);
 assert.deepEqual(stableSave(beforeReconnectSave), stableSave({ ...originalSave, minutes: beforeReconnectSave.minutes, totalMinutes: beforeReconnectSave.totalMinutes }), 'offline fallback changes no inventory, rewards, quests or village state before a player action');
 const beforeReconnect = (await callsFor('check')).length;
 await page.evaluate(() => window.__startupFixture.reconnect());
 await page.waitForFunction(before => window.__startupFixture.calls.filter(call => call.method === 'check').length > before, beforeReconnect);
 await page.waitForFunction(() => window.__startupFixture.content.status === 'ready');
 assert.equal((await callsFor('activate')).length, 0, 'a reconnected download does not interrupt an open game dialog');
 await touch(page.locator('#modal-root [data-close]').first());
 await page.waitForFunction(() => window.__startupFixture.calls.some(call => call.method === 'activate'));
 assert.equal((await callsFor('activate')).length, 1); assert.deepEqual(stableSave(await saved()), stableSave(beforeReconnectSave)); assert.equal(await page.locator('#clock').innerText(), reconnectClock, 'the paused village remains frozen during its reconnected patch');
 await record('Private network failure permits saved-game play; online event retries automatically and activation waits until the open dialog closes'); await context.close();

 context = await fixture('slow', { existing: true, width: 360, height: 740 });
 const slowStart = Date.now(); await page.locator('[data-patch-phase="downloading"]').waitFor();
 assert.equal(await page.locator('[data-patch-continue]').isVisible(), false);
 await page.locator('[data-patch-continue]').waitFor({ state: 'visible', timeout: 16000 });
 const elapsedMs = Date.now() - slowStart; timings.push({ name: 'real slow-connection continue delay', elapsedMs }); assert.ok(elapsedMs >= 10500, 'the slow-connection escape is tested with real browser time');
 const continueBox = await page.locator('[data-patch-continue]').boundingBox(); assert.ok(continueBox.width >= 44 && continueBox.height >= 44, 'the patch continue action is finger sized');
 assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight + 1), true, 'patch UI fits a small phone');
 await shot('slow-network-360'); await touch(page.locator('[data-patch-continue]')); await waitPlayable(); await pauseWorld();
 assert.deepEqual(stableSave(await saved()), stableSave(originalSave)); assert.equal((await callsFor('activate')).length, 0);
 await touch(page.locator('[data-nav="settings"]')); await page.evaluate(() => window.__startupFixture.ready()); await page.waitForTimeout(700);
 assert.equal((await callsFor('activate')).length, 0); await touch(page.locator('#modal-root [data-close]').first());
 await page.waitForFunction(() => window.__startupFixture.calls.some(call => call.method === 'activate'));
 assert.equal((await callsFor('activate')).length, 1); await record('A genuinely slow startup offers a finger-sized continue control; the pending compatible patch still waits for safe gameplay after continuing'); await context.close();

 context = await fixture('activation-error', { existing: true });
 await page.locator('[data-patch-phase="applying"]').waitFor(); await waitPlayable(); await pauseWorld();
 await page.waitForTimeout(1700); assert.equal((await callsFor('activate')).length, 1, 'failed activation cannot become an immediate restart loop');
 assert.deepEqual(stableSave(await saved()), stableSave(originalSave));
 await touch(page.locator('[data-nav="farm"]')); await touch(page.locator('[data-quick="gather"]'));
 await page.waitForFunction(() => document.querySelector('#app').hasAttribute('aria-busy'));
 await page.waitForFunction(() => !document.querySelector('#app').hasAttribute('aria-busy'), null, { timeout: 10000 });
 assert.equal((await saved()).stats.gathers, originalSave.stats.gathers + 1, 'ordinary animated work remains usable after startup activation failure');
 await record('A rejected startup activation restores the existing game without an immediate retry loop; actual animated gathering persists normally'); await context.close();

 context = await fixture('cached', { existing: true, storageFailure: true });
 await waitPlayable(); await pauseWorld(); assert.equal((await callsFor('activate')).length, 0, 'a failed save prevents update activation');
 assert.deepEqual(stableSave(await saved()), stableSave(originalSave), 'storage failure cannot damage the original save');
 await record('Private full-storage fixture prevents activation and leaves the original village available'); await context.close();

 assert.equal(canceledImages.every(url => successfulImages.has(url)), true, 'redundant canceled SVG image requests have a successful matching request');
 assert.deepEqual(errors, []); assert.deepEqual(failedAssets, []);
 await writeFile(`artifacts/startup-patch-v${version}-verification.json`, JSON.stringify({ version, versionCode, status: 'passed', baseUrl, nativeUrl, startedAt: startedAt.toISOString(), finishedAt: new Date().toISOString(), assertionsExecuted, input: 'Real mobile touchscreen coordinates and real browser timers', nativeBoundary: 'Private Capacitor bridge and manifest fixture; manual reload models the native reload boundary. No actual APK download, signed archive application or Android device execution claimed.', cases, timings, screenshots, errors, failedAssets, canceledImages, navigations }, null, 2) + '\n');
 console.log(`PASS: ${assertionsExecuted} startup patch assertions; ${cases.length} private bridge cases.`);
} catch (error) {
 if (page && !page.isClosed()) await shot('failure').catch(() => {});
 const bridgeTrace = page && !page.isClosed() ? await page.evaluate(() => window.__startupFixture?.calls.map(({ plugin, method, at, boot }) => ({ plugin, method, at, boot }))).catch(() => undefined) : undefined;
 await writeFile(`artifacts/startup-patch-v${version}-verification.json`, JSON.stringify({ version, status: 'failed', baseUrl, nativeUrl, assertionsExecuted, cases, timings, screenshots, errors, failedAssets, navigations, bridgeTrace, failure: String(error) }, null, 2) + '\n');
 throw error;
} finally { await browser.close(); }
