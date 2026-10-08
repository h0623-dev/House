import '@fontsource-variable/dm-sans';
import './style.css';
import './gameplay.css';
import { createGame, performAction, tick, saveGame, loadGame, expansionCost, questList, getCropProgress, resourceLabels, MAX_DECK_LEVEL, beginHunt, finishHunt, cancelHunt, type Action, type Gender, type Resource, type CropId, CROPS, CROP_IDS, getSeedInventory, getSeedCount, getPlotCropId } from './game';
import { Scene } from './scene';
import { BUILDINGS, BUILDING_TYPES, getSettlement, getUnlockedSlots, buildFacility, moveFacility, upgradeFacility, startProduction, collectProduction, getSettlementGoals, type BuildingType } from './settlement';
import { buildingCatalog, facilitySheet, productionState } from './settlement-ui';
import { facilityIcon } from './settlement-art';
import { BattleView } from './battle-view';
import { STAGE_NAMES, type BattleResult } from './battle';
import { icon, portrait } from './icons';
import { petPortrait } from './creatures';
import { BATTLE_ART_URLS } from './battle-art';
import { cropIcon } from './crop-art';
import { APP_VERSION, checkUpdate, downloadUpdate, initializeAutoUpdates, prepareAutomaticUpdate, installPreparedUpdate, isNativeUpdateSupported, type AutomaticUpdateState, type UpdateResult } from './update';
import { initializeLiveUpdates, checkLiveUpdate, activateLiveUpdate, type LiveUpdateState } from './live-update';

