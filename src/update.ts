import appPackage from '../package.json';
import androidRelease from '../release-version.json';
import { Capacitor, registerPlugin } from '@capacitor/core';
export const APP_VERSION = import.meta.env?.VITE_APP_VERSION || appPackage.version;
export const APP_VERSION_CODE = Number(import.meta.env?.VITE_APP_VERSION_CODE || androidRelease.versionCode);
export interface Release { version: string; versionCode: number; apkUrl: string; sha256: string; notes: string; publishedAt: string }
export type UpdateResult = {status:'unconfigured'|'current'|'available'|'error'; release?:Release; message:string};
const Updater = registerPlugin<{ getVersion(): Promise<{version:string;versionCode:number}>; openDownload(options:{url:string}):Promise<void> }>('Updater');
export function parseRelease(data:unknown):Release {
 if(!data || typeof data !== 'object') throw Error('잘못된 업데이트 정보입니다.');
 const r=data as Record<string,unknown>;
 if(typeof r.version!=='string'||!/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(r.version)||!Number.isSafeInteger(r.versionCode)||Number(r.versionCode)<1||typeof r.apkUrl!=='string'||typeof r.sha256!=='string'||!/^[a-f\d]{64}$/i.test(r.sha256)||typeof r.notes!=='string'||r.notes.length>5000||typeof r.publishedAt!=='string'||Number.isNaN(Date.parse(r.publishedAt))) throw Error('업데이트 정보의 형식이 올바르지 않습니다.');
 const url=new URL(r.apkUrl);
 if(url.protocol!=='https:'||url.username||url.password) throw Error('안전한 HTTPS 다운로드 주소가 필요합니다.');
 return r as unknown as Release;
}
export async function checkUpdate():Promise<UpdateResult> {
 const endpoint=import.meta.env?.VITE_UPDATE_MANIFEST_URL;
 if(!endpoint) return {status:'unconfigured',message:'아직 배포 서버가 연결되지 않았어요. 첫 배포 후 앱이 새 버전을 자동으로 확인해요.'};
 try {
  if(new URL(endpoint).protocol!=='https:') throw Error('업데이트 서버에 HTTPS가 필요합니다.');
  const response=await fetch(endpoint,{cache:'no-store',signal:AbortSignal.timeout(10000)});
  if(!response.ok) throw Error(`서버 응답 오류 (${response.status})`);
  const release=parseRelease(await response.json());
  const current=Capacitor.isNativePlatform()?(await Updater.getVersion()).versionCode:APP_VERSION_CODE;
  return release.versionCode>current ? {status:'available',release,message:`새로운 여행이 기다려요. v${release.version} 업데이트를 받을 수 있어요.`} : {status:'current',message:'최신 버전으로 여행하고 있어요.'};
 } catch(e) {return {status:'error',message:`업데이트를 확인하지 못했어요. ${e instanceof Error?e.message:'연결 상태를 확인해 주세요.'}`};}
}
export async function downloadUpdate(release:Release):Promise<void> {
 const safe=parseRelease(release);
 if(Capacitor.isNativePlatform()) await Updater.openDownload({url:safe.apkUrl});
 else {const link=document.createElement('a');link.href=safe.apkUrl;link.target='_blank';link.rel='noopener noreferrer';link.click();}
}
