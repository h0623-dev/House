import { chromium } from '@playwright/test';
import strictAssert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { captureExecutionInputs } from './release-execution-inputs.mjs';

// Actual touch/RAF tests against the immutable release. Native download events
// are a declared private Capacitor bridge fixture, not an Android installation.
// Pets/hero never receive injected positions or private Scene calls. The Lv2
// save is explicitly unearned setup; the first placement uses fresh welcome UI.
const version=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8')).version;
const versionCode=JSON.parse(await readFile(new URL('../release-version.json',import.meta.url),'utf8')).versionCode;
const baseUrl=process.env.TEST_BASE_URL,nativeUrl=process.env.TEST_UPDATE_BASE_URL;
const snapshotId=process.env.TEST_SNAPSHOT_ID,finalSnapshot=process.env.TEST_FINAL_SNAPSHOT==='1';
if(!baseUrl||!nativeUrl||!finalSnapshot||!/^v\d{3}-r[1-9]\d*$/.test(snapshotId))throw Error('Loading/placement verification requires both immutable release URLs and its final snapshot identity.');
const executionInputs=await captureExecutionInputs(import.meta.url,{snapshotId,finalSnapshot});
let assertionsExecuted=0;
const assert=new Proxy(strictAssert,{get(target,key){const value=Reflect.get(target,key);return typeof value==='function'?(...args)=>{assertionsExecuted++;return value(...args);}:value;}});
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const receipt={version,versionCode,snapshotId,finalSnapshot,baseUrl,nativeUrl,executionInputs,status:'running',startedAt:new Date().toISOString(),
 scope:'Chromium mobile emulation with native touchscreen inputs, natural RAF/timers and read-only scene telemetry; no physical phone, native signed archive activation, APK installation or fake clock claim.',
 fixtures:[],loading:[],placements:[],rejections:[],observations:[],inputs:[],screenshots:[],errors:[],failedAssets:[],canceledImages:[],successfulImages:[],
 clock:'Game clock paused through the actual UI for exact accounting. Pets keep natural RAF; reduced-motion media preference holds natural initial spawns for deterministic placement overlap.'};
