import { formatGameDuration } from './game-time';
import '@fontsource-variable/dm-sans';
import './style.css';
import './gameplay.css';
import './growth-quests.css';
import './map-controls.css';
import './farm-expansion.css';
import './village.css';
import { createGame, performAction, tick, applyOfflineProgress, saveGame, loadGame, expansionCost, farmExpansionCost, getFarmCapacity, questList, getCropProgress, resourceLabels, MAX_DECK_LEVEL, beginHunt, finishHunt, cancelHunt, setCompanionTeam, type Action, type Gender, type Resource, type CropId, CROPS, CROP_IDS, getSeedInventory, getSeedCount, getPlotCropId } from './game';
import { getVillageOrder, fulfillVillageOrder } from './village-orders';
import { Scene } from './scene';
import { getLayoutDirection, rotateLayoutTarget, type LayoutTarget } from './layout-direction';
import { BUILDINGS, BUILDING_TYPES, getSettlement, getUpgradeCost, buildFacility, moveFacility, replaceFacility, upgradeFacility, startProduction, collectProduction, collectAndRestartProduction, getBuiltTypes, buildTruckFloor, type Building, type BuildingType } from './settlement';
import { getTruckFloorCount, getTruckFloorCost, getFloorBounds, type TruckFloor } from './truck-layout';
import { DECK_CELL_SIZE, getDeckGridBounds, getBuildingFootprint, getFacilityPlacement, snapFacilityPlacement, findFreeFacilityPlacement, checkFacilityPlacement, type FacilityPlacement } from './deck-placement';
import { buildingCatalog, facilitySheet, facilityUpgradePreview, productionState } from './settlement-ui';
import { GROWTH_CHAPTERS, getGrowthQuests, getActiveGrowthQuest, claimGrowthQuest } from './growth-quests';
import { renderGrowthQuestBoard, updateGrowthQuestBoard } from './growth-quests-ui';
import { getVillageHub, type VillageTarget, type VillageAdvice } from './village-guide';
import { renderVillageHub, updateVillageHub, renderVillageManagement, updateVillageManagement } from './village-hub';
import { facilityIcon } from './settlement-art';
import { BattleView } from './battle-view';
import { STAGE_NAMES, type BattleResult } from './battle';
import { icon, portrait } from './icons';
import { getCompanions } from './companions';
import { UNIT_IDS, UNITS, getUnitRoster, getUnlockedUnitIds, getSelectedTeam, getReadyTeam, getUnitLevel, getUnitMaxHealth, getUnitBattleBonuses, isUnitId, canAnimalBoardTruck, getAnimalDeckUnlockLevel, type UnitId } from './units';
import { companionPortrait } from './companion-art';
import './companions.css';
import './planning.css';
import './truck-floors.css';
import './pwa.css';
import './village-hub.css';
import './layout-directions.css';
import { isAppleMobileDevice, isHomeScreenGame, showInstallHelp, hasInstallPrompt, installHomeScreenGame, homeScreenInstructions } from './pwa-install';
import { BATTLE_ART_URLS } from './battle-art';
import { cropIcon } from './crop-art';
import { APP_VERSION, checkUpdate, downloadUpdate, initializeAutoUpdates, prepareAutomaticUpdate, installPreparedUpdate, isNativeUpdateSupported, type AutomaticUpdateState, type UpdateResult } from './update';
import { isLiveUpdateSupported, checkLiveUpdate, activateLiveUpdate, canActivateLiveUpdate, acknowledgeLiveUpdate, setWebUpdateActivationGuard, type LiveUpdateState } from './live-update';
import { runStartupPatch } from './startup-patch';
import { getShop, getEquippedOutfit, buyShopSeed, buyShopPet, buyShopOutfit, equipShopOutfit, sellShopResource } from './shop';
import { renderShop, renderShopPurchaseConfirmation, SHOP_TABS, type ShopTab, type ShopQuantity, type ShopPurchaseKind } from './shop-ui';
import './shop.css';
import { getFarmOrder, getFarmPlotCare, fulfillFarmOrder } from './farm-economy';
import { renderFarmDelivery, renderFarmCropLedger, renderFarmDeliveryPreview, updateFarmDeliveryPreview } from './farm-economy-ui';
import { OUTDOOR_SITES, getOutdoorSite, type OutdoorSiteId } from './outdoor-sites';
import { getGatheringArea, getGatheringRegion, getGatheringNode, performGatheringAction, migrateLegacyGatheringFields } from './gathering';
import { GROUND_RESOURCE_NODES, getGroundResourceNode, getGroundResourceZone, type GroundResourceId } from './ground-resources';
import { GROUND_REGIONS, getGroundRegion, type GroundRegionId } from './ground-regions';
import { getPetPassage, setPetPassageOpen } from './pet-passage';
import { recoverEnergy, secondsUntilEnergyRecovery } from './energy-recovery';
import './farm-economy.css';
import './outdoor.css';
import './hud-layout.css';
import './game-dialog.css';
import './deck-placement.css';
import { initializeGameOrientation, type GameOrientationController, type GameOrientationState } from './game-orientation';
import './landscape.css';
import './gathering-dock.css';
import './animal-interactions.css';
import './haven-visuals.css';

