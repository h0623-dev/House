import { chromium } from '@playwright/test';
import strictAssert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { captureExecutionInputs } from './release-execution-inputs.mjs';

// Native mobile fingers, ordinary settings and natural RAF/game time. Fixtures
// come from the actual domain before a browser starts; no clock, wallet, crop
// inventory, movement destination or game method is injected during play.
const version = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')).version;
const baseUrl = process.env.TEST_BASE_URL ?? 'http://127.0.0.1:5173/';
const snapshotId = process.env.TEST_SNAPSHOT_ID ?? 'mutable-development-diagnostic';
const finalSnapshot = process.env.TEST_FINAL_SNAPSHOT === '1';
const diagnosticOnly = process.env.TEST_GAMEPLAY_OUTDOOR_DIAGNOSTIC === '1';
const runId = String(Date.now());
if (finalSnapshot === diagnosticOnly) throw Error('Choose one immutable final snapshot or mutable development diagnostic.');
const executionInputs = await captureExecutionInputs(import.meta.url, { snapshotId, finalSnapshot });
const sha = value => createHash('sha256').update(value).digest('hex');
let assertionsExecuted = 0;
const assert = new Proxy(strictAssert, { get(target, key) { const value = Reflect.get(target, key); return typeof value === 'function' ? (...args) => { assertionsExecuted++; return value(...args); } : value; } });
const receipt = { version, baseUrl, snapshotId, finalSnapshot, diagnosticOnly, runId, executionInputs,
  status: 'running', startedAt: new Date().toISOString(),
  scope: 'Chromium mobile emulation, actual touchscreen controls and natural animation/game seconds; no physical-phone or earned-test-fixture claim.',
  fixtures: [], inputs: [], guards: [], farming: [], deliveries: [], shop: [], walks: [], collections: [], pans: [], screenshots: [], httpIdentity: [], errors: [], failedAssets: [] };
let browser, context, page, currentCase = 'preflight';
const stable = state => { const copy = structuredClone(state); delete copy.lastSaved; return copy; };
const nonClock = state => { const copy = stable(state); for (const key of ['day', 'minutes', 'totalMinutes']) delete copy[key]; return copy; };
const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('road-haven-save-v1')));
const xy = point => Array.isArray(point) ? { x: point[0], y: point[1] } : point;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function domain(operation, input = {}, item = '', quantity = 1) {
  const script = `import {createGame,saveGame,loadGame,performAction,getCropProgress} from './src/game.ts';
import {getFarmEconomy,getFarmOrder,fulfillFarmOrder,getFarmPlotCare} from './src/farm-economy.ts';
import {getShop,buyShopSeed} from './src/shop.ts';
import {performRoadsideAction,getRoadsideProgress,getRoadsideSite} from './src/roadside.ts';
import {GAME_SPEED_MULTIPLIER} from './src/game-speed.ts';
import {GAME_MINUTES_PER_SECOND} from './src/game-time.ts';
const operation=process.argv[1],state=JSON.parse(process.argv[2]),item=process.argv[3],quantity=Number(process.argv[4]);
let raw;const store={getItem:()=>raw??null,setItem:(key,value)=>raw=value};
if(operation==='fresh')console.log(JSON.stringify(createGame('female','도로 농장 검수')));
else if(operation==='validate'){const accepted=saveGame(state,store),loaded=loadGame(store);console.log(JSON.stringify({accepted,loaded,farm:getFarmEconomy(state),order:getFarmOrder(state),shop:getShop(state),speed:GAME_SPEED_MULTIPLIER,minutesPerSecond:GAME_MINUTES_PER_SECOND}));}
else if(operation==='action')console.log(JSON.stringify(performAction(state,item,quantity,'carrot',{advanceClock:false})));
else if(operation==='deliver')console.log(JSON.stringify(fulfillFarmOrder(state,item)));
else if(operation==='seed')console.log(JSON.stringify(buyShopSeed(state,item,quantity)));
else if(operation==='care')console.log(JSON.stringify(getFarmPlotCare(state,state.plots.find(plot=>plot.id===quantity))));
else if(operation==='order')console.log(JSON.stringify(getFarmOrder(state)));
else if(operation==='collect')console.log(JSON.stringify(performRoadsideAction(state,item)));
else if(operation==='roadside')console.log(JSON.stringify({progress:getRoadsideProgress(state),view:getRoadsideSite(state,item)}));
else throw Error('Unknown fixture/domain check');`;
  const result = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script, operation, JSON.stringify(input), item, String(quantity)], { encoding: 'utf8' });
  assert.equal(result.status, 0, `actual TypeScript domain executes: ${result.stderr}`);
  return JSON.parse(result.stdout);
}