let browser,context,page,caseName='preflight',originalSave;
const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('road-haven-save-v1')));
const stable=value=>{const result=structuredClone(value);if(result)delete result.lastSaved;return result;};
const withoutClock=value=>{const result=stable(value);for(const key of ['day','minutes','totalMinutes'])delete result[key];return result;};
const buildings=state=>{const placements=new Map((state.truckLayout?.placements??[]).map(p=>[p.id,p.slot]));return[...(state.settlement?.buildings??[]).map(b=>({...b,slot:placements.get(b.id)??b.slot})),...(state.truckLayout?.upperBuildings??[])];};
const point=p=>Array.isArray(p)?{x:p[0],y:p[1]}:p;
const distance=(a,b)=>Math.hypot(point(a).x-point(b).x,point(a).y-point(b).y);
function inside(p,polygon){p=point(p);let result=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=point(polygon[i]),b=point(polygon[j]);if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)result=!result;}return result;}
function edgeDistance(p,polygon){p=point(p);return Math.min(...polygon.map((value,i)=>{const a=point(value),b=point(polygon[(i+1)%polygon.length]),vx=b.x-a.x,vy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*vx+(p.y-a.y)*vy)/(vx*vx+vy*vy)));return Math.hypot(p.x-a.x-t*vx,p.y-a.y-t*vy);}));}
const overlaps=(body,slot)=>body.surface==='deck'&&body.floor===slot.floor&&(inside(body,slot.polygon)||edgeDistance(body,slot.polygon)<=body.radius);
async function frame(){return page.locator('#world').evaluate(canvas=>{const d=canvas.dataset,r=canvas.getBoundingClientRect();return{movement:JSON.parse(d.freeMovement),action:JSON.parse(d.sceneAction),pets:JSON.parse(d.petMotion??'[]'),geometry:JSON.parse(d.sceneGeometry),hits:JSON.parse(d.sceneHits??'[]'),slots:JSON.parse(d.settlementSlots??'[]'),relocation:JSON.parse(d.placementPetRelocation??'null'),rect:{left:r.left,top:r.top,right:r.right,bottom:r.bottom}};});}
function screen(p,f){p=point(p);return{x:f.rect.left+f.geometry.dx+p.x*f.geometry.scale,y:f.rect.top+f.geometry.dy+p.y*f.geometry.scale};}
function attachErrors(target){
 target.on('pageerror',error=>receipt.errors.push({caseName,message:error.message}));
 target.on('response',r=>{const kind=r.request().resourceType();if(r.status()>=400&&['image','font','script','stylesheet'].includes(kind))receipt.failedAssets.push({caseName,status:r.status(),url:r.url()});if(r.ok()&&kind==='image')receipt.successfulImages.push(r.url());});
 target.on('requestfailed',request=>{const kind=request.resourceType();if(!['image','font','script','stylesheet'].includes(kind))return;const reason=request.failure()?.errorText??'request failed';if(kind==='image'&&reason==='net::ERR_ABORTED')receipt.canceledImages.push(request.url());else receipt.failedAssets.push({caseName,reason,url:request.url()});});
}
async function shot(label){const path=`artifacts/v${version}-loading-placement-${label}.png`;await page.screenshot({path,fullPage:true});receipt.screenshots.push({path,sha256:sha(await readFile(path))});}
async function touch(locator){
 await locator.scrollIntoViewIfNeeded();const box=await locator.boundingBox();assert.ok(box,'intended native control is rendered');assert.ok(box.width>=44&&box.height>=44,'control preserves a full 44px finger target');
 const client={x:box.x+box.width/2,y:box.y+box.height/2};assert.equal(await locator.evaluate((button,p)=>document.elementFromPoint(p.x,p.y)?.closest('button')===button,client),true,'actual finger reaches the control');
 const input={at:Date.now(),kind:'native-touchscreen-tap',client,bounds:box,label:await locator.getAttribute('aria-label')??await locator.innerText()};receipt.inputs.push(input);await page.touchscreen.tap(client.x,client.y);return input;
}
async function worldTap(client){
 assert.equal(await page.evaluate(p=>[-21.5,0,21.5].every(dx=>[-21.5,0,21.5].every(dy=>document.elementFromPoint(p.x+dx,p.y+dy)?.id==='world')),client),true,'map input has nine clear probes over a full 44px finger target');
 await page.locator('#world').evaluate(canvas=>{window.__loadingPlacementMapRelease=null;canvas.addEventListener('pointerup',event=>{const d=canvas.dataset,g=JSON.parse(d.sceneGeometry),r=canvas.getBoundingClientRect();window.__loadingPlacementMapRelease={isTrusted:event.isTrusted,at:performance.now(),client:{x:event.clientX,y:event.clientY},world:{x:(event.clientX-r.left-g.dx)/g.scale,y:(event.clientY-r.top-g.dy)/g.scale},movement:JSON.parse(d.freeMovement),pets:JSON.parse(d.petMotion),slots:JSON.parse(d.settlementSlots)};},{capture:true,once:true});});
 await page.touchscreen.tap(client.x,client.y);const input=await page.evaluate(()=>window.__loadingPlacementMapRelease);assert.ok(input?.isTrusted,'map release is a genuine native pointer');receipt.inputs.push({kind:'native-map-tap',...input});return input;
}
async function cameraSettled(){await page.evaluate(()=>{window.__loadingCameraFrames=[];window.__loadingCameraStable=0;});await page.waitForFunction(()=>{const c=document.querySelector('#world'),g=JSON.parse(c.dataset.sceneGeometry),m=JSON.parse(c.dataset.freeMovement),a=window.__loadingCameraFrames.at(-1);if(a?.frameAt===m.frameAt)return false;const b={frameAt:m.frameAt,dx:g.dx,dy:g.dy,scale:g.scale};window.__loadingCameraFrames.push(b);window.__loadingCameraStable=a&&Math.abs(a.dx-b.dx)<.25&&Math.abs(a.dy-b.dy)<.25&&Math.abs(a.scale-b.scale)<.0005?window.__loadingCameraStable+1:0;return window.__loadingCameraStable>=3;},null,{timeout:5000});return page.evaluate(()=>window.__loadingCameraFrames);}
async function waitPlayable(){await page.waitForFunction(()=>!document.querySelector('[data-startup-patch]')&&document.querySelector('#world')?.dataset.freeMovement&&!document.querySelector('#app')?.inert,null,{timeout:15000});}
async function closeModal(){if(await page.locator('#modal-root').isVisible())await touch(page.locator('#modal-root [data-close]').first());}
async function pauseWorld(){
 // Flush the paused in-memory village through the existing save control before
 // reading a full JSON baseline. A pre-pause tick may not yet be persisted.
 await closeModal();await touch(page.locator('[data-open="menu"]'));await touch(page.locator('#modal-root [data-open="settings"]'));
 if(await page.locator('.time-button').getAttribute('aria-label')!=='시간 계속'){
  // The existing compact clock icon is smaller than a finger target. Use the
  // shipped 44px settings controls, as the other release suites already do.
  await touch(page.locator('#modal-root [data-pause]'));
 }
 await touch(page.locator('#modal-root [data-save]'));await closeModal();
 assert.equal(await page.locator('.time-button').getAttribute('aria-label'),'시간 계속');
}
async function begin(width,height,{fixture,reducedMotion='reduce'}={}){
 context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,deviceScaleFactor:2,reducedMotion});
 if(fixture){await context.addInitScript(({save,origin})=>{if(location.origin!==origin||sessionStorage.getItem('loading-placement-seeded'))return;const value=structuredClone(save);value.lastSaved=Date.now();localStorage.setItem('road-haven-save-v1',JSON.stringify(value));sessionStorage.setItem('loading-placement-seeded','true');},{save:fixture,origin:new URL(baseUrl).origin});receipt.fixtures.push({kind:'Explicit unearned saved-state setup; only loading lastSaved becomes actual time',save:fixture,sha256:sha(JSON.stringify(fixture)),width,height});}
 page=await context.newPage();attachErrors(page);await page.goto(baseUrl,{waitUntil:'domcontentloaded'});
 if(!fixture){await page.locator('[data-start]').waitFor();await page.locator('#player-name').fill('건설 검수');await touch(page.locator('[data-start]'));}
 await waitPlayable();await pauseWorld();await cameraSettled();if(fixture)assert.deepEqual(withoutClock(await saved()),withoutClock(fixture),'fixture reload edits no non-clock saved progress');
}
async function observe(label){await page.locator('#world').evaluate((canvas,label)=>{const frames=[],worlds=[],worldIds=new Map();const capture=()=>{const d=canvas.dataset,movement=JSON.parse(d.freeMovement),key=JSON.stringify(movement.world);let worldId=worldIds.get(key);if(worldId===undefined){worldId=worlds.length;worldIds.set(key,worldId);worlds.push(movement.world);}delete movement.world;const f={at:performance.now(),worldId,movement,action:JSON.parse(d.sceneAction),pets:JSON.parse(d.petMotion),relocation:JSON.parse(d.placementPetRelocation??'null')};if(frames.at(-1)?.movement.frameAt===movement.frameAt)frames[frames.length-1]=f;else frames.push(f);};window.__loadingPlacementObservation={label,frames,worlds};capture();window.__loadingPlacementObserver=new MutationObserver(capture);window.__loadingPlacementObserver.observe(canvas,{attributes:true,attributeFilter:['data-free-movement','data-scene-action','data-pet-motion','data-placement-pet-relocation']});},label);}
async function stopObserve(){const result=await page.evaluate(()=>{window.__loadingPlacementObserver.disconnect();return window.__loadingPlacementObservation;});result.id=receipt.observations.length;receipt.observations.push(result);return result;}
function assertBodies(f,world){
 const actors=[{id:'hero',body:f.movement.body},...f.pets.map(p=>({id:p.id,body:p.body}))],radii={hero:7,dog:25.74,cat:24.82};
 for(const actor of actors){const body=actor.body;assert.ok(Number.isFinite(body.x)&&Number.isFinite(body.y));assert.ok(Math.abs(body.radius-radii[actor.id])<.001,'complete original collision radius is preserved');if(body.surface==='ladder')continue;
  const outer=body.surface==='deck'?world.floors.find(floor=>floor.id===body.floor).outerPolygon:[{x:world.roadOuterBounds.left,y:world.roadOuterBounds.top},{x:world.roadOuterBounds.right,y:world.roadOuterBounds.top},{x:world.roadOuterBounds.right,y:world.roadOuterBounds.bottom},{x:world.roadOuterBounds.left,y:world.roadOuterBounds.bottom}];
  assert.equal(inside(body,outer),true,'whole actor stays on its actual surface');assert.ok(edgeDistance(body,outer)+.2>=body.radius,'complete collision circle clears the railing');
  for(const obstacle of world.obstacles.filter(o=>o.surface===body.surface&&(body.surface==='road'||o.floor===body.floor))){assert.equal(inside(body,obstacle.polygon),false,'feet avoid complete building footprint');assert.ok(edgeDistance(body,obstacle.polygon)+.2>=body.radius,'original body clears complete static footprint');}
 }
 for(let a=0;a<actors.length;a++)for(let b=a+1;b<actors.length;b++){const x=actors[a].body,y=actors[b].body;if(x.surface===y.surface&&x.floor===y.floor&&(x.surface!=='ladder'||x.link===y.link))assert.ok(distance(x,y)+.2>=x.radius+y.radius,'physical actor bodies remain separate after placement');}
}
async function preview(slot){await touch(page.locator('[data-nav="build"]'));await touch(page.locator('#modal-root [data-build-type="waterworks"]'));await cameraSettled();const f=await frame(),hit=f.hits.find(h=>h.kind==='build-slot'&&h.plotId===slot);assert.ok(hit,'real requested slot marker exists');const input=await worldTap(screen(hit,f));await page.waitForFunction(slot=>document.querySelector('#construction-bar')?.dataset.preview?.split(':')[2]===String(slot),slot,{timeout:1500});return input;}
async function prepareConfirmation(){const button=page.locator('[data-construction-confirm]');assert.equal(await button.isDisabled(),false,'pet-occupied preview remains confirmable');await button.scrollIntoViewIfNeeded();const box=await button.boundingBox();assert.ok(box&&box.width>=44&&box.height>=44,'cached confirm target retains the complete 44px finger target');const client={x:box.x+box.width/2,y:box.y+box.height/2};assert.equal(await button.evaluate((element,p)=>document.elementFromPoint(p.x,p.y)?.closest('button')===element,client),true,'cached native confirm center reaches the actual stable button');await button.evaluate(element=>{window.__loadingPlacementConfirm=null;element.addEventListener('pointerup',event=>{const d=document.querySelector('#world').dataset;window.__loadingPlacementConfirm={at:performance.now(),isTrusted:event.isTrusted,preview:document.querySelector('#construction-bar').dataset.preview,movement:JSON.parse(d.freeMovement),pets:JSON.parse(d.petMotion),slots:JSON.parse(d.settlementSlots),relocation:JSON.parse(d.placementPetRelocation??'null'),save:JSON.parse(localStorage.getItem('road-haven-save-v1'))};},{capture:true,once:true});});return{button,client,bounds:box,preparedAt:Date.now()};}
async function confirmCapture(prepared){const target=prepared??await prepareConfirmation();if(prepared){receipt.inputs.push({kind:'native-touchscreen-tap',at:Date.now(),client:target.client,bounds:target.bounds,label:'건설 확정 · 실제 걷기 시작에 즉시 터치'});await page.touchscreen.tap(target.client.x,target.client.y);}else await touch(target.button);const result=await page.evaluate(()=>window.__loadingPlacementConfirm);assert.ok(result?.isTrusted,'confirm proof comes from the actual native pointerup');return result;}
async function buildOverPets(label,expectedMoved,{moving=false}={}){
 const before=await saved(),beforeFrame=await frame();await preview(0);const previewFrame=await frame(),slot=previewFrame.slots.find(s=>s.slot===0);assert.equal(slot.available,true,'pet-only occupancy keeps the actual preview valid');assert.equal(overlaps(previewFrame.movement.body,slot),false,'hero is clear of the full footprint');
 if(!moving)assert.deepEqual(previewFrame.pets.filter(p=>overlaps(p.body,slot)).map(p=>p.id).sort(),[...expectedMoved].sort(),'expected natural initial pets really overlap complete footprint');await shot(`${label}-preview`);await observe(label);
 let movingReadiness,prepared,movingProof,movingHandle;
 if(moving){
  prepared=await prepareConfirmation();movingProof={label,prepared:{client:prepared.client,bounds:prepared.bounds,preparedAt:prepared.preparedAt},budgetMs:20000};(receipt.movingPreparations??=[]).push(movingProof);
  // The normal-motion Scene starts with its ordinary media preference. Wait for
  // a genuine moving resident well inside the footprint so a native release
  // can prove the requested moving-pet placement, without modifying its route.
  const handle=await page.waitForFunction(()=>{
   const d=document.querySelector('#world').dataset,slots=JSON.parse(d.settlementSlots),pets=JSON.parse(d.petMotion),movement=JSON.parse(d.freeMovement),slot=slots.find(s=>s.slot===0),poly=slot?.polygon,previous=window.__loadingMovingPrevious;if(previous?.frameAt===movement.frameAt)return false;window.__loadingMovingPrevious={frameAt:movement.frameAt,pets};if(!slot?.available||!poly||!previous)return false;
   const contains=p=>{let hit=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)hit=!hit;}return hit;};
   const edge=p=>Math.min(...poly.map((a,i)=>{const b=poly[(i+1)%poly.length],vx=b.x-a.x,vy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*vx+(p.y-a.y)*vy)/(vx*vx+vy*vy)));return Math.hypot(p.x-a.x-t*vx,p.y-a.y-t*vy);}));
   const walking=pets.filter(p=>{const prior=previous.pets.find(old=>old.id===p.id);return prior?.gait.speed===0&&prior.pose==='idle'&&p.body.surface==='deck'&&p.body.floor===slot.floor&&p.pose==='walk'&&p.gait.speed>.05&&(contains(p.body)||edge(p.body)<p.body.radius-10);});
   return walking.length?{at:performance.now(),slot,pets,walking,previous,current:{frameAt:movement.frameAt,pets}}:false;
  },null,{timeout:20000});movingHandle=handle;
 }
 const release=await confirmCapture(prepared),releaseSlot=release.slots.find(s=>s.slot===0),actualMoved=release.pets.filter(p=>overlaps(p.body,releaseSlot)).map(p=>p.id).sort();if(movingProof)movingProof.release=release;
 if(movingHandle){movingReadiness=await movingHandle.jsonValue();await movingHandle.dispose();movingProof.readiness=movingReadiness;}
 if(moving){assert.ok(actualMoved.length>0,'actual moving-pet confirm overlaps at least one complete animal body');assert.ok(release.pets.some(p=>actualMoved.includes(p.id)&&p.pose==='walk'&&p.gait.speed>.05),'an overlapping pet is genuinely walking at the native confirm');expectedMoved=actualMoved;}
 else assert.deepEqual(actualMoved,[...expectedMoved].sort(),'actual confirm frame retains full pet-body overlap');
 await page.waitForFunction(()=>JSON.parse(document.querySelector('#world').dataset.placementPetRelocation??'null')?.moved.length>0,null,{timeout:1500});const afterFrame=await frame(),relocation=afterFrame.relocation;
 assert.deepEqual(relocation.moved.map(p=>p.id).sort(),[...expectedMoved].sort(),'only overlapping pets teleport');
 for(const pet of release.pets){const after=afterFrame.pets.find(p=>p.id===pet.id),moved=relocation.moved.find(p=>p.id===pet.id);assert.equal(after.body.radius,pet.body.radius);if(moved||!moving)assert.equal(after.gait.distance,pet.gait.distance,'teleport adds no artificial walking distance');
  if(moved){assert.ok(distance(moved.from.point,pet.body)<.1,'teleport starts at the actual confirm body');assert.ok(distance(moved.to.point,after.body)<.1,'first rendered body is the published safe landing');assert.ok(distance(moved.from.point,moved.to.point)>1,'occupied pet actually jumps');assert.equal(overlaps(after.body,releaseSlot),false);assert.ok(edgeDistance(after.body,releaseSlot.polygon)>=after.body.radius+1.8,'landing clears new footprint with full radius and 2px margin');assert.equal(after.gait.speed,0,'relocated pet begins with reset walking speed');assert.equal(after.turnRemaining,0,'old turn does not survive relocation');}
  else if(!moving)assert.deepEqual(after,pet,'nonoverlapping stationary pet is preserved exactly');
 }
 assert.ok(distance(afterFrame.action.from??afterFrame.movement.position,release.movement.position)<.1,'placement retains hero feet at the physical start of the ordinary chore');
 await page.waitForFunction(()=>!document.querySelector('#app').hasAttribute('aria-busy'),null,{timeout:20000});const complete=await frame(),after=await saved(),observation=await stopObserve();
 const added=buildings(after).filter(b=>!buildings(before).some(old=>old.id===b.id));assert.equal(added.length,1,'exactly one new facility is built');assert.equal(added[0].slot,0);assert.equal(added[0].type,'waterworks');assert.equal(after.resources.wood,before.resources.wood-12);assert.equal(after.resources.scrap,before.resources.scrap-4);
 for(const key of ['health','energy','morale','xp','level','companions','animalReserve','companionTeam','maxCompanionTeamSize','plots','seedInventory','growthQuests','villageOrders','quests','stats'])assert.deepEqual(after[key],before[key],`${key}: build/teleport changes no unrelated progress`);
 for(const f of observation.frames)assertBodies(f,observation.worlds[f.worldId]);assert.ok(observation.frames.some(f=>f.action.kind==='build'&&f.action.phase==='working'),'ordinary building work actually finishes after teleport');
 const stableAfter=stable(after);await page.waitForTimeout(200);assert.deepEqual(stable(await saved()),stableAfter,'completed build never charges or grants twice');await shot(`${label}-complete`);
 receipt.placements.push({label,moving,before,beforeFrame,previewFrame,movingReadiness,release,relocation,after,complete,observationId:observation.id});
 if(moving){
  await observe(`${label}-resumed-patrol`);await page.waitForFunction(ids=>JSON.parse(document.querySelector('#world').dataset.petMotion).some(p=>ids.includes(p.id)&&p.pose==='walk'&&p.gait.speed>.05),expectedMoved,{timeout:16000});await page.waitForTimeout(1200);const resumed=await stopObserve();
  assert.ok(resumed.frames.some(f=>f.pets.some(p=>expectedMoved.includes(p.id)&&p.pose==='walk')),'a relocated pet resumes ordinary natural walking in the same Scene');
  for(let i=0;i<resumed.frames.length;i++){const f=resumed.frames[i];assertBodies(f,resumed.worlds[f.worldId]);if(i){const previous=resumed.frames[i-1],seconds=(f.movement.frameAt-previous.movement.frameAt)/1000;for(const pet of f.pets){const before=previous.pets.find(p=>p.id===pet.id);assert.ok(distance(pet.body,before.body)<=44*seconds+1.5,'resumed natural patrol keeps its original 2× physical speed without further jumps');}}}
  receipt.placements.at(-1).resumedObservationId=resumed.id;
 }else receipt.placements.at(-1).patrolPolicy='Reduced-motion Scene intentionally keeps pets stationary; resume is independently exercised by the normal-motion native placement case.';
 return after;
}
async function heroOccupiedRejection(){
 await cameraSettled();const candidate=await page.locator('#world').evaluate(canvas=>{
  const d=canvas.dataset,g=JSON.parse(d.sceneGeometry),r=canvas.getBoundingClientRect(),slot=JSON.parse(d.settlementSlots).find(s=>s.slot===1),hits=JSON.parse(d.sceneHits),pets=JSON.parse(d.petMotion),p=slot?.polygon;if(!p)return null;
  for(const a of [.08,.15,.85,.92])for(const b of [.08,.15,.85,.92]){
   const q={x:p[0].x+(p[1].x-p[0].x)*a+(p[3].x-p[0].x)*b,y:p[0].y+(p[1].y-p[0].y)*a+(p[3].y-p[0].y)*b};
   if(hits.some(h=>h.bounds?q.x>=h.bounds[0]&&q.x<=h.bounds[2]&&q.y>=h.bounds[1]&&q.y<=h.bounds[3]:Math.hypot(q.x-h.x,q.y-h.y)<=h.radius))continue;
   if(pets.some(pet=>pet.body.surface==='deck'&&pet.body.floor===1&&Math.hypot(q.x-pet.x,q.y-pet.y)<pet.body.radius+9))continue;
   const client={x:r.left+g.dx+q.x*g.scale,y:r.top+g.dy+q.y*g.scale};
   if([-21.5,0,21.5].some(dx=>[-21.5,0,21.5].some(dy=>document.elementFromPoint(client.x+dx,client.y+dy)!==canvas)))continue;
   return{slot,world:q,client,geometry:g,hits,pets};
  }return null;
 });assert.ok(candidate,'real ground inside another empty footprint is available for a native manual walk');
 await observe('hero-native-walk-into-empty-footprint');const input=await worldTap(candidate.client);await page.waitForFunction(()=>JSON.parse(document.querySelector('#world').dataset.freeMovement).moving,null,{timeout:1500});await page.waitForFunction(()=>!JSON.parse(document.querySelector('#world').dataset.freeMovement).moving,null,{timeout:15000});const walk=await stopObserve(),arrived=await frame();
 assert.ok(distance(arrived.movement.position,candidate.world)<3,'hero physically reaches the actual touched empty footprint');for(const f of walk.frames)assertBodies(f,walk.worlds[f.worldId]);const before=await saved();await preview(1);const selected=await frame(),slot=selected.slots.find(s=>s.slot===1);assert.equal(overlaps(selected.movement.body,slot),true,'actual hero full body occupies the proposed footprint');assert.equal(slot.available,false,'hero occupancy still invalidates the map preview');
 const release=await confirmCapture();await page.waitForTimeout(200);assert.deepEqual(stable(await saved()),stable(before),'hero rejection preserves all stored progress and costs nothing');assert.equal((await frame()).action.kind,null,'hero rejection starts no building chore');assert.equal(await page.locator('#app').getAttribute('aria-busy'),null);assert.equal(await page.locator('#construction-bar').getAttribute('data-preview'),'waterworks:1:1:','rejected hero preview remains selected');await shot('hero-occupied-rejected');receipt.rejections.push({kind:'hero',candidate,input,walkObservationId:walk.id,arrived,selected,release,before,after:await saved()});
}
async function staticOccupiedRejection(){
 const before=await saved();await touch(page.locator('[data-nav="build"]'));await touch(page.locator('#modal-root [data-build-type="waterworks"]'));await cameraSettled();const f=await frame(),slot=f.slots.find(s=>s.slot===0),hit=f.hits.find(h=>h.kind==='build-slot'&&h.plotId===0);assert.equal(slot.blockedReason,'static');assert.equal(slot.available,false,'existing complete footprint remains invalid');assert.ok(hit,'occupied visible slot still has the actual construction hit');const input=await worldTap(screen(hit,f));await page.waitForTimeout(100);assert.equal(await page.locator('[data-construction-confirm]').isDisabled(),true,'occupied static slot creates no confirmable preview');assert.deepEqual(stable(await saved()),stable(before),'static rejection preserves costs and saved progress');assert.equal((await frame()).action.kind,null);await shot('static-occupied-rejected');receipt.rejections.push({kind:'static',slot,input,before,after:await saved()});
}
async function prepareCatOnlyWithRoster(){
 // Actual Scene construction initially paints the default pets before the
 // loaded village is supplied. Rejoin the dog through the shipped roster UI
 // so its genuine spawn uses this declared Lv2 world; retain the original cat.
 const before=await saved(),beforeFrame=await frame(),inputs=[];
 inputs.push(await touch(page.locator('[data-open="menu"]')));inputs.push(await touch(page.locator('#modal-root [data-open="pet"]')));
 inputs.push(await touch(page.locator('#modal-root [data-team-toggle="dog"]')));await page.waitForFunction(()=>!JSON.parse(document.querySelector('#world').dataset.petMotion).some(p=>p.id==='dog'),null,{timeout:3000});const dogRemoved=await frame(),saveRemoved=await saved();
 assert.deepEqual(saveRemoved.companionTeam,['cat'],'the real roster removes only the dog');assert.deepEqual(dogRemoved.pets.find(p=>p.id==='cat'),beforeFrame.pets.find(p=>p.id==='cat'),'the stationary original cat remains untouched');
 inputs.push(await touch(page.locator('#modal-root [data-team-toggle="dog"]')));await page.waitForFunction(()=>JSON.parse(document.querySelector('#world').dataset.petMotion).some(p=>p.id==='dog'),null,{timeout:3000});const dogReturned=await frame();await closeModal();await cameraSettled();const after=await saved(),afterFrame=await frame(),slot=afterFrame.slots.find(s=>s.slot===0);
 assert.deepEqual(after.companionTeam,['cat','dog'],'the real roster re-adds the dog as its ordinary second resident');assert.deepEqual(stable(after),stable({...before,companionTeam:['cat','dog']}),'roster setup changes only explicit team ordering, never resources, health, XP, quests or statistics');
 assert.deepEqual(afterFrame.pets.find(p=>p.id==='cat'),beforeFrame.pets.find(p=>p.id==='cat'),'the cat still occupies its original real feet');assert.equal(overlaps(afterFrame.pets.find(p=>p.id==='dog').body,slot),false,'rejoined dog genuinely clears the complete building footprint');assert.equal(overlaps(afterFrame.pets.find(p=>p.id==='cat').body,slot),true,'retained cat genuinely overlaps the complete building footprint');assert.deepEqual(afterFrame.movement.body,beforeFrame.movement.body,'the authentic roster preparation never moves the hero');
 receipt.fixtures.at(-1).rosterPreparation={scope:'Explicit native user roster out/in setup; no actor position injection, no private Scene call, no time manipulation',before,beforeFrame,inputs,dogRemoved,saveRemoved,dogReturned,after,afterFrame};
}
async function nativeFixture(width,height,{reducedMotion='no-preference',mode='hold',existing=originalSave}={}){
 context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,deviceScaleFactor:2,reducedMotion});
 await context.route('**/update.json*',route=>route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({version,versionCode,minimumNativeVersionCode:8,apkUrl:'https://example.invalid/private-not-downloaded.apk',sha256:'a'.repeat(64),notes:'Private browser bridge fixture'})}));
 await context.addInitScript(({version,versionCode,existing,mode})=>{
  // Zero is the save schema's explicit no-away-time baseline. This suite tests
  // the artwork/inert startup UI, not the separately covered absence catch-up.
  if(existing&&!sessionStorage.getItem('loading-private-seeded')){localStorage.setItem('road-haven-save-v1',JSON.stringify({...existing,lastSaved:0}));sessionStorage.setItem('loading-private-seeded','true');}
  const calls=[],listeners={},native={status:'idle',progress:0,revision:0,message:'Private fixture'};let content={status:'checking',progress:0,contentVersion:versionCode-1,version,message:'Private bridge fixture'},resolveCheck;
  const emit=(status,progress)=>{content={...content,status,progress,...(status==='ready'?{contentVersion:versionCode}:{})};listeners.ContentUpdater?.(content);if(status==='ready'||status==='error'||status==='idle')resolveCheck?.(content);};
  window.__loadingNativeFixture={calls,emit,offline(){emit('error',0);},get content(){return content;}};window.CapacitorCustomPlatform={name:'android'};
  window.Capacitor={PluginHeaders:['Updater','ContentUpdater'].map(name=>({name,methods:(name==='Updater'?['getVersion','getUpdateState','prepareUpdate','installUpdate','cancelUpdate']:['getState','check','activate','acknowledge']).map(name=>({name,rtype:'promise'})).concat([{name:'addListener',rtype:'callback'},{name:'removeListener',rtype:'promise'}])})),
   nativeCallback(plugin,method,args,callback){calls.push({plugin,method,at:Date.now()});if(method==='addListener')listeners[plugin]=callback;return Promise.resolve(`loading-${plugin}`);},
   async nativePromise(plugin,method,args){calls.push({plugin,method,at:Date.now(),save:localStorage.getItem('road-haven-save-v1')});if(plugin==='Updater')return method==='getVersion'?{version:'0.8.0',versionCode:8}:native;
    if(method==='getState')return content;if(method==='check'){if(mode==='offline')throw Error('Private offline bridge fixture');return new Promise(resolve=>{resolveCheck=resolve;});}if(method==='activate')return{};return{};}};
 },{version,versionCode,existing,mode});receipt.fixtures.push({kind:'Private native content bridge; controlled native progress events with real timers; no signed native activation',absenceBaseline:'lastSaved=0 explicitly declares no away time; source save and every other field unchanged',mode,width,height,reducedMotion});
 page=await context.newPage();attachErrors(page);await page.goto(nativeUrl,{waitUntil:'domcontentloaded'});if(mode!=='offline')await page.locator('[data-startup-patch]').waitFor();
}
async function assertLoading(phase,label,reducedMotion=false){
 await page.locator(`[data-patch-phase="${phase}"]`).waitFor();await page.locator('[data-startup-patch]').evaluate(async panel=>{await document.fonts.ready;await Promise.all([...panel.querySelectorAll('img')].map(image=>image.decode()));});
 const view=await page.locator('[data-startup-patch]').evaluate(panel=>{const card=panel.querySelector('.startup-patch-card'),r=card.getBoundingClientRect(),images=[...panel.querySelectorAll('img')].map(i=>({src:i.currentSrc,complete:i.complete,width:i.naturalWidth,height:i.naturalHeight}));return{phase:panel.dataset.patchPhase,title:panel.querySelector('h1')?.textContent,viewport:{width:innerWidth,height:innerHeight},card:{left:r.left,top:r.top,right:r.right,bottom:r.bottom},scroll:{width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight},images,animations:panel.getAnimations({subtree:true}).map(a=>({state:a.playState,iterations:a.effect?.getTiming().iterations}))};});
 assert.ok(view.title?.length>0,'loading has a real Korean title');assert.ok(view.card.left>=0&&view.card.top>=0&&view.card.right<=view.viewport.width+.5&&view.card.bottom<=view.viewport.height+.5,'entire loading card fits this viewport');assert.ok(view.scroll.width<=view.viewport.width&&view.scroll.height<=view.viewport.height+1,'loading has no clipped document or accidental scrolling');
 for(const image of view.images)assert.ok(image.complete&&image.width>0&&image.height>0,'actual loading artwork successfully decodes');
 assert.equal(await page.locator('#app').evaluate(app=>app.inert),true,'startup keeps gameplay inert');assert.equal(await page.locator('[data-start]').count(),0,'startup cannot expose welcome beneath loading');assert.equal(await page.locator('[data-patch-continue]').isVisible(),false,'normal update stages cannot be bypassed');assert.deepEqual(stable(await saved()),stable(originalSave),'loading never alters saved inventory/stats/clock');
 if(reducedMotion)assert.equal(view.animations.filter(a=>a.state==='running'&&a.iterations===Infinity).length,0,'reduced-motion loading runs no infinite decorative animation');await shot(label);receipt.loading.push({...view,label,reducedMotion});
}
async function emit(status,progress){await page.evaluate(({status,progress})=>window.__loadingNativeFixture.emit(status,progress),{status,progress});}
async function assertNoApk(){const calls=await page.evaluate(()=>window.__loadingNativeFixture.calls);assert.equal(calls.filter(c=>c.method==='prepareUpdate'||c.method==='installUpdate').length,0,'compatible startup invokes no APK download or installer');return calls;}

