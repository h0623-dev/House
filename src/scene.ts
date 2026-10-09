import { formatGameDuration, gameMinutesToSeconds } from './game-time';
import { GAME_SPEED_MULTIPLIER, realDuration } from './game-speed';
import { CROPS, getCropProgress, getPlotCropId, getFarmCapacity, type CropId, type GameState, type Plot } from './game';
import { drawHero, type HeroPose } from './actors';
import { drawZombie } from './creatures';
import { drawCompanion, companionPawContacts, sampleCompanionGait, type CompanionOptions } from './companion-art';
import { drawTruckFloor, drawTruckStairway } from './truck-floor-art';
import { drawSkyBirds, skyNightAmount } from './sky-birds';
import { createPetPatrol, stepPetPatrol, getPetGroundRadius, type PetPatrolState } from './scene-patrol';
import { getFloorBounds, getFloorSlots, getFloorStairs, getHomeLocation, getHomeSlots, getHousePosition, getHouseFootprint,
  getSlotFloor, getSlotLocalIndex, getTruckFloorCount, type TruckFloor } from './truck-layout';
import { getSelectedTeam, getUnitRoster, type UnitId } from './units';
import { drawWorldSprite, paintWorldQuad, drawWorldRoad, drawWorldFence, drawWorldStairs, worldArtReady, worldImages } from './world-art';
import { drawCropSprite } from './crop-art';
import { BUILDINGS, getSettlement, getUnlockedSlots, isFacilitySlotAvailable, isHomeSlotAvailable, type BuildingType } from './settlement';
import { drawFacility, facilityArtReady } from './settlement-art';
import { type MotionRoute } from './scene-motion';
import { anchoredCameraChange, clampMapZoom, MapPinchGesture } from './scene-gestures';
import { createNavigationWorld, defaultHeroLocation, groundLocation, navigationDeckBounds, planNavigation, projectDeckPoint,
  sampleNavigation, planWorkNavigation, planYieldNavigation, blocksActorStep, circleOverlapsPolygon, distanceToSegment, getPatrolTargets, HERO_BODY_RADIUS, DECK_FRONTS, FARM_POSITIONS, SETTLEMENT_POSITIONS,
  type NavigationActor, type NavigationLocation, type NavigationPath, type NavigationWorld } from './scene-navigation';
import itemAtlasUrl from './assets/items-anime.png';

type Point = [number, number];
type Selectable = 'farm' | 'farm-expand' | 'truck' | 'house' | 'house-slot' | 'pet' | 'character' | 'grove' | 'grove-work' | 'facility' | 'facility-collect' | 'facility-start' | 'build-slot';
type Hit = { kind: Selectable; x: number; y: number; radius: number; bounds?: [number, number, number, number]; plotId?: number };
type SceneAction = 'plant' | 'water' | 'harvest' | 'chop' | 'expand' | 'expandFarm' | 'gather' | 'build' | 'upgrade';
type FarmAction = 'plant' | 'water' | 'harvest';
type PlanningMode = 'catalog' | 'placement' | 'expansion';
type WorldBounds = { left: number; top: number; right: number; bottom: number };
type FarmStroke = { pointerId: number; last: Point; visited: Set<number> };
type MapGesture = { pointerId: number; start: Point; last: Point; moved: boolean };
const isFarmAction = (kind: SceneAction): kind is FarmAction => kind === 'plant' || kind === 'water' || kind === 'harvest';
type Chore = { kind: SceneAction; elapsed: number; duration: number; walk: number; work: number; path: Point[]; route: MotionRoute; navigation: NavigationPath; plotIndex: number; cropId: CropId; facilitySlot?: number; stalled:number; yieldAt:number; resolve: () => void; reject:(reason:Error)=>void };
const CHORE_STALL_TIMEOUT=16;
// The hero belongs to the truck's scale: a person fits comfortably beside its house and planters.
// Compact painted residents sit between the crops and miniature buildings.
const WORLD_HERO_SCALE = .64;
const CROP_PLANT_SIZE: Record<CropId, Point> = { carrot: [21, 34], potato: [26, 27], tomato: [24, 35], corn: [19, 40], strawberry: [22, 25], pumpkin: [29, 27] };
const CROP_SEED_COLOR: Record<CropId, string> = { carrot: '#d29b57', potato: '#bfab72', tomato: '#cfad6c', corn: '#efc955', strawberry: '#9d7150', pumpkin: '#ead5a1' };
// The original eight beds keep their identity and position as the garden grows.
// New beds occupy the deck's front garden; facilities stay behind the central path.
const SETTLEMENT_SLOTS = SETTLEMENT_POSITIONS;
const FACILITY_SIZE: Record<BuildingType, Point> = { workshop: [126, 119], kitchen: [120, 112], waterworks: [116, 118], greenhouse: [126, 105], watchtower: [111, 146], petHouse: [106, 90] };
const PET_GROUND_SIZE: Record<UnitId,number>={dog:33,cat:34,rabbit:25,fox:33,boar:44,owl:31};

