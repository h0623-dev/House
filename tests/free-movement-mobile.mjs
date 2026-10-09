import { chromium } from '@playwright/test';
import strictAssert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { captureExecutionInputs } from './release-execution-inputs.mjs';

// Actual visible mobile touches and read-only rendered frame telemetry. No game
// methods, advanced saves, synthetic pointer events or accelerated clocks.
const version = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')).version;
if (Number(version.split('.')[1]) < 20) throw Error('Free movement requires the v0.20 implementation; earlier release artifacts remain untouched.');
const baseUrl = process.env.TEST_BASE_URL || 'http://127.0.0.1:5173/';
const snapshotId = process.env.TEST_SNAPSHOT_ID || 'mutable-development-diagnostic';
const finalSnapshot = process.env.TEST_FINAL_SNAPSHOT === '1';
const executionInputs = await captureExecutionInputs(import.meta.url, { snapshotId, finalSnapshot });
const diagnosticOnly = process.env.TEST_FREE_MOVEMENT_DIAGNOSTIC === '1';
const landscapeDiagnostic = process.env.TEST_FREE_MOVEMENT_LANDSCAPE_DIAGNOSTIC === '1';
if(landscapeDiagnostic&&!diagnosticOnly)throw Error('An isolated landscape run must be explicitly diagnostic.');
const diagnosticPrefix=landscapeDiagnostic?'landscape-diagnostic-':diagnosticOnly?'diagnostic-':'';
const receiptSuffix=landscapeDiagnostic?'-landscape-diagnostic':diagnosticOnly?'-diagnostic':'';
if (diagnosticOnly && finalSnapshot) throw Error('A partial diagnostic cannot be recorded as a final snapshot test.');
const startedAt = new Date();
let assertionsExecuted = 0;
const assert = new Proxy(strictAssert, { get(target, key) { const value = Reflect.get(target, key); return typeof value === 'function' ? (...args) => { assertionsExecuted++; return value(...args); } : value; } });
const walks = [], gestures = [], choreStarts = [], obstacleProof = [], companionMotion = [], modalStops = [], screenshots = [], cases = [], errors = [], failedAssets = [], constructionReadiness = [], constructionPreparations = [], cameraPreparations = [];
let browser, context, page, failureEvidence;
await mkdir('artifacts', { recursive: true });
const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('road-haven-save-v1')));
const movement = () => page.locator('#world').evaluate(canvas => JSON.parse(canvas.dataset.freeMovement));
const geometry = () => page.locator('#world').evaluate(canvas => JSON.parse(canvas.dataset.sceneGeometry));
const action = () => page.locator('#world').evaluate(canvas => JSON.parse(canvas.dataset.sceneAction));
const stableSave = state => { const result = structuredClone(state); delete result.lastSaved; return result; };
const xy = point => Array.isArray(point) ? { x: point[0], y: point[1] } : point;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function inside(point, polygon) {
 let result = false;
 for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
  const a = xy(polygon[i]), b = xy(polygon[j]);
  if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) result = !result;
 }
 return result;
}
async function touch(locator) {
 await locator.scrollIntoViewIfNeeded(); const box = await locator.boundingBox(); assert.ok(box, 'the intended control is rendered');
 const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
 assert.equal(await locator.evaluate((button, point) => document.elementFromPoint(point.x, point.y)?.closest('button') === button, point), true, 'a finger reaches the intended button');
 await page.touchscreen.tap(point.x, point.y);
 return {point,box};
}
async function tapWorld(point) {
 assert.equal(await page.evaluate(point => document.elementFromPoint(point.x, point.y)?.id === 'world', point), true, 'the destination is physically visible on the canvas');
 await page.locator('#world').evaluate(canvas=>{
  window.__lastGroundTouch=null;
  canvas.addEventListener('pointerup',event=>{
   const g=JSON.parse(canvas.dataset.sceneGeometry),r=canvas.getBoundingClientRect();
   window.__lastGroundTouch={at:performance.now(),eventAt:event.timeStamp,client:{x:event.clientX,y:event.clientY},rect:{left:r.left,top:r.top,width:r.width,height:r.height},geometry:g,
    world:{x:(event.clientX-r.left-g.dx)/g.scale,y:(event.clientY-r.top-g.dy)/g.scale}};
  },{capture:true,once:true});
 });
 await page.touchscreen.tap(point.x, point.y);
 return page.evaluate(()=>window.__lastGroundTouch);
}
async function closeModal() { if (await page.locator('#modal-root').isVisible()) await touch(page.locator('#modal-root [data-close]').first()); }
async function home() { await closeModal(); await touch(page.locator('[data-nav="home"]')); }
async function menu(kind) { await closeModal(); await touch(page.locator('[data-open="menu"]')); if (kind) await touch(page.locator(`#modal-root [data-open="${kind}"]`)); }
async function pauseWorld() {
 if (await page.locator('.time-button').getAttribute('aria-label') === '시간 계속') return;
 await menu('settings'); await touch(page.locator('#modal-root [data-pause]')); await touch(page.locator('#modal-root [data-save]')); await closeModal();
}
async function shot(label) { await page.waitForTimeout(80); const filename = `artifacts/v${version}-free-movement-${diagnosticPrefix}${label}.png`; await page.screenshot({ path: filename, fullPage: true }); screenshots.push(filename); return filename; }
async function screenPoint(world) { return page.locator('#world').evaluate((canvas, point) => { const r = canvas.getBoundingClientRect(), g = JSON.parse(canvas.dataset.sceneGeometry); return { x: r.left + g.dx + point.x * g.scale, y: r.top + g.dy + point.y * g.scale }; }, world); }
async function observe(label) {
 await page.evaluate(label => {
  const canvas = document.querySelector('#world'); window.__freeWalkFrames = [];
  const capture = () => window.__freeWalkFrames.push({ at: performance.now(), label, movement: JSON.parse(canvas.dataset.freeMovement), action: JSON.parse(canvas.dataset.sceneAction), companions: JSON.parse(canvas.dataset.petMotion || '[]') });
  capture(); window.__freeWalkObserver = new MutationObserver(capture); window.__freeWalkObserver.observe(canvas, { attributes: true, attributeFilter: ['data-free-movement','data-scene-action','data-pet-motion'] });
 }, label);
}
async function stopObserve() { return page.evaluate(() => { window.__freeWalkObserver.disconnect(); return window.__freeWalkFrames; }); }
async function cameraSettled() {
 await page.evaluate(()=>{window.__cameraSettling={samples:[],stable:0};});
 await page.waitForFunction(()=>{
  const canvas=document.querySelector('#world'),g=JSON.parse(canvas.dataset.sceneGeometry),m=JSON.parse(canvas.dataset.freeMovement),r=canvas.getBoundingClientRect(),proof=window.__cameraSettling;
  const sample={frameAt:m.frameAt,at:performance.now(),dx:g.dx,dy:g.dy,scale:g.scale,rect:{left:r.left,top:r.top,width:r.width,height:r.height}},prior=proof.samples.at(-1);
  if(prior?.frameAt===sample.frameAt)return false;
  proof.samples.push(sample);proof.stable=prior&&Math.abs(sample.dx-prior.dx)<.25&&Math.abs(sample.dy-prior.dy)<.25&&Math.abs(sample.scale-prior.scale)<.0005&&JSON.stringify(sample.rect)===JSON.stringify(prior.rect)?proof.stable+1:0;
  return proof.stable>=3;
 },null,{timeout:5000});
 return page.evaluate(()=>window.__cameraSettling);
}
async function chooseGround(surface, { minDistance = 85, near, far = true, crossObstacle = false, settle = true, boundaryClearance = 0, obstacleClearance = 0 } = {}) {
 // Choose visible, empty terrain from the rendered geometry; never call the
 // product planner to choose its own expected route or mutate its destination.
 const cameraSettling=settle?await cameraSettled():null;const candidates = await page.locator('#world').evaluate((canvas, { surface, minDistance, near, far, crossObstacle, boundaryClearance, obstacleClearance }) => {
  const m = JSON.parse(canvas.dataset.freeMovement), g = JSON.parse(canvas.dataset.sceneGeometry), r = canvas.getBoundingClientRect();
  const points = [], hits = JSON.parse(canvas.dataset.sceneHits || '[]');
  const bodyRadius=m.body.radius,boundaryPadding=Math.max(boundaryClearance,bodyRadius+2),obstaclePadding=Math.max(obstacleClearance,bodyRadius+2);
  const companions=JSON.parse(canvas.dataset.petMotion||'[]');
  const get = p => Array.isArray(p) ? {x:p[0],y:p[1]} : p;
  const contains = (p, poly) => { let value=false; for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=get(poly[i]),b=get(poly[j]);if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)value=!value;}return value; };
  const edgeDistance=(p,poly)=>Math.min(...poly.map((vertex,i)=>{const a=get(vertex),b=get(poly[(i+1)%poly.length]),vx=b.x-a.x,vy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*vx+(p.y-a.y)*vy)/(vx*vx+vy*vy)));return Math.hypot(p.x-a.x-t*vx,p.y-a.y-t*vy);}));
  const deck = m.world.deckPolygon.map(get), bounds = surface === 'deck'
   ? {left:Math.min(...deck.map(p=>p.x)),right:Math.max(...deck.map(p=>p.x)),top:Math.min(...deck.map(p=>p.y)),bottom:Math.max(...deck.map(p=>p.y))}
   : m.world.roadBounds;
  for(let y=bounds.top+12;y<bounds.bottom-12;y+=10)for(let x=bounds.left+12;x<bounds.right-12;x+=10){
   const point={x,y};if(surface==='deck'&&!contains(point,deck))continue;if(surface==='road'&&contains(point,deck))continue;
   if(surface==='deck'?edgeDistance(point,deck)<boundaryPadding:Math.min(x-bounds.left,bounds.right-x,y-bounds.top,bounds.bottom-y)<boundaryPadding)continue;
   if(m.world.obstacles.some(o=>o.surface===surface&&contains(point,o.polygon)))continue;
   if(m.world.obstacles.some(o=>o.surface===surface&&edgeDistance(point,o.polygon)<obstaclePadding))continue;
   if(companions.some(p=>p.body.surface===surface&&p.body.floor===(m.activeFloor??1)&&Math.hypot(x-p.body.x,y-p.body.y)<bodyRadius+p.body.radius+14))continue;
   const screen={x:r.left+g.dx+x*g.scale,y:r.top+g.dy+y*g.scale};
   // Chromium may adjust a finger touch onto a nearby DOM button even when
   // its center barely hits the canvas. Require a clear44px canvas touch area.
   if(![-22,0,22].every(dx=>[-22,0,22].every(dy=>document.elementFromPoint(screen.x+dx,screen.y+dy)?.id==='world')))continue;
   if(hits.some(hit=>{
    if(hit.kind==='truck'&&surface==='deck')return false;
    if(hit.bounds)return x>=hit.bounds[0]-7&&x<=hit.bounds[2]+7&&y>=hit.bounds[1]-7&&y<=hit.bounds[3]+7;
    return Math.hypot(x-hit.x,y-hit.y)<Math.max(hit.radius,22/g.scale)+12;
   }))continue;
   if(Math.hypot(x-m.position.x,y-m.position.y)<minDistance)continue;
   let crossing=null;
   if(crossObstacle){
    const vx=x-m.position.x,vy=y-m.position.y,length2=vx*vx+vy*vy;
    for(const obstacle of m.world.obstacles.filter(o=>o.surface===surface)){
     const polygon=obstacle.polygon.map(get),centre={x:polygon.reduce((sum,p)=>sum+p.x,0)/polygon.length,y:polygon.reduce((sum,p)=>sum+p.y,0)/polygon.length};
     const clearance=Math.min(...polygon.map((a,i)=>{const b=polygon[(i+1)%polygon.length];return Math.abs((b.x-a.x)*(centre.y-a.y)-(b.y-a.y)*(centre.x-a.x))/Math.hypot(b.x-a.x,b.y-a.y);}));
     const fraction=Math.max(0,Math.min(1,((centre.x-m.position.x)*vx+(centre.y-m.position.y)*vy)/length2)),closest={x:m.position.x+fraction*vx,y:m.position.y+fraction*vy},lineDistance=Math.hypot(closest.x-centre.x,closest.y-centre.y);
     if(lineDistance<clearance*.1){crossing={polygon,centre,clearance,lineDistance};break;}
    }
    if(!crossing)continue;
   }
   const rank=near?Math.hypot(x-near.x,y-near.y):Math.hypot(x-m.position.x,y-m.position.y);
   points.push({world:point,screen,surface,rank,crossing});
  }
  points.sort((a,b)=>crossObstacle?a.crossing.lineDistance/a.crossing.clearance-b.crossing.lineDistance/b.crossing.clearance||b.rank-a.rank:near||!far?a.rank-b.rank:b.rank-a.rank);return points.slice(0,8);
 }, { surface, minDistance, near, far, crossObstacle, boundaryClearance, obstacleClearance });
 assert.ok(candidates.length, `${surface}: an empty walkable destination is visible`); return {...candidates[0],cameraSettling};
}
function assertContinuous(frames, label) {
 const active = frames.filter(f => f.movement.moving);
 const proof = [];
 assert.ok(active.length >= 3, `${label}: naturally spaced moving frames are rendered`);
 for (let i = 1; i < frames.length; i++) {
  const a = frames[i - 1], b = frames[i], prior = a.movement, current = b.movement;
  if (!a.movement.moving && !b.movement.moving) continue;
  // MutationObserver delivery follows variable canvas rendering work. The
  // scene's actual natural RAF timestamp and elapsed motion carry the movement
  // timebase; retain observer time separately so delivery jitter stays visible.
  const wallSeconds = (b.at - a.at) / 1000, frameSeconds = (current.frameAt - prior.frameAt) / 1000;
  assert.ok(Number.isFinite(frameSeconds) && frameSeconds >= 0, `${label}: natural scene frame timestamps remain monotonic`);
  const sameRoute = prior.moving && current.moving && JSON.stringify(prior.target) === JSON.stringify(current.target)
   && JSON.stringify(prior.route) === JSON.stringify(current.route);
  const seconds = sameRoute ? current.elapsed - prior.elapsed : !current.moving
   ? Math.min(frameSeconds, prior.total - prior.elapsed) : frameSeconds;
  assert.ok(seconds >= -1e-6, `${label}: motion elapsed never reverses within one route`);
  if (sameRoute) assert.ok(seconds <= frameSeconds + 1e-6, `${label}: route motion advances only by naturally elapsed scene time`);
  if (current.moving && !sameRoute) {
   assert.ok(current.route.length, `${label}: a new destination retains a physical route origin`);
   assert.ok(distance(xy(current.route[0]), prior.position) <= frameSeconds * 420 + 1.5, `${label}: retargeting starts from the preceding actual feet`);
  }
  const travelled = distance(prior.position, current.position), allowedDistance = Math.max(0, seconds) * 420 + 1.5;
  assert.ok(travelled <= allowedDistance, `${label}: retargeting and arrival never teleport the feet`);
  proof.push({ observerAt: b.at, sceneFrameAt: current.frameAt, wallSeconds, frameSeconds, motionSeconds: seconds, sameRoute,
   travelled, allowedDistance, from: prior.position, to: current.position, routeOrigin: current.route[0] ?? null });
 }
 for (const frame of active) {
  assert.ok(['walk','climb'].includes(frame.movement.pose), `${label}: moving feet have the walking or ladder pose`);
  if (frame.movement.surface !== 'ladder') for (const obstacle of frame.movement.world.obstacles.filter(o => o.surface === frame.movement.surface)) {
   assert.equal(inside(frame.movement.position, obstacle.polygon), false, `${label}: feet avoid the occupied footprint`);
  }
 }
 return proof;
}
async function walk(label, surface, options = {}) {
 const before = await movement(), saveBefore = await saved(), destination = await chooseGround(surface, options); await observe(label); const actualTouch=await tapWorld(destination.screen);
 await page.waitForFunction(() => JSON.parse(document.querySelector('#world').dataset.freeMovement).moving, null, { timeout: 1200 });
 const accepted = await movement(); assert.ok(actualTouch,`${label}: the actual native pointer release is observed`);assert.ok(distance(accepted.target, actualTouch.world) < 8, `${label}: tapping empty ground selects the ground under the released finger`);
 assert.equal(await page.locator('#app').getAttribute('aria-busy'), null, 'free walking is separate from a resource chore');
 await page.waitForFunction(() => !JSON.parse(document.querySelector('#world').dataset.freeMovement).moving, null, { timeout: 15000 });
 const frames = await stopObserve(), final = await movement(), saveAfter = await saved(), continuityProof = assertContinuous(frames, label);
 assert.ok(distance(final.position, accepted.target) < 2, `${label}: the hero reaches the accepted destination`); assert.equal(final.surface,surface);
 assert.deepEqual(stableSave(saveAfter),stableSave(saveBefore),`${label}: walking grants and spends no saved resources, energy or progress`);
 walks.push({label,destination,actualTouch,from:before,accepted,final,frames,continuityProof,saveBefore,saveAfter});if(options.crossObstacle){const routeLength=accepted.route.slice(1).reduce((total,p,i)=>total+distance(xy(p),xy(accepted.route[i])),0);assert.ok(routeLength>distance(before.position,accepted.target)+2,'an occupied footprint forces a real detour instead of a straight crossing');obstacleProof.push({label,from:before.position,target:accepted.target,route:accepted.route,routeLength,frames});}return {before,accepted,final,frames};
}
async function retarget(label) {
 const before=await movement(),saveBefore=await saved(),first=await chooseGround('deck');await observe(label);await tapWorld(first.screen);
 await page.waitForFunction(()=>{const m=JSON.parse(document.querySelector('#world').dataset.freeMovement);return m.moving&&m.elapsed>.08;},null,{timeout:1200});
 const during=await movement(),second=await chooseGround('deck',{minDistance:90,near:before.position}),actualTouch=await tapWorld(second.screen);
 await page.waitForFunction(point=>{const m=JSON.parse(document.querySelector('#world').dataset.freeMovement);return m.target&&Math.hypot(m.target.x-point.x,m.target.y-point.y)<8;},actualTouch.world,{timeout:1200});
 const accepted=await movement();await page.waitForFunction(()=>!JSON.parse(document.querySelector('#world').dataset.freeMovement).moving,null,{timeout:15000});
 const frames=await stopObserve(),final=await movement(),continuityProof=assertContinuous(frames,label);assert.ok(distance(final.position,accepted.target)<2);assert.ok(distance(during.position,before.position)>1,'the original walk genuinely began before retargeting');
 for(let i=1;i<frames.length;i++)assert.ok(frames[i].movement.gaitDistance>=frames[i-1].movement.gaitDistance-1e-6,'retargeting preserves the accumulated walking gait instead of resetting feet');
 assert.deepEqual(stableSave(await saved()),stableSave(saveBefore));walks.push({label,retarget:true,first,second,actualTouch,from:before,during,accepted,final,frames,continuityProof,saveBefore,saveAfter:await saved()});
}
async function ladderRetarget(label) {
 const from=await movement(),saveBefore=await saved(),road=await chooseGround('road');await observe(label);await tapWorld(road.screen);
 await page.waitForFunction(()=>{const m=JSON.parse(document.querySelector('#world').dataset.freeMovement);return m.moving&&m.climbing==='down';},null,{timeout:10000});
 const onLadder=await movement();assert.equal(onLadder.surface,'ladder');const deck=await chooseGround('deck',{near:from.position}),actualTouch=await tapWorld(deck.screen);
 await page.waitForFunction(()=>{const m=JSON.parse(document.querySelector('#world').dataset.freeMovement);return m.moving&&m.climbing==='up';},null,{timeout:1200});const accepted=await movement();
 await page.waitForFunction(()=>!JSON.parse(document.querySelector('#world').dataset.freeMovement).moving,null,{timeout:15000});const frames=await stopObserve(),final=await movement(),continuityProof=assertContinuous(frames,label);
 assert.ok(frames.some(f=>f.movement.climbing==='down')&&frames.some(f=>f.movement.climbing==='up'),'retargeting midway down the ladder reverses physical travel without snapping to an end');assert.ok(distance(final.position,accepted.target)<2);assert.equal(final.surface,'deck');assert.deepEqual(stableSave(await saved()),stableSave(saveBefore));
 assert.ok(distance(accepted.target,actualTouch.world)<8,'the ladder retarget follows the actual released finger');walks.push({label,retargetOnLadder:true,from,onLadder,road,deck,actualTouch,accepted,final,frames,continuityProof,saveBefore,saveAfter:await saved()});
}
async function gesture(label, pinch=false, cancel=false, {dx=25,dy=10}={}) {
 const before=await movement(),g=await geometry(),saveBefore=await saved(),origin=(await chooseGround('deck',{minDistance:20})).screen;
 const session=await context.newCDPSession(page);await observe(label);
 const a={...origin,id:1},b={x:origin.x+34,y:origin.y+5,id:2};
 await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[a]});
 if(pinch){await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[a,b]});for(let i=1;i<=5;i++){await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[a,{...b,x:b.x+i*4,y:b.y+i}]});await page.waitForTimeout(30);}}
 else for(let i=1;i<=5;i++){await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...a,x:a.x+dx*i/5,y:a.y+dy*i/5}]});await page.waitForTimeout(30);}
 await session.send('Input.dispatchTouchEvent',{type:cancel?'touchCancel':'touchEnd',touchPoints:[]});await session.detach();await page.waitForTimeout(150);
 const after=await movement(),afterGeometry=await geometry(),frames=await stopObserve();assert.equal(after.moving,false,`${label}: gestures never create a walk destination`);assert.ok(distance(before.position,after.position)<.1);assert.deepEqual(after.target,before.target);assert.deepEqual(stableSave(await saved()),stableSave(saveBefore));
 assert.ok(pinch?afterGeometry.mapZoom>g.mapZoom:Math.hypot(afterGeometry.dx-g.dx,afterGeometry.dy-g.dy)>8,`${label}: the intended camera gesture still works`);gestures.push({label,before,after,g,afterGeometry,frames});
}
async function cameraReset() {
 if(await page.locator('[data-camera-toggle]').getAttribute('aria-expanded')!=='true')await touch(page.locator('[data-camera-toggle]'));
 await touch(page.locator('[data-map-reset]'));await page.waitForTimeout(1000);await touch(page.locator('[data-camera-toggle]'));
}
async function revealLandscapeRoad() {
 // The landscape home camera fits the deck; the visible grove navigation
 // exposes road terrain without changing the hero's feet or saved progress.
 const before=await movement(),g=await geometry(),saveBefore=await saved(),actionBefore=await action(),inputs=[];
 for(const selector of ['[data-open="menu"]','#modal-root [data-open="grove"]','#modal-root [data-look-grove]'])inputs.push({selector,...await touch(page.locator(selector))});
 const cameraSettling=await cameraSettled(),after=await movement(),afterGeometry=await geometry(),saveAfter=await saved(),actionAfter=await action();
 assert.equal(after.moving,false,'landscape road exploration does not start walking');
 assert.ok(distance(before.position,after.position)<.1,'landscape road exploration keeps the actual feet');
 assert.deepEqual(after.target,before.target,'landscape road exploration keeps the walk destination');
 assert.equal(actionBefore.kind,null);assert.equal(actionAfter.kind,null,'looking at the grove does not perform resource work');
 assert.deepEqual(stableSave(saveAfter),stableSave(saveBefore),'landscape road exploration grants and spends no progress');
 assert.equal(afterGeometry.zone,'grove','the visible grove button reveals its road camera');
 cameraPreparations.push({label:'landscape-grove-view-to-visible-road',input:'Actual visible mobile menu, grove and look-around touches',inputs,before,after,g,afterGeometry,actionBefore,actionAfter,saveBefore,saveAfter,cameraSettling});
}
async function handModeTap(label) {
 const before=await movement(),saveBefore=await saved();await touch(page.locator('[data-camera-toggle]'));await touch(page.locator('[data-map-move]'));assert.equal(await page.locator('[data-map-move]').getAttribute('aria-pressed'),'true');
 await observe(label);const destination=await chooseGround('deck',{minDistance:20});await tapWorld(destination.screen);await page.waitForTimeout(150);
 const after=await movement(),frames=await stopObserve();assert.equal(after.moving,false,'a ground tap in explicit camera-move mode never starts the hero walking');assert.ok(distance(before.position,after.position)<.1);assert.deepEqual(after.target,before.target);assert.deepEqual(stableSave(await saved()),stableSave(saveBefore));
 gestures.push({label,kind:'hand-mode-ground-tap',before,after,destination,frames});await touch(page.locator('[data-map-move]'));assert.equal(await page.locator('[data-map-move]').getAttribute('aria-pressed'),'false');await touch(page.locator('[data-camera-toggle]'));
}
async function observeChore(label, trigger, kind) {
 const from=await movement(),saveBefore=await saved();await observe(label);await trigger();
 await page.waitForFunction(kind=>{const canvas=document.querySelector('#world'),rendered=JSON.parse(canvas.dataset.sceneAction);return document.querySelector('#app').getAttribute('aria-busy')==='true'&&rendered.kind===kind&&rendered.from!==null;},kind,{timeout:1500});const initial=await action();
 assert.ok(distance(xy(initial.from),from.position)<3,`${label}: the job begins at the manually chosen feet position`);assert.equal((await movement()).moving,false);
 // This touch must happen during the real job, rather than waiting for its
 // automatic camera focus to settle until after a short job has already ended.
 const ground=await movement(),blockedSurface=kind==='chop'?'road':'deck',road=ground.world.roadBounds;
 const near=blockedSurface==='road'?{x:(road.left+road.right)/2,y:(road.top+road.bottom)/2}:undefined;
 const ignored=await chooseGround(blockedSurface,{minDistance:20,far:false,near,settle:false,boundaryClearance:30,obstacleClearance:20}),busyBefore=await page.locator('#app').getAttribute('aria-busy');assert.equal(busyBefore,'true','the suppression tap occurs during real resource work');
 const actualTouch=await tapWorld(ignored.screen),busyAfter=await page.locator('#app').getAttribute('aria-busy');assert.equal(busyAfter,'true','the job is still active after the suppression tap');assert.equal((await movement()).moving,false,'ground taps cannot interrupt or duplicate resource work');
 const actualGround=await movement(),point=actualTouch.world;
 assert.equal(blockedSurface==='deck'?inside(point,actualGround.world.deckPolygon):point.x>=road.left&&point.x<=road.right&&point.y>=road.top&&point.y<=road.bottom,true,'the suppression tap actually lands on valid ground');
 for(const obstacle of actualGround.world.obstacles.filter(o=>o.surface===blockedSurface))assert.equal(inside(point,obstacle.polygon),false,'the suppression tap lands outside all occupied footprints');
 await page.waitForFunction(()=>!document.querySelector('#app').hasAttribute('aria-busy'),null,{timeout:20000});const frames=await stopObserve(),final=await movement(),saveAfter=await saved();
 assert.ok(frames.some(f=>f.action.kind===kind&&f.action.phase==='working'));assert.ok(initial.returnPoint,`${label}: the complete chore has a physical return point`);
 const returnPoint=xy(initial.returnPoint),occupiedOrigin=frames[0].movement.world.obstacles.some(o=>o.surface===initial.from.surface&&inside(from.position,o.polygon))
  ||frames.some(f=>f.movement.world.obstacles.some(o=>o.surface===initial.from.surface&&inside(from.position,o.polygon)));
 assert.ok(distance(final.position,returnPoint)<2,`${label}: the complete chore reaches its actual planned return point`);
 if(!occupiedOrigin)assert.ok(distance(returnPoint,from.position)<2,`${label}: a still-empty starting point remains the exact manual return position`);
 else for(const obstacle of final.world.obstacles.filter(o=>o.surface===final.surface))assert.equal(inside(final.position,obstacle.polygon),false,`${label}: a newly occupied origin returns to safe terrain`);
 choreStarts.push({label,kind,from,initial,final,occupiedOrigin,returnPoint,blockedTouch:{surface:blockedSurface,destination:ignored,actualTouch,busyBefore,busyAfter,actualGround},frames,saveBefore,saveAfter});return {saveBefore,saveAfter,frames};
}
async function actualHit(kind) {
 await cameraSettled();
 const point=await page.locator('#world').evaluate((canvas,kind)=>{const hit=JSON.parse(canvas.dataset.sceneHits).find(h=>h.kind===kind),g=JSON.parse(canvas.dataset.sceneGeometry),r=canvas.getBoundingClientRect();if(!hit)return null;return{x:r.left+g.dx+hit.x*g.scale,y:r.top+g.dy+hit.y*g.scale};},kind);
 assert.ok(point,`${kind}: the actual rendered interactive object exists`);await tapWorld(point);
}
async function waitConstructionClear(timeout=20000) {
 const selection=await page.locator('#construction-bar').getAttribute('data-preview'),parts=selection.split(':'),floor=Number(parts[1]),slot=Number(parts[2]);
 assert.ok(Number.isInteger(floor)&&Number.isInteger(slot),'the selected construction footprint comes from the visible preview');
 await page.waitForFunction(({floor,slot})=>{
  const canvas=document.querySelector('#world'),target=JSON.parse(canvas.dataset.settlementSlots).find(item=>item.floor===floor&&item.slot===slot);
  if(!target?.available)return false;
  const m=JSON.parse(canvas.dataset.freeMovement),pets=JSON.parse(canvas.dataset.petMotion),poly=target.polygon;
  const contains=p=>{let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;}return inside;};
  const edge=p=>Math.min(...poly.map((a,i)=>{const b=poly[(i+1)%poly.length],vx=b.x-a.x,vy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*vx+(p.y-a.y)*vy)/(vx*vx+vy*vy)));return Math.hypot(p.x-a.x-t*vx,p.y-a.y-t*vy);}));
  return [m.body,...pets.map(p=>p.body)].every(body=>body.surface!=='deck'||body.floor!==floor||!contains(body)&&edge(body)>body.radius+2);
 },{floor,slot},{timeout});
 return {floor,slot};
}
async function selectClearConstruction() {
 const deadline=Date.now()+20000,proof={budgetMs:20000,startedAt:new Date().toISOString(),saveBefore:await saved()};constructionPreparations.push(proof);
 await page.evaluate(()=>{
  const canvas=document.querySelector('#world'),frames=[];
  const capture=()=>{const m=JSON.parse(canvas.dataset.freeMovement),pets=JSON.parse(canvas.dataset.petMotion),g=JSON.parse(canvas.dataset.sceneGeometry);
   frames.push({at:performance.now(),selection:document.querySelector('#construction-bar').dataset.preview,geometry:g,
    slots:JSON.parse(canvas.dataset.settlementSlots).filter(slot=>slot.unlocked&&slot.floor===g.activeFloor),
    movement:{moving:m.moving,body:m.body,target:m.target},pets,action:JSON.parse(canvas.dataset.sceneAction)});};
  const observer=new MutationObserver(capture);capture();observer.observe(canvas,{attributes:true,attributeFilter:['data-free-movement','data-pet-motion','data-settlement-slots','data-scene-geometry']});
  window.__constructionPreparation={frames,observer,capture};
 });
 try{
  proof.cameraSettling=await cameraSettled();
  const handle=await page.waitForFunction(()=>{
   const canvas=document.querySelector('#world'),r=canvas.getBoundingClientRect(),g=JSON.parse(canvas.dataset.sceneGeometry),m=JSON.parse(canvas.dataset.freeMovement),
    pets=JSON.parse(canvas.dataset.petMotion),hits=JSON.parse(canvas.dataset.sceneHits),slots=JSON.parse(canvas.dataset.settlementSlots);
   for(const target of slots){
    if(!target.visible||!target.unlocked||!target.available||target.floor!==g.activeFloor)continue;
    const hit=hits.find(hit=>hit.kind==='build-slot'&&hit.plotId===target.slot);if(!hit)continue;
    const point={x:r.left+g.dx+hit.x*g.scale,y:r.top+g.dy+hit.y*g.scale},poly=target.polygon;
    if(point.x-22<Math.max(0,r.left+g.viewport.safeLeft)||point.x+22>Math.min(innerWidth,r.right-g.viewport.safeRight)
      ||point.y-22<Math.max(0,r.top+g.viewport.safeTop)||point.y+22>Math.min(innerHeight,r.bottom-g.viewport.safeBottom))continue;
    if([-22,0,22].some(dx=>[-22,0,22].some(dy=>document.elementFromPoint(point.x+dx,point.y+dy)!==canvas)))continue;
    const contains=p=>{let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;}return inside;};
    const edge=p=>Math.min(...poly.map((a,i)=>{const b=poly[(i+1)%poly.length],vx=b.x-a.x,vy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*vx+(p.y-a.y)*vy)/(vx*vx+vy*vy)));return Math.hypot(p.x-a.x-t*vx,p.y-a.y-t*vy);}));
    const bodies=[m.body,...pets.map(pet=>pet.body)];
    if(bodies.some(body=>body.surface==='deck'&&body.floor===target.floor&&(contains(body)||edge(body)<=body.radius+2)))continue;
    return {target,point,hit,bodies,geometry:g,at:performance.now()};
   }
   return false;
  },null,{timeout:Math.max(1,deadline-Date.now())});
  proof.candidate=await handle.jsonValue();await handle.dispose();assert.ok(proof.candidate,'build-slot: the actual rendered interactive object exists');
  proof.beforeSelection=await page.evaluate(()=>window.__constructionPreparation.frames.at(-1));
  proof.actualTouch=await tapWorld(proof.candidate.point);
  assert.ok(distance(proof.actualTouch.world,proof.candidate.hit)<3,'the native touch reaches the actual clear construction slot');
  proof.selection=await waitConstructionClear(Math.max(1,deadline-Date.now()));
  assert.equal(proof.selection.floor,proof.candidate.target.floor);assert.equal(proof.selection.slot,proof.candidate.target.slot);
  assert.ok(Date.now()<=deadline,'selection and complete footprint readiness share the original 20-second budget');
  proof.status='ready';
 }catch(error){proof.status='failed';proof.failure=String(error);throw error;}
 finally{
  proof.frames=await page.evaluate(()=>{const trace=window.__constructionPreparation;trace.observer.disconnect();trace.capture();return trace.frames;});
  proof.afterSelection=proof.frames.at(-1);proof.saveAfter=await saved();proof.finishedAt=new Date().toISOString();
 }
 assert.equal(proof.afterSelection.movement.moving,false);assert.deepEqual(proof.afterSelection.movement.target,proof.frames[0].movement.target);
 assert.ok(distance(proof.afterSelection.movement.body,proof.frames[0].movement.body)<.1,'choosing a clear preview retains the manually selected feet');
 assert.equal(proof.afterSelection.action.kind,null);assert.deepEqual(stableSave(proof.saveAfter),stableSave(proof.saveBefore),'preview selection changes no saved progress');
}
async function confirmClearConstruction() {
 const deadline=Date.now()+20000;
 for(let attempt=0;attempt<3&&Date.now()<deadline;attempt++){
  const selection=await waitConstructionClear(Math.max(1,deadline-Date.now())),before=await saved(),button=page.locator('[data-construction-confirm]');
  await button.evaluate((element,selection)=>{window.__constructionRelease=null;element.addEventListener('pointerup',event=>{
   const canvas=document.querySelector('#world'),m=JSON.parse(canvas.dataset.freeMovement),pets=JSON.parse(canvas.dataset.petMotion);
   window.__constructionRelease={at:performance.now(),eventAt:event.timeStamp,client:{x:event.clientX,y:event.clientY},selection,
    target:JSON.parse(canvas.dataset.settlementSlots).find(item=>item.floor===selection.floor&&item.slot===selection.slot),bodies:[m.body,...pets.map(p=>p.body)]};
  },{capture:true,once:true});},selection);
  await touch(button);
  const outcome=await page.waitForFunction(()=>{
   const app=document.querySelector('#app'),a=JSON.parse(document.querySelector('#world').dataset.sceneAction);
   if(app.getAttribute('aria-busy')==='true'&&a.kind==='build'&&a.from!==null)return 'accepted';
   if(document.querySelector('#toast').textContent==='캐릭터나 동물이 지나가는 자리예요. 잠시 뒤 다시 확정해 주세요.')return 'actor-rejected';
   return false;
  },null,{timeout:1500});
  const release=await page.evaluate(()=>window.__constructionRelease);assert.ok(release?.target,'a real confirm release records its actual footprint and complete body radii');
  const result=await outcome.jsonValue();constructionReadiness.push({attempt:attempt+1,result,release,before,after:await saved()});
  if(result==='accepted')return;
  assert.deepEqual(stableSave(await saved()),stableSave(before),'a temporary actor rejection changes no saved resources or progress');
  assert.equal(await page.locator('#app').getAttribute('aria-busy'),null,'the rejected occupied placement starts no chore');
  assert.equal((await action()).kind,null);
  assert.ok(release.bodies.some(body=>body.surface==='deck'&&body.floor===release.selection.floor&&(inside(body,release.target.polygon)||Math.min(...release.target.polygon.map((a,i)=>{const b=release.target.polygon[(i+1)%release.target.polygon.length],vx=b.x-a.x,vy=b.y-a.y,t=Math.max(0,Math.min(1,((body.x-a.x)*vx+(body.y-a.y)*vy)/(vx*vx+vy*vy)));return Math.hypot(body.x-a.x-t*vx,body.y-a.y-t*vy);}))<body.radius)),'an observed rejection independently overlaps the actual actor circle');
 }
 throw Error('The selected construction footprint remained occupied after bounded real confirmations.');
}

