import { chromium } from '@playwright/test';
import strictAssert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { captureExecutionInputs } from './release-execution-inputs.mjs';

// Immutable release verification only. All earned actions use native fingers and
// natural RAF/time. The one older three-floor input is separately hash-bound,
// declared unearned setup; only its loading lastSaved is set to the current time.
const version=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8')).version;
const baseUrl=process.env.TEST_BASE_URL,snapshotId=process.env.TEST_SNAPSHOT_ID,finalSnapshot=process.env.TEST_FINAL_SNAPSHOT==='1';
if(version!=='0.22.0'||baseUrl!=='http://127.0.0.1:4288/House/'||!/^v022-r[1-9]\d*$/.test(snapshotId)||!finalSnapshot)throw Error('Village verification requires the approved immutable v0.22 snapshot on port 4288.');
const startedAt=new Date(),executionInputs=await captureExecutionInputs(import.meta.url,{snapshotId,finalSnapshot});
let assertionsExecuted=0;
const assert=new Proxy(strictAssert,{get(target,key){const value=Reflect.get(target,key);return typeof value==='function'?(...args)=>{assertionsExecuted++;return value(...args);}:value;}});
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
async function fileSha(path){const hash=createHash('sha256');for await(const bytes of createReadStream(path))hash.update(bytes);return hash.digest('hex');}
const receipt={version,snapshotId,finalSnapshot,baseUrl,executionInputs,startedAt:startedAt.toISOString(),
 scope:'Actual immutable native touch village growth, production, deliveries, original paid-floor migration and physical stairs; Chromium emulation, not physical phones.',
 clock:'Natural browser RAF and the real 2× / 4 stored game minutes per real second clock. UI pause is used for exact accounting; no fake clock or private game/Scene calls.',
 observationSchema:'Each natural scene frame retains hero movement, complete actor bodies, paws and camera. movement.world is deduplicated in observation.worlds; frame.worldId is its exact index. No frames are dropped except replacement of repeated notifications for the same scene frameAt.',
 freshFlows:[],fixtures:[],floorViews:[],journeys:[],observations:[],collisionProofs:[],cameraProofs:[],httpIdentity:[],screenshots:[],inputs:[],errors:[],failedAssets:[]};
