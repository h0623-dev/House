import { chromium } from '@playwright/test';
import strictAssert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const snapshotId = process.env.TEST_SNAPSHOT_ID || 'mutable-development-diagnostic';
const finalSnapshot = process.env.TEST_FINAL_SNAPSHOT === '1';
const startedAt = new Date();
let assertionsExecuted = 0;
const assert = new Proxy(strictAssert, {
 get(target, key) {
  const value = Reflect.get(target, key);
  return typeof value === 'function' ? (...args) => { assertionsExecuted++; return value(...args); } : value;
 },
});

await mkdir('artifacts', { recursive: true });
const appVersion = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')).version;
const browser = await chromium.launch({
 executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
 headless: true, args: ['--no-sandbox'],
});
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await context.newPage();
const errors = [];
const failedAssets = [];
const canceledImageRequests = [];
const loadedIllustrations = new Set();
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => {
 if (response.status() >= 400 && ['image', 'font', 'script', 'stylesheet'].includes(response.request().resourceType())) {
  failedAssets.push(response.status() + ' ' + response.url());
 }
 if (response.ok() && response.request().resourceType() === 'image' && response.headers()['content-type']?.includes('image/png')) {
  loadedIllustrations.add(response.url());
 }
});
page.on('requestfailed', request => {
 if (['image', 'font', 'script', 'stylesheet'].includes(request.resourceType())) {
  const reason = request.failure()?.errorText || 'request failed';
  // Removing an SVG icon or reloading a document can cancel a redundant image
  // request. This is acceptable only if this very URL also loaded successfully
  // and decodes in the final asset check below; other failures remain fatal.
  if (request.resourceType() === 'image' && reason === 'net::ERR_ABORTED') canceledImageRequests.push(request.url());
  else failedAssets.push(reason + ' ' + request.url());
 }
});
const save = async () => JSON.parse(await page.evaluate(() => localStorage.getItem('road-haven-save-v1')));
const close = async () => page.locator('#modal-root [data-close]').click();
const quick = action => page.locator('#quick-actions [data-quick="' + action + '"]');
const nav = section => page.locator('[data-nav="' + section + '"]');
async function openFarmTray() {
 if (!await page.locator('#farm-tray').isVisible()) await nav('farm').click();
}
async function clickQuick(action) { await openFarmTray(); await quick(action).click(); }
async function menuItem(kind) {
 if (await page.locator('#modal-root').isVisible()) await close();
 await page.locator('[data-open="menu"]').click();
 await page.locator(`#modal-root [data-open="${kind}"]`).click();
}
async function pauseWorld() {
 if (await page.locator('.time-button').getAttribute('aria-label') !== '시간 일시정지') return;
 await menuItem('settings'); await page.locator('#modal-root [data-pause]').click(); await close();
}
async function openPetOnMap() {
 await nav('home').click(); await page.clock.runFor(2000);
 // The pet shortcut moved onto the painted truck. Touch its roaming area in
 // the live canvas rather than invoking the modal through a private API.
 for (const u of [90, 62, 118, 35, 145]) for (const v of [-14, -29, 1]) {
  const point = await page.locator('#world').evaluate((canvas, { u, v }) => {
   const g = JSON.parse(canvas.dataset.sceneGeometry), r = canvas.getBoundingClientRect();
   return { x: r.left + g.dx + (480 + u * .91 - v * .67) * g.scale, y: r.top + g.dy + (420 + u * .34 + v * .47 - 110) * g.scale };
  }, { u, v });
  assert.equal(await page.evaluate(point => document.elementFromPoint(point.x, point.y)?.id === 'world', point), true, 'the pet roaming area is reachable on the painted truck');
  await page.mouse.click(point.x, point.y);
  if (await page.locator('#modal-root [data-companion-card="dog"]').isVisible()) return;
  if (await page.locator('#modal-root').isVisible()) await close();
 }
 assert.fail('Tapping the visible pet roaming area must open the pet interaction');
}
const screenshots = [];
const screenshot = name => {
 const path = 'artifacts/v' + appVersion + '-' + name + '.png';
 screenshots.push(path);
 return page.screenshot({ path, fullPage: true });
};
async function writeReceipt(status, failure) {
 const finishedAt = new Date();
 await writeFile('artifacts/browser-v' + appVersion + '-verification.json', JSON.stringify({
  version: appVersion, snapshotId, finalSnapshot, status,
  baseUrl: process.env.TEST_BASE_URL || 'http://127.0.0.1:5173',
  startedAt: startedAt.toISOString(), finishedAt: finishedAt.toISOString(),
  elapsedMs: finishedAt.getTime() - startedAt.getTime(), assertionsExecuted,
  viewports: ['360×740', '390×844', '844×390', '1440×1100'],
  loadedIllustrationCount: loadedIllustrations.size,
  loadedIllustrations: [...loadedIllustrations].sort(),
  legacyDeckCase: 'Valid local late-game fixture: deck level 6 and eight plots, day and night',
  screenshots, errors, failedAssets, canceledImageRequests,
  ...(failure ? { failure: String(failure) } : {}),
 }, null, 2) + '\n');
}