await mkdir('artifacts',{recursive:true});
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 caseName='fresh-reduced-390-both-pets';await begin(390,844);originalSave=await saved();const constructedSave=await buildOverPets(caseName,['dog','cat']);await context.close();
 const fixture=structuredClone(originalSave);fixture.deckLevel=2;fixture.plots.push({id:4,plantedAt:null,watered:false});fixture.resources.wood=200;fixture.resources.scrap=100;fixture.stats.expansions=1;fixture.log=['명시된 QA용 Lv2 저장 fixture — 자연 획득 기록 아님'];
 caseName='declared-lv2-360-cat-only';await begin(360,740,{fixture});await prepareCatOnlyWithRoster();await buildOverPets(caseName,['cat']);await context.close();
 caseName='normal-motion-390-moving-pet';await begin(390,844,{reducedMotion:'no-preference'});await buildOverPets(caseName,null,{moving:true});await context.close();
 caseName='hero-still-blocks-390';await begin(390,844);await heroOccupiedRejection();await context.close();
 caseName='existing-building-still-blocks-390';await begin(390,844,{fixture:constructedSave});await staticOccupiedRejection();await context.close();
 for(const[width,height,reducedMotion]of[[360,740,false],[390,844,false],[844,390,false],[390,844,true]]){
  caseName=`loading-${width}-${height}-${reducedMotion?'reduced':'normal'}`;await nativeFixture(width,height,{reducedMotion:reducedMotion?'reduce':'no-preference'});
  await assertLoading('checking',`${caseName}-checking`,reducedMotion);await emit('downloading',43);await assertLoading('downloading',`${caseName}-download`,reducedMotion);assert.equal(await page.locator('[data-patch-progress]').getAttribute('aria-valuenow'),'43');
  await emit('downloading',98);await assertLoading('verifying',`${caseName}-verify`,reducedMotion);assert.equal(await page.locator('[data-patch-progress]').getAttribute('aria-valuenow'),'98');
  await emit('ready',100);await assertLoading('applying',`${caseName}-applying`,reducedMotion);assert.equal(await page.locator('[data-patch-progress]').getAttribute('aria-valuenow'),'100');const calls=await assertNoApk();assert.equal(calls.filter(c=>c.method==='activate').length,1,'accepted startup activates compatible content exactly once');receipt.loading.at(-1).bridgeCalls=calls;await context.close();
 }
 caseName='real-twelve-second-slow-continue';await nativeFixture(360,740);await emit('downloading',43);const slowAt=Date.now();await page.locator('[data-patch-continue]:visible').waitFor({timeout:14000});assert.ok(Date.now()-slowAt>=10000,'continue unlock follows natural startup timeout, no fake clock');const held=await saved();await shot(`${caseName}-ready`);await touch(page.locator('[data-patch-continue]'));await waitPlayable();await pauseWorld();assert.deepEqual(withoutClock(await saved()),withoutClock(held),'slow fallback preserves every non-clock saved field');const slowCalls=await assertNoApk();assert.equal(slowCalls.filter(c=>c.method==='activate').length,0,'continuing current content activates nothing');receipt.loading.push({label:caseName,elapsedMs:Date.now()-slowAt,bridgeCalls:slowCalls});await context.close();
 caseName='offline-fallback';await nativeFixture(390,844,{mode:'offline'});await waitPlayable();await pauseWorld();assert.deepEqual(withoutClock(await saved()),withoutClock(originalSave),'offline startup keeps the original village');assert.equal((await assertNoApk()).filter(c=>c.method==='activate').length,0);receipt.loading.push({label:caseName,save:await saved()});await context.close();
 assert.equal(receipt.canceledImages.every(url=>receipt.successfulImages.includes(url)),true,'canceled duplicate images have successful matching asset requests');assert.deepEqual(receipt.errors,[]);assert.deepEqual(receipt.failedAssets,[]);receipt.status='passed';
}catch(error){receipt.status='failed';receipt.failure={message:String(error),stack:error.stack};if(page&&!page.isClosed()){receipt.failureFrame=await frame().catch(()=>null);receipt.bridgeCalls=await page.evaluate(()=>window.__loadingNativeFixture?.calls).catch(()=>null);await shot('failure').catch(()=>{});}throw error;
}finally{
 receipt.assertionsExecuted=assertionsExecuted;receipt.finishedAt=new Date().toISOString();await writeFile(`artifacts/loading-placement-v${version}-verification.json`,JSON.stringify(receipt,null,2)+'\n');await browser?.close();console.log(JSON.stringify({status:receipt.status,assertionsExecuted,placements:receipt.placements.length,loadingScreens:receipt.loading.length,screenshots:receipt.screenshots.length,failure:receipt.failure?.message}));
}
