import test from 'node:test';
import assert from 'node:assert/strict';
import { createStartupPatchFlow, type StartupPatchServices, type StartupPatchView } from '../src/startup-patch-flow.ts';
import type { LiveUpdateState } from '../src/live-update.ts';

const current:LiveUpdateState={status:'idle',progress:100,message:'Current'};
const ready:LiveUpdateState={status:'ready',progress:100,version:'0.10.0',contentVersion:10,message:'Ready'};
const failed:LiveUpdateState={status:'error',progress:0,message:'Offline'};
const downloading=(progress:number):LiveUpdateState=>({status:'downloading',progress,message:'Downloading'});
const delay=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(r=>{resolve=r;});return {promise,resolve};}
function fixture(overrides:Partial<StartupPatchServices>={}){
 const events:string[]=[], views:(StartupPatchView|null)[]=[];
 let listener:(state:LiveUpdateState)=>void=()=>{};
 const services:StartupPatchServices={
  supported:true,
  initialize:async receive=>{events.push('initialize');listener=receive;return current;},
  check:async()=>{events.push('check');return current;},
  beforeApply:()=>{events.push('save');return true;},
  activate:async()=>{events.push('activate');return true;},
  show:view=>{views.push(view);},
  setBlocked:blocked=>{events.push(blocked?'lock':'unlock');},
  ...overrides,
 };
 return {flow:createStartupPatchFlow(services),events,views,emit:(state:LiveUpdateState)=>listener(state)};
}

test('web begins immediately without native calls, a gate or writing a save',async()=>{
 const {flow,events,views}=fixture({supported:false});
 assert.equal(await flow.start(),'web');assert.deepEqual(events,[]);assert.deepEqual(views,[]);
});

test('current content is checked before releasing startup and never written again',async()=>{
 const {flow,events,views}=fixture();
 assert.equal(await flow.start(),'current');
 assert.deepEqual(events,['lock','initialize','check','unlock']);assert.equal(views.at(-1),null);
});

test('cached ready content saves and activates exactly once, retaining the gate for native reload',async()=>{
 const {flow,events,views}=fixture({initialize:async()=>ready});
 const first=flow.start();assert.equal(flow.start(),first);
 assert.equal(await first,'applying');
 assert.deepEqual(events,['lock','save','activate']);
 assert.deepEqual(views.at(-1),{phase:'applying',progress:100,canContinue:false,version:'0.10.0'});
 flow.continueCurrent();assert.equal(events.includes('unlock'),false);
});

test('download and verification progress stay gated before applying',async()=>{
 const checked=deferred<LiveUpdateState>();
 const {flow,events,views,emit}=fixture({check:()=>checked.promise});
 const result=flow.start();await delay(0);
 emit(downloading(40));assert.equal(views.at(-1)?.phase,'downloading');assert.equal(views.at(-1)?.progress,40);
 emit(downloading(97));assert.equal(views.at(-1)?.phase,'verifying');
 assert.equal(events.includes('save'),false);assert.equal(events.includes('unlock'),false);
 emit(ready);checked.resolve(ready);
 assert.equal(await result,'applying');assert.equal(events.filter(e=>e==='activate').length,1);
});

test('an already busy native check waits for its completion event before gameplay',async()=>{
 const {flow,events,emit}=fixture({check:async()=>downloading(22)});
 const result=flow.start();await delay(0);
 assert.equal(events.includes('unlock'),false);emit(ready);
 assert.equal(await result,'applying');assert.deepEqual(events,['lock','initialize','save','activate']);
});

test('a completion event wins over an older busy response delivered afterward',async()=>{
 let emit:(state:LiveUpdateState)=>void=()=>{};
 const setup=fixture({check:async()=>{emit(ready);return downloading(70);},stalledAfterMs:25});
 emit=setup.emit;
 assert.equal(await setup.flow.start(),'applying');
 assert.equal(setup.events.filter(event=>event==='activate').length,1);
 assert.equal(setup.events.includes('unlock'),false);
});

test('offline, missing native plugin and check rejection release the installed game without writes',async()=>{
 for(const overrides of [
  {initialize:async()=>failed},
  {initialize:async()=>{throw Error('Plugin unavailable');}},
  {check:async()=>{throw Error('Offline');}},
  {check:async()=>failed},
 ]){
  const {flow,events,views}=fixture(overrides);
  assert.equal(await flow.start(),'offline');assert.equal(events.at(-1),'unlock');assert.equal(views.at(-1),null);
  assert.equal(events.includes('save'),false);assert.equal(events.includes('activate'),false);
 }
});

test('a slow connection can be left safely and late ready events do not reactivate the startup gate',async()=>{
 const checked=deferred<LiveUpdateState>();
 const {flow,events,views,emit}=fixture({check:()=>checked.promise,continueAfterMs:5,stalledAfterMs:1000});
 const result=flow.start();flow.continueCurrent();assert.equal(events.includes('unlock'),false);
 await delay(15);assert.equal(views.at(-1)?.canContinue,true);
 flow.continueCurrent();assert.equal(await result,'deferred');
 emit(ready);checked.resolve(ready);await delay(0);
 assert.equal(events.filter(e=>e==='unlock').length,1);assert.equal(events.includes('activate'),false);assert.equal(views.at(-1),null);
});

test('a stalled native request cannot indefinitely prevent offline play',async()=>{
 const {flow,events}=fixture({initialize:()=>new Promise(()=>{}),continueAfterMs:5,stalledAfterMs:15});
 assert.equal(await flow.start(),'deferred');assert.deepEqual(events,['lock','unlock']);
});

test('duplicate progress events do not indefinitely extend the stalled request',async()=>{
 const {flow,events,emit}=fixture({check:()=>new Promise(()=>{}),continueAfterMs:2,stalledAfterMs:15});
 const result=flow.start();await delay(0);emit(downloading(10));
 const duplicate=setInterval(()=>emit(downloading(10)),3);
 try {assert.equal(await result,'deferred');assert.equal(events.at(-1),'unlock');}
 finally {clearInterval(duplicate);}
});

test('save failure leaves the previous content running and never starts activation',async()=>{
 const {flow,events,views}=fixture({initialize:async()=>ready,beforeApply:()=>false});
 assert.equal(await flow.start(),'storage-error');assert.equal(events.includes('activate'),false);assert.equal(events.at(-1),'unlock');assert.equal(views.at(-1),null);
});

test('activation rejection releases input once without an activation retry loop',async()=>{
 for(const activate of [async()=>false,async()=>{throw Error('Rejected');}]){
  let calls=0;
  const {flow,events,views}=fixture({initialize:async()=>ready,activate:async()=>{calls++;return activate();}});
  assert.equal(await flow.start(),'activation-error');assert.equal(calls,1);assert.equal(events.at(-1),'unlock');assert.equal(views.at(-1),null);
 }
});

test('a delayed native activation cannot be interrupted after the continue button was shown',async()=>{
 const checked=deferred<LiveUpdateState>(),activation=deferred<boolean>();
 const {flow,events,views}=fixture({check:()=>checked.promise,activate:()=>activation.promise,continueAfterMs:5,stalledAfterMs:1000});
 const result=flow.start();await delay(15);assert.equal(views.at(-1)?.canContinue,true);
 checked.resolve(ready);await delay(0);assert.equal(views.at(-1)?.phase,'applying');assert.equal(views.at(-1)?.canContinue,false);
 flow.continueCurrent();assert.equal(events.includes('unlock'),false);
 activation.resolve(true);assert.equal(await result,'applying');assert.equal(events.includes('unlock'),false);
});
