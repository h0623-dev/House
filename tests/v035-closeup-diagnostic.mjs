import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const baseUrl=process.env.TEST_BASE_URL??'http://127.0.0.1:4302/House/',tag=process.env.TEST_RECEIPT_TAG??`capture-${Date.now()}`;
if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tag))throw Error('Unique safe tag required');
const output=`artifacts/v035-closeup-${tag}`,sha=b=>createHash('sha256').update(b).digest('hex'),testPath='tests/v035-closeup-diagnostic.mjs';
await mkdir(`${output}-inputs`,{recursive:true});await writeFile(`${output}-inputs/executed-harness.mjs`,await readFile(testPath),{flag:'wx'});
const receipt={status:'running',scope:'Actual native mobile zoom and drag compose both real truck entrances. Exact ordinary new-game startup only; no actor, route, resources or clock mutations.',baseUrl,tag,testSha256:sha(await readFile(testPath)),screenshots:[],gestures:[],errors:[]};
const fixture=spawnSync(process.execPath,['--import','tsx','--input-type=module','-e',"import {createGame} from './src/game.ts';console.log(JSON.stringify(createGame('female','우리 트럭 산책길')));"],{encoding:'utf8'});assert.equal(fixture.status,0,fixture.stderr);
let browser,page,context;
const frame=()=>page.locator('#world').evaluate(c=>{const t=c.getContext('2d').getTransform();return{g:JSON.parse(c.dataset.sceneGeometry),m:JSON.parse(c.dataset.freeMovement),p:JSON.parse(c.dataset.petPassage),outdoor:JSON.parse(c.dataset.outdoorGround),r:c.getBoundingClientRect().toJSON(),t:{a:t.a,b:t.b,c:t.c,d:t.d,e:t.e,f:t.f,dpr:Math.min(devicePixelRatio||1,2)}}});
async function touch(selector){const b=page.locator(selector);await b.scrollIntoViewIfNeeded();await page.waitForTimeout(150);const r=await b.boundingBox(),p={x:r.x+r.width/2,y:r.y+r.height/2};assert.equal(await b.evaluate((b,p)=>document.elementFromPoint(p.x,p.y)?.closest('button')===b,p),true);await page.touchscreen.tap(p.x,p.y);}
async function shot(label){const path=`${output}-${label}.png`;await page.screenshot({path});const b=await readFile(path);receipt.screenshots.push({path,sha256:sha(b),bytes:b.length,frame:await frame()});}
const worldClient=(f,p)=>({x:f.r.left+(f.t.a*p[0]+f.t.c*p[1]+f.t.e)/f.t.dpr,y:f.r.top+(f.t.b*p[0]+f.t.d*p[1]+f.t.f)/f.t.dpr});
async function pan(delta){
 const before=await frame(),origin=await page.locator('#world').evaluate((c,delta)=>{const r=c.getBoundingClientRect(),hud=[...document.querySelectorAll('button')].map(b=>b.getBoundingClientRect()).filter(b=>b.width&&b.height),clear=p=>document.elementFromPoint(p.x,p.y)?.id==='world'&&hud.every(b=>Math.hypot(Math.max(b.left-p.x,p.x-b.right,0),Math.max(b.top-p.y,p.y-b.bottom,0))>=14);for(let y=r.top+140;y<r.bottom-100;y+=12)for(let x=r.left+24;x<r.right-24;x+=12)if(Array.from({length:9},(_,n)=>({x:x+delta.x*n/8,y:y+delta.y*n/8})).every(clear))return{x,y};throw Error('No honest full-finger-clear drag path');},delta);
 const row={delta,origin,before:before.g};receipt.gestures.push(row);
 await page.evaluate(()=>{window.__v035CloseupEvents=[];for(const type of['pointerdown','pointerup','pointercancel','touchstart','touchend'])document.addEventListener(type,e=>window.__v035CloseupEvents.push({type,isTrusted:e.isTrusted,target:e.target.id,button:e.target.closest?.('button')?.getAttribute('aria-label')??null,x:e.clientX,y:e.clientY}),{capture:true,once:true});});
 const cdp=await context.newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...origin,id:1}]});for(let n=1;n<=8;n++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:origin.x+delta.x*n/8,y:origin.y+delta.y*n/8,id:1}]});await page.waitForTimeout(35);}await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();await page.waitForTimeout(700);
 row.events=await page.evaluate(()=>window.__v035CloseupEvents);row.after=(await frame()).g;
 assert.ok(Math.abs(row.after.dx-row.before.dx-delta.x)<8&&Math.abs(row.after.dy-row.before.dy-delta.y)<8,JSON.stringify(row));
}
try{
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
 await context.addInitScript(raw=>localStorage.setItem('road-haven-save-v1',raw),fixture.stdout.trim());page=await context.newPage();page.on('pageerror',e=>receipt.errors.push(e.message));await page.goto(baseUrl,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('#world')?.dataset.petPassage&&!document.querySelector('[data-startup-patch]'),null,{timeout:20000});
 await touch('[data-open="menu"]');await touch('#modal-root [data-open="settings"]');if(await page.locator('.time-button').getAttribute('aria-label')!=='시간 계속')await touch('#modal-root [data-pause]');await touch('#modal-root [data-close]');await touch('[data-camera-toggle]');await touch('[data-map-reset]');
 for(let n=0;n<8;n++){const f=await frame(),xs=f.m.world.deckPolygon.map(p=>worldClient(f,[p.x,p.y]).x);if(Math.max(...xs)-Math.min(...xs)>=260)break;await touch('[data-map-zoom="1"]');await page.waitForTimeout(500);}
 for(let n=0;n<4;n++){const f=await frame(),b=f.p.geometry.bounds,points=[...f.m.world.deckPolygon.map(p=>[p.x,p.y]),[b.left,b.top],[b.right,b.bottom],[f.m.world.ladder.bottom.x,f.m.world.ladder.bottom.y]].map(p=>worldClient(f,p)),xs=points.map(p=>p.x),ys=points.map(p=>p.y),delta={x:Math.max(-110,Math.min(110,195-(Math.max(...xs)+Math.min(...xs))/2)),y:Math.max(-100,Math.min(100,f.r.top+f.r.height*.52-(Math.max(...ys)+Math.min(...ys))/2))};if(Math.hypot(delta.x,delta.y)<4)break;await pan(delta);}
 await shot('both-entrances-closed');await touch('.road-controls [data-open="pet-passage"]');await touch('[data-pet-passage-toggle="open"]');await page.waitForFunction(()=>{const p=JSON.parse(document.querySelector('#world').dataset.petPassage);return p.open&&!p.operating;},null,{timeout:30000});await shot('both-entrances-open');
 await touch('.road-controls [data-road-walk]');await page.waitForFunction(()=>JSON.parse(document.querySelector('#world').dataset.petMotion).some(p=>p.surface==='ramp'),null,{timeout:60000});await shot('pet-on-full-bridge');
 assert.deepEqual(receipt.errors,[]);receipt.status='visual-checked';
}catch(e){receipt.status='failed';receipt.failure={message:String(e),stack:e.stack};process.exitCode=1;if(page&&!page.isClosed())try{await shot('failure');}catch{}}
finally{if(browser)await browser.close();await writeFile(`${output}-verification.json`,JSON.stringify(receipt),{flag:'wx'});console.log(JSON.stringify({status:receipt.status,receipt:`${output}-verification.json`,error:receipt.failure?.message}));}
