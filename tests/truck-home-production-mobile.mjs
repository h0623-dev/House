import { chromium } from '@playwright/test';
import strictAssert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { captureExecutionInputs } from './release-execution-inputs.mjs';

// Declared older save, actual domain loader, genuine native touch and natural RAF.
// This is Chromium emulation; it claims neither physical-phone tests nor earned late-game materials.
const version=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8')).version;
const baseUrl=process.env.TEST_BASE_URL??'http://127.0.0.1:5173/';
const snapshotId=process.env.TEST_SNAPSHOT_ID??'mutable-development-diagnostic';
const finalSnapshot=process.env.TEST_FINAL_SNAPSHOT==='1',diagnosticOnly=process.env.TEST_TRUCK_HOME_DIAGNOSTIC==='1';
if(finalSnapshot===diagnosticOnly)throw Error('Choose exactly one immutable final snapshot or explicitly mutable diagnostic.');
const executionInputs=await captureExecutionInputs(import.meta.url,{snapshotId,finalSnapshot});
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
let assertionsExecuted=0;
const assert=new Proxy(strictAssert,{get(target,key){const fn=Reflect.get(target,key);return typeof fn==='function'?(...args)=>{assertionsExecuted++;return fn(...args);}:fn;}});
const receipt={version,snapshotId,finalSnapshot,diagnosticOnly,baseUrl,executionInputs,status:'running',startedAt:new Date().toISOString(),
 scope:'Chromium mobile emulation, real native touchscreen input and natural RAF; no physical phone, APK installation or earned late-game progress claim.',
 fixtures:[],homeRemovals:[],productionMarkers:[],adviceIcons:[],transactions:[],inputs:[],screenshots:[],errors:[],failedAssets:[],httpIdentity:[]};
