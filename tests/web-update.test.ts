import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { mkdtemp, writeFile, readFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { supportsWebUpdates, parseWebUpdateState, createWebUpdateClient } from '../src/web-update.ts';
import { createPwaRelease, generateServiceWorker, webPwaPlugin } from '../scripts/web-pwa-plugin.mjs';

const sha=(data:string|Uint8Array)=>createHash('sha256').update(data).digest('hex');
const origin='https://example.test',base='/House/';
const complete=origin+base+'.road-haven-complete';
type Manifest={schema:number;buildId:string;version:string;contentVersion:number;base:string;files:Array<{path:string;bytes:number;sha256:string}>};
function fixture(version=1,changes:Record<string,string>={}){
 const data={'index.html':`<html>Version ${version}</html>`,'assets/main.js':`window.version=${version};`,
  'assets/game.css':'body{color:green}','assets/world.png':'Unchanged painted art','fonts/game.ttf':'Unchanged font',...changes};
 const files=Object.entries(data).map(([name,bytes])=>({path:name,bytes:Buffer.byteLength(bytes),sha256:sha(bytes)}));
 const manifest:Manifest={schema:1,version:`0.${version}.0`,contentVersion:version,base,files,buildId:sha(JSON.stringify({version,files}))};
 return {data,manifest,name:`road-haven-web:${base}:${manifest.buildId}`};
}
class FakeCache {
 data=new Map<string,Response>();puts=0;failAfter=Infinity;
 async match(key:string|Request){return this.data.get(typeof key==='string'?key:key.url)?.clone();}
 async put(key:string|Request,response:Response){if(++this.puts>this.failAfter)throw Error('QuotaExceededError');this.data.set(typeof key==='string'?key:key.url,response.clone());}
}
class FakeCaches {
 data=new Map<string,FakeCache>();failNewAfter=Infinity;
 async keys(){return [...this.data.keys()];}
 async open(name:string){if(!this.data.has(name)){const cache=new FakeCache();cache.failAfter=this.failNewAfter;this.data.set(name,cache);}return this.data.get(name)!;}
 async delete(name:string){return this.data.delete(name);}
}
async function seed(caches:FakeCaches,release:ReturnType<typeof fixture>){
 const cache=await caches.open(release.name);
 for(const [name,data] of Object.entries(release.data))await cache.put(origin+base+name,new Response(data));
 await cache.put(complete,new Response(JSON.stringify({...release.manifest,firstInstall:false})));
 return cache;
}
function worker(release:ReturnType<typeof fixture>,options:{caches?:FakeCaches;active?:boolean;clients?:Array<{id:string;url:string;postMessage:(data:any)=>void}>;fetchError?:string;corrupt?:string;matchAll?:()=>any[];skipWaitingPromise?:Promise<void>}={}){
 const caches=options.caches??new FakeCaches();
 const handlers=new Map<string,(event:any)=>void>();const requests:string[]=[],messages:any[]=[];
 let skipped=0,claimed=0;
 const clients=options.clients??[{id:'owner',url:origin+base,postMessage:(message:any)=>messages.push(message)}];
 const self={location:{origin},registration:{active:options.active?{}:null},
  addEventListener:(name:string,callback:(event:any)=>void)=>handlers.set(name,callback),
  clients:{matchAll:async()=>options.matchAll?.()??clients,claim:async()=>{claimed++;}},skipWaiting:()=>{skipped++;return options.skipWaitingPromise??Promise.resolve();}};
 const fetcher=async(request:Request)=>{
  const name=new URL(request.url).pathname.slice(base.length);requests.push(name);
  if(name===options.fetchError||!(name in release.data))return new Response('missing',{status:404});
  return new Response(name===options.corrupt?'CORRUPTED':release.data[name as keyof typeof release.data]);
 };
 vm.runInNewContext(generateServiceWorker(release.manifest),{self,caches,fetch:fetcher,Request,Response,URL,crypto:webcrypto,Uint8Array,setTimeout,clearTimeout,Map,Promise,console});
 async function dispatch(name:string,values:any={}){
  const promises:Promise<unknown>[]=[],replies:any[]=[];
  const event={...values,waitUntil:(pending:Promise<unknown>)=>promises.push(pending),ports:[{postMessage:(value:any)=>replies.push(value)}]};
  handlers.get(name)!(event);await Promise.all(promises);return replies[0];
 }
 async function fetchAsset(name:string,clientId='owner',navigate=false,resultingClientId='new-page'){
  let response:Promise<Response>|undefined;
  handlers.get('fetch')!({request:{url:origin+base+name,method:'GET',mode:navigate?'navigate':'cors'},clientId,resultingClientId,respondWith:(pending:Promise<Response>)=>{response=pending;}});
  return response!;
 }
 return {caches,requests,messages,clients,dispatch,fetchAsset,get skipped(){return skipped;},get claimed(){return claimed;}};
}

test('production web eligibility excludes native, portable, insecure origins and other paths',()=>{
 const env={native:false,production:true,pwaEnabled:true,base,secure:true,protocol:'https:',hostname:'example.test',pathname:base,serviceWorkerAvailable:true};
 assert.equal(supportsWebUpdates(env),true);
 for(const change of [{native:true},{production:false},{pwaEnabled:false},{secure:false},{serviceWorkerAvailable:false},{pathname:'/other/'},{base:'//House/'},{base:'/../House/'},{protocol:'file:'},{protocol:'http:'}])assert.equal(supportsWebUpdates({...env,...change}),false);
 assert.equal(supportsWebUpdates({...env,protocol:'http:',hostname:'127.0.0.1'}),true);
 assert.equal(supportsWebUpdates({...env,pathname:'/House'}),true);
});

test('worker state parsing rejects malformed progress/status and returns detached bounded values',()=>{
 const input={status:'ready',progress:120,message:'Ready',version:'0.18.0',contentVersion:18};
 const parsed=parseWebUpdateState(input);assert.equal(parsed.progress,100);input.message='Mutated';assert.equal(parsed.message,'Ready');
 for(const value of [null,{}, {...input,status:'installed'},{...input,progress:NaN},{...input,message:42}])assert.throws(()=>parseWebUpdateState(value));
});

test('build generator is reproducible, hashes final index/assets, and changes identity for modified bytes',async()=>{
 const out=await mkdtemp(path.join(tmpdir(),'road-haven-pwa-unit-'));
 try{
  await mkdir(path.join(out,'assets'));await writeFile(path.join(out,'assets/game.js'),'window.game=true;');await writeFile(path.join(out,'index.html'),'<html>\n<head>\n  </head>\n<body>Game</body></html>');
  const first=await createPwaRelease(out,{version:'0.18.0',contentVersion:18,base});
  const sw=await readFile(path.join(out,'sw.js'),'utf8');
  const second=await createPwaRelease(out,{version:'0.18.0',contentVersion:18,base});
  assert.deepEqual(second,first);assert.equal(await readFile(path.join(out,'sw.js'),'utf8'),sw);
  assert.equal(first.files.find((file:any)=>file.path==='index.html').sha256,sha(await readFile(path.join(out,'index.html'))));
  assert.ok((await readFile(path.join(out,'index.html'),'utf8')).includes(first.buildId));
  assert.equal(first.files.some((file:any)=>['sw.js','web-update.json'].includes(file.path)),false);
  await writeFile(path.join(out,'assets/game.js'),'window.game="changed";');const changed=await createPwaRelease(out,{version:'0.18.0',contentVersion:18,base});assert.notEqual(changed.buildId,first.buildId);
 }finally{await rm(out,{recursive:true,force:true});}
});

test('native plugin strips web-only head metadata and does not enable PWA by default',()=>{
 const plugin=webPwaPlugin();const config={base:'/',define:{},env:{}};plugin.configResolved(config);
 assert.equal(plugin.config({base:'/'},{command:'build'}).define.__ROAD_HAVEN_WEB_PWA__,'false');
 assert.equal(plugin.config({base},{command:'build'}).define.__ROAD_HAVEN_WEB_PWA__,'true');
 assert.equal(plugin.config({base},{command:'serve'}).define.__ROAD_HAVEN_WEB_PWA__,'false');
 assert.equal(config.define['import.meta.env.VITE_WEB_PWA_ENABLED'],'false');
 assert.equal(config.env['VITE_WEB_PWA_ENABLED'],false);
 assert.equal(plugin.transformIndexHtml('<link data-pwa-only rel="manifest" href="/manifest.webmanifest"><meta data-pwa-only name="apple-mobile-web-app-capable" content="yes"><meta name="theme-color" content="green">'),'<meta name="theme-color" content="green">');
});

test('complete release install caches verified files without activating or touching the previous release',async()=>{
 const old=fixture(1),next=fixture(2);const caches=new FakeCaches();await seed(caches,old);
 const sw=worker(next,{caches,active:true});await sw.dispatch('install');
 assert.equal(sw.skipped,0);assert.ok((await caches.keys()).includes(old.name));
 const cache=await caches.open(next.name);for(const file of next.manifest.files)assert.equal(sha(await (await cache.match(origin+base+file.path))!.arrayBuffer().then(value=>new Uint8Array(value))),file.sha256);
 assert.equal((await(await cache.match(complete))!.json()).firstInstall,false);
});

test('missing file and incorrect digest reject the candidate atomically while old assets remain available',async()=>{
 for(const option of [{fetchError:'index.html'},{corrupt:'assets/main.js'}]){
  const old=fixture(1),next=fixture(2);const caches=new FakeCaches();const previous=await seed(caches,old);
  const sw=worker(next,{caches,active:true,...option});await assert.rejects(sw.dispatch('install'));
  assert.equal((await caches.keys()).includes(next.name),false);assert.equal(await(await previous.match(origin+base+'assets/main.js'))!.text(),old.data['assets/main.js']);assert.equal(sw.skipped,0);
  assert.ok(sw.messages.some(message=>message.state?.status==='error'));
 }
});

test('quota failure during copying verified assets leaves the complete previous cache untouched',async()=>{
 const old=fixture(1),next=fixture(2);const caches=new FakeCaches();const previous=await seed(caches,old);caches.failNewAfter=2;
 const sw=worker(next,{caches,active:true});await assert.rejects(sw.dispatch('install'),/Quota/);
 assert.equal((await caches.keys()).includes(next.name),false);assert.equal(await(await previous.match(origin+base+'fonts/game.ttf'))!.text(),old.data['fonts/game.ttf']);assert.equal(sw.skipped,0);
});

test('unchanged painted assets and fonts are digest checked and copied without new HTTP requests',async()=>{
 const old=fixture(1),next=fixture(2);const caches=new FakeCaches();await seed(caches,old);
 const sw=worker(next,{caches,active:true});await sw.dispatch('install');
 assert.deepEqual(sw.requests,['index.html','assets/main.js']);
 const metadata=await(await(await caches.open(next.name)).match(complete))!.json();
 assert.ok(metadata.reusedBytes>0);assert.equal(metadata.downloadedBytes+metadata.reusedBytes,next.manifest.files.reduce((sum,file)=>sum+file.bytes,0));
});

test('corrupt reusable cache data is downloaded again and checked instead of silently copied',async()=>{
 const old=fixture(1),next=fixture(2);const caches=new FakeCaches();const previous=await seed(caches,old);await previous.put(origin+base+'assets/world.png',new Response('BROKEN CACHE'));
 const sw=worker(next,{caches,active:true});await sw.dispatch('install');assert.ok(sw.requests.includes('assets/world.png'));
 assert.equal(await(await(await caches.open(next.name)).match(origin+base+'assets/world.png'))!.text(),next.data['assets/world.png']);
});

test('first install activates its complete cache without claiming or reloading an existing legacy page',async()=>{
 const sw=worker(fixture(1));await sw.dispatch('install');await sw.dispatch('activate');assert.equal(sw.claimed,0);assert.equal(sw.skipped,0);
 assert.ok(sw.messages.some(message=>message.type==='WEB_UPDATE_ACTIVATED'));
});

test('a busy peer rejects activation for all tabs and the initiator never votes through its peer guard',async()=>{
 const next=fixture(2);let sw:ReturnType<typeof worker>;const messages:any[]=[];
 const clients=[{id:'owner',url:origin+base,postMessage:(data:any)=>messages.push({id:'owner',...data})},
  {id:'peer',url:origin+base,postMessage:(data:any)=>{messages.push({id:'peer',...data});if(data.type==='WEB_UPDATE_PREPARE')void sw.dispatch('message',{source:{id:'peer'},data:{type:'WEB_UPDATE_VOTE',token:data.token,ready:false}});}}];
 sw=worker(next,{active:true,clients});await sw.dispatch('install');
 const result=await sw.dispatch('message',{source:{id:'owner'},data:{type:'WEB_UPDATE_ACTIVATE',token:'test-activation'}});
 assert.equal(result.accepted,false);assert.equal(sw.skipped,0);assert.equal(messages.some(message=>message.id==='owner'&&message.type==='WEB_UPDATE_PREPARE'),false);
 assert.equal(messages.filter(message=>message.type==='WEB_UPDATE_ABORT').length,2);
});

test('every peer approval is required before the final canonical save and commit',async()=>{
 const next=fixture(2);let sw:ReturnType<typeof worker>;const messages:any[]=[];
 const clients=[{id:'owner',url:origin+base,postMessage:(data:any)=>{messages.push(data);if(data.type==='WEB_UPDATE_FINALIZE')void sw.dispatch('message',{source:{id:'owner'},data:{type:'WEB_UPDATE_FINALIZED',token:data.token,saved:true}});}},
  {id:'peer',url:origin+base,postMessage:(data:any)=>{messages.push(data);if(data.type==='WEB_UPDATE_PREPARE')void sw.dispatch('message',{source:{id:'peer'},data:{type:'WEB_UPDATE_VOTE',token:data.token,ready:true}});}}];
 sw=worker(next,{active:true,clients});await sw.dispatch('install');const result=await sw.dispatch('message',{source:{id:'owner'},data:{type:'WEB_UPDATE_ACTIVATE',token:'saved-tabs'}});
 assert.equal(result.accepted,true);assert.equal(sw.skipped,1);assert.equal(messages.filter(message=>message.type==='WEB_UPDATE_COMMIT').length,2);
 await sw.dispatch('activate');assert.equal(sw.claimed,1);
});

test('committed transaction message lifetimes finish while the browser still waits to activate its worker',async()=>{
 const next=fixture(2);let sw:ReturnType<typeof worker>;const messages:any[]=[];
 const clients=[{id:'owner',url:origin+base,postMessage:(data:any)=>{
  messages.push(data);
  if(data.type==='WEB_UPDATE_FINALIZE')void sw.dispatch('message',{source:{id:'owner'},data:{type:'WEB_UPDATE_FINALIZED',token:data.token,saved:true}});
 }}];
 let releaseActivation:()=>void;
 const lifecycle=new Promise<void>(resolve=>{releaseActivation=resolve;});
 sw=worker(next,{active:true,clients,skipWaitingPromise:lifecycle});await sw.dispatch('install');
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{
  const result=await Promise.race([
   sw.dispatch('message',{source:{id:'owner'},data:{type:'WEB_UPDATE_ACTIVATE',token:'browser-lifecycle'}}),
   new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('Activation must not keep its own message event alive')),1000);}),
  ]);
  assert.equal(result.accepted,true);assert.equal(sw.skipped,1);
  assert.deepEqual(messages.filter(message=>['WEB_UPDATE_FINALIZE','WEB_UPDATE_COMMIT'].includes(message.type)).map(message=>message.type),['WEB_UPDATE_FINALIZE','WEB_UPDATE_COMMIT']);
 }finally{clearTimeout(timer);releaseActivation!();}
});

