import './startup-patch.css';
import { initializeLiveUpdates,checkLiveUpdate,activateLiveUpdate,isLiveUpdateSupported,type LiveUpdateState } from './live-update';
import { createStartupPatchFlow,type StartupPatchOutcome,type StartupPatchView } from './startup-patch-flow';

interface StartupPatchOptions {
 onState:(state:LiveUpdateState)=>void;
 beforeApply:()=>boolean|Promise<boolean>;
 onPendingChange:(pending:boolean)=>void;
}

/** Check, download and apply compatible content before the player's first input. */
export function runStartupPatch(options:StartupPatchOptions):Promise<StartupPatchOutcome>{
 let panel:HTMLElement|undefined;
 function render(view:StartupPatchView|null){
  if(!view){panel?.remove();panel=undefined;return;}
  if(!panel){
   panel=document.createElement('section');panel.className='startup-patch';panel.dataset.startupPatch='';
   panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-labelledby','startup-patch-title');
   panel.innerHTML=`<div class="startup-patch-card"><p class="startup-patch-brand">ROAD HAVEN</p><div class="startup-patch-art" aria-hidden="true"><svg viewBox="0 0 240 130" fill="none"><ellipse cx="120" cy="109" rx="94" ry="10" fill="#CDD9BB"/><path d="M22 85h196" stroke="#AEB994" stroke-width="3" stroke-linecap="round"/><path d="M47 72h125v25H47z" fill="#C99A64" stroke="#72634C" stroke-width="3" stroke-linejoin="round"/><path d="M172 69h24l15 17v11h-39z" fill="#BCD1BA" stroke="#72634C" stroke-width="3" stroke-linejoin="round"/><path d="M178 76h14l9 10h-23z" fill="#E5EEDB"/><path d="M68 44h40v29H68z" fill="#F2D8AC" stroke="#72634C" stroke-width="3"/><path d="m60 46 28-23 29 23z" fill="#9EB8A4" stroke="#72634C" stroke-width="3" stroke-linejoin="round"/><path d="M82 56h12v17H82z" fill="#B18A64"/><path d="M122 61h33v12h-33z" fill="#A9815B"/><path d="M131 61V45m0 9c-14 1-14-13-14-13 13 0 14 13 14 13m0-4s0-13 13-13c0 0 0 13-13 13m15 11V47m0 8s0-10 10-10c0 0 0 10-10 10" stroke="#7B9B71" stroke-width="4" stroke-linecap="round"/><circle cx="71" cy="99" r="12" fill="#686B60"/><circle cx="71" cy="99" r="5" fill="#E7D5AD"/><circle cx="181" cy="99" r="12" fill="#686B60"/><circle cx="181" cy="99" r="5" fill="#E7D5AD"/><path d="m28 41 3-7 3 7 7 3-7 3-3 7-3-7-7-3zM190 25l2-5 2 5 5 2-5 2-2 5-2-5-5-2z" fill="#E4C58F"/></svg></div><h1 id="startup-patch-title">우리 트럭을 준비하고 있어요</h1><p class="startup-patch-message" data-patch-message aria-live="polite"></p><div class="startup-patch-progress" data-patch-progress role="progressbar" aria-label="게임 업데이트 진행" aria-valuemin="0" aria-valuemax="100"><i></i></div><p class="startup-patch-detail" data-patch-detail>게임 실행 시 새 콘텐츠가 자동으로 적용돼요.</p><button class="startup-patch-continue" data-patch-continue hidden>현재 버전으로 시작</button><small class="startup-patch-offline" data-patch-offline hidden>연결이 느려도 저장한 마을에서 계속할 수 있어요.</small></div>`;
   document.body.append(panel);
   panel.querySelector('[data-patch-continue]')!.addEventListener('click',()=>flow.continueCurrent());
  }
  panel.dataset.patchPhase=view.phase;
  const messages={checking:'새로운 게임 소식을 확인하고 있어요.',downloading:`새 콘텐츠를 받고 있어요 · ${Math.floor(view.progress)}%`,verifying:'받은 게임 파일을 확인하고 있어요.',applying:'새로운 우리집으로 들어가고 있어요.'};
  panel.querySelector('[data-patch-message]')!.textContent=messages[view.phase];
  panel.querySelector('[data-patch-detail]')!.textContent=view.phase==='applying'?'저장한 마을을 그대로 이어서 시작해요.':'게임 실행 시 새 콘텐츠가 자동으로 적용돼요.';
  const progress=panel.querySelector<HTMLElement>('[data-patch-progress]')!;
  progress.classList.toggle('is-checking',view.phase==='checking');
  if(view.phase==='checking')progress.removeAttribute('aria-valuenow');else progress.setAttribute('aria-valuenow',String(Math.floor(view.progress)));
  progress.querySelector<HTMLElement>('i')!.style.width=`${view.phase==='checking'?32:view.progress}%`;
  panel.querySelector<HTMLButtonElement>('[data-patch-continue]')!.hidden=!view.canContinue;
  panel.querySelector<HTMLElement>('[data-patch-offline]')!.hidden=!view.canContinue;
 }
 const flow=createStartupPatchFlow({
  supported:isLiveUpdateSupported(),
  initialize:receive=>initializeLiveUpdates(next=>{options.onState(next);receive(next);},{checkOnInitialize:false}),
  check:checkLiveUpdate,activate:activateLiveUpdate,beforeApply:options.beforeApply,
  show:render,setBlocked:options.onPendingChange,
 });
 return flow.start();
}
