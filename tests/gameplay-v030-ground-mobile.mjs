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
const diagnosticOnly = process.env.TEST_V030_DIAGNOSTIC === '1';
if (finalSnapshot === diagnosticOnly) throw Error('Choose one immutable final snapshot or mutable development diagnostic.');
const receiptTag=process.env.TEST_RECEIPT_TAG??'';
if(receiptTag&&!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(receiptTag))throw Error('Receipt tag must be a safe unique file suffix.');
if(finalSnapshot&&receiptTag!=='v030-r1-test-r2')throw Error('This final test revision requires its unique v030-r1-test-r2 receipt tag.');
const sha = value => createHash('sha256').update(value).digest('hex');
let assertionsExecuted = 0;
const assert = new Proxy(strictAssert, { get(target, key) { const value = Reflect.get(target, key); return typeof value === 'function' ? (...args) => { assertionsExecuted++; return value(...args); } : value; } });
const executionInputs = await captureExecutionInputs(import.meta.url, { snapshotId, finalSnapshot, dependencies:['artifacts/gameplay-v029-v0.29.0-verification.json'] });
const sourceScopes = ['src', 'public', 'scripts', 'index.html', 'package.json', 'package-lock.json', 'release-version.json', 'content-release.json', 'capacitor.config.ts', 'vite.config.ts', 'tsconfig.json'];
async function sourceHashes() {
  const result = spawnSync('rg', ['--files', '--hidden', '--no-ignore', ...sourceScopes], { encoding: 'utf8' });
  if (result.status !== 0) throw Error(result.stderr);
  return Object.fromEntries(await Promise.all(result.stdout.trim().split('\n').sort().map(async path => [path, sha(await readFile(path))])));
}
const runId = String(Date.now());
const receipt = { version, baseUrl, snapshotId, finalSnapshot, diagnosticOnly, runId, executionInputs,
  receiptTag,testRevisionId:receiptTag||null,
  sourceHashesAtStart: await sourceHashes(), status: 'running', startedAt: new Date().toISOString(),
  schemaVersion:1, samplingIntervalMs:100, scope: 'Chromium mobile emulation, genuine touch controls, natural RAF and real elapsed energy time; no physical-phone or newly-earned paid fixture claim. Compact 10 Hz samples complement continuous sweep unit tests.',
  fixtures: [], art:[], inputs: [], walks: [], phases: [], blockedInputs: [], collections: [], camera: [], gates: [], petRoutes: [], groundBodyProofs: [], screenshots: [], httpIdentity: [], errors: [], failedAssets: [] };
