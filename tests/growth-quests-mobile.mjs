import { chromium } from '@playwright/test';
import strictAssert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tsImport } from 'tsx/esm/api';

// The browser performs the work and claims. Model metadata describes the
// published campaign and validates explicit saved fixtures, not browser actions.
const { createGame, loadGame, SAVE_KEY, CROP_IDS } = await tsImport('../src/game.ts', import.meta.url);
const { GROWTH_QUESTS, getGrowthQuests } = await tsImport('../src/growth-quests.ts', import.meta.url);
const { BUILDINGS, BUILDING_TYPES, getBuiltTypes } = await tsImport('../src/settlement.ts', import.meta.url);
const version = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')).version;
const baseUrl = process.env.TEST_BASE_URL || 'http://127.0.0.1:5173';
const snapshotId = process.env.TEST_SNAPSHOT_ID || 'mutable-development-diagnostic';
const finalSnapshot = process.env.TEST_FINAL_SNAPSHOT === '1';
const startedAt = new Date();
await mkdir('artifacts', { recursive: true });
let assertionsExecuted = 0;
const assert = new Proxy(strictAssert, { get(target, key) { const value = Reflect.get(target, key); return typeof value === 'function' ? (...args) => { assertionsExecuted++; return value(...args); } : value; } });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
const errors = [], failedAssets = [], canceledImages = [], screenshots = [], timings = [], cases = [], fixtureNames = [];
const successfulImages = new Set();
let page;
const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('road-haven-save-v1')));
const quest = id => GROWTH_QUESTS.find(quest => quest.id === id);
const card = id => page.locator(`[data-growth-quest="${id}"]`);
const history = id => page.locator(`[data-growth-history="${id}"]`);
const nav = section => page.locator(`[data-nav="${section}"]`);
const claimed = state => state.growthQuests?.claimed ?? [];
const facilities = state => state.settlement?.buildings ?? [];
async function touch(locator) {
 if (!await locator.isVisible() && await locator.evaluate(element => Boolean(element.closest('#farm-tray')))) await touch(page.locator('[data-nav="farm"]'));
 await locator.scrollIntoViewIfNeeded(); const box = await locator.boundingBox(); assert.ok(box, 'the touch target is rendered');
 const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
 assert.equal(await locator.evaluate((button, point) => document.elementFromPoint(point.x, point.y)?.closest('button') === button, point), true, 'the finger reaches the intended control');
 await page.touchscreen.tap(point.x, point.y);
 return point;
}
async function menuItem(kind) {
 if (await page.locator('#modal-root').isVisible()) await touch(page.locator('#modal-root [data-close]').first());
 await touch(page.locator('[data-open="menu"]'));
 await touch(page.locator(`#modal-root [data-open="${kind}"]`));
}
async function setPaused(paused) {
 const current = await page.locator('.time-button').getAttribute('aria-label') === '시간 계속';
 if (current === paused) return;
 const selected = await page.locator('#facility-sheet').isVisible() ? Number(await page.locator('#facility-sheet').getAttribute('data-facility')) : null;
 await menuItem('settings'); await touch(page.locator('#modal-root [data-pause]'));
 await touch(page.locator('#modal-root [data-close]').first());
 if (selected !== null) {
  await page.waitForTimeout(900);
  const point = await page.locator('#world').evaluate((canvas, id) => { const slot = JSON.parse(canvas.dataset.settlementSlots).find(slot => slot.buildingId === id), r = canvas.getBoundingClientRect(); return { x: r.left + slot.facilityX, y: r.top + slot.facilityY }; }, selected);
  assert.equal(await page.evaluate(point => document.elementFromPoint(point.x, point.y)?.id === 'world', point), true, 'the selected facility can be reopened after setting time');
  await page.touchscreen.tap(point.x, point.y); await page.locator(`#facility-sheet[data-facility="${selected}"]`).waitFor();
 }
}
async function pauseWorld() { await setPaused(true); }
async function close() { if (await page.locator('#modal-root').isVisible()) await touch(page.locator('#modal-root [data-close]').first()); }
async function shot(name) { const path = `artifacts/v${version}-growth-${name}.png`; await page.screenshot({ path, fullPage: true }); screenshots.push(path); }
function validateFixture(state) {
 const loaded = loadGame({ getItem: key => key === SAVE_KEY ? JSON.stringify(state) : null });
 assert.ok(loaded, `${state.name}: the saved fixture passes strict game validation`); assert.equal(loaded.name, state.name);
 return loaded;
}
async function reload(state) {
 if (state) { validateFixture(state); fixtureNames.push(state.name); await page.evaluate(state => localStorage.setItem('growth-qa-fixture', JSON.stringify(state)), state); }
 await page.reload(); await page.locator('#resident-name').waitFor(); await pauseWorld();
 if (state) assert.equal((await saved()).name, state.name, 'the application actually loaded the fixture');
}
async function makeContext(width, height) {
 const context = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true });
 await context.addInitScript(() => { const fixture = localStorage.getItem('growth-qa-fixture'); if (fixture) { const state = JSON.parse(fixture); state.lastSaved = 0; localStorage.setItem('road-haven-save-v1', JSON.stringify(state)); localStorage.removeItem('growth-qa-fixture'); localStorage.removeItem('road-haven-selected-seed-v1'); } });
 page = await context.newPage();
 page.on('pageerror', error => errors.push(error.message));
 page.on('response', response => { const kind = response.request().resourceType(); if (response.status() >= 400 && ['image', 'font', 'script', 'stylesheet'].includes(kind)) failedAssets.push(`${response.status()} ${response.url()}`); if (response.ok() && kind === 'image') successfulImages.add(response.url()); });
 page.on('requestfailed', request => { if (!['image', 'font', 'script', 'stylesheet'].includes(request.resourceType())) return; const reason = request.failure()?.errorText || 'request failed'; if (request.resourceType() === 'image' && reason === 'net::ERR_ABORTED') canceledImages.push(request.url()); else failedAssets.push(`${reason} ${request.url()}`); });
 await page.goto(baseUrl); await page.waitForLoadState('networkidle'); await touch(page.locator('[data-start]')); await pauseWorld();
 return context;
}
async function touchSummary(locator) {
 await locator.scrollIntoViewIfNeeded(); const box = await locator.boundingBox(); assert.ok(box && box.width >= 44 && box.height >= 44, 'optional detail controls remain finger sized');
 const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
 assert.equal(await locator.evaluate((summary, point) => document.elementFromPoint(point.x, point.y)?.closest('summary') === summary, point), true);
 await page.touchscreen.tap(point.x, point.y);
}
async function openBoard(id) {
 if (!await page.locator('[data-growth-board]').isVisible()) await menuItem('settlement-goals');
 await page.locator('[data-growth-board]').waitFor();
 if (id && !await card(id).count()) {
  const all = page.locator('[data-growth-all-goals]'); if (!await all.evaluate(element => element.open)) await touchSummary(all.locator(':scope > summary'));
  const row = history(id); if (!await row.evaluate(element => element.open)) await touchSummary(row.locator(':scope > summary'));
 }
}
async function uiStatus(id, status) { await openBoard(id); assert.equal(await (await card(id).count() ? card(id) : history(id)).getAttribute('data-quest-state'), status); }
async function go(id, { works = false } = {}) {
 await openBoard(id); assert.equal(await card(id).getAttribute('data-quest-state'), 'active');
 const before = await saved(); await touch(card(id).locator(`[data-quest-goto="${id}"]`));
 assert.equal(await page.locator('[data-growth-board]').isVisible(), false, 'a shortcut reaches the actual activity instead of leaving the board open');
 assert.deepEqual((await saved()).resources, before.resources, 'navigation does not immediately grant or charge resources');
 if (works) await waitBusy();
 return before;
}
async function waitBusy() { await page.waitForFunction(() => document.querySelector('#app').getAttribute('aria-busy') === 'true', null, { timeout: 1500 }); assert.equal(await page.locator('.chore-status').isVisible(), true); }
async function waitIdle(name, started = Date.now(), timeout = 30000) {
 await page.waitForFunction(() => !document.querySelector('#app').hasAttribute('aria-busy'), null, { timeout });
 timings.push({ name, elapsedMs: Date.now() - started }); assert.ok(Date.now() - started < timeout, `${name} ends in bounded real browser time`); assert.equal(await page.locator('.chore-status').isVisible(), false);
}
function assertReward(before, after, definition) {
 const reward = definition.reward, ownSeeds = Object.fromEntries(CROP_IDS.map(id => [id, (before.seedInventory?.[id] ?? (id === 'carrot' ? before.resources.seeds : 0)) + (reward.seeds?.[id] ?? 0) + (id === 'carrot' ? reward.resources?.seeds ?? 0 : 0)]));
 for (const resource of ['wood', 'scrap', 'food', 'water']) assert.equal(after.resources[resource], before.resources[resource] + (reward.resources?.[resource] ?? 0), `${definition.id} grants its displayed ${resource} reward exactly once`);
 assert.deepEqual(after.seedInventory, ownSeeds); assert.equal(after.resources.seeds, Object.values(ownSeeds).reduce((sum, count) => sum + count, 0));
 assert.equal(after.xp, before.xp + reward.xp); assert.equal(after.level, Math.floor(after.xp / 120) + 1);
 assert.deepEqual(claimed(after), [...claimed(before), definition.id]); assert.equal(new Set(claimed(after)).size, claimed(after).length);
}
async function claim(id, { repeat = false, reloadAfter = false } = {}) {
 await uiStatus(id, 'ready'); const before = await saved(), definition = quest(id);
 assert.equal(await card(id).locator('[data-quest-progress]').getAttribute('aria-valuenow'), String(definition.target));
 const claimButton = card(id).locator(`[data-quest-claim="${id}"]`); await claimButton.scrollIntoViewIfNeeded(); const box = await claimButton.boundingBox();
 assert.ok(box.width >= 44 && box.height >= 44, 'claim is finger sized'); const point = await touch(claimButton);
 if (repeat) { await page.touchscreen.tap(point.x, point.y); await page.touchscreen.tap(point.x, point.y); }
 const after = await saved(); assertReward(before, after, definition);
 if (repeat) assert.equal(await page.locator('#app').getAttribute('aria-busy'), null, 'duplicate claim taps do not start a phantom activity');
 if (reloadAfter) { await reload(); assert.deepEqual((await saved()).resources, after.resources); assert.deepEqual(claimed(await saved()), claimed(after)); assert.equal((await saved()).xp, after.xp); }
 // A deliberate next action follows the UI's 450 ms double-tap guard; the
 // duplicate taps above still occur immediately and must never pay twice.
 await page.waitForTimeout(500);
 return after;
}
async function tapPlot(id) {
 const point = await page.locator('#world').evaluate((canvas, id) => { const positions = [[-116, 42], [-33, 42], [50, 42], [133, 42], [-116, 122], [-33, 122], [50, 122], [133, 122]], [u, v] = positions[id - 1], g = JSON.parse(canvas.dataset.sceneGeometry), r = canvas.getBoundingClientRect(); return { x: r.left + g.dx + (480 + (u + 35) * .91 - (v + 36) * .67) * g.scale, y: r.top + g.dy + (420 + (u + 35) * .34 + (v + 36) * .47 - 112) * g.scale }; }, id);
 assert.equal(await page.evaluate(point => document.elementFromPoint(point.x, point.y)?.id === 'world', point), true, `plot ${id} is visible on the actual farm`); await page.touchscreen.tap(point.x, point.y);
}
async function sowTwo() {
 await go('new-seeds'); assert.equal(await page.locator('[data-select-seed]').count(), 6); await touch(page.locator('[data-select-seed="potato"]')); await page.waitForTimeout(1300);
 const before = await saved(), empty = before.plots.filter(plot => plot.plantedAt === null).slice(0, 2).map(plot => plot.id); assert.equal(empty.length, 2);
 const start = Date.now(); await tapPlot(empty[0]); await waitBusy(); await tapPlot(empty[1]); await waitIdle('quest-two-selected-potato-plots', start);
 const after = await saved(); assert.equal(after.seedInventory.potato, before.seedInventory.potato - 2); assert.equal(after.resources.seeds, before.resources.seeds - 2); assert.equal(after.stats.plantings, (before.stats.plantings ?? 0) + 2); assert.equal(after.energy, before.energy - 8);
}
async function buildForQuest(id, slot) {
 const definition = quest(id), type = definition.destination.buildingType, before = await go(id);
 await page.locator(`[data-build-type="${type}"]`).waitFor(); assert.equal(await page.locator(`[data-build-type="${type}"]`).evaluate(button => button.classList.contains('quest-target')), true);
 await touch(page.locator(`[data-build-type="${type}"]`)); await page.locator('#construction-bar').waitFor(); await page.waitForTimeout(1200);
 const point = await page.locator('#world').evaluate((canvas, slot) => { const p = JSON.parse(canvas.dataset.settlementSlots).find(p => p.slot === slot), r = canvas.getBoundingClientRect(); return { x: r.left + p.x, y: r.top + p.y }; }, slot);
 assert.equal(await page.evaluate(point => document.elementFromPoint(point.x, point.y)?.id === 'world', point), true); await page.touchscreen.tap(point.x, point.y); assert.deepEqual((await saved()).resources, before.resources);
 await touch(page.locator('[data-construction-confirm]')); const after = await saved(); assert.equal(after.resources.wood, before.resources.wood - BUILDINGS[type].wood); assert.equal(after.resources.scrap, before.resources.scrap - BUILDINGS[type].scrap); assert.equal(facilities(after).at(-1).type, type); await page.waitForFunction(() => !document.querySelector('#app').hasAttribute('aria-busy'), null, { timeout: 20000 }); return facilities(after).at(-1).id;
}
async function inspectBoard(expectedStates) {
 const before = await saved(), seen = [];
 await openBoard(); assert.equal(await page.locator('[data-quest-chapter]').count(), 0, 'the main board has no six-tile chapter selector');
 const current = GROWTH_QUESTS.find(quest => ['active', 'ready'].includes(expectedStates[quest.id]));
 assert.equal(await page.locator('[data-growth-quest]').count(), current ? 1 : 0, 'only the next actionable objective gets a full card');
 assert.equal(await page.locator('[data-growth-board]').getAttribute('data-current-quest'), current?.id ?? '');
 if (current) {
  const button = card(current.id).locator(expectedStates[current.id] === 'ready' ? '[data-quest-claim]' : '[data-quest-goto]');
  assert.equal(await button.isVisible(), true); const box = await button.boundingBox(); assert.ok(box.width >= 44 && box.height >= 44, 'the single primary action is finger sized');
 }
 const all = page.locator('[data-growth-all-goals]'); if (!await all.evaluate(element => element.open)) await touchSummary(all.locator(':scope > summary'));
 assert.equal(await page.locator('[data-growth-history]').count(), 32); assert.equal(await page.locator('[data-growth-history-chapter]').count(), 8);
 for (const definition of GROWTH_QUESTS) {
  seen.push(definition.id); const row = history(definition.id); assert.equal(await row.getAttribute('data-quest-state'), expectedStates[definition.id]);
  if (!await row.evaluate(element => element.open)) await touchSummary(row.locator(':scope > summary'));
  const countText = await row.locator('[data-history-count]').innerText(); assert.ok(countText.endsWith(` / ${definition.target}`));
  const text = await row.locator('.growth-rewards').innerText(); assert.ok(text.includes(String(definition.reward.xp)), 'every hidden-by-default objective still exposes its real XP reward on request');
  assert.equal(await row.locator('[data-quest-claim], [data-quest-goto]').count(), 0, 'history has no duplicate or locked action controls');
  await touchSummary(row.locator(':scope > summary'));
 }
 await touchSummary(all.locator(':scope > summary')); assert.equal(await all.evaluate(element => element.open), false);
 assert.deepEqual(seen, GROWTH_QUESTS.map(quest => quest.id)); assert.deepEqual((await saved()).resources, before.resources); assert.equal((await saved()).xp, before.xp); assert.deepEqual(claimed(await saved()), claimed(before));
}
function lateState(name, duplicate = false) {
 const state = createGame('female', name); state.deckLevel = duplicate ? 6 : 8; state.energy = 100; state.xp = 110; state.level = 1;
 state.resources = { wood: 1000, scrap: 1000, food: 100, water: 100, seeds: 23 };
 state.stats = { harvests: 8, gathers: 3, hunts: 5, expansions: duplicate ? 5 : 7, chops: 3, battlesWon: 5, defeatedEnemies: 12, plantings: 2, waterings: 2 };
 state.quests = ['first-harvest', 'road-scout', 'bigger-home']; state.plots = Array.from({ length: duplicate ? 8 : 10 }, (_, index) => ({ id: index + 1, plantedAt: null, watered: false }));
 state.settlement = { buildings: Array.from({ length: duplicate ? 12 : 6 }, (_, index) => ({ id: index + 1, type: duplicate ? 'waterworks' : BUILDING_TYPES[index], slot: index, level: duplicate || index < 3 ? 2 : 1, startedAt: null, readyAt: null })), nextBuildingId: duplicate ? 13 : 7, stats: { productions: 24, collections: 24 } };
 state.maxCompanionTeamSize = 3; state.companionTeam = ['dog', 'cat', 'rabbit']; state.settlement.buildings[0].level = 5;
 return state;
}
async function recoverReplacement(id) {
 const definition = quest(id), type = definition.destination.buildingType, before = await go(id); await page.locator('[data-replacement-target]').first().waitFor(); assert.equal(await page.locator('[data-replacement-target]').count(), 12);
 const target = page.locator('[data-replacement-target]').first(), facilityId = Number(await target.getAttribute('data-replacement-target')), original = facilities(before).find(facility => facility.id === facilityId);
 assert.equal(await target.getAttribute('data-replacement-type'), type); await touch(target); await touch(page.locator(`[data-replace-type="${type}"]`)); assert.deepEqual((await saved()).resources, before.resources); assert.equal(facilities(await saved()).length, 12);
 await touch(page.locator(`[data-replace-confirm="${facilityId}"][data-replace-building-type="${type}"]`)); const after = await saved(), replaced = facilities(after).find(facility => facility.id === facilityId);
 assert.equal(after.resources.wood, before.resources.wood - BUILDINGS[type].wood); assert.equal(after.resources.scrap, before.resources.scrap - BUILDINGS[type].scrap); assert.equal(facilities(after).length, 12); assert.equal(after.settlement.nextBuildingId, 13); assert.equal(replaced.slot, original.slot); assert.equal(replaced.level, 1); assert.equal(replaced.type, type); assert.equal(replaced.startedAt, null); assert.equal(after.settlement.stats.collections, before.settlement.stats.collections);
}

