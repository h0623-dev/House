import { chromium } from '@playwright/test';
import strictAssert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

// Regressions for the controls a person actually touches on a phone. Unlike the
// broader browser smoke suite, this test never installs or advances page.clock.
const startedAt = new Date();
const appVersion = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')).version;
const baseUrl = process.env.TEST_BASE_URL || 'http://127.0.0.1:5173';
await mkdir('artifacts', { recursive: true });
let assertionsExecuted = 0;
const assert = new Proxy(strictAssert, {
 get(target, key) {
  const value = Reflect.get(target, key);
  return typeof value === 'function' ? (...args) => { assertionsExecuted++; return value(...args); } : value;
 },
});
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
const errors = [], failedAssets = [], timings = [], screenshots = [];
let page;

const shot = async name => {
 const path = `artifacts/v${appVersion}-real-touch-${name}.png`;
 await page.waitForTimeout(350);
 await page.screenshot({ path, fullPage: true });
 screenshots.push(path);
};
const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('road-haven-save-v1')));
const quick = action => page.locator(`[data-quick="${action}"]`);
const nav = section => page.locator(`[data-nav="${section}"]`);
async function touch(locator) {
 if (!await locator.isVisible() && await locator.evaluate(element => Boolean(element.closest('#farm-tray')))) await touch(nav('farm'));
 await locator.scrollIntoViewIfNeeded();
 const box = await locator.boundingBox();
 assert.ok(box, 'the touch target must be rendered');
 const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
 assert.equal(await locator.evaluate((button, point) => button === document.elementFromPoint(point.x, point.y)?.closest('button'), point), true, 'no overlay may swallow the intended button touch');
 // Actual coordinates also exercise unavailable-but-explanatory controls.
 // Locator.tap considers aria-disabled an actionability blocker, even though
 // the native button intentionally receives taps to show a recovery choice.
 await page.touchscreen.tap(point.x, point.y);
}
async function heldTouch(locator, session) {
 await locator.scrollIntoViewIfNeeded();
 const box = await locator.boundingBox();
 assert.ok(box, 'a held touch needs a rendered button');
 await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }] });
 // Cross at least one actual one-second game tick while the finger is down.
 await page.waitForTimeout(1250);
 await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
