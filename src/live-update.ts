import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

export type LiveUpdateStatus='idle'|'checking'|'downloading'|'ready'|'error';
export interface LiveUpdateState {status:LiveUpdateStatus;progress:number;version?:string;contentVersion?:number;message:string}
interface ContentUpdaterPlugin {
 getState():Promise<LiveUpdateState>;
 check():Promise<LiveUpdateState>;
 activate():Promise<void>;
 acknowledge():Promise<void>;
 addListener(event:'contentStateChanged',listener:(state:LiveUpdateState)=>void):Promise<PluginListenerHandle>;
}
const ContentUpdater=registerPlugin<ContentUpdaterPlugin>('ContentUpdater');
let state:LiveUpdateState={status:'idle',progress:0,message:'게임 콘텐츠는 앱 안에서 자동으로 업데이트해요.'};
let initializing:Promise<LiveUpdateState>|null=null;
let checking:Promise<LiveUpdateState>|null=null;
let activating=false;
let retryTimer:ReturnType<typeof setTimeout>|undefined;
let retryAttempt=0;
let foregroundListenersInstalled=false;
let nativeEventGeneration=0;
const retryDelays=[15_000,45_000,120_000,300_000];
const listeners=new Set<(state:LiveUpdateState)=>void>();
export const isLiveUpdateSupported=()=>Capacitor.isNativePlatform()&&Capacitor.getPlatform()==='android';
const native=isLiveUpdateSupported;
function update(next:LiveUpdateState){state=next;for(const listener of listeners)listener({...next});return {...next};}
function receiveNativeEvent(next:LiveUpdateState){nativeEventGeneration++;return update(next);}
function receiveSnapshot(next:LiveUpdateState,requestedAt:number){
 // A busy native worker can send a completion event before an older bridge response arrives.
 return nativeEventGeneration===requestedAt?update(next):{...state};
}
function failure(error:unknown){return update({status:'error',progress:0,message:`연결되면 다시 자동으로 업데이트해요. ${error instanceof Error?error.message:''}`});}
function clearRetry(){clearTimeout(retryTimer);retryTimer=undefined;}
function scheduleRetry(){
 clearRetry();
 if(document.hidden||navigator.onLine===false||activating||retryAttempt>=retryDelays.length)return;
 retryTimer=setTimeout(()=>{retryTimer=undefined;void checkLiveUpdate();},retryDelays[retryAttempt++]);
}
function installForegroundListeners(){
 if(foregroundListenersInstalled)return;
 foregroundListenersInstalled=true;
 document.addEventListener('visibilitychange',()=>{
  if(document.hidden)clearRetry();
  else if(!activating)void checkLiveUpdate();
 });
 window.addEventListener('online',()=>{
  retryAttempt=0;clearRetry();if(!document.hidden&&!activating)void checkLiveUpdate();
 });
 window.addEventListener('offline',clearRetry);
 window.addEventListener('pagehide',clearRetry);
}
export function getLiveUpdateState():LiveUpdateState{return {...state};}
export async function initializeLiveUpdates(onState?:(state:LiveUpdateState)=>void,options:{checkOnInitialize?:boolean}={}):Promise<LiveUpdateState>{
 if(onState){listeners.add(onState);onState({...state});}
 if(!native())return {...state};
 if(!initializing)initializing=(async()=>{
  // Acknowledge this rendered boot before a ready listener can activate another bundle.
  await ContentUpdater.acknowledge();
  await ContentUpdater.addListener('contentStateChanged',receiveNativeEvent);
  const requestedAt=nativeEventGeneration;
  receiveSnapshot(await ContentUpdater.getState(),requestedAt);
  installForegroundListeners();
  if(options.checkOnInitialize!==false)void checkLiveUpdate();
  return {...state};
 })().catch(error=>{initializing=null;return failure(error);});
 return initializing;
}
export async function checkLiveUpdate():Promise<LiveUpdateState>{
 if(!native()||activating)return {...state};
 if(checking)return checking;
 clearRetry();
 const requestedAt=nativeEventGeneration;
 checking=ContentUpdater.check().then(next=>receiveSnapshot(next,requestedAt)).catch(failure).then(next=>{
  if(next.status==='error')scheduleRetry();
  else if(next.status==='idle'||next.status==='ready')retryAttempt=0;
  return next;
 }).finally(()=>{checking=null;});
 return checking;
}
/** Call after saved gameplay is idle; Android reloads the same local origin. */
export async function activateLiveUpdate():Promise<boolean>{
 if(!native()||activating||state.status!=='ready')return false;
 activating=true;clearRetry();
 try{await ContentUpdater.activate();return true;}catch(error){activating=false;failure(error);return false;}
}
/** A rendered, usable game confirms the new content booted successfully. */
export async function acknowledgeLiveUpdate():Promise<void>{
 if(native())try{await ContentUpdater.acknowledge();}catch(error){failure(error);}
}
