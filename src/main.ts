import '@fontsource-variable/dm-sans';
import './style.css';
import './gameplay.css';
import { createGame, performAction, tick, saveGame, loadGame, expansionCost, questList, getCropProgress, resourceLabels, MAX_DECK_LEVEL, beginHunt, finishHunt, cancelHunt, type Action, type Gender, type Resource } from './game';
import { Scene } from './scene';
import { BattleView } from './battle-view';
import { STAGE_NAMES, type BattleResult } from './battle';
import { icon, portrait } from './icons';
import { petPortrait } from './creatures';
import { BATTLE_ART_URLS } from './battle-art';
import { APP_VERSION, checkUpdate, downloadUpdate, type UpdateResult } from './update';

const stored = loadGame();
let state = stored ?? createGame('female', '하루');
const recoveredExpedition = Boolean(state.expedition);
if (recoveredExpedition) state = cancelHunt(state).state;
let actionBusy = false;
let battleView: BattleView | null = null;
let selectedStage = 1;
let selectedZone: 'home'|'grove' = 'home';
let selectedPlotId: number | null = state.plots[0]?.id ?? null;
let farmFocused = false;
let paused = false;
let sound = false;
let selectedGender:Gender=state.gender;
let currentModal='';
let lastUpdate:UpdateResult|undefined;
let updateBusy=false;
let toastTimer:ReturnType<typeof setTimeout>;
let audioContext:AudioContext|undefined;
const app = document.querySelector<HTMLDivElement>('#app')!;
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const navItems=[['home','우리집','home'],['seeds','텃밭','farm'],['wood','벌목장','grove'],['hunt','사냥','hunt'],['bag','배낭','bag'],['settings','설정','settings']];
const quickItems=[['harvest','food','수확'],['water','water','물 주기'],['plant','seeds','씨앗 심기'],['chop','axe','벌목'],['gather','map','탐색'],['rest','bed','휴식']] as const;
app.innerHTML=`
 <div class="shell game-shell">
  <header class="topbar game-topbar">
   <button class="profile-button" data-open="character" aria-label="캐릭터 변경" id="profile"></button>
   <div class="survivor-name"><strong id="resident-name"></strong><span><b id="player-level">Lv.1</b><i>·</i> DAY <b id="day">01</b></span></div>
   <div class="vitals" id="vitals" aria-label="생존자 건강과 기력"></div>
   <button class="round-button sound-toggle" data-sound aria-label="소리 켜기">${icon('mute')}</button>
   <span class="save-status" id="save-status" role="status">${icon('check')} 저장됨</span>
  </header>
  <section class="resource-bar" aria-label="보유 자원" id="resources"></section>
  <main class="game-main">
   <section class="scene-card" aria-label="트럭 위 우리집 게임 화면">
    <canvas id="world" aria-label="농장과 집이 있는 거대한 트럭. 밭을 누르거나 화면 아래 활동 버튼으로 플레이하세요."></canvas>
    <div class="scene-top"><div class="scene-label"><span class="live-dot"></span><strong id="zone-name">우리집</strong><span id="truck-level">Lv.1</span></div><button class="scene-icon" data-open="guide" aria-label="게임 도움말">?</button></div>
    <div class="scene-weather"><span id="weather-icon">${icon('sun')}</span><div><strong id="clock">08:00</strong><small id="weather-text">기분 좋은 아침</small></div><button data-pause class="time-button" aria-label="시간 일시정지">${icon('pause')}</button></div>
    <div class="scene-tools"><button class="game-tool" data-open="expand" aria-label="트럭 확장"><span>${icon('expand')}</span><small>확장</small></button><button class="game-tool" data-open="quests" aria-label="모든 목표 보기"><span>${icon('flag')}</span><small>목표</small></button><button class="game-tool" data-open="journal" aria-label="여행 일지"><span>${icon('book')}</span><small>일지</small></button><button class="game-tool" data-open="pet" aria-label="보리와 쉬어 가기"><span>${petPortrait()}</span><small>보리</small></button></div>
    <div class="chore-status" hidden role="status" aria-live="polite"></div>
    <div class="game-controls">
     <div class="farm-context" id="farm-context" aria-label="선택한 밭과 할 일">
      <div class="plot-selector"><button data-plot-step="-1" aria-label="이전 밭 선택">${icon('chevron')}</button><div><strong id="context-title">1번 밭</strong><span id="context-state">수확할 준비가 됐어요</span></div><button data-plot-step="1" aria-label="다음 밭 선택">${icon('chevron')}</button></div>
      <button class="context-action" id="plot-action"><span class="control-icon">${icon('food')}</span><small>수확하기</small></button>
      <button class="context-details" data-open="farm" aria-label="텃밭 전체 보기">${icon('map')}<small>전체 밭</small></button>
     </div>
     <div class="quick-actions" id="quick-actions" aria-label="바로 하는 활동">${quickItems.map(([a,i,t])=>`<button class="quick-action quick-${a}" data-quick="${a}" aria-label="${t}"><span class="control-icon">${icon(i)}<b class="action-count" hidden></b></span><small>${t}</small></button>`).join('')}</div>
    </div>
   </section>
  </main>
  <nav class="game-nav" aria-label="게임 메뉴">${navItems.map(([i,t,id])=>`<button class="nav-button ${id==='home'?'active':''}" data-nav="${id}" aria-label="${t}">${icon(i)}<span>${t}</span></button>`).join('')}</nav>
 </div>
 <div class="toast" id="toast" role="status" aria-live="polite"></div>
 <div class="modal-backdrop" id="modal-root" hidden></div>
`;
const scene=new Scene(document.querySelector('#world')!,(kind,plotId?:number)=>{
 if(actionBusy||battleView)return;
 if(kind==='farm'){setZone('home',true);selectPlot(plotId??preferredPlot()?.id??state.plots[0]?.id??null);}
 if(kind==='truck')openModal('expand');
 if(kind==='pet')openModal('pet');
 if(kind==='character')openModal('character');
 if(kind==='grove'){setZone('grove');renderControls();}
 if(kind==='grove-work'){setZone('grove');renderControls();void action('chop');}
});
function updateNav(){
 const active=['hunt','bag','settings'].includes(currentModal)?currentModal:selectedZone==='grove'?'grove':farmFocused?'farm':'home';
 document.querySelectorAll('[data-nav]').forEach(el=>{const selected=el.getAttribute('data-nav')===active;el.classList.toggle('active',selected);el.setAttribute('aria-current',selected?'page':'false');});
}
function setZone(zone:'home'|'grove',focusFarm=false) {
 selectedZone=zone;farmFocused=zone==='home'&&focusFarm;scene.setZone(zone);scene.setFarmFocus(farmFocused);
 scene.setSelectedPlot(zone==='home'&&farmFocused?selectedPlotId:null);
 document.querySelector('#zone-name')!.textContent=zone==='grove'?'도로 옆 벌목장':farmFocused?'우리집 텃밭':'트럭 위 우리집';
 updateNav();
}
function selectPlot(id:number|null){
 selectedPlotId=id;scene.setSelectedPlot(selectedZone==='home'?id:null);renderControls();
}
function preferredPlot(){return state.plots.find(p=>getCropProgress(state,p)>=1)??state.plots.find(p=>p.plantedAt!==null&&!p.watered)??state.plots.find(p=>p.plantedAt===null)??state.plots[0];}
type FarmAction='plant'|'water'|'harvest';
const actionNames:Record<Action,string>={plant:'씨앗 심기',water:'물 주기',harvest:'수확하기',chop:'나무 베기',gather:'도로 탐색',expand:'데크 확장',rest:'휴식하기',pet:'보리 쓰다듬기',repair:'트럭 수리',hunt:'사냥 출발'};
const actionEnergy:Partial<Record<Action,number>>={plant:4,water:3,harvest:4,chop:10,gather:10,expand:15,repair:6,hunt:16};
function markAvailability(button:HTMLButtonElement,available:boolean,busy:boolean,message:string){
 // Native disabled buttons swallow touch events, so unavailable activities stay
 // tappable and explain how to recover. Only a running chore locks the controls.
 button.disabled=busy;button.setAttribute('aria-disabled',String(busy||!available));button.classList.toggle('unavailable',!available&&!busy);button.title=message;
}
function eligiblePlots(a:FarmAction){return state.plots.filter(p=>a==='plant'?p.plantedAt===null:a==='water'?p.plantedAt!==null&&!p.watered:getCropProgress(state,p)>=1);}
function quickPlot(a:FarmAction){const eligible=eligiblePlots(a);return eligible.find(p=>p.id===selectedPlotId)??eligible[0];}
function renderControls(){
 const busy=actionBusy||Boolean(battleView);
 for(const [a] of quickItems){
  const button=document.querySelector<HTMLButtonElement>(`[data-quick="${a}"]`)!;
  const farmAction=['plant','water','harvest'].includes(a);
  const plot=farmAction?quickPlot(a as FarmAction):undefined;
  const result=performAction(state,a,plot?.id);
  markAvailability(button,Boolean((!farmAction||plot)&&result.ok),busy,busy?'캐릭터가 작업을 마칠 때까지 잠시 기다려요':result.ok?(farmAction?`${eligiblePlots(a as FarmAction).length}개 밭에서 가능 · 한 번 눌러 한 밭씩 돌봐요`:a==='chop'?'목재 +18 · 씨앗 +1 · 기력 10':a==='gather'?'목재 · 고철 · 물 · 씨앗을 모아요':'체력과 기력을 회복해요'):result.message);
  const count=button.querySelector<HTMLElement>('.action-count')!;
  count.hidden=!farmAction;count.textContent=farmAction?String(eligiblePlots(a as FarmAction).length):'';
  button.classList.toggle('context-ready',Boolean(farmAction&&plot?.id===selectedPlotId&&farmFocused));
 }
 const context=document.querySelector<HTMLElement>('#farm-context')!;
 const title=context.querySelector<HTMLElement>('#context-title')!,detail=context.querySelector<HTMLElement>('#context-state')!;
 const actionButton=context.querySelector<HTMLButtonElement>('#plot-action')!;
 const details=context.querySelector<HTMLButtonElement>('.context-details')!;
 const plot=state.plots.find(p=>p.id===selectedPlotId)??preferredPlot();
 if(plot)selectedPlotId=plot.id;
 const grove=selectedZone==='grove';
 let contextAction:Action='chop',label='나무 베기',contextIcon='wood';
 title.textContent=grove?'도로 옆 벌목장':`${plot?.id??1}번 밭`;
 if(grove){detail.textContent=state.energy<10?'잠깐 쉬면 다시 나무를 벨 수 있어요':'나무를 직접 눌러도 벌목해요 · 기력 10';delete actionButton.dataset.plot;details.dataset.open='grove';details.setAttribute('aria-label','벌목장 안내 보기');details.querySelector('small')!.textContent='안내';}
 else if(plot){
  const progress=getCropProgress(state,plot);
  contextAction=plot.plantedAt===null?'plant':progress>=1?'harvest':'water';
  label=contextAction==='plant'?'씨앗 심기':contextAction==='harvest'?'수확하기':'물 주기';contextIcon=contextAction==='plant'?'seeds':contextAction==='harvest'?'food':'water';
  const result=performAction(state,contextAction,plot.id);
  detail.textContent=plot.plantedAt!==null&&plot.watered&&progress<1?`자라는 중 · ${Math.round(progress*100)}%`:!result.ok?result.message:contextAction==='plant'?'빈 밭 · 씨앗 1개':contextAction==='harvest'?'당근이 다 자랐어요!':`물이 필요해요 · ${Math.round(progress*100)}%`;
  actionButton.dataset.plot=String(plot.id);details.dataset.open='farm';details.setAttribute('aria-label','텃밭 전체 보기');details.querySelector('small')!.textContent='전체 밭';
 }
 const needsRest=state.energy<(actionEnergy[contextAction]??0);
 if(grove&&needsRest){label='쉬고 벌목';contextIcon='bed';}
 actionButton.dataset.action=contextAction;actionButton.setAttribute('aria-label',`${grove?'벌목장':`${plot?.id??1}번 밭`} ${label}`);
 actionButton.querySelector('.control-icon')!.innerHTML=icon(contextIcon);actionButton.querySelector('small')!.textContent=label;
 const contextResult=performAction(state,contextAction,grove?undefined:plot?.id);
 markAvailability(actionButton,contextResult.ok,busy,contextResult.message);
 context.classList.toggle('grove-context',grove);context.classList.toggle('working',busy);
 context.querySelectorAll<HTMLButtonElement>('[data-plot-step]').forEach(b=>{b.hidden=grove;b.disabled=busy||state.plots.length<2;});
 document.querySelectorAll<HTMLButtonElement>('.game-nav button,.scene-tools button,.scene-icon,.profile-button,.context-details').forEach(b=>b.disabled=busy);
 updateNav();
}
let displayedResources={...state.resources};
const resources:Resource[]=['wood','scrap','food','water','seeds'];
function render(){
 scene.setState(state);
 document.querySelector('#resources')!.innerHTML=resources.map(r=>{const gained=state.resources[r]-displayedResources[r];return `<button class="resource ${gained>0?'resource-gained':''}" data-open="bag" aria-label="${resourceLabels[r]} ${state.resources[r]}개"><span class="resource-icon ${r}">${icon(r)}</span><strong>${state.resources[r]}</strong>${gained>0?`<span class="resource-delta">+${gained}</span>`:''}</button>`;}).join('');
 displayedResources={...state.resources};
 document.querySelector('#day')!.textContent=String(state.day).padStart(2,'0');
 document.querySelector('#clock')!.textContent=`${String(Math.floor(state.minutes/60)).padStart(2,'0')}:${String(Math.floor(state.minutes%60)).padStart(2,'0')}`;
 const hour=state.minutes/60;
 document.querySelector('#weather-text')!.textContent=hour<6||hour>=20?'대한민국, 2187 · 밤':hour<12?'대한민국, 2187 · 아침':hour<17?'대한민국, 2187 · 오후':'대한민국, 2187 · 저녁';
 document.querySelector('#weather-icon')!.innerHTML=icon(hour<6||hour>=20?'moon':'sun');
 document.querySelector('#truck-level')!.textContent=`Lv.${state.deckLevel}`;
 document.querySelector('#profile')!.innerHTML=portrait(state.gender);
 document.querySelector('#resident-name')!.textContent=state.name;
 document.querySelector('#player-level')!.textContent=`Lv.${state.level}`;
 document.querySelector('#vitals')!.innerHTML=[['heart','건강',state.health,'health'],['bolt','기력',state.energy,'energy']].map(([i,t,n,c])=>`<div class="vital" aria-label="${t} ${Math.round(Number(n))} /100"><span>${icon(String(i))}</span><div class="meter"><div class="${c}" style="width:${n}%"></div></div><strong>${Math.round(Number(n))}</strong></div>`).join('');
 renderControls();
 if(currentModal==='farm')renderFarm();
 if(currentModal==='bag')renderBag();
}

