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
const diagnosticOnly = process.env.TEST_V029_DIAGNOSTIC === '1';
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
  schemaVersion:1, samplingIntervalMs:100, scope: 'Chromium mobile emulation, genuine touch controls, natural RAF and real elapsed energy time; no physical-phone or newly-earned paid fixture claim. Compact 10 Hz samples complement continuous sweep unit tests.',
  fixtures: [], art:[], inputs: [], walks: [], energy: [], camera: [], gates: [], petRoutes: [], bodySeparation: [], screenshots: [], httpIdentity: [], errors: [], failedAssets: [] };
let browser, context, page, currentCase = 'preflight', currentStep = 'preflight';
const stable = state => { const copy = structuredClone(state); delete copy.lastSaved; return copy; };
const nonClock = state => { const copy = stable(state); for (const key of ['day', 'minutes', 'totalMinutes', 'energyRecovery']) delete copy[key]; return copy; };
function energyAccounting(before,after,label,baseEnergy=before.energy) {
  const anchor=before.energyRecovery,end=after.energyRecovery;
  assert.ok(anchor&&end&&anchor.version===1&&end.version===1,`${label}: real recovery baselines exist`);
  const elapsed=end.checkedAt-anchor.checkedAt+anchor.carryMs;
  assert.ok(elapsed>=0,`${label}: real elapsed time is monotonic`);
  const gain=Math.floor(elapsed/20000),expectedEnergy=Math.min(100,baseEnergy+gain);
  assert.equal(after.energy,expectedEnergy,`${label}: energy changes only by exactly one point each real20 seconds`);
  assert.equal(end.carryMs,expectedEnergy===100?0:elapsed%20000,`${label}: fractional real time is retained`);
  return{realElapsedMs:end.checkedAt-anchor.checkedAt,carryBeforeMs:anchor.carryMs,carryAfterMs:end.carryMs,gain,energyBefore:before.energy,energyAfter:after.energy};
}
function automaticOnly(before,after,label,transform=()=>{}) {
  const expected=structuredClone(before);transform(expected);const proof=energyAccounting(before,after,label,expected.energy);
  expected.energy=after.energy;expected.energyRecovery=structuredClone(after.energyRecovery);
  assert.deepEqual(stable(after),stable(expected),`${label}: every other saved field remains exact`);return proof;
}
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('road-haven-save-v1')));
function domain(operation, input = {}) {
  const script = `import {createGame,saveGame,loadGame} from './src/game.ts';
import {getPetPassage} from './src/pet-passage.ts';
import {GAME_SPEED_MULTIPLIER} from './src/game-speed.ts';
import {performRoadsideAction} from './src/roadside.ts';
const operation=process.argv[1],state=JSON.parse(process.argv[2]);let raw;const store={getItem:()=>raw??null,setItem:(key,value)=>raw=value};
if(operation==='fresh')console.log(JSON.stringify(createGame('female','동물 통로 검수')));
else if(operation==='collect-spring')console.log(JSON.stringify(performRoadsideAction(state,'spring')));
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
  assert.equal(Object.hasOwn(save,'energyRecovery'),false,'legacy fixtures receive no recovery anchor or benefits in the pure load check');return { save: checked.loaded, provenance };
}
async function frame(controlSelector = null) { return page.locator('#world').evaluate((canvas, selector) => {
  const result = { geometry: JSON.parse(canvas.dataset.sceneGeometry), movement: JSON.parse(canvas.dataset.freeMovement), action: JSON.parse(canvas.dataset.sceneAction), pets: JSON.parse(canvas.dataset.petMotion || '[]'), passage: canvas.dataset.petPassage ? JSON.parse(canvas.dataset.petPassage) : null, outfit: JSON.parse(canvas.dataset.survivorOutfit), outdoor:canvas.dataset.outdoorGround?JSON.parse(canvas.dataset.outdoorGround):null, hits: JSON.parse(canvas.dataset.sceneHits), rect: canvas.getBoundingClientRect().toJSON() };
  if (selector) { const button = document.querySelector(selector), box = button.getBoundingClientRect(), point = { x: box.x + box.width / 2, y: box.y + box.height / 2 }; result.controlProof = { bounds: box.toJSON(), point, hit: document.elementFromPoint(point.x, point.y)?.closest('button') === button, label: button.getAttribute('aria-label') ?? button.innerText, at: performance.now() }; }
  return result;
}, controlSelector); }
async function animations(locator) { await locator.evaluate(async element => { const list = []; for (let node = element; node; node = node.parentElement) list.push(...node.getAnimations().filter(a => a.effect?.getComputedTiming().iterations !== Infinity)); await Promise.all(list.map(a => a.finished.catch(() => {}))); }); }
async function touch(locator) {
  await animations(locator); await locator.scrollIntoViewIfNeeded(); await animations(locator); const box = await locator.boundingBox();
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
  const path = `artifacts/v${version}-gameplay-v029-${diagnosticOnly ? `diagnostic-${runId}-` : ''}${String(receipt.screenshots.length + 1).padStart(2, '0')}-${label}.png`; await page.screenshot({ path, fullPage: true }); const bytes = await readFile(path); receipt.screenshots.push({ path, bytes: bytes.length, sha256: sha(bytes) });
}
async function observe(label) {
  await page.evaluate(label => { window.__playerPetFrames = []; window.__playerPetObserving = true;const observationId=(window.__playerPetObservationId??0)+1;window.__playerPetObservationId=observationId;let last=-Infinity;
    const capture=()=>{if(!window.__playerPetObserving||window.__playerPetObservationId!==observationId)return;const c=document.querySelector('#world'),m=JSON.parse(c.dataset.freeMovement);
      if(m.frameAt-last>=100){last=m.frameAt;const g=JSON.parse(c.dataset.sceneGeometry),a=JSON.parse(c.dataset.sceneAction),p=JSON.parse(c.dataset.petPassage),save=JSON.parse(localStorage.getItem('road-haven-save-v1'));
        window.__playerPetFrames.push({label,at:performance.now(),movement:{frameAt:m.frameAt,moving:m.moving,surface:m.surface,floor:m.floor,link:m.link,position:m.position,body:m.body,target:m.target,pose:m.pose,blockedReason:m.blockedReason},
          geometry:{scale:g.scale,dx:g.dx,dy:g.dy,mapZoom:g.mapZoom,manualCamera:g.manualCamera,playerFollowing:g.playerFollowing,cameraMode:g.cameraMode,cameraCenter:g.cameraCenter,activeFloor:g.activeFloor,overviewBounds:g.overviewBounds,viewport:g.viewport},
          action:{kind:a.kind,phase:a.phase,elapsed:a.elapsed,total:a.total,walk:a.walk,work:a.work,pose:a.pose,climbing:a.climbing,waitingPets:a.waitingPets,petGateClosing:a.petGateClosing,outdoorSiteId:a.outdoorSiteId},
          pets:JSON.parse(c.dataset.petMotion||'[]').map(p=>({id:p.id,x:p.x,y:p.y,scale:p.scale,pose:p.pose,body:p.body,surface:p.surface,floor:p.floor,link:p.link,visible:p.visible,waitingForPassage:p.waitingForPassage,blockedReason:p.blockedReason,gait:{distance:p.gait.distance,speed:p.gait.speed}})),
          passage:{open:p.open,closingPending:p.closingPending,pendingTarget:p.pendingTarget,operating:p.operating,activeCrossings:p.activeCrossings.map(p=>({id:p.id,location:p.location}))},
          persistedPassage:{version:1,open:save.petPassage?.open??false},energy:save.energy,energyRecovery:save.energyRecovery,popupCTAConnected:window.__v029EnergyPopupCTA?window.__v029EnergyPopupCTA.isConnected&&document.querySelector('[data-outdoor-collect="spring"]')===window.__v029EnergyPopupCTA:undefined});
      }requestAnimationFrame(capture);};requestAnimationFrame(capture);},label);
}
async function stopObserve() { return page.evaluate(() => { window.__playerPetObserving = false; return window.__playerPetFrames; }); }
function cameraProof(frames,label,scale,zoom,{manual=false}={}) {
  assert.ok(frames.length>=3,`${label}: several naturally rendered compact frames observed`);let checks=0;
  for(const f of frames){const g=f.geometry,v=g.viewport,b=g.overviewBounds;
    assert.equal(g.playerFollowing,false,`${label}: movement cannot force a close protagonist camera`);
    assert.equal(g.manualCamera,manual,`${label}: only deliberate manual controls change camera mode`);
    assert.equal(g.cameraMode,manual?'manual':'overview');assert.equal(g.mapZoom,zoom);
    assert.ok(Math.abs(g.scale-scale)<=.003,`${label}: normal surfaces and actions cannot shrink or enlarge the map`);checks+=5;
    if(!manual){assert.ok(b,`${label}: actual whole-map bounds are exposed`);const projected={left:g.dx+b.left*g.scale,right:g.dx+b.right*g.scale,top:g.dy+b.top*g.scale,bottom:g.dy+b.bottom*g.scale};
      assert.ok(projected.left>=v.safeLeft+13&&projected.right<=v.width-v.safeRight-13&&projected.top>=v.safeTop+13&&projected.bottom<=v.height-v.safeBottom-13,`${label}: the entire map is inside the area between actual HUD insets`);
      assert.ok(Math.abs(g.cameraCenter.x-(b.left+b.right)/2)<.002&&Math.abs(g.cameraCenter.y-(b.top+b.bottom)/2)<.002,`${label}: actual camera remains at the whole-map center`);checks+=3;
    }
  }return{label,frames:frames.length,checks,minScale:Math.min(...frames.map(f=>f.geometry.scale)),maxScale:Math.max(...frames.map(f=>f.geometry.scale)),zoom,manual};
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
  await pause();await settled(); const loaded=await saved(),f=await frame();
  assert.deepEqual(nonClock(loaded),nonClock(input.save),'old paid state remains exact before any gameplay action'); assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'phone page has no horizontal overflow');
  assert.equal(f.geometry.playerFollowing,false);assert.equal(f.geometry.cameraMode,'overview');assert.equal(f.geometry.manualCamera,false);assert.equal(f.geometry.mapZoom,1);assert.equal(f.passage?.open,false);assert.deepEqual(f.pets.map(p=>p.id).sort(),['cat','dog']);
  receipt.fixtures.push({viewport:{width,height},...input,loaded,initialFrame:f});await shot(`${width}-default-whole-map-overview`);
}
async function walk(label,start,expectedSurface,scale,zoom) {
  currentStep=label;
  const before=await saved();await observe(label);await start();await page.waitForFunction(()=>window.__playerPetFrames.some(frame=>frame.movement.moving),null,{timeout:2200});
  await page.waitForFunction(()=>!JSON.parse(document.querySelector('#world').dataset.freeMovement).moving,null,{timeout:22000});await settled();const frames=await stopObserve(),after=await frame();
  assert.equal(after.movement.surface,expectedSurface);automaticOnly(before,await saved(),label);
  const proof=cameraProof(frames,label,scale,zoom),physicalProof=motionProof(frames,label);receipt.camera.push({case:currentCase,kind:label,...proof});receipt.walks.push({case:currentCase,label,frames,after,physicalProof});return{frames,after};
}
async function gate(open,label) {
  currentStep=label;
  await closeModal();await touch(page.locator('.road-controls [data-open="pet-passage"]')); const before=await saved(),beforeFrame=await frame();
  assert.equal(await page.locator(`[data-pet-passage-toggle="${open?'open':'close'}"]`).isDisabled(),false);
  await observe(label);await touch(page.locator(`[data-pet-passage-toggle="${open?'open':'close'}"]`));
  await page.waitForFunction(()=>document.querySelector('#app')?.getAttribute('aria-busy')==='true',null,{timeout:2200});await page.waitForFunction(()=>!document.querySelector('#app')?.hasAttribute('aria-busy'),null,{timeout:26000});await settled();
  const frames=await stopObserve(),after=await saved(),final=await frame(),expected=structuredClone(before);expected.petPassage={version:1,open};
  const recovery=automaticOnly(before,after,label,next=>{next.petPassage={version:1,open};});
  const active=frames.filter(f=>f.action.kind==='pet-gate');assert.ok(active.some(f=>f.action.phase==='working'),'the protagonist actually operates the gate with a work pose');
  for(const f of active)assert.equal(f.persistedPassage.open,before.petPassage?.open??false,'the gate state commits only after the protagonist finishes actual work');
  assert.ok(active.some(f=>f.action.phase==='outbound')||distance(beforeFrame.movement.position,active[0]?.movement.position??beforeFrame.movement.position)<10,'the gate uses a real hero visit when the character is elsewhere');
  assert.equal(final.passage.open,open);assert.equal(final.passage.drawn,true);assert.equal(final.passage.painted,true);
  receipt.camera.push({case:currentCase,kind:`gate-camera-${label}`,...cameraProof(frames,label,beforeFrame.geometry.scale,beforeFrame.geometry.mapZoom)});
  receipt.gates.push({case:currentCase,kind:label,open,before,after,recovery,beforeFrame,final,frames,physicalProof:motionProof(frames,label)});await shot(`${page.viewportSize().width}-${open?'open':'closed'}-gate`);return{frames,final};
}
async function petsOn(surface,label,scale,zoom) {
  currentStep=label;const start=await frame(),points=start.passage.geometry.points,rampDistance=points.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p[0]-points[i][0],p[1]-points[i][1]),0);
  assert.ok(rampDistance<548,'the actual compact route is shorter than the shortest former large bridge');assert.ok(start.passage.geometry.width>=Math.max(...start.pets.map(p=>p.body.radius))*2,'the painted compact walkway still supports each full paw body');
  const crossingPets=start.pets.filter(p=>p.surface!==surface),entry=surface==='road'?points.at(-1):points[0];
  const approachDistance=crossingPets.filter(p=>p.surface!=='ramp').reduce((sum,p)=>sum+Math.hypot(p.x-entry[0],p.y-entry[1]),0);
  const arrivalBudget={rampDistance,approachDistance,serialCrossers:crossingPets.length,walkingWorldUnitsPerSecond:44,stanceAndRouteAllowanceSeconds:12,
    timeoutMs:Math.max(38000,Math.ceil((rampDistance*crossingPets.length+approachDistance)/44*1000+12000))};
  const deadline=Date.now()+arrivalBudget.timeoutMs;await observe(label);
  await page.evaluate(()=>{window.__v029VisibleRampFrame=null;window.__v029VisibleRampCandidate=null;});
  await page.waitForFunction(surface=>{
    const canvas=document.querySelector('#world'),pets=JSON.parse(canvas.dataset.petMotion||'[]'),g=JSON.parse(canvas.dataset.sceneGeometry),r=canvas.getBoundingClientRect(),v=g.viewport,m=JSON.parse(canvas.dataset.freeMovement);
    if(pets.every(p=>p.surface===surface))return true;
    const visibleRampPets=pets.filter(p=>p.surface==='ramp'&&p.pose==='walk').map(p=>{const k=p.scale*g.scale,x=r.left+g.dx+p.x*g.scale,y=r.top+g.dy+p.y*g.scale,box={left:x-45*k,right:x+45*k,top:y-80*k,bottom:y+8*k};
      const fitsUsableViewport=box.left>=r.left+v.safeLeft+5&&box.right<=r.left+v.width-v.safeRight-5&&box.top>=r.top+v.safeTop+5&&box.bottom<=r.top+v.height-v.safeBottom-5;
      const canvasSamples=[box.left,(box.left+box.right)/2,box.right].flatMap(px=>[box.top,(box.top+box.bottom)/2,box.bottom].map(py=>({x:px,y:py,canvas:document.elementFromPoint(px,py)===canvas})));
      return{id:p.id,surface:p.surface,link:p.link,pose:p.pose,feet:{x:p.x,y:p.y},conservativePaintBounds:box,fitsUsableViewport,unobstructed:canvasSamples.every(p=>p.canvas),canvasSamples};
    }).filter(p=>p.fitsUsableViewport&&p.unobstructed);
    const candidate=visibleRampPets[0],old=window.__v029VisibleRampCandidate;
    if(!candidate){window.__v029VisibleRampCandidate=null;return false;}
    if(!old||old.id!==candidate.id){window.__v029VisibleRampCandidate={id:candidate.id,frameAt:m.frameAt,feet:candidate.feet};return false;}
    const stableNaturalWalkMs=m.frameAt-old.frameAt,naturalFootTravel=Math.hypot(candidate.feet.x-old.feet.x,candidate.feet.y-old.feet.y);
    if(stableNaturalWalkMs<150||naturalFootTravel<3)return false;
    // Read pose, full painted bounds and all nine DOM samples atomically from
    // the same natural frame. An entry turn can no longer change walk to idle
    // between the wait predicate and a later browser telemetry read.
    window.__v029VisibleRampFrame={geometry:g,movement:m,action:JSON.parse(canvas.dataset.sceneAction),pets,passage:JSON.parse(canvas.dataset.petPassage),outfit:JSON.parse(canvas.dataset.survivorOutfit),outdoor:JSON.parse(canvas.dataset.outdoorGround),hits:JSON.parse(canvas.dataset.sceneHits),rect:r.toJSON(),
      visibleRampPets,capturedAt:performance.now(),captureMethod:'atomic-natural-RAF-walking-pose-and-nine-canvas-samples',stableNaturalWalkMs,naturalFootTravel};return true;
  },surface,{timeout:Math.max(1000,deadline-Date.now())});
  const crossingFrame=await page.evaluate(()=>window.__v029VisibleRampFrame);
  if(crossingFrame){assert.ok(crossingFrame.visibleRampPets.length>0,'an actual full walking animal is inside the usable map and unobstructed by HUD controls');assert.ok(crossingFrame.stableNaturalWalkMs>=150&&crossingFrame.naturalFootTravel>=3,'the captured natural walking phase includes genuine foot progress after any entry turn');await shot(`${page.viewportSize().width}-${label}-crossing`);receipt.art.push({case:currentCase,kind:'actual-compact-pet-ramp',frame:crossingFrame,screenshot:receipt.screenshots.at(-1)});}
  if(label.startsWith('real-compact-pet-ramp'))assert.ok(crossingFrame,'a real ramp crossing is captured while the complete walking animal fits unobstructed gameplay view');
  await page.waitForFunction(surface=>JSON.parse(document.querySelector('#world').dataset.petMotion||'[]').every(p=>p.surface===surface),surface,{timeout:Math.max(1000,deadline-Date.now())});await page.waitForTimeout(600);
  const frames=await stopObserve();receipt.petRoutes.push({case:currentCase,kind:label,surface,arrivalBudget,crossingFrame,frames,physicalProof:motionProof(frames,label)});receipt.camera.push({case:currentCase,kind:label,...cameraProof(frames,label,scale,zoom)});await shot(`${page.viewportSize().width}-${label}-arrived`);return frames;
}
async function pan() {
  const drag=await page.locator('#world').evaluate(canvas=>{const r=canvas.getBoundingClientRect(),g=JSON.parse(canvas.dataset.sceneGeometry),x=r.left+g.viewport.safeLeft+g.viewport.usableWidth/2,y=r.top+g.viewport.safeTop+g.viewport.usableHeight/2;return document.elementFromPoint(x,y)?.id==='world'?{origin:{x,y},horizontal:54,vertical:Math.min(32,g.viewport.usableHeight*.12),usableHeight:g.viewport.usableHeight,beforeGeometry:g,rect:r.toJSON()}:null;});assert.ok(drag,'an unobstructed map point allows a genuine drag');const{origin,horizontal,vertical}=drag,nativeSteps=[];
  const session=await context.newCDPSession(page);await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...origin,id:1}]});nativeSteps.push({type:'touchStart',point:origin,completedAt:Date.now()});
  for(let i=1;i<=6;i++){const point={x:origin.x+horizontal*i/6,y:origin.y+vertical*i/6};await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...point,id:1}]});nativeSteps.push({type:'touchMove',index:i,point,completedAt:Date.now()});await page.waitForTimeout(25);}
  await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});nativeSteps.push({type:'touchEnd',completedAt:Date.now()});await session.detach();await settled();const afterGeometry=(await frame()).geometry;receipt.inputs.push({case:currentCase,kind:'native-touchscreen-drag',...drag,nativeSteps,afterGeometry});
}
async function roadTap(label,preferRight=true,longVisible=false) {
  const chosen=await page.locator('#world').evaluate((canvas,{preferRight,longVisible})=>{
    const m=JSON.parse(canvas.dataset.freeMovement),g=JSON.parse(canvas.dataset.sceneGeometry),v=g.viewport,rect=canvas.getBoundingClientRect(),hits=JSON.parse(canvas.dataset.sceneHits),pets=JSON.parse(canvas.dataset.petMotion),candidates=[];
    const latencySeconds=.5,walkingWorldUnitsPerSecond=44,margin=latencySeconds*walkingWorldUnitsPerSecond;
    const bodies=pets.filter(p=>p.surface==='road').map(p=>({id:p.id,...p.body}));
    const clearance=world=>bodies.map(body=>({id:body.id,feet:{x:body.x,y:body.y},radius:body.radius,heroRadius:m.body.radius,separation:Math.hypot(world.x-body.x,world.y-body.y),required:body.radius+m.body.radius}));
    const maxDx=Math.min(longVisible?390:330,Math.floor(v.usableWidth/g.scale*.4/15)*15),road=m.world.roadBounds;
    const searchBounds={left:Math.max(road.left+15,(v.safeLeft+24-g.dx)/g.scale),right:Math.min(road.right-15,(v.width-v.safeRight-24-g.dx)/g.scale),top:Math.max(road.top+15,(v.safeTop+24-g.dy)/g.scale),bottom:Math.min(road.bottom-15,(v.height-v.safeBottom-24-g.dy)/g.scale)};
    const consider=(world,searchKind)=>{const dx=world.x-m.position.x,dy=world.y-m.position.y,travel=Math.hypot(dx,dy),previousTarget=m.moving?m.target:null;
      if(travel<90)return;if(world.x<road.left+15||world.x>road.right-15||world.y<road.top+15||world.y>road.bottom-15)return;
      if(searchKind==='full-visible-road-fallback'&&previousTarget&&Math.hypot(world.x-previousTarget.x,world.y-previousTarget.y)<60)return;
      if(m.world.obstacles.filter(o=>o.surface==='road').some(o=>world.x>=o.bounds.left-m.body.radius-2&&world.x<=o.bounds.right+m.body.radius+2&&world.y>=o.bounds.top-m.body.radius-2&&world.y<=o.bounds.bottom+m.body.radius+2))return;
      const petClearances=clearance(world);if(petClearances.some(p=>p.separation<p.required+margin))return;
      const screen={x:rect.x+g.dx+world.x*g.scale,y:rect.y+g.dy+world.y*g.scale};if(screen.x<rect.x+v.safeLeft+24||screen.x>rect.x+v.width-v.safeRight-24||screen.y<rect.y+v.safeTop+24||screen.y>rect.y+v.height-v.safeBottom-24)return;
      if(hits.filter(h=>['road-entry','pet-gate','outdoor-site','pet','character','grove-work','grove','farm'].includes(h.kind)).some(h=>h.bounds?world.x>=h.bounds[0]-8&&world.x<=h.bounds[2]+8&&world.y>=h.bounds[1]-8&&world.y<=h.bounds[3]+8:Math.hypot(world.x-h.x,world.y-h.y)<Math.max(h.radius,22/g.scale)+8))return;
      if(document.elementFromPoint(screen.x,screen.y)!==canvas)return;
      candidates.push({world,screen,rank:searchKind==='full-visible-road-fallback'?travel:(preferRight?-dx:dx)+Math.abs(dy)*.2,directionRank:preferRight?-dx:dx,selectionProof:{at:performance.now(),frameAt:m.frameAt,canvasHit:true,latencySeconds,walkingWorldUnitsPerSecond,margin,maxDx,longVisible,searchKind,searchBounds,travel,previousTarget,minRetargetSeparation:searchKind==='full-visible-road-fallback'?60:0,petClearances}});
    };
    // Retain the already-proven portrait setup. Only when its local rectangle
    // has no genuine finger target, search the actual visible physical road.
    for(let dx=-maxDx;dx<=maxDx;dx+=15)for(let dy=-90;dy<=90;dy+=15)consider({x:m.position.x+dx,y:m.position.y+dy},'existing-local-neighborhood');
    const localCandidateCount=candidates.length;
    if(!candidates.length)for(let x=Math.ceil(searchBounds.left/15)*15;x<=searchBounds.right;x+=15)for(let y=Math.ceil(searchBounds.top/15)*15;y<=searchBounds.bottom;y+=15)consider({x,y},'full-visible-road-fallback');
    candidates.sort((a,b)=>a.rank-b.rank||a.directionRank-b.directionRank);const chosen=candidates[0];if(!chosen)return null;chosen.selectionProof.localCandidateCount=localCandidateCount;chosen.selectionProof.fallbackCandidateCount=localCandidateCount?0:candidates.length;chosen.selectionProof.selectionContext={geometry:g,rect:rect.toJSON(),position:m.position,body:m.body,roadBounds:road,obstacles:m.world.obstacles,hits,pets:pets.map(p=>({id:p.id,surface:p.surface,body:p.body}))};chosen.selectionProof.sortedCandidateEvidence=candidates.slice(0,5).map(p=>({world:p.world,travel:p.selectionProof.travel,rank:p.rank,directionRank:p.directionRank}));
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
  assert.ok(chosen,'a genuine road walking target lies outside live pet circles and the actual minimum map-hit areas');
  for(const pet of chosen.selectionProof.petClearances)assert.ok(pet.separation>=pet.required+chosen.selectionProof.margin,'the selected physical destination includes finite real walking input clearance');
  await page.touchscreen.tap(chosen.screen.x,chosen.screen.y);const {nativeTap,acceptedFrame}=await page.evaluate(()=>({nativeTap:window.__playerPetRoadNativeTap,acceptedFrame:window.__playerPetRoadAcceptedFrame}));
  receipt.inputs.push({case:currentCase,kind:'native-map-touch',label,...chosen,nativeTap,acceptedFrame});assert.ok(nativeTap?.isTrusted&&nativeTap.canvasHit,'a genuine native finger reaches the actual map');
  assert.ok(acceptedFrame?.nativeEvent.isTrusted&&acceptedFrame.nativeEvent.phase==='after-production-canvas-pointerup-handler','the accepted map route is observed after the actual Scene input handler');
  for(const pet of nativeTap.petClearances)assert.ok(pet.separation>=pet.required,'the actual native target remains outside each live pet body');assert.ok(acceptedFrame.movement.total>0&&acceptedFrame.movement.total<=22,'the real accepted navigation fits the unchanged22-second walking deadline');return{...chosen,nativeTap,acceptedFrame};
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
  assert.equal(retargeted.geometry.playerFollowing,false,'a real walking retarget cannot force protagonist close-up');assert.equal(retargeted.geometry.cameraMode,'overview');
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
  receipt.camera.push({case:currentCase,kind:'whole-map-reset-during-walk-preserves-route',initial,resumed,afterNativeTap,nativeTap});
  const down=nativeTap.find(event=>event.type==='pointerdown');assert.ok(down?.isTrusted&&down.moving,'the genuine pointer reaches whole-map view while the accepted walk is active');
  assert.deepEqual(down.target,initial.movement.target);assert.deepEqual(down.route,initial.movement.route);
  const click=nativeTap.find(event=>event.type==='click');assert.ok(click?.isTrusted&&click.moving,'the actual native click starts while the accepted walk is active');
  assert.ok(resumed?.nativeEvent.isTrusted&&resumed.nativeEvent.phase==='after-production-document-click-handler','the resumed frame is captured synchronously after the real production click handler');
  assert.ok(initial.controlProof.at<=down.at&&down.at<=click.at&&click.at<=resumed.capturedAt,'initial, native finger and actual handler-result captures are ordered');
  assert.ok(resumed.movement.moving,'whole-map control keeps the current walk active');assert.deepEqual(resumed.movement.target,initial.movement.target,'camera resume preserves the actual destination');
  assert.deepEqual(resumed.movement.route,initial.movement.route,'camera resume preserves the accepted walking route');assert.equal(resumed.geometry.playerFollowing,false);assert.equal(resumed.geometry.cameraMode,'overview');
}
async function cameraControls(scale) {
  currentStep='native-map-pan-zoom-and-explicit-overview';const before=await saved();await touch(page.locator('[data-camera-toggle]'));await touch(page.locator('[data-map-zoom="1"]'));await settled();let zoomed=await frame();assert.equal(zoomed.geometry.mapZoom,1.25,'ordinary zoom control selects125%');
  await pan();let manual=await frame();assert.equal(manual.geometry.manualCamera,true);assert.equal(manual.geometry.cameraMode,'manual');assert.equal(manual.geometry.playerFollowing,false);
  await touch(page.locator('[data-camera-toggle]'));await observe('native-map-tap-keeps-manual-view');await roadTap('road walking after deliberate zoom and pan');await page.waitForFunction(()=>!JSON.parse(document.querySelector('#world').dataset.freeMovement).moving,null,{timeout:10000});const frames=await stopObserve();
  const retained=await frame();assert.equal(retained.geometry.manualCamera,true);assert.equal(retained.geometry.mapZoom,1.25);receipt.camera.push({case:currentCase,kind:'native-map-tap-keeps-manual-view',...cameraProof(frames,'manual-view',manual.geometry.scale,1.25,{manual:true}),frames,zoomed,manual,retained,physicalProof:motionProof(frames,'manual-view')});
  await touch(page.locator('.road-controls [data-camera-player]'));await settled();const restored=await frame();assert.equal(restored.geometry.mapZoom,1);assert.equal(restored.geometry.cameraMode,'overview');assert.equal(restored.geometry.manualCamera,false);assert.ok(Math.abs(restored.geometry.scale-scale)<=.003);
  automaticOnly(before,await saved(),'camera-controls');receipt.camera.push({case:currentCase,kind:'explicit-whole-map-reset',restored});await shot(`${page.viewportSize().width}-whole-map-after-manual-reset`);
}
async function floorResume() {
  currentStep='native-paid-floor-inspection-overview';const state=await saved(),before=await frame();await touch(page.locator('[data-truck-floor="3"]'));await settled();const inspected=await frame();
  assert.equal(inspected.geometry.activeFloor,3);assert.equal(inspected.geometry.visibleFloors.length,1);assert.deepEqual(inspected.geometry.visibleFloors,[3]);assert.equal(inspected.movement.floor,1);assert.deepEqual(inspected.movement.position,before.movement.position,'floor inspection never moves actual hero feet');
  await observe('paid-third-floor-overview');await page.waitForTimeout(350);const frames=await stopObserve();receipt.camera.push({case:currentCase,kind:'paid-third-floor-overview',...cameraProof(frames,'paid-third-floor-overview',inspected.geometry.scale,1),frames});await shot('844-paid-third-floor-overview');
  await touch(page.locator('[data-truck-floor="1"]'));await settled();const resumed=await frame();assert.equal(resumed.geometry.activeFloor,1);assert.equal(resumed.geometry.cameraMode,'overview');assert.equal(resumed.geometry.mapZoom,1);assert.deepEqual(resumed.movement.position,before.movement.position);automaticOnly(state,await saved(),'paid-floor-inspection');receipt.camera.push({case:currentCase,kind:currentStep,before,inspected,resumed});
}
async function closedPatrol(beforePets,label) {
  currentStep=label;
  await observe(label);await page.waitForTimeout(2200);const frames=await stopObserve();for(const f of frames)for(const pet of f.pets){const old=beforePets.find(p=>p.id===pet.id);assert.equal(pet.surface,old.surface,'a closed gate keeps each pet on its current real side');assert.equal(pet.link,null,'closed-side patrol never enters a passage');}
  assert.ok(frames.some(f=>f.pets.some(p=>p.pose==='walk')),'closed-side pets continue natural patrol rather than freezing');receipt.petRoutes.push({case:currentCase,kind:label,frames,physicalProof:motionProof(frames,label)});
}
async function roadsideCamera(scale) {
  currentStep='actual-roadside-work-overview';await touch(page.locator('.road-controls [data-open="roadside"]'));await touch(page.locator('[data-outdoor-site="spring"]'));const before=await saved();await observe('roadside-work-overview');await touch(page.locator('[data-outdoor-collect="spring"]'));
  await page.waitForFunction(()=>document.querySelector('#app')?.getAttribute('aria-busy')==='true',null,{timeout:2200});await page.waitForFunction(()=>!document.querySelector('#app')?.hasAttribute('aria-busy'),null,{timeout:26000});await settled();const frames=await stopObserve(),active=frames.filter(f=>f.action.outdoorSiteId==='spring');
  assert.ok(active.some(f=>f.action.phase==='outbound')&&active.some(f=>f.action.phase==='working')&&active.some(f=>f.action.phase==='returning'),'genuine gathering physically walks, works and returns');const expected=domain('collect-spring',before);assert.equal(expected.ok,true);const after=await saved();assert.equal(after.resources.water,before.resources.water+12);automaticOnly(before,after,'roadside-gather',next=>Object.assign(next,expected.state));
  receipt.camera.push({case:currentCase,kind:'roadside-work-overview',...cameraProof(frames,'roadside-work-overview',scale,1),frames,physicalProof:motionProof(frames,'roadside-work-overview')});await shot('390-gather-whole-map-overview');
}
async function energyRecoveryProof() {
  currentStep='real-paused-20-second-energy-recovery';await touch(page.locator('[data-open="energy"]').first());const explanation=await page.locator('#modal-root').innerText();assert.match(explanation,/1분[\s\S]{0,12}3|3[\s\S]{0,12}1분/,'the real energy popup explains three points per minute');assert.doesNotMatch(explanation,/기력\s*[+＋]\s*(55|35)/,'old rest energy grants are removed from recovery guidance');assert.equal(await page.locator('[data-rest-retry]').count(),0);await closeModal();
  await touch(page.locator('.road-controls [data-open="roadside"]'));await touch(page.locator('[data-outdoor-site="spring"]'));const popupSelector='[data-outdoor-collect="spring"]',popupButton=page.locator(popupSelector);await animations(popupButton);await popupButton.scrollIntoViewIfNeeded();await animations(popupButton);
  await popupButton.evaluate(button=>{window.__v029EnergyPopupCTA=button;});
  const popupIdentity=async()=>popupButton.evaluate(button=>{const bounds=button.getBoundingClientRect().toJSON(),point={x:bounds.x+bounds.width/2,y:bounds.y+bounds.height/2};return{capturedAt:performance.now(),sameMounted:button===window.__v029EnergyPopupCTA,connected:window.__v029EnergyPopupCTA.isConnected,bounds,point,buttonHit:document.elementFromPoint(point.x,point.y)?.closest('button')===button,disabled:button.disabled,label:button.getAttribute('aria-label')??button.innerText};});
  const assertPopup=proof=>{assert.equal(proof.sameMounted,true,'the exact mounted spring CTA survives automatic energy recovery');assert.equal(proof.connected,true);assert.equal(proof.disabled,false);assert.equal(proof.buttonHit,true,'the real CTA remains available to a native finger');assert.ok(proof.bounds.width>=44&&proof.bounds.height>=44);assert.ok(proof.bounds.x>=-1&&proof.bounds.y>=-1&&proof.bounds.x+proof.bounds.width<=page.viewportSize().width+1&&proof.bounds.y+proof.bounds.height<=page.viewportSize().height+1);};
  const mounted=await popupIdentity();assertPopup(mounted);
  const warmUpBefore=await saved(),warmUpStartedAt=Date.now();assert.ok(warmUpBefore.energy<=97,'the unmodified fresh game has room for natural synchronization and recovery');assert.ok(warmUpBefore.energyRecovery);
  const synchronization=[];let before;
  for(let attempt=0;attempt<3;attempt++){
    const start=await saved(),startedAt=Date.now();await page.waitForFunction(energy=>{const save=JSON.parse(localStorage.getItem('road-haven-save-v1'));return save.energy>energy&&save.energyRecovery.carryMs<1000;},start.energy,{timeout:23500});
    const actual=await saved();synchronization.push({startedAt,endedAt:Date.now(),before:start,after:actual,proof:automaticOnly(start,actual,'natural-recovery-rollover-synchronization')});
    if(actual.energyRecovery.carryMs<2000){before=actual;break;}
  }
  assert.ok(before,'the observed recovery carry is fresh; protocol delays are recorded without resetting any state');assert.ok(before.energy<=97,'the synchronized fresh game still has room for three recovery points');assert.ok(before.energyRecovery.carryMs<2000);
  const proofStart=await popupIdentity();assertPopup(proofStart);
  const warmUp={realStartedAt:warmUpStartedAt,realEndedAt:Date.now(),before:warmUpBefore,after:before,synchronization,proof:automaticOnly(warmUpBefore,before,'natural-recovery-rollover-warm-up')},startAt=Date.now();assert.equal(await page.locator('[data-rest-retry]').count(),0,'there is no energy-rest retry control');
  await observe('real-paused-energy-recovery');await page.waitForTimeout(20020);await page.waitForFunction(energy=>JSON.parse(localStorage.getItem('road-haven-save-v1')).energy===energy+1,before.energy,{timeout:2000});await page.waitForTimeout(150);const after=await saved(),endAt=Date.now(),frames=await stopObserve(),proof=automaticOnly(before,after,'real-paused-energy-recovery');
  assert.equal(after.energy,before.energy+1);assert.ok(endAt-startAt>=20000,'the energy proof uses a complete real20 seconds without clock replacement');assert.ok(endAt-startAt<23500);assert.equal(await page.locator('.time-button').getAttribute('aria-label'),'시간 계속','automatic recovery runs even while village time is paused');
  const proofFinish=await popupIdentity();assertPopup(proofFinish);assert.ok(frames.every(f=>f.popupCTAConnected===true),'every naturally observed recovery frame keeps the same in-document spring CTA');
  assert.ok(frames.some(f=>f.energy===before.energy)&&frames.some(f=>f.energy===after.energy));receipt.energy.push({case:currentCase,kind:currentStep,explanation,popup:{selector:popupSelector,mounted,proofStart,proofFinish,observedChecks:frames.length,allObservedConnected:true},warmUp,realStartAt:startAt,realEndAt:endAt,before,after,proof,frames,physicalProof:motionProof(frames,'real-paused-energy-recovery')});receipt.camera.push({case:currentCase,kind:'real-paused-energy-recovery',...cameraProof(frames,'real-paused-energy-recovery',frames[0].geometry.scale,1)});await shot('344-real-automatic-energy-recovery');await closeModal();await page.evaluate(()=>{delete window.__v029EnergyPopupCTA;});
}
async function humanStairStart() {
  await touch(page.locator('.road-controls [data-road-walk]'));await page.waitForFunction(()=>JSON.parse(document.querySelector('#world').dataset.freeMovement).surface==='ladder',null,{timeout:10000});const f=await frame();assert.equal(f.movement.pose,'climb');assert.equal(f.movement.link,'road-1');assert.equal(f.outdoor.accessStairs.drawn,true);assert.equal(f.outdoor.accessStairs.painted,true);assert.equal(f.outdoor.accessStairs.width,48);assert.ok(f.outdoor.accessStairs.treadQuads.length>=3);assert.ok(distance({x:f.outdoor.accessStairs.top[0],y:f.outdoor.accessStairs.top[1]},f.movement.world.ladder.top)<.001);assert.ok(distance({x:f.outdoor.accessStairs.bottom[0],y:f.outdoor.accessStairs.bottom[1]},f.movement.world.ladder.bottom)<.001);await shot(`${page.viewportSize().width}-real-human-stairs-descent`);receipt.art.push({case:currentCase,kind:'actual-human-stairs',frame:f,screenshot:receipt.screenshots.at(-1)});
}
async function crossingClose(scale) {
  await observe('close-while-pet-crossing');await touch(page.locator('.road-controls [data-road-walk]'));await page.waitForFunction(()=>!JSON.parse(document.querySelector('#world').dataset.freeMovement).moving&&JSON.parse(document.querySelector('#world').dataset.freeMovement).surface==='road',null,{timeout:22000});
  await page.waitForFunction(()=>JSON.parse(document.querySelector('#world').dataset.petMotion).some(p=>p.surface==='ramp'),null,{timeout:30000});const crossing=await frame();const descentFrames=await stopObserve();assert.ok(crossing.pets.some(p=>p.surface==='ramp'));receipt.petRoutes.push({case:currentCase,kind:'observed-in-flight-ramp-before-close',frames:descentFrames,physicalProof:motionProof(descentFrames,'in-flight ramp')});
  const closed=await gate(false,'close-while-pet-crossing');const pending=closed.frames.find(f=>f.passage?.closingPending||f.passage?.pendingTarget===false);assert.ok(pending,'close reserves new entries while the hero approaches the occupied gate');
  const admitted=new Set(pending.pets.filter(p=>p.surface==='ramp').map(p=>p.id));assert.ok(admitted.size>0,'an actual pet is already crossing when close reservation starts');
  for(const f of closed.frames.filter(f=>f.movement.frameAt>=pending.movement.frameAt))for(const pet of f.pets)if(pet.surface==='ramp')assert.ok(admitted.has(pet.id),'no new pet enters while the existing crossing safely completes');
  assert.ok(closed.frames.some(f=>f.pets.some(p=>admitted.has(p.id)&&p.surface==='road')),'the admitted pet reaches physical ground before closure');assert.ok(closed.final.pets.every(p=>p.surface!=='ramp'),'closed gate waits until every existing ramp lease exits');
  receipt.camera.push({case:currentCase,kind:'close-while-pet-crossing',...cameraProof(closed.frames,'close-while-pet-crossing',scale,1)});
}

try {
  await mkdir('artifacts',{recursive:true});if(finalSnapshot){const manifest=JSON.parse(await readFile(executionInputs.snapshotManifestPath,'utf8'));assert.equal(manifest.snapshotId,snapshotId);assert.equal(manifest.version,version);for(const[path,hash]of Object.entries(manifest.files)){const url=new URL(path,new URL('/',baseUrl)),response=await fetch(url);assert.equal(response.status,200);const bytes=Buffer.from(await response.arrayBuffer());assert.equal(sha(bytes),hash);receipt.httpIdentity.push({path,url:String(url),bytes:bytes.length,sha256:hash});}}
  const fresh=await fixture(),legacy=await fixture(true);browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  for(const[width,height]of[[344,740],[360,800],[390,844],[844,390]]){
    await begin(width,height,width===844?legacy:fresh);const base=(await frame()).geometry.scale;
    await observe('default-whole-map-overview');await page.waitForTimeout(350);const initial=await stopObserve();receipt.camera.push({case:currentCase,kind:'default-whole-map-overview',...cameraProof(initial,'default-whole-map-overview',base,1),frames:initial,physicalProof:motionProof(initial,'default-whole-map-overview')});
    if(width===344)await energyRecoveryProof();
    await gate(true,'physical-gate-open');const down=await walk('human-stairs-descent-overview',()=>humanStairStart(),'road',base,1);assert.ok(down.frames.some(f=>f.movement.surface==='ladder'&&f.movement.pose==='climb'),'hero really uses the painted human stairs');
    const descended=await petsOn('road','real-compact-pet-ramp-descent',base,1);assert.ok(descended.some(f=>f.pets.some(p=>p.surface==='ramp'))||down.frames.some(f=>f.pets.some(p=>p.surface==='ramp')),'pets actually walk their compact dedicated ramp');
    await walk('ground-native-stop-retarget',retargetRoad,'road',base,1);await walk('whole-map-reset-preserves-ground-walk',resumeDuringWalk,'road',base,1);if(width===390)await roadsideCamera(base);await cameraControls(base);
    await gate(false,'physical-gate-close');const sameSide=(await frame()).pets;await closedPatrol(sameSide,'closed-road-patrol');
    // Operating the gate leaves the hero at the real deck hinge. Descend again
    // with the gate closed before asking for an actual stair ascent.
    const closedDown=await walk('human-stairs-descent-pets-gate-closed',()=>touch(page.locator('.road-controls [data-road-walk]')),'road',base,1);
    assert.ok(closedDown.frames.some(f=>f.movement.surface==='ladder'&&f.movement.pose==='climb'),'the closed-gate setup genuinely descends the human stairs');
    for(const f of closedDown.frames)for(const pet of f.pets){assert.equal(pet.surface,'road','closed-side companions remain on the physical road during the hero descent');assert.equal(pet.link,null,'no companion crosses a closed gate during the hero descent');}
    const returned=await walk('human-stairs-return-overview',()=>touch(page.locator('.road-controls [data-road-return]')),'deck',base,1);assert.ok(returned.frames.some(f=>f.movement.surface==='ladder'&&f.movement.pose==='climb'));await closedPatrol(sameSide,'closed-road-patrol-hero-on-deck');
    await gate(true,'physical-gate-reopen');await walk('human-landing-no-forced-zoom',()=>touch(page.locator('.road-controls [data-road-return]')),'deck',base,1);await petsOn('deck','real-compact-pet-ramp-ascent',base,1);
    if(width===390){await crossingClose(base);await closedPatrol((await frame()).pets,'closed-after-in-flight-completion');await gate(true,'reopen-after-safe-in-flight-close');}
    if(width===844)await floorResume();
    const before=await saved();await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('#world')?.dataset.freeMovement&&!document.querySelector('[data-startup-patch]'),null,{timeout:15000});await pause();const after=await saved();const reloadRecovery=energyAccounting(before,after,'real-reload-recovery');const check=structuredClone(after);check.energy=before.energy;assert.deepEqual(nonClock(check),nonClock(before),'reload retains gate, paid floors and every economic progress field');assert.equal((await frame()).passage.open,before.petPassage.open);assert.equal((await frame()).geometry.cameraMode,'overview');receipt.fixtures.at(-1).reload={before,after,recovery:reloadRecovery};await context.close();context=null;console.log(`PASS ${width}x${height}: whole-map overview, natural human stairs, compact dog/cat ramp, actual gate and exact progress reload.`);
  }
  assert.equal(receipt.fixtures.length,4);assert.equal(receipt.gates.length,14);assert.equal(receipt.energy.length,1);assert.equal(new Set(receipt.bodySeparation.map(p=>p.case)).size,4);assert.ok(receipt.bodySeparation.every(p=>p.checks>0));assert.deepEqual(receipt.errors,[]);assert.deepEqual(receipt.failedAssets,[]);
  receipt.sourceHashesAtFinish=await sourceHashes();assert.deepEqual(receipt.sourceHashesAtFinish,receipt.sourceHashesAtStart,'the source did not change during this browser execution');assert.equal(sha(await readFile(new URL(import.meta.url))),executionInputs.testSha256,'the executed test stayed unchanged');receipt.status='passed';
}catch(error){receipt.status='failed';receipt.failure={case:currentCase,step:currentStep,message:String(error),stack:error.stack};process.exitCode=1;if(page)try{
  receipt.failure.save=await saved();receipt.failure.frame=await frame();
  const observation=await page.evaluate(()=>{const active=window.__playerPetObserving===true,frames=window.__playerPetFrames??[];window.__playerPetObserving=false;return{active,frames,label:frames[0]?.label??null};});
  receipt.failure.observationActive=observation.active;receipt.failure.lastObservedPhase=observation.label;receipt.failure.observedFrames=observation.frames;
  if(receipt.failure.observedFrames.length>=3)try{receipt.failure.physicalProof=motionProof(receipt.failure.observedFrames,observation.label??currentStep);}catch(proofError){receipt.failure.physicalProofError=String(proofError);}
  await shot('failure');
}catch(e){receipt.failure.captureError=String(e);}}
finally{if(browser)await browser.close();receipt.finishedAt=new Date().toISOString();receipt.assertionsExecuted=assertionsExecuted;const path=`artifacts/gameplay-v029-v${version}${diagnosticOnly?'-diagnostic':''}-verification.json`;await writeFile(path,JSON.stringify(receipt,null,2));console.log(JSON.stringify({status:receipt.status,assertionsExecuted,receipt:path,error:receipt.failure?.message}));}
