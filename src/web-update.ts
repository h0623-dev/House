import type { LiveUpdateState } from './live-update';
import { Capacitor } from '@capacitor/core';
declare const __ROAD_HAVEN_WEB_PWA__:boolean;

export interface WebUpdateDiagnostics {
 supported:boolean;controllerBuildId?:string;waitingBuildId?:string;applying:boolean;
 registeredScope?:string;cachePrefix:string;state:LiveUpdateState;
}
export interface WebUpdateEnvironment {
 native:boolean;production:boolean;pwaEnabled:boolean;base:string;secure:boolean;
 protocol:string;hostname:string;pathname:string;serviceWorkerAvailable:boolean;
}
export function supportsWebUpdates(value:WebUpdateEnvironment):boolean {
 if(value.native||!value.production||!value.pwaEnabled||!value.secure||!value.serviceWorkerAvailable)return false;
 if(value.protocol!=='https:'&&!(value.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(value.hostname)))return false;
 if(!value.base.startsWith('/')||!value.base.endsWith('/')||value.base.includes('..')||value.base.includes('//'))return false;
 return value.pathname===value.base.slice(0,-1)||value.pathname.startsWith(value.base);
}

interface WorkerReply {buildId?:string;state?:LiveUpdateState;accepted?:boolean;reason?:string}
export interface WebUpdateClientOptions {
 supported:boolean;base:string;serviceWorker:ServiceWorkerContainer;
 renderedBuildId:()=>string|undefined;reload:()=>void;
 beforePeerApply:()=>boolean|Promise<boolean>;onApplying:(value:boolean)=>void;
 finalSave?:()=>boolean|Promise<boolean>;
 onState:(state:LiveUpdateState)=>void;onDiagnostics?:(diagnostics:WebUpdateDiagnostics)=>void;
}
export function parseWebUpdateState(value:unknown):LiveUpdateState {
 if(!value||typeof value!=='object')throw Error('Invalid web update state');
 const state=value as Record<string,unknown>;
 if(!['idle','checking','downloading','ready','error'].includes(String(state.status))||typeof state.progress!=='number'||!Number.isFinite(state.progress)||typeof state.message!=='string'||state.message.length>2000)throw Error('Invalid web update state');
 const parsed:LiveUpdateState={status:state.status as LiveUpdateState['status'],progress:Math.max(0,Math.min(100,state.progress)),message:state.message};
 if(typeof state.version==='string'&&state.version.length<=100)parsed.version=state.version;
 if(Number.isSafeInteger(state.contentVersion)&&Number(state.contentVersion)>0)parsed.contentVersion=Number(state.contentVersion);
 return parsed;
}