function persist(){const ok=saveGame(state);document.querySelector('#save-status')!.innerHTML=icon(ok?'check':'shield')+(ok?'여행이 저장되었어요':'저장 공간을 확인해 주세요');return ok;}
function toast(message:string){const el=document.querySelector<HTMLElement>('#toast')!;el.textContent=message;el.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),3500);}
function ping(){if(!sound)return;try{audioContext??=new AudioContext();void audioContext.resume();const osc=audioContext.createOscillator(),gain=audioContext.createGain();osc.type='sine';osc.frequency.setValueAtTime(580,audioContext.currentTime);osc.frequency.exponentialRampToValueAtTime(850,audioContext.currentTime+.08);gain.gain.setValueAtTime(.05,audioContext.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audioContext.currentTime+.22);osc.connect(gain);gain.connect(audioContext.destination);osc.start();osc.stop(audioContext.currentTime+.22);}catch{}}
type ChoreAction = 'plant'|'water'|'harvest'|'chop'|'expand'|'gather';
const animatedActions:Action[]=['plant','water','harvest','chop','expand','gather'];
const choreLabels:Record<ChoreAction,string>={plant:'텃밭으로 가서 씨앗을 뿌리고 있어요',water:'물뿌리개로 텃밭을 돌보고 있어요',harvest:'잘 자란 당근을 바구니에 담고 있어요',chop:'숲길에서 나무를 베어 목재를 모으고 있어요',expand:'새 판자를 놓아 우리집을 넓히고 있어요',gather:'트럭 주변에서 쓸 만한 물자를 찾고 있어요'};
function showActivityHelp(a:Action,plotId:number|undefined,message:string){
 const energy=actionEnergy[a]??0,needsHealth=a==='hunt'&&state.health<15,needsRest=state.energy<energy||needsHealth;
 const targetPlot=plotId===undefined?'':` data-plot="${plotId}"`;
 let recovery='';
 if(needsRest)recovery=`<button class="button full-width" data-rest-retry="${a}"${targetPlot}>${icon('bed')} 쉬고 ${a==='hunt'?'사냥 준비하기':actionNames[a]}</button><p class="fine-print">${a==='hunt'?'휴식 후 선택한 사냥터로 돌아가 출발을 준비해요.':'휴식으로 기력을 회복한 뒤 바로 작업해요.'}<br>${state.resources.food>=1&&state.resources.water>=1?'식량 1 · 물 1 사용 · 기력 +55 · 체력 +12':'식량과 물이 없어도 잠깐 쉬면 기력 +35 · 체력 +3'}${needsHealth?'<br>체력 15까지 부족하면 한 번 더 쉬어 주세요.':''}</p>`;
 else if((a==='plant'&&state.resources.seeds<1)||(a==='water'&&state.resources.water<1)||a==='expand'||a==='repair')recovery=`<button class="button full-width" data-action="gather">${icon('map')} 도로에서 필요한 물자 찾기</button><button class="button button-light full-width activity-secondary" data-open="grove">${icon('axe')} 벌목장으로 가기</button>`;
 else if(['plant','water','harvest'].includes(a))recovery=`<button class="button full-width" data-show-farm>${icon('seeds')} 텃밭에서 할 일 보기</button><button class="button button-light full-width activity-secondary" data-action="chop">${icon('axe')} 기다리는 동안 나무 베기</button>`;
 else recovery=`<button class="button full-width" data-action="rest">${icon('bed')} 우리집에서 쉬기</button>`;
 currentModal='activity';updateNav();modalShell('OUR NEXT LITTLE STEP',actionNames[a],`<div class="activity-help-icon">${icon(a==='chop'?'axe':a==='gather'?'map':a==='plant'?'seeds':a==='water'?'water':a==='harvest'?'food':a==='hunt'?'hunt':'bed')}</div><p class="activity-block-reason" role="status">${escape(message)}</p>${needsRest?`<div class="activity-energy"><span>${icon('bolt')} 현재 기력 <b>${Math.floor(state.energy)}</b></span><span>필요한 기력 <b>${energy}</b></span></div>${a==='hunt'?`<div class="activity-energy"><span>${icon('heart')} 현재 체력 <b>${Math.floor(state.health)}</b></span><span>필요한 체력 <b>15</b></span></div>`:''}`:''}${recovery}<button class="text-button full-width" data-close>화면으로 돌아가기</button>`);
}
async function action(a:Action,plotId?:number){
 if(actionBusy||battleView){toast('지금 하던 일을 마치고 함께해요.');return;}
 if(a==='hunt'){openModal('hunt');return;}
 if(plotId!==undefined&&['plant','water','harvest'].includes(a))selectedPlotId=plotId;
 const before=performAction(state,a,plotId);
 if(!before.ok){if(a==='repair'&&state.truckHealth>=100)toast(before.message);else showActivityHelp(a,plotId,before.message);return;}
 if(animatedActions.includes(a)){
  actionBusy=true;app.setAttribute('aria-busy','true');renderControls();
  closeModal();
  setZone(a==='chop'?'grove':'home',['plant','water','harvest'].includes(a));renderControls();
  const status=document.querySelector<HTMLElement>('.chore-status')!;
  status.innerHTML=`<span class="chore-pulse">${icon(a==='chop'?'wood':a==='expand'?'hammer':'seeds')}</span><div><strong>${escape(state.name)}의 작은 일상</strong><span>${choreLabels[a as ChoreAction]}</span><div class="chore-track"><i></i></div></div>`;
  status.hidden=false;
  try { await scene.playAction(a as ChoreAction,plotId); }
  catch {toast('작업을 마치지 못했어요. 다시 시도해 주세요.');status.hidden=true;actionBusy=false;app.removeAttribute('aria-busy');renderControls();return;}
  actionBusy=false;status.hidden=true;app.removeAttribute('aria-busy');
 }
 const result=performAction(state,a,plotId);
 state=result.state;if(animatedActions.includes(a))setZone(a==='chop'?'grove':'home',['plant','water','harvest'].includes(a));toast(result.message);
 if(result.ok){ping();persist();scene.focus(a==='pet'?'pet':a==='expand'?'truck':a==='chop'?'grove':a==='plant'||a==='water'||a==='harvest'?'farm':'character');}
 render();
 if(currentModal==='quests')openModal('quests');
 if(currentModal==='pet')openModal('pet');
 if(currentModal==='hunt')openModal('hunt');
}
function startBattle(){
 if(actionBusy||battleView)return;
 const started=beginHunt(state,selectedStage);
 if(!started.ok){showActivityHelp('hunt',undefined,started.message);return;}
 state=started.state;const expeditionId=state.expedition!.id;persist();
 closeModal();scene.setSuspended(true);app.inert=true;document.body.classList.add('in-battle');
 try {
  battleView=new BattleView({gender:state.gender,name:state.name,level:state.level,health:state.health,stage:selectedStage,onFinish:(result:BattleResult)=>{
   const finished=finishHunt(state,result,expeditionId);state=finished.state;
   if(!finished.ok&&state.expedition?.id===expeditionId)state=cancelHunt(state).state;
   battleView?.destroy();battleView=null;app.inert=false;document.body.classList.remove('in-battle');scene.setSuspended(false);setZone('home');persist();render();toast(finished.message);
  }});
 }catch{
  state=cancelHunt(state).state;battleView?.destroy();battleView=null;app.inert=false;document.body.classList.remove('in-battle');scene.setSuspended(false);persist();render();toast('전투 화면을 열지 못해 트럭으로 돌아왔어요.');
 }
}
function modalShell(eyebrow:string,title:string,body:string,wide=false){const root=document.querySelector<HTMLElement>('#modal-root')!;root.hidden=false;root.innerHTML=`<section class="modal ${wide?'modal-wide':''}" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button class="modal-close round-button" data-close aria-label="닫기">${icon('close')}</button><div class="eyebrow">${eyebrow}</div><h2 id="modal-title">${title}</h2>${body}</section>`;requestAnimationFrame(()=>root.querySelector<HTMLButtonElement>('button')?.focus());}
function closeModal(){document.querySelector<HTMLElement>('#modal-root')!.hidden=true;currentModal='';updateNav();}
function farmContent(){return `<p class="modal-description">작업을 고르면 캐릭터가 밭으로 직접 걸어가요.<br>씨앗을 뿌리고, 물을 주고, 자라난 당근을 수확해 보세요.</p><div class="farm-grid">${state.plots.map((p,i)=>{const progress=getCropProgress(state,p);const planted=p.plantedAt!==null;return `<article class="plot-card" data-plot-card="${p.id}"><div class="plot-illustration ${!planted?'empty':''}">${icon(planted?(progress>=1?'plot-ready':'plot-sprout'):'plot-empty')}</div><h3>${i+1}번 텃밭</h3><span class="plot-state">${!planted?'새로운 씨앗을 기다려요':progress>=1?'수확할 준비가 됐어요!':p.watered?'쑥쑥 자라는 중':'목이 말라요. 물을 주세요'}</span><div class="quest-progress"><span style="width:${progress*100}%"></span></div><button class="button ${planted&&progress<1?'button-light':''}" data-action="${!planted?'plant':progress>=1?'harvest':'water'}" data-plot="${p.id}" ${planted&&p.watered&&progress<1?'disabled':''}>${icon(!planted?'seeds':progress>=1?'food':'water')}${!planted?'씨앗 심기':progress>=1?'수확하기':p.watered?'잘 자라고 있어요':'물 주기'}</button></article>`;}).join('')}</div><div class="info-note">${icon('clock')} 게임 시간에 따라 자라요. 앱을 닫으면 시간도 쉬어 갑니다.</div>`;}
function renderFarm(){
 const body=document.querySelector('#farm-content');if(!body)return;
 const cards=Array.from(body.querySelectorAll<HTMLElement>('[data-plot-card]'));
 if(cards.length!==state.plots.length||cards.some((card,i)=>card.dataset.plotCard!==String(state.plots[i].id))){body.innerHTML=farmContent();return;}
 // Keep each touch target mounted as crops grow. Replacing the full dialog every
 // second can remove a button between a phone's pointer-down and pointer-up.
 cards.forEach((card,i)=>{
  const p=state.plots[i],progress=getCropProgress(state,p),planted=p.plantedAt!==null;
  const artKey=!planted?'plot-empty':progress>=1?'plot-ready':'plot-sprout';
  const art=card.querySelector<HTMLElement>('.plot-illustration')!;art.classList.toggle('empty',!planted);
  if(art.dataset.cropArt!==artKey){art.innerHTML=icon(artKey);art.dataset.cropArt=artKey;}
  const detail=card.querySelector<HTMLElement>('.plot-state')!,text=!planted?'새로운 씨앗을 기다려요':progress>=1?'수확할 준비가 됐어요!':p.watered?'쑥쑥 자라는 중':'목이 말라요. 물을 주세요';
  if(detail.textContent!==text)detail.textContent=text;
  card.querySelector<HTMLElement>('.quest-progress>span')!.style.width=`${progress*100}%`;
  const button=card.querySelector<HTMLButtonElement>('[data-action]')!,a=!planted?'plant':progress>=1?'harvest':'water',label=!planted?'씨앗 심기':progress>=1?'수확하기':p.watered?'잘 자라고 있어요':'물 주기';
  const key=`${a}:${label}`;button.dataset.action=a;button.classList.toggle('button-light',planted&&progress<1);button.disabled=planted&&p.watered&&progress<1;
  if(button.dataset.cropAction!==key){button.innerHTML=icon(a==='plant'?'seeds':a==='harvest'?'food':'water')+label;button.dataset.cropAction=key;}
 });
}
function bagContent(){return `<p class="modal-description">도로에서 모은 것들이 우리의 내일을 만들어요.</p><div class="inventory-grid">${resources.map(r=>`<div class="inventory-item"><span class="resource-icon ${r}">${icon(r)}</span><strong>${resourceLabels[r]}</strong><b><span data-inventory-count="${r}">${state.resources[r]}</span><small>${r==='water'?' L':' 개'}</small></b><p>${({wood:'트럭을 넓힐 때 써요',scrap:'튼튼한 집의 재료예요',food:'휴식과 여행의 힘이 돼요',water:'텃밭에 생기를 더해요',seeds:'새로운 먹거리를 심어요'})[r]}</p></div>`).join('')}</div><button class="button full-width" data-action="gather">${icon('wood')} 주변에서 자원 찾기</button><button class="button button-light full-width inventory-map-link" data-open="map">${icon('map')} 도로 주변 지도 보기</button>`;}
function renderBag(){const body=document.querySelector('#bag-content');if(body)for(const r of resources){const count=body.querySelector<HTMLElement>(`[data-inventory-count="${r}"]`)!;if(count.textContent!==String(state.resources[r]))count.textContent=String(state.resources[r]);}}
function openModal(kind:string){if(actionBusy||battleView)return;currentModal=kind;updateNav();
 if(kind==='farm')modalShell('LITTLE GARDEN','트럭 위 작은 텃밭',`<div id="farm-content">${farmContent()}</div>`,true);
 if(kind==='bag')modalShell('THINGS WE FOUND','우리의 배낭',`<div id="bag-content">${bagContent()}</div>`,true);
 if(kind==='expand'){const cost=expansionCost(state);modalShell('A LITTLE MORE ROOM','우리집을 넓혀 볼까요?',`<div class="expansion-art">${icon('truck')}<span>Lv.${state.deckLevel}</span>${icon('arrow')}<span>${state.deckLevel>=MAX_DECK_LEVEL?'MAX':`Lv.${state.deckLevel+1}`}</span></div><p class="modal-description">옆으로 펼쳐지는 새 데크와 넓어진 통로를 직접 확인해 보세요.<br>확장할 때마다 울타리와 새 텃밭도 함께 늘어나요.</p><div class="cost-row"><span class="${state.resources.wood>=cost.wood?'':'insufficient'}">${icon('wood')} 목재 <strong>${state.resources.wood} / ${cost.wood}</strong></span><span class="${state.resources.scrap>=cost.scrap?'':'insufficient'}">${icon('scrap')} 고철 <strong>${state.resources.scrap} / ${cost.scrap}</strong></span></div><button class="button full-width" data-action="expand" ${state.deckLevel>=MAX_DECK_LEVEL?'disabled':''}>${icon('hammer')} ${state.deckLevel>=MAX_DECK_LEVEL?'최대 크기의 우리집이에요':'데크 확장하기'}</button><button class="text-button full-width" data-action="repair">${icon('shield')} 트럭 수리 · 현재 내구도 ${state.truckHealth}%</button>`);}
 if(kind==='grove'){
  modalShell('THE LITTLE WOODLAND','도로 옆, 우리의 벌목장',`<div class="grove-illustration"><span class="grove-sign">서울 숲길 · 채집 구역</span></div><p class="modal-description">트럭 옆 숲길로 내려가 나무를 직접 베어요.<br>벌목장 화면에서 나무를 누르거나 아래 버튼으로 시작하세요.</p><div class="grove-rewards"><span>${icon('wood')} 목재 <b>+18</b></span><span>${icon('seeds')} 씨앗 <b>+1</b></span><span>${icon('bolt')} 기력 <b>−10</b></span></div><button class="button full-width" data-action="chop">${icon('axe')} ${state.energy<10?'쉬고 나무 베러 가기':'나무 베러 가기'}</button><button class="button button-light full-width grove-look" data-look-grove>${icon('map')} 벌목장 둘러보기</button><div class="grove-salvage"><span>고철과 물이 필요하다면</span><button class="text-button" data-action="gather">버려진 휴게소 탐색 ${icon('arrow')}</button></div>`);
 }
 if(kind==='hunt'){
  const stages=[{id:1,title:STAGE_NAMES[0],desc:'숲에 숨어든 좀비 무리',tag:'추천 Lv.1',style:'forest'},{id:2,title:STAGE_NAMES[1],desc:'바리케이드 너머의 감염자',tag:'추천 Lv.2',style:'toll'},{id:3,title:STAGE_NAMES[2],desc:'거대한 경비병이 지키는 보급품',tag:'추천 Lv.3',style:'ruins'}];
  modalShell('ADVENTURE WITH BORI','보리와 함께, 사냥 출발',`<p class="modal-description">세 번의 웨이브를 지나 보스를 물리치세요.<br>일반 공격은 자동, 강한 일격과 보리의 돌진·회복은 직접 사용할 수 있어요.</p><div class="stage-list">${stages.map(st=>`<button class="stage-card ${st.style} ${selectedStage===st.id?'selected':''}" data-stage="${st.id}" aria-pressed="${selectedStage===st.id}" style="--stage-art:url('${BATTLE_ART_URLS[st.id-1]}')"><span class="stage-number">${String(st.id).padStart(2,'0')}<span>STAGE</span></span><span class="stage-card-body"><small>${st.tag} · 3 WAVES</small><strong>${st.title}</strong><span>${st.desc}</span></span><span class="stage-check">${icon(selectedStage===st.id?'check':'chevron')}</span></button>`).join('')}</div><div class="party-preview">${portrait(state.gender)}<span><strong>${escape(state.name)} & 보리</strong><small>체력 ${Math.round(state.health)} · 기력 ${Math.round(state.energy)}</small></span><b>Lv.${state.level}</b></div><div class="battle-reward-preview">${icon('food')} 승리 보상: 식량 ${6+selectedStage*2} · 고철 ${selectedStage*2} · 목재 2</div><button class="button full-width ${state.energy<16||state.health<15?'unavailable':''}" data-start-hunt aria-disabled="${state.energy<16||state.health<15}">${icon('hunt')} 전투 스테이지 입장 <span class="button-cost">기력 16</span></button>${state.energy<16||state.health<15?`<p class="fine-print">건강 15와 기력 16이 필요해요. 먼저 휴식해 주세요.</p><button class="button button-light full-width activity-secondary" data-action="rest">${icon('bed')} 여기서 쉬고 사냥 준비하기</button>`:''}<p class="fine-print">전투 중 앱을 종료하면 보상 없이 귀환해요 · 승리 후 보상 지급</p>`,true);
 }
 if(kind==='quests'){modalShell('ONE STEP AT A TIME','작은 목표, 큰 하루',`<p class="modal-description">서두르지 않아도 괜찮아요. 하나씩 해 나가요.</p><div class="quest-list">${questList(state).map(q=>`<article class="quest-row ${q.complete?'completed':''}"><span class="quest-row-icon">${icon(q.complete?'check':'flag')}</span><div><h3>${escape(q.title)}</h3><p>${escape(q.description)}</p><small>${escape(q.reward)} · 달성 시 자동 지급</small><div class="quest-progress"><span style="width:${Math.min(100,q.current/q.target*100)}%"></span></div></div><b>${q.current}/${q.target}</b></article>`).join('')}</div>`);}
 if(kind==='pet'){modalShell('YOUR VERY BEST FRIEND','보리와 쉬어 가기',`<div class="pet-modal-art">${petPortrait()}<span>${icon('heart')}</span></div><p class="pet-dialogue">“멍! 오늘도 네 옆에 있을게.”</p><p class="modal-description">보리는 우리집을 자유롭게 뛰어다녀요.<br>쓰다듬으며 마음의 여유를 찾아보세요.</p><div class="bond-meter"><span>우리의 행복</span><strong>${Math.round(state.morale)} / 100</strong><div class="quest-progress"><span style="width:${state.morale}%"></span></div></div><button class="button full-width" data-action="pet">${icon('paw')} 보리 쓰다듬기</button>`);}
 if(kind==='character'||kind==='welcome'){selectedGender=state.gender;modalShell(kind==='welcome'?'YOUR STORY STARTS HERE':'MEET YOUR SURVIVOR',kind==='welcome'?'우리의 첫 번째 아침':'오늘의 나를 만나기',`<p class="modal-description">2187년, 좀비로 가득한 대한민국.<br>커다란 트럭 위에서 당신만의 작은 일상을 시작하세요.</p><div class="character-choices"><button data-gender="female" class="character-choice ${selectedGender==='female'?'selected':''}">${portrait('female')}<strong>여자 생존자</strong><span>다정하고 씩씩한 모험가</span></button><button data-gender="male" class="character-choice ${selectedGender==='male'?'selected':''}">${portrait('male')}<strong>남자 생존자</strong><span>따뜻하고 든든한 모험가</span></button></div><label class="name-label" for="player-name">어떤 이름으로 불러 드릴까요?</label><input class="name-input" id="player-name" maxlength="16" value="${escape(state.name)}" placeholder="생존자의 이름" autocomplete="off"><button class="button full-width" data-start>${icon('sun')} ${kind==='welcome'?'우리집에서 시작하기':'변경 저장하기'}</button><p class="fine-print">캐릭터는 언제든 변경할 수 있어요 · 기기에 자동 저장</p>`);}
 if(kind==='map'){modalShell('BEYOND OUR LITTLE HOME','도로 너머로 한 걸음',`<p class="modal-description">서울 외곽 순환도로 · 현재 주둔지<br>트럭을 중심으로 주변을 탐색해 생활에 필요한 자원을 구해요.</p><div class="explore-map"><span class="map-home">${icon('truck')} 우리집</span><span class="map-stop s1">${icon('wood')}</span><span class="map-stop s2">${icon('hunt')}</span><span class="map-caption">SEOUL OUTER RING ROAD</span></div><div class="exploration-list"><button data-action="gather"><span class="resource-icon wood">${icon('wood')}</span><span><strong>버려진 휴게소</strong><small>목재 · 고철 · 생활 물자 수집</small></span>${icon('arrow')}</button><button data-open="grove"><span class="resource-icon wood">${icon('wood')}</span><span><strong>도로 옆 벌목장</strong><small>직접 나무 베기 · 목재 +18</small></span>${icon('arrow')}</button><button data-open="hunt"><span class="resource-icon food">${icon('hunt')}</span><span><strong>좀비가 숨어든 사냥터</strong><small>전투 스테이지 3곳 · 승리 보상</small></span>${icon('arrow')}</button></div><div class="info-note">${icon('shield')} 바깥에는 좀비가 있어요. 건강과 기력을 챙겨 주세요.</div>`,true);}
 if(kind==='journal'){modalShell('POSTCARDS FROM THE ROAD','우리의 여행 일지',`<div class="journal-day">DAY ${String(state.day).padStart(2,'0')}<span>도로 위에서 함께한 날들</span></div><div class="journal-stats"><div><b>${state.stats.harvests}</b><span>번의 수확</span></div><div><b>${state.stats.chops}</b><span>번의 벌목</span></div><div><b>${state.stats.battlesWon}</b><span>번의 전투 승리</span></div></div><div class="journal-entries">${state.log.slice(0,12).map(l=>`<div>${icon('leaf')}<p>${escape(l)}</p></div>`).join('')||'<p>작은 행동으로 첫 번째 이야기를 써 보세요.</p>'}</div>`);}
 if(kind==='settings')renderSettings();
 if(kind==='guide'){modalShell('WELCOME TO ROAD HAVEN','천천히, 함께 살아가기',`<div class="guide-list">${[['seeds','심고, 돌보고, 수확해요','화면의 밭을 누르면 바로 할 일이 나와요. 아래 수확·물 주기·씨앗 심기 버튼은 할 수 있는 밭을 찾아 한 곳씩 돌봐요. 캐릭터가 작업을 마치면 자원이 반영돼요.'],['wood','도로 너머를 탐색해요','벌목장에서 나무를 베어 목재를 얻고, 휴게소를 탐색해 물과 고철을 모아요. 사냥은 별도 전투 스테이지에서 진행돼요.'],['hammer','트럭을 우리집으로 만들어요','재료를 모아 새 판자를 놓으면 데크의 외곽과 통로가 넓어져요. 확장할 때마다 새 텃밭도 생겨요.'],['bed','쉼도 소중한 하루예요','활동하면 기력이 줄어요. 쉬면서 회복하고, 보리를 쓰다듬어 행복을 채워요.'],['shield','우리의 일상은 저장돼요','진행 상황은 이 기기에 자동 저장돼요. 앱을 삭제하거나 데이터를 지우면 저장도 사라져요.']].map(([i,t,d])=>`<div><span>${icon(i)}</span><article><h3>${t}</h3><p>${d}</p></article></div>`).join('')}</div>`);}
 if(kind==='reset')modalShell('A FRESH START','새로운 여행을 시작할까요?',`<p class="modal-description">현재 기기의 모든 진행 상황이 지워집니다.<br>이 작업은 되돌릴 수 없어요.</p><button class="button button-danger full-width" data-reset>진행 상황을 지우고 새로 시작</button><button class="text-button full-width" data-close>지금의 여행 계속하기</button>`);
}
function renderSettings(){modalShell('MAKE YOURSELF AT HOME','우리집 설정',`<div class="settings-row"><div><strong>게임 소리</strong><p>작은 행동에 기분 좋은 소리를 더해요</p></div><button class="toggle ${sound?'on':''}" data-sound aria-label="게임 소리 ${sound?'끄기':'켜기'}" aria-pressed="${sound}"><span></span></button></div><div class="settings-row"><div><strong>시간 흐름</strong><p>현재 ${paused?'쉬어 가는 중':'흘러가는 중'}</p></div><button class="button button-light small" data-pause>${paused?'계속하기':'잠시 멈춤'}</button></div><div class="update-box"><div class="update-heading">${icon('download')}<strong>앱 업데이트</strong><span>v${APP_VERSION}</span></div><p>${escape(lastUpdate?.message??'앱을 시작할 때 새 버전을 확인해요.')}</p>${lastUpdate?.release?`<div class="release-notes">${escape(lastUpdate.release.notes)}</div>`:''}<button class="button button-light full-width" data-update ${updateBusy?'disabled':''}>${updateBusy?'확인하는 중…':'새 버전 확인'}</button>${lastUpdate?.status==='available'?'<button class="button full-width" data-download>새 APK 다운로드</button><small>다운로드 후 Android 설치 확인을 진행해 주세요.</small>':''}</div><button class="text-button full-width" data-save>${icon('check')} 지금 저장하기</button><button class="text-button danger full-width" data-open="reset">새로운 여행 시작</button><p class="fine-print">ROAD HAVEN · 로드헤이븐 v${APP_VERSION}<br>당신의 기기에 머무는 작은 세상</p>`);}
async function runUpdate(manual=false){if(updateBusy)return;updateBusy=true;if(currentModal==='settings')renderSettings();lastUpdate=await checkUpdate();updateBusy=false;if(currentModal==='settings')renderSettings();else if(lastUpdate.status==='available')toast('새 버전이 도착했어요! 설정에서 업데이트를 확인하세요.');if(manual&&currentModal!=='settings')toast(lastUpdate.message);}
document.addEventListener('click',e=>{const t=(e.target as Element).closest<HTMLElement>('button,a');if(!t||!t.closest('#app')||battleView)return;if(actionBusy){e.preventDefault();toast('하던 작업을 마치면 다시 움직일 수 있어요.');return;}if(t.matches('a[href="#"]')){e.preventDefault();closeModal();}
 if(t.dataset.nav){const nav=t.dataset.nav;if(nav==='home'||nav==='farm'||nav==='grove'){closeModal();setZone(nav==='grove'?'grove':'home',nav==='farm');if(nav==='farm')selectPlot(preferredPlot()?.id??null);else renderControls();}else openModal(nav);}
 if(t.dataset.open)openModal(t.dataset.open);
 if(t.dataset.zone){closeModal();setZone(t.dataset.zone as 'home'|'grove');renderControls();}
 if(t.hasAttribute('data-look-grove')){closeModal();setZone('grove');renderControls();}
 if(t.dataset.stage){selectedStage=Number(t.dataset.stage);openModal('hunt');}
 if(t.hasAttribute('data-start-hunt'))startBattle();
 if(t.hasAttribute('data-close'))closeModal();
 if(t.hasAttribute('data-show-farm')){closeModal();setZone('home',true);selectPlot(preferredPlot()?.id??null);}
 if(t.dataset.restRetry){const retry=t.dataset.restRetry as Action,plot=t.dataset.plot!==undefined?Number(t.dataset.plot):undefined;closeModal();const rested=performAction(state,'rest');if(rested.ok){state=rested.state;persist();render();toast(rested.message);void action(retry,plot);}else toast(rested.message);}
 if(t.dataset.plotStep){const index=state.plots.findIndex(p=>p.id===selectedPlotId);const next=(index+Number(t.dataset.plotStep)+state.plots.length)%state.plots.length;setZone('home',true);selectPlot(state.plots[next]?.id??null);}
 if(t.dataset.quick){const a=t.dataset.quick as Action;const farm=['plant','water','harvest'].includes(a);const plot=farm?quickPlot(a as FarmAction):undefined;if(farm&&plot){selectedPlotId=plot.id;scene.setSelectedPlot(plot.id);}void action(a,plot?.id);}
 if(t.dataset.action)void action(t.dataset.action as Action,t.dataset.plot!==undefined?Number(t.dataset.plot):undefined);
 if(t.dataset.gender){selectedGender=t.dataset.gender as Gender;document.querySelectorAll('[data-gender]').forEach(el=>el.classList.toggle('selected',el===t));}
 if(t.hasAttribute('data-start')){const name=(document.querySelector<HTMLInputElement>('#player-name')?.value??'').trim();if(!name){toast('함께할 생존자의 이름을 알려 주세요.');return;}state={...state,gender:selectedGender,name:name.slice(0,16)};persist();closeModal();render();toast(`${state.name}, 우리집에 온 걸 환영해요!`);}
 if(t.hasAttribute('data-sound')){sound=!sound;document.querySelector('.sound-toggle')!.innerHTML=icon(sound?'volume':'mute');document.querySelector('.sound-toggle')!.setAttribute('aria-label',sound?'소리 끄기':'소리 켜기');if(sound)ping();if(currentModal==='settings')renderSettings();}
 if(t.hasAttribute('data-pause')){paused=!paused;document.querySelector('.time-button')!.innerHTML=icon(paused?'play':'pause');document.querySelector('.time-button')!.setAttribute('aria-label',paused?'시간 계속':'시간 일시정지');if(currentModal==='settings')renderSettings();}
 if(t.hasAttribute('data-save'))toast(persist()?'소중한 하루를 저장했어요.':'저장하지 못했어요. 기기 저장 공간을 확인해 주세요.');
 if(t.hasAttribute('data-reset')){state=createGame(state.gender,'하루');selectedPlotId=state.plots[0]?.id??null;setZone('home');persist();render();openModal('welcome');}
 if(t.hasAttribute('data-update'))void runUpdate(true);
 if(t.hasAttribute('data-download')&&lastUpdate?.release)void downloadUpdate(lastUpdate.release).catch(()=>toast('다운로드를 열지 못했어요. 잠시 후 다시 시도해 주세요.'));
});
document.querySelector('#modal-root')!.addEventListener('click',e=>{if(e.target===e.currentTarget)closeModal();});
document.addEventListener('keydown',e=>{if(battleView||actionBusy)return;if(e.key==='Escape')closeModal();if(e.key==='Tab'&&currentModal){const els=Array.from(document.querySelectorAll<HTMLElement>('#modal-root button:not([disabled]), #modal-root input'));const first=els[0],last=els.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}});
let saveCounter=0;
setInterval(()=>{if(paused||document.hidden||actionBusy||battleView||currentModal==='welcome')return;state=tick(state,1);render();if(++saveCounter>=10){persist();saveCounter=0;}},1000);
document.addEventListener('visibilitychange',()=>{if(document.hidden)persist();else void runUpdate();});
window.addEventListener('pagehide',persist);
render();
if(!stored)openModal('welcome');
if(recoveredExpedition){persist();toast('이전 원정에서 안전하게 귀환했어요. 트럭에서 다시 출발할 수 있어요.');}
void runUpdate();