test('a newly opened unapproved tab aborts the final activation recheck',async()=>{
 const next=fixture(2);let calls=0;
 const owner={id:'owner',url:origin+base,postMessage:()=>{}};const late={id:'late',url:origin+base,postMessage:()=>{}};
 const sw=worker(next,{active:true,clients:[owner],matchAll:()=>++calls===1?[owner]:[owner,late]});
 await sw.dispatch('install');calls=0;
 const result=await sw.dispatch('message',{source:{id:'owner'},data:{type:'WEB_UPDATE_ACTIVATE',token:'late-tab'}});
 assert.equal(result.accepted,false);assert.equal(sw.skipped,0);
});

test('pinned old tabs keep old common paths; navigation adopts the new release; missing cached assets never mix',async()=>{
 const old=fixture(1),next=fixture(2,{'fonts/game.ttf':'NEW FONT'});const caches=new FakeCaches();await seed(caches,old);
 const sw=worker(next,{caches,active:true});await sw.dispatch('install');
 await sw.dispatch('message',{source:{id:'owner'},data:{type:'WEB_UPDATE_BOOT',buildId:old.manifest.buildId}});
 assert.equal(await(await sw.fetchAsset('fonts/game.ttf')).text(),'Unchanged font');
 assert.equal(await(await sw.fetchAsset('', 'owner',true,'new-page')).text(),next.data['index.html']);
 assert.equal(await(await sw.fetchAsset('fonts/game.ttf','new-page')).text(),'NEW FONT');
 const cache=await caches.open(next.name);cache.data.delete(origin+base+'assets/main.js');
 const before=sw.requests.length;assert.equal((await sw.fetchAsset('assets/main.js','new-page')).status,503);assert.equal(sw.requests.length,before);
});