async function fixture(legacy = false) {
  let input = domain('fresh'), provenance = { kind: 'actual-createGame', earned: false,
    declaration: 'Unmodified ordinary new-game starting resources and old planted crops. No fixture coins, typed crop stock, fertilizer, progress or elapsed growth is granted.' };
  if (legacy) {
    const path = 'artifacts/truck-floors-v0.21.0-paid-save.json', bytes = await readFile(path), previous = JSON.parse(bytes);
    assert.equal(sha(bytes), '6d215de7d0c98fe03a837fc96db38343790b158a8250a965a0fb4a690225bbc3');
    assert.equal(previous.sha256OfSave, sha(JSON.stringify(previous.save)));
    input = structuredClone(previous.save);
    provenance = { kind: 'previous-paid-three-floor-fixture', path, sha256: sha(bytes), earned: false,
      declaration: 'Existing previously validated paid-floor save reused without new grants. Preserves all crops, animal HP/XP, floors and pending production; no new wallet, crop stock or outdoor collection is inserted.' };
  }
  const checked = domain('validate', input);
  assert.equal(checked.accepted, true); assert.deepEqual(stable(checked.loaded), stable(input));
  assert.equal(checked.speed, 2); assert.equal(checked.minutesPerSecond, 4);
  assert.equal(checked.shop.coins, 0); assert.equal(Object.hasOwn(input, 'farmEconomy'), false);
  assert.equal(Object.values(checked.farm.crops).reduce((sum, n) => sum + n, 0), 0, 'old general food does not become newly typed harvested produce');
  return { save: checked.loaded, provenance };
}

async function frame() {
  return page.locator('#world').evaluate(canvas => ({
    geometry: JSON.parse(canvas.dataset.sceneGeometry), movement: JSON.parse(canvas.dataset.freeMovement),
    action: JSON.parse(canvas.dataset.sceneAction), hits: JSON.parse(canvas.dataset.sceneHits),
    ground: canvas.dataset.outdoorGround ? JSON.parse(canvas.dataset.outdoorGround) : null,
    outfit: JSON.parse(canvas.dataset.survivorOutfit), pets: JSON.parse(canvas.dataset.petMotion || '[]'), rect: canvas.getBoundingClientRect().toJSON()
  }));
}
async function touch(locator) {
  await locator.scrollIntoViewIfNeeded();
  await locator.evaluate(async element => { const animations = []; for (let node = element; node; node = node.parentElement) animations.push(...node.getAnimations().filter(a => a.effect?.getComputedTiming().iterations !== Infinity)); await Promise.all(animations.map(a => a.finished.catch(() => {}))); });
  const box = await locator.boundingBox();
  assert.ok(box && box.width >= 44 && box.height >= 44, `entire actionable control measures at least44px: ${JSON.stringify(box)}`);
  const client = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  assert.equal(await locator.evaluate((button, point) => document.elementFromPoint(point.x, point.y)?.closest('button') === button, client), true, 'the real finger reaches the intended control');
  assert.ok(box.x >= -1 && box.y >= -1 && box.x + box.width <= page.viewportSize().width + 1 && box.y + box.height <= page.viewportSize().height + 1, 'the entire actionable control fits after actual scrolling');
  receipt.inputs.push({ case: currentCase, kind: 'native-touchscreen-tap', client, bounds: box, label: await locator.getAttribute('aria-label') ?? await locator.innerText() });
  await page.touchscreen.tap(client.x, client.y);
}
async function closeModal() { if (await page.locator('#modal-root').isVisible()) await touch(page.locator('#modal-root [data-close]').first()); }
async function setPaused(paused) {
  await closeModal(); await touch(page.locator('[data-open="menu"]')); await touch(page.locator('#modal-root [data-open="settings"]'));
  if ((await page.locator('.time-button').getAttribute('aria-label') === '시간 계속') !== paused) await touch(page.locator('#modal-root [data-pause]'));
  await touch(page.locator('#modal-root [data-save]')); await closeModal();
  assert.equal(await page.locator('.time-button').getAttribute('aria-label'), paused ? '시간 계속' : '시간 일시정지');
  return Date.now();
}
async function settled() {
  await page.evaluate(() => { window.__outdoorCameraLast = null; window.__outdoorCameraStable = 0; });
  await page.waitForFunction(() => {
    const data = document.querySelector('#world')?.dataset; if (!data?.sceneGeometry || !data.freeMovement) return false;
    const g = JSON.parse(data.sceneGeometry), m = JSON.parse(data.freeMovement), prior = window.__outdoorCameraLast;
    if (prior?.at === m.frameAt) return false;
    window.__outdoorCameraLast = { at: m.frameAt, dx: g.dx, dy: g.dy, scale: g.scale };
    window.__outdoorCameraStable = prior && Math.abs(g.dx - prior.dx) < .25 && Math.abs(g.dy - prior.dy) < .25 && Math.abs(g.scale - prior.scale) < .0005 ? window.__outdoorCameraStable + 1 : 0;
    return window.__outdoorCameraStable >= 3;
  }, null, { timeout: 5000 });
}
async function shot(label) {
  await page.evaluate(async () => { await Promise.all(document.getAnimations().filter(a => a.effect?.getComputedTiming().iterations !== Infinity).map(a => a.finished.catch(() => {}))); });
  const path = `artifacts/v${version}-gameplay-outdoor-${diagnosticOnly ? `diagnostic-${runId}-` : ''}${String(receipt.screenshots.length + 1).padStart(2, '0')}-${label}.png`;
  await page.screenshot({ path, fullPage: true }); const bytes = await readFile(path);
  receipt.screenshots.push({ path, bytes: bytes.length, sha256: sha(bytes) });
}
async function begin(width, height, input) {
  currentCase = `${width}x${height}`;
  context = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, reducedMotion: width === 390 ? 'no-preference' : 'reduce' });
  await context.addInitScript(save => { if (sessionStorage.getItem('outdoor-fixture-installed')) return; save.lastSaved = Date.now(); localStorage.setItem('road-haven-save-v1', JSON.stringify(save)); sessionStorage.setItem('outdoor-fixture-installed', 'true'); }, input.save);
  page = await context.newPage();
  page.on('pageerror', error => receipt.errors.push({ case: currentCase, message: error.message }));
  page.on('response', response => { if (response.status() >= 400 && ['script', 'stylesheet', 'image', 'font'].includes(response.request().resourceType())) receipt.failedAssets.push({ case: currentCase, status: response.status(), url: response.url() }); });
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('#world')?.dataset.freeMovement && !document.querySelector('[data-startup-patch]') && !document.querySelector('#app')?.inert, null, { timeout: 15000 });
  await setPaused(true); await settled();
  const loaded = await saved(); assert.deepEqual(nonClock(loaded), nonClock(input.save), 'startup preserves the entire previous non-clock save and paid pending work');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'mobile page has no horizontal overflow');
  const f = await frame();
  assert.ok(f.movement.world.roadOuterBounds.right - f.movement.world.roadOuterBounds.left > 1000, 'the real physical road is substantially wider than the former275px strip');
  assert.ok(f.movement.world.roadOuterBounds.bottom - f.movement.world.roadOuterBounds.top > 400, 'the physical road also provides room vertically below the truck');
  receipt.fixtures.push({ viewport: { width, height }, ...input, loaded, initialFrame: f });
  await shot(`${width}-new-village`);
}

