import './startup-patch.css';
import worldAtlasUrl from './assets/world-atlas-anime.png';
import roadUrl from './assets/world-road-anime.png';
import dogAtlasUrl from './assets/creatures-anime.png';
import catAtlasUrl from './assets/companions-cat-anime.png';
import { initializeLiveUpdates,checkLiveUpdate,activateLiveUpdate,isLiveUpdateSupported,type LiveUpdateState } from './live-update';
import { createStartupPatchFlow,type StartupPatchOutcome,type StartupPatchView } from './startup-patch-flow';

interface StartupPatchOptions {
 onState:(state:LiveUpdateState)=>void;
 beforeApply:()=>boolean|Promise<boolean>;
 onPendingChange:(pending:boolean)=>void;
}

/** The loading illustration uses the same painted village and companions as play. */
function startupVillageArt(){
 return `<svg class="startup-patch-tableau" viewBox="0 0 460 410" fill="none" aria-hidden="true" focusable="false">
  <defs>
   <radialGradient id="startup-patch-glow"><stop stop-color="#fff5c8" stop-opacity=".9"/><stop offset="1" stop-color="#fff5c8" stop-opacity="0"/></radialGradient>
   <radialGradient id="startup-patch-shadow"><stop stop-color="#344b2d" stop-opacity=".3"/><stop offset="1" stop-color="#344b2d" stop-opacity="0"/></radialGradient>
   <clipPath id="startup-patch-truck-crop"><path d="M10 188 159 78 181 76 219 116 313 180 343 226 377 240 421 270 449 313 454 344 477 367 500 410 500 478 459 506 447 549 403 574 343 570 276 537 223 463 167 432 108 403 47 377 14 325Z"/></clipPath>
   <clipPath id="startup-patch-tree-crop"><path d="M836 60H1202V567H887L812 465 809 237Z"/></clipPath>
  </defs>
  <ellipse cx="231" cy="193" rx="214" ry="174" fill="url(#startup-patch-glow)"/>
  <g class="startup-patch-fireflies" fill="#f4d381"><circle cx="62" cy="102" r="3"/><circle cx="379" cy="54" r="2.5"/><circle cx="409" cy="236" r="3"/></g>
  <ellipse cx="235" cy="374" rx="220" ry="31" fill="url(#startup-patch-shadow)"/>
  <svg x="279" y="31" width="139" height="179" viewBox="809 60 393 507"><image href="${worldAtlasUrl}" width="1536" height="1024" clip-path="url(#startup-patch-tree-crop)"/></svg>
  <svg x="63" y="86" width="328" height="311" viewBox="0 62 510 520"><image href="${worldAtlasUrl}" width="1536" height="1024" clip-path="url(#startup-patch-truck-crop)"/></svg>
  <svg x="250" y="140" width="40" height="55" viewBox="1207 181 146 201"><image href="${worldAtlasUrl}" width="1536" height="1024"/></svg>
  <svg x="48" y="278" width="61" height="75" viewBox="42 73 309 377"><image href="${dogAtlasUrl}" width="1536" height="1024"/></svg>
  <svg x="204" y="318" width="64" height="64" viewBox="63 86 537 535"><image href="${catAtlasUrl}" width="1254" height="1254"/></svg>
  <g class="startup-patch-breeze" stroke="#69826d" stroke-width="2.5" stroke-linecap="round"><path d="M339 13q6-6 12 0m0 0q6-6 12 0"/><path d="M379 35q4-4 8 0m0 0q4-4 8 0"/></g>
 </svg>`;
}

/** Check, download and apply compatible content before the player's first input. */
export function runStartupPatch(options:StartupPatchOptions):Promise<StartupPatchOutcome>{
 let panel:HTMLElement|undefined;
 function render(view:StartupPatchView|null){
  if(!view){panel?.remove();panel=undefined;return;}
  if(!panel){
   panel=document.createElement('section');panel.className='startup-patch';panel.dataset.startupPatch='';
   panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-labelledby','startup-patch-title');
   panel.innerHTML=`<div class="startup-patch-backdrop" aria-hidden="true" style="background-image:url('${roadUrl}')"></div><div class="startup-patch-card"><header class="startup-patch-heading"><p class="startup-patch-brand">ROAD HAVEN</p><p class="startup-patch-logo">로드헤이븐</p><p class="startup-patch-subtitle"><span></span>트럭 위의 우리집<span></span></p></header><div class="startup-patch-art" aria-hidden="true">${startupVillageArt()}</div><div class="startup-patch-status"><h1 id="startup-patch-title">우리 트럭을 준비하고 있어요</h1><p class="startup-patch-message" data-patch-message aria-live="polite"></p><div class="startup-patch-progress" data-patch-progress role="progressbar" aria-label="게임 업데이트 진행" aria-valuemin="0" aria-valuemax="100"><i></i></div><p class="startup-patch-detail" data-patch-detail>게임 실행 시 새 콘텐츠가 자동으로 적용돼요.</p><button class="startup-patch-continue" data-patch-continue hidden>현재 버전으로 시작</button><small class="startup-patch-offline" data-patch-offline hidden>연결이 느려도 저장한 마을에서 계속할 수 있어요.</small></div><p class="startup-patch-caption">오늘도, 우리만의 작은 마을을 만들어요.</p></div>`;
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
