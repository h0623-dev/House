import { chromium } from '@playwright/test';
import strictAssert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { captureExecutionInputs } from './release-execution-inputs.mjs';

// Actual mobile fingers and ordinary pause settings. Domain fixtures are loaded
// before startup; no browser timer, route, position or animation is replaced.
const version = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')).version;
const baseUrl = process.env.TEST_BASE_URL ?? 'http://127.0.0.1:5173/';
const snapshotId = process.env.TEST_SNAPSHOT_ID ?? 'mutable-development-diagnostic';
const finalSnapshot = process.env.TEST_FINAL_SNAPSHOT === '1';
const diagnosticOnly = process.env.TEST_GAMEPLAY_PLAYER_PET_DIAGNOSTIC === '1';
if (finalSnapshot === diagnosticOnly) throw Error('Choose one immutable final snapshot or mutable development diagnostic.');
const sha = value => createHash('sha256').update(value).digest('hex');
let assertionsExecuted = 0;
const assert = new Proxy(strictAssert, { get(target, key) { const value = Reflect.get(target, key); return typeof value === 'function' ? (...args) => { assertionsExecuted++; return value(...args); } : value; } });
const executionInputs = await captureExecutionInputs(import.meta.url, { snapshotId, finalSnapshot });
const sourceScopes = ['src', 'public', 'scripts', 'index.html', 'package.json', 'package-lock.json', 'release-version.json', 'content-release.json', 'capacitor.config.ts', 'vite.config.ts', 'tsconfig.json'];
async function sourceHashes() {
  const result = spawnSync('rg', ['--files', '--hidden', '--no-ignore', ...sourceScopes], { encoding: 'utf8' });
  if (result.status !== 0) throw Error(result.stderr);
  return Object.fromEntries(await Promise.all(result.stdout.trim().split('\n').sort().map(async path => [path, sha(await readFile(path))])));
}
const runId = String(Date.now());
const receipt = { version, baseUrl, snapshotId, finalSnapshot, diagnosticOnly, runId, executionInputs,
  sourceHashesAtStart: await sourceHashes(), status: 'running', startedAt: new Date().toISOString(),
  scope: 'Chromium mobile emulation, genuine touch controls and natural RAF time; no physical-phone or earned-fixture claim.',
  fixtures: [], inputs: [], walks: [], camera: [], gates: [], petRoutes: [], bodySeparation: [], screenshots: [], httpIdentity: [], errors: [], failedAssets: [] };