function inside(point, polygon) {
  let result = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) { const a = xy(polygon[i]), b = xy(polygon[j]); if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) result = !result; }
  return result;
}
function edgeDistance(point, polygon) {
  return Math.min(...polygon.map((vertex, i) => { const a = xy(vertex), b = xy(polygon[(i + 1) % polygon.length]), vx = b.x - a.x, vy = b.y - a.y, t = Math.max(0, Math.min(1, ((point.x - a.x) * vx + (point.y - a.y) * vy) / (vx * vx + vy * vy))); return Math.hypot(point.x - a.x - t * vx, point.y - a.y - t * vy); }));
}
async function observe(label) {
  await page.evaluate(label => {
    const canvas = document.querySelector('#world'); window.__outdoorFrames = []; let last = -Infinity;
    const capture = () => { const m = JSON.parse(canvas.dataset.freeMovement); if (m.frameAt - last < 40) return; last = m.frameAt;
      const action = JSON.parse(canvas.dataset.sceneAction), state = JSON.parse(localStorage.getItem('road-haven-save-v1'));
      window.__outdoorFrames.push({ label, at: performance.now(), movement: m, action, outfit: JSON.parse(canvas.dataset.survivorOutfit),
        account: { resources: state.resources, energy: state.energy, farmEconomy: state.farmEconomy, shop: state.shop, stats: state.stats } }); };
    capture(); window.__outdoorObserver = new MutationObserver(capture); window.__outdoorObserver.observe(canvas, { attributes: true, attributeFilter: ['data-free-movement', 'data-scene-action', 'data-survivor-outfit'] });
  }, label);
}
async function stopObserve() { return page.evaluate(() => { window.__outdoorObserver.disconnect(); return window.__outdoorFrames; }); }
function assertPhysical(frames, label) {
  assert.ok(frames.length >= 3, `${label}: multiple natural rendered frames observed`);
  const proof = [];
  for (let i = 0; i < frames.length; i++) {
    const m = frames[i].movement;
    if (m.surface === 'road') {
      const bounds = m.world.roadOuterBounds, p = m.position, radius = m.body.radius;
      assert.ok(p.x - radius >= bounds.left - .05 && p.x + radius <= bounds.right + .05 && p.y - radius >= bounds.top - .05 && p.y + radius <= bounds.bottom + .05, `${label}: the entire hero stays within the road`);
      for (const obstacle of m.world.obstacles.filter(o => o.surface === 'road')) {
        assert.equal(inside(p, obstacle.polygon), false, `${label}: road feet avoid physical scenery`);
        assert.ok(edgeDistance(p, obstacle.polygon) >= radius - .25, `${label}: the full character body clears road scenery`);
      }
    }
    if (!i) continue; const previous = frames[i - 1].movement, dt = (m.frameAt - previous.frameAt) / 1000;
    assert.ok(dt >= 0, `${label}: observed natural scene time is monotonic`);
    const travelled = distance(previous.position, m.position), allowed = dt * 420 + 1.5;
    assert.ok(travelled <= allowed, `${label}: natural walking, ladder and work do not teleport the hero`);
    proof.push({ at: m.frameAt, seconds: dt, travelled, allowed, from: previous.position, to: m.position, surface: m.surface });
  }
  return proof;
}