let browser,context,page,currentCase='preflight';
const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('road-haven-save-v1')));
const stable=value=>{const copy=structuredClone(value);delete copy.lastSaved;return copy;};
const withoutClock=value=>{const copy=stable(value);for(const key of ['day','minutes','totalMinutes'])delete copy[key];return copy;};
const buildings=state=>{const placements=new Map((state.truckLayout?.placements??[]).map(p=>[p.id,p.slot]));return[...(state.settlement?.buildings??[]).map(b=>({...b,slot:placements.get(b.id)??b.slot})),...(state.truckLayout?.upperBuildings??[])];};
const point=value=>Array.isArray(value)?{x:value[0],y:value[1]}:value;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function inside(p,polygon){let result=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=point(polygon[i]),b=point(polygon[j]);if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)result=!result;}return result;}
function edgeDistance(p,polygon){return Math.min(...polygon.map((v,i)=>{const a=point(v),b=point(polygon[(i+1)%polygon.length]),vx=b.x-a.x,vy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*vx+(p.y-a.y)*vy)/(vx*vx+vy*vy)));return Math.hypot(p.x-a.x-t*vx,p.y-a.y-t*vy);}));}
async function frame(){return page.locator('#world').evaluate(canvas=>{const d=canvas.dataset,r=canvas.getBoundingClientRect();return{movement:JSON.parse(d.freeMovement),action:JSON.parse(d.sceneAction),pets:JSON.parse(d.petMotion??'[]'),geometry:JSON.parse(d.sceneGeometry),hits:JSON.parse(d.sceneHits??'[]'),slots:JSON.parse(d.settlementSlots??'[]'),rect:{left:r.left,top:r.top,width:r.width,height:r.height}};});}
function screen(p,f){return{x:f.rect.left+f.geometry.dx+p.x*f.geometry.scale,y:f.rect.top+f.geometry.dy+p.y*f.geometry.scale};}
async function clearCanvas(p){return page.evaluate(p=>[-22,0,22].every(dx=>[-22,0,22].every(dy=>document.elementFromPoint(p.x+dx,p.y+dy)?.id==='world')),p);}
async function touch(locator,{scroll=true,minHeight=44}={}){
 if(scroll)await locator.scrollIntoViewIfNeeded();const box=await locator.boundingBox();assert.ok(box,'intended native control is rendered');assert.ok(box.width>=44&&box.height>=minHeight,'native control has a 44px finger target');
 const client={x:box.x+box.width/2,y:box.y+box.height/2};assert.equal(await locator.evaluate((button,p)=>document.elementFromPoint(p.x,p.y)?.closest('button')===button,client),true,'actual finger reaches intended control');
 const input={kind:'native-touchscreen-tap',at:Date.now(),client,bounds:box,label:await locator.getAttribute('aria-label')??await locator.innerText()};receipt.inputs.push(input);await page.touchscreen.tap(client.x,client.y);return input;
}
async function worldTap(client){
 assert.equal(await clearCanvas(client),true,'actual map finger has nine clear probes across a full 44px target');
 await page.locator('#world').evaluate(canvas=>{window.__villageRelease=null;canvas.addEventListener('pointerup',event=>{const g=JSON.parse(canvas.dataset.sceneGeometry),r=canvas.getBoundingClientRect();window.__villageRelease={at:performance.now(),eventAt:event.timeStamp,isTrusted:event.isTrusted,client:{x:event.clientX,y:event.clientY},geometry:g,world:{x:(event.clientX-r.left-g.dx)/g.scale,y:(event.clientY-r.top-g.dy)/g.scale},movement:JSON.parse(canvas.dataset.freeMovement),pets:JSON.parse(canvas.dataset.petMotion),slots:JSON.parse(canvas.dataset.settlementSlots)};},{once:true,capture:true});});
 await page.touchscreen.tap(client.x,client.y);const input=await page.evaluate(()=>window.__villageRelease);assert.ok(input?.isTrusted,'map release is a genuine native pointer');receipt.inputs.push({kind:'native-map-tap',...input});return input;
}
async function closeModal(){if(await page.locator('#modal-root').isVisible())await touch(page.locator('#modal-root [data-close]').first());}
async function closeFacility(){if(await page.locator('#facility-sheet').isVisible())await touch(page.locator('[data-facility-close]'));}
async function home(){await closeModal();await closeFacility();await touch(page.locator('[data-nav="home"]'));}
async function setPaused(wanted){
 const current=await page.locator('.time-button').getAttribute('aria-label')==='시간 계속';if(current===wanted)return;
 await closeModal();await closeFacility();await touch(page.locator('[data-open="menu"]'));await touch(page.locator('#modal-root [data-open="settings"]'));await touch(page.locator('#modal-root [data-pause]'));await touch(page.locator('#modal-root [data-save]'));await closeModal();
 assert.equal(await page.locator('.time-button').getAttribute('aria-label')==='시간 계속',wanted,'UI pause reflects the actual clock');
}
async function cameraSettled(timeout=5000){
 await page.evaluate(()=>{window.__villageCamera=[];window.__villageCameraStable=0;});
 await page.waitForFunction(()=>{const c=document.querySelector('#world'),g=JSON.parse(c.dataset.sceneGeometry),m=JSON.parse(c.dataset.freeMovement),a=window.__villageCamera.at(-1);if(a?.frameAt===m.frameAt)return false;const b={frameAt:m.frameAt,dx:g.dx,dy:g.dy,scale:g.scale};window.__villageCamera.push(b);window.__villageCameraStable=a&&Math.abs(a.dx-b.dx)<.25&&Math.abs(a.dy-b.dy)<.25&&Math.abs(a.scale-b.scale)<.0005?window.__villageCameraStable+1:0;return window.__villageCameraStable>=3;},null,{timeout});return page.evaluate(()=>window.__villageCamera);
}
async function shot(label){const path=`artifacts/v${version}-village-management-${label}.png`;await page.screenshot({path,fullPage:true});receipt.screenshots.push({path,sha256:await fileSha(path)});return path;}
async function observe(label){
 await page.locator('#world').evaluate((canvas,label)=>{
  const worlds=[],frames=[],ids=new Map();const capture=()=>{const d=canvas.dataset,movement=JSON.parse(d.freeMovement),key=JSON.stringify(movement.world);let worldId=ids.get(key);if(worldId===undefined){worldId=worlds.length;ids.set(key,worldId);worlds.push(movement.world);}delete movement.world;
   const current={at:performance.now(),worldId,movement,action:JSON.parse(d.sceneAction),pets:JSON.parse(d.petMotion??'[]'),camera:JSON.parse(d.sceneGeometry)};if(frames.at(-1)?.movement.frameAt===movement.frameAt)frames[frames.length-1]=current;else frames.push(current);};
  window.__villageObservation={label,worlds,frames};capture();window.__villageObserver=new MutationObserver(capture);window.__villageObserver.observe(canvas,{attributes:true,attributeFilter:['data-free-movement','data-scene-action','data-pet-motion']});
 },label);
}
async function stopObserve(){const result=await page.evaluate(()=>{window.__villageObserver.disconnect();return window.__villageObservation;});result.id=receipt.observations.length;receipt.observations.push(result);return result;}
function collisions(observation){
 let pairs=0,bodies=0,ladderFrames=0;const expectedRadii={hero:7,dog:25.74,cat:24.82};
 for(let index=0;index<observation.frames.length;index++){
  const f=observation.frames[index],world=observation.worlds[f.worldId],actors=[{id:'hero',body:f.movement.body},...f.pets.map(p=>({id:p.id,body:p.body,contacts:p.contacts}))];
  assert.ok(Number.isFinite(f.movement.frameAt),'frames come from natural scene RAF');
  for(const actor of actors){const b=actor.body;assert.ok(b&&Number.isFinite(b.x)&&Number.isFinite(b.y)&&b.radius>0,'complete physical body exists');if(expectedRadii[actor.id]!==undefined)assert.ok(Math.abs(b.radius-expectedRadii[actor.id])<.001,'original full actor radius is retained');
   if(b.surface==='ladder'){ladderFrames++;assert.ok(world.links.some(link=>link.id===b.link),'climber owns an existing physical stair link');continue;}
   const polygon=b.surface==='deck'?world.floors.find(floor=>floor.id===b.floor)?.outerPolygon:[{x:world.roadOuterBounds.left,y:world.roadOuterBounds.top},{x:world.roadOuterBounds.right,y:world.roadOuterBounds.top},{x:world.roadOuterBounds.right,y:world.roadOuterBounds.bottom},{x:world.roadOuterBounds.left,y:world.roadOuterBounds.bottom}];assert.ok(polygon,'actual floor railing exists');assert.equal(inside(b,polygon),true,'feet remain on their actual surface');assert.ok(edgeDistance(b,polygon)+.2>=b.radius,'whole body clears railing');bodies++;
   const obstacles=world.obstacles.filter(o=>o.surface===b.surface&&(b.surface==='road'||o.floor===b.floor));for(const obstacle of obstacles){assert.equal(inside(b,obstacle.polygon),false,'body avoids complete static footprint');assert.ok(edgeDistance(b,obstacle.polygon)+.2>=b.radius,'whole body clears static footprint');}
   for(const contact of Object.values(actor.contacts??{}))if(contact.planted){assert.ok(distance(contact,b)<=b.radius+.2,'actual planted paw stays inside collision body');assert.equal(inside(contact,polygon),true,'paw clears railing');for(const obstacle of obstacles)assert.equal(inside(contact,obstacle.polygon),false,'paw avoids footprint');}
  }
  const owners=new Set();for(const actor of actors)if(actor.body.surface==='ladder'){assert.equal(owners.has(actor.body.link),false,'the complete stair bridge has one owner even across its lower/upper floor transition');owners.add(actor.body.link);}
  for(let a=0;a<actors.length;a++)for(let b=a+1;b<actors.length;b++){const x=actors[a].body,y=actors[b].body;if(x.surface!==y.surface||x.floor!==y.floor||x.surface==='ladder'&&x.link!==y.link)continue;pairs++;assert.ok(distance(x,y)-x.radius-y.radius>=-.2,'all compatible physical actor pairs remain separate');}
  if(index){const a=observation.frames[index-1].movement,b=f.movement,seconds=(b.frameAt-a.frameAt)/1000;assert.ok(seconds>=0&&Number.isFinite(seconds),'natural frame time is monotonic');assert.ok(distance(a.position,b.position)<=seconds*420+1.5,'hero feet never teleport or accelerate across stairs');}
 }
 assert.ok(bodies>0,'full physical checks actually executed');const proof={observationId:observation.id,bodies,pairs,ladderFrames};receipt.collisionProofs.push(proof);return proof;
}
async function chore(label,kind,trigger){
 const before=await saved(),from=(await frame()).movement;await observe(label);const input=await trigger();
 await page.waitForFunction(kind=>document.querySelector('#app').hasAttribute('aria-busy')&&JSON.parse(document.querySelector('#world').dataset.sceneAction).kind===kind,kind,{timeout:1500});
 const first=(await frame()).action;await page.waitForFunction(()=>!document.querySelector('#app').hasAttribute('aria-busy'),null,{timeout:20000});const observation=await stopObserve(),after=await saved(),final=(await frame()).movement;
 assert.ok(observation.frames.filter(f=>f.action.kind===kind&&f.action.phase==='working').length>=2,'actual work pose persists for several natural frames');assert.ok(distance(first.from,from.position)<2,'chore starts at retained physical feet');assert.ok(distance(final.position,first.returnPoint)<2,'chore physically returns to retained point');collisions(observation);return{label,kind,before,after,input,first,final,observationId:observation.id};
}
async function begin(width,height,input){
 context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,deviceScaleFactor:2});
 if(input)await context.addInitScript(({save,origin})=>{if(location.origin!==origin||sessionStorage.getItem('village-management-qa-applied'))return;const value=structuredClone(save);value.lastSaved=Date.now();localStorage.setItem('road-haven-save-v1',JSON.stringify(value));sessionStorage.setItem('village-management-qa-applied','true');},{save:input.save,origin:new URL(baseUrl).origin});
 page=await context.newPage();page.on('pageerror',error=>receipt.errors.push({case:currentCase,message:error.message}));page.on('response',r=>{if(r.status()>=400&&['image','font','script','stylesheet'].includes(r.request().resourceType()))receipt.failedAssets.push({case:currentCase,status:r.status(),url:r.url()});});
 await page.goto(baseUrl,{waitUntil:'domcontentloaded'});if(!input){await page.locator('[data-start]').waitFor();await page.locator('#player-name').fill(`마을성장${width}`);await touch(page.locator('[data-start]'));}
 await page.waitForFunction(()=>document.querySelector('#app')?.inert===false&&document.querySelector('#world')?.dataset.freeMovement,null,{timeout:15000});await setPaused(true);await cameraSettled();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight+1),true,'game fits the phone viewport');
 if(input){const loaded=await saved();assert.deepEqual(withoutClock(loaded),withoutClock(input.save),'entire original paid progress survives migration without gifts');receipt.fixtures.push({...input,viewport:{width,height},loaded,loadingPolicy:'Only lastSaved becomes actual loading time; real zero-baseline loading may advance the clock, no other save field is edited.'});}
 return saved();
}
async function claim(id,expectedNext){
 await home();assert.equal(await page.locator('#settlement-objective').getAttribute('data-active-quest'),id);assert.equal(await page.locator('#settlement-objective').getAttribute('data-quest-state'),'ready');const before=await saved(),input=await touch(page.locator('[data-next-goal]')),after=await saved();assert.deepEqual(after.growthQuests.claimed,[...before.growthQuests.claimed,id]);assert.equal(await page.locator('#settlement-objective').getAttribute('data-active-quest'),expectedNext);return{before,after,input,id};
}
async function chooseClearSlot(deadline,selectedSlot){
 const handle=await page.waitForFunction(selectedSlot=>{
  const c=document.querySelector('#world'),r=c.getBoundingClientRect(),slots=JSON.parse(c.dataset.settlementSlots),m=JSON.parse(c.dataset.freeMovement),pets=JSON.parse(c.dataset.petMotion);
  const inside=(p,poly)=>{let result=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)result=!result;}return result;};
  const edge=(p,poly)=>Math.min(...poly.map((a,i)=>{const b=poly[(i+1)%poly.length],vx=b.x-a.x,vy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*vx+(p.y-a.y)*vy)/(vx*vx+vy*vy)));return Math.hypot(p.x-a.x-t*vx,p.y-a.y-t*vy);}));
  return slots.filter(s=>(selectedSlot===null||s.slot===selectedSlot)&&s.available&&s.unlocked&&s.visible).map(s=>({...s,client:{x:r.left+s.x,y:r.top+s.y}})).find(s=>[-22,0,22].every(dx=>[-22,0,22].every(dy=>document.elementFromPoint(s.client.x+dx,s.client.y+dy)?.id==='world'))&&[m.body,...pets.map(p=>p.body)].every(b=>b.surface!=='deck'||b.floor!==s.floor||!inside(b,s.polygon)&&edge(b,s.polygon)>b.radius+2));
 },selectedSlot??null,{timeout:Math.max(1,deadline-Date.now())});const target=await handle.jsonValue();await handle.dispose();return target;
}
async function confirmClearSlot(slot,deadline){
 const attempts=[];
 while(Date.now()<deadline){
  const target=await chooseClearSlot(deadline,slot),before=await saved(),button=page.locator('[data-construction-confirm]');
  await button.evaluate((e,slot)=>{window.__villagePlacementRelease=null;e.addEventListener('pointerup',event=>{const c=document.querySelector('#world');window.__villagePlacementRelease={at:performance.now(),isTrusted:event.isTrusted,target:JSON.parse(c.dataset.settlementSlots).find(s=>s.slot===slot),bodies:[JSON.parse(c.dataset.freeMovement).body,...JSON.parse(c.dataset.petMotion).map(p=>p.body)]};},{once:true,capture:true});},slot);
  const input=await touch(button),release=await page.evaluate(()=>window.__villagePlacementRelease);assert.ok(release?.isTrusted&&release.target?.polygon,'actual confirmation captures complete footprint and bodies at native release');
  const handle=await page.waitForFunction(()=>document.querySelector('#app').hasAttribute('aria-busy')?'accepted':document.querySelector('#toast').textContent==='캐릭터나 동물이 지나가는 자리예요. 잠시 뒤 다시 확정해 주세요.'?'actor-rejected':false,null,{timeout:Math.max(1,Math.min(1500,deadline-Date.now()))});const outcome=await handle.jsonValue();await handle.dispose();attempts.push({target,before,input,release,outcome});
  if(outcome==='accepted'){
   for(const body of release.bodies)if(body.surface==='deck'&&body.floor===release.target.floor){assert.equal(inside(body,release.target.polygon),false,'accepted full footprint contains no actual actor centre');assert.ok(edgeDistance(body,release.target.polygon)+.05>=body.radius,'accepted native release clears every complete physical body');}
   return{input,release,attempts,acceptedAt:Date.now()};
  }
  const after=await saved();assert.deepEqual(stable(after),stable(before),'a body entering before confirmation neither spends nor begins work');assert.ok(release.bodies.some(b=>b.surface==='deck'&&b.floor===release.target.floor&&(inside(b,release.target.polygon)||edgeDistance(b,release.target.polygon)<b.radius)),'refused native release independently overlaps an actual complete body');
 }
 throw Error('The original20second placement readiness budget ended without a clear accepted footprint.');
}
async function placement(){
 await touch(page.locator('[data-nav="build"]'));await touch(page.locator('[data-build-type="waterworks"]'));const before=await saved();
 const deadline=Date.now()+20000,target=await chooseClearSlot(deadline),input=await worldTap(target.client);assert.deepEqual(stable(await saved()),stable(before),'preview spends nothing');await touch(page.locator('[data-construction-cancel]'));assert.deepEqual(stable(await saved()),stable(before),'cancelled blueprint preserves complete progress');
 await touch(page.locator('[data-nav="build"]'));await touch(page.locator('[data-build-type="waterworks"]'));
 const readinessStart=Date.now(),budgetDeadline=readinessStart+20000,clear=await chooseClearSlot(budgetDeadline);await worldTap(clear.client);
 const built=await chore('paid-first-waterworks','build',()=>confirmClearSlot(clear.slot,budgetDeadline));
 const added=buildings(built.after).filter(b=>!buildings(before).some(old=>old.id===b.id));assert.equal(added.length,1);const facility=added[0];assert.equal(facility.type,'waterworks');assert.equal(facility.slot,clear.slot);assert.equal(built.after.resources.wood,before.resources.wood-12);assert.equal(built.after.resources.scrap,before.resources.scrap-4);
 return{before,preview:{target,input},readiness:{startedAt:readinessStart,finishedAt:built.input.acceptedAt,budgetMs:20000},built,facility};
}
async function management(id){
 await home();await touch(page.locator('[data-open="village"]'));
 // Observe the genuine entrance animation before measuring its settled frame.
 // This is outside placement and physical-travel budgets; no clock is driven.
 await page.waitForFunction(()=>{const panel=document.querySelector('#modal-root:not([hidden]) .modal');return panel&&getComputedStyle(panel).opacity==='1'&&panel.getAnimations().every(animation=>animation.playState==='finished');},null,{timeout:5000});await cameraSettled();
 const row=page.locator(`[data-village-production="${id}"]`),main=row.locator('.village-production-main');
 const measured=await main.evaluate(e=>{const r=e.getBoundingClientRect(),panel=e.closest('.modal').getBoundingClientRect();return{r:{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height},panel:{top:panel.top,bottom:panel.bottom},reached:document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)?.closest('button')===e};});assert.ok(measured.r.top>=measured.panel.top&&measured.r.bottom<=measured.panel.bottom,'first production row is initially visible without scrolling');assert.equal(measured.reached,true);assert.match(await main.getAttribute('aria-label'),/Lv\.1.*현장에서/);assert.match(await row.locator('[data-village-production-duration]').innerText(),/초$/);assert.ok(await row.locator('[data-village-production-location]').innerText());return{row,main,measured};
}
async function cameraRoundtrip(label){
 await home();const before=await saved(),first=await frame();await touch(page.locator('[data-camera-toggle]'));const input=await touch(page.locator('[data-map-overview]'));await cameraSettled();const overview=await frame();assert.deepEqual(stable(await saved()),stable(before),'overview grants no progress');assert.ok(distance(overview.movement.position,first.movement.position)<.01,'overview does not move the hero');assert.ok(Math.abs(overview.geometry.scale-first.geometry.scale)>.001||Math.abs(overview.geometry.dx-first.geometry.dx)>1,'explicit overview changes actual camera framing');const reset=await touch(page.locator('[data-map-reset]'));await cameraSettled();const after=await frame();assert.deepEqual(stable(await saved()),stable(before),'camera reset preserves entire paid state');assert.ok(distance(after.movement.position,first.movement.position)<.01);await touch(page.locator('[data-camera-toggle]'));const proof={label,before,first,overview,after,input,reset};receipt.cameraProofs.push(proof);return proof;
}
async function reloadProgress(label){
 await home();await setPaused(true);await touch(page.locator('[data-open="menu"]'));await touch(page.locator('#modal-root [data-open="settings"]'));await touch(page.locator('#modal-root [data-save]'));await closeModal();const before=await saved(),seed=await page.evaluate(()=>localStorage.getItem('road-haven-selected-seed-v1'));await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('#app')?.inert===false&&document.querySelector('#world')?.dataset.freeMovement,null,{timeout:15000});await setPaused(true);const after=await saved();assert.deepEqual(withoutClock(after),withoutClock(before),'reload preserves all resources, buildings, job timestamps, seed inventory, claimed goals, animal health and XP');assert.equal(await page.evaluate(()=>localStorage.getItem('road-haven-selected-seed-v1')),seed,'chosen seed survives reload');return{label,before,after,seed,clock:'Only real loading time can advance village time.'};
}
async function fresh(width,height){
 currentCase=`fresh-${width}`;const initial=await begin(width,height),flow={viewport:{width,height},earned:true,initial,claims:[]};receipt.freshFlows.push(flow);await shot(`fresh-${width}`);
 flow.gather=await chore(`earned-gather-${width}`,'gather',()=>touch(page.locator('[data-next-goal]')));assert.equal(flow.gather.after.stats.gathers,flow.gather.before.stats.gathers+1);assert.equal(flow.gather.after.resources.wood,flow.gather.before.resources.wood+10);assert.equal(flow.gather.after.resources.scrap,flow.gather.before.resources.scrap+5);flow.claims.push(await claim('road-supplies','first-carrot'));
 flow.harvest=await chore(`earned-harvest-${width}`,'harvest',()=>touch(page.locator('[data-next-goal]')));assert.equal(flow.harvest.after.stats.harvests,flow.harvest.before.stats.harvests+1);assert.equal(flow.harvest.after.resources.food,flow.harvest.before.resources.food+4);flow.claims.push(await claim('first-carrot','rainwater-home'));
 flow.construction=await placement();const id=flow.construction.facility.id;await shot(`built-waterworks-${width}`);flow.claims.push(await claim('rainwater-home','first-delivery'));
 const idle=await management(id);flow.managementInitial=idle.measured;assert.equal(await idle.row.getAttribute('data-village-phase'),'idle');await touch(idle.main,{scroll:false});assert.equal(await page.locator('#facility-sheet').isVisible(),true);assert.equal(await page.locator('#facility-sheet').getAttribute('data-facility'),String(id));
 await closeFacility();await setPaused(false);await home();await touch(page.locator('[data-open="village"]'));await touch(page.locator(`[data-village-production="${id}"] .village-production-main`));
 const startWall=Date.now();await touch(page.locator(`[data-facility-start="${id}"]`));const starting=await saved(),batch=buildings(starting).find(b=>b.id===id);assert.equal(batch.readyAt-batch.startedAt,45,'actual Lv1 water batch retains45 stored game minutes / 11.25 seconds at2×');
 await closeFacility();await touch(page.locator('[data-open="village"]'));await page.locator(`[data-village-production="${id}"]`).evaluate(e=>{window.__villageStableRow=e;window.__villageStableMain=e.querySelector('.village-production-main');});await page.waitForTimeout(3100);assert.equal(await page.evaluate(id=>window.__villageStableRow===document.querySelector(`[data-village-production="${id}"]`)&&window.__villageStableMain===document.querySelector(`[data-village-production="${id}"] .village-production-main`),id),true,'natural production ticks preserve row and intended control identity');
 await page.waitForFunction(id=>document.querySelector(`[data-village-production="${id}"]`)?.dataset.villagePhase==='ready',id,{timeout:20000});const readyWall=Date.now();await setPaused(true);const ready=await saved();assert.ok(readyWall-startWall>=10500,'production readiness follows real elapsed2× time');assert.equal(ready.settlement.stats.collections,starting.settlement.stats.collections,'waiting awards no uncollected output');flow.production={startWall,readyWall,starting,ready,batch};
 const readyRow=await management(id);assert.equal(await readyRow.row.getAttribute('data-village-phase'),'ready');await touch(readyRow.main,{scroll:false});await closeFacility();assert.deepEqual(stable(await saved()),stable(ready),'opening and cancelling ready production preserves its uncollected batch');await management(id);await shot(`management-ready-${width}`);
 const beforeRepeat=await saved(),repeat=await touch(page.locator(`#modal-root [data-facility-collect-repeat="${id}"]`)),afterRepeat=await saved(),restarted=buildings(afterRepeat).find(b=>b.id===id);assert.equal(afterRepeat.resources.water,beforeRepeat.resources.water+4);assert.equal(afterRepeat.settlement.stats.collections,beforeRepeat.settlement.stats.collections+1);assert.equal(afterRepeat.settlement.stats.productions,beforeRepeat.settlement.stats.productions+1);assert.equal(restarted.readyAt-restarted.startedAt,45);assert.equal(restarted.startedAt,afterRepeat.totalMinutes);
 const duplicateTarget=await page.evaluate(p=>{const e=document.elementFromPoint(p.x,p.y);return{tag:e?.tagName,label:e?.closest('button')?.getAttribute('aria-label'),text:e?.closest('button')?.innerText};},repeat.client);await page.touchscreen.tap(repeat.client.x,repeat.client.y);const afterDuplicate=await saved();assert.deepEqual(stable(afterDuplicate),stable(afterRepeat),'a second physical tap cannot duplicate the just-collected batch or restart');flow.repeat={beforeRepeat,afterRepeat,afterDuplicate,input:repeat,duplicateInput:{kind:'native-repeated-same-coordinate-tap',client:repeat.client,target:duplicateTarget}};
 await home();await touch(page.locator('[data-village-advice^="activity:order-"]'));const beforeOrder=await saved(),orderId=await page.locator('[data-order-deliver]').getAttribute('data-order-deliver');assert.equal(orderId,'village-order-1');await touch(page.locator('[data-order-deliver]'));const afterOrder=await saved();assert.equal(afterOrder.villageOrders.completed,beforeOrder.villageOrders.completed+1);assert.equal(afterOrder.resources.water,beforeOrder.resources.water-3);assert.equal(afterOrder.resources.wood,beforeOrder.resources.wood+8);assert.equal(afterOrder.resources.scrap,beforeOrder.resources.scrap+3);assert.equal(afterOrder.xp,beforeOrder.xp+12);const nextInvestment=await page.locator('[data-order-investment-title]').innerText();assert.ok(nextInvestment.length>0);flow.order={beforeOrder,afterOrder,orderId,nextInvestment};await shot(`order-investment-${width}`);
 flow.claims.push(await claim('first-delivery','new-seeds'));await touch(page.locator('[data-next-goal]'));assert.equal(await page.locator('[data-select-seed="potato"]').isVisible(),true,'active next growth objective prepares real seed selection');await touch(page.locator('[data-select-seed="potato"]'));await home();assert.equal(await page.evaluate(()=>localStorage.getItem('road-haven-selected-seed-v1')),'potato');flow.camera=await cameraRoundtrip(`earned-village-${width}`);await shot(`default-return-${width}`);flow.reload=await reloadProgress(`earned-${width}`);flow.final=await saved();await context.close();context=null;
 console.log(`PASS fresh ${width}×${height}: four claimed goals, paid build, natural production, one explicit repeat, neighbor delivery and retained save.`);
}
async function originalPaidInput(){
 const paths={wrapper:'artifacts/truck-floors-v0.21.0-paid-save.json',sourceCapture:'artifacts/native-v021-build-source-snapshot.json',manifest:'artifacts/qa-snapshot-v021-r5.json',truckReceipt:'artifacts/truck-floors-v0.21.0-verification.json'};
 const expected={wrapper:'6d215de7d0c98fe03a837fc96db38343790b158a8250a965a0fb4a690225bbc3',sourceCapture:'e0196e19efe3153a06cba6c6dc4eb3ed7013a2b54df923acc3c845c17c713773',manifest:'8ba3235c907a37c4967da54957bd059d721c8452cb223934227b9d0135ac1fb8',truckReceipt:'cf4f3e6b3d9af0f0d56d386b61adfdaf7c7b79fbe977e99b114621b68585deaa'};
 for(const[key,path]of Object.entries(paths))assert.equal(await fileSha(path),expected[key],`actual prior ${key} is byte-identical to the published r5 evidence`);
 const wrapper=JSON.parse(await readFile(paths.wrapper,'utf8'));assert.equal(wrapper.snapshotId,'v021-r5');assert.equal(wrapper.finalSnapshot,true);assert.equal(wrapper.sha256OfSave,sha(JSON.stringify(wrapper.save)));assert.equal(wrapper.executionInputs.sourceCaptureSha256,expected.sourceCapture);assert.equal(wrapper.executionInputs.snapshotManifestSha256,expected.manifest);assert.equal(wrapper.paidPurchases.length,2);assert.equal(wrapper.save.truckLayout.floors,3);
 return{kind:'genuine-old-v021-paid-three-floor-save',earned:false,save:wrapper.save,sourcePaths:paths,sourceHashes:expected,originalSetup:wrapper.setup,originalPaidPurchases:wrapper.paidPurchases,claim:'The older run made actual paid floor purchases. Its earlier declared late unlock/resources setup is preserved as unearned input, never presented as natural progress in this suite.'};
}
async function readableFloor(floor,label){
 const before=await saved(),from=(await frame()).movement,input=await touch(page.locator(`[data-truck-floor="${floor}"]`));await cameraSettled();const result=await frame();assert.equal(result.geometry.activeFloor,floor);assert.ok(distance(result.movement.position,from.position)<.01,'floor selection changes view only, without hero teleport');assert.equal(result.movement.floor,from.floor);assert.deepEqual(stable(await saved()),stable(before),'viewing another paid floor preserves complete save');
 const house=result.hits.find(h=>h.kind==='house');if(house?.bounds){const[a,b,c,d]=house.bounds;for(const p of[{x:a,y:b},{x:c,y:d}]){const s=screen(p,result);assert.ok(s.x>=result.rect.left+result.geometry.viewport.safeLeft-1&&s.x<=result.rect.left+result.rect.width-result.geometry.viewport.safeRight+1&&s.y>=result.rect.top+result.geometry.viewport.safeTop-1&&s.y<=result.rect.top+result.rect.height-result.geometry.viewport.safeBottom+1,'whole visible cottage remains inside unobscured camera');}}
 const proof={label,floor,before,from,input,frame:result};receipt.floorViews.push(proof);await shot(label);return proof;
}
async function groundTarget(floor){
 const started=Date.now(),deadline=started+3500,attempts=[];await cameraSettled();
 do{
  const f=await frame(),poly=f.movement.world.floors.find(item=>item.id===floor).deckPolygon,links=f.movement.world.links.filter(l=>l.lower===floor||l.upper===floor),near=point((links.find(l=>l.lower!==0)??links[0]).points[(links.find(l=>l.lower!==0)??links[0]).upper===floor?3:0]);
  const xs=poly.map(p=>p.x),ys=poly.map(p=>p.y),candidates=[];
  for(let y=Math.min(...ys);y<=Math.max(...ys);y+=12)for(let x=Math.min(...xs);x<=Math.max(...xs);x+=12){const p={x,y};if(!inside(p,poly)||edgeDistance(p,poly)<12||distance(p,f.movement.position)<28)continue;if(f.pets.some(pet=>pet.body.surface==='deck'&&pet.body.floor===floor&&distance(p,pet.body)<pet.body.radius+f.movement.body.radius+12))continue;if(f.movement.world.obstacles.some(o=>o.surface==='deck'&&o.floor===floor&&(inside(p,o.polygon)||edgeDistance(p,o.polygon)<12)))continue;if(f.hits.some(h=>h.kind!=='truck'&&(h.bounds?x>=h.bounds[0]-7&&x<=h.bounds[2]+7&&y>=h.bounds[1]-7&&y<=h.bounds[3]+7:distance(p,h)<Math.max(h.radius,22/f.geometry.scale)+12)))continue;candidates.push({world:p,client:screen(p,f),rank:distance(p,near)});}
  candidates.sort((a,b)=>a.rank-b.rank);for(const candidate of candidates)if(await clearCanvas(candidate.client))return{...candidate,floor,readiness:{startedAt:started,finishedAt:Date.now(),budgetMs:3500,attempts},frame:f};attempts.push({at:Date.now(),camera:f.geometry,candidateCount:candidates.length});await page.waitForTimeout(40);
 }while(Date.now()<deadline);throw Error(`floor${floor}: no actual empty44px terrain within original3500ms readiness budget`);
}
async function journey(floor,label){
 await readableFloor(floor,`${label}-view`);const before=await saved(),from=(await frame()).movement,target=await groundTarget(floor);await observe(label);const input=await worldTap(target.client);await page.waitForFunction(()=>JSON.parse(document.querySelector('#world').dataset.freeMovement).moving,null,{timeout:1200});const accepted=(await frame()).movement;assert.equal(accepted.target.floor,floor);assert.ok(distance(accepted.target,input.world)<8,'route destination is under actual released finger');
 await page.waitForFunction(()=>!JSON.parse(document.querySelector('#world').dataset.freeMovement).moving,null,{timeout:20000});const observation=await stopObserve(),final=(await frame()).movement,after=await saved();assert.equal(final.floor,floor);assert.ok(distance(final.position,accepted.target)<2,'actual walking reaches exact retained destination');assert.deepEqual(stable(after),stable(before),'stairs travel spends and grants no saved progress');const physical=collisions(observation);const usedLinks=[...new Set(observation.frames.map(f=>f.movement.link).filter(Boolean))];
 if(from.floor!==floor){assert.ok(physical.ladderFrames>0,'floor travel traverses actual stairs');for(let step=Math.min(from.floor,floor);step<Math.max(from.floor,floor);step++)assert.ok(usedLinks.includes(`${step}-${step+1}`),'every connecting stair link is actually traversed');}
 const result={label,floor,before,after,from,target,input,accepted,final,usedLinks,observationId:observation.id,completionBudgetMs:20000};receipt.journeys.push(result);return result;
}
async function late(width,height,input){
 currentCase=`paid-three-floor-${width}`;await begin(width,height,input);for(const floor of[1,2,3])await readableFloor(floor,`paid-${width}-floor-${floor}`);
 await cameraRoundtrip(`paid-${width}`);await journey(3,`paid-${width}-1-to-3`);await journey(1,`paid-${width}-3-to-1`);await journey(3,`paid-${width}-1-to-3-return`);
 const ids=buildings(await saved()).filter(b=>Math.floor(b.slot/16)+1===3);assert.ok(ids.length>0);await touch(page.locator('[data-open="village"]'));const facility=ids[0];await touch(page.locator(`#modal-root [data-facility-select="${facility.id}"]`).first());await cameraSettled();const f=await frame(),slot=f.slots.find(s=>s.buildingId===facility.id);assert.equal(f.geometry.activeFloor,3);assert.ok(slot?.visible,'selected upper facility including its production controls fits actual safe viewport');assert.equal(await page.locator('#facility-sheet').getAttribute('data-facility'),String(facility.id));await shot(`paid-${width}-selected-facility`);const reload=await reloadProgress(`paid-${width}`);receipt.fixtures.at(-1).reload=reload;await context.close();context=null;console.log(`PASS paid3 ${width}: exact original saved layout, all floor views and natural1→3→1→3 stairs.`);
}
try{
 await mkdir('artifacts',{recursive:true});const manifest=JSON.parse(await readFile(executionInputs.snapshotManifestPath,'utf8'));assert.equal(manifest.root,`/tmp/road-haven-qa-${snapshotId}`);assert.equal(manifest.version,version);
 for(const[path,hash]of Object.entries(manifest.files)){const url=new URL(path,new URL('/',baseUrl)).href,response=await fetch(url);assert.equal(response.status,200,`immutable HTTP payload ${path}`);const bytes=Buffer.from(await response.arrayBuffer());assert.equal(sha(bytes),hash,`immutable HTTP bytes ${path}`);receipt.httpIdentity.push({path,url,status:response.status,bytes:bytes.length,sha256:hash});}
 const input=await originalPaidInput();browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 for(const[width,height]of[[390,844],[360,740],[844,390]])await fresh(width,height);
 for(const[width,height]of[[390,844],[844,390]])await late(width,height,input);
 assert.equal(receipt.freshFlows.length,3);assert.equal(receipt.fixtures.length,2);assert.equal(receipt.journeys.length,6);assert.deepEqual(receipt.errors,[]);assert.deepEqual(receipt.failedAssets,[]);receipt.status='passed';
}catch(error){receipt.status='failed';receipt.failure={case:currentCase,message:String(error),stack:error.stack};process.exitCode=1;if(page){try{receipt.failure.frame=await frame();receipt.failure.save=await saved();await shot('failure');}catch(e){receipt.failure.captureError=String(e);}}}
finally{
 if(context)await context.close();if(browser)await browser.close();receipt.finishedAt=new Date().toISOString();receipt.elapsedMs=Date.now()-startedAt.getTime();receipt.assertionsExecuted=assertionsExecuted;
 await writeFile(`artifacts/village-management-v${version}-verification.json`,JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({status:receipt.status,assertionsExecuted,freshFlows:receipt.freshFlows.length,fixtures:receipt.fixtures.length,journeys:receipt.journeys.length,screenshots:receipt.screenshots.length,failure:receipt.failure?.message}));
}