/** A live isometric home built from our original painted anime environment art. */
export class Scene {
  private ctx: CanvasRenderingContext2D;
  private state: GameState | null = null;
  private frame = 0;
  private width = 1;
  private height = 1;
  private scale = 1;
  private dx = 0;
  private dy = 0;
  private time = 0;
  private hits: Hit[] = [];
  private focused = '';
  private focusedUntil = 0;
  private observer: ResizeObserver;
  private lastFrame = 0;
  private reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  private action: Chore | null = null;
  private heroLocation: NavigationLocation = defaultHeroLocation();
  private freeWalk: { navigation: NavigationPath; elapsed: number; gaitOffset: number; blockedFor:number; retryFor:number; reroutes:number } | null = null;
  private walkingEnabled = true;
  private gaitDistance = 0;
  private heroFacing: 1 | -1 = 1;
  private activeFloor: TruckFloor = 1;
  private renderFloor: TruckFloor = 1;
  private houseMoveMode = false;
  private selectedHouseSlot: number | null = null;
  private blockedReason: string | null = null;
  private walkEventState = '';
  private petMotion = new Map<UnitId,PetPatrolState>();
  private petYields = new Map<UnitId,{route:NavigationPath;reserved:NavigationLocation[];reservedRadius:number}>();
  private zone: 'home' | 'grove' = 'home';
  private selectedPlotId: number | null = null;
  private farmFocus = false;
  private farmMode: FarmAction | null = null;
  private farmStroke: FarmStroke | null = null;
  private cancelledFarmPointer: number | null = null;
  private mapGesture: MapGesture | null = null;
  private cancelledMapPointer: number | null = null;
  private mapPan: Point = [0, 0];
  private mapZoom = 1;
  private mapMoveMode = false;
  private cameraViewport: Point = [920, 560];
  private manualViewport: Point | null = null;
  private pinch = new MapPinchGesture();
  private cancelledGesturePointers = new Set<number>();
  private pendingFarmTouch: { pointerId: number; point: Point; timer: number } | null = null;
  private mapPanLimit: Point = [500, 400];
  private constructionMode: BuildingType | null = null;
  private selectedSlot: number | null = null;
  private movingBuildingId: number | null = null;
  private selectedFacilityId: number | null = null;
  private planningMode: PlanningMode | null = null;
  private planningLevel: number | null = null;
  private expansionPreview: number | null = null;
  private cameraFocusRequested = false;
  private safeViewport = { top: 0, bottom: 0, left: 0, right: 0, width: 1, height: 1 };
  private queuedPlotIds: number[] = [];
  private plantingCropId: CropId = 'carrot';
  private itemAtlas = (() => { const image = new Image(); image.decoding = 'async'; image.src = itemAtlasUrl; return image; })();
  private camera = { x: 480, y: 350, zoom: 1 };
  private treeCutAt = -100;
  private heroDrawn = false;
  private actionEventState = '';
  private disposed = false;
  private suspended = false;
  private animate = (timestamp: number) => {
    if (document.hidden || this.suspended) { this.frame = 0; return; }
    this.frame = requestAnimationFrame(this.animate);
    if (timestamp - this.lastFrame < (this.reducedMotion && !this.action && !this.freeWalk ? 250 : 32)) return;
    const elapsed = this.lastFrame ? Math.max(0, (timestamp - this.lastFrame) / 1000) : 0;
    const delta = Math.min(elapsed, .1);
    this.lastFrame = timestamp;
    this.time += delta * GAME_SPEED_MULTIPLIER;
    if (this.freeWalk) {
      const walking = this.freeWalk,nextElapsed=Math.min(walking.navigation.motion.duration,walking.elapsed+delta),sample=sampleNavigation(walking.navigation,nextElapsed);
      const blocker=this.stepBlocker(this.heroLocation,sample.location);
      this.blockedReason=blocker?`actor:${blocker.id}`:null;
      if(blocker){
        walking.blockedFor+=elapsed;walking.retryFor+=elapsed;
        if(walking.blockedFor>=.3&&walking.retryFor>=.3){
          walking.retryFor=0;
          this.tryPetYield(blocker,[sample.location,walking.navigation.target]);
          const detour=planNavigation(this.navigationWorld(),this.heroLocation,walking.navigation.target);
          if(detour){walking.navigation=detour;walking.elapsed=0;walking.gaitOffset=this.gaitDistance;walking.reroutes++;}
        }
      }else{walking.blockedFor=0;walking.retryFor=0;walking.elapsed=nextElapsed;this.heroLocation=sample.location;this.heroFacing=sample.facing;this.gaitDistance=walking.gaitOffset+sample.distance;this.followFloor(sample.location.floor??1);}
      if (walking.elapsed >= walking.navigation.motion.duration) { this.freeWalk = null; this.publishWalking(); }
    }
    if (this.action) {
      const action=this.action,nextElapsed=Math.min(action.duration,action.elapsed+elapsed),nextLocation=nextElapsed<action.walk?sampleNavigation(action.navigation,nextElapsed).location:
        nextElapsed>action.walk+action.work?sampleNavigation(action.navigation,nextElapsed-action.walk-action.work,true).location:action.navigation.target;
      const blocker=this.stepBlocker(this.currentHeroLocation(),nextLocation);
      this.blockedReason=blocker?`actor:${blocker.id}`:null;
      if(blocker){
        action.stalled+=elapsed;
        if(action.stalled-action.yieldAt>=.3){action.yieldAt=action.stalled;this.tryPetYield(blocker,[nextLocation,nextElapsed>action.walk+action.work?action.navigation.returnLocation:action.navigation.target]);}
      }else{action.stalled=0;action.yieldAt=0;action.elapsed=nextElapsed;this.followFloor(nextLocation.floor??1);}
      if(action.stalled>=CHORE_STALL_TIMEOUT){
        const retained=this.currentHeroLocation();this.heroLocation={...retained,point:[...retained.point]};this.action=null;this.zone='home';
        action.reject(new Error('동물이 길을 막아 작업을 멈췄어요. 트럭 휴식으로 동료를 회복시킨 뒤 다시 해 주세요.'));
      }else{
        if (action.kind === 'chop' && action.elapsed >= action.walk + action.work * .78 && this.treeCutAt < this.time - 15) this.treeCutAt = this.time;
        if (action.elapsed >= action.duration) {
          this.heroLocation = { ...action.navigation.returnLocation, point: [...action.navigation.returnLocation.point] };
          this.action = null; this.zone = 'home'; action.resolve();
        }
      }
    }
    this.advancePets(delta);
    this.render();
  };
  private visibility = () => {
    if (document.hidden) { this.stopWalking(); this.cancelCameraGesture(); this.endFarmStroke(); this.endMapGesture(); cancelAnimationFrame(this.frame); this.frame = 0; }
    else if (!this.frame && !this.suspended) { this.lastFrame = 0; this.frame = requestAnimationFrame(this.animate); }
  };
  private blur = () => { this.cancelCameraGesture(); this.endFarmStroke(); this.endMapGesture(); };
  private pointerDown = (event: PointerEvent) => {
    if (event.button !== 0 || this.suspended) return;
    this.cancelledGesturePointers.delete(event.pointerId);
    if (this.pinch.down(event.pointerId, { x: event.clientX, y: event.clientY })) {
      this.endFarmStroke(true, false); this.endMapGesture(true, false);
      for (const pointerId of this.pinch.pointerIds) this.canvas.setPointerCapture(pointerId);
      event.preventDefault(); return;
    }
    if (!event.isPrimary) return;
    this.cancelledFarmPointer = null;
    this.cancelledMapPointer = null;
    // A farming swipe belongs to a plot only when it starts on that plot. Empty
    // ground always moves the map, even if the drag later crosses a planter.
    const startsFarmStroke = !this.mapMoveMode && this.farmMode !== null
      && (!this.action || isFarmAction(this.action.kind))
      && this.pointerHits(event.clientX, event.clientY).plots.length > 0;
    if (!startsFarmStroke) {
      this.endMapGesture(); this.cancelledMapPointer = null;
      this.mapGesture = { pointerId: event.pointerId, start: [event.clientX, event.clientY], last: [event.clientX, event.clientY], moved: false };
      this.canvas.setPointerCapture(event.pointerId); event.preventDefault(); return;
    }
    this.endFarmStroke();
    this.cancelledFarmPointer = null;
    this.farmStroke = { pointerId: event.pointerId, last: [event.clientX, event.clientY], visited: new Set() };
    this.canvas.setPointerCapture(event.pointerId);
    event.preventDefault();
    if (event.pointerType === 'touch') {
      // The second finger must have time to land before a pinch can plant or harvest a plot.
      this.pendingFarmTouch = { pointerId: event.pointerId, point: [event.clientX, event.clientY],
        timer: window.setTimeout(() => this.flushFarmTouch(), 120) };
    } else this.paintFarmPoint(event.clientX, event.clientY, false);
  };
  private pointerMove = (event: PointerEvent) => {
    if (this.suspended || this.cancelledGesturePointers.has(event.pointerId)) return;
    const pinch = this.pinch.move(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pinch.consumed) {
      event.preventDefault();
      if (pinch.change) this.zoomAt(this.mapZoom * pinch.change.ratio, pinch.change.from, pinch.change.to);
      return;
    }
    const gesture = this.mapGesture;
    if (gesture && gesture.pointerId === event.pointerId) {
      const distance = Math.hypot(event.clientX - gesture.start[0], event.clientY - gesture.start[1]);
      const previous = gesture.moved ? gesture.last : gesture.start;
      if (distance > 7) gesture.moved = true;
      if (gesture.moved) {
        this.holdCamera();
        const changeX = (event.clientX - previous[0]) / this.scale, changeY = (event.clientY - previous[1]) / this.scale;
        const nextX = Math.max(-this.mapPanLimit[0], Math.min(this.mapPanLimit[0], this.mapPan[0] - changeX));
        const nextY = Math.max(-this.mapPanLimit[1], Math.min(this.mapPanLimit[1], this.mapPan[1] - changeY));
        this.camera.x += nextX - this.mapPan[0]; this.camera.y += nextY - this.mapPan[1];
        this.mapPan = [nextX, nextY];
        event.preventDefault();
        this.render();
      }
      gesture.last = [event.clientX, event.clientY]; return;
    }
    const stroke = this.farmStroke;
    if (!stroke || event.pointerId !== stroke.pointerId || !this.farmMode) return;
    event.preventDefault();
    if (this.pendingFarmTouch?.pointerId === event.pointerId) {
      if (Math.hypot(event.clientX - stroke.last[0], event.clientY - stroke.last[1]) <= 7) return;
      this.flushFarmTouch();
    }
    const [fromX, fromY] = stroke.last;
    const steps = Math.max(1, Math.ceil(Math.hypot(event.clientX - fromX, event.clientY - fromY) / 10));
    stroke.last = [event.clientX, event.clientY];
    // Sparse touch events still paint every planter crossed by a fast swipe.
    for (let step = 1; step <= steps && this.farmStroke === stroke; step++) {
      const amount = step / steps;
      this.paintFarmPoint(fromX + (event.clientX - fromX) * amount, fromY + (event.clientY - fromY) * amount, true);
    }
  };
  private pointerCancel = (event: PointerEvent) => {
    if (event.type === 'lostpointercapture') {
      if (this.pinch.active) return;
      this.pinch.up(event.pointerId);
      if (event.pointerId === this.farmStroke?.pointerId) this.endFarmStroke();
      if (event.pointerId === this.mapGesture?.pointerId) this.endMapGesture();
      return;
    }
    this.pinch.up(event.pointerId);
    this.cancelledGesturePointers.add(event.pointerId);
    if (event.pointerId === this.farmStroke?.pointerId) this.endFarmStroke();
    if (event.pointerId === this.mapGesture?.pointerId) this.endMapGesture();
  };
  private pointer = (event: PointerEvent) => {
    const pinched = this.pinch.up(event.pointerId);
    if (this.cancelledGesturePointers.delete(event.pointerId) || pinched || this.suspended) { event.preventDefault(); return; }
    if (!event.isPrimary || event.button !== 0) return;
    if (event.pointerId === this.cancelledFarmPointer) { this.cancelledFarmPointer = null; return; }
    if (event.pointerId === this.cancelledMapPointer) { this.cancelledMapPointer = null; return; }
    if (event.pointerId === this.mapGesture?.pointerId) {
      this.pointerMove(event); const moved = this.mapGesture?.moved;
      this.endMapGesture(false); if (moved) return;
    }
    if (event.pointerId === this.farmStroke?.pointerId) { this.flushFarmTouch(); this.pointerMove(event); this.endFarmStroke(false); return; }
    // Menus and facility collection remain available while the resident is working.
    // The game controller decides whether a new resource-consuming job can begin.
    if (this.mapMoveMode) return;
    const { candidates, plots, x, y } = this.pointerHits(event.clientX, event.clientY);
    const facilityAction = candidates.filter(item => item.kind === 'facility-collect' || item.kind === 'facility-start')
      .sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];
    const foreground = [...candidates].reverse().find(item => (item.kind === 'pet' || item.kind === 'character') && Math.hypot(item.x - x, item.y - y) < item.radius);
    const workTree = candidates.find(item => item.kind === 'grove-work');
    const slots = candidates.filter(item => item.kind === 'build-slot').sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y));
    const facilities = candidates.filter(item => item.kind === 'facility').sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y));
    const hit = this.houseMoveMode ? candidates.find(item=>item.kind==='house-slot') : this.constructionMode ? slots[0] : facilityAction ?? foreground ?? facilities[0] ?? workTree ?? plots[0] ?? candidates[candidates.length - 1];
    const target = groundLocation(this.navigationWorld(), [x,y]);
    // The truck cab remains interactive; its broad legacy hit circle must not
    // turn a real empty deck tile into the expansion menu.
    if (hit && (hit.kind !== 'truck' || !target)) { this.focus(hit.kind); this.onSelect(hit.kind, hit.plotId); }
    else if (target) this.walkTo(target);
  };
  private wheelInput = (event: WheelEvent) => {
    if (this.suspended) return;
    event.preventDefault();
    this.endFarmStroke(); this.endMapGesture();
    const units = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? this.height : 1;
    const amount = Math.max(-300, Math.min(300, event.deltaY * units));
    this.zoomAt(this.mapZoom * Math.exp(-amount * .002), { x: event.clientX, y: event.clientY });
  };

  constructor(private canvas: HTMLCanvasElement, private onSelect: (kind: Selectable, plotId?: number) => void) {
    this.ctx = canvas.getContext('2d')!;
    canvas.style.touchAction = 'none';
    canvas.setAttribute('aria-label', '미래 대한민국의 트럭 집. 텃밭과 반려견, 캐릭터, 도로 옆 벌목장을 눌러 보세요.');
    canvas.addEventListener('pointerdown', this.pointerDown);
    canvas.addEventListener('pointermove', this.pointerMove);
    canvas.addEventListener('pointerup', this.pointer);
    canvas.addEventListener('pointercancel', this.pointerCancel);
    canvas.addEventListener('lostpointercapture', this.pointerCancel);
    canvas.addEventListener('wheel', this.wheelInput, { passive: false });
    document.addEventListener('visibilitychange', this.visibility);
    window.addEventListener('blur', this.blur);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    this.resize();
    this.frame = requestAnimationFrame(this.animate);
  }

  setState(state: GameState) {
    this.state = state;
    const team=getSelectedTeam(state);
    for(const id of this.petMotion.keys())if(!team.includes(id)){this.petMotion.delete(id);this.petYields.delete(id);}
    if(this.activeFloor>getTruckFloorCount(state))this.activeFloor=1;
    if (this.selectedPlotId !== null && !state.plots.some(plot => plot.id === this.selectedPlotId)) this.selectedPlotId = null;
    if (this.selectedFacilityId !== null && !getSettlement(state).buildings.some(building => building.id === this.selectedFacilityId)) this.selectedFacilityId = null;
  }
  setSelectedPlot(plotId: number | null) { this.selectedPlotId = plotId; }
  setFarmFocus(enabled: boolean) { if (enabled !== this.farmFocus) { this.cancelCameraGesture(); this.endFarmStroke(); this.endMapGesture(); } this.farmFocus = enabled; }
  /** A farming tool stays selected while taps or a finger swipe queue further plots. */
  setFarmMode(mode: FarmAction | null, queuedPlotIds: number[] = [], selectedSeed: CropId = 'carrot') {
    if (mode !== this.farmMode) { this.cancelCameraGesture(); this.endFarmStroke(); this.endMapGesture(); }
    this.farmMode = mode;
    this.canvas.style.touchAction = 'none';
    this.queuedPlotIds = mode ? [...queuedPlotIds] : [];
    this.plantingCropId = selectedSeed;
    if (mode && !this.action) this.zone = 'home';
  }
  setPlantingMode(enabled: boolean, queuedPlotIds: number[] = [], selectedSeed: CropId = 'carrot') { this.setFarmMode(enabled ? 'plant' : null, queuedPlotIds, selectedSeed); }
  setConstructionMode(type: BuildingType | null, selectedSlot?: number, movingId?: number) {
    if (type !== this.constructionMode) { this.cancelCameraGesture(); this.endFarmStroke(); this.endMapGesture(); }
    this.constructionMode = type;
    this.selectedSlot = type && selectedSlot !== undefined ? selectedSlot : null;
    this.movingBuildingId = type && movingId !== undefined ? movingId : null;
    if (type && !this.action) this.zone = 'home';
  }
  /** Fit when a planning view opens; later user drags and pinches keep their camera. */
  setPlanningViewport(mode: PlanningMode | null, nextLevel?: number) {
    const level = mode === 'expansion' ? Math.min(8, Math.max(1, nextLevel ?? (this.state?.deckLevel ?? 1) + 1)) : null;
    if (mode === this.planningMode && level === this.planningLevel) return;
    this.cancelCameraGesture(); this.endFarmStroke(); this.endMapGesture();
    this.planningMode = mode; this.planningLevel = level;
    this.mapPan = [0, 0]; this.mapZoom = 1; this.manualViewport = null;
    this.cameraFocusRequested = true;
    if (mode) this.zone = 'home';
    this.canvas.dispatchEvent(new CustomEvent('scenezoomchange', { detail: { zoom: this.mapZoom } }));
    this.render();
  }
  setExpansionPreview(level: number | null) {
    this.expansionPreview = level === null ? null : Math.min(8, Math.max(this.state?.deckLevel ?? 1, Math.floor(level)));
    this.render();
  }
  /** Selecting a distant facility explicitly makes both its sprite and upgrade sheet readable. */
  focusFacility(id: number) {
    if (!this.state || !getSettlement(this.state).buildings.some(building => building.id === id)) return;
    this.setActiveFloor(getSlotFloor(getSettlement(this.state).buildings.find(building=>building.id===id)!.slot));
    this.cancelCameraGesture(); this.endFarmStroke(); this.endMapGesture();
    this.selectedFacilityId = id; this.zone = 'home';
    this.mapPan = [0, 0]; this.mapZoom = 1; this.manualViewport = null; this.cameraFocusRequested = true;
    this.canvas.dispatchEvent(new CustomEvent('scenezoomchange', { detail: { zoom: this.mapZoom } }));
    this.render();
  }
  setSelectedFacility(id: number | null) {
    if (id !== this.selectedFacilityId) { this.endFarmStroke(); this.endMapGesture(); }
    this.selectedFacilityId = id;
  }
  setMapZoom(zoom: number) { this.cancelCameraGesture(); this.endFarmStroke(); this.endMapGesture(); this.zoomAt(zoom); }
  getMapZoom() { return this.mapZoom; }
  setMapMoveMode(enabled: boolean) {
    if (enabled === this.mapMoveMode) return;
    this.cancelCameraGesture(); this.endFarmStroke(); this.endMapGesture();
    this.mapMoveMode = enabled;
    if (enabled) this.holdCamera();
    this.canvas.style.cursor = enabled ? 'grab' : '';
    this.canvas.dispatchEvent(new CustomEvent('scenemovemodechange', { detail: { enabled } }));
    this.render();
  }
  getMapMoveMode() { return this.mapMoveMode; }
  isWalking() { return this.freeWalk !== null; }
  /** Menu, battle and tool boundaries retain the current feet, never reset home. */
  stopWalking() {
    if (!this.freeWalk) return;
    const sample = sampleNavigation(this.freeWalk.navigation, this.freeWalk.elapsed);
    this.heroLocation = sample.location; this.heroFacing = sample.facing;
    this.gaitDistance = this.freeWalk.gaitOffset + sample.distance; this.freeWalk = null;
    this.publishWalking();
  }
  setWalkingEnabled(enabled: boolean) {
    if (enabled === this.walkingEnabled) return;
    this.walkingEnabled = enabled; if (!enabled) this.stopWalking();
  }
  getActiveFloor() { return this.activeFloor; }
  /** Floor tabs change only the view; the actor still travels through actual stairs. */
  setActiveFloor(floor: TruckFloor) {
    if(!this.state||!getFloorSlots(this.state,floor).length||floor===this.activeFloor)return;
    this.stopWalking();this.activeFloor=floor;this.resetMapView();this.cameraFocusRequested=true;
    this.canvas.dispatchEvent(new CustomEvent('scenefloorchange',{detail:{floor}}));this.render();
  }
  setHouseMoveMode(enabled:boolean,slot?:number) {
    if(enabled!==this.houseMoveMode){this.stopWalking();this.cancelCameraGesture();this.endFarmStroke();this.endMapGesture();}
    this.houseMoveMode=enabled;this.selectedHouseSlot=enabled&&slot!==undefined?slot:null;this.render();
  }
  canPlaceHome(floor:TruckFloor,slot:number) { return !this.placementOccupied(floor,getHouseFootprint({floor,slot})); }
  canPlaceFacility(slot:number) {
    const position=SETTLEMENT_SLOTS[getSlotLocalIndex(slot)];if(!position)return false;
    const[u,v]=position;return !this.placementOccupied(getSlotFloor(slot),{left:u-65,top:v-65,right:u+65,bottom:v+65});
  }
  private placementOccupied(floor:TruckFloor,bounds:{left:number;top:number;right:number;bottom:number}) {
    const polygon=[[bounds.left,bounds.top],[bounds.right,bounds.top],[bounds.right,bounds.bottom],[bounds.left,bounds.bottom]]
      .map(p=>projectDeckPoint(p as Point,floor));
    return this.physicalActors().some(a=>a.location.surface==='deck'&&(a.location.floor??1)===floor&&circleOverlapsPolygon(a.location.point,a.radius,polygon));
  }
  private petScale(id:UnitId) { return id==='dog'?.78:id==='boar'?.7:.73; }
  private physicalActors():NavigationActor[] {
    const hero:NavigationActor={id:'hero',location:this.currentHeroLocation(),radius:HERO_BODY_RADIUS};
    const team=this.state?getSelectedTeam(this.state):['dog','cat']as UnitId[];
    return[hero,...team.flatMap(id=>{const motion=this.petMotion.get(id);return motion?[{id,location:{...motion.location,point:[...motion.location.point]as Point},radius:motion.radius}]:[];})];
  }
  private stepBlocker(from:NavigationLocation,to:NavigationLocation) {
    const actors=this.physicalActors().filter(actor=>actor.id!=='hero');
    return (to.surface==='ladder'?actors.find(a=>a.location.surface==='ladder'&&a.location.link===to.link):undefined)
      ??blocksActorStep(from,to,HERO_BODY_RADIUS,actors);
  }
  private tryPetYield(blocker:NavigationActor,reserved:NavigationLocation[],reservedRadius=HERO_BODY_RADIUS,requested=new Set<UnitId>()) {
    const id=blocker.id as UnitId,motion=this.petMotion.get(id),roster=getUnitRoster(this.state??{});
    if(!motion||requested.has(id)||this.petYields.has(id)||this.reducedMotion||roster[id].health<=0)return;
    requested.add(id);
    const ownsLink=motion.location.surface==='ladder'&&reserved.some(location=>location.surface==='ladder'&&location.link===motion.location.link);
    if(!ownsLink&&motion.blockedReason!=='no-clear-patrol-route'&&!motion.blockedReason?.startsWith('actor:'))return;
    const actors=this.physicalActors().filter(actor=>actor.id!==id),world=this.navigationWorld(motion.radius,actors),
      route=planYieldNavigation(world,motion.location,reserved,reservedRadius);
    if(!route){
      // An occupied landing can prevent the first exit route from existing.
      // Clear its actual companion body before accepting any movement through it.
      const links=world.links.filter(link=>motion.location.surface==='ladder'&&motion.location.link===link.id
        ||reserved.some(location=>location.surface==='ladder'&&location.link===link.id));
      for(const actor of actors){
        if(actor.id==='hero'||requested.has(actor.id as UnitId)||roster[actor.id as UnitId].health<=0)continue;
        if(links.some(link=>((actor.location.floor??1)===link.lower||(actor.location.floor??1)===link.upper)
          &&link.points.slice(1).some((to,index)=>distanceToSegment(actor.location.point,link.points[index],to)<motion.radius+actor.radius+2)))
          this.tryPetYield(actor,[...reserved,motion.location],Math.max(motion.radius,reservedRadius),requested);
      }
      return;
    }
    motion.route=route;motion.elapsed=0;motion.retryRemaining=0;motion.pauseRemaining=0;motion.blockedReason=null;
    this.petYields.set(id,{route,reserved:reserved.map(location=>({...location,point:[...location.point]})),reservedRadius});
  }
  private followFloor(floor:TruckFloor) {
    if(floor===this.activeFloor)return;this.activeFloor=floor;this.renderFloor=floor;this.manualViewport=null;this.mapPan=[0,0];this.mapZoom=1;
    this.canvas.dispatchEvent(new CustomEvent('scenefloorchange',{detail:{floor,following:true}}));
  }
  /** Only an explicit new-game reset discards the session's retained position. */
  resetPosition() {
    this.stopWalking(); this.heroLocation=defaultHeroLocation();this.gaitDistance=0;this.heroFacing=1;this.petMotion.clear();this.petYields.clear();this.activeFloor=1;
    this.publishWalking();
  }
  resetMapView() {
    this.cancelCameraGesture(); this.endFarmStroke(); this.endMapGesture(); this.mapPan = [0, 0]; this.mapZoom = 1; this.manualViewport = null;
    this.canvas.dispatchEvent(new CustomEvent('scenezoomchange', { detail: { zoom: this.mapZoom } }));
    this.render();
  }
  setSuspended(value: boolean) {
    this.suspended = value;
    if (value) { this.stopWalking(); this.cancelCameraGesture(); this.endFarmStroke(); this.endMapGesture(); cancelAnimationFrame(this.frame); this.frame = 0; }
    else this.visibility();
  }
  setZone(zone: 'home' | 'grove', recenter = false) {
    if (!this.action && zone !== this.zone) { this.cancelCameraGesture(); this.endFarmStroke(); this.endMapGesture(); this.zone = zone; }
    if (recenter) this.resetMapView();
  }
  /** Resolves only after the visible walk, work and return have finished. */
  playAction(kind: SceneAction, plotId?: number, selectedCropId?: CropId): Promise<void> {
    if (this.disposed) return Promise.resolve();
    if (this.action) return Promise.reject(new Error('이미 행동 중이에요.'));
    this.stopWalking();
    const state = this.state;
    let plotIndex = state?.plots.findIndex(plot => plot.id === plotId) ?? -1;
    if (plotIndex < 0 && state) plotIndex = state.plots.findIndex(plot => kind === 'plant' ? plot.plantedAt === null : kind === 'water' ? plot.plantedAt !== null && !plot.watered : getCropProgress(state, plot) >= 1);
    plotIndex = kind === 'expandFarm' ? state?.plots.length ?? 3 : Math.max(0, plotIndex);
    const cropId = kind === 'plant' ? selectedCropId ?? this.plantingCropId : getPlotCropId(state?.plots[plotIndex] ?? { id: 0, plantedAt: null, watered: false });
    const [u, v] = this.plotPosition(plotIndex);
    let target: NavigationLocation = { surface: 'deck', floor:1, point: projectDeckPoint([u - 13,v + 39],1) };
    let work = kind === 'expandFarm' ? 1.8 : kind === 'water' ? 1.5 : kind === 'harvest' ? 1.65 : 1.5;
    if (kind === 'chop' || kind === 'gather') {
      target = { surface: 'road', point: kind === 'chop' ? [142,590] : [211,578] };
      work = kind === 'chop' ? 2.55 : 2.4;
      if (kind === 'chop') this.treeCutAt = -100;
    } else if (kind === 'expand') {
      target = { surface: 'deck', floor:1, point: projectDeckPoint([-157, this.deckBounds().front - 23],1) };
      work = 1.8;
    }
    work = realDuration(work);
    // A passing pet may temporarily occupy the work approach. The fixed route
    // avoids structures; each accepted frame still waits for full actor clearance.
    let approaches:NavigationLocation[];
    if(target.surface==='road')approaches=[target,...[[-28,0],[28,0],[0,28],[0,-28]].map(([x,y])=>({surface:'road' as const,point:[target.point[0]+x,target.point[1]+y]as Point}))];
    else if(kind==='expand')approaches=[target,...[-48,48,-96,96].map(shift=>({surface:'deck' as const,floor:1 as const,point:projectDeckPoint([-157+shift,this.deckBounds().front-23],1)}))];
    else approaches=[target,...[[u+83,v+39],[u+34,v-13],[u+34,v+81]].map(point=>({surface:'deck' as const,floor:1 as const,point:projectDeckPoint(point as Point,1)}))];
    const navigation = planWorkNavigation(this.choreWorld(),this.heroLocation,approaches);
    if (!navigation) return Promise.reject(new Error('작업 장소로 가는 길이 막혔어요. 트럭 휴식으로 동료를 회복시키거나 빈 길로 이동해 주세요.'));
    const route = navigation.motion, path = navigation.points, walk = route.duration;
    this.zone = 'home';
    this.lastFrame = performance.now();
    return new Promise((resolve,reject) => { this.action = { kind, elapsed: 0, duration: walk + navigation.returnMotion.duration + work, walk, work, path, route, navigation, plotIndex, cropId, stalled:0, yieldAt:0, resolve,reject }; });
  }
  /** A short, visible visit to the facility; the controller commits its state exactly once. */
  playFacilityAction(slot: number, kind: 'build' | 'upgrade'): Promise<void> {
    if (this.disposed) return Promise.resolve();
    if (this.action) return Promise.reject(new Error('이미 행동 중이에요.'));
    this.stopWalking();
    if (!Number.isInteger(slot) || !SETTLEMENT_SLOTS[getSlotLocalIndex(slot)]) return Promise.reject(new Error('시설 자리를 확인해 주세요.'));
    const [u, v] = SETTLEMENT_SLOTS[getSlotLocalIndex(slot)],floor=getSlotFloor(slot);
    // These narrow aisles run along the edges of every existing footprint.
    const approaches=[[83,83],[-83,83],[83,-83],[-83,-83],[83,0],[-83,0],[0,83],[0,-83]]
      .map(([x,y])=>({surface:'deck' as const,floor,point:projectDeckPoint([u+x,v+y],floor)}));
    const navigation = planWorkNavigation(this.choreWorld(),this.heroLocation,approaches);
    if (!navigation) return Promise.reject(new Error('시설로 가는 길이 막혔어요. 트럭 휴식으로 동료를 회복시킨 뒤 다시 해 주세요.'));
    const route = navigation.motion, path = navigation.points, walk = route.duration, work = realDuration(1.65);
    this.zone = 'home'; this.lastFrame = performance.now();
    return new Promise((resolve,reject) => { this.action = { kind, elapsed: 0, duration: walk + navigation.returnMotion.duration + work, walk, work, path,
      route, navigation, plotIndex: 0, cropId: 'carrot', facilitySlot: slot, stalled:0, yieldAt:0, resolve,reject }; });
  }
  focus(kind: string) { this.focused = kind; this.focusedUntil = performance.now() + 2400; }
  resize() {
    this.cancelCameraGesture();
    this.endFarmStroke();
    this.endMapGesture();
    const bounds = this.canvas.getBoundingClientRect();
    this.width = bounds.width || 850;
    this.height = bounds.height || 650;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.width * dpr);
    this.canvas.height = Math.round(this.height * dpr);
    this.render();
  }
  destroy() {
    this.disposed = true;
    this.cancelCameraGesture();
    this.endFarmStroke(false);
    this.endMapGesture(false);
    this.action?.resolve(); this.action = null;
    cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    this.canvas.removeEventListener('pointerdown', this.pointerDown);
    this.canvas.removeEventListener('pointermove', this.pointerMove);
    this.canvas.removeEventListener('pointerup', this.pointer);
    this.canvas.removeEventListener('pointercancel', this.pointerCancel);
    this.canvas.removeEventListener('lostpointercapture', this.pointerCancel);
    this.canvas.removeEventListener('wheel', this.wheelInput);
    document.removeEventListener('visibilitychange', this.visibility);
    window.removeEventListener('blur', this.blur);
  }

  private endFarmStroke(suppressUp = true, releaseCapture = true) {
    if (this.pendingFarmTouch) window.clearTimeout(this.pendingFarmTouch.timer);
    this.pendingFarmTouch = null;
    const stroke = this.farmStroke;
    this.farmStroke = null;
    if (!stroke) return;
    this.cancelledFarmPointer = suppressUp ? stroke.pointerId : null;
    if (releaseCapture && this.canvas.hasPointerCapture(stroke.pointerId)) this.canvas.releasePointerCapture(stroke.pointerId);
  }
  private endMapGesture(suppressUp = true, releaseCapture = true) {
    const gesture = this.mapGesture; this.mapGesture = null;
    if (!gesture) return;
    this.cancelledMapPointer = suppressUp ? gesture.pointerId : null;
    if (releaseCapture && this.canvas.hasPointerCapture(gesture.pointerId)) this.canvas.releasePointerCapture(gesture.pointerId);
  }
  private flushFarmTouch() {
    const pending = this.pendingFarmTouch;
    if (!pending) return;
    window.clearTimeout(pending.timer); this.pendingFarmTouch = null;
    if (this.farmStroke?.pointerId === pending.pointerId && !this.pinch.active && !this.suspended) this.paintFarmPoint(...pending.point, false);
  }
  private cancelCameraGesture() {
    const pointers = this.pinch.pointerIds;
    this.pinch.reset();
    for (const pointerId of pointers) {
      this.cancelledGesturePointers.add(pointerId);
      if (this.canvas.hasPointerCapture(pointerId)) this.canvas.releasePointerCapture(pointerId);
    }
  }
  private holdCamera() { this.manualViewport ??= [...this.cameraViewport]; }
  private zoomAt(zoom: number, from?: { x: number; y: number }, to = from) {
    this.holdCamera();
    const rect = this.canvas.getBoundingClientRect();
    const center = { x: this.dx + this.camera.x * this.scale, y: this.dy + this.camera.y * this.scale };
    const local = (point?: { x: number; y: number }) => point ? { x: point.x - rect.left, y: point.y - rect.top } : center;
    const change = anchoredCameraChange({ camera: this.camera, scale: this.scale, zoom: this.mapZoom,
      nextZoom: clampMapZoom(zoom), origin: { x: this.dx, y: this.dy }, center, from: local(from), to: local(to) });
    const nextPan: Point = [Math.max(-this.mapPanLimit[0], Math.min(this.mapPanLimit[0], this.mapPan[0] + change.delta.x)),
      Math.max(-this.mapPanLimit[1], Math.min(this.mapPanLimit[1], this.mapPan[1] + change.delta.y))];
    this.camera.x += nextPan[0] - this.mapPan[0]; this.camera.y += nextPan[1] - this.mapPan[1];
    this.camera.zoom *= change.ratio;
    this.mapPan = nextPan; this.mapZoom = change.zoom;
    this.canvas.dispatchEvent(new CustomEvent('scenezoomchange', { detail: { zoom: this.mapZoom } }));
    this.render();
  }
  private pointerHits(clientX: number, clientY: number) {
    const rect = this.canvas.getBoundingClientRect();
    const x = (clientX - rect.left - this.dx) / this.scale, y = (clientY - rect.top - this.dy) / this.scale;
    const withinCanvas = clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
    const candidates = withinCanvas ? this.hits.filter(item => item.bounds
      ? x >= item.bounds[0] && y >= item.bounds[1] && x <= item.bounds[2] && y <= item.bounds[3]
      : Math.hypot(item.x - x, item.y - y) < Math.max(item.radius, 22 / this.scale)) : [];
    const plots = candidates.filter(item => item.kind === 'farm').sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y));
    return { candidates, plots, x, y };
  }
  private publishGeometry() {
    const round = (value: number) => Math.round(value * 1000) / 1000;
    const geometry = JSON.stringify({ scale: round(this.scale), dx: round(this.dx), dy: round(this.dy), zone: this.zone,
      farmMode: this.farmMode, constructionMode: this.constructionMode, mapZoom: this.mapZoom,
      mapMoveMode: this.mapMoveMode, mapPan: this.mapPan.map(round), manualCamera: this.manualViewport !== null,
      planningMode: this.planningMode, planningLevel: this.planningLevel, expansionPreview: this.expansionPreview,
      activeFloor:this.activeFloor,floorCount:this.state?getTruckFloorCount(this.state):1,houseMoveMode:this.houseMoveMode,
      deckLevel: this.state?.deckLevel ?? 1, farmCapacity: this.state ? getFarmCapacity(this.state) : 3, facilityCapacity: this.state ? getFloorSlots(this.state,this.activeFloor).length : 2,
      viewport: { width: round(this.width), height: round(this.height), safeTop: round(this.safeViewport.top), safeBottom: round(this.safeViewport.bottom), safeLeft: round(this.safeViewport.left), safeRight: round(this.safeViewport.right), usableWidth: round(this.safeViewport.width), usableHeight: round(this.safeViewport.height) } });
    if (this.canvas.dataset.sceneGeometry !== geometry) this.canvas.dataset.sceneGeometry = geometry;
    const buildings = this.state ? getSettlement(this.state).buildings : [];
    const unlocked = this.state ? getFloorSlots(this.state,this.activeFloor) : [0,1];
    const slots = SETTLEMENT_SLOTS.map(([u, v], local) => {
      const slot=(this.activeFloor-1)*16+local;
      const point = this.p(u, v, 95), building = buildings.find(item => item.slot === slot);
      const size = building ? FACILITY_SIZE[building.type] : [126, 119];
      const logicalBounds = this.slotBounds(slot);
      const footprint = { left: round(this.dx + logicalBounds.left * this.scale), top: round(this.dy + logicalBounds.top * this.scale),
        right: round(this.dx + logicalBounds.right * this.scale), bottom: round(this.dy + logicalBounds.bottom * this.scale) };
      const staticAvailable=this.state?isFacilitySlotAvailable(this.state,slot,this.movingBuildingId??undefined):!building,
        actorAvailable=this.canPlaceFacility(slot);
      return { slot,floor:this.activeFloor,footprint,polygon:[[u-65,v-65],[u+65,v-65],[u+65,v+65],[u-65,v+65]].map(p=>{const[x,y]=projectDeckPoint(p as Point,this.activeFloor);return{x,y};}),
        available:staticAvailable&&actorAvailable,blockedReason:!staticAvailable?'static':!actorAvailable?'actor':null, visible: footprint.left >= this.safeViewport.left && footprint.right <= this.width - this.safeViewport.right
        && footprint.top >= this.safeViewport.top && footprint.bottom <= this.height - this.safeViewport.bottom, x: round(this.dx + point[0] * this.scale), y: round(this.dy + point[1] * this.scale),
        unlocked: unlocked.includes(slot), buildingId: building?.id ?? null,
        facilityX: round(this.dx + point[0] * this.scale), facilityY: round(this.dy + (point[1] - 44) * this.scale),
        readyX: round(this.dx + point[0] * this.scale), readyY: round(this.dy + (point[1] - size[1] - 18) * this.scale),
        action: !building ? null : building.readyAt === null ? 'facility-start'
          : (this.state?.totalMinutes ?? 0) >= building.readyAt ? 'facility-collect' : null,
        remainingSeconds: building?.readyAt === null || !building ? null
          : gameMinutesToSeconds(building.readyAt - (this.state?.totalMinutes ?? 0)) };
    });
    const deck = this.deckBounds(), preview = this.expansionPreview === null ? null : this.deckBounds(this.expansionPreview);
    const corners = (bounds: ReturnType<Scene['deckBounds']>) => [[bounds.left, bounds.back], [bounds.end, bounds.back], [bounds.end, bounds.front], [bounds.left, bounds.front]].map(([u, v]) => { const point = this.p(u, v, 95); return { x: round(this.dx + point[0] * this.scale), y: round(this.dy + point[1] * this.scale) }; });
    this.canvas.dataset.deckExpansion = JSON.stringify({ level: this.state?.deckLevel ?? 1, nextLevel: this.expansionPreview, current: corners(deck), preview: preview ? corners(preview) : null,
      addedSlots: this.expansionPreview === null ? [] : slots.filter(slot => !slot.unlocked && getSlotLocalIndex(slot.slot) < this.expansionPreview! * 2).map(slot => slot.slot) });
    this.canvas.dataset.houseSlots=JSON.stringify(this.state?Array.from({length:getTruckFloorCount(this.state)},(_,i)=>(i+1)as TruckFloor).flatMap(floor=>getHomeSlots(this.state!,floor).map(slot=>{
      const rect=getHouseFootprint({floor,slot}),[u,v]=getHousePosition({floor,slot}),[x,y]=projectDeckPoint([u,v],floor),staticAvailable=isHomeSlotAvailable(this.state!,{floor,slot}),actorAvailable=this.canPlaceHome(floor,slot);
      return{floor,slot,x,y,available:staticAvailable&&actorAvailable,blockedReason:!staticAvailable?'static':!actorAvailable?'actor':null,
        polygon:[[rect.left,rect.top],[rect.right,rect.top],[rect.right,rect.bottom],[rect.left,rect.bottom]].map(p=>{const[x,y]=projectDeckPoint(p as Point,floor);return{x,y};})};})) : []);
    const encoded = JSON.stringify(slots);
    if (this.canvas.dataset.settlementSlots !== encoded) this.canvas.dataset.settlementSlots = encoded;
    const plots = (this.state?.plots ?? []).slice(0, FARM_POSITIONS.length).map((plot, index) => {
      const [u, v] = this.plotPosition(index), point = this.p(u + 35, v + 36, 112);
      return { id: plot.id, x: round(this.dx + point[0] * this.scale), y: round(this.dy + point[1] * this.scale) };
    });
    const farmGeometry = JSON.stringify(plots);
    if (this.canvas.dataset.farmPlots !== farmGeometry) this.canvas.dataset.farmPlots = farmGeometry;
    const count = this.state?.plots.length ?? 3, available = count < (this.state ? getFarmCapacity(this.state) : 3);
    const [u, v] = this.plotPosition(count), next = this.p(u + 35, v + 36, 112);
    const expansion = JSON.stringify({ available, index: count, x: round(this.dx + next[0] * this.scale), y: round(this.dy + next[1] * this.scale) });
    if (this.canvas.dataset.farmExpansion !== expansion) this.canvas.dataset.farmExpansion = expansion;
  }
  private eligibleFarmPlot(plot: Plot) {
    if (this.farmMode === 'plant') return plot.plantedAt === null;
    if (this.farmMode === 'water') return plot.plantedAt !== null && !plot.watered;
    return this.farmMode === 'harvest' && this.state !== null && getCropProgress(this.state, plot) >= 1;
  }
  private paintFarmPoint(clientX: number, clientY: number, swiping: boolean) {
    const stroke = this.farmStroke;
    if (!stroke || !this.farmMode || this.action && !isFarmAction(this.action.kind)) return;
    const hit = this.pointerHits(clientX, clientY).plots[0];
    if (hit?.plotId === undefined || stroke.visited.has(hit.plotId)) return;
    const plot = this.state?.plots.find(item => item.id === hit.plotId);
    if (swiping && (!plot || !this.eligibleFarmPlot(plot))) return;
    stroke.visited.add(hit.plotId);
    this.focus('farm'); this.onSelect('farm', hit.plotId);
  }

  private rawP(u:number,v:number,z=0):Point { return [480+u*.91-v*.67,420+u*.34+v*.47-z]; }
  private p(u: number, v: number, z = 0): Point { return this.rawP(u,v,z+(this.renderFloor-1)*176); }
  private poly(points: Point[], fill: string, stroke = '#586759', weight = 1.7) {
    const c = this.ctx;
    c.beginPath(); points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath();
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = weight; c.lineJoin = 'round'; c.stroke(); }
  }
  private line(points: Point[], color: string, width = 1.6) {
    const c = this.ctx; c.beginPath(); points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
    c.strokeStyle = color; c.lineWidth = width; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke();
  }
  private ellipse(x: number, y: number, rx: number, ry: number, fill: string, stroke = '', weight = 1.5) {
    const c = this.ctx; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = weight; c.stroke(); }
  }
  private waterDrop(x: number, y: number, size: number) {
    const c = this.ctx; c.beginPath(); c.moveTo(x, y - size);
    c.bezierCurveTo(x + size, y, x + size * .6, y + size * .6, x, y + size * .6);
    c.bezierCurveTo(x - size * .6, y + size * .6, x - size, y, x, y - size);
    c.fillStyle = '#9dd7e9'; c.fill(); c.strokeStyle = '#578da8'; c.lineWidth = 1.1; c.stroke();
    this.line([[x - size * .3, y], [x - size * .2, y + size * .23]], '#edfbff', 1.5);
  }
  private round(x: number, y: number, width: number, height: number, radius: number, fill: string, stroke = '') {
    const c = this.ctx; c.beginPath(); c.roundRect(x, y, width, height, radius); c.fillStyle = fill; c.fill();
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = 1.8; c.stroke(); }
  }
  private label(text: string, x: number, y: number, size: number, color: string, weight = 600, align: CanvasTextAlign = 'center') {
    this.ctx.fillStyle = color; this.ctx.font = `${weight} ${size}px "Noto Sans KR Variable", system-ui, sans-serif`;
    this.ctx.textAlign = align; this.ctx.fillText(text, x, y);
  }
  private resourceIllustration(resource: string, x: number, y: number, size: number) {
    if (!this.itemAtlas.complete || !this.itemAtlas.naturalWidth) return;
    const cell = ({ wood: 0, scrap: 1, food: 2, water: 3 } as Record<string, number>)[resource];
    if (cell === undefined) return;
    const source = this.itemAtlas.naturalWidth / 4;
    this.ctx.drawImage(this.itemAtlas, cell * source, 0, source, source, x - size / 2, y - size / 2, size, size);
  }
  private box(u: number, v: number, z: number, w: number, d: number, h: number, top: string, front: string, side: string, outline = '#68705b') {
    const faces: [Point, Point, Point, Point][] = [
      [this.p(u, v + d, z), this.p(u + w, v + d, z), this.p(u + w, v + d, z + h), this.p(u, v + d, z + h)],
      [this.p(u + w, v, z), this.p(u + w, v + d, z), this.p(u + w, v + d, z + h), this.p(u + w, v, z + h)],
      [this.p(u, v, z + h), this.p(u + w, v, z + h), this.p(u + w, v + d, z + h), this.p(u, v + d, z + h)],
    ];
    const material = ['#557770', '#7ca493', '#799181'].includes(top) ? 'metal' : 'wood';
    for (let i = 0; i < faces.length; i++) {
      this.poly(faces[i], [front, side, top][i], '', 0);
      paintWorldQuad(this.ctx, material, faces[i], [.22, .1, -.04][i]);
      this.poly(faces[i], '', outline, .95);
    }
  }
  private seed(i: number) { const n = Math.sin(i * 78.233 + 13.17) * 43758.5453; return n - Math.floor(n); }

  private ease(value: number) { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); }
  private actionProgress() { return this.action ? Math.max(0, Math.min(1, (this.action.elapsed - this.action.walk) / this.action.work)) : 0; }
  private navigationWorld(radius=HERO_BODY_RADIUS,actors=this.physicalActors().filter(actor=>actor.id!=='hero')): NavigationWorld {
    return createNavigationWorld(this.state?.deckLevel ?? 1,this.state?.plots.length ?? 3,
      this.state ? getSettlement(this.state).buildings.map(building => building.slot) : [],
      {floors:Array.from({length:this.state?getTruckFloorCount(this.state):1},(_,i)=>(i+1)as TruckFloor),activeFloor:this.activeFloor,
        home:this.state?getHomeLocation(this.state):{floor:1,slot:0},radius,actors});
  }
  private choreWorld() {
    const roster=getUnitRoster(this.state??{});
    return this.navigationWorld(HERO_BODY_RADIUS,this.physicalActors().filter(actor=>actor.id!=='hero'&&(this.reducedMotion||roster[actor.id as UnitId].health<=0)));
  }
  private ensurePets() {
    const team=this.state?getSelectedTeam(this.state):['dog','cat']as UnitId[];
    team.forEach((id,index)=>{if(this.petMotion.has(id))return;const scale=this.petScale(id),radius=getPetGroundRadius(id,scale),actors=this.physicalActors();
      const motion=createPetPatrol(id,this.navigationWorld(radius,actors),this.currentHeroLocation(),actors,index,scale);if(motion)this.petMotion.set(id,motion);});
  }
  private advancePets(delta:number) {
    this.ensurePets();const roster=getUnitRoster(this.state??{}),team=this.state?getSelectedTeam(this.state):['dog','cat']as UnitId[];
    for(const id of team){const motion=this.petMotion.get(id);if(!motion)continue;
      if(roster[id].health<=0){motion.speed=0;motion.blend=0;continue;}
      const actors=this.physicalActors().filter(actor=>actor.id!==id);
      const world=this.navigationWorld(motion.radius,actors),hero=this.currentHeroLocation(),yielding=this.petYields.get(id);
      if(yielding){
        const target=yielding.route.target;
        if(!motion.route&&motion.location.surface===target.surface&&motion.location.floor===target.floor&&Math.hypot(motion.location.point[0]-target.point[0],motion.location.point[1]-target.point[1])<.1){
          this.petYields.delete(id);
        }else{
          // An explicit corridor exit has priority until its actual feet arrive.
          // Following the hero's new floor must not cancel it halfway out.
          motion.desiredFloor=hero.floor??1;
          const key=JSON.stringify([world.floors,world.obstacles,world.links,world.road]);
          if(motion.route!==yielding.route||key!==motion.worldKey){
            const blocker=actors.find(actor=>motion.blockedReason===`actor:${actor.id}`);
            if(blocker)this.tryPetYield(blocker,[...yielding.reserved,motion.location,target],Math.max(motion.radius,yielding.reservedRadius));
            if(motion.retryRemaining>0){motion.retryRemaining=Math.max(0,motion.retryRemaining-delta);motion.speed=0;motion.blend=Math.max(0,motion.blend*(1-Math.min(1,delta*10)));continue;}
            const route=planNavigation(world,motion.location,target)??planYieldNavigation(world,motion.location,yielding.reserved,yielding.reservedRadius);
            if(!route){motion.retryRemaining=.35;motion.speed=0;motion.blend=Math.max(0,motion.blend*(1-Math.min(1,delta*10)));continue;}
            yielding.route=route;motion.route=route;motion.elapsed=0;motion.retryRemaining=0;motion.pauseRemaining=0;motion.blockedReason=null;motion.worldKey=key;
          }
        }
      }
      stepPetPatrol(motion,world,hero,actors,delta,{reducedMotion:this.reducedMotion});
      if(this.petYields.has(id)||motion.location.surface==='ladder'
        ||motion.blockedReason!=='no-clear-patrol-route'&&!motion.blockedReason?.startsWith('actor:'))continue;
      // A resident trying to follow an occupied stair must clear its own landing
      // before the current climber reaches it, without replacing that climber's exit.
      for(const actor of actors){
        const owner=this.petMotion.get(actor.id as UnitId),lease=this.petYields.get(actor.id as UnitId);
        if(!owner||!lease||roster[owner.id].health<=0||owner.location.surface!=='ladder'
          ||motion.blockedReason!=='no-clear-patrol-route'&&motion.blockedReason!==`actor:${owner.id}`)continue;
        const link=world.links.find(link=>link.id===owner.location.link),floor=motion.location.surface==='road'?0:motion.location.floor??1,
          entry=link&&(floor===link.lower?link.points[0]:floor===link.upper?link.points[link.points.length-1]:undefined);
        if(!entry||Math.hypot(motion.location.point[0]-entry[0],motion.location.point[1]-entry[1])>=motion.radius+owner.radius+2)continue;
        this.tryPetYield({id,location:motion.location,radius:motion.radius},[...lease.reserved,owner.location,lease.route.target],Math.max(owner.radius,lease.reservedRadius));
        if(this.petYields.has(id))break;
      }
    }
  }
  private drawPets(onDeck:boolean) {
    this.ensurePets();const roster=getUnitRoster(this.state??{}),team=this.state?getSelectedTeam(this.state):['dog','cat']as UnitId[],telemetry:unknown[]=[];
    for(const id of team){const motion=this.petMotion.get(id);if(!motion)continue;
      const location=motion.location,[x,y]=location.point,visible=(location.floor??1)===this.activeFloor;
      const options:CompanionOptions={id,x,y,scale:this.petScale(id),time:this.reducedMotion?0:this.time,facing:motion.facing,
        pose:roster[id].health<=0?'down':motion.speed>.05&&!motion.turnRemaining?'walk':'idle',
        gait:{distance:motion.distance,speed:motion.speed,heading:motion.heading,blend:motion.blend,facingBlend:motion.facingBlend,reducedMotion:this.reducedMotion}};
      if(visible&&(onDeck?location.surface==='deck':location.surface!=='deck')){drawCompanion(this.ctx,options);this.hits.push({kind:'pet',x,y:y-14,radius:24});this.pulse('pet',x,y-15,26);}
      telemetry.push({id,x,y,visible,scale:options.scale,floor:location.floor??1,surface:location.surface,link:location.link??null,
        body:{x,y,radius:motion.radius,floor:location.floor??1,surface:location.surface,link:location.link??null},blockedReason:motion.blockedReason,
        facing:options.facing,pose:options.pose,turnRemaining:motion.turnRemaining,gait:options.gait,sample:sampleCompanionGait(id,options.gait!,options.scale),contacts:companionPawContacts(options)??null});
    }
    this.canvas.dataset.petMotion=JSON.stringify(telemetry);
  }
  private currentHeroLocation(): NavigationLocation {
    const action=this.action;
    if(!action)return {...this.heroLocation,point:[...this.heroLocation.point]};
    if(action.elapsed<action.walk)return sampleNavigation(action.navigation,action.elapsed).location;
    if(action.elapsed>action.walk+action.work)return sampleNavigation(action.navigation,action.elapsed-action.walk-action.work,true).location;
    return {...action.navigation.target,point:[...action.navigation.target.point]};
  }
  private walkTo(target: NavigationLocation) {
    if(!this.walkingEnabled||this.action||this.suspended||this.disposed||this.constructionMode||this.houseMoveMode||this.planningMode||this.selectedFacilityId!==null)return;
    const navigation=planNavigation(this.navigationWorld(),this.heroLocation,target)
      ??planNavigation(this.choreWorld(),this.heroLocation,target);
    if(!navigation)return;
    if(navigation.motion.duration<.001){this.stopWalking();return;}
    this.holdCamera();
    this.freeWalk={navigation,elapsed:0,gaitOffset:this.gaitDistance,blockedFor:0,retryFor:0,reroutes:0};
    this.lastFrame=performance.now();this.publishWalking();this.render();
  }
  private publishWalking() {
    const hero=this.heroState(),location=this.currentHeroLocation(),walking=this.freeWalk,world=this.navigationWorld();
    const point=(p:Point)=>({x:p[0],y:p[1]});
    const corners=(r:{left:number;top:number;right:number;bottom:number})=>[[r.left,r.top],[r.right,r.top],[r.right,r.bottom],[r.left,r.bottom]]as Point[];
    this.canvas.dataset.freeMovement=JSON.stringify({moving:walking!==null,enabled:this.walkingEnabled,surface:location.surface,floor:location.floor??1,activeFloor:this.activeFloor,link:location.link??null,blockedReason:this.blockedReason,
      body:{...point(hero.point),radius:HERO_BODY_RADIUS,floor:location.floor??1,surface:location.surface,link:location.link??null},
      position:point(hero.point),target:walking?{...point(walking.navigation.target.point),surface:walking.navigation.target.surface,floor:walking.navigation.target.floor??1}:null,
      route:walking?walking.navigation.points.map((p,index)=>({...point(p),surface:index?walking.navigation.surfaces[index-1]:walking.navigation.start.surface,floor:index?walking.navigation.segments[index-1].toFloor:walking.navigation.start.floor??1})):[],
      frameAt:this.lastFrame,elapsed:walking?.elapsed??0,total:walking?.navigation.motion.duration??0,blockedFor:walking?.blockedFor??0,reroutes:walking?.reroutes??0,pose:hero.pose,facing:hero.facing,climbing:hero.climbing??null,gaitDistance:this.gaitDistance,
      world:{deckUV:world.deck,deckPolygon:corners(world.deck).map(p=>point(projectDeckPoint(p,this.activeFloor))),roadBounds:world.road,roadOuterBounds:world.roadOuter,
        floors:world.floors.map(f=>({id:f.id,outerPolygon:corners(f.outer).map(p=>point(projectDeckPoint(p,f.id))),deckPolygon:corners(f.deck).map(p=>point(projectDeckPoint(p,f.id)))})),
        links:world.links.map(l=>({...l,points:l.points.map(point)})),
        ladder:{entry:point(world.ladder.entry),top:point(world.ladder.top),bottom:point(world.ladder.bottom)},
        obstacles:world.obstacles.map(o=>{const polygon=corners(o.bounds).map(p=>o.surface==='deck'?projectDeckPoint(p,o.floor??1):p);return{surface:o.surface,floor:o.floor??1,kind:o.kind,
          bounds:{left:Math.min(...polygon.map(p=>p[0])),top:Math.min(...polygon.map(p=>p[1])),right:Math.max(...polygon.map(p=>p[0])),bottom:Math.max(...polygon.map(p=>p[1]))},polygon:polygon.map(point)};})}});
    const detail={moving:walking!==null,surface:location.surface},eventState=JSON.stringify(detail);
    if(eventState!==this.walkEventState){this.walkEventState=eventState;this.canvas.dispatchEvent(new CustomEvent('scenewalkchange',{detail}));}
  }
  private publishAction() {
    const action = this.action, hero = this.heroState();
    const round = (value: number) => Math.round(value * 1000) / 1000;
    const phase = !action ? 'idle' : action.elapsed < action.walk ? 'outbound'
      : action.elapsed < action.walk + action.work ? 'working' : 'returning';
    // Read-only scene telemetry also makes pauses, stairs and completion observable.
    this.canvas.dataset.sceneAction = JSON.stringify({ kind: action?.kind ?? null, phase,
      elapsed: round(action?.elapsed ?? 0), total: round(action?.duration ?? 0),
      stalled:round(action?.stalled??0),stallLimit:CHORE_STALL_TIMEOUT,
      walk: round(action?.walk ?? 0), work: round(action?.work ?? 0),
      from: action ? { x: action.navigation.start.point[0], y: action.navigation.start.point[1], surface: action.navigation.start.surface, floor:action.navigation.start.floor??1 } : null,
      returnPoint: action ? { x: action.navigation.returnLocation.point[0], y: action.navigation.returnLocation.point[1], surface: action.navigation.returnLocation.surface, floor:action.navigation.returnLocation.floor??1 } : null,
      returnWalk: round(action?.navigation.returnMotion.duration ?? 0),
      route: action?.navigation.points.map(point => ({ x: point[0], y: point[1] })) ?? [], climbSegments: action?.navigation.climbSegments ?? [],
      floor:this.currentHeroLocation().floor??1,blockedReason:this.blockedReason,facilitySlot: action?.facilitySlot ?? null, facilityId: action?.facilitySlot === undefined || !this.state ? null : getSettlement(this.state).buildings.find(building => building.slot === action.facilitySlot)?.id ?? null,
      pose: hero.pose, climbing: hero.climbing ?? null, progress: round(hero.progress),
      x: round(hero.point[0]), y: round(hero.point[1]), gaitTime: round(hero.time) });
    const progress = action ? Math.min(100, Math.floor(action.elapsed / action.duration * 100)) : 0;
    const detail = { kind: action?.kind ?? null, phase, progress, climbing: hero.climbing ?? null, pose: hero.pose };
    const eventState = JSON.stringify(detail);
    if (eventState !== this.actionEventState) {
      this.actionEventState = eventState;
      this.canvas.dispatchEvent(new CustomEvent('sceneactionchange', { detail }));
    }
  }
  private deckBounds(atLevel?: number) {
    let level = atLevel ?? this.state?.deckLevel ?? 1;
    if (atLevel === undefined && this.action?.kind === 'expand') level += this.ease(this.actionProgress());
    return navigationDeckBounds(level);
  }
  private plotPosition(index: number): Point {
    return FARM_POSITIONS[index] ?? FARM_POSITIONS[0];
  }
  private rampTop(): Point { return this.p(-225, this.deckBounds().front - 3, 95); }
  private rampBottom(): Point { return [140, 527]; }
  private heroState(): { point: Point; pose: HeroPose; facing: 1 | -1; progress: number; time: number; climbing?: 'up' | 'down' } {
    const action = this.action;
    if (!action) {
      if(this.freeWalk){const motion=sampleNavigation(this.freeWalk.navigation,this.freeWalk.elapsed);return {...motion,facing:motion.distance>.01?motion.facing:this.heroFacing,time:(this.freeWalk.gaitOffset+motion.distance)/86};}
      return { point: [...this.heroLocation.point], pose: this.heroLocation.surface==='ladder'?'climb':'idle', facing: this.heroFacing, progress: 0, time: this.reducedMotion || this.heroLocation.surface==='ladder' ? 0 : this.time };
    }
    if (action.elapsed < action.walk) {
      const motion = sampleNavigation(action.navigation, action.elapsed);
      return { ...motion, time: motion.distance / 86 };
    }
    if (action.elapsed > action.walk + action.work) {
      const motion = sampleNavigation(action.navigation, action.elapsed - action.walk - action.work, true);
      return { ...motion, time: motion.distance / 86 };
    }
    const poses: Record<SceneAction, HeroPose> = { plant: 'sow', water: 'water', harvest: 'harvest', chop: 'chop', expand: this.actionProgress() > .83 ? 'celebrate' : 'idle', expandFarm: this.actionProgress() > .83 ? 'celebrate' : 'gather', gather: 'gather', build: 'gather', upgrade: 'gather' };
    return { point: action.path[action.path.length - 1], pose: poses[action.kind], facing: action.kind === 'chop' || action.kind === 'gather' ? -1 : 1,
      progress: this.actionProgress(), time: (action.elapsed - action.walk) * GAME_SPEED_MULTIPLIER };
  }
  private heroOnDeck() {
    const location=this.currentHeroLocation();return location.surface==='deck'&&(location.floor??1)===this.activeFloor;
  }
  private slotBounds(slot: number): WorldBounds {
    const [u, v] = SETTLEMENT_SLOTS[getSlotLocalIndex(slot)], point = this.p(u, v, 95);
    const corners = [this.p(u - 65, v - 62, 95), this.p(u + 65, v - 62, 95), this.p(u + 65, v + 62, 95), this.p(u - 65, v + 62, 95)];
    return { left: Math.min(...corners.map(p => p[0]), point[0] - 75),
      right: Math.max(...corners.map(p => p[0]), point[0] + 75),
      top: Math.min(...corners.map(p => p[1]), point[1] - 174),
      bottom: Math.max(...corners.map(p => p[1]), point[1] + 26) };
  }
  private planningBounds(): WorldBounds | null {
    if (!this.planningMode) return null;
    const level = this.planningMode === 'expansion' ? this.planningLevel ?? this.state?.deckLevel ?? 1 : this.state?.deckLevel ?? 1;
    const slotCount = Math.min(SETTLEMENT_SLOTS.length, level * 2);
    const bounds = Array.from({ length: slotCount }, (_, slot) => this.slotBounds((this.activeFloor-1)*16+slot));
    if (this.planningMode === 'expansion') {
      const deck = this.deckBounds(level);
      const corners = [this.p(deck.left, deck.back, 95), this.p(deck.end, deck.back, 95), this.p(deck.end, deck.front, 95), this.p(deck.left, deck.front, 95)];
      bounds.push({ left: Math.min(...corners.map(p => p[0])) - 10, right: Math.max(...corners.map(p => p[0])) + 10,
        top: Math.min(...corners.map(p => p[1])) - 35, bottom: Math.max(...corners.map(p => p[1])) + 20 });
    }
    return { left: Math.min(...bounds.map(b => b.left)) - 22, top: Math.min(...bounds.map(b => b.top)) - 18,
      right: Math.max(...bounds.map(b => b.right)) + 22, bottom: Math.max(...bounds.map(b => b.bottom)) + 18 };
  }
  private viewportInsets(css: CSSStyleDeclaration): { top: number; bottom: number; left: number; right: number; width: number; height: number } {
    const top = Math.max(0, parseFloat(css.getPropertyValue('--world-safe-top')) || 0);
    let bottom = Math.max(0, parseFloat(css.getPropertyValue('--world-safe-bottom')) || 0), left = 0, right = 0;
    if (this.planningMode) {
      const canvas = this.canvas.getBoundingClientRect();
      const overlay = this.planningMode === 'placement' ? document.querySelector<HTMLElement>('#construction-bar')
        : document.querySelector<HTMLElement>('#modal-root:not([hidden]) .modal');
      if (overlay && !overlay.hidden) {
        const bounds = overlay.getBoundingClientRect();
        if (bounds.width > 0 && bounds.height > 0 && bounds.top < canvas.bottom && bounds.bottom > canvas.top) {
          // Landscape catalogues sit beside the map. Reserve their column instead
          // of shrinking a fully available left-hand map to a thin strip above it.
          if (bounds.width < canvas.width * .55 && (bounds.height > canvas.height * .45 || this.planningMode === 'placement' && canvas.width > canvas.height * 1.4) && bounds.left > canvas.left + canvas.width * .4) right = canvas.right - bounds.left + 12;
          else if (bounds.width < canvas.width * .55 && (bounds.height > canvas.height * .45 || this.planningMode === 'placement' && canvas.width > canvas.height * 1.4) && bounds.right < canvas.left + canvas.width * .6) left = bounds.right - canvas.left + 12;
          else bottom = Math.max(bottom, canvas.bottom - bounds.top + 12);
        }
      }
    }
    return { top, bottom, left, right, width: Math.max(100, this.width - left - right), height: Math.max(70, this.height - top - bottom) };
  }
  private updateCamera() {
    const { level, left, end, back, front } = this.deckBounds();
    const homeX = 480 - (level - 1) * 12, homeY = 350 + (level - 1) * 6-(this.activeFloor-1)*176;
    const showFarm = this.activeFloor===1&&(this.farmFocus || this.farmMode !== null);
    const farmCount = this.state?.plots.length ?? 3;
    const visibleFarmCount = Math.min(farmCount + 1, this.state ? getFarmCapacity(this.state) : 3, FARM_POSITIONS.length);
    const farmPoints = FARM_POSITIONS.slice(0, visibleFarmCount).map(([u, v]) => this.p(u + 35, v + 36, 112));
    const farmXs = farmPoints.map(point => point[0]), farmYs = farmPoints.map(point => point[1]);
    const farmWidth = Math.max(...farmXs) - Math.min(...farmXs) + 126;
    const farmHeight = Math.max(...farmYs) - Math.min(...farmYs) + 118;
    const farmCenter: Point = farmCount <= 3 ? [468, 350]
      : [(Math.min(...farmXs) + Math.max(...farmXs)) / 2, (Math.min(...farmYs) + Math.max(...farmYs)) / 2 - 5];
    let target = showFarm && this.zone === 'home' ? { x: farmCenter[0], y: farmCenter[1], zoom: 1.48 } : { x: homeX, y: homeY, zoom: 1 };
    if (this.zone === 'grove') target = { x: 180, y: 515, zoom: 2.15 };
    const action = this.action;
    // A stable whole-farm view lets additional taps queue while the hero works.
    if (action && !(this.farmMode && isFarmAction(action.kind))) {
      const entry = action.walk > 0 ? this.ease(action.elapsed / action.walk) : 1;
      const returnWalk = action.navigation.returnMotion.duration;
      const exit = returnWalk > 0 ? this.ease((action.duration - action.elapsed) / returnWalk) : 1;
      const amount = Math.min(entry, exit);
      const targetPoint = action.path[action.path.length - 1];
      const logging = action.kind === 'chop' || action.kind === 'gather';
      const focusX = logging ? 160 : targetPoint[0] + 35;
      const focusY = logging ? 523 : targetPoint[1] - 45;
      const zoom = action.kind === 'expand' ? 1.08 : logging ? 2.2 : 1.78;
      target = { x: target.x + (focusX - target.x) * amount, y: target.y + (focusY - target.y) * amount, zoom: target.zoom + (zoom - target.zoom) * amount };
    }
    const blend = this.reducedMotion ? .6 : .13;
    const minX = Math.min(-10, this.p(left, front)[0] - 28);
    const logicalWidth = Math.max(showFarm ? 860 : 920 + (level - 1) * 24, 828 - minX);
    const logicalHeight = 560 + Math.max(0, level - 3) * 17;
    // The same scene supports the phone HUD and the standalone art preview.
    const css = getComputedStyle(this.canvas);
    const insets = this.viewportInsets(css); this.safeViewport = insets;
    const safeTop = insets.top, availableHeight = insets.height, availableWidth = insets.width;
    let viewWidth = showFarm ? Math.max(logicalWidth, farmWidth * 1.48) : logicalWidth;
    let viewHeight = showFarm ? Math.max(logicalHeight, farmHeight * 1.48) : logicalHeight;
    if (!showFarm && this.zone === 'home' && (!this.action || this.action.kind === 'expand')) {
      const corners = [this.p(left, back, 94), this.p(end, back, 94), this.p(end, front, 94), this.p(left, front, 94)];
      const cabin = this.p(end + 95, (back + front) / 2, -12);
      let xs = corners.map(point => point[0]), ys = corners.map(point => point[1]);
      xs.push(cabin[0] - 130, cabin[0] + 130); ys.push(cabin[1] + 71);
      let minViewX = Math.min(...xs) - 32, maxViewX = Math.max(...xs) + 24;
      let minViewY = Math.min(...ys) - 98, maxViewY = Math.max(...ys) + 28;
      viewWidth = maxViewX - minViewX; viewHeight = maxViewY - minViewY;
      const center: Point = [(minViewX + maxViewX) / 2, (minViewY + maxViewY) / 2];
      const facility = this.selectedFacilityId === null || this.constructionMode || !this.state ? undefined : getSettlement(this.state).buildings.find(building => building.id === this.selectedFacilityId);
      const selectedPoint = facility ? this.p(...SETTLEMENT_SLOTS[getSlotLocalIndex(facility.slot)], 95) : null;
      // Expanded villages are explored by panning. Keep the resident's garden in
      // the home view rather than pulling the camera toward a distant truck cab.
      const gardenHomeX = Math.min(center[0], farmCenter[0] + (level > 1 ? 72 : 0));
      const targetX = this.constructionMode ? center[0] : selectedPoint?.[0] ?? gardenHomeX;
      const targetY = this.constructionMode ? center[1] : selectedPoint ? selectedPoint[1] - 52 : center[1];
      const desiredZoom = facility ? 1.35 : 1;
      target = { x: targetX, y: targetY, zoom: desiredZoom };
    }
    // A whole-deck fit made an eighteen-bed village shrink to finger-inaccessible
    // miniatures. At phone widths the home view now keeps a readable village scale;
    // the same drag/pinch camera exposes the rest of the expanded deck.
    if (this.zone === 'home' && !showFarm) {
      viewWidth = Math.min(viewWidth, Math.max(700, this.width / 1.05));
      viewHeight = Math.min(viewHeight, viewWidth * availableHeight / this.width);
    }
    const planning = this.planningBounds();
    if (planning) {
      viewWidth = planning.right - planning.left;
      viewHeight = planning.bottom - planning.top;
      target = { x: (planning.left + planning.right) / 2, y: (planning.top + planning.bottom) / 2, zoom: 1 };
    }
    // Keep the viewport as well as the camera fixed after a manual move. An action
    // starting or ending must not silently change the map's scale under the finger.
    if (this.manualViewport) [viewWidth, viewHeight] = this.manualViewport;
    this.cameraViewport = [viewWidth, viewHeight];
    // One user-controlled magnification works on the truck, farm, grove and during chores.
    this.mapPanLimit = [viewWidth * .6, viewHeight * .6];
    this.mapPan = [Math.max(-this.mapPanLimit[0], Math.min(this.mapPanLimit[0], this.mapPan[0])),
      Math.max(-this.mapPanLimit[1], Math.min(this.mapPanLimit[1], this.mapPan[1]))];
    target.x += this.mapPan[0]; target.y += this.mapPan[1]; target.zoom *= this.mapZoom;
    // Explicit navigation or the reset control returns to automatic camera focus.
    if (this.cameraFocusRequested && !this.manualViewport) {
      this.camera = { ...target }; this.cameraFocusRequested = false;
    }
    if (!this.manualViewport && !this.pinch.active) {
      this.camera.x += (target.x - this.camera.x) * blend;
      this.camera.y += (target.y - this.camera.y) * blend;
      this.camera.zoom += (target.zoom - this.camera.zoom) * blend;
    }
    this.scale = Math.min(availableWidth / viewWidth, availableHeight / viewHeight) * this.camera.zoom;
    this.dx = insets.left + availableWidth / 2 - this.camera.x * this.scale;
    this.dy = safeTop + availableHeight / 2 - this.camera.y * this.scale;
  }

  private render() {
    this.renderFloor=this.activeFloor;
    const c = this.ctx;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, this.width, this.height);
    c.fillStyle = '#776c47'; c.fillRect(0, 0, this.width, this.height);
    this.updateCamera();
    c.translate(this.dx, this.dy); c.scale(this.scale, this.scale);
    this.hits = [];
    this.heroDrawn = false;
    this.environment();
    this.truck();
    this.foreground();
    if(this.activeFloor===1)this.loggingGrove();
    this.drawPets(false);
    if(this.freeWalk&&(this.freeWalk.navigation.target.floor??1)===this.activeFloor){const target=this.freeWalk.navigation.target.point;this.ellipse(target[0],target[1],9,4,'#f8f0bf60','#ffe9a3',1.5);}
    this.hero();
    this.workEffects();
    this.fireflies();
    this.publishGeometry();
    this.publishAction();
    this.publishWalking();
    this.canvas.dataset.sceneHits=JSON.stringify(this.hits.map(hit=>({...hit})));
    // Assets are cached before the next frame; the fallback never hides interactions.
    if (!worldArtReady()) this.label('그림을 불러오는 중…', 470, 45, 13, '#fff2d0');
  }

  private environment() {
    const backdrop = this.ctx.createLinearGradient(0, -1100, 0, 1200);
    backdrop.addColorStop(0, '#f0edd3'); backdrop.addColorStop(.4, '#e7e5cb'); backdrop.addColorStop(1, '#84956d');
    this.ctx.fillStyle = backdrop; this.ctx.fillRect(-3000, -2500, 7000, 5000);
    const road = worldImages.road;
    const left = -this.dx / this.scale, right = (this.width - this.dx) / this.scale;
    const top = -this.dy / this.scale, bottom = (this.height - this.dy) / this.scale;
    // Fit the original painting beyond every camera edge when the expanded map zooms out.
    const coverage = Math.max(1, (500 - left) / 1100, (right - 500) / 1100, (298.335 - top) / 733.335, (bottom - 298.335) / 733.335);
    if (coverage > 1 && road.complete && road.naturalWidth) {
      this.ctx.drawImage(road, 500 - 1100 * coverage, 298.335 - 733.335 * coverage, 2200 * coverage, 1466.67 * coverage);
    } else if (!drawWorldRoad(this.ctx)) {
      const sky = this.ctx.createLinearGradient(0, -200, 0, 800); sky.addColorStop(0, '#efe8cc'); sky.addColorStop(1, '#7e8060');
      this.ctx.fillStyle = sky; this.ctx.fillRect(-1000, -600, 3000, 2000);
    }
    // A quiet road separates the playable wooden village from its backdrop.
    this.ctx.fillStyle = '#e8ead247'; this.ctx.fillRect(-1000, -600, 3000, 2000);
    const night=skyNightAmount(this.state?.minutes??660);
    if(night>0){this.ctx.fillStyle=`rgba(19,31,57,${night*.58})`;this.ctx.fillRect(left,top,right-left,bottom-top);}
    const canvasBounds=this.canvas.getBoundingClientRect();
    let skyInset=this.safeViewport.top;
    for(const element of document.querySelectorAll<HTMLElement>('.scene-top,.truck-floor-controls,.settlement-objective')){
      const bounds=element.getBoundingClientRect();
      if(bounds.width&&bounds.height&&bounds.bottom>canvasBounds.top&&bounds.top<canvasBounds.bottom)
        skyInset=Math.max(skyInset,bounds.bottom-canvasBounds.top);
    }
    const skyTop=(Math.min(this.height-52,skyInset+12)-this.dy)/this.scale,
      skyBottom=skyTop+Math.min(96,this.height*.18)/this.scale;
    this.canvas.dataset.skyBirds=JSON.stringify(drawSkyBirds(this.ctx,{timeSeconds:this.time/GAME_SPEED_MULTIPLIER,viewport:{left,top,right,bottom},skyTop,skyBottom,night,reducedMotion:this.reducedMotion}));
    // Foreground trees share the same painted line work as the survivors.
    this.tree(72, 226, 1.04); this.tree(25, 307, .72); this.tree(891, 196, .88);
    this.tree(1006, 252, .95);
    this.roadSign(788, 202);
    this.zombie(88 + Math.sin(this.time * .14) * 6, 423, .75, .2);
    this.zombie(970, 507 + Math.sin(this.time * .16) * 5, .55, 1.2);
  }

  private grass(x: number, y: number, s: number) {
    drawWorldSprite(this.ctx, 'forest', x, y + 4 * s, 37 * s, 31 * s, .88);
  }
  private rock(x: number, y: number, s: number) {
    drawWorldSprite(this.ctx, 'forest', x, y + 6 * s, 59 * s, 50 * s);
  }
  private tree(x: number, y: number, s: number) {
    const c = this.ctx; c.save(); c.translate(x, y); c.rotate(Math.sin(this.time * .65 + x) * .002);
    drawWorldSprite(c, 'tree', 0, 0, 111 * s, 146 * s); c.restore();
  }
  private roadSign(x: number, y: number) {
    this.line([[x - 26, y + 42], [x - 26, y - 14]], '#4b4b32', 4);
    this.line([[x + 36, y + 49], [x + 36, y - 8]], '#4b4b32', 4);
    const sign: [Point, Point, Point, Point] = [[x - 55, y - 61], [x + 71, y - 44], [x + 71, y + 8], [x - 55, y - 9]];
    this.poly(sign, '#31594a', '', 0); paintWorldQuad(this.ctx, 'metal', sign, .14); this.poly(sign, '', '#d9b873', 2);
    this.ctx.save(); this.ctx.transform(1, .135, 0, 1, x, y);
    this.label('서울  SEOUL', 8, -31, 12, '#fff0ca', 700);
    this.label('↑  12 km', 8, -12, 10, '#efdfb5', 600);
    this.ctx.restore(); this.grass(x - 30, y + 43, 1.3);
  }

  private zombie(x: number, y: number, s: number, phase: number) {
    drawZombie(this.ctx, { x, y, scale: s * .49, time: this.reducedMotion ? phase : this.time + phase, kind: 'walker', pose: 'walk', facing: phase > 1 ? -1 : 1, alpha: .76 });
  }

  private truck() {
    const { level, left, end, back, front: deckFront } = this.deckBounds();
    const floorArt={project:(u:number,v:number,z:number)=>this.rawP(u,v,z),bounds:{left,end,back,front:deckFront},
      floors:Array.from({length:this.state?getTruckFloorCount(this.state):1},(_,i)=>({id:(i+1)as TruckFloor,z:94+i*176})),selectedFloor:this.activeFloor,
      stairways:Array.from({length:(this.state?getTruckFloorCount(this.state):1)-1},(_,i)=>{const stair=getFloorStairs(this.state?.deckLevel??1,(i+2)as 2|3);return{from:stair.lowerFloor,to:stair.upperFloor,top:stair.top,bottom:stair.bottom,reserved:stair.reserved};}),
      railGaps:this.activeFloor===1?[{edge:'front' as const,from:-270,to:-180}]:[],night:skyNightAmount(this.state?.minutes??660)};
    drawTruckFloor(this.ctx,{...floorArt,pass:'structure'});
    this.renderFloor=1;
    this.poly([this.p(left - 8, back - 6, -45), this.p(end + 118, back - 6, -45), this.p(end + 118, deckFront + 25, -45), this.p(left - 8, deckFront + 25, -45)], '#26372742', '');
    this.box(left + 12, back + 10, -6, end - left + 34, deckFront - back - 19, 63, '#557770', '#3c6660', '#38625b', '#3e3328');
    this.box(left + 15, back + 8, 31, end - left - 28, deckFront - back - 8, 47, '#7ca493', '#77a996', '#5e8c7f', '#3e3328');
    for (let u = left + 25; u < end - 65; u += 90) {
      const face: [Point, Point, Point, Point] = [this.p(u, deckFront + 1, 37), this.p(u + 71, deckFront + 1, 37), this.p(u + 71, deckFront + 1, 69), this.p(u, deckFront + 1, 69)];
      paintWorldQuad(this.ctx, 'metal', face, .08); this.poly(face, '', '#403524', .8);
      this.line([this.p(u + 29, deckFront + 2, 60), this.p(u + 43, deckFront + 2, 60)], '#e2ba65', 2.4);
    }
    this.line([this.p(left + 15, deckFront + 2, 77), this.p(end, deckFront + 2, 77)], '#d1a24f', 3);
    for (let u = left + 62; u < end + 30; u += 136) this.wheel(u, deckFront + 9);
    this.renderFloor=this.activeFloor;
    this.box(left, back, 78, end - left, deckFront - back, 15, '#e4c28c', '#bc9669', '#caab78', '#655037');
    const deck: [Point, Point, Point, Point] = [this.p(left + 1, back + 1, 94), this.p(end, back + 1, 94), this.p(end, deckFront, 94), this.p(left + 1, deckFront, 94)];
    this.poly(deck, '#d8ab64', '', 0); paintWorldQuad(this.ctx, 'wood', deck, -.025); this.poly(deck, '', '#715135', 1.6);
    for (let v = back + 24; v < deckFront; v += 24) {
      this.line([this.p(left + 1, v, 94), this.p(end, v, 94)], '#72533155', .9);
      this.line([this.p(left + 1, v + 1, 94), this.p(end, v + 1, 94)], '#ffe1a34d', .7);
    }
    for (let v = 141; v < deckFront; v += 36) this.line([this.p(left + 1, v, 94), this.p(end, v, 94)], '#80613c', 1.5);
    drawTruckFloor(this.ctx,{...floorArt,pass:'back'});
    this.expansionDeck();
    this.bunting(); this.settlement(); this.house();if(this.activeFloor===1)this.farm();
    if (this.heroOnDeck()) this.hero();
    drawWorldSprite(this.ctx, 'crate', ...this.p(-207, -53, 96), 26, 27);
    this.drawPets(true);
    this.renderFloor=1;this.cabin();this.renderFloor=this.activeFloor;
    drawTruckFloor(this.ctx,{...floorArt,pass:'front'});
    this.flowerPot(left + 25, deckFront - 21, 95, '#e5a082');
    this.flowerPot(end - 16, deckFront - 16, 95, '#80a896');
    if(this.activeFloor===1)this.ramp();
    if (level >= 2) {
      const q = this.p(70, deckFront - 17, 96);
      this.label(`LIVING DECK · LV.${Math.floor(level)}`, q[0], q[1], 9, '#694f2c', 700);
    }
    if (this.action?.kind === 'expand') this.buildingDeck();
    const center = this.p(end + 50, (back + deckFront) / 2, 120);
    this.hits.unshift({kind: 'truck', x: center[0], y: center[1] + 55, radius: 97});
    this.pulse('truck', center[0], center[1] + 50, 71);
  }

  private expansionDeck() {
    if (this.expansionPreview === null || this.expansionPreview <= (this.state?.deckLevel ?? 1)) return;
    const current = this.deckBounds(), next = this.deckBounds(this.expansionPreview);
    const rectangles = [
      [next.left, next.back, next.end, current.back], [next.left, current.front, next.end, next.front],
      [next.left, current.back, current.left, current.front], [current.end, current.back, next.end, current.front],
    ];
    this.ctx.save(); this.ctx.setLineDash([9, 5]);
    for (const [left, back, right, front] of rectangles) {
      if (right <= left || front <= back) continue;
      this.poly([this.p(left, back, 96), this.p(right, back, 96), this.p(right, front, 96), this.p(left, front, 96)], '#c7ec9690', '#c4e9a2', 2.2);
    }
    this.poly([this.p(next.left, next.back, 96), this.p(next.end, next.back, 96), this.p(next.end, next.front, 96), this.p(next.left, next.front, 96)], '', '#f3f4b8', 3);
    this.ctx.restore();
    const point = this.p((next.left + next.end) / 2, (next.back + current.back) / 2, 103);
    const pixel = 1 / this.scale;
    this.round(point[0] - 58 * pixel, point[1] - 12 * pixel, 116 * pixel, 24 * pixel, 10 * pixel, '#e7f4cded', '#91af74');
    this.label(`확장 후 데크 Lv.${this.expansionPreview}`, point[0], point[1] + 4 * pixel, 10 * pixel, '#577244', 800);
  }

  private wheel(u: number, v: number) {
    const [x, y] = this.p(u, v, -4);
    drawWorldSprite(this.ctx, 'wheel', x + 1, y + 30, 55, 72);
  }

  private cabin() {
    const { end, back, front } = this.deckBounds();
    const [x, y] = this.p(end + 95, (back + front) / 2, -12);
    drawWorldSprite(this.ctx, 'cabin', x + 4, y + 61, 230, 208);
  }

  private house() {
    const home=this.state?getHomeLocation(this.state):{floor:1 as const,slot:0};
    if(this.houseMoveMode&&this.state)for(const slot of getHomeSlots(this.state,this.activeFloor)){
      const footprint=getHouseFootprint({floor:this.activeFloor,slot}),[u,v]=getHousePosition({floor:this.activeFloor,slot}),p=this.p(u,v,95),available=isHomeSlotAvailable(this.state,{floor:this.activeFloor,slot})&&this.canPlaceHome(this.activeFloor,slot);
      this.poly([this.p(footprint.left,footprint.top,95),this.p(footprint.right,footprint.top,95),this.p(footprint.right,footprint.bottom,95),this.p(footprint.left,footprint.bottom,95)],available?'#c4e4a873':'#dba99552',available?'#85ab6a':'#b98060',2);
      this.label(`집 자리 ${slot+1}`,p[0],p[1]+8,12,'#536b47',700);
      this.hits.push({kind:'house-slot',x:p[0],y:p[1],radius:47,plotId:slot});
      if(slot===this.selectedHouseSlot)drawWorldSprite(this.ctx,'cottage',p[0],p[1]+5,122,143,.52);
    }
    if(home.floor!==this.activeFloor)return;
    const [u,v]=getHousePosition(home),[x,y]=this.p(u,v,94);
    drawWorldSprite(this.ctx, 'cottage', x, y + 5, 122, 143);
    if(!this.houseMoveMode&&!this.constructionMode)this.hits.push({kind:'house',x,y:y-58,radius:0,bounds:[x-61,y-138,x+61,y+8]});
    for (let i = 0; i < 3; i++) {
      const age = (this.time * .24 + i / 3) % 1, r = 3 + age * 6;
      this.ctx.globalAlpha = (1 - age) * .21;
      this.ellipse(x - 20 + Math.sin(age * 4) * 5, y - 129 - age * 29, r, r * .72, '#fff1d7');
    }
    this.ctx.globalAlpha = 1;
  }

  private settlement() {
    const state = this.state, buildings = state ? getSettlement(state).buildings : [];
    const selectedType = this.constructionMode;
    for (let local = 0; local < SETTLEMENT_SLOTS.length; local++) {
      const slot=(this.activeFloor-1)*16+local,open=this.state?getFloorSlots(this.state,this.activeFloor).includes(slot):local<2;
      const previewSlot = this.expansionPreview !== null && local < this.expansionPreview * 2;
      if (!open && !previewSlot) continue;
      const [u, v] = SETTLEMENT_SLOTS[local], point = this.p(u, v, 95);
      const building = buildings.find(item => item.slot === slot);
      const selected = selectedType !== null && slot === this.selectedSlot;
      const valid = open && (this.state?isFacilitySlotAvailable(this.state,slot,this.movingBuildingId??undefined):!building)&&this.canPlaceFacility(slot)
        && (!selectedType || (state?.deckLevel ?? 1) >= BUILDINGS[selectedType].unlockLevel);
      const corners: [Point, Point, Point, Point] = [this.p(u - 65, v - 62, 95), this.p(u + 65, v - 62, 95), this.p(u + 65, v + 62, 95), this.p(u - 65, v + 62, 95)];
      this.ctx.save();
      if (!open || selectedType && !building) this.ctx.setLineDash([6, 5]);
      const edge = selected ? valid ? '#86bb7c' : '#d09a83' : this.planningMode && open ? '#d5eb99' : open ? '#ad977164' : '#8b9a8780';
      this.poly(corners, selected ? valid ? '#d2efb077' : '#dbbaa22e' : this.planningMode && open ? '#eff8c44a' : open ? '#fff3cb1c' : '#c5d6bf30', edge, selected || this.planningMode ? 2.5 : 1.25);
      this.ctx.restore();
      if (!building) {
        const badgeSize = 12 / this.scale;
        this.label(open ? '+' : '⌑', point[0], point[1] - 2, badgeSize, open ? '#69895c' : '#74856e', 500);
        if (selectedType || this.planningMode) this.label(open ? `${local + 1}번 자리` : `데크 Lv.${Math.floor(local / 2) + 1}`, point[0], point[1] + 12 / this.scale, 10 / this.scale, open ? '#705d3b' : '#60735b', 600);
      }
      this.hits.push({ kind: 'build-slot', x: point[0], y: point[1], radius: selectedType || this.planningMode ? 57 : 22 / this.scale, plotId: slot });
      if (selected && selectedType && valid) {
        const [width, height] = FACILITY_SIZE[selectedType];
        drawFacility(this.ctx, selectedType, point[0], point[1], width, height, .52);
      }
    }
    const ordered = buildings.filter(b=>getSlotFloor(b.slot)===this.activeFloor).sort((a,b)=>this.p(...SETTLEMENT_SLOTS[getSlotLocalIndex(a.slot)],95)[1]-this.p(...SETTLEMENT_SLOTS[getSlotLocalIndex(b.slot)],95)[1]);
    for (const building of ordered) {
      const point = this.p(...SETTLEMENT_SLOTS[getSlotLocalIndex(building.slot)], 95), [width, height] = FACILITY_SIZE[building.type];
      const selected = building.id === this.selectedFacilityId;
      if (selected) {
        this.ctx.save(); this.ctx.shadowColor = '#fff2a1'; this.ctx.shadowBlur = 14;
        this.ellipse(point[0], point[1] - 3, width * .56, 23, '#fbea9c45', '#ffefa4', 2.5); this.ctx.restore();
      }
      const alpha = building.id === this.movingBuildingId ? .4 : 1;
      if (facilityArtReady()) drawFacility(this.ctx, building.type, point[0], point[1], width, height, alpha, building.level);
      else drawWorldSprite(this.ctx, building.type === 'waterworks' ? 'tank' : building.type === 'greenhouse' ? 'solar' : 'furniture', point[0], point[1], width * .76, height * .76, alpha);
      this.hits.push({ kind: 'facility', x: point[0], y: point[1] - 44, radius: 61, plotId: building.id });
    }
    const shortNames: Record<BuildingType, string> = { workshop: '공방', kitchen: '부엌', waterworks: '정수소', greenhouse: '온실', watchtower: '감시소', petHouse: '보리 집' };
    for (const building of ordered) {
      const point = this.p(...SETTLEMENT_SLOTS[getSlotLocalIndex(building.slot)], 95), [, height] = FACILITY_SIZE[building.type];
      const pixel = 1 / this.scale, caption = `${shortNames[building.type]} ${building.level}`;
      if (building.id === this.selectedFacilityId || building.id === this.movingBuildingId) {
        this.round(point[0] - 37 * pixel, point[1] + 5 * pixel, 74 * pixel, 19 * pixel, 8 * pixel, '#fff9e9ed', '#b8ac85');
        this.label(caption, point[0], point[1] + 18 * pixel, 10 * pixel, '#53654b', 700);
      }
      // Placement previews own the map while building: production controls must
      // not cover a free slot or intercept a placement confirmation.
      if (!state || selectedType || this.planningMode) continue;
      const bubble: Point = [point[0], point[1] - height - 18];
      if (building.readyAt === null) {
        this.round(bubble[0] - 22 * pixel, bubble[1] - 19 * pixel, 44 * pixel, 38 * pixel, 12 * pixel, '#f3f3dcf2', '#b3b791');
        this.poly([[bubble[0] - 5 * pixel, bubble[1] - 10 * pixel], [bubble[0] + 7 * pixel, bubble[1] - 3 * pixel], [bubble[0] - 5 * pixel, bubble[1] + 4 * pixel]], '#6c925a', '', 0);
        this.label('생산', bubble[0], bubble[1] + 14 * pixel, 9 * pixel, '#596d49', 700);
        this.hits.push({ kind: 'facility-start', x: bubble[0], y: bubble[1], radius: 22 * pixel, plotId: building.id });
        continue;
      }
      const ready = state.totalMinutes >= building.readyAt;
      if (ready) {
        this.ctx.save(); this.ctx.shadowColor = '#3f4b2938'; this.ctx.shadowBlur = 7 * pixel; this.ctx.shadowOffsetY = 2 * pixel;
        this.round(bubble[0] - 24 * pixel, bubble[1] - 22 * pixel, 48 * pixel, 44 * pixel, 13 * pixel, '#fff1ba', '#b99b55');
        this.ctx.restore();
        const definition = BUILDINGS[building.type];
        this.resourceIllustration(definition.yieldResource, bubble[0] - 10 * pixel, bubble[1] - 5 * pixel, 25 * pixel);
        this.label(`+${definition.yieldAmount * building.level}`, bubble[0] + 10 * pixel, bubble[1] - 1 * pixel, 11 * pixel, '#68713e', 800);
        this.label('받기', bubble[0], bubble[1] + 15 * pixel, 9 * pixel, '#796638', 700);
        this.hits.push({ kind: 'facility-collect', x: bubble[0], y: bubble[1], radius: 24 * pixel, plotId: building.id });
      } else {
        const duration = building.readyAt - (building.startedAt ?? state.totalMinutes);
        const progress = duration > 0 ? Math.max(0, Math.min(1, (state.totalMinutes - (building.startedAt ?? state.totalMinutes)) / duration)) : 0;
        this.round(bubble[0] - 23 * pixel, bubble[1] - 15 * pixel, 46 * pixel, 30 * pixel, 10 * pixel, '#edf2ddf0', '#b1c0a0');
        this.label(formatGameDuration(building.readyAt - state.totalMinutes), bubble[0], bubble[1] + 1 * pixel, 11 * pixel, '#52714b', 700);
        this.round(bubble[0] - 17 * pixel, bubble[1] + 7 * pixel, 34 * pixel, 3 * pixel, 1.5 * pixel, '#687c5733');
        if (progress > 0) this.round(bubble[0] - 17 * pixel, bubble[1] + 7 * pixel, 34 * progress * pixel, 3 * pixel, 1.5 * pixel, '#88ae7c');
      }
    }
  }

  private farm() {
    const plots = this.state?.plots ?? [{ id: 1, plantedAt: null, watered: false }, { id: 2, plantedAt: null, watered: false }, { id: 3, plantedAt: null, watered: false }];
    const count = Math.min(plots.length, FARM_POSITIONS.length);
    const order = Array.from({ length: count }, (_, index) => index).sort((a, b) => {
      const [au, av] = this.plotPosition(a), [bu, bv] = this.plotPosition(b);
      return this.p(au, av)[1] - this.p(bu, bv)[1];
    });
    for (const i of order) {
      const [u, v] = this.plotPosition(i), plot = plots[i];
      const mid = this.p(u + 35, v + 36, 112);
      // A resident behind a planter belongs behind its wood and leaves as well.
      if (!this.heroDrawn && this.heroOnDeck() && this.heroState().point[1] <= mid[1] + 31) this.hero();
      // A painted empty planter provides warm woodgrain and rich detailed soil.
      drawWorldSprite(this.ctx, 'planter', mid[0], mid[1] + 31, 109, 71);
      const soil: [Point, Point, Point, Point] = [this.p(u + 6, v + 6, 106), this.p(u + 63, v + 6, 106), this.p(u + 63, v + 62, 106), this.p(u + 6, v + 62, 106)];
      if (plot.watered) {
        this.ctx.save(); this.ctx.globalAlpha = .25; this.poly(soil, '#251c12', '', 0); this.ctx.restore();
      }
      const queueIndex = this.queuedPlotIds.indexOf(plot.id);
      const working = this.action !== null && isFarmAction(this.action.kind) && this.action.plotIndex === i;
      const eligibleTarget = this.farmMode !== null && this.eligibleFarmPlot(plot);
      const waterTool = this.farmMode === 'water';
      const targetColor = waterTool ? '#a4d8ee' : this.farmMode === 'harvest' ? '#f5dc86' : '#bfdca2';
      if (plot.id === this.selectedPlotId || working || queueIndex >= 0 || eligibleTarget) {
        const color = working ? this.action?.kind === 'water' ? '#daf7ff' : '#ffec9a'
          : queueIndex >= 0 ? waterTool ? '#85c9e6' : '#ffce74'
          : plot.id === this.selectedPlotId ? waterTool ? '#d3f1fc' : '#ffec9a' : targetColor;
        this.ctx.save(); this.ctx.shadowColor = color; this.ctx.shadowBlur = working ? 10 : 5;
        if (queueIndex >= 0 && !working) this.ctx.setLineDash([5, 4]);
        this.poly([this.p(u, v, 108), this.p(u + 69, v, 108), this.p(u + 69, v + 68, 108), this.p(u, v + 68, 108)], waterTool ? '#aadfee24' : working ? '#ffe79d26' : '#bde39f16', color, working ? 3 : 2);
        this.ctx.restore();
      }
      const progress = this.state ? getCropProgress(this.state, plot) : 0;
      const cropId = getPlotCropId(plot);
      const cropPositions: Point[] = cropId === 'pumpkin' ? [[20, 19], [47, 28], [30, 48]]
        : cropId === 'corn' || cropId === 'tomato' || cropId === 'potato' ? [[18, 20], [45, 20], [18, 46], [45, 46]]
        : [[17, 15], [47, 15], [17, 33], [47, 33], [17, 51], [47, 51]];
      if (plot.plantedAt !== null) for (let k = 0; k < cropPositions.length; k++) {
        const [plantU, plantV] = cropPositions[k], [x, y] = this.p(u + plantU, v + plantV, 107);
        const mature = progress >= 1, medium = progress > .35;
        const growthScale = mature ? 1 : medium ? .7 + progress * .24 : .38 + progress * .8;
        const width = CROP_PLANT_SIZE[cropId][0] * growthScale, height = CROP_PLANT_SIZE[cropId][1] * growthScale;
        this.ctx.save(); this.ctx.translate(x, y); this.ctx.rotate(Math.sin(this.time * 1.1 + k + i) * .018);
        if (!drawCropSprite(this.ctx, cropId, 'plant', 0, 3, width, height)) drawWorldSprite(this.ctx, mature ? 'carrot' : medium ? 'carrotYoung' : 'sprout', 0, 3, width, height);
        this.ctx.restore();
      }
      if (eligibleTarget && !working) {
        const center = this.p(u + 34, v + 34, 115);
        this.ctx.save(); this.ctx.globalAlpha = queueIndex >= 0 ? .95 : .65;
        if (this.farmMode === 'plant') drawCropSprite(this.ctx, this.plantingCropId, 'seed', center[0], center[1] + 4, 18, 24);
        else {
          const hint = this.p(u + 53, v + 46, 125);
          this.ellipse(hint[0], hint[1], 10, 10, '#fff9e9e8', waterTool ? '#88bed5' : '#ccb16c', 1);
          if (waterTool) this.waterDrop(hint[0], hint[1] + 1, 7);
          else drawCropSprite(this.ctx, cropId, 'produce', hint[0], hint[1] + 8, 17, 17);
        }
        this.ctx.restore();
        if (queueIndex >= 0) {
          this.round(center[0] - 22, center[1] + 7, 44, 16, 8, waterTool ? '#d8eff9f0' : '#ffe9b6f0', waterTool ? '#75a8bb' : '#a7844a');
          this.label(`대기 ${queueIndex + 1}`, center[0], center[1] + 18, 9, waterTool ? '#406d82' : '#735935', 700);
        } else if (this.farmMode === 'plant') {
          this.label('+', center[0] + 15, center[1] + 4, 17, '#e7f4c8', 700);
        }
      }
      const marker = this.p(u + 63, v + 9, 107);
      this.line([[marker[0], marker[1]], [marker[0], marker[1] - 14]], '#ccae75', 2);
      this.round(marker[0] - 5, marker[1] - 21, 11, 8, 2, '#f1dbad', '#86673e');
      this.hits.push({kind: 'farm', x: mid[0], y: mid[1], radius: 45, plotId: plot.id});
      this.pulse('farm', mid[0], mid[1], 34);
      if (this.farmFocus || this.farmMode || plot.id === this.selectedPlotId) {
        const label = this.p(u + 11, v + 7, 123);
        this.ellipse(label[0], label[1], 9, 9, plot.id === this.selectedPlotId ? '#ffdf93' : '#fffae6', '#84613b', 1);
        this.label(String(i + 1), label[0], label[1] + 3.2, 10, '#4d462c');
      }
    }
    if (count < (this.state ? getFarmCapacity(this.state) : 3)) {
      const [u, v] = this.plotPosition(count), q = this.p(u + 35, v + 36, 112);
      const preparing = this.action?.kind === 'expandFarm';
      const c = this.ctx; c.save(); c.setLineDash([4, 5]);
      this.poly([this.p(u, v, 96), this.p(u + 69, v, 96), this.p(u + 69, v + 68, 96), this.p(u, v + 68, 96)], '#d4ddb13b', '#718653', 1.8); c.restore();
      if (preparing && this.action && this.action.elapsed > this.action.walk + this.action.work) {
        drawWorldSprite(c, 'planter', q[0], q[1] + 31, 109, 71);
      }
      if (!preparing) {
        const pixel = 1 / this.scale;
        this.ellipse(q[0], q[1], 13 * pixel, 13 * pixel, '#fff7dced', '#7e925e', 1.2 * pixel);
        this.label('+', q[0], q[1] + 5 * pixel, 22 * pixel, '#627b43', 500);
        this.label('밭 늘리기', q[0], q[1] + 24 * pixel, 8 * pixel, '#5d683e', 700);
        this.hits.push({kind: 'farm-expand', x: q[0], y: q[1], radius: 32});
      }
    }
  }

  private sprig(x: number, y: number, s: number, flower?: string) {
    drawWorldSprite(this.ctx, flower ? 'flowers' : 'sprout', x, y + 3, (flower ? 29 : 18) * s, (flower ? 30 : 29) * s);
  }

  private flowerPot(u: number, v: number, z: number, color: string) {
    const [x, y] = this.p(u, v, z);
    drawWorldSprite(this.ctx, 'flowers', x, y + 2, 31, 35);
    void color;
  }

  private railing(u: number, v: number, endU: number, endV: number, z: number, front: boolean) {
    const dist = Math.hypot(endU - u, endV - v), n = Math.max(1, Math.ceil(dist / 155)), high = front ? 24 : 35;
    for (let i = 0; i < n; i++) {
      const a = i / n, b = (i + 1) / n;
      drawWorldFence(this.ctx, this.p(u + (endU - u) * a, v + (endV - v) * a, z), this.p(u + (endU - u) * b, v + (endV - v) * b, z), high);
    }
  }

  private bunting() {
    const { left, end, back } = this.deckBounds();
    const a = this.p(left + 14, back + 8, 178), b = this.p(end - 20, back + 8, 158);
    this.line([this.p(end - 20, back + 8, 93), b], '#a58f67', 4);
    const c = this.ctx; c.beginPath(); c.moveTo(...a); c.quadraticCurveTo((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 42, ...b);
    c.strokeStyle = '#625137'; c.lineWidth = 1.2; c.stroke();
    const colors = ['#b86f44', '#ceac61', '#537e45', '#d5bd82', '#39654e'];
    for (let i = 1; i < 15; i++) {
      const t = i / 15;
      const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t + 84 * t * (1 - t);
      const sway = Math.sin(this.time * 1.6 + i) * 2;
      if (i % 2) this.poly([[x - 8, y - 2], [x + 8, y + 2], [x + sway, y + 20]], colors[i % colors.length], '#7e8c6860', .6);
      else { this.line([[x, y], [x, y + 6]], '#738064', 1); this.ellipse(x, y + 9, 3.3, 4.4, '#fbefb4', '#bea878', .6); }
    }
  }

  private hero() {
    if((this.currentHeroLocation().floor??1)!==this.activeFloor)return;
    if (this.heroDrawn) return;
    this.heroDrawn = true;
    const hero = this.heroState(), [x, y] = hero.point;
    let progress = hero.progress;
    if (hero.pose === 'chop') progress = (progress * 3) % 1;
    drawHero(this.ctx, { x, y, scale: WORLD_HERO_SCALE, gender: this.state?.gender ?? 'female', pose: hero.pose, facing: hero.facing, time: hero.time, progress, climbing: hero.climbing });
    this.hits.push({ kind: 'character', x, y: y - 64 * WORLD_HERO_SCALE, radius: 60 * WORLD_HERO_SCALE });
    this.pulse('character', x, y - 64 * WORLD_HERO_SCALE, 54 * WORLD_HERO_SCALE);
    if (this.action && this.action.elapsed >= this.action.walk && this.action.elapsed <= this.action.walk + this.action.work) {
      const cropName = CROPS[this.action.cropId].name;
      const labels: Record<SceneAction, string> = { plant: `${cropName} 씨앗을 톡톡`, water: '물을 듬뿍', harvest: `${cropName} 수확!`, chop: '나무를 차곡차곡', expand: '우리 집을 넓혀요', expandFarm: progress < .5 ? '새 밭에 흙을 채워요' : '튼튼하게 밭을 만들어요', gather: progress < .6 ? '쓸 만한 재료를 찾아요' : '가방에 차곡차곡', build: '새 시설을 튼튼하게', upgrade: '시설을 손보고 있어요' };
      const label = labels[this.action.kind];
      const top = y - 128 * WORLD_HERO_SCALE - 32;
      this.round(x - 58, top, 116, 23, 11, '#fffae8e8', '#bda982');
      this.label(label, x, top + 15, 10, '#526750', 700);
    }
  }

  private ramp() {
    const top = this.rampTop(), bottom = this.rampBottom();
    drawTruckStairway(this.ctx,top,bottom);
    this.ctx.save(); this.ctx.setLineDash([5, 9]);
    this.line([[bottom[0], bottom[1] + 9], [157, 552], [151, 571], [130, 590]], '#e8c987', 2); this.ctx.restore();
  }

  private loggingGrove() {
    const c = this.ctx;
    drawWorldSprite(c, 'forest', 99, 628, 196, 159);
    this.tree(34, 574, .87); this.tree(29, 619, .57);
    const cut = this.time - this.treeCutAt, falling = cut >= 0 && cut < .8, stump = cut >= .8 && cut < 15;
    const work = this.action?.kind === 'chop' ? this.actionProgress() : 0;
    drawWorldSprite(c, 'stump', 100, 616, 79, 56);
    if (!stump) {
      c.save(); c.translate(97, 601);
      const swing = falling ? -this.ease(cut / .8) * 1.42 : work > .03 ? Math.sin(work * Math.PI * 24) * .02 : Math.sin(this.time * .7) * .006;
      c.rotate(swing); drawWorldSprite(c, 'tree', 0, 0, 131, 178); c.restore();
    }
    drawWorldSprite(c, 'stump', 183, 629, 70, 49);
    // A separate roadside supply pile gives the gathering motion a visible target.
    drawWorldSprite(c, 'crate', 184, 576, 43, 39);
    this.line([[173, 568], [184, 564], [191, 568]], '#809087', 3);
    this.sprig(197, 579, .45);
    this.line([[69, 629], [69, 650]], '#8a693d', 3);
    this.line([[134, 629], [134, 650]], '#8a693d', 3);
    this.round(48, 622, 108, 30, 7, '#f4e4b7', '#8f6b3d');
    this.label('작은 벌목장', 102, 642, 13, '#4d572f', 800);
    // A tree tap starts work, while the sign opens the grove. Cover the painted canopies too.
    this.hits.push({kind: 'grove-work', x: 97, y: 512, radius: 0, bounds: [31, 423, 163, 616]});
    this.hits.push({kind: 'grove-work', x: 34, y: 511, radius: 0, bounds: [-15, 447, 83, 574]});
    this.hits.push({kind: 'grove-work', x: 29, y: 577, radius: 0, bounds: [-3, 536, 61, 619]});
    this.hits.push({kind: 'grove', x: 101, y: 636, radius: 44});
    this.pulse('grove', 100, 588, 74);
    this.pulse('grove-work', 100, 588, 74);
    if (this.zone === 'grove' && !this.action) {
      this.round(16, 421, 182, 30, 12, '#fff9e7f0', '#bcaa7a');
      this.label('나무를 눌러 벌목을 시작해요', 107, 441, 11, '#4d572f', 700);
    }
  }

  private buildingDeck() {
    const action = this.action;
    if (!action || action.elapsed < action.walk || action.elapsed > action.walk + action.work) return;
    const { left, end, front } = this.deckBounds();
    const oldFront = DECK_FRONTS[(this.state?.deckLevel ?? 1) - 1];
    this.ctx.save(); this.ctx.globalAlpha = .32 + Math.sin(this.time * 9) * .12;
    this.poly([this.p(left, oldFront, 96), this.p(end, oldFront, 96), this.p(end, front, 96), this.p(left, front, 96)], '#fff1a5', '#fff4bd', 2);
    this.ctx.restore();
    const progress = this.actionProgress();
    for (let i = 0; i < 10; i++) {
      const q = this.p(left + (end - left) * i / 9, front - 3, 98), phase = (progress * 3 + i * .15) % 1;
      this.ctx.globalAlpha = Math.sin(phase * Math.PI);
      this.line([[q[0] - 4, q[1] - phase * 28], [q[0] + 4, q[1] - phase * 28]], '#fff8b9', 2);
      this.line([[q[0], q[1] - phase * 28 - 4], [q[0], q[1] - phase * 28 + 4]], '#fff8b9', 2);
    }
    this.ctx.globalAlpha = 1;
  }

  private workEffects() {
    const action = this.action;
    if (!action || action.elapsed < action.walk || action.elapsed > action.walk + action.work) return;
    const hero = this.heroState(), [hx, hy] = hero.point, progress = this.actionProgress();
    const [u, v] = this.plotPosition(action.plotIndex), target = this.p(u + 29, v + 33, 110);
    const c = this.ctx;
    if (action.kind === 'plant') {
      for (let i = 0; i < 9; i++) {
        const t = (progress * 2.5 + i * .12) % 1;
        const sx = hx + 28 * WORLD_HERO_SCALE, sy = hy - 37 * WORLD_HERO_SCALE;
        this.ellipse(sx + (target[0] - sx + (i % 3 - 1) * 13) * t, sy + (target[1] - sy + Math.floor(i / 3) * 5) * t - Math.sin(t * Math.PI) * 19, 2, 1.2, CROP_SEED_COLOR[action.cropId], '#957044', .7);
      }
      if (progress > .7) for (let i = 0; i < 3; i++) {
        const grow = (progress - .7) / .3;
        if (!drawCropSprite(c, action.cropId, 'plant', target[0] - 14 + i * 14, target[1], 8 + grow * 4, 8 + grow * 8)) this.sprig(target[0] - 14 + i * 14, target[1], (progress - .7) * .9);
      }
    } else if (action.kind === 'water') {
      for (let i = 0; i < 18; i++) {
        const t = (progress * 4 + i * .071) % 1, spread = (i % 5 - 2) * 5;
        const sx = hx + 38 * WORLD_HERO_SCALE, sy = hy - 27 * WORLD_HERO_SCALE;
        const x = sx + (target[0] - sx + spread) * t, y = sy + (target[1] - sy) * t + t * t * 4;
        this.line([[x, y], [x - 1.6, y - 4]], '#8dcde6', 1.8);
      }
      c.globalAlpha = progress * .3; this.ellipse(...target, 27, 11, '#4a9eb2'); c.globalAlpha = 1;
    } else if (action.kind === 'harvest') {
      for (let i = 0; i < 3; i++) {
        const t = Math.max(0, Math.min(1, (progress - i * .19) * 2));
        const x = target[0] + i * 8 - 8 + (hx + 25 * WORLD_HERO_SCALE - target[0]) * t, y = target[1] - Math.sin(t * Math.PI) * 41 + (hy - 15 * WORLD_HERO_SCALE - target[1]) * t;
        c.save(); c.translate(x, y); c.rotate(t * 2 + i * .4);
        const produceSize: Point = action.cropId === 'carrot' || action.cropId === 'corn' ? [16, 27] : [22, 22];
        if (!drawCropSprite(c, action.cropId, 'produce', 0, 9, produceSize[0], produceSize[1])) drawWorldSprite(c, 'carrot', 0, 9, 16, 30);
        c.restore();
      }
    } else if (action.kind === 'chop') {
      const cut = this.time - this.treeCutAt;
      if (cut < 0 || cut > .8) for (let i = 0; i < 12; i++) {
        const t = (progress * 3 + i * .057) % 1;
        const x = 98 + Math.cos(i * 1.2) * t * 40, y = 578 - Math.sin(t * Math.PI) * (15 + i * 2) + t * 21;
        c.save(); c.translate(x, y); c.rotate(t * 6 + i); this.round(-3, -1, 6, 2, 1, '#e0bf81'); c.restore();
      }
      if (progress > .8) {
        this.round(111, 514 - (progress - .8) * 55, 82, 26, 12, '#f6e8be', '#b5a175');
        this.label('목재 +18', 152, 532 - (progress - .8) * 55, 12, '#617947', 800);
      }
    } else if (action.kind === 'gather') {
      // The recovered bundle travels from the roadside pile to the survivor's bag.
      // It never appears as a completed reward before the return journey finishes.
      const pickedUp = Math.max(0, Math.min(1, (progress - .38) / .24));
      const stowed = Math.max(0, Math.min(1, (progress - .64) / .25));
      if (pickedUp > 0 && stowed < 1) {
        const handX = hx - 26 * WORLD_HERO_SCALE, handY = hy - 37 * WORLD_HERO_SCALE;
        const packX = hx + 6 * WORLD_HERO_SCALE, packY = hy - 52 * WORLD_HERO_SCALE;
        const x = 184 + (handX - 184) * pickedUp + (packX - handX) * stowed;
        const y = 568 + (handY - 568) * pickedUp + (packY - handY) * stowed;
        c.save(); c.globalAlpha = Math.min(1, pickedUp * 4) * (1 - stowed * stowed);
        this.round(x - 4, y - 4, 9, 7, 2, '#ad9b78', '#796c52');
        this.line([[x - 2, y - 3], [x - 2, y + 2]], '#d9c69a', 1); c.restore();
      }
    } else if (action.kind === 'expandFarm') {
      // Soil and timber gradually become the new bed. The state adds the usable
      // plot only once the character has finished and returned home.
      c.save(); c.globalAlpha = Math.min(1, progress * 2);
      drawWorldSprite(c, 'planter', target[0] + 3, target[1] + 33, 109, 71);
      c.restore();
      for (let i = 0; i < 8; i++) {
        const t = (progress * 3 + i * .137) % 1;
        const x = target[0] + (i % 4 - 1.5) * 12, y = target[1] - Math.sin(t * Math.PI) * 13 + (Math.floor(i / 4) - .5) * 12;
        this.ellipse(x, y, 2.8, 1.5, i % 2 ? '#977649' : '#b69761');
      }
      if (progress > .5 && progress < .83) {
        c.save(); c.translate(hx + 25 * WORLD_HERO_SCALE, hy - 37 * WORLD_HERO_SCALE); c.scale(WORLD_HERO_SCALE, WORLD_HERO_SCALE); c.rotate(-.8 + Math.sin(progress * Math.PI * 14) * .9);
        this.line([[0, 0], [0, -25]], '#9e7750', 4); this.round(-10, -30, 21, 9, 3, '#8faaa0', '#617e75'); c.restore();
      }
    } else if ((action.kind === 'build' || action.kind === 'upgrade') && action.facilitySlot !== undefined) {
      const [fu, fv] = SETTLEMENT_SLOTS[getSlotLocalIndex(action.facilitySlot)], facility = this.p(fu, fv, 100);
      c.save(); c.translate(hx + 25 * WORLD_HERO_SCALE, hy - 37 * WORLD_HERO_SCALE); c.scale(WORLD_HERO_SCALE, WORLD_HERO_SCALE);
      c.rotate(-.75 + Math.sin(progress * Math.PI * 4) * .7);
      this.line([[0, 0], [0, -25]], '#9e7750', 4); this.round(-10, -30, 21, 9, 3, '#8faaa0', '#617e75'); c.restore();
      for (let i = 0; i < 6; i++) {
        const t = (progress * 2 + i * .17) % 1;
        this.ellipse(facility[0] + 48 - t * 12 + (i % 3 - 1) * 8, facility[1] - Math.sin(t * Math.PI) * 12 + i % 2 * 3,
          1.8, 1.1, '#d4b578');
      }
      if (progress > .72) for (let i = 0; i < 4; i++) {
        const x = facility[0] + Math.cos(i * 1.7) * 40, y = facility[1] - 42 + Math.sin(i * 1.7) * 24;
        this.line([[x - 3, y], [x + 3, y]], '#fff4b0', 1.8); this.line([[x, y - 3], [x, y + 3]], '#fff4b0', 1.8);
      }
    } else if (action.kind === 'expand' && progress < .83) {
      c.save(); c.translate(hx + 25 * WORLD_HERO_SCALE, hy - 37 * WORLD_HERO_SCALE); c.scale(WORLD_HERO_SCALE, WORLD_HERO_SCALE); c.rotate(-.8 + Math.sin(progress * Math.PI * 10) * .9);
      this.line([[0, 0], [0, -29]], '#9e7750', 5); this.round(-12, -34, 25, 10, 3, '#8faaa0', '#617e75'); c.restore();
    }
    if (isFarmAction(action.kind) && progress > .78) {
      for (let i = 0; i < 6; i++) {
        const x = target[0] + Math.cos(i) * 32, y = target[1] - 12 + Math.sin(i) * 22;
        this.line([[x - 3, y], [x + 3, y]], '#fff4b0', 2); this.line([[x, y - 3], [x, y + 3]], '#fff4b0', 2);
      }
    }
  }

  private pulse(kind: string, x: number, y: number, radius: number) {
    if (this.focused !== kind || performance.now() > this.focusedUntil) return;
    const c = this.ctx; c.save(); c.globalAlpha = .55 + Math.sin(this.time * 5) * .25; c.setLineDash([4, 6]);
    c.beginPath(); c.ellipse(x, y, radius, radius * .62, 0, 0, Math.PI * 2); c.strokeStyle = '#fff4bd'; c.lineWidth = 3; c.stroke(); c.restore();
  }
  private foreground() {
    this.tree(-58, 739, 1.03); this.tree(1054, 733, 1.29);
    drawWorldSprite(this.ctx, 'forest', 943, 754, 165, 141);
    drawWorldSprite(this.ctx, 'forest', 8, 724, 143, 122);
    this.grass(859, 740, 1.5);
  }
  private fireflies() {
    for (let i = 0; i < 9; i++) {
      const x = 140 + this.seed(i + 76) * 760 + Math.sin(this.time * .35 + i) * 12;
      const y = 160 + this.seed(i + 91) * 390 + Math.cos(this.time * .5 + i) * 8;
      this.ctx.globalAlpha = .24 + Math.sin(this.time + i) * .16;
      this.ellipse(x, y, 2.1, 2.1, '#fff9d7');
    }
    this.ctx.globalAlpha = 1;
  }
}