if(receiptTag){
 const originalTestPath='artifacts/diagnostics/v030-ground-final-r1/tests/gameplay-v030-ground-mobile.mjs',originalFailurePath='artifacts/diagnostics/v030-ground-final-r1/artifacts/gameplay-v030-ground-v0.30.0-verification.json',preservationPath='artifacts/diagnostics/v030-ground-final-r1/preservation.json';
 receipt.testRevision={id:receiptTag,scope:'test-measurement-only-actual-remaining-accepted-deck-route',immutableSnapshotId:snapshotId,
  originalExecutedTest:{path:originalTestPath,sha256:sha(await readFile(originalTestPath))},originalFailedFinalReceipt:{path:originalFailurePath,sha256:sha(await readFile(originalFailurePath))},failurePreservation:{path:preservationPath,sha256:sha(await readFile(preservationPath))}};
 assert.equal(receipt.testRevision.originalExecutedTest.sha256,'f8fd0ed9d9192028ee6d66e3b1ad6a355e727988b43cafd784161a442e0d9cf4');assert.equal(receipt.testRevision.originalFailedFinalReceipt.sha256,'f46790e2d0851268e932c4f7d449b8ddbd743c5de5a71cd7a091e75b23b5e78e');assert.equal(receipt.testRevision.failurePreservation.sha256,'122a095b8f5bb5a57c04431e3ea86df9a3b87cf8e681ba601bfb94128f71c981');
}
let browser, context, page, currentCase = 'preflight', currentStep = 'preflight';
const stable = state => { const copy = structuredClone(state); delete copy.lastSaved; return copy; };
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
function domain(operation,input={}) {
 const script=`import {createGame,loadGame,applyOfflineProgress,advanceTime} from './src/game.ts';
import {recoverEnergy} from './src/energy-recovery.ts';
import {GAME_SPEED_MULTIPLIER} from './src/game-speed.ts';
import {performRoadsideAction,ROADSIDE_RULES} from './src/roadside.ts';
import {getOutdoorSites} from './src/outdoor-sites.ts';
const operation=process.argv[1],input=JSON.parse(process.argv[2]);
if(operation==='fresh')console.log(JSON.stringify(createGame('female','차체 바깥 도로 검수')));
else if(operation==='validate'){const raw=JSON.stringify(input);console.log(JSON.stringify({loaded:loadGame({getItem:()=>raw}),speed:GAME_SPEED_MULTIPLIER}));}
else if(operation==='clock')console.log(JSON.stringify(advanceTime(input.state,input.minutes)));
else if(operation==='recover')console.log(JSON.stringify(recoverEnergy(input.state,input.now)));
else if(operation==='collect')console.log(JSON.stringify({result:performRoadsideAction(input.state,input.id),rule:ROADSIDE_RULES[input.id]}));
else if(operation==='sites')console.log(JSON.stringify(getOutdoorSites(input.level)));`;
 const result=spawnSync(process.execPath,['--import','tsx','--input-type=module','-e',script,operation,JSON.stringify(input)],{encoding:'utf8'});
 assert.equal(result.status,0,`actual unchanged domain executes: ${result.stderr}`);return JSON.parse(result.stdout);
}
async function fixture(paid=false){
 let save=domain('fresh'),provenance={kind:'actual-createGame',earned:false,declaration:'Exact ordinary new game. No resources, energy, level, gate or elapsed time granted.'};
 if(paid){
  const path='artifacts/gameplay-v029-v0.29.0-verification.json',bytes=await readFile(path),previous=JSON.parse(bytes);
  assert.equal(sha(bytes),'ec6399688617f11fa2d3ea156d72b0a9220da695cfa74570948b94aec3a18935');assert.equal(previous.status,'passed');assert.equal(previous.finalSnapshot,true);
  const index=previous.fixtures.findIndex(f=>f.viewport.width===844&&f.viewport.height===390);assert.ok(index>=0);
  save=structuredClone(previous.fixtures[index].reload.after);
  assert.equal(sha(JSON.stringify(save)),'1e27fc7658d8058d6c001b5ade87b29b6b07ea15612e4f4e26de0424ca7991b0');
  assert.equal(save.deckLevel,7);assert.equal(save.truckLayout.floors,3);assert.equal(save.energy,7);
  provenance={kind:'actual-v029-final-observed-paid-reload-save',path,receiptSha256:sha(bytes),jsonPointer:`/fixtures/${index}/reload/after`,saveJsonSha256:sha(JSON.stringify(save)),earned:false,
   declaration:'Exact previously observed level7/three-floor paid save, without new paid growth claims. Original lastSaved and real energy anchor remain untouched; genuine wall absence is applied only by normal production startup.'};
 }
 const checked=domain('validate',save);assert.deepEqual(checked.loaded,save,'pure loading grants no elapsed time, resources, energy or progress');assert.equal(checked.speed,2);
 return{save,provenance,paid};
}
async function frame(controlSelector = null) { return page.locator('#world').evaluate((canvas, selector) => {
  const matrix=canvas.getContext('2d').getTransform(),renderTransform={a:matrix.a,b:matrix.b,c:matrix.c,d:matrix.d,e:matrix.e,f:matrix.f,dpr:Math.min(devicePixelRatio||1,2)};
  const result = { renderTransform,geometry: JSON.parse(canvas.dataset.sceneGeometry), movement: JSON.parse(canvas.dataset.freeMovement), action: JSON.parse(canvas.dataset.sceneAction), pets: JSON.parse(canvas.dataset.petMotion || '[]'), passage: canvas.dataset.petPassage ? JSON.parse(canvas.dataset.petPassage) : null, outfit: JSON.parse(canvas.dataset.survivorOutfit), outdoor:canvas.dataset.outdoorGround?JSON.parse(canvas.dataset.outdoorGround):null, hits: JSON.parse(canvas.dataset.sceneHits), rect: canvas.getBoundingClientRect().toJSON() };
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
  await page.evaluate(() => { window.__groundCameraLast = null; window.__groundCameraStable = 0; });
  await page.waitForFunction(() => { const c = document.querySelector('#world'); if (!c?.dataset.sceneGeometry) return false; const g = JSON.parse(c.dataset.sceneGeometry), m = JSON.parse(c.dataset.freeMovement), old = window.__groundCameraLast; if (old?.at === m.frameAt) return false; window.__groundCameraLast = { at: m.frameAt, dx: g.dx, dy: g.dy, scale: g.scale }; window.__groundCameraStable = old && Math.abs(g.dx-old.dx)<.25 && Math.abs(g.dy-old.dy)<.25 && Math.abs(g.scale-old.scale)<.0005 ? window.__groundCameraStable+1 : 0; return window.__groundCameraStable >= 3; }, null, { timeout: 6000 });
}
async function shot(label) {
  const path = `artifacts/v${version}-gameplay-v030-ground-${receiptTag?`${receiptTag}-`:''}${diagnosticOnly ? `diagnostic-${runId}-` : ''}${String(receipt.screenshots.length + 1).padStart(2, '0')}-${label}.png`; await page.screenshot({ path, fullPage: true }); const bytes = await readFile(path); receipt.screenshots.push({ path, bytes: bytes.length, sha256: sha(bytes) });
}

// Independent geometry. A 10 Hz chord across a route corner is not the real
// motion path: continuous sweeps use the actual accepted path vertices.
function pointInside(p,polygon){let inside=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
 const a=polygon[i],b=polygon[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
}return inside;}
function pointSegment(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,n=dx*dx+dy*dy,t=n?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/n)):0;return Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t);}
function segmentDistance(a,b,c,d){
 const cross=(p,q,r)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);
 const abC=cross(a,b,c),abD=cross(a,b,d),cdA=cross(c,d,a),cdB=cross(c,d,b);
 if(abC*abD<=0&&cdA*cdB<=0&&Math.max(Math.min(a.x,b.x),Math.min(c.x,d.x))<=Math.min(Math.max(a.x,b.x),Math.max(c.x,d.x))+1e-8&&Math.max(Math.min(a.y,b.y),Math.min(c.y,d.y))<=Math.min(Math.max(a.y,b.y),Math.max(c.y,d.y))+1e-8)return 0;
 return Math.min(pointSegment(a,c,d),pointSegment(b,c,d),pointSegment(c,a,b),pointSegment(d,a,b));
}
function circleClearance(p,polygon){const d=Math.min(...polygon.map((a,i)=>pointSegment(p,a,polygon[(i+1)%polygon.length])));return pointInside(p,polygon)?-d:d;}
function sweepClearance(a,b,polygon){if(pointInside(a,polygon)||pointInside(b,polygon))return -1;return Math.min(...polygon.map((c,i)=>segmentDistance(a,b,c,polygon[(i+1)%polygon.length])));}
function remainingDeckApproach(route,position,surface){
 if(surface!=='deck')return{remainingDeckDistance:0,currentSegment:null,positionError:0};
 if(!route?.surfaces.includes('ramp'))return null;
 const rampIndex=route.surfaces.indexOf('ramp'),points=route.points.map(([x,y])=>({x,y})),matches=[];
 if(rampIndex===0){const error=distance(position,points[0]);assert.ok(error<=.002,'a deck admission with no approach starts at the real ramp entry');return{remainingDeckDistance:0,currentSegment:null,positionError:error,firstRampSegment:0};}
 for(let i=0;i<rampIndex;i++)if(route.surfaces[i]==='deck'){const error=pointSegment(position,points[i],points[i+1]);if(error<=.002)matches.push({index:i,error});}
 assert.ok(matches.length>0,'the actual feet lie on the accepted deck approach');matches.sort((a,b)=>a.error-b.error||b.index-a.index);const current=matches[0];
 let remainingDeckDistance=distance(position,points[current.index+1]);for(let i=current.index+1;i<rampIndex;i++)if(route.surfaces[i]==='deck')remainingDeckDistance+=distance(points[i],points[i+1]);
 return{remainingDeckDistance,currentSegment:current.index,positionError:current.error,firstRampSegment:rampIndex};
}
function expectedTruckPaintPoints(level){
 const step=Math.max(0,Math.min(7,level-1)),left=-318-step*14,back=[-184,-356,-528,-544,-560,-576,-744,-768][step],end=[234,282,350,558,582,606,634,662][step],front=[141,228,228,254,324,344,420,448][step];
 const p=(u,v,ground=false)=>({x:480+u*.91-v*.67,y:325+u*.34+v*.47+(ground?95:0)});
 const roof=[p(left,back),p(end,back),p(end,back,true),p(end,front,true),p(left,front,true),p(left,front)],cab=p(end+95,(back+front)/2);
 const cabOffsets=[[-114,-117],[-63,-173],[6,-207],[92,-162],[112,-59],[94,-31],[4,1],[-49,1],[-63,-8],[-114,-95]];
 // Actual opaque boxes painted by Scene.truck(), projected at both heights.
 const box=(u0,u1,v0,v1,z0,z1)=>[u0,u1].flatMap(u=>[v0,v1].flatMap(v=>[z0,z1].map(z=>({x:480+u*.91-v*.67,y:420+u*.34+v*.47-z}))));
 const wheelOffsets=[[-27.8,-46.47],[-24.1,-58.64],[-11.26,-69.39],[9.53,-69.73],[25.92,-41.9],[24.18,-17.75],[18.19,-8.65],[0.5,-0.74],[-8.23,-1.98],[-21.65,-16.13]],wheels=[];
 for(let u=left+62;u<end+30;u+=136){const anchor=p(u,front+9);for(const[x,y]of wheelOffsets)wheels.push({x:anchor.x+1+x,y:anchor.y+129+y});}
 return[...roof,...box(left+12,end+46,back+10,front-9,-6,57),...box(left+15,end-13,back+8,front,31,78),...wheels,...cabOffsets.map(([x,y])=>({x:cab.x+4+x,y:cab.y+168+y}))];
}
let caseBody;
function truckBody(f,level){
 const matches=f.movement.world.obstacles.filter(o=>o.kind==='truck-body'&&o.surface==='road');assert.equal(matches.length,1,'one complete physical truck body, without corridor holes');
 const body=matches[0],expected=expectedTruckPaintPoints(level);assert.ok(body.polygon.length>=6);
 for(const point of expected)assert.ok(circleClearance(point,body.polygon)<=.002,'full roof, chassis and measured opaque cab contour are inside the actual body');
 for(const point of body.polygon)assert.ok(expected.some(p=>distance(p,point)<.002),'the physical outline follows actual painted shape vertices');
 for(let i=0;i<body.polygon.length;i++){const a=body.polygon[i],b=body.polygon[(i+1)%body.polygon.length],c=body.polygon[(i+2)%body.polygon.length];assert.ok((b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x)>0,'one convex body outline cannot contain under-truck holes');}
 assert.equal(f.outdoor.truckOpacity,1);assert.equal(f.outdoor.cutaway,false);assert.equal(f.outdoor.groundPolicy,'outside-truck-body');return body;
}
async function observe(label,pendingApproachIds=[]){
 await page.evaluate(({label,pendingApproachIds})=>{window.__groundFrames=[];window.__groundRouteTable={};window.__groundFirstApproaches={};window.__groundContinuous={frames:0,roadCircles:0,violationCount:0,violations:[]};window.__groundObserving=true;const id=(window.__groundObservationId??0)+1;window.__groundObservationId=id;let last=-Infinity;
 const routeKey=(route,radius)=>{if(!route)return null;const key=JSON.stringify({route,radius});if(!Object.hasOwn(window.__groundRouteTable,key))window.__groundRouteTable[key]={id:Object.keys(window.__groundRouteTable).length,route,radius};return window.__groundRouteTable[key].id;};
 const clearance=(p,polygon)=>{let inside=false,nearest=Infinity;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j],dx=b.x-a.x,dy=b.y-a.y,n=dx*dx+dy*dy,t=n?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/n)):0;nearest=Math.min(nearest,Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t));if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;}return inside?-nearest:nearest;};
 const capture=()=>{if(!window.__groundObserving||window.__groundObservationId!==id)return;const c=document.querySelector('#world'),m=JSON.parse(c.dataset.freeMovement),p=JSON.parse(c.dataset.petPassage),o=JSON.parse(c.dataset.outdoorGround),pets=JSON.parse(c.dataset.petMotion),heroRouteKey=routeKey(m.route,m.body.radius),petKeys=Object.fromEntries(pets.map(pet=>[pet.id,routeKey(p.pets.find(q=>q.id===pet.id)?.route,pet.body.radius)])),continuous=window.__groundContinuous,polygon=m.world.obstacles.find(o=>o.kind==='truck-body').polygon;
  for(const pet of pets)if(pendingApproachIds.includes(pet.id)&&!Object.hasOwn(window.__groundFirstApproaches,pet.id)){const runtime=p.pets.find(q=>q.id===pet.id),route=runtime?.route;if(route?.surfaces.includes('ramp'))window.__groundFirstApproaches[pet.id]={id:pet.id,position:{x:pet.x,y:pet.y},surface:pet.surface,route,runtimeLocation:runtime.location,frameAt:m.frameAt,capturedAt:performance.now(),realCapturedAt:Date.now()};}
  continuous.frames++;const violations=[];if(o.truckOpacity!==1||o.cutaway!==false||o.groundPolicy!=='outside-truck-body')violations.push({kind:'truck-opacity',outdoor:o});for(const body of [{id:'hero',...m.body},...pets.map(p=>({id:p.id,...p.body}))])if(body.surface==='road'){continuous.roadCircles++;const distance=clearance(body,polygon);if(distance<body.radius-.012)violations.push({kind:'road-body-overlap',body,clearance:distance});}for(const violation of violations){continuous.violationCount++;if(continuous.violations.length<20)continuous.violations.push({at:performance.now(),frameAt:m.frameAt,...violation});}
  if(m.frameAt-last>=100){last=m.frameAt;
  const g=JSON.parse(c.dataset.sceneGeometry),a=JSON.parse(c.dataset.sceneAction),save=JSON.parse(localStorage.getItem('road-haven-save-v1'));
  window.__groundFrames.push({at:performance.now(),frameAt:m.frameAt,geometry:{scale:g.scale,dx:g.dx,dy:g.dy,mapZoom:g.mapZoom,manualCamera:g.manualCamera,playerFollowing:g.playerFollowing,cameraMode:g.cameraMode,cameraCenter:g.cameraCenter,overviewBounds:g.overviewBounds,viewport:g.viewport},
   hero:{moving:m.moving,body:m.body,position:m.position,surface:m.surface,link:m.link,pose:m.pose,target:m.target,routeKey:heroRouteKey},
   pets:pets.map(pet=>({id:pet.id,x:pet.x,y:pet.y,scale:pet.scale,body:pet.body,pose:pet.pose,surface:pet.surface,link:pet.link,gait:{distance:pet.gait.distance,speed:pet.gait.speed},routeKey:petKeys[pet.id]})),
   action:{kind:a.kind,phase:a.phase,pose:a.pose,climbing:a.climbing,outdoorSiteId:a.outdoorSiteId},passage:{open:p.open,operating:p.operating},
   truckOpacity:o.truckOpacity,cutaway:o.cutaway,groundPolicy:o.groundPolicy,energy:save.energy,energyRecovery:save.energyRecovery});
 }requestAnimationFrame(capture);};requestAnimationFrame(capture);},{label,pendingApproachIds});
}
async function stopObserve(){return page.evaluate(()=>{window.__groundObserving=false;return{frames:window.__groundFrames,routes:Object.values(window.__groundRouteTable),continuous:window.__groundContinuous};});}
function phaseProof(observation,label,{manual=false,zoom=1,scale}={}){
 const {frames,routes,continuous}=observation;assert.ok(frames.length>=3,`${label}: natural compact observations exist`);assert.ok(continuous.frames>=frames.length);assert.equal(continuous.violationCount,0,`${label}: every observed natural RAF keeps the truck opaque and full ground feet outside: ${JSON.stringify(continuous.violations)}`);let roadCircles=0,roadSweeps=0,pairs=0;
 for(const f of frames){assert.equal(f.truckOpacity,1,`${label}: the truck stays opaque in every actual retained frame`);assert.equal(f.cutaway,false);assert.equal(f.groundPolicy,'outside-truck-body');
  const g=f.geometry;assert.equal(g.playerFollowing,false);assert.equal(g.manualCamera,manual);assert.equal(g.cameraMode,manual?'manual':'overview');assert.equal(g.mapZoom,zoom);if(scale!==undefined)assert.ok(Math.abs(g.scale-scale)<.003);
  if(!manual){const b=g.overviewBounds,v=g.viewport;assert.ok(b);const projected={left:g.dx+b.left*g.scale,right:g.dx+b.right*g.scale,top:g.dy+b.top*g.scale,bottom:g.dy+b.bottom*g.scale};
   assert.ok(projected.left>=v.safeLeft+13&&projected.right<=v.width-v.safeRight-13&&projected.top>=v.safeTop+13&&projected.bottom<=v.height-v.safeBottom-13,'whole map remains within its actual usable viewport');}
  const bodies=[{id:'hero',...f.hero.body},...f.pets.map(p=>({id:p.id,...p.body}))];
  for(const b of bodies)if(b.surface==='road'){assert.ok(circleClearance(b,caseBody.polygon)>=b.radius-.012,`${label}: full ${b.id} feet stay outside truck body`);roadCircles++;}
  for(let i=0;i<bodies.length;i++)for(let j=i+1;j<bodies.length;j++){const a=bodies[i],b=bodies[j],linked=p=>['ladder','ramp'].includes(p.surface),floor=p=>p.surface==='road'?0:p.floor??1,
   shared=linked(a)||linked(b)?Boolean(a.link&&a.link===b.link)||floor(a)===floor(b):a.surface===b.surface&&floor(a)===floor(b);
   if(shared){assert.ok(distance(a,b)>=a.radius+b.radius-.012,`${label}: physical actor circles do not overlap`);pairs++;}}
 }
 for(const {route,radius}of routes){const points=Array.isArray(route)?route:route.points.map(p=>({x:p[0],y:p[1]})),surfaces=Array.isArray(route)?points.slice(1).map(p=>p.surface):route.surfaces;
  for(let i=1;i<points.length;i++)if(surfaces[i-1]==='road'){assert.ok(sweepClearance(points[i-1],points[i],caseBody.polygon)>=radius-.012,`${label}: complete accepted road segment sweeps stay outside truck body`);roadSweeps++;}
 }
 for(let i=1;i<frames.length;i++){const a=frames[i-1],b=frames[i],dt=(b.frameAt-a.frameAt)/1000;assert.ok(dt>=0);assert.ok(distance(a.hero.position,b.hero.position)<=dt*420+1.6,'actual hero walking never teleports');
  for(const pet of b.pets){const old=a.pets.find(p=>p.id===pet.id);if(!old)continue;assert.ok(distance(old,pet)<=dt*65+1.5,'actual animal feet walk continuously');assert.ok(pet.gait.distance+1e-6>=old.gait.distance);assert.notEqual(pet.link,'road-1','animals use their own ramp');if(pet.surface==='ramp')assert.notEqual(pet.pose,'climb');}
 }
 const proof={roadCircles,roadSweeps,bodyPairs:pairs,frames:frames.length,continuousFrames:continuous.frames,continuousRoadCircles:continuous.roadCircles};receipt.groundBodyProofs.push({case:currentCase,label,...proof});return proof;
}
async function finishPhase(label,before,options){const observed=await stopObserve(),after=await frame(),saveAfter=await saved();const proof=phaseProof(observed,label,options);receipt.phases.push({case:currentCase,label,...observed,proof,after});if(before)automaticOnly(before,saveAfter,label);return{...observed,after,saveAfter,proof};}
async function begin(width,height,input){
 currentCase=`${width}x${height}`;currentStep='startup-exact-save-and-real-absence';context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,deviceScaleFactor:2,reducedMotion:'no-preference'});
 await context.addInitScript(save=>{if(sessionStorage.getItem('v030-ground-installed'))return;const raw=JSON.stringify(save);localStorage.setItem('road-haven-save-v1',raw);window.__groundInstalledSave={raw,installedAt:Date.now()};sessionStorage.setItem('v030-ground-installed','1');},input.save);
 page=await context.newPage();page.on('pageerror',e=>receipt.errors.push({case:currentCase,message:e.message}));page.on('response',r=>{if(r.status()>=400&&['script','stylesheet','image','font'].includes(r.request().resourceType()))receipt.failedAssets.push({case:currentCase,status:r.status(),url:r.url()});});
 await page.goto(baseUrl,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('#world')?.dataset.freeMovement&&!document.querySelector('[data-startup-patch]')&&!document.querySelector('#app')?.inert,null,{timeout:15000});await pause();await settled();
 const installed=await page.evaluate(()=>window.__groundInstalledSave),loaded=await saved(),f=await frame();assert.equal(installed.raw,JSON.stringify(input.save),'the browser receives the exact input JSON without timestamp or economic edits');
 const delta=loaded.totalMinutes-input.save.totalMinutes;assert.ok(delta>=0&&Number.isInteger(delta/4));const expected=domain('clock',{state:input.save,minutes:delta});expected.energy=loaded.energy;expected.energyRecovery=structuredClone(loaded.energyRecovery);assert.deepEqual(stable(loaded),stable(expected),'startup applies only genuine village-clock progress and real energy recovery');
 let offlineRecovery=null;if(input.paid){offlineRecovery=energyAccounting(input.save,loaded,'genuine wall-absence recovery');assert.equal(loaded.energy,100);assert.ok(delta>=420&&delta<=500,'real old absence applies normal105-second capped clock plus short unpaused startup');}
 else{assert.equal(loaded.energy,input.save.energy,'missing legacy anchor gives no startup energy grant');assert.ok(loaded.energyRecovery.carryMs>=0&&loaded.energyRecovery.carryMs<20000);assert.ok(loaded.energyRecovery.checkedAt>=installed.installedAt&&loaded.energyRecovery.checkedAt<=Date.now(),'fresh recovery uses actual elapsed startup time');}
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.equal(f.geometry.mapZoom,1);assert.equal(f.geometry.cameraMode,'overview');assert.deepEqual(f.pets.map(p=>p.id).sort(),['cat','dog']);
 caseBody=truckBody(f,input.save.deckLevel);const siteDomain=domain('sites',{level:input.save.deckLevel});for(const site of f.outdoor.sites){const actual=siteDomain.find(s=>s.id===site.id);assert.ok(distance(site.point,{x:actual.point[0],y:actual.point[1]})<.002);for(const p of actual.approaches)assert.ok(circleClearance({x:p[0],y:p[1]},caseBody.polygon)>=30.8-.002,'canonical site approaches fit full largest animal outside body');}
 assert.ok(circleClearance(f.movement.world.ladder.bottom,caseBody.polygon)>=7-.002,'human landing genuinely outside complete body');assert.ok(circleClearance({x:f.passage.geometry.ground[0],y:f.passage.geometry.ground[1]},caseBody.polygon)>=38-.002,'animal landing fits full painted ramp width outside body');
 receipt.fixtures.push({viewport:{width,height},...input,installed:{installedAt:installed.installedAt,jsonSha256:sha(installed.raw)},loaded,startup:{clockMinutesApplied:delta,offlineRecovery},truckBody:caseBody,initialFrame:f,siteDomain});
 await observe('default-whole-map');await page.waitForTimeout(400);await finishPhase('default-whole-map',null,{scale:f.geometry.scale});await shot(`${width}-opaque-whole-map-overview`);
}
async function walk(label,start,surface,options={}){
 currentStep=label;const before=await saved();await observe(label);await start();await page.waitForFunction(()=>window.__groundFrames.some(f=>f.hero.moving),null,{timeout:2200});await page.waitForFunction(()=>!JSON.parse(document.querySelector('#world').dataset.freeMovement).moving,null,{timeout:22000});await settled();
 const result=await finishPhase(label,before,options);assert.equal(result.after.movement.surface,surface);receipt.walks.push({case:currentCase,label,phaseIndex:receipt.phases.length-1,after:result.after});return result;
}
async function stairs(down,scale){const label=down?'actual-human-stair-descent':'actual-human-stair-return';const result=await walk(label,()=>touch(page.locator(`.road-controls [data-road-${down?'walk':'return'}]`)),down?'road':'deck',{scale});
 assert.ok(result.frames.some(f=>f.hero.surface==='ladder'&&f.hero.link==='road-1'&&f.hero.pose==='climb'),'genuine human traversal uses the actual stair link');const art=result.after.outdoor.accessStairs;
 assert.equal(art.drawn,true);assert.equal(art.painted,true);assert.equal(art.width,48);assert.ok(distance({x:art.bottom[0],y:art.bottom[1]},result.after.movement.world.ladder.bottom)<.002);await shot(`${page.viewportSize().width}-${label}`);return result;
}
async function gate(open,scale){currentStep=`actual-gate-${open?'open':'close'}`;await touch(page.locator('.road-controls [data-open="pet-passage"]'));const before=await saved();await observe(currentStep);await touch(page.locator(`[data-pet-passage-toggle="${open?'open':'close'}"]`));await page.waitForFunction(()=>document.querySelector('#app')?.getAttribute('aria-busy')==='true',null,{timeout:2200});await page.waitForFunction(()=>!document.querySelector('#app')?.hasAttribute('aria-busy'),null,{timeout:26000});await settled();
 const observation=await stopObserve(),after=await saved(),f=await frame();assert.ok(observation.frames.some(f=>f.action.kind==='pet-gate'&&f.action.phase==='working'));automaticOnly(before,after,currentStep,s=>{s.petPassage={version:1,open};});assert.equal(f.passage.open,open);assert.equal(f.passage.painted,true);const proof=phaseProof(observation,currentStep,{scale});receipt.gates.push({case:currentCase,open,before,after,observation,proof,final:f});
}
async function nativeMapTarget(kind,label){
 const chosen=await page.locator('#world').evaluate((canvas,kind)=>{
  const m=JSON.parse(canvas.dataset.freeMovement),g=JSON.parse(canvas.dataset.sceneGeometry),rect=canvas.getBoundingClientRect(),v=g.viewport,hits=JSON.parse(canvas.dataset.sceneHits),pets=JSON.parse(canvas.dataset.petMotion),body=m.world.obstacles.find(o=>o.kind==='truck-body'),road=m.world.roadBounds,
   matrix=canvas.getContext('2d').getTransform(),renderTransform={a:matrix.a,b:matrix.b,c:matrix.c,d:matrix.d,e:matrix.e,f:matrix.f,dpr:Math.min(devicePixelRatio||1,2)},actualScale=matrix.a/renderTransform.dpr,actualDx=matrix.e/renderTransform.dpr,actualDy=matrix.f/renderTransform.dpr;
  const inside=(p,poly)=>{let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)yes=!yes;}return yes;};
  const pointSegment=(p,a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,n=dx*dx+dy*dy,t=n?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/n)):0;return Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t);};
  const clearance=(p,poly)=>{const d=Math.min(...poly.map((a,i)=>pointSegment(p,a,poly[(i+1)%poly.length])));return inside(p,poly)?-d:d;};
  const cross=(p,q,r)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);
  const segmentDistance=(a,b,c,d)=>{if(cross(a,b,c)*cross(a,b,d)<=0&&cross(c,d,a)*cross(c,d,b)<=0&&Math.max(Math.min(a.x,b.x),Math.min(c.x,d.x))<=Math.min(Math.max(a.x,b.x),Math.max(c.x,d.x))&&Math.max(Math.min(a.y,b.y),Math.min(c.y,d.y))<=Math.min(Math.max(a.y,b.y),Math.max(c.y,d.y)))return 0;return Math.min(pointSegment(a,c,d),pointSegment(b,c,d),pointSegment(c,a,b),pointSegment(d,a,b));};
  const sweep=(a,b,poly)=>inside(a,poly)||inside(b,poly)?-1:Math.min(...poly.map((c,i)=>segmentDistance(a,b,c,poly[(i+1)%poly.length])));
  const searchBounds={left:Math.max(road.left+10,(v.safeLeft+16-actualDx)/actualScale),right:Math.min(road.right-10,(v.width-v.safeRight-16-actualDx)/actualScale),top:Math.max(road.top+10,(v.safeTop+16-actualDy)/actualScale),bottom:Math.min(road.bottom-10,(v.height-v.safeBottom-16-actualDy)/actualScale)},candidates=[];
  for(let x=Math.ceil(searchBounds.left/15)*15;x<=searchBounds.right;x+=15)for(let y=Math.ceil(searchBounds.top/15)*15;y<=searchBounds.bottom;y+=15){
   const world={x,y},travel=Math.hypot(x-m.position.x,y-m.position.y),bodyClearance=clearance(world,body.polygon);if(kind==='truck-body-interior'?bodyClearance>-(m.body.radius+10):bodyClearance<m.body.radius+8)continue;
   if(kind!=='truck-body-interior'&&(travel<180||travel>4000||m.world.obstacles.filter(o=>o.surface==='road'&&o.kind!=='truck-body').some(o=>clearance(world,o.polygon)<m.body.radius+8)))continue;
   const directClearance=sweep(m.position,world,body.polygon);if(kind==='exterior-detour'&&directClearance>=m.body.radius-.012)continue;
   const petClearances=pets.filter(p=>p.surface==='road').map(p=>({id:p.id,radius:p.body.radius,feet:{x:p.x,y:p.y},separation:Math.hypot(x-p.x,y-p.y),required:p.body.radius+m.body.radius}));if(petClearances.some(p=>p.separation<p.required+22))continue;
   if(hits.filter(h=>['road-entry','pet-gate','outdoor-site','pet','character','grove-work','grove'].includes(h.kind)).some(h=>h.bounds?x>=h.bounds[0]-8&&x<=h.bounds[2]+8&&y>=h.bounds[1]-8&&y<=h.bounds[3]+8:Math.hypot(x-h.x,y-h.y)<Math.max(h.radius,22/actualScale)+8))continue;
   const screen={x:rect.x+actualDx+x*actualScale,y:rect.y+actualDy+y*actualScale};if(document.elementFromPoint(screen.x,screen.y)!==canvas)continue;
   candidates.push({world,screen,travel,bodyClearance,directClearance,petClearances});
  }
  candidates.sort((a,b)=>kind==='truck-body-interior'?a.bodyClearance-b.bodyClearance:a.travel-b.travel);const chosen=candidates[0];if(!chosen)return{missing:true,kind,candidateCount:0,context:{geometry:g,movement:m,hits,pets,rect:rect.toJSON(),searchBounds}};
  chosen.kind=kind;chosen.candidateCount=candidates.length;chosen.context={renderTransform,geometry:g,movement:m,hits,pets,rect:rect.toJSON(),searchBounds,at:performance.now()};
  window.__groundBeforeNative=null;window.__groundAfterNative=null;
  const raw=()=>{const t=canvas.getContext('2d').getTransform();return{renderTransform:{a:t.a,b:t.b,c:t.c,d:t.d,e:t.e,f:t.f,dpr:Math.min(devicePixelRatio||1,2)},geometry:JSON.parse(canvas.dataset.sceneGeometry),movement:JSON.parse(canvas.dataset.freeMovement),action:JSON.parse(canvas.dataset.sceneAction),pets:JSON.parse(canvas.dataset.petMotion),passage:JSON.parse(canvas.dataset.petPassage),outdoor:JSON.parse(canvas.dataset.outdoorGround),hits:JSON.parse(canvas.dataset.sceneHits),rect:canvas.getBoundingClientRect().toJSON(),capturedAt:performance.now(),realAt:Date.now()};};
  canvas.addEventListener('pointerup',event=>{const f=raw();f.event={isTrusted:event.isTrusted,phase:'before-production-canvas-pointerup-handler',clientX:event.clientX,clientY:event.clientY,canvasHit:document.elementFromPoint(event.clientX,event.clientY)===canvas};window.__groundBeforeNative=f;},{once:true,capture:true});
  canvas.addEventListener('pointerup',event=>{const f=raw();f.event={isTrusted:event.isTrusted,phase:'after-production-canvas-pointerup-handler'};window.__groundAfterNative=f;},{once:true});return chosen;
 },kind);
 assert.ok(!chosen.missing,`actual visible ${kind} target exists: ${JSON.stringify(chosen)}`);await page.touchscreen.tap(chosen.screen.x,chosen.screen.y);
 const capture=await page.evaluate(()=>({before:window.__groundBeforeNative,after:window.__groundAfterNative}));assert.ok(capture.before?.event.isTrusted&&capture.before.event.canvasHit);assert.ok(capture.after?.event.isTrusted);assert.ok(capture.before.capturedAt<=capture.after.capturedAt);
 const t=capture.before.renderTransform;assert.ok(Math.abs(t.b)<1e-10&&Math.abs(t.c)<1e-10&&Math.abs(t.a-t.d)<1e-10);assert.ok(t.a>0);const world={x:((capture.before.event.clientX-capture.before.rect.x)*t.dpr-t.e)/t.a,y:((capture.before.event.clientY-capture.before.rect.y)*t.dpr-t.f)/t.d};
 for(const pet of capture.before.pets.filter(p=>p.surface==='road'))assert.ok(distance(world,pet)>=pet.body.radius+capture.before.movement.body.radius,'fresh native destination misses actual pet circles');
 const row={case:currentCase,label,...chosen,...capture,nativeWorld:world};receipt.inputs.push({...row,kind:'genuine-native-map-touch',targetKind:row.kind});
 if(kind==='truck-body-interior'){
  assert.ok(circleClearance(world,caseBody.polygon)<=-(capture.before.movement.body.radius+8));assert.equal(capture.before.movement.surface,'road');assert.equal(capture.before.movement.moving,false);
  assert.equal(capture.after.movement.moving,false);assert.equal(capture.after.movement.target,null);assert.deepEqual(capture.after.movement.route,capture.before.movement.route);assert.deepEqual(capture.after.movement.position,capture.before.movement.position,'native truck body tap cannot grant any movement');receipt.blockedInputs.push(row);
 }else{
  const m=capture.after.movement;assert.equal(m.surface,'road');assert.ok(m.moving&&m.target?.surface==='road');assert.ok(m.total>0&&m.total<=22,'ordinary actual accepted walk fits the original deadline');assert.ok(distance(m.target,world)<.002);
  assert.ok(circleClearance(world,caseBody.polygon)>=m.body.radius-.012);assert.ok(m.route.every(p=>p.surface==='road'),'an exterior walk cannot detour over the truck deck');
  for(let i=1;i<m.route.length;i++)assert.ok(sweepClearance(m.route[i-1],m.route[i],caseBody.polygon)>=m.body.radius-.012,'every actual route leg passes the full-body swept collision check');
  if(kind==='exterior-detour'){assert.ok(sweepClearance(capture.before.movement.position,world,caseBody.polygon)<m.body.radius-.012,'the straight intended movement is physically blocked by the truck');assert.ok(m.route.length>=3,'the accepted real path contains genuine outside detour vertices');const pathLength=m.route.slice(1).reduce((sum,p,i)=>sum+distance(m.route[i],p),0);assert.ok(pathLength>distance(m.route[0],m.route.at(-1))+.1);row.detour={pathLength,straightLength:distance(m.route[0],m.route.at(-1)),routeSweeps:m.route.length-1};}
 }return row;
}
async function blockedTruck(scale){currentStep='native-truck-body-tap-rejected';const before=await saved();await observe(currentStep);const row=await nativeMapTarget('truck-body-interior',currentStep);await page.waitForTimeout(450);const result=await finishPhase(currentStep,before,{scale});for(const f of result.frames){assert.equal(f.hero.moving,false);assert.equal(f.hero.target,null);assert.ok(distance(f.hero.position,row.before.movement.position)<.002);}await shot(`${page.viewportSize().width}-blocked-full-truck-body`);receipt.art.push({case:currentCase,kind:'blocked-full-truck-body',frame:result.after,screenshot:receipt.screenshots.at(-1)});}
async function exteriorWalk(scale,{detour=true,manual=false,zoom=1}={}){
 const label=detour?'native-real-exterior-detour':'native-free-exterior-walk';let accepted;
 const result=await walk(label,async()=>{accepted=await nativeMapTarget(detour?'exterior-detour':'clear-road',label);await page.waitForFunction(()=>JSON.parse(document.querySelector('#world').dataset.freeMovement).pose==='walk',null,{timeout:2200});const walking=await frame();await shot(`${page.viewportSize().width}-${label}`);receipt.art.push({case:currentCase,kind:label,frame:walking,screenshot:receipt.screenshots.at(-1)});},'road',{scale,manual,zoom});
 receipt.walks.at(-1).accepted=accepted;assert.ok(result.proof.roadCircles>0&&result.proof.roadSweeps>0);return result;
}
async function cameraControls(scale){
 const label='native-manual-zoom-pan-and-reset';currentStep=label;const before=await saved();await touch(page.locator('[data-camera-toggle]'));await touch(page.locator('[data-map-zoom="1"]'));await settled();const zoomed=await frame();assert.equal(zoomed.geometry.mapZoom,1.25);
 const drag=await page.locator('#world').evaluate(canvas=>{const rect=canvas.getBoundingClientRect(),g=JSON.parse(canvas.dataset.sceneGeometry),origin={x:rect.x+g.viewport.safeLeft+g.viewport.usableWidth/2,y:rect.y+g.viewport.safeTop+g.viewport.usableHeight/2};return document.elementFromPoint(origin.x,origin.y)===canvas?{origin,dx:54,dy:Math.min(32,g.viewport.usableHeight*.12),rect:rect.toJSON(),geometry:g}:null;});assert.ok(drag);const session=await context.newCDPSession(page),steps=[];
 await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...drag.origin,id:1}]});steps.push({type:'touchStart',point:drag.origin});for(let i=1;i<=6;i++){const point={x:drag.origin.x+drag.dx*i/6,y:drag.origin.y+drag.dy*i/6};await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...point,id:1}]});steps.push({type:'touchMove',point});await page.waitForTimeout(25);}await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});steps.push({type:'touchEnd'});await session.detach();await settled();const manual=await frame();assert.equal(manual.geometry.manualCamera,true);assert.equal(manual.geometry.cameraMode,'manual');assert.equal(manual.geometry.mapZoom,1.25);
 await touch(page.locator('[data-camera-toggle]'));await exteriorWalk(manual.geometry.scale,{detour:false,manual:true,zoom:1.25});const retained=await frame();assert.equal(retained.geometry.mapZoom,1.25);assert.equal(retained.geometry.manualCamera,true);
 currentStep=label;await touch(page.locator('.road-controls [data-camera-player]'));await settled();const restored=await frame();assert.equal(restored.geometry.mapZoom,1);assert.equal(restored.geometry.cameraMode,'overview');assert.equal(restored.geometry.manualCamera,false);assert.ok(Math.abs(restored.geometry.scale-scale)<.003);assert.deepEqual(restored.movement.position,retained.movement.position,'whole-map reset changes the camera without moving physical feet');automaticOnly(before,await saved(),label);receipt.camera.push({case:currentCase,label,zoomed,drag,steps,manual,retained,restored});
}
async function petsDescend(scale){
 currentStep='actual-pet-ramp-to-outside-ground';const start=await frame(),points=start.passage.geometry.points,entry={x:points.at(-1)[0],y:points.at(-1)[1]},rampDistance=points.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p[0]-points[i][0],p[1]-points[i][1]),0);
 const approaches=start.pets.map(pet=>{const position={x:pet.x,y:pet.y},runtime=start.passage.pets.find(p=>p.id===pet.id),measurement=remainingDeckApproach(runtime?.route,position,pet.surface),directDistance=distance(position,entry);
  return{id:pet.id,position,surface:pet.surface,directDistance,rawRoute:runtime?.route??null,measurement,source:measurement?'phase-start-accepted-remaining-deck':'queued-direct-estimate',accountedDistance:measurement?.remainingDeckDistance??directDistance,firstQueuedActualCount:0};});
 const phaseStartedAt=Date.now(),originalApproachDistance=approaches.reduce((n,p)=>n+p.directDistance,0),timeoutFor=length=>Math.max(38000,Math.ceil((rampDistance*2+length)/44*1000+12000));
 const arrivalBudget={phaseStartedAt,phaseStartFrameAt:start.movement.frameAt,walkingWorldUnitsPerSecond:44,stanceAndReservationAllowanceSeconds:12,minTimeoutMs:38000,serialRampCrossers:2,rampDistance,originalApproachDistance,originalTimeoutMs:timeoutFor(originalApproachDistance),approaches,updates:[]};
 const refreshBudget=()=>{arrivalBudget.approachDistance=approaches.reduce((n,p)=>n+p.accountedDistance,0);arrivalBudget.timeoutMs=timeoutFor(arrivalBudget.approachDistance);arrivalBudget.absoluteDeadlineAt=phaseStartedAt+arrivalBudget.timeoutMs;};refreshBudget();arrivalBudget.initialTimeoutMs=arrivalBudget.timeoutMs;
 // The clock remains anchored here. A queued animal's FIRST real admission
 // can replace its distance estimate once; retries never renew its deadline.
 receipt.activePetArrival={case:currentCase,start,arrivalBudget};const pendingIds=approaches.filter(p=>!p.measurement).map(p=>p.id),before=await saved();await observe(currentStep,pendingIds);
 const accountFirstApproaches=async()=>{const captured=await page.evaluate(()=>window.__groundFirstApproaches);for(const approach of approaches){const evidence=captured[approach.id];if(!evidence||approach.measurement||approach.firstQueuedActualCount)continue;
  assert.ok(evidence.route.surfaces.includes('ramp'));const origin={x:evidence.route.points[0][0],y:evidence.route.points[0][1]},measurement=remainingDeckApproach(evidence.route,origin,'deck'),observedRemaining=remainingDeckApproach(evidence.route,evidence.position,evidence.surface);
  const previousTimeoutMs=arrivalBudget.timeoutMs;approach.firstQueuedActualCount=1;approach.firstActualEvidence=evidence;approach.firstActualOrigin=origin;approach.firstActualMeasurement=measurement;approach.firstObservedRemaining=observedRemaining;approach.source='queued-first-actual-admission';approach.accountedDistance=measurement.remainingDeckDistance;refreshBudget();arrivalBudget.updates.push({id:approach.id,consumedAt:Date.now(),phaseStartedAt,previousTimeoutMs,timeoutMs:arrivalBudget.timeoutMs,absoluteDeadlineAt:arrivalBudget.absoluteDeadlineAt});
 }};
 await page.evaluate(()=>{window.__groundWalkingPetCandidate=null;window.__groundVisiblePetCrossing=null;});
 const waitStage=async mode=>{for(;;){await accountFirstApproaches();const remainingMs=arrivalBudget.absoluteDeadlineAt-Date.now();assert.ok(remainingMs>0,'the absolute real-route arrival deadline has not expired');const knownIds=approaches.filter(p=>p.measurement||p.firstQueuedActualCount).map(p=>p.id);
  const handle=await page.waitForFunction(({mode,knownIds})=>{
   if(Object.keys(window.__groundFirstApproaches).some(id=>!knownIds.includes(id)))return'first-actual-approach';
   const canvas=document.querySelector('#world'),g=JSON.parse(canvas.dataset.sceneGeometry),m=JSON.parse(canvas.dataset.freeMovement),pets=JSON.parse(canvas.dataset.petMotion),r=canvas.getBoundingClientRect(),v=g.viewport;
   if(mode==='all-road')return pets.every(p=>p.surface==='road')?'all-road':false;
   const visible=pets.filter(p=>p.surface==='ramp'&&p.pose==='walk'&&p.link==='pet-road-1').map(p=>{const k=p.scale*g.scale,x=r.x+g.dx+p.x*g.scale,y=r.y+g.dy+p.y*g.scale,bounds={left:x-45*k,right:x+45*k,top:y-80*k,bottom:y+8*k},fits=bounds.left>=r.x+v.safeLeft+5&&bounds.right<=r.x+v.width-v.safeRight-5&&bounds.top>=r.y+v.safeTop+5&&bounds.bottom<=r.y+v.height-v.safeBottom-5;
    const samples=[bounds.left,(bounds.left+bounds.right)/2,bounds.right].flatMap(x=>[bounds.top,(bounds.top+bounds.bottom)/2,bounds.bottom].map(y=>({x,y,canvas:document.elementFromPoint(x,y)===canvas})));return{id:p.id,feet:{x:p.x,y:p.y},bounds,fits,samples};}).filter(p=>p.fits&&p.samples.every(s=>s.canvas));
   const candidate=visible[0],old=window.__groundWalkingPetCandidate;if(!candidate){window.__groundWalkingPetCandidate=null;return false;}if(!old||old.id!==candidate.id){window.__groundWalkingPetCandidate={id:candidate.id,frameAt:m.frameAt,feet:candidate.feet};return false;}
   const stableNaturalWalkMs=m.frameAt-old.frameAt,naturalFootTravel=Math.hypot(candidate.feet.x-old.feet.x,candidate.feet.y-old.feet.y);if(stableNaturalWalkMs<150||naturalFootTravel<3)return false;
   window.__groundVisiblePetCrossing={geometry:g,movement:m,pets,action:JSON.parse(canvas.dataset.sceneAction),passage:JSON.parse(canvas.dataset.petPassage),outdoor:JSON.parse(canvas.dataset.outdoorGround),hits:JSON.parse(canvas.dataset.sceneHits),rect:r.toJSON(),visiblePets:visible,capturedAt:performance.now(),stableNaturalWalkMs,naturalFootTravel,captureMethod:'atomic-natural-RAF-walking-pose-and-nine-canvas-samples'};return'visible-ramp';
  },{mode,knownIds},{timeout:remainingMs});const result=await handle.jsonValue();await handle.dispose();await accountFirstApproaches();if(result!=='first-actual-approach')return;}
 };
 await waitStage('visible-ramp');const crossing=await page.evaluate(()=>window.__groundVisiblePetCrossing);assert.ok(crossing.visiblePets.length>0);assert.ok(crossing.stableNaturalWalkMs>=150&&crossing.naturalFootTravel>=3);
 await shot(`${page.viewportSize().width}-real-pet-ramp-outside-truck`);receipt.art.push({case:currentCase,kind:'actual-pet-ramp',frame:crossing,screenshot:receipt.screenshots.at(-1)});
 await waitStage('all-road');arrivalBudget.arrivedAt=Date.now();assert.ok(arrivalBudget.arrivedAt<=arrivalBudget.absoluteDeadlineAt,'both actual animals arrive inside the anchored route-derived deadline');for(const approach of approaches)assert.ok(approach.firstQueuedActualCount<=1);await page.waitForTimeout(400);
 const result=await finishPhase(currentStep,before,{scale});for(const id of ['dog','cat']){assert.ok(result.frames.some(f=>f.pets.some(p=>p.id===id&&p.surface==='ramp'&&p.link==='pet-road-1')),'each animal follows its own real ramp');assert.ok(result.frames.some(f=>f.pets.some(p=>p.id===id&&p.surface==='road')),'each full animal reaches legitimate outside ground');}
 receipt.petRoutes.push({case:currentCase,label:currentStep,start,crossing,after:result.after,rampDistance,approachDistance:arrivalBudget.approachDistance,timeoutMs:arrivalBudget.timeoutMs,arrivalBudget,phaseIndex:receipt.phases.length-1});delete receipt.activePetArrival;
}
async function collect(id,scale){
 currentStep=`actual-paid-exterior-${id}-work`;await touch(page.locator('.road-controls [data-open="roadside"]'));await touch(page.locator(`[data-outdoor-site="${id}"]`));const before=await saved(),rule=domain('collect',{state:before,id}).rule;assert.ok(before.energy>=rule.energy);
 await observe(currentStep);const realStartedAt=Date.now();await touch(page.locator(`[data-outdoor-collect="${id}"]`));await page.waitForFunction(id=>{const a=JSON.parse(document.querySelector('#world').dataset.sceneAction);return a.outdoorSiteId===id&&a.phase==='working';},id,{timeout:22000});
 const working=await frame();assert.equal(working.movement.surface,'road');assert.equal(working.action.from.surface,'road');assert.deepEqual(working.action.climbSegments,[]);assert.ok(circleClearance(working.movement.body,caseBody.polygon)>=working.movement.body.radius-.012);
 for(let i=1;i<working.action.route.length;i++)assert.ok(sweepClearance(working.action.route[i-1],working.action.route[i],caseBody.polygon)>=working.movement.body.radius-.012,'real collection outbound and reverse-return route sweeps stay outside truck body');
 await shot(`${page.viewportSize().width}-paid-${id}-real-outside-work`);receipt.art.push({case:currentCase,kind:`paid-outside-${id}-work`,frame:working,screenshot:receipt.screenshots.at(-1)});
 await page.waitForFunction(()=>!document.querySelector('#app')?.hasAttribute('aria-busy'),null,{timeout:26000});await settled();const realEndedAt=Date.now(),observation=await stopObserve(),after=await saved(),f=await frame(),active=observation.frames.filter(f=>f.action.outdoorSiteId===id);
 for(const phase of ['outbound','working','returning'])assert.ok(active.some(f=>f.action.phase===phase),`actual resource action completes ${phase}`);const proof=phaseProof(observation,currentStep,{scale});
 let expected,recovery,commitAt=null;if(before.energy===100){commitAt=after.energyRecovery.checkedAt-after.energyRecovery.carryMs;assert.ok(commitAt>=realStartedAt&&commitAt<=realEndedAt,'the cap-to-cost recovery anchor comes from a real observed work completion interval');const atCommit=domain('recover',{state:before,now:commitAt});const result=domain('collect',{state:atCommit,id});assert.equal(result.result.ok,true);expected=domain('recover',{state:result.result.state,now:after.energyRecovery.checkedAt});recovery={capBefore:true,commitAt,afterCostEnergy:100-rule.energy,realElapsedMs:after.energyRecovery.checkedAt-commitAt,carryAfterMs:after.energyRecovery.carryMs};}
 else{const result=domain('collect',{state:before,id});assert.equal(result.result.ok,true);expected=result.result.state;recovery=energyAccounting(before,after,currentStep,expected.energy);expected.energy=after.energy;expected.energyRecovery=structuredClone(after.energyRecovery);}
 assert.deepEqual(stable(after),stable(expected),'collection commits exact resources, XP, stats, quests, cooldown and natural energy only');assert.equal(after.roadside.sites[id].readyAt,before.totalMinutes+rule.cooldownSeconds*4);assert.equal(after.roadside.sites[id].visits,(before.roadside?.sites[id].visits??0)+1);
 receipt.collections.push({case:currentCase,id,before,after,rule,realStartedAt,realEndedAt,commitAt,recovery,working,afterFrame:f,observation,proof});
}

