import { chromium } from '@playwright/test';
import strictAssert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

// Real mobile taps and browser time. Declared production fixtures avoid a full
// 15-second batch; observation only reads UI text and never advances the clock.
const version = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')).version;
const baseUrl = process.env.TEST_BASE_URL || 'http://127.0.0.1:5173';
const startedAt = new Date();
await mkdir('artifacts', { recursive: true });
let assertionsExecuted = 0;
const assert = new Proxy(strictAssert, { get(target, key) { const value = Reflect.get(target, key); return typeof value === 'function' ? (...args) => { assertionsExecuted++; return value(...args); } : value; } });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
const errors = [], failedAssets = [], screenshots = [], cases = [], countdowns = [], fixtures = [];
let page, context;
const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('road-haven-save-v1')));
const status = () => page.locator('[data-production-status]').innerText();
async function touch(control) {
 if (!await control.isVisible() && await control.evaluate(element => Boolean(element.closest('#farm-tray')))) await touch(page.locator('[data-farm-toggle]'));
 await control.scrollIntoViewIfNeeded(); const box = await control.boundingBox(); assert.ok(box, 'the touch target is rendered');
 const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
 assert.equal(await control.evaluate((button, point) => document.elementFromPoint(point.x, point.y)?.closest('button') === button, point), true, 'a real finger reaches the intended control');
 await page.touchscreen.tap(point.x, point.y);
}
async function setPaused(paused) {
 if ((await page.locator('.time-button').getAttribute('aria-label') === '시간 계속') === paused) return;
 await closeModal();
 await touch(page.locator('[data-open="menu"]'));
 await touch(page.locator('#modal-root [data-open="settings"]'));
 await touch(page.locator('#modal-root [data-pause]'));
 await touch(page.locator('#modal-root [data-save]'));
 await closeModal();
}
async function pauseWorld() { await setPaused(true); }
async function resumeWorld() { await setPaused(false); }
async function shot(name) { await page.waitForTimeout(250); const path = `artifacts/v${version}-time-display-${name}.png`; await page.screenshot({ path, fullPage: true }); screenshots.push(path); }
async function closeModal() { if (await page.locator('#modal-root').isVisible()) await touch(page.locator('#modal-root [data-close]').first()); }
async function loadFixture(state, label) {
 fixtures.push({ label, gameMinutesRemaining: state.settlement.buildings[0].readyAt - state.totalMinutes });
 await page.evaluate(state => localStorage.setItem('time-display-qa-fixture', JSON.stringify(state)), state); await page.reload();
 await page.locator('#resident-name').getByText(state.name, { exact: true }).waitFor(); await pauseWorld();
 const loaded = await saved();
 for (const key of ['resources', 'plots', 'settlement', 'growthQuests', 'facilityHistory', 'stats', 'energy', 'xp', 'companions']) assert.deepEqual(loaded[key], state[key], `${label}: loading preserves ${key}`);
}
function productionFixture(fresh, remaining) {
 const state = structuredClone(fresh);
 state.name = '초 단위 시간 검사'; state.health = 80; state.lastSaved = 0;
 // Healing now belongs to the two animal allies. This declared saved injury
 // keeps the real recovery cooldown test available without injuring a farmer.
 state.companions = { dog: { health: 80, xp: 0 }, cat: { health: 80, xp: 0 } };
 state.stats.gathers = 1; state.stats.harvests = 1; state.xp = 45; state.level = 1;
 state.growthQuests = { claimed: ['road-supplies', 'first-carrot', 'rainwater-home'] };
 state.facilityHistory = { builtTypes: ['waterworks'], upgradedFacilityIds: [] };
 state.settlement = { buildings: [{ id: 1, type: 'waterworks', slot: 0, level: 1, startedAt: state.totalMinutes + remaining - 90, readyAt: state.totalMinutes + remaining }], nextBuildingId: 2, stats: { productions: 1, collections: 0 } };
 return state;
}
async function openFacility() {
 await touch(page.locator('[data-nav="home"]')); await page.waitForTimeout(900);
 const point = await page.locator('#world').evaluate(canvas => { const slot = JSON.parse(canvas.dataset.settlementSlots).find(slot => slot.buildingId === 1), rect = canvas.getBoundingClientRect(); return { x: rect.left + slot.facilityX, y: rect.top + slot.facilityY }; });
 assert.equal(await page.evaluate(point => document.elementFromPoint(point.x, point.y)?.id === 'world', point), true, 'the facility is physically reachable on the map');
 await page.touchscreen.tap(point.x, point.y); await page.locator('#facility-sheet[data-facility="1"]').waitFor();
}
async function observeCountdown() {
 await page.evaluate(() => {
  const target = document.querySelector('[data-production-status]');
  window.__timeDisplaySamples = [{ text: target.textContent, at: performance.now() }];
  window.__timeDisplayObserver = new MutationObserver(() => { const text = target.textContent; if (text !== window.__timeDisplaySamples.at(-1).text) window.__timeDisplaySamples.push({ text, at: performance.now() }); });
  window.__timeDisplayObserver.observe(target, { childList: true, subtree: true, characterData: true });
 });
}
async function stopObservation() { return page.evaluate(() => { window.__timeDisplayObserver.disconnect(); return window.__timeDisplaySamples; }); }
try {
 context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
 await context.addInitScript(() => { const fixture = localStorage.getItem('time-display-qa-fixture'); if (fixture) { localStorage.setItem('road-haven-save-v1', fixture); localStorage.removeItem('time-display-qa-fixture'); } });
 page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
 page.on('response', response => { if (response.status() >= 400 && ['image', 'font', 'script', 'stylesheet'].includes(response.request().resourceType())) failedAssets.push(`${response.status()} ${response.url()}`); });
 await page.goto(baseUrl); await touch(page.locator('[data-start]')); await pauseWorld(); const fresh = await saved();

 await touch(page.locator('[data-nav="build"]'));
 for (const [type, seconds] of [['waterworks', 15], ['kitchen', 20], ['workshop', 25], ['petHouse', 20], ['greenhouse', 40], ['watchtower', 30]]) {
  const card = page.locator(`[data-build-type="${type}"]`); await card.scrollIntoViewIfNeeded();
  assert.equal((await card.locator('.building-output small').innerText()).trim(), `· ${seconds}초`, `${type} shows actual active-play seconds`);
 }
 assert.doesNotMatch(await page.locator('#modal-root').innerText(), /\d+\s*분/, 'the catalog has no game-minute waiting labels');
 await shot('catalog-seconds'); await closeModal();
 await touch(page.locator('[data-nav="farm"]')); await touch(page.locator('[data-quick="plant"]'));
 for (const [crop, seconds] of [['carrot', 30], ['potato', 40], ['tomato', 45], ['corn', 50], ['strawberry', 60], ['pumpkin', 70]]) {
  const card = page.locator(`[data-select-seed="${crop}"]`); await card.scrollIntoViewIfNeeded();
  assert.equal(await card.locator('small').innerText(), `성장 ${seconds}초`, `${crop} growth is shown in real active-play seconds`);
 }
 const seedCopy = await page.locator('#modal-root').innerText(); assert.doesNotMatch(seedCopy, /\d+\s*분/); assert.match(seedCopy, /물.{0,16}(?:준|주)/, 'seed timing explains the watering condition');
 await shot('seed-growth-seconds'); await closeModal();
 cases.push('All six facility durations15/20/25/20/40/30초 and watered seed growth durations30/40/45/50/60/70초 appear at3× gameplay pace.');

 const existing = productionFixture(fresh, 76); await loadFixture(existing, 'Declared valid old-schema production with76 game-minutes left'); await openFacility();
 const before = await saved(), remainingAtPause = existing.settlement.buildings[0].readyAt - before.totalMinutes;
 assert.ok(remainingAtPause > 58 && remainingAtPause <= 76, 'only actual loading and settings navigation may consume active village time');
 const secondsAtPause = Math.ceil(remainingAtPause / 6), pausedLabel = `생산 중 · ${secondsAtPause}초 남음`;
 assert.equal(await status(), pausedLabel, 'the unchanged old completion boundary displays actual remaining game-minutes divided by6, rounded up');
 await page.waitForTimeout(2300); assert.equal(await status(), pausedLabel, 'pausing freezes the countdown'); assert.deepEqual(await saved(), before, 'pausing does not secretly advance or award production');
 await shot('13-seconds-paused'); await resumeWorld(); await openFacility(); await observeCountdown();
 await page.waitForFunction(() => window.__timeDisplaySamples.length >= 4, null, { timeout: 6000 });
 const observed = await stopObservation(); countdowns.push({ label: '76 game-minute fixture, real unpaused countdown', samples: observed });
 const numbers = observed.map(sample => Number(sample.text.match(/(\d+)초/)?.[1]));
 assert.ok(numbers[0] >= secondsAtPause - 3 && numbers[0] <= secondsAtPause, 'opening settings and returning consumes only actual unpaused seconds');
 assert.ok(observed.length >= 4); for (let index = 1; index < observed.length; index++) assert.equal(numbers[index - 1] - numbers[index], 1, 'each real game tick subtracts one displayed second');
 for (let index = 2; index < observed.length; index++) assert.ok(observed[index].at - observed[index - 1].at > 650 && observed[index].at - observed[index - 1].at < 1800, 'successive countdown steps follow real one-second browser ticks');
 await pauseWorld(); await openFacility(); const held = await status(); await page.waitForTimeout(1400); assert.equal(await status(), held, 'pausing again holds the updated seconds');
 assert.deepEqual((await saved()).resources, before.resources, 'counting down grants no early production reward');
 assert.deepEqual((await saved()).growthQuests, existing.growthQuests, 'the time-label change preserves claimed growth progress');
 cases.push(`Old76-game-minute production retains its completion boundary; after real loading and settings navigation, ${remainingAtPause} game-minutes display ${secondsAtPause}초, hold while paused, and decrease1 displayed second per real tick.`);

 const nearReady = productionFixture(fresh, 30); await loadFixture(nearReady, 'Declared production fixture with5 real seconds left'); await openFacility();
 const nearReadyRemaining = nearReady.settlement.buildings[0].readyAt - (await saved()).totalMinutes;
 assert.ok(nearReadyRemaining > 12 && nearReadyRemaining <= 30, 'actual loading and pause navigation leave time to observe the final seconds');
 assert.equal(await status(), `생산 중 · ${Math.ceil(nearReadyRemaining / 6)}초 남음`);
 const readyStart = Date.now(); await resumeWorld(); await openFacility(); await observeCountdown(); await page.locator('[data-facility-collect="1"]').waitFor({ state: 'visible', timeout: 6500 });
 const completion = await stopObservation(); countdowns.push({ label: 'Natural completion from5seconds', elapsedMs: Date.now() - readyStart, samples: completion });
 await pauseWorld(); await openFacility();
 assert.equal(await status(), '생산품이 준비됐어요!'); assert.ok(completion.some(sample => sample.text === '생산 중 · 1초 남음')); assert.ok(completion.every(sample => !/\b0초|-[\d.]+초|\d+분/.test(sample.text)), 'completion changes to ready rather than0 or negative seconds');
 assert.deepEqual((await saved()).resources, nearReady.resources, 'ready production waits for explicit collection');
 const water = (await saved()).resources.water; await touch(page.locator('[data-facility-collect="1"]')); const collected = await saved();
 assert.equal(collected.resources.water, water + 4); assert.equal(collected.settlement.stats.collections, 1); assert.equal(collected.settlement.buildings[0].readyAt, null); assert.equal(collected.settlement.buildings[0].startedAt, null); assert.equal(await page.locator('[data-facility-collect="1"]').isVisible(), false);
 await page.reload(); await page.locator('#resident-name').getByText(nearReady.name, { exact: true }).waitFor(); await pauseWorld(); assert.deepEqual((await saved()).resources, collected.resources, 'reload cannot collect the finished batch twice'); assert.deepEqual((await saved()).growthQuests, nearReady.growthQuests);
 cases.push('Actual5-second production reaches1초 then ready, without0/negative labels; ready state grants nothing, one collection awards4 water, reload grants nothing twice.');

 await touch(page.locator('[data-nav="hunt"]')); await touch(page.locator('[data-start-hunt]')); await page.locator('.battle-screen').waitFor();
 assert.match(await page.locator('.battle-progress [data-battle-time]').innerText(), /^\d+초$/, 'the battle elapsed-time HUD also uses seconds');
 await page.waitForFunction(() => !document.querySelector('[data-skill="sweep"]').disabled, null, { timeout: 5000 });
 for (const [skill, limit] of [['sweep', 4], ['dash', 4], ['heal', 8]]) {
  await touch(page.locator(`[data-skill="${skill}"]`)); const text = await page.locator(`[data-skill="${skill}"] .battle-skill-cooldown`).innerText();
  assert.match(text, /^\d+초$/, 'battle skills use the same Korean seconds unit'); assert.ok(Number(text.slice(0, -1)) >= limit - 1 && Number(text.slice(0, -1)) <= limit, 'battle cooldowns show rounded-up real seconds at3× pace');
 }
 await touch(page.locator('[data-battle="pause"]')); const cooldowns = await page.locator('.battle-skill-cooldown').allInnerTexts(); await page.waitForTimeout(1200); assert.deepEqual(await page.locator('.battle-skill-cooldown').allInnerTexts(), cooldowns, 'battle pause also holds the second-based cooldowns');
 await shot('battle-seconds'); await touch(page.locator('[data-battle="resume"]')); await touch(page.locator('[data-battle="retreat"]')); await touch(page.locator('[data-battle="confirm-retreat"]')); await page.locator('.battle-result-layer').waitFor({ state: 'visible' });
 assert.match(await page.locator('.battle-result-stats>div').nth(1).locator('b').innerText(), /^\d+초$/, 'battle result duration keeps its Korean seconds unit'); await touch(page.locator('[data-battle="finish"]'));
 cases.push('Actual battle skill activation displays4/4/8-second rounded cooldowns at3× pace; pause holds cooldowns; retreat results also use초.');
 assert.deepEqual(errors, []); assert.deepEqual(failedAssets, []);
 await writeFile(`artifacts/time-display-v${version}-verification.json`, JSON.stringify({ version, status: 'passed', baseUrl, assertionsExecuted, startedAt: startedAt.toISOString(), finishedAt: new Date().toISOString(), input: 'Actual mobile touchscreen taps', clock: 'Real browser countdown ticks; no page.clock, synthetic clock, or direct game calls', deviceLimit: 'Chromium mobile emulation only; not a physical Android test', fixtures, cases, countdowns, screenshots, errors, failedAssets }, null, 2) + '\n');
 console.log(`PASS: ${assertionsExecuted} time display assertions; real seconds, pause, completion, collection and battle units.`);
} catch (error) {
 if (page && !page.isClosed()) await shot('failure').catch(() => {});
 await writeFile(`artifacts/time-display-v${version}-verification.json`, JSON.stringify({ version, status: 'failed', baseUrl, assertionsExecuted, fixtures, cases, countdowns, screenshots, errors, failedAssets, failure: String(error), stack: error.stack }, null, 2) + '\n'); throw error;
} finally { await browser.close(); }
