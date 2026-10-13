import { chromium } from '@playwright/test';
import strictAssert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { captureExecutionInputs } from './release-execution-inputs.mjs';

// Genuine touches and natural RAF on an explicitly unearned older paid save.
// The actual save loader and Scene constructor validate setup before any input.
// Reduced-motion is a normal media preference, not a forced actor position.
const version=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8')).version;
const baseUrl=process.env.TEST_BASE_URL??'http://127.0.0.1:5173/';
const snapshotId=process.env.TEST_SNAPSHOT_ID??'mutable-development-diagnostic';
const finalSnapshot=process.env.TEST_FINAL_SNAPSHOT==='1';
const diagnosticOnly=process.env.TEST_LAYOUT_DIAGNOSTIC==='1';
if(!finalSnapshot&&!diagnosticOnly)throw Error('Choose an immutable final snapshot or an explicitly declared mutable diagnostic.');
if(diagnosticOnly&&finalSnapshot)throw Error('A mutable diagnostic cannot count as final release validation.');
const executionInputs=await captureExecutionInputs(import.meta.url,{snapshotId,finalSnapshot});
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
let assertionsExecuted=0;
const assert=new Proxy(strictAssert,{get(target,key){const v=Reflect.get(target,key);return typeof v==='function'?(...args)=>{assertionsExecuted++;return v(...args);}:v;}});
const receipt={version,snapshotId,finalSnapshot,diagnosticOnly,baseUrl,executionInputs,status:'running',startedAt:new Date().toISOString(),
 scope:'Chromium mobile emulation, real touchscreen input and natural RAF; no physical phone, APK installation or earned late-game progress claim.',
 fixtures:[],floorViews:[],rotations:[],journeys:[],inputs:[],screenshots:[],errors:[],failedAssets:[],httpIdentity:[]};
