import '@fontsource-variable/dm-sans';
import './style.css';
import './gameplay.css';
import { createGame, performAction, tick, saveGame, loadGame, expansionCost, questList, getCropProgress, resourceLabels, MAX_DECK_LEVEL, beginHunt, finishHunt, cancelHunt, type Action, type Gender, type Resource } from './game';
import { Scene } from './scene';
import { BattleView } from './battle-view';
import { STAGE_NAMES, type BattleResult } from './battle';
import { icon, portrait } from './icons';
import { APP_VERSION, checkUpdate, downloadUpdate, type UpdateResult } from './update';

const stored = loadGame();
let state = stored ?? createGame('female', '하루');
const recoveredExpedition = Boolean(state.expedition);
if (recoveredExpedition) state = cancelHunt(state).state;
let actionBusy = false;
let battleView: BattleView | null = null;
let selectedStage = 1;
let selectedZone: 'home'|'grove' = 'home';
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
const navItems=[['home','우리집','home'],['map','탐험','map'],['bag','배낭','bag'],['book','여행 일지','journal']];
app.innerHTML=`
 <aside class="sidebar"><a class="brand-mark" href="#" aria-label="로드헤이븐 우리집">${icon('truck')}</a><div class="sidebar-line"></div><nav>${navItems.map(([i,t,id])=>`<button class="nav-button ${id==='home'?'active':''}" data-nav="${id}" aria-label="${t}">${icon(i)}<span>${t}</span></button>`).join('')}</nav><div class="sidebar-bottom"><span class="online-dot"></span><button class="nav-button" data-open="settings" aria-label="설정">${icon('settings')}<span>설정</span></button></div></aside>
 <div class="shell">
  <header class="topbar"><a href="#" class="wordmark"><span>로드<span class="wordmark-accent">헤이븐</span><i></i></span><small>TRUCK LIFE, LITTLE JOYS</small></a><div class="topbar-divider"></div><div class="world-location">${icon('pin')}<div><small>대한민국, 2187년</small><strong>서울 외곽 순환도로</strong></div></div><div class="topbar-right"><span class="save-status" id="save-status">${icon('check')} 여행이 저장되었어요</span><button class="round-button sound-toggle" data-sound aria-label="소리 켜기">${icon('mute')}</button><button class="profile-button" data-open="character" aria-label="캐릭터 변경" id="profile"></button></div></header>
  <main>
   <section class="greeting"><div><div class="eyebrow"><span></span> OUR LITTLE HOME ON WHEELS</div><h1>세상은 변해도,<br class="mobile-break"> 우리의 일상은 계속돼요<span>.</span></h1><p>직접 가꾸는 텃밭, 숲길 채집, 보리와 함께하는 모험.</p></div><button class="day-badge" data-open="journal">${icon('sun')}<div><small>함께 살아온 시간</small><strong>DAY <span id="day">01</span></strong></div></button></section>
   <section class="resource-bar" aria-label="보유 자원" id="resources"></section>
   <div class="game-grid"><section class="scene-card" aria-label="트럭 위 우리집 게임 화면">
    <div class="scene-top"><div class="scene-label"><span class="live-dot"></span>우리집 <span class="label-divider">/</span> <span id="truck-level">작은 시작 · Lv.1</span></div><button class="scene-icon" data-open="guide" aria-label="게임 도움말">?</button></div>
    <canvas id="world" aria-label="농장과 집이 있는 거대한 트럭, 캐릭터와 반려견 보리. 아래 활동 버튼으로 플레이하세요."></canvas>
    <div class="scene-weather"><span id="weather-icon">${icon('sun')}</span><div><strong id="clock">08:00</strong><small id="weather-text">기분 좋은 아침</small></div><button data-pause class="time-button" aria-label="시간 일시정지">${icon('pause')}</button></div>
    <div class="scene-zones"><button class="active" data-zone="home" aria-label="트럭 우리집 보기">${icon('truck')} 우리집</button><button data-zone="grove" aria-label="숲길 벌목장 보기">${icon('leaf')} 벌목장</button><button data-open="farm">${icon('seeds')} 텃밭</button></div><div class="chore-status" hidden role="status" aria-live="polite"></div><div class="scene-hint">${icon('sparkle')} <span>텃밭과 숲길을 오가며 작은 일상을 가꿔요</span></div>
    <button class="scene-expand" data-open="expand">${icon('expand')}<span>공간 넓히기</span>${icon('plus')}</button>
   </section>
   <aside class="right-panel">
    <section class="resident-card"><div class="section-label">오늘의 생존자 <span>MY SURVIVOR</span></div><div class="resident-heading"><button class="resident-portrait" data-open="character" id="resident-portrait"></button><div><h2 id="resident-name"></h2><p><span class="tiny-dot"></span><span id="resident-mood">평화로운 하루를 보내는 중</span></p></div><span class="level-chip" id="player-level">Lv.1</span></div><div class="vitals" id="vitals"></div><button class="rest-link" data-action="rest">${icon('bed')} 잠깐 쉬어 가기 ${icon('arrow')}</button></section>
    <section class="quest-card"><div class="section-label">작은 목표, 큰 하루 <button data-open="quests" aria-label="모든 목표 보기">${icon('arrow')}</button></div><div id="quest-preview"></div></section>
    <button class="pet-card" data-open="pet"><div class="pet-art"><svg viewBox="0 0 80 80" aria-hidden="true"><path d="m16 32 3-21 18 15m28 6-3-21-17 15" fill="#c98952"/><path d="m20 26 2-11 10 12m27-1-2-11-10 12" fill="#f3c3a2"/><ellipse cx="40" cy="46" rx="28" ry="24" fill="#daa36a"/><path d="M15 47q25 8 50 0c-3 29-46 29-50 0" fill="#fff2d9"/><ellipse cx="28" cy="40" rx="3" ry="4" fill="#384839"/><ellipse cx="52" cy="40" rx="3" ry="4" fill="#384839"/><path d="m35 49 5 6 5-6Z" fill="#384839"/><path d="M32 57q8 8 16 0" fill="none" stroke="#384839" stroke-width="2"/><path d="M22 66q18 9 36 0" fill="none" stroke="#719b8c" stroke-width="6"/><circle cx="40" cy="72" r="5" fill="#e3b653"/></svg></div><div><span class="pet-eyebrow">우리집 작은 동료</span><h3>보리 ${icon('heart')}</h3><p>함께라서 더 좋은 오늘</p></div>${icon('chevron','pet-arrow')}</button>
   </aside></div>
   <section class="activities"><div class="activities-heading"><h2>오늘은 무엇을 할까요?</h2><span>작은 행동이 우리집을 키워요</span></div><div class="action-grid">
    ${[['farm','leaf','농장 가꾸기','싱싱한 하루의 시작'],['grove','wood','숲길 채집','나무를 직접 베러 가요'],['hunt','hunt','사냥 나가기','보리와 함께하는 전투'],['expand','hammer','트럭 확장','조금 더 넓은 우리집'],['bag','bag','배낭 열기','차곡차곡 모은 보물들'],['rest','bed','휴식하기','내일을 위한 작은 쉼']].map(([a,i,t,d],n)=>`<button class="action-card action-${a}" ${a==='rest'?`data-action="${a}"`:`data-open="${a}"`}><span class="action-icon">${icon(i)}</span><span><strong>${t}</strong><small>${d}</small></span>${icon('chevron','action-arrow')}<span class="shortcut">0${n+1}</span></button>`).join('')}
   </div></section>
   <footer class="footer"><span>${icon('leaf')} 무너진 세상 속, 우리가 만드는 작은 낙원</span><span>ROAD HAVEN <i>•</i> v${APP_VERSION}</span></footer>
  </main>
 </div>
 <div class="toast" id="toast" role="status" aria-live="polite"></div>
 <div class="modal-backdrop" id="modal-root" hidden></div>
`;
const scene=new Scene(document.querySelector('#world')!,kind=>{
 if(actionBusy||battleView)return;
 if(kind==='farm')openModal('farm');
 if(kind==='truck')openModal('expand');
 if(kind==='pet')openModal('pet');
 if(kind==='character')openModal('character');
 if(kind==='grove')openModal('grove');
});
function setZone(zone:'home'|'grove') {
 selectedZone=zone;scene.setZone(zone);
 document.querySelectorAll('[data-zone]').forEach(el=>el.classList.toggle('active',el.getAttribute('data-zone')===zone));
 const label=document.querySelector('.scene-label')!;
 label.innerHTML=`<span class="live-dot"></span>${zone==='grove'?'숲길 벌목장':'우리집'} <span class="label-divider">/</span> <span id="truck-level">${zone==='grove'?'나무를 눌러 채집해요':`함께 자라는 공간 · Lv.${state.deckLevel}`}</span>`;
}