let browser,context,page,currentCase='preflight';
const stable=s=>{const c=structuredClone(s);delete c.lastSaved;return c;};
const nonClock=s=>{const c=stable(s);for(const k of['day','minutes','totalMinutes'])delete c[k];return c;};
const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('road-haven-save-v1')));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function domain(operation,input,id){
 const script=`import {saveGame,loadGame,tick} from './src/game.ts';import {startProduction,collectProduction,getSettlement,BUILDINGS} from './src/settlement.ts';import {getHomeLocation,HOME_POSITIONS,projectTruckPoint} from './src/truck-layout.ts';const s=JSON.parse(process.argv[1]),operation=process.argv[2],id=Number(process.argv[3]);let raw;const store={getItem:()=>raw??null,setItem:(k,v)=>raw=v};if(operation==='validate'){const accepted=saveGame(s,store),loaded=loadGame(store),h=getHomeLocation(s),p=projectTruckPoint(HOME_POSITIONS[h.slot],h.floor);console.log(JSON.stringify({accepted,loaded,buildings:getSettlement(s).buildings,definitions:BUILDINGS,formerHome:{x:p[0],y:p[1],floor:h.floor}}));}else if(operation==='tick')console.log(JSON.stringify(tick(s,id)));else console.log(JSON.stringify((operation==='start'?startProduction:collectProduction)(s,id)));`;
 const result=spawnSync(process.execPath,['--import','tsx','--input-type=module','-e',script,JSON.stringify(input),operation,String(id??0)],{encoding:'utf8'});
 assert.equal(result.status,0,'actual TypeScript domain executes');return JSON.parse(result.stdout);
}
async function fixture(){
 const paidPath='artifacts/truck-floors-v0.21.0-paid-save.json',paidBytes=await readFile(paidPath),paid=JSON.parse(paidBytes);
 assert.equal(sha(paidBytes),'6d215de7d0c98fe03a837fc96db38343790b158a8250a965a0fb4a690225bbc3');assert.equal(paid.sha256OfSave,sha(JSON.stringify(paid.save)));
 const path='artifacts/layout-directions-v0.24.0-verification.json',bytes=await readFile(path),previous=JSON.parse(bytes);
 assert.equal(sha(bytes),'44d1a8c1df77f34299556666c1333c51bdb6efb5f4177704a60a16a0d949613a');assert.equal(previous.status,'passed');assert.equal(previous.finalSnapshot,true);
 const input=previous.fixtures.find(f=>f.viewport.width===390).reload.after,checked=domain('validate',input);
 assert.equal(checked.accepted,true);assert.deepEqual(stable(checked.loaded),stable(input),'actual save loader preserves the entire released old-home/direction save');
 assert.equal(input.layoutDirections.home,1);assert.deepEqual(input.truckLayout.home,{floor:3,slot:1});assert.deepEqual(nonClock({...input,layoutDirections:undefined}),nonClock({...paid.save,layoutDirections:undefined}),'released browser progress differs only by documented clock and chosen directions');
 return{path,sha256:sha(bytes),paidPath,paidSha256:sha(paidBytes),save:checked.loaded,definitions:checked.definitions,buildings:checked.buildings,formerHome:checked.formerHome,earned:false,
  declaration:'An actual v0.24 final browser save descended from the explicitly unearned v0.21 paid-floor fixture. It includes user-input directions and paid buildings, not newly fabricated progress.'};
}
async function frame(){return page.locator('#world').evaluate(canvas=>{const d=canvas.dataset,r=canvas.getBoundingClientRect();return{at:performance.now(),movement:JSON.parse(d.freeMovement),geometry:JSON.parse(d.sceneGeometry),hits:JSON.parse(d.sceneHits),pets:JSON.parse(d.petMotion),rect:{left:r.left,top:r.top,width:r.width,height:r.height}};});}
async function touch(locator){
 await locator.scrollIntoViewIfNeeded();const box=await locator.boundingBox();assert.ok(box&&box.width>=44&&box.height>=44,'a visible complete 44px native control');
 const client={x:box.x+box.width/2,y:box.y+box.height/2};assert.equal(await locator.evaluate((button,p)=>document.elementFromPoint(p.x,p.y)?.closest('button')===button,client),true,'actual finger reaches intended control');
 receipt.inputs.push({case:currentCase,kind:'native-touchscreen-tap',client,bounds:box,label:await locator.getAttribute('aria-label')??await locator.innerText()});await page.touchscreen.tap(client.x,client.y);
}
async function closeModal(){if(await page.locator('#modal-root').isVisible())await touch(page.locator('#modal-root [data-close]').first());}
async function closeFacility(){if(await page.locator('#facility-sheet').isVisible())await touch(page.locator('[data-facility-close]'));}
async function setPaused(paused){
 await closeModal();await closeFacility();await touch(page.locator('[data-open="menu"]'));await touch(page.locator('#modal-root [data-open="settings"]'));
 if((await page.locator('.time-button').getAttribute('aria-label')==='시간 계속')!==paused)await touch(page.locator('#modal-root [data-pause]'));
 await touch(page.locator('#modal-root [data-save]'));await closeModal();assert.equal(await page.locator('.time-button').getAttribute('aria-label'),paused?'시간 계속':'시간 일시정지');
}
const pauseAndSave=()=>setPaused(true);
async function settled(){
 await page.evaluate(()=>{window.__truckCamera=[];window.__truckStable=0;});await page.waitForFunction(()=>{const d=document.querySelector('#world')?.dataset;if(!d?.sceneGeometry||!d.freeMovement)return false;window.__truckCamera??=[];window.__truckStable??=0;const g=JSON.parse(d.sceneGeometry),m=JSON.parse(d.freeMovement),last=window.__truckCamera.at(-1);if(last?.at===m.frameAt)return false;const now={at:m.frameAt,dx:g.dx,dy:g.dy,scale:g.scale};window.__truckCamera.push(now);window.__truckStable=last&&Math.abs(now.dx-last.dx)<.25&&Math.abs(now.dy-last.dy)<.25&&Math.abs(now.scale-last.scale)<.0005?window.__truckStable+1:0;return window.__truckStable>=3;},null,{timeout:5000});
}
async function shot(label){const path=`artifacts/v${version}-truck-home-${diagnosticOnly?'diagnostic-':''}${label}.png`;await page.screenshot({path,fullPage:true});const bytes=await readFile(path);receipt.screenshots.push({path,sha256:sha(bytes),bytes:bytes.length});}
async function begin(width,height,input){
 currentCase=`${width}x${height}`;context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,deviceScaleFactor:2,reducedMotion:'reduce'});
 await context.addInitScript(save=>{if(sessionStorage.getItem('truck-home-fixture-installed'))return;save.lastSaved=Date.now();localStorage.setItem('road-haven-save-v1',JSON.stringify(save));sessionStorage.setItem('truck-home-fixture-installed','true');},input.save);
 page=await context.newPage();page.on('pageerror',error=>receipt.errors.push({case:currentCase,message:error.message}));page.on('response',r=>{if(r.status()>=400&&['script','stylesheet','image','font'].includes(r.request().resourceType()))receipt.failedAssets.push({status:r.status(),url:r.url()});});
 await page.goto(baseUrl,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('#world')?.dataset.freeMovement&&!document.querySelector('[data-startup-patch]')&&!document.querySelector('#app')?.inert,null,{timeout:15000});await pauseAndSave();await settled();
 const loaded=await saved();assert.deepEqual(nonClock(loaded),nonClock(input.save),'startup preserves every non-clock field including HP/XP, crops, pending timestamps and old-home metadata');receipt.fixtures.push({viewport:{width,height},...input,loaded});
}
async function homeView(floor,width){
 await closeModal();await closeFacility();const before=await saved();await touch(page.locator(`[data-truck-floor="${floor}"]`));await settled();const f=await frame();
 assert.equal(f.geometry.activeFloor,floor);assert.deepEqual(f.geometry.visibleFloors,[floor]);assert.equal(f.geometry.layoutDirections.home,null,'former cottage has no visible direction record');
 assert.equal(f.geometry.layoutPaintGeometry.some(p=>p.kind==='home'),false,'actual painter never draws the separate cottage');assert.equal(f.hits.some(h=>h.kind==='house'||h.kind==='home-slot'),false,'removed house has no invisible hit target');
 assert.equal(f.movement.world.obstacles.some(o=>o.kind==='home'||o.kind==='house'||o.id==='home'||o.id==='house'),false,'removed cottage never blocks physical navigation');
 assert.equal(await page.locator('[data-home-move],[data-home-move-confirm],[data-layout-rotate="home"]').count(),0,'obsolete house action controls are absent');assert.deepEqual(stable(await saved()),stable(before),'floor viewing preserves entire save');
 receipt.homeRemovals.push({case:currentCase,floor,frame:f,kind:'selected-floor-no-cottage'});await shot(`${width}-floor-${floor}`);return f;
}
async function truckLivingMenu(){
 const before=await saved();await touch(page.locator('[data-nav="build"]'));await touch(page.locator('#modal-root [data-open="truck-home"]'));
 assert.equal(await page.locator('#modal-root').getByText('우리 트럭이 곧 우리집이에요',{exact:true}).isVisible(),true);
 assert.equal(await page.locator('[data-home-move],[data-home-move-confirm],[data-layout-rotate="home"]').count(),0,'truck living offers no obsolete cottage editing');
 for(const selector of['[data-action="rest"]','[data-open="expand"]','[data-open="floors"]']){const button=page.locator(`#modal-root ${selector}`),box=await button.boundingBox();assert.ok(box&&box.width>=44&&box.height>=44,'truck living retains complete 44px rest/expansion/floor controls');}
 await closeModal();assert.deepEqual(stable(await saved()),stable(before),'opening truck living changes no progress');
}
function marker(f,input,id,expectedState){
 const building=input.buildings.find(b=>b.id===id),definition=input.definitions[building.type],p=f.geometry.productionItems.find(p=>p.id===id);assert.ok(p,'actual production draw call exists');
 assert.equal(p.resource,definition.yieldResource,'produced item matches actual facility definition');assert.equal(p.amount,definition.yieldAmount*building.level,'batch quantity reflects actual level');assert.equal(p.state,expectedState);
 assert.equal(p.itemArt.asset,'items-anime');assert.equal(p.itemArt.cell,{wood:0,scrap:1,food:2,water:3}[definition.yieldResource],'correct atlas resource cell, never a generic play or bag');assert.equal(p.itemArt.decoded,true);assert.equal(p.itemArt.drawn,true,'real drawImage produced the visible resource');
 assert.equal(p.floor,f.geometry.activeFloor);assert.ok(p.bounds[2]>p.bounds[0]&&p.bounds[3]>p.bounds[1]);assert.ok(p.screenBounds.every(Number.isFinite),'actual unrounded draw coordinates are available');assert.ok(p.screenBounds[2]-p.screenBounds[0]>=44-1e-6,'actual painted item width is at least 44px');assert.ok(p.screenBounds[3]-p.screenBounds[1]>=44-1e-6,'actual painted item height is at least 44px');
 for(let i=0;i<f.geometry.productionItems.length;i++)for(let j=i+1;j<f.geometry.productionItems.length;j++){const a=f.geometry.productionItems[i].screenBounds,b=f.geometry.productionItems[j].screenBounds;assert.ok(a[2]<=b[0]+1e-6||b[2]<=a[0]+1e-6||a[3]<=b[1]+1e-6||b[3]<=a[1]+1e-6,'actual visible resource badges never cover each other');}
 if(expectedState==='running'){assert.equal(p.hit,'facility','running product opens its own facility instead of the building behind it');assert.ok(p.progress>=0&&p.progress<1);assert.ok(p.remainingSeconds>0);}else assert.equal(p.hit,expectedState==='idle'?'facility-start':'facility-collect');
 receipt.productionMarkers.push({case:currentCase,id,expectedState,paint:p,geometry:{scale:f.geometry.scale,dx:f.geometry.dx,dy:f.geometry.dy},actualBatch:building});return p;
}
async function selectFacility(id){await closeModal();await closeFacility();await touch(page.locator('[data-open="village"]'));await touch(page.locator(`#modal-root [data-facility-select="${id}"]`).first());await settled();await closeFacility();await settled();}
async function mapTouch(id,state,input){
 const f=await frame(),p=marker(f,input,id,state),client={x:f.rect.left+(p.screenBounds[0]+p.screenBounds[2])/2,y:f.rect.top+(p.screenBounds[1]+p.screenBounds[3])/2};
 assert.equal(await page.evaluate(p=>[-21.5,0,21.5].every(dx=>[-21.5,0,21.5].every(dy=>document.elementFromPoint(p.x+dx,p.y+dy)?.id==='world')),client),true,'entire 44px production marker is accessible on the real map');
 await page.locator('#world').evaluate(canvas=>{window.__truckProductionRelease=null;canvas.addEventListener('pointerup',e=>{window.__truckProductionRelease={isTrusted:e.isTrusted,x:e.clientX,y:e.clientY,at:performance.now()};},{once:true,capture:true});});
 receipt.inputs.push({case:currentCase,kind:'native-map-item-tap',id,state,client,paint:p});await page.touchscreen.tap(client.x,client.y);const release=await page.evaluate(()=>window.__truckProductionRelease);assert.equal(release?.isTrusted,true,'trusted touchscreen release reaches canvas');return release;
}
async function transaction(kind,id,input){
 const before=await saved(),expected=domain(kind,before,id);assert.equal(expected.ok,true);const release=await mapTouch(id,kind==='start'?'idle':'ready',input);
 await page.waitForFunction(({id,kind})=>{const s=JSON.parse(localStorage.getItem('road-haven-save-v1')),b=[...s.settlement.buildings,...s.truckLayout.upperBuildings].find(b=>b.id===id);return kind==='start'?b.startedAt!==null:b.startedAt===null;},{id,kind},{timeout:1500});
 const after=await saved();assert.deepEqual(stable(after),stable(expected.state),'native map input commits exactly one actual production-domain transition');
 const definition=input.definitions[input.buildings.find(b=>b.id===id).type];if(kind==='collect')assert.equal(after.resources[definition.yieldResource]-before.resources[definition.yieldResource],definition.yieldAmount*input.buildings.find(b=>b.id===id).level,'exactly one batch, no hidden repeat');
 receipt.transactions.push({case:currentCase,kind,id,before,after,expected:expected.state,release});await settled();return after;
}
async function adviceIcons(input){
 const icons=await page.locator('#village-hub [data-village-advice-identity]').evaluateAll(nodes=>nodes.map(n=>({identity:n.dataset.villageAdviceIdentity,icon:n.querySelector('[data-village-advice-icon]')?.dataset.villageAdviceIcon,viewBox:n.querySelector('[data-village-advice-icon] svg')?.getAttribute('viewBox'),asset:n.querySelector('[data-village-advice-icon] image')?.getAttribute('href')})).filter(n=>/^(collect|start|working)-\d+$/.test(n.identity)));
 assert.ok(icons.length>0,'live dock offers actual production activities');for(const entry of icons){const id=Number(entry.identity.split('-').at(-1)),b=input.buildings.find(b=>b.id===id),resource=input.definitions[b.type].yieldResource;assert.equal(entry.icon,resource,'production quick action shows its real output resource');const cell={wood:0,scrap:1,food:2,water:3}[resource];assert.deepEqual(entry.viewBox.split(' ').map(Number),[cell*313.5,0,313.5,313.5],'actual DOM SVG crops the produced item rather than a facility tool');assert.ok(entry.asset.includes('items-anime'));}receipt.adviceIcons.push({case:currentCase,icons});
}
async function productionFlow(width,input){
 await selectFacility(17);marker(await frame(),input,17,'running');marker(await frame(),input,18,'idle');await adviceIcons(input);await shot(`${width}-water-running-food-idle`);
 const beforeInspection=await saved(),inspection=await mapTouch(17,'running',input);assert.equal(await page.locator('#facility-sheet').isVisible(),true);assert.equal(await page.locator('#facility-sheet').getAttribute('data-facility'),'17','native running product touch selects the actual producing facility');assert.deepEqual(stable(await saved()),stable(beforeInspection),'inspecting running product changes no resources or timestamps');receipt.productionMarkers.at(-1).inspection={before:beforeInspection,after:await saved(),release:inspection};await closeFacility();await settled();
 await transaction('start',18,input);const started=await saved();marker(await frame(),input,18,'running');await shot(`${width}-food-running`);
 // Real one-second game ticks and actual RAF, with no artificial clock or readiness mutation.
 await setPaused(false);const timeStarted=Date.now();
 await page.waitForFunction(()=>JSON.parse(document.querySelector('#world').dataset.sceneGeometry).productionItems.find(p=>p.id===18)?.state==='ready',null,{timeout:24000});await pauseAndSave();await selectFacility(18);
 const ready=await saved(),elapsedTicks=(ready.totalMinutes-started.totalMinutes)/4;assert.equal(Number.isInteger(elapsedTicks),true,'actual clock advances in existing 2× whole-second ticks');assert.ok(elapsedTicks>0);assert.deepEqual(stable(ready),stable(domain('tick',started,elapsedTicks)),'natural waiting changes only actual game tick results');
 marker(await frame(),input,18,'ready');await adviceIcons(input);await shot(`${width}-food-ready`);await transaction('collect',18,input);marker(await frame(),input,18,'idle');
 await selectFacility(1);marker(await frame(),input,1,'ready');await shot(`${width}-water-ready`);await transaction('collect',1,input);marker(await frame(),input,1,'idle');
 receipt.transactions.at(-1).naturalProductionWaitMs=Date.now()-timeStarted;
 const before=await saved();await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('#world')?.dataset.freeMovement&&!document.querySelector('[data-startup-patch]'),null,{timeout:15000});await pauseAndSave();assert.deepEqual(nonClock(await saved()),nonClock(before),'reload preserves exact production transactions and legacy house/directions');
 receipt.fixtures.at(-1).reload={before,after:await saved()};
}
async function formerHomeJourney(input){
 await touch(page.locator('[data-nav="home"]'));await touch(page.locator('[data-truck-floor="3"]'));await settled();const f=await frame(),p=input.formerHome,client={x:f.rect.left+f.geometry.dx+p.x*f.geometry.scale,y:f.rect.top+f.geometry.dy+p.y*f.geometry.scale};
 assert.equal(await page.evaluate(p=>document.elementFromPoint(p.x,p.y)?.id==='world',client),true,'former cottage center is an unobscured real map point');const before=await saved();
 await page.locator('#world').evaluate(canvas=>{window.__truckJourney={frames:[],release:null};canvas.addEventListener('pointerup',e=>{window.__truckJourney.release={isTrusted:e.isTrusted,at:performance.now()};},{once:true,capture:true});window.__truckObserver=new MutationObserver(()=>{const m=JSON.parse(canvas.dataset.freeMovement);if(window.__truckJourney.frames.at(-1)?.frameAt!==m.frameAt)window.__truckJourney.frames.push(m);});window.__truckObserver.observe(canvas,{attributes:true,attributeFilter:['data-free-movement']});});
 const start=Date.now();await page.touchscreen.tap(client.x,client.y);await page.waitForFunction(()=>JSON.parse(document.querySelector('#world').dataset.freeMovement).moving,null,{timeout:1200});const accepted=await frame();assert.equal(accepted.movement.target.floor,3);assert.ok(distance(accepted.movement.target,p)<2,'former cottage point is accepted directly rather than routed around an invisible house');
 await page.waitForFunction(()=>!JSON.parse(document.querySelector('#world').dataset.freeMovement).moving,null,{timeout:22000});const end=await frame(),proof=await page.evaluate(()=>{window.__truckObserver.disconnect();return window.__truckJourney;});
 assert.equal(proof.release?.isTrusted,true);assert.equal(end.movement.floor,3);assert.equal(end.movement.surface,'deck');assert.ok(distance(end.movement.position,p)<2,'hero actually enters the freed cottage footprint');assert.deepEqual(stable(await saved()),stable(before),'real navigation changes no saved progress');assert.deepEqual([...new Set(proof.frames.map(m=>m.link).filter(Boolean))].sort(),['1-2','2-3']);
 receipt.homeRemovals.push({kind:'actual-former-home-walk',case:currentCase,target:p,accepted,end,proof,durationMs:Date.now()-start});await shot('390-former-house-free');
}
try{
 await mkdir('artifacts',{recursive:true});if(finalSnapshot){const manifest=JSON.parse(await readFile(executionInputs.snapshotManifestPath,'utf8'));assert.equal(manifest.snapshotId,snapshotId);assert.equal(manifest.version,version);for(const[path,hash]of Object.entries(manifest.files)){const url=new URL(path,new URL('/',baseUrl)),response=await fetch(url);assert.equal(response.status,200);const bytes=Buffer.from(await response.arrayBuffer());assert.equal(sha(bytes),hash);receipt.httpIdentity.push({path,url:String(url),bytes:bytes.length,sha256:hash});}}
 const input=await fixture();browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 for(const[width,height]of[[360,800],[390,844],[844,390]]){await begin(width,height,input);for(const floor of[1,2,3])await homeView(floor,width);await truckLivingMenu();await productionFlow(width,input);if(width===390)await formerHomeJourney(input);await context.close();context=null;console.log(`PASS ${width}x${height}: removed cottage, actual yield art, trusted native production and whole-save accounting.`);}
 assert.equal(receipt.homeRemovals.filter(r=>r.kind==='selected-floor-no-cottage').length,9);assert.equal(receipt.homeRemovals.filter(r=>r.kind==='actual-former-home-walk').length,1);assert.equal(receipt.transactions.length,9);assert.ok(receipt.productionMarkers.some(p=>p.expectedState==='running'&&p.paint.resource==='food'));assert.ok(receipt.productionMarkers.some(p=>p.expectedState==='ready'&&p.paint.resource==='water'));assert.deepEqual(receipt.errors,[]);assert.deepEqual(receipt.failedAssets,[]);receipt.status='passed';
}catch(error){receipt.status='failed';receipt.failure={case:currentCase,message:String(error),stack:error.stack};process.exitCode=1;if(page){try{receipt.failure.frame=await frame();receipt.failure.save=await saved();await shot('failure');}catch(e){receipt.failure.captureError=String(e);}}}
finally{if(browser)await browser.close();receipt.finishedAt=new Date().toISOString();receipt.assertionsExecuted=assertionsExecuted;const path=`artifacts/truck-home-production-v${version}${diagnosticOnly?'-diagnostic':''}-verification.json`;await writeFile(path,JSON.stringify(receipt,null,2));console.log(JSON.stringify({status:receipt.status,assertionsExecuted,receipt:path,error:receipt.failure?.message}));}