test('old caches are deleted only after every live tab acknowledges a usable new boot',async()=>{
 const old=fixture(1),next=fixture(2);const caches=new FakeCaches();await seed(caches,old);
 const clients=[{id:'owner',url:origin+base,postMessage:()=>{}},{id:'peer',url:origin+base,postMessage:()=>{}}];
 const sw=worker(next,{caches,active:true,clients});await sw.dispatch('install');
 await sw.dispatch('message',{source:{id:'peer'},data:{type:'WEB_UPDATE_BOOT',buildId:old.manifest.buildId}});
 await sw.dispatch('message',{source:{id:'owner'},data:{type:'WEB_UPDATE_ACK',buildId:next.manifest.buildId}});assert.ok((await caches.keys()).includes(old.name));
 await sw.dispatch('message',{source:{id:'peer'},data:{type:'WEB_UPDATE_ACK',buildId:next.manifest.buildId}});assert.equal((await caches.keys()).includes(old.name),false);assert.ok((await caches.keys()).includes(next.name));
});

test('current boot acknowledgement preserves a verified waiting successor and an incomplete installing cache',async()=>{
 const current=fixture(2),future=fixture(3);const caches=new FakeCaches();await seed(caches,future);
 const partialName=`road-haven-web:${base}:${sha('incomplete')}`;await caches.open(partialName);
 const sw=worker(current,{caches,active:true});await sw.dispatch('install');
 await sw.dispatch('message',{source:{id:'owner'},data:{type:'WEB_UPDATE_ACK',buildId:current.manifest.buildId}});
 assert.ok((await caches.keys()).includes(future.name));assert.ok((await caches.keys()).includes(partialName));
});