async function assertHudFits(width, height) {
 await page.setViewportSize({ width, height });
 await page.clock.runFor(400);
 await openFarmTray();
 assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, width + 'px mobile viewport must not overflow horizontally');
 assert.equal(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1), true, width + '×' + height + ' main game must fit without vertical scrolling');
 for (const action of ['harvest', 'water', 'plant', 'chop', 'gather', 'rest']) {
  const button = quick(action);
  assert.equal(await button.isVisible(), true, action + ' must be directly visible in the game');
  const box = await button.boundingBox();
  assert.ok(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= width + 1 && box.y + box.height <= height + 1, action + ' must be reachable without scrolling at ' + width + '×' + height + ': ' + JSON.stringify(box));
  assert.ok(box.width >= 44 && box.height >= 44, action + ' needs a finger-sized target');
  assert.ok((await button.innerText()).trim(), action + ' must have a visible caption');
  const iconBox = await button.locator('.control-icon').boundingBox();
  const caption = button.locator('small');
  const captionBox = await caption.boundingBox();
  assert.ok(iconBox && captionBox && captionBox.y >= iconBox.y + iconBox.height - 1, action + ' caption must be below the icon');
  assert.ok(await caption.evaluate(element => parseFloat(getComputedStyle(element).fontSize) <= 12), action + ' caption should remain smaller than the button icon');
 }
 for (const section of ['home', 'farm', 'build', 'hunt', 'bag']) {
  const box = await nav(section).boundingBox();
  assert.ok(box && box.y >= 0 && box.y + box.height <= height + 1, section + ' navigation must stay in the viewport');
  assert.ok(box.width >= 44 && box.height >= 44, section + ' navigation needs a finger-sized target');
 }
}

async function selectPlot(id) {
 await nav('farm').click();
 for (let attempt = 0; attempt < 9; attempt++) {
  if (await page.locator('#plot-action').getAttribute('data-plot') === String(id)) return;
  await page.locator('[data-plot-step="1"]').click();
 }
 assert.fail('Unable to select plot ' + id + ' from the in-game controls');
}

async function chooseSeed(button, cropId = 'carrot') {
 await openFarmTray();
 if (await page.locator('#planting-toolbar').isVisible() && await page.locator('#planting-toolbar').getAttribute('data-farm-mode') === 'plant') await page.locator('#planting-toolbar [data-seed-change]').click();
 else await button.click();
 if (!await page.locator('#modal-root [data-select-seed]').first().isVisible()) {
  await page.locator('#planting-toolbar [data-seed-change]').click();
 }
 assert.equal(await page.locator('#modal-root [data-select-seed]').count(), 6, 'planting starts with a choice of six seeds');
 const before = await save();
 await page.locator(`[data-select-seed="${cropId}"]`).click();
 assert.equal(await page.locator('#modal-root').isVisible(), false);
 assert.equal(await page.locator('#planting-toolbar').isVisible(), true);
 assert.equal((await save()).resources.seeds, before.resources.seeds, 'choosing a seed must not consume it');
 await page.clock.runFor(2000);
}

