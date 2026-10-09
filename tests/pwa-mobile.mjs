import { chromium, webkit } from '@playwright/test';
import strictAssert from 'node:assert/strict';
import { readFile, writeFile, mkdir, cp, rename, stat, rm, readdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

// This suite installs the shipped worker in an actual secure localhost browser.
// Future publications are declared copies of the immutable production build:
// only valid asset names/comments, index markers and generated release metadata
// change. No game methods, synthetic SW messages, clock manipulation or advanced
// saved-game fixtures make a patch appear ready or a task finish.
const root = fileURLToPath(new URL('../', import.meta.url));
const testSourceSha256 = createHash('sha256').update(await readFile(fileURLToPath(import.meta.url))).digest('hex');
const sourceUrl = process.env.TEST_BASE_URL;
if (!sourceUrl) throw Error('TEST_BASE_URL must identify the immutable production build containing sw.js and web-update.json.');
const sourceBase = new URL(sourceUrl.endsWith('/') ? sourceUrl : sourceUrl + '/');
if (sourceBase.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(sourceBase.hostname)) throw Error('PWA publication fixtures use an ordinary local HTTP secure context only.');
const version = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')).version;
const snapshotId = process.env.TEST_SNAPSHOT_ID || 'mutable-development-diagnostic';
const finalSnapshot = process.env.TEST_FINAL_SNAPSHOT === '1';
const smokeOnly = process.env.TEST_PWA_SMOKE_ONLY === '1';
if (finalSnapshot && smokeOnly) throw Error('A preliminary PWA smoke cannot be labeled final regression QA.');
const smokeComplete = Symbol('declared preliminary PWA smoke completed');
const startedAt = new Date();
let assertionsExecuted = 0;
const assert = new Proxy(strictAssert, { get(target, key) { const value = Reflect.get(target, key); return typeof value === 'function' ? (...args) => { assertionsExecuted++; return value(...args); } : value; } });
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const artifacts = path.join(root, 'artifacts');
const fixtureRoot = path.join(artifacts, `pwa-v${version}-publications`);
await mkdir(fixtureRoot, { recursive: true });
const cases = [], screenshots = [], errors = [], failedAssets = [], expectedInstallFailures = [], requests = [], navigations = [], cacheProofs = [], publications = [], welcomeLifecycle = [], saveTransactions = [], storageFailures = [], coldInstallRuns = [];
let browser, context, page, server, currentPublication, testBase, sourceManifest, sourceManifestSha256, sourceWorkerSha256, shippedWorkerPrefix, sourceFiles = [], failure, failureEvidence;
const activePages = new Set();
const portablePath = process.env.TEST_PORTABLE_PATH || path.join(artifacts, `road-haven-${version}-play.html`);
const safariUserAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

async function download(relative) {
  const response = await fetch(new URL(relative, sourceBase));
  assert.equal(response.status, 200, `immutable source ${relative} is available`);
  return Buffer.from(await response.arrayBuffer());
}
async function sourceSnapshot() {
  const manifestBytes = await download('web-update.json'); sourceManifestSha256 = digest(manifestBytes);
  sourceManifest = JSON.parse(manifestBytes);
  assert.equal(sourceManifest.schema, 1); assert.match(sourceManifest.buildId, /^[a-f0-9]{64}$/);
  assert.equal(sourceManifest.version, version); assert.equal(sourceManifest.base, sourceBase.pathname);
  assert.ok(sourceManifest.files.length >= 20);
  const directory = path.join(fixtureRoot, 'immutable-source');
  await rm(directory, { recursive: true, force: true });
  await mkdir(directory, { recursive: true });
  for (let index = 0; index < sourceManifest.files.length; index += 5) {
    await Promise.all(sourceManifest.files.slice(index, index + 5).map(async file => {
      const bytes = await download(file.path);
      assert.equal(bytes.length, file.bytes, `${file.path} immutable bytes`);
      assert.equal(digest(bytes), file.sha256, `${file.path} immutable SHA`);
      const filename = path.join(directory, file.path); await mkdir(path.dirname(filename), { recursive: true }); await writeFile(filename, bytes);
      sourceFiles.push({ path: file.path, bytes: bytes.length, sha256: digest(bytes) });
    }));
  }
  const worker = await download('sw.js'); sourceWorkerSha256 = digest(worker);
  const argument = `)(${JSON.stringify(sourceManifest)});\n`;
  assert.equal(worker.toString('utf8').endsWith(argument), true, 'the shipped worker contains exactly the immutable release manifest');
  // Vite transforms a plugin's function.toString() formatting. Preserve the
  // actual published runtime bytes, changing only its declared manifest input.
  shippedWorkerPrefix = worker.toString('utf8').slice(0, -argument.length);
  await writeFile(path.join(directory, 'sw.js'), worker);
  await writeFile(path.join(directory, 'web-update.json'), manifestBytes);
  const copiedMembers = (await readdir(directory, { recursive: true, withFileTypes: true }))
    .filter(entry => entry.isFile()).map(entry => path.relative(directory, path.join(entry.parentPath, entry.name)).split(path.sep).join('/'));
  assert.deepEqual(copiedMembers.sort(), [...sourceManifest.files.map(file => file.path), 'sw.js', 'web-update.json'].sort(), 'publication source contains exactly the shipped immutable inventory and release metadata');
  return { directory, manifest: sourceManifest, marker: 'immutable-source' };
}
async function makePublication(label, sequence, fault = null) {
  const { createPwaRelease } = await import(pathToFileURL(path.join(root, 'scripts/web-pwa-plugin.mjs')));
  const directory = path.join(fixtureRoot, label); await rm(directory, { recursive: true, force: true });
  await cp(path.join(fixtureRoot, 'immutable-source'), directory, { recursive: true });
  let html = await readFile(path.join(directory, 'index.html'), 'utf8');
  for (const extension of ['js', 'css']) {
    const asset = sourceManifest.files.find(file => new RegExp(`^assets/index-.*\\.${extension}$`).test(file.path));
    assert.ok(asset, 'the fixture changes an actual production entry asset');
    const target = `assets/index-pwa-${label}.${extension}`;
    await rename(path.join(directory, asset.path), path.join(directory, target));
    const original = await readFile(path.join(directory, target));
    await writeFile(path.join(directory, target), Buffer.concat([original, Buffer.from(`\n/* Declared valid PWA test publication ${label}. */\n`)]));
    html = html.replaceAll(asset.path, target);
  }
  html = html.replace('</head>', `<meta name="pwa-qa-publication" content="${label}"></head>`);
  await writeFile(path.join(directory, 'index.html'), html);
  const majorMinor = version.split('.').slice(0, 2).join('.');
  await createPwaRelease(directory, { version: `${majorMinor}.${sequence}`, contentVersion: sourceManifest.contentVersion + sequence, base: sourceManifest.base });
  const manifest = JSON.parse(await readFile(path.join(directory, 'web-update.json'), 'utf8'));
  await writeFile(path.join(directory, 'sw.js'), shippedWorkerPrefix + `)(${JSON.stringify(manifest)});\n`);
  const badPath = manifest.files.find(file => file.path === `assets/index-pwa-${label}.css`).path;
  const publication = { directory, manifest, marker: label, fault, badPath };
  publications.push({ label, version: manifest.version, contentVersion: manifest.contentVersion, buildId: manifest.buildId, fault, badPath: fault ? badPath : null, fixtureDescription: 'Valid immutable-build copy with renamed entry assets, harmless comments and regenerated release hashes; explicit fault applied by the HTTP server only.' });
  return publication;
}
const mime = filename => ({ '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.txt': 'text/plain' })[path.extname(filename)] || 'application/octet-stream';
async function startServer(initial) {
  currentPublication = initial;
  server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      const portable = pathname === '/portable.html';
      if (!portable && !pathname.startsWith(sourceManifest.base)) { response.writeHead(404); response.end(); return; }
      const relative = portable ? 'portable.html' : pathname.slice(sourceManifest.base.length) || 'index.html';
      if (relative.includes('..')) { response.writeHead(400); response.end(); return; }
      const publication = currentPublication;
      if (!portable && publication.fault === 'missing' && relative === publication.badPath) {
        requests.push({ publication: publication.marker, path: relative, status: 503, fault: 'missing', at: Date.now() });
        response.writeHead(503, { 'cache-control': 'no-store' }); response.end('Declared incomplete publication'); return;
      }
      let bytes = await readFile(portable ? portablePath : path.join(publication.directory, relative));
      if (!portable && publication.fault === 'tampered' && relative === publication.badPath) bytes = Buffer.concat([bytes, Buffer.from('\n/* Deliberate manifest SHA mismatch fixture. */\n')]);
      requests.push({ publication: portable ? 'portable' : publication.marker, path: relative, status: 200, bytes: bytes.length, sha256: digest(bytes), at: Date.now() });
      response.writeHead(200, { 'content-type': mime(relative), 'cache-control': 'no-store', 'service-worker-allowed': sourceManifest.base, 'x-content-type-options': 'nosniff' }); response.end(bytes);
    } catch { response.writeHead(404, { 'cache-control': 'no-store' }); response.end(); }
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  testBase = `http://127.0.0.1:${server.address().port}${sourceManifest.base}`;
}
function attach(target, label) {
  activePages.add(target); target.on('close', () => activePages.delete(target));
  target.on('pageerror', error => errors.push({ label, message: error.message }));
  target.on('framenavigated', frame => { if (frame === target.mainFrame()) navigations.push({ label, url: frame.url(), at: Date.now() }); });
  target.on('response', response => {
    if (response.status() >= 400 && ['document', 'script', 'stylesheet', 'image', 'font'].includes(response.request().resourceType())) failedAssets.push({ label, status: response.status(), url: response.url() });
  });
}
async function touch(locator, target = page) {
  await locator.scrollIntoViewIfNeeded(); const box = await locator.boundingBox();
  assert.ok(box && box.width >= 1 && box.height >= 1);
  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  assert.equal(await locator.evaluate((button, point) => document.elementFromPoint(point.x, point.y)?.closest('button') === button, point), true, 'a physical finger reaches the rendered control');
  await target.touchscreen.tap(point.x, point.y);
}
async function tapElement(locator, target = page) {
  await locator.scrollIntoViewIfNeeded(); const box = await locator.boundingBox(); assert.ok(box);
  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  assert.equal(await locator.evaluate((element, point) => element.contains(document.elementFromPoint(point.x, point.y)), point), true);
  await target.touchscreen.tap(point.x, point.y);
}
async function settings(target = page) {
  if (await target.locator('#modal-root').isVisible()) await touch(target.locator('#modal-root [data-close]').first(), target);
  await touch(target.locator('[data-open="menu"]'), target); await touch(target.locator('#modal-root [data-open="settings"]'), target);
}
async function monitorProtocol(target, label) {
  const setup = label => {
    if (window.__pwaProtocolRecorder) return; window.__pwaProtocolRecorder = true;
    const key = 'pwa-qa-protocol-log', original = Storage.prototype.setItem;
    const record = value => {
      const list = JSON.parse(sessionStorage.getItem(key) || '[]');
      list.push({ label, at: Date.now(), boot: performance.timeOrigin, ...value }); original.call(sessionStorage, key, JSON.stringify(list));
    };
    Storage.prototype.setItem = function(key, value) {
      const result = original.call(this, key, value);
      if (this === localStorage && key === 'road-haven-save-v1') {
        const state = JSON.parse(value); record({ type: 'save', state });
      }
      return result;
    };
    navigator.serviceWorker.addEventListener('message', event => {
      const data = event.data;
      if (data && ['WEB_UPDATE_PREPARE', 'WEB_UPDATE_FINALIZE', 'WEB_UPDATE_COMMIT', 'WEB_UPDATE_ABORT'].includes(data.type)) record({ type: data.type, token: data.token, buildId: data.buildId, workerState: event.source?.state });
    });
    const postMessage = ServiceWorker.prototype.postMessage;
    ServiceWorker.prototype.postMessage = function(...args) {
      const data = args[0];
      if (data && ['WEB_UPDATE_ACTIVATE', 'WEB_UPDATE_VOTE', 'WEB_UPDATE_FINALIZED'].includes(data.type)) record({ type: 'out:' + data.type, token: data.token, buildId: data.buildId, saved: data.saved, ready: data.ready, workerState: this.state });
      return postMessage.apply(this, args);
    };
  };
  await target.addInitScript(setup, label); await target.evaluate(setup, label);
}
const protocolLog = target => target.evaluate(() => JSON.parse(sessionStorage.getItem('pwa-qa-protocol-log') || '[]'));
const saved = (target = page) => target.evaluate(() => JSON.parse(localStorage.getItem('road-haven-save-v1')));
const diagnostics = (target = page) => target.locator('#app').evaluate(app => JSON.parse(app.dataset.webUpdateDiagnostics));
const boot = (target = page) => target.evaluate(() => performance.timeOrigin);
async function shot(label, target = page) {
  const filename = `artifacts/v${version}-pwa-${label}.png`;
  await target.evaluate(async () => {
    const finite = document.getAnimations().filter(animation => animation.effect?.getTiming().iterations !== Infinity);
    await Promise.allSettled(finite.map(animation => animation.finished));
  });
  await target.screenshot({ path: path.join(root, filename), fullPage: true }); screenshots.push(filename);
}
async function home(target = page) { await touch(target.locator('[data-nav="home"]'), target); }
async function begin(target = page, name = '아이폰 우리집') {
  await target.locator('[data-start]').waitFor();
  assert.ok(await target.locator('#player-name').evaluate(input => parseFloat(getComputedStyle(input).fontSize) >= 16), 'the shipped name field uses at least 16px for iPhone focus');
  await target.locator('#player-name').fill(name); await touch(target.locator('[data-start]'), target);
  await target.locator('#resident-name').getByText(name, { exact: true }).waitFor();
}
async function waitControlled(target = page, expected = sourceManifest.buildId) {
  await target.waitForFunction(expected => {
    const raw = document.querySelector('#app')?.dataset.webUpdateDiagnostics;
    if (!raw) return false; const info = JSON.parse(raw);
    return info.supported && info.controllerBuildId === expected && navigator.serviceWorker.controller
      && !document.querySelector('#app').inert && !document.querySelector('[data-startup-patch]')
      && document.querySelector('#world')?.dataset.sceneGeometry;
  }, expected, { timeout: 25000 });
  const info = await diagnostics(target); assert.equal(info.registeredScope, testBase); return info;
}
async function checkRelease(target = page) {
  // The browser's standard updater downloads and evaluates the real worker.
  // Its lifecycle and the application's own safety/persistence code decide apply.
  await target.evaluate(async () => { const registration = await navigator.serviceWorker.getRegistration(); if (!registration) throw Error('No real worker registration'); await registration.update(); });
}
async function waitReady(publication, target = page) {
  await target.waitForFunction(buildId => {
    const info = JSON.parse(document.querySelector('#app')?.dataset.webUpdateDiagnostics || '{}');
    return info.waitingBuildId === buildId && info.state?.status === 'ready';
  }, publication.manifest.buildId, { timeout: 30000 });
}
async function waitApplied(publication, previousBoot, target = page) {
  await target.waitForFunction(({ buildId, previousBoot }) => {
    const info = JSON.parse(document.querySelector('#app')?.dataset.webUpdateDiagnostics || '{}');
    return performance.timeOrigin !== previousBoot && info.controllerBuildId === buildId && !info.applying
      && !document.querySelector('#app').inert && !document.querySelector('[data-startup-patch]')
      && document.querySelector('#world')?.dataset.sceneGeometry;
  }, { buildId: publication.manifest.buildId, previousBoot }, { timeout: 30000 });
  assert.equal(await target.locator('meta[name="pwa-qa-publication"]').getAttribute('content'), publication.marker, 'the new index is actually loaded from the activated publication');
}
async function waitUntil(predicate, message, timeout = 30000) {
  const started = Date.now();
  while (!predicate()) { if (Date.now() - started > timeout) throw Error(message); await new Promise(resolve => setTimeout(resolve, 80)); }
}
async function cacheProof(publication, target = page) {
  const proof = await target.evaluate(async manifest => {
    const names = await caches.keys(), name = names.find(name => name.endsWith(manifest.buildId));
    if (!name) return { names, files: [] };
    const cache = await caches.open(name), files = [];
    for (const file of manifest.files) {
      const response = await cache.match(new URL(file.path, location.href));
      if (!response) { files.push({ path: file.path, missing: true }); continue; }
      const bytes = await response.arrayBuffer(), hash = await crypto.subtle.digest('SHA-256', bytes);
      files.push({ path: file.path, bytes: bytes.byteLength, sha256: Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('') });
    }
    const marker = await cache.match(new URL('.road-haven-complete', location.href));
    return { names, name, files, complete: marker ? await marker.json() : null };
  }, publication.manifest);
  assert.equal(proof.files.length, publication.manifest.files.length);
  for (const file of proof.files) { const expected = publication.manifest.files.find(item => item.path === file.path); assert.equal(file.missing, undefined); assert.equal(file.bytes, expected.bytes); assert.equal(file.sha256, expected.sha256); }
  assert.equal(proof.complete?.buildId, publication.manifest.buildId);
  assert.equal(proof.complete.downloadedBytes + proof.complete.reusedBytes, publication.manifest.files.reduce((total, file) => total + file.bytes, 0), 'verified cache accounting covers every release byte');
  if (publication.marker !== 'immutable-source') assert.ok(proof.complete.reusedBytes > proof.complete.downloadedBytes, 'unchanged heavy artwork is verified and reused while only new content downloads');
  cacheProofs.push({ publication: publication.marker, ...proof }); return proof;
}
function sameProgress(actual, expected) {
  for (const key of ['name', 'gender', 'level', 'deckLevel', 'health', 'energy', 'resources', 'plots', 'stats', 'xp', 'companions', 'animalReserve', 'companionTeam', 'settlement', 'seedInventory']) assert.deepEqual(actual[key], expected[key], `automatic patch preserves ${key}`);
  assert.ok(actual.totalMinutes >= expected.totalMinutes, 'a patch never resets earned village time while real clocks continue');
}