test('failed initiating final save aborts after peer approvals without committing or activating',async()=>{
 const next=fixture(2);let sw:ReturnType<typeof worker>;const messages:any[]=[];
 const clients=[{id:'owner',url:origin+base,postMessage:(data:any)=>{messages.push(data);if(data.type==='WEB_UPDATE_FINALIZE')void sw.dispatch('message',{source:{id:'owner'},data:{type:'WEB_UPDATE_FINALIZED',token:data.token,saved:false}});}},
  {id:'peer',url:origin+base,postMessage:(data:any)=>{messages.push(data);if(data.type==='WEB_UPDATE_PREPARE')void sw.dispatch('message',{source:{id:'peer'},data:{type:'WEB_UPDATE_VOTE',token:data.token,ready:true}});}}];
 sw=worker(next,{active:true,clients});await sw.dispatch('install');const result=await sw.dispatch('message',{source:{id:'owner'},data:{type:'WEB_UPDATE_ACTIVATE',token:'save-failed'}});
 assert.equal(result.accepted,false);assert.equal(sw.skipped,0);assert.ok(messages.some(message=>message.type==='WEB_UPDATE_ABORT'));assert.equal(messages.some(message=>message.type==='WEB_UPDATE_COMMIT'),false);
});

test('concurrent initiating tabs cannot replace another activation transaction or lose its resolver',async()=>{
 const next=fixture(2);let sw:ReturnType<typeof worker>;
 const clients=['one','two'].map(id=>({id,url:origin+base,postMessage:(data:any)=>{
  if(data.type==='WEB_UPDATE_PREPARE')void sw.dispatch('message',{source:{id},data:{type:'WEB_UPDATE_VOTE',token:data.token,ready:true}});
  if(data.type==='WEB_UPDATE_FINALIZE')void sw.dispatch('message',{source:{id},data:{type:'WEB_UPDATE_FINALIZED',token:data.token,saved:true}});
 }}));
 sw=worker(next,{active:true,clients});await sw.dispatch('install');
 const results=await Promise.all(clients.map(client=>sw.dispatch('message',{source:{id:client.id},data:{type:'WEB_UPDATE_ACTIVATE',token:client.id}})));
 assert.equal(results.filter(result=>result.accepted).length,1);assert.equal(results.filter(result=>!result.accepted).length,1);assert.equal(sw.skipped,1);
});