async function stopPlanting() {
 if (await page.locator('#planting-toolbar').isVisible()) await page.locator('[data-plant-cancel]').click();
}

function paintedPlot(id) {
 const coordinates = async () => {
  return page.locator('#world').evaluate((canvas, id) => {
   const positions = [[-116, 42], [-33, 42], [50, 42], [133, 42], [-116, 122], [-33, 122], [50, 122], [133, 122]];
   const [u, v] = positions[id - 1], p = (u, v, z = 0) => [480 + u * .91 - v * .67, 420 + u * .34 + v * .47 - z];
   const [x, y] = p(u + 35, v + 36, 112), rect = canvas.getBoundingClientRect();
   const geometry = JSON.parse(canvas.dataset.sceneGeometry);
   return { x: rect.left + geometry.dx + x * geometry.scale, y: rect.top + geometry.dy + y * geometry.scale, width: 1, height: 1 };
  }, id);
 };
 return { boundingBox: coordinates, click: async () => { const point = await coordinates(); await page.mouse.click(point.x, point.y); } };
}

async function chore(button, assertNotApplied, { workScreenshot, repeatTap = false } = {}) {
 if (typeof button.getAttribute === 'function' && await button.getAttribute('data-quick')) await openFarmTray();
 const box = await button.boundingBox();
 const pausedClock = await page.locator('.time-button').getAttribute('aria-label') === '시간 계속' ? await page.locator('#clock').textContent() : null;
 await button.click();
 assert.equal(await page.locator('#app').getAttribute('aria-busy'), 'true');
 assert.equal(await page.locator('#modal-root').isVisible(), false, 'chores play in the game without a farm dialog');
 if (repeatTap && box) {
  // A second real tap during the walk must not queue duplicate work or rewards.
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
 }
 await page.clock.runFor(100);
 const motion = await page.locator('#world').evaluate(canvas => JSON.parse(canvas.dataset.sceneAction));
 const expectedWork = { plant: .5, water: .5, harvest: .55, chop: .85, gather: .8, expand: .6 }[motion.kind];
 assert.ok(expectedWork && Math.abs(motion.work - expectedWork) < .005, 'the faster work phase still retains its readable action duration');
 assert.ok(Math.abs(motion.total - (motion.walk * 2 + motion.work)) < .005, 'shortened outbound, work and return still form one complete chore');
 if (assertNotApplied) await assertNotApplied();
 assert.equal(await page.locator('#app').getAttribute('aria-busy'), 'true');
 await page.clock.runFor(Math.max(0, Math.ceil((motion.walk + motion.work / 2) * 1000) - 100));
 assert.equal(await page.locator('#app').getAttribute('aria-busy'), 'true', 'the resident visibly works before the single resource commit');
 if (assertNotApplied) await assertNotApplied();
 if (workScreenshot) await screenshot(workScreenshot);
 // Travel now follows physical distance, including the complete ladder trip.
 for (let elapsed = 0; elapsed < 30000 && await page.locator('#app').getAttribute('aria-busy'); elapsed += 500) await page.clock.runFor(500);
 assert.equal(await page.locator('#app').getAttribute('aria-busy'), null, 'the distance-based chore completes within the bounded route time');
 if (pausedClock !== null) assert.equal(await page.locator('#clock').textContent(), pausedClock, 'a shortened chore never advances the paused village clock on completion');
}

async function enterBattle(stage = 1) {
 await nav('hunt').click();
 await page.locator('[data-stage="' + stage + '"]').click();
 await page.locator('[data-start-hunt]').click();
 await page.locator('.battle-screen').waitFor();
 assert.ok((await save()).expedition, 'battle entry must be persisted before fighting');
 assert.equal((await save()).expedition.unitParty, true, 'the battle saves the participating animal party');
 assert.equal(await page.locator('[data-battle-ally="dog"]').isVisible(), true, 'the dog has an individual party card');
 assert.equal(await page.locator('[data-battle-ally="cat"]').isVisible(), true, 'the cat has an individual party card');
}