try{
 await mkdir('artifacts',{recursive:true});if(finalSnapshot){const manifest=JSON.parse(await readFile(executionInputs.snapshotManifestPath,'utf8'));assert.equal(manifest.snapshotId,snapshotId);assert.equal(manifest.version,version);for(const[path,hash]of Object.entries(manifest.files)){const url=new URL(path,new URL('/',baseUrl)),response=await fetch(url);assert.equal(response.status,200);const bytes=Buffer.from(await response.arrayBuffer());assert.equal(sha(bytes),hash);receipt.httpIdentity.push({path,url:String(url),bytes:bytes.length,sha256:hash});}}
 const fresh=await fixture(),paid=await fixture(true);browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 for(const[width,height]of[[344,740],[390,844],[844,390]]){
  const input=width===844?paid:fresh;await begin(width,height,input);const scale=(await frame()).geometry.scale;
  if((await frame()).passage.open)await gate(false,scale);
  await stairs(true,scale);await blockedTruck(scale);await exteriorWalk(scale);await cameraControls(scale);await stairs(false,scale);await gate(true,scale);await stairs(true,scale);await petsDescend(scale);await exteriorWalk(scale,{detour:false});
  if(input.paid){await collect('salvage',scale);await collect('spring',scale);}await stairs(false,scale);
  const after=await saved();assert.equal(after.deckLevel,input.save.deckLevel);assert.deepEqual(after.truckLayout,input.save.truckLayout,'no building, placement or paid-floor progress is manufactured by navigation');receipt.fixtures.at(-1).after=after;
  await context.close();context=null;console.log(`PASS ${width}x${height}: opaque truck body, genuine blocked finger, exterior detour, human stairs, animal ramp and${input.paid?' exact paid-site work':' ordinary unchanged progress'}.`);
 }
 assert.equal(receipt.fixtures.length,3);assert.equal(receipt.blockedInputs.length,3);assert.equal(receipt.collections.length,2);assert.equal(receipt.petRoutes.length,3);assert.deepEqual(receipt.errors,[]);assert.deepEqual(receipt.failedAssets,[]);
 receipt.sourceHashesAtFinish=await sourceHashes();assert.deepEqual(receipt.sourceHashesAtFinish,receipt.sourceHashesAtStart,'the source stayed unchanged throughout actual QA');assert.equal(sha(await readFile(new URL(import.meta.url))),executionInputs.testSha256);for(const[path,hash]of Object.entries(executionInputs.directDependencyHashes))assert.equal(sha(await readFile(path)),hash,'each actually executed helper and exact historical fixture receipt stays unchanged');receipt.status='passed';
}catch(error){receipt.status='failed';receipt.failure={case:currentCase,step:currentStep,message:String(error),stack:error.stack};process.exitCode=1;if(page)try{receipt.failure.save=await saved();receipt.failure.frame=await frame();receipt.failure.observation=await stopObserve();await shot('failure');}catch(e){receipt.failure.captureError=String(e);}}
finally{if(browser)await browser.close();receipt.finishedAt=new Date().toISOString();receipt.assertionsExecuted=assertionsExecuted;const path=`artifacts/gameplay-v030-ground-v${version}${receiptTag?`-${receiptTag}`:''}${diagnosticOnly?'-diagnostic':''}-verification.json`;await writeFile(path,JSON.stringify(receipt,null,2));console.log(JSON.stringify({status:receipt.status,assertionsExecuted,receipt:path,error:receipt.failure?.message}));}