function clientHarness(options:{firstInstall?:boolean;renderedCurrent?:boolean}={}){
 const oldId=sha('old-document'),newId=sha('new-document');
 const listeners=new Map<string,Array<(event:any)=>void>>();const calls:any[]=[];
 let activationPort:MessagePort|undefined;
 const makeWorker=(buildId:string,state:string)=>({state,stateListeners:[] as Array<()=>void>,addEventListener(name:string,callback:()=>void){if(name==='statechange')this.stateListeners.push(callback);},postMessage(data:any,ports:MessagePort[]=[]){
  calls.push({...data,workerBuildId:buildId});
  if(data.type==='WEB_UPDATE_GET_STATE')ports[0].postMessage({buildId,state:{status:data.waiting?'ready':'idle',progress:100,version:'0.19.0',contentVersion:19,message:'Tested worker'}});
  else if(data.type==='WEB_UPDATE_ACTIVATE')activationPort=ports[0];
  else if(ports[0])ports[0].postMessage({accepted:true});
 }});
 const active=makeWorker(oldId,'activated'),waiting=makeWorker(newId,'installed');
 const registration:any={scope:origin+base,active:options.firstInstall?null:active,waiting,installing:null,addEventListener:()=>{},update:async()=>{}};
 const container:any={controller:options.firstInstall?null:active,register:async()=>registration,addEventListener:(name:string,listener:(event:any)=>void)=>{const list=listeners.get(name)??[];list.push(listener);listeners.set(name,list);}};
 const emit=(name:string,data:any={},source:any=waiting)=>{for(const listener of listeners.get(name)??[])listener({data,source});};
 let reloads=0,peerApprovals=0,finalSaves=0,peerReady=false;const locks:boolean[]=[];
 const states:string[]=[];
 const client=createWebUpdateClient({supported:true,base,serviceWorker:container,renderedBuildId:()=>options.renderedCurrent?newId:oldId,reload:()=>{reloads++;},
  beforePeerApply:()=>{peerApprovals++;return peerReady;},onApplying:value=>locks.push(value),finalSave:()=>{finalSaves++;return true;},onState:state=>states.push(state.status)});
 return {client,emit,calls,locks,states,active,waiting,registration,container,oldId,newId,
  becomeActive(){waiting.state='activated';registration.active=waiting;registration.waiting=null;container.controller=waiting;emit('controllerchange');},
  beginActivation(){waiting.state='activating';registration.active=waiting;registration.waiting=null;container.controller=waiting;emit('controllerchange');},
  finishActivation(){waiting.state='activated';for(const listener of waiting.stateListeners)listener();},
  accept(){activationPort!.postMessage({accepted:true});},set peerReady(value:boolean){peerReady=value;},
  get reloads(){return reloads;},get peerApprovals(){return peerApprovals;},get finalSaves(){return finalSaves;}};
}
async function until(condition:()=>boolean){const deadline=Date.now()+1000;while(!condition()){assert.ok(Date.now()<deadline,'Asynchronous worker exchange must complete');await new Promise(resolve=>setTimeout(resolve,2));}}