/** The native updater owns Android; this client owns only production web builds. */
export function createWebUpdateClient(options:WebUpdateClientOptions){
 let state:LiveUpdateState={status:'idle',progress:0,message:'게임을 열면 새 콘텐츠를 자동으로 준비해요.'};
 let registration:ServiceWorkerRegistration|undefined;
 let initializing:Promise<LiveUpdateState>|undefined;
 let checking:Promise<LiveUpdateState>|undefined;
 let controllerBuildId:string|undefined,waitingBuildId:string|undefined;
 let applying=false,reloadQueued=false;
 let expectedBuildId:string|undefined,activationToken:string|undefined,peerToken:string|undefined;
 let expectedWorker:ServiceWorker|undefined;
 let peerTimeout:ReturnType<typeof setTimeout>|undefined;
 let activationRetry:ReturnType<typeof setTimeout>|undefined;
 let nextActivationAllowedAt=0;
 let revision=0;
 let listenersInstalled=false;
 const watched=new Set<ServiceWorker>();
 const watchedRegistrations=new Set<ServiceWorkerRegistration>();
 const getDiagnostics=():WebUpdateDiagnostics=>({supported:options.supported,controllerBuildId,waitingBuildId,applying,
  registeredScope:registration?.scope,cachePrefix:`road-haven-web:${options.base}:`,state:{...state}});
 const diagnostics=()=>options.onDiagnostics?.(getDiagnostics());
 function emit(next:LiveUpdateState){revision++;state=parseWebUpdateState(next);options.onState({...state});diagnostics();return {...state};}
 function failure(){return emit({status:'error',progress:0,message:'연결되면 새 게임을 다시 준비해요. 저장한 마을은 그대로 이어갈 수 있어요.'});}
 function request(worker:ServiceWorker,data:Record<string,unknown>,timeout=9000):Promise<WorkerReply>{
  return new Promise((resolve,reject)=>{
   const channel=new MessageChannel();
   const timer=setTimeout(()=>{channel.port1.close();reject(Error('Web update worker timeout'));},timeout);
   channel.port1.onmessage=event=>{clearTimeout(timer);channel.port1.close();resolve(event.data as WorkerReply);};
   try{worker.postMessage(data,[channel.port2]);}catch(error){clearTimeout(timer);channel.port1.close();reject(error);}
  });
 }
 function unlock(){clearTimeout(peerTimeout);peerToken=undefined;activationToken=undefined;expectedBuildId=undefined;expectedWorker=undefined;applying=false;options.onApplying(false);diagnostics();}
 function retryWhenPeersFinish(){
  clearTimeout(activationRetry);
  // Jitter separates two idle tabs that both tried to initiate the same patch.
  const delay=5000+Math.floor(Math.random()*2000);nextActivationAllowedAt=Date.now()+delay;
  activationRetry=setTimeout(()=>{if(!applying&&state.status==='ready')void inspect().catch(failure);},delay);
 }
 async function rememberBoot(){
  const worker=options.serviceWorker.controller??registration?.active;
  const buildId=options.renderedBuildId();
  if(worker&&buildId)await request(worker,{type:'WEB_UPDATE_BOOT',buildId});
 }
 async function reloadIfApproved(){
  const worker=expectedWorker;
  // COMMIT belongs to the chosen waiting worker. Messaging the old controller
  // while the browser retires it can restart it and stall the replacement.
  if(!worker||!expectedBuildId||reloadQueued||worker.state!=='activated'
   ||(options.serviceWorker.controller!==worker&&registration?.active!==worker))return;
  const target=expectedBuildId;
  const result=await request(worker,{type:'WEB_UPDATE_GET_STATE',waiting:false});
  controllerBuildId=result.buildId;diagnostics();
  if(expectedBuildId!==target||result.buildId!==target)return;
  // A committed controller transition always restarts once, including a page
  // that fetched the new HTML before its previous worker was replaced. The
  // first installation never requests a transaction for its own rendered build.
  reloadQueued=true;options.reload();
 }
 async function inspect():Promise<LiveUpdateState>{
  if(!registration)return {...state};
  watch(registration.installing);watch(registration.waiting);watch(registration.active);
  const worker=registration.waiting??registration.active;
  if(registration.waiting&&worker){
   const result=await request(worker,{type:'WEB_UPDATE_GET_STATE',waiting:true});
   // The first worker can naturally leave waiting while this reply is in flight.
   // Do not turn that obsolete lifecycle snapshot into an explicit hot reload.
   if(registration.waiting!==worker)return inspect();
   if(result.buildId===options.renderedBuildId()&&(!registration.active||registration.active===worker)){
    waitingBuildId=undefined;
    return emit({...parseWebUpdateState(result.state),status:'idle',message:'최신 게임으로 여행하고 있어요.'});
   }
   waitingBuildId=result.buildId;
   return emit(parseWebUpdateState(result.state));
  }
  if(registration.installing){
   if(state.status==='downloading')return {...state};
   return emit({status:'downloading',progress:0,message:'새로운 게임을 안전하게 준비하고 있어요.'});
  }
  if(worker){
   const result=await request(worker,{type:'WEB_UPDATE_GET_STATE',waiting:false});
   controllerBuildId=options.serviceWorker.controller?result.buildId:undefined;
   waitingBuildId=undefined;
   const next=parseWebUpdateState(result.state);
   // A first-load document can remain uncontrolled. If another release became
   // active naturally, its document still reloads only through the saved gate.
   if(result.buildId&&options.renderedBuildId()&&result.buildId!==options.renderedBuildId()){
    waitingBuildId=result.buildId;next.status='ready';next.progress=100;
    next.message='새 게임이 준비됐어요. 안전하게 저장한 뒤 자동으로 이어갈게요.';
   }
   return emit(next);
  }
  return {...state};
 }
 function watch(worker:ServiceWorker|null){
  if(!worker||watched.has(worker))return;watched.add(worker);
  worker.addEventListener('statechange',()=>{
   if(worker.state==='redundant'&&state.status==='downloading'){failure();return;}
   if(['installed','activated'].includes(worker.state))setTimeout(()=>{
    // controllerchange and our activation broadcast can both arrive while the
    // browser still reports activating. Retry the approved reload once the
    // actual lifecycle reaches activated; first installs have no COMMIT token.
    void(async()=>{await inspect();await reloadIfApproved();})().catch(failure);
   },0);
  });
 }
 async function onMessage(event:MessageEvent){
  if(!registration||![registration.waiting,registration.active,registration.installing].includes(event.source as ServiceWorker))return;
  const data=event.data as Record<string,unknown>;
  if(!data||typeof data!=='object')return;
  if(data.type==='WEB_UPDATE_STATE'){try{emit(parseWebUpdateState(data.state));}catch{/* Ignore malformed foreign messages. */}return;}
  if(data.type==='WEB_UPDATE_ACTIVATED'){await rememberBoot();await inspect();await reloadIfApproved();return;}
  if(data.type==='WEB_UPDATE_PREPARE'&&typeof data.token==='string'&&typeof data.buildId==='string'){
   let ready=false;
   try{ready=!applying&&await options.beforePeerApply();}catch{/* A failed save rejects the whole update. */}
   if(ready){
    peerToken=data.token;applying=true;options.onApplying(true);diagnostics();
    clearTimeout(peerTimeout);peerTimeout=setTimeout(()=>{if(peerToken===data.token)unlock();},16000);
   }
   (event.source as ServiceWorker).postMessage({type:'WEB_UPDATE_VOTE',token:data.token,ready});return;
  }
  if(data.type==='WEB_UPDATE_ABORT'&&(data.token===peerToken||data.token===activationToken)){unlock();return;}
  if(data.type==='WEB_UPDATE_FINALIZE'&&data.token===activationToken){
   let saved=false;
   try{saved=await options.finalSave?.()===true;}catch{/* Save errors cancel every tab's activation. */}
   (event.source as ServiceWorker).postMessage({type:'WEB_UPDATE_FINALIZED',token:data.token,saved});return;
  }
  if(data.type==='WEB_UPDATE_COMMIT'&&(data.token===peerToken||data.token===activationToken)&&typeof data.buildId==='string'){
   expectedBuildId=data.buildId;expectedWorker=event.source as ServiceWorker;applying=true;diagnostics();await reloadIfApproved();
  }
 }
 async function initialize():Promise<LiveUpdateState>{
  if(!options.supported)return {...state};
  if(!initializing)initializing=(async()=>{
   if(!listenersInstalled){
    listenersInstalled=true;
    options.serviceWorker.addEventListener('message',event=>{void onMessage(event).catch(failure);});
    options.serviceWorker.addEventListener('controllerchange',()=>{void(async()=>{await rememberBoot();await inspect();await reloadIfApproved();})().catch(failure);});
   }
   emit({status:'checking',progress:0,message:'새로운 게임 소식을 확인하고 있어요.'});
   registration=await options.serviceWorker.register(options.base+'sw.js',{scope:options.base,updateViaCache:'none'});
   if(!watchedRegistrations.has(registration)){
    watchedRegistrations.add(registration);
    registration.addEventListener('updatefound',()=>{watch(registration?.installing??null);void inspect().catch(failure);});
   }
   await rememberBoot();return inspect();
  })().catch(()=>{initializing=undefined;return failure();});
  return initializing;
 }
 async function check():Promise<LiveUpdateState>{
  if(!options.supported||applying)return {...state};
  if(checking)return checking;
  checking=(async()=>{
   await initialize();
   if(!registration)return {...state};
   if(registration.waiting||registration.installing)return inspect();
   emit({status:'checking',progress:0,message:'새로운 게임 소식을 확인하고 있어요.'});
   const requestedAt=revision;
   await registration.update();
   if(revision!==requestedAt&&['ready','error'].includes(state.status))return {...state};
   return inspect();
  })().catch(failure).finally(()=>{checking=undefined;});
  return checking;
 }
 async function activate():Promise<boolean>{
  const worker=registration?.waiting??registration?.active;
  if(!worker||!canActivate())return false;
  // Only a COMMIT sent after peer approvals and the final canonical save can
  // authorize reload; a naturally activated worker alone must not do so.
  applying=true;expectedBuildId=undefined;expectedWorker=undefined;
  activationToken=globalThis.crypto?.randomUUID?.()??`${Date.now()}-${Math.random()}`;diagnostics();
  try{
   const result=await request(worker,{type:'WEB_UPDATE_ACTIVATE',token:activationToken,buildId:waitingBuildId},15000);
   if(result.accepted){await reloadIfApproved();return true;}
   unlock();retryWhenPeersFinish();return false;
  }catch{unlock();failure();return false;}
 }
 async function acknowledge():Promise<void>{
  const worker=options.serviceWorker.controller??registration?.active;
  const buildId=options.renderedBuildId();
  if(worker&&buildId)await request(worker,{type:'WEB_UPDATE_ACK',buildId});
 }
 function canActivate(){return Boolean(options.supported&&(registration?.waiting??registration?.active)&&!applying&&state.status==='ready'&&waitingBuildId&&Date.now()>=nextActivationAllowedAt);}
 diagnostics();
 return {initialize,check,activate,acknowledge,canActivate,getState:()=>({...state}),getDiagnostics};
}

