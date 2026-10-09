import { chromium } from '@playwright/test';
import strictAssert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

// A person controls these fights with actual mobile touch coordinates and real
// browser frames. Boundary saves are explicitly declared; no test calls combat
// methods, alters simulation time, or writes health after a fight has started.
const version = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')).version;
const baseUrl = process.env.TEST_BASE_URL || 'http://127.0.0.1:5173';
const startedAt = new Date();
await mkdir('artifacts', { recursive: true });
let assertionsExecuted = 0;
const assert = new Proxy(strictAssert, { get(target, key) { const value = Reflect.get(target, key); return typeof value === 'function' ? (...args) => { assertionsExecuted++; return value(...args); } : value; } });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
const errors = [], failedAssets = [], cases = [], fixtures = [], screenshots = [], battles = [];
let page, context, fresh;
const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('road-haven-save-v1')));
const actors = () => page.locator('.battle-screen canvas').evaluate(canvas => JSON.parse(canvas.dataset.battleActors));

async function touch(control) {
 if (!await control.isVisible() && await control.evaluate(element => Boolean(element.closest('#farm-tray')))) await touch(page.locator('[data-nav="farm"]'));
 await control.scrollIntoViewIfNeeded();
 const box = await control.boundingBox(); assert.ok(box, 'an actual touch target is rendered');
 const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
 assert.equal(await control.evaluate((button, point) => document.elementFromPoint(point.x, point.y)?.closest('button') === button, point), true, 'no overlay intercepts this finger touch');
 await page.touchscreen.tap(point.x, point.y);
}
async function closeModal() { if (await page.locator('#modal-root').isVisible()) await touch(page.locator('#modal-root [data-close]').first()); }
async function pauseVillage() {
 if (await page.locator('.time-button').getAttribute('aria-label') === '시간 계속') return;
 await closeModal(); await touch(page.locator('[data-open="menu"]')); await touch(page.locator('#modal-root [data-open="settings"]'));
 await touch(page.locator('#modal-root [data-pause]')); await touch(page.locator('#modal-root [data-save]')); await closeModal();
}
async function shot(name) {
 const path = `artifacts/v${version}-animal-battle-${name}.png`;
 await page.screenshot({ path, fullPage: true }); screenshots.push(path);
}
async function fixture(label, changes = {}) {
 const state = { ...structuredClone(fresh), ...changes, name: label.slice(0, 16), lastSaved: 0, expedition: null };
 fixtures.push({ label, health: state.health, energy: state.energy, companions: state.companions ?? 'legacy absent defaults', resources: state.resources });
 await page.evaluate(state => localStorage.setItem('animal-battle-qa-fixture', JSON.stringify(state)), state); await page.reload();
 await page.locator('#resident-name').getByText(state.name, { exact: true }).waitFor(); await pauseVillage();
 const loaded = await saved();
 assert.equal(loaded.name, state.name, 'the declared valid save loads without a reset');
 for (const key of ['health', 'energy', 'resources', 'stats', 'xp', 'companions']) assert.deepEqual(loaded[key], state[key], `${label}: loading does not gift or consume ${key}`);
 return loaded;
}
async function enter(stage = 1) {
 await closeModal(); await touch(page.locator('[data-nav="hunt"]')); await touch(page.locator(`[data-stage="${stage}"]`));
 const before = await saved(), roster = before.companions ?? { dog: { health: 100, xp: 0 }, cat: { health: 100, xp: 0 } };
 for (const id of ['dog', 'cat']) {
  const level = Math.min(10, Math.floor(roster[id].xp / 80) + 1), max = (id === 'dog' ? 120 : 90) + (level - 1) * (id === 'dog' ? 8 : 6);
  assert.equal(await page.locator(`[data-companion-hp="${id}"]`).innerText(), `${Math.ceil(roster[id].health * max / 100)} / ${max}`, 'stage preparation shows each saved animal actual HP');
  assert.match(await page.locator(`[data-companion-card="${id}"]`).innerText(), id === 'dog' ? /보리.*Lv\./s : /나비.*Lv\./s);
 }
 await touch(page.locator('[data-start-hunt]')); await page.locator('.battle-screen').waitFor();
 await page.waitForFunction(() => document.querySelector('.battle-screen canvas')?.dataset.battleActors && document.querySelector('.battle-screen canvas')?.dataset.battleArtReady === 'true');
 assert.equal(await page.locator('.battle-screen canvas').getAttribute('data-battle-art-ready'), 'true', 'both gameplay animal atlases have loaded and decoded');
 const state = await saved(); assert.ok(state.expedition?.animalParty, 'the pending animal expedition is saved before combat');
 assert.equal(await page.locator('#app').evaluate(element => element.inert), true, 'home actions are held during combat');
 assert.deepEqual((await actors()).map(actor => actor.id).sort(), ['cat', 'dog'], 'the battle renders only the two animal allies');
 return state;
}
async function observeBattle(label) {
 await page.locator('.battle-screen canvas').evaluate((canvas, label) => {
  const records = { label, startedAt: performance.now(), events: [], poses: [], samples: [], seen: new Set() };
  const capture = () => {
   const allies = JSON.parse(canvas.dataset.battleActors || '[]');
   records.samples.push({ at: performance.now(), actors: allies, paused: canvas.dataset.battlePaused === 'true', elapsedLabel: document.querySelector('.battle-progress [data-battle-time]')?.textContent });
   for (const ally of allies) if (!records.poses.some(pose => pose.id === ally.id && pose.pose === ally.pose)) records.poses.push({ id: ally.id, pose: ally.pose });
   for (const event of JSON.parse(canvas.dataset.battleEvents || '[]')) {
    if (!records.seen.has(event.id)) { records.seen.add(event.id); records.events.push(event); }
   }
  };
  capture(); window.__animalBattleQA = records;
  window.__animalBattleObserver = new MutationObserver(capture);
  window.__animalBattleObserver.observe(canvas, { attributes: true, attributeFilter: ['data-battle-actors', 'data-battle-events'] });
 }, label);
}
async function observation() {
 const record = await page.evaluate(() => {
  window.__animalBattleObserver.disconnect(); const { seen, ...records } = window.__animalBattleQA;
  return { ...records, elapsedMs: performance.now() - records.startedAt };
 });
 battles.push(record); return record;
}
async function ready(skill = 'dash') { await page.waitForFunction(skill => !document.querySelector(`[data-skill="${skill}"]`)?.disabled, skill, { timeout: 5000 }); }
async function retreat() {
 await touch(page.locator('[data-battle="retreat"]')); await touch(page.locator('[data-battle="confirm-retreat"]'));
 await page.locator('.battle-result-layer').waitFor({ state: 'visible' });
}
async function finish() {
 await touch(page.locator('[data-battle="finish"]')); await page.locator('.battle-screen').waitFor({ state: 'detached' });
 assert.equal(await page.locator('#app').evaluate(element => element.inert), false, 'return releases the home controls');
 const state = await saved(); assert.equal(state.expedition, null, 'the completed expedition is cleared'); return state;
}
async function fit(width, height) {
 await page.setViewportSize({ width, height }); await page.waitForTimeout(180);
 assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${width}×${height}: animal combat has no horizontal overflow`);
 for (const id of ['dog', 'cat']) {
  const card = page.locator(`[data-battle-ally="${id}"]`), box = await card.boundingBox();
  assert.ok(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= width + 1 && box.y + box.height <= height + 1, `${id}: the HP card fits ${width}×${height}`);
  assert.ok((await card.innerText()).includes(id === 'dog' ? '보리' : '나비'), 'each animal is named on its own party card');
  const track = page.locator(`[data-battle-ally-track="${id}"]`); assert.ok(Number(await track.getAttribute('aria-valuemax')) > 0);
 }
 for (const skill of ['sweep', 'dash', 'heal']) {
  const control = page.locator(`[data-skill="${skill}"]`), box = await control.boundingBox();
  assert.ok(box && box.width >= 44 && box.height >= 44 && box.x >= 0 && box.y >= 0 && box.x + box.width <= width + 1 && box.y + box.height <= height + 1, `${skill}: finger-sized skill fits ${width}×${height}`);
  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  assert.equal(await control.evaluate((button, point) => document.elementFromPoint(point.x, point.y)?.closest('button') === button, point), true, 'skills remain reachable even when disabled');
 }
}
async function receipt(status, failure) {
 await writeFile(`artifacts/animal-battle-v${version}-verification.json`, JSON.stringify({ version, status, baseUrl, assertionsExecuted,
  startedAt: startedAt.toISOString(), finishedAt: new Date().toISOString(), input: 'Actual touchscreen coordinates in Chromium mobile emulation',
  clock: 'Natural requestAnimationFrame and wall time; no page.clock, combat method calls, simulation-time writes, or health writes during combat',
  deviceLimit: 'Mobile Chromium emulation only; no physical Android device', fixtures, cases, screenshots, battles, errors, failedAssets,
  ...(failure ? { failure: String(failure), stack: failure.stack } : {}) }, null, 2) + '\n');
}

try {
 context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
 await context.addInitScript(() => {
  const fixture = localStorage.getItem('animal-battle-qa-fixture');
  if (fixture) { localStorage.setItem('road-haven-save-v1', fixture); localStorage.removeItem('animal-battle-qa-fixture'); }
 });
 page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
 page.on('response', response => { if (response.status() >= 400 && ['image', 'font', 'script', 'stylesheet'].includes(response.request().resourceType())) failedAssets.push(`${response.status()} ${response.url()}`); });
 await page.goto(baseUrl); await touch(page.locator('[data-start]')); await pauseVillage(); fresh = await saved();

 // The first battle comes from the actual welcome screen, not a boosted save.
 const beforeFresh = await saved(), pending = await enter();
 assert.equal(pending.energy, beforeFresh.energy - 16, 'entry consumes the existing16 energy once');
 assert.equal(pending.health, beforeFresh.health, 'the farmer is not a combatant');
 assert.deepEqual(pending.companions, { dog: { health: 100, xp: 0 }, cat: { health: 100, xp: 0 } }, 'the actual new party starts at level1 with full animal health');
 await observeBattle('Actual fresh welcome party, three natural waves');
 await fit(390, 844); await ready('sweep');
 await touch(page.locator('[data-battle="pause"]')); const held = await actors(), elapsed = await page.locator('.battle-progress [data-battle-time]').innerText();
 await page.waitForTimeout(1100); assert.deepEqual(await actors(), held, 'manual pause holds animal health, position and animation state');
 assert.equal(await page.locator('.battle-progress [data-battle-time]').innerText(), elapsed, 'manual pause holds actual elapsed seconds');
 await fit(360, 740); await shot('two-animal-party-small'); await fit(844, 390); await shot('two-animal-party-landscape'); await fit(390, 844);
 // This explicitly simulated browser visibility event verifies the pause
 // protocol only. It does not claim an actual Android background transition.
 await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
 await touch(page.locator('[data-battle="resume"]')); const hiddenActors = await actors(), hiddenTime = await page.locator('.battle-progress [data-battle-time]').innerText();
 await page.waitForTimeout(1100); assert.deepEqual(await actors(), hiddenActors, 'the hidden-page protocol holds the animal simulation even after manual resume');
 assert.equal(await page.locator('.battle-progress [data-battle-time]').innerText(), hiddenTime, 'hidden elapsed time does not count as active battle seconds');
 await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
 await ready('sweep'); await touch(page.locator('[data-skill="sweep"]'));
 assert.equal(await page.locator('[data-skill="sweep"]').isDisabled(), true, 'a cat skill cannot be repeatedly fired');
 assert.match(await page.locator('[data-skill="sweep"] .battle-skill-cooldown').innerText(), /^[34]초$/, 'the cat skill keeps the3× real-second cooldown');
 await touch(page.locator('[data-skill="dash"]')); await touch(page.locator('[data-battle="auto"]'));
 await page.locator('.battle-result-layer').waitFor({ state: 'visible', timeout: 40000 });
 assert.match(await page.locator('.battle-result-layer').innerText(), /함께 해냈어요/, 'the unboosted dog and cat can win the first stage');
 await shot('fresh-animal-victory'); const first = await observation();
 assert.equal(first.samples.every(sample => sample.actors.every(actor => ['dog', 'cat'].includes(actor.id) && actor.owner === actor.id)), true, 'all rendered allies belong to animals throughout the entire fight');
 assert.ok(first.events.some(event => event.owner === 'dog' && ['dog', 'dash'].includes(event.kind)), 'the dog has actual owned attacks');
 assert.ok(first.events.some(event => event.owner === 'cat' && ['attack', 'sweep'].includes(event.kind)), 'the cat has actual owned attacks');
 assert.equal(first.events.some(event => ['hero', 'human', 'farmer'].includes(event.owner) || ['hero', 'human', 'farmer'].includes(event.target)), false, 'the farmer neither attacks nor takes combat damage');
 for (const id of ['dog', 'cat']) assert.ok(first.poses.some(pose => pose.id === id && ['attack', 'skill', 'dash', 'claw', 'pounce'].includes(pose.pose)), `${id} visibly animates its own attacks`);
 assert.ok(Math.max(...first.samples.flatMap(sample => sample.actors.map(actor => actor.wave))) === 3, 'all three waves are visibly played');
 const frameRates = first.samples.slice(1).flatMap((sample, index) => {
  const before = first.samples[index], realSeconds = (sample.at - before.at) / 1000, simulationSeconds = sample.actors[0].time - before.actors[0].time;
  return !sample.paused && !before.paused && realSeconds > .005 && simulationSeconds > .005 ? [simulationSeconds / realSeconds] : [];
 }).sort((a, b) => a - b);
 assert.ok(frameRates.length > 20, 'many naturally rendered advancing frames are available for pace observation');
 const medianPace = frameRates[Math.floor(frameRates.length / 2)]; first.medianSimulationSecondsPerRealSecond = medianPace;
 assert.ok(medianPace > 2.6 && medianPace < 3.4, 'animal combat retains the shared3× real-frame pace');
 const afterFirst = await finish();
 assert.equal(afterFirst.health, beforeFresh.health, 'animal victory preserves farmer HP'); assert.equal(afterFirst.stats.battlesWon, beforeFresh.stats.battlesWon + 1);
 assert.equal(afterFirst.stats.defeatedEnemies, beforeFresh.stats.defeatedEnemies + 8, 'the actual three waves contain eight zombies');
 for (const id of ['dog', 'cat']) { assert.equal(afterFirst.companions[id].xp, 20, 'each participating pet earns20 XP once'); assert.ok(afterFirst.companions[id].health > 0 && afterFirst.companions[id].health <= 100); }
 await page.reload(); await page.locator('#resident-name').waitFor(); await pauseVillage(); const afterReload = await saved();
 for (const key of ['companions', 'health', 'resources', 'stats', 'xp']) assert.deepEqual(afterReload[key], afterFirst[key], 'reload does not duplicate animal XP, HP or loot');
 cases.push('Actual welcome party wins three waves/eight zombies; only dog/cat actors and attack owners, two readable HP cards, three mobile sizes, manual pause and separately declared simulated-document.hidden protocol, cat/dog skills, AUTO, exactly-once loot/20XP and unchanged farmer HP.');

 // Deliberate injury makes healing observable before enemies reach the party.
 const injured = await fixture('동물 회복 경계 fixture', { health: 3, energy: 100, companions: { dog: { health: 50, xp: 80 }, cat: { health: 40, xp: 160 } } });
 await enter(); await observeBattle('Actual healing tap with declared pre-entry pet injuries'); await ready('heal');
 const healBefore = await actors(); await touch(page.locator('[data-skill="heal"]'));
 await page.waitForFunction(before => JSON.parse(document.querySelector('.battle-screen canvas').dataset.battleActors).every(after => after.health >= before.find(ally => ally.id === after.id).health + 29 - .001), healBefore, { timeout: 1000 });
 const healAfter = await actors();
 for (const id of ['dog', 'cat']) {
  const before = healBefore.find(actor => actor.id === id), after = healAfter.find(actor => actor.id === id);
  assert.ok(Math.abs(after.health - before.health - 29) < .001, `${id} receives29 actual HP, not29 percentage points`);
  assert.equal(after.maxHealth, id === 'dog' ? 128 : 102, 'individual level increases actual maximum HP');
 }
 assert.match(await page.locator('[data-skill="heal"] .battle-skill-cooldown').innerText(), /^[78]초$/, 'the team recovery retains its actual8-second cooldown');
 await touch(page.locator('[data-battle="pause"]')); const cooldowns = await page.locator('.battle-skill-cooldown').allInnerTexts();
 await page.waitForTimeout(1100); assert.deepEqual(await page.locator('.battle-skill-cooldown').allInnerTexts(), cooldowns, 'pausing freezes animal recovery cooldown');
 await touch(page.locator('[data-battle="resume"]')); await retreat(); const recoveryEvents = await observation();
 assert.ok(recoveryEvents.events.some(event => event.kind === 'heal'), 'the recovery produces rendered healing events');
 const healed = await finish(); assert.equal(healed.health, injured.health, 'a farmer at3 HP still safely commands healthy animal allies');
 assert.equal(healed.stats.battlesWon, injured.stats.battlesWon); assert.deepEqual(healed.resources, injured.resources, 'retreat provides no victory loot');
 for (const id of ['dog', 'cat']) { assert.equal(healed.companions[id].xp, injured.companions[id].xp, 'retreat grants no pet XP'); assert.ok(healed.companions[id].health > injured.companions[id].health && healed.companions[id].health < 100, 'actual healed percentage persists without being reset to full'); }
 await page.reload(); await page.locator('#resident-name').waitFor(); await pauseVillage(); assert.deepEqual((await saved()).companions, healed.companions, 'startup does not gift full pet HP');
 cases.push('Farmer3HP does not block animal entry; dogLv2/catLv3 get29 actual HP each,8-second team recovery holds while paused, retreat persists actual percentages and XP without loot or reload healing.');

 const threshold = await fixture('동물 레벨 성장 경계 fixture', { health: 73, energy: 100, companions: { dog: { health: 80, xp: 79 }, cat: { health: 80, xp: 159 } } });
 await enter(); await observeBattle('Natural victory crosses declared pet XP boundaries'); await ready(); await touch(page.locator('[data-battle="auto"]'));
 await page.locator('.battle-result-layer').waitFor({ state: 'visible', timeout: 40000 });
 assert.match(await page.locator('.battle-result-layer').innerText(), /함께 해냈어요/); const thresholdActors = await actors(); await observation(); const leveled = await finish();
 for (const id of ['dog', 'cat']) {
  assert.equal(leveled.companions[id].xp, threshold.companions[id].xp + 20, 'one natural victory crosses the next level boundary');
  const last = thresholdActors.find(actor => actor.id === id);
  assert.ok(Math.abs(leveled.companions[id].health - last.health / last.maxHealth * 100) < .001, 'leveling preserves the actual post-combat health percentage');
 }
 await touch(page.locator('[data-nav="hunt"]'));
 assert.match(await page.locator('[data-companion-card="dog"]').innerText(), /Lv\.2/); assert.match(await page.locator('[data-companion-card="cat"]').innerText(), /Lv\.3/);
 const stageText = await page.locator('#modal-root').innerText(); assert.match(stageText, /다음 레벨까지 경험치/); await closeModal();
 await page.reload(); await page.locator('#resident-name').waitFor(); await pauseVillage(); assert.deepEqual((await saved()).companions, leveled.companions, 'crossed animal level and injury persist on reload');
 cases.push('Declared dog79XP/cat159XP party wins naturally and advances toLv2/Lv3, adds20XP once, preserves exact post-combat health percentages rather than gaining a level-up heal, and shows new levels in stage preparation.');

 // Either animal can continue alone; the down animal cannot use its own skill.
 for (const alive of ['dog', 'cat']) {
  const down = alive === 'dog' ? 'cat' : 'dog', ownSkill = alive === 'dog' ? 'dash' : 'sweep', downSkill = down === 'dog' ? 'dash' : 'sweep';
  const solo = await fixture(`${alive} 단독 출전 fixture`, { health: 5, energy: 100, companions: { dog: { health: alive === 'dog' ? 60 : 0, xp: 0 }, cat: { health: alive === 'cat' ? 60 : 0, xp: 0 } } });
  const soloPending = await enter(); assert.deepEqual(soloPending.expedition.participantIds, [alive], 'only the healthy animal is eligible for victory XP');
  await observeBattle(`${alive} survives while ${down} is down`); await ready(ownSkill);
  assert.equal(await page.locator(`[data-skill="${downSkill}"]`).isDisabled(), true, 'a down animal cannot activate its attack skill');
  const soloBefore = await actors(); assert.equal(soloBefore.find(actor => actor.id === down).health, 0, 'entry never resurrects the down animal');
  await touch(page.locator(`[data-skill="${ownSkill}"]`)); await touch(page.locator('[data-skill="heal"]')); await page.waitForTimeout(1000);
  const soloAfter = await actors(); assert.equal(soloAfter.find(actor => actor.id === down).health, 0, 'team recovery cannot revive a down animal');
  await shot(`solo-${alive}`); await retreat(); const soloRecord = await observation();
  assert.ok(soloRecord.events.some(event => event.owner === alive && ['attack', 'dog', 'sweep', 'dash'].includes(event.kind)), 'the surviving animal continues to fight');
  assert.equal(soloRecord.events.some(event => event.owner === down && ['attack', 'dog', 'sweep', 'dash', 'heal'].includes(event.kind)), false, 'the down animal creates no attacks or healing');
  const returned = await finish(); assert.equal(returned.companions[down].health, 0); assert.equal(returned.health, solo.health);
 }
 cases.push('Dog-only and cat-only entry remain valid; own skill and attacks continue, down ally stays0HP through team recovery and creates no attack events.');

 // Actual incoming damage defeats both animals; the recovery action is in game.
 const fragile = await fixture('동물 전멸 회복 fixture', { health: 77, energy: 100, companions: { dog: { health: 3, xp: 0 }, cat: { health: 3, xp: 0 } } });
 await enter(3); await observeBattle('Actual zombie attacks defeat both3-percent pets');
 await page.locator('.battle-result-layer').waitFor({ state: 'visible', timeout: 20000 });
 assert.match(await page.locator('.battle-result-layer').innerText(), /잠시 쉬어요/, 'both animals down produces the animal recovery result');
 assert.equal(await page.locator('.battle-result-card.victory').count(), 0, 'team defeat does not display a victory');
 const lostActors = await actors(); assert.equal(lostActors.every(actor => actor.health === 0), true, 'defeat requires both pet health pools to be exhausted');
 await shot('team-defeat'); const loss = await observation();
 assert.ok(loss.events.some(event => event.kind === 'damage' && event.target === 'dog'), 'front-line zombie attacks hit the dog');
 assert.ok(loss.events.some(event => event.kind === 'damage' && event.target === 'cat'), 'enemy attacks also reach the cat');
 const lost = await finish(); assert.equal(lost.health, fragile.health, 'team defeat does not damage the farmer');
 assert.deepEqual(lost.companions, { dog: { health: 0, xp: 0 }, cat: { health: 0, xp: 0 } }); assert.deepEqual(lost.resources, fragile.resources);
 await touch(page.locator('[data-nav="hunt"]')); const gate = page.locator('[data-start-hunt]');
 assert.equal(await gate.isDisabled(), true, 'both pets down blocks another expedition with an explanatory recovery option');
 assert.match(await page.locator('#modal-root').innerText(), /휴식|회복/, 'the blocked entry explains how to recover'); await closeModal();
 await touch(page.locator('[data-nav="farm"]')); await touch(page.locator('[data-quick="rest"]')); const rested = await saved();
 for (const id of ['dog', 'cat']) assert.equal(rested.companions[id].health, 35, 'a meal restores each animal35 percentage points');
 assert.equal(rested.resources.food, lost.resources.food - 1); assert.equal(rested.resources.water, lost.resources.water - 1);
 await enter(); await ready(); await retreat(); await finish();
 cases.push('Natural zombie hits defeat both3%-HP pets; farmer/loot/XP stay unchanged, both-down entry is gated with recovery guidance, actual rest costs one food/water and restores both35%, then entry works again.');

 const hungry = await fixture('재료 없는 동물 휴식 fixture', { energy: 15, companions: { dog: { health: 0, xp: 80 }, cat: { health: 0, xp: 160 } }, resources: { ...fresh.resources, food: 0, water: 0 } });
 await touch(page.locator('[data-nav="farm"]')); await touch(page.locator('[data-quick="rest"]')); const weakRest = await saved();
 for (const id of ['dog', 'cat']) { assert.equal(weakRest.companions[id].health, 10, 'rest without food restores10 percentage points'); assert.equal(weakRest.companions[id].xp, hungry.companions[id].xp); }
 assert.deepEqual(weakRest.resources, hungry.resources, 'resource-free recovery cannot charge unavailable food/water');
 cases.push('Actual resource-free rest recovers both pets10% and preserves XP without negative material costs.');

 // A legacy save has no animal roster. Migration must remain compatible.
 const legacy = structuredClone(fresh); legacy.companions = undefined; legacy.health = 2; legacy.energy = 100;
 const migrated = await fixture('구 버전 동물 팀 fixture', legacy); assert.equal(migrated.companions, undefined, 'simply loading the optional old schema does not manufacture progress');
 const legacyPending = await enter(); assert.deepEqual(legacyPending.companions, { dog: { health: 100, xp: 0 }, cat: { health: 100, xp: 0 } });
 const interrupted = await saved(); await page.reload(); await page.locator('#resident-name').waitFor(); await pauseVillage(); const recovered = await saved();
 assert.equal(recovered.expedition, null, 'an interrupted animal expedition safely returns home');
 for (const key of ['companions', 'health', 'resources', 'energy', 'stats', 'xp']) assert.deepEqual(recovered[key], interrupted[key], `interruption does not invent ${key}`);
 await enter(); await ready(); await retreat(); await finish();
 cases.push('Absent legacy roster defaults to100HP/0XP at first entry even with farmer2HP; interrupted expedition clears once without HP, XP, loot or energy gifts and can enter again.');

 assert.deepEqual(errors, []); assert.deepEqual(failedAssets, []); await receipt('passed');
 console.log(`PASS: ${assertionsExecuted} animal-combat assertions, ${battles.length} observed natural fights, real mobile taps at390/360/landscape; ${cases.length} scenarios.`);
} catch (error) {
 if (page && !page.isClosed()) await shot('failure').catch(() => {});
 await receipt('failed', error).catch(() => {}); throw error;
} finally { await browser.close(); }