const resources:Resource[]=['wood','scrap','food','water','seeds'];
function render(){
 scene.setState(state);
 document.querySelector('#resources')!.innerHTML=resources.map(r=>`<button class="resource" data-open="bag" aria-label="${resourceLabels[r]} ${state.resources[r]}개"><span class="resource-icon ${r}">${icon(r)}</span><span class="resource-name">${resourceLabels[r]}</span><strong>${state.resources[r]}</strong><span class="resource-unit">${r==='water'?'L':'개'}</span></button>`).join('')+`<div class="supply-status">${icon('shield')} <span>안전한 우리집</span></div>`;
 document.querySelector('#day')!.textContent=String(state.day).padStart(2,'0');
 document.querySelector('#clock')!.textContent=`${String(Math.floor(state.minutes/60)).padStart(2,'0')}:${String(Math.floor(state.minutes%60)).padStart(2,'0')}`;
 const hour=state.minutes/60;
 document.querySelector('#weather-text')!.textContent=hour<6||hour>=20?'별이 머무는 밤':hour<12?'기분 좋은 아침':hour<17?'햇살 가득한 오후':'노을이 물드는 저녁';
 document.querySelector('#weather-icon')!.innerHTML=icon(hour<6||hour>=20?'moon':'sun');
 document.querySelector('#truck-level')!.textContent=selectedZone==='grove'?'나무를 눌러 채집해요':`${['작은 시작','아늑한 보금자리','자라는 우리집','도로 위 작은 마을'][Math.min(state.deckLevel-1,3)]} · Lv.${state.deckLevel}`;
 document.querySelector('#profile')!.innerHTML=portrait(state.gender);
 document.querySelector('#resident-portrait')!.innerHTML=portrait(state.gender);
 document.querySelector('#resident-name')!.textContent=state.name;
 document.querySelector('#player-level')!.textContent=`Lv.${state.level}`;
 document.querySelector('#resident-mood')!.textContent=state.energy<25?'조금 쉬어 가고 싶어요':state.morale>70?'이만하면 행복한 하루':'천천히 나아가는 중';
 document.querySelector('#vitals')!.innerHTML=[['heart','건강',state.health,'health'],['bolt','기력',state.energy,'energy']].map(([i,t,n,c])=>`<div class="vital"><span>${icon(String(i))}${t}</span><div class="meter"><div class="${c}" style="width:${n}%"></div></div><strong>${Math.round(Number(n))}<small>/100</small></strong></div>`).join('');
 const quests=questList(state);const q=quests.find(q=>!q.complete)??quests[quests.length-1];
 document.querySelector('#quest-preview')!.innerHTML=`<div class="quest-icon">${icon(q.complete?'check':'seeds')}</div><h3>${escape(q.title)}</h3><p>${escape(q.description)}</p><div class="quest-progress"><span style="width:${Math.min(100,q.current/q.target*100)}%"></span></div><div class="quest-bottom"><span>${q.complete?'목표 달성!':`${q.current} / ${q.target}`}</span><span>${icon('sparkle')} ${escape(q.reward)}</span></div>`;
 if(currentModal==='farm')renderFarm();
 if(currentModal==='bag')renderBag();
}
function persist(){const ok=saveGame(state);document.querySelector('#save-status')!.innerHTML=icon(ok?'check':'shield')+(ok?'여행이 저장되었어요':'저장 공간을 확인해 주세요');return ok;}
function toast(message:string){const el=document.querySelector<HTMLElement>('#toast')!;el.textContent=message;el.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),3500);}
function ping(){if(!sound)return;try{audioContext??=new AudioContext();void audioContext.resume();const osc=audioContext.createOscillator(),gain=audioContext.createGain();osc.type='sine';osc.frequency.setValueAtTime(580,audioContext.currentTime);osc.frequency.exponentialRampToValueAtTime(850,audioContext.currentTime+.08);gain.gain.setValueAtTime(.05,audioContext.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audioContext.currentTime+.22);osc.connect(gain);gain.connect(audioContext.destination);osc.start();osc.stop(audioContext.currentTime+.22);}catch{}}
type ChoreAction = 'plant'|'water'|'harvest'|'chop'|'expand'|'gather';
const animatedActions:Action[]=['plant','water','harvest','chop','expand','gather'];
const choreLabels:Record<ChoreAction,string>={plant:'텃밭으로 가서 씨앗을 뿌리고 있어요',water:'물뿌리개로 텃밭을 돌보고 있어요',harvest:'잘 자란 당근을 바구니에 담고 있어요',chop:'숲길에서 나무를 베어 목재를 모으고 있어요',expand:'새 판자를 놓아 우리집을 넓히고 있어요',gather:'트럭 주변에서 쓸 만한 물자를 찾고 있어요'};
async function action(a:Action,plotId?:number){
 if(actionBusy||battleView){toast('지금 하던 일을 마치고 함께해요.');return;}
 if(a==='hunt'){openModal('hunt');return;}
 const before=performAction(state,a,plotId);
 if(!before.ok){toast(before.message);return;}
 if(animatedActions.includes(a)){
  actionBusy=true;app.setAttribute('aria-busy','true');
  closeModal();
  setZone(a==='chop'?'grove':'home');
  const status=document.querySelector<HTMLElement>('.chore-status')!;
  status.innerHTML=`<span class="chore-pulse">${icon(a==='chop'?'wood':a==='expand'?'hammer':'seeds')}</span><div><strong>${escape(state.name)}의 작은 일상</strong><span>${choreLabels[a as ChoreAction]}</span><div class="chore-track"><i></i></div></div>`;
  status.hidden=false;
  document.querySelector('.scene-card')!.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'center'});
  try { await scene.playAction(a as ChoreAction,plotId); }
  catch {toast('작업을 마치지 못했어요. 다시 시도해 주세요.');status.hidden=true;actionBusy=false;app.removeAttribute('aria-busy');return;}
  actionBusy=false;status.hidden=true;app.removeAttribute('aria-busy');
 }
 const result=performAction(state,a,plotId);
 state=result.state;if(animatedActions.includes(a))setZone(a==='chop'?'grove':'home');toast(result.message);
 if(result.ok){ping();persist();scene.focus(a==='pet'?'pet':a==='expand'?'truck':a==='chop'?'grove':a==='plant'||a==='water'||a==='harvest'?'farm':'character');}
 render();
 if(currentModal==='quests')openModal('quests');
 if(currentModal==='pet')openModal('pet');
}
function startBattle(){
 if(actionBusy||battleView)return;
 const started=beginHunt(state,selectedStage);
 if(!started.ok){toast(started.message);return;}
 state=started.state;const expeditionId=state.expedition!.id;persist();
 closeModal();scene.setSuspended(true);app.inert=true;document.body.classList.add('in-battle');
 try {
  battleView=new BattleView({gender:state.gender,name:state.name,level:state.level,health:state.health,stage:selectedStage,onFinish:(result:BattleResult)=>{
   const finished=finishHunt(state,result,expeditionId);state=finished.state;
   if(!finished.ok&&state.expedition?.id===expeditionId)state=cancelHunt(state).state;
   battleView?.destroy();battleView=null;app.inert=false;document.body.classList.remove('in-battle');scene.setSuspended(false);setZone('home');persist();render();toast(finished.message);
   document.querySelector('.scene-card')!.scrollIntoView({block:'center'});
  }});
 }catch{
  state=cancelHunt(state).state;battleView?.destroy();battleView=null;app.inert=false;document.body.classList.remove('in-battle');scene.setSuspended(false);persist();render();toast('전투 화면을 열지 못해 트럭으로 돌아왔어요.');
 }
}
function modalShell(eyebrow:string,title:string,body:string,wide=false){const root=document.querySelector<HTMLElement>('#modal-root')!;root.hidden=false;root.innerHTML=`<section class="modal ${wide?'modal-wide':''}" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button class="modal-close round-button" data-close aria-label="닫기">${icon('close')}</button><div class="eyebrow">${eyebrow}</div><h2 id="modal-title">${title}</h2>${body}</section>`;requestAnimationFrame(()=>root.querySelector<HTMLButtonElement>('button')?.focus());}
function closeModal(){document.querySelector<HTMLElement>('#modal-root')!.hidden=true;currentModal='';document.querySelectorAll('[data-nav]').forEach(el=>el.classList.toggle('active',el.getAttribute('data-nav')==='home'));}
function farmContent(){return `<p class="modal-description">작업을 고르면 캐릭터가 밭으로 직접 걸어가요.<br>씨앗을 뿌리고, 물을 주고, 자라난 당근을 수확해 보세요.</p><div class="farm-grid">${state.plots.map((p,i)=>{const progress=getCropProgress(state,p);const planted=p.plantedAt!==null;return `<article class="plot-card"><div class="plot-illustration ${!planted?'empty':''}">${icon(planted?(progress>=1?'food':'seeds'):'plus')}</div><h3>${i+1}번 텃밭</h3><span class="plot-state">${!planted?'새로운 씨앗을 기다려요':progress>=1?'수확할 준비가 됐어요!':p.watered?'쑥쑥 자라는 중':'목이 말라요. 물을 주세요'}</span><div class="quest-progress"><span style="width:${progress*100}%"></span></div><button class="button ${planted&&progress<1?'button-light':''}" data-action="${!planted?'plant':progress>=1?'harvest':'water'}" data-plot="${p.id}" ${planted&&p.watered&&progress<1?'disabled':''}>${icon(!planted?'seeds':progress>=1?'leaf':'water')}${!planted?'씨앗 심기':progress>=1?'수확하기':p.watered?'잘 자라고 있어요':'물 주기'}</button></article>`;}).join('')}</div><div class="info-note">${icon('clock')} 게임 시간에 따라 자라요. 앱을 닫으면 시간도 쉬어 갑니다.</div>`;}
function renderFarm(){const body=document.querySelector('#farm-content');if(body){const focus=document.activeElement as HTMLElement;const key=focus?.dataset.action,plot=focus?.dataset.plot;body.innerHTML=farmContent();if(key&&plot)body.querySelector<HTMLButtonElement>(`[data-action="${key}"][data-plot="${plot}"]`)?.focus();}}
function bagContent(){return `<p class="modal-description">도로에서 모은 것들이 우리의 내일을 만들어요.</p><div class="inventory-grid">${resources.map(r=>`<div class="inventory-item"><span class="resource-icon ${r}">${icon(r)}</span><strong>${resourceLabels[r]}</strong><b>${state.resources[r]}<small>${r==='water'?' L':' 개'}</small></b><p>${({wood:'트럭을 넓힐 때 써요',scrap:'튼튼한 집의 재료예요',food:'휴식과 여행의 힘이 돼요',water:'텃밭에 생기를 더해요',seeds:'새로운 먹거리를 심어요'})[r]}</p></div>`).join('')}</div><button class="button full-width" data-action="gather">${icon('wood')} 주변에서 자원 찾기</button>`;}
function renderBag(){const body=document.querySelector('#bag-content');if(body){const focused=body.contains(document.activeElement);body.innerHTML=bagContent();if(focused)body.querySelector<HTMLButtonElement>('[data-action]')?.focus();}}
function openModal(kind:string){if(actionBusy||battleView)return;currentModal=kind;
 if(kind==='farm')modalShell('LITTLE GARDEN','트럭 위 작은 텃밭',`<div id="farm-content">${farmContent()}</div>`,true);
 if(kind==='bag')modalShell('THINGS WE FOUND','우리의 배낭',`<div id="bag-content">${bagContent()}</div>`,true);
 if(kind==='expand'){const cost=expansionCost(state);modalShell('A LITTLE MORE ROOM','우리집을 넓혀 볼까요?',`<div class="expansion-art">${icon('truck')}<span>Lv.${state.deckLevel}</span>${icon('arrow')}<span>${state.deckLevel>=MAX_DECK_LEVEL?'MAX':`Lv.${state.deckLevel+1}`}</span></div><p class="modal-description">옆으로 펼쳐지는 새 데크와 넓어진 통로를 직접 확인해 보세요.<br>확장할 때마다 울타리와 새 텃밭도 함께 늘어나요.</p><div class="cost-row"><span class="${state.resources.wood>=cost.wood?'':'insufficient'}">${icon('wood')} 목재 <strong>${state.resources.wood} / ${cost.wood}</strong></span><span class="${state.resources.scrap>=cost.scrap?'':'insufficient'}">${icon('scrap')} 고철 <strong>${state.resources.scrap} / ${cost.scrap}</strong></span></div><button class="button full-width" data-action="expand" ${state.deckLevel>=MAX_DECK_LEVEL?'disabled':''}>${icon('hammer')} ${state.deckLevel>=MAX_DECK_LEVEL?'최대 크기의 우리집이에요':'데크 확장하기'}</button><button class="text-button full-width" data-action="repair">${icon('shield')} 트럭 수리 · 현재 내구도 ${state.truckHealth}%</button>`);}
 if(kind==='grove'){
  modalShell('THE LITTLE WOODLAND','도로 옆, 우리의 벌목장',`<div class="grove-illustration"><span class="grove-tree tree-a">${icon('leaf')}</span><span class="grove-tree tree-b">${icon('leaf')}</span><span class="grove-tree tree-c">${icon('leaf')}</span><span class="grove-path"></span><span class="grove-sign">서울 숲길 · 채집 구역</span></div><p class="modal-description">트럭 옆 숲길로 내려가 나무를 직접 베어요.<br>도끼질이 끝나면 쓰러진 나무에서 목재를 모아 돌아옵니다.</p><div class="grove-rewards"><span>${icon('wood')} 목재 <b>+18</b></span><span>${icon('seeds')} 씨앗 <b>+1</b></span><span>${icon('bolt')} 기력 <b>−10</b></span></div><button class="button full-width" data-action="chop">${icon('wood')} 나무 베러 가기</button><button class="button button-light full-width grove-look" data-look-grove>${icon('map')} 벌목장 둘러보기</button><div class="grove-salvage"><span>고철과 물이 필요하다면</span><button class="text-button" data-action="gather">버려진 휴게소 탐색 ${icon('arrow')}</button></div>`);
 }
 if(kind==='hunt'){
  const stages=[{id:1,title:STAGE_NAMES[0],desc:'숲에 숨어든 좀비 무리',tag:'추천 Lv.1',style:'forest'},{id:2,title:STAGE_NAMES[1],desc:'바리케이드 너머의 감염자',tag:'추천 Lv.2',style:'toll'},{id:3,title:STAGE_NAMES[2],desc:'거대한 경비병이 지키는 보급품',tag:'추천 Lv.3',style:'ruins'}];
  modalShell('ADVENTURE WITH BORI','보리와 함께, 사냥 출발',`<p class="modal-description">세 번의 웨이브를 지나 보스를 물리치세요.<br>일반 공격은 자동, 강한 일격과 보리의 돌진·회복은 직접 사용할 수 있어요.</p><div class="stage-list">${stages.map(st=>`<button class="stage-card ${st.style} ${selectedStage===st.id?'selected':''}" data-stage="${st.id}" aria-pressed="${selectedStage===st.id}"><span class="stage-number">01<span>— ${String(st.id).padStart(2,'0')}</span></span><span class="stage-card-body"><small>${st.tag} · 3 WAVES</small><strong>${st.title}</strong><span>${st.desc}</span></span><span class="stage-check">${icon(selectedStage===st.id?'check':'chevron')}</span></button>`).join('')}</div><div class="party-preview">${portrait(state.gender)}<span><strong>${escape(state.name)} & 보리</strong><small>체력 ${Math.round(state.health)} · 기력 ${Math.round(state.energy)}</small></span><b>Lv.${state.level}</b></div><div class="battle-reward-preview">${icon('food')} 승리 보상: 식량 ${6+selectedStage*2} · 고철 ${selectedStage*2} · 목재 2</div><button class="button full-width" data-start-hunt ${state.energy<16||state.health<15?'disabled':''}>${icon('hunt')} 전투 스테이지 입장 <span class="button-cost">기력 16</span></button>${state.energy<16||state.health<15?'<p class="fine-print">건강 15와 기력 16이 필요해요. 먼저 휴식해 주세요.</p>':''}<p class="fine-print">전투 중 앱을 종료하면 보상 없이 귀환해요 · 승리 후 보상 지급</p>`,true);
 }
 if(kind==='quests'){modalShell('ONE STEP AT A TIME','작은 목표, 큰 하루',`<p class="modal-description">서두르지 않아도 괜찮아요. 하나씩 해 나가요.</p><div class="quest-list">${questList(state).map(q=>`<article class="quest-row ${q.complete?'completed':''}"><span class="quest-row-icon">${icon(q.complete?'check':'flag')}</span><div><h3>${escape(q.title)}</h3><p>${escape(q.description)}</p><small>${escape(q.reward)} · 달성 시 자동 지급</small><div class="quest-progress"><span style="width:${Math.min(100,q.current/q.target*100)}%"></span></div></div><b>${q.current}/${q.target}</b></article>`).join('')}</div>`);}
 if(kind==='pet'){modalShell('YOUR VERY BEST FRIEND','보리와 쉬어 가기',`<div class="pet-modal-art">${document.querySelector('.pet-art')!.innerHTML}<span>${icon('heart')}</span></div><p class="pet-dialogue">“멍! 오늘도 네 옆에 있을게.”</p><p class="modal-description">보리는 우리집을 자유롭게 뛰어다녀요.<br>쓰다듬으며 마음의 여유를 찾아보세요.</p><div class="bond-meter"><span>우리의 행복</span><strong>${Math.round(state.morale)} / 100</strong><div class="quest-progress"><span style="width:${state.morale}%"></span></div></div><button class="button full-width" data-action="pet">${icon('paw')} 보리 쓰다듬기</button>`);}
 if(kind==='character'||kind==='welcome'){selectedGender=state.gender;modalShell(kind==='welcome'?'YOUR STORY STARTS HERE':'MEET YOUR SURVIVOR',kind==='welcome'?'우리의 첫 번째 아침':'오늘의 나를 만나기',`<p class="modal-description">2187년, 좀비로 가득한 대한민국.<br>커다란 트럭 위에서 당신만의 작은 일상을 시작하세요.</p><div class="character-choices"><button data-gender="female" class="character-choice ${selectedGender==='female'?'selected':''}">${portrait('female')}<strong>여자 생존자</strong><span>다정하고 씩씩한 모험가</span></button><button data-gender="male" class="character-choice ${selectedGender==='male'?'selected':''}">${portrait('male')}<strong>남자 생존자</strong><span>따뜻하고 든든한 모험가</span></button></div><label class="name-label" for="player-name">어떤 이름으로 불러 드릴까요?</label><input class="name-input" id="player-name" maxlength="16" value="${escape(state.name)}" placeholder="생존자의 이름" autocomplete="off"><button class="button full-width" data-start>${icon('sun')} ${kind==='welcome'?'우리집에서 시작하기':'변경 저장하기'}</button><p class="fine-print">캐릭터는 언제든 변경할 수 있어요 · 기기에 자동 저장</p>`);}
 if(kind==='map'){modalShell('BEYOND OUR LITTLE HOME','도로 너머로 한 걸음',`<p class="modal-description">서울 외곽 순환도로 · 현재 주둔지<br>트럭을 중심으로 주변을 탐색해 생활에 필요한 자원을 구해요.</p><div class="explore-map"><span class="map-road"></span><span class="map-home">${icon('truck')} 우리집</span><span class="map-tree t1">${icon('leaf')}</span><span class="map-tree t2">${icon('leaf')}</span><span class="map-stop s1">${icon('wood')}</span><span class="map-stop s2">${icon('hunt')}</span><span class="map-caption">SEOUL OUTER RING ROAD</span></div><div class="exploration-list"><button data-action="gather"><span class="resource-icon wood">${icon('wood')}</span><span><strong>버려진 휴게소</strong><small>목재 · 고철 · 생활 물자 수집</small></span>${icon('arrow')}</button><button data-open="grove"><span class="resource-icon wood">${icon('wood')}</span><span><strong>도로 옆 벌목장</strong><small>직접 나무 베기 · 목재 +18</small></span>${icon('arrow')}</button><button data-open="hunt"><span class="resource-icon food">${icon('hunt')}</span><span><strong>좀비가 숨어든 사냥터</strong><small>전투 스테이지 3곳 · 승리 보상</small></span>${icon('arrow')}</button></div><div class="info-note">${icon('shield')} 바깥에는 좀비가 있어요. 건강과 기력을 챙겨 주세요.</div>`,true);}
 if(kind==='journal'){modalShell('POSTCARDS FROM THE ROAD','우리의 여행 일지',`<div class="journal-day">DAY ${String(state.day).padStart(2,'0')}<span>도로 위에서 함께한 날들</span></div><div class="journal-stats"><div><b>${state.stats.harvests}</b><span>번의 수확</span></div><div><b>${state.stats.chops}</b><span>번의 벌목</span></div><div><b>${state.stats.battlesWon}</b><span>번의 전투 승리</span></div></div><div class="journal-entries">${state.log.slice(0,12).map(l=>`<div>${icon('leaf')}<p>${escape(l)}</p></div>`).join('')||'<p>작은 행동으로 첫 번째 이야기를 써 보세요.</p>'}</div>`);}
 if(kind==='settings')renderSettings();
 if(kind==='guide'){modalShell('WELCOME TO ROAD HAVEN','천천히, 함께 살아가기',`<div class="guide-list">${[['seeds','심고, 돌보고, 수확해요','텃밭에서 할 일을 골라 주세요. 캐릭터가 직접 걸어가 씨앗을 뿌리고 물을 주고 수확해요. 작업을 마쳐야 자원이 반영돼요.'],['wood','도로 너머를 탐색해요','벌목장에서 나무를 베어 목재를 얻고, 휴게소를 탐색해 물과 고철을 모아요. 사냥은 별도 전투 스테이지에서 진행돼요.'],['hammer','트럭을 우리집으로 만들어요','재료를 모아 새 판자를 놓으면 데크의 외곽과 통로가 넓어져요. 확장할 때마다 새 텃밭도 생겨요.'],['bed','쉼도 소중한 하루예요','활동하면 기력이 줄어요. 쉬면서 회복하고, 보리를 쓰다듬어 행복을 채워요.'],['shield','우리의 일상은 저장돼요','진행 상황은 이 기기에 자동 저장돼요. 앱을 삭제하거나 데이터를 지우면 저장도 사라져요.']].map(([i,t,d])=>`<div><span>${icon(i)}</span><article><h3>${t}</h3><p>${d}</p></article></div>`).join('')}</div>`);}
 if(kind==='reset')modalShell('A FRESH START','새로운 여행을 시작할까요?',`<p class="modal-description">현재 기기의 모든 진행 상황이 지워집니다.<br>이 작업은 되돌릴 수 없어요.</p><button class="button button-danger full-width" data-reset>진행 상황을 지우고 새로 시작</button><button class="text-button full-width" data-close>지금의 여행 계속하기</button>`);
}
function renderSettings(){modalShell('MAKE YOURSELF AT HOME','우리집 설정',`<div class="settings-row"><div><strong>게임 소리</strong><p>작은 행동에 기분 좋은 소리를 더해요</p></div><button class="toggle ${sound?'on':''}" data-sound aria-label="게임 소리 ${sound?'끄기':'켜기'}" aria-pressed="${sound}"><span></span></button></div><div class="settings-row"><div><strong>시간 흐름</strong><p>현재 ${paused?'쉬어 가는 중':'흘러가는 중'}</p></div><button class="button button-light small" data-pause>${paused?'계속하기':'잠시 멈춤'}</button></div><div class="update-box"><div class="update-heading">${icon('download')}<strong>앱 업데이트</strong><span>v${APP_VERSION}</span></div><p>${escape(lastUpdate?.message??'앱을 시작할 때 새 버전을 확인해요.')}</p>${lastUpdate?.release?`<div class="release-notes">${escape(lastUpdate.release.notes)}</div>`:''}<button class="button button-light full-width" data-update ${updateBusy?'disabled':''}>${updateBusy?'확인하는 중…':'새 버전 확인'}</button>${lastUpdate?.status==='available'?'<button class="button full-width" data-download>새 APK 다운로드</button><small>다운로드 후 Android 설치 확인을 진행해 주세요.</small>':''}</div><button class="text-button full-width" data-save>${icon('check')} 지금 저장하기</button><button class="text-button danger full-width" data-open="reset">새로운 여행 시작</button><p class="fine-print">ROAD HAVEN · 로드헤이븐 v${APP_VERSION}<br>당신의 기기에 머무는 작은 세상</p>`);}
async function runUpdate(manual=false){if(updateBusy)return;updateBusy=true;if(currentModal==='settings')renderSettings();lastUpdate=await checkUpdate();updateBusy=false;if(currentModal==='settings')renderSettings();else if(lastUpdate.status==='available')toast('새 버전이 도착했어요! 설정에서 업데이트를 확인하세요.');if(manual&&currentModal!=='settings')toast(lastUpdate.message);}
document.addEventListener('click',e=>{const t=(e.target as Element).closest<HTMLElement>('button,a');if(!t||!t.closest('#app')||battleView)return;if(actionBusy){e.preventDefault();toast('하던 작업을 마치면 다시 움직일 수 있어요.');return;}if(t.matches('a[href="#"]')){e.preventDefault();closeModal();}
 if(t.dataset.nav){document.querySelectorAll('[data-nav]').forEach(el=>el.classList.toggle('active',el===t));if(t.dataset.nav==='home'){closeModal();setZone('home');}else openModal(t.dataset.nav);}
 if(t.dataset.open)openModal(t.dataset.open);
 if(t.dataset.zone){closeModal();setZone(t.dataset.zone as 'home'|'grove');}
 if(t.hasAttribute('data-look-grove')){closeModal();setZone('grove');document.querySelector('.scene-card')!.scrollIntoView({behavior:'smooth',block:'center'});}
 if(t.dataset.stage){selectedStage=Number(t.dataset.stage);openModal('hunt');}
 if(t.hasAttribute('data-start-hunt'))startBattle();
 if(t.hasAttribute('data-close'))closeModal();
 if(t.dataset.action)void action(t.dataset.action as Action,t.dataset.plot!==undefined?Number(t.dataset.plot):undefined);
 if(t.dataset.gender){selectedGender=t.dataset.gender as Gender;document.querySelectorAll('[data-gender]').forEach(el=>el.classList.toggle('selected',el===t));}
 if(t.hasAttribute('data-start')){const name=(document.querySelector<HTMLInputElement>('#player-name')?.value??'').trim();if(!name){toast('함께할 생존자의 이름을 알려 주세요.');return;}state={...state,gender:selectedGender,name:name.slice(0,16)};persist();closeModal();render();toast(`${state.name}, 우리집에 온 걸 환영해요!`);}
 if(t.hasAttribute('data-sound')){sound=!sound;document.querySelector('.sound-toggle')!.innerHTML=icon(sound?'volume':'mute');document.querySelector('.sound-toggle')!.setAttribute('aria-label',sound?'소리 끄기':'소리 켜기');if(sound)ping();if(currentModal==='settings')renderSettings();}
 if(t.hasAttribute('data-pause')){paused=!paused;document.querySelector('.time-button')!.innerHTML=icon(paused?'play':'pause');document.querySelector('.time-button')!.setAttribute('aria-label',paused?'시간 계속':'시간 일시정지');if(currentModal==='settings')renderSettings();}
 if(t.hasAttribute('data-save'))toast(persist()?'소중한 하루를 저장했어요.':'저장하지 못했어요. 기기 저장 공간을 확인해 주세요.');
 if(t.hasAttribute('data-reset')){state=createGame(state.gender,'하루');persist();render();openModal('welcome');}
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
