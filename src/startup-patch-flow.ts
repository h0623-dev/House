import type { LiveUpdateState } from './live-update';

export type StartupPatchOutcome='web'|'current'|'offline'|'deferred'|'storage-error'|'activation-error'|'applying';
export type StartupPatchPhase='checking'|'downloading'|'verifying'|'applying';
export interface StartupPatchView {
 phase:StartupPatchPhase;
 progress:number;
 canContinue:boolean;
 version?:string;
}
export interface StartupPatchServices {
 supported:boolean;
 initialize:(receive:(state:LiveUpdateState)=>void)=>Promise<LiveUpdateState>;
 check:()=>Promise<LiveUpdateState>;
 activate:()=>Promise<boolean>;
 beforeApply:()=>boolean|Promise<boolean>;
 show:(view:StartupPatchView|null)=>void;
 setBlocked:(blocked:boolean)=>void;
 /** A slow connection must not make the already installed game unavailable. */
 continueAfterMs?:number;
 stalledAfterMs?:number;
}

/** Coordinates startup only. Native code remains the authority for verification and activation. */
export function createStartupPatchFlow(services:StartupPatchServices){
 let started=false,finished=false,applying=false,canContinue=false;
 let latest:LiveUpdateState={status:'checking',progress:0,message:''};
 let resolveOutcome:(outcome:StartupPatchOutcome)=>void;
 const outcome=new Promise<StartupPatchOutcome>(resolve=>{resolveOutcome=resolve;});
 let continueTimer:ReturnType<typeof setTimeout>|undefined;
 let stalledTimer:ReturnType<typeof setTimeout>|undefined;
 let terminal:((state:LiveUpdateState)=>void)|undefined;
 let progressToken='';
 let eventGeneration=0;
 function clearTimers(){clearTimeout(continueTimer);clearTimeout(stalledTimer);}
 function show(){
  if(finished||applying)return;
  const progress=Number.isFinite(latest.progress)?Math.max(0,Math.min(100,latest.progress)):0;
  services.show({phase:latest.status==='downloading'?(progress>=97?'verifying':'downloading'):'checking',progress,canContinue,version:latest.version});
 }
 function finish(result:Exclude<StartupPatchOutcome,'applying'>){
  if(finished||applying)return;
  finished=true;clearTimers();terminal?.(latest);terminal=undefined;services.show(null);services.setBlocked(false);resolveOutcome(result);
 }
 function watchProgress(){
  const token=`${latest.status}:${latest.progress}`;
  // Duplicate progress events do not extend a stalled request forever.
  if(token===progressToken)return;
  progressToken=token;clearTimeout(stalledTimer);
  stalledTimer=setTimeout(()=>finish('deferred'),services.stalledAfterMs??45_000);
 }
 function receive(next:LiveUpdateState){
  eventGeneration++;
  latest={...next};
  if(finished||applying)return;
  watchProgress();show();
  if(next.status==='idle'||next.status==='ready'||next.status==='error')terminal?.(next);
 }
 async function apply(){
  if(finished||applying)return;
  applying=true;clearTimers();services.show({phase:'applying',progress:100,canContinue:false,version:latest.version});
  try {
   if(!await services.beforeApply()){applying=false;finish('storage-error');return;}
   if(finished)return;
   if(await services.activate()){
    // A successful native call reloads this origin. Keep every input and clock locked until then.
    finished=true;resolveOutcome('applying');return;
   }
  }catch{/* Continue the verified installed game if activation was rejected. */}
  applying=false;finish('activation-error');
 }
 async function run(){
  try {
   const initializeGeneration=eventGeneration;
   const initialResponse=await services.initialize(receive);
   if(finished)return;
   const initialized=eventGeneration===initializeGeneration?initialResponse:latest;
   receive(initialized);
   if(initialized.status==='ready'){await apply();return;}
   if(initialized.status==='error'){finish('offline');return;}
   const checkGeneration=eventGeneration;
   let checked=await services.check();
   if(finished)return;
   // Preserve a completion event when a busy snapshot crosses it in the native bridge.
   if(eventGeneration!==checkGeneration)checked=latest;
   receive(checked);
   if(checked.status==='checking'||checked.status==='downloading'){
    // The native worker may already be checking after an Activity resume.
    checked=await new Promise<LiveUpdateState>(resolve=>{terminal=resolve;});
    terminal=undefined;
   }
   if(finished)return;
   if(checked.status==='ready')await apply();
   else finish(checked.status==='error'?'offline':'current');
  }catch{finish('offline');}
 }
 return {
  start():Promise<StartupPatchOutcome>{
   if(started)return outcome;
   started=true;
   if(!services.supported){finished=true;resolveOutcome('web');return outcome;}
   services.setBlocked(true);watchProgress();show();
   continueTimer=setTimeout(()=>{if(!finished&&!applying){canContinue=true;show();}},services.continueAfterMs??12_000);
   void run();return outcome;
  },
  continueCurrent(){if(started&&canContinue)finish('deferred');},
 };
}
