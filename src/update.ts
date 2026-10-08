import appPackage from '../package.json';
import androidRelease from '../release-version.json';
import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
export const APP_VERSION = import.meta.env?.VITE_APP_VERSION || appPackage.version;
export const APP_VERSION_CODE = Number(import.meta.env?.VITE_APP_VERSION_CODE || androidRelease.versionCode);
export interface Release { version: string; versionCode: number; apkUrl: string; sha256: string; notes: string; publishedAt: string; minimumNativeVersionCode?:number }
export type UpdateResult = {status:'unconfigured'|'current'|'available'|'error'; release?:Release; message:string};
export type AutomaticUpdateStatus='idle'|'downloading'|'ready'|'permission'|'installing'|'error';
export interface AutomaticUpdateState {
 status:AutomaticUpdateStatus; progress:number; message:string;
 version?:string; versionCode?:number; downloadedBytes?:number; totalBytes?:number; revision?:number;
}
const Updater = registerPlugin<{
 getVersion():Promise<{version:string;versionCode:number}>;
 getUpdateState():Promise<AutomaticUpdateState>;
 prepareUpdate(release:Release):Promise<AutomaticUpdateState>;
 installUpdate():Promise<AutomaticUpdateState>;
 cancelUpdate():Promise<AutomaticUpdateState>;
 addListener(event:'updateStateChanged',listener:(state:AutomaticUpdateState)=>void):Promise<PluginListenerHandle>;
}>('Updater');
const listeners=new Set<(state:AutomaticUpdateState)=>void>();
let subscription:Promise<PluginListenerHandle>|undefined;
let automaticState:AutomaticUpdateState={status:'idle',progress:0,message:'새 업데이트를 기다리고 있어요.'};
export function parseRelease(data:unknown):Release {
 if(!data || typeof data !== 'object') throw Error('잘못된 업데이트 정보입니다.');
 const r=data as Record<string,unknown>;
 if(typeof r.version!=='string'||r.version.length>100||!/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(r.version)||!Number.isSafeInteger(r.versionCode)||Number(r.versionCode)<1||Number(r.versionCode)>2100000000||typeof r.apkUrl!=='string'||typeof r.sha256!=='string'||!/^[a-f\d]{64}$/i.test(r.sha256)||typeof r.notes!=='string'||r.notes.length>5000||typeof r.publishedAt!=='string'||Number.isNaN(Date.parse(r.publishedAt))) throw Error('업데이트 정보의 형식이 올바르지 않습니다.');
 if(r.minimumNativeVersionCode!==undefined&&(!Number.isSafeInteger(r.minimumNativeVersionCode)||Number(r.minimumNativeVersionCode)<1||Number(r.minimumNativeVersionCode)>Number(r.versionCode))) throw Error('필요한 앱 버전 정보가 올바르지 않습니다.');
 const url=new URL(r.apkUrl);
 if(r.apkUrl.length>8192||url.protocol!=='https:'||url.username||url.password||r.apkUrl.includes('#')||/^https:\/\/[^/?#]*@/i.test(r.apkUrl)) throw Error('안전한 HTTPS 다운로드 주소가 필요합니다.');
 return r as unknown as Release;
}
export function isNativeUpdateSupported():boolean {
 return Capacitor.isNativePlatform()&&Capacitor.getPlatform()==='android';
}
/** Compatible game-content updates do not force another Android APK install. */
export function shouldOfferUpdate(release:Release,currentCode:number,native=false):boolean {
 return (native?(release.minimumNativeVersionCode??release.versionCode):release.versionCode)>currentCode;
}
export function parseAutomaticUpdateState(data:unknown):AutomaticUpdateState {
 if(!data||typeof data!=='object')throw Error('업데이트 진행 정보를 확인하지 못했어요.');
 const value=data as Record<string,unknown>;
 if(!['idle','downloading','ready','permission','installing','error'].includes(String(value.status))||typeof value.progress!=='number'||!Number.isFinite(value.progress)||typeof value.message!=='string')throw Error('업데이트 진행 정보가 올바르지 않아요.');
 const state:AutomaticUpdateState={status:value.status as AutomaticUpdateStatus,progress:Math.max(0,Math.min(100,Math.round(value.progress))),message:value.message};
 if(typeof value.version==='string')state.version=value.version;
 for(const key of ['versionCode','downloadedBytes','totalBytes','revision'] as const){if(Number.isSafeInteger(value[key])&&Number(value[key])>=0)state[key]=Number(value[key]);}
 return state;
}
function receiveState(data:unknown):AutomaticUpdateState {
 const next=parseAutomaticUpdateState(data);
 // A getState response may arrive after a newer progress event.
 if(next.revision!==undefined&&automaticState.revision!==undefined&&next.revision<automaticState.revision)return automaticState;
 automaticState=next;
 for(const listener of listeners)listener(automaticState);
 return automaticState;
}
export async function initializeAutoUpdates(onState?:(state:AutomaticUpdateState)=>void):Promise<AutomaticUpdateState> {
 if(onState)listeners.add(onState);
 if(!isNativeUpdateSupported())return receiveState({status:'idle',progress:0,message:'앱에서는 새 업데이트를 자동으로 받아요.'});
 subscription??=Updater.addListener('updateStateChanged',receiveState).catch(error=>{subscription=undefined;throw error;});
 await subscription;
 return getAutomaticUpdateState();
}
export async function getAutomaticUpdateState():Promise<AutomaticUpdateState> {
 if(!isNativeUpdateSupported())return automaticState;
 try{return receiveState(await Updater.getUpdateState());}
 catch{return receiveState({status:'error',progress:0,message:'업데이트 상태를 확인하지 못했어요. 다시 확인해 주세요.'});}
}
export async function prepareAutomaticUpdate(release:Release):Promise<AutomaticUpdateState> {
 const safe=parseRelease(release);
 if(!isNativeUpdateSupported())return automaticState;
 return receiveState(await Updater.prepareUpdate(safe));
}
export async function installPreparedUpdate():Promise<AutomaticUpdateState> {
 if(!isNativeUpdateSupported())throw Error('Android 앱에서 업데이트를 설치할 수 있어요.');
 return receiveState(await Updater.installUpdate());
}
export async function cancelAutomaticUpdate():Promise<AutomaticUpdateState> {
 if(!isNativeUpdateSupported())return automaticState;
 return receiveState(await Updater.cancelUpdate());
}
export async function checkUpdate():Promise<UpdateResult> {
 const endpoint=import.meta.env?.VITE_UPDATE_MANIFEST_URL;
 if(!endpoint) return {status:'unconfigured',message:'아직 배포 서버가 연결되지 않았어요. 첫 배포 후 앱이 새 버전을 자동으로 확인해요.'};
 try {
  if(new URL(endpoint).protocol!=='https:') throw Error('업데이트 서버에 HTTPS가 필요합니다.');
  const response=await fetch(endpoint,{cache:'no-store',signal:AbortSignal.timeout(10000)});
  if(!response.ok) throw Error(`서버 응답 오류 (${response.status})`);
  const release=parseRelease(await response.json());
  const native=isNativeUpdateSupported();
  const current=native?(await Updater.getVersion()).versionCode:APP_VERSION_CODE;
  return shouldOfferUpdate(release,current,native) ? {status:'available',release,message:`새로운 여행이 기다려요. v${release.version} 업데이트를 받을 수 있어요.`} : {status:'current',message:'최신 버전으로 여행하고 있어요.'};
 } catch(e) {return {status:'error',message:`업데이트를 확인하지 못했어요. ${e instanceof Error?e.message:'연결 상태를 확인해 주세요.'}`};}
}
export async function downloadUpdate(release:Release):Promise<void> {
 const safe=parseRelease(release);
 if(isNativeUpdateSupported())await prepareAutomaticUpdate(safe);
 else {const link=document.createElement('a');link.href=safe.apkUrl;link.target='_blank';link.rel='noopener noreferrer';link.click();}
}
