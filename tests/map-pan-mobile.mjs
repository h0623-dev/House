import { chromium } from '@playwright/test';
import strictAssert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

// Real CDP touch streams and mouse drags, genuine animation time, read-only
// scene coordinates. The one declared empty-farm save fixture changes no resources.
const version = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')).version;
const baseUrl = process.env.TEST_BASE_URL || 'http://127.0.0.1:5173';
const startedAt = new Date();
await mkdir('artifacts', { recursive: true });
let assertionsExecuted = 0;
const assert = new Proxy(strictAssert, { get(target, key) { const value = Reflect.get(target, key); return typeof value === 'function' ? (...args) => { assertionsExecuted++; return value(...args); } : value; } });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
const errors = [], failedAssets = [], screenshots = [], cases = [], movements = [], timings = [];
let page, context;
const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('road-haven-save-v1')));
const geometry = () => page.locator('#world').evaluate(canvas => JSON.parse(canvas.dataset.sceneGeometry));
const nav = section => page.locator(`[data-nav="${section}"]`);
async function shot(name) { const path = `artifacts/v${version}-map-pan-${name}.png`; await page.screenshot({ path, fullPage: true }); screenshots.push(path); }
async function touch(locator) {
 if (!await locator.isVisible() && await locator.evaluate(element => element.matches('[data-map-zoom],[data-map-reset],[data-map-move]'))) await touch(page.locator('[data-camera-toggle]'));
 if (!await locator.isVisible() && await locator.evaluate(element => Boolean(element.closest('#farm-tray')))) await touch(page.locator('[data-nav="farm"]'));
 await locator.scrollIntoViewIfNeeded(); const box = await locator.boundingBox(); assert.ok(box, 'the control is rendered');
 const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
 assert.equal(await locator.evaluate((button, point) => document.elementFromPoint(point.x, point.y)?.closest('button') === button, point), true, 'the physical finger reaches the intended control');
 await page.touchscreen.tap(point.x, point.y);
}
async function worldAt(point, label = 'map gesture') {
 assert.equal(await page.evaluate(point => document.elementFromPoint(point.x, point.y)?.id === 'world', point), true, `${label} contacts the actual visible canvas`);
}
async function setWorldPaused(paused) {
 await touch(page.locator('[data-open="menu"]')); await touch(page.locator('#modal-root [data-open="settings"]'));
 const button = page.locator('#modal-root [data-pause]'); const currentlyPaused = (await button.innerText()).trim() === '계속하기';
 if (currentlyPaused !== paused) await touch(button);
 await touch(page.locator('#modal-root .modal-close'));
}
async function pauseWorld() { await setWorldPaused(true); }
async function resetView() { await touch(page.locator('[data-map-reset]')); await page.waitForTimeout(850); assert.equal((await geometry()).mapZoom, 1); }
async function handMode(enabled) {
 const control = page.locator('[data-map-move]'); if ((await control.getAttribute('aria-pressed') === 'true') !== enabled) await touch(control);
 assert.equal(await control.getAttribute('aria-pressed'), String(enabled));
}
async function plotPoint(id) {
 return page.locator('#world').evaluate((canvas, id) => {
  const positions = [[-116, 42], [-33, 42], [50, 42], [133, 42], [-116, 122], [-33, 122], [50, 122], [133, 122]], [u, v] = positions[id - 1], g = JSON.parse(canvas.dataset.sceneGeometry), r = canvas.getBoundingClientRect();
  return { x: r.left + g.dx + (480 + (u + 35) * .91 - (v + 36) * .67) * g.scale, y: r.top + g.dy + (420 + (u + 35) * .34 + (v + 36) * .47 - 112) * g.scale };
 }, id);
}
async function slotPoint(id, facility = false) {
 return page.locator('#world').evaluate((canvas, { id, facility }) => { const slot = JSON.parse(canvas.dataset.settlementSlots).find(item => item.slot === id), r = canvas.getBoundingClientRect(); return { x: r.left + (facility ? slot.facilityX : slot.x), y: r.top + (facility ? slot.facilityY : slot.y) }; }, { id, facility });
}
async function facilityActionPoint(id) {
 return page.locator('#world').evaluate((canvas, id) => { const slot = JSON.parse(canvas.dataset.settlementSlots).find(item => item.buildingId === id), r = canvas.getBoundingClientRect(); return { x: r.left + slot.readyX, y: r.top + slot.readyY, action: slot.action }; }, id);
}
async function emptyPoint(delta = { x: 40, y: 0 }, nearPlot) {
 return page.locator('#world').evaluate((canvas, { delta, nearPlot }) => {
  const r = canvas.getBoundingClientRect(), g = JSON.parse(canvas.dataset.sceneGeometry), positions = [[-116, 42], [-33, 42], [50, 42]], radius = Math.max(45 * g.scale, 22);
  const plots = positions.map(([u, v]) => ({ x: r.left + g.dx + (480 + (u + 35) * .91 - (v + 36) * .67) * g.scale, y: r.top + g.dy + (420 + (u + 35) * .34 + (v + 36) * .47 - 112) * g.scale }));
  const points = [];
  for (let y = r.top + 16; y <= r.bottom - 16; y += 8) for (let x = r.left + 16; x <= r.right - 16; x += 8) {
   const point = { x, y }, end = { x: x + delta.x, y: y + delta.y };
   if (document.elementFromPoint(x, y)?.id !== 'world' || document.elementFromPoint(end.x, end.y)?.id !== 'world') continue;
   if (plots.some(plot => Math.hypot(x - plot.x, y - plot.y) < radius + 8)) continue;
   const center = nearPlot ? plots[nearPlot - 1] : { x: r.left + r.width * .46, y: r.top + r.height * .52 };
   points.push({ ...point, distance: Math.hypot(x - center.x, y - center.y) });
  }
  points.sort((a, b) => a.distance - b.distance);
  if (!points.length) throw Error('No unobstructed empty canvas gesture origin found');
  return { x: points[0].x, y: points[0].y };
 }, { delta, nearPlot });
}
async function drag(points, { cancel = false, mouse = false, delay = 35 } = {}) {
 for (const point of [points[0], points.at(-1)]) await worldAt(point);
 if (mouse) {
  await page.mouse.move(points[0].x, points[0].y); await page.mouse.down();
  for (const point of points.slice(1)) { await page.mouse.move(point.x, point.y); await page.waitForTimeout(delay); }
  await page.mouse.up(); return;
 }
 const session = await context.newCDPSession(page);
 await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...points[0], id: 1 }] });
 for (const point of points.slice(1)) { await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...point, id: 1 }] }); await page.waitForTimeout(delay); }
 await session.send('Input.dispatchTouchEvent', { type: cancel ? 'touchCancel' : 'touchEnd', touchPoints: [] }); await session.detach();
}
function dragLine(origin, delta) { return Array.from({ length: 7 }, (_, step) => ({ x: origin.x + delta.x * step / 6, y: origin.y + delta.y * step / 6 })); }
async function pan(label, delta, options = {}) {
 const origin = options.origin || await emptyPoint(delta), before = await geometry();
 await drag(dragLine(origin, delta), options); await page.waitForTimeout(120); const released = await geometry();
 await page.waitForTimeout(620); const settled = await geometry();
 assert.ok(Math.abs(released.dx - before.dx - delta.x) < 7, `${label}: the painted world follows the horizontal finger movement`);
 assert.ok(Math.abs(released.dy - before.dy - delta.y) < 7, `${label}: the painted world follows the vertical finger movement`);
 assert.ok(Math.abs(settled.dx - released.dx) < 2 && Math.abs(settled.dy - released.dy) < 2, `${label}: releasing the finger never snaps the view back (${JSON.stringify({ released, settled })})`);
 assert.ok(Math.abs(settled.scale - before.scale) < .004, `${label}: dragging does not accidentally zoom`);
 movements.push({ label, delta, before, released, settled }); return settled;
}
async function pinch(origin, cancel = false) {
 const session = await context.newCDPSession(page), a = { ...origin, id: 1 }, b = { x: origin.x + 45, y: origin.y + 8, id: 2 };
 await worldAt(a); await worldAt(b);
 await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [a] });
 await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [a, b] });
 for (let step = 1; step <= 6; step++) { await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [a, { ...b, x: b.x + step * 4, y: b.y + step }] }); await page.waitForTimeout(25); }
 await session.send('Input.dispatchTouchEvent', { type: cancel ? 'touchCancel' : 'touchEnd', touchPoints: [] }); await session.detach(); await page.waitForTimeout(500);
}
async function fits(label) {
 if (!await page.locator('[data-map-move]').isVisible()) await touch(page.locator('[data-camera-toggle]'));
 const { width, height } = page.viewportSize();
 assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight + 1), true, `${label}: the screen itself does not scroll`);
 for (const selector of ['[data-map-move]', '[data-map-zoom="1"]', '[data-map-zoom="-1"]', '[data-map-reset]']) {
  const locator = page.locator(selector), box = await locator.boundingBox();
  assert.ok(box && box.width >= 44 && box.height >= 44 && box.x >= 0 && box.y >= 0 && box.x + box.width <= width + 1 && box.y + box.height <= height + 1, `${label}: ${selector} is finger sized and inside the screen`);
  assert.equal(await locator.evaluate((element, box) => document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)?.closest('button') === element, box), true, `${label}: ${selector} is not covered`);
 }
}
async function waitWork() { await page.waitForFunction(() => document.querySelector('#app').hasAttribute('aria-busy'), null, { timeout: 1500 }); }
async function waitIdle(timeout = 30000) { await page.waitForFunction(() => !document.querySelector('#app').hasAttribute('aria-busy'), null, { timeout }); }
async function noWork(before, label) { await page.waitForTimeout(180); assert.equal(await page.locator('#app').getAttribute('aria-busy'), null, `${label}: no accidental job begins`); assert.deepEqual(await saved(), before, `${label}: no resource, seed, or saved progress changes`); }
async function emptyFarmFixture() {
 const state = await saved(); state.name = '화면 이동 검사'; state.plots = state.plots.map(plot => ({ id: plot.id, plantedAt: null, watered: false }));
 await page.evaluate(state => localStorage.setItem('map-pan-empty-farm-fixture', JSON.stringify(state)), state); await page.reload(); await page.locator('#resident-name').getByText(state.name, { exact: true }).waitFor(); await pauseWorld();
 assert.deepEqual((await saved()).resources, state.resources, 'the declared empty-farm fixture preserves every resource');
}
try {
 for (const [width, height] of [[360, 740], [390, 844]]) {
  context = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true });
  await context.addInitScript(() => { const fixture = localStorage.getItem('map-pan-empty-farm-fixture'); if (fixture) { const state = JSON.parse(fixture); state.lastSaved = Date.now(); localStorage.setItem('road-haven-save-v1', JSON.stringify(state)); localStorage.removeItem('map-pan-empty-farm-fixture'); } });
  page = await context.newPage(); page.on('pageerror', error => errors.push(error.message)); page.on('response', response => { if (response.status() >= 400 && ['image', 'font', 'script', 'stylesheet'].includes(response.request().resourceType())) failedAssets.push(`${response.status()} ${response.url()}`); });
  await page.goto(baseUrl); await page.waitForLoadState('networkidle'); await touch(page.locator(`[data-gender="${width === 360 ? 'female' : 'male'}"]`)); await touch(page.locator('[data-start]')); await pauseWorld(); await page.waitForTimeout(1000);
  await fits(`home ${width}`); await handMode(false); const home = await geometry(), initial = await saved();
  for (const [label, delta] of [['right', { x: 48, y: 0 }], ['left', { x: -48, y: 0 }], ['down', { x: 0, y: 40 }], ['up', { x: 0, y: -40 }]]) await pan(`${width} home ${label}`, delta);
  await noWork(initial, 'four-direction home dragging'); assert.equal(await page.locator('#modal-root').isVisible(), false);
  await touch(page.locator('[data-map-zoom="1"]')); await page.waitForTimeout(500); await pan(`${width} zoomed pan`, { x: 38, y: -25 });
  await resetView(); const reset = await geometry(); assert.ok(Math.abs(reset.dx - home.dx) < 2 && Math.abs(reset.dy - home.dy) < 2, 'default view restores the original home composition');
  await pan(`${width} canceled pan`, { x: 34, y: 18 }, { cancel: true }); await noWork(initial, 'canceled drag'); await pan(`${width} drag after cancel`, { x: -34, y: -18 });
  const prePinch = await geometry(), pinchOrigin = await emptyPoint({ x: 74, y: 16 }); await pinch(pinchOrigin, true); assert.ok((await geometry()).mapZoom > prePinch.mapZoom * 1.3, 'two-finger zoom still works after panning and cancellation'); await noWork(initial, 'pinch after pan'); await resetView();
  if (width === 390) { await pan('mouse left-button drag', { x: 42, y: -23 }, { mouse: true }); await noWork(initial, 'mouse drag'); await resetView(); }

  await touch(nav('build')); await touch(page.locator('[data-build-type="waterworks"]')); await page.waitForTimeout(1000); await fits(`construction ${width}`);
  assert.equal(await page.locator('[data-construction-confirm]').isDisabled(), true);
  await pan(`${width} drag from construction slot`, { x: 38, y: 25 }, { origin: await slotPoint(0) });
  assert.equal(await page.locator('[data-construction-confirm]').isDisabled(), true, 'a construction drag never selects a build slot'); assert.deepEqual((await saved()).resources, initial.resources);
  await resetView(); const slot = await slotPoint(0); await worldAt(slot); await page.touchscreen.tap(slot.x, slot.y); assert.equal(await page.locator('[data-construction-confirm]').isDisabled(), false, 'a subsequent ordinary tap still previews a slot');
  await touch(page.locator('[data-construction-confirm]')); let built = await saved(); assert.equal(built.settlement.buildings.length, 1); assert.equal(built.resources.wood, initial.resources.wood - 12); assert.equal(built.resources.scrap, initial.resources.scrap - 4);
  await fits(`selected facility ${width}`); await touch(page.locator('[data-facility-close]')); await touch(nav('home')); await page.waitForTimeout(900); await resetView();
  await pan(`${width} drag starting on a facility`, { x: 32, y: 25 }, { origin: await slotPoint(0, true) });
  assert.equal(await page.locator('#facility-sheet').isVisible(), false, 'dragging a facility does not accidentally open its controls'); assert.equal(await page.locator('#modal-root').isVisible(), false); await noWork(built, 'facility drag'); await resetView();
  const facility = await slotPoint(0, true); await worldAt(facility); await page.touchscreen.tap(facility.x, facility.y); await page.locator('#facility-sheet').waitFor(); await fits(`selected facility after pan ${width}`); await touch(page.locator('[data-facility-close]')); await touch(nav('home')); await page.waitForTimeout(800);
  const idleBubble = await facilityActionPoint(1); assert.equal(idleBubble.action, 'facility-start'); await worldAt(idleBubble); await page.touchscreen.tap(idleBubble.x, idleBubble.y);
  built = await saved(); assert.notEqual(built.settlement.buildings[0].readyAt, null, 'an idle map bubble starts production directly'); assert.equal(await page.locator('#facility-sheet').isVisible(), false, 'a direct production tap does not require the facility sheet');
  assert.deepEqual(built.resources, { ...initial.resources, wood: initial.resources.wood - 12, scrap: initial.resources.scrap - 4 }, 'the free waterworks recipe does not consume unrelated resources');

  await emptyFarmFixture(); await touch(nav('farm')); await touch(page.locator('[data-quick="plant"]')); await touch(page.locator('[data-select-seed="potato"]')); await page.waitForTimeout(1100); await fits(`farm tool ${width}`);
  const beforeFarm = await saved(), plot = await plotPoint(2), empty = await emptyPoint({ x: 0, y: 0 }, 2);
  await pan(`${width} farm empty ground across a plot`, { x: plot.x - empty.x, y: plot.y - empty.y }, { origin: empty });
  await noWork(beforeFarm, 'an empty-ground farm drag crossing a planter'); assert.equal(await page.locator('#planting-toolbar').getAttribute('data-farm-mode'), 'plant'); await resetView();
  await handMode(true); await pan(`${width} hand tool from a planter`, { x: 33, y: -24 }, { origin: await plotPoint(2) }); await noWork(beforeFarm, 'hand mode on a planter');
  const tapped = await plotPoint(3); await worldAt(tapped); await page.touchscreen.tap(tapped.x, tapped.y); await noWork(beforeFarm, 'a hand-mode tap on a planter'); await resetView();
  assert.equal(await page.locator('[data-map-move]').getAttribute('aria-pressed'), 'false', 'the reset button returns to ordinary map interaction'); await handMode(true); await handMode(false);
  const start = Date.now(), single = await plotPoint(3); await worldAt(single); await page.touchscreen.tap(single.x, single.y); await waitWork(); await waitIdle(14000);
  const afterSingle = await saved(); assert.equal(afterSingle.stats.plantings, beforeFarm.stats.plantings + 1); assert.equal(afterSingle.seedInventory.potato, beforeFarm.seedInventory.potato - 1); assert.equal(afterSingle.energy, beforeFarm.energy - 4);
  timings.push({ name: `plant after leaving hand tool ${width}`, elapsedMs: Date.now() - start });
  await drag([await plotPoint(1), await plotPoint(2)], { delay: 70 }); await waitWork(); await waitIdle(25000);
  const afterStroke = await saved(); assert.equal(afterStroke.stats.plantings, beforeFarm.stats.plantings + 3, 'normal planter-to-planter painting still plants continuously'); assert.equal(afterStroke.seedInventory.potato, beforeFarm.seedInventory.potato - 3); assert.equal(afterStroke.energy, beforeFarm.energy - 12); assert.ok(afterStroke.plots.every(plot => plot.cropId === 'potato'));
  assert.equal(await page.locator('#planting-toolbar').getAttribute('data-farm-mode'), 'plant'); await shot(`farm-pan-tool-${width}`); await touch(page.locator('[data-plant-cancel]'));

  await touch(nav('hunt')); await touch(page.locator('[data-zone="grove"]')); await page.waitForTimeout(900); await resetView(); await pan(`${width} grove`, { x: 41, y: 23 }); await shot(`grove-panned-${width}`); await resetView();
  const beforeGather = await saved(), gatherStart = Date.now(); await touch(page.locator('[data-quick="gather"]')); await waitWork(); await page.waitForFunction(() => JSON.parse(document.querySelector('#world').dataset.sceneAction || 'null')?.elapsed > 1, null, { timeout: 3000 });
  await handMode(true); await fits(`working ${width}`);
  const held = await pan(`${width} ongoing gathering`, { x: 38, y: -24 }); const phases = [];
  for (;;) {
   const snapshot = await page.evaluate(() => ({ busy: document.querySelector('#app').getAttribute('aria-busy') === 'true', geometry: JSON.parse(document.querySelector('#world').dataset.sceneGeometry), action: JSON.parse(document.querySelector('#world').dataset.sceneAction || 'null'), state: JSON.parse(localStorage.getItem('road-haven-save-v1')) }));
   if (!snapshot.busy) break;
   const current = snapshot.geometry, action = snapshot.action;
   assert.ok(Math.abs(current.dx - held.dx) < 2 && Math.abs(current.dy - held.dy) < 2 && Math.abs(current.scale - held.scale) < .004, 'the manually placed camera stays fixed while walking, climbing, working and returning');
   assert.deepEqual(snapshot.state.resources, beforeGather.resources, 'moving the view cannot grant materials before work finishes'); if (action) phases.push(action.phase);
   assert.ok(Date.now() - gatherStart < 35000, 'camera control never stalls the actual gathering task'); await page.waitForTimeout(270);
  }
  const gathered = await saved(), finished = await geometry(); assert.ok(phases.includes('working') && phases.includes('returning')); assert.ok(Math.abs(finished.dx - held.dx) < 2 && Math.abs(finished.dy - held.dy) < 2, 'finishing the chore does not snap a user-controlled view back');
  assert.equal(gathered.stats.gathers, beforeGather.stats.gathers + 1); assert.equal(gathered.resources.wood, beforeGather.resources.wood + 10); assert.equal(gathered.resources.scrap, beforeGather.resources.scrap + 5); assert.equal(gathered.resources.seeds, beforeGather.resources.seeds + 3); assert.equal(gathered.energy, beforeGather.energy - 10); await page.waitForTimeout(450); assert.deepEqual((await saved()).resources, gathered.resources, 'a moved camera does not duplicate the reward');
  timings.push({ name: `complete gathering while camera held ${width}`, elapsedMs: Date.now() - gatherStart }); await shot(`finished-work-held-view-${width}`); await resetView();
  await touch(nav('home')); await setWorldPaused(false);
  await page.waitForFunction(() => { const state = JSON.parse(localStorage.getItem('road-haven-save-v1')); return state.totalMinutes >= state.settlement.buildings[0].readyAt; }, null, { timeout: 55000 });
  await pauseWorld(); await resetView(); const readyBubble = await facilityActionPoint(1); assert.equal(readyBubble.action, 'facility-collect'); const beforeCollect = await saved(); await worldAt(readyBubble); await page.touchscreen.tap(readyBubble.x, readyBubble.y);
  const collected = await saved(); assert.equal(collected.resources.water, beforeCollect.resources.water + 4, 'the ready map bubble collects the naturally completed water batch'); assert.equal(collected.settlement.buildings[0].readyAt, null); assert.equal(await page.locator('#facility-sheet').isVisible(), false, 'direct collection keeps the village map available');
  await touch(nav('home')); await page.waitForTimeout(900); await fits(`home after chore ${width}`); await shot(`home-controls-${width}`);
  if (width === 390) { await page.setViewportSize({ width: 844, height: 390 }); await page.waitForTimeout(900); await fits('landscape'); await pan('landscape', { x: 45, y: 20 }); await handMode(true); await fits('landscape hand tool'); await shot('landscape'); }
  cases.push(`${width}px: expandable camera controls, four-direction and zoomed pan, persistence and reset, cancellation and subsequent pinch, construction drag versus tap, facility drag versus tap, direct map production start and naturally completed batch collection, empty-ground farming versus continuous plot painting, explicit hand tool, full gathering during fixed manual camera.`);
  await context.close();
 }
 assert.deepEqual(errors, []); assert.deepEqual(failedAssets, []);
 await writeFile(`artifacts/map-pan-v${version}-verification.json`, JSON.stringify({ version, status: 'passed', baseUrl, assertionsExecuted, startedAt: startedAt.toISOString(), finishedAt: new Date().toISOString(), input: 'Actual CDP touchscreen touchStart/touchMove/touchEnd/touchCancel, actual mouse down/move/up; no synthetic DOM pointer events or direct scene calls', clock: 'Real animation time', fixture: 'One saved empty-farm fixture per viewport; all resource quantities preserved', viewports: ['360×740', '390×844', '844×390'], cases, movements, timings, screenshots, errors, failedAssets }, null, 2) + '\n');
 console.log(`PASS: ${assertionsExecuted} map panning assertions across ${movements.length} physical drags.`);
} catch (error) {
 if (page && !page.isClosed()) await shot('failure').catch(() => {});
 await writeFile(`artifacts/map-pan-v${version}-verification.json`, JSON.stringify({ version, status: 'failed', baseUrl, assertionsExecuted, cases, movements, timings, screenshots, errors, failedAssets, failure: String(error) }, null, 2) + '\n'); throw error;
} finally { await browser.close(); }