const stored = loadGame();
let state = stored ?? createGame('female', '하루');
const recoveredExpedition = Boolean(state.expedition);
if (recoveredExpedition) state = cancelHunt(state).state;
let actionBusy = false;
type FarmAction='plant'|'water'|'harvest';
type FarmJob={action:FarmAction;plotId:number;cropId:CropId};
let farmMode:FarmAction|null=null;
const selectedSeedStorageKey='road-haven-selected-seed-v1';
const preferredSeed=loadPreferredSeed();
let selectedCropId:CropId=preferredSeed??'carrot';
let seedChosen=preferredSeed!==null;
let farmQueue:FarmJob[]=[];
let runningFarm:FarmJob|null=null;
let drainingFarmQueue=false;
let afterFarm: (()=>void)|null=null;
let battleView: BattleView | null = null;
let selectedStage = 1;
let selectedZone: 'home'|'grove' = 'home';
let selectedPlotId: number | null = state.plots[0]?.id ?? null;
let farmFocused = false;
let farmTrayOpen=false;
let selectedFacilityId:number|null=null;
let placement:{type:BuildingType;slot:number|null;movingId?:number}|null=null;
let paused = false;
let sound = false;
let selectedGender:Gender=state.gender;
let currentModal='';
let lastUpdate:UpdateResult|undefined;
let updateBusy=false;
let automaticUpdate:AutomaticUpdateState={status:'idle',progress:0,message:'앱 기능의 새 버전을 자동으로 확인해요.'};
let liveUpdate:LiveUpdateState={status:'idle',progress:0,message:'게임 콘텐츠는 앱 안에서 자동으로 업데이트해요.'};
let updateInitializing:Promise<void>|null=null;
let installAfterWork=false;
let contentActivationPending=false;
let toastTimer:ReturnType<typeof setTimeout>;
let audioContext:AudioContext|undefined;
const app = document.querySelector<HTMLDivElement>('#app')!;
const contentApplyingNotice=document.createElement('div');
contentApplyingNotice.className='content-applying-notice';contentApplyingNotice.hidden=true;contentApplyingNotice.setAttribute('role','status');contentApplyingNotice.setAttribute('aria-live','polite');
contentApplyingNotice.innerHTML='<strong>게임 업데이트 적용 중</strong><span>진행을 저장했어요. 잠시만 기다려 주세요.</span>';document.body.append(contentApplyingNotice);
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const navItems=[['home','우리 트럭','home'],['hammer','건설','build'],['seeds','농장','farm'],['map','탐험','hunt'],['bag','창고','bag'],['settings','설정','settings']];
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
    <div class="scene-top"><div class="scene-label"><span class="live-dot"></span><strong id="zone-name">우리 트럭</strong><span id="truck-level">Lv.1</span></div><button class="scene-icon" data-open="guide" aria-label="게임 도움말">?</button></div>
    <div class="scene-weather"><span id="weather-icon">${icon('sun')}</span><div><strong id="clock">08:00</strong><small id="weather-text">기분 좋은 아침</small></div><button data-pause class="time-button" aria-label="시간 일시정지">${icon('pause')}</button></div>
    <div class="scene-tools"><button class="game-tool" data-open="build" aria-label="시설 건설"><span>${icon('hammer')}</span><small>건설</small></button><button class="game-tool" data-open="expand" aria-label="트럭 확장"><span>${icon('expand')}</span><small>확장</small></button><button class="game-tool" data-open="settlement-goals" aria-label="마을 목표"><span>${icon('flag')}</span><small>목표</small></button></div>
    <button class="update-badge" id="update-badge" hidden data-update-notice aria-live="polite"><span>${icon('download')}</span><div><strong></strong><small></small></div></button>
    <div class="map-controls"><button data-map-zoom="1" aria-label="지도 확대">+</button><button data-map-zoom="-1" aria-label="지도 축소">−</button><button data-farm-toggle aria-label="농사 도구 펼치기"><span>${icon('seeds')}</span><small>농사 도구</small></button></div>
    <button class="settlement-objective" id="settlement-objective" data-next-goal><span>${icon('flag')}</span><div><small>도로 위 우리 마을</small><strong id="objective-title">첫 시설을 지어 보세요</strong><p id="objective-detail">건설 → 생산 → 수령 → 데크 확장</p></div>${icon('chevron')}</button>
    <div class="construction-bar" id="construction-bar" hidden aria-live="polite"></div>
    <section class="facility-sheet" id="facility-sheet" hidden aria-label="선택한 시설"></section>
    <div class="chore-status" hidden role="status" aria-live="polite"></div>
    <div class="game-controls" id="farm-tray" hidden>
     <div class="planting-toolbar" id="planting-toolbar" hidden aria-label="연속 텃밭 작업">
      <div class="planting-selection"><span id="planting-seed-art"></span><div><strong id="planting-seed-name"></strong><small id="planting-seed-status" role="status" aria-live="polite"></small></div></div>
      <button class="planting-tool" data-plant-all aria-label="빈 밭에 선택한 씨앗 연속 심기"><span>${icon('seeds')}</span><small>모두 심기</small></button>
      <button class="planting-tool" data-seed-change aria-label="다른 씨앗 선택"><span>${icon('bag')}</span><small>씨앗 바꾸기</small></button>
      <button class="planting-tool" data-plant-cancel aria-label="연속 심기 종료"><span>${icon('close')}</span><small>심기 종료</small></button>
     </div>
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
 if(battleView||contentActivationPending)return;
 if(kind==='build-slot'){if(plotId!==undefined){if(placement)previewConstruction(plotId);else if(!actionBusy){if(plotId>=getUnlockedSlots(state)){openModal('expand');toast(`데크 Lv.${Math.floor(plotId/2)+1}로 확장하면 새 자리가 열려요.`);}else openModal('build');}}return;}
 if(kind==='facility'){if(plotId!==undefined&&!actionBusy){if(placement)toast('빈 자리를 눌러 시설을 놓아 주세요.');else selectFacility(plotId);}return;}
 if(kind==='farm'&&farmMode){if(plotId!==undefined)enqueueFarmPlot(plotId);return;}
 if(actionBusy)return;
 if(kind==='farm'){setZone('home',true);selectPlot(plotId??preferredPlot()?.id??state.plots[0]?.id??null);}
 else if(farmMode)stopFarmMode();
 if(kind==='truck')openModal('expand');
 if(kind==='pet')openModal('pet');
 if(kind==='character')openModal('character');
 if(kind==='grove'){setZone('grove');renderControls();}
 if(kind==='grove-work'){setZone('grove');renderControls();void action('chop');}
});
function setFarmTray(open:boolean){
 farmTrayOpen=open;document.querySelector<HTMLElement>('#farm-tray')!.hidden=!open;
 document.querySelector('.scene-card')!.classList.toggle('farm-tray-open',open);
 const toggle=document.querySelector<HTMLButtonElement>('[data-farm-toggle]')!;
 toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',open?'농사 도구 접기':'농사 도구 펼치기');
 toggle.querySelector('small')!.textContent=open?'도구 접기':'농사 도구';
}
function closeFacility(){document.querySelector('#toast')!.classList.remove('facility-toast');selectedFacilityId=null;scene.setSelectedFacility(null);document.querySelector<HTMLElement>('#facility-sheet')!.hidden=true;document.querySelector('.scene-card')!.classList.remove('facility-selected');}
function cancelConstruction(){placement=null;scene.setConstructionMode(null);document.querySelector<HTMLElement>('#construction-bar')!.hidden=true;document.querySelector('.scene-card')!.classList.remove('construction-mode');}
function selectFacility(id:number){
 const facility=getSettlement(state).buildings.find(b=>b.id===id);if(!facility)return;
 cancelConstruction();stopFarmMode();closeModal();setZone('home');setFarmTray(false);selectedFacilityId=id;scene.setSelectedFacility(id);renderSettlement();
}
function beginConstruction(type:BuildingType,movingId?:number){
 if(battleView||actionBusy)return;
 const definition=BUILDINGS[type];
 if(state.deckLevel<definition.unlockLevel){toast(`데크 Lv.${definition.unlockLevel}부터 ${definition.name}을 지을 수 있어요.`);openModal('expand');return;}
 closeModal();closeFacility();stopFarmMode();setZone('home');setFarmTray(false);
 placement={type,slot:null,...(movingId!==undefined?{movingId}:{})};scene.setConstructionMode(type,undefined,movingId);renderSettlement();
 toast(movingId?'빈 자리를 눌러 시설을 옮겨 보세요.':'빈 자리를 누르고 건설을 확정해 주세요.');
}
function previewConstruction(slot:number){
 if(!placement||slot<0)return;
 if(slot>=getUnlockedSlots(state)){toast(`데크 Lv.${Math.floor(slot/2)+1}로 확장하면 이 자리를 사용할 수 있어요.`);return;}
 const occupied=getSettlement(state).buildings.some(b=>b.slot===slot&&b.id!==placement?.movingId);
 if(occupied){toast('이미 시설이 있는 자리예요. 다른 빈 자리를 눌러 주세요.');return;}
 placement.slot=slot;scene.setConstructionMode(placement.type,slot,placement.movingId);renderSettlement();
}
function confirmConstruction(){
 if(!placement||placement.slot===null||actionBusy||battleView)return;
 const plan=placement,result=plan.movingId!==undefined?moveFacility(state,plan.movingId,plan.slot!):buildFacility(state,plan.type,plan.slot!);
 if(!result.ok){toast(result.message);return;}
 state=result.state;cancelConstruction();persist();render();ping();toast(result.message);
 const building=plan.movingId!==undefined?getSettlement(state).buildings.find(b=>b.id===plan.movingId):getSettlement(state).buildings.find(b=>b.slot===plan.slot);
 if(building)selectFacility(building.id);
}
function operateFacility(kind:'start'|'collect'|'upgrade',id:number){
 if(actionBusy||battleView||placement)return;
 const result=kind==='start'?startProduction(state,id):kind==='collect'?collectProduction(state,id):upgradeFacility(state,id);
 if(result.ok){state=result.state;persist();render();ping();}toast(result.message);
}
function openFacilityUpgrade(id:number){
 const building=getSettlement(state).buildings.find(b=>b.id===id);if(!building)return;
 const definition=BUILDINGS[building.type];
 if(building.level>=definition.maxLevel){toast('이미 최대 레벨의 시설이에요.');return;}
 if(building.readyAt!==null){toast('진행 중인 생산품을 먼저 수령해 주세요.');return;}
 const next=building.level+1;currentModal='facility-upgrade';
 modalShell('MAKE ROOM FOR MORE',`${definition.name} Lv.${next}`,`<div class="upgrade-facility-art">${facilityIcon(building.type)}${icon('arrow')}<strong>Lv.${next}</strong></div><p class="modal-description">한 번에 만드는 생산품이 ${definition.yieldAmount*building.level}개에서 ${definition.yieldAmount*next}개로 늘어나요.<br>생산에 쓰는 재료도 시설 레벨에 맞춰 늘어나요.</p><div class="cost-row"><span>${icon('wood')} 목재 <strong>${state.resources.wood} / ${definition.wood*next}</strong></span><span>${icon('scrap')} 고철 <strong>${state.resources.scrap} / ${definition.scrap*next}</strong></span></div><button class="button full-width" data-upgrade-confirm="${id}">${icon('hammer')} 재료를 사용해 레벨 올리기</button>`);
}
function settlementGoalsContent(){return `<p class="modal-description">먼 미래 대한민국의 도로 위에서<br>작은 트럭을 우리가 살아가는 마을로 바꿔요.</p><div class="village-steps"><span>건설</span>${icon('arrow')}<span>생산</span>${icon('arrow')}<span>수령</span>${icon('arrow')}<span>확장</span></div><div class="quest-list">${getSettlementGoals(state).map(goal=>`<article class="quest-row ${goal.complete?'completed':''}"><span class="quest-row-icon">${icon(goal.complete?'check':'flag')}</span><div><h3>${escape(goal.title)}</h3><p>${escape(goal.description)}</p><div class="quest-progress"><span style="width:${Math.min(100,goal.current/goal.target*100)}%"></span></div></div><b>${goal.current}/${goal.target}</b></article>`).join('')}</div><button class="button button-light full-width village-old-goals" data-open="quests">${icon('flag')} 생존 목표도 확인하기</button>`;}
function nextSettlementStep(){
 const goal=getSettlementGoals(state).find(g=>!g.complete);
 if(goal?.id==='wider-settlement'){openModal('expand');return;}
 if(goal?.id==='different-facilities'){openModal('build');return;}
 const buildings=getSettlement(state).buildings,ready=buildings.find(b=>productionState(state,b).ready),running=buildings.find(b=>productionState(state,b).running);
 if(!buildings.length)openModal('build');else if(ready)selectFacility(ready.id);else if(running)selectFacility(running.id);else selectFacility(buildings[0].id);
}
function renderSettlement(){
 document.querySelector('#toast')!.classList.toggle('facility-toast',selectedFacilityId!==null);
 const settlement=getSettlement(state),goals=getSettlementGoals(state),goal=goals.find(g=>!g.complete),ready=settlement.buildings.filter(b=>productionState(state,b).ready).length;
 document.querySelector('#objective-title')!.textContent=goal?.title??'도로 위 마을이 자라고 있어요';
 document.querySelector('#objective-detail')!.textContent=goal?`${goal.description} · ${goal.current}/${goal.target}`:'새 시설을 짓고 생산하며 오늘의 마을을 돌봐요';
 const buildTab=document.querySelector<HTMLButtonElement>('[data-nav="build"]')!;buildTab.dataset.ready=String(ready);buildTab.setAttribute('aria-label',ready?`건설 · 수령할 생산품 ${ready}곳`:'건설');
 if(placement){
  const bar=document.querySelector<HTMLElement>('#construction-bar')!,definition=BUILDINGS[placement.type],moving=placement.movingId!==undefined,key=`${placement.type}:${placement.slot}:${placement.movingId??''}`;
  bar.hidden=false;document.querySelector('.scene-card')!.classList.add('construction-mode');
  if(bar.dataset.preview!==key){bar.dataset.preview=key;bar.innerHTML=`<span class="construction-art">${facilityIcon(placement.type)}</span><div class="construction-info"><strong>${definition.name}${moving?' 옮기기':''}</strong><small>${placement.slot===null?'트럭 위 빈 자리를 눌러요':`${placement.slot+1}번 자리 · 미리 보기`}</small><span class="construction-cost">${moving?'옮기기는 무료예요':`${icon('wood')} <b data-placement-wood></b> / ${definition.wood} ${icon('scrap')} <b data-placement-scrap></b> / ${definition.scrap}`}</span></div><button class="placement-confirm" data-construction-confirm ${placement.slot===null?'disabled':''}>${icon('check')}<small>${moving?'이동 확정':'건설 확정'}</small></button><button class="placement-cancel" data-construction-cancel>${icon('close')}<small>취소</small></button>`;}
  const wood=bar.querySelector<HTMLElement>('[data-placement-wood]'),scrap=bar.querySelector<HTMLElement>('[data-placement-scrap]');if(wood)wood.textContent=String(state.resources.wood);if(scrap)scrap.textContent=String(state.resources.scrap);
  bar.classList.toggle('insufficient-materials',!moving&&(state.resources.wood<definition.wood||state.resources.scrap<definition.scrap));
 }
 const selected=settlement.buildings.find(b=>b.id===selectedFacilityId);
 if(!selected){if(selectedFacilityId!==null)closeFacility();return;}
 const panel=document.querySelector<HTMLElement>('#facility-sheet')!,definition=BUILDINGS[selected.type],production=productionState(state,selected);
 panel.hidden=false;document.querySelector('.scene-card')!.classList.add('facility-selected');
 if(panel.dataset.facility!==String(selected.id)){panel.dataset.facility=String(selected.id);panel.innerHTML=facilitySheet(state,selected);}
 panel.querySelector('[data-facility-level]')!.textContent=`Lv.${selected.level}`;
 panel.querySelector('[data-production-status]')!.textContent=production.ready?'생산품이 준비됐어요!':production.running?`생산 중 · ${Math.ceil(production.remaining)}분 남음`:`한 번 생산으로 ${resourceLabels[definition.yieldResource]}을 모아요`;
 panel.querySelector<HTMLElement>('.facility-progress>i')!.style.width=`${production.progress*100}%`;
 panel.querySelector('[data-production-reward]')!.innerHTML=`${icon(definition.yieldResource)} +${definition.yieldAmount*selected.level}`;
 const start=panel.querySelector<HTMLButtonElement>('[data-facility-start]')!,collect=panel.querySelector<HTMLButtonElement>('[data-facility-collect]')!;
 start.hidden=production.ready;collect.hidden=!production.ready;start.disabled=production.running;start.querySelector('span')!.textContent=production.running?'생산 중…':'생산 시작';
 panel.querySelector<HTMLElement>('.facility-recipe')!.textContent=`${definition.recipe?Object.entries(definition.recipe).map(([r,n])=>`${resourceLabels[r as Resource]} ${Number(n)*selected.level}`).join(' · ')+' 사용':'재료 사용 없이 생산해요'} · 최대 Lv.${definition.maxLevel}`;
 const upgrade=panel.querySelector<HTMLButtonElement>('[data-facility-upgrade]')!;upgrade.title=selected.level>=definition.maxLevel?'최대 레벨이에요':`목재 ${definition.wood*(selected.level+1)} · 고철 ${definition.scrap*(selected.level+1)}`;
}
function updateNav(){
 const active=['build','hunt','bag','settings'].includes(currentModal)?currentModal:selectedZone==='grove'||farmFocused?'farm':'home';
 document.querySelectorAll('[data-nav]').forEach(el=>{const selected=el.getAttribute('data-nav')===active;el.classList.toggle('active',selected);el.setAttribute('aria-current',selected?'page':'false');});
}
function setZone(zone:'home'|'grove',focusFarm=false) {
 selectedZone=zone;farmFocused=zone==='home'&&focusFarm;scene.setZone(zone);scene.setFarmFocus(farmFocused);
 document.querySelector('.scene-card')!.classList.toggle('work-view',zone==='grove'||farmFocused);
 scene.setSelectedPlot(zone==='home'&&farmFocused?selectedPlotId:null);
 setFarmTray(zone==='grove'||farmFocused);
 document.querySelector('#zone-name')!.textContent=zone==='grove'?'도로 옆 벌목장':farmFocused?'트럭 농장':'우리 트럭 마을';
 updateNav();
}
function selectPlot(id:number|null){
 selectedPlotId=id;scene.setSelectedPlot(selectedZone==='home'?id:null);renderControls();
}
function preferredPlot(){return state.plots.find(p=>getCropProgress(state,p)>=1)??state.plots.find(p=>p.plantedAt!==null&&!p.watered)??state.plots.find(p=>p.plantedAt===null)??state.plots[0];}
const actionNames:Record<Action,string>={plant:'씨앗 심기',water:'물 주기',harvest:'수확하기',chop:'나무 베기',gather:'도로 탐색',expand:'데크 확장',rest:'휴식하기',pet:'보리 쓰다듬기',repair:'트럭 수리',hunt:'사냥 출발'};
const actionEnergy:Partial<Record<Action,number>>={plant:4,water:3,harvest:4,chop:10,gather:10,expand:15,repair:6,hunt:16};
function markAvailability(button:HTMLButtonElement,available:boolean,busy:boolean,message:string){
 // Native disabled buttons swallow touch events, so unavailable activities stay
 // tappable and explain how to recover. Only a running chore locks the controls.
 button.disabled=busy;button.setAttribute('aria-disabled',String(busy||!available));button.classList.toggle('unavailable',!available&&!busy);button.title=message;
}
function eligiblePlots(a:FarmAction){return state.plots.filter(p=>a==='plant'?p.plantedAt===null:a==='water'?p.plantedAt!==null&&!p.watered:getCropProgress(state,p)>=1);}
function quickPlot(a:FarmAction){const eligible=eligiblePlots(a);return eligible.find(p=>p.id===selectedPlotId)??eligible[0];}
function renderFarmMode(){
 scene.setFarmMode(farmMode,farmQueue.map(job=>job.plotId),selectedCropId);
 const toolbar=document.querySelector<HTMLElement>('#planting-toolbar')!;
 toolbar.hidden=!farmMode;toolbar.dataset.farmMode=farmMode??'';
 document.querySelector('.scene-card')!.classList.toggle('planting-mode',Boolean(farmMode));
 if(!farmMode)return;
 const crop=CROPS[selectedCropId],waiting=farmQueue.length,artKey=farmMode==='plant'?selectedCropId:farmMode;
 const art=document.querySelector<HTMLElement>('#planting-seed-art')!;
 if(art.dataset.crop!==artKey){art.innerHTML=farmMode==='plant'?cropIcon(selectedCropId,'seed'):icon(farmMode==='water'?'water':'food');art.dataset.crop=artKey;}
 document.querySelector('#planting-seed-name')!.textContent=farmMode==='plant'?`${crop.seedName} · ${getSeedCount(state,selectedCropId)}개`:farmMode==='water'?`연속 물 주기 · 물 ${state.resources.water}개`:`연속 수확 · ${eligiblePlots('harvest').length}곳`;
 let idle='밭을 누르거나 쓸어 연속 작업해요';
 if(!eligiblePlots(farmMode).length)idle=farmMode==='plant'?'빈 밭을 모두 심었어요 · 물 주기로 이어가요':farmMode==='water'?'물을 줄 밭이 없어요 · 다른 도구를 골라요':'수확할 밭이 없어요 · 작물이 자라길 기다려요';
 else if(state.energy<(actionEnergy[farmMode]??0))idle='기력이 부족해요 · 휴식 후 이어서 돌봐요';
 else if(farmMode==='plant'&&!getSeedCount(state,selectedCropId))idle='탐색으로 씨앗 3개씩 모아요';
 else if(farmMode==='water'&&!state.resources.water)idle='물이 부족해요 · 탐색으로 보급해 주세요';
 const working=runningFarm?`${runningFarm.plotId}번 ${farmToolLabels[runningFarm.action].working} · 대기 ${waiting}곳`:waiting?`대기 ${waiting}곳 · 밭을 더 눌러요`:idle;
 document.querySelector('#planting-seed-status')!.textContent=working;
 const all=toolbar.querySelector<HTMLButtonElement>('[data-plant-all]')!;
 all.disabled=Boolean(battleView);all.setAttribute('aria-label',farmToolLabels[farmMode].all);all.setAttribute('aria-disabled',String(!eligiblePlots(farmMode).some(p=>!isPlotReserved(p.id))));
 const allArt=all.querySelector('span')!;if(allArt.getAttribute('data-tool')!==farmMode){allArt.innerHTML=icon(farmMode==='plant'?'seeds':farmMode==='water'?'water':'food');allArt.setAttribute('data-tool',farmMode);}
 all.querySelector('small')!.textContent=farmToolLabels[farmMode].all;
 toolbar.querySelector<HTMLElement>('[data-seed-change]')!.hidden=farmMode!=='plant';
 toolbar.querySelector('[data-plant-cancel]')!.setAttribute('aria-label','연속 텃밭 작업 종료');
 toolbar.querySelector('[data-plant-cancel] small')!.textContent='작업 종료';
 toolbar.setAttribute('aria-label',`${actionNames[farmMode]} 연속 작업`);
}
function renderControls(){
 const busy=actionBusy||Boolean(battleView),farmingBusy=Boolean(runningFarm)&&!battleView;
 for(const [a] of quickItems){
  const button=document.querySelector<HTMLButtonElement>(`[data-quick="${a}"]`)!;
  const farmAction=['plant','water','harvest'].includes(a);
  const plot=farmAction?quickPlot(a as FarmAction):undefined;
  const result=performAction(state,a,plot?.id,selectedCropId);
  if(farmAction){
   const label=a==='plant'?(farmMode==='plant'?'모두 심기':seedChosen?'심기 이어하기':'씨앗 심기'):a==='water'?'물 주기':'수확';
   button.querySelector('small')!.textContent=label;button.setAttribute('aria-label',label);
   markAvailability(button,a==='plant'||farmingBusy||Boolean(plot&&result.ok),busy&&!farmingBusy,a==='plant'?'고른 씨앗을 기억해 연속으로 심어요 · 씨앗 바꾸기에서 다른 종류 선택':result.ok?`${eligiblePlots(a as FarmAction).length}개 밭을 차례로 ${a==='water'?'물 줘요':'수확해요'} · 한 번 선택해 연속 작업`:result.message);
  }else markAvailability(button,result.ok,busy&&!farmingBusy,busy?'지금 작업을 마치고 선택한 활동으로 이어가요':result.ok?(a==='chop'?'목재 +18 · 씨앗 꾸러미 +3 · 기력 10':a==='gather'?'목재 · 고철 · 물 · 씨앗 3개씩 모아요':'체력과 기력을 회복해요'):result.message);
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
  const progress=getCropProgress(state,plot),crop=CROPS[getPlotCropId(plot)];
  contextAction=plot.plantedAt===null?'plant':progress>=1?'harvest':'water';
  label=contextAction==='plant'?(seedChosen?'심기 이어하기':'씨앗 심기'):contextAction==='harvest'?'수확하기':'물 주기';contextIcon=contextAction==='plant'?'seeds':contextAction==='harvest'?'food':'water';
  const result=performAction(state,contextAction,plot.id,selectedCropId);
  detail.textContent=plot.plantedAt!==null&&plot.watered&&progress<1?`${crop.name} 자라는 중 · ${Math.round(progress*100)}%`:contextAction==='plant'?'빈 밭 · 씨앗을 골라 연속 심기':!result.ok?result.message:contextAction==='harvest'?`${crop.name} 수확할 준비가 됐어요!`:`${crop.name}에 물이 필요해요 · ${Math.round(progress*100)}%`;
  actionButton.dataset.plot=String(plot.id);details.dataset.open='farm';details.setAttribute('aria-label','텃밭 전체 보기');details.querySelector('small')!.textContent='전체 밭';
 }
 const needsRest=state.energy<(actionEnergy[contextAction]??0);
 if(grove&&needsRest){label='쉬고 벌목';contextIcon='bed';}
 actionButton.dataset.action=contextAction;actionButton.setAttribute('aria-label',`${grove?'벌목장':`${plot?.id??1}번 밭`} ${label}`);
 actionButton.querySelector('.control-icon')!.innerHTML=contextAction==='harvest'&&plot?cropIcon(getPlotCropId(plot),'produce'):icon(contextIcon);actionButton.querySelector('small')!.textContent=label;
 const contextResult=performAction(state,contextAction,grove?undefined:plot?.id,selectedCropId);
 markAvailability(actionButton,contextAction==='plant'||contextResult.ok,busy,contextAction==='plant'?'씨앗을 선택하고 원하는 빈 밭을 눌러요':contextResult.message);
 context.classList.toggle('grove-context',grove);context.classList.toggle('working',busy);
 context.querySelectorAll<HTMLButtonElement>('[data-plot-step]').forEach(b=>{b.hidden=grove;b.disabled=busy||state.plots.length<2;});
 document.querySelectorAll<HTMLButtonElement>('.game-nav button,.scene-tools button,.scene-icon,.profile-button,.context-details').forEach(b=>b.disabled=busy&&!farmingBusy);
 renderFarmMode();updateNav();
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
 if(currentModal==='seeds')renderSeedInventory();
 renderSettlement();refreshUpdateUI();
}