async function canvasOrigin() {
  return page.locator('#world').evaluate(canvas => { const r = canvas.getBoundingClientRect();
    const candidates = []; for (let y = r.top + 35; y < r.bottom - 35; y += 12) for (let x = r.left + 35; x < r.right - 35; x += 12) {
      if ([-23, 0, 23].every(dx => [-23, 0, 23].every(dy => document.elementFromPoint(x + dx, y + dy)?.id === 'world'))) candidates.push({ x, y, rank: Math.hypot(x - (r.left + r.right) / 2, y - (r.top + r.bottom) / 2) });
    } candidates.sort((a, b) => a.rank - b.rank); return candidates[0]; });
}
async function pan(delta, label) {
  const origin = await canvasOrigin(); assert.ok(origin, 'a real unobstructed44px canvas origin exists for panning');
  const before = await frame(), state = await saved(), session = await context.newCDPSession(page);
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: origin.x, y: origin.y, id: 1 }] });
  for (let i = 1; i <= 6; i++) { await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: origin.x + delta.x * i / 6, y: origin.y + delta.y * i / 6, id: 1 }] }); await page.waitForTimeout(25); }
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await session.detach(); await settled();
  const after = await frame(); assert.deepEqual(stable(await saved()), stable(state), 'native camera dragging spends no resources and performs no work');
  assert.equal(after.movement.moving, false, 'a camera drag never becomes an unintended walking tap');
  receipt.pans.push({ case: currentCase, label, origin, delta, before, after });
}
async function revealWorld(point) {
  for (let attempt = 0; attempt < 15; attempt++) {
    await settled(); const f = await frame(), screen = { x: f.rect.x + f.geometry.dx + point.x * f.geometry.scale, y: f.rect.y + f.geometry.dy + point.y * f.geometry.scale };
    const clear = await page.evaluate(p => [-23, 0, 23].every(dx => [-23, 0, 23].every(dy => document.elementFromPoint(p.x + dx, p.y + dy)?.id === 'world')), screen);
    if (clear) return { world: point, screen, frame: f };
    const origin = await canvasOrigin(); assert.ok(origin);
    const delta = { x: Math.max(-70, Math.min(70, origin.x - screen.x)), y: Math.max(-70, Math.min(70, origin.y - screen.y)) };
    assert.ok(Math.hypot(delta.x, delta.y) > 2, 'camera reveal has a meaningful real drag');
    await pan(delta, `reveal world${point.x},${point.y}`);
  }
  throw Error(`Native camera drags did not reveal world${JSON.stringify(point)}`);
}
async function mapTouch(point, label) {
  assert.equal(await page.evaluate(p => document.elementFromPoint(p.x, p.y)?.id === 'world', point), true, 'the actual map destination is touchable');
  await page.locator('#world').evaluate(canvas => { window.__outdoorLastTouch = null; canvas.addEventListener('pointerup', event => { const g = JSON.parse(canvas.dataset.sceneGeometry), r = canvas.getBoundingClientRect(); window.__outdoorLastTouch = { at: performance.now(), client: { x: event.clientX, y: event.clientY }, world: { x: (event.clientX - r.left - g.dx) / g.scale, y: (event.clientY - r.top - g.dy) / g.scale } }; }, { capture: true, once: true }); });
  await page.touchscreen.tap(point.x, point.y); const actual = await page.evaluate(() => window.__outdoorLastTouch);
  assert.ok(actual, 'native pointer release was actually observed'); receipt.inputs.push({ case: currentCase, kind: 'native-map-touch', label, requested: point, actual }); return actual;
}
async function waitWalk(label, before, destination, expectedSurface, beginInput) {
  const stateBefore = await saved(); await observe(label); await beginInput();
  await page.waitForFunction(() => JSON.parse(document.querySelector('#world').dataset.freeMovement).moving, null, { timeout: 1800 });
  const accepted = await frame();
  assert.equal(accepted.movement.target.surface, expectedSurface, 'accepted native destination has the intended physical surface');
  if (destination) assert.ok(distance(accepted.movement.target, destination) < 8, 'native walking targets the terrain under the released finger');
  await page.waitForFunction(() => !JSON.parse(document.querySelector('#world').dataset.freeMovement).moving, null, { timeout: 18000 });
  const frames = await stopObserve(), final = await frame(), proof = assertPhysical(frames, label);
  assert.equal(final.movement.surface, expectedSurface); assert.ok(distance(final.movement.position, accepted.movement.target) < 2, 'hero really arrives at the selected physical feet');
  assert.deepEqual(stable(await saved()), stable(stateBefore), 'free movement does not manufacture or spend gameplay resources');
  const result = { case: currentCase, label, before, destination, accepted, final, frames, proof, stateBefore, stateAfter: await saved() }; receipt.walks.push(result); return result;
}
async function roadFreedom() {
  await closeModal(); await touch(page.locator('.game-nav [data-nav="home"]')); await settled();
  let before = await frame(); assert.equal(before.movement.surface, 'deck');
  const descend = await waitWalk('actual ladder descent to broad road', before, null, 'road', () => touch(page.locator('.road-controls [data-road-walk]')));
  assert.ok(descend.frames.some(f => f.movement.surface === 'ladder' && f.movement.pose === 'climb'), 'the hero physically climbs down instead of teleporting');
  const m = descend.final.movement, bounds = m.world.roadBounds, polygon = m.world.deckPolygon;
  const candidates = [];
  for (let y = bounds.top + 5; y < Math.min(bounds.bottom, Math.max(...polygon.map(p => p.y))); y += 8) for (let x = Math.max(bounds.left + 5, Math.min(...polygon.map(p => p.x))); x < Math.min(bounds.right - 5, Math.max(...polygon.map(p => p.x))); x += 8) {
    const p = { x, y }; if (!inside(p, polygon) || distance(p, m.position) < 85) continue;
    if (m.world.obstacles.filter(o => o.surface === 'road').some(o => inside(p, o.polygon) || edgeDistance(p, o.polygon) < m.body.radius + 2)) continue;
    candidates.push({ ...p, rank: Math.hypot(p.x - 480, p.y - 420) });
  }
  candidates.sort((a, b) => a.rank - b.rank); assert.ok(candidates.length, 'actual whole-body-clear road overlaps the projected truck');
  const beneath = await revealWorld({ x: candidates[0].x, y: candidates[0].y });
  const under = await waitWalk('native road tap beneath projected truck', await frame(), beneath.world, 'road', () => mapTouch(beneath.screen, 'beneath truck'));
  assert.equal(inside(under.final.movement.position, under.final.movement.world.deckPolygon), true, 'the hero reaches road beneath the truck projection');
  assert.equal(under.final.ground.cutaway, true); assert.equal(under.final.ground.truckOpacity, .42, 'the truck becomes transparent so the character below it stays visible');
  assert.equal(under.final.ground.roadActorLayer, 'above-cutaway-truck', 'the actual ground-actor rendering branch runs after the translucent truck layers');
  assert.equal(under.final.outfit.imageReady, true, 'actual survivor artwork has decoded before under-truck inspection');
  assert.equal(under.final.outfit.floor, 1); assert.equal(under.final.outfit.activeFloor, 1);
  assert.ok(distance(under.final.outfit, under.final.movement.position) < .01, 'the actually painted character follows the physical road feet below the truck');
  await shot(`${page.viewportSize().width}-beneath-truck`);
  const outer = under.final.movement.world.roadOuterBounds, radius = under.final.movement.body.radius;
  const outskirts = await revealWorld({ x: outer.right - radius - 110, y: outer.bottom - radius - 60 });
  const wide = await waitWalk('native walk beyond former narrow road bounds', await frame(), outskirts.world, 'road', () => mapTouch(outskirts.screen, 'wide road outskirts'));
  assert.ok(wide.final.movement.position.x > 340 || wide.final.movement.position.y > 685, 'real destination lies outside the former road rectangle');
  await shot(`${page.viewportSize().width}-road-outskirts`);
  const returning = await waitWalk('explicit ladder return from distant road', await frame(), null, 'deck', () => touch(page.locator('.road-controls [data-road-return]')));
  assert.ok(returning.frames.some(f => f.movement.surface === 'ladder' && f.movement.pose === 'climb'), 'returning physically climbs the ladder');
  await settled();
}