try {
  const initial = await sourceSnapshot(); await startServer(initial);
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  context = await browser.newContext({ viewport: { width: 390, height: 664 }, isMobile: true, hasTouch: true, userAgent: safariUserAgent });
  page = await context.newPage(); attach(page, 'primary'); page.setDefaultTimeout(15000);
  page.on('console', message => { const text = message.text(); if (text.startsWith('PWA_WELCOME_LIFECYCLE ')) welcomeLifecycle.push(JSON.parse(text.slice('PWA_WELCOME_LIFECYCLE '.length))); });
  await page.addInitScript(() => {
    const report = type => { if (!location.hostname) return; console.log('PWA_WELCOME_LIFECYCLE ' + JSON.stringify({ type, visibility: document.visibilityState, saveExists: localStorage.getItem('road-haven-save-v1') !== null, at: Date.now() })); };
    window.addEventListener('pagehide', () => report('pagehide')); window.addEventListener('pageshow', () => report('pageshow'));
    document.addEventListener('visibilitychange', () => report('visibilitychange'));
  });
  await page.goto(testBase); const firstBoot = await boot();
  const welcomeInstall = page.locator('[data-pwa-welcome-install]'); await welcomeInstall.waitFor();
  assert.equal(await saved(), null, 'the welcome screen has not silently confirmed or saved a new player');
  assert.equal(await page.locator('#modal-root [data-close]').first().isVisible(), false, 'new players cannot dismiss onboarding with the close button');
  await page.keyboard.press('Escape'); assert.equal(await page.locator('[data-start]').isVisible(), true);
  assert.equal(await page.evaluate(() => Boolean(document.elementFromPoint(4, 4)?.closest('.modal-backdrop'))), true);
  await page.touchscreen.tap(4, 4); assert.equal(await page.locator('[data-start]').isVisible(), true);
  assert.equal(await saved(), null, 'Escape and a real backdrop touch cannot start an unconfirmed village');
  await tapElement(welcomeInstall.locator('summary'));
  assert.equal(await welcomeInstall.evaluate(element => element.open), true);
  assert.match(await welcomeInstall.innerText(), /Safari[\s\S]*공유[\s\S]*홈 화면에 추가/);
  assert.equal(await saved(), null, 'reading installation instructions does not create a game save');
  await page.waitForFunction(() => navigator.serviceWorker.getRegistration().then(registration => registration?.active?.state === 'activated'), null, { timeout: 30000 });
  assert.equal(await boot(), firstBoot, 'first installation never restarts the active onboarding/village document');
  assert.equal(await page.evaluate(() => navigator.serviceWorker.controller), null, 'first installation preserves the already running document until its next visit');
  await page.goto('about:blank');
  const welcomeOrigin = (await context.storageState()).origins.find(origin => origin.origin === new URL(testBase).origin);
  assert.ok(!welcomeOrigin?.localStorage.some(item => item.name === 'road-haven-save-v1'), 'genuine pagehide before confirmation leaves the main save absent');
  await page.goto(testBase); await welcomeInstall.waitFor();
  assert.equal(await saved(), null, 'returning to the installed game still requires the user to confirm their name');
  assert.ok(welcomeLifecycle.some(event => event.type === 'pagehide' && event.saveExists === false));
  await begin(); assert.equal((await saved()).name, '아이폰 우리집'); await waitControlled();
  cases.push('real welcome pagehide/return and installation help keep the main save absent until the player confirms their name');
  assert.equal(await page.evaluate(() => isSecureContext), true);
  assert.equal(await page.locator('meta[name="viewport"]').getAttribute('content').then(value => value.includes('viewport-fit=cover')), true);
  const manifestLink = await page.locator('link[rel="manifest"]').getAttribute('href');
  const pwaManifest = await page.evaluate(async href => await (await fetch(href)).json(), manifestLink);
  const scope = new URL(pwaManifest.scope, testBase), start = new URL(pwaManifest.start_url, testBase);
  assert.equal(scope.pathname, sourceManifest.base); assert.ok(start.pathname.startsWith(scope.pathname));
  assert.equal(pwaManifest.display, 'standalone'); assert.ok(pwaManifest.icons.length >= 1);
  assert.equal(await page.locator('meta[name="apple-mobile-web-app-capable"]').getAttribute('content'), 'yes');
  assert.ok(await page.locator('link[rel="apple-touch-icon"]').count());
  assert.ok(await page.locator('meta[name="apple-mobile-web-app-title"]').getAttribute('content'));
  for (const icon of pwaManifest.icons) {
    const iconUrl = new URL(icon.src, new URL(manifestLink, testBase));
    assert.equal(iconUrl.origin, new URL(testBase).origin); assert.ok(iconUrl.pathname.startsWith(sourceManifest.base));
    const bytes = await readFile(path.join(initial.directory, iconUrl.pathname.slice(sourceManifest.base.length)));
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'install icons are actual PNG files');
    assert.equal(icon.sizes, `${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`, 'install icon metadata agrees with real image dimensions');
  }
  const stylesheets = await Promise.all(sourceManifest.files.filter(file => file.path.endsWith('.css')).map(file => readFile(path.join(initial.directory, file.path), 'utf8')));
  for (const side of ['top', 'bottom', 'left', 'right']) assert.ok(stylesheets.some(css => css.includes(`env(safe-area-inset-${side}`)), `shipped CSS accounts for the iPhone ${side} safe area`);
  assert.equal(await page.locator('#player-name').isVisible(), false, 'the welcome name field closes after confirmation');
  assert.equal(await page.locator('#modal-root').isVisible(), false, 'the fresh named village is playable');
  await settings();
  assert.equal(await page.locator('#modal-root [data-download]').count(), 0, 'iPhone web installation never sends the player to an Android APK');
  await touch(page.locator('#modal-root [data-open="install"]'));
  const install = page.locator('[data-pwa-install]');
  assert.equal(await install.getAttribute('data-pwa-ios'), 'true'); assert.equal(await install.getAttribute('data-pwa-standalone'), 'false');
  assert.match(await install.innerText(), /Safari[\s\S]*공유[\s\S]*홈 화면에 추가/);
  await shot('00-safari-install-instructions'); await touch(page.locator('#modal-root [data-close]').first());
  for (const [width, height] of [[390, 664], [390, 844], [320, 568], [844, 390]]) {
    await page.setViewportSize({ width, height }); await page.waitForTimeout(140);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${width}×${height} has no horizontal overflow`);
    for (const selector of ['[data-nav="home"]', '[data-open="menu"]', '[data-nav="hunt"]']) {
      const box = await page.locator(selector).boundingBox(); assert.ok(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= width + 1 && box.y + box.height <= height + 1, `${selector} fits the iPhone viewport`);
      assert.ok(box.width >= 44 && box.height >= 44, 'navigation remains finger-sized');
    }
  }
  await page.setViewportSize({ width: 390, height: 844 }); await shot('01-installed-home');
  await cacheProof(initial); cases.push('actual worker install/control, manifest/iPhone metadata and four mobile viewport checks');
  for (let attempt = 1; attempt <= 3; attempt++) {
    const coldContext = await browser.newContext({ viewport: { width: 390, height: 664 }, isMobile: true, hasTouch: true, userAgent: safariUserAgent });
    try {
      const cold = await coldContext.newPage(); attach(cold, `cold-install-${attempt}`);
      await cold.goto(testBase); const originalBoot = await boot(cold);
      await cold.locator('[data-pwa-welcome-install]').waitFor();
      await cold.waitForFunction(() => navigator.serviceWorker.getRegistration().then(registration => registration?.active?.state === 'activated'), null, { timeout: 30000 });
      assert.equal(await boot(cold), originalBoot, 'a complete first installation cannot leave startup waiting for a same-build reload');
      assert.equal(await cold.locator('[data-startup-patch]').count(), 0);
      assert.equal(await cold.locator('#app').evaluate(app => app.inert), false);
      assert.equal(await cold.evaluate(() => navigator.serviceWorker.controller), null);
      assert.equal(await saved(cold), null);
      coldInstallRuns.push({ attempt, diagnostics: await diagnostics(cold), save: null, startupUnblocked: true, documentUnchanged: true });
    } finally { await coldContext.close(); }
  }
  cases.push('three additional isolated cold installations finish without a spurious same-build activation or startup lock');
  const offlineBefore = await saved(), offlineBoot = await boot();
  await context.setOffline(true); await page.reload({ waitUntil: 'domcontentloaded' }); await page.locator('#resident-name').getByText(offlineBefore.name, { exact: true }).waitFor(); await waitControlled();
  assert.notEqual(await boot(), offlineBoot); sameProgress(await saved(), offlineBefore); await shot('02-real-offline-reload');
  await context.setOffline(false); cases.push('fully reloaded cached village and save survive real browser offline mode');

  await monitorProtocol(page, 'primary');
  const farmPatch = await makePublication('farm-update', 1), farmBefore = await saved();
  await touch(page.locator('[data-nav="farm"]')); await touch(page.locator('[data-quick="water"]'));
  await page.waitForFunction(() => document.querySelector('#planting-toolbar')?.hidden === false && document.querySelector('#app')?.getAttribute('aria-busy') === 'true');
  const farmBoot = await boot(); currentPublication = farmPatch; await checkRelease(); await waitReady(farmPatch);
  assert.equal(await boot(), farmBoot, 'a ready patch does not restart the ongoing farming session');
  assert.equal(await page.locator('#planting-toolbar').isVisible(), true);
  await page.waitForTimeout(650); assert.equal(await boot(), farmBoot);
  await page.waitForFunction(() => !document.querySelector('#app')?.hasAttribute('aria-busy'), null, { timeout: 15000 });
  const farmDone = await saved(); assert.ok((farmDone.stats.waterings ?? 0) > (farmBefore.stats.waterings ?? 0)); assert.ok(farmDone.resources.water < farmBefore.resources.water);
  await shot('03-ready-patch-waits-for-farming'); await home(); await waitApplied(farmPatch, farmBoot);
  sameProgress(await saved(), farmDone); await cacheProof(farmPatch); await shot('04-farm-save-after-auto-apply');
  saveTransactions.push({ scenario: 'farming', publication: farmPatch.marker, protocol: await protocolLog(page), savedWork: farmDone, savedAfterPatch: await saved() });
  cases.push('actual farming holds a downloaded patch until home, then automatic reload preserves its completed work');
  console.log('PWA real installation, offline complete reload and first safe automatic farming patch passed.');
  if (smokeOnly) {
    for (const sequence of [2, 3]) {
      const repeated = await makePublication(`smoke-home-update-${sequence}`, sequence), priorBoot = await boot(), priorSave = await saved();
      currentPublication = repeated; await checkRelease(); await waitApplied(repeated, priorBoot);
      sameProgress(await saved(), priorSave); await cacheProof(repeated);
      saveTransactions.push({ scenario: 'sequential-safe-home', publication: repeated.marker, protocol: await protocolLog(page), savedBeforePatch: priorSave, savedAfterPatch: await saved() });
    }
    cases.push('two further real sequential safe-home publications activate and reload without an extendable-event lifetime deadlock');
    console.log('PWA three sequential actual automatic activations passed.');
    throw smokeComplete;
  }

  const battlePatch = await makePublication('battle-update', 2);
  await touch(page.locator('[data-nav="hunt"]')); const battleBefore = await saved(); await touch(page.locator('[data-start-hunt]'));
  await page.locator('.battle-screen').waitFor(); const battleBoot = await boot();
  await touch(page.locator('[data-battle="auto"]')); currentPublication = battlePatch; await checkRelease(); await waitReady(battlePatch);
  assert.equal(await boot(), battleBoot, 'a ready patch does not restart a live animal battle');
  assert.equal(await page.locator('.battle-screen').isVisible(), true); await shot('05-ready-patch-waits-for-battle');
  await page.waitForFunction(() => document.querySelector('.battle-screen')?.dataset.battleOutcome === 'victory', null, { timeout: 60000 });
  await page.waitForTimeout(350); assert.equal(await boot(), battleBoot, 'victory results remain interactive before returning home');
  await touch(page.locator('[data-battle="finish"]')); await waitApplied(battlePatch, battleBoot);
  const battleDone = await saved(); assert.equal(battleDone.expedition, null); assert.equal(battleDone.health, battleBefore.health);
  assert.equal(battleDone.stats.battlesWon, battleBefore.stats.battlesWon + 1);
  assert.equal(battleDone.companions.dog.xp, battleBefore.companions.dog.xp + 20); assert.equal(battleDone.companions.cat.xp, battleBefore.companions.cat.xp + 20);
  assert.equal(battleDone.resources.food, battleBefore.resources.food + 8); assert.equal(battleDone.resources.wood, battleBefore.resources.wood + 2); assert.equal(battleDone.resources.scrap, battleBefore.resources.scrap + 2);
  await cacheProof(battlePatch); await shot('06-battle-rewards-survive-auto-apply');
  cases.push('natural three-wave animal victory and saved rewards/XP finish before a ready automatic patch applies');

  for (const [label, sequence, fault] of [['missing-release', 3, 'missing'], ['tampered-release', 4, 'tampered']]) {
    const broken = await makePublication(label, sequence, fault), priorBoot = await boot(); currentPublication = broken;
    await checkRelease();
    await waitUntil(() => requests.some(request => request.publication === label && request.path === broken.badPath), 'The worker did not request the intentionally failed candidate asset');
    await page.waitForFunction(() => navigator.serviceWorker.getRegistration().then(registration => !registration.installing && !registration.waiting), null, { timeout: 30000 });
    assert.ok(requests.some(request => request.publication === label && request.path === broken.badPath), 'the real worker actually fetches the declared bad asset');
    assert.equal(await boot(), priorBoot); assert.equal((await diagnostics()).controllerBuildId, battlePatch.manifest.buildId);
    const names = await page.evaluate(() => caches.keys()); assert.ok(!names.some(name => name.endsWith(broken.manifest.buildId)), 'an incomplete or corrupt candidate cache never becomes a saved release');
    expectedInstallFailures.push({ label, fault, activeBuildId: battlePatch.manifest.buildId, candidateBuildId: broken.manifest.buildId, noReload: true });
    await context.setOffline(true); await page.reload({ waitUntil: 'domcontentloaded' }); await waitControlled(page, battlePatch.manifest.buildId);
    assert.equal(await page.locator('meta[name="pwa-qa-publication"]').getAttribute('content'), battlePatch.marker); sameProgress(await saved(), battleDone);
    await context.setOffline(false); cases.push(`${fault} publication fails atomically and the prior complete version still boots offline`);
  }

  currentPublication = battlePatch;
  const second = await context.newPage(); attach(second, 'second-tab'); await second.goto(testBase); await waitControlled(second, battlePatch.manifest.buildId);
  const secondMemory = await saved(second); await monitorProtocol(page, 'first'); await monitorProtocol(second, 'second');
  await touch(second.locator('[data-nav="farm"]'), second); await touch(second.locator('[data-quick="plant"]'), second); await touch(second.locator('[data-select-seed="carrot"]'), second);
  assert.equal(await second.locator('#planting-toolbar').isVisible(), true);
  await touch(page.locator('[data-open="character"]')); await page.locator('#player-name').fill('첫 탭의 새 마을'); await touch(page.locator('[data-start]'));
  await touch(page.locator('[data-nav="farm"]')); await touch(page.locator('[data-quick="gather"]'));
  await page.waitForFunction(() => document.querySelector('#app')?.getAttribute('aria-busy') === 'true');
  await page.waitForFunction(() => !document.querySelector('#app')?.hasAttribute('aria-busy'), null, { timeout: 30000 });
  await home(); const firstMemory = await saved();
  assert.notEqual(firstMemory.name, secondMemory.name); assert.equal(firstMemory.stats.gathers, secondMemory.stats.gathers + 1);
  assert.equal(firstMemory.resources.wood, secondMemory.resources.wood + 10, 'the two real tabs contain genuinely different earned village progress');
  assert.ok((await second.locator('#resident-name').innerText()).includes(secondMemory.name), 'the peer still displays its older in-memory village');
  const multiFirstBoot = await boot(), secondBoot = await boot(second), multi = await makePublication('two-tab-update', 5); currentPublication = multi;
  await checkRelease(); await waitReady(multi); await waitReady(multi, second); await page.waitForTimeout(650);
  assert.equal(await boot(), multiFirstBoot); assert.equal(await boot(second), secondBoot, 'one unsafe client holds activation for both actual tabs');
  await shot('07-two-tabs-safe-vote-hold', second); await home(second);
  await waitApplied(multi, multiFirstBoot); await waitApplied(multi, secondBoot, second);
  const firstLog = await protocolLog(page), secondLog = await protocolLog(second);
  const commit = firstLog.filter(event => event.type === 'WEB_UPDATE_COMMIT').at(-1); assert.ok(commit);
  assert.ok(secondLog.some(event => event.type === 'WEB_UPDATE_COMMIT' && event.token === commit.token));
  const firstFinalized = firstLog.some(event => event.type === 'WEB_UPDATE_FINALIZE' && event.token === commit.token);
  const secondFinalized = secondLog.some(event => event.type === 'WEB_UPDATE_FINALIZE' && event.token === commit.token);
  assert.notEqual(firstFinalized, secondFinalized, 'one actual initiator performs the canonical final save');
  const canonical = firstFinalized ? firstMemory : secondMemory;
  sameProgress(await saved(), canonical); sameProgress(await saved(second), canonical);
  const peerLog = firstFinalized ? secondLog : firstLog;
  const preparedIndex = peerLog.findIndex(event => event.type === 'WEB_UPDATE_PREPARE' && event.token === commit.token);
  const committedIndex = peerLog.findIndex(event => event.type === 'WEB_UPDATE_COMMIT' && event.token === commit.token);
  assert.ok(preparedIndex >= 0 && committedIndex > preparedIndex);
  assert.equal(peerLog.slice(preparedIndex + 1, committedIndex).filter(event => event.type === 'save').length, 0, 'a frozen peer cannot overwrite canonical storage during activation');
  saveTransactions.push({ token: commit.token, initiator: firstFinalized ? 'first' : 'second', firstMemory, secondMemory, firstLog, secondLog, canonicalSave: await saved() });
  await cacheProof(multi); await second.close();
  cases.push('two genuinely different live villages hold an unsafe peer, then one final initiator save survives a coordinated patch without stale peer writes');

  const saveFailurePatch = await makePublication('final-save-failure', 6), beforeFailure = await saved(), failureBoot = await boot();
  await touch(page.locator('[data-nav="farm"]')); await touch(page.locator('[data-quick="plant"]'));
  if (await page.locator('[data-select-seed="carrot"]').isVisible()) await touch(page.locator('[data-select-seed="carrot"]'));
  currentPublication = saveFailurePatch; await checkRelease(); await waitReady(saveFailurePatch);
  await page.evaluate(() => {
    window.__pwaStorageFailure = { original: Storage.prototype.setItem, failedWrites: [], armed: true };
    Storage.prototype.setItem = function(key, value) {
      const info = JSON.parse(document.querySelector('#app')?.dataset.webUpdateDiagnostics || '{}');
      if (this === localStorage && key === 'road-haven-save-v1' && window.__pwaStorageFailure.armed && info.applying) {
        window.__pwaStorageFailure.failedWrites.push({ at: Date.now(), applying: true, attemptedState: JSON.parse(value) });
        throw new DOMException('Declared final-save storage quota failure', 'QuotaExceededError');
      }
      return window.__pwaStorageFailure.original.call(this, key, value);
    };
  });
  await home();
  await page.waitForFunction(() => window.__pwaStorageFailure.failedWrites.length > 0 && !JSON.parse(document.querySelector('#app').dataset.webUpdateDiagnostics).applying, null, { timeout: 15000 });
  assert.equal(await boot(), failureBoot); assert.equal((await diagnostics()).controllerBuildId, multi.manifest.buildId);
  assert.equal(await page.locator('#app').evaluate(app => app.inert), false, 'an aborted final save releases the current village controls');
  sameProgress(await saved(), beforeFailure);
  const failureLog = await protocolLog(page); assert.ok(failureLog.some(event => event.type === 'WEB_UPDATE_FINALIZE' && event.buildId === saveFailurePatch.manifest.buildId));
  assert.ok(failureLog.some(event => event.type === 'WEB_UPDATE_ABORT' && event.buildId === saveFailurePatch.manifest.buildId));
  storageFailures.push({ publication: saveFailurePatch.marker, failedWrites: await page.evaluate(() => window.__pwaStorageFailure.failedWrites), protocol: failureLog, retainedSave: await saved(), activeBuildId: multi.manifest.buildId, noReload: true });
  await shot('10-final-save-failure-keeps-old-game');
  await page.evaluate(() => { window.__pwaStorageFailure.armed = false; Storage.prototype.setItem = window.__pwaStorageFailure.original; });
  await waitApplied(saveFailurePatch, failureBoot); sameProgress(await saved(), beforeFailure); await cacheProof(saveFailurePatch);
  cases.push('a genuine final-save quota failure aborts a fully downloaded patch and keeps its canonical save; restoring storage lets the safe automatic retry succeed');

  for (const platform of ['ios', 'android']) {
    const nativeContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await nativeContext.addInitScript(({ platform, version, contentVersion }) => {
      window.__pwaRegistrationCalls = [];
      const register = ServiceWorkerContainer.prototype.register;
      ServiceWorkerContainer.prototype.register = function(...args) { window.__pwaRegistrationCalls.push(args.map(String)); return register.apply(this, args); };
      window.CapacitorCustomPlatform = { name: platform };
      if (platform === 'android') {
        window.Capacitor = {
          PluginHeaders: ['Updater', 'ContentUpdater'].map(name => ({ name, methods: (name === 'Updater' ? ['getVersion', 'getUpdateState', 'prepareUpdate', 'installUpdate', 'cancelUpdate'] : ['getState', 'check', 'activate', 'acknowledge']).map(name => ({ name, rtype: 'promise' })).concat([{ name: 'addListener', rtype: 'callback' }, { name: 'removeListener', rtype: 'promise' }]) })),
          nativeCallback() { return Promise.resolve('pwa-exclusion-private-listener'); },
          async nativePromise(plugin, method) {
            if (plugin === 'Updater' && method === 'getVersion') return { version, versionCode: contentVersion };
            return { status: 'idle', progress: 0, revision: 0, version, contentVersion, message: 'Declared native-platform SW exclusion fixture' };
          },
        };
      }
    }, { platform, version, contentVersion: sourceManifest.contentVersion });
    const nativePage = await nativeContext.newPage(); attach(nativePage, `native-${platform}-private-platform-fixture`); await nativePage.goto(testBase); await nativePage.locator('[data-start]').waitFor();
    assert.deepEqual(await nativePage.evaluate(() => window.__pwaRegistrationCalls), []);
    assert.equal(await nativePage.evaluate(() => navigator.serviceWorker.getRegistrations().then(registrations => registrations.length)), 0);
    await nativeContext.close();
  }
  cases.push('declared iOS and Android native-platform fixtures never register the web worker');

  const installedContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: safariUserAgent });
  await installedContext.addInitScript(() => Object.defineProperty(navigator, 'standalone', { configurable: true, value: true }));
  const installedPage = await installedContext.newPage(); attach(installedPage, 'declared-ios-standalone-branch');
  await installedPage.goto(testBase); await installedPage.locator('[data-start]').waitFor();
  assert.equal(await installedPage.locator('[data-pwa-welcome-install]').count(), 0, 'the installed-app branch hides welcome installation instructions');
  await begin(installedPage, '홈 화면 우리집'); await settings(installedPage);
  assert.equal(await installedPage.locator('#modal-root [data-open="install"]').count(), 0, 'the installed-app branch hides redundant installation settings');
  await installedPage.waitForFunction(() => navigator.serviceWorker.getRegistration().then(registration => registration?.active?.state === 'activated'), null, { timeout: 30000 });
  await shot('09-ios-standalone-branch', installedPage); await installedContext.close();
  cases.push('an explicitly declared navigator.standalone branch hides redundant Safari installation UI');

  await stat(portablePath);
  const portableContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await portableContext.addInitScript(() => {
    window.__pwaRegistrationCalls = []; const register = ServiceWorkerContainer.prototype.register;
    ServiceWorkerContainer.prototype.register = function(...args) { window.__pwaRegistrationCalls.push(args.map(String)); return register.apply(this, args); };
  });
  const portablePage = await portableContext.newPage(); attach(portablePage, 'portable-http'); const portableRequests = [];
  portablePage.on('request', request => { if (request.url() !== `http://127.0.0.1:${server.address().port}/portable.html` && !request.url().startsWith('data:') && !request.url().startsWith('blob:')) portableRequests.push(request.url()); });
  await portablePage.goto(`http://127.0.0.1:${server.address().port}/portable.html`); await begin(portablePage, '휴대용 우리집'); await portablePage.waitForTimeout(500);
  assert.deepEqual(await portablePage.evaluate(() => window.__pwaRegistrationCalls), []); assert.deepEqual(portableRequests, []);
  assert.equal(await portablePage.evaluate(() => navigator.serviceWorker.getRegistrations().then(registrations => registrations.length)), 0);
  await shot('08-portable-http-no-web-worker', portablePage); await portableContext.close();
  cases.push('the actual self-contained portable HTML served over HTTP has no SW registration or external assets');
  assert.deepEqual(errors, []); assert.deepEqual(failedAssets, []);
} catch (error) {
  if (error !== smokeComplete) {
    failure = error.stack || String(error);
    if (page && !page.isClosed()) {
      try {
        failureEvidence = await page.evaluate(async () => {
          const registration = await navigator.serviceWorker.getRegistration();
          const app = document.querySelector('#app');
          return {
            url: location.href, secure: isSecureContext, boot: performance.timeOrigin,
            renderedBuildId: document.querySelector('meta[name="road-haven-build"]')?.content,
            diagnostics: JSON.parse(app?.dataset.webUpdateDiagnostics || 'null'),
            appInert: app?.inert, startupPhase: document.querySelector('[data-startup-patch]')?.dataset.patchPhase,
            welcomeVisible: Boolean(document.querySelector('[data-start]')?.getClientRects().length),
            controllerState: navigator.serviceWorker.controller?.state,
            protocol: JSON.parse(sessionStorage.getItem('pwa-qa-protocol-log') || '[]'),
            registration: registration ? {
              scope: registration.scope, installing: registration.installing?.state,
              waiting: registration.waiting?.state, active: registration.active?.state,
            } : null,
          };
        });
      } catch {}
      try { await shot('failure'); } catch {}
    }
  }
} finally {
  if (browser) await browser.close();
  if (server) await new Promise(resolve => server.close(resolve));
  let webkitInstalled = false; try { await stat(webkit.executablePath()); webkitInstalled = true; } catch {}
  const receipt = {
    version, status: failure ? 'failed' : smokeOnly ? 'partial' : 'passed', smokeOnly, snapshotId, finalSnapshot, testSourceSha256, baseUrl: sourceUrl, fixtureOrigin: testBase,
    startedAt: startedAt.toISOString(), completedAt: new Date().toISOString(), assertionsExecuted,
    immutableSourceManifestSha256: sourceManifestSha256, immutableSourceWorkerSha256: sourceWorkerSha256,
    fixtureWorkerRuntimePrefixSha256: shippedWorkerPrefix ? digest(shippedWorkerPrefix) : undefined,
    immutableSourceBuildId: sourceManifest?.buildId, sourceFiles,
    cases, screenshots, publications, cacheProofs, expectedInstallFailures, requests, navigations, welcomeLifecycle, saveTransactions, storageFailures, coldInstallRuns, errors, failedAssets,
    realServiceWorkerLifecycleTested: !failure, browserClockManipulated: false, advancedSaveFixturesUsed: false,
    viewports: ['390×664', '390×844', '320×568', '844×390'], browserEngine: 'Chromium',
    safariUserAgentIsOnlyABranchFixture: true, standaloneIsOnlyANavigatorBranchFixture: true,
    nativePlatformFixtures: ['ios', 'android'], webkitInstalled, physicalIPhoneTested: false, physicalSafariInstallTested: false, fileOriginTested: false,
    ...(failure ? { failure, failureEvidence } : {}),
  };
  const filename = path.join(artifacts, `pwa-v${version}${smokeOnly ? '-smoke' : ''}-verification.json`); await writeFile(filename, JSON.stringify(receipt, null, 2) + '\n');
  console.log(JSON.stringify({ status: receipt.status, assertionsExecuted, cases: cases.length, publications: publications.length, cacheProofs: cacheProofs.length, screenshots: screenshots.length, errors, failedAssets, failure, receipt: filename }));
  if (failure) process.exitCode = 1;
}