let browser, context, page, currentCase = 'preflight', currentStep = 'preflight';
const stable = state => { const copy = structuredClone(state); delete copy.lastSaved; return copy; };
const nonClock = state => { const copy = stable(state); for (const key of ['day', 'minutes', 'totalMinutes']) delete copy[key]; return copy; };
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('road-haven-save-v1')));
function domain(operation, input = {}) {
  const script = `import {createGame,saveGame,loadGame} from './src/game.ts';
import {getPetPassage} from './src/pet-passage.ts';
import {GAME_SPEED_MULTIPLIER} from './src/game-speed.ts';
const operation=process.argv[1],state=JSON.parse(process.argv[2]);let raw;const store={getItem:()=>raw??null,setItem:(key,value)=>raw=value};
if(operation==='fresh')console.log(JSON.stringify(createGame('female','동물 통로 검수')));
else {const accepted=saveGame(state,store);console.log(JSON.stringify({accepted,loaded:loadGame(store),passage:getPetPassage(state),speed:GAME_SPEED_MULTIPLIER}));}`;
  const result = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script, operation, JSON.stringify(input)], { encoding: 'utf8' });
  assert.equal(result.status, 0, `actual domain executes: ${result.stderr}`); return JSON.parse(result.stdout);
}
async function fixture(legacy = false) {
  let save = domain('fresh'), provenance = { kind: 'actual-createGame', earned: false, declaration: 'Ordinary unmodified new-game resources and dog/cat team. No gate, coins, levels or elapsed time is granted.' };
  if (legacy) {
    const path = 'artifacts/truck-floors-v0.21.0-paid-save.json', bytes = await readFile(path), previous = JSON.parse(bytes);
    assert.equal(sha(bytes), '6d215de7d0c98fe03a837fc96db38343790b158a8250a965a0fb4a690225bbc3'); assert.equal(previous.sha256OfSave, sha(JSON.stringify(previous.save)));
    save = structuredClone(previous.save); provenance = { kind: 'previous-paid-three-floor-fixture', path, sha256: sha(bytes), earned: false, declaration: 'Previous validated paid-floor save reused without new grants. Pending work, resources, dog/cat HP and XP remain exact.' };
  }
  const checked = domain('validate', save); assert.equal(checked.accepted, true); assert.deepEqual(stable(checked.loaded), stable(save)); assert.equal(checked.speed, 2);
  assert.deepEqual(checked.passage, { version: 1, open: false }); assert.equal(Object.hasOwn(save, 'petPassage'), false, 'an old save receives no new gate field or benefits merely by loading');
  return { save: checked.loaded, provenance };
}
async function frame(controlSelector = null) { return page.locator('#world').evaluate((canvas, selector) => {
  const result = { geometry: JSON.parse(canvas.dataset.sceneGeometry), movement: JSON.parse(canvas.dataset.freeMovement), action: JSON.parse(canvas.dataset.sceneAction), pets: JSON.parse(canvas.dataset.petMotion || '[]'), passage: canvas.dataset.petPassage ? JSON.parse(canvas.dataset.petPassage) : null, outfit: JSON.parse(canvas.dataset.survivorOutfit), hits: JSON.parse(canvas.dataset.sceneHits), rect: canvas.getBoundingClientRect().toJSON() };
  if (selector) { const button = document.querySelector(selector), box = button.getBoundingClientRect(), point = { x: box.x + box.width / 2, y: box.y + box.height / 2 }; result.controlProof = { bounds: box.toJSON(), point, hit: document.elementFromPoint(point.x, point.y)?.closest('button') === button, label: button.getAttribute('aria-label') ?? button.innerText, at: performance.now() }; }
  return result;
}, controlSelector); }
async function animations(locator) { await locator.evaluate(async element => { const list = []; for (let node = element; node; node = node.parentElement) list.push(...node.getAnimations().filter(a => a.effect?.getComputedTiming().iterations !== Infinity)); await Promise.all(list.map(a => a.finished.catch(() => {}))); }); }
async function touch(locator) {
  await locator.scrollIntoViewIfNeeded(); await animations(locator); const box = await locator.boundingBox();
  assert.ok(box && box.width >= 44 && box.height >= 44, `actual entire actionable control is44px: ${JSON.stringify(box)}`);
  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  assert.equal(await locator.evaluate((button, p) => document.elementFromPoint(p.x, p.y)?.closest('button') === button, point), true, 'the genuine finger reaches its control');
  assert.ok(box.x >= -1 && box.y >= -1 && box.x + box.width <= page.viewportSize().width + 1 && box.y + box.height <= page.viewportSize().height + 1, 'entire control fits after ordinary scrolling');
  receipt.inputs.push({ case: currentCase, kind: 'native-touchscreen-tap', point, bounds: box, label: await locator.getAttribute('aria-label') ?? await locator.innerText() }); await page.touchscreen.tap(point.x, point.y);
}
async function closeModal() { if (await page.locator('#modal-root').isVisible()) await touch(page.locator('#modal-root [data-close]').first()); }
async function pause() {
  await closeModal(); await touch(page.locator('[data-open="menu"]')); await touch(page.locator('#modal-root [data-open="settings"]'));
  if (await page.locator('.time-button').getAttribute('aria-label') !== '시간 계속') await touch(page.locator('#modal-root [data-pause]'));
  await touch(page.locator('#modal-root [data-save]')); await closeModal(); assert.equal(await page.locator('.time-button').getAttribute('aria-label'), '시간 계속');
}
async function settled() {
  await page.evaluate(() => { window.__playerPetCameraLast = null; window.__playerPetCameraStable = 0; });
  await page.waitForFunction(() => { const c = document.querySelector('#world'); if (!c?.dataset.sceneGeometry) return false; const g = JSON.parse(c.dataset.sceneGeometry), m = JSON.parse(c.dataset.freeMovement), old = window.__playerPetCameraLast; if (old?.at === m.frameAt) return false; window.__playerPetCameraLast = { at: m.frameAt, dx: g.dx, dy: g.dy, scale: g.scale }; window.__playerPetCameraStable = old && Math.abs(g.dx-old.dx)<.25 && Math.abs(g.dy-old.dy)<.25 && Math.abs(g.scale-old.scale)<.0005 ? window.__playerPetCameraStable+1 : 0; return window.__playerPetCameraStable >= 3; }, null, { timeout: 6000 });
}
async function shot(label) {
  const path = `artifacts/v${version}-gameplay-player-pet-${diagnosticOnly ? `diagnostic-${runId}-` : ''}${String(receipt.screenshots.length + 1).padStart(2, '0')}-${label}.png`; await page.screenshot({ path, fullPage: true }); const bytes = await readFile(path); receipt.screenshots.push({ path, bytes: bytes.length, sha256: sha(bytes) });
}
async function observe(label) {
  await page.evaluate(label => { window.__playerPetFrames = []; window.__playerPetObserving = true;const observationId=(window.__playerPetObservationId??0)+1;window.__playerPetObservationId=observationId;let last = -Infinity;
    const capture = () => { if (!window.__playerPetObserving||window.__playerPetObservationId!==observationId) return; const c = document.querySelector('#world'), m = JSON.parse(c.dataset.freeMovement); if (m.frameAt-last >= 35) { last=m.frameAt;const save=JSON.parse(localStorage.getItem('road-haven-save-v1'));window.__playerPetFrames.push({ label, at: performance.now(), movement:m, geometry:JSON.parse(c.dataset.sceneGeometry), action:JSON.parse(c.dataset.sceneAction), pets:JSON.parse(c.dataset.petMotion || '[]'), passage:c.dataset.petPassage?JSON.parse(c.dataset.petPassage):null, persistedPassage:{version:1,open:save.petPassage?.open??false},outfit:JSON.parse(c.dataset.survivorOutfit), rect:c.getBoundingClientRect().toJSON() }); } requestAnimationFrame(capture); }; requestAnimationFrame(capture); }, label);
}
async function stopObserve() { return page.evaluate(() => { window.__playerPetObserving = false; return window.__playerPetFrames; }); }
function cameraProof(frames, label, scale, zoom) {
  assert.ok(frames.length >= 3, `${label}: several naturally rendered frames observed`); let checks = 0;
  for (const f of frames) {
    const g=f.geometry,m=f.movement,v=g.viewport,p={x:g.dx+m.position.x*g.scale,y:g.dy+m.position.y*g.scale};
    assert.equal(g.playerFollowing,true,`${label}: actual protagonist follow camera remains active`); assert.equal(g.manualCamera,false);
    assert.equal(g.mapZoom,zoom,`${label}: chosen user magnification is retained`); assert.ok(Math.abs(g.scale-scale)<=.003,`${label}: actual screen scale does not shrink between surfaces or actions`);
    assert.ok(Math.abs(g.cameraCenter.x-m.position.x)<65&&Math.abs(g.cameraCenter.y-(m.position.y-36))<65,`${label}: viewpoint follows actual current hero feet`);
    assert.ok(p.x>=v.safeLeft+8&&p.x<=g.viewport.width-v.safeRight-8&&p.y>=v.safeTop+30&&p.y<=g.viewport.height-v.safeBottom-3,`${label}: actual projected hero stays in usable gameplay view`);
    assert.ok(p.y-128*f.outfit.scale*g.scale>=v.safeTop+6,`${label}: the protagonist's complete painted height clears the upper gameplay inset`);
    assert.ok(128*f.outfit.scale*g.scale>=60,`${label}: protagonist keeps a readable painted height`); checks+=8;
  }
  return { label, frames:frames.length, checks, minScale:Math.min(...frames.map(f=>f.geometry.scale)),maxScale:Math.max(...frames.map(f=>f.geometry.scale)),zoom };
}
function motionProof(frames,label) {
  assert.ok(frames.length>=3); const proof=[],bodyRows=[];
  const physicalFloor=body=>body.surface==='road'?0:body.floor??1,linked=body=>body.surface==='ladder'||body.surface==='ramp';
  for(const f of frames){const bodies=[{id:'hero',...f.movement.body},...f.pets.map(p=>({id:p.id,...p.body}))];
    for(let i=0;i<bodies.length;i++)for(let j=i+1;j<bodies.length;j++){const a=bodies[i],b=bodies[j],same=(linked(a)||linked(b))?Boolean(a.link&&a.link===b.link)||physicalFloor(a)===physicalFloor(b):physicalFloor(a)===physicalFloor(b)&&a.surface===b.surface;
      if(!same)continue;const separation=distance(a,b),required=a.radius+b.radius;
      assert.ok(separation>=required-.012,`${label}: actual ${a.id}/${b.id} body circles stay separate on their shared physical surface (${separation} >= ${required})`);
      bodyRows.push({at:f.movement.frameAt,ids:[a.id,b.id],bodies:[a,b],surfaces:[a.surface,b.surface],physicalFloors:[physicalFloor(a),physicalFloor(b)],links:[a.link,b.link],separation,required,tolerance:.012});
    }
  }
  receipt.bodySeparation.push({case:currentCase,label,frames:frames.length,checks:bodyRows.length,rows:bodyRows});
  for(let i=1;i<frames.length;i++) {
    const a=frames[i-1],b=frames[i],dt=(b.movement.frameAt-a.movement.frameAt)/1000;
    assert.ok(dt>=0,`${label}: natural RAF time is monotonic`); assert.ok(distance(a.movement.position,b.movement.position)<=dt*420+1.6,`${label}: protagonist cannot teleport`);
    for(const pet of b.pets) { const old=a.pets.find(p=>p.id===pet.id); if(!old)continue;
      const travelled=distance(old,pet); assert.ok(travelled<=dt*65+1.5,`${label}: ${pet.id} has continuous real walking feet`); assert.ok(pet.gait.distance+1e-6>=old.gait.distance,`${label}: ${pet.id} gait distance is monotonic`);
      if(pet.surface==='ramp') { assert.equal(pet.link,'pet-road-1'); assert.notEqual(pet.pose,'climb'); }
      assert.notEqual(pet.link,'road-1',`${label}: pets never use the human road ladder`);
      proof.push({id:pet.id,at:b.movement.frameAt,dt,travelled,surface:pet.surface,link:pet.link,gaitDistance:pet.gait.distance});
    }
  } return proof;
}
async function begin(width,height,input) {
  currentCase=`${width}x${height}`; context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,deviceScaleFactor:2,reducedMotion:'no-preference'});
  await context.addInitScript(save=>{if(sessionStorage.getItem('player-pet-fixture'))return;save.lastSaved=Date.now();localStorage.setItem('road-haven-save-v1',JSON.stringify(save));sessionStorage.setItem('player-pet-fixture','installed');},input.save);
  page=await context.newPage(); page.on('pageerror',error=>receipt.errors.push({case:currentCase,message:error.message})); page.on('response',response=>{if(response.status()>=400&&['script','stylesheet','image','font'].includes(response.request().resourceType()))receipt.failedAssets.push({case:currentCase,status:response.status(),url:response.url()});});
  await page.goto(baseUrl,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('#world')?.dataset.freeMovement&&!document.querySelector('[data-startup-patch]')&&!document.querySelector('#app')?.inert,null,{timeout:15000});
  await pause();await touch(page.locator('.road-controls [data-camera-player]'));await settled(); const loaded=await saved(),f=await frame();
  assert.deepEqual(nonClock(loaded),nonClock(input.save),'old paid state remains exact before any gameplay action'); assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'phone page has no horizontal overflow');
  assert.equal(f.geometry.playerFollowing,true);assert.equal(f.geometry.mapZoom,1);assert.equal(f.passage?.open,false);assert.deepEqual(f.pets.map(p=>p.id).sort(),['cat','dog']);
  receipt.fixtures.push({viewport:{width,height},...input,loaded,initialFrame:f});await shot(`${width}-closed-gate-player-view`);
}
async function walk(label,start,expectedSurface,scale,zoom) {
  currentStep=label;
  const before=await saved();await observe(label);await start();await page.waitForFunction(()=>window.__playerPetFrames.some(frame=>frame.movement.moving),null,{timeout:2200});
  await page.waitForFunction(()=>!JSON.parse(document.querySelector('#world').dataset.freeMovement).moving,null,{timeout:22000});await settled();const frames=await stopObserve(),after=await frame();
  assert.equal(after.movement.surface,expectedSurface);assert.deepEqual(stable(await saved()),stable(before),'free walking never spends or manufactures gameplay state');
  const proof=cameraProof(frames,label,scale,zoom),physicalProof=motionProof(frames,label);receipt.camera.push({case:currentCase,kind:label,...proof});receipt.walks.push({case:currentCase,label,frames,after,physicalProof});return{frames,after};
}
async function gate(open,label) {
  currentStep=label;
  await closeModal();await touch(page.locator('.road-controls [data-open="pet-passage"]')); const before=await saved(),beforeFrame=await frame();
  assert.equal(await page.locator(`[data-pet-passage-toggle="${open?'open':'close'}"]`).isDisabled(),false);
  await observe(label);await touch(page.locator(`[data-pet-passage-toggle="${open?'open':'close'}"]`));
  await page.waitForFunction(()=>document.querySelector('#app')?.getAttribute('aria-busy')==='true',null,{timeout:2200});await page.waitForFunction(()=>!document.querySelector('#app')?.hasAttribute('aria-busy'),null,{timeout:26000});await settled();
  const frames=await stopObserve(),after=await saved(),final=await frame(),expected=structuredClone(before);expected.petPassage={version:1,open};
  assert.deepEqual(stable(after),stable(expected),'physical gate operation changes only its persisted boolean, with no economic or clock grants');
  const active=frames.filter(f=>f.action.kind==='pet-gate');assert.ok(active.some(f=>f.action.phase==='working'),'the protagonist actually operates the gate with a work pose');
  for(const f of active)assert.equal(f.persistedPassage.open,before.petPassage?.open??false,'the gate state commits only after the protagonist finishes actual work');
  assert.ok(active.some(f=>f.action.phase==='outbound')||distance(beforeFrame.movement.position,active[0]?.movement.position??beforeFrame.movement.position)<10,'the gate uses a real hero visit when the character is elsewhere');
  assert.equal(final.passage.open,open);assert.equal(final.passage.drawn,true);assert.equal(final.passage.painted,true);
  receipt.camera.push({case:currentCase,kind:`gate-camera-${label}`,...cameraProof(frames,label,beforeFrame.geometry.scale,beforeFrame.geometry.mapZoom)});
  receipt.gates.push({case:currentCase,kind:label,open,before,after,beforeFrame,final,frames,physicalProof:motionProof(frames,label)});await shot(`${page.viewportSize().width}-${open?'open':'closed'}-gate`);return{frames,final};
}
async function petsOn(surface,label,scale,zoom) {
  currentStep=label;const start=await frame(),points=start.passage.geometry.points,rampDistance=points.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p[0]-points[i][0],p[1]-points[i][1]),0);
  const crossingPets=start.pets.filter(p=>p.surface!==surface),entry=surface==='road'?points.at(-1):points[0];
  const approachDistance=crossingPets.filter(p=>p.surface!=='ramp').reduce((sum,p)=>sum+Math.hypot(p.x-entry[0],p.y-entry[1]),0);
  const arrivalBudget={rampDistance,approachDistance,serialCrossers:crossingPets.length,walkingWorldUnitsPerSecond:44,stanceAndRouteAllowanceSeconds:12,
    timeoutMs:Math.max(38000,Math.ceil((rampDistance*crossingPets.length+approachDistance)/44*1000+12000))};
  const deadline=Date.now()+arrivalBudget.timeoutMs;await observe(label);
  await page.waitForFunction(surface=>{
    const canvas=document.querySelector('#world'),pets=JSON.parse(canvas.dataset.petMotion||'[]'),g=JSON.parse(canvas.dataset.sceneGeometry),r=canvas.getBoundingClientRect(),v=g.viewport;
    if(pets.every(p=>p.surface===surface))return true;
    return pets.some(p=>{if(p.surface!=='ramp'||p.pose!=='walk')return false;const k=p.scale*g.scale,x=r.left+g.dx+p.x*g.scale,y=r.top+g.dy+p.y*g.scale,box={left:x-45*k,right:x+45*k,top:y-80*k,bottom:y+8*k};
      if(box.left<r.left+v.safeLeft+5||box.right>r.left+v.width-v.safeRight-5||box.top<r.top+v.safeTop+5||box.bottom>r.top+v.height-v.safeBottom-5)return false;
      return [box.left,(box.left+box.right)/2,box.right].every(px=>[box.top,(box.top+box.bottom)/2,box.bottom].every(py=>document.elementFromPoint(px,py)===canvas));});
  },surface,{timeout:arrivalBudget.timeoutMs});
  let crossingFrame=null;const crossing=await frame();if(crossing.pets.some(p=>p.surface==='ramp')){
    crossingFrame=crossing;crossingFrame.visibleRampPets=await page.locator('#world').evaluate(canvas=>{
      const pets=JSON.parse(canvas.dataset.petMotion),g=JSON.parse(canvas.dataset.sceneGeometry),r=canvas.getBoundingClientRect(),v=g.viewport;
      return pets.filter(p=>p.surface==='ramp'&&p.pose==='walk').map(p=>{const k=p.scale*g.scale,x=r.left+g.dx+p.x*g.scale,y=r.top+g.dy+p.y*g.scale,box={left:x-45*k,right:x+45*k,top:y-80*k,bottom:y+8*k};
        const fitsUsableViewport=box.left>=r.left+v.safeLeft+5&&box.right<=r.left+v.width-v.safeRight-5&&box.top>=r.top+v.safeTop+5&&box.bottom<=r.top+v.height-v.safeBottom-5;
        const canvasSamples=[box.left,(box.left+box.right)/2,box.right].flatMap(px=>[box.top,(box.top+box.bottom)/2,box.bottom].map(py=>({x:px,y:py,canvas:document.elementFromPoint(px,py)===canvas})));
        return{id:p.id,surface:p.surface,link:p.link,pose:p.pose,feet:{x:p.x,y:p.y},conservativePaintBounds:box,fitsUsableViewport,unobstructed:canvasSamples.every(p=>p.canvas),canvasSamples};
      }).filter(p=>p.fitsUsableViewport&&p.unobstructed);
    });assert.ok(crossingFrame.visibleRampPets.length>0,'an actual full walking animal is inside the usable map and unobstructed by HUD controls');await shot(`${page.viewportSize().width}-${label}-crossing`);
  }
  if(label.startsWith('real-pet-ramp'))assert.ok(crossingFrame,'a real ramp crossing is captured while the complete walking animal fits unobstructed gameplay view');
  await page.waitForFunction(surface=>JSON.parse(document.querySelector('#world').dataset.petMotion||'[]').every(p=>p.surface===surface),surface,{timeout:Math.max(1000,deadline-Date.now())});await page.waitForTimeout(600);
  const frames=await stopObserve();receipt.petRoutes.push({case:currentCase,kind:label,surface,arrivalBudget,crossingFrame,frames,physicalProof:motionProof(frames,label)});receipt.camera.push({case:currentCase,kind:label,...cameraProof(frames,label,scale,zoom)});await shot(`${page.viewportSize().width}-${label}-arrived`);return frames;
}
async function pan() {
  const origin=await page.locator('#world').evaluate(canvas=>{const r=canvas.getBoundingClientRect(),g=JSON.parse(canvas.dataset.sceneGeometry),x=r.left+g.viewport.safeLeft+g.viewport.usableWidth/2,y=r.top+g.viewport.safeTop+g.viewport.usableHeight/2;return document.elementFromPoint(x,y)?.id==='world'?{x,y}:null;});assert.ok(origin,'an unobstructed map point allows a genuine drag');
  const session=await context.newCDPSession(page);await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...origin,id:1}]});for(let i=1;i<=6;i++){await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:origin.x+54*i/6,y:origin.y+32*i/6,id:1}]});await page.waitForTimeout(25);}await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await session.detach();await settled();
}
async function roadTap(label,preferRight=true,longVisible=false) {
  const chosen=await page.locator('#world').evaluate((canvas,{preferRight,longVisible})=>{
    const m=JSON.parse(canvas.dataset.freeMovement),g=JSON.parse(canvas.dataset.sceneGeometry),v=g.viewport,rect=canvas.getBoundingClientRect(),hits=JSON.parse(canvas.dataset.sceneHits),pets=JSON.parse(canvas.dataset.petMotion),candidates=[];
    const latencySeconds=.5,walkingWorldUnitsPerSecond=44,margin=latencySeconds*walkingWorldUnitsPerSecond;
    const bodies=pets.filter(p=>p.surface==='road').map(p=>({id:p.id,...p.body}));
    const clearance=world=>bodies.map(body=>({id:body.id,feet:{x:body.x,y:body.y},radius:body.radius,heroRadius:m.body.radius,separation:Math.hypot(world.x-body.x,world.y-body.y),required:body.radius+m.body.radius}));
    const maxDx=longVisible&&v.width>=700?Math.min(330,Math.floor(v.usableWidth/g.scale*.4/15)*15):135;
    for(let dx=-maxDx;dx<=maxDx;dx+=15)for(let dy=-90;dy<=90;dy+=15){if(Math.hypot(dx,dy)<90)continue;const world={x:m.position.x+dx,y:m.position.y+dy},b=m.world.roadBounds;if(world.x<b.left+15||world.x>b.right-15||world.y<b.top+15||world.y>b.bottom-15)continue;
      if(m.world.obstacles.filter(o=>o.surface==='road').some(o=>world.x>=o.bounds.left-m.body.radius-2&&world.x<=o.bounds.right+m.body.radius+2&&world.y>=o.bounds.top-m.body.radius-2&&world.y<=o.bounds.bottom+m.body.radius+2))continue;
      const petClearances=clearance(world);if(petClearances.some(p=>p.separation<p.required+margin))continue;
      const screen={x:rect.x+g.dx+world.x*g.scale,y:rect.y+g.dy+world.y*g.scale};if(screen.x<rect.x+v.safeLeft+24||screen.x>rect.x+v.width-v.safeRight-24||screen.y<rect.y+v.safeTop+24||screen.y>rect.y+v.height-v.safeBottom-24)continue;
      if(hits.filter(h=>['road-entry','pet-gate','outdoor-site','pet','character','grove-work','grove'].includes(h.kind)).some(h=>h.bounds?world.x>=h.bounds[0]-8&&world.x<=h.bounds[2]+8&&world.y>=h.bounds[1]-8&&world.y<=h.bounds[3]+8:Math.hypot(world.x-h.x,world.y-h.y)<h.radius+8))continue;
      if(document.elementFromPoint(screen.x,screen.y)!==canvas)continue;candidates.push({world,screen,rank:(preferRight?-dx:dx)+Math.abs(dy)*.2,selectionProof:{at:performance.now(),frameAt:m.frameAt,canvasHit:true,latencySeconds,walkingWorldUnitsPerSecond,margin,maxDx,longVisible,petClearances}});
    }
    candidates.sort((a,b)=>a.rank-b.rank);const chosen=candidates[0];if(!chosen)return null;
    // Passive capture records the actual finger target using the current camera
    // and physical feet immediately before the ordinary Scene pointer handler.
    window.__playerPetRoadNativeTap=null;window.__playerPetRoadAcceptedFrame=null;canvas.addEventListener('pointerup',event=>{
      const g=JSON.parse(canvas.dataset.sceneGeometry),m=JSON.parse(canvas.dataset.freeMovement),rect=canvas.getBoundingClientRect(),world={x:(event.clientX-rect.x-g.dx)/g.scale,y:(event.clientY-rect.y-g.dy)/g.scale};
      const bodies=JSON.parse(canvas.dataset.petMotion).filter(p=>p.surface==='road').map(p=>({id:p.id,...p.body}));
      window.__playerPetRoadNativeTap={at:performance.now(),frameAt:m.frameAt,isTrusted:event.isTrusted,world,canvasHit:document.elementFromPoint(event.clientX,event.clientY)===canvas,movement:{moving:m.moving,position:m.position,target:m.target,route:m.route,elapsed:m.elapsed,total:m.total},petClearances:bodies.map(body=>({id:body.id,feet:{x:body.x,y:body.y},radius:body.radius,heroRadius:m.body.radius,separation:Math.hypot(world.x-body.x,world.y-body.y),required:body.radius+m.body.radius}))};
    },{once:true,capture:true});canvas.addEventListener('pointerup',event=>{
      const button=document.querySelector('.road-controls [data-camera-player]'),box=button.getBoundingClientRect(),point={x:box.x+box.width/2,y:box.y+box.height/2};
      window.__playerPetRoadAcceptedFrame={geometry:JSON.parse(canvas.dataset.sceneGeometry),movement:JSON.parse(canvas.dataset.freeMovement),action:JSON.parse(canvas.dataset.sceneAction),pets:JSON.parse(canvas.dataset.petMotion),passage:JSON.parse(canvas.dataset.petPassage),outfit:JSON.parse(canvas.dataset.survivorOutfit),hits:JSON.parse(canvas.dataset.sceneHits),rect:canvas.getBoundingClientRect().toJSON(),capturedAt:performance.now(),nativeEvent:{type:event.type,isTrusted:event.isTrusted,phase:'after-production-canvas-pointerup-handler'},controlProof:{bounds:box.toJSON(),point,hit:document.elementFromPoint(point.x,point.y)?.closest('button')===button,label:button.getAttribute('aria-label')??button.innerText,at:performance.now()}};
    },{once:true});return chosen;
  },{preferRight,longVisible});
  assert.ok(chosen,'a genuine road walking target lies outside actual pet body circles in the current close view');
  for(const pet of chosen.selectionProof.petClearances)assert.ok(pet.separation>=pet.required+chosen.selectionProof.margin,'the selected physical destination includes finite real walking input clearance');
  await page.touchscreen.tap(chosen.screen.x,chosen.screen.y);const {nativeTap,acceptedFrame}=await page.evaluate(()=>({nativeTap:window.__playerPetRoadNativeTap,acceptedFrame:window.__playerPetRoadAcceptedFrame}));
  receipt.inputs.push({case:currentCase,kind:'native-map-touch',label,...chosen,nativeTap,acceptedFrame});assert.ok(nativeTap?.isTrusted&&nativeTap.canvasHit,'a genuine native finger reaches the actual map');
  assert.ok(acceptedFrame?.nativeEvent.isTrusted&&acceptedFrame.nativeEvent.phase==='after-production-canvas-pointerup-handler','the accepted map route is observed after the actual Scene input handler');
  for(const pet of nativeTap.petClearances)assert.ok(pet.separation>=pet.required,'the actual native target remains outside each live pet body');return{...chosen,nativeTap,acceptedFrame};
}
async function retargetRoad() {
  const first=await roadTap('first road destination',true,true),initial=first.acceptedFrame;
  assert.ok(initial.movement.moving&&initial.movement.target,'the first native map touch accepts an actual walking route');
  await page.waitForFunction(({position,target})=>window.__playerPetFrames.some(frame=>{const m=frame.movement;return m.moving&&m.target&&m.target.x===target.x&&m.target.y===target.y&&Math.hypot(m.position.x-position.x,m.position.y-position.y)>.1;}),{position:initial.movement.position,target:initial.movement.target},{timeout:1800});
  const second=await roadTap('new road destination during walking',false),beforeRetarget=second.nativeTap,retargeted=second.acceptedFrame;
  receipt.camera.push({case:currentCase,kind:'native-walking-retarget',initial,beforeRetarget,retargeted});
  assert.ok(beforeRetarget.isTrusted&&beforeRetarget.movement.moving,'the second actual native pointerup arrives while the first route is active');
  assert.deepEqual(beforeRetarget.movement.target,initial.movement.target);assert.deepEqual(beforeRetarget.movement.route,initial.movement.route,'retargeting begins from the original accepted route');
  assert.ok(distance(beforeRetarget.movement.position,initial.movement.position)>.1,'the original native route makes real physical foot progress before retargeting');
  assert.ok(retargeted.movement.moving&&retargeted.movement.target,'the second native handler accepts a walking retarget');assert.ok(distance(retargeted.movement.target,initial.movement.target)>30,'the actual new destination differs from the original accepted destination');
  assert.equal(retargeted.geometry.playerFollowing,true,'a real walking retarget keeps protagonist camera follow');
}
async function resumeDuringWalk() {
  const selector='.road-controls [data-camera-player]',control=page.locator(selector);
  // A real135px walk lasts about0.38s at the configured2x pace. Perform the
  // ordinary scroll/animation preflight before starting it, then measure the
  // fresh control and moving character together before the native finger tap.
  await control.scrollIntoViewIfNeeded();await animations(control);
  await page.evaluate(selector=>{window.__playerPetResumeNativeEvents=[];window.__playerPetResumeAfterHandler=null;window.__playerPetResumeEventObserver=event=>{
    if(!event.target.closest?.(selector))return;const movement=JSON.parse(document.querySelector('#world').dataset.freeMovement);
    window.__playerPetResumeNativeEvents.push({type:event.type,isTrusted:event.isTrusted,at:performance.now(),frameAt:movement.frameAt,moving:movement.moving,target:movement.target,route:movement.route});
  };window.__playerPetResumeAfterHandlerObserver=event=>{
    if(!event.target.closest?.(selector))return;const canvas=document.querySelector('#world');
    window.__playerPetResumeAfterHandler={geometry:JSON.parse(canvas.dataset.sceneGeometry),movement:JSON.parse(canvas.dataset.freeMovement),action:JSON.parse(canvas.dataset.sceneAction),pets:JSON.parse(canvas.dataset.petMotion),passage:JSON.parse(canvas.dataset.petPassage),outfit:JSON.parse(canvas.dataset.survivorOutfit),hits:JSON.parse(canvas.dataset.sceneHits),rect:canvas.getBoundingClientRect().toJSON(),capturedAt:performance.now(),nativeEvent:{type:event.type,isTrusted:event.isTrusted,phase:'after-production-document-click-handler'}};
  };for(const type of ['pointerdown','pointerup','click'])document.addEventListener(type,window.__playerPetResumeEventObserver,true);document.addEventListener('click',window.__playerPetResumeAfterHandlerObserver);},selector);
  const started=await roadTap('destination retained by protagonist-view control',true,true),initial=started.acceptedFrame,{bounds:box,point,hit,label}=initial.controlProof;
  assert.ok(initial.movement.moving,'the atomic pre-tap capture observes an actual active walk');
  assert.ok(box.width>=44&&box.height>=44,'the fresh protagonist-view control is at least44px');assert.equal(hit,true,'the real finger reaches the freshly measured protagonist-view control');
  assert.ok(box.x>=-1&&box.y>=-1&&box.x+box.width<=page.viewportSize().width+1&&box.y+box.height<=page.viewportSize().height+1,'the fresh whole control fits the viewport');
  receipt.inputs.push({case:currentCase,kind:'native-touchscreen-tap',point,bounds:box,label});await page.touchscreen.tap(point.x,point.y);const afterNativeTap=await frame();
  const {nativeTap,resumed}=await page.evaluate(()=>{for(const type of ['pointerdown','pointerup','click'])document.removeEventListener(type,window.__playerPetResumeEventObserver,true);document.removeEventListener('click',window.__playerPetResumeAfterHandlerObserver);return{nativeTap:window.__playerPetResumeNativeEvents,resumed:window.__playerPetResumeAfterHandler};});
  receipt.camera.push({case:currentCase,kind:'resume-during-walk-preserves-route',initial,resumed,afterNativeTap,nativeTap});
  const down=nativeTap.find(event=>event.type==='pointerdown');assert.ok(down?.isTrusted&&down.moving,'the genuine pointer reaches protagonist view while the accepted walk is active');
  assert.deepEqual(down.target,initial.movement.target);assert.deepEqual(down.route,initial.movement.route);
  const click=nativeTap.find(event=>event.type==='click');assert.ok(click?.isTrusted&&click.moving,'the actual native click starts while the accepted walk is active');
  assert.ok(resumed?.nativeEvent.isTrusted&&resumed.nativeEvent.phase==='after-production-document-click-handler','the resumed frame is captured synchronously after the real production click handler');
  assert.ok(initial.controlProof.at<=down.at&&down.at<=click.at&&click.at<=resumed.capturedAt,'initial, native finger and actual handler-result captures are ordered');
  assert.ok(resumed.movement.moving,'protagonist-view control keeps the current walk active');assert.deepEqual(resumed.movement.target,initial.movement.target,'camera resume preserves the actual destination');
  assert.deepEqual(resumed.movement.route,initial.movement.route,'camera resume preserves the accepted walking route');assert.equal(resumed.geometry.playerFollowing,true);
}
async function cameraControls(scale) {
  const before=await saved();await touch(page.locator('[data-camera-toggle]'));await touch(page.locator('[data-map-zoom="1"]'));await settled();let f=await frame();assert.equal(f.geometry.mapZoom,1.25,'ordinary zoom control selects125%');
  await pan();f=await frame();assert.equal(f.geometry.manualCamera,true,'a native drag creates an explicit manual camera');assert.equal(f.geometry.playerFollowing,false);
  await touch(page.locator('.road-controls [data-camera-player]'));await settled();f=await frame();assert.equal(f.geometry.playerFollowing,true);assert.equal(f.geometry.manualCamera,false);assert.equal(f.geometry.mapZoom,1.25,'resume follows the hero without discarding chosen zoom');assert.ok(Math.abs(f.geometry.scale-scale*1.25)<=.003);
  assert.deepEqual(stable(await saved()),stable(before),'zoom, pan and camera resume never modify gameplay state');receipt.camera.push({case:currentCase,kind:'native-pan-zoom-resume',beforeScale:scale,final:f});await shot(`${page.viewportSize().width}-125-percent-player-camera`);
  await touch(page.locator('[data-camera-toggle]'));
  await walk('ground-native-tap-125-percent',()=>roadTap('road walking at chosen125%'),'road',f.geometry.scale,1.25);
}
async function floorResume(scale) {
  currentStep='native-floor-inspection-player-resume';const state=await saved(),before=await frame();
  await touch(page.locator('[data-truck-floor="3"]'));await settled();const inspected=await frame();
  assert.equal(inspected.geometry.activeFloor,3,'ordinary paid-floor tab shows3F');assert.equal(inspected.movement.floor,1);assert.deepEqual(inspected.movement.position,before.movement.position,'floor inspection leaves the actual protagonist feet in place');
  await touch(page.locator('[data-camera-toggle]'));await touch(page.locator('[data-map-zoom="1"]'));await settled();assert.equal((await frame()).geometry.mapZoom,1.25,'the user chooses125% while inspecting another paid floor');await touch(page.locator('[data-camera-toggle]'));
  await touch(page.locator('.road-controls [data-camera-player]'));await settled();const resumed=await frame();
  assert.equal(resumed.geometry.activeFloor,1,'protagonist control restores the actual hero floor after3F inspection');assert.equal(resumed.geometry.playerFollowing,true);assert.equal(resumed.geometry.mapZoom,1.25);assert.ok(Math.abs(resumed.geometry.scale-scale*1.25)<=.003);
  assert.deepEqual(resumed.movement.position,before.movement.position,'floor resume never moves or teleports the protagonist');assert.equal(resumed.movement.surface,before.movement.surface);assert.deepEqual(stable(await saved()),stable(state),'paid floors and all economic progress remain exact after floor inspection and resume');
  receipt.camera.push({case:currentCase,kind:currentStep,before,inspected,resumed});await shot('844-floor-inspection-player-resume');
}
async function closedPatrol(beforePets,label) {
  currentStep=label;
  await observe(label);await page.waitForTimeout(2200);const frames=await stopObserve();for(const f of frames)for(const pet of f.pets){const old=beforePets.find(p=>p.id===pet.id);assert.equal(pet.surface,old.surface,'a closed gate keeps each pet on its current real side');assert.equal(pet.link,null,'closed-side patrol never enters a passage');}
  assert.ok(frames.some(f=>f.pets.some(p=>p.pose==='walk')),'closed-side pets continue natural patrol rather than freezing');receipt.petRoutes.push({case:currentCase,kind:label,frames,physicalProof:motionProof(frames,label)});
}
async function roadsideCamera(scale) {
  await touch(page.locator('.road-controls [data-open="roadside"]'));await touch(page.locator('[data-outdoor-site="spring"]'));const before=await saved();await observe('roadside-work-camera');await touch(page.locator('[data-outdoor-collect="spring"]'));
  await page.waitForFunction(()=>document.querySelector('#app')?.getAttribute('aria-busy')==='true',null,{timeout:2200});await page.waitForFunction(()=>!document.querySelector('#app')?.hasAttribute('aria-busy'),null,{timeout:26000});await settled();const frames=await stopObserve(),active=frames.filter(f=>f.action.outdoorSiteId==='spring');
  assert.ok(active.some(f=>f.action.phase==='outbound')&&active.some(f=>f.action.phase==='working')&&active.some(f=>f.action.phase==='returning'),'genuine roadside collection walks, works and returns');assert.equal((await saved()).resources.water,before.resources.water+12);assert.equal((await saved()).energy,before.energy-8);
  receipt.camera.push({case:currentCase,kind:'roadside-work-camera',...cameraProof(frames,'roadside-work-camera',scale,1),frames,physicalProof:motionProof(frames,'roadside-work-camera')});await shot('390-gather-player-follow');
}
async function crossingClose(scale) {
  await observe('close-while-pet-crossing');await touch(page.locator('.road-controls [data-road-walk]'));await page.waitForFunction(()=>!JSON.parse(document.querySelector('#world').dataset.freeMovement).moving&&JSON.parse(document.querySelector('#world').dataset.freeMovement).surface==='road',null,{timeout:22000});
  await page.waitForFunction(()=>JSON.parse(document.querySelector('#world').dataset.petMotion).some(p=>p.surface==='ramp'),null,{timeout:30000});const crossing=await frame();const descentFrames=await stopObserve();assert.ok(crossing.pets.some(p=>p.surface==='ramp'));receipt.petRoutes.push({case:currentCase,kind:'observed-in-flight-ramp-before-close',frames:descentFrames,physicalProof:motionProof(descentFrames,'in-flight ramp')});
  const closed=await gate(false,'close-while-pet-crossing');const pending=closed.frames.find(f=>f.passage?.closingPending||f.passage?.pendingTarget===false);assert.ok(pending,'close reserves new entries while the hero approaches the occupied gate');
  const admitted=new Set(pending.pets.filter(p=>p.surface==='ramp').map(p=>p.id));assert.ok(admitted.size>0,'an actual pet is already crossing when close reservation starts');
  for(const f of closed.frames.filter(f=>f.movement.frameAt>=pending.movement.frameAt))for(const pet of f.pets)if(pet.surface==='ramp')assert.ok(admitted.has(pet.id),'no new pet enters while the existing crossing safely completes');
  assert.ok(closed.frames.some(f=>f.pets.some(p=>admitted.has(p.id)&&p.surface==='road')),'the admitted pet reaches physical ground before closure');assert.ok(closed.final.pets.every(p=>p.surface!=='ramp'),'closed gate waits until every existing ramp lease exits');
  receipt.camera.push({case:currentCase,kind:'close-while-pet-crossing',...cameraProof(closed.frames,'close-while-pet-crossing',scale,1.25)});
}