async function retreat() {
 const before = await save();
 await page.locator('[data-battle="retreat"]').click();
 await page.locator('[data-battle="confirm-retreat"]').click();
 await page.clock.runFor(50);
 await page.locator('[data-battle="finish"]').click();
 const after = await save();
 assert.equal(after.expedition, null);
 assert.equal(after.stats.battlesWon, before.stats.battlesWon);
 assert.equal(after.resources.food, before.resources.food, 'retreat grants no victory reward');
 assert.equal(await page.locator('#app').evaluate(element => element.inert), false);
}

try {
 await page.clock.install({ time: new Date('2026-10-08T02:00:00Z') });
 await page.clock.pauseAt(new Date('2026-10-08T02:00:00Z'));
 await page.goto(process.env.TEST_BASE_URL || 'http://127.0.0.1:5173');
 await page.waitForLoadState('networkidle');
 await page.evaluate(() => document.fonts.ready);
 await page.clock.runFor(350);
 await screenshot('character-selection');
 await page.locator('[data-gender="male"]').click();
 await page.getByLabel('어떤 이름으로 불러 드릴까요?').fill('노을');
 await page.locator('[data-start]').click();
 assert.equal((await save()).gender, 'male');
 assert.equal((await save()).name, '노을');
 await pauseWorld();
 await assertHudFits(360, 740);
 await screenshot('mobile-small-home');
 await assertHudFits(390, 844);
 await screenshot('mobile-male-home');
 await assertHudFits(844, 390);
 await screenshot('landscape-home');
 await assertHudFits(390, 844);
 await nav('farm').click();
 await page.locator('#farm-context [data-open="farm"]').click();
 await page.clock.runFor(350);
 await screenshot('mobile-farm-overview');
 await close();

 // Select a different plot in the HUD, then tap the actual rendered first plot.
 // The farm camera is settled before translating this world point into screen pixels.
 await selectPlot(3);
 await page.clock.runFor(2000);
 const beforeHarvest = await save();
 // A mature planter is now an immediate harvest action, with no extra toolbar tap.
 await chore(paintedPlot(1), async () => {
  assert.equal((await save()).stats.harvests, beforeHarvest.stats.harvests);
  assert.equal((await save()).resources.food, beforeHarvest.resources.food);
 }, { repeatTap: true, workScreenshot: 'mobile-harvesting' });
 assert.equal((await save()).stats.harvests, beforeHarvest.stats.harvests + 1, 'rapid repeated taps must harvest once');
 assert.equal((await save()).plots[0].plantedAt, null);

 await selectPlot(3);
 assert.equal(await page.locator('#plot-action').getAttribute('data-action'), 'plant');
 const beforePlant = await save();
 await chooseSeed(page.locator('#plot-action'));
 await chore(paintedPlot(3), async () => assert.equal((await save()).resources.seeds, beforePlant.resources.seeds));
 assert.notEqual((await save()).plots[2].plantedAt, null);
 assert.equal((await save()).plots[0].plantedAt, null, 'planting a selected plot must not silently use another empty plot');
 assert.equal((await save()).resources.seeds, beforePlant.resources.seeds - 1);
 assert.equal((await save()).plots[2].cropId, 'carrot');
 await stopPlanting();
 assert.equal(await page.locator('#plot-action').getAttribute('data-action'), 'water');
 const beforeWater = await save();
 await chore(page.locator('#plot-action'), async () => assert.equal((await save()).resources.water, beforeWater.resources.water));
 assert.equal((await save()).plots[2].watered, true);
 assert.equal((await save()).plots[1].watered, false, 'targeted watering must preserve the other dry plot');
 await chore(quick('water'));
 assert.equal((await save()).plots[1].watered, true);
 await selectPlot(1);
 await chooseSeed(quick('plant'));
 await chore(paintedPlot(1));
 assert.notEqual((await save()).plots[0].plantedAt, null);
 await stopPlanting();

 await menuItem('expand');
 await chore(page.locator('#modal-root [data-action="expand"]'), async () => assert.equal((await save()).deckLevel, 1));
 assert.equal((await save()).deckLevel, 2);
 assert.equal((await save()).plots.length, 4);
 await screenshot('mobile-expanded-home');
 const wood = (await save()).resources.wood;
 await chore(quick('chop'), async () => assert.equal((await save()).resources.wood, wood), { workScreenshot: 'mobile-woodcutting' });
 assert.equal((await save()).resources.wood, wood + 18);
 assert.equal((await save()).stats.chops, 1);
 await menuItem('grove');
 await page.locator('#modal-root [data-look-grove]').click();
 await page.clock.runFor(2000);
 await screenshot('mobile-grove');
 await menuItem('grove');
 await page.clock.runFor(350);
 await screenshot('mobile-grove-guide');
 await close();
 await chore(quick('gather'));
 assert.equal((await save()).stats.gathers, 1);

 const food = (await save()).resources.food;
 await enterBattle(1);
 assert.equal((await save()).resources.food, food, 'entry must not grant the eventual battle reward');
 await page.clock.runFor(600);
 await page.getByRole('button', { name: '전투 일시정지', exact: true }).click();
 const pausedTime = await page.locator('.battle-progress [data-battle-time]').textContent();
 await page.clock.runFor(3000);
 assert.equal(await page.locator('.battle-progress [data-battle-time]').textContent(), pausedTime);
 await page.locator('[data-battle="resume"]').click();
 await page.locator('[data-skill="sweep"]').click();
 assert.equal(await page.locator('[data-skill="sweep"]').isDisabled(), true);
 assert.equal(await page.locator('[data-skill="sweep"] .battle-skill-cooldown').textContent(), '4초', 'the original 12-second skill displays its actual four-second cooldown');
 await page.locator('[data-battle="auto"]').click();
 await screenshot('mobile-battle');
 await page.setViewportSize({ width: 844, height: 390 });
 await page.clock.runFor(350);
 assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'landscape battle must not overflow horizontally');
 for (const skill of ['sweep', 'dash', 'heal']) {
  const box = await page.locator('[data-skill="' + skill + '"]').boundingBox();
  assert.ok(box && box.width >= 44 && box.height >= 44 && box.y >= 0 && box.y + box.height <= 391, skill + ' skill remains reachable in landscape');
 }
 await screenshot('landscape-battle');
 await page.setViewportSize({ width: 390, height: 844 });
 await page.clock.runFor(350);
 let capturedBoss = false;
 for (let attempt = 0; attempt < 24; attempt++) {
  if (await page.locator('[data-battle="finish"]').count()) break;
  await page.clock.runFor(1667);
  assert.equal(await page.locator('.battle-screen').count(), 1, 'battle remains open until the player returns');
  if (!capturedBoss && await page.locator('.battle-boss-label').isVisible()) {
   await screenshot('mobile-boss');
   capturedBoss = true;
  }
 }
 assert.equal(capturedBoss, true, 'the final wave must visibly show its illustrated boss');
 await page.locator('[data-battle="finish"]').waitFor();
 await screenshot('battle-result');
 await page.locator('[data-battle="finish"]').click();
 assert.equal((await save()).expedition, null);
 assert.equal((await save()).stats.battlesWon, 1);
 assert.ok((await save()).resources.food >= food + 8);
 assert.equal((await save()).stats.defeatedEnemies, 8);
 assert.equal(await page.locator('#app').evaluate(element => element.inert), false);
 const afterWin = await save();
 await page.reload();
 await page.locator('#resident-name').getByText('노을').waitFor();
 assert.equal((await save()).deckLevel, 2);
 assert.equal((await save()).stats.battlesWon, 1);
 assert.equal((await save()).resources.food, afterWin.resources.food, 'reload must not grant a second battle reward');
 await pauseWorld();

 // All stages use the same direct hunt entry and safe return path.
 for (const stage of [2, 3]) {
  await clickQuick('rest');
  await enterBattle(stage);
  await page.clock.runFor(1000);
  await screenshot('battle-stage-' + stage);
  await retreat();
 }

 await page.locator('[data-open="character"]').click();
 await page.locator('[data-gender="female"]').click();
 await page.clock.runFor(350);
 await screenshot('female-portrait');
 await page.locator('[data-start]').click();
 assert.equal((await save()).gender, 'female');
 assert.equal((await save()).stats.battlesWon, 1, 'character changes must preserve progression');
 await page.clock.runFor(1000);
 await screenshot('mobile-female-home');

 await nav('bag').click();
 await page.clock.runFor(350);
 await screenshot('mobile-bag');
 await page.locator('#modal-root [data-open="map"]').click();
 await page.clock.runFor(350);
 await screenshot('mobile-overview-map');
 await close();
 await openPetOnMap();
 await page.clock.runFor(350);
 const svgDefinitionIds = await page.locator('svg [id]').evaluateAll(elements => elements.map(element => element.id));
 assert.equal(new Set(svgDefinitionIds).size, svgDefinitionIds.length, 'illustrated portraits must use unique SVG clip/gradient IDs when shown together');
 await screenshot('mobile-pet');
 await page.getByRole('button', { name: '보리 쓰다듬기', exact: true }).click();
 await close();

 await menuItem('settings');
 await page.getByRole('button', { name: '앱 새 버전 확인', exact: true }).click();
 await page.getByText(/아직 배포 서버가 연결되지 않았어요/).waitFor();
 await close();
 const portraitSources = await page.locator('#profile img, #profile svg image').evaluateAll(images => [...new Set(images.map(image => image.getAttribute('src') || image.getAttribute('href')).filter(Boolean))]);
 assert.ok(portraitSources.length, 'the profile must display the new illustrated character art');
 const decodedPortraits = await page.evaluate(async sources => Promise.all(sources.map(async source => {
  const image = new Image();
  image.src = source;
  await image.decode();
  return image.naturalWidth > 0;
 })), portraitSources);
 assert.equal(decodedPortraits.every(Boolean), true, 'anime portrait art must decode without broken images');
 await context.setOffline(true);
 await chore(quick('chop'));
 await clickQuick('rest');
 assert.ok((await save()).energy > 0);
 await context.setOffline(false);
 await assertHudFits(390, 844);

 // Migrate the schema written by the original APK and recover interrupted hunts.
 await page.evaluate(() => {
  const old = JSON.parse(localStorage.getItem('road-haven-save-v1'));
  delete old.expedition;
  delete old.stats.chops;
  delete old.stats.battlesWon;
  delete old.stats.defeatedEnemies;
  delete old.seedInventory;
  old.plots.forEach(plot => { delete plot.cropId; });
  localStorage.setItem('road-haven-legacy-test-input', JSON.stringify(old));
 });
 await context.addInitScript(() => {
  const legacy = localStorage.getItem('road-haven-legacy-test-input');
  if (legacy) {
   localStorage.setItem('road-haven-save-v1', legacy);
   localStorage.removeItem('road-haven-legacy-test-input');
  }
 });
 await page.reload();
 await page.locator('#resident-name').getByText('노을').waitFor();
 await clickQuick('rest');
 assert.equal((await save()).deckLevel, 2);
 assert.equal((await save()).stats.chops, 0);
 assert.equal((await save()).expedition, null);
 await enterBattle(1);
 const pending = await save();
 assert.ok(pending.expedition);
 await page.reload();
 await page.locator('#resident-name').getByText('노을').waitFor();
 assert.equal((await save()).expedition, null);
 assert.equal((await save()).resources.food, pending.resources.food);
 assert.equal((await save()).energy, pending.energy);
 await page.setViewportSize({ width: 1440, height: 1100 });
 await page.clock.runFor(4000);
 await screenshot('desktop-home');

 // A valid late-game save exercises all eight plots and the largest painted deck.
 const maxDeck = await save();
 maxDeck.deckLevel = 6;
 maxDeck.stats.expansions = 5;
 maxDeck.minutes = 9 * 60;
 maxDeck.totalMinutes = (maxDeck.day - 1) * 1440 + maxDeck.minutes;
 maxDeck.plots = Array.from({ length: 8 }, (_, index) => ({
  id: index + 1,
  plantedAt: index % 3 === 2 ? null : Math.max(0, maxDeck.totalMinutes - (index % 3 === 0 ? 300 : 60)),
  watered: index % 3 === 0,
 }));
 // Stage fixtures separately because the outgoing page saves its real progress
 // on pagehide; apply the fixture before the next page loads its game state.
 await context.addInitScript(() => {
  const fixture = localStorage.getItem('road-haven-visual-test-input');
  if (fixture) {
   // This declared visual fixture starts at its chosen game clock with no absence.
   // Zero is the model's unstarted offline baseline; page.clock installs its Date shim separately.
   const state = JSON.parse(fixture); state.lastSaved = 0;
   localStorage.setItem('road-haven-save-v1', JSON.stringify(state));
   localStorage.removeItem('road-haven-visual-test-input');
  }
 });
 await page.evaluate(fixture => localStorage.setItem('road-haven-visual-test-input', JSON.stringify(fixture)), maxDeck);
 await page.setViewportSize({ width: 390, height: 844 });
 await page.reload();
 await page.locator('#resident-name').getByText('노을').waitFor();
 await pauseWorld();
 await page.clock.runFor(2000);
 assert.equal((await save()).deckLevel, 6);
 assert.equal((await save()).plots.length, 8);
 await assertHudFits(390, 844);
 await screenshot('mobile-max-deck-day');
 for (let id = 1; id <= 8; id++) {
  await selectPlot(id);
  assert.equal(await page.locator('#plot-action').getAttribute('data-plot'), String(id), 'all eight late-game plots must be selectable');
 }
 await page.clock.runFor(2000);
 await screenshot('mobile-max-deck-farm');
 await nav('home').click();
 const nightDeck = await save();
 nightDeck.minutes = 21 * 60;
 nightDeck.totalMinutes = (nightDeck.day - 1) * 1440 + nightDeck.minutes;
 await page.evaluate(fixture => localStorage.setItem('road-haven-visual-test-input', JSON.stringify(fixture)), nightDeck);
 await page.reload();
 await page.locator('#resident-name').getByText('노을').waitFor();
 await pauseWorld();
 await page.clock.runFor(2000);
 assert.equal(await page.locator('#clock').textContent(), '21:00');
 await assertHudFits(360, 740);
 await screenshot('mobile-max-deck-night-small');
 await assertHudFits(390, 844);
 await screenshot('mobile-max-deck-night');
 const decodedIllustrations = await page.evaluate(async sources => Promise.all(sources.map(async source => {
  const image = new Image();
  image.src = source;
  await image.decode();
  return image.naturalWidth > 0 && image.naturalHeight > 0;
 })), [...loadedIllustrations]);
 assert.ok(loadedIllustrations.size >= 4, 'world, survivor, creatures and UI illustration assets must load');
 assert.equal(decodedIllustrations.every(Boolean), true, 'all requested PNG illustrations must decode');
 assert.equal(canceledImageRequests.every(url => loadedIllustrations.has(url)), true, 'a canceled image request is allowed only when the same image loaded successfully and decoded');
 assert.deepEqual(failedAssets, []);
 assert.deepEqual(errors, []);
 await writeReceipt('passed');
 console.log('Verified ' + assertionsExecuted + ' assertions in ' + (Date.now() - startedAt.getTime()) + ' ms; ' + loadedIllustrations.size + ' PNG illustration assets decoded.');
 console.log('PASS: direct in-game plot selection and farming, delayed single resource commits, viewport-sized mobile controls at 360×740 and 390×844, woodcutting/expansion, anime portraits, three battle stages with skills/pause/victory/retreat, exactly-once rewards, old save migration, interrupted expedition recovery, reload, offline actions and clean console/assets.');
} catch (error) {
 await screenshot('ui-failure').catch(() => {});
 await writeReceipt('failed', error).catch(() => {});
 const battleDiagnostic = await page.evaluate(() => ({
  time: document.querySelector('[data-battle-time]')?.textContent ?? null,
  wave: document.querySelector('[data-battle-wave]')?.textContent ?? null,
 })).catch(() => null);
 console.error('UI diagnostic', battleDiagnostic, { errors, failedAssets });
 throw error;
} finally {
 await browser.close();
}
