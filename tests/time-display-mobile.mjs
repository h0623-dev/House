import { chromium } from '@playwright/test';
import strictAssert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

// Real mobile taps and browser time. Declared production fixtures avoid a full
// 45-second batch; observation only reads UI text and never advances the clock.
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
async function pauseWorld() { const button = page.getByRole('button', { name: '시간 일시정지', exact: true }); if (await button.count()) await touch(button); }
async function resumeWorld() { await touch(page.getByRole('button', { name: '시간 계속', exact: true })); }
async function shot(name) { await page.waitForTimeout(250); const path = `artifacts/v${version}-time-display-${name}.png`; await page.screenshot({ path, fullPage: true }); screenshots.push(path); }
async function closeModal() { if (await page.locator('#modal-root').isVisible()) await touch(page.locator('#modal-root [data-close]').first()); }
async function loadFixture(state, label) {
 fixtures.push({ label, gameMinutesRemaining: state.settlement.buildings[0].readyAt - state.totalMinutes });
 await page.evaluate(state => localStorage.setItem('time-display-qa-fixture', JSON.stringify(state)), state); await page.reload();
 await page.locator('#resident-name').getByText(state.name, { exact: true }).waitFor(); await pauseWorld();
 const loaded = await saved();
 for (const key of ['resources', 'plots', 'settlement', 'growthQuests', 'facilityHistory', 'stats', 'energy', 'xp']) assert.deepEqual(loaded[key], state[key], `${label}: loading preserves ${key}`);
}
function productionFixture(fresh, remaining) {
 const state = structuredClone(fresh);
 state.name = '초 단위 시간 검사'; state.health = 80;
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
 for (const [type, seconds] of [['waterworks', 45], ['kitchen', 60], ['workshop', 75], ['petHouse', 60], ['greenhouse', 120], ['watchtower', 90]]) {
  const card = page.locator(`[data-build-type="${type}"]`); await card.scrollIntoViewIfNeeded();
  assert.equal((await card.locator('.building-output small').innerText()).trim(), `· ${seconds}초`, `${type} shows actual active-play seconds`);
 }
 assert.doesNotMatch(await page.locator('#modal-root').innerText(), /\d+\s*분/, 'the catalog has no game-minute waiting labels');
 await shot('catalog-seconds'); await closeModal();
 await touch(page.locator('[data-nav="farm"]')); await touch(page.locator('[data-quick="plant"]'));
 for (const [crop, seconds] of [['carrot', 90], ['potato', 120], ['tomato', 135], ['corn', 150], ['strawberry', 180], ['pumpkin', 210]]) {
  const card = page.locator(`[data-select-seed="${crop}"]`); await card.scrollIntoViewIfNeeded();
  assert.equal(await card.locator('small').innerText(), `성장 ${seconds}초`, `${crop} growth is shown in real active-play seconds`);
 }
 const seedCopy = await page.locator('#modal-root').innerText(); assert.doesNotMatch(seedCopy, /\d+\s*분/); assert.match(seedCopy, /물.{0,16}(?:준|주)/, 'seed timing explains the watering condition');
 await shot('seed-growth-seconds'); await closeModal();
 cases.push('All six facility production durations45/60/75/60/120/90초 and six watered seed growth durations90/120/135/150/180/210초 appear in the mobile UI.');

 const existing = productionFixture(fresh, 76); await loadFixture(existing, 'Declared valid old-schema production with76 game-minutes left'); await openFacility();
 assert.equal(await status(), '생산 중 · 38초 남음', '76 remaining game-minutes convert to38 seconds, not76 seconds');
 const before = await saved(); await page.waitForTimeout(2300); assert.equal(await status(), '생산 중 · 38초 남음', 'pausing freezes the countdown'); assert.deepEqual(await saved(), before, 'pausing does not secretly advance or award production');
 await shot('38-seconds-paused'); await observeCountdown(); await resumeWorld();
 await page.waitForFunction(() => window.__timeDisplaySamples.length >= 4, null, { timeout: 6000 }); await pauseWorld();
 const observed = await stopObservation(); countdowns.push({ label: '76 game-minute fixture, real unpaused countdown', samples: observed });
 assert.equal(observed[0].text, '생산 중 · 38초 남음');
 const numbers = observed.map(sample => Number(sample.text.match(/(\d+)초/)?.[1]));
 assert.ok(observed.length >= 4); for (let index = 1; index < observed.length; index++) assert.equal(numbers[index - 1] - numbers[index], 1, 'each real game tick subtracts one displayed second');
 for (let index = 2; index < observed.length; index++) assert.ok(observed[index].at - observed[index - 1].at > 650 && observed[index].at - observed[index - 1].at < 1800, 'successive countdown steps follow real one-second browser ticks');
 const held = await status(); await page.waitForTimeout(1400); assert.equal(await status(), held, 'pausing again holds the updated seconds');
 assert.deepEqual((await saved()).resources, before.resources, 'counting down grants no early production reward');
 assert.deepEqual((await saved()).growthQuests, existing.growthQuests, 'the time-label change preserves claimed growth progress');
 cases.push('Existing76-game-minute production shows38초, holds while paused, and decreases exactly1 displayed second on each real second over three ticks.');

 const nearReady = productionFixture(fresh, 4); await loadFixture(nearReady, 'Declared production fixture with2 real seconds left'); await openFacility(); assert.equal(await status(), '생산 중 · 2초 남음');
 await observeCountdown(); const readyStart = Date.now(); await resumeWorld(); await page.locator('[data-facility-collect="1"]').waitFor({ state: 'visible', timeout: 4500 }); await pauseWorld();
 const completion = await stopObservation(); countdowns.push({ label: 'Natural completion from2seconds', elapsedMs: Date.now() - readyStart, samples: completion });
 assert.equal(await status(), '생산품이 준비됐어요!'); assert.ok(completion.some(sample => sample.text === '생산 중 · 1초 남음')); assert.ok(completion.every(sample => !/\b0초|-[\d.]+초|\d+분/.test(sample.text)), 'completion changes to ready rather than0 or negative seconds');
 assert.deepEqual((await saved()).resources, nearReady.resources, 'ready production waits for explicit collection');
 const water = (await saved()).resources.water; await touch(page.locator('[data-facility-collect="1"]')); const collected = await saved();
 assert.equal(collected.resources.water, water + 4); assert.equal(collected.settlement.stats.collections, 1); assert.equal(collected.settlement.buildings[0].readyAt, null); assert.equal(collected.settlement.buildings[0].startedAt, null); assert.equal(await page.locator('[data-facility-collect="1"]').isVisible(), false);
 await page.reload(); await page.locator('#resident-name').getByText(nearReady.name, { exact: true }).waitFor(); await pauseWorld(); assert.deepEqual((await saved()).resources, collected.resources, 'reload cannot collect the finished batch twice'); assert.deepEqual((await saved()).growthQuests, nearReady.growthQuests);
 cases.push('Actual2→1-second production completes without0/negative labels; ready state does not grant resources, one collection awards4 water, reload grants nothing twice.');

 await touch(page.locator('[data-nav="hunt"]')); await touch(page.locator('[data-start-hunt]')); await page.locator('.battle-screen').waitFor();
 assert.match(await page.locator('[data-battle-time]').innerText(), /^\d+초$/, 'the battle elapsed-time HUD also uses seconds');
 await page.waitForFunction(() => !document.querySelector('[data-skill="sweep"]').disabled, null, { timeout: 5000 });
 for (const [skill, limit] of [['sweep', 12], ['dash', 10], ['heal', 23]]) {
  await touch(page.locator(`[data-skill="${skill}"]`)); const text = await page.locator(`[data-skill="${skill}"] .battle-skill-cooldown`).innerText();
  assert.match(text, /^\d+초$/, 'battle skills use the same Korean seconds unit'); assert.ok(Number(text.slice(0, -1)) >= limit - 1 && Number(text.slice(0, -1)) <= limit, 'a real-second battle cooldown is not divided by the world-clock speed');
 }
 await touch(page.locator('[data-battle="pause"]')); const cooldowns = await page.locator('.battle-skill-cooldown').allInnerTexts(); await page.waitForTimeout(1200); assert.deepEqual(await page.locator('.battle-skill-cooldown').allInnerTexts(), cooldowns, 'battle pause also holds the second-based cooldowns');
 await shot('battle-seconds'); await touch(page.locator('[data-battle="resume"]')); await touch(page.locator('[data-battle="retreat"]')); await touch(page.locator('[data-battle="confirm-retreat"]')); await page.locator('.battle-result-layer').waitFor({ state: 'visible' });
 assert.match(await page.locator('.battle-result-stats>div').nth(1).locator('b').innerText(), /^\d+초$/, 'battle result duration keeps its Korean seconds unit'); await touch(page.locator('[data-battle="finish"]'));
 cases.push('Actual battle skill activation displays12/10/23-second cooldowns in초 without halving them; pause holds cooldowns; retreat results also use초.');
 assert.deepEqual(errors, []); assert.deepEqual(failedAssets, []);
 await writeFile(`artifacts/time-display-v${version}-verification.json`, JSON.stringify({ version, status: 'passed', baseUrl, assertionsExecuted, startedAt: startedAt.toISOString(), finishedAt: new Date().toISOString(), input: 'Actual mobile touchscreen taps', clock: 'Real browser countdown ticks; no page.clock, synthetic clock, or direct game calls', deviceLimit: 'Chromium mobile emulation only; not a physical Android test', fixtures, cases, countdowns, screenshots, errors, failedAssets }, null, 2) + '\n');
 console.log(`PASS: ${assertionsExecuted} time display assertions; real seconds, pause, completion, collection and battle units.`);
} catch (error) {
 if (page && !page.isClosed()) await shot('failure').catch(() => {});
 await writeFile(`artifacts/time-display-v${version}-verification.json`, JSON.stringify({ version, status: 'failed', baseUrl, assertionsExecuted, fixtures, cases, countdowns, screenshots, errors, failedAssets, failure: String(error), stack: error.stack }, null, 2) + '\n'); throw error;
} finally { await browser.close(); }