try {
  await mkdir('artifacts',{recursive:true});if(finalSnapshot){const manifest=JSON.parse(await readFile(executionInputs.snapshotManifestPath,'utf8'));assert.equal(manifest.snapshotId,snapshotId);assert.equal(manifest.version,version);for(const[path,hash]of Object.entries(manifest.files)){const url=new URL(path,new URL('/',baseUrl)),response=await fetch(url);assert.equal(response.status,200);const bytes=Buffer.from(await response.arrayBuffer());assert.equal(sha(bytes),hash);receipt.httpIdentity.push({path,url:String(url),bytes:bytes.length,sha256:hash});}}
  const fresh=await fixture(),legacy=await fixture(true);browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  for(const[width,height]of[[344,740],[360,800],[390,844],[844,390]]){
    await begin(width,height,width===844?legacy:fresh);const base=(await frame()).geometry.scale;
    await gate(true,'physical-gate-open');const down=await walk('human-ladder-descent-stable-scale',()=>touch(page.locator('.road-controls [data-road-walk]')),'road',base,1);assert.ok(down.frames.some(f=>f.movement.surface==='ladder'&&f.movement.pose==='climb'),'hero really climbs the human ladder');
    const descended=await petsOn('road','real-pet-ramp-descent',base,1);assert.ok(descended.some(f=>f.pets.some(p=>p.surface==='ramp'))||down.frames.some(f=>f.pets.some(p=>p.surface==='ramp')),'pets actually walk their dedicated ramp to ground');
    await walk('ground-native-stop-retarget',retargetRoad,'road',base,1);if(width===390)await roadsideCamera(base);
    await walk('resume-current-ground-walk',resumeDuringWalk,'road',base,1);
    await cameraControls(base);if(width===844)await floorResume(base);const zoomed=base*1.25;
    await gate(false,'physical-gate-close');const sameSide=(await frame()).pets;await closedPatrol(sameSide,'closed-road-patrol');
    await walk('human-descent-pets-gate-closed',()=>touch(page.locator('.road-controls [data-road-walk]')),'road',zoomed,1.25);
    const returned=await walk('human-return-pets-gate-closed',()=>touch(page.locator('.road-controls [data-road-return]')),'deck',zoomed,1.25);assert.ok(returned.frames.some(f=>f.movement.surface==='ladder'&&f.movement.pose==='climb'),'chosen125% zoom survives a real human ladder ascent');await closedPatrol(sameSide,'closed-road-patrol-hero-on-deck');
    await gate(true,'physical-gate-reopen');const landing=await walk('idle-human-landing-return-125-percent',()=>touch(page.locator('.road-controls [data-road-return]')),'deck',zoomed,1.25);
    assert.ok(distance(landing.after.movement.position,landing.after.movement.world.ladder.entry)<.1,'the protagonist stands at the actual human landing that previously blocked an ascending cat');
    await petsOn('deck','real-pet-ramp-ascent-125-percent',zoomed,1.25);
    if(width===390){await crossingClose(zoomed);await closedPatrol((await frame()).pets,'closed-after-in-flight-completion');await gate(true,'reopen-after-safe-in-flight-close');}
    const before=await saved();await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('#world')?.dataset.freeMovement&&!document.querySelector('[data-startup-patch]'),null,{timeout:15000});await pause();assert.deepEqual(nonClock(await saved()),nonClock(before),'reload preserves the exact gate state and all prior gameplay progress');assert.equal((await frame()).passage.open,before.petPassage.open);
    receipt.fixtures.at(-1).reload={before,after:await saved()};await context.close();context=null;console.log(`PASS ${width}x${height}: protagonist camera, actual gate work, dog/cat ramp and exact save reload.`);
  }
  assert.equal(receipt.fixtures.length,4);assert.equal(receipt.gates.length,14);assert.ok(receipt.camera.length>=45);assert.equal(new Set(receipt.bodySeparation.map(p=>p.case)).size,4);assert.ok(receipt.bodySeparation.every(p=>p.checks>0));assert.deepEqual(receipt.errors,[]);assert.deepEqual(receipt.failedAssets,[]);
  receipt.sourceHashesAtFinish=await sourceHashes();assert.deepEqual(receipt.sourceHashesAtFinish,receipt.sourceHashesAtStart,'the source did not change during this browser execution');assert.equal(sha(await readFile(new URL(import.meta.url))),executionInputs.testSha256,'the executed test stayed unchanged');receipt.status='passed';
}catch(error){receipt.status='failed';receipt.failure={case:currentCase,step:currentStep,message:String(error),stack:error.stack};process.exitCode=1;if(page)try{
  receipt.failure.save=await saved();receipt.failure.frame=await frame();
  const observation=await page.evaluate(()=>{const active=window.__playerPetObserving===true,frames=window.__playerPetFrames??[];window.__playerPetObserving=false;return{active,frames,label:frames[0]?.label??null};});
  receipt.failure.observationActive=observation.active;receipt.failure.lastObservedPhase=observation.label;receipt.failure.observedFrames=observation.frames;
  if(receipt.failure.observedFrames.length>=3)try{receipt.failure.physicalProof=motionProof(receipt.failure.observedFrames,observation.label??currentStep);}catch(proofError){receipt.failure.physicalProofError=String(proofError);}
  await shot('failure');
}catch(e){receipt.failure.captureError=String(e);}}
finally{if(browser)await browser.close();receipt.finishedAt=new Date().toISOString();receipt.assertionsExecuted=assertionsExecuted;const path=`artifacts/gameplay-player-pet-v${version}${diagnosticOnly?'-diagnostic':''}-verification.json`;await writeFile(path,JSON.stringify(receipt,null,2));console.log(JSON.stringify({status:receipt.status,assertionsExecuted,receipt:path,error:receipt.failure?.message}));}
