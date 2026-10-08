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
const listeners=new Set<(state:LiveUpdateState)=>void>();
const native=()=>Capacitor.isNativePlatform()&&Capacitor.getPlatform()==='android';
function update(next:LiveUpdateState){state=next;for(const listener of listeners)listener({...next});return {...next};}
function failure(error:unknown){return update({status:'error',progress:0,message:`연결되면 다시 자동으로 업데이트해요. ${error instanceof Error?error.message:''}`});}
export function getLiveUpdateState():LiveUpdateState{return {...state};}
export async function initializeLiveUpdates(onState?:(state:LiveUpdateState)=>void):Promise<LiveUpdateState>{
 if(onState){listeners.add(onState);onState({...state});}
 if(!native())return {...state};
 if(!initializing)initializing=(async()=>{
  // Acknowledge this rendered boot before a ready listener can activate another bundle.
  await ContentUpdater.acknowledge();
  await ContentUpdater.addListener('contentStateChanged',update);
  update(await ContentUpdater.getState());
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)void checkLiveUpdate();});
  void checkLiveUpdate();
  return {...state};
 })().catch(error=>{initializing=null;return failure(error);});
 return initializing;
}
export async function checkLiveUpdate():Promise<LiveUpdateState>{
 if(!native())return {...state};
 if(checking)return checking;
 checking=ContentUpdater.check().then(update).catch(failure).finally(()=>{checking=null;});
 return checking;
}
/** Call after saved gameplay is idle; Android reloads the same local origin. */
export async function activateLiveUpdate():Promise<boolean>{
 if(!native()||activating||state.status!=='ready')return false;
 activating=true;
 try{await ContentUpdater.activate();return true;}catch(error){activating=false;failure(error);return false;}
}
/** A rendered, usable game confirms the new content booted successfully. */
export async function acknowledgeLiveUpdate():Promise<void>{
 if(native())try{await ContentUpdater.acknowledge();}catch(error){failure(error);}
}