async function menuItem(kind) {
 if (await page.locator('#modal-root').isVisible()) await closeModal();
 await touch(page.locator('[data-open="menu"]'));
 await touch(page.locator(`#modal-root [data-open="${kind}"]`));
}
async function setPaused(paused) {
 if ((await page.locator('.time-button').getAttribute('aria-label') === '시간 계속') === paused) return;
 await menuItem('settings'); await touch(page.locator('#modal-root [data-pause]'));
 await touch(page.locator('#modal-root [data-save]')); await closeModal();
}
async function pauseWorldTime() { await setPaused(true); }
async function closeModal() { await touch(page.locator('#modal-root [data-close]').first()); }
async function fixture(state) {
 // Declared boundary saves start at their chosen game clock. Reusing the
 // first welcome save's old timestamp would simulate an unintended absence.
 await page.evaluate(state => localStorage.setItem('road-haven-touch-fixture', JSON.stringify({ ...state, lastSaved: 0 })), state);
 await page.reload();
 await page.locator('#resident-name').getByText(state.name, { exact: true }).waitFor();
 await pauseWorldTime();
}
async function settleCamera() { await page.waitForTimeout(1300); }
async function worldPoint(x, y) {
 return page.locator('#world').evaluate((canvas, { x, y }) => {
  const rect = canvas.getBoundingClientRect(), geometry = JSON.parse(canvas.dataset.sceneGeometry);
  return { x: rect.left + geometry.dx + x * geometry.scale, y: rect.top + geometry.dy + y * geometry.scale };
 }, { x, y });
}
async function chore(name, trigger, { noCommit, repeatedTouches, screenshot } = {}) {
 const started = Date.now();
 await trigger();
 await page.waitForFunction(() => document.querySelector('#app').getAttribute('aria-busy') === 'true', null, { timeout: 1500 });
 assert.equal(await page.locator('#modal-root').isVisible(), false, `${name} must play in the world`);
 if (repeatedTouches) await repeatedTouches();
 await page.waitForTimeout(300);
 if (noCommit) await noCommit();
 assert.equal(await page.locator('#app').getAttribute('aria-busy'), 'true', `${name} must not give an immediate hidden reward`);
 if (screenshot) { await page.waitForTimeout(1100); await shot(screenshot); }
 await page.waitForFunction(() => !document.querySelector('#app').hasAttribute('aria-busy'), null, { timeout: 30000 });
 const elapsedMs = Date.now() - started;
 timings.push({ name, elapsedMs });
 assert.ok(elapsedMs < 32000, `${name} should finish promptly using real requestAnimationFrame: ${elapsedMs} ms`);
 assert.equal(await page.locator('.chore-status').isVisible(), false, `${name} must release its work indicator`);
 assert.equal(await nav('build').isDisabled(), false, `${name} must restore navigation`);
 assert.equal(await quick('rest').isDisabled(), false, `${name} must restore recovery controls`);
}
async function assertHudFits(width, height) {
 if (!await page.locator('#farm-tray').isVisible()) await touch(nav('farm'));
 assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight + 1), true, `${width}×${height}: no main-screen scrolling`);
 for (const action of ['harvest', 'water', 'plant', 'chop', 'gather', 'rest']) {
  const button = quick(action), box = await button.boundingBox();
  assert.ok(box && box.width >= 44 && box.height >= 44 && box.x >= 0 && box.y >= 0 && box.x + box.width <= width + 1 && box.y + box.height <= height + 1, `${action} needs a visible finger-sized target`);
  const iconBox = await button.locator('.control-icon').boundingBox(), captionBox = await button.locator('small').boundingBox();
  assert.ok(iconBox && captionBox && captionBox.y >= iconBox.y + iconBox.height - 1, `${action}: caption below icon`);
 }
}
async function selectPlot(id) {
 await touch(nav('farm'));
 for (let attempt = 0; attempt < 9; attempt++) {
  if (await page.locator('#plot-action').getAttribute('data-plot') === String(id)) return;
  await touch(page.locator('[data-plot-step="1"]'));
 }
 assert.fail(`Could not select plot ${id}`);
}
async function chooseSeed(button, cropId = 'carrot') {
 if (await page.locator('#planting-toolbar').isVisible() && await page.locator('#planting-toolbar').getAttribute('data-farm-mode') === 'plant') await touch(page.locator('#planting-toolbar [data-seed-change]'));
 else await touch(button);
 if (!await page.locator('#modal-root [data-select-seed]').first().isVisible()) {
  await touch(page.locator('#planting-toolbar [data-seed-change]'));
 }
 assert.equal(await page.locator('#modal-root [data-select-seed]').count(), 6, 'planting offers all six seed varieties');
 const before = await saved();
 await touch(page.locator(`[data-select-seed="${cropId}"]`));
 assert.equal(await page.locator('#modal-root').isVisible(), false);
 assert.equal(await page.locator('#planting-toolbar').isVisible(), true);
 assert.equal((await saved()).resources.seeds, before.resources.seeds, 'seed selection does not consume or plant a seed');
 await settleCamera();
}
async function stopPlanting() {
 if (await page.locator('#planting-toolbar').isVisible()) await touch(page.locator('[data-plant-cancel]'));
}
async function touchPlot(id) {
 const positions = [[-116, 42], [-33, 42], [50, 42], [133, 42], [-116, 122], [-33, 122], [50, 122], [133, 122]];
 const [u, v] = positions[id - 1];
 const x = 480 + (u + 35) * .91 - (v + 36) * .67, y = 420 + (u + 35) * .34 + (v + 36) * .47 - 112;
 const point = await worldPoint(x, y);
 assert.equal(await page.evaluate(point => document.elementFromPoint(point.x, point.y)?.id === 'world', point), true, 'the selected painted plot is clear of HUD overlays');
 await page.touchscreen.tap(point.x, point.y);
}