test('the first same-build worker passing through waiting never advertises a reload or locks onboarding',async()=>{
 const harness=clientHarness({firstInstall:true,renderedCurrent:true});
 assert.equal((await harness.client.initialize()).status,'idle');
 assert.equal((await harness.client.check()).status,'idle');
 assert.equal(harness.client.getDiagnostics().waitingBuildId,undefined);
 assert.equal(harness.client.canActivate(),false);assert.equal(await harness.client.activate(),false);
 assert.equal(harness.states.includes('ready'),false);assert.equal(harness.calls.some(call=>call.type==='WEB_UPDATE_ACTIVATE'),false);
 harness.becomeActive();await until(()=>harness.client.getDiagnostics().controllerBuildId===harness.newId);
 assert.equal(harness.reloads,0);assert.deepEqual(harness.locks,[]);
});

test('an explicitly committed replacement reloads once even when the document already fetched its current HTML',async()=>{
 const harness=clientHarness({renderedCurrent:true});await harness.client.initialize();assert.equal(harness.client.canActivate(),true);
 const activating=harness.client.activate();await until(()=>harness.calls.some(call=>call.type==='WEB_UPDATE_ACTIVATE'));
 const token=harness.calls.find(call=>call.type==='WEB_UPDATE_ACTIVATE').token;
 harness.emit('message',{type:'WEB_UPDATE_FINALIZE',token,buildId:harness.newId});await until(()=>harness.finalSaves===1);
 harness.emit('message',{type:'WEB_UPDATE_COMMIT',token,buildId:harness.newId});
 harness.becomeActive();await until(()=>harness.reloads===1);harness.accept();assert.equal(await activating,true);
 assert.equal(harness.reloads,1);assert.equal(harness.peerApprovals,0);
});