let browser,context,page,currentCase='preflight';
const stable=value=>{const copy=structuredClone(value);delete copy.lastSaved;return copy;};
const unchanged=value=>{const copy=stable(value);delete copy.layoutDirections;return copy;};
const physical=value=>{const copy=structuredClone(value);delete copy.deckPolygon;return copy;};
const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('road-haven-save-v1')));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function inside(p,poly){let result=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)result=!result;}return result;}
function edgeDistance(p,poly){return Math.min(...poly.map((a,i)=>{const b=poly[(i+1)%poly.length],x=b.x-a.x,y=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*x+(p.y-a.y)*y)/(x*x+y*y)));return Math.hypot(p.x-a.x-t*x,p.y-a.y-t*y);}));}
async function frame(){return page.locator('#world').evaluate(canvas=>{const d=canvas.dataset,r=canvas.getBoundingClientRect();return{at:performance.now(),movement:JSON.parse(d.freeMovement),action:JSON.parse(d.sceneAction),pets:JSON.parse(d.petMotion),geometry:JSON.parse(d.sceneGeometry),hits:JSON.parse(d.sceneHits),slots:JSON.parse(d.settlementSlots),rect:{left:r.left,top:r.top,width:r.width,height:r.height}};});}
async function touch(locator){
 await locator.scrollIntoViewIfNeeded();const box=await locator.boundingBox();assert.ok(box&&box.width>=44&&box.height>=44,'complete 44px native control');
 const client={x:box.x+box.width/2,y:box.y+box.height/2};assert.equal(await locator.evaluate((button,p)=>document.elementFromPoint(p.x,p.y)?.closest('button')===button,client),true,'actual finger reaches its intended control');
 receipt.inputs.push({case:currentCase,kind:'native-touchscreen-tap',at:Date.now(),client,bounds:box,label:await locator.getAttribute('aria-label')??await locator.innerText()});await page.touchscreen.tap(client.x,client.y);
}
async function closeModal(){if(await page.locator('#modal-root').isVisible())await touch(page.locator('#modal-root [data-close]').first());}
async function closeFacility(){if(await page.locator('#facility-sheet').isVisible())await touch(page.locator('[data-facility-close]'));}
async function pauseAndSave(){
 await closeModal();await closeFacility();await touch(page.locator('[data-open="menu"]'));await touch(page.locator('#modal-root [data-open="settings"]'));
 if(await page.locator('.time-button').getAttribute('aria-label')!=='시간 계속')await touch(page.locator('#modal-root [data-pause]'));
 await touch(page.locator('#modal-root [data-save]'));await closeModal();assert.equal(await page.locator('.time-button').getAttribute('aria-label'),'시간 계속');
}
async function settled(){
 await page.evaluate(()=>{window.__layoutCamera=[];window.__layoutStable=0;});await page.waitForFunction(()=>{const d=document.querySelector('#world').dataset,g=JSON.parse(d.sceneGeometry),m=JSON.parse(d.freeMovement),last=window.__layoutCamera.at(-1);if(last?.frameAt===m.frameAt)return false;const now={frameAt:m.frameAt,dx:g.dx,dy:g.dy,scale:g.scale};window.__layoutCamera.push(now);window.__layoutStable=last&&Math.abs(now.dx-last.dx)<.25&&Math.abs(now.dy-last.dy)<.25&&Math.abs(now.scale-last.scale)<.0005?window.__layoutStable+1:0;return window.__layoutStable>=3;},null,{timeout:5000});
}
async function shot(label){const path=`artifacts/v${version}-layout-${diagnosticOnly?'diagnostic-':''}${label}.png`;await page.screenshot({path,fullPage:true});receipt.screenshots.push({path,sha256:sha(await readFile(path))});}
function bodiesSafe(f){
 const world=f.movement.world,actors=[{id:'hero',body:f.movement.body},...f.pets.map(p=>({id:p.id,body:p.body}))];
 for(const actor of actors){const b=actor.body;assert.ok(Math.abs(b.radius-{hero:7,dog:25.74,cat:24.82}[actor.id])<.001,'original complete body radius');if(b.surface==='ladder')continue;
  const poly=b.surface==='deck'?world.floors.find(p=>p.id===b.floor).outerPolygon:[{x:world.roadOuterBounds.left,y:world.roadOuterBounds.top},{x:world.roadOuterBounds.right,y:world.roadOuterBounds.top},{x:world.roadOuterBounds.right,y:world.roadOuterBounds.bottom},{x:world.roadOuterBounds.left,y:world.roadOuterBounds.bottom}];
  assert.equal(inside(b,poly),true,'actual constructor/body lies on its physical surface');assert.ok(edgeDistance(b,poly)+.2>=b.radius,'complete body clears deck edge');
  for(const o of world.obstacles.filter(o=>o.surface===b.surface&&(b.surface==='road'||o.floor===b.floor))){assert.equal(inside(b,o.polygon),false);assert.ok(edgeDistance(b,o.polygon)+.2>=b.radius,'whole body clears physical static footprint');}
 }
}
function alignedPaint(f){
 const slopes=[.34/.91,-.47/.67];assert.ok(Array.isArray(f.geometry.layoutPaintGeometry),'telemetry comes from actual paint calls');
 for(const art of f.geometry.layoutPaintGeometry){assert.equal(art.floor,f.geometry.activeFloor,'every actual building/bed paint belongs to selected floor');
  if(art.kind==='plot'){const slope=(a,b)=>(b[1]-a[1])/(b[0]-a[0]);assert.ok(Math.abs(slope(art.bed[0],art.bed[1])-slopes[0])<.000001,'bed foundation follows actual deck U');assert.ok(Math.abs(slope(art.bed[1],art.bed[2])-slopes[1])<.000001,'bed foundation follows actual deck V');assert.equal(art.rows.length,3);for(const [a,b] of art.rows)assert.ok(Math.abs(slope(a,b)-slopes[art.direction])<.000001,'painted crop rows follow selected deck axis');}
  else{assert.ok(art.matrix.yScale>0,'upright walls stay upright');assert.equal(Math.sign(art.matrix.xScale),art.direction===0?1:-1);for(let i=0;i<2;i++){const actual=(art.matrix.yShear+art.sourceSlopes[i]*art.matrix.yScale)/art.matrix.xScale;assert.ok(Math.abs(actual-slopes[art.direction===0?i:1-i])<.000001,'actual art transformation fits both deck axes');}}
 }
}
function direction(save,kind,id){const dirs=save.layoutDirections;if(!dirs)return 0;return kind==='home'?dirs.home:(kind==='facility'?dirs.facilities:dirs.plots).find(p=>p.id===id)?.direction??0;}
async function fixture(){
 const path='artifacts/truck-floors-v0.21.0-paid-save.json',bytes=await readFile(path);assert.equal(sha(bytes),'6d215de7d0c98fe03a837fc96db38343790b158a8250a965a0fb4a690225bbc3');
 const original=JSON.parse(bytes);assert.equal(original.sha256OfSave,sha(JSON.stringify(original.save)));assert.equal(original.save.truckLayout.floors,3);
 // Run actual TypeScript save/load code, without importing browser-only art.
 const validator=spawnSync(process.execPath,['--import','tsx','--input-type=module','-e',`import {saveGame,loadGame} from './src/game.ts';let raw;const store={getItem:()=>raw??null,setItem:(k,v)=>raw=v};const input=JSON.parse(process.argv[1]);const accepted=saveGame(input,store);console.log(JSON.stringify({accepted,loaded:loadGame(store)}));`,JSON.stringify(original.save)],{encoding:'utf8'});
 assert.equal(validator.status,0,'real save loader validator executes');const checked=JSON.parse(validator.stdout);assert.equal(checked.accepted,true);assert.ok(checked.loaded);assert.deepEqual(stable(checked.loaded),stable(original.save),'actual save/load retains entire older progress');
 return{path,sha256:sha(bytes),save:checked.loaded,earned:false,originalSetup:original.setup,originalPaidPurchases:original.paidPurchases,
  declaration:'The older run made paid floor purchases after declared late-game fixture setup. This suite claims neither injected materials nor earned progression.'};
}
async function begin(width,height,input){
 currentCase=`${width}x${height}`;context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,deviceScaleFactor:2,reducedMotion:'reduce'});
 await context.addInitScript(save=>{if(sessionStorage.getItem('layout-fixture-installed'))return;save.lastSaved=Date.now();localStorage.setItem('road-haven-save-v1',JSON.stringify(save));sessionStorage.setItem('layout-fixture-installed','true');},input.save);
 page=await context.newPage();page.on('pageerror',error=>receipt.errors.push({case:currentCase,message:error.message}));page.on('response',r=>{if(r.status()>=400&&['script','stylesheet','image','font'].includes(r.request().resourceType()))receipt.failedAssets.push({status:r.status(),url:r.url()});});
 await page.goto(baseUrl,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('#world')?.dataset.freeMovement&&!document.querySelector('[data-startup-patch]')&&!document.querySelector('#app')?.inert,null,{timeout:15000});
 const constructor=await frame();bodiesSafe(constructor);assert.deepEqual(constructor.movement.world.floors.map(f=>f.id),[1,2,3]);await pauseAndSave();await settled();
 const loaded=await saved(),noClock=s=>{const c=stable(s);for(const key of['day','minutes','totalMinutes'])delete c[key];return c;};assert.deepEqual(noClock(loaded),noClock(input.save),'startup changes no non-clock progress');
 receipt.fixtures.push({...input,viewport:{width,height},constructor,loaded,loadingPolicy:'Only lastSaved changes during injection; natural startup clock is allowed before actual UI pause.'});
}
async function floorView(floor,label){
 await closeModal();await closeFacility();const before=await saved(),old=await frame();await touch(page.locator(`[data-truck-floor="${floor}"]`));await settled();const f=await frame(),g=f.geometry;
 assert.equal(g.activeFloor,floor);assert.equal(g.floorHeight,264);assert.deepEqual(g.visibleFloors,[floor]);assert.deepEqual(g.drawFloorHeights,[94+(floor-1)*264]);assert.deepEqual(g.physicalFloors,[1,2,3]);
 assert.deepEqual(physical(f.movement.world),physical(old.movement.world),'floor viewing leaves all physical floors, stairs and obstacles intact');assert.deepEqual(f.movement.world.deckPolygon,f.movement.world.floors.find(p=>p.id===floor).deckPolygon,'selected projection belongs to intended physical floor');assert.deepEqual(stable(await saved()),stable(before),'view changes no saved progress');assert.equal(f.movement.floor,old.movement.floor);assert.ok(distance(f.movement.position,old.movement.position)<.01,'view selection never teleports hero');
 for(const h of f.hits){if(h.kind==='build-slot')assert.equal(Math.floor(h.plotId/16)+1,floor);if(['facility','facility-start','facility-collect'].includes(h.kind)){const b=[...before.settlement.buildings.map(b=>({...b,slot:before.truckLayout.placements.find(p=>p.id===b.id)?.slot??b.slot})),...before.truckLayout.upperBuildings].find(b=>b.id===h.plotId);assert.ok(b);assert.equal(Math.floor(b.slot/16)+1,floor);}if(['farm','farm-expand','grove','grove-work'].includes(h.kind))assert.equal(floor,1);if(h.kind==='house')assert.equal(before.truckLayout.home.floor,floor);}
 assert.equal(f.hits.some(h=>h.kind==='farm'),floor===1);assert.equal(f.hits.some(h=>h.kind==='house'),floor===before.truckLayout.home.floor);
 for(const pet of f.pets)assert.equal(pet.visible,pet.floor===floor);
 assert.ok(g.layoutDirections.facilities.every(b=>b.floor===floor));assert.ok(g.layoutDirections.plots.every(b=>b.floor===floor));
 alignedPaint(f);const proofs=f.movement.world.floors.map(p=>p.outerPolygon[0]);assert.ok(Math.abs(proofs[0].y-proofs[1].y-264)<.001);assert.ok(Math.abs(proofs[1].y-proofs[2].y-264)<.001);
 receipt.floorViews.push({label,floor,before,frame:f});await shot(label);return f;
}
async function rotate(kind,id,label){
 const selector=`[data-layout-rotate="${kind}"]${id===undefined?'':`[data-layout-id="${id}"]`}`,before=await saved(),physical=(await frame()).movement.world,prior=direction(before,kind,id);
 await touch(page.locator(selector));await page.waitForFunction(({kind,id,expected})=>{const s=JSON.parse(localStorage.getItem('road-haven-save-v1')),d=s?.layoutDirections;return !!d&&(kind==='home'?d.home:(kind==='facility'?d.facilities:d.plots).find(p=>p.id===id)?.direction)===expected;},{kind,id,expected:1-prior},{timeout:1500});
 await page.waitForFunction(({kind,id,expected})=>{const g=JSON.parse(document.querySelector('#world').dataset.sceneGeometry),d=g.layoutDirections;const art=kind==='home'?d.home:d[kind==='facility'?'facilities':'plots'].find(p=>p.id===id);return art?.direction===expected;},{kind,id,expected:1-prior},{timeout:1500});
 const after=await saved(),f=await frame();assert.equal(direction(after,kind,id),1-prior);assert.deepEqual(unchanged(after),unchanged(before),'rotation preserves whole progress including materials, HP/XP, crops and pending batch timestamps');assert.deepEqual(f.movement.world,physical,'rotation never changes paid collision footprint or stairs');
 const art=kind==='home'?f.geometry.layoutDirections.home:f.geometry.layoutDirections[kind==='facility'?'facilities':'plots'].find(p=>p.id===id);assert.ok(art,'rotated object belongs to actual selected-floor paint');assert.equal(art.direction,1-prior);alignedPaint(f);const painted=f.geometry.layoutPaintGeometry.find(p=>p.kind===kind&&(id===undefined||p.id===id)&&!p.preview);assert.ok(painted,'rotated object reaches actual canvas painter');assert.equal(painted.direction,1-prior);
 receipt.rotations.push({label,kind,id,before,after,frame:f});await shot(label);
}
async function rotationFlow(width){
 await touch(page.locator('[data-nav="build"]'));await touch(page.locator('#modal-root [data-open="house"]'));await rotate('home',undefined,`${width}-home-turned`);await rotate('home',undefined,`${width}-home-returned`);await rotate('home',undefined,`${width}-home-persisted-facing`);await closeModal();
 await touch(page.locator('[data-open="village"]'));await touch(page.locator('#modal-root [data-facility-select="17"]').first());await settled();assert.equal((await frame()).geometry.activeFloor,3);await rotate('facility',17,`${width}-facility-turned`);await rotate('facility',17,`${width}-facility-returned`);await rotate('facility',17,`${width}-facility-persisted-facing`);await closeFacility();
 await touch(page.locator('[data-nav="farm"]'));await settled();const id=Number(await page.locator('[data-layout-rotate="plot"]').getAttribute('data-layout-id'));assert.ok(Number.isInteger(id));await rotate('plot',id,`${width}-plot-turned`);await rotate('plot',id,`${width}-plot-returned`);await rotate('plot',id,`${width}-plot-persisted-facing`);
 const before=await saved();await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('#world')?.dataset.freeMovement&&!document.querySelector('[data-startup-patch]'),null,{timeout:15000});await pauseAndSave();const after=await saved(),noClock=s=>{const c=stable(s);for(const k of['day','minutes','totalMinutes'])delete c[k];return c;};assert.deepEqual(noClock(after),noClock(before),'reload retains all directions and every non-clock progress field');receipt.fixtures.at(-1).reload={before,after};
}
async function upperJourney(width){
 await touch(page.locator('[data-nav="home"]'));await floorView(3,`${width}-upper-work-view`);await settled();const f=await frame(),poly=f.movement.world.floors.find(p=>p.id===3).deckPolygon,candidates=[];
 for(let y=Math.min(...poly.map(p=>p.y));y<=Math.max(...poly.map(p=>p.y));y+=12)for(let x=Math.min(...poly.map(p=>p.x));x<=Math.max(...poly.map(p=>p.x));x+=12){const p={x,y};if(!inside(p,poly)||edgeDistance(p,poly)<12)continue;if(f.movement.world.obstacles.some(o=>o.surface==='deck'&&o.floor===3&&(inside(p,o.polygon)||edgeDistance(p,o.polygon)<12)))continue;if(f.hits.some(h=>h.kind!=='truck'&&(h.bounds?x>=h.bounds[0]-7&&x<=h.bounds[2]+7&&y>=h.bounds[1]-7&&y<=h.bounds[3]+7:distance(p,h)<Math.max(h.radius,22/f.geometry.scale)+12)))continue;const client={x:f.rect.left+f.geometry.dx+x*f.geometry.scale,y:f.rect.top+f.geometry.dy+y*f.geometry.scale};candidates.push({world:p,client,rank:distance(p,f.movement.world.links.find(l=>l.id==='2-3').points.at(-1))});}
 candidates.sort((a,b)=>a.rank-b.rank);let target;for(const c of candidates)if(await page.evaluate(p=>[-21.5,0,21.5].every(dx=>[-21.5,0,21.5].every(dy=>document.elementFromPoint(p.x+dx,p.y+dy)?.id==='world')),c.client)){target=c;break;}assert.ok(target,'selected upper floor has a genuine 44px unobscured work surface');
 await page.locator('#world').evaluate(canvas=>{window.__layoutJourney={frames:[],release:null};canvas.addEventListener('pointerup',event=>{window.__layoutJourney.release={isTrusted:event.isTrusted,client:{x:event.clientX,y:event.clientY},at:performance.now()};},{once:true,capture:true});window.__layoutObserver=new MutationObserver(()=>{const m=JSON.parse(canvas.dataset.freeMovement);if(window.__layoutJourney.frames.at(-1)?.frameAt!==m.frameAt)window.__layoutJourney.frames.push(m);});window.__layoutObserver.observe(canvas,{attributes:true,attributeFilter:['data-free-movement']});});
 const before=await saved(),started=performance.now();await page.touchscreen.tap(target.client.x,target.client.y);await page.waitForFunction(()=>JSON.parse(document.querySelector('#world').dataset.freeMovement).moving,null,{timeout:1200});const accepted=await frame();assert.equal(accepted.movement.target.floor,3);await page.waitForFunction(()=>!JSON.parse(document.querySelector('#world').dataset.freeMovement).moving,null,{timeout:22000});
 const after=await saved(),end=await frame(),proof=await page.evaluate(()=>{window.__layoutObserver.disconnect();return window.__layoutJourney;});assert.ok(proof.release?.isTrusted);assert.equal(end.movement.floor,3);assert.equal(end.movement.surface,'deck');assert.ok(distance(end.movement.position,accepted.movement.target)<2);assert.deepEqual(stable(after),stable(before),'actual upper-floor work travel changes no saved progress');assert.deepEqual([...new Set(proof.frames.map(m=>m.link).filter(Boolean))].sort(),['1-2','2-3']);assert.ok(proof.frames.some(m=>m.surface==='ladder'),'actual natural stair frames are rendered');bodiesSafe(end);receipt.journeys.push({width,target,accepted,end,before,after,proof,durationMs:performance.now()-started,completionBudgetMs:22000});await shot(`${width}-upper-arrived`);
}
try{
 await mkdir('artifacts',{recursive:true});if(finalSnapshot){const manifest=JSON.parse(await readFile(executionInputs.snapshotManifestPath,'utf8'));assert.equal(manifest.snapshotId,snapshotId);assert.equal(manifest.version,version);for(const[path,hash]of Object.entries(manifest.files)){const url=new URL(path,new URL('/',baseUrl)),response=await fetch(url);assert.equal(response.status,200);const bytes=Buffer.from(await response.arrayBuffer());assert.equal(sha(bytes),hash);receipt.httpIdentity.push({path,url:String(url),bytes:bytes.length,sha256:hash});}}
 const input=await fixture();browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 for(const[width,height]of[[390,844],[844,390]]){await begin(width,height,input);for(const floor of[1,2,3])await floorView(floor,`${width}-floor-${floor}`);await rotationFlow(width);if(width===390)await upperJourney(width);await context.close();context=null;console.log(`PASS ${width}x${height}: real direction controls, full-save accounting, reload and selected-floor painting.`);}
 assert.equal(receipt.floorViews.length,7);assert.equal(receipt.rotations.length,18);assert.equal(receipt.journeys.length,1);assert.deepEqual(receipt.errors,[]);assert.deepEqual(receipt.failedAssets,[]);receipt.status='passed';
}catch(error){receipt.status='failed';receipt.failure={case:currentCase,message:String(error),stack:error.stack};process.exitCode=1;if(page){try{receipt.failure.frame=await frame();receipt.failure.save=await saved();await shot('failure');}catch(e){receipt.failure.captureError=String(e);}}}
finally{if(browser)await browser.close();receipt.finishedAt=new Date().toISOString();receipt.assertionsExecuted=assertionsExecuted;const path=`artifacts/layout-directions-v${version}${diagnosticOnly?'-diagnostic':''}-verification.json`;await writeFile(path,JSON.stringify(receipt,null,2));console.log(JSON.stringify({status:receipt.status,assertionsExecuted,receipt:path,error:receipt.failure?.message}));}