async function deliveryPanel() {
  await openFarmDetails();
  await touch(page.locator('#modal-root [data-open="farm-delivery"]'));
  assert.equal(await page.locator('[data-farm-delivery-panel]').count(), 1);
}
async function deliveryGuards() {
  const before = await saved(); await deliveryPanel();
  const order = domain('order', before); assert.equal(order.id, 'farm-order-1'); assert.equal(order.ready, false);
  assert.equal(await page.locator('[data-farm-crop-count]').count(), 6, 'all six real harvested crop types have visible stock');
  for (const id of ['carrot', 'potato', 'tomato', 'corn', 'strawberry', 'pumpkin']) assert.equal(await page.locator(`[data-farm-crop-count="${id}"]`).innerText(), '0', 'old food and old growing crops have no fabricated harvested stock');
  const deliver = page.locator('[data-farm-deliver="farm-order-1"]'); assert.equal(await deliver.isDisabled(), true);
  await touch(deliver); assert.deepEqual(stable(await saved()), stable(before), 'real disabled delivery never grants free coins or construction resources');
  receipt.guards.push({ case: currentCase, kind: 'old-food-not-typed-crops-and-unfunded-order', before, after: await saved(), order });
  await shot(`${page.viewportSize().width}-delivery-start`); await closeModal();
}
async function roadsideCatalog() {
  const before = await saved(); await touch(page.locator('.road-controls [data-open="roadside"]'));
  assert.equal(await page.locator('[data-roadside-card]').count(), 4, 'four distinct real road resource places are available');
  const catalog = [];
  for (const id of ['grove', 'salvage', 'seed-meadow', 'spring']) {
    await touch(page.locator(`[data-outdoor-site="${id}"]`));
    const collect = page.locator(`[data-outdoor-collect="${id}"]`); await collect.scrollIntoViewIfNeeded();
    await collect.evaluate(async element => { const animations = []; for (let node = element; node; node = node.parentElement) animations.push(...node.getAnimations().filter(a => a.effect?.getComputedTiming().iterations !== Infinity)); await Promise.all(animations.map(a => a.finished.catch(() => {}))); });
    const box = await collect.boundingBox(); assert.ok(box && box.width >= 44 && box.height >= 44, 'the actual site work control meets44px');
    assert.equal(await collect.isDisabled(), false, 'fresh road place is actually ready'); catalog.push({ id, bounds: box });
    await touch(page.locator('#modal-root [data-open="roadside"]'));
  }
  assert.deepEqual(stable(await saved()), stable(before), 'viewing every resource place never awards materials or consumes energy');
  receipt.guards.push({ case: currentCase, kind: 'four-native-site-previews-no-rewards', catalog, before, after: await saved() });
  await shot(`${page.viewportSize().width}-road-resource-places`); await closeModal();
}
async function openFarmDetails() {
  await closeModal(); await touch(page.locator('.game-nav [data-nav="farm"]'));
  await touch(page.locator('#farm-tray [data-open="farm"]'));
}
async function farmJob(kind, start) {
  const before = await saved(), expected = domain('action', before, kind, 3); assert.equal(expected.ok, true, `actual ${kind} domain precondition holds`);
  await observe(`animated ${kind} on new plot3`); const beganAt = Date.now(); await start();
  await page.waitForFunction(() => document.querySelector('#app')?.getAttribute('aria-busy') === 'true', null, { timeout: 1800 });
  await page.waitForFunction(() => !document.querySelector('#app')?.hasAttribute('aria-busy'), null, { timeout: 18000 });
  const frames = await stopObserve(), after = await saved(); assert.deepEqual(stable(after), stable(expected.state), 'the native animated farm action commits exactly one actual domain transition');
  const working = frames.filter(f => f.action.kind === kind && f.action.phase === 'working'); assert.ok(working.length >= 3, 'a visible naturally timed farm work motion occurs');
  assert.ok(working.every(f => f.action.work >= .75 && f.action.work <= .9), 'farm work retains the chosen shared2× pace');
  assert.ok(working.some(f => f.outfit.pose === ({ plant: 'sow', water: 'water', fertilize: 'sow', harvest: 'harvest' })[kind]), 'the actual character artwork performs the intended farm motion');
  receipt.farming.push({ case: currentCase, kind, plotId: 3, before, after, expected: expected.state, elapsedMs: Date.now() - beganAt, frames, physicalProof: assertPhysical(frames, kind) });
  if (await page.locator('[data-plant-cancel]').isVisible()) await touch(page.locator('[data-plant-cancel]'));
  return after;
}
async function farmingAndDelivery() {
  await touch(page.locator('.game-nav [data-nav="farm"]')); await touch(page.locator('#farm-tray [data-quick="plant"]'));
  await touch(page.locator('[data-select-seed="carrot"]')); await settled();
  await farmJob('plant', async () => { const f = await frame(), hit = f.hits.find(h => h.kind === 'farm' && h.plotId === 3); assert.ok(hit, 'ordinary third plot is present');
    const p = { x: f.rect.x + f.geometry.dx + hit.x * f.geometry.scale, y: f.rect.y + f.geometry.dy + hit.y * f.geometry.scale }; await mapTouch(p, 'new carrot seed on ordinary plot3'); });
  await openFarmDetails(); await farmJob('water', () => touch(page.locator('[data-action="water"][data-plot="3"]')));
  await openFarmDetails(); const cared = await farmJob('fertilize', () => touch(page.locator('[data-action="fertilize"][data-plot="3"]')));
  assert.equal(cared.resources.food, receipt.farming.at(-1).before.resources.food - 1); assert.equal(cared.energy, receipt.farming.at(-1).before.energy - 2);
  assert.equal(domain('care', cared, '', 3).yieldAmount, 6, 'one paid nutrient application adds exactly two carrots to the ordinary four');
  await openFarmDetails(); const duplicate = page.locator('[data-action="fertilize"][data-plot="3"]'); assert.equal(await duplicate.isDisabled(), true);
  await touch(duplicate); assert.deepEqual(stable(await saved()), stable(cared), 'native duplicate nutrient control cannot spend resources twice');
  receipt.guards.push({ case: currentCase, kind: 'one-nutrient-application-per-planting', before: cared, after: await saved() }); await shot('390-paid-crop-care');
  await setPaused(false); const resumed = Date.now(), beforeGrowing = await saved(), plot = beforeGrowing.plots.find(p => p.id === 3);
  const expectedMs = Math.max(0, (plot.plantedAt + 180 - beforeGrowing.totalMinutes) / 4 * 1000);
  await openFarmDetails();
  await page.waitForFunction(() => document.querySelector('[data-action="harvest"][data-plot="3"]'), null, { timeout: 56000 });
  const elapsedMs = Date.now() - resumed;
  assert.ok(elapsedMs >= expectedMs - 1800 && elapsedMs <= expectedMs + 5500, `the planted carrot grows in natural2× game time: observed${elapsedMs}ms, expected${expectedMs}ms`);
  await setPaused(true); const matured = await saved(); await openFarmDetails();
  await farmJob('harvest', () => touch(page.locator('[data-action="harvest"][data-plot="3"]')));
  const harvest = await saved(); assert.equal(harvest.farmEconomy.crops.carrot, 6, 'actual new cared crop harvest yields six typed carrots');
  assert.equal(harvest.farmEconomy.fertilizedPlots.length, 0, 'harvesting retires nutrient care for that exact planting batch');
  receipt.farming.push({ case: currentCase, kind: 'natural-growth', resumed, elapsedMs, expectedMs, before: beforeGrowing, matured });
  await deliveryPanel(); const before = await saved(), order = domain('order', before), expected = domain('deliver', before, order.id); assert.equal(expected.ok, true); assert.equal(order.ready, true);
  await touch(page.locator(`[data-farm-deliver="${order.id}"]`)); const delivered = await saved(); assert.deepEqual(stable(delivered), stable(expected.state), 'native crop delivery spends its actual new harvest and grants its exact reward once');
  assert.equal(delivered.farmEconomy.crops.carrot, 3); assert.equal(delivered.resources.food, before.resources.food - 3); assert.equal(delivered.shop.coins, 14);
  assert.equal(delivered.resources.wood, before.resources.wood + 2); assert.equal(delivered.xp, before.xp + 12); assert.equal(delivered.farmEconomy.completedOrders, 1);
  assert.equal(await page.locator('[data-farm-deliver="farm-order-1"]').count(), 0, 'the completed order is replaced rather than offering another payout');
  const next = page.locator('[data-farm-deliver="farm-order-2"]'); assert.equal(await next.isDisabled(), true); await touch(next); assert.deepEqual(stable(await saved()), stable(delivered), 'insufficient next-order crop cannot grant a second reward');
  receipt.deliveries.push({ case: currentCase, order, before, after: delivered });
  receipt.guards.push({ case: currentCase, kind: 'completed-order-removed-and-next-stock-disabled', before: delivered, after: await saved() }); await shot('390-crop-delivery-earned-coins');
  await touch(page.locator('[data-farm-seed="potato"]')); assert.equal(await page.locator('[data-select-seed="potato"]').count(), 1, 'the new request links to the actual requested seed inventory');
  await closeModal(); await deliveryPanel(); await touch(page.locator('.farm-growth-links [data-open="build"]')); assert.ok(await page.locator('[data-build-type]').count() > 0, 'earned building materials lead to the genuine construction catalog'); await closeModal();
  await deliveryPanel(); await touch(page.locator('.farm-growth-links [data-shop-tab="seeds"]')); assert.equal(await page.locator('.shop-tabs [data-shop-tab="seeds"]').getAttribute('aria-pressed'), 'true');
  const beforeBuy = await saved(), buy = domain('seed', beforeBuy, 'carrot', 1); assert.equal(buy.ok, true);
  await touch(page.locator('[data-shop-buy-kind="seed"][data-shop-item="carrot"]')); await touch(page.locator('[data-shop-confirm-kind="seed"][data-shop-item="carrot"][data-shop-quantity="1"]'));
  assert.deepEqual(stable(await saved()), stable(buy.state), 'the actual new delivery coins fund an ordinary seed purchase'); assert.equal((await saved()).shop.coins, 12);
  receipt.shop.push({ case: currentCase, kind: 'earned-delivery-coin-seed-purchase', before: beforeBuy, after: await saved() }); await closeModal();
}