const stored = loadGame();
let state = stored ?? createGame('female', '하루');
// Anchor old site cooldowns to the original saved time before normal offline
// progress consumes that absence. Loading alone never grants materials.
state = { ...state, ...migrateLegacyGatheringFields(state) };
let playerConfirmed = Boolean(stored);
const recoveredExpedition = Boolean(state.expedition);
if (recoveredExpedition) state = { ...cancelHunt(state).state, lastSaved: Date.now() };
let actionBusy = false;
type FarmAction='plant'|'water'|'harvest'|'fertilize';
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
let gatheringTrayOpen=false;
let animalContextId:UnitId|null=null;
let animalPanelKey='';
let animalRideKey='';
let animalActionKind:'pet'|'mount'|'dismount'|null=null;
let selectedFacilityId:number|null=null;
let placement:{type:BuildingType;point:FacilityPlacement|null;movingId?:number}|null=null;
let modalBackdropPointer:number|null=null;
let modalBackdropClickPointer:number|null=null;
let selectedGrowthChapter:number|undefined;
let questAdvanceGuardUntil=0;
let orderAdvanceGuardUntil=0;
let questSeedHint:CropId|null=null;
let paused = false;
let sound = false;
let selectedGender:Gender=state.gender;
let currentModal='';
let shopTab:ShopTab='seeds';
let shopQuantity:ShopQuantity=1;
let shopPending:{kind:ShopPurchaseKind;id:string;quantity:ShopQuantity}|null=null;
let renderedShopKey='';
let renderedFarmDeliveryKey='';
let renderedRoadsideKey='';
let activeRoadsideSite:OutdoorSiteId|null=null;
let activeGroundRegion:GroundRegionId|null=null;
let lastUpdate:UpdateResult|undefined;
let updateBusy=false;
let automaticUpdate:AutomaticUpdateState={status:'idle',progress:0,message:'앱 기능의 새 버전을 자동으로 확인해요.'};
let liveUpdate:LiveUpdateState={status:'idle',progress:0,message:'게임 콘텐츠는 앱 안에서 자동으로 업데이트해요.'};
let updateInitializing:Promise<void>|null=null;
let installAfterWork=false;
let contentActivationPending=false;
let startupPending=isLiveUpdateSupported();
let orientationBlocked=false;
let gameOrientation:GameOrientationController|null=null;
let toastTimer:ReturnType<typeof setTimeout>;
let audioContext:AudioContext|undefined;
const app = document.querySelector<HTMLDivElement>('#app')!;
const contentApplyingNotice=document.createElement('div');
contentApplyingNotice.className='content-applying-notice';contentApplyingNotice.hidden=true;contentApplyingNotice.setAttribute('role','status');contentApplyingNotice.setAttribute('aria-live','polite');
contentApplyingNotice.innerHTML='<strong>게임 업데이트 적용 중</strong><span>진행을 저장했어요. 잠시만 기다려 주세요.</span>';document.body.append(contentApplyingNotice);
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const navItems=[['hammer','건설','build'],['seeds','농사','farm'],['map','탐험','hunt'],['shop','상점','shop']];
const quickItems=[['harvest','food','수확'],['water','water','물 주기'],['plant','seeds','씨앗 심기'],['fertilize','seeds','영양 주기'],['chop','axe','벌목'],['gather','scrap','고철']] as const;
const gatheringShortcuts=[['wood','나무'],['scrap','고철'],['seeds','씨앗'],['water','연못']] as const;
type GatheringShortcutResource=typeof gatheringShortcuts[number][0];
app.innerHTML=`
 <div class="shell game-shell village-shell">
  <header class="topbar game-topbar">
   <button class="profile-button" data-open="character" aria-label="캐릭터 변경" id="profile"></button>
   <div class="survivor-name"><strong id="resident-name"></strong><span><b id="player-level">Lv.1</b><i>·</i> DAY <b id="day">01</b></span></div>
   <button class="vitals vitals-energy" id="vitals" data-open="energy" aria-label="기력 자동 회복 시간 보기"></button>
   <button class="round-button village-menu" data-open="menu" aria-label="마을 메뉴">${icon('settings')}</button>
   <button class="round-button sound-toggle" data-sound aria-label="소리 켜기" hidden>${icon('mute')}</button>
   <span class="save-status" id="save-status" role="status">${icon('check')} 저장됨</span>
  </header>
  <button class="resource-bar" data-open="bag" aria-label="보유 자원과 창고 열기" id="resources"></button>
  <main class="game-main">
   <section class="scene-card" aria-label="트럭 위 우리집 게임 화면">
    <canvas id="world" aria-label="텃밭과 생활 시설이 있는 거대한 트럭. 빈 바닥을 눌러 이동하고, 시설을 눌러 재배치할 수 있어요."></canvas>
    <div class="scene-top"><div class="scene-label"><span class="live-dot"></span><strong id="zone-name">우리 트럭</strong><span id="truck-level">Lv.1</span></div><button class="scene-icon" data-open="guide" aria-label="게임 도움말">?</button></div>
    <div class="scene-weather"><span id="weather-icon">${icon('sun')}</span><div><strong id="clock">08:00</strong><small id="weather-text">기분 좋은 아침</small></div><button data-pause class="time-button" aria-label="시간 일시정지">${icon('pause')}</button></div>
    <div class="truck-floor-controls" role="group" aria-label="트럭 층 선택"><button data-truck-floor="1" aria-pressed="true">1층</button><button data-truck-floor="2" aria-pressed="false">2층 <small>Lv.4</small></button><button data-truck-floor="3" aria-pressed="false">3층 <small>Lv.7</small></button><button data-open="floors" aria-label="층 증축">${icon('plus')}<small>증축</small></button></div>
    <button class="game-tool map-move-tool" data-map-move aria-pressed="false" aria-label="화면 이동 모드 켜기"><span>${icon('move')}</span><small>화면 이동</small></button>
    <button class="game-tool farm-expand-tool" data-open="farm-expand" aria-label="밭 확장"><span>${icon('plot-empty')}<b data-farm-capacity></b></span><small>밭 확장</small></button>
    <div class="scene-tools"><button class="game-tool" data-open="build" aria-label="시설 건설"><span>${icon('hammer')}</span><small>건설</small></button><button class="game-tool" data-open="expand" aria-label="트럭 확장"><span>${icon('expand')}</span><small>확장</small></button><button class="game-tool growth-goals-tool" data-open="settlement-goals" aria-label="마을 성장 목표"><span>${icon('flag')}<b data-growth-ready hidden>!</b></span><small>성장 목표</small></button></div>
    <button class="update-badge" id="update-badge" hidden data-update-notice aria-live="polite"><span>${icon('download')}</span><div><strong></strong><small></small></div></button>
    <button class="game-tool village-order-tool" data-open="orders" aria-label="마을 의뢰"><span>${icon('bag')}<b data-order-ready hidden>!</b></span><small>마을 의뢰</small></button>
    <button class="game-tool camera-tool" data-camera-toggle aria-expanded="false" aria-label="지도 조작 펼치기"><span>${icon('move')}</span><small>지도</small></button>
    <div class="map-controls" role="group" aria-label="지도 확대와 축소"><button data-map-zoom="1" aria-label="지도 확대"><span>+</span><small>확대</small></button><button data-map-reset aria-label="지도 기본 크기로 보기"><strong data-map-percent>100%</strong><small>기본 보기</small></button><button data-map-zoom="-1" aria-label="지도 축소"><span>−</span><small>축소</small></button><button data-map-overview aria-label="트럭 마을 전체 보기"><span>${icon('map')}</span><small>전체 보기</small></button><button data-farm-toggle aria-label="농사 도구 펼치기"><span>${icon('seeds')}</span><small>농사 도구</small></button></div>
    <button class="settlement-objective" id="settlement-objective" data-next-goal aria-label="현재 성장 목표 진행"><span>${icon('flag')}</span><div><small id="objective-chapter">도로 위 우리 마을</small><strong id="objective-title">첫 목표를 확인해 보세요</strong><p id="objective-detail">작은 목표를 따라 우리 마을을 키워요</p><div class="objective-progress" aria-hidden="true"><i></i></div></div><b class="objective-cta" data-objective-cta>하러 가기</b></button>
    <div class="village-hub" id="village-hub">${renderVillageHub(getVillageHub(state))}</div>
    <div class="gathering-dock" aria-label="채집 도구">
     <div class="gathering-tray" id="gathering-tray" role="group" aria-label="전체 채집지의 준비된 자원 · 선택하면 가까운 곳에서 채집" hidden>${gatheringShortcuts.map(([resource,label])=>`<button data-gather-resource="${resource}">${icon(resource)}<span><strong>${label}</strong><small data-gather-ready="${resource}">채집 준비</small></span></button>`).join('')}</div>
     <button class="gathering-toggle" data-gather-toggle aria-controls="gathering-tray" aria-expanded="false" aria-label="채집 도구 펼치기">${icon('axe')}<strong data-gather-toggle-label>채집</strong>${icon('chevron')}</button>
    </div>
    <section class="animal-sheet" id="animal-sheet" hidden aria-label="동물과 함께하기"></section>
    <section class="animal-ride-hud" id="animal-ride-hud" hidden aria-label="동물 탑승 중"></section>
    <div class="road-controls" id="road-controls" aria-label="전체 지도와 도로 활동"><button data-camera-player aria-label="지금 층의 전체 맵을 기본 크기로 보기">${icon('map')}<small>전체 보기</small></button><button data-road-walk aria-label="계단를 내려가 도로 걷기">${icon('move')}<small>도로 걷기</small></button><button class="travel-extra" data-open="roadside" aria-label="도로 채집 장소 보기">${icon('map')}<small>채집 장소</small></button><button class="travel-extra" data-road-return aria-label="실제 계단으로 트럭에 돌아오기">${icon('truck')}<small>트럭으로</small></button><button class="travel-extra" data-open="pet-passage" aria-label="동물 통로 문 조작">${icon('paw')}<small>동물 문</small></button><button class="travel-more" data-travel-toggle aria-label="도로 도구 펼치기" aria-expanded="false" aria-controls="road-controls">${icon('chevron')}<small>이동</small></button></div>
    <div class="construction-bar" id="construction-bar" hidden aria-live="polite"></div>
    <section class="facility-sheet" id="facility-sheet" hidden aria-label="선택한 시설"></section>
    <div class="chore-status" hidden role="status" aria-live="polite"></div>
    <div class="game-controls" id="farm-tray" hidden role="region" aria-label="농사 도구">
     <header class="farm-tray-heading"><strong>농사 도구</strong><button class="panel-dismiss" data-farm-dismiss aria-label="농사 도구 닫기">${icon('close')}<small>닫기</small></button></header>
     <div class="planting-toolbar" id="planting-toolbar" hidden aria-label="연속 텃밭 작업">
      <div class="planting-selection"><span id="planting-seed-art"></span><div><strong id="planting-seed-name"></strong><small id="planting-seed-status" role="status" aria-live="polite"></small></div></div>
      <button class="planting-tool" data-plant-all aria-label="빈 밭에 선택한 씨앗 연속 심기"><span>${icon('seeds')}</span><small>모두 심기</small></button>
      <button class="planting-tool" data-seed-change aria-label="다른 씨앗 선택"><span>${icon('bag')}</span><small>씨앗 바꾸기</small></button>
      <button class="planting-tool" data-plant-cancel aria-label="연속 심기 종료"><span>${icon('close')}</span><small>심기 종료</small></button>
     </div>
     <div class="farm-context" id="farm-context" aria-label="선택한 밭과 할 일">
      <div class="plot-selector"><button data-plot-step="-1" aria-label="이전 밭 선택">${icon('chevron')}</button><div><strong id="context-title">1번 밭</strong><span id="context-state">수확할 준비가 됐어요</span></div><button data-plot-step="1" aria-label="다음 밭 선택">${icon('chevron')}</button></div>
      <button class="context-action" id="plot-action"><span class="control-icon">${icon('food')}</span><small>수확하기</small></button>
      <button class="context-direction" data-layout-rotate="plot" aria-label="선택한 밭 방향 바꾸기" aria-pressed="false">${icon('refresh')}<small>방향</small></button>
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
const scene=new Scene(document.querySelector('#world')!,(kind,plotId?:number,point?:FacilityPlacement)=>{
 if(startupPending||orientationBlocked||battleView||contentActivationPending)return;
 if(currentModal){if(currentModal==='build'||currentModal==='expand'||currentModal==='floors')closeModal();return;}
 if(kind==='build-placement'){if(point)previewConstruction(point);return;}
 if(kind==='build-slot'){if(!placement&&!actionBusy)openModal('build');return;}
 if(kind==='facility-collect'||kind==='facility-start'){if(plotId!==undefined)operateFacility(kind==='facility-collect'?'collect':'start',plotId);return;}
 if(kind==='facility'){if(plotId!==undefined){if(placement)toast('원하는 데크 바닥을 눌러 배치해 주세요.');else selectFacility(plotId);}return;}
 if(kind==='farm-expand'){if(!actionBusy)openModal('farm-expand');return;}
 if(kind==='outdoor-site'){const site=OUTDOOR_SITES[plotId??-1];if(site&&!actionBusy)openRoadsideSite(site.id);return;}
 if(kind==='ground-resource'){const node=GROUND_RESOURCE_NODES[plotId??-1];if(node)void gatherGroundResource(node.id);return;}
 if(kind==='pet-gate'){if(!actionBusy)openModal('pet-passage');return;}
 if(kind==='farm'&&farmMode){if(plotId!==undefined)enqueueFarmPlot(plotId);return;}
 if(actionBusy)return;
 if(kind==='farm'){
  const plot=state.plots.find(p=>p.id===plotId)??preferredPlot();if(!plot)return;
  setZone('home',true);selectPlot(plot.id);
  if(getCropProgress(state,plot)>=1)startFarmMode('harvest',plot.id);
  else if(plot.plantedAt!==null&&!plot.watered)startFarmMode('water',plot.id);
  else if(plot.plantedAt===null){if(seedChosen)startFarmMode('plant',plot.id);else openSeedInventory();}
 }
 else if(farmMode)stopFarmMode();
 if(kind==='truck')openModal('expand');
 if(kind==='pet'){const id=plotId===undefined?'dog':UNIT_IDS[plotId];if(id)showAnimalContext(id);}
 if(kind==='character')openModal('character');
 if(kind==='grove'){setZone('grove');renderControls();}
 if(kind==='grove-work')void roadsideAction('grove');
});
function updateMapMoveControl(){
 const enabled=scene.getMapMoveMode(),button=document.querySelector<HTMLButtonElement>('[data-map-move]')!;
 button.setAttribute('aria-pressed',String(enabled));
 button.setAttribute('aria-label',enabled?'화면 이동 모드 끄기, 밭 작업으로 돌아가기':'화면 이동 모드 켜기');
 document.querySelector('.scene-card')!.classList.toggle('map-move-active',enabled);
 button.querySelector('small')!.textContent=enabled?'이동 모드':'화면 이동';
}
function recenterMap(){scene.setMapMoveMode(false);scene.resetMapView();}
function resumePlayerView(){
 closeModal();cancelConstruction();closeFacility();if(!actionBusy)stopFarmMode();
 setZone('home',false,true);setFarmTray(false);scene.setFarmFocus(false);scene.setMapMoveMode(false);scene.showVillageOverview();updateWalkingAvailability();
}
function updateWalkingAvailability(){
 scene.setWalkingEnabled(playerConfirmed&&!startupPending&&!orientationBlocked&&!contentActivationPending&&!battleView&&!currentModal&&!placement&&selectedFacilityId===null&&!actionBusy);
 renderGatheringDock();
 renderAnimalUI();
}
document.querySelector('#world')!.addEventListener('sceneanimalinteractionchange',event=>{
 const detail=(event as CustomEvent<{phase:string}>).detail;
 if(animalActionKind){const label=document.querySelector('[data-animal-phase]');if(label)label.textContent=detail.phase==='approaching'?'곁으로 걸어가는 중':detail.phase==='petting'?'다정하게 쓰다듬는 중':detail.phase==='mount'?'등에 올라타는 중':detail.phase==='dismount'?'안전한 땅으로 내려오는 중':'함께하는 중';}
 updateWalkingAvailability();
});
document.querySelector('#world')!.addEventListener('scenewalkchange',()=>{
 // A menu or a new chore may stop a walk synchronously; assess patch safety
 // after that interaction has finished changing the controller state.
 if(!scene.isWalking())queueMicrotask(finishDeferredUpdate);
});
document.querySelector('#world')!.addEventListener('scenemovemodechange',updateMapMoveControl);
document.querySelector('#world')!.addEventListener('scenefloorchange',()=>{renderFloorControls();renderGatheringDock();});
updateMapMoveControl();
function updateZoomControls(){
 const zoom=scene.getMapZoom();
 document.querySelector('[data-map-percent]')!.textContent=`${Math.round(zoom*100)}%`;
 document.querySelector<HTMLButtonElement>('[data-map-zoom="1"]')!.disabled=zoom>=2.5-.001;
 document.querySelector<HTMLButtonElement>('[data-map-zoom="-1"]')!.disabled=zoom<=.75+.001;
 document.querySelector('[data-map-reset]')!.setAttribute('aria-label',`현재 지도 ${Math.round(zoom*100)}%, 기본 크기로 보기`);
}
document.querySelector('#world')!.addEventListener('scenezoomchange',updateZoomControls);
document.querySelector('#world')!.addEventListener('sceneactionchange',event=>{
 const detail=(event as CustomEvent<{phase:string;progress:number;climbing:'up'|'down'|null}>).detail;
 const status=document.querySelector<HTMLElement>('.chore-status')!;if(status.hidden)return;
 const phase=status.querySelector('[data-chore-phase]'),track=status.querySelector<HTMLElement>('.chore-track');
 const text=detail.climbing==='down'?'계단 내려가는 중':detail.climbing==='up'?'계단 올라가는 중':detail.phase==='waiting'?'친구가 지나가길 기다리는 중':detail.phase==='working'?(phase?.getAttribute('data-working-label')??'작업 중'):detail.phase==='returning'?'돌아오는 중':'이동 중';
 if(phase&&phase.textContent!==text)phase.textContent=text;
 if(track){track.setAttribute('aria-valuenow',String(detail.progress));track.querySelector<HTMLElement>('i')!.style.width=`${detail.progress}%`;}
});
updateZoomControls();
function setFarmTray(open:boolean){
 if(open&&selectedZone==='home')scene.setActiveFloor(1);
 farmTrayOpen=open;document.querySelector<HTMLElement>('#farm-tray')!.hidden=!open;
 document.querySelector('.scene-card')!.classList.toggle('farm-tray-open',open);
 const toggle=document.querySelector<HTMLButtonElement>('[data-farm-toggle]')!;
 toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',open?'농사 도구 접기':'농사 도구 펼치기');
 toggle.querySelector('small')!.textContent=open?'도구 접기':'농사 도구';
}
function dismissFarmTray(){
 afterFarm=null;stopFarmMode();
 // Closing stops new reservations; the current job keeps its completion path.
 setZone('home',false,true);
 document.querySelector<HTMLButtonElement>('[data-nav="farm"]')?.focus({preventScroll:true});
 finishDeferredUpdate();
}
function closeFacility(){document.querySelector('#toast')!.classList.remove('facility-toast');selectedFacilityId=null;scene.setSelectedFacility(null);document.querySelector<HTMLElement>('#facility-sheet')!.hidden=true;document.querySelector('.scene-card')!.classList.remove('facility-selected','facility-repeat-ready');updateWalkingAvailability();}
function changeLayoutDirection(target:LayoutTarget){
 if(actionBusy||farmQueue.length||runningFarm||placement){toast('지금 작업을 마치고 방향을 바꿔 주세요.');return;}
 const result=rotateLayoutTarget(state,target);if(!result.ok){toast(result.message);return;}
 if(target.kind==='facility'&&!scene.relocatePetsForPlacement(result.state)){toast('주변 통로를 비운 뒤 방향을 바꿔 주세요.');return;}
 state=result.state;persist();
 render();ping();toast(result.message);
}
function cancelConstruction(){placement=null;scene.setConstructionMode(null);scene.setPlanningViewport(null);document.querySelector<HTMLElement>('#construction-bar')!.hidden=true;document.querySelector('.scene-card')!.classList.remove('construction-mode');updateWalkingAvailability();}
function deckCellCount(deckLevel:number){const grid=getDeckGridBounds({deckLevel});return (grid.right-grid.left)*(grid.bottom-grid.top)/(DECK_CELL_SIZE*DECK_CELL_SIZE);}
function facilityLocationLabel(building:Building){const point=getFacilityPlacement(state,building),size=getBuildingFootprint(building.type,point.rotation);return `${point.floor}층 · ${size.columns}×${size.rows}칸`;}
function renderFloorControls(){
 const count=getTruckFloorCount(state),active=scene.getActiveFloor(),group=document.querySelector<HTMLElement>('.truck-floor-controls')!;
 group.hidden=selectedZone==='grove';
 group.dataset.floorCount=String(count);
 group.classList.toggle('show-locked-floors',Boolean(placement||currentModal==='floors'));
 document.querySelector('.scene-card')!.classList.toggle('multi-floor-village',count>1);
 group.querySelectorAll<HTMLButtonElement>('[data-truck-floor]').forEach(button=>{
  const floor=Number(button.dataset.truckFloor) as TruckFloor,locked=floor>count;
  button.classList.toggle('locked',locked);button.setAttribute('aria-pressed',String(floor===active));
  button.setAttribute('aria-label',locked?`${floor}층 증축 · 데크 Lv.${floor===2?4:7} 필요`:`트럭 ${floor}층 보기`);
  button.innerHTML=`${floor}층${locked?` <small>Lv.${floor===2?4:7}</small>`:''}`;
  button.disabled=actionBusy||Boolean(battleView)||startupPending||orientationBlocked||contentActivationPending;
 });
}
function chooseTruckFloor(floor:TruckFloor){
 if(!requireOnFoot())return;
 if(actionBusy){toast('지금 작업을 마친 뒤 층을 바꿀 수 있어요.');return;}
 if(floor>getTruckFloorCount(state)){openModal('floors');return;}
 closeModal();closeFacility();stopFarmMode();setZone('home');setFarmTray(false);
 scene.setActiveFloor(floor);
 if(placement){placement.point=initialConstructionPoint(placement.type,floor);scene.setConstructionMode(placement.type,placement.point,placement.movingId);}
 renderFloorControls();renderSettlement();
}
function purchaseTruckFloor(){
 if(!requireOnFoot())return;
 if(actionBusy||battleView)return;
 const next=getTruckFloorCost(state);if(!next)return;
 const result=buildTruckFloor(state);if(!result.ok){toast(result.message);return;}
 state=result.state;closeModal();persist();render();scene.setActiveFloor(next.floor);renderFloorControls();ping();toast(result.message);
}
function selectFacility(id:number){
 const facility=getSettlement(state).buildings.find(b=>b.id===id);if(!facility)return;
 cancelConstruction();if(!actionBusy)stopFarmMode();closeModal();setZone('home');setFarmTray(false);selectedFacilityId=id;scene.setSelectedFacility(id);updateWalkingAvailability();renderSettlement();scene.focusFacility(id);
}
function beginConstruction(type:BuildingType,movingId?:number){
 if(!requireOnFoot())return;
 if(battleView)return;if(actionBusy){toast('지금 작업을 마치면 시설을 배치할 수 있어요. 건설 목록은 둘러볼 수 있어요.');return;}
 const definition=BUILDINGS[type];
 if(state.deckLevel<definition.unlockLevel){toast(`데크 Lv.${definition.unlockLevel}부터 ${definition.name}을 지을 수 있어요.`);openModal('expand');return;}
 recenterMap();closeModal();closeFacility();stopFarmMode();setZone('home');setFarmTray(false);
 const building=movingId===undefined?undefined:getSettlement(state).buildings.find(item=>item.id===movingId);
 const point=building?getFacilityPlacement(state,building):initialConstructionPoint(type,scene.getActiveFloor());
 scene.setActiveFloor(point.floor);
 placement={type,point,...(movingId!==undefined?{movingId}:{})};scene.setConstructionMode(type,point,movingId);updateWalkingAvailability();renderFloorControls();renderSettlement();scene.setPlanningViewport('placement');
 toast(movingId?'원하는 바닥을 누르거나 끌어 시설을 옮겨요.':'원하는 위치를 누르거나 끌고, 초록색일 때 건설을 확정해요.');
}
function initialConstructionPoint(type:BuildingType,floor:TruckFloor):FacilityPlacement{
 const free=findFreeFacilityPlacement(state,type,floor,placement?.movingId);if(free)return free;
 const deck=getFloorBounds(state.deckLevel,floor);
 return snapFacilityPlacement(state,type,{floor,x:(deck.left+deck.end)/2,y:(deck.back+deck.front)/2,rotation:0});
}
function previewConstruction(point:FacilityPlacement){
 if(!placement)return;
 placement.point={...point};renderConstructionBar();
}
function renderConstructionBar(){
 if(!placement)return;
 const bar=document.querySelector<HTMLElement>('#construction-bar')!,definition=BUILDINGS[placement.type],moving=placement.movingId!==undefined,point=placement.point;
 const size=getBuildingFootprint(placement.type,point?.rotation??0);
 const check=point?checkFacilityPlacement(state,placement.type,point,placement.movingId):{ok:false,message:'원하는 데크 바닥을 눌러 주세요.'};
 const affordable=moving||state.resources.wood>=definition.wood&&state.resources.scrap>=definition.scrap;
 const key=JSON.stringify([placement.type,point,placement.movingId,check.ok,check.message,affordable]);
 bar.hidden=false;document.querySelector('.scene-card')!.classList.add('construction-mode');
 if(bar.dataset.preview!==key){
  bar.dataset.preview=key;
  bar.innerHTML=`<span class="construction-art">${facilityIcon(placement.type)}</span><div class="construction-info"><strong>${definition.name}${moving?' 재배치':''} <span class="construction-size">${size.columns}×${size.rows}칸</span></strong><small class="${check.ok?'construction-valid':'construction-invalid'}">${point?`${point.floor}층 · `:''}${check.ok?'설치 가능':check.message}</small><span class="construction-cost">${moving?'무료 · 레벨과 생산 유지':`${icon('wood')} <b data-placement-wood></b> / ${definition.wood} ${icon('scrap')} <b data-placement-scrap></b> / ${definition.scrap}`}</span></div><button class="placement-rotate" data-construction-rotate aria-label="시설 방향 회전" aria-pressed="${point?.rotation===1}">${icon('refresh')}<small>회전</small></button><button class="placement-confirm" data-construction-confirm ${!check.ok||!affordable?'disabled':''}>${icon('check')}<small>${moving?'이동 확정':'건설 확정'}</small></button><button class="placement-cancel" data-construction-cancel>${icon('close')}<small>취소</small></button>`;
 }
 const wood=bar.querySelector<HTMLElement>('[data-placement-wood]'),scrap=bar.querySelector<HTMLElement>('[data-placement-scrap]');if(wood)wood.textContent=String(state.resources.wood);if(scrap)scrap.textContent=String(state.resources.scrap);
 bar.classList.toggle('insufficient-materials',!affordable);
 bar.classList.toggle('placement-invalid',!check.ok);
}
function rotateConstruction(){
 if(!placement?.point)return;
 placement.point=snapFacilityPlacement(state,placement.type,{...placement.point,rotation:placement.point.rotation===0?1:0});
 scene.setConstructionMode(placement.type,placement.point,placement.movingId);renderConstructionBar();
}
function confirmConstruction(){
 if(!requireOnFoot())return;
 if(!placement?.point||actionBusy||battleView)return;
 const check=checkFacilityPlacement(state,placement.type,placement.point,placement.movingId);
 if(!check.ok){toast(check.message);return;}
 const plan=placement,previousIds=new Set(getSettlement(state).buildings.map(building=>building.id));
 const result=plan.movingId!==undefined?moveFacility(state,plan.movingId,plan.point!):buildFacility(state,plan.type,plan.point!);
 if(!result.ok){toast(result.message);return;}
 if(!scene.relocatePetsForPlacement(result.state)){toast('동물이 머물 안전한 빈 공간을 먼저 확보해 주세요.');return;}
 state=result.state;cancelConstruction();persist();render();ping();toast(result.message);
 const building=plan.movingId!==undefined?getSettlement(state).buildings.find(b=>b.id===plan.movingId):getSettlement(state).buildings.find(b=>!previousIds.has(b.id));
 if(building){selectFacility(building.id);if(plan.movingId===undefined)void showFacilityWork(building.id,'build');}
}
async function showFacilityWork(id:number,kind:'build'|'upgrade'){
 const building=getSettlement(state).buildings.find(b=>b.id===id);if(!building||actionBusy)return;
 actionBusy=true;app.setAttribute('aria-busy','true');renderControls();
 const status=document.querySelector<HTMLElement>('.chore-status')!;
 status.innerHTML=`<span class="chore-pulse">${icon('hammer')}</span><div><strong>${escape(state.name)}의 마을 작업<small data-chore-phase data-working-label="망치질하는 중">이동 중</small></strong><span>${BUILDINGS[building.type].name} ${kind==='build'?'망치로 새 시설을 완성해요':'망치로 시설을 튼튼하게 개선해요'}</span><div class="chore-track" role="progressbar" aria-label="시설 작업 진행" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i style="width:0%"></i></div></div>`;status.hidden=false;
 try{await scene.playFacilityAction(building.slot,kind,getFacilityPlacement(state,building),building.id);}catch(error){toast(error instanceof Error?error.message:'시설은 완성됐어요. 통로를 비운 뒤 다시 이동해 주세요.');}finally{actionBusy=false;status.hidden=true;app.removeAttribute('aria-busy');render();finishDeferredUpdate();}
}
function operateFacility(kind:'start'|'collect'|'upgrade',id:number){
 if(kind==='upgrade'&&!requireOnFoot())return;
 if(battleView||placement||contentActivationPending)return;
 if(actionBusy&&kind!=='collect'){toast('지금 작업을 마치면 생산과 개선을 시작할 수 있어요. 시설은 둘러볼 수 있어요.');return;}
 const result=kind==='start'?startProduction(state,id):kind==='collect'?collectProduction(state,id):upgradeFacility(state,id);
 if(result.ok){state=result.state;persist();render();ping();if(kind==='upgrade')void showFacilityWork(id,'upgrade');}else if(kind==='start'){currentModal='facility-supplies';modalShell('KEEP OUR VILLAGE MOVING','생산에 쓸 물자를 모아요',`<p class="activity-block-reason" role="status">${escape(result.message)}</p><button class="button full-width" data-open="roadside">${icon('map')} 부족한 생활 물자 찾기</button><button class="button button-light full-width activity-secondary" data-close>${icon('arrow')} 시설로 돌아가기</button>`);}toast(result.message);
}
function receiveAndRestartFacility(id:number){
 if(battleView||placement||contentActivationPending)return;
 const result=collectAndRestartProduction(state,id);
 if(result.ok){state=result.state;persist();render();ping();}
 toast(result.message);
}
function villageAdvice(key:string):VillageAdvice|undefined{
 const hub=getVillageHub(state);
 return key==='primary'?hub.primary:key==='investment'?hub.investment:key.startsWith('activity:')?hub.activities.find(item=>item.id===key.slice(9)):undefined;
}
function goToVillageTarget(target:VillageTarget){
 if(actionBusy||battleView||contentActivationPending){toast('지금 작업을 마친 뒤 이어서 할 수 있어요.');return;}
 if(target.kind==='quest'){
  const quest=getGrowthQuests(state).find(item=>item.id===target.questId);
  if(quest?.status==='ready')claimGrowthReward(quest.id);else goToGrowthQuest(target.questId);
  return;
 }
 if(target.kind==='facility'){
  selectFacility(target.id);
  if(target.operation==='upgrade')openFacilityUpgrade(target.id);
  else {
   const facility=getSettlement(state).buildings.find(building=>building.id===target.id);
   if(facility&&target.operation==='start'&&facility.readyAt===null)operateFacility('start',target.id);
   else if(facility&&target.operation==='collect'&&productionState(state,facility).ready)operateFacility('collect',target.id);
  }
  return;
 }
 if(target.kind==='build'){showQuestBuild(target.buildingType);return;}
 if(target.kind==='roadside'){openRoadsideSite(target.siteId);return;}
 if(target.kind==='farm'){
  if(target.mode==='plant'){
   openSeedInventory();
   if(target.cropId){document.querySelector(`[data-select-seed="${target.cropId}"]`)?.classList.add('quest-target');toast(`${CROPS[target.cropId].seedName}을 골라 빈 밭에 이어 심어요.`);}
  }else startFarmMode(target.mode,undefined,true);
  return;
 }
 if(target.kind==='gather'||target.kind==='chop'||target.kind==='rest'){closeModal();cancelConstruction();closeFacility();stopFarmMode();void action(target.kind);return;}
 if(target.kind==='companions'){openModal('pet');return;}
 if(target.kind==='energy'){openModal('energy');return;}
 openModal(target.kind);
}
function openFacilityUpgrade(id:number){
 const building=getSettlement(state).buildings.find(b=>b.id===id);if(!building)return;
 const definition=BUILDINGS[building.type];
 if(building.level>=definition.maxLevel){toast('이미 최대 레벨의 시설이에요.');return;}
 if(building.readyAt!==null){toast('진행 중인 생산품을 먼저 수령해 주세요.');return;}
 currentModal='facility-upgrade';
 modalShell('GROW OUR VILLAGE',`${definition.name} 레벨 올리기`,facilityUpgradePreview(state,building));
}
function openReplacementTargets(preferred?:BuildingType){
 if(actionBusy||battleView||contentActivationPending)return;
 closeModal();cancelConstruction();closeFacility();stopFarmMode();setZone('home');setFarmTray(false);currentModal='facility-replacement-target';
 const facilities=getSettlement(state).buildings;
 modalShell('A NEW PLACE IN OUR VILLAGE','빈 자리 없이도 마을을 바꿔요',`<p class="modal-description">${preferred?`${BUILDINGS[preferred].name}을 지을 자리가 없어요.<br>`:''}시설을 고르면 같은 자리에 다른 시설을 지을 수 있어요.<br>생산 중인 시설은 생산품을 먼저 수령해 주세요.</p>${state.deckLevel<MAX_DECK_LEVEL?'<button class="button button-light full-width replacement-expand" data-open="expand">'+icon('expand')+' 데크를 넓혀 새 자리 만들기</button>':''}<div class="replacement-target-list">${facilities.map(b=>`<button class="replacement-target" data-replacement-target="${b.id}"${preferred?` data-replacement-type="${preferred}"`:''}><span>${facilityIcon(b.type)}</span><div><strong>${BUILDINGS[b.type].name} · Lv.${b.level}</strong><small>${facilityLocationLabel(b)} · ${productionState(state,b).ready?'생산품 먼저 수령':b.readyAt!==null?'생산을 마치고 수령':'교체할 시설 고르기'}</small></div>${icon('chevron')}</button>`).join('')}</div>`,true);
}
function openFacilityReplacement(id:number,preferred?:BuildingType){
 if(actionBusy||battleView||contentActivationPending)return;
 const building=getSettlement(state).buildings.find(b=>b.id===id);if(!building)return;
 if(building.readyAt!==null){selectFacility(id);toast('생산품을 먼저 수령한 뒤 시설 교체를 눌러 주세요.');return;}
 closeModal();closeFacility();cancelConstruction();stopFarmMode();setZone('home');setFarmTray(false);currentModal='facility-replace';
 modalShell('A FRESH START ON THE SAME DECK','이 자리에 새 시설 짓기',`<div class="replacement-current">${facilityIcon(building.type)}<div><small>${facilityLocationLabel(building)}</small><strong>${BUILDINGS[building.type].name} Lv.${building.level}</strong></div></div><p class="modal-description">새 시설의 건설 재료를 사용해 같은 자리에 교체해요.<br>교체하는 시설은 Lv.1부터 다시 자라요.</p><div class="building-catalog replacement-catalog">${BUILDING_TYPES.map(type=>{const b=BUILDINGS[type],same=type===building.type,locked=state.deckLevel<b.unlockLevel;return `<button class="building-card ${locked||same?'locked':''} ${preferred===type?'quest-target':''}" data-replace-type="${type}" data-replace-facility="${id}" ${locked||same?'disabled':''} aria-label="${b.name}으로 교체${same?' 현재 시설':locked?` 데크 Lv.${b.unlockLevel} 필요`:''}"><span class="building-card-art">${facilityIcon(type)}</span><span class="building-unlock">${same?'현재 시설':locked?`데크 Lv.${b.unlockLevel}`:'교체 가능'}</span><strong>${b.name}</strong><span class="building-description">${b.description}</span><span class="building-cost"><span>${icon('wood')} ${b.wood}</span><span>${icon('scrap')} ${b.scrap}</span></span><span class="building-select">${same?'이곳에 살고 있어요':locked?'데크 확장이 필요해요':'교체 미리 보기'} ${icon('chevron')}</span></button>`;}).join('')}</div><p class="fine-print">확정하기 전까지 시설과 재료는 그대로예요.</p>`,true);
 if(preferred)requestAnimationFrame(()=>document.querySelector<HTMLElement>(`[data-replace-type="${preferred}"]`)?.scrollIntoView({block:'nearest'}));
}
function confirmFacilityReplacement(id:number,type:BuildingType){
 if(!requireOnFoot())return;
 if(actionBusy||battleView||contentActivationPending)return;
 const building=getSettlement(state).buildings.find(b=>b.id===id);if(!building)return;
 const definition=BUILDINGS[type];
 if(type===building.type||state.deckLevel<definition.unlockLevel)return;
 if(building.readyAt!==null){selectFacility(id);toast('생산품을 먼저 수령해 주세요.');return;}
 currentModal='facility-replace-confirm';
 modalShell('A NEW NEIGHBOR ON OUR TRUCK','시설 교체를 확정할까요?',`<div class="replacement-preview"><div>${facilityIcon(building.type)}<strong>${BUILDINGS[building.type].name}</strong><small>Lv.${building.level}</small></div>${icon('arrow')}<div>${facilityIcon(type)}<strong>${definition.name}</strong><small>Lv.1</small></div></div><p class="modal-description">${facilityLocationLabel(building)}에서 새 시설의 생활을 시작해요.<br>기존 시설의 레벨은 이어지지 않고, 새 시설은 Lv.1이 돼요.<br>이 시설에는 수령하지 않은 생산품이 없어요.</p><div class="cost-row"><span>${icon('wood')} 목재 <strong>${state.resources.wood} / ${definition.wood}</strong></span><span>${icon('scrap')} 고철 <strong>${state.resources.scrap} / ${definition.scrap}</strong></span></div><button class="button full-width" data-replace-confirm="${id}" data-replace-building-type="${type}">${icon('hammer')} 재료를 사용해 시설 교체</button>${state.resources.wood<definition.wood||state.resources.scrap<definition.scrap?'<button class="button button-light full-width activity-secondary" data-open="roadside">'+icon('map')+' 부족한 건설 재료 찾기</button>':''}<button class="text-button full-width" data-facility-replace="${id}">교체하지 않고 돌아가기</button>`);
}
function openGrowthBoard(chapter?:number){
 if(battleView||contentActivationPending)return;
 selectedGrowthChapter=chapter??getActiveGrowthQuest(state)?.chapter??GROWTH_CHAPTERS.at(-1)!.id;
 openModal('settlement-goals');
}
function renderGrowthBoard(){
 const board=document.querySelector<HTMLElement>('[data-growth-board]');if(!board||currentModal!=='settlement-goals')return;
 updateGrowthQuestBoard(board,state);
}
function claimGrowthReward(id:string){
 if(battleView||contentActivationPending||performance.now()<questAdvanceGuardUntil)return;
 const result=claimGrowthQuest(state,id);if(!result.ok){toast(result.message);return;}
 questAdvanceGuardUntil=performance.now()+450;
 state=result.state;persist();render();ping();toast(getActiveGrowthQuest(state)?'보상을 받았어요. 다음 목표를 확인해 주세요.':'모든 성장 목표를 완성했어요!');
 selectedGrowthChapter=getActiveGrowthQuest(state)?.chapter??GROWTH_CHAPTERS.at(-1)!.id;
 const modal=document.querySelector<HTMLElement>('#modal-root .modal');if(modal)modal.scrollTop=0;
 requestAnimationFrame(()=>document.querySelector<HTMLElement>('[data-growth-current] [data-quest-goto]:not([hidden]),[data-growth-current] [data-quest-claim]:not([hidden])')?.focus({preventScroll:true}));
}

function showQuestBuild(type?:BuildingType){
 if(type&&state.deckLevel<BUILDINGS[type].unlockLevel){openModal('expand');toast(`${BUILDINGS[type].name}을 지으려면 데크 Lv.${BUILDINGS[type].unlockLevel}이 필요해요.`);return;}
 openModal('build');if(type){const card=document.querySelector<HTMLElement>(`[data-build-type="${type}"]`);card?.classList.add('quest-target');requestAnimationFrame(()=>card?.scrollIntoView({block:'nearest'}));}
}
function goToGrowthQuest(id:string){
 if(actionBusy||battleView||contentActivationPending)return;
 const quest=getGrowthQuests(state).find(q=>q.id===id);if(!quest||quest.status!=='active'){toast('현재 진행 중인 목표에서 하러 가기를 눌러 주세요.');return;}
 const preparation=getVillageHub(state).primary;
 if(quest.id===getActiveGrowthQuest(state)?.id&&preparation.target.kind!=='quest'){goToVillageTarget(preparation.target);return;}
 const destination=quest.destination,facilities=getSettlement(state).buildings;
 recenterMap();closeModal();cancelConstruction();closeFacility();stopFarmMode();
 if(destination.kind==='gather'){void action('gather');return;}
 if(destination.kind==='chop'){setZone('grove');void action('chop');return;}
 if(destination.kind==='expand'){openModal('expand');return;}
 if(destination.kind==='hunt'){selectedStage=1;openModal('hunt');return;}
 if(destination.kind==='companions'){openModal('pet');return;}
 if(destination.kind==='plant'){
  questSeedHint=CROP_IDS.find(crop=>!state.plots.some(p=>p.plantedAt!==null&&getPlotCropId(p)===crop)&&getSeedCount(state,crop)>0)??'potato';
  openSeedInventory();document.querySelector<HTMLElement>(`[data-select-seed="${questSeedHint}"]`)?.classList.add('quest-target');toast(`성장 목표를 위해 ${CROPS[questSeedHint].seedName}을 골라 빈 밭에 심어 보세요.`);return;
 }
 if(destination.kind==='water'||destination.kind==='harvest'){
  const mode=destination.kind,plot=eligiblePlots(mode)[0];
  if(plot){startFarmMode(mode,undefined,true);return;}
  setZone('home',true);selectPlot(preferredPlot()?.id??null);
  toast(mode==='water'?'물 주기 도구를 선택했어요. 먼저 빈 밭에 씨앗을 심어 보세요.':'자란 작물을 수확해요. 아직 자라는 밭에는 물을 주고, 빈 밭에는 씨앗을 심어요.');
  if(mode==='water')startFarmMode('water');return;
 }
 if(destination.kind==='build'){showQuestBuild(destination.buildingType??BUILDING_TYPES.find(type=>!getBuiltTypes(state).includes(type)));return;}
 if(destination.kind==='collect'){
  const ready=facilities.find(b=>productionState(state,b).ready),running=facilities.find(b=>productionState(state,b).running),idle=facilities.find(b=>b.readyAt===null),facility=ready??running??idle;
  if(!facility){showQuestBuild('waterworks');return;}
  selectFacility(facility.id);toast(ready?'준비된 생산품 수령을 눌러 목표를 진행해요.':running?'생산을 마치면 이곳에서 생산품을 수령해요.':'생산 시작을 누른 뒤 완성된 생산품을 수령해요.');return;
 }
 if(destination.kind==='upgrade'){
  const upgradedIds=state.facilityHistory?.upgradedFacilityIds??[],target=quest.metric==='highestFacilityLevel'?quest.target:2,eligible=facilities.filter(b=>b.level<target&&(target>2||!upgradedIds.includes(b.id))).sort((a,b)=>b.level-a.level),facility=eligible.find(b=>b.readyAt===null)??eligible[0];
  if(!facility){showQuestBuild();return;}
  selectFacility(facility.id);if(facility.readyAt===null)openFacilityUpgrade(facility.id);else toast('생산품을 수령한 뒤 레벨 올리기를 눌러 주세요.');
 }
}
function renderSettlement(){
 document.querySelector('#toast')!.classList.toggle('facility-toast',selectedFacilityId!==null);
 const settlement=getSettlement(state),goal=getActiveGrowthQuest(state),ready=settlement.buildings.filter(b=>productionState(state,b).ready).length;
 const hub=getVillageHub(state),chapter=GROWTH_CHAPTERS.find(c=>c.id===goal?.chapter),objective=document.querySelector<HTMLElement>('#settlement-objective')!,rewardReady=goal?.status==='ready';
 objective.classList.toggle('reward-ready',rewardReady);objective.dataset.questState=goal?.status??'complete';objective.dataset.activeQuest=goal?.id??'';
 document.querySelector('#objective-chapter')!.textContent=chapter?`${String(chapter.id).padStart(2,'0')}장 · ${chapter.title}`:'여덟 장의 이야기를 완성했어요';
 document.querySelector('#objective-title')!.textContent=hub.primary.title;
 document.querySelector('#objective-detail')!.textContent=hub.primary.detail;
 document.querySelector('[data-objective-cta]')!.textContent=hub.primary.cta;
 objective.setAttribute('aria-label',`${hub.primary.title} · ${hub.primary.detail} · ${hub.primary.cta}`);
 objective.querySelector<HTMLElement>('.objective-progress>i')!.style.width=`${goal?Math.min(100,goal.current/goal.target*100):100}%`;
 document.querySelector<HTMLElement>('[data-growth-ready]')!.hidden=!rewardReady;
 updateVillageHub(document.querySelector<HTMLElement>('#village-hub')!,hub);
 const management=document.querySelector<HTMLElement>('#village-management');if(management&&currentModal==='village')updateVillageManagement(management,state,hub);
 renderGrowthBoard();
 const buildTab=document.querySelector<HTMLButtonElement>('[data-nav="build"]')!;buildTab.dataset.ready=String(ready);buildTab.setAttribute('aria-label',ready?`건설 · 수령할 생산품 ${ready}곳`:'건설');
 renderConstructionBar();
 const selected=settlement.buildings.find(b=>b.id===selectedFacilityId);
 document.querySelector('.scene-card')!.classList.toggle('facility-repeat-ready',Boolean(selected&&productionState(state,selected).ready));
 if(!selected){if(selectedFacilityId!==null)closeFacility();return;}
 const panel=document.querySelector<HTMLElement>('#facility-sheet')!,definition=BUILDINGS[selected.type],production=productionState(state,selected),positionKey=JSON.stringify(getFacilityPlacement(state,selected));
 panel.hidden=false;document.querySelector('.scene-card')!.classList.add('facility-selected');
 if(panel.dataset.facility!==String(selected.id)||panel.dataset.facilityType!==selected.type||panel.dataset.level!==String(selected.level)||panel.dataset.slot!==String(selected.slot)||panel.dataset.placement!==positionKey){panel.dataset.placement=positionKey;panel.dataset.facility=String(selected.id);panel.dataset.facilityType=selected.type;panel.dataset.level=String(selected.level);panel.dataset.slot=String(selected.slot);panel.innerHTML=facilitySheet(state,selected);}
 panel.querySelector('[data-facility-level]')!.textContent=`Lv.${selected.level} / ${definition.maxLevel}`;
 panel.querySelector('[data-production-status]')!.textContent=production.ready?'생산품이 준비됐어요!':production.running?`생산 중 · ${formatGameDuration(production.remaining)} 남음`:`한 번 생산으로 ${resourceLabels[definition.yieldResource]}을 모아요`;
 panel.querySelector<HTMLElement>('.facility-progress>i')!.style.width=`${production.progress*100}%`;
 panel.querySelector('[data-production-reward]')!.innerHTML=`${icon(definition.yieldResource)} +${definition.yieldAmount*selected.level}`;
 const start=panel.querySelector<HTMLButtonElement>('[data-facility-start]')!,collect=panel.querySelector<HTMLButtonElement>('[data-facility-collect]')!;
 start.hidden=production.ready;collect.hidden=!production.ready;start.disabled=production.running;start.querySelector('span')!.textContent=production.running?'생산 중…':'생산 시작';
 const repeat=panel.querySelector<HTMLButtonElement>('[data-facility-collect-repeat]');if(repeat)repeat.hidden=!production.ready;
 const cost=getUpgradeCost(selected),upgrade=panel.querySelector<HTMLButtonElement>('[data-facility-upgrade]')!;upgrade.title=selected.level>=definition.maxLevel?'최대 레벨이에요':`목재 ${cost.wood} · 고철 ${cost.scrap}`;
 const direction=panel.querySelector<HTMLButtonElement>('[data-layout-rotate="facility"]')!;
 direction.setAttribute('aria-pressed',String(getLayoutDirection(state,{kind:'facility',id:selected.id})===1));direction.disabled=actionBusy;
}
function updateNav(){
 const active=['build','hunt','bag','settings','shop','shop-confirm'].includes(currentModal)?(currentModal==='shop-confirm'?'shop':currentModal):selectedZone==='grove'||farmFocused?'farm':'home';
 document.querySelectorAll('[data-nav]').forEach(el=>{const selected=el.getAttribute('data-nav')===active;el.classList.toggle('active',selected);el.setAttribute('aria-current',selected?'page':'false');});
}
function setZone(zone:'home'|'grove',focusFarm=false,preserveWalk=false) {
 if(!preserveWalk)scene.stopWalking();
 selectedZone=zone;farmFocused=zone==='home'&&focusFarm;scene.setZone(zone);scene.setFarmFocus(farmFocused);
 document.querySelector('.scene-card')!.classList.toggle('work-view',zone==='grove'||farmFocused);
 scene.setSelectedPlot(zone==='home'&&farmFocused?selectedPlotId:null);
 document.querySelector<HTMLButtonElement>('.farm-expand-tool')!.hidden=zone==='grove';
 setFarmTray(zone==='grove'||farmFocused);
 renderFloorControls();
 document.querySelector('#zone-name')!.textContent=zone==='grove'?'도로 옆 벌목장':farmFocused?'트럭 농장':'우리 트럭 마을';
 updateNav();
}
function selectPlot(id:number|null){
 selectedPlotId=id;scene.setSelectedPlot(selectedZone==='home'?id:null);renderControls();
}
function preferredPlot(){return state.plots.find(p=>getCropProgress(state,p)>=1)??state.plots.find(p=>p.plantedAt!==null&&!p.watered)??state.plots.find(p=>p.plantedAt===null)??state.plots[0];}
const actionNames:Record<Action,string>={plant:'씨앗 심기',water:'물 주기',harvest:'수확하기',fertilize:'영양 주기',chop:'나무 베기',gather:'도로 탐색',expand:'데크 확장',expandFarm:'밭 확장',rest:'동료 돌보기',pet:'보리 쓰다듬기',repair:'트럭 수리',hunt:'사냥 출발'};
const actionEnergy:Partial<Record<Action,number>>={plant:4,water:3,harvest:4,fertilize:2,chop:10,gather:10,expand:15,expandFarm:8,repair:6,hunt:16};
function markAvailability(button:HTMLButtonElement,available:boolean,busy:boolean,message:string){
 // Native disabled buttons swallow touch events, so unavailable activities stay
 // tappable and explain how to recover. Only a running chore locks the controls.
 button.disabled=busy;button.setAttribute('aria-disabled',String(busy||!available));button.classList.toggle('unavailable',!available&&!busy);button.title=message;
}
function eligiblePlots(a:FarmAction){return state.plots.filter(p=>a==='plant'?p.plantedAt===null:a==='water'?p.plantedAt!==null&&!p.watered:a==='fertilize'?getFarmPlotCare(state,p).canFertilize:getCropProgress(state,p)>=1);}
function quickPlot(a:FarmAction){const eligible=eligiblePlots(a);return eligible.find(p=>p.id===selectedPlotId)??eligible[0];}
function renderFarmMode(){
 scene.setFarmMode(farmMode,farmQueue.map(job=>job.plotId),selectedCropId);
 const toolbar=document.querySelector<HTMLElement>('#planting-toolbar')!;
 toolbar.hidden=!farmMode;toolbar.dataset.farmMode=farmMode??'';
 document.querySelector('.scene-card')!.classList.toggle('planting-mode',Boolean(farmMode));
 if(!farmMode)return;
 const crop=CROPS[selectedCropId],waiting=farmQueue.length,artKey=farmMode==='plant'?selectedCropId:farmMode;
 const art=document.querySelector<HTMLElement>('#planting-seed-art')!;
 if(art.dataset.crop!==artKey){art.innerHTML=farmMode==='plant'?cropIcon(selectedCropId,'seed'):icon(farmMode==='water'?'water':farmMode==='fertilize'?'seeds':'food');art.dataset.crop=artKey;}
 document.querySelector('#planting-seed-name')!.textContent=farmMode==='plant'?`${crop.seedName} · ${getSeedCount(state,selectedCropId)}개`:farmMode==='water'?`연속 물 주기 · 물 ${state.resources.water}개`:farmMode==='fertilize'?`영양 주기 · 식량 1 / 수확 +2`:`연속 수확 · ${eligiblePlots('harvest').length}곳`;
 let idle='밭을 누르거나 쓸어 연속 작업해요';
 if(!eligiblePlots(farmMode).length)idle=farmMode==='plant'?'빈 밭을 모두 심었어요 · 물 주기로 이어가요':farmMode==='water'?'물을 줄 밭이 없어요 · 다른 도구를 골라요':farmMode==='fertilize'?'자라는 밭에 한 번 영양을 줘요 · 식량 1 필요':'수확할 밭이 없어요 · 작물이 자라길 기다려요';
 else if(state.energy<(actionEnergy[farmMode]??0))idle='기력이 자동 회복 중이에요 · 1분에 +3';
 else if(farmMode==='plant'&&!getSeedCount(state,selectedCropId))idle='씨앗 풀밭에서 씨앗을 모으거나 상점에서 원하는 씨앗을 사요';
 else if(farmMode==='water'&&!state.resources.water)idle='물이 부족해요 · 탐색으로 보급해 주세요';
 const working=runningFarm?`${runningFarm.plotId}번 ${farmToolLabels[runningFarm.action].working} · 대기 ${waiting}곳`:waiting?`대기 ${waiting}곳 · 밭을 더 눌러요`:idle;
 document.querySelector('#planting-seed-status')!.textContent=working;
 const all=toolbar.querySelector<HTMLButtonElement>('[data-plant-all]')!;
 all.disabled=Boolean(battleView);all.setAttribute('aria-label',farmToolLabels[farmMode].all);all.setAttribute('aria-disabled',String(!eligiblePlots(farmMode).some(p=>!isPlotReserved(p.id))));
 const allArt=all.querySelector('span')!;if(allArt.getAttribute('data-tool')!==farmMode){allArt.innerHTML=icon(farmMode==='plant'?'seeds':farmMode==='water'?'water':farmMode==='fertilize'?'seeds':'food');allArt.setAttribute('data-tool',farmMode);}
 all.querySelector('small')!.textContent=farmToolLabels[farmMode].all;
 toolbar.querySelector<HTMLElement>('[data-seed-change]')!.hidden=farmMode!=='plant';
 toolbar.querySelector('[data-plant-cancel]')!.setAttribute('aria-label','연속 텃밭 작업 종료');
 toolbar.querySelector('[data-plant-cancel] small')!.textContent='작업 종료';
 toolbar.setAttribute('aria-label',`${actionNames[farmMode]} 연속 작업`);
}
function renderControls(){
 updateWalkingAvailability();
 const busy=actionBusy||Boolean(battleView),farmingBusy=Boolean(runningFarm)&&!battleView;
 const gateButton=document.querySelector<HTMLButtonElement>('.road-controls [data-open="pet-passage"]')!;
 gateButton.disabled=busy;gateButton.setAttribute('aria-label',`동물 통로 문 ${getPetPassage(state).open?'열림':'닫힘'} · 문 조작`);
 gateButton.setAttribute('aria-pressed',String(getPetPassage(state).open));
 const farmExpand=document.querySelector<HTMLButtonElement>('.farm-expand-tool')!;
 farmExpand.disabled=busy&&!farmingBusy;
 farmExpand.setAttribute('aria-label',`밭 확장 · 현재 ${state.plots.length}칸 / 최대 ${getFarmCapacity(state)}칸`);
 farmExpand.querySelector('[data-farm-capacity]')!.textContent=`${state.plots.length}/${getFarmCapacity(state)}`;
 for(const [a] of quickItems){
  const button=document.querySelector<HTMLButtonElement>(`[data-quick="${a}"]`)!;
  const farmAction=['plant','water','harvest','fertilize'].includes(a);
  const plot=farmAction?quickPlot(a as FarmAction):undefined;
  const result=performAction(state,a,plot?.id,selectedCropId);
  if(farmAction){
   const label=a==='plant'?(farmMode==='plant'?'모두 심기':seedChosen?'심기 이어하기':'씨앗 심기'):a==='water'?'물 주기':a==='fertilize'?'영양 주기':'수확';
   button.querySelector('small')!.textContent=label;button.setAttribute('aria-label',label);
   markAvailability(button,a==='plant'||farmingBusy||Boolean(plot&&result.ok),busy&&!farmingBusy,a==='plant'?'고른 씨앗을 기억해 연속으로 심어요 · 씨앗 바꾸기에서 다른 종류 선택':result.ok?`${eligiblePlots(a as FarmAction).length}개 밭을 차례로 ${a==='water'?'물 줘요':'수확해요'} · 한 번 선택해 연속 작업`:result.message);
  }else {const specific=a==='chop'||a==='gather'?performGatheringAction(state,groundArea(a==='chop'?'grove':'salvage').next.node.id):result;markAvailability(button,specific.ok,busy&&!farmingBusy,busy?'지금 작업을 마치고 선택한 활동으로 이어가요':specific.ok?(a==='chop'?'숲의 나무를 하나씩 벌목 · 목재 +18 · 기력 10':a==='gather'?'지상 고철 더미에서 +9 · 다른 채집물도 개별 재생':'체력과 기력을 회복해요'):specific.message);}
  const count=button.querySelector<HTMLElement>('.action-count')!;
  count.hidden=!farmAction;count.textContent=farmAction?String(eligiblePlots(a as FarmAction).length):'';
  button.classList.toggle('context-ready',Boolean(farmAction&&plot?.id===selectedPlotId&&farmFocused));
 }
 const context=document.querySelector<HTMLElement>('#farm-context')!;
 const title=context.querySelector<HTMLElement>('#context-title')!,detail=context.querySelector<HTMLElement>('#context-state')!;
 const actionButton=context.querySelector<HTMLButtonElement>('#plot-action')!;
 const details=context.querySelector<HTMLButtonElement>('.context-details')!;
 const direction=context.querySelector<HTMLButtonElement>('[data-layout-rotate="plot"]')!;
 const plot=state.plots.find(p=>p.id===selectedPlotId)??preferredPlot();
 if(plot)selectedPlotId=plot.id;
 const grove=selectedZone==='grove';
 direction.hidden=grove||!plot;direction.disabled=busy;
 if(plot){direction.dataset.layoutId=String(plot.id);direction.setAttribute('aria-label',`${plot.id}번 밭 방향 바꾸기`);direction.setAttribute('aria-pressed',String(getLayoutDirection(state,{kind:'plot',id:plot.id})===1));}
 let contextAction:Action='chop',label='나무 베기',contextIcon='wood';
 title.textContent=grove?'도로 옆 벌목장':`${plot?.id??1}번 밭`;
 if(grove){detail.textContent=state.energy<10?'기력은 1분에 3씩 자동 회복돼요':'나무를 직접 눌러도 벌목해요 · 기력 10';delete actionButton.dataset.plot;details.dataset.open='grove';details.setAttribute('aria-label','벌목장 안내 보기');details.querySelector('small')!.textContent='안내';}
 else if(plot){
  const progress=getCropProgress(state,plot),crop=CROPS[getPlotCropId(plot)];
  contextAction=plot.plantedAt===null?'plant':progress>=1?'harvest':'water';
  label=contextAction==='plant'?(seedChosen?'심기 이어하기':'씨앗 심기'):contextAction==='harvest'?'수확하기':'물 주기';contextIcon=contextAction==='plant'?'seeds':contextAction==='harvest'?'food':'water';
  const result=performAction(state,contextAction,plot.id,selectedCropId);
  const care=getFarmPlotCare(state,plot);
  detail.textContent=plot.plantedAt!==null&&plot.watered&&progress<1?`${crop.name} ${Math.round(progress*100)}% · ${care.fertilized?'영양 +2':'영양을 주면 수확 +2'}`:contextAction==='plant'?'빈 밭 · 씨앗을 골라 연속 심기':!result.ok?result.message:contextAction==='harvest'?`${crop.name} ${care.yieldAmount}개 수확할 준비가 됐어요!`:`${crop.name}에 물이 필요해요 · ${Math.round(progress*100)}%`;
  actionButton.dataset.plot=String(plot.id);details.dataset.open='farm';details.setAttribute('aria-label','텃밭 전체 보기');details.querySelector('small')!.textContent='전체 밭';
 }
 const needsRest=state.energy<(actionEnergy[contextAction]??0);
 if(grove&&needsRest){label='기력 대기';contextIcon='bolt';}
 actionButton.dataset.action=contextAction;actionButton.setAttribute('aria-label',`${grove?'벌목장':`${plot?.id??1}번 밭`} ${label}`);
 actionButton.querySelector('.control-icon')!.innerHTML=contextAction==='harvest'&&plot?cropIcon(getPlotCropId(plot),'produce'):icon(contextIcon);actionButton.querySelector('small')!.textContent=label;
 const contextResult=grove?performGatheringAction(state,groundArea('grove').next.node.id):performAction(state,contextAction,plot?.id,selectedCropId);
 markAvailability(actionButton,contextAction==='plant'||contextResult.ok,busy,contextAction==='plant'?'씨앗을 선택하고 원하는 빈 밭을 눌러요':contextResult.message);
 context.classList.toggle('grove-context',grove);context.classList.toggle('working',busy);
 context.querySelectorAll<HTMLButtonElement>('[data-plot-step]').forEach(b=>{b.hidden=grove;b.disabled=busy||state.plots.length<2;});
 document.querySelectorAll<HTMLButtonElement>('.game-nav button,.scene-tools button,.scene-icon,.profile-button,.context-details').forEach(b=>b.disabled=Boolean(battleView));
 renderFarmMode();updateNav();
}
let displayedResources={...state.resources};
const resources:Resource[]=['wood','scrap','food','water','seeds'];
function render(){
 scene.setState(state);
 renderFloorControls();
 document.querySelector('#resources')!.innerHTML=resources.map(r=>{const gained=state.resources[r]-displayedResources[r];return `<span class="resource ${gained>0?'resource-gained':''}" aria-label="${resourceLabels[r]} ${state.resources[r]}개"><span class="resource-icon ${r}">${icon(r)}</span><strong>${state.resources[r]}</strong>${gained>0?`<span class="resource-delta">+${gained}</span>`:''}</span>`;}).join('');
 displayedResources={...state.resources};
 document.querySelector('#day')!.textContent=String(state.day).padStart(2,'0');
 document.querySelector('#clock')!.textContent=`${String(Math.floor(state.minutes/60)).padStart(2,'0')}:${String(Math.floor(state.minutes%60)).padStart(2,'0')}`;
 const hour=state.minutes/60;
 document.querySelector('#weather-text')!.textContent=hour<6||hour>=20?'대한민국, 2187 · 밤':hour<12?'대한민국, 2187 · 아침':hour<17?'대한민국, 2187 · 오후':'대한민국, 2187 · 저녁';
 document.querySelector('#weather-icon')!.innerHTML=icon(hour<6||hour>=20?'moon':'sun');
 document.querySelector('#truck-level')!.textContent=`Lv.${state.deckLevel}`;
 document.querySelector('#profile')!.innerHTML=portrait(state.gender,'',getEquippedOutfit(state));
 document.querySelector('#resident-name')!.textContent=state.name;
 document.querySelector('#player-level')!.textContent=`Lv.${state.level}`;
 renderVitals();
 renderControls();
 if(currentModal==='farm')renderFarm();
 if(currentModal==='bag')renderBag();
 if(currentModal==='seeds')renderSeedInventory();
 if(currentModal==='shop'||currentModal==='shop-confirm')renderLiveShop();
 if(currentModal==='farm-delivery')renderLiveFarmDelivery();
 if(currentModal==='roadside'||currentModal==='outdoor-site'||currentModal==='ground-region')renderLiveRoadside();
 if(currentModal==='pet-passage')updatePetPassageControls();
 updateEnergyPanel();
 renderSettlement();renderVillageOrder();refreshUpdateUI();
}

function energyRecoveryText(){return state.energy>=100?'기력이 가득 찼어요':secondsUntilEnergyRecovery(state)+'초 뒤 +1';}
function renderVitals(){
 document.querySelector('#vitals')!.innerHTML='<div class="vital" aria-label="건강 '+Math.round(state.health)+' /100"><span>'+icon('heart')+'</span><div class="meter"><div class="health" style="width:'+state.health+'%"></div></div><strong>'+Math.round(state.health)+'</strong></div><div class="vital vital-energy" aria-label="기력 '+Math.round(state.energy)+' /100"><span>'+icon('bolt')+'</span><div class="meter"><div class="energy" style="width:'+state.energy+'%"></div></div><strong data-energy-current>'+Math.round(state.energy)+'</strong></div><small class="energy-auto-rate" data-energy-rate>자동 +3/분</small>';
 document.querySelector('#vitals')!.setAttribute('aria-label','기력 '+Math.round(state.energy)+' /100 · 1분에 3 자동 회복 · '+energyRecoveryText());
}
function updateEnergyPanel(){
 if(currentModal!=='energy'&&currentModal!=='activity')return;
 document.querySelectorAll<HTMLElement>('[data-energy-current]').forEach(el=>el.textContent=String(Math.round(state.energy)));
 document.querySelectorAll<HTMLElement>('[data-energy-next]').forEach(el=>el.textContent=energyRecoveryText());
}

function persist(){if(!playerConfirmed)return true;state=recoverEnergy(state);state={...state,lastSaved:Date.now()};const ok=saveGame(state);document.querySelector('#save-status')!.innerHTML=icon(ok?'check':'shield')+(ok?'여행이 저장되었어요':'저장 공간을 확인해 주세요');return ok;}
function toast(message:string){const el=document.querySelector<HTMLElement>('#toast')!;el.textContent=message;el.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),3500);}
function ping(){if(!sound)return;try{audioContext??=new AudioContext();void audioContext.resume();const osc=audioContext.createOscillator(),gain=audioContext.createGain();osc.type='sine';osc.frequency.setValueAtTime(580,audioContext.currentTime);osc.frequency.exponentialRampToValueAtTime(850,audioContext.currentTime+.08);gain.gain.setValueAtTime(.05,audioContext.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audioContext.currentTime+.22);osc.connect(gain);gain.connect(audioContext.destination);osc.start();osc.stop(audioContext.currentTime+.22);}catch{}}
type ChoreAction = 'plant'|'water'|'harvest'|'fertilize'|'chop'|'expand'|'expandFarm'|'gather';
const animatedActions:Action[]=['plant','water','harvest','fertilize','chop','expand','expandFarm','gather'];
const choreLabels:Record<ChoreAction,string>={plant:'텃밭으로 가서 씨앗을 뿌리고 있어요',water:'물뿌리개로 텃밭을 돌보고 있어요',harvest:'잘 자란 작물을 바구니에 담고 있어요',fertilize:'밭으로 가서 작물에 영양을 주고 있어요',chop:'숲길에서 나무를 베어 목재를 모으고 있어요',expand:'새 판자를 놓아 우리집을 넓히고 있어요',expandFarm:'새 밭에 흙을 채우고 씨앗 심을 자리를 만들고 있어요',gather:'트럭 주변에서 쓸 만한 물자를 찾고 있어요'};
const farmToolLabels:Record<FarmAction,{working:string;all:string}>={plant:{working:'심는 중',all:'모두 심기'},water:{working:'물 주는 중',all:'모두 물 주기'},harvest:{working:'수확 중',all:'모두 수확'},fertilize:{working:'영양 주는 중',all:'모두 영양 주기'}};
function loadPreferredSeed():CropId|null{try{const seed=localStorage.getItem(selectedSeedStorageKey);return CROP_IDS.includes(seed as CropId)?seed as CropId:null;}catch{return null;}}
function rememberSeed(cropId:CropId){selectedCropId=cropId;seedChosen=true;try{localStorage.setItem(selectedSeedStorageKey,cropId);}catch{}}
function isPlotReserved(plotId:number){return runningFarm?.plotId===plotId||farmQueue.some(job=>job.plotId===plotId);}
function reservedSeeds(cropId:CropId){return farmQueue.filter(job=>job.action==='plant'&&job.cropId===cropId).length+Number(runningFarm?.action==='plant'&&runningFarm.cropId===cropId);}
function reservedEnergy(){return farmQueue.reduce((total,job)=>total+(actionEnergy[job.action]??0),0)+(runningFarm?(actionEnergy[runningFarm.action]??0):0);}
function reservedWater(){return farmQueue.filter(job=>job.action==='water').length+Number(runningFarm?.action==='water');}
function reservedNutritionFood(){return farmQueue.filter(job=>job.action==='fertilize').length+Number(runningFarm?.action==='fertilize');}
function stopFarmMode(){farmMode=null;farmQueue=[];scene.setFarmMode(null);renderControls();}
function afterCurrentFarm(next:()=>void){
 stopFarmMode();
 if(runningFarm&&actionBusy){afterFarm=next;toast('지금 밭의 작업을 마치고 이어가요. 대기 중인 작업은 취소했어요.');}
 else next();
}
function startFarmMode(mode:FarmAction,plotId?:number,all=false){
 if(!requireOnFoot())return;
 if(battleView||actionBusy&&!runningFarm)return;
 if(!actionBusy)scene.setActiveFloor(1);
 scene.setMapMoveMode(false);
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
 return `<p class="modal-description">씨앗을 고른 뒤 원하는 빈 밭을 차례로 눌러요.<br>캐릭터가 심는 동안에도 다음 밭을 예약할 수 있어요.</p><div class="seed-inventory">${CROP_IDS.map(id=>{const crop=CROPS[id],available=Math.max(0,seeds[id]-reservedSeeds(id));return `<button class="seed-card ${id===selectedCropId?'selected':''} ${available?'':'empty'}" data-select-seed="${id}" aria-label="${crop.seedName} 선택, 사용 가능한 씨앗 ${available}개" aria-pressed="${id===selectedCropId}"><span class="seed-card-art">${cropIcon(id,'seed')}</span><strong>${crop.seedName}</strong><span class="seed-card-count"><b data-seed-count="${id}">${available}</b>개</span><span class="seed-card-yield">${icon('food')} 식량 +${crop.food}</span><small>성장 ${formatGameDuration(crop.growMinutes)}</small><span class="seed-card-note">${escape(crop.description)}</span></button>`;}).join('')}</div><p class="fine-print">물을 준 작물 기준의 성장 시간이에요 · 수확하면 같은 씨앗 2개를 얻어요<br>${runningFarm?'지금 밭의 작업은 마저 끝내고 새 씨앗을 사용할게요.':'고른 씨앗은 다음에도 기억해요. 원하는 밭을 직접 골라 주세요.'}</p><button class="button button-light full-width activity-secondary" data-shop-tab="seeds">${icon('bag')} 상점에서 씨앗 구매하기</button><button class="button button-light full-width" data-seed-gather>${icon('map')} 탐색으로 씨앗 3개씩 모으기</button>`;
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
 scene.setMapMoveMode(false);
 if(getSeedCount(state,cropId)-reservedSeeds(cropId)<1){toast(`${CROPS[cropId].seedName}이 없어요. 탐색으로 3개씩 얻거나 이 작물을 수확해 모아 주세요.`);return;}
 if(!actionBusy)scene.setActiveFloor(1);
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
  if(!quiet){const message=mode==='plant'?`${plotId}번 밭에는 ${CROPS[getPlotCropId(plot)].name} 작물이 자라고 있어요. 빈 밭을 눌러 주세요.`:mode==='water'?(plot.plantedAt===null?'씨앗을 심은 밭에 물을 줄 수 있어요.':`${plotId}번 밭에는 이미 물을 주었어요.`):mode==='fertilize'?(getFarmPlotCare(state,plot).fertilized?'이 작물에는 이미 영양을 주었어요.':plot.plantedAt===null?'씨앗을 심은 뒤 자라는 작물에 영양을 줄 수 있어요.':'수확 준비가 된 작물은 영양 대신 수확해 주세요.'):'아직 수확할 준비가 되지 않았어요. 다 자란 작물을 눌러 주세요.';toast(message);}
  return false;
 }
 const cropId=mode==='plant'?selectedCropId:getPlotCropId(plot),energy=actionEnergy[mode]??0;
 if(mode==='plant'&&getSeedCount(state,cropId)-reservedSeeds(cropId)<1){
  if(!quiet){if(reservedSeeds(cropId))toast(`${CROPS[cropId].seedName}은 모두 심는 중이거나 대기 중이에요. 다른 씨앗을 고를 수 있어요.`);else if(actionBusy)toast('다른 씨앗을 고르거나 작업 후 씨앗 풀밭에서 씨앗을 모으거나 상점에서 원하는 씨앗을 사요.');else showActivityHelp(mode,retryPlot,`${CROPS[cropId].seedName}이 없어요. 씨앗을 바꾸거나 탐색으로 3개씩 모아 주세요.`,cropId);}
  return false;
 }
 if(mode==='water'&&state.resources.water-reservedWater()<1){
  if(!quiet){if(actionBusy)toast('가지고 있는 물은 모두 사용 대기 중이에요. 작업 후 도로 샘터에서 물을 모아요.');else showActivityHelp(mode,retryPlot,'물을 더 모아 주세요. 도로 샘터에서 물을 모을 수 있어요.',cropId);}
  return false;
 }
 if(mode==='fertilize'&&state.resources.food-reservedNutritionFood()<1){if(!quiet)toast('영양을 주려면 식량 1개가 필요해요. 작물을 수확하거나 부엌에서 식량을 만들어요.');return false;}
 if(state.energy-reservedEnergy()<energy){
  if(!quiet){if(actionBusy)toast('기력이 자동으로 회복되면 작업을 이어갈 수 있어요.');else showActivityHelp(mode,retryPlot,`${actionNames[mode]}에는 기력 ${energy}이 필요해요. 기력은 1분에 3씩 자동 회복돼요.`,cropId);}
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
 const energy=actionEnergy[a]??0,needsEnergy=state.energy<energy,needsHealth=a==='hunt'&&!getReadyTeam(state).length;
 let recovery='';
 if(needsEnergy)recovery='<div class="energy-recovery-summary"><span>'+icon('bolt')+'</span><strong>기력이 자동으로 회복되고 있어요</strong><p>실제 시간 20초마다 +1 · 1분에 +3 · 최대 100</p><p><b data-energy-next>'+energyRecoveryText()+'</b></p></div><button class="button full-width" data-open="energy">'+icon('bolt')+' 회복 시간 보기</button>';
 else if(needsHealth)recovery='<button class="button full-width" data-open="pet">'+icon('paw')+' 동료 돌보기</button><p class="fine-print">동물 친구들의 체력을 회복한 뒤 출발해요.</p>';
 else if((a==='plant'&&getSeedCount(state,cropId)<1)||(a==='water'&&state.resources.water<1)||a==='expand'||a==='expandFarm'||a==='repair')recovery='<button class="button full-width" data-open="roadside">'+icon('map')+' 필요한 생활 물자 찾기</button>';
 else recovery='<button class="button full-width" data-show-farm>'+icon('seeds')+' 텃밭 둘러보기</button>';
 currentModal='activity';updateNav();modalShell('OUR NEXT LITTLE STEP',actionNames[a],'<p class="activity-block-reason" role="status">'+escape(message)+'</p>'+(needsEnergy?'<div class="activity-energy"><span>현재 기력 <b data-energy-current>'+Math.round(state.energy)+'</b></span><span>필요한 기력 <b>'+energy+'</b></span></div>':'')+recovery+(a==='plant'?'<button class="button button-light full-width activity-secondary" data-seed-change>'+icon('bag')+' 다른 씨앗 고르기</button>':'')+'<button class="text-button full-width" data-close>화면으로 돌아가기</button>');
}

async function action(a:Action,plotId?:number,cropId:CropId=selectedCropId,queuedFarm=false):Promise<boolean>{
 if(startupPending||contentActivationPending)return false;
 if(a==='pet')return interactWithAnimal('pet','dog');
 if(!requireOnFoot())return false;
 state=recoverEnergy(state);
 if(a==='chop'||a==='gather')return roadsideAction(a==='chop'?'grove':'salvage');
 if(['plant','water','harvest','fertilize'].includes(a)&&!queuedFarm){startFarmMode(a as FarmAction,plotId??quickPlot(a as FarmAction)?.id);return false;}
 if(actionBusy||battleView){toast('지금 하던 일을 마치고 함께해요.');return false;}
 if(!queuedFarm){cancelConstruction();closeFacility();if(farmMode)stopFarmMode();}
 if(a==='hunt'){openModal('hunt');return false;}
 if(plotId!==undefined&&['plant','water','harvest','fertilize'].includes(a))selectedPlotId=plotId;
 const before=performAction(state,a,plotId,cropId);
 if(!before.ok){if(a==='repair'&&state.truckHealth>=100)toast(before.message);else showActivityHelp(a,plotId,before.message,cropId);return false;}
 if(a==='expandFarm')recenterMap();
 if(animatedActions.includes(a)){
  actionBusy=true;app.setAttribute('aria-busy','true');renderControls();
  if(!queuedFarm)closeModal();
  if(!queuedFarm)setZone('home',['plant','water','harvest','fertilize','expandFarm'].includes(a));renderControls();
  const status=document.querySelector<HTMLElement>('.chore-status')!;
  const cropLabel=a==='plant'?`${CROPS[cropId].name} 씨앗을 ${plotId}번 밭에 심고 있어요`:a==='harvest'?`${CROPS[getPlotCropId(state.plots.find(p=>p.id===plotId)??state.plots[0])].name}을 바구니에 담고 있어요`:choreLabels[a as ChoreAction];
  status.innerHTML=`<span class="chore-pulse">${a==='plant'?cropIcon(cropId,'seed'):icon(a==='expand'||a==='expandFarm'?'hammer':'seeds')}</span><div><strong>${escape(state.name)}의 작은 일상<small data-chore-phase>이동 중</small></strong><span>${cropLabel}</span><div class="chore-track" role="progressbar" aria-label="이동과 작업 진행" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-live="off"><i style="width:0%"></i></div></div>`;
  status.hidden=false;
  try { await scene.playAction(a as ChoreAction,plotId,cropId); }
  catch (error) {toast(error instanceof Error?error.message:'작업을 마치지 못했어요. 다시 시도해 주세요.');status.hidden=true;actionBusy=false;app.removeAttribute('aria-busy');render();finishDeferredUpdate();return false;}
  actionBusy=false;status.hidden=true;app.removeAttribute('aria-busy');
 }
 state=recoverEnergy(state);
 const result=performAction(state,a,plotId,cropId,{advanceClock:!animatedActions.includes(a)});
 state=result.state;
 if(result.ok&&a==='expandFarm'){selectedPlotId=state.plots.at(-1)!.id;scene.setSelectedPlot(selectedPlotId);}
 if(queuedFarm)runningFarm=null;
 if(animatedActions.includes(a)&&!queuedFarm)setZone('home',['plant','water','harvest','fertilize','expandFarm'].includes(a));toast(result.message);
 if(result.ok){ping();persist();if(!queuedFarm)scene.focus(a==='expand'?'truck':a==='plant'||a==='water'||a==='harvest'||a==='fertilize'||a==='expandFarm'?'farm':'character');}
 render();
 if(currentModal==='quests')openModal('quests');
 if(currentModal==='pet')openModal('pet');
 if(currentModal==='hunt')openModal('hunt');
 finishDeferredUpdate();return result.ok;
}
function startBattle(){
 if(!requireOnFoot())return;
 if(actionBusy||battleView||contentActivationPending)return;
 state=recoverEnergy(state);
 scene.stopWalking();
 cancelConstruction();closeFacility();setFarmTray(false);
 stopFarmMode();
 const started=beginHunt(state,selectedStage);
 if(!started.ok){showActivityHelp('hunt',undefined,started.message);return;}
 state=started.state;const expeditionId=state.expedition!.id;persist();
 closeModal();scene.setSuspended(true);app.inert=true;document.body.classList.add('in-battle');
 try {
  battleView=new BattleView({gender:state.gender,name:state.name,level:state.level,health:state.health,companions:getCompanions(state),units:getUnitRoster(state),teamIds:state.expedition!.unitParticipantIds??getReadyTeam(state),bonuses:state.expedition!.unitBattleBonuses,stage:selectedStage,onFinish:(result:BattleResult)=>{
   const finished=finishHunt(state,result,expeditionId);state=finished.state;
   if(!finished.ok&&state.expedition?.id===expeditionId)state=cancelHunt(state).state;
   battleView?.destroy();battleView=null;app.inert=orientationBlocked||startupPending||contentActivationPending;document.body.classList.remove('in-battle');scene.setSuspended(orientationBlocked||startupPending||contentActivationPending);setZone('home');persist();render();toast(finished.message+(finished.ok&&result.outcome==='victory'?` · 다음 성장: ${getVillageHub(state).investment.title}`:''));finishDeferredUpdate();
  }});
 }catch{
  state=cancelHunt(state).state;battleView?.destroy();battleView=null;app.inert=orientationBlocked||startupPending||contentActivationPending;document.body.classList.remove('in-battle');scene.setSuspended(orientationBlocked||startupPending||contentActivationPending);persist();render();toast('전투 화면을 열지 못해 트럭으로 돌아왔어요.');
 }
}
function huntRecoveryHint(){
 let body='';
 if(state.energy<16)body+='<p class="fine-print">기력은 실제 시간 1분에 3씩 자동 회복돼요.</p><button class="button button-light full-width activity-secondary" data-open="energy">'+icon('bolt')+' 회복 시간 보기</button>';
 if(!getReadyTeam(state).length)body+='<p class="fine-print">출전할 동료의 체력을 회복해 주세요.</p><button class="button button-light full-width activity-secondary" data-open="pet">'+icon('paw')+' 동료 돌보기</button>';
 return body;
}

function animalHomeLabel(id:UnitId){
 const level=getAnimalDeckUnlockLevel(id);
 return canAnimalBoardTruck(id,state.deckLevel)?level>1?'지상 · 트럭 1층 생활':'지상 · 트럭 생활':`지상 생활 · 데크 Lv.${level}부터 탑승`;
}
function companionRosterCards(compact=false){
 const roster=getUnitRoster(state),selected=getSelectedTeam(state),unlocked=getUnlockedUnitIds(state),bonuses=getUnitBattleBonuses(state);
 if(compact)return `<section class="unit-team unit-team-compact"><div class="unit-team-heading"><strong>출전 편성 <b>${selected.length} / 3</b></strong><button data-open="pet-team">${icon('paw')} 편성 바꾸기</button></div><div class="companion-roster" style="--team-columns:${selected.length}">${selected.map(id=>{const definition=UNITS[id],progress=roster[id],max=getUnitMaxHealth(id,progress),hp=Math.ceil(progress.health*max/100);return `<article class="companion-card ${hp===0?'companion-resting':''}" data-companion-card="${id}"><div class="companion-card-art">${companionPortrait(id)}</div><div class="companion-card-info"><strong>${definition.name}<small>Lv.${getUnitLevel(progress)}</small></strong><span>${definition.speciesLabel} · ${definition.roleLabel}</span><span class="animal-home-label">${animalHomeLabel(id)} · 1마리</span><b data-companion-hp="${id}">${hp} / ${max}</b><div class="companion-hp-track"><i style="width:${progress.health}%"></i></div>${hp===0?'<small class="companion-xp">돌봄 후 출전해요</small>':''}</div></article>`;}).join('')}</div></section>`;
 return `<section class="unit-team" aria-label="동물 전투 편성"><div class="unit-team-heading"><strong>우리 원정대 <b>${selected.length} / 3</b></strong><small>최대 3마리 · 교체할 동료를 먼저 빼 주세요</small></div><div class="companion-roster">${UNIT_IDS.map(id=>{
  const progress=roster[id],definition=UNITS[id],level=getUnitLevel(progress),max=getUnitMaxHealth(id,progress),hp=Math.ceil(progress.health*max/100),locked=!unlocked.includes(id),chosen=selected.includes(id);
  return `<button class="companion-card ${hp===0?'companion-resting':''} ${chosen?'unit-selected':''} ${locked?'unit-locked':''}" data-companion-card="${id}" data-team-toggle="${id}" aria-pressed="${chosen}" aria-label="${definition.name} ${locked?`데크 Lv.${definition.unlockDeck} 해금`:chosen?'편성에서 빼기':'편성하기'}" ${locked?'disabled':''}><div class="companion-card-art">${companionPortrait(id)}</div><div class="companion-card-info"><strong>${definition.name}<small>Lv.${level}</small></strong><span>${definition.speciesLabel} · ${definition.roleLabel}</span><span class="animal-home-label">${animalHomeLabel(id)} · 1마리</span><b data-companion-hp="${id}">${hp} / ${max}</b><div class="companion-hp-track" role="progressbar" aria-label="${definition.name} 체력" aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="${hp}"><i style="width:${progress.health}%"></i></div><small class="companion-xp">${locked?`데크 Lv.${definition.unlockDeck}에서 함께해요`:level===10?'최대 레벨':`다음 레벨까지 경험치 ${80-progress.xp%80}`}${!locked&&hp===0?' · 회복 필요':''}</small><span class="unit-selection-label">${locked?icon('paw'):chosen?icon('check'):icon('plus')}${locked?'아직 잠김':chosen?'편성 중':'편성하기'}</span></div><span class="unit-skill-description">${definition.skillLabel} · ${definition.skillDescription}</span></button>`;
 }).join('')}</div><p class="unit-village-bonus">${icon('truck')} 마을 지원 · 공격 +${Math.round((bonuses.attackMultiplier-1)*100)}% · 받는 피해 −${Math.round((1-bonuses.enemyDamageMultiplier)*100)}%<small>동료의 쉼터와 도로 관측소를 개선하면 강해져요.</small></p></section>`;
}
const dialogThemes: Record<string, readonly [string, string]> = {
 welcome:['truck','로드헤이븐'], village:['truck','우리 트럭 마을'], quests:['flag','마을의 다음 이야기'],
 farm:['leaf','농장 생활'], seeds:['seeds','씨앗 가방'], 'farm-delivery':['food','우리 마을의 수확'], 'crop-ledger':['book','작물 이야기'],
 hunt:['shield','동물 원정대'], pet:['paw','우리의 작은 동료'], 'pet-team':['paw','동물 전투 편성'], 'pet-passage':['paw','동물 통로'],
 build:['hammer','트럭 건설'], expand:['expand','데크 확장'], floors:['truck','트럭 층 확장'],
 bag:['bag','생활 물자'], shop:['bag','트럭 상점'], 'shop-confirm':['bag','장보기 확인'],
 settings:['settings','게임 설정'], guide:['book','트럭 생활 안내'], journal:['book','우리의 생활 기록'],
 activity:['bolt','작업 안내'], roadside:['map','트럭 밖 작은 모험'], 'outdoor-site':['axe','지상에서 모으기'], 'ground-region':['map','채집 장소'],
 'facility-upgrade':['hammer','시설 성장'], 'facility-supplies':['bag','생산 준비'],
 'facility-replacement-target':['hammer','마을 배치'], 'facility-replace':['hammer','시설 교체'], 'facility-replace-confirm':['hammer','새 시설 준비'],
};
function modalShell(_eyebrow:string,title:string,body:string,wide=false){
 modalBackdropPointer=null;modalBackdropClickPointer=null;scene.setWalkingEnabled(false);
 const root=document.querySelector<HTMLElement>('#modal-root')!,[emblem,category]=dialogThemes[currentModal]??['truck','트럭 생활'];
 const closeButton=currentModal==='welcome'&&!playerConfirmed?'':`<button class="modal-close round-button" data-close aria-label="닫기">${icon('close')}</button>`;
 root.hidden=false;
 root.innerHTML=`<section class="modal modal-${currentModal} ${wide?'modal-wide':''}" role="dialog" aria-modal="true" aria-labelledby="modal-title"><header class="game-dialog-heading"><span class="game-dialog-emblem" aria-hidden="true">${icon(emblem)}</span><div><div class="eyebrow">${category}</div><h2 id="modal-title">${title}</h2></div>${closeButton}</header>${body}</section>`;
 requestAnimationFrame(()=>root.querySelector<HTMLButtonElement>('button')?.focus());
}
function closeModal(){if(currentModal==='welcome'&&!playerConfirmed)return;modalBackdropPointer=null;modalBackdropClickPointer=null;const root=document.querySelector<HTMLElement>('#modal-root')!;root.hidden=true;root.classList.remove('planning-catalog','planning-expansion');document.querySelector('.scene-card')!.classList.remove('planning-catalog','planning-expansion');scene.setExpansionPreview(null);if(!placement)scene.setPlanningViewport(null);currentModal='';updateNav();updateWalkingAvailability();}
function renderLiveShop(force=false){
 const key=JSON.stringify([currentModal,shopTab,shopQuantity,shopPending,state.gender,state.deckLevel,state.resources,getSeedInventory(state),getShop(state),state.companions,state.animalReserve]);
 if(!force&&key===renderedShopKey)return;
 const scroll=document.querySelector<HTMLElement>('#modal-root .modal')?.scrollTop??0;
 renderedShopKey=key;
 modalShell('TRUCK MARKET',currentModal==='shop-confirm'?'장보기 확인':'트럭 상점',currentModal==='shop-confirm'&&shopPending
  ?renderShopPurchaseConfirmation(state,shopPending.kind,shopPending.id,shopPending.quantity):renderShop(state,shopTab,shopQuantity),true);
 document.querySelector<HTMLElement>('#modal-root .modal')!.scrollTop=scroll;
}
function openShop(tab:ShopTab=shopTab){shopTab=tab;shopPending=null;openModal('shop');}
function shopUnavailable(){
 if(actionBusy||runningFarm||farmQueue.length||battleView||contentActivationPending){toast('지금 작업을 마친 뒤 장보기와 옷 갈아입기를 할 수 있어요.');return true;}
 return false;
}
function previewShopPurchase(kind:ShopPurchaseKind,id:string){
 if(shopUnavailable())return;
 shopPending={kind,id,quantity:kind==='seed'||kind==='sale'?shopQuantity:1};
 currentModal='shop-confirm';renderLiveShop(true);updateNav();
}
function confirmShopPurchase(kind:string,id:string,quantity:number){
 if(currentModal!=='shop-confirm'||!shopPending||shopPending.kind!==kind||shopPending.id!==id||shopPending.quantity!==quantity||shopUnavailable())return;
 const quote=shopPending;shopPending=null;
 const result=quote.kind==='seed'?buyShopSeed(state,quote.id,quote.quantity):quote.kind==='pet'?buyShopPet(state,quote.id)
  :quote.kind==='outfit'?buyShopOutfit(state,quote.id):sellShopResource(state,quote.id,quote.quantity);
 if(result.ok){state=result.state;persist();ping();}
 openShop();render();toast(result.message);
}
function wearShopOutfit(id:string){
 if(shopUnavailable())return;
 const result=equipShopOutfit(state,id);
 if(result.ok){state=result.state;persist();render();ping();}toast(result.message);
}
function renderLiveFarmDelivery(){
 const key=JSON.stringify([state.farmEconomy,state.resources,state.seedInventory,state.plots.map(p=>[p.id,p.plantedAt,p.watered,getCropProgress(state,p)>=1])]);
 if(key===renderedFarmDeliveryKey)return;
 const scroll=document.querySelector<HTMLElement>('#modal-root .modal')?.scrollTop??0;
 renderedFarmDeliveryKey=key;
 modalShell('HARVEST FOR OUR VILLAGE','농산물 납품',renderFarmDelivery(state),true);
 document.querySelector<HTMLElement>('#modal-root .modal')!.scrollTop=scroll;
}
function deliverFarmOrder(id:string){
 if(actionBusy||battleView||runningFarm||contentActivationPending||performance.now()<orderAdvanceGuardUntil)return;
 const result=fulfillFarmOrder(state,id);
 if(result.ok){state=result.state;orderAdvanceGuardUntil=performance.now()+400;persist();render();ping();}
 toast(result.message);
}
function groundArea(id:OutdoorSiteId){
 return getGatheringArea(state,id)!;
}
function requireOnFoot(){
 const mounted=scene.getMountedAnimal();
 if(mounted){toast(`${UNITS[mounted].name}와 산책을 마치고 왼쪽 아래 ‘내리기’를 눌러 주세요.`);return false;}
 if(scene.isAnimalInteracting()){toast('동물과 함께하는 행동을 마친 뒤 이어가요.');return false;}
 return true;
}
function closeAnimalContext(){animalContextId=null;document.querySelector<HTMLElement>('#animal-sheet')!.hidden=true;}
function showAnimalContext(id:UnitId,focus=false){
 if(actionBusy||battleView||startupPending||contentActivationPending)return;
 if(scene.getMountedAnimal()){if(id===scene.getMountedAnimal())scene.focusAnimal(id);else requireOnFoot();return;}
 scene.stopWalking();
 if(currentModal)closeModal();
 if(placement)cancelConstruction();
 if(selectedFacilityId!==null)closeFacility();
 if(farmMode)stopFarmMode();
 if(farmTrayOpen)setFarmTray(false);
 setGatheringTray(false);
 animalContextId=id;
 if(focus)scene.focusAnimal(id);
 renderAnimalUI();
}
function renderAnimalUI(){
 const mounted=scene.getMountedAnimal(),interacting=scene.isAnimalInteracting();
 const card=document.querySelector('.scene-card')!;
 card.classList.toggle('animal-riding',Boolean(mounted));card.classList.toggle('animal-interacting',interacting);
 const views=scene.getAnimalInteractions(),sheet=document.querySelector<HTMLElement>('#animal-sheet')!,hud=document.querySelector<HTMLElement>('#animal-ride-hud')!;
 const blocked=startupPending||orientationBlocked||contentActivationPending||Boolean(battleView)||Boolean(currentModal)||Boolean(placement)||farmTrayOpen||selectedFacilityId!==null;
 hud.hidden=!mounted||blocked;
 if(mounted&&!hud.hidden){
  const view=views.find(animal=>animal.id===mounted),key=JSON.stringify([mounted,actionBusy,interacting,view?.canDismount]);
  if(key!==animalRideKey){animalRideKey=key;hud.innerHTML=`<button class="animal-ride-follow" data-animal-follow="${mounted}" aria-label="${UNITS[mounted].name}와 주인공 보기">${companionPortrait(mounted)}<span><strong>${UNITS[mounted].name}와 산책 중</strong><small>${view?.canDismount?'지상 길을 누르면 함께 걸어요':'조금 더 넓은 공터로 이동해요'}</small></span></button><button class="animal-dismount" data-animal-dismount ${actionBusy||interacting?'disabled':''}>${icon('arrow')}<small>내리기</small></button>`;}
 }else animalRideKey='';
 if(blocked||actionBusy||interacting||mounted)closeAnimalContext();
 const animal=animalContextId?views.find(view=>view.id===animalContextId):undefined;
 sheet.hidden=!animal;
 if(!animal){animalPanelKey='';return;}
 const id=animal.id,definition=UNITS[id],rideable=id==='elephant'||id==='giraffe';
 const key=JSON.stringify([animal,scene.getActiveFloor()]);if(key===animalPanelKey)return;animalPanelKey=key;
 sheet.innerHTML=`<header class="animal-sheet-heading">${companionPortrait(id)}<div><strong>${definition.name}</strong><small>${definition.speciesLabel} · ${animal.surface==='road'?'지상에서 지내는 중':'트럭에서 지내는 중'}</small></div><button class="panel-dismiss" data-animal-dismiss aria-label="동물 메뉴 닫기">${icon('close')}<small>닫기</small></button></header><div class="animal-sheet-actions"><button data-animal-pet="${id}" ${animal.available?'':'disabled'}>${icon('paw')}<small>쓰다듬기</small></button>${rideable?`<button data-animal-ride="${id}" ${animal.mountable?'':'disabled'}>${icon('move')}<small>올라타기</small></button>`:''}</div><p>${!animal.available?'동물이 편히 쉴 수 있는 곳에서 다시 만나요.':rideable&&!animal.mountable?(animal.health<=0?'동료 돌보기로 체력을 회복해 주세요.':'지상에 내려와 있을 때 등에 탈 수 있어요.'):'곁으로 다가가 함께 시간을 보내요.'}</p>`;
}
async function interactWithAnimal(kind:'pet'|'mount'|'dismount',id:UnitId):Promise<boolean>{
 if(actionBusy||battleView||startupPending||contentActivationPending)return false;
 if(kind!=='dismount'&&!requireOnFoot())return false;
 if(currentModal)closeModal();
 cancelConstruction();closeFacility();if(farmMode)stopFarmMode();setFarmTray(false);closeAnimalContext();setGatheringTray(false);
 animalActionKind=kind;actionBusy=true;app.setAttribute('aria-busy','true');renderControls();
 const status=document.querySelector<HTMLElement>('.chore-status')!;
 status.innerHTML=`<span class="chore-pulse">${icon('paw')}</span><div><strong>${UNITS[id].name}와 함께<small data-animal-phase>${kind==='dismount'?'내려올 자리를 살피는 중':'곁으로 걸어가는 중'}</small></strong><span>${kind==='pet'?'손을 뻗어 다정하게 쓰다듬어요':kind==='mount'?'등에 올라 함께 지상 길을 산책해요':'주변을 살피고 안전한 땅으로 내려와요'}</span></div>`;status.hidden=false;
 let ok=false;
 try{
  if(kind==='pet')await scene.playPetting(id);else if(kind==='mount')await scene.mountAnimal(id);else await scene.dismountAnimal();
  if(kind==='pet')state={...state,morale:Math.min(100,state.morale+3),log:[`${UNITS[id].name}를 쓰다듬으며 잠깐 쉬었어요.`,...state.log].slice(0,30)};
  persist();ping();ok=true;
  toast(kind==='pet'?`${UNITS[id].name}와 다정한 시간을 보냈어요. 기분 +3`:kind==='mount'?`${UNITS[id].name} 등에 탔어요. 빈 지상 길을 눌러 이동해요.`:`${UNITS[id].name} 곁의 안전한 땅에 내렸어요.`);
 }catch(error){toast(error instanceof Error?error.message:'동물에게 다가가지 못했어요. 주변 길을 비우고 다시 만나 주세요.');}
 finally{animalActionKind=null;actionBusy=false;status.hidden=true;app.removeAttribute('aria-busy');render();finishDeferredUpdate();}
 return ok;
}
function setGatheringTray(open:boolean){
 gatheringTrayOpen=open;
 const dock=document.querySelector<HTMLElement>('.gathering-dock')!,button=dock.querySelector<HTMLButtonElement>('[data-gather-toggle]')!;
 dock.classList.toggle('expanded',open);
 dock.querySelector<HTMLElement>('.gathering-tray')!.hidden=!open;
 button.setAttribute('aria-expanded',String(open));
 button.setAttribute('aria-label',open?'채집 도구 접기':'채집 도구 펼치기');
 button.querySelector('[data-gather-toggle-label]')!.textContent=open?'접기':'채집';
}
function renderGatheringDock(){
 const dock=document.querySelector<HTMLElement>('.gathering-dock')!;
 dock.hidden=!playerConfirmed||startupPending||orientationBlocked||contentActivationPending||Boolean(battleView)||Boolean(currentModal)||Boolean(placement)||selectedFacilityId!==null||farmTrayOpen||actionBusy||Boolean(scene.getMountedAnimal())||scene.getActiveFloor()!==1;
 if(dock.hidden){if(gatheringTrayOpen)setGatheringTray(false);return;}
 if(!gatheringTrayOpen)return;
 const now=Date.now();
 for(const [resource,label]of gatheringShortcuts){
  const views=GROUND_RESOURCE_NODES.filter(node=>node.resource===resource).map(node=>getGatheringNode(state,node.id,now)!);
  const ready=views.filter(view=>view.ready),remaining=Math.min(...views.map(view=>view.remainingSeconds));
  const button=dock.querySelector<HTMLButtonElement>(`[data-gather-resource="${resource}"]`)!;
  const pond=resource==='water'?views[0]:undefined;
  const status=ready.length?(pond?`${pond.remainingUses}/${pond.capacity}회 남음`:`${ready.length}곳 준비`):`${remaining}초 후`;
  button.disabled=ready.length===0;
  button.setAttribute('aria-label',`${label} · ${pond?`${pond.remainingUses}/${pond.capacity}회 남음`:`전체 채집지 ${ready.length}/${views.length}곳 준비`} · ${ready.length?'가까운 곳에서 바로 채집':`${remaining}초 뒤 재생`}`);
  const text=button.querySelector('small')!;if(text.textContent!==status)text.textContent=status;
 }
}
function gatherFromShortcut(resource:GatheringShortcutResource){
 if(actionBusy||battleView||startupPending||contentActivationPending)return;
 state=recoverEnergy(state);
 const feet=scene.getResidentPosition(),now=Date.now();
 const ready=GROUND_RESOURCE_NODES.filter(node=>node.resource===resource)
  .map(node=>getGatheringNode(state,node.id,now)!).filter(view=>view.ready)
  .sort((a,b)=>Math.hypot(a.node.point[0]-feet[0],a.node.point[1]-feet[1])-Math.hypot(b.node.point[0]-feet[0],b.node.point[1]-feet[1]));
 const target=ready.find(view=>state.energy>=view.energyCost)??ready[0];
 if(!target){renderGatheringDock();return;}
 setGatheringTray(false);
 void gatherGroundResource(target.node.id,true);
}
function gatheringNodeStatus(view:NonNullable<ReturnType<typeof getGatheringNode>>){
 return view.ready?(view.node.kind==='water'?`${view.remainingUses}/${view.capacity}회 채집 가능`:'채집 가능'):`${view.remainingSeconds}초 뒤 재생`;
}
function areaStatus(id:OutdoorSiteId){const area=groundArea(id);return id==='spring'?gatheringNodeStatus(area.next):`${area.ready.length} / ${area.views.length}개 채집 가능${area.ready.length?'':` · ${area.next.remainingSeconds}초 뒤 재생`}`;}
function gatheringReward(view:NonNullable<ReturnType<typeof getGatheringNode>>){
 return view.cropId?`${CROPS[view.cropId].seedName} ${view.yieldAmount}개`:`${resourceLabels[view.node.resource]} ${view.yieldAmount}${view.node.resource==='water'?' L':'개'}`;
}
function outdoorCard(id:OutdoorSiteId){
 const view=groundArea(id).next,zone=getGroundResourceZone(id)!;
 const art=icon(view.node.resource),reward=view.node.resource==='seeds'?`씨앗 ${view.yieldAmount}개 · 여러 품종`:gatheringReward(view);
 return `<article class="outdoor-card" data-roadside-card="${id}"><span class="outdoor-card-art">${art}</span><div><strong>${zone.name}</strong><span>${id==='spring'?'한 번에':'한 곳당'} ${reward} · 기력 ${view.energyCost}</span><small data-outdoor-status="${id}">${areaStatus(id)}</small></div><button data-outdoor-site="${id}">${icon('pin')} 장소 보기</button></article>`;
}
function groundNodeButton(id:GroundResourceId){
 const view=getGatheringNode(state,id)!;
 return `<button class="ground-node-choice" data-ground-node="${id}" aria-label="${escape(view.node.name)}에 직접 가서 ${view.node.kind==='tree'?'벌목':'채집'}하기 · ${gatheringNodeStatus(view)}">${view.cropId?cropIcon(view.cropId,'seed'):icon(view.node.resource)}<strong>${escape(view.node.name)}</strong><small data-ground-status="${id}">${gatheringNodeStatus(view)}</small></button>`;
}
function regionStatus(id:GroundRegionId){
 const area=getGatheringRegion(state,id)!;
 return id==='spring'?gatheringNodeStatus(area.next):`${area.readyCount} / ${area.totalCount}곳 채집 가능${area.readyCount?'':` · ${area.remainingSeconds}초 뒤 재생`}`;
}
function regionCard(id:GroundRegionId){
 const region=getGroundRegion(id)!,area=getGatheringRegion(state,id)!;
 const resources=(['wood','scrap','seeds','water']as const).filter(resource=>area.views.some(view=>view.node.resource===resource));
 return `<article class="ground-region-card" data-ground-region-card="${id}"><div class="ground-region-heading"><strong>${escape(region.name)}</strong><small data-region-status="${id}">${regionStatus(id)}</small></div><p>${escape(region.description)}</p><div class="ground-region-resources">${resources.map(resource=>`<span>${icon(resource)}${resource==='wood'?'나무':resource==='scrap'?'고철':resource==='seeds'?'씨앗':'연못'} <b>${area.views.filter(view=>view.node.resource===resource).length}</b></span>`).join('')}</div><div class="ground-region-actions"><button class="button" data-region-focus="${id}">${icon('map')} 둘러보기</button><button class="button button-light" data-ground-region="${id}">${icon('bag')} 채집물 목록</button></div></article>`;
}
function renderLiveRoadside(){
 const key=JSON.stringify([currentModal,activeRoadsideSite,activeGroundRegion,state.gathering,state.resources]);
 if(key!==renderedRoadsideKey){
  const scroll=document.querySelector<HTMLElement>('#modal-root .modal')?.scrollTop??0;
  renderedRoadsideKey=key;
  if(currentModal==='ground-region'&&activeGroundRegion){
   const region=getGroundRegion(activeGroundRegion)!,area=getGatheringRegion(state,region.id)!;
   modalShell('A LITTLE PLACE TO EXPLORE',region.name,`<p class="modal-description">${escape(region.description)}<br>원하는 채집물을 고르면 직접 걸어가 작업해요.</p><button class="button full-width" data-region-focus="${region.id}">${icon('map')} 이 장소 둘러보기</button><div class="ground-node-grid">${area.views.map(view=>groundNodeButton(view.node.id)).join('')}</div><button class="text-button full-width" data-open="roadside">다른 채집 장소 보기</button>`,true);
  }else if(currentModal==='outdoor-site'&&activeRoadsideSite){
   const area=groundArea(activeRoadsideSite),zone=getGroundResourceZone(activeRoadsideSite)!;
   modalShell('FOLLOW THE FOREST TRAIL',zone.name,`${outdoorCard(zone.id)}<p class="modal-description">${zone.id==='spring'?'큰 연못 가장자리에서 물을 길어요.<br>10번 채집하면 연못이 사라지고 180초 뒤 다시 차올라요.':`${zone.id==='grove'?'숲속길을 따라 나무를 하나씩 골라 베어요.':'지상의 채집물을 하나씩 골라 모아요.'}<br>작업을 마친 곳마다 실제 180초 후 다시 생성돼요.`}</p><button class="button full-width" data-outdoor-walk="${zone.id}">${icon('map')} ${zone.name} 크게 보기</button><div class="ground-node-grid">${area.views.map(view=>groundNodeButton(view.node.id)).join('')}</div><button class="button button-light full-width activity-secondary" data-outdoor-collect="${zone.id}">${icon(area.next.node.resource)}<span data-outdoor-cta="${zone.id}">준비된 곳에서 채집하기</span></button><button class="text-button full-width" data-open="roadside">다른 채집 구역 보기</button>`,true);
  }else modalShell('LIFE BEYOND THE TRUCK','지상 채집 지도',`<p class="modal-description">트럭 주변 ${GROUND_REGIONS.length}개 장소를 둘러보세요.<br>숲길의 나무·군집 고철·씨앗 풀을 모으고, 남동쪽 큰 연못에서 물을 길어요.</p><div class="ground-region-cards">${GROUND_REGIONS.map(region=>regionCard(region.id)).join('')}</div><div class="outdoor-modal-actions"><button class="button" data-road-walk>${icon('move')} 도로 걷기</button><button class="button button-light" data-road-return>${icon('truck')} 트럭으로</button></div><p class="fine-print">채집물 그림이나 작은 표식을 누르면 바로 작업해요.<br>연못은 10회 채집 후, 다른 채집물은 한 번 채집 후 180초 뒤 다시 준비돼요.</p>`,true);
  document.querySelector<HTMLElement>('#modal-root .modal')!.scrollTop=scroll;
 }
 for(const region of GROUND_REGIONS){
  document.querySelectorAll<HTMLElement>(`[data-region-status="${region.id}"]`).forEach(status=>status.textContent=regionStatus(region.id));
 }
 for(const site of OUTDOOR_SITES){
  const area=groundArea(site.id),status=document.querySelector<HTMLElement>(`[data-outdoor-status="${site.id}"]`);
  if(status)status.textContent=areaStatus(site.id);
  const button=document.querySelector<HTMLButtonElement>(`[data-outdoor-collect="${site.id}"]`);
  if(button){button.disabled=!area.ready.length;button.querySelector('[data-outdoor-cta]')!.textContent=area.ready.length?'준비된 곳에서 채집하기':`${area.next.remainingSeconds}초 뒤 재생`;}
 }
 for(const node of GROUND_RESOURCE_NODES){
  const view=getGatheringNode(state,node.id)!;
  document.querySelectorAll<HTMLElement>(`[data-ground-status="${node.id}"]`).forEach(status=>status.textContent=gatheringNodeStatus(view));
 }
}
function openRoadsideSite(id:OutdoorSiteId){activeRoadsideSite=id;openModal('outdoor-site');}
function openGroundRegion(id:GroundRegionId){activeGroundRegion=id;openModal('ground-region');}
function petPassageContent(){
 const open=getPetPassage(state).open;
 return `<div class="pet-passage-summary">${icon('paw')}<div><strong>친구들만 다니는 경사로</strong><span data-pet-passage-status>${open?'문이 열려 있어요':'문이 닫혀 있어요'}</span></div></div><p class="modal-description">동물들은 전용 통로로 트럭과 지상을 오가요.<br>주인공이 문을 열고, 승선할 공간이 준비된 친구부터 올라와요. 사슴은 데크 Lv.3, 판다 Lv.4, 기린 Lv.5, 코끼리 Lv.6부터 1층을 이용해요.</p><button class="button full-width" data-pet-passage-toggle="${open?'close':'open'}">${icon('paw')} ${open?'문 닫으러 가기':'문 열러 가기'}</button><p class="fine-print">재료와 기력을 사용하지 않아요.<br>문을 닫으면 친구들은 지금 있는 층이나 지상에서 산책해요. 이미 경사로를 건너는 친구는 끝까지 지나간 뒤 닫아요.</p>`;
}
function updatePetPassageControls(){
 const open=getPetPassage(state).open,button=document.querySelector<HTMLButtonElement>('[data-pet-passage-toggle]');if(!button)return;
 button.disabled=actionBusy||Boolean(battleView);
 const status=document.querySelector('[data-pet-passage-status]')!,text=open?'문이 열려 있어요':'문이 닫혀 있어요';if(status.textContent!==text)status.textContent=text;
 const target=open?'close':'open';if(button.dataset.petPassageToggle!==target){button.dataset.petPassageToggle=target;button.innerHTML=`${icon('paw')} ${open?'문 닫으러 가기':'문 열러 가기'}`;}
}
async function operatePetPassage(open:boolean){
 if(!requireOnFoot())return;
 if(actionBusy||battleView||startupPending||contentActivationPending)return;
 const before=setPetPassageOpen(state,open);if(!before.ok){toast(before.message);return;}
 if(!prepareRoadWalk())return;
 scene.setMapMoveMode(false);scene.resumePlayerCamera();actionBusy=true;app.setAttribute('aria-busy','true');renderControls();
 const status=document.querySelector<HTMLElement>('.chore-status')!;
 status.innerHTML=`<span class="chore-pulse">${icon('paw')}</span><div><strong>동물 통로 문 ${open?'열기':'닫기'}<small data-chore-phase>이동 중</small></strong><span>${open?'문까지 걸어가 친구들의 길을 열어요':'건너는 친구가 지나간 뒤 문을 닫아요'}</span><div class="chore-track" role="progressbar" aria-label="동물 문 조작 진행" aria-valuemin="0" aria-valuemax="100"><i style="width:0%"></i></div></div>`;status.hidden=false;
 let failure:unknown;
 try{await scene.playPetPassageGate(open);}catch(error){failure=error;}finally{actionBusy=false;status.hidden=true;app.removeAttribute('aria-busy');}
 if(failure){scene.clearPetPassageGateOperation();render();finishDeferredUpdate();toast(failure instanceof Error?failure.message:'문까지 가는 통로를 확인해 주세요.');return;}
 const result=setPetPassageOpen(state,open);if(result.ok){state=result.state;persist();ping();}scene.clearPetPassageGateOperation();render();toast(result.message);finishDeferredUpdate();
}
function prepareRoadWalk(preserveResourceView=false){
 if(actionBusy||battleView||startupPending||contentActivationPending){toast('현재 작업을 마친 뒤 도로로 이동해요.');return false;}
 closeModal();cancelConstruction();closeFacility();stopFarmMode();if(!preserveResourceView||selectedZone!=='home')setZone('home');setFarmTray(false);scene.setFarmFocus(false);scene.setMapMoveMode(false);if(!preserveResourceView)scene.resumePlayerCamera();updateWalkingAvailability();return true;
}
async function roadsideAction(id:OutdoorSiteId):Promise<boolean>{
 const area=groundArea(id);return gatherGroundResource(area.next.node.id,true);
}
async function gatherGroundResource(id:GroundResourceId,focusTarget=false):Promise<boolean>{
 if(!requireOnFoot())return false;
 if(actionBusy||battleView||startupPending||contentActivationPending)return false;
 if(currentModal==='outdoor-site'||currentModal==='roadside'||currentModal==='ground-region')closeModal();
 state=recoverEnergy(state);
 const before=performGatheringAction(state,id);if(!before.ok){toast(before.message);return false;}
 if(!prepareRoadWalk(true))return false;
 if(focusTarget)scene.focusGroundResource(id);
 const node=getGroundResourceNode(id)!;const gatheringLabels={tree:['도끼질하는 중','도끼로 나무를 베어 목재를 모아요'],scrap:['고철을 캐는 중','도구로 고철을 캐고 쓸 만한 부품을 챙겨요'],seed:['씨앗을 따는 중','몸을 숙여 씨앗을 따고 가방에 담아요'],water:['물을 뜨는 중','연못 가장자리에서 물을 떠요 · 10회 채집 후 180초 뒤 재생']} as const;const [workLabel,workDescription]=gatheringLabels[node.kind];actionBusy=true;app.setAttribute('aria-busy','true');renderControls();
 const status=document.querySelector<HTMLElement>('.chore-status')!;
 status.innerHTML=`<span class="chore-pulse">${icon(node.resource)}</span><div><strong>${escape(node.name)}<small data-chore-phase data-working-label="${workLabel}">이동 중</small></strong><span>${workDescription}</span><div class="chore-track" role="progressbar" aria-label="이동과 채집 진행" aria-valuemin="0" aria-valuemax="100"><i style="width:0%"></i></div></div>`;status.hidden=false;
 let failure:unknown;
 try{await scene.playGroundResourceAction(id);}catch(error){failure=error;}finally{actionBusy=false;status.hidden=true;app.removeAttribute('aria-busy');}
 if(failure){render();finishDeferredUpdate();toast(failure instanceof Error?failure.message:'통로를 확인하고 다시 채집해 주세요.');return false;}
 state=recoverEnergy(state);
 const result=performGatheringAction(state,id);if(result.ok){state=result.state;persist();ping();}render();toast(result.message);finishDeferredUpdate();return result.ok;
}
function farmExpansionSummary(){
 const capacity=getFarmCapacity(state),remaining=capacity-state.plots.length;
 return `<div class="farm-expansion-summary"><span>${icon('plot-empty')}</span><div><strong>우리 농장 <b>${state.plots.length} / ${capacity}칸</b></strong><small>${remaining>0?`밭 ${remaining}칸을 더 만들 수 있어요`:state.deckLevel<MAX_DECK_LEVEL?'데크를 넓히면 새 농장 공간이 열려요':'가장 넓은 농장이에요'}</small></div><button class="button button-light" data-open="farm-expand">밭 확장</button></div>`;
}
function renderFarmExpansion(){
 const capacity=getFarmCapacity(state),count=state.plots.length,full=count>=capacity,cost=farmExpansionCost(state);
 modalShell('GROW OUR GARDEN','밭을 더 만들어 볼까요?',`
  <div class="farm-expansion-preview">${icon('plot-empty')}<div><strong>${count}칸 ${full?'':`→ ${count+1}칸`}</strong><span>데크 Lv.${state.deckLevel} · 최대 ${capacity}칸</span></div></div>
  <p class="modal-description">${full?state.deckLevel<MAX_DECK_LEVEL?`지금 데크의 농장 공간을 모두 사용하고 있어요.<br>데크 Lv.${state.deckLevel+1}로 확장하면 최대 ${getFarmCapacity({deckLevel:state.deckLevel+1})}칸까지 가꿀 수 있어요.`:'24칸의 넓은 농장이 완성됐어요. 원하는 씨앗을 골라 가꿔 보세요.':'목재와 고철로 새 밭 한 칸을 만들어요.<br>완성한 밭에서도 씨앗 심기·물 주기·수확을 이어서 할 수 있어요.'}</p>
  ${full?'':`<div class="cost-row"><span class="${state.resources.wood>=cost.wood?'':'insufficient'}">${icon('wood')} 목재 <strong>${state.resources.wood} / ${cost.wood}</strong></span><span class="${state.resources.scrap>=cost.scrap?'':'insufficient'}">${icon('scrap')} 고철 <strong>${state.resources.scrap} / ${cost.scrap}</strong></span></div><p class="farm-expansion-energy">${icon('bolt')} 기력 8 사용</p>`}
  <button class="button full-width" data-action="expandFarm" ${full?'disabled':''}>${icon('hammer')} ${full?'지금 데크의 밭이 가득 찼어요':'새 밭 1칸 만들기'}</button>
  ${full&&state.deckLevel<MAX_DECK_LEVEL?`<button class="button button-light full-width activity-secondary" data-open="expand">${icon('expand')} 데크 확장하러 가기</button>`:''}
  <button class="text-button full-width" data-show-farm>${icon('seeds')} 농장으로 돌아가기</button>
 `);
}
function farmContent(){return `${renderFarmDeliveryPreview(state)}${farmExpansionSummary()}<p class="modal-description">씨앗 인벤토리에서 고른 뒤 빈 밭을 연속으로 눌러 심어요.<br>물 주기·수확은 한 번 누르면 할 수 있는 모든 밭을 차례로 돌봐요.</p><button class="button button-light full-width farm-seed-link" data-seed-change>${icon('seeds')} 씨앗 인벤토리 열기</button><div class="farm-all-tools"><button class="button button-light" data-farm-all="fertilize">${icon('seeds')} 모두 영양 주기</button><button class="button button-light" data-farm-all="water">${icon('water')} 모두 물 주기</button><button class="button button-light" data-farm-all="harvest">${icon('food')} 모두 수확</button></div><div class="farm-grid">${state.plots.map((p,i)=>{const progress=getCropProgress(state,p),planted=p.plantedAt!==null,crop=CROPS[getPlotCropId(p)];return `<article class="plot-card" data-plot-card="${p.id}"><div class="plot-illustration ${!planted?'empty':''}">${planted?cropIcon(crop.id,progress>=1?'produce':'plant'):icon('plot-empty')}</div><h3>${i+1}번 텃밭${planted?` · ${crop.name}`:''}</h3><span class="plot-state">${!planted?'새로운 씨앗을 기다려요':progress>=1?`${crop.name} 수확할 준비가 됐어요!`:p.watered?`${crop.name} 쑥쑥 자라는 중`:`${crop.name}에 물을 주세요`}</span><div class="quest-progress"><span style="width:${progress*100}%"></span></div><button class="button ${planted&&progress<1?'button-light':''}" data-action="${!planted?'plant':progress>=1?'harvest':'water'}" data-plot="${p.id}" ${planted&&p.watered&&progress<1?'disabled':''}>${planted&&progress>=1?cropIcon(crop.id,'produce'):icon(!planted?'seeds':'water')}${!planted?(seedChosen?'심기 이어하기':'씨앗 고르기'):progress>=1?'수확하기':p.watered?'잘 자라고 있어요':'물 주기'}</button><button class="button button-light farm-care-button" data-action="fertilize" data-plot="${p.id}" ${!planted?'hidden':''} ${getFarmPlotCare(state,p).canFertilize?'':'disabled'}>${icon('seeds')}<span>${getFarmPlotCare(state,p).fertilized?'영양 +2 적용됨':'영양 주기 · 식량 1 / 수확 +2'}</span></button></article>`;}).join('')}</div><div class="info-note">${icon('clock')} 시간이 흐르는 동안 작물이 자라요. 잠시 앱을 닫아도 작물이 자라요. 시간을 멈추면 성장은 쉬어요.</div>`;}
function renderFarm(){
 const body=document.querySelector('#farm-content');if(!body)return;
 updateFarmDeliveryPreview(body as HTMLElement,state);
 const cards=Array.from(body.querySelectorAll<HTMLElement>('[data-plot-card]'));
 if(cards.length!==state.plots.length||cards.some((card,i)=>card.dataset.plotCard!==String(state.plots[i].id))){body.innerHTML=farmContent();return;}
 // Keep touch targets mounted across growth ticks and inventory changes.
 cards.forEach((card,i)=>{
  const p=state.plots[i],progress=getCropProgress(state,p),planted=p.plantedAt!==null,crop=CROPS[getPlotCropId(p)];
  const care=getFarmPlotCare(state,p),nutrition=card.querySelector<HTMLButtonElement>('.farm-care-button');if(nutrition){nutrition.hidden=!planted;nutrition.disabled=!care.canFertilize;nutrition.querySelector('span')!.textContent=care.fertilized?'영양 +2 적용됨':'영양 주기 · 식량 1 / 수확 +2';}
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
function bagContent(){return `<div id="bag-farm-ledger">${renderFarmCropLedger(state)}</div><p class="modal-description">도로에서 모은 자원과 여섯 가지 씨앗을 보관해요.</p><div class="inventory-grid">${resources.map(r=>`<div class="inventory-item"><span class="resource-icon ${r}">${icon(r)}</span><strong>${resourceLabels[r]}</strong><b><span data-inventory-count="${r}">${state.resources[r]}</span><small>${r==='water'?' L':' 개'}</small></b><p>${({wood:'트럭을 넓힐 때 써요',scrap:'튼튼한 집의 재료예요',food:'동물 돌봄과 여행에 써요',water:'텃밭에 생기를 더해요',seeds:'여섯 종류를 골라 심어요'})[r]}</p></div>`).join('')}</div><button class="button button-light full-width inventory-seed-link" data-seed-change>${icon('seeds')} 씨앗 인벤토리 · 원하는 씨앗 고르기</button><div class="bag-seed-list">${CROP_IDS.map(id=>`<span>${cropIcon(id,'seed')}<small>${CROPS[id].name}</small><b data-bag-seed-count="${id}">${getSeedCount(state,id)}</b></span>`).join('')}</div><button class="button full-width" data-open="roadside">${icon('wood')} 주변에서 자원 찾기</button><button class="button button-light full-width inventory-map-link" data-open="map">${icon('map')} 도로 주변 지도 보기</button>`;}
function renderBag(){
 const ledger=document.querySelector('#bag-farm-ledger');if(ledger){const key=JSON.stringify([state.farmEconomy?.crops,state.resources.food]);if((ledger as HTMLElement).dataset.ledgerKey!==key){ledger.innerHTML=renderFarmCropLedger(state);(ledger as HTMLElement).dataset.ledgerKey=key;}}
 const body=document.querySelector('#bag-content');if(!body)return;
 for(const r of resources){const count=body.querySelector<HTMLElement>(`[data-inventory-count="${r}"]`)!;if(count.textContent!==String(state.resources[r]))count.textContent=String(state.resources[r]);}
 for(const id of CROP_IDS){const count=body.querySelector<HTMLElement>(`[data-bag-seed-count="${id}"]`)!;if(count.textContent!==String(getSeedCount(state,id)))count.textContent=String(getSeedCount(state,id));}
}
function villageInvestmentContent(){
 const investment=getVillageHub(state).investment;
 return `<button class="order-next-investment village-plan-card" data-village-advice="investment" aria-label="${escape(investment.title)} · ${escape(investment.cta)}"><span>${icon(investment.icon)}</span><div><small>이 보상으로 이어갈 마을 투자</small><strong data-order-investment-title>${escape(investment.title)}</strong><span data-order-investment-detail>${escape(investment.detail)}</span></div>${icon('chevron')}</button>`;
}
function villageOrderContent(){
 const order=getVillageOrder(state);
 return `<article class="village-order-card" data-village-order="${order.id}"><div class="order-heading"><span>${icon('truck')}</span><div><small>이웃 트럭의 의뢰 · ${order.sequence}번째</small><h3>${escape(order.name)}</h3></div></div><p>${escape(order.description)}</p><h4>보낼 물자</h4><div class="order-costs">${Object.entries(order.costs).map(([r,n])=>`<div class="${state.resources[r as Resource]>=n!?'enough':''}">${icon(r)}<span>${resourceLabels[r as Resource]}</span><strong data-order-resource="${r}">${state.resources[r as Resource]} / ${n}</strong></div>`).join('')}</div><h4>받는 보상</h4><div class="order-rewards">${Object.entries(order.rewards.resources).map(([r,n])=>`<span>${icon(r)} ${resourceLabels[r as Resource]} <b>+${n}</b></span>`).join('')}<span>${icon('star')} 경험치 <b>+${order.rewards.xp}</b></span></div><button class="button full-width" data-order-deliver="${order.id}" ${!order.ready||actionBusy?'disabled':''}>${icon('truck')} ${actionBusy?'지금 작업을 마치면 납품해요':order.ready?'물자 보내고 보상 받기':'물자를 더 모아 주세요'}</button><button class="button button-light full-width" data-order-source>${icon('map')} 물자 모으러 가기</button><p class="order-source-hint">${escape(order.sourceHint)}</p></article><p class="fine-print">납품할 때 표시된 물자를 사용해요. 보상을 받으면 다음 의뢰가 도착해요.</p>${villageInvestmentContent()}`;
}
function renderVillageOrder(){
 const order=getVillageOrder(state);document.querySelector<HTMLElement>('[data-order-ready]')!.hidden=!order.ready;
 const body=document.querySelector<HTMLElement>('#village-order-content');if(!body||currentModal!=='orders')return;
 if(body.dataset.order!==order.id){body.dataset.order=order.id;body.innerHTML=villageOrderContent();}
 for(const r of Object.keys(order.costs))body.querySelector(`[data-order-resource="${r}"]`)!.textContent=`${state.resources[r as Resource]} / ${order.costs[r as Resource]}`;
 const nextInvestment=getVillageHub(state).investment;
 body.querySelector('[data-order-investment-title]')!.textContent=nextInvestment.title;body.querySelector('[data-order-investment-detail]')!.textContent=nextInvestment.detail;
 const deliver=body.querySelector<HTMLButtonElement>('[data-order-deliver]')!;deliver.disabled=!order.ready||actionBusy;
 deliver.innerHTML=icon('truck')+(actionBusy?'지금 작업을 마치면 납품해요':order.ready?'물자 보내고 보상 받기':'물자를 더 모아 주세요');
}
function deliverVillageOrder(id:string){
 if(actionBusy||battleView||contentActivationPending||performance.now()<orderAdvanceGuardUntil)return;
 const result=fulfillVillageOrder(state,id);if(!result.ok){toast(result.message);return;}
 orderAdvanceGuardUntil=performance.now()+600;state=result.state;persist();render();ping();toast(result.message);
}
function goToOrderSource(){
 const order=getVillageOrder(state);
 const missing=(Object.keys(order.costs) as Resource[]).find(resource=>state.resources[resource]<(order.costs[resource]??0));
 if(!missing){toast('물자가 준비됐어요. 납품하고 마을의 다음 투자를 이어가요.');return;}
 const building=getSettlement(state).buildings.filter(b=>BUILDINGS[b.type].yieldResource===missing).sort((a,b)=>Number(productionState(state,b).ready)-Number(productionState(state,a).ready))[0];
 closeModal();if(building){selectFacility(building.id);return;}
 if(missing==='food'){setZone('home',true);selectPlot(preferredPlot()?.id??null);toast('자란 작물을 눌러 수확하고, 빈 밭에는 씨앗을 심어요.');}
 else if(missing==='wood')openRoadsideSite('grove');
 else if(missing==='scrap')openRoadsideSite('salvage');
 else if(missing==='seeds')openRoadsideSite('seed-meadow');
 else openRoadsideSite('spring');
}
function showPlanningSheet(mode:'catalog'|'expansion',expectedModal=mode==='catalog'?'build':'expand'){
 const className=mode==='catalog'?'planning-catalog':'planning-expansion',root=document.querySelector<HTMLElement>('#modal-root')!;
 root.classList.add(className);document.querySelector('.scene-card')!.classList.add(className);
 requestAnimationFrame(()=>{if(currentModal===expectedModal)scene.setPlanningViewport(expectedModal==='floors'?'catalog':mode,expectedModal!=='floors'&&expectedModal!=='village'&&state.deckLevel<MAX_DECK_LEVEL?state.deckLevel+1:undefined);});
}
function openModal(kind:string){

 if(kind==='grove'){activeRoadsideSite='grove';kind='outdoor-site';}if(kind==='seeds'){openSeedInventory();return;}if(battleView)return;closeModal();document.querySelector('#toast')!.classList.remove('visible');clearTimeout(toastTimer);cancelConstruction();closeFacility();if(!actionBusy)stopFarmMode();currentModal=kind;updateNav();
 if(kind==='energy'){
  state=recoverEnergy(state);renderVitals();
  modalShell('A LITTLE ENERGY EVERY MINUTE','기력 자동 회복','<div class="energy-recovery-summary"><span>'+icon('bolt')+'</span><strong><b data-energy-current>'+Math.round(state.energy)+'</b> / 100</strong><p>실제 시간 20초마다 +1 · 1분에 +3</p><p data-energy-next>'+energyRecoveryText()+'</p></div><p class="modal-description">기력은 버튼을 누르지 않아도 자연스럽게 회복돼요.<br>게임을 닫아 둔 동안에도 최대 100까지 회복됩니다.</p><button class="button full-width" data-close>계속 플레이</button>');
  return;
 }
 if(kind==='village'){setZone('home');setFarmTray(false);modalShell('OUR GROWING TRUCK VILLAGE','마을 생산과 다음 성장',`<div id="village-management">${renderVillageManagement(state,getVillageHub(state))}</div>`,true);showPlanningSheet('catalog','village');}
 if(kind==='shop'){shopPending=null;renderedShopKey='';renderLiveShop(true);}
 if(kind==='menu')modalShell('OUR LITTLE VILLAGE','마을 메뉴',`<div class="village-menu-grid">${[['flag','성장 목표','settlement-goals'],['expand','트럭 확장','expand'],['plot-empty','밭 확장','farm-expand'],['axe','벌목장','grove'],['bag','마을 의뢰','orders'],['bag','트럭 상점','shop'],['settings','설정','settings'],['paw','동물 동료','pet'],['character','생존자','character'],['map','도움말','guide']].map(([i,t,id])=>`<button data-open="${id}">${icon(i)}<span>${t}</span></button>`).join('')}</div>`);
 if(kind==='farm-delivery'){renderedFarmDeliveryKey='';renderLiveFarmDelivery();}
 if(kind==='roadside'||kind==='outdoor-site'||kind==='ground-region'){renderedRoadsideKey='';renderLiveRoadside();}
 if(kind==='pet-passage')modalShell('A PATH FOR OUR FRIENDS','동물 통로 문',petPassageContent());
 if(kind==='orders')modalShell('NEIGHBORS ON THE ROAD','마을 의뢰',`<div id="village-order-content" data-order="${getVillageOrder(state).id}">${villageOrderContent()}</div>`);
 if(kind==='build'){setZone('home');setFarmTray(false);closeFacility();modalShell('BUILD OUR TRUCK VILLAGE','트럭 위 마을 건설',buildingCatalog(state),true);showPlanningSheet('catalog');}
 if(kind==='settlement-goals'){selectedGrowthChapter??=getActiveGrowthQuest(state)?.chapter;modalShell('CURRENT QUEST','마을 성장 목표',renderGrowthQuestBoard(state,selectedGrowthChapter),true);}
 if(kind==='farm')modalShell('LITTLE GARDEN','트럭 위 작은 텃밭',`<div id="farm-content">${farmContent()}</div>`,true);
 if(kind==='farm-expand')renderFarmExpansion();
 if(kind==='truck-home'){
  modalShell('OUR TRUCK, OUR HOME','트럭 생활',`<div class="truck-home-art">${icon('truck')}<strong>우리 트럭이 곧 우리집이에요</strong></div><p class="modal-description">생활 데크 ${getTruckFloorCount(state)}층에서 농사와 생산을 이어가요.<br>기력은 자동으로 회복돼요. 공간을 넓혀 마을을 키워 보세요.</p><button class="button full-width" data-open="energy">${icon('bolt')} 기력 자동 회복 보기</button><button class="button button-light full-width activity-secondary" data-open="expand">${icon('expand')} 생활 데크 넓히기</button><button class="button button-light full-width activity-secondary" data-open="floors">${icon('truck')} 2층 · 3층 증축 보기</button>`);
 }
 if(kind==='floors'){
  setZone('home');setFarmTray(false);const count=getTruckFloorCount(state),cost=getTruckFloorCost(state),unlocked=cost!==null&&state.deckLevel>=cost.unlockLevel;
  modalShell('BUILD UP OUR TRUCK',cost?`${count}층 → ${cost.floor}층 증축`:'3층 트럭 마을 완성',`<div class="truck-floor-preview">${icon('truck')}<div><strong>현재 ${count}층 · 빈 데크에 자유롭게 배치</strong><small>데크 Lv.4에서 2층 · Lv.7에서 3층을 지어요.<br>층 버튼으로 지도를 바꾸고 계단으로 오르내려요.</small></div></div>${cost?`<div class="expansion-dock-cost">${icon('wood')} 목재 ${state.resources.wood} / ${cost.wood} ${icon('scrap')} 고철 ${state.resources.scrap} / ${cost.scrap}</div><button class="button full-width" data-truck-floor-build ${unlocked?'':'disabled'}>${icon('hammer')} ${unlocked?`${cost.floor}층 플랫폼 건설 확정`:`먼저 데크 Lv.${cost.unlockLevel}로 확장해요`}</button>${unlocked?'':'<button class="button button-light full-width activity-secondary" data-open="expand">'+icon('expand')+' 데크 확장 보기</button>'}`:'<p class="fine-print">생활 시설을 세 층에 나누어 배치해 보세요.</p>'}<p class="fine-print">증축은 확정할 때 재료를 사용해요. 시설의 재배치와 방향 변경은 무료예요.</p>`);
  showPlanningSheet('expansion','floors');
 }
 if(kind==='bag')modalShell('THINGS WE FOUND','우리의 배낭',`<div id="bag-content">${bagContent()}</div>`,true);
 if(kind==='expand'){
  setZone('home');setFarmTray(false);const cost=expansionCost(state),full=state.deckLevel>=MAX_DECK_LEVEL,next=state.deckLevel+1;
  modalShell('EXPAND OUR TRUCK',full?'데크를 모두 넓혔어요':`데크 Lv.${state.deckLevel} → Lv.${next}`,`<div class="expansion-dock-summary"><span>${icon('expand')}</span><div><strong>${full?`빈 데크에 자유 건설 · 밭 최대 24칸`:`데크 ${deckCellCount(state.deckLevel)} → ${deckCellCount(next)}칸 · 밭 최대 ${getFarmCapacity(state)} → ${getFarmCapacity({deckLevel:next})}칸`}</strong><small>${full?'2·3층을 증축해 더 많은 시설을 배치해요':'맵의 초록 영역이 새로 열릴 데크예요 · 기본 밭 +1'}</small></div></div><div class="expansion-dock-cost">${icon('wood')} 목재 ${state.resources.wood} / ${cost.wood} ${icon('scrap')} 고철 ${state.resources.scrap} / ${cost.scrap}<span>${icon('bolt')} 기력 15</span></div><button class="button full-width" data-action="expand" ${full?'disabled':''}>${icon('hammer')} ${full?'최대 크기의 데크':'새 데크 확장 확정'}</button><button class="button button-light full-width activity-secondary" data-open="floors">${icon('truck')} 2층 · 3층 증축</button>`);
  showPlanningSheet('expansion');if(!full)scene.setExpansionPreview(next);
 }
 if(kind==='grove'){
  modalShell('THE LITTLE WOODLAND','도로 옆, 우리의 벌목장',`<div class="grove-illustration"><span class="grove-sign">서울 숲길 · 채집 구역</span></div><p class="modal-description">트럭 옆 숲길로 내려가 나무를 직접 베어요.<br>벌목장 화면에서 나무를 누르거나 아래 버튼으로 시작하세요.</p><div class="grove-rewards"><span>${icon('wood')} 목재 <b>+18</b></span><span>${icon('seeds')} 씨앗 <b>+3</b></span><span>${icon('bolt')} 기력 <b>−10</b></span></div><button class="button full-width" data-action="chop">${icon('axe')} ${state.energy<10?'기력 회복 기다리기':'나무 베러 가기'}</button><button class="button button-light full-width grove-look" data-look-grove>${icon('map')} 벌목장 둘러보기</button><div class="grove-salvage"><span>고철과 물이 필요하다면</span><button class="text-button" data-open="roadside">버려진 휴게소 탐색 ${icon('arrow')}</button></div>`);
 }
 if(kind==='hunt'){
  const stages=[{id:1,title:STAGE_NAMES[0],desc:'숲에 숨어든 좀비 무리',tag:'추천 동료 Lv.1',style:'forest'},{id:2,title:STAGE_NAMES[1],desc:'바리케이드 너머의 감염자',tag:'추천 동료 Lv.2',style:'toll'},{id:3,title:STAGE_NAMES[2],desc:'거대한 경비병이 지키는 보급품',tag:'추천 동료 Lv.3',style:'ruins'}];
  modalShell('OUR ANIMAL EXPEDITION','우리 동물 원정대',`<p class="modal-description">동료 최대 3마리와 세 웨이브에 도전해요.<br>기본 공격은 자동 · 기술 버튼으로 도와주세요.</p><div class="explore-quick-links"><button data-zone="grove">${icon('axe')} 벌목장 둘러보기</button><button data-open="roadside">${icon('map')} 생활 물자 탐색</button></div><div class="stage-list">${stages.map(st=>`<button class="stage-card ${st.style} ${selectedStage===st.id?'selected':''}" data-stage="${st.id}" aria-pressed="${selectedStage===st.id}" style="--stage-art:url('${BATTLE_ART_URLS[st.id-1]}')"><span class="stage-number">${String(st.id).padStart(2,'0')}<span>STAGE</span></span><span class="stage-card-body"><small>${st.tag} · 3 WAVES</small><strong>${st.title}</strong><span>${st.desc}</span></span><span class="stage-check">${icon(selectedStage===st.id?'check':'chevron')}</span></button>`).join('')}</div>${companionRosterCards(true)}<p class="companion-party-note">${icon('paw')} 출전 동료: ${getReadyTeam(state).map(id=>UNITS[id].name).join(' · ')||'함께 쉬어 주세요'} <span>${icon('bolt')} 기력 ${Math.round(state.energy)}</span></p><div class="battle-reward-preview">${icon('food')} 승리 보상: 식량 ${6+selectedStage*2} · 고철 ${selectedStage*2} · 목재 2</div><button class="button full-width ${state.energy<16||!getReadyTeam(state).length?'unavailable':''}" data-start-hunt aria-disabled="${state.energy<16||!getReadyTeam(state).length}">${icon('hunt')} 전투 스테이지 입장 <span class="button-cost">기력 16</span></button>${huntRecoveryHint()}<p class="fine-print">승리하면 출전 동료가 경험치를 얻어요 · 한 동료가 지쳐도 다른 동료는 계속 싸워요<br>전투 중 앱을 종료하면 보상 없이 귀환해요</p>`,true);
 }
 if(kind==='quests'){modalShell('ONE STEP AT A TIME','작은 목표, 큰 하루',`<p class="modal-description">서두르지 않아도 괜찮아요. 하나씩 해 나가요.</p><div class="quest-list">${questList(state).map(q=>`<article class="quest-row ${q.complete?'completed':''}"><span class="quest-row-icon">${icon(q.complete?'check':'flag')}</span><div><h3>${escape(q.title)}</h3><p>${escape(q.description)}</p><small>${escape(q.reward)} · 달성 시 자동 지급</small><div class="quest-progress"><span style="width:${Math.min(100,q.current/q.target*100)}%"></span></div></div><b>${q.current}/${q.target}</b></article>`).join('')}</div>`);}
 if(kind==='pet'){
  modalShell('OUR LITTLE FAMILY','함께 살아가는 동물 친구들',`<p class="modal-description">동물 카드를 누르면 곁으로 가서 쓰다듬을 수 있어요.<br>지상에 있는 코끼리와 기린은 등에 타고 함께 산책해요.</p><div class="animal-meet-grid">${getUnlockedUnitIds(state).map(id=>`<button data-animal-focus="${id}" aria-label="${UNITS[id].name} ${UNITS[id].speciesLabel} 만나기">${companionPortrait(id)}<strong>${UNITS[id].name}</strong><small>${UNITS[id].speciesLabel}${id==='elephant'||id==='giraffe'?' · 지상 탑승':''}</small></button>`).join('')}</div><button class="button button-light full-width activity-secondary" data-open="pet-team">${icon('shield')} 전투 동료 편성하기</button><div class="bond-meter"><span>우리의 행복</span><strong>${Math.round(state.morale)} / 100</strong><div class="quest-progress"><span style="width:${state.morale}%"></span></div></div><button class="button full-width" data-action="rest">${icon('bed')} 동료 체력 돌보기</button><p class="fine-print">${state.resources.food>=1&&state.resources.water>=1?'식량 1 · 물 1 · 동료 체력 35% 회복':'물자가 없어도 동료 체력 10% 회복'}<br>11종이 한 마리씩 함께 살아요. 큰 동물은 데크 성장 후 승선해요.</p><button class="button button-light full-width activity-secondary" data-open="shop">${icon('bag')} 상점에서 동료 만나기</button>`);
 }
 if(kind==='pet-team')modalShell('OUR ANIMAL EXPEDITION','전투 동료 편성',`${companionRosterCards()}<button class="button button-light full-width activity-secondary" data-open="pet">${icon('paw')} 마을 동물 만나기</button><button class="button full-width activity-secondary" data-open="hunt">${icon('shield')} 원정 준비하기</button>`,true);
 if(kind==='character'||kind==='welcome'){selectedGender=state.gender;modalShell(kind==='welcome'?'YOUR STORY STARTS HERE':'MEET YOUR SURVIVOR',kind==='welcome'?'우리의 첫 번째 아침':'오늘의 나를 만나기',`<p class="modal-description">2187년, 좀비로 가득한 대한민국.<br> 커다란 트럭 위에서 당신만의 작은 일상을 시작하세요.</p><div class="character-choices"><button data-gender="female" class="character-choice ${selectedGender==='female'?'selected':''}">${portrait('female','',getEquippedOutfit(state,'female'))}<strong>여자 생존자</strong><span>다정하고 씩씩한 모험가</span></button><button data-gender="male" class="character-choice ${selectedGender==='male'?'selected':''}">${portrait('male','',getEquippedOutfit(state,'male'))}<strong>남자 생존자</strong><span>따뜻하고 든든한 모험가</span></button></div><label class="name-label" for="player-name">어떤 이름으로 불러 드릴까요?</label><input class="name-input" id="player-name" maxlength="16" value="${escape(state.name)}" placeholder="생존자의 이름" autocomplete="off"><button class="button full-width" data-start>${icon('sun')} ${kind==='welcome'?'우리집에서 시작하기':'변경 저장하기'}</button><p class="fine-print">캐릭터는 언제든 변경할 수 있어요 · 기기에 자동 저장</p>${kind==='welcome'&&showInstallHelp()&&isAppleMobileDevice()?`<details class="pwa-welcome-install" data-pwa-welcome-install><summary>아이폰 홈 화면에서 시작하는 방법</summary>${homeScreenInstructions()}<p>Safari와 홈 화면 앱의 진행은 별개일 수 있어요. 처음부터 홈 화면 아이콘으로 시작하면 좋아요.</p></details>`:''}`);}
 if(kind==='map'){activeRoadsideSite=null;currentModal='roadside';renderedRoadsideKey='';renderLiveRoadside();}
 if(kind==='journal'){modalShell('POSTCARDS FROM THE ROAD','우리의 여행 일지',`<div class="journal-day">DAY ${String(state.day).padStart(2,'0')}<span>도로 위에서 함께한 날들</span></div><div class="journal-stats"><div><b>${state.stats.harvests}</b><span>번의 수확</span></div><div><b>${state.stats.chops}</b><span>번의 벌목</span></div><div><b>${state.stats.battlesWon}</b><span>번의 전투 승리</span></div></div><div class="journal-entries">${state.log.slice(0,12).map(l=>`<div>${icon('leaf')}<p>${escape(l)}</p></div>`).join('')||'<p>작은 행동으로 첫 번째 이야기를 써 보세요.</p>'}</div>`);}
 if(kind==='install'){
  const installed=isHomeScreenGame(),supported=isLiveUpdateSupported();
  modalShell('OUR HOME ON YOUR PHONE',installed?'홈 화면에서 여행하고 있어요':'홈 화면에서 바로 플레이',`<section data-pwa-install data-pwa-ios="${isAppleMobileDevice()}" data-pwa-standalone="${installed}"><p class="modal-description">${!supported?'최신 Safari에서 공개 게임 주소를 열면 홈 화면 설치와 자동 패치를 이용할 수 있어요.':installed?'게임을 열 때 새 버전을 자동으로 확인해요.':'아이콘으로 열고, 화면을 넓게 쓰고, 새 게임 업데이트를 자동으로 받아요.'}</p>${installed?'':homeScreenInstructions()}${!installed&&hasInstallPrompt()?'<button class="button full-width" data-pwa-install-now>로드헤이븐 설치하기</button>':''}<p class="pwa-install-note">${!supported?'이 브라우저에서는 현재 게임을 실행해요. 자동 패치와 오프라인 재실행은 지원되는 Safari에서 이용해 주세요.':installed?'업데이트는 파일 준비가 끝난 뒤 저장하고 적용해요. 농사나 전투를 하고 있다면 트럭 홈에 돌아온 뒤 이어서 적용해요.':'처음부터 홈 화면 아이콘으로 시작하면 좋아요. Safari와 홈 화면 앱, 다른 기기의 진행은 별개일 수 있어요.'}</p><p class="fine-print">처음 게임 파일을 준비할 때는 인터넷이 필요해요.<br>준비가 끝난 뒤에는 오프라인에서도 저장한 마을을 열 수 있어요.</p></section>`);
 }
 if(kind==='settings')renderSettings();
 if(kind==='guide'){modalShell('WELCOME TO ROAD HAVEN','천천히, 함께 살아가기',`<div class="guide-list">${[['move','원하는 곳으로 화면을 움직여요','빈 바닥을 톡 누르면 캐릭터가 걸어가요. 다시 누르면 방향을 바꾸고 건물은 피해 가요. 도로와 트럭 사이는 계단으로 오가요. 층 버튼으로 1·2·3층을 선택하고 연결 계단을 이용해요. 완성된 시설을 누르면 무료로 재배치할 수 있어요. 손가락으로 끌면 화면이 움직여요. 밭 위에서도 화면을 움직이려면 왼쪽 화면 이동 버튼을 켜 주세요. 이동 모드에서는 씨앗을 쓰거나 시설을 선택하지 않아요. 두 손가락으로 이동·확대도 가능하며, 기본 보기나 우리 트럭 메뉴로 돌아올 수 있어요.'],['seeds','심고, 돌보고, 수확해요','씨앗을 한 번 골라 두면 심기 이어하기로 다시 사용할 수 있어요. 밭을 누르거나 손가락으로 쓸면 차례로 심고 돌봐요. 아래 물 주기·수확·영양 버튼은 한 번 누르면 가능한 밭을 모두 작업해요. 자라는 작물에 식량 1개로 한 번 영양을 주면 수확량이 2개 늘어요. 실제 수확한 작물을 납품하면 코인·경험치·건설 재료를 받아요. 작업 종료는 대기를 취소하고 지금 밭만 마쳐요.'],['wood','도로 너머를 탐색해요','트럭 차체 바깥 도로를 자유롭게 걸어요. 벌목장·고철 수거장·씨앗 풀밭·샘터에서 필요한 물자를 골라 직접 모아요. 계단으로 트럭에 돌아오고, 채집 장소는 표시된 초가 지나면 다시 준비돼요. 사냥은 동물 11종 중 최대 3마리를 편성하는 전투 스테이지에서 진행돼요.'],['hammer','트럭을 우리집으로 만들어요','데크를 확장하면 기본 밭 1칸과 추가 농장 공간이 열려요. 화면 왼쪽 밭 확장에서 재료를 써 새 밭을 만들 수 있어요. 데크 단계마다 최대 밭이 3칸씩 늘어 총 24칸까지 가꿀 수 있어요. 시설은 Lv.5까지 개선할 수 있어요.'],['bolt','기력이 자연스럽게 차올라요','기력은 실제 시간 20초마다 1씩, 1분에 3씩 자동 회복돼요. 게임을 닫아도 최대 100까지 회복됩니다. 동료 화면의 돌보기는 동물 체력을 회복하고, 쓰다듬기는 행복을 채워요.'],['shield','우리의 일상은 저장돼요','진행 상황은 이 기기에 자동 저장돼요. 앱을 삭제하거나 데이터를 지우면 저장도 사라져요.']].map(([i,t,d])=>`<div><span>${icon(i)}</span><article><h3>${t}</h3><p>${d}</p></article></div>`).join('')}</div>`);}
 if(kind==='reset')modalShell('A FRESH START','새로운 여행을 시작할까요?',`<p class="modal-description">현재 기기의 모든 진행 상황이 지워집니다.<br>이 작업은 되돌릴 수 없어요.</p><button class="button button-danger full-width" data-reset>진행 상황을 지우고 새로 시작</button><button class="text-button full-width" data-close>지금의 여행 계속하기</button>`);
}
function renderSettings(){modalShell('MAKE YOURSELF AT HOME','우리집 설정',`<div class="settings-row"><div><strong>게임 소리</strong><p>작은 행동에 기분 좋은 소리를 더해요</p></div><button class="toggle ${sound?'on':''}" data-sound aria-label="게임 소리 ${sound?'끄기':'켜기'}" aria-pressed="${sound}"><span></span></button></div><div class="settings-row"><div><strong>시간 흐름</strong><p>현재 ${paused?'쉬어 가는 중':'흘러가는 중'}</p></div><button class="button button-light small" data-pause>${paused?'계속하기':'잠시 멈춤'}</button></div><button class="button button-light full-width" data-game-landscape>가로 전체 화면으로 플레이</button><p class="fine-print">회전이 지원되지 않으면 자동 회전을 켜고 기기를 옆으로 돌려 주세요.</p>${updateSettingsContent()}<button class="text-button full-width" data-save>${icon('check')} 지금 저장하기</button><button class="text-button danger full-width" data-open="reset">새로운 여행 시작</button><p class="fine-print">ROAD HAVEN · 로드헤이븐 v${APP_VERSION}<br>당신의 기기에 머무는 작은 세상</p>`);refreshUpdateUI();}
function updateSettingsContent(){
 const native=isNativeUpdateSupported(),supported=isLiveUpdateSupported();
 return `<div class="update-box game-content-update"><div class="update-heading">${icon('check')}<strong>게임 콘텐츠 자동 업데이트</strong><span>v${APP_VERSION}</span></div><p data-live-update-message>${escape(liveUpdate.message)}</p><div class="update-download-progress" data-live-update-progress hidden><i></i></div><p class="update-explanation">${supported?'게임을 열면 새 콘텐츠를 자동으로 준비해요. 진행을 저장한 뒤 적용하고, 이동·농사·전투 중에는 기다려요.':'이 화면은 현재 게임 파일로 실행돼요. 공개 플레이 주소에서 자동 업데이트를 이용할 수 있어요.'}</p><button class="button button-light full-width" data-live-update-check ${supported?'':'hidden'}>게임 업데이트 다시 확인</button></div>${native?`<div class="update-box native-feature-update"><div class="update-heading">${icon('download')}<strong>앱 기능 업데이트</strong><span>Android</span></div><p data-native-update-message>${escape(native?automaticUpdate.message:lastUpdate?.message??'앱을 시작할 때 새 버전을 확인해요.')}</p><div class="update-download-progress" data-native-update-progress hidden><i></i></div><div class="release-notes" data-update-release-notes>${escape(lastUpdate?.release?.notes??'')}</div><button class="button button-light full-width" data-update ${updateBusy?'disabled':''}>${updateBusy?'확인하는 중…':'앱 새 버전 확인'}</button><button class="button full-width" data-install-update hidden>받은 새 버전 설치하기</button><button class="button button-light full-width" data-retry-native-update hidden>다운로드 다시 시도</button><button class="button full-width" data-download ${!native&&lastUpdate?.status==='available'?'':'hidden'}>Android APK 다운로드</button><small>${native?'새 앱 기능이 필요할 때는 설치 확인을 한 번 진행해 주세요. 다운로드는 앱 안에서 자동으로 준비해요.':'브라우저에서는 APK를 내려받아 Android에 설치할 수 있어요.'}</small></div>`:''}${showInstallHelp()?'<button class="button button-light full-width" data-open="install">홈 화면에 추가하는 방법</button>':''}`;
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
 contentActivationPending=applying;app.inert=startupPending||orientationBlocked||applying||Boolean(battleView);app.classList.toggle('content-applying',applying);contentApplyingNotice.hidden=!applying;scene.setSuspended(startupPending||orientationBlocked||applying||Boolean(battleView));
 updateWalkingAvailability();
}
function onLiveUpdate(next:LiveUpdateState){liveUpdate=next;if(next.status==='error'&&contentActivationPending)setContentApplying(false);refreshUpdateUI();maybeApplyContentUpdate();}
function maybeApplyContentUpdate(){
 if(startupPending||liveUpdate.status!=='ready'||contentActivationPending||!canActivateLiveUpdate()||document.hidden||actionBusy||scene.isWalking()||scene.isAnimalInteracting()||scene.getMountedAnimal()||battleView||currentModal||placement||selectedFacilityId!==null||farmQueue.length||farmMode||farmTrayOpen||selectedZone!=='home')return;
 if(!persist())return;
 setContentApplying(true);refreshUpdateUI();
 void activateLiveUpdate().then(accepted=>{if(!accepted){setContentApplying(false);refreshUpdateUI();}}).catch(()=>{setContentApplying(false);refreshUpdateUI();});
}
setWebUpdateActivationGuard(()=>{
 // Peer tabs freeze in memory; only the initiating tab writes the shared save.
 if(startupPending||contentActivationPending||actionBusy||scene.isWalking()||scene.isAnimalInteracting()||scene.getMountedAnimal()||battleView||currentModal||placement||selectedFacilityId!==null||farmQueue.length||farmMode||farmTrayOpen||selectedZone!=='home')return false;
 return true;
},applying=>{setContentApplying(applying);refreshUpdateUI();},()=>startupPending&&!stored?true:persist());
async function requestAutomaticInstall(){
 if(actionBusy||scene.isWalking()||scene.isAnimalInteracting()||scene.getMountedAnimal()||battleView){installAfterWork=true;if(runningFarm){afterFarm=null;stopFarmMode();}toast('지금 이동이나 작업을 마치면 준비된 앱 설치를 열어요.');return;}
 if(!persist()){toast('진행 상황을 저장한 뒤 설치를 다시 시도해 주세요.');return;}
 installAfterWork=false;closeModal();try{onAutomaticUpdate(await installPreparedUpdate());}catch{onAutomaticUpdate({status:'error',progress:0,message:'설치를 열지 못했어요. 설정에서 다시 시도해 주세요.'});}
}
function finishDeferredUpdate(){if(installAfterWork&&!actionBusy&&!battleView&&!scene.isAnimalInteracting()&&!scene.getMountedAnimal())void requestAutomaticInstall();else maybeApplyContentUpdate();}
async function initializeUpdateSystem(){
 if(!updateInitializing)updateInitializing=(async()=>{if(isNativeUpdateSupported()){onAutomaticUpdate(await initializeAutoUpdates(onAutomaticUpdate));await runUpdate();}else refreshUpdateUI();})().catch(()=>{refreshUpdateUI();});
 return updateInitializing;
}
async function runUpdate(manual=false){
 if(updateBusy)return;updateBusy=true;refreshUpdateUI();lastUpdate=await checkUpdate();updateBusy=false;
 if(lastUpdate.status==='available'&&lastUpdate.release&&isNativeUpdateSupported())try{onAutomaticUpdate(await prepareAutomaticUpdate(lastUpdate.release));}catch{onAutomaticUpdate({status:'error',progress:0,message:'새 버전을 받지 못했어요. 연결되면 설정에서 다시 시도해 주세요.'});}
 refreshUpdateUI();if(manual&&currentModal!=='settings')toast(lastUpdate.message);
}
function navigateButton(t:HTMLElement){
 if(t.dataset.nav){const nav=t.dataset.nav;if(['build','farm','hunt','grove'].includes(nav)&&!requireOnFoot())return true;cancelConstruction();closeFacility();if(!actionBusy)stopFarmMode();if(nav==='home'||nav==='farm'||nav==='grove'){recenterMap();closeModal();setZone(nav==='grove'?'grove':'home',nav==='farm');if(nav==='farm'){if(!actionBusy)scene.setActiveFloor(1);selectPlot(preferredPlot()?.id??null);}else renderControls();}else openModal(nav);return true;}
 if(t.dataset.open){if(t.dataset.open==='settlement-goals')openGrowthBoard();else openModal(t.dataset.open);return true;}
 if(t.dataset.zone){if(t.dataset.zone==='grove'){if(prepareRoadWalk())scene.focusResourceArea('grove');}else{recenterMap();cancelConstruction();closeFacility();stopFarmMode();closeModal();setZone('home');}renderControls();return true;}
 if(t.hasAttribute('data-look-grove')){if(prepareRoadWalk())scene.focusResourceArea('grove');renderControls();return true;}
 if(t.hasAttribute('data-show-farm')){recenterMap();stopFarmMode();closeModal();setZone('home',true);if(!actionBusy)scene.setActiveFloor(1);selectPlot(preferredPlot()?.id??null);return true;}
 return false;
}
const pressedVillageTargets=new WeakMap<HTMLElement,{key:string;target:VillageTarget}>();
document.addEventListener('pointerdown',event=>{
 if(animalContextId&&!(event.target as Element).closest('.animal-sheet'))closeAnimalContext();
 if(gatheringTrayOpen&&!(event.target as Element).closest('.gathering-dock'))setGatheringTray(false);
 const button=(event.target as Element).closest<HTMLElement>('[data-village-advice],[data-next-goal]');
 if(!button||!button.closest('#app'))return;
 const key=button.dataset.villageAdvice??'primary',advice=villageAdvice(key);
 if(advice)pressedVillageTargets.set(button,{key,target:advice.target});
},{capture:true});
document.addEventListener('pointercancel',event=>{
 const button=(event.target as Element).closest<HTMLElement>('[data-village-advice],[data-next-goal]');if(button)pressedVillageTargets.delete(button);
},{capture:true});
document.addEventListener('click',e=>{
 const t=(e.target as Element).closest<HTMLElement>('button,a');if(!t||!t.closest('#app')||startupPending||orientationBlocked||battleView||contentActivationPending)return;
 if(t.hasAttribute('data-farm-dismiss')){dismissFarmTray();return;}
 if(t.hasAttribute('data-animal-dismiss')){closeAnimalContext();return;}
 if(t.dataset.animalFocus&&isUnitId(t.dataset.animalFocus)){showAnimalContext(t.dataset.animalFocus,true);return;}
 if(t.dataset.animalPet&&isUnitId(t.dataset.animalPet)){void interactWithAnimal('pet',t.dataset.animalPet);return;}
 if(t.dataset.animalRide&&isUnitId(t.dataset.animalRide)){void interactWithAnimal('mount',t.dataset.animalRide);return;}
 if(t.dataset.animalFollow&&isUnitId(t.dataset.animalFollow)){scene.focusAnimal(t.dataset.animalFollow);return;}
 if(t.hasAttribute('data-animal-dismount')){const id=scene.getMountedAnimal();if(id)void interactWithAnimal('dismount',id);return;}
 if((t.hasAttribute('data-road-walk')||t.hasAttribute('data-road-return')||t.hasAttribute('data-farm-toggle'))&&!requireOnFoot())return;
 if(t.hasAttribute('data-gather-toggle')){setGatheringTray(!gatheringTrayOpen);renderGatheringDock();return;}
 if(t.dataset.gatherResource){const resource=gatheringShortcuts.find(([id])=>id===t.dataset.gatherResource)?.[0];if(resource)gatherFromShortcut(resource);return;}
 if(t.hasAttribute('data-travel-toggle')){const card=document.querySelector('.scene-card')!;const open=card.classList.toggle('travel-open');t.setAttribute('aria-expanded',String(open));t.setAttribute('aria-label',open?'도로 도구 접기':'도로 도구 펼치기');t.querySelector('small')!.textContent=open?'접기':'이동';return;}
 if(t.closest('.road-controls')){const card=document.querySelector('.scene-card')!;card.classList.remove('travel-open');const more=card.querySelector<HTMLButtonElement>('[data-travel-toggle]')!;more.setAttribute('aria-expanded','false');more.setAttribute('aria-label','도로 도구 펼치기');more.querySelector('small')!.textContent='이동';}
 if(t.hasAttribute('data-camera-player')){resumePlayerView();return;}
 if(t.dataset.petPassageToggle){void operatePetPassage(t.dataset.petPassageToggle==='open');return;}
 if(t.hasAttribute('data-road-walk')||t.hasAttribute('data-road-return')){if(prepareRoadWalk()){if(t.hasAttribute('data-road-return'))scene.walkToTruck();else scene.walkOntoRoad();}return;}
 if(t.dataset.outdoorSite){const site=getOutdoorSite(t.dataset.outdoorSite);if(site&&!actionBusy)openRoadsideSite(site.id);return;}
 if(t.dataset.regionFocus){const region=getGroundRegion(t.dataset.regionFocus);if(region&&prepareRoadWalk()){scene.focusGroundRegion(region.id);document.querySelector('#zone-name')!.textContent=region.name;toast('채집물 그림이나 작은 표식을 누르면 바로 채집해요.');}return;}
 if(t.dataset.groundRegion){const region=getGroundRegion(t.dataset.groundRegion);if(region&&!actionBusy)openGroundRegion(region.id);return;}
 if(t.dataset.groundNode){const node=getGroundResourceNode(t.dataset.groundNode);if(node)void gatherGroundResource(node.id,true);return;}
 if(t.dataset.groundFocus){const node=getGroundResourceNode(t.dataset.groundFocus);if(node&&prepareRoadWalk(true)){scene.focusGroundResource(node.id);toast('원하는 채집물을 누르면 직접 가서 작업해요.');}return;}
 if(t.dataset.outdoorCollect){const site=getOutdoorSite(t.dataset.outdoorCollect);if(site)void roadsideAction(site.id);return;}
 if(t.dataset.outdoorWalk){const site=getOutdoorSite(t.dataset.outdoorWalk);if(site&&prepareRoadWalk()){scene.focusResourceArea(site.id);toast('채집물을 눌러 하나씩 모아요. 지도 버튼을 켜고 드래그하면 숲 안쪽도 볼 수 있어요.');}return;}
 if(t.dataset.farmDeliver){deliverFarmOrder(t.dataset.farmDeliver);return;}
 if(t.dataset.farmSeed&&CROP_IDS.includes(t.dataset.farmSeed as CropId)){if(!actionBusy){openSeedInventory();document.querySelector(`[data-select-seed="${t.dataset.farmSeed}"]`)?.classList.add('quest-target');toast(`납품에 필요한 ${CROPS[t.dataset.farmSeed as CropId].seedName}을 골라요.`);}return;}
 if(t.dataset.shopTab&&SHOP_TABS.includes(t.dataset.shopTab as ShopTab)){openShop(t.dataset.shopTab as ShopTab);return;}
 if(t.dataset.shopQty){const quantity=Number(t.dataset.shopQty);if(quantity===1||quantity===5||quantity===10){shopQuantity=quantity;renderLiveShop(true);}return;}
 if(t.hasAttribute('data-shop-back')){openShop();return;}
 if(t.dataset.shopBuyKind&&['seed','pet','outfit','sale'].includes(t.dataset.shopBuyKind)){previewShopPurchase(t.dataset.shopBuyKind as ShopPurchaseKind,t.dataset.shopItem??'');return;}
 if(t.dataset.shopConfirmKind){confirmShopPurchase(t.dataset.shopConfirmKind,t.dataset.shopItem??'',Number(t.dataset.shopQuantity));return;}
 if(t.dataset.shopEquip){wearShopOutfit(t.dataset.shopEquip);return;}
 if(t.dataset.villageAdvice){
  const pressed=pressedVillageTargets.get(t);pressedVillageTargets.delete(t);
  const key=pressed?.key??t.dataset.villageAdvice,advice=villageAdvice(key);
  if(t.getAttribute('aria-disabled')==='true'||!advice){toast('이 활동은 완료됐어요. 지금 할 수 있는 일을 다시 확인해 주세요.');return;}
  goToVillageTarget(pressed?.target??advice.target);return;
 }
 if(t.dataset.layoutRotate){
  const kind=t.dataset.layoutRotate;if(kind==='facility'||kind==='plot')changeLayoutDirection({kind,id:Number(t.dataset.layoutId)});
  return;
 }
 if(t.dataset.facilitySelect){selectFacility(Number(t.dataset.facilitySelect));return;}
 if(t.dataset.facilityCollectRepeat){receiveAndRestartFacility(Number(t.dataset.facilityCollectRepeat));return;}
 if(t.hasAttribute('data-install-update')){void requestAutomaticInstall();return;}
 if(t.hasAttribute('data-update-notice')){if(automaticUpdate.status==='ready'||automaticUpdate.status==='permission')void requestAutomaticInstall();else if(runningFarm&&actionBusy)afterCurrentFarm(()=>openModal('settings'));else if(!actionBusy)openModal('settings');else toast('작업을 마치면 설정에서 업데이트를 확인해요.');return;}
 if(t.hasAttribute('data-game-landscape')){void gameOrientation?.requestLandscape();return;}
 if(t.hasAttribute('data-live-update-check')){void checkLiveUpdate().then(onLiveUpdate);return;}
 if(t.hasAttribute('data-pwa-install-now')){void installHomeScreenGame().then(installed=>{toast(installed?'홈 화면 아이콘으로 이어서 플레이해요.':'브라우저 메뉴에서 홈 화면에 추가할 수 있어요.');if(currentModal==='install')openModal('install');}).catch(()=>toast('브라우저 메뉴에서 홈 화면에 추가해 주세요.'));return;}
 if(t.hasAttribute('data-retry-native-update')&&lastUpdate?.release){void prepareAutomaticUpdate(lastUpdate.release).then(onAutomaticUpdate).catch(()=>toast('연결을 확인하고 다시 시도해 주세요.'));return;}
 if(t.hasAttribute('data-construction-cancel')){cancelConstruction();renderSettlement();return;}
 if(t.hasAttribute('data-construction-confirm')){confirmConstruction();return;}
 if(t.hasAttribute('data-construction-rotate')){rotateConstruction();return;}
 if(t.hasAttribute('data-truck-floor-build')){purchaseTruckFloor();return;}
 if(t.dataset.truckFloor){const floor=Number(t.dataset.truckFloor);if(floor===1||floor===2||floor===3)chooseTruckFloor(floor);return;}
 if(t.hasAttribute('data-facility-close')){closeFacility();return;}
 if(t.dataset.facilityEdit){selectFacility(Number(t.dataset.facilityEdit));return;}
 if(t.hasAttribute('data-camera-toggle')){const open=!document.querySelector('.scene-card')!.classList.contains('camera-open');document.querySelector('.scene-card')!.classList.toggle('camera-open',open);t.setAttribute('aria-expanded',String(open));t.setAttribute('aria-label',open?'지도 조작 접기':'지도 조작 펼치기');return;}
 if(t.dataset.orderDeliver){deliverVillageOrder(t.dataset.orderDeliver);return;}
 if(t.hasAttribute('data-order-source')){goToOrderSource();return;}
 if(t.hasAttribute('data-map-move')){const enabled=!scene.getMapMoveMode();scene.setMapMoveMode(enabled);toast(enabled?'화면을 끌어 이동해요. 밭 위에서 끌어도 작업하지 않아요. 다시 누르면 해제돼요.':'화면 이동 모드를 껐어요. 밭을 눌러 선택한 작업을 이어가세요.');return;}
 if(t.hasAttribute('data-map-reset')){recenterMap();return;}
 if(t.hasAttribute('data-map-overview')){scene.setMapMoveMode(false);scene.showVillageOverview();return;}
 if(t.dataset.mapZoom){scene.setMapZoom(scene.getMapZoom()*(Number(t.dataset.mapZoom)>0?1.25:.8));return;}
 if(t.hasAttribute('data-farm-toggle')){
  if(farmTrayOpen){dismissFarmTray();return;}
  const toggle=()=>{cancelConstruction();closeFacility();setFarmTray(true);};
  if(runningFarm&&actionBusy)afterCurrentFarm(toggle);else if(!actionBusy)toggle();return;
 }
 if(t.dataset.buildType&&BUILDING_TYPES.includes(t.dataset.buildType as BuildingType)){beginConstruction(t.dataset.buildType as BuildingType);return;}
 if(t.dataset.facilityStart){operateFacility('start',Number(t.dataset.facilityStart));return;}
 if(t.dataset.facilityCollect){operateFacility('collect',Number(t.dataset.facilityCollect));return;}
 if(t.dataset.facilityUpgrade){openFacilityUpgrade(Number(t.dataset.facilityUpgrade));return;}
 if(t.dataset.upgradeConfirm){const id=Number(t.dataset.upgradeConfirm);operateFacility('upgrade',id);closeModal();selectFacility(id);return;}
 if(t.dataset.facilityMove){const facility=getSettlement(state).buildings.find(b=>b.id===Number(t.dataset.facilityMove));if(facility)beginConstruction(facility.type,facility.id);return;}
 if(t.hasAttribute('data-next-goal')){const pressed=pressedVillageTargets.get(t);pressedVillageTargets.delete(t);if(actionBusy)openGrowthBoard();else goToVillageTarget(pressed?.target??getVillageHub(state).primary.target);return;}
 if(t.dataset.questChapter){openGrowthBoard(Number(t.dataset.questChapter));return;}
 if(t.dataset.questClaim){claimGrowthReward(t.dataset.questClaim);return;}
 if(t.dataset.questGoto){if(performance.now()>=questAdvanceGuardUntil)goToGrowthQuest(t.dataset.questGoto);return;}
 if(t.dataset.replacementTarget){openFacilityReplacement(Number(t.dataset.replacementTarget),t.dataset.replacementType as BuildingType|undefined);return;}
 if(t.dataset.facilityReplace){openFacilityReplacement(Number(t.dataset.facilityReplace));return;}
 if(t.dataset.replaceType&&BUILDING_TYPES.includes(t.dataset.replaceType as BuildingType)){confirmFacilityReplacement(Number(t.dataset.replaceFacility),t.dataset.replaceType as BuildingType);return;}
 if(t.dataset.replaceConfirm&&BUILDING_TYPES.includes(t.dataset.replaceBuildingType as BuildingType)){
  if(!requireOnFoot())return;
  if(actionBusy)return;const id=Number(t.dataset.replaceConfirm),building=getSettlement(state).buildings.find(item=>item.id===id);
  if(!building)return;
  const result=replaceFacility(state,id,t.dataset.replaceBuildingType as BuildingType);
  if(result.ok&&!scene.relocatePetsForPlacement(result.state)){toast('동물이 머물 안전한 빈 공간을 먼저 확보해 주세요.');return;}
  if(result.ok){state=result.state;closeModal();persist();render();selectFacility(id);ping();}toast(result.message);return;
 }
 if(t.dataset.selectSeed&&CROP_IDS.includes(t.dataset.selectSeed as CropId)){selectSeed(t.dataset.selectSeed as CropId);return;}
 if(t.hasAttribute('data-seed-change')){openSeedInventory();return;}
 if(t.dataset.quick==='plant'){
  if(!seedChosen)openSeedInventory();else if(farmMode==='plant')farmAllEligible();else startFarmMode('plant');return;
 }
 if(t.dataset.quick==='water'||t.dataset.quick==='harvest'||t.dataset.quick==='fertilize'){startFarmMode(t.dataset.quick,undefined,true);return;}
 if(t.dataset.farmAll==='water'||t.dataset.farmAll==='harvest'||t.dataset.farmAll==='fertilize'){startFarmMode(t.dataset.farmAll,undefined,true);return;}
 if(t.hasAttribute('data-plant-cancel')){afterFarm=null;stopFarmMode();toast(runningFarm?'지금 밭을 마치고 작업을 종료해요.':'연속 텃밭 작업을 종료했어요.');return;}
 if(t.hasAttribute('data-plant-all')){farmAllEligible();return;}
 if(t.hasAttribute('data-seed-gather')){closeModal();afterCurrentFarm(()=>void roadsideAction('seed-meadow'));return;}
 if(actionBusy){
  if(t.dataset.nav||t.dataset.open||t.dataset.zone||t.hasAttribute('data-look-grove')||t.hasAttribute('data-show-farm')){navigateButton(t);return;}
  if(runningFarm&&t.dataset.quick){const next=t.dataset.quick as Action;afterCurrentFarm(()=>void action(next));return;}
  if(runningFarm&&t.dataset.action){const next=t.dataset.action as Action,plot=t.dataset.plot!==undefined?Number(t.dataset.plot):undefined;if(['plant','water','harvest','fertilize'].includes(next))startFarmMode(next as FarmAction,plot);else afterCurrentFarm(()=>void action(next,plot));return;}
  if(t.hasAttribute('data-close')){closeModal();return;}
  e.preventDefault();toast('하던 작업을 마치면 다시 움직일 수 있어요.');return;
 }
 if(t.matches('a[href="#"]')){e.preventDefault();closeModal();}
 if(navigateButton(t))return;
 if(t.dataset.stage){selectedStage=Number(t.dataset.stage);openModal('hunt');}
 if(t.dataset.teamToggle&&isUnitId(t.dataset.teamToggle)){
  const id=t.dataset.teamToggle,team=getSelectedTeam(state),next=team.includes(id)?team.filter(unit=>unit!==id):[...team,id];
  const result=setCompanionTeam(state,next);if(result.ok){const scroll=document.querySelector<HTMLElement>('#modal-root .modal')?.scrollTop??0;state=result.state;persist();render();openModal(currentModal==='hunt'?'hunt':'pet-team');document.querySelector<HTMLElement>('#modal-root .modal')!.scrollTop=scroll;}toast(result.message);return;
 }
 if(t.hasAttribute('data-start-hunt'))startBattle();
 if(t.hasAttribute('data-close'))closeModal();

 if(t.dataset.plotStep){const index=state.plots.findIndex(p=>p.id===selectedPlotId);const next=(index+Number(t.dataset.plotStep)+state.plots.length)%state.plots.length;setZone('home',true);selectPlot(state.plots[next]?.id??null);}
 if(t.dataset.quick){const a=t.dataset.quick as Action;const farm=['water','harvest'].includes(a);const plot=farm?quickPlot(a as FarmAction):undefined;if(farm&&plot){selectedPlotId=plot.id;scene.setSelectedPlot(plot.id);}void action(a,plot?.id);}
 if(t.dataset.action)void action(t.dataset.action as Action,t.dataset.plot!==undefined?Number(t.dataset.plot):undefined);
 if(t.dataset.gender){selectedGender=t.dataset.gender as Gender;document.querySelectorAll('[data-gender]').forEach(el=>el.classList.toggle('selected',el===t));}
 if(t.hasAttribute('data-start')){const name=(document.querySelector<HTMLInputElement>('#player-name')?.value??'').trim();if(!name){toast('함께할 생존자의 이름을 알려 주세요.');return;}state={...state,gender:selectedGender,name:name.slice(0,16)};playerConfirmed=true;persist();closeModal();render();toast(`${state.name}, 우리집에 온 걸 환영해요!`);}
 if(t.hasAttribute('data-sound')){sound=!sound;document.querySelector('.sound-toggle')!.innerHTML=icon(sound?'volume':'mute');document.querySelector('.sound-toggle')!.setAttribute('aria-label',sound?'소리 끄기':'소리 켜기');if(sound)ping();if(currentModal==='settings')renderSettings();}
 if(t.hasAttribute('data-pause')){paused=!paused;document.querySelector('.time-button')!.innerHTML=icon(paused?'play':'pause');document.querySelector('.time-button')!.setAttribute('aria-label',paused?'시간 계속':'시간 일시정지');if(currentModal==='settings')renderSettings();}
 if(t.hasAttribute('data-save'))toast(persist()?'소중한 하루를 저장했어요.':'저장하지 못했어요. 기기 저장 공간을 확인해 주세요.');
 if(t.hasAttribute('data-reset')){stopFarmMode();seedChosen=false;selectedCropId='carrot';try{localStorage.removeItem(selectedSeedStorageKey);}catch{}state=createGame(state.gender,'하루');selectedPlotId=state.plots[0]?.id??null;scene.resetPosition();setZone('home');persist();render();openModal('welcome');}
 if(t.hasAttribute('data-update'))void runUpdate(true);
 if(t.hasAttribute('data-download')&&lastUpdate?.release)void downloadUpdate(lastUpdate.release).catch(()=>toast('다운로드를 열지 못했어요. 잠시 후 다시 시도해 주세요.'));
});
const modalRoot=document.querySelector<HTMLElement>('#modal-root')!;
// A canvas touch can open a dialog before its compatibility click arrives.
// Only a gesture that both starts and ends on the backdrop may dismiss it.
modalRoot.addEventListener('pointerdown',e=>{modalBackdropPointer=e.target===modalRoot?e.pointerId:null;modalBackdropClickPointer=null;});
modalRoot.addEventListener('pointerup',e=>{modalBackdropClickPointer=modalBackdropPointer===e.pointerId&&e.target===modalRoot?e.pointerId:null;modalBackdropPointer=null;});
modalRoot.addEventListener('pointercancel',()=>{modalBackdropPointer=null;modalBackdropClickPointer=null;});
modalRoot.addEventListener('click',e=>{const backdropGesture=modalBackdropClickPointer!==null&&(!(e instanceof PointerEvent)||e.pointerId===modalBackdropClickPointer);modalBackdropClickPointer=null;if(!startupPending&&e.target===modalRoot&&backdropGesture)closeModal();});
document.addEventListener('keydown',e=>{if(startupPending||orientationBlocked||battleView||contentActivationPending)return;if(e.key==='Escape'){if(animalContextId){closeAnimalContext();return;}if(gatheringTrayOpen){setGatheringTray(false);document.querySelector<HTMLButtonElement>('[data-gather-toggle]')!.focus();return;}if(currentModal)closeModal();else if(placement)cancelConstruction();else if(selectedFacilityId!==null)closeFacility();else if(farmTrayOpen||farmMode){dismissFarmTray();}}if(actionBusy&&e.key!=='Tab')return;if(e.key==='Tab'&&currentModal){const els=Array.from(document.querySelectorAll<HTMLElement>('#modal-root button:not([disabled]), #modal-root input'));const first=els[0],last=els.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}});
let saveCounter=0;
setInterval(()=>{
 if(!startupPending&&!contentActivationPending&&playerConfirmed){
  const before=state.energy;state=recoverEnergy(state);
  if(state.energy!==before){persist();render();}else{renderVitals();updateEnergyPanel();if(paused)renderControls();}
  if(currentModal==='roadside'||currentModal==='outdoor-site'||currentModal==='ground-region')renderLiveRoadside();
 }
 if(startupPending||orientationBlocked||paused||document.hidden||battleView||contentActivationPending||currentModal==='welcome')return;
 state=tick(state,1);render();if(++saveCounter>=10){persist();saveCounter=0;}
},1000);
document.addEventListener('visibilitychange',()=>{if(contentActivationPending)return;if(document.hidden){farmQueue=[];afterFarm=null;renderControls();persist();}else if(!startupPending){state=paused?recoverEnergy({...state,lastSaved:Date.now()}):applyOfflineProgress(state).state;render();persist();void initializeUpdateSystem().then(()=>{if(isNativeUpdateSupported())return runUpdate();});}});
setInterval(maybeApplyContentUpdate,500);
window.addEventListener('pagehide',()=>{if(!contentActivationPending)persist();});
window.addEventListener('gameorientationchange',event=>{
 orientationBlocked=(event as CustomEvent<GameOrientationState>).detail.blocked;
 app.inert=orientationBlocked||startupPending||contentActivationPending||Boolean(battleView);
 scene.setSuspended(orientationBlocked||startupPending||contentActivationPending||Boolean(battleView));
 battleView?.setOrientationBlocked(orientationBlocked);
 updateWalkingAvailability();
});
window.addEventListener('gameorientationupdate',()=>{
 if(startupPending||contentActivationPending)return;
 openModal('settings');
 void initializeUpdateSystem().then(()=>runUpdate()).then(()=>{
  if(lastUpdate?.status!=='available')toast('가로 고정 앱 기능 업데이트는 준비 중이에요. 브라우저에서는 기기를 가로로 돌려 플레이할 수 있어요.');
 });
});
gameOrientation=initializeGameOrientation();
orientationBlocked=gameOrientation.blocked;
app.inert=orientationBlocked||startupPending||contentActivationPending||Boolean(battleView);
scene.setSuspended(orientationBlocked||startupPending||contentActivationPending||Boolean(battleView));
render();
async function startGame(){
 let loadedAbsenceConsumed=false,offlineSeconds=0;
 const consumeLoadedAbsence=()=>{
  if(!stored||loadedAbsenceConsumed)return;
  const offline=applyOfflineProgress(state);state=offline.state;offlineSeconds=offline.secondsApplied;loadedAbsenceConsumed=true;
 };
 const boot=await runStartupPatch({onState:onLiveUpdate,beforeApply:()=>{consumeLoadedAbsence();return !stored||persist();},onPendingChange:pending=>{
  startupPending=pending;app.inert=pending||orientationBlocked||contentActivationPending||Boolean(battleView);scene.setSuspended(pending||orientationBlocked||contentActivationPending||Boolean(battleView));updateWalkingAvailability();
 }});
 if(boot==='applying')return;
 if(boot==='storage-error')toast('저장 공간을 확인한 뒤 게임 업데이트를 다시 적용해 주세요.');
 else if(boot==='activation-error')toast('현재 버전으로 시작해요. 다음 실행 때 업데이트를 다시 확인해요.');
 if(stored){consumeLoadedAbsence();render();persist();if(offlineSeconds)toast('돌아왔군요! 자리를 비운 동안 작물과 시설 생산이 자랐어요.');}
 else openModal('welcome');
 if(recoveredExpedition){persist();toast('이전 원정에서 안전하게 귀환했어요. 트럭에서 다시 출발할 수 있어요.');}
 if(!isNativeUpdateSupported())void acknowledgeLiveUpdate();
 void initializeUpdateSystem();
}
void startGame();