let guard:()=>boolean|Promise<boolean>=()=>false;
let applyingHook:(value:boolean)=>void=()=>{};
let finalSave:()=>boolean|Promise<boolean>=()=>false;
let client:ReturnType<typeof createWebUpdateClient>|undefined;
/** Peer tabs approve/freeze without overwriting primary storage; the caller saves last. */
export function setWebUpdateActivationGuard(next:()=>boolean|Promise<boolean>,onApplying?:(value:boolean)=>void,save?:()=>boolean|Promise<boolean>){guard=next;applyingHook=onApplying??(()=>{});finalSave=save??(()=>false);}
export function isWebUpdateSupported(native=Capacitor.isNativePlatform()):boolean {
 if(typeof window==='undefined'||typeof navigator==='undefined')return false;
 const productionWeb=typeof __ROAD_HAVEN_WEB_PWA__!=='undefined'&&__ROAD_HAVEN_WEB_PWA__===true;
 return supportsWebUpdates({native,production:productionWeb,
  pwaEnabled:productionWeb,base:import.meta.env.BASE_URL??'',
  secure:window.isSecureContext,protocol:location.protocol,hostname:location.hostname,pathname:location.pathname,
  serviceWorkerAvailable:'serviceWorker' in navigator});
}
export function getWebUpdateClient(onState:(state:LiveUpdateState)=>void){
 if(!client)client=createWebUpdateClient({supported:isWebUpdateSupported(),base:import.meta.env.BASE_URL??'/House/',
  serviceWorker:navigator.serviceWorker,renderedBuildId:()=>document.querySelector<HTMLMetaElement>('meta[name="road-haven-build"]')?.content,
  reload:()=>location.reload(),beforePeerApply:()=>guard(),onApplying:value=>applyingHook(value),finalSave:()=>finalSave(),onState,
  onDiagnostics:value=>{const app=document.querySelector<HTMLElement>('#app');if(app)app.dataset.webUpdateDiagnostics=JSON.stringify(value);}});
 return client;
}
export function getWebUpdateDiagnostics():WebUpdateDiagnostics {
 return client?.getDiagnostics()??{supported:isWebUpdateSupported(),applying:false,
  cachePrefix:`road-haven-web:${import.meta.env.BASE_URL??'/House/'}:`,state:{status:'idle',progress:0,message:'게임을 열면 새 콘텐츠를 자동으로 준비해요.'}};
}