function persist(){const ok=saveGame(state);document.querySelector('#save-status')!.innerHTML=icon(ok?'check':'shield')+(ok?'여행이 저장되었어요':'저장 공간을 확인해 주세요');return ok;}
function toast(message:string){const el=document.querySelector<HTMLElement>('#toast')!;el.textContent=message;el.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),3500);}
function ping(){if(!sound)return;try{audioContext??=new AudioContext();void audioContext.resume();const osc=audioContext.createOscillator(),gain=audioContext.createGain();osc.type='sine';osc.frequency.setValueAtTime(580,audioContext.currentTime);osc.frequency.exponentialRampToValueAtTime(850,audioContext.currentTime+.08);gain.gain.setValueAtTime(.05,audioContext.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audioContext.currentTime+.22);osc.connect(gain);gain.connect(audioContext.destination);osc.start();osc.stop(audioContext.currentTime+.22);}catch{}}
type ChoreAction = 'plant'|'water'|'harvest'|'chop'|'expand'|'gather';
const animatedActions:Action[]=['plant','water','harvest','chop','expand','gather'];
const choreLabels:Record<ChoreAction,string>={plant:'텃밭으로 가서 씨앗을 뿌리고 있어요',water:'물뿌리개로 텃밭을 돌보고 있어요',harvest:'잘 자란 작물을 바구니에 담고 있어요',chop:'숲길에서 나무를 베어 목재를 모으고 있어요',expand:'새 판자를 놓아 우리집을 넓히고 있어요',gather:'트럭 주변에서 쓸 만한 물자를 찾고 있어요'};
const farmToolLabels:Record<FarmAction,{working:string;all:string}>={plant:{working:'심는 중',all:'모두 심기'},water:{working:'물 주는 중',all:'모두 물 주기'},harvest:{working:'수확 중',all:'모두 수확'}};
function loadPreferredSeed():CropId|null{try{const seed=localStorage.getItem(selectedSeedStorageKey);return CROP_IDS.includes(seed as CropId)?seed as CropId:null;}catch{return null;}}
function rememberSeed(cropId:CropId){selectedCropId=cropId;seedChosen=true;try{localStorage.setItem(selectedSeedStorageKey,cropId);}catch{}}
function isPlotReserved(plotId:number){return runningFarm?.plotId===plotId||farmQueue.some(job=>job.plotId===plotId);}
function reservedSeeds(cropId:CropId){return farmQueue.filter(job=>job.action==='plant'&&job.cropId===cropId).length+Number(runningFarm?.action==='plant'&&runningFarm.cropId===cropId);}
function reservedEnergy(){return farmQueue.reduce((total,job)=>total+(actionEnergy[job.action]??0),0)+(runningFarm?(actionEnergy[runningFarm.action]??0):0);}
function reservedWater(){return farmQueue.filter(job=>job.action==='water').length+Number(runningFarm?.action==='water');}
function stopFarmMode(){farmMode=null;farmQueue=[];scene.setFarmMode(null);renderControls();}
function afterCurrentFarm(next:()=>void){
 stopFarmMode();
 if(runningFarm&&actionBusy){afterFarm=next;toast('지금 밭의 작업을 마치고 이어가요. 대기 중인 작업은 취소했어요.');}
 else next();
}
function startFarmMode(mode:FarmAction,plotId?:number,all=false){
 if(battleView||actionBusy&&!runningFarm)return;
 cancelConstruction();closeFacility();
 if(mode==='plant'&&!seedChosen){openSeedInventory();return;}
 const switching=farmMode!==mode;
 if(switching){farmQueue=[];afterFarm=null;}
 farmMode=mode;closeModal();setZone('home',true);renderControls();
 const begin=()=>{if(farmMode!==mode)return;if(all)farmAllEligible();else if(plotId!==undefined)enqueueFarmPlot(plotId);};
 if(switching&&runningFarm&&actionBusy&&(all||plotId!==undefined)){
  afterFarm=begin;toast(`지금 밭을 마치면 ${actionNames[mode]}를 이어서 해요.`);
 }else begin();
 if(!all&&plotId===undefined)toast(mode==='plant'?`${CROPS[selectedCropId].seedName}으로 이어 심어요. 빈 밭을 누르거나 모두 심기를 눌러요.`:`${actionNames[mode]} 선택! 밭을 누르거나 쓸어 연속으로 돌봐요.`);
}
function openSeedInventory(){
 if(battleView||actionBusy&&!runningFarm)return;
 cancelConstruction();closeFacility();
 farmQueue=[];afterFarm=null;farmMode=null;renderControls();
 currentModal='seeds';updateNav();
 modalShell('CHOOSE YOUR LITTLE GARDEN','씨앗 인벤토리',seedInventoryContent(),true);
}
function seedInventoryContent(){
 const seeds=getSeedInventory(state);
 return `<p class="modal-description">씨앗을 고른 뒤 원하는 빈 밭을 차례로 눌러요.<br>캐릭터가 심는 동안에도 다음 밭을 예약할 수 있어요.</p><div class="seed-inventory">${CROP_IDS.map(id=>{const crop=CROPS[id],available=Math.max(0,seeds[id]-reservedSeeds(id));return `<button class="seed-card ${id===selectedCropId?'selected':''} ${available?'':'empty'}" data-select-seed="${id}" aria-label="${crop.seedName} 선택, 사용 가능한 씨앗 ${available}개" aria-pressed="${id===selectedCropId}"><span class="seed-card-art">${cropIcon(id,'seed')}</span><strong>${crop.seedName}</strong><span class="seed-card-count"><b data-seed-count="${id}">${available}</b>개</span><span class="seed-card-yield">${icon('food')} 식량 +${crop.food}</span><small>성장 ${crop.growMinutes}분</small><span class="seed-card-note">${escape(crop.description)}</span></button>`;}).join('')}</div><p class="fine-print">성장 시간은 게임 속 시간이에요 · 수확하면 같은 씨앗 2개를 얻어요<br>${runningFarm?'지금 밭의 작업은 마저 끝내고 새 씨앗을 사용할게요.':'고른 씨앗은 다음에도 기억해요. 원하는 밭을 직접 골라 주세요.'}</p><button class="button button-light full-width" data-seed-gather>${icon('map')} 탐색으로 씨앗 3개씩 모으기</button>`;
}
function renderSeedInventory(){
 const seeds=getSeedInventory(state);
 for(const id of CROP_IDS){
  const card=document.querySelector<HTMLButtonElement>(`[data-select-seed="${id}"]`);if(!card)continue;
  const count=Math.max(0,seeds[id]-reservedSeeds(id));
  card.classList.toggle('empty',!count);card.classList.toggle('selected',id===selectedCropId);card.setAttribute('aria-pressed',String(id===selectedCropId));
  card.setAttribute('aria-label',`${CROPS[id].seedName} 선택, 사용 가능한 씨앗 ${count}개`);
  const value=card.querySelector<HTMLElement>('[data-seed-count]')!;if(value.textContent!==String(count))value.textContent=String(count);
 }
}
function selectSeed(cropId:CropId){
 if(getSeedCount(state,cropId)-reservedSeeds(cropId)<1){toast(`${CROPS[cropId].seedName}이 없어요. 탐색으로 3개씩 얻거나 이 작물을 수확해 모아 주세요.`);return;}
 farmQueue=[];afterFarm=null;rememberSeed(cropId);farmMode='plant';
 closeModal();setZone('home',true);renderControls();
 toast(`${CROPS[cropId].seedName} 선택! 빈 밭을 쓸거나 눌러 연속으로 심어요.`);
}
function enqueueFarmPlot(plotId:number,quiet=false,retryAll=false){
 if(!farmMode||battleView)return false;
 const mode=farmMode,plot=state.plots.find(p=>p.id===plotId),retryPlot=retryAll?undefined:plotId;
 if(!plot){if(!quiet)toast('확장으로 새 텃밭을 만들 수 있어요.');return false;}
 if(isPlotReserved(plotId)){if(!quiet)toast(`${plotId}번 밭은 이미 작업 중이거나 대기 중이에요.`);return false;}
 if(!eligiblePlots(mode).some(p=>p.id===plotId)){
  if(!quiet){const message=mode==='plant'?`${plotId}번 밭에는 ${CROPS[getPlotCropId(plot)].name} 작물이 자라고 있어요. 빈 밭을 눌러 주세요.`:mode==='water'?(plot.plantedAt===null?'씨앗을 심은 밭에 물을 줄 수 있어요.':`${plotId}번 밭에는 이미 물을 주었어요.`):'아직 수확할 준비가 되지 않았어요. 다 자란 작물을 눌러 주세요.';toast(message);}
  return false;
 }
 const cropId=mode==='plant'?selectedCropId:getPlotCropId(plot),energy=actionEnergy[mode]??0;
 if(mode==='plant'&&getSeedCount(state,cropId)-reservedSeeds(cropId)<1){
  if(!quiet){if(reservedSeeds(cropId))toast(`${CROPS[cropId].seedName}은 모두 심는 중이거나 대기 중이에요. 다른 씨앗을 고를 수 있어요.`);else if(actionBusy)toast('다른 씨앗을 고르거나 작업 후 탐색으로 씨앗 3개씩 모아요.');else showActivityHelp(mode,retryPlot,`${CROPS[cropId].seedName}이 없어요. 씨앗을 바꾸거나 탐색으로 3개씩 모아 주세요.`,cropId);}
  return false;
 }
 if(mode==='water'&&state.resources.water-reservedWater()<1){
  if(!quiet){if(actionBusy)toast('가지고 있는 물은 모두 사용 대기 중이에요. 작업 후 탐색으로 물을 모아요.');else showActivityHelp(mode,retryPlot,'물을 더 모아 주세요. 도로 탐색으로 보급할 수 있어요.',cropId);}
  return false;
 }
 if(state.energy-reservedEnergy()<energy){
  if(!quiet){if(actionBusy)toast('대기 중인 작업을 마친 뒤 휴식이 필요해요.');else showActivityHelp(mode,retryPlot,`${actionNames[mode]}에는 기력 ${energy}이 필요해요. 잠깐 쉬고 이어서 돌봐요.`,cropId);}
  return false;
 }
 const valid=performAction(state,mode,plotId,cropId);
 if(!valid.ok){if(!quiet&&!actionBusy)showActivityHelp(mode,retryPlot,valid.message,cropId);return false;}
 farmQueue.push({action:mode,plotId,cropId});renderControls();
 if(!actionBusy)void drainFarmQueue();
 else if(!quiet)toast(`${plotId}번 밭 ${actionNames[mode]} 대기 · ${farmQueue.length}곳`);
 return true;
}
function farmAllEligible(){
 if(!farmMode)return;
 const mode=farmMode,plots=eligiblePlots(mode);let added=0;
 for(const plot of plots)if(!isPlotReserved(plot.id)&&enqueueFarmPlot(plot.id,true))added++;
 if(added)toast(`${added}개 밭에서 ${actionNames[mode]}를 차례로 해요.`);
 else{
  const plot=plots.find(p=>!isPlotReserved(p.id));
  if(plot)enqueueFarmPlot(plot.id,false,true);
  else if(!plots.length){const reason=performAction(state,mode,selectedPlotId??undefined,selectedCropId).message;if(!actionBusy)showActivityHelp(mode,undefined,reason);else toast(reason);}
  else toast('할 수 있는 밭은 모두 작업 중이거나 대기 중이에요.');
 }
}
async function drainFarmQueue(){
 if(drainingFarmQueue||actionBusy||battleView||document.hidden)return;
 drainingFarmQueue=true;
 try{
  while(farmMode&&farmQueue.length&&!battleView&&!document.hidden){
   const job=farmQueue.shift()!;runningFarm=job;selectedPlotId=job.plotId;scene.setSelectedPlot(job.plotId);renderControls();
   const ok=await action(job.action,job.plotId,job.cropId,true);runningFarm=null;
   if(!ok)farmQueue=[];
   if(afterFarm){const next=afterFarm;afterFarm=null;next();if(actionBusy||currentModal||!farmMode)break;}
   renderControls();
   if(!ok)break;
  }
 }finally{
  drainingFarmQueue=false;runningFarm=null;renderControls();if(currentModal==='seeds')renderSeedInventory();
  if(farmMode&&farmQueue.length&&!actionBusy&&!currentModal&&!document.hidden)void drainFarmQueue();
 }
}
function showActivityHelp(a:Action,plotId:number|undefined,message:string,cropId:CropId=selectedCropId){
 const energy=actionEnergy[a]??0,needsHealth=a==='hunt'&&state.health<15,needsRest=state.energy<energy||needsHealth;
 const targetPlot=(plotId===undefined?'':` data-plot="${plotId}"`)+(a==='plant'?` data-crop="${cropId}"`:'');
 let recovery='';
 if(needsRest)recovery=`<button class="button full-width" data-rest-retry="${a}"${targetPlot}>${icon('bed')} 쉬고 ${a==='hunt'?'사냥 준비하기':actionNames[a]}</button><p class="fine-print">${a==='hunt'?'휴식 후 선택한 사냥터로 돌아가 출발을 준비해요.':'휴식으로 기력을 회복한 뒤 바로 작업해요.'}<br>${state.resources.food>=1&&state.resources.water>=1?'식량 1 · 물 1 사용 · 기력 +55 · 체력 +12':'식량과 물이 없어도 잠깐 쉬면 기력 +35 · 체력 +3'}${needsHealth?'<br>체력 15까지 부족하면 한 번 더 쉬어 주세요.':''}</p>`;
 else if((a==='plant'&&getSeedCount(state,cropId)<1)||(a==='water'&&state.resources.water<1)||a==='expand'||a==='repair')recovery=`<button class="button full-width" data-action="gather">${icon('map')} 도로에서 필요한 물자 찾기</button><button class="button button-light full-width activity-secondary" data-open="grove">${icon('axe')} 벌목장으로 가기</button>`;
 else if(['plant','water','harvest'].includes(a))recovery=`<button class="button full-width" data-show-farm>${icon('seeds')} 텃밭에서 할 일 보기</button><button class="button button-light full-width activity-secondary" data-action="chop">${icon('axe')} 기다리는 동안 나무 베기</button>`;
 else recovery=`<button class="button full-width" data-action="rest">${icon('bed')} 우리집에서 쉬기</button>`;
 currentModal='activity';updateNav();modalShell('OUR NEXT LITTLE STEP',actionNames[a],`<div class="activity-help-icon">${icon(a==='chop'?'axe':a==='gather'?'map':a==='plant'?'seeds':a==='water'?'water':a==='harvest'?'food':a==='hunt'?'hunt':'bed')}</div><p class="activity-block-reason" role="status">${escape(message)}</p>${needsRest?`<div class="activity-energy"><span>${icon('bolt')} 현재 기력 <b>${Math.floor(state.energy)}</b></span><span>필요한 기력 <b>${energy}</b></span></div>${a==='hunt'?`<div class="activity-energy"><span>${icon('heart')} 현재 체력 <b>${Math.floor(state.health)}</b></span><span>필요한 체력 <b>15</b></span></div>`:''}`:''}${recovery}${a==='plant'?`<button class="button button-light full-width activity-secondary" data-seed-change>${icon('bag')} 다른 씨앗 고르기</button>`:''}<button class="text-button full-width" data-close>화면으로 돌아가기</button>`);
}
async function action(a:Action,plotId?:number,cropId:CropId=selectedCropId,queuedFarm=false):Promise<boolean>{
 if(contentActivationPending)return false;
 if(['plant','water','harvest'].includes(a)&&!queuedFarm){startFarmMode(a as FarmAction,plotId??quickPlot(a as FarmAction)?.id);return false;}
 if(actionBusy||battleView){toast('지금 하던 일을 마치고 함께해요.');return false;}
 if(!queuedFarm){cancelConstruction();closeFacility();if(farmMode)stopFarmMode();}
 if(a==='hunt'){openModal('hunt');return false;}
 if(plotId!==undefined&&['plant','water','harvest'].includes(a))selectedPlotId=plotId;
 const before=performAction(state,a,plotId,cropId);
 if(!before.ok){if(a==='repair'&&state.truckHealth>=100)toast(before.message);else showActivityHelp(a,plotId,before.message,cropId);return false;}
 if(animatedActions.includes(a)){
  actionBusy=true;app.setAttribute('aria-busy','true');renderControls();
  closeModal();
  setZone(a==='chop'?'grove':'home',['plant','water','harvest'].includes(a));renderControls();
  const status=document.querySelector<HTMLElement>('.chore-status')!;
  const cropLabel=a==='plant'?`${CROPS[cropId].name} 씨앗을 ${plotId}번 밭에 심고 있어요`:a==='harvest'?`${CROPS[getPlotCropId(state.plots.find(p=>p.id===plotId)??state.plots[0])].name}을 바구니에 담고 있어요`:choreLabels[a as ChoreAction];
  status.innerHTML=`<span class="chore-pulse">${a==='plant'?cropIcon(cropId,'seed'):icon(a==='chop'?'wood':a==='expand'?'hammer':'seeds')}</span><div><strong>${escape(state.name)}의 작은 일상</strong><span>${cropLabel}</span><div class="chore-track"><i></i></div></div>`;
  status.hidden=false;
  try { await scene.playAction(a as ChoreAction,plotId,cropId); }
  catch {toast('작업을 마치지 못했어요. 다시 시도해 주세요.');status.hidden=true;actionBusy=false;app.removeAttribute('aria-busy');renderControls();return false;}
  actionBusy=false;status.hidden=true;app.removeAttribute('aria-busy');
 }
 const result=performAction(state,a,plotId,cropId);
 state=result.state;
 if(queuedFarm)runningFarm=null;
 if(animatedActions.includes(a))setZone(a==='chop'?'grove':'home',['plant','water','harvest'].includes(a));toast(result.message);
 if(result.ok){ping();persist();scene.focus(a==='pet'?'pet':a==='expand'?'truck':a==='chop'?'grove':a==='plant'||a==='water'||a==='harvest'?'farm':'character');}
 render();
 if(currentModal==='quests')openModal('quests');
 if(currentModal==='pet')openModal('pet');
 if(currentModal==='hunt')openModal('hunt');
 finishDeferredUpdate();return result.ok;
}
function startBattle(){
 if(actionBusy||battleView||contentActivationPending)return;
 cancelConstruction();closeFacility();setFarmTray(false);
 stopFarmMode();
 const started=beginHunt(state,selectedStage);
 if(!started.ok){showActivityHelp('hunt',undefined,started.message);return;}
 state=started.state;const expeditionId=state.expedition!.id;persist();
 closeModal();scene.setSuspended(true);app.inert=true;document.body.classList.add('in-battle');
 try {
  battleView=new BattleView({gender:state.gender,name:state.name,level:state.level,health:state.health,stage:selectedStage,onFinish:(result:BattleResult)=>{
   const finished=finishHunt(state,result,expeditionId);state=finished.state;
   if(!finished.ok&&state.expedition?.id===expeditionId)state=cancelHunt(state).state;
   battleView?.destroy();battleView=null;app.inert=false;document.body.classList.remove('in-battle');scene.setSuspended(false);setZone('home');persist();render();toast(finished.message);finishDeferredUpdate();
  }});
 }catch{
  state=cancelHunt(state).state;battleView?.destroy();battleView=null;app.inert=false;document.body.classList.remove('in-battle');scene.setSuspended(false);persist();render();toast('전투 화면을 열지 못해 트럭으로 돌아왔어요.');
 }
}
function modalShell(eyebrow:string,title:string,body:string,wide=false){const root=document.querySelector<HTMLElement>('#modal-root')!;root.hidden=false;root.innerHTML=`<section class="modal ${wide?'modal-wide':''}" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button class="modal-close round-button" data-close aria-label="닫기">${icon('close')}</button><div class="eyebrow">${eyebrow}</div><h2 id="modal-title">${title}</h2>${body}</section>`;requestAnimationFrame(()=>root.querySelector<HTMLButtonElement>('button')?.focus());}
function closeModal(){document.querySelector<HTMLElement>('#modal-root')!.hidden=true;currentModal='';updateNav();}
function farmContent(){return `<p class="modal-description">씨앗 인벤토리에서 고른 뒤 빈 밭을 연속으로 눌러 심어요.<br>물 주기·수확은 한 번 누르면 할 수 있는 모든 밭을 차례로 돌봐요.</p><button class="button button-light full-width farm-seed-link" data-seed-change>${icon('seeds')} 씨앗 인벤토리 열기</button><div class="farm-all-tools"><button class="button button-light" data-farm-all="water">${icon('water')} 모두 물 주기</button><button class="button button-light" data-farm-all="harvest">${icon('food')} 모두 수확</button></div><div class="farm-grid">${state.plots.map((p,i)=>{const progress=getCropProgress(state,p),planted=p.plantedAt!==null,crop=CROPS[getPlotCropId(p)];return `<article class="plot-card" data-plot-card="${p.id}"><div class="plot-illustration ${!planted?'empty':''}">${planted?cropIcon(crop.id,progress>=1?'produce':'plant'):icon('plot-empty')}</div><h3>${i+1}번 텃밭${planted?` · ${crop.name}`:''}</h3><span class="plot-state">${!planted?'새로운 씨앗을 기다려요':progress>=1?`${crop.name} 수확할 준비가 됐어요!`:p.watered?`${crop.name} 쑥쑥 자라는 중`:`${crop.name}에 물을 주세요`}</span><div class="quest-progress"><span style="width:${progress*100}%"></span></div><button class="button ${planted&&progress<1?'button-light':''}" data-action="${!planted?'plant':progress>=1?'harvest':'water'}" data-plot="${p.id}" ${planted&&p.watered&&progress<1?'disabled':''}>${planted&&progress>=1?cropIcon(crop.id,'produce'):icon(!planted?'seeds':'water')}${!planted?(seedChosen?'심기 이어하기':'씨앗 고르기'):progress>=1?'수확하기':p.watered?'잘 자라고 있어요':'물 주기'}</button></article>`;}).join('')}</div><div class="info-note">${icon('clock')} 게임 시간에 따라 자라요. 앱을 닫으면 시간도 쉬어 갑니다.</div>`;}
function renderFarm(){
 const body=document.querySelector('#farm-content');if(!body)return;
 const cards=Array.from(body.querySelectorAll<HTMLElement>('[data-plot-card]'));
 if(cards.length!==state.plots.length||cards.some((card,i)=>card.dataset.plotCard!==String(state.plots[i].id))){body.innerHTML=farmContent();return;}
 // Keep touch targets mounted across growth ticks and inventory changes.
 cards.forEach((card,i)=>{
  const p=state.plots[i],progress=getCropProgress(state,p),planted=p.plantedAt!==null,crop=CROPS[getPlotCropId(p)];
  const artKey=!planted?'plot-empty':`${crop.id}:${progress>=1?'produce':'plant'}`;
  const art=card.querySelector<HTMLElement>('.plot-illustration')!;art.classList.toggle('empty',!planted);
  if(art.dataset.cropArt!==artKey){art.innerHTML=planted?cropIcon(crop.id,progress>=1?'produce':'plant'):icon('plot-empty');art.dataset.cropArt=artKey;}
  const title=card.querySelector('h3')!,name=`${i+1}번 텃밭${planted?` · ${crop.name}`:''}`;if(title.textContent!==name)title.textContent=name;
  const detail=card.querySelector<HTMLElement>('.plot-state')!,text=!planted?'새로운 씨앗을 기다려요':progress>=1?`${crop.name} 수확할 준비가 됐어요!`:p.watered?`${crop.name} 쑥쑥 자라는 중`:`${crop.name}에 물을 주세요`;
  if(detail.textContent!==text)detail.textContent=text;
  card.querySelector<HTMLElement>('.quest-progress>span')!.style.width=`${progress*100}%`;
  const button=card.querySelector<HTMLButtonElement>('[data-action]')!,a=!planted?'plant':progress>=1?'harvest':'water',label=!planted?(seedChosen?'심기 이어하기':'씨앗 고르기'):progress>=1?'수확하기':p.watered?'잘 자라고 있어요':'물 주기';
  const key=`${a}:${label}:${crop.id}`;button.dataset.action=a;button.classList.toggle('button-light',planted&&progress<1);button.disabled=planted&&p.watered&&progress<1;
  if(button.dataset.cropAction!==key){button.innerHTML=(a==='harvest'?cropIcon(crop.id,'produce'):icon(a==='plant'?'seeds':'water'))+label;button.dataset.cropAction=key;}
 });
}
function bagContent(){return `<p class="modal-description">도로에서 모은 자원과 여섯 가지 씨앗을 보관해요.</p><div class="inventory-grid">${resources.map(r=>`<div class="inventory-item"><span class="resource-icon ${r}">${icon(r)}</span><strong>${resourceLabels[r]}</strong><b><span data-inventory-count="${r}">${state.resources[r]}</span><small>${r==='water'?' L':' 개'}</small></b><p>${({wood:'트럭을 넓힐 때 써요',scrap:'튼튼한 집의 재료예요',food:'휴식과 여행의 힘이 돼요',water:'텃밭에 생기를 더해요',seeds:'여섯 종류를 골라 심어요'})[r]}</p></div>`).join('')}</div><button class="button button-light full-width inventory-seed-link" data-seed-change>${icon('seeds')} 씨앗 인벤토리 · 원하는 씨앗 고르기</button><div class="bag-seed-list">${CROP_IDS.map(id=>`<span>${cropIcon(id,'seed')}<small>${CROPS[id].name}</small><b data-bag-seed-count="${id}">${getSeedCount(state,id)}</b></span>`).join('')}</div><button class="button full-width" data-action="gather">${icon('wood')} 주변에서 자원 찾기</button><button class="button button-light full-width inventory-map-link" data-open="map">${icon('map')} 도로 주변 지도 보기</button>`;}
function renderBag(){
 const body=document.querySelector('#bag-content');if(!body)return;
 for(const r of resources){const count=body.querySelector<HTMLElement>(`[data-inventory-count="${r}"]`)!;if(count.textContent!==String(state.resources[r]))count.textContent=String(state.resources[r]);}
 for(const id of CROP_IDS){const count=body.querySelector<HTMLElement>(`[data-bag-seed-count="${id}"]`)!;if(count.textContent!==String(getSeedCount(state,id)))count.textContent=String(getSeedCount(state,id));}
}
function openModal(kind:string){if(kind==='seeds'){openSeedInventory();return;}if(actionBusy||battleView)return;document.querySelector('#toast')!.classList.remove('visible');clearTimeout(toastTimer);cancelConstruction();closeFacility();stopFarmMode();currentModal=kind;updateNav();
 if(kind==='build'){setZone('home');setFarmTray(false);closeFacility();modalShell('BUILD OUR TRUCK VILLAGE','트럭 위 마을 건설',buildingCatalog(state),true);}
 if(kind==='settlement-goals')modalShell('A VILLAGE ON THE ROAD','우리 마을의 다음 걸음',settlementGoalsContent(),true);
 if(kind==='farm')modalShell('LITTLE GARDEN','트럭 위 작은 텃밭',`<div id="farm-content">${farmContent()}</div>`,true);
 if(kind==='bag')modalShell('THINGS WE FOUND','우리의 배낭',`<div id="bag-content">${bagContent()}</div>`,true);
 if(kind==='expand'){const cost=expansionCost(state);modalShell('A LITTLE MORE ROOM','우리집을 넓혀 볼까요?',`<div class="expansion-art">${icon('truck')}<span>Lv.${state.deckLevel}</span>${icon('arrow')}<span>${state.deckLevel>=MAX_DECK_LEVEL?'MAX':`Lv.${state.deckLevel+1}`}</span></div><p class="modal-description">옆으로 펼쳐지는 새 데크와 넓어진 통로를 직접 확인해 보세요.<br>확장할 때마다 울타리와 새 텃밭도 함께 늘어나요.</p><div class="cost-row"><span class="${state.resources.wood>=cost.wood?'':'insufficient'}">${icon('wood')} 목재 <strong>${state.resources.wood} / ${cost.wood}</strong></span><span class="${state.resources.scrap>=cost.scrap?'':'insufficient'}">${icon('scrap')} 고철 <strong>${state.resources.scrap} / ${cost.scrap}</strong></span></div><button class="button full-width" data-action="expand" ${state.deckLevel>=MAX_DECK_LEVEL?'disabled':''}>${icon('hammer')} ${state.deckLevel>=MAX_DECK_LEVEL?'최대 크기의 우리집이에요':'데크 확장하기'}</button><button class="text-button full-width" data-action="repair">${icon('shield')} 트럭 수리 · 현재 내구도 ${state.truckHealth}%</button>`);}
 if(kind==='grove'){
  modalShell('THE LITTLE WOODLAND','도로 옆, 우리의 벌목장',`<div class="grove-illustration"><span class="grove-sign">서울 숲길 · 채집 구역</span></div><p class="modal-description">트럭 옆 숲길로 내려가 나무를 직접 베어요.<br>벌목장 화면에서 나무를 누르거나 아래 버튼으로 시작하세요.</p><div class="grove-rewards"><span>${icon('wood')} 목재 <b>+18</b></span><span>${icon('seeds')} 씨앗 <b>+3</b></span><span>${icon('bolt')} 기력 <b>−10</b></span></div><button class="button full-width" data-action="chop">${icon('axe')} ${state.energy<10?'쉬고 나무 베러 가기':'나무 베러 가기'}</button><button class="button button-light full-width grove-look" data-look-grove>${icon('map')} 벌목장 둘러보기</button><div class="grove-salvage"><span>고철과 물이 필요하다면</span><button class="text-button" data-action="gather">버려진 휴게소 탐색 ${icon('arrow')}</button></div>`);
 }
 if(kind==='hunt'){
  const stages=[{id:1,title:STAGE_NAMES[0],desc:'숲에 숨어든 좀비 무리',tag:'추천 Lv.1',style:'forest'},{id:2,title:STAGE_NAMES[1],desc:'바리케이드 너머의 감염자',tag:'추천 Lv.2',style:'toll'},{id:3,title:STAGE_NAMES[2],desc:'거대한 경비병이 지키는 보급품',tag:'추천 Lv.3',style:'ruins'}];
  modalShell('ADVENTURE WITH BORI','보리와 함께, 사냥 출발',`<p class="modal-description">세 번의 웨이브를 지나 보스를 물리치세요.<br>일반 공격은 자동, 강한 일격과 보리의 돌진·회복은 직접 사용할 수 있어요.</p><div class="explore-quick-links"><button data-zone="grove">${icon('axe')} 벌목장 둘러보기</button><button data-action="gather">${icon('map')} 생활 물자 탐색</button></div><div class="stage-list">${stages.map(st=>`<button class="stage-card ${st.style} ${selectedStage===st.id?'selected':''}" data-stage="${st.id}" aria-pressed="${selectedStage===st.id}" style="--stage-art:url('${BATTLE_ART_URLS[st.id-1]}')"><span class="stage-number">${String(st.id).padStart(2,'0')}<span>STAGE</span></span><span class="stage-card-body"><small>${st.tag} · 3 WAVES</small><strong>${st.title}</strong><span>${st.desc}</span></span><span class="stage-check">${icon(selectedStage===st.id?'check':'chevron')}</span></button>`).join('')}</div><div class="party-preview">${portrait(state.gender)}<span><strong>${escape(state.name)} & 보리</strong><small>체력 ${Math.round(state.health)} · 기력 ${Math.round(state.energy)}</small></span><b>Lv.${state.level}</b></div><div class="battle-reward-preview">${icon('food')} 승리 보상: 식량 ${6+selectedStage*2} · 고철 ${selectedStage*2} · 목재 2</div><button class="button full-width ${state.energy<16||state.health<15?'unavailable':''}" data-start-hunt aria-disabled="${state.energy<16||state.health<15}">${icon('hunt')} 전투 스테이지 입장 <span class="button-cost">기력 16</span></button>${state.energy<16||state.health<15?`<p class="fine-print">건강 15와 기력 16이 필요해요. 먼저 휴식해 주세요.</p><button class="button button-light full-width activity-secondary" data-action="rest">${icon('bed')} 여기서 쉬고 사냥 준비하기</button>`:''}<p class="fine-print">전투 중 앱을 종료하면 보상 없이 귀환해요 · 승리 후 보상 지급</p>`,true);
 }
 if(kind==='quests'){modalShell('ONE STEP AT A TIME','작은 목표, 큰 하루',`<p class="modal-description">서두르지 않아도 괜찮아요. 하나씩 해 나가요.</p><div class="quest-list">${questList(state).map(q=>`<article class="quest-row ${q.complete?'completed':''}"><span class="quest-row-icon">${icon(q.complete?'check':'flag')}</span><div><h3>${escape(q.title)}</h3><p>${escape(q.description)}</p><small>${escape(q.reward)} · 달성 시 자동 지급</small><div class="quest-progress"><span style="width:${Math.min(100,q.current/q.target*100)}%"></span></div></div><b>${q.current}/${q.target}</b></article>`).join('')}</div>`);}
 if(kind==='pet'){modalShell('YOUR VERY BEST FRIEND','보리와 쉬어 가기',`<div class="pet-modal-art">${petPortrait()}<span>${icon('heart')}</span></div><p class="pet-dialogue">“멍! 오늘도 네 옆에 있을게.”</p><p class="modal-description">보리는 우리집을 자유롭게 뛰어다녀요.<br>쓰다듬으며 마음의 여유를 찾아보세요.</p><div class="bond-meter"><span>우리의 행복</span><strong>${Math.round(state.morale)} / 100</strong><div class="quest-progress"><span style="width:${state.morale}%"></span></div></div><button class="button full-width" data-action="pet">${icon('paw')} 보리 쓰다듬기</button>`);}
 if(kind==='character'||kind==='welcome'){selectedGender=state.gender;modalShell(kind==='welcome'?'YOUR STORY STARTS HERE':'MEET YOUR SURVIVOR',kind==='welcome'?'우리의 첫 번째 아침':'오늘의 나를 만나기',`<p class="modal-description">2187년, 좀비로 가득한 대한민국.<br>커다란 트럭 위에서 당신만의 작은 일상을 시작하세요.</p><div class="character-choices"><button data-gender="female" class="character-choice ${selectedGender==='female'?'selected':''}">${portrait('female')}<strong>여자 생존자</strong><span>다정하고 씩씩한 모험가</span></button><button data-gender="male" class="character-choice ${selectedGender==='male'?'selected':''}">${portrait('male')}<strong>남자 생존자</strong><span>따뜻하고 든든한 모험가</span></button></div><label class="name-label" for="player-name">어떤 이름으로 불러 드릴까요?</label><input class="name-input" id="player-name" maxlength="16" value="${escape(state.name)}" placeholder="생존자의 이름" autocomplete="off"><button class="button full-width" data-start>${icon('sun')} ${kind==='welcome'?'우리집에서 시작하기':'변경 저장하기'}</button><p class="fine-print">캐릭터는 언제든 변경할 수 있어요 · 기기에 자동 저장</p>`);}
 if(kind==='map'){modalShell('BEYOND OUR LITTLE HOME','도로 너머로 한 걸음',`<p class="modal-description">서울 외곽 순환도로 · 현재 주둔지<br>트럭을 중심으로 주변을 탐색해 생활에 필요한 자원을 구해요.</p><div class="explore-map"><span class="map-home">${icon('truck')} 우리집</span><span class="map-stop s1">${icon('wood')}</span><span class="map-stop s2">${icon('hunt')}</span><span class="map-caption">SEOUL OUTER RING ROAD</span></div><div class="exploration-list"><button data-action="gather"><span class="resource-icon wood">${icon('wood')}</span><span><strong>버려진 휴게소</strong><small>목재 · 고철 · 생활 물자 수집</small></span>${icon('arrow')}</button><button data-open="grove"><span class="resource-icon wood">${icon('wood')}</span><span><strong>도로 옆 벌목장</strong><small>직접 나무 베기 · 목재 +18</small></span>${icon('arrow')}</button><button data-open="hunt"><span class="resource-icon food">${icon('hunt')}</span><span><strong>좀비가 숨어든 사냥터</strong><small>전투 스테이지 3곳 · 승리 보상</small></span>${icon('arrow')}</button></div><div class="info-note">${icon('shield')} 바깥에는 좀비가 있어요. 건강과 기력을 챙겨 주세요.</div>`,true);}
 if(kind==='journal'){modalShell('POSTCARDS FROM THE ROAD','우리의 여행 일지',`<div class="journal-day">DAY ${String(state.day).padStart(2,'0')}<span>도로 위에서 함께한 날들</span></div><div class="journal-stats"><div><b>${state.stats.harvests}</b><span>번의 수확</span></div><div><b>${state.stats.chops}</b><span>번의 벌목</span></div><div><b>${state.stats.battlesWon}</b><span>번의 전투 승리</span></div></div><div class="journal-entries">${state.log.slice(0,12).map(l=>`<div>${icon('leaf')}<p>${escape(l)}</p></div>`).join('')||'<p>작은 행동으로 첫 번째 이야기를 써 보세요.</p>'}</div>`);}
 if(kind==='settings')renderSettings();
 if(kind==='guide'){modalShell('WELCOME TO ROAD HAVEN','천천히, 함께 살아가기',`<div class="guide-list">${[['seeds','심고, 돌보고, 수확해요','씨앗을 한 번 골라 두면 심기 이어하기로 다시 사용할 수 있어요. 밭을 누르거나 손가락으로 쓸면 차례로 심고 돌봐요. 아래 물 주기·수확 버튼은 한 번 누르면 가능한 밭을 모두 작업해요. 작업 종료는 대기를 취소하고 지금 밭만 마쳐요.'],['wood','도로 너머를 탐색해요','벌목장에서 나무를 베어 목재를 얻고, 휴게소를 탐색해 물과 고철을 모아요. 사냥은 별도 전투 스테이지에서 진행돼요.'],['hammer','트럭을 우리집으로 만들어요','재료를 모아 새 판자를 놓으면 데크의 외곽과 통로가 넓어져요. 확장할 때마다 새 텃밭도 생겨요.'],['bed','쉼도 소중한 하루예요','활동하면 기력이 줄어요. 쉬면서 회복하고, 보리를 쓰다듬어 행복을 채워요.'],['shield','우리의 일상은 저장돼요','진행 상황은 이 기기에 자동 저장돼요. 앱을 삭제하거나 데이터를 지우면 저장도 사라져요.']].map(([i,t,d])=>`<div><span>${icon(i)}</span><article><h3>${t}</h3><p>${d}</p></article></div>`).join('')}</div>`);}
 if(kind==='reset')modalShell('A FRESH START','새로운 여행을 시작할까요?',`<p class="modal-description">현재 기기의 모든 진행 상황이 지워집니다.<br>이 작업은 되돌릴 수 없어요.</p><button class="button button-danger full-width" data-reset>진행 상황을 지우고 새로 시작</button><button class="text-button full-width" data-close>지금의 여행 계속하기</button>`);
}
function renderSettings(){modalShell('MAKE YOURSELF AT HOME','우리집 설정',`<div class="settings-row"><div><strong>게임 소리</strong><p>작은 행동에 기분 좋은 소리를 더해요</p></div><button class="toggle ${sound?'on':''}" data-sound aria-label="게임 소리 ${sound?'끄기':'켜기'}" aria-pressed="${sound}"><span></span></button></div><div class="settings-row"><div><strong>시간 흐름</strong><p>현재 ${paused?'쉬어 가는 중':'흘러가는 중'}</p></div><button class="button button-light small" data-pause>${paused?'계속하기':'잠시 멈춤'}</button></div>${updateSettingsContent()}<button class="text-button full-width" data-save>${icon('check')} 지금 저장하기</button><button class="text-button danger full-width" data-open="reset">새로운 여행 시작</button><p class="fine-print">ROAD HAVEN · 로드헤이븐 v${APP_VERSION}<br>당신의 기기에 머무는 작은 세상</p>`);refreshUpdateUI();}
function updateSettingsContent(){
 const native=isNativeUpdateSupported();
 return `<div class="update-box game-content-update"><div class="update-heading">${icon('check')}<strong>게임 콘텐츠 자동 업데이트</strong><span>v${APP_VERSION}</span></div><p data-live-update-message>${escape(liveUpdate.message)}</p><div class="update-download-progress" data-live-update-progress hidden><i></i></div><p class="update-explanation">${native?'농사·마을·그래픽 업데이트는 자동으로 받아요. 작업과 전투를 마치고 트럭 홈 화면에서 저장한 뒤 적용해요.':'웹에서는 새로 열면 최신 게임을 플레이해요. Android 앱은 게임 콘텐츠를 자동으로 적용해요.'}</p><button class="button button-light full-width" data-live-update-check ${native?'':'hidden'}>게임 업데이트 다시 확인</button></div><div class="update-box native-feature-update"><div class="update-heading">${icon('download')}<strong>앱 기능 업데이트</strong><span>Android</span></div><p data-native-update-message>${escape(native?automaticUpdate.message:lastUpdate?.message??'앱을 시작할 때 새 버전을 확인해요.')}</p><div class="update-download-progress" data-native-update-progress hidden><i></i></div><div class="release-notes" data-update-release-notes>${escape(lastUpdate?.release?.notes??'')}</div><button class="button button-light full-width" data-update ${updateBusy?'disabled':''}>${updateBusy?'확인하는 중…':'앱 새 버전 확인'}</button><button class="button full-width" data-install-update hidden>받은 새 버전 설치하기</button><button class="button button-light full-width" data-retry-native-update hidden>다운로드 다시 시도</button><button class="button full-width" data-download ${!native&&lastUpdate?.status==='available'?'':'hidden'}>Android APK 다운로드</button><small>${native?'새 앱 기능이 필요할 때는 설치 확인을 한 번 진행해 주세요. 다운로드는 앱 안에서 자동으로 준비해요.':'브라우저에서는 APK를 내려받아 Android에 설치할 수 있어요.'}</small></div>`;
}
function refreshUpdateUI(){
 const badge=document.querySelector<HTMLButtonElement>('#update-badge')!;
 let title='',detail='';
 if(contentActivationPending){title='게임 업데이트 적용 중';detail='진행을 저장했어요 · 잠시 기다려 주세요';}
 else if(liveUpdate.status==='downloading'){title=`게임 업데이트 ${Math.round(liveUpdate.progress)}%`;detail='플레이하며 자동으로 준비해요';}
 else if(liveUpdate.status==='ready'){title='게임 업데이트 준비됨';detail='트럭 홈에서 자동으로 적용해요';}
 else if(automaticUpdate.status==='downloading'){title=`앱 업데이트 ${Math.round(automaticUpdate.progress)}%`;detail='새 기능을 자동으로 받고 있어요';}
 else if(automaticUpdate.status==='ready'||automaticUpdate.status==='permission'){title='새 앱 버전 설치하기';detail=automaticUpdate.status==='permission'?'설치 허용을 확인해 주세요':'다운로드 완료 · 눌러서 설치';}
 else if(automaticUpdate.status==='error'){title='앱 업데이트 다시 시도';detail='게임은 계속 플레이할 수 있어요';}
 else if(!isNativeUpdateSupported()&&lastUpdate?.status==='available'){title='새 버전이 도착했어요';detail='설정에서 업데이트를 확인해요';}
 badge.hidden=!title;badge.querySelector('strong')!.textContent=title;badge.querySelector('small')!.textContent=detail;
 const root=document.querySelector('#modal-root');if(currentModal!=='settings'||!root)return;
 const live=root.querySelector<HTMLElement>('[data-live-update-message]'),engine=root.querySelector<HTMLElement>('[data-native-update-message]');
 if(live)live.textContent=liveUpdate.message;if(engine)engine.textContent=isNativeUpdateSupported()?automaticUpdate.status==='idle'?(lastUpdate?.message??automaticUpdate.message):automaticUpdate.message:lastUpdate?.message??'앱을 시작할 때 새 버전을 확인해요.';
 for(const [selector,progress,visible] of [['live',liveUpdate.progress,liveUpdate.status==='downloading'],['native',automaticUpdate.progress,automaticUpdate.status==='downloading']] as const){const bar=root.querySelector<HTMLElement>(`[data-${selector}-update-progress]`);if(bar){bar.hidden=!visible;bar.querySelector<HTMLElement>('i')!.style.width=`${Math.max(0,Math.min(100,progress))}%`;}}
 const install=root.querySelector<HTMLButtonElement>('[data-install-update]');if(install){install.hidden=!isNativeUpdateSupported()||!['ready','permission','installing'].includes(automaticUpdate.status);install.disabled=automaticUpdate.status==='installing';install.textContent=automaticUpdate.status==='permission'?'설치 허용 후 이어하기':automaticUpdate.status==='installing'?'Android 설치 확인 중…':'받은 새 버전 설치하기';}
 const retry=root.querySelector<HTMLElement>('[data-retry-native-update]');if(retry)retry.hidden=automaticUpdate.status!=='error'||!lastUpdate?.release;
 const download=root.querySelector<HTMLElement>('[data-download]');if(download)download.hidden=isNativeUpdateSupported()||lastUpdate?.status!=='available';
 const release=root.querySelector<HTMLElement>('[data-update-release-notes]');if(release)release.textContent=lastUpdate?.release?.notes??'';
 const check=root.querySelector<HTMLButtonElement>('[data-update]');if(check){check.disabled=updateBusy;check.textContent=updateBusy?'확인하는 중…':'앱 새 버전 확인';}
}
function onAutomaticUpdate(next:AutomaticUpdateState){automaticUpdate=next;refreshUpdateUI();}
function setContentApplying(applying:boolean){
 contentActivationPending=applying;app.inert=applying||Boolean(battleView);app.classList.toggle('content-applying',applying);contentApplyingNotice.hidden=!applying;
}
function onLiveUpdate(next:LiveUpdateState){liveUpdate=next;if(next.status==='error'&&contentActivationPending)setContentApplying(false);refreshUpdateUI();maybeApplyContentUpdate();}
function maybeApplyContentUpdate(){
 if(liveUpdate.status!=='ready'||contentActivationPending||document.hidden||actionBusy||battleView||currentModal||placement||selectedFacilityId!==null||farmQueue.length||farmMode||farmTrayOpen||selectedZone!=='home')return;
 if(!persist())return;
 setContentApplying(true);refreshUpdateUI();
 void activateLiveUpdate().then(accepted=>{if(!accepted){setContentApplying(false);refreshUpdateUI();}}).catch(()=>{setContentApplying(false);refreshUpdateUI();});
}
async function requestAutomaticInstall(){
 if(actionBusy||battleView){installAfterWork=true;if(runningFarm){afterFarm=null;stopFarmMode();}toast('지금 작업을 마치면 준비된 앱 설치를 열어요.');return;}
 if(!persist()){toast('진행 상황을 저장한 뒤 설치를 다시 시도해 주세요.');return;}
 installAfterWork=false;closeModal();try{onAutomaticUpdate(await installPreparedUpdate());}catch{onAutomaticUpdate({status:'error',progress:0,message:'설치를 열지 못했어요. 설정에서 다시 시도해 주세요.'});}
}
function finishDeferredUpdate(){if(installAfterWork&&!actionBusy&&!battleView)void requestAutomaticInstall();else maybeApplyContentUpdate();}
async function initializeUpdateSystem(){
 if(!updateInitializing)updateInitializing=(async()=>{await initializeLiveUpdates(onLiveUpdate);if(isNativeUpdateSupported())onAutomaticUpdate(await initializeAutoUpdates(onAutomaticUpdate));await runUpdate();})().catch(()=>{refreshUpdateUI();});
 return updateInitializing;
}
async function runUpdate(manual=false){
 if(updateBusy)return;updateBusy=true;refreshUpdateUI();lastUpdate=await checkUpdate();updateBusy=false;
 if(lastUpdate.status==='available'&&lastUpdate.release&&isNativeUpdateSupported())try{onAutomaticUpdate(await prepareAutomaticUpdate(lastUpdate.release));}catch{onAutomaticUpdate({status:'error',progress:0,message:'새 버전을 받지 못했어요. 연결되면 설정에서 다시 시도해 주세요.'});}
 refreshUpdateUI();if(manual&&currentModal!=='settings')toast(lastUpdate.message);
}
function navigateButton(t:HTMLElement){
 if(t.dataset.nav){const nav=t.dataset.nav;cancelConstruction();closeFacility();stopFarmMode();if(nav==='home'||nav==='farm'||nav==='grove'){closeModal();setZone(nav==='grove'?'grove':'home',nav==='farm');if(nav==='farm')selectPlot(preferredPlot()?.id??null);else renderControls();}else openModal(nav);return true;}
 if(t.dataset.open){openModal(t.dataset.open);return true;}
 if(t.dataset.zone){cancelConstruction();closeFacility();stopFarmMode();closeModal();setZone(t.dataset.zone as 'home'|'grove');renderControls();return true;}
 if(t.hasAttribute('data-look-grove')){stopFarmMode();closeModal();setZone('grove');renderControls();return true;}
 if(t.hasAttribute('data-show-farm')){stopFarmMode();closeModal();setZone('home',true);selectPlot(preferredPlot()?.id??null);return true;}
 return false;
}
document.addEventListener('click',e=>{
 const t=(e.target as Element).closest<HTMLElement>('button,a');if(!t||!t.closest('#app')||battleView||contentActivationPending)return;
 if(t.hasAttribute('data-install-update')){void requestAutomaticInstall();return;}
 if(t.hasAttribute('data-update-notice')){if(automaticUpdate.status==='ready'||automaticUpdate.status==='permission')void requestAutomaticInstall();else if(runningFarm&&actionBusy)afterCurrentFarm(()=>openModal('settings'));else if(!actionBusy)openModal('settings');else toast('작업을 마치면 설정에서 업데이트를 확인해요.');return;}
 if(t.hasAttribute('data-live-update-check')){void checkLiveUpdate().then(onLiveUpdate);return;}
 if(t.hasAttribute('data-retry-native-update')&&lastUpdate?.release){void prepareAutomaticUpdate(lastUpdate.release).then(onAutomaticUpdate).catch(()=>toast('연결을 확인하고 다시 시도해 주세요.'));return;}
 if(t.hasAttribute('data-construction-cancel')){cancelConstruction();renderSettlement();return;}
 if(t.hasAttribute('data-construction-confirm')){confirmConstruction();return;}
 if(t.hasAttribute('data-facility-close')){closeFacility();return;}
 if(t.dataset.mapZoom){scene.setMapZoom(scene.getMapZoom()*(Number(t.dataset.mapZoom)>0?1.25:.8));return;}
 if(t.hasAttribute('data-farm-toggle')){
  const toggle=()=>{cancelConstruction();closeFacility();if(farmTrayOpen){afterFarm=null;stopFarmMode();setFarmTray(false);}else setFarmTray(true);};
  if(runningFarm&&actionBusy)afterCurrentFarm(toggle);else if(!actionBusy)toggle();return;
 }
 if(t.dataset.buildType&&BUILDING_TYPES.includes(t.dataset.buildType as BuildingType)){beginConstruction(t.dataset.buildType as BuildingType);return;}
 if(t.dataset.facilityStart){operateFacility('start',Number(t.dataset.facilityStart));return;}
 if(t.dataset.facilityCollect){operateFacility('collect',Number(t.dataset.facilityCollect));return;}
 if(t.dataset.facilityUpgrade){openFacilityUpgrade(Number(t.dataset.facilityUpgrade));return;}
 if(t.dataset.upgradeConfirm){const id=Number(t.dataset.upgradeConfirm);operateFacility('upgrade',id);closeModal();selectFacility(id);return;}
 if(t.dataset.facilityMove){const facility=getSettlement(state).buildings.find(b=>b.id===Number(t.dataset.facilityMove));if(facility)beginConstruction(facility.type,facility.id);return;}
 if(t.hasAttribute('data-next-goal')){if(runningFarm&&actionBusy)afterCurrentFarm(nextSettlementStep);else if(!actionBusy)nextSettlementStep();return;}
 if(t.dataset.selectSeed&&CROP_IDS.includes(t.dataset.selectSeed as CropId)){selectSeed(t.dataset.selectSeed as CropId);return;}
 if(t.hasAttribute('data-seed-change')){openSeedInventory();return;}
 if(t.dataset.quick==='plant'){
  if(!seedChosen)openSeedInventory();else if(farmMode==='plant')farmAllEligible();else startFarmMode('plant');return;
 }
 if(t.dataset.quick==='water'||t.dataset.quick==='harvest'){startFarmMode(t.dataset.quick,undefined,true);return;}
 if(t.dataset.farmAll==='water'||t.dataset.farmAll==='harvest'){startFarmMode(t.dataset.farmAll,undefined,true);return;}
 if(t.hasAttribute('data-plant-cancel')){afterFarm=null;stopFarmMode();toast(runningFarm?'지금 밭을 마치고 작업을 종료해요.':'연속 텃밭 작업을 종료했어요.');return;}
 if(t.hasAttribute('data-plant-all')){farmAllEligible();return;}
 if(t.hasAttribute('data-seed-gather')){closeModal();afterCurrentFarm(()=>void action('gather'));return;}
 if(actionBusy){
  if(runningFarm&&(t.dataset.nav||t.dataset.open||t.dataset.zone||t.hasAttribute('data-look-grove')||t.hasAttribute('data-show-farm'))){afterCurrentFarm(()=>navigateButton(t));return;}
  if(runningFarm&&t.dataset.quick){const next=t.dataset.quick as Action;afterCurrentFarm(()=>void action(next));return;}
  if(runningFarm&&t.dataset.action){const next=t.dataset.action as Action,plot=t.dataset.plot!==undefined?Number(t.dataset.plot):undefined;if(['plant','water','harvest'].includes(next))startFarmMode(next as FarmAction,plot);else afterCurrentFarm(()=>void action(next,plot));return;}
  if(runningFarm&&t.hasAttribute('data-close')){closeModal();return;}
  e.preventDefault();toast('하던 작업을 마치면 다시 움직일 수 있어요.');return;
 }
 if(t.matches('a[href="#"]')){e.preventDefault();closeModal();}
 if(navigateButton(t))return;
 if(t.dataset.stage){selectedStage=Number(t.dataset.stage);openModal('hunt');}
 if(t.hasAttribute('data-start-hunt'))startBattle();
 if(t.hasAttribute('data-close'))closeModal();
 if(t.dataset.restRetry){
  const retry=t.dataset.restRetry as Action,plot=t.dataset.plot!==undefined?Number(t.dataset.plot):undefined;
  closeModal();farmQueue=[];const rested=performAction(state,'rest');
  if(rested.ok){state=rested.state;persist();render();toast(rested.message);
   if(['plant','water','harvest'].includes(retry)){
    if(retry==='plant'){const crop=t.dataset.crop as CropId;if(CROP_IDS.includes(crop))rememberSeed(crop);}
    farmMode=null;startFarmMode(retry as FarmAction,plot,plot===undefined);
   }else void action(retry,plot);
  }else toast(rested.message);
 }
 if(t.dataset.plotStep){const index=state.plots.findIndex(p=>p.id===selectedPlotId);const next=(index+Number(t.dataset.plotStep)+state.plots.length)%state.plots.length;setZone('home',true);selectPlot(state.plots[next]?.id??null);}
 if(t.dataset.quick){const a=t.dataset.quick as Action;const farm=['water','harvest'].includes(a);const plot=farm?quickPlot(a as FarmAction):undefined;if(farm&&plot){selectedPlotId=plot.id;scene.setSelectedPlot(plot.id);}void action(a,plot?.id);}
 if(t.dataset.action)void action(t.dataset.action as Action,t.dataset.plot!==undefined?Number(t.dataset.plot):undefined);
 if(t.dataset.gender){selectedGender=t.dataset.gender as Gender;document.querySelectorAll('[data-gender]').forEach(el=>el.classList.toggle('selected',el===t));}
 if(t.hasAttribute('data-start')){const name=(document.querySelector<HTMLInputElement>('#player-name')?.value??'').trim();if(!name){toast('함께할 생존자의 이름을 알려 주세요.');return;}state={...state,gender:selectedGender,name:name.slice(0,16)};persist();closeModal();render();toast(`${state.name}, 우리집에 온 걸 환영해요!`);}
 if(t.hasAttribute('data-sound')){sound=!sound;document.querySelector('.sound-toggle')!.innerHTML=icon(sound?'volume':'mute');document.querySelector('.sound-toggle')!.setAttribute('aria-label',sound?'소리 끄기':'소리 켜기');if(sound)ping();if(currentModal==='settings')renderSettings();}
 if(t.hasAttribute('data-pause')){paused=!paused;document.querySelector('.time-button')!.innerHTML=icon(paused?'play':'pause');document.querySelector('.time-button')!.setAttribute('aria-label',paused?'시간 계속':'시간 일시정지');if(currentModal==='settings')renderSettings();}
 if(t.hasAttribute('data-save'))toast(persist()?'소중한 하루를 저장했어요.':'저장하지 못했어요. 기기 저장 공간을 확인해 주세요.');
 if(t.hasAttribute('data-reset')){stopFarmMode();seedChosen=false;selectedCropId='carrot';try{localStorage.removeItem(selectedSeedStorageKey);}catch{}state=createGame(state.gender,'하루');selectedPlotId=state.plots[0]?.id??null;setZone('home');persist();render();openModal('welcome');}
 if(t.hasAttribute('data-update'))void runUpdate(true);
 if(t.hasAttribute('data-download')&&lastUpdate?.release)void downloadUpdate(lastUpdate.release).catch(()=>toast('다운로드를 열지 못했어요. 잠시 후 다시 시도해 주세요.'));
});
document.querySelector('#modal-root')!.addEventListener('click',e=>{if(e.target===e.currentTarget)closeModal();});
document.addEventListener('keydown',e=>{if(battleView||contentActivationPending)return;if(e.key==='Escape'){if(currentModal)closeModal();else if(placement)cancelConstruction();else if(selectedFacilityId!==null)closeFacility();else if(farmMode){afterFarm=null;stopFarmMode();}}if(actionBusy&&e.key!=='Tab')return;if(e.key==='Tab'&&currentModal){const els=Array.from(document.querySelectorAll<HTMLElement>('#modal-root button:not([disabled]), #modal-root input'));const first=els[0],last=els.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}});
let saveCounter=0;
setInterval(()=>{if(paused||document.hidden||actionBusy||battleView||contentActivationPending||currentModal==='welcome')return;state=tick(state,1);render();if(++saveCounter>=10){persist();saveCounter=0;}},1000);
document.addEventListener('visibilitychange',()=>{if(document.hidden){farmQueue=[];afterFarm=null;renderControls();persist();}else void initializeUpdateSystem().then(()=>runUpdate());});
setInterval(maybeApplyContentUpdate,500);
window.addEventListener('pagehide',persist);
render();
if(!stored)openModal('welcome');
if(recoveredExpedition){persist();toast('이전 원정에서 안전하게 귀환했어요. 트럭에서 다시 출발할 수 있어요.');}
void initializeUpdateSystem();