try {
 for (const width of [360, 390]) {
  const height = width === 360 ? 740 : 844;
  const context = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true });
  await context.addInitScript(() => {
   const fixture = localStorage.getItem('road-haven-touch-fixture');
   if (fixture) { localStorage.setItem('road-haven-save-v1', fixture); localStorage.removeItem('road-haven-touch-fixture'); localStorage.removeItem('road-haven-selected-seed-v1'); }
  });
  page = await context.newPage();
  page.on('pageerror', error => errors.push(`${width}: ${error.message}`));
  page.on('response', response => { if (response.status() >= 400 && ['image', 'font', 'script', 'stylesheet'].includes(response.request().resourceType())) failedAssets.push(`${response.status()} ${response.url()}`); });
  await page.goto(baseUrl);
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  await touch(page.locator(`[data-gender="${width === 360 ? 'female' : 'male'}"]`));
  await page.getByLabel('어떤 이름으로 불러 드릴까요?').fill(`터치${width}`);
  await touch(page.locator('[data-start]'));
  await pauseWorldTime();
  await assertHudFits(width, height);
  const fresh = await saved();
  await shot(`home-${width}`);

  await touch(nav('hunt'));
  await touch(page.locator('#modal-root [data-zone="grove"]'));
  await settleCamera();
  const tree = await worldPoint(98, 554);
  assert.equal(await page.evaluate(point => document.elementFromPoint(point.x, point.y)?.id === 'world', tree), true, 'painted tree must remain touchable through the HUD');
  const beforeTree = await saved();
  const chopBox = await quick('chop').boundingBox();
  await chore(`painted-tree-${width}`, () => page.touchscreen.tap(tree.x, tree.y), {
   noCommit: async () => assert.equal((await saved()).resources.wood, beforeTree.resources.wood),
   repeatedTouches: async () => {
    await page.touchscreen.tap(tree.x, tree.y);
    await page.touchscreen.tap(chopBox.x + chopBox.width / 2, chopBox.y + chopBox.height / 2);
   }, screenshot: `tree-chopping-${width}`,
  });
  assert.equal((await saved()).resources.wood, beforeTree.resources.wood + 18, 'tree touch grants exactly one woodcutting reward');
  assert.equal((await saved()).resources.seeds, beforeTree.resources.seeds + 3);
  assert.equal((await saved()).stats.chops, beforeTree.stats.chops + 1);
  await shot(`grove-${width}`);

  let before = await saved();
  await chore(`grove-context-${width}`, () => touch(page.locator('#plot-action')));
  assert.equal((await saved()).resources.wood, before.resources.wood + 18);
  assert.equal((await saved()).stats.chops, before.stats.chops + 1);

  before = await saved();
  await touch(page.locator('#farm-context [data-open="grove"]'));
  await chore(`grove-guide-${width}`, () => touch(page.locator('#modal-root [data-action="chop"]')));
  assert.equal((await saved()).resources.wood, before.resources.wood + 18);
  before = await saved();
  await chore(`quick-chop-${width}`, () => touch(quick('chop')));
  assert.equal((await saved()).resources.wood, before.resources.wood + 18);

  await touch(nav('bag'));
  await touch(page.locator('#modal-root [data-open="map"]'));
  before = await saved();
  await chore(`map-gather-${width}`, () => touch(page.locator('#modal-root [data-action="gather"]')));
  assert.equal((await saved()).resources.wood, before.resources.wood + 10);
  assert.equal((await saved()).resources.scrap, before.resources.scrap + 5);
  assert.equal((await saved()).stats.gathers, before.stats.gathers + 1);

  await selectPlot(3);
  before = await saved();
  await chooseSeed(page.locator('#plot-action'));
  await chore(`selected-plot-plant-${width}`, () => touchPlot(3));
  assert.notEqual((await saved()).plots[2].plantedAt, null);
  assert.equal((await saved()).resources.seeds, before.resources.seeds - 1);
  assert.equal((await saved()).plots[2].cropId, 'carrot');
  await stopPlanting();
  await chore(`selected-plot-water-${width}`, () => touch(page.locator('#plot-action')));
  assert.equal((await saved()).plots[2].watered, true);
  assert.equal((await saved()).plots[1].watered, false, 'selected watering preserves another dry plot');
  await selectPlot(1);
  await chore(`selected-plot-harvest-${width}`, () => touch(page.locator('#plot-action')));
  assert.equal((await saved()).plots[0].plantedAt, null);
  assert.equal((await saved()).stats.harvests, 1);

  await touch(quick('rest'));
  assert.ok((await saved()).energy > 30);
  await menuItem('expand');
  await chore(`expand-${width}`, () => touch(page.locator('#modal-root [data-action="expand"]')));
  assert.equal((await saved()).deckLevel, 2);
  assert.equal((await saved()).plots.length, 4);
  await shot(`expanded-${width}`);

  // Ordinary real-time battle controls must still work after several chores.
  await touch(nav('hunt'));
  await touch(page.locator('[data-start-hunt]'));
  await page.locator('.battle-screen').waitFor();
  assert.ok((await saved()).expedition);
  await page.waitForTimeout(600);
  await touch(page.getByRole('button', { name: '전투 일시정지', exact: true }));
  const pausedTime = await page.locator('.battle-progress [data-battle-time]').textContent();
  await page.waitForTimeout(1100);
  assert.equal(await page.locator('.battle-progress [data-battle-time]').textContent(), pausedTime);
  await touch(page.locator('[data-battle="resume"]'));
  await touch(page.locator('[data-skill="sweep"]'));
  assert.equal(await page.locator('[data-skill="sweep"]').isDisabled(), true);
  await shot(`battle-${width}`);
  const beforeReturn = await saved();
  await touch(page.locator('[data-battle="retreat"]'));
  await touch(page.locator('[data-battle="confirm-retreat"]'));
  await touch(page.locator('[data-battle="finish"]'));
  assert.equal((await saved()).expedition, null);
  assert.equal((await saved()).resources.food, beforeReturn.resources.food);
  assert.equal((await saved()).stats.battlesWon, beforeReturn.stats.battlesWon);
  assert.equal(await page.locator('#app').evaluate(app => app.inert), false);

  // Installed players can already have exhausted energy or supplies. Test the
  // visible recovery choices without resetting their actual saved progress.
  const exhausted = structuredClone(fresh);
  exhausted.energy = 0;
  exhausted.resources.food = 0;
  exhausted.resources.water = 0;
  exhausted.resources.seeds = 0;
  delete exhausted.seedInventory;
  await fixture(exhausted);
  await touch(nav('hunt'));
  await touch(page.locator('#modal-root [data-zone="grove"]'));
  assert.match(await page.locator('#plot-action small').innerText(), /쉬고/);
  await touch(page.locator('#plot-action'));
  assert.equal(await page.locator('#modal-root').isVisible(), true, 'low-energy tap must explain the obstacle');
  assert.match(await page.locator('.activity-block-reason').innerText(), /기운|기력/);
  await shot(`energy-recovery-${width}`);
  await chore(`rest-and-retry-${width}`, () => touch(page.locator('[data-rest-retry="chop"]')));
  assert.equal((await saved()).resources.wood, exhausted.resources.wood + 18);
  assert.equal((await saved()).stats.chops, exhausted.stats.chops + 1);
  assert.ok((await saved()).energy >= 20, 'free rest makes woodcutting possible without food or water');
  assert.equal((await saved()).resources.food, 0);
  assert.ok((await saved()).resources.water >= 0);

  const noSeeds = structuredClone(fresh);
  noSeeds.resources.seeds = 0;
  delete noSeeds.seedInventory;
  await fixture(noSeeds);
  await touch(quick('plant'));
  assert.equal(await page.locator('#modal-root [data-select-seed]').count(), 6, 'empty inventory still explains all seed varieties');
  assert.match(await page.locator('#modal-root').innerText(), /씨앗/);
  await chore(`missing-seeds-gather-${width}`, () => touch(page.locator('#modal-root [data-seed-gather]')));
  assert.equal((await saved()).resources.seeds, 3);
  await selectPlot(3);
  await chooseSeed(quick('plant'), 'potato');
  await chore(`plant-after-gather-${width}`, () => touchPlot(3));
  assert.equal((await saved()).resources.seeds, 2);
  assert.notEqual((await saved()).plots[2].plantedAt, null);
  assert.equal((await saved()).plots[2].cropId, 'potato', 'gathered seed variety is the crop that gets planted');
  await stopPlanting();

  if (width === 360) {
   // A slow tap crossing a live UI tick should still activate the exact plot
   // and the bag's gathering button. Time remains real and unpaused here.
   await setPaused(false);
   await touch(nav('farm'));
   await touch(page.locator('#farm-context [data-open="farm"]'));
   const touchSession = await context.newCDPSession(page);
   await chore('held-farm-touch-across-tick', () => heldTouch(page.locator('#modal-root [data-action="water"][data-plot="2"]'), touchSession));
   assert.equal((await saved()).plots[1].watered, true);
   await touch(nav('bag'));
   before = await saved();
   await chore('held-bag-touch-across-tick', () => heldTouch(page.locator('#modal-root [data-action="gather"]'), touchSession));
   assert.equal((await saved()).resources.wood, before.resources.wood + 10);
   assert.equal((await saved()).stats.gathers, before.stats.gathers + 1);
   await touchSession.detach();
   await pauseWorldTime();
  }

  if (width === 390) {
   const injured = structuredClone(fresh);
   injured.health = 2;
   injured.energy = 0;
   injured.companions = { dog: { health: 0, xp: 0 }, cat: { health: 0, xp: 0 } };
   await fixture(injured);
   await touch(nav('hunt'));
   await touch(page.locator('[data-stage="2"]'));
   await touch(page.locator('[data-start-hunt]'));
   assert.equal(await page.locator('[data-rest-retry="hunt"]').isVisible(), true, 'an exhausted hunting entry must show a recovery choice');
   await touch(page.locator('[data-rest-retry="hunt"]'));
   assert.equal(await page.locator('[data-stage="2"].selected').isVisible(), true, 'rest preserves the selected hunting destination');
   assert.ok((await saved()).health < 15, 'the farmer remains below the obsolete human combat threshold');
   assert.equal((await saved()).companions.dog.health, 35, 'the actual meal recovers the dog for animal combat');
   assert.equal((await saved()).companions.cat.health, 35, 'the actual meal recovers the cat for animal combat');
   assert.ok((await saved()).energy >= 16, 'the actual rest restores enough entry energy');
   assert.equal(await page.locator('.battle-screen').count(), 0, 'rest never silently starts a battle');
   await touch(page.locator('[data-start-hunt]'));
   await page.locator('.battle-screen').waitFor();
   assert.equal((await saved()).expedition.stage, 2);
   await touch(page.locator('[data-battle="retreat"]'));
   await touch(page.locator('[data-battle="confirm-retreat"]'));
   await touch(page.locator('[data-battle="finish"]'));
   assert.equal((await saved()).expedition, null);

   const growing = structuredClone(fresh);
   growing.plots = growing.plots.map(plot => ({ ...plot, plantedAt: growing.totalMinutes, watered: true }));
   await fixture(growing);
   await touch(quick('harvest'));
   assert.equal(await page.locator('#planting-toolbar[data-farm-mode="harvest"]').isVisible(), true, 'unready harvest remains the continuous in-game tool');
   assert.match(await page.locator('#planting-seed-status').innerText(), /수확할 밭이 없어요|작물이 자라길 기다려요/, 'the in-game tool explains that the new crops must grow first');
   assert.equal(await page.locator('.activity-block-reason').isVisible(), true, 'unready harvest also offers its recovery guidance');
   assert.match(await page.locator('.activity-block-reason').innerText(), /아직 다 자란 작물이 없어요|기다려/, 'the guidance explains the actual maturity boundary');
   await touch(page.locator('[data-show-farm]'));
   assert.equal(await page.locator('#modal-root').isVisible(), false, 'the actual guidance link returns to the in-game farm');
   assert.equal(await page.locator('#app').getAttribute('aria-busy'), null, 'unready crops do not start a fake harvesting animation');
   assert.equal(await nav('farm').getAttribute('aria-current'), 'page');
   assert.equal((await saved()).stats.harvests, growing.stats.harvests, 'an unready harvest never grants a crop reward');
   assert.equal((await saved()).plots.every(plot => plot.plantedAt === growing.totalMinutes && plot.watered), true, 'the declared newly watered crop fixture retains its actual planting boundaries');
   await stopPlanting();
  }

  const late = structuredClone(fresh);
  late.deckLevel = 6;
  late.stats.expansions = 5;
  late.plots = Array.from({ length: 8 }, (_, index) => ({ id: index + 1, plantedAt: null, watered: false }));
  await fixture(late);
  await selectPlot(8);
  await chooseSeed(page.locator('#plot-action'));
  await chore(`max-deck-plot-eight-${width}`, () => touchPlot(8));
  assert.notEqual((await saved()).plots[7].plantedAt, null);
  assert.equal((await saved()).plots.slice(0, 7).every(plot => plot.plantedAt === null), true);
  await stopPlanting();
  await touch(nav('home'));
  await settleCamera();
  await assertHudFits(width, height);
  await shot(`max-deck-${width}`);
  await page.reload();
  await page.locator('#resident-name').getByText(late.name, { exact: true }).waitFor();
  assert.equal((await saved()).deckLevel, 6);
  assert.notEqual((await saved()).plots[7].plantedAt, null, 'successful work survives reload');
  await context.close();
 }

 // A phone struggling to render the painted map must still finish a chore in
 // real seconds. Delay actual RAF callbacks; do not advance or fake timestamps.
 const slowContext = await browser.newContext({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });
 await slowContext.addInitScript(() => {
  const nativeRequest = window.requestAnimationFrame.bind(window);
  const nativeCancel = window.cancelAnimationFrame.bind(window);
  let next = 0;
  const pending = new Map();
  window.requestAnimationFrame = callback => {
   const id = ++next;
   const item = { timer: 0, frame: 0 };
   item.timer = setTimeout(() => {
    item.frame = nativeRequest(timestamp => { pending.delete(id); callback(timestamp); });
   }, 350);
   pending.set(id, item);
   return id;
  };
  window.cancelAnimationFrame = id => {
   const item = pending.get(id);
   if (!item) return;
   clearTimeout(item.timer);
   if (item.frame) nativeCancel(item.frame);
   pending.delete(id);
  };
 });
 page = await slowContext.newPage();
 page.on('pageerror', error => errors.push(`slow RAF: ${error.message}`));
 await page.goto(baseUrl);
 await page.waitForLoadState('networkidle');
 await touch(page.locator('[data-start]'));
 await pauseWorldTime();
 const beforeSlow = await saved();
 if (!await page.locator('#farm-tray').isVisible()) await touch(nav('farm'));
 const slowButtonBox = await quick('chop').boundingBox();
 assert.ok(slowButtonBox, 'the slow-rendering duplicate-touch target is visible after opening the farm tray');
 await chore('woodcutting-at-350ms-visible-frames', () => touch(quick('chop')), {
  noCommit: async () => assert.equal((await saved()).resources.wood, beforeSlow.resources.wood),
  repeatedTouches: async () => page.touchscreen.tap(slowButtonBox.x + slowButtonBox.width / 2, slowButtonBox.y + slowButtonBox.height / 2),
 });
 assert.equal((await saved()).resources.wood, beforeSlow.resources.wood + 18, 'low rendering speed grants one complete woodcutting reward');
 assert.equal((await saved()).stats.chops, beforeSlow.stats.chops + 1);
 await slowContext.close();
 assert.deepEqual(errors, []);
 assert.deepEqual(failedAssets, []);
 await writeFile(`artifacts/mobile-real-time-v${appVersion}-verification.json`, JSON.stringify({
  version: appVersion, status: 'passed', baseUrl, clock: 'Real browser timers and requestAnimationFrame; no page.clock',
  input: 'Touchscreen tap coordinates on mobile contexts', viewports: ['360×740', '390×844'],
  slowRenderingCase: 'Actual requestAnimationFrame callbacks delayed by 350 ms with original browser timestamps',
  startedAt: startedAt.toISOString(), finishedAt: new Date().toISOString(), elapsedMs: Date.now() - startedAt.getTime(),
  assertionsExecuted, timings, screenshots, errors, failedAssets,
 }, null, 2) + '\n');
 console.log(`PASS: ${assertionsExecuted} real-touch assertions; ${timings.length} bounded real-time chores; tree/context/modal/quick woodcutting, gathering, targeted farming, rest, expansion, battle controls, low-energy/low-supply recovery and max-deck save persistence.`);
} catch (error) {
 if (page && !page.isClosed()) await shot('failure').catch(() => {});
 await writeFile(`artifacts/mobile-real-time-v${appVersion}-verification.json`, JSON.stringify({ version: appVersion, status: 'failed', baseUrl, assertionsExecuted, timings, screenshots, errors, failedAssets, failure: String(error) }, null, 2) + '\n');
 throw error;
} finally {
 await browser.close();
}