async function roadsideCollections() {
  // Each real site is opened through the road-place HUD, worked on physically, and
  // paid once. The paused clock keeps each site's countdown unchanged for the
  // duplicate guard; no timer or scene destination is advanced artificially.
  for (const id of ['grove', 'salvage', 'seed-meadow', 'spring']) {
    await closeModal(); await touch(page.locator('.road-controls [data-open="roadside"]'));
    await touch(page.locator(`[data-outdoor-site="${id}"]`)); const before = await saved(), beforeFrame = await frame(), expected = domain('collect', before, id); assert.equal(expected.ok, true);
    await observe(`real road collection${id}`); const beganAt = Date.now(); await touch(page.locator(`[data-outdoor-collect="${id}"]`));
    await page.waitForFunction(() => document.querySelector('#app')?.getAttribute('aria-busy') === 'true', null, { timeout: 1800 });
    await page.waitForFunction(() => !document.querySelector('#app')?.hasAttribute('aria-busy'), null, { timeout: 26000 });
    const frames = await stopObserve(), after = await saved(), final = await frame(); assert.deepEqual(stable(after), stable(expected.state), 'actual site work commits exactly one site-specific reward and paid energy cost');
    const active = frames.filter(f => f.action.outdoorSiteId === id), phases = active.map(f => f.action.phase);
    assert.ok(phases.includes('outbound') && phases.includes('working') && phases.includes('returning'), 'real collection visibly walks, works and returns');
    for (const sample of active) {
      assert.deepEqual(sample.account.resources, before.resources, 'walking and working cannot award the site materials early');
      assert.equal(sample.account.energy, before.energy, 'site energy cost commits with successful completed work');
    }
    const working = active.filter(f => f.action.phase === 'working'); assert.ok(working.length >= 3);
    assert.ok(working.every(f => f.movement.surface === 'road'), 'road work physically occurs on the road');
    assert.ok(working.some(f => f.outfit.pose === (id === 'grove' ? 'chop' : 'gather')), 'the actual character performs the visible gathering/chopping motion');
    assert.ok(distance(final.movement.position, beforeFrame.movement.position) < 2, 'the chore retains and returns to the actual original character coordinates');
    const view = domain('roadside', after, id).view; assert.equal(view.ready, false); assert.ok(view.remainingSeconds > 0); assert.equal(after.roadside.sites[id].visits, 1);
    receipt.collections.push({ case: currentCase, id, before, after, beforeFrame, final, elapsedMs: Date.now() - beganAt, view, frames, physicalProof: assertPhysical(frames, id) });
    await touch(page.locator('.road-controls [data-open="roadside"]')); await touch(page.locator(`[data-outdoor-site="${id}"]`));
    const blocked = page.locator(`[data-outdoor-collect="${id}"]`); assert.equal(await blocked.isDisabled(), true); await touch(blocked); assert.deepEqual(stable(await saved()), stable(after), 'native cooldown control grants no repeated site rewards or energy charges');
    receipt.guards.push({ case: currentCase, kind: 'real-site-cooldown', id, before: after, after: await saved(), view }); await shot(`390-road-site-${id}-cooldown`); await closeModal();
  }
}