try {
 assert.equal(GROWTH_QUESTS.length, 32);
 for (const width of [360, 390]) {
  const height = width === 360 ? 740 : 844, context = await makeContext(width, height), fresh = await saved();
  assert.deepEqual(claimed(fresh), []); assert.equal(fresh.stats.plantings, 0); assert.equal(fresh.stats.waterings, 0);
  await inspectBoard(Object.fromEntries(GROWTH_QUESTS.map((quest, index) => [quest.id, index === 0 ? 'active' : 'locked']))); await shot(`locked-chapters-${width}`);
  let start = Date.now(), before = await go('road-supplies', { works: true }); await waitIdle(`quest-first-exploration-${width}`, start); assert.equal((await saved()).stats.gathers, 1); assert.equal((await saved()).resources.wood, before.resources.wood + 10); assert.equal((await saved()).resources.scrap, before.resources.scrap + 5);
  await claim('road-supplies', { repeat: true, reloadAfter: true }); await uiStatus('first-carrot', 'active'); await uiStatus('rainwater-home', 'locked');
  start = Date.now(); before = await go('first-carrot', { works: true }); await waitIdle(`quest-first-harvest-${width}`, start); assert.equal((await saved()).stats.harvests, 1); assert.equal((await saved()).resources.food, before.resources.food + 4); await claim('first-carrot');
  const waterworks = await buildForQuest('rainwater-home', 0); await claim('rainwater-home'); await go('first-delivery'); await page.locator(`[data-facility-start="${waterworks}"]`).waitFor();
  before = await saved(); await touch(page.locator(`[data-facility-start="${waterworks}"]`)); let state = await saved(); assert.deepEqual(state.resources, before.resources); assert.equal(state.settlement.stats.productions, 1); assert.equal(facilities(state)[0].readyAt - facilities(state)[0].startedAt, 45); assert.match(await page.locator('[data-production-status]').innerText(), /12초/, 'the first batch at2× pace needs twelve rounded-up real seconds');
  if (width === 360) {
   start = Date.now(); await setPaused(false); await page.locator(`[data-facility-collect="${waterworks}"]`).waitFor({ state: 'visible', timeout: 23000 });
   const elapsedMs = Date.now() - start; await pauseWorld(); timings.push({ name: 'quest-first-production-natural-twelve-rounded-seconds', elapsedMs });
   assert.ok(elapsedMs >= 9750 && elapsedMs <= 15750, 'the first quest batch matures in11.25 real seconds with the same one-second tick and menu-travel tolerance');
  }
  else { state = await saved(); state.name = '390 생산 시간 경과'; state.totalMinutes = facilities(state)[0].readyAt; state.day = Math.floor(state.totalMinutes / 1440) + 1; state.minutes = state.totalMinutes % 1440; await reload(state); await go('first-delivery'); }
  await touch(page.locator(`[data-facility-collect="${waterworks}"]`)); state = await saved(); assert.equal(state.resources.water, before.resources.water + 4); assert.equal(state.settlement.stats.collections, 1); await claim('first-delivery');
  assert.equal(await page.locator('[data-growth-board]').getAttribute('data-current-quest'), 'new-seeds', 'claiming the chapter finale directly displays the next task');
  await sowTwo(); await claim('new-seeds'); start = Date.now(); before = await go('tender-watering', { works: true }); const dry = before.plots.filter(plot => plot.plantedAt !== null && !plot.watered).length; await waitIdle(`quest-continued-watering-${width}`, start); state = await saved(); assert.equal(state.stats.waterings, dry); assert.equal(state.resources.water, before.resources.water - dry); await claim('tender-watering');
  await buildForQuest('warm-kitchen', 1); await claim('warm-kitchen'); before = await go('wider-deck'); await page.locator('#modal-root [data-action="expand"]').waitFor(); start = Date.now(); await touch(page.locator('#modal-root [data-action="expand"]')); await waitBusy(); await waitIdle(`quest-animated-expansion-${width}`, start); state = await saved(); assert.equal(state.deckLevel, 2); assert.equal(state.plots.length, 4); assert.equal(state.resources.wood, before.resources.wood - 20); assert.equal(state.resources.scrap, before.resources.scrap - 10); await claim('wider-deck', { reloadAfter: true });
  start = Date.now(); await go('forest-logs', { works: true }); assert.equal(await page.locator('#zone-name').innerText(), '도로 옆 벌목장'); await waitIdle(`quest-forest-shortcut-${width}`, start); assert.equal((await saved()).stats.chops, 1); await uiStatus('forest-logs', 'active'); assert.equal(await card('forest-logs').locator('[data-quest-count]').innerText(), '1 / 3'); await shot(`chapter-three-${width}`);
  cases.push(`${width}px normal play: ordered gather/harvest/build/production/plant/water/kitchen/expansion claims, no rewards for locked chapters, real crop and resource actions, duplicate claim/reload, chapter unlock and actual grove shortcut`);
  if (width === 390) {
   const upgrade = lateState('뒤 챕터 개선 목적지 fixture'); upgrade.growthQuests.claimed = GROWTH_QUESTS.slice(0, 11).map(quest => quest.id); upgrade.settlement.buildings.forEach(building => building.level = 1); await reload(upgrade); before = await go('better-facility'); const confirm = page.locator('[data-upgrade-confirm]'); await confirm.waitFor(); const facilityId = Number(await confirm.getAttribute('data-upgrade-confirm')), original = facilities(before).find(building => building.id === facilityId); await touch(confirm); state = await saved(); assert.equal(facilities(state).find(building => building.id === facilityId).level, 2); assert.equal(state.resources.wood, before.resources.wood - BUILDINGS[original.type].wood * 2); assert.equal(state.resources.scrap, before.resources.scrap - BUILDINGS[original.type].scrap * 2); await waitIdle('quest-upgrade-visible-work'); await claim('better-facility');
   const collect = lateState('뒤 챕터 수령 목적지 fixture'); collect.growthQuests.claimed = GROWTH_QUESTS.slice(0, 10).map(quest => quest.id); collect.settlement.stats.collections = 3; collect.settlement.stats.productions = 4; collect.settlement.buildings[1].level = 1; collect.settlement.buildings[1].startedAt = collect.totalMinutes - 120; collect.settlement.buildings[1].readyAt = collect.totalMinutes; await reload(collect); before = await go('steady-deliveries'); assert.equal(await page.locator('#facility-sheet').getAttribute('data-facility'), '2'); await touch(page.locator('[data-facility-collect="2"]')); assert.equal((await saved()).resources.food, before.resources.food + 5); assert.equal((await saved()).settlement.stats.collections, 4); await claim('steady-deliveries');
   const hunt = lateState('뒤 챕터 사냥 목적지 fixture'); hunt.growthQuests.claimed = GROWTH_QUESTS.slice(0, 14).map(quest => quest.id); hunt.stats.battlesWon = 0; hunt.stats.hunts = 0; hunt.stats.defeatedEnemies = 0; await reload(hunt); before = await go('safe-road'); assert.equal(await page.locator('[data-stage="1"]').getAttribute('aria-pressed'), 'true'); assert.deepEqual((await saved()).resources, before.resources); await touch(page.locator('[data-start-hunt]')); await page.locator('.battle-screen').waitFor(); assert.ok((await saved()).expedition); await touch(page.locator('[data-battle="retreat"]')); await touch(page.locator('[data-battle="confirm-retreat"]')); await touch(page.locator('[data-battle="finish"]')); assert.equal((await saved()).stats.battlesWon, 0); await uiStatus('safe-road', 'active');
   await page.setViewportSize({ width: 844, height: 390 }); await openBoard('safe-road'); await card('safe-road').locator('[data-quest-goto]').scrollIntoViewIfNeeded(); const gotoBox = await card('safe-road').locator('[data-quest-goto]').boundingBox(); assert.ok(gotoBox.width >= 44 && gotoBox.height >= 44); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true); await shot('landscape-board'); await page.setViewportSize({ width: 390, height: 844 });
   const legacy = lateState('12곳 교체와 후반 목표 fixture', true); delete legacy.growthQuests; delete legacy.stats.plantings; delete legacy.stats.waterings; await reload(legacy); state = await saved(); assert.deepEqual(state.resources, legacy.resources); assert.equal(state.xp, legacy.xp); assert.equal(state.level, legacy.level); assert.deepEqual(state.seedInventory, legacy.seedInventory); assert.equal(state.stats.plantings, 0, 'persisting the offline-clock baseline normalizes old counters without inventing farming progress'); assert.equal(state.stats.waterings, 0); assert.deepEqual(claimed(state), []);
   await inspectBoard(Object.fromEntries(GROWTH_QUESTS.map((quest, index) => [quest.id, index === 0 ? 'ready' : 'locked'])));
   for (const id of ['new-seeds', 'tender-watering']) { await openBoard(id); assert.equal(await history(id).locator('[data-history-count]').innerText(), '0 / 2', 'in-memory legacy progress starts at zero'); }
   await reload(); assert.deepEqual((await saved()).resources, legacy.resources); assert.equal((await saved()).xp, legacy.xp);
   for (let index = 0; index < GROWTH_QUESTS.length; index++) {
    const definition = GROWTH_QUESTS[index], current = getGrowthQuests(await saved())[index];
    if (current.status === 'active') {
     if (definition.id === 'new-seeds') { assert.equal((await saved()).stats.plantings, 0, 'the first explicit save persists the normalized zero'); await sowTwo(); assert.equal((await saved()).stats.plantings, 2); }
     else if (definition.id === 'tender-watering') { assert.equal((await saved()).stats.waterings, 0); start = Date.now(); await go(definition.id, { works: true }); await waitIdle('legacy-required-actual-watering', start); assert.equal((await saved()).stats.waterings, 2); }
     else if (definition.destination.kind === 'build') await recoverReplacement(definition.id);
     else if (definition.destination.kind === 'expand') { const before = await go(definition.id), level = before.deckLevel, wood = 20 + 14 * (level - 1), scrap = 10 + 7 * (level - 1); const started = Date.now(); await touch(page.locator('[data-action="expand"]')); await waitIdle(`later-quest-deck-${level + 1}`, started); const after = await saved(); assert.equal(after.deckLevel, level + 1); assert.equal(after.resources.wood, before.resources.wood - wood); assert.equal(after.resources.scrap, before.resources.scrap - scrap); }
     else assert.fail(`Unexpected missing endgame fixture condition: ${definition.id}`);
    }
    state = await claim(definition.id, { reloadAfter: index === 0 || index === 18 || index === 23 });
    if (index === 0) { assert.equal(state.xp, 120); assert.equal(state.level, 2, 'the first legacy catch-up reward crosses the XP level boundary once'); }
    assert.equal(claimed(state).length, index + 1);
   }
   assert.equal(getBuiltTypes(await saved()).length, 6, 'paid replacement retains all six distinct construction experiences'); assert.equal(facilities(await saved()).length, 12);
   await inspectBoard(Object.fromEntries(GROWTH_QUESTS.map(quest => [quest.id, 'claimed']))); assert.equal(await page.locator('[data-growth-history][data-quest-state="claimed"]').count(), 32); assert.equal(await page.locator('[data-growth-complete]').isVisible(), true); assert.match(await page.locator('[data-growth-overview-title]').innerText(), /성장 완료/); await shot('all-32-claimed');
   cases.push('Explicit validated later-chapter fixtures cover actual upgrade, ready production and stage-one battle controls; Explicit full12 duplicate facility boundary with later achievements gets no automatic gifts, records only actual plant/water, recovers all missing types through paid same-slot replacement, and claims all32 rewards in order with persistent prefixes/XP/level/seed consistency');
  }
  await context.close();
 }
 assert.equal(canceledImages.every(url => successfulImages.has(url)), true); const imageContext = await browser.newContext(), imagePage = await imageContext.newPage(); await imagePage.goto(baseUrl);
 const decodedCanceledImages = await imagePage.evaluate(async sources => Promise.all(sources.map(async source => { const image = new Image(); image.src = source; await image.decode(); return { source, width: image.naturalWidth, height: image.naturalHeight }; })), [...new Set(canceledImages)]); assert.equal(decodedCanceledImages.every(image => image.width > 0 && image.height > 0), true); await imageContext.close(); assert.deepEqual(errors, []); assert.deepEqual(failedAssets, []);
 await writeFile(`artifacts/growth-quests-v${version}-verification.json`, JSON.stringify({ version, snapshotId, finalSnapshot, status: 'passed', baseUrl, assertionsExecuted, input: 'Actual touchscreen taps against visible mobile canvas and controls', clock: 'Real browser time; first360px production matures naturally, 390px and later ready batches use explicitly identified validated saved fixtures', viewports: ['360×740', '390×844', '844×390'], startedAt: startedAt.toISOString(), finishedAt: new Date().toISOString(), cases, fixtureNames, timings, screenshots, errors, failedAssets, canceledImages, decodedCanceledImages }, null, 2) + '\n');
 console.log(`PASS: ${assertionsExecuted} growth-quest assertions; ${timings.length} real-time sequences; eight chapters, explicit ordered rewards, actual destinations, legacy recovery and32 claimed goals.`);
} catch (error) { if (page && !page.isClosed()) await shot('failure').catch(() => {}); await writeFile(`artifacts/growth-quests-v${version}-verification.json`, JSON.stringify({ version, snapshotId, finalSnapshot, status: 'failed', baseUrl, assertionsExecuted, cases, fixtureNames, timings, screenshots, errors, failedAssets, canceledImages, failure: String(error) }, null, 2) + '\n'); throw error; }
finally { await browser.close(); }