async function idleWalkTurnPets(width) {
 await observe(`natural-pets-${width}`);
 await page.waitForFunction(()=>{
  const frames=window.__freeWalkFrames;return ['dog','cat'].every(id=>{
   const poses=frames.flatMap(f=>f.companions.filter(a=>a.id===id));return poses.some(a=>a.pose==='idle')&&poses.some(a=>a.pose==='walk')&&new Set(poses.filter(a=>a.pose==='walk').map(a=>a.facing)).size===2;
  });
 },null,{timeout:22000});
 const frames=await stopObserve();for(const id of ['dog','cat']){
  const animals=frames.flatMap(f=>f.companions.filter(a=>a.id===id));assert.ok(animals.some(a=>a.pose==='idle'));assert.ok(animals.some(a=>a.pose==='walk'));assert.equal(new Set(animals.filter(a=>a.pose==='walk').map(a=>a.facing)).size,2);
  const footFrames=animals.filter(a=>a.pose==='walk'&&a.sample?.paws);assert.ok(footFrames.length>=3,`${id}: the rendered walk publishes its actual articulated feet`);
  assert.ok(new Set(footFrames.map(a=>JSON.stringify(a.sample.paws))).size>=3,`${id}: paws change naturally instead of sliding a static animal`);
 }
 const stanceProof=[];
 for(const id of ['dog','cat']){
  const animals=frames.map(f=>({at:f.at,animal:f.companions.find(a=>a.id===id)})).filter(f=>f.animal);const pairs=[];
  for(let i=1;i<animals.length;i++){const a=animals[i-1].animal,b=animals[i].animal,bodyDelta=distance(a,b),headingDelta=Math.abs(Math.atan2(Math.sin(b.gait.heading-a.gait.heading),Math.cos(b.gait.heading-a.gait.heading)));
   if(a.pose!=='walk'||b.pose!=='walk'||a.facing!==b.facing||a.sample.strength<.99||b.sample.strength<.99||bodyDelta<.45||headingDelta>.02)continue;
   for(const paw of ['frontNear','frontFar','hindNear','hindFar']){const prior=a.contacts?.[paw],current=b.contacts?.[paw];if(prior?.planted&&current?.planted&&current.phase>prior.phase){pairs.push({at:animals[i].at,paw,bodyDelta,pawDelta:distance(prior,current),prior,current});}}
  }
  assert.ok(pairs.length>=5,`${id}: naturally planted feet have multiple independent world-contact samples`);const ratios=pairs.map(p=>p.pawDelta/p.bodyDelta).sort((a,b)=>a-b),median=ratios[Math.floor(ratios.length/2)];assert.ok(median<.3,`${id}: grounded paws stay anchored while the torso advances`);stanceProof.push({id,pairs,medianPawDriftToBodyTravel:median});
 }
 companionMotion.push({width,frames,stanceProof});
 // Capture real poses at their real times; no sprite API or clock is driven.
 const captures=[];
 for(const id of ['dog','cat'])for(const pose of ['idle','walk','turn']){
  await page.waitForFunction(({id,pose})=>JSON.parse(document.querySelector('#world').dataset.petMotion).some(a=>a.id===id&&(pose==='turn'?a.turnRemaining>.15&&a.turnRemaining<.29:a.pose===pose)),{id,pose},{timeout:16000});
  const actor=await page.locator('#world').evaluate((canvas,id)=>JSON.parse(canvas.dataset.petMotion).find(a=>a.id===id),id);
  const center=await screenPoint(actor),viewport=page.viewportSize(),clip={x:Math.max(0,Math.min(viewport.width-110,center.x-55)),y:Math.max(0,Math.min(viewport.height-100,center.y-75)),width:110,height:100};
  const filename=`artifacts/v${version}-free-movement-${diagnosticPrefix}${id}-${pose}-feet-${width}.png`;await page.screenshot({path:filename,clip});screenshots.push(filename);captures.push({id,pose,actor,filename,at:Date.now()});
 }
 companionMotion.at(-1).captures=captures;
}
async function begin(width,height) {
 context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,deviceScaleFactor:2});page=await context.newPage();
 page.on('pageerror',error=>errors.push(error.message));page.on('response',response=>{if(response.status()>=400&&['image','font','script','stylesheet'].includes(response.request().resourceType()))failedAssets.push(`${response.status()} ${response.url()}`);});
 await page.goto(baseUrl);await page.locator('[data-start]').waitFor();await page.locator('#player-name').fill(`걷기${width}`);await touch(page.locator('[data-start]'));await page.locator('#resident-name').getByText(`걷기${width}`,{exact:true}).waitFor();await pauseWorld();await page.waitForTimeout(1000);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight+1),true,`${width}×${height}: the game itself does not scroll`);
 await page.waitForFunction(()=>document.querySelector('#world')?.dataset.freeMovement&&JSON.parse(document.querySelector('#world').dataset.freeMovement).enabled);await cameraReset();
}
async function saveReceipt(status,error) {
 await writeFile(`artifacts/free-movement-v${version}${receiptSuffix}-verification.json`,JSON.stringify({version,status,baseUrl,snapshotId,finalSnapshot,executionInputs,diagnosticOnly,landscapeDiagnostic,assertionsExecuted,startedAt:startedAt.toISOString(),finishedAt:new Date().toISOString(),input:'Actual mobile touches and CDP touchscreen gestures',clock:'Natural browser RAF/timers; read-only rendered telemetry, no page.clock or private game calls',deviceLimit:'Chromium mobile emulation, not physical Android or iPhone',walks,gestures,choreStarts,obstacleProof,companionMotion,modalStops,constructionReadiness,constructionPreparations,cameraPreparations,screenshots,cases,errors,failedAssets,failureEvidence,...(error?{failure:String(error),stack:error.stack}:{})},null,2)+'\n');
}
try {
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 for(const[width,height]of(landscapeDiagnostic?[[844,390]]:diagnosticOnly?[[360,740]]:[[360,740],[390,844],[844,390]])){
  await begin(width,height);if(diagnosticOnly&&!landscapeDiagnostic)await idleWalkTurnPets(width);await walk(`empty-deck-${width}`,'deck');await retarget(`retarget-current-feet-${width}`);await shot(`reached-deck-${width}`);
  if(width>height){await gesture('landscape-pan-to-visible-road',false,false,{dx:0,dy:-125});await revealLandscapeRoad();}
  const down=await walk(`deck-to-road-${width}`,'road');assert.ok(down.frames.some(f=>f.movement.climbing==='down'),'the road journey visibly descends the stairs');
  const up=await walk(`road-to-deck-${width}`,'deck');assert.ok(up.frames.some(f=>f.movement.climbing==='up'),'the deck journey visibly ascends the stairs');await ladderRetarget(`retarget-midway-on-ladder-${width}`);
  await gesture(`drag-does-not-walk-${width}`);await cameraReset();await gesture(`cancelled-drag-does-not-walk-${width}`,false,true);await cameraReset();await gesture(`pinch-does-not-walk-${width}`,true);await cameraReset();await handModeTap(`hand-mode-tap-does-not-walk-${width}`);
  await touch(page.locator('[data-camera-toggle]'));await touch(page.locator('[data-map-zoom="1"]'));await page.waitForTimeout(750);await touch(page.locator('[data-camera-toggle]'));await walk(`zoomed-ground-${width}`,'deck');await cameraReset();
  cases.push(`${width}×${height}: real ground taps/arrival, retarget without teleport, ladder both ways, obstacle-safe continuous feet, drag/cancel/pinch and zoom hit conversion.`);
  console.log(`PASS focused viewport ${width}×${height}: natural walks, ladder retarget and camera gestures.`);
  if(width===390){
   // Start another journey and open the visible menu while feet are moving.
   const destination=await chooseGround('road');await tapWorld(destination.screen);await page.waitForFunction(()=>JSON.parse(document.querySelector('#world').dataset.freeMovement).moving);const beforeMenu=await movement();await menu();const stopped=await movement();assert.equal(stopped.moving,false);assert.equal(stopped.enabled,false);await page.waitForTimeout(300);assert.ok(distance((await movement()).position,stopped.position)<.1,'a menu freezes the current feet rather than moving them home');modalStops.push({beforeMenu,stopped,after:await movement()});await closeModal();
   await walk('manual-position-before-farm','deck');await touch(page.locator('[data-nav="farm"]'));
   const harvested=await observeChore('farm-from-manual-position',()=>actualHit('farm'),'harvest');assert.equal(harvested.saveAfter.stats.harvests,harvested.saveBefore.stats.harvests+1);assert.equal(harvested.saveAfter.resources.food,harvested.saveBefore.resources.food+4);await home();
   await walk('manual-position-before-chop','road');await touch(page.locator('[data-nav="farm"]'));const chopped=await observeChore('chop-from-manual-road-position',()=>touch(page.locator('[data-quick="chop"]')),'chop');assert.equal(chopped.saveAfter.stats.chops,chopped.saveBefore.stats.chops+1);assert.equal(chopped.saveAfter.resources.wood,chopped.saveBefore.resources.wood+18);await home();
   await walk('manual-position-before-building','deck');const beforeBuild=await saved();await touch(page.locator('[data-nav="build"]'));await touch(page.locator('[data-build-type="waterworks"]'));await page.waitForTimeout(650);
   await actualHit('build-slot');assert.equal(await page.locator('[data-construction-confirm]').isDisabled(),false);assert.equal((await movement()).moving,false);await touch(page.locator('[data-construction-cancel]'));assert.deepEqual((await saved()).resources,beforeBuild.resources);await home();
   await touch(page.locator('[data-nav="build"]'));await touch(page.locator('[data-build-type="waterworks"]'));await page.waitForTimeout(650);await selectClearConstruction();await observeChore('construction-from-manual-position',()=>confirmClearConstruction(),'build');
   const built=await saved();assert.equal(built.resources.wood,beforeBuild.resources.wood-12);assert.equal(built.resources.scrap,beforeBuild.resources.scrap-4);assert.equal(built.settlement.buildings.length,1);await touch(page.locator('[data-facility-close]'));await actualHit('facility');assert.equal(await page.locator('#facility-sheet[data-facility="1"]').isVisible(),true);assert.equal((await movement()).moving,false);await touch(page.locator('[data-facility-close]'));await actualHit('facility-start');assert.equal((await saved()).settlement.stats.productions,1);assert.equal((await movement()).moving,false);assert.equal(await page.locator('#facility-sheet').isVisible(),false,'the actual in-game production bubble starts production without reopening the sheet');await home();
   await walk('deliberate-occupied-footprint-detour','deck',{crossObstacle:true});
   await actualHit('pet');assert.equal(await page.locator('#modal-root').isVisible(),true);assert.match(await page.locator('#modal-root').innerText(),/보리/);assert.equal((await movement()).moving,false);await closeModal();
   const huntDestination=await chooseGround('road');await tapWorld(huntDestination.screen);await page.waitForFunction(()=>JSON.parse(document.querySelector('#world').dataset.freeMovement).moving);await touch(page.locator('[data-nav="hunt"]'));const huntStop=await movement();assert.equal(huntStop.moving,false);assert.equal(huntStop.enabled,false);await touch(page.locator('[data-start-hunt]'));await page.locator('.battle-screen').waitFor();assert.equal((await movement()).moving,false);await touch(page.locator('[data-battle="retreat"]'));await touch(page.locator('[data-battle="confirm-retreat"]'));await page.locator('[data-battle="finish"]').waitFor();await touch(page.locator('[data-battle="finish"]'));await page.locator('.battle-screen').waitFor({state:'detached'});assert.ok(distance((await movement()).position,huntStop.position)<.1,'battle entry and return retain the cancelled physical feet');modalStops.push({scenario:'battle',stopped:huntStop,after:await movement()});await home();
   await idleWalkTurnPets(width);await shot('natural-pets-and-free-home');
   const beforeOffline=await saved();const supported=await page.evaluate(()=>Boolean(navigator.serviceWorker));assert.equal(supported,true);
   await page.waitForFunction(()=>navigator.serviceWorker.getRegistration().then(r=>r?.active?.state==='activated'),null,{timeout:30000});await context.setOffline(true);await page.reload({waitUntil:'domcontentloaded'});await page.locator('#resident-name').getByText(beforeOffline.name,{exact:true}).waitFor();await pauseWorld();
   const offlineSave=await saved();for(const key of ['resources','energy','health','plots','stats','xp','companions','settlement','growthQuests'])assert.deepEqual(offlineSave[key],beforeOffline[key],`offline reload preserves ${key}`);await walk('actual-offline-walking','deck');await context.setOffline(false);cases.push('Manual farming and road woodcutting retain actual start/return positions and award once; construction/pet hits keep their actions; menus cancel at current feet; natural dog/cat idle/walk/turn; actual cached offline reload and walking preserve saved progress.');
  }
  await context.close();
 }
 assert.deepEqual(errors,[]);assert.deepEqual(failedAssets,[]);await saveReceipt(finalSnapshot?'passed':'diagnostic-passed');console.log(`PASS free movement: ${assertionsExecuted} assertions, ${walks.length} real journeys, ${gestures.length} gestures, ${choreStarts.length} complete chores.`);
}catch(error){if(page&&!page.isClosed()){failureEvidence=await page.evaluate(()=>({frames:window.__freeWalkFrames,lastGroundTouch:window.__lastGroundTouch,cameraSettling:window.__cameraSettling,sceneGeometry:JSON.parse(document.querySelector('#world')?.dataset.sceneGeometry||'null'),freeMovement:JSON.parse(document.querySelector('#world')?.dataset.freeMovement||'null'),sceneAction:JSON.parse(document.querySelector('#world')?.dataset.sceneAction||'null')})).catch(()=>null);await shot('failure').catch(()=>{});}await saveReceipt('failed',error);throw error;}finally{if(browser)await browser.close();}