test('naturally changed controller cannot reload before the committed final save; initiating peer guard stays excluded',async()=>{
 const harness=clientHarness();await harness.client.initialize();assert.equal(harness.client.canActivate(),true);
 const activating=harness.client.activate();await until(()=>harness.calls.some(call=>call.type==='WEB_UPDATE_ACTIVATE'));
 const token=harness.calls.find(call=>call.type==='WEB_UPDATE_ACTIVATE').token;
 harness.becomeActive();await until(()=>harness.client.getDiagnostics().controllerBuildId===harness.newId);
 assert.equal(harness.reloads,0);assert.equal(harness.finalSaves,0);assert.equal(harness.peerApprovals,0);
 harness.emit('message',{type:'WEB_UPDATE_FINALIZE',token,buildId:harness.newId});await until(()=>harness.calls.some(call=>call.type==='WEB_UPDATE_FINALIZED'));
 assert.equal(harness.finalSaves,1);assert.equal(harness.reloads,0);
 harness.emit('message',{type:'WEB_UPDATE_COMMIT',token,buildId:harness.newId});await until(()=>harness.reloads===1);harness.accept();assert.equal(await activating,true);
 harness.emit('controllerchange');await new Promise(resolve=>setTimeout(resolve,10));assert.equal(harness.reloads,1);
});