async function reload() {
  await closeModal(); const before = await saved(); await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('#world')?.dataset.freeMovement && !document.querySelector('[data-startup-patch]'), null, { timeout: 15000 }); await setPaused(true);
  assert.deepEqual(nonClock(await saved()), nonClock(before), 'reload preserves the exact harvested crop ledger, nutrient batches, delivery wallet, roadsite timestamps, animal HP/XP and existing floors');
  const checked = domain('validate', await saved()); assert.equal(checked.accepted, true); assert.deepEqual(stable(checked.loaded), stable(await saved()));
  receipt.fixtures.at(-1).reload = { before, after: await saved(), accepted: checked.accepted };
}

try {
  await mkdir('artifacts', { recursive: true });
  if (finalSnapshot) {
    const manifest = JSON.parse(await readFile(executionInputs.snapshotManifestPath, 'utf8')); assert.equal(manifest.snapshotId, snapshotId); assert.equal(manifest.version, version);
    for (const [path, hash] of Object.entries(manifest.files)) { const url = new URL(path, new URL('/', baseUrl)), response = await fetch(url); assert.equal(response.status, 200); const bytes = Buffer.from(await response.arrayBuffer()); assert.equal(sha(bytes), hash); receipt.httpIdentity.push({ path, url: String(url), bytes: bytes.length, sha256: hash }); }
  }
  const fresh = await fixture(), legacy = await fixture(true);
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  for (const [width, height] of [[344, 740], [360, 800], [390, 844], [844, 390]]) {
    await begin(width, height, width === 844 ? legacy : fresh); await deliveryGuards(); await roadsideCatalog();
    if (width === 390) { await farmingAndDelivery(); await roadsideCollections(); }
    await roadFreedom(); await reload(); await context.close(); context = null;
    console.log(`PASS ${width}x${height}: actual growth/delivery UI, broad physical road, beneath-truck touch and exact save reload.`);
  }
  assert.equal(receipt.fixtures.length, 4); assert.equal(receipt.farming.filter(f => f.kind !== 'natural-growth').length, 4); assert.equal(receipt.deliveries.length, 1);
  assert.equal(receipt.shop.length, 1); assert.equal(receipt.walks.length, 16); assert.equal(receipt.collections.length, 4); assert.deepEqual(receipt.errors, []); assert.deepEqual(receipt.failedAssets, []);
  receipt.status = 'passed';
} catch (error) {
  receipt.status = 'failed'; receipt.failure = { case: currentCase, message: String(error), stack: error.stack }; process.exitCode = 1;
  if (page) try { receipt.failure.save = await saved(); receipt.failure.frame = await frame(); await shot('failure'); } catch (e) { receipt.failure.captureError = String(e); }
} finally {
  if (browser) await browser.close(); receipt.finishedAt = new Date().toISOString(); receipt.assertionsExecuted = assertionsExecuted;
  const path = `artifacts/gameplay-outdoor-v${version}${diagnosticOnly ? '-diagnostic' : ''}-verification.json`; await writeFile(path, JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify({ status: receipt.status, assertionsExecuted, receipt: path, error: receipt.failure?.message }));
}
