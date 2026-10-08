import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

await mkdir('artifacts', { recursive: true });
const browser = await chromium.launch({
 executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
 headless: true, args: ['--no-sandbox'],
});
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await context.newPage();
const errors = [];
const failedAssets = [];
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => {
 if (response.status() >= 400 && ['image', 'font', 'script', 'stylesheet'].includes(response.request().resourceType())) {
  failedAssets.push(response.status() + ' ' + response.url());
 }
});
page.on('requestfailed', request => {
 if (['image', 'font', 'script', 'stylesheet'].includes(request.resourceType())) {
  failedAssets.push((request.failure()?.errorText || 'request failed') + ' ' + request.url());
 }
});
const save = async () => JSON.parse(await page.evaluate(() => localStorage.getItem('road-haven-save-v1')));
const close = async () => page.locator('#modal-root [data-close]').click();
const quick = action => page.locator('#quick-actions [data-quick="' + action + '"]');
const nav = section => page.locator('[data-nav="' + section + '"]');
const screenshot = name => page.screenshot({ path: 'artifacts/v0.3.0-' + name + '.png', fullPage: true });

async function assertHudFits(width, height) {
 await page.setViewportSize({ width, height });
 await page.clock.runFor(400);
 assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, width + 'px mobile viewport must not overflow horizontally');
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
 for (const section of ['home', 'farm', 'grove', 'hunt', 'bag', 'settings']) {
  const box = await nav(section).boundingBox();
  assert.ok(box && box.y >= 0 && box.y + box.height <= height + 1, section + ' navigation must stay in the viewport');
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

async function chore(button, assertNotApplied, { workScreenshot, repeatTap = false } = {}) {
 const box = await button.boundingBox();
 await button.click();
 assert.equal(await page.locator('#app').getAttribute('aria-busy'), 'true');
 assert.equal(await page.locator('#modal-root').isVisible(), false, 'chores play in the game without a farm dialog');
 if (repeatTap && box) {
  // A second real tap during the walk must not queue duplicate work or rewards.
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
 }
 await page.clock.runFor(300);
 if (assertNotApplied) await assertNotApplied();
 assert.equal(await page.locator('#app').getAttribute('aria-busy'), 'true');
 await page.clock.runFor(1300);
 assert.equal(await page.locator('#app').getAttribute('aria-busy'), 'true', 'the character must visibly work before resources change');
 if (workScreenshot) await screenshot(workScreenshot);
 await page.clock.runFor(5000);
 assert.equal(await page.locator('#app').getAttribute('aria-busy'), null);
}

async function enterBattle(stage = 1) {
 await nav('hunt').click();
 await page.locator('[data-stage="' + stage + '"]').click();
 await page.locator('[data-start-hunt]').click();
 await page.locator('.battle-screen').waitFor();
 assert.ok((await save()).expedition, 'battle entry must be persisted before fighting');
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
 await page.evaluate(() => document.fonts.ready);
 await page.clock.runFor(350);
 await screenshot('character-selection');
 await page.locator('[data-gender="male"]').click();
 await page.getByLabel('어떤 이름으로 불러 드릴까요?').fill('노을');
 await page.locator('[data-start]').click();
 assert.equal((await save()).gender, 'male');
 assert.equal((await save()).name, '노을');
 await page.getByRole('button', { name: '시간 일시정지', exact: true }).click();
 await assertHudFits(360, 740);
 await screenshot('mobile-small-home');
 await assertHudFits(390, 844);
 await screenshot('mobile-male-home');

 // Select a different plot in the HUD, then tap the actual rendered first plot.
 // The farm camera is settled before translating this world point into screen pixels.
 await selectPlot(3);
 await page.clock.runFor(2000);
 const firstPlot = await page.locator('#world').evaluate(canvas => {
  const rect = canvas.getBoundingClientRect();
  const style = getComputedStyle(canvas);
  const top = parseFloat(style.getPropertyValue('--world-safe-top')) || 0;
  const bottom = parseFloat(style.getPropertyValue('--world-safe-bottom')) || 0;
  const available = Math.max(100, rect.height - top - bottom);
  const scale = Math.min(rect.width / 860, available / 560) * 1.48;
  return { x: rect.left + rect.width / 2 + (354.03 - 468) * scale, y: rect.top + top + available / 2 + (317.12 - 350) * scale };
 });
 await page.mouse.click(firstPlot.x, firstPlot.y);
 assert.equal(await page.locator('#plot-action').getAttribute('data-plot'), '1', 'tapping a rendered plot must select that exact plot');
 // Each plot is selectable in the HUD; no farm management modal is required.
 assert.equal(await page.locator('#plot-action').getAttribute('data-action'), 'harvest');
 const beforeHarvest = await save();
 await chore(quick('harvest'), async () => {
  assert.equal((await save()).stats.harvests, beforeHarvest.stats.harvests);
  assert.equal((await save()).resources.food, beforeHarvest.resources.food);
 }, { repeatTap: true, workScreenshot: 'mobile-harvesting' });
 assert.equal((await save()).stats.harvests, beforeHarvest.stats.harvests + 1, 'rapid repeated taps must harvest once');
 assert.equal((await save()).plots[0].plantedAt, null);

 await selectPlot(3);
 assert.equal(await page.locator('#plot-action').getAttribute('data-action'), 'plant');
 const beforePlant = await save();
 await chore(page.locator('#plot-action'), async () => assert.equal((await save()).resources.seeds, beforePlant.resources.seeds));
 assert.notEqual((await save()).plots[2].plantedAt, null);
 assert.equal((await save()).plots[0].plantedAt, null, 'planting a selected plot must not silently use another empty plot');
 assert.equal((await save()).resources.seeds, beforePlant.resources.seeds - 1);
 assert.equal(await page.locator('#plot-action').getAttribute('data-action'), 'water');
 const beforeWater = await save();
 await chore(page.locator('#plot-action'), async () => assert.equal((await save()).resources.water, beforeWater.resources.water));
 assert.equal((await save()).plots[2].watered, true);
 assert.equal((await save()).plots[1].watered, false, 'targeted watering must preserve the other dry plot');
 await chore(quick('water'));
 assert.equal((await save()).plots[1].watered, true);
 await chore(quick('plant'));
 assert.notEqual((await save()).plots[0].plantedAt, null);

 await page.locator('[data-open="expand"]').click();
 await chore(page.locator('#modal-root [data-action="expand"]'), async () => assert.equal((await save()).deckLevel, 1));
 assert.equal((await save()).deckLevel, 2);
 assert.equal((await save()).plots.length, 4);
 const wood = (await save()).resources.wood;
 await chore(quick('chop'), async () => assert.equal((await save()).resources.wood, wood), { workScreenshot: 'mobile-woodcutting' });
 assert.equal((await save()).resources.wood, wood + 18);
 assert.equal((await save()).stats.chops, 1);
 await chore(quick('gather'));
 assert.equal((await save()).stats.gathers, 1);

 const food = (await save()).resources.food;
 await enterBattle(1);
 assert.equal((await save()).resources.food, food, 'entry must not grant the eventual battle reward');
 await page.clock.runFor(1800);
 await page.getByRole('button', { name: '전투 일시정지', exact: true }).click();
 const pausedTime = await page.locator('[data-battle-time]').textContent();
 await page.clock.runFor(3000);
 assert.equal(await page.locator('[data-battle-time]').textContent(), pausedTime);
 await page.locator('[data-battle="resume"]').click();
 await page.locator('[data-skill="sweep"]').click();
 assert.equal(await page.locator('[data-skill="sweep"]').isDisabled(), true);
 await page.locator('[data-battle="auto"]').click();
 await screenshot('mobile-battle');
 for (let attempt = 0; attempt < 24; attempt++) {
  if (await page.locator('[data-battle="finish"]').count()) break;
  await page.clock.runFor(5000);
  assert.equal(await page.locator('.battle-screen').count(), 1, 'battle remains open until the player returns');
 }
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
 await page.getByRole('button', { name: '시간 일시정지', exact: true }).click();

 // All stages use the same direct hunt entry and safe return path.
 for (const stage of [2, 3]) {
  await quick('rest').click();
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

 await nav('settings').click();
 await page.getByRole('button', { name: '새 버전 확인', exact: true }).click();
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
 await quick('rest').click();
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
 await quick('rest').click();
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
 assert.deepEqual(failedAssets, []);
 assert.deepEqual(errors, []);
 console.log('PASS: direct in-game plot selection and farming, delayed single resource commits, viewport-sized mobile controls at 360×740 and 390×844, woodcutting/expansion, anime portraits, three battle stages with skills/pause/victory/retreat, exactly-once rewards, old save migration, interrupted expedition recovery, reload, offline actions and clean console/assets.');
} catch (error) {
 await screenshot('ui-failure').catch(() => {});
 console.error('UI diagnostic', await page.locator('[data-battle-time]').textContent().catch(() => null), await page.locator('[data-battle-wave]').textContent().catch(() => null), { errors, failedAssets });
 throw error;
} finally {
 await browser.close();
}