test('a committed update retries its reload when an activating controller finally reaches activated',async()=>{
 const harness=clientHarness();await harness.client.initialize();
 const activating=harness.client.activate();await until(()=>harness.calls.some(call=>call.type==='WEB_UPDATE_ACTIVATE'));
 const token=harness.calls.find(call=>call.type==='WEB_UPDATE_ACTIVATE').token;
 harness.emit('message',{type:'WEB_UPDATE_FINALIZE',token,buildId:harness.newId});await until(()=>harness.finalSaves===1);
 harness.emit('message',{type:'WEB_UPDATE_COMMIT',token,buildId:harness.newId});
 harness.beginActivation();harness.emit('message',{type:'WEB_UPDATE_ACTIVATED',buildId:harness.newId});
 await until(()=>harness.client.getDiagnostics().controllerBuildId===harness.newId);harness.accept();assert.equal(await activating,true);
 assert.equal(harness.reloads,0);
 harness.finishActivation();await until(()=>harness.reloads===1);
 harness.finishActivation();await new Promise(resolve=>setTimeout(resolve,10));assert.equal(harness.reloads,1);
});

test('a commit never wakes the retiring old controller while its chosen worker is still waiting',async()=>{
 const harness=clientHarness();await harness.client.initialize();
 const activating=harness.client.activate();await until(()=>harness.calls.some(call=>call.type==='WEB_UPDATE_ACTIVATE'));
 const token=harness.calls.find(call=>call.type==='WEB_UPDATE_ACTIVATE').token;
 harness.emit('message',{type:'WEB_UPDATE_FINALIZE',token,buildId:harness.newId});await until(()=>harness.finalSaves===1);
 const oldRequests=harness.calls.filter(call=>call.workerBuildId===harness.oldId).length;
 harness.emit('message',{type:'WEB_UPDATE_COMMIT',token,buildId:harness.newId});
 await new Promise(resolve=>setTimeout(resolve,10));
 assert.equal(harness.calls.filter(call=>call.workerBuildId===harness.oldId).length,oldRequests);
 assert.equal(harness.reloads,0);
 harness.becomeActive();await until(()=>harness.reloads===1);harness.accept();assert.equal(await activating,true);
});

test('a peer rejects an unsafe game, freezes only after idle approval, and restores its lock after abort',async()=>{
 const harness=clientHarness();await harness.client.initialize();
 harness.emit('message',{type:'WEB_UPDATE_PREPARE',token:'unsafe',buildId:harness.newId});await until(()=>harness.calls.some(call=>call.type==='WEB_UPDATE_VOTE'&&call.token==='unsafe'));
 assert.equal(harness.calls.find(call=>call.token==='unsafe').ready,false);assert.deepEqual(harness.locks,[]);assert.equal(harness.reloads,0);
 harness.peerReady=true;harness.emit('message',{type:'WEB_UPDATE_PREPARE',token:'saved',buildId:harness.newId});await until(()=>harness.calls.some(call=>call.type==='WEB_UPDATE_VOTE'&&call.token==='saved'));
 assert.equal(harness.calls.find(call=>call.token==='saved').ready,true);assert.deepEqual(harness.locks,[true]);assert.equal(harness.client.getDiagnostics().applying,true);
 harness.emit('message',{type:'WEB_UPDATE_ABORT',token:'saved',buildId:harness.newId});await until(()=>!harness.client.getDiagnostics().applying);
 assert.deepEqual(harness.locks,[true,false]);assert.equal(harness.finalSaves,0);assert.equal(harness.reloads,0);
});
