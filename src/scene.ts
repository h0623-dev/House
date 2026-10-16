import { formatGameDuration, gameMinutesToSeconds } from './game-time';
import { GAME_SPEED_MULTIPLIER, realDuration } from './game-speed';
import { CROPS, getCropProgress, getPlotCropId, getFarmCapacity, type CropId, type GameState, type Plot } from './game';
import { drawHero, type HeroPose } from './actors';
import { getEquippedOutfit } from './shop';
import { drawZombie } from './creatures';
import { drawCompanion, companionPawContacts, sampleCompanionGait, type CompanionOptions } from './companion-art';
import { drawTruckFloor } from './truck-floor-art';
import { drawTruckAccessStairs } from './truck-stair-art';
import { drawSkyBirds, skyNightAmount } from './sky-birds';
import { createPetPatrol, stepPetPatrol, getPetGroundRadius, getPetPatrolDestination, type PetPatrolState } from './scene-patrol';
import { planPlacementPetRelocations } from './scene-placement';
import { getFloorBounds, getFloorSlots, getFloorStairs,
  getSlotFloor, getSlotLocalIndex, getTruckFloorCount, FLOOR_HEIGHT, type TruckFloor } from './truck-layout';
import { getUnlockedUnitIds, getUnitRoster, getAnimalDeckUnlockLevel, canAnimalBoardTruck, type UnitId } from './units';
import { drawWorldSprite, paintWorldQuad, drawWorldRoad, drawWorldFence, drawWorldStairs, worldArtReady } from './world-art';
import { drawCropSprite } from './crop-art';
import { BUILDINGS, getSettlement, type Building, type BuildingType } from './settlement';
import { DECK_CELL_SIZE, getBuildingFootprint, getDeckGridBounds, getFacilityPlacement, getFacilityBounds,
  snapFacilityPlacement, checkFacilityPlacement, type FacilityPlacement } from './deck-placement';
import { drawFacility, facilityArtReady, FACILITY_BASE_SLOPES } from './settlement-art';
import { getLayoutDirection, type LayoutDirection } from './layout-direction';
import { type MotionRoute } from './scene-motion';
import { anchoredCameraChange, clampMapZoom, MapPinchGesture } from './scene-gestures';
import { fitVillageCamera, getVillageContentBounds, mergeVillageBounds, VILLAGE_FACILITY_SIZE } from './village-camera';
import { frameHomeOverview, getHomeOverviewBounds } from './player-camera';
import { createNavigationWorld, defaultHeroLocation, groundLocation, navigationDeckBounds, planNavigation, projectDeckPoint,
  sampleNavigation, planWorkNavigation, planYieldNavigation, blocksActorStep, circleOverlapsPolygon, navigationObstaclePolygon, distanceToSegment, getPatrolTargets, getRoadBounds, HERO_BODY_RADIUS, DECK_FRONTS, FARM_POSITIONS, SETTLEMENT_POSITIONS, unprojectDeckPoint,
  type NavigationActor, type NavigationLocation, type NavigationPath, type NavigationWorld, type NavigationLink } from './scene-navigation';
import itemAtlasUrl from './assets/items-anime.png';
import { layoutProductionBubbles } from './production-bubble-layout';
import { type OutdoorSiteId } from './outdoor-sites';
import { GROUND_RESOURCE_NODES, GROUND_RESOURCE_ZONES, getGroundResourceNode, getGroundResourceZone, type GroundResourceId, type GroundResourceNode } from './ground-resources';
import { GROUND_REGIONS, getGroundRegion, type GroundRegionId } from './ground-regions';
import { getGatheringNode } from './gathering';
import { gatheringKindForResource, sampleGatheringMotion, gatheringFinalContactProgress, GATHERING_CONTACT_PHASE } from './gathering-motion';
import { layoutGroundMarkers, type GroundMarker, type GroundMarkerInput } from './ground-marker-layout';
import { drawGroundLandscape, drawGroundSprite, groundArtReady } from './ground-art';
import { GROUND_LANDSCAPE_BOUNDS, GROUND_BACKGROUND_BOUNDS, getGroundResourceVisual, getGroundVisualBounds, getGroundVisualPolygon } from './ground-visuals';
import { getFarmPlotCare } from './farm-economy';
import { getPetPassage, getPetPassageGeometry, PET_PASSAGE_LINK_ID } from './pet-passage';
import { getTruckAccessGeometry } from './truck-access';
import { drawPetPassage } from './pet-passage-art';
import { isNavigationLinkSurface } from './scene-navigation';

type Point = [number, number];
type Selectable = 'farm' | 'farm-expand' | 'truck' | 'pet' | 'pet-gate' | 'character' | 'grove' | 'grove-work' | 'outdoor-site' | 'ground-resource' | 'road-entry' | 'facility' | 'facility-collect' | 'facility-start' | 'build-slot' | 'build-placement';
type Hit = { kind: Selectable; x: number; y: number; radius: number; bounds?: [number, number, number, number]; polygon?: Point[]; plotId?: number; siteId?:OutdoorSiteId; nodeId?:GroundResourceId; marker?:boolean };
type SceneAction = 'plant' | 'water' | 'fertilize' | 'harvest' | 'chop' | 'expand' | 'expandFarm' | 'gather' | 'build' | 'upgrade' | 'pet-gate';
type FarmAction = 'plant' | 'water' | 'fertilize' | 'harvest';
type PlanningMode = 'catalog' | 'placement' | 'expansion';
type WorldBounds = { left: number; top: number; right: number; bottom: number };
type FarmStroke = { pointerId: number; last: Point; visited: Set<number> };
type MapGesture = { pointerId: number; start: Point; last: Point; moved: boolean };
type HeroSceneState = { point: Point; pose: HeroPose; facing: 1 | -1; progress: number; time: number; climbing?: 'up' | 'down' };
const isFarmAction = (kind: SceneAction): kind is FarmAction => kind === 'plant' || kind === 'water' || kind === 'fertilize' || kind === 'harvest';
type Chore = { kind: SceneAction; elapsed: number; duration: number; walk: number; work: number; path: Point[]; route: MotionRoute; navigation: NavigationPath; plotIndex: number; cropId: CropId; facilitySlot?: number; facilityPlacement?:FacilityPlacement; facilityId?:number; outdoorSiteId?:OutdoorSiteId; groundResourceId?:GroundResourceId; stayAtTarget?:boolean; gaitOffset?:number; stalled:number; yieldAt:number; resolve: () => void; reject:(reason:Error)=>void };
const CHORE_STALL_TIMEOUT=16;
// Residents fit comfortably beside the truck's facilities and planters.
// Compact painted residents sit between the crops and miniature buildings.
const WORLD_HERO_SCALE = .64;
const RESOURCE_FOCUS_MIN_SCALE = .38;
const RESOURCE_PROP_FOCUS_MIN_SCALE = .6;
const CROP_PLANT_SIZE: Record<CropId, Point> = { carrot: [21, 34], potato: [26, 27], tomato: [24, 35], corn: [19, 40], strawberry: [22, 25], pumpkin: [29, 27] };
const CROP_SEED_COLOR: Record<CropId, string> = { carrot: '#d29b57', potato: '#bfab72', tomato: '#cfad6c', corn: '#efc955', strawberry: '#9d7150', pumpkin: '#ead5a1' };
// The original eight beds keep their identity and position as the garden grows.
// New beds occupy the deck's front garden; facilities stay behind the central path.
const SETTLEMENT_SLOTS = SETTLEMENT_POSITIONS;
const FACILITY_SIZE = VILLAGE_FACILITY_SIZE;

/** A live isometric home built from our original painted anime environment art. */
export class Scene {
  private ctx: CanvasRenderingContext2D;
  private layoutPaintGeometry:unknown[]=[];
  private productionItems:{id:number;slot:number;floor:TruckFloor;resource:string;amount:number;state:'idle'|'running'|'ready';progress:number;remainingSeconds:number|null;itemArt:unknown;bounds:[number,number,number,number];screenBounds:[number,number,number,number];hit:'facility-start'|'facility-collect'|'facility'|null;displaced:boolean;anchor:Point}[]=[];
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
  private blockedReason: string | null = null;
  private walkEventState = '';
  private petMotion = new Map<UnitId,PetPatrolState>();
  private petYields = new Map<UnitId,{route:NavigationPath;reserved:NavigationLocation[];reservedRadius:number;passage?:NavigationLink;passageOwner?:UnitId}>();
  private placementRelocationSequence = 0;
  private petGateClosing = false;
  private petGatePendingOpen: boolean | null = null;
  private petGateWaitElapsed = 0;
  private petPassageEventState = '';
  private petPassagePaint: { drawn: boolean; painted: boolean } = { drawn: false, painted: false };
  private petPassageLeasedPaint: { owners: UnitId[]; points: Point[]; drawn: boolean; painted: boolean }[] = [];
  private accessStairPaint: ReturnType<typeof drawTruckAccessStairs> | null = null;
  private zone: 'home' | 'grove' = 'home';
  private resourceFocus: { siteId: OutdoorSiteId; nodeId?: GroundResourceId; regionId?: GroundRegionId } | null = null;
  private groundResourcePaint: unknown[] = [];
  private groundMarkerPaint: (GroundMarker & {icon:string;itemArt:unknown})[] = [];
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
  private playerCameraFollowing = false;
  private cameraMode: 'overview' | 'manual' | 'focus' | 'planning' = 'overview';
  private overviewBounds: WorldBounds | null = null;
  private pinch = new MapPinchGesture();
  private cancelledGesturePointers = new Set<number>();
  private pendingFarmTouch: { pointerId: number; point: Point; timer: number } | null = null;
  private mapPanLimit: Point = [500, 400];
  private constructionMode: BuildingType | null = null;
  private selectedPlacement: FacilityPlacement | null = null;
  private placementPointer: number | null = null;
  private movingBuildingId: number | null = null;
  private selectedFacilityId: number | null = null;
  private planningMode: PlanningMode | null = null;
  private planningLevel: number | null = null;
  private expansionPreview: number | null = null;
  private cameraFocusRequested = true;
  private villageOverview = false;
  private wholeWorldOverview = false;
  private safeViewport = { top: 0, bottom: 0, left: 0, right: 0, width: 1, height: 1 };
  private queuedPlotIds: number[] = [];
  private plantingCropId: CropId = 'carrot';
  private itemAtlas = (() => { const image = new Image(); image.decoding = 'async'; image.src = itemAtlasUrl; return image; })();
  private camera = { x: 480, y: 350, zoom: 1 };
  private treeCuts = new Map<GroundResourceId, { at: number; direction: 1 | -1 }>();
  private heroDrawn = false;
  private heroToolContact: Point | null = null;
  private gatheringContact: { nodeId: GroundResourceId; cycle: number; point: Point } | null = null;
  private actionEventState = '';
  private disposed = false;
  private suspended = false;
  private animate = (timestamp: number) => {
    if (document.hidden || this.suspended) { this.frame = 0; return; }
    this.frame = requestAnimationFrame(this.animate);
    if (timestamp - this.lastFrame < (this.reducedMotion && !this.action && !this.freeWalk ? 250 : 32)) return;
    const elapsed = this.lastFrame ? Math.max(0, (timestamp - this.lastFrame) / 1000) : 0;
    this.lastFrame = timestamp;
    // Hero jobs and pets share the real frame time. Small joint steps retain
    // swept collision checks without letting slow rendering freeze a blocker.
    const steps = Math.max(1, Math.ceil(elapsed / .1));
    const delta = elapsed / steps;
    for (let step = 0; step < steps; step++) {
      this.time += delta * GAME_SPEED_MULTIPLIER;
      if (this.freeWalk) {
        const walking = this.freeWalk,nextElapsed=Math.min(walking.navigation.motion.duration,walking.elapsed+delta),sample=sampleNavigation(walking.navigation,nextElapsed);
        const blocker=this.stepBlocker(this.heroLocation,sample.location);
        this.blockedReason=blocker?`actor:${blocker.id}`:null;
        if(blocker){
          walking.blockedFor+=delta;walking.retryFor+=delta;
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
        const action=this.action,waitingForPets=action.kind==='pet-gate'&&this.petGateClosing&&this.petsOnPassage().length>0;
        let nextElapsed=Math.min(action.duration,action.elapsed+delta);
        if(waitingForPets&&nextElapsed>=action.walk){nextElapsed=action.walk;this.petGateWaitElapsed+=delta;}
        const nextLocation=nextElapsed<action.walk?sampleNavigation(action.navigation,nextElapsed).location:
          nextElapsed>action.walk+action.work?sampleNavigation(action.navigation,nextElapsed-action.walk-action.work,true).location:action.navigation.target;
        const blocker=this.stepBlocker(this.currentHeroLocation(),nextLocation);
        this.blockedReason=blocker?`actor:${blocker.id}`:null;
        if(blocker){
          action.stalled+=delta;
          if(action.stalled-action.yieldAt>=.3){
            action.yieldAt=action.stalled;
            this.tryPetYield(blocker,[nextLocation,nextElapsed>action.walk+action.work?action.navigation.returnLocation:action.navigation.target]);
            if(action.kind==='pet-gate'&&action.elapsed<action.walk)this.reroutePetGateVisit(action);
          }
        }else{action.stalled=0;action.yieldAt=0;action.elapsed=nextElapsed;this.followFloor(nextLocation.floor??1);}
        if(action.stalled>=CHORE_STALL_TIMEOUT||this.petGateWaitElapsed>=CHORE_STALL_TIMEOUT){
          const retained=this.currentHeroLocation();this.heroLocation={...retained,point:[...retained.point]};this.action=null;this.zone='home';
          if(action.groundResourceId)this.treeCuts.delete(action.groundResourceId);
          action.reject(new Error(this.petGateWaitElapsed>=CHORE_STALL_TIMEOUT?'동물이 통로에 있어 문을 닫지 않았어요. 친구가 통로를 벗어난 뒤 다시 해 주세요.':'동물이 길을 막아 작업을 멈췄어요. 트럭 휴식으로 동료를 회복시킨 뒤 다시 해 주세요.'));
        }else{
          if (action.kind === 'chop' && action.groundResourceId && action.elapsed >= action.walk + action.work * gatheringFinalContactProgress('chop') && !this.treeCuts.has(action.groundResourceId)) {
            const node=getGroundResourceNode(action.groundResourceId);
            this.treeCuts.set(action.groundResourceId,{at:performance.now()/1000,direction:node&&node.point[0]<action.navigation.target.point[0]?-1:1});
          }
          if (action.elapsed >= action.duration) {
            const destination=action.stayAtTarget?action.navigation.target:action.navigation.returnLocation;
            if(action.groundResourceId)this.heroFacing=this.heroState().facing;
            this.heroLocation = { ...destination, point: [...destination.point] };
            this.action = null; this.zone = 'home'; action.resolve();
          }
        }
      }
      this.advancePets(delta);
    }
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
      this.placementPointer=null;
      this.endFarmStroke(true, false); this.endMapGesture(true, false);
      for (const pointerId of this.pinch.pointerIds) this.canvas.setPointerCapture(pointerId);
      event.preventDefault(); return;
    }
    if (!event.isPrimary) return;
    if(this.constructionMode&&this.placementPointerDown(event))return;
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
    if(this.placementPointer===event.pointerId){
      event.preventDefault();this.movePlacementPointer(event.clientX,event.clientY);return;
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
    if(this.placementPointer===event.pointerId)this.placementPointer=null;
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
    if(this.placementPointer===event.pointerId){
      this.movePlacementPointer(event.clientX,event.clientY);this.placementPointer=null;
      if(this.canvas.hasPointerCapture(event.pointerId))this.canvas.releasePointerCapture(event.pointerId);
      event.preventDefault();return;
    }
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
    const roadEntry=candidates.find(item=>item.kind==='road-entry'),petGate=candidates.find(item=>item.kind==='pet-gate'),outdoorSite=candidates.find(item=>item.kind==='outdoor-site'),
      resource=[...candidates].reverse().find(item=>item.kind==='ground-resource'),
      resourceMarker=[...candidates].reverse().find(item=>item.kind==='ground-resource'&&item.marker),
      outdoors=this.currentHeroLocation().surface==='road',world=this.navigationWorld();
    if(petGate&&!this.constructionMode){this.focus('pet-gate');this.onSelect('pet-gate');return;}
    if(roadEntry&&!this.constructionMode){
      this.walkTo(outdoors?{surface:'deck',floor:1,point:[...world.ladder.entry]}:{surface:'road',point:[...world.ladder.bottom]});return;
    }
    const hit = this.constructionMode ? slots[0] : resourceMarker ?? outdoorSite ?? (outdoors
      ?foreground??resource??workTree??candidates.find(item=>item.kind==='grove')
      :facilityAction ?? foreground ?? facilities[0] ?? resource ?? workTree ?? plots[0] ?? candidates[candidates.length - 1]);
    const target = groundLocation(world, [x,y],this.activeFloor,outdoors?'road':undefined);
    // The truck cab remains interactive; its broad legacy hit circle must not
    // turn a real empty deck tile into the expansion menu.
    if (hit && (hit.kind !== 'truck' || !target)) { this.focus(hit.nodeId?`ground:${hit.nodeId}`:hit.kind); this.onSelect(hit.kind, hit.plotId); }
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

  constructor(private canvas: HTMLCanvasElement, private onSelect: (kind: Selectable, plotId?: number, placement?:FacilityPlacement) => void) {
    this.ctx = canvas.getContext('2d')!;
    canvas.style.touchAction = 'none';
    canvas.setAttribute('aria-label', '미래 대한민국의 트럭 집. 빈 바닥을 눌러 길을 걸어요. 숲길의 나무와 땅 위의 고철, 씨앗 풀, 샘물을 각각 눌러 채집해 보세요.');
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
    if(this.petGatePendingOpen!==null&&this.action?.kind!=='pet-gate')this.clearPetPassageGateOperation();
    const team=getUnlockedUnitIds(state);
    for(const id of this.petMotion.keys())if(!team.includes(id)){this.petMotion.delete(id);this.petYields.delete(id);}
    if(this.activeFloor>getTruckFloorCount(state))this.activeFloor=1;
    if (this.selectedPlotId !== null && !state.plots.some(plot => plot.id === this.selectedPlotId)) this.selectedPlotId = null;
    if (this.selectedFacilityId !== null && !getSettlement(state).buildings.some(building => building.id === this.selectedFacilityId)) this.selectedFacilityId = null;
  }
  setSelectedPlot(plotId: number | null) { this.selectedPlotId = plotId; }
  setFarmFocus(enabled: boolean) { if (enabled !== this.farmFocus) { this.cancelCameraGesture(); this.endFarmStroke(); this.endMapGesture(); } this.farmFocus = enabled; if(enabled){this.resourceFocus=null;this.villageOverview=false;this.wholeWorldOverview=false;} }
  /** A farming tool stays selected while taps or a finger swipe queue further plots. */
  setFarmMode(mode: FarmAction | null, queuedPlotIds: number[] = [], selectedSeed: CropId = 'carrot') {
    if (mode !== this.farmMode) { this.cancelCameraGesture(); this.endFarmStroke(); this.endMapGesture(); }
    this.farmMode = mode;
    if(mode){this.resourceFocus=null;this.villageOverview=false;this.wholeWorldOverview=false;}
    this.canvas.style.touchAction = 'none';
    this.queuedPlotIds = mode ? [...queuedPlotIds] : [];
    this.plantingCropId = selectedSeed;
    if (mode && !this.action) this.zone = 'home';
  }
  setPlantingMode(enabled: boolean, queuedPlotIds: number[] = [], selectedSeed: CropId = 'carrot') { this.setFarmMode(enabled ? 'plant' : null, queuedPlotIds, selectedSeed); }
  setConstructionMode(type: BuildingType | null, position?: FacilityPlacement | number, movingId?: number) {
    if (type !== this.constructionMode) { this.cancelCameraGesture(); this.endFarmStroke(); this.endMapGesture(); }
    this.constructionMode = type;
    if(type)this.resourceFocus=null;
    this.selectedPlacement = type && position !== undefined ? typeof position==='number'
      ? this.legacyPlacement(position) : {...position} : null;
    if(!type)this.placementPointer=null;
    this.movingBuildingId = type && movingId !== undefined ? movingId : null;
    if (type && !this.action) this.zone = 'home';
  }
  /** Fit when a planning view opens; later user drags and pinches keep their camera. */
  setPlanningViewport(mode: PlanningMode | null, nextLevel?: number) {
    const level = mode === 'expansion' ? Math.min(8, Math.max(1, nextLevel ?? (this.state?.deckLevel ?? 1) + 1)) : null;
    if (mode === this.planningMode && level === this.planningLevel) return;
    this.cancelCameraGesture(); this.endFarmStroke(); this.endMapGesture();
    this.planningMode = mode; this.planningLevel = level; this.villageOverview = false;
    this.mapPan = [0, 0]; this.mapZoom = 1; this.manualViewport = null;
    this.cameraFocusRequested = true;
    if (mode) {this.zone = 'home';this.resourceFocus=null;this.wholeWorldOverview=false;}
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
    this.setActiveFloor(getFacilityPlacement(this.state,getSettlement(this.state).buildings.find(building=>building.id===id)!).floor);
    this.cancelCameraGesture(); this.endFarmStroke(); this.endMapGesture();
    this.selectedFacilityId = id; this.zone = 'home'; this.resourceFocus=null;this.villageOverview = false;this.wholeWorldOverview=false;
    this.mapPan = [0, 0]; this.mapZoom = 1; this.manualViewport = null; this.cameraFocusRequested = true;
    this.canvas.dispatchEvent(new CustomEvent('scenezoomchange', { detail: { zoom: this.mapZoom } }));
    this.render();
  }
  setSelectedFacility(id: number | null) {
    if (id !== this.selectedFacilityId) { this.endFarmStroke(); this.endMapGesture(); }
    this.selectedFacilityId = id;
    if(id!==null)this.wholeWorldOverview=false;
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
  /** HUD buttons use the same physical routes as native ground taps. */
  walkOntoRoad() {
    if(this.activeFloor!==1)this.setActiveFloor(1);
    this.walkTo({surface:'road',point:[...this.navigationWorld().ladder.bottom]});
  }
  walkToTruck() {
    if(this.activeFloor!==1)this.setActiveFloor(1);
    this.walkTo({surface:'deck',floor:1,point:[...this.navigationWorld().ladder.entry]});
  }
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
  /** Old controllers may still clear this retired mode; the truck itself is home. */
  setHouseMoveMode(_enabled:boolean,_slot?:number) {}
  canPlaceHome(_floor:TruckFloor,_slot:number) { return false; }
  canPlaceFacility(position:FacilityPlacement|number|undefined=this.selectedPlacement??undefined) {
    if(!this.state||!this.constructionMode||position===undefined)return false;
    const placement=typeof position==='number'?this.legacyPlacement(position):position;
    return checkFacilityPlacement(this.state,this.constructionMode,placement,this.movingBuildingId??undefined).ok;
  }
  private legacyPlacement(slot:number):FacilityPlacement {
    const[x,y]=SETTLEMENT_SLOTS[getSlotLocalIndex(slot)]??[0,0];
    return{floor:getSlotFloor(slot),x,y,rotation:0};
  }
  private facilityPoint(building:Building):Point {
    const placement=this.state?getFacilityPlacement(this.state,building):this.legacyPlacement(building.slot);
    return projectDeckPoint([placement.x,placement.y],placement.floor);
  }
  private facilityFootprints(state:GameState) {
    return getSettlement(state).buildings.map(building=>({floor:getFacilityPlacement(state,building).floor,bounds:getFacilityBounds(state,building)}));
  }
  private placementPointerDown(event:PointerEvent) {
    if(!this.state)return false;
    const{x,y}=this.pointerHits(event.clientX,event.clientY),[u,v]=unprojectDeckPoint([x,y],this.activeFloor),deck=this.deckBounds();
    if(u<deck.left||u>deck.end||v<deck.back||v>deck.front)return false;
    this.endMapGesture();this.endFarmStroke();this.placementPointer=event.pointerId;
    this.canvas.setPointerCapture(event.pointerId);event.preventDefault();
    this.movePlacementPointer(event.clientX,event.clientY);return true;
  }
  private movePlacementPointer(clientX:number,clientY:number) {
    if(!this.state||!this.constructionMode)return;
    const{x,y}=this.pointerHits(clientX,clientY),[u,v]=unprojectDeckPoint([x,y],this.activeFloor);
    const placement=snapFacilityPlacement(this.state,this.constructionMode,{floor:this.activeFloor,x:u,y:v,rotation:this.selectedPlacement?.rotation??0});
    if(this.selectedPlacement&&JSON.stringify(this.selectedPlacement)===JSON.stringify(placement))return;
    this.selectedPlacement=placement;
    this.onSelect('build-placement',undefined,{...placement});this.render();
  }
  /** Call after a successful domain placement and before publishing its new state. */
  relocatePetsForPlacement(nextState:GameState):boolean {
    if(!this.state)return false;
    const actors=this.physicalActors(),worldFor=(radius:number,occupants:NavigationActor[])=>createNavigationWorld(nextState.deckLevel,nextState.plots.length,
      getSettlement(nextState).buildings.map(building=>building.slot),
      {floors:Array.from({length:getTruckFloorCount(nextState)},(_,i)=>(i+1)as TruckFloor),activeFloor:this.activeFloor,
        radius,actors:occupants,actor:'pet',petPassageOpen:getPetPassage(nextState).open&&!this.petGateClosing,facilityFootprints:this.facilityFootprints(nextState)});
    const previous=this.navigationWorld().obstacles,
      obstacleKey=(obstacle:NavigationWorld['obstacles'][number])=>JSON.stringify([obstacle.surface,obstacle.floor,obstacle.kind,obstacle.bounds]),
      previousKeys=new Set(previous.map(obstacleKey)),
      added=worldFor(HERO_BODY_RADIUS,[]).obstacles.filter(obstacle=>obstacle.kind==='facility'&&!previousKeys.has(obstacleKey(obstacle))),
      relocations=planPlacementPetRelocations(added,actors,worldFor);
    if(!relocations)return false;
    for(const relocation of relocations){
      if(relocation.id==='hero'){
        this.stopWalking();this.heroLocation={...relocation.to,point:[...relocation.to.point]};continue;
      }
      const id=relocation.id as UnitId,motion=this.petMotion.get(id)!;
      motion.location={...relocation.to,point:[...relocation.to.point]};
      motion.route=null;motion.elapsed=0;motion.speed=0;motion.blend=0;motion.turnRemaining=0;
      motion.blockedReason=null;motion.retryRemaining=0;motion.pauseRemaining=.35;
      motion.facingBlend=motion.facing;motion.turnFrom=motion.facing;motion.nextFacing=motion.facing;motion.turnHeading=motion.heading;
      const world=worldFor(motion.radius,[]);
      motion.worldKey=JSON.stringify([world.floors,world.obstacles,world.links,world.road,world.petMaxFloor]);
      motion.desiredFloor=this.currentHeroLocation().floor??1;this.petYields.delete(id);
    }
    this.canvas.dataset.placementPetRelocation=JSON.stringify({sequence:++this.placementRelocationSequence,moved:relocations});
    return true;
  }
  private petScale(id:UnitId) {
    return id==='dog'?.78:id==='boar'?.7:id==='elephant'||id==='giraffe'?.82:id==='panda'||id==='deer'?.78:.73;
  }
  private physicalActors():NavigationActor[] {
    const hero:NavigationActor={id:'hero',location:this.currentHeroLocation(),radius:HERO_BODY_RADIUS};
    const team=this.state?getUnlockedUnitIds(this.state):['dog','cat']as UnitId[];
    return[hero,...team.flatMap(id=>{const motion=this.petMotion.get(id),route=motion?.route,
      approaching=motion&&route&&motion.location.surface===route.start.surface&&(motion.location.floor??1)===(route.start.floor??1),
      reserved=[...this.petYields.values()].find(yielding=>yielding.passageOwner===id&&yielding.passage&&motion&&this.holdsPetPassageIntent(motion,yielding.passage)),
      passageIntent=(approaching?route.segments.find((_,index)=>route.surfaces[index]==='ramp')?.link:undefined)??reserved?.passage?.id;
      return motion?[{id,location:{...motion.location,point:[...motion.location.point]as Point},radius:motion.radius,
        ...(passageIntent?{passageIntent}:{})}]:[];})];
  }
  private stepBlocker(from:NavigationLocation,to:NavigationLocation) {
    const actors=this.physicalActors().filter(actor=>actor.id!=='hero');
    return (isNavigationLinkSurface(to.surface)?actors.find(a=>isNavigationLinkSurface(a.location.surface)&&a.location.link===to.link):undefined)
      ??blocksActorStep(from,to,HERO_BODY_RADIUS,actors);
  }
  private tryPetYield(blocker:NavigationActor,reserved:NavigationLocation[],reservedRadius=HERO_BODY_RADIUS,requested=new Set<UnitId>(),passage?:NavigationLink,passageOwner?:UnitId) {
    const id=blocker.id as UnitId,motion=this.petMotion.get(id),roster=getUnitRoster(this.state??{});
    if(!motion||requested.has(id)||this.petYields.has(id)||this.reducedMotion||roster[id].health<=0)return;
    if(motion.location.surface==='ramp'&&motion.passageLease)return;
    requested.add(id);
    const ownsLink=isNavigationLinkSurface(motion.location.surface)&&reserved.some(location=>isNavigationLinkSurface(location.surface)&&location.link===motion.location.link);
    if(passage&&isNavigationLinkSurface(motion.location.surface))return;
    if(!ownsLink&&!passage&&motion.blockedReason!=='no-clear-patrol-route'&&!motion.blockedReason?.startsWith('actor:'))return;
    const actors=this.physicalActors().filter(actor=>actor.id!==id),world=this.reservePetPassage(this.petNavigationWorld(motion.radius,actors,motion),passage),
      route=planYieldNavigation(world,motion.location,reserved,reservedRadius);
    if(!route){
      // An occupied landing can prevent the first exit route from existing.
      // Clear its actual companion body before accepting any movement through it.
      const links=world.links.filter(link=>isNavigationLinkSurface(motion.location.surface)&&motion.location.link===link.id
        ||reserved.some(location=>isNavigationLinkSurface(location.surface)&&location.link===link.id));
      for(const actor of actors){
        if(actor.id==='hero'||requested.has(actor.id as UnitId)||roster[actor.id as UnitId].health<=0)continue;
        if(links.some(link=>((actor.location.floor??1)===link.lower||(actor.location.floor??1)===link.upper)
          &&link.points.slice(1).some((to,index)=>distanceToSegment(actor.location.point,link.points[index],to)<motion.radius+actor.radius+2)))
          this.tryPetYield(actor,[...reserved,motion.location],Math.max(motion.radius,reservedRadius),requested);
      }
      return;
    }
    motion.route=route;motion.elapsed=0;motion.retryRemaining=0;motion.pauseRemaining=0;motion.blockedReason=null;
    if(passage)motion.worldKey=JSON.stringify([world.floors,world.obstacles,world.links,world.road,world.petMaxFloor]);
    this.petYields.set(id,{route,reserved:reserved.map(location=>({...location,point:[...location.point]})),reservedRadius,
      ...(passage?{passage:{...passage,points:passage.points.map(point=>[...point])},...(passageOwner?{passageOwner}:{})}:{})});
  }
  private followFloor(floor:TruckFloor) {
    if(floor===this.activeFloor)return;this.activeFloor=floor;this.renderFloor=floor;
    this.canvas.dispatchEvent(new CustomEvent('scenefloorchange',{detail:{floor,following:true}}));
  }
  /** Only an explicit new-game reset discards the session's retained position. */
  resetPosition() {
    this.stopWalking(); this.heroLocation=defaultHeroLocation();this.gaitDistance=0;this.heroFacing=1;this.petMotion.clear();this.petYields.clear();this.activeFloor=1;
    this.resourceFocus=null;this.treeCuts.clear();
    this.clearPetPassageGateOperation();
    this.publishWalking();
  }
  resetMapView() {
    this.resetOverview(false);
  }
  getResidentPosition(): readonly [number,number] {
    return [...this.currentHeroLocation().point];
  }
  /** Return to the readable truck and its nearby road without moving residents. */
  showHomeView() {
    this.resetOverview(false);
  }
  private resetOverview(wholeWorld:boolean) {
    this.cancelCameraGesture(); this.endFarmStroke(); this.endMapGesture(); this.mapPan = [0, 0]; this.mapZoom = 1; this.manualViewport = null; this.villageOverview = true;
    this.wholeWorldOverview=wholeWorld;
    this.resourceFocus=null;
    this.cameraFocusRequested = true;
    this.canvas.dispatchEvent(new CustomEvent('scenezoomchange', { detail: { zoom: this.mapZoom } }));
    this.render();
  }
  /** Legacy controllers resume the map, preserving deliberate zoom and pan.
   * Walking and gate visits never switch back to the retired close follow view. */
  resumePlayerCamera() {
    this.cancelCameraGesture(); this.endFarmStroke(); this.endMapGesture();
    this.followFloor(this.currentHeroLocation().floor??1);
    this.villageOverview=true;this.zone='home';this.resourceFocus=null;
    this.render();
  }
  /** Only the explicit map overview fits all seven ground regions at once. */
  showVillageOverview() {
    this.resetOverview(true);
  }
  setSuspended(value: boolean) {
    this.suspended = value;
    if (value) { this.stopWalking(); this.cancelCameraGesture(); this.endFarmStroke(); this.endMapGesture(); cancelAnimationFrame(this.frame); this.frame = 0; }
    else this.visibility();
  }
  setZone(zone: 'home' | 'grove', recenter = false) {
    if(zone==='grove'){this.focusResourceArea('grove');return;}
    this.resourceFocus=null;
    if (!this.action && zone !== this.zone) { this.cancelCameraGesture(); this.endFarmStroke(); this.endMapGesture(); this.zone = zone; this.villageOverview = false; }
    if (recenter) this.resetMapView();
  }
  /** Recenter the real roadside place; opening its information never moves feet. */
  focusOutdoorSite(id:OutdoorSiteId) {
    this.focusResourceArea(id);
  }
  /** Only an explicit place-view command changes the resource camera. */
  focusResourceArea(id:OutdoorSiteId) {
    if(!getGroundResourceZone(id)||this.action)return;
    this.focusResourceView({siteId:id});
  }
  focusGroundRegion(id:GroundRegionId) {
    const region=getGroundRegion(id),node=GROUND_RESOURCE_NODES.find(node=>node.regionId===id);
    if(!region||!node||this.action)return;
    this.focusResourceView({siteId:node.siteId,regionId:region.id});
  }
  focusGroundResource(id:GroundResourceId) {
    const node=getGroundResourceNode(id);if(!node||this.action)return;
    this.focusResourceView({siteId:node.siteId,nodeId:node.id});
    this.focus(`ground:${node.id}`);
  }
  private focusResourceView(focus:{siteId:OutdoorSiteId;nodeId?:GroundResourceId;regionId?:GroundRegionId}) {
    if(this.activeFloor!==1)this.setActiveFloor(1);
    this.cancelCameraGesture();this.endFarmStroke();this.endMapGesture();
    this.resourceFocus=focus;this.zone=focus.siteId==='grove'?'grove':'home';
    this.farmFocus=false;this.villageOverview=false;this.wholeWorldOverview=false;this.selectedFacilityId=null;
    this.mapPan=[0,0];this.mapZoom=1;this.manualViewport=null;this.cameraFocusRequested=true;
    this.canvas.dispatchEvent(new CustomEvent('scenezoomchange',{detail:{zoom:this.mapZoom}}));
    this.render();
  }
  /** Rewards belong to the controller and can commit only after actual work finishes. */
  playPetPassageGate(open: boolean): Promise<void> {
    if(!this.state||this.disposed||this.suspended)return Promise.reject(new Error('게임 화면을 연 뒤 동물 통로 문을 조작해 주세요.'));
    if(typeof open!=='boolean'||this.action||this.petGatePendingOpen!==null)return Promise.reject(new Error('진행 중인 행동을 마친 뒤 문을 조작해 주세요.'));
    if(getPetPassage(this.state).open===open)return Promise.reject(new Error(open?'동물 통로 문이 이미 열려 있어요.':'동물 통로 문이 이미 닫혀 있어요.'));
    const crossing=this.petsOnPassage(),roster=getUnitRoster(this.state);
    if(!open&&crossing.some(pet=>this.reducedMotion||roster[pet.id].health<=0))
      return Promise.reject(new Error('통로의 동물이 움직일 수 없어 문을 닫지 않았어요. 친구가 통로를 벗어난 뒤 다시 해 주세요.'));
    this.stopWalking();this.cancelCameraGesture();this.endFarmStroke();this.endMapGesture();
    const approaches=getPetPassageGeometry(this.state.deckLevel).heroApproaches
      .map(point=>({surface:'deck' as const,floor:1 as const,point:[...point]as Point}));
    const navigation=planWorkNavigation(this.navigationWorld(),this.heroLocation,approaches)
      ??planWorkNavigation(this.choreWorld(),this.heroLocation,approaches);
    if(!navigation)return Promise.reject(new Error('동물 통로 문으로 가는 길이 막혔어요. 빈 길로 이동하거나 동료를 회복시켜 주세요.'));
    this.petGateClosing=!open;this.petGatePendingOpen=open;this.petGateWaitElapsed=0;
    this.zone='home';this.resumePlayerCamera();this.lastFrame=performance.now();
    const walk=navigation.motion.duration,work=realDuration(1.4);
    return new Promise((resolve,reject)=>{
      this.action={kind:'pet-gate',elapsed:0,duration:walk+work,walk,work,path:navigation.points,route:navigation.motion,navigation,
        plotIndex:0,cropId:'carrot',stayAtTarget:true,stalled:0,yieldAt:0,resolve,
        reject:reason=>{this.clearPetPassageGateOperation();reject(reason);}};
      this.render();
    });
  }
  /** The controller calls this in its finally path; setState also clears a finished operation. */
  clearPetPassageGateOperation() {
    this.petGateClosing=false;this.petGatePendingOpen=null;this.petGateWaitElapsed=0;
  }
  private reroutePetGateVisit(action:Chore) {
    const retained=this.currentHeroLocation(),approaches=getPetPassageGeometry(this.state?.deckLevel??1).heroApproaches
      .map(point=>({surface:'deck' as const,floor:1 as const,point:[...point]as Point}));
    const navigation=planWorkNavigation(this.navigationWorld(),retained,approaches);
    if(!navigation)return;
    action.gaitOffset=(action.gaitOffset??0)+sampleNavigation(action.navigation,action.elapsed).distance;
    action.navigation=navigation;action.route=navigation.motion;action.path=navigation.points;
    action.walk=navigation.motion.duration;action.duration=action.walk+action.work;action.elapsed=0;
  }
  private petsOnPassage() {
    return [...this.petMotion.values()].filter(pet=>pet.location.surface==='ramp'&&pet.location.link===PET_PASSAGE_LINK_ID);
  }
  private activePetPassageLeases() {
    const current=getPetPassageGeometry(this.state?.deckLevel??1).points;
    const paths=new Map<string,{owners:UnitId[];points:Point[]}>();
    for(const pet of this.petsOnPassage()){
      const points=pet.passageLease?.points;if(!points||points.length<3)continue;
      if(points.length===current.length&&points.every((point,index)=>Math.hypot(point[0]-current[index][0],point[1]-current[index][1])<1e-7))continue;
      const key=JSON.stringify(points),existing=paths.get(key);
      if(existing)existing.owners.push(pet.id);else paths.set(key,{owners:[pet.id],points:points.map(point=>[...point])});
    }
    return [...paths.values()];
  }
  getPetPassageSceneState() {
    const geometry=getPetPassageGeometry(this.state?.deckLevel??1),open=getPetPassage(this.state??{}).open;
    const point:Point=[geometry.hinge[0],geometry.hinge[1]-16],halfX=Math.max(43,24.5/this.scale),halfY=Math.max(44.5,24.5/this.scale);
    const worldBounds:[number,number,number,number]=[point[0]-halfX,point[1]-halfY,point[0]+halfX,point[1]+halfY];
    const gateBounds=worldBounds.map((value,index)=>index%2?this.dy+value*this.scale:this.dx+value*this.scale);
    const activeCrossings=this.petsOnPassage().map(pet=>({id:pet.id,location:{...pet.location,point:[...pet.location.point]},lease:pet.passageLease??null}));
    const leasedPaths=this.activePetPassageLeases().map(path=>{
      const painted=this.petPassageLeasedPaint?.find(paint=>JSON.stringify(paint.points)===JSON.stringify(path.points));
      return {...path,id:PET_PASSAGE_LINK_ID,surface:'ramp',entryAllowed:false,open:true,
        drawn:painted?.drawn??false,painted:painted?.painted??false};
    });
    const canInteract=!!this.state&&!this.state.expedition&&!this.action&&!this.suspended&&!this.disposed&&!this.constructionMode&&!this.planningMode;
    return {drawn:this.petPassagePaint?.drawn??false,painted:this.petPassagePaint?.painted??false,open,
      closing:this.petGateClosing??false,closingPending:this.petGateClosing??false,pendingTarget:this.petGatePendingOpen??null,
      operating:this.action?.kind==='pet-gate',canInteract,activeCrossings,waitingPets:activeCrossings.map(pet=>pet.id),
      geometry,gateBounds,gate:{visible:this.activeFloor===1,x:this.dx+point[0]*this.scale,y:this.dy+point[1]*this.scale,
        worldPoint:point,worldBounds,bounds:gateBounds,hit:'pet-gate' as const},
      leasedPaths,paths:[{id:PET_PASSAGE_LINK_ID,surface:'ramp',points:geometry.points,entryAllowed:open&&!this.petGateClosing},...leasedPaths],
      pets:[...this.petMotion.values()].map(pet=>({id:pet.id,location:{...pet.location,point:[...pet.location.point]},
        passageLease:pet.passageLease??null,route:pet.route?{points:pet.route.points,surfaces:pet.route.surfaces,segments:pet.route.segments}:null}))};
  }
  private publishPetPassage() {
    const detail=this.getPetPassageSceneState();
    this.canvas.dataset.petPassage=JSON.stringify(detail);
    const eventState=JSON.stringify([detail.open,detail.closingPending,detail.operating,detail.canInteract,detail.waitingPets]);
    if(eventState!==this.petPassageEventState){
      this.petPassageEventState=eventState;this.canvas.dispatchEvent(new CustomEvent('scenepetpassagechange',{detail}));
    }
  }
  /** Rewards belong to the controller and can commit only after actual work finishes. */
  playOutdoorAction(kind:'chop'|'gather',id:OutdoorSiteId):Promise<void> {
    const now=Date.now(),feet=this.currentHeroLocation().point;
    const node=GROUND_RESOURCE_NODES.filter(node=>node.regionId===id&&(node.kind==='tree'?'chop':'gather')===kind
      &&(!this.state||getGatheringNode(this.state,node.id,now)?.ready))
      .sort((a,b)=>Math.hypot(a.point[0]-feet[0],a.point[1]-feet[1])-Math.hypot(b.point[0]-feet[0],b.point[1]-feet[1]))[0];
    return node?this.playGroundResourceAction(node.id):Promise.reject(new Error('이곳의 자원이 다시 준비 중이에요. 다른 자원을 눌러 주세요.'));
  }
  /** The chosen node never changes between its visible visit and the reward. */
  playGroundResourceAction(id:GroundResourceId):Promise<void> {
    if(!this.state||this.disposed||this.suspended)return Promise.reject(new Error('게임 화면을 연 뒤 채집해 주세요.'));
    if(this.action)return Promise.reject(new Error('이미 행동 중이에요.'));
    const stock=getGatheringNode(this.state,id),node=stock?.node;
    if(!node)return Promise.reject(new Error('땅 위의 채집물을 확인해 주세요.'));
    if(!stock.ready)return Promise.reject(new Error(`${node.name}은 ${stock.remainingSeconds}초 뒤 다시 채집할 수 있어요.`));
    this.stopWalking();
    // Work within arm's reach of the trunk or pile. The wider authored stops
    // remain available for animal traffic, while the hero uses a clear side.
    const clearance=HERO_BODY_RADIUS+3,nearby:Point[]=[];
    for(const offsetY of [8,14,-2])nearby.push([node.bounds.left-clearance,node.point[1]+offsetY],[node.bounds.right+clearance,node.point[1]+offsetY]);
    nearby.sort((a,b)=>Math.hypot(a[0]-this.heroLocation.point[0],a[1]-this.heroLocation.point[1])-Math.hypot(b[0]-this.heroLocation.point[0],b[1]-this.heroLocation.point[1]));
    const navigation=planWorkNavigation(this.choreWorld(),this.heroLocation,[...nearby,...node.approaches].map(point=>({surface:'road',point:[...point]})));
    if(!navigation)return Promise.reject(new Error('채집 장소로 가는 길이 막혔어요. 동료를 회복시키거나 빈 길로 이동해 주세요.'));
    const kind=node.kind==='tree'?'chop':'gather';
    // Preparation, visible repeated contact and putting the tool away all fit
    // inside this work window; the reward still resolves once at its end.
    const workSeconds={tree:4.6,scrap:4.2,seed:4,water:4.2}[node.kind];
    const route=navigation.motion,walk=route.duration,work=realDuration(workSeconds);
    if(kind==='chop')this.treeCuts.delete(node.id);
    this.gatheringContact=null;
    this.lastFrame=performance.now();
    return new Promise((resolve,reject)=>{this.action={kind,elapsed:0,duration:walk+work,stayAtTarget:true,
      walk,work,path:navigation.points,route,navigation,plotIndex:0,cropId:stock.cropId??'carrot',outdoorSiteId:node.siteId,
      groundResourceId:node.id,stalled:0,yieldAt:0,resolve,reject};});
  }
  /** Finish at the worked plot so queued chores continue from the resident's actual feet. */
  playAction(kind: SceneAction, plotId?: number, selectedCropId?: CropId): Promise<void> {
    if(kind==='chop'||kind==='gather')return this.playOutdoorAction(kind,kind==='chop'?'grove':'salvage');
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
    let work = kind === 'expandFarm' ? 1.8 : kind === 'fertilize' ? 1.8 : kind === 'water' ? 1.5 : kind === 'harvest' ? 1.65 : 1.5;
    if (kind === 'expand') {
      target = { surface: 'deck', floor:1, point: projectDeckPoint([-157, this.deckBounds().front - 23],1) };
      work = 1.8;
    }
    work = realDuration(work);
    // A passing pet may temporarily occupy the work approach. The fixed route
    // avoids structures; each accepted frame still waits for full actor clearance.
    let approaches:NavigationLocation[];
    if(kind==='expand')approaches=[target,...[-48,48,-96,96].map(shift=>({surface:'deck' as const,floor:1 as const,point:projectDeckPoint([-157+shift,this.deckBounds().front-23],1)}))];
    else approaches=[target,...[[u+83,v+39],[u+34,v-13],[u+34,v+81]].map(point=>({surface:'deck' as const,floor:1 as const,point:projectDeckPoint(point as Point,1)}))];
    const navigation = planWorkNavigation(this.choreWorld(),this.heroLocation,approaches);
    if (!navigation) return Promise.reject(new Error('작업 장소로 가는 길이 막혔어요. 트럭 휴식으로 동료를 회복시키거나 빈 길로 이동해 주세요.'));
    const route = navigation.motion, path = navigation.points, walk = route.duration;
    this.zone = 'home';
    this.lastFrame = performance.now();
    return new Promise((resolve,reject) => { this.action = { kind, elapsed: 0, duration: walk + work, walk, work, path, route, navigation, plotIndex, cropId, stayAtTarget:true, stalled:0, yieldAt:0, resolve,reject }; });
  }
  /** A short, visible visit to the facility; the controller commits its state exactly once. */
  playFacilityAction(slot: number, kind: 'build' | 'upgrade', position?:FacilityPlacement, buildingId?:number): Promise<void> {
    if (this.disposed) return Promise.resolve();
    if (this.action) return Promise.reject(new Error('이미 행동 중이에요.'));
    this.stopWalking();
    const building=this.state&&buildingId!==undefined?getSettlement(this.state).buildings.find(value=>value.id===buildingId):undefined;
    const placement=position??(building&&this.state?getFacilityPlacement(this.state,building):this.legacyPlacement(slot));
    const {x:u,y:v,floor}=placement,type=building?.type??this.constructionMode??'waterworks';
    const footprint=getBuildingFootprint(type,placement.rotation),halfW=footprint.width/2+18,halfD=footprint.depth/2+18;
    // Work from an unobstructed edge of this particular building's footprint.
    const approaches=[[halfW,halfD],[-halfW,halfD],[halfW,-halfD],[-halfW,-halfD],[halfW,0],[-halfW,0],[0,halfD],[0,-halfD]]
      .map(([x,y])=>({surface:'deck' as const,floor,point:projectDeckPoint([u+x,v+y],floor)}));
    const navigation = planWorkNavigation(this.choreWorld(),this.heroLocation,approaches);
    if (!navigation) return Promise.reject(new Error('시설로 가는 길이 막혔어요. 트럭 휴식으로 동료를 회복시킨 뒤 다시 해 주세요.'));
    const route = navigation.motion, path = navigation.points, walk = route.duration, work = realDuration(1.65);
    this.zone = 'home'; this.lastFrame = performance.now();
    return new Promise((resolve,reject) => { this.action = { kind, elapsed: 0, duration: walk + work, walk, work, path,
      route, navigation, plotIndex: 0, cropId: 'carrot', facilitySlot: slot, facilityPlacement:placement,facilityId:buildingId, stayAtTarget:true, stalled:0, yieldAt:0, resolve,reject }; });
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
    if(this.action?.kind==='pet-gate')this.action.reject(new Error('게임 화면을 닫아 문 조작을 멈췄어요.'));
    else if(this.action?.groundResourceId)this.action.reject(new Error('게임 화면을 닫아 채집을 멈췄어요.'));
    else this.action?.resolve();
    this.action = null;this.treeCuts.clear();this.clearPetPassageGateOperation();
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
    const pointers = [...this.pinch.pointerIds];
    if(this.placementPointer!==null&&!pointers.includes(this.placementPointer))pointers.push(this.placementPointer);
    this.placementPointer=null;
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
    const candidates = withinCanvas ? this.hits.filter(item => item.polygon
      ? circleOverlapsPolygon([x,y],0,item.polygon)
      : item.bounds ? x >= item.bounds[0] && y >= item.bounds[1] && x <= item.bounds[2] && y <= item.bounds[3]
      : Math.hypot(item.x - x, item.y - y) < Math.max(item.radius, 22 / this.scale)) : [];
    const plots = candidates.filter(item => item.kind === 'farm').sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y));
    return { candidates, plots, x, y };
  }
  private publishGeometry() {
    const round = (value: number) => Math.round(value * 1000) / 1000;
    const geometry = JSON.stringify({ scale: round(this.scale), dx: round(this.dx), dy: round(this.dy), zone: this.zone,
      farmMode: this.farmMode, constructionMode: this.constructionMode, mapZoom: this.mapZoom,
      mapMoveMode: this.mapMoveMode, mapPan: this.mapPan.map(round), manualCamera: this.manualViewport !== null,
      playerFollowing:this.playerCameraFollowing,cameraCenter:{x:round(this.camera.x),y:round(this.camera.y)},
      cameraMode:this.cameraMode,overviewBounds:this.overviewBounds,overviewScope:this.wholeWorldOverview?'world':'home',
      resourceFocus:this.resourceFocus,
      cameraViewport:{width:round(this.cameraViewport[0]),height:round(this.cameraViewport[1])},
      planningMode: this.planningMode, planningLevel: this.planningLevel, expansionPreview: this.expansionPreview,
      activeFloor:this.activeFloor,floorCount:this.state?getTruckFloorCount(this.state):1,houseMoveMode:false,
      selectedFloor:this.activeFloor,visibleFloors:[this.activeFloor],floorHeight:FLOOR_HEIGHT,
      drawFloorHeights:[94+(this.activeFloor-1)*FLOOR_HEIGHT],
      physicalFloors:Array.from({length:this.state?getTruckFloorCount(this.state):1},(_,index)=>index+1),
      layoutPaintGeometry:this.layoutPaintGeometry,productionItems:this.productionItems,
      layoutDirections:{home:null,
        facilities:this.state?getSettlement(this.state).buildings.filter(building=>getFacilityPlacement(this.state!,building).floor===this.activeFloor).map(building=>({id:building.id,floor:this.activeFloor,direction:getFacilityPlacement(this.state!,building).rotation})):[],
        plots:this.state&&this.activeFloor===1?this.state.plots.map(plot=>({id:plot.id,floor:1,direction:getLayoutDirection(this.state!,{kind:'plot',id:plot.id})})):[]},
      deckLevel: this.state?.deckLevel ?? 1, farmCapacity: this.state ? getFarmCapacity(this.state) : 3,
      deckGrid:this.state?{size:DECK_CELL_SIZE,bounds:getDeckGridBounds(this.state,this.activeFloor),placement:this.selectedPlacement}:null,
      viewport: { width: round(this.width), height: round(this.height), safeTop: round(this.safeViewport.top), safeBottom: round(this.safeViewport.bottom), safeLeft: round(this.safeViewport.left), safeRight: round(this.safeViewport.right), usableWidth: round(this.safeViewport.width), usableHeight: round(this.safeViewport.height) } });
    if (this.canvas.dataset.sceneGeometry !== geometry) this.canvas.dataset.sceneGeometry = geometry;
    const buildings = this.state ? getSettlement(this.state).buildings : [];
    const slots = buildings.filter(building=>this.state&&getFacilityPlacement(this.state,building).floor===this.activeFloor).map(building => {
      const placement=getFacilityPlacement(this.state!,building),point=this.facilityPoint(building),size=FACILITY_SIZE[building.type];
      const bounds=getFacilityBounds(this.state!,building),polygon=this.placementPolygon(bounds),product=this.productionItems.find(item=>item.id===building.id);
      const footprint={left:round(this.dx+(point[0]-size[0]/2)*this.scale),top:round(this.dy+(point[1]-size[1])*this.scale),
        right:round(this.dx+(point[0]+size[0]/2)*this.scale),bottom:round(this.dy+(point[1]+8)*this.scale)};
      return { slot:building.slot,floor:placement.floor,placement,cellFootprint:getBuildingFootprint(building.type,placement.rotation),footprint,
        polygon:polygon.map(([x,y])=>({x,y})),available:false,blockedReason:'building',
        visible:footprint.left>=this.safeViewport.left&&footprint.right<=this.width-this.safeViewport.right&&footprint.top>=this.safeViewport.top&&footprint.bottom<=this.height-this.safeViewport.bottom,
        x:round(this.dx+point[0]*this.scale),y:round(this.dy+point[1]*this.scale),unlocked:true,buildingId:building.id,
        facilityX:round(this.dx+point[0]*this.scale),facilityY:round(this.dy+(point[1]-44)*this.scale),
        readyX:round(this.dx+(product?(product.bounds[0]+product.bounds[2])/2:point[0])*this.scale),
        readyY:round(this.dy+(product?(product.bounds[1]+product.bounds[3])/2:point[1]-size[1]-18)*this.scale),
        action:building.readyAt===null?'facility-start':(this.state?.totalMinutes??0)>=building.readyAt?'facility-collect':null,
        remainingSeconds:building.readyAt===null?null:gameMinutesToSeconds(building.readyAt-(this.state?.totalMinutes??0)) };
    });
    const deck = this.deckBounds(), preview = this.expansionPreview === null ? null : this.deckBounds(this.expansionPreview);
    const corners = (bounds: ReturnType<Scene['deckBounds']>) => [[bounds.left, bounds.back], [bounds.end, bounds.back], [bounds.end, bounds.front], [bounds.left, bounds.front]].map(([u, v]) => { const point = this.p(u, v, 95); return { x: round(this.dx + point[0] * this.scale), y: round(this.dy + point[1] * this.scale) }; });
    this.canvas.dataset.deckExpansion = JSON.stringify({ level: this.state?.deckLevel ?? 1, nextLevel: this.expansionPreview, current: corners(deck), preview: preview ? corners(preview) : null,
      gridCellSize:DECK_CELL_SIZE });
    this.canvas.dataset.houseSlots='[]';
    const encoded = JSON.stringify(slots);
    if (this.canvas.dataset.settlementSlots !== encoded) this.canvas.dataset.settlementSlots = encoded;
    const plots = (this.activeFloor===1?this.state?.plots??[]:[]).slice(0, FARM_POSITIONS.length).map((plot, index) => {
      const [u, v] = this.plotPosition(index), point = this.p(u + 35, v + 36, 112);
      return { id: plot.id, x: round(this.dx + point[0] * this.scale), y: round(this.dy + point[1] * this.scale),
        fertilized:this.state?getFarmPlotCare(this.state,plot).fertilized:false,yieldAmount:this.state?getFarmPlotCare(this.state,plot).yieldAmount:null };
    });
    const farmGeometry = JSON.stringify(plots);
    if (this.canvas.dataset.farmPlots !== farmGeometry) this.canvas.dataset.farmPlots = farmGeometry;
    const count = this.state?.plots.length ?? 3, available = this.activeFloor===1&&count < (this.state ? getFarmCapacity(this.state) : 3);
    const [u, v] = this.plotPosition(count), next = this.p(u + 35, v + 36, 112);
    const expansion = JSON.stringify({ available, index: count, x: round(this.dx + next[0] * this.scale), y: round(this.dy + next[1] * this.scale) });
    if (this.canvas.dataset.farmExpansion !== expansion) this.canvas.dataset.farmExpansion = expansion;
  }
  private eligibleFarmPlot(plot: Plot) {
    if (this.farmMode === 'plant') return plot.plantedAt === null;
    if (this.farmMode === 'water') return plot.plantedAt !== null && !plot.watered;
    if (this.farmMode === 'fertilize') return this.state!==null&&getFarmPlotCare(this.state,plot).canFertilize;
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
  private p(u: number, v: number, z = 0): Point { return this.rawP(u,v,z+(this.renderFloor-1)*FLOOR_HEIGHT); }
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
    const decoded=this.itemAtlas.complete&&this.itemAtlas.naturalWidth>0;
    const cell = ({ wood: 0, scrap: 1, food: 2, water: 3, seeds: 4 } as Record<string, number>)[resource];
    if(!decoded||cell===undefined)return{asset:'items-anime',cell,decoded,drawn:false};
    const source = this.itemAtlas.naturalWidth / 4;
    this.ctx.drawImage(this.itemAtlas, (cell % 4) * source, Math.floor(cell / 4) * source, source, source, x - size / 2, y - size / 2, size, size);
    return{asset:'items-anime',cell,decoded,drawn:true};
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
        radius,actors,facilityFootprints:this.state?this.facilityFootprints(this.state):[]});
  }
  private petNavigationWorld(radius:number,actors:NavigationActor[],motion?:PetPatrolState,id=motion?.id): NavigationWorld {
    const level=this.state?.deckLevel??1,petMaxFloor:0|TruckFloor=id&&!canAnimalBoardTruck(id,level)?0
      :id&&getAnimalDeckUnlockLevel(id)>1?1:3;
    return createNavigationWorld(this.state?.deckLevel??1,this.state?.plots.length??3,
      this.state?getSettlement(this.state).buildings.map(building=>building.slot):[],
      {floors:Array.from({length:this.state?getTruckFloorCount(this.state):1},(_,i)=>(i+1)as TruckFloor),activeFloor:this.activeFloor,
        radius,actors,actor:'pet',petMaxFloor,petPassageOpen:petMaxFloor>0&&getPetPassage(this.state??{}).open&&!this.petGateClosing,petPassageLease:motion?.passageLease,
        facilityFootprints:this.state?this.facilityFootprints(this.state):[]});
  }
  private reservePetPassage(world:NavigationWorld,passage?:NavigationLink): NavigationWorld {
    return passage?{...world,links:[...world.links.filter(link=>link.id!==passage.id),
      {...passage,points:passage.points.map(point=>[...point]),entryAllowed:false}]}:world;
  }
  /** Admitted paws own their whole physical corridor until the real exit. */
  private requestPetPassageClearance(owner:PetPatrolState) {
    const passage=owner.passageLease;
    if(owner.location.surface!=='ramp'||!passage)return;
    const reserved:NavigationLocation[]=[{...owner.location,point:[...owner.location.point]},
      ...passage.points.map((point,index)=>({point:[...point]as Point,surface:index===0?'road' as const:'deck' as const,
        ...(index===0?{}:{floor:passage.upper})})),...(owner.route?[owner.route.target]:[])];
    for(const actor of this.physicalActors()){
      if(actor.id==='hero'||actor.id===owner.id||isNavigationLinkSurface(actor.location.surface))continue;
      const onDeck=actor.location.surface==='deck'&&(actor.location.floor??1)===passage.upper;
      const clearance=onDeck?Math.min(...passage.points.slice(1).map((to,index)=>distanceToSegment(actor.location.point,passage.points[index],to)))
        :actor.location.surface==='road'?Math.hypot(actor.location.point[0]-passage.points[0][0],actor.location.point[1]-passage.points[0][1]):Infinity;
      if(clearance<owner.radius+actor.radius+2)
        this.tryPetYield(actor,reserved,owner.radius,new Set<UnitId>(),passage,owner.id);
    }
  }
  private holdsPetPassageIntent(owner:PetPatrolState,passage:NavigationLink) {
    if(owner.location.surface==='ramp'&&owner.passageLease?.id===passage.id)return true;
    if(!getPetPassage(this.state??{}).open||this.petGateClosing)return false;
    return owner.waitingForPassage===passage.id||!!(owner.route&&owner.location.surface===owner.route.start.surface
      &&(owner.location.floor??1)===(owner.route.start.floor??1)&&owner.route.segments.some(segment=>segment.link===passage.id));
  }
  /** A queued entrant must be able to reach a landing before it can own a bridge. */
  private requestPetPassageEntryClearance(waiter:PetPatrolState) {
    if(!waiter.waitingForPassage||waiter.route||this.petGateClosing||!getPetPassage(this.state??{}).open)return;
    const actors=this.physicalActors(),passage=this.petNavigationWorld(waiter.radius,actors,waiter).links.find(link=>link.id===waiter.waitingForPassage);
    if(!passage||actors.some(actor=>actor.id!==waiter.id&&(actor.passageIntent===passage.id
      ||actor.location.surface==='ramp'&&actor.location.link===passage.id)))return;
    const onRoad=waiter.location.surface==='road',hero=getPetPatrolDestination(waiter,this.petNavigationWorld(waiter.radius,actors,waiter),this.currentHeroLocation());
    if(!onRoad&&(waiter.location.surface!=='deck'||(waiter.location.floor??1)!==passage.upper)
      ||(onRoad?hero.surface==='road':hero.surface!=='road'))return;
    const landing=onRoad?passage.points[passage.points.length-1]:passage.points[0],
      reserved:NavigationLocation[]=[{surface:'ramp',floor:passage.upper,link:passage.id,point:[...landing]}];
    for(const actor of actors){
      if(actor.id==='hero'||actor.id===waiter.id||isNavigationLinkSurface(actor.location.surface))continue;
      const opposite=onRoad?actor.location.surface==='deck'&&(actor.location.floor??1)===passage.upper:actor.location.surface==='road';
      if(opposite&&Math.hypot(actor.location.point[0]-landing[0],actor.location.point[1]-landing[1])<waiter.radius+actor.radius+2)
        this.tryPetYield(actor,reserved,waiter.radius,new Set<UnitId>(),passage,waiter.id);
    }
  }
  private choreWorld() {
    const roster=getUnitRoster(this.state??{});
    return this.navigationWorld(HERO_BODY_RADIUS,this.physicalActors().filter(actor=>actor.id!=='hero'&&(this.reducedMotion||roster[actor.id as UnitId].health<=0)));
  }
  private ensurePets() {
    const residents=this.state?getUnlockedUnitIds(this.state):['dog','cat']as UnitId[],level=this.state?.deckLevel??1;
    residents.forEach((id,index)=>{
      const previous=this.petMotion.get(id);
      if(previous&&(!canAnimalBoardTruck(id,level)&&previous.location.surface!=='road'
        ||getAnimalDeckUnlockLevel(id)>1&&(previous.location.floor??1)>1)){
        this.petMotion.delete(id);this.petYields.delete(id);
      }
      if(this.petMotion.has(id))return;
      const scale=this.petScale(id),radius=getPetGroundRadius(id,scale),actors=this.physicalActors(),
        world=this.petNavigationWorld(radius,actors,undefined,id),
        // Only the original household pair starts on the little deck. Every
        // other species receives its own clear roadside space from day one.
        initialSurface=id==='dog'||id==='cat'?'deck' as const:'road' as const,
        motion=createPetPatrol(id,world,this.currentHeroLocation(),actors,index,scale,{initialSurface})
          ??(initialSurface==='deck'?createPetPatrol(id,world,this.currentHeroLocation(),actors,index,scale,{initialSurface:'road'}):undefined);
      if(motion)this.petMotion.set(id,motion);
    });
  }
  private advancePets(delta:number) {
    this.ensurePets();const roster=getUnitRoster(this.state??{}),team=this.state?getUnlockedUnitIds(this.state):['dog','cat']as UnitId[];
    for(const id of team){const motion=this.petMotion.get(id);if(!motion)continue;
      if(roster[id].health<=0){motion.speed=0;motion.blend=0;continue;}
      this.requestPetPassageEntryClearance(motion);
      this.requestPetPassageClearance(motion);
      const actors=this.physicalActors().filter(actor=>actor.id!==id),hero=this.currentHeroLocation(),yielding=this.petYields.get(id);
      const world=this.reservePetPassage(this.petNavigationWorld(motion.radius,actors,motion),yielding?.passage);
      if(yielding){
        const target=yielding.route.target;
        if(!motion.route&&motion.location.surface===target.surface&&motion.location.floor===target.floor&&Math.hypot(motion.location.point[0]-target.point[0],motion.location.point[1]-target.point[1])<.1){
          const passageOwner=yielding.passageOwner?this.petMotion.get(yielding.passageOwner):undefined;
          if(yielding.passage&&passageOwner&&this.holdsPetPassageIntent(passageOwner,yielding.passage)){
            // Wait naturally outside the whole reserved corridor. Releasing a
            // yield here would send eager followers back to the occupied entry.
            motion.speed=0;motion.blend=Math.max(0,motion.blend*(1-Math.min(1,delta*10)));motion.pauseRemaining=.35;
            continue;
          }
          this.petYields.delete(id);
        }else{
          // An explicit corridor exit has priority until its actual feet arrive.
          // Following the hero's new floor must not cancel it halfway out.
          const destination=getPetPatrolDestination(motion,world,hero);
          motion.desiredFloor=destination.floor??1;
          motion.desiredSurface=destination.surface==='road'?'road':'deck';
          const key=JSON.stringify([world.floors,world.obstacles,world.links,world.road,world.petMaxFloor]);
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
      this.requestPetPassageClearance(motion);
      if(this.petYields.has(id)||isNavigationLinkSurface(motion.location.surface)
        ||motion.blockedReason!=='no-clear-patrol-route'&&!motion.blockedReason?.startsWith('actor:'))continue;
      // A resident trying to follow an occupied stair must clear its own landing
      // before the current climber reaches it, without replacing that climber's exit.
      for(const actor of actors){
        const owner=this.petMotion.get(actor.id as UnitId),lease=this.petYields.get(actor.id as UnitId);
        if(!owner||!lease||roster[owner.id].health<=0||!isNavigationLinkSurface(owner.location.surface)
          ||motion.blockedReason!=='no-clear-patrol-route'&&motion.blockedReason!==`actor:${owner.id}`)continue;
        const link=world.links.find(link=>link.id===owner.location.link),floor=motion.location.surface==='road'?0:motion.location.floor??1,
          entry=link&&(floor===link.lower?link.points[0]:floor===link.upper?link.points[link.points.length-1]:undefined);
        if(!entry||Math.hypot(motion.location.point[0]-entry[0],motion.location.point[1]-entry[1])>=motion.radius+owner.radius+2)continue;
        this.tryPetYield({id,location:motion.location,radius:motion.radius},[...lease.reserved,owner.location,lease.route.target],Math.max(owner.radius,lease.reservedRadius));
        if(this.petYields.has(id))break;
      }
    }
  }
  private drawPets(onDeck:boolean,onlyId?:UnitId,excludeRoad=false) {
    this.ensurePets();const roster=getUnitRoster(this.state??{}),team=this.state?getUnlockedUnitIds(this.state):['dog','cat']as UnitId[],telemetry:unknown[]=[];
    for(const id of team){if(onlyId&&id!==onlyId)continue;const motion=this.petMotion.get(id);if(!motion)continue;
      const location=motion.location,[x,y]=location.point,visible=(location.floor??1)===this.activeFloor;
      const options:CompanionOptions={id,x,y,scale:this.petScale(id),time:this.reducedMotion?0:this.time,facing:motion.facing,
        pose:roster[id].health<=0?'down':motion.speed>.05&&!motion.turnRemaining?'walk':'idle',
        gait:{distance:motion.distance,speed:motion.speed,heading:motion.heading,blend:motion.blend,facingBlend:motion.facingBlend,reducedMotion:this.reducedMotion}};
      if(visible&&(!onlyId||onlyId===id)&&(!excludeRoad||location.surface!=='road')&&(onDeck?location.surface==='deck':location.surface!=='deck')){
        drawCompanion(this.ctx,options);this.hits.push({kind:'pet',x,y:y-14,radius:Math.max(24,motion.radius)});this.pulse('pet',x,y-15,Math.max(26,motion.radius));
      }
      telemetry.push({id,x,y,visible,deckUnlockLevel:getAnimalDeckUnlockLevel(id),canBoardTruck:canAnimalBoardTruck(id,this.state?.deckLevel??1),scale:options.scale,floor:location.floor??1,surface:location.surface,link:location.link??null,passageLease:motion.passageLease??null,waitingForPassage:motion.waitingForPassage??null,
        body:{x,y,radius:motion.radius,floor:location.floor??1,surface:location.surface,link:location.link??null},blockedReason:motion.blockedReason,
        facing:options.facing,pose:options.pose,turnRemaining:motion.turnRemaining,gait:options.gait,sample:sampleCompanionGait(id,options.gait!,options.scale),contacts:companionPawContacts(options)??null});
    }
    if(!onlyId)this.canvas.dataset.petMotion=JSON.stringify(telemetry);
  }
  private currentHeroLocation(): NavigationLocation {
    const action=this.action;
    if(!action)return {...this.heroLocation,point:[...this.heroLocation.point]};
    if(action.elapsed<action.walk)return sampleNavigation(action.navigation,action.elapsed).location;
    if(action.elapsed>action.walk+action.work)return sampleNavigation(action.navigation,action.elapsed-action.walk-action.work,true).location;
    return {...action.navigation.target,point:[...action.navigation.target.point]};
  }
  private walkTo(target: NavigationLocation) {
    if(!this.walkingEnabled||this.action||this.suspended||this.disposed||this.constructionMode||this.planningMode||this.selectedFacilityId!==null)return;
    const navigation=planNavigation(this.navigationWorld(),this.heroLocation,target)
      ??planNavigation(this.choreWorld(),this.heroLocation,target);
    if(!navigation)return;
    if(navigation.motion.duration<.001){this.stopWalking();return;}
    // Tapping a destination moves feet while retaining the complete map or the
    // deliberate camera position chosen by a pinch/drag.
    this.villageOverview=true;this.zone='home';
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
        obstacles:world.obstacles.map(o=>{const polygon=navigationObstaclePolygon(o);return{surface:o.surface,floor:o.floor??1,kind:o.kind,
          bounds:{left:Math.min(...polygon.map(p=>p[0])),top:Math.min(...polygon.map(p=>p[1])),right:Math.max(...polygon.map(p=>p[0])),bottom:Math.max(...polygon.map(p=>p[1]))},polygon:polygon.map(point)};})}});
    const detail={moving:walking!==null,surface:location.surface},eventState=JSON.stringify(detail);
    if(eventState!==this.walkEventState){this.walkEventState=eventState;this.canvas.dispatchEvent(new CustomEvent('scenewalkchange',{detail}));}
  }
  private publishAction() {
    const action = this.action, hero = this.heroState();
    const round = (value: number) => Math.round(value * 1000) / 1000;
    const waitingForPets=action?.kind==='pet-gate'&&this.petGateClosing&&action.elapsed>=action.walk&&this.petsOnPassage().length>0;
    const phase = !action ? 'idle' : action.elapsed < action.walk ? 'outbound' : waitingForPets?'waiting'
      : action.elapsed < action.walk + action.work ? 'working' : 'returning';
    // Read-only scene telemetry also makes pauses, stairs and completion observable.
    this.canvas.dataset.sceneAction = JSON.stringify({ kind: action?.kind ?? null, phase,
      elapsed: round(action?.elapsed ?? 0), total: round(action?.duration ?? 0),
      stalled:round(action?.stalled??0),stallLimit:CHORE_STALL_TIMEOUT,
      petGateClosing:this.petGateClosing??false,petGateWaitElapsed:round(this.petGateWaitElapsed??0),waitingPets:waitingForPets?this.petsOnPassage().map(pet=>pet.id):[],
      walk: round(action?.walk ?? 0), work: round(action?.work ?? 0),
      from: action ? { x: action.navigation.start.point[0], y: action.navigation.start.point[1], surface: action.navigation.start.surface, floor:action.navigation.start.floor??1 } : null,
      returnPoint: action ? (()=>{const point=action.stayAtTarget?action.navigation.target:action.navigation.returnLocation;return{x:point.point[0],y:point.point[1],surface:point.surface,floor:point.floor??1};})() : null,
      returnWalk: round(action?.stayAtTarget?0:action?.navigation.returnMotion.duration ?? 0),stayAtTarget:action?.stayAtTarget??false,
      route: action?.navigation.points.map(point => ({ x: point[0], y: point[1] })) ?? [], climbSegments: action?.navigation.climbSegments ?? [],
      floor:this.currentHeroLocation().floor??1,blockedReason:this.blockedReason,outdoorSiteId:action?.outdoorSiteId??null,groundResourceId:action?.groundResourceId??null,facilitySlot: action?.facilitySlot ?? null, facilityId:action?.facilityId??null,facilityPlacement:action?.facilityPlacement??null,
      pose: hero.pose, climbing: hero.climbing ?? null, progress: round(hero.progress),
      x: round(hero.point[0]), y: round(hero.point[1]), gaitTime: round(hero.time) });
    const progress = action ? Math.min(100, Math.floor(action.elapsed / action.duration * 100)) : 0;
    const detail = { kind: action?.kind ?? null, phase, progress, climbing: hero.climbing ?? null, pose: hero.pose,groundResourceId:action?.groundResourceId??null };
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
  private heroState(): HeroSceneState {
    const action = this.action;
    if (!action) {
      if(this.freeWalk){const motion=sampleNavigation(this.freeWalk.navigation,this.freeWalk.elapsed);return {...motion,facing:motion.distance>.01?motion.facing:this.heroFacing,time:(this.freeWalk.gaitOffset+motion.distance)/86};}
      const climbing = this.heroLocation.surface==='ladder'&&this.heroLocation.link!=='road-1';
      return { point: [...this.heroLocation.point], pose: climbing?'climb':'idle', facing: this.heroFacing, progress: 0, time: this.reducedMotion || climbing ? 0 : this.time };
    }
    if (action.elapsed < action.walk) {
      const motion = sampleNavigation(action.navigation, action.elapsed);
      return { ...motion, time: ((action.gaitOffset??0)+motion.distance) / 86 };
    }
    if (action.elapsed > action.walk + action.work) {
      const motion = sampleNavigation(action.navigation, action.elapsed - action.walk - action.work, true);
      return { ...motion, time: motion.distance / 86 };
    }
    const poses: Record<SceneAction, HeroPose> = { plant: 'sow', water: 'water', fertilize:'sow', harvest: 'harvest', chop: 'chop', expand: this.actionProgress() > .83 ? 'celebrate' : 'idle', expandFarm: this.actionProgress() > .83 ? 'celebrate' : 'gather', gather: 'gather', build: 'gather', upgrade: 'gather', 'pet-gate':this.petGateClosing&&this.petsOnPassage().length?'idle':'gather' };
    const node=action.groundResourceId?getGroundResourceNode(action.groundResourceId):undefined;
    const pose=node?gatheringKindForResource(node.resource):poses[action.kind];
    return { point: action.path[action.path.length - 1], pose, facing: node?node.point[0]>=action.navigation.target.point[0]?1:-1:action.kind === 'chop' || action.kind === 'gather' ? -1 : 1,
      progress: this.actionProgress(), time: (action.elapsed - action.walk) * GAME_SPEED_MULTIPLIER };
  }
  private heroOnDeck() {
    const location=this.currentHeroLocation();return location.surface==='deck'&&(location.floor??1)===this.activeFloor;
  }
  private homeViewBounds(level:number):WorldBounds {
    if(!this.state)return{left:120,top:20,right:940,bottom:590};
    if(this.activeFloor!==1)return getHomeOverviewBounds(this.state,this.activeFloor,level);
    const deck=this.deckBounds(level),corners=[[deck.left,deck.back],[deck.end,deck.back],[deck.end,deck.front],[deck.left,deck.front]]
      .map(([u,v])=>this.p(u,v,94));
    const cabin=this.p(deck.end+95,(deck.back+deck.front)/2,-107);
    // Include the home, both real road landings and a little breathing room.
    // Distant gathering regions belong only to the explicit whole-map view.
    return mergeVillageBounds([
      {left:Math.min(...corners.map(p=>p[0]))-40,top:Math.min(...corners.map(p=>p[1]))-82,
        right:Math.max(...corners.map(p=>p[0]))+40,bottom:Math.max(...corners.map(p=>p[1]))+154},
      {left:cabin[0]-126,top:cabin[1]-147,right:cabin[0]+134,bottom:cabin[1]+85},
      getVillageContentBounds(this.state,1),getTruckAccessGeometry(level).bounds,getPetPassageGeometry(level).bounds,
    ]);
  }
  private planningBounds(): WorldBounds | null {
    if (!this.planningMode) return null;
    const level = this.planningMode === 'expansion' ? this.planningLevel ?? this.state?.deckLevel ?? 1 : this.state?.deckLevel ?? 1;
    const deck = this.deckBounds(level),corners = [this.p(deck.left, deck.back, 95), this.p(deck.end, deck.back, 95), this.p(deck.end, deck.front, 95), this.p(deck.left, deck.front, 95)];
    const bounds:WorldBounds[]=[{ left:Math.min(...corners.map(p=>p[0]))-10,right:Math.max(...corners.map(p=>p[0]))+10,
      top:Math.min(...corners.map(p=>p[1]))-110,bottom:Math.max(...corners.map(p=>p[1]))+20 }];
    return { left: Math.min(...bounds.map(b => b.left)) - 22, top: Math.min(...bounds.map(b => b.top)) - 18,
      right: Math.max(...bounds.map(b => b.right)) + 22, bottom: Math.max(...bounds.map(b => b.bottom)) + 18 };
  }
  private viewportInsets(css: CSSStyleDeclaration): { top: number; bottom: number; left: number; right: number; width: number; height: number } {
    const top = Math.max(0, parseFloat(css.getPropertyValue('--world-safe-top')) || 0);
    let bottom = Math.max(0, parseFloat(css.getPropertyValue('--world-safe-bottom')) || 0), left = 0, right = 0;
    if (this.planningMode || this.width > this.height * 1.15) {
      const canvas = this.canvas.getBoundingClientRect();
      const overlay = this.planningMode === 'placement' ? document.querySelector<HTMLElement>('#construction-bar')
        : this.planningMode ? document.querySelector<HTMLElement>('#modal-root:not([hidden]) .modal')
        : document.querySelector<HTMLElement>('#farm-tray:not([hidden]), #facility-sheet:not([hidden])');
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
    const homeX = 480 - (level - 1) * 12, homeY = 350 + (level - 1) * 6-(this.activeFloor-1)*FLOOR_HEIGHT;
    const showFarm = !this.villageOverview&&this.activeFloor===1&&(this.farmFocus || this.farmMode !== null);
    const farmCount = this.state?.plots.length ?? 3;
    const visibleFarmCount = Math.min(farmCount + 1, this.state ? getFarmCapacity(this.state) : 3, FARM_POSITIONS.length);
    const farmPoints = FARM_POSITIONS.slice(0, visibleFarmCount).map(([u, v]) => this.p(u + 35, v + 36, 112));
    const farmXs = farmPoints.map(point => point[0]), farmYs = farmPoints.map(point => point[1]);
    const farmWidth = Math.max(...farmXs) - Math.min(...farmXs) + 126;
    const farmHeight = Math.max(...farmYs) - Math.min(...farmYs) + 118;
    const farmCenter: Point = farmCount <= 3 ? [468, 350]
      : [(Math.min(...farmXs) + Math.max(...farmXs)) / 2, (Math.min(...farmYs) + Math.max(...farmYs)) / 2 - 5];
    let target = showFarm && this.zone === 'home' ? { x: farmCenter[0], y: farmCenter[1], zoom: 1.48 } : { x: homeX, y: homeY, zoom: 1 };
    const action = this.action;
    // A stable whole-farm view lets additional taps queue while the hero works.
    if (action && !(this.farmMode && isFarmAction(action.kind))) {
      const entry = action.walk > 0 ? this.ease(action.elapsed / action.walk) : 1;
      const returnWalk = action.stayAtTarget ? 0 : action.navigation.returnMotion.duration;
      const exit = returnWalk > 0 ? this.ease((action.duration - action.elapsed) / returnWalk) : 1;
      const amount = Math.min(entry, exit);
      const targetPoint = action.path[action.path.length - 1];
      const logging = action.kind === 'chop' || action.kind === 'gather';
      const outdoorNode=action.groundResourceId?getGroundResourceNode(action.groundResourceId):undefined;
      const focusX = outdoorNode?outdoorNode.point[0]:logging ? 160 : targetPoint[0] + 35;
      const focusY = outdoorNode?outdoorNode.point[1]-44:logging ? 523 : targetPoint[1] - 45;
      const zoom = action.kind === 'expand' ? 1.08 : outdoorNode?1.55:logging ? 2.2 : 1.78;
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
      const selectedPoint = facility ? this.facilityPoint(facility) : null;
      // Expanded villages are explored by panning. Keep the resident's garden in
      // the home view rather than pulling the camera toward a distant truck cab.
      const gardenHomeX = Math.min(center[0], farmCenter[0] + (level > 1 ? 72 : 0));
      const targetX = this.villageOverview || this.constructionMode ? center[0] : selectedPoint?.[0] ?? gardenHomeX;
      const targetY = this.villageOverview || this.constructionMode ? center[1] : selectedPoint ? selectedPoint[1] - 52 : center[1];
      const desiredZoom = this.villageOverview ? 1 : facility ? 1.35 : 1;
      target = { x: targetX, y: targetY, zoom: desiredZoom };
    }
    // A deliberately selected facility retains readable roofs and production
    // controls. The normal map composition is fitted independently below.
    if (this.state && this.zone === 'home' && !showFarm && !this.action && !this.villageOverview) {
      let bounds = getVillageContentBounds(this.state, this.activeFloor);
      const selected = this.selectedFacilityId === null ? undefined : getSettlement(this.state).buildings.find(b=>b.id===this.selectedFacilityId);
      if (selected) {
        const [x,y]=this.facilityPoint(selected),[w,h]=FACILITY_SIZE[selected.type];
        bounds={left:x-w/2-72,top:y-h-52,right:x+w/2+72,bottom:y+72};
      }
      const village=fitVillageCamera(bounds,availableWidth,availableHeight);
      viewWidth=village.width;viewHeight=village.height;target={x:village.x,y:village.y,zoom:village.zoom};
    }
    const resourceView=this.activeFloor===1&&this.resourceFocus&&!this.planningMode&&!this.constructionMode&&!showFarm;
    const overviewView=!!this.state&&!resourceView&&!showFarm&&!this.planningMode&&!this.constructionMode&&(this.villageOverview||this.selectedFacilityId===null);
    this.overviewBounds=null;
    if(overviewView&&this.state){
      let bounds=this.wholeWorldOverview?getHomeOverviewBounds(this.state,this.activeFloor,level):this.homeViewBounds(level);
      if(this.activeFloor===1){
        const leased=this.activePetPassageLeases().map(path=>({
          left:Math.min(...path.points.map(point=>point[0]))-40,top:Math.min(...path.points.map(point=>point[1]))-72,
          right:Math.max(...path.points.map(point=>point[0]))+40,bottom:Math.max(...path.points.map(point=>point[1]))+40,
        }));
        if(leased.length)bounds=mergeVillageBounds([bounds,...leased]);
      }
      this.overviewBounds=bounds;
      const overview=frameHomeOverview(bounds,availableWidth,availableHeight);
      viewWidth=overview.width;viewHeight=overview.height;target={x:overview.x,y:overview.y,zoom:overview.zoom};
    }
    if(resourceView&&this.resourceFocus){
      const zone=(this.resourceFocus.regionId?getGroundRegion(this.resourceFocus.regionId):getGroundResourceZone(this.resourceFocus.siteId))!,node=this.resourceFocus.nodeId?getGroundResourceNode(this.resourceFocus.nodeId):undefined;
      const sprite=node?this.groundSpriteBounds(node):null;
      const bounds=sprite?{left:sprite[0]-36,top:sprite[1]-18,right:sprite[2]+36,bottom:sprite[3]+18}:zone.bounds;
      const view=frameHomeOverview(bounds,availableWidth,availableHeight);
      viewWidth=view.width;viewHeight=view.height;target={x:view.x,y:view.y,zoom:view.zoom};
      const minScale=node&&node.kind!=='tree'?RESOURCE_PROP_FOCUS_MIN_SCALE:RESOURCE_FOCUS_MIN_SCALE;
      // A selected small prop still shares a clearing with the working resident.
      // Avoid stretching one scrap sprite across a short landscape viewport.
      if(node&&view.scale>1){viewWidth=availableWidth;viewHeight=availableHeight;}
      else if(view.scale<minScale){
        viewWidth=availableWidth/minScale;viewHeight=availableHeight/minScale;
        // A short landscape strip starts at the clearing's entrance. Further
        // trees remain readable when the player pans down the real forest trail.
        target.y=node?view.y:zone.bounds.top+viewHeight/2+16/minScale;
      }
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
    this.playerCameraFollowing=false;
    this.cameraMode=this.manualViewport||this.pinch.active?'manual':planning?'planning':overviewView?'overview':'focus';
    this.cameraViewport = [viewWidth, viewHeight];
    // One user-controlled magnification works on the truck, farm, grove and during chores.
    const road=this.activeFloor===1?getRoadBounds(this.state?.deckLevel??1):null;
    this.mapPanLimit = [Math.max(viewWidth*.6,road?Math.max(target.x-road.left,road.right-target.x)+viewWidth*.35:0),
      Math.max(viewHeight*.6,road?Math.max(target.y-road.top,road.bottom-target.y)+viewHeight*.35:0)];
    this.mapPan = [Math.max(-this.mapPanLimit[0], Math.min(this.mapPanLimit[0], this.mapPan[0])),
      Math.max(-this.mapPanLimit[1], Math.min(this.mapPanLimit[1], this.mapPan[1]))];
    target.x += this.mapPan[0]; target.y += this.mapPan[1]; target.zoom *= this.mapZoom;
    // Explicit navigation or the reset control returns to automatic camera focus.
    if (this.cameraFocusRequested && !this.manualViewport) {
      this.camera = { ...target }; this.cameraFocusRequested = false;
    }
    if (!this.manualViewport && !this.pinch.active) {
      if(overviewView){this.camera={...target};}
      else{
        this.camera.x += (target.x - this.camera.x) * blend;
        this.camera.y += (target.y - this.camera.y) * blend;
        this.camera.zoom += (target.zoom - this.camera.zoom) * blend;
      }
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
    c.fillStyle = '#c3bd95'; c.fillRect(0, 0, this.width, this.height);
    this.updateCamera();
    c.translate(this.dx, this.dy); c.scale(this.scale, this.scale);
    this.hits = [];
    this.accessStairPaint=null;
    this.layoutPaintGeometry=[];this.productionItems=[];this.groundResourcePaint=[];this.groundMarkerPaint=[];
    this.petPassagePaint={drawn:false,painted:false};
    this.petPassageLeasedPaint=[];
    this.heroDrawn = false;
    this.heroToolContact = null;
    this.environment();
    if(this.activeFloor===1)this.groundTrails();
    this.truck();
    if(this.activeFloor===1)this.petPassage();
    if(this.activeFloor===1)this.groundResources();
    this.drawPets(true);
    this.drawPets(false,undefined,this.activeFloor===1);
    if(this.freeWalk&&(this.freeWalk.navigation.target.floor??1)===this.activeFloor){const target=this.freeWalk.navigation.target.point;this.ellipse(target[0],target[1],9,4,'#f8f0bf60','#ffe9a3',1.5);}
    this.hero();
    this.workEffects();
    this.constructionPreview();
    // Ground, residents, timber and foliage share one ambient light pass.
    // Night is a gentle moonlit colour shift: chores must remain readable at
    // every hour, including the broad overview of the gathering grounds.
    c.save(); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const night = skyNightAmount(this.state?.minutes ?? 660);
    if (night < 1) { c.fillStyle = `rgba(255,242,211,${(1 - night) * .025})`; c.fillRect(0, 0, this.width, this.height); }
    if (night > 0) { c.fillStyle = `rgba(74,94,121,${night * .18})`; c.fillRect(0, 0, this.width, this.height); }
    c.restore();
    this.groundMarkers();
    this.fireflies();
    this.publishGeometry();
    this.publishAction();
    this.publishWalking();
    this.publishPetPassage();
    this.canvas.dataset.sceneHits=JSON.stringify(this.hits.map(hit=>({...hit})));
    this.canvas.dataset.groundResources=JSON.stringify(this.groundResourcePaint);
    this.canvas.dataset.outdoorGround=JSON.stringify({visible:this.activeFloor===1,cutaway:false,truckOpacity:1,
      roadActorLayer:'normal-world-order',groundPolicy:'outside-truck-body',
      nodes:this.groundResourcePaint,markers:this.groundMarkerPaint,trails:GROUND_RESOURCE_ZONES,regenerationSeconds:180,
      regions:GROUND_REGIONS.map(region=>{const nodes=GROUND_RESOURCE_NODES.filter(node=>node.regionId===region.id);return{...region,nodeIds:nodes.map(node=>node.id),totalCount:nodes.length,readyCount:nodes.filter(node=>!this.state||getGatheringNode(this.state,node.id)?.ready).length};}),
      terrain:{style:'painted-continuous-ground',asset:'ground-landscape',cameraIndependent:true,fixedWorldBounds:GROUND_LANDSCAPE_BOUNDS,coverageWorldBounds:GROUND_BACKGROUND_BOUNDS,tileMode:'single-painting-soft-terrain-border',ready:groundArtReady(),paintedTrailIds:GROUND_REGIONS.map(region=>region.id),capsulePaths:false,actorDepth:'foot-y',treeVariants:3},
      sites:GROUND_RESOURCE_ZONES.map((zone,index)=>{const nodes=GROUND_RESOURCE_NODES.filter(node=>node.regionId===zone.id),
        readyCount=nodes.filter(node=>!this.state||getGatheringNode(this.state,node.id)?.ready).length;
        return{id:zone.id,index,name:zone.name,bounds:zone.bounds,totalCount:nodes.length,readyCount,ready:readyCount>0};}),
      ladderEntry:{x:this.dx+this.navigationWorld().ladder.bottom[0]*this.scale,y:this.dy+(this.navigationWorld().ladder.bottom[1]-19)*this.scale},accessStairs:this.accessStairPaint});
    // Assets are cached before the next frame; the fallback never hides interactions.
    if (!worldArtReady()) this.label('그림을 불러오는 중…', 470, 45, 13, '#fff2d0');
  }

  private environment() {
    const backdrop = this.ctx.createLinearGradient(0, -1100, 0, 1200);
    backdrop.addColorStop(0, '#f6f0d9'); backdrop.addColorStop(.4, '#ecebd1'); backdrop.addColorStop(1, '#a9b48b');
    this.ctx.fillStyle = backdrop; this.ctx.fillRect(-3000, -2500, 7000, 5000);
    const left = -this.dx / this.scale, right = (this.width - this.dx) / this.scale;
    const top = -this.dy / this.scale, bottom = (this.height - this.dy) / this.scale;
    // Ground artwork has fixed world coordinates. Camera movement never scales
    // the highway beneath independently positioned actors and terrain.
    if (!drawGroundLandscape(this.ctx) && !drawWorldRoad(this.ctx)) {
      const sky = this.ctx.createLinearGradient(0, -200, 0, 800); sky.addColorStop(0, '#f2ead0'); sky.addColorStop(1, '#b0b18b');
      this.ctx.fillStyle = sky; this.ctx.fillRect(-1000, -600, 3000, 2000);
    }
    const night=skyNightAmount(this.state?.minutes??660);
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
    const passageV=getPetPassageGeometry(level).hingeUV[1];
    const floorArt={project:(u:number,v:number,z:number)=>this.rawP(u,v,z),bounds:{left,end,back,front:deckFront},
      floors:Array.from({length:this.state?getTruckFloorCount(this.state):1},(_,i)=>({id:(i+1)as TruckFloor,z:94+i*FLOOR_HEIGHT})),selectedFloor:this.activeFloor,
      stairways:Array.from({length:(this.state?getTruckFloorCount(this.state):1)-1},(_,i)=>{const stair=getFloorStairs(this.state?.deckLevel??1,(i+2)as 2|3);return{from:stair.lowerFloor,to:stair.upperFloor,top:stair.top,bottom:stair.bottom,reserved:stair.reserved};}),
      railGaps:this.activeFloor===1?[{edge:'front' as const,from:-270,to:-180},{edge:'left' as const,from:passageV-52,to:passageV+52}]:[],night:skyNightAmount(this.state?.minutes??660)};
    drawTruckFloor(this.ctx,{...floorArt,pass:'structure'});
    if(this.activeFloor===1){
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
    }
    this.renderFloor=this.activeFloor;
    this.box(left, back, 78, end - left, deckFront - back, 15, '#e4c28c', '#bc9669', '#caab78', '#655037');
    const deck: [Point, Point, Point, Point] = [this.p(left + 1, back + 1, 94), this.p(end, back + 1, 94), this.p(end, deckFront, 94), this.p(left + 1, deckFront, 94)];
    this.poly(deck, '#d8ab64', '', 0); paintWorldQuad(this.ctx, 'wood', deck, -.025);
    // Keep the original painted material, with softer grain under small buildings.
    this.poly(deck, '#edd3a547', '', 0); this.poly(deck, '', '#715135', 1.6);
    for (let v = back + 24; v < deckFront; v += 24) {
      this.line([this.p(left + 1, v, 94), this.p(end, v, 94)], '#72533138', .8);
      this.line([this.p(left + 1, v + 1, 94), this.p(end, v + 1, 94)], '#ffe1a32e', .6);
    }
    for (let v = 141; v < deckFront; v += 36) this.line([this.p(left + 1, v, 94), this.p(end, v, 94)], '#80613c72', 1);
    drawTruckFloor(this.ctx,{...floorArt,pass:'back'});
    this.expansionDeck();
    this.bunting(); this.settlement();if(this.activeFloor===1)this.farm();
    if(this.activeFloor===1){this.renderFloor=1;this.cabin();this.renderFloor=this.activeFloor;}
    drawTruckFloor(this.ctx,{...floorArt,pass:'front'});
    this.flowerPot(left + 25, deckFront - 21, 95, '#e5a082');
    this.flowerPot(end - 16, deckFront - 16, 95, '#80a896');
    if(this.activeFloor===1)this.ramp();
    if (level >= 2) {
      const q = this.p(70, deckFront - 17, 96);
      this.label(`LIVING DECK · LV.${Math.floor(level)}`, q[0], q[1], 9, '#694f2c', 700);
    }
    if (this.action?.kind === 'expand') this.buildingDeck();
    if(this.activeFloor===1){
      const center = this.p(end + 50, (back + deckFront) / 2, 120);
      this.hits.unshift({kind: 'truck', x: center[0], y: center[1] + 55, radius: 97});
      this.pulse('truck', center[0], center[1] + 50, 71);
    }
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
    const currentGrid=getDeckGridBounds({deckLevel:this.state?.deckLevel??1},this.activeFloor),nextGrid=getDeckGridBounds({deckLevel:this.expansionPreview},this.activeFloor);
    const addedCells=Math.round(((nextGrid.right-nextGrid.left)*(nextGrid.bottom-nextGrid.top)-(currentGrid.right-currentGrid.left)*(currentGrid.bottom-currentGrid.top))/(DECK_CELL_SIZE*DECK_CELL_SIZE));
    const addedFarm=getFarmCapacity({deckLevel:this.expansionPreview})-getFarmCapacity({deckLevel:this.state?.deckLevel??1});
    this.round(point[0] - 70 * pixel, point[1] - 20 * pixel, 140 * pixel, 41 * pixel, 10 * pixel, '#edf5d6f5', '#91af74');
    this.label(`새 데크 · Lv.${this.expansionPreview}`, point[0], point[1] - 4 * pixel, 11 * pixel, '#48683c', 800);
    this.label(`꾸미기 공간 +${addedCells}칸 · 밭 최대 +${addedFarm}`, point[0], point[1] + 12 * pixel, 9 * pixel, '#667c50', 600);
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

  private placementPolygon(bounds:{left:number;top:number;right:number;bottom:number},floor=this.activeFloor):Point[] {
    return [[bounds.left,bounds.top],[bounds.right,bounds.top],[bounds.right,bounds.bottom],[bounds.left,bounds.bottom]]
      .map(point=>projectDeckPoint(point,floor));
  }
  private constructionGrid() {
    if(!this.state||!this.constructionMode&&!this.planningMode)return;
    const bounds=getDeckGridBounds(this.state,this.activeFloor),pixel=1/this.scale;
    this.poly(this.placementPolygon(bounds),'#fff5cb12','#ebefd0a6',1.2*pixel);
    for(let u=bounds.left+DECK_CELL_SIZE;u<bounds.right;u+=DECK_CELL_SIZE)
      this.line([projectDeckPoint([u,bounds.top],this.activeFloor),projectDeckPoint([u,bounds.bottom],this.activeFloor)],'#fff9d75b',.65*pixel);
    for(let v=bounds.top+DECK_CELL_SIZE;v<bounds.bottom;v+=DECK_CELL_SIZE)
      this.line([projectDeckPoint([bounds.left,v],this.activeFloor),projectDeckPoint([bounds.right,v],this.activeFloor)],'#fff9d75b',.65*pixel);
    for(const building of getSettlement(this.state).buildings){
      if(building.id===this.movingBuildingId||getFacilityPlacement(this.state,building).floor!==this.activeFloor)continue;
      this.poly(this.placementPolygon(getFacilityBounds(this.state,building)),'#624f3529','#d6b78c95',1*pixel);
    }
  }
  /** Placement is a readable interaction overlay above residents and structures. */
  private constructionPreview() {
    if(!this.state)return;
    const pixel=1/this.scale;
    const placement=this.selectedPlacement,type=this.constructionMode;
    if(!placement||!type||placement.floor!==this.activeFloor)return;
    const size=getBuildingFootprint(type,placement.rotation),check=checkFacilityPlacement(this.state,type,placement,this.movingBuildingId??undefined);
    const left=placement.x-size.width/2,top=placement.y-size.depth/2;
    const color=check.ok?'#cdf19383':'#efb5a078',edge=check.ok?'#ccec99':'#ef9f8a';
    for(let row=0;row<size.rows;row++)for(let column=0;column<size.columns;column++){
      const x=left+column*DECK_CELL_SIZE,y=top+row*DECK_CELL_SIZE;
      this.poly(this.placementPolygon({left:x,top:y,right:x+DECK_CELL_SIZE,bottom:y+DECK_CELL_SIZE}),color,'#fff9e38c',.7*pixel);
    }
    this.poly(this.placementPolygon({left,top,right:left+size.width,bottom:top+size.depth}),'',edge,2.8*pixel);
    const point=projectDeckPoint([placement.x,placement.y],placement.floor),[width,height]=FACILITY_SIZE[type];
    drawFacility(this.ctx,type,point[0],point[1],width,height,check.ok?.65:.35,
      this.movingBuildingId===null?1:getSettlement(this.state).buildings.find(b=>b.id===this.movingBuildingId)?.level??1,placement.rotation);
    const caption=`${size.columns} × ${size.rows} · ${check.ok?'설치 가능':'위치 조정'}`,badgeWidth=check.ok?112:120;
    this.round(point[0]-badgeWidth/2*pixel,point[1]+12*pixel,badgeWidth*pixel,25*pixel,10*pixel,'#fff9e9f5',edge);
    this.label(caption,point[0],point[1]+29*pixel,10*pixel,check.ok?'#4f7138':'#9a543d',800);
  }

  private settlement() {
    const state = this.state, buildings = state ? getSettlement(state).buildings : [];
    const selectedType = this.constructionMode;
    const ordered = buildings.filter(b=>state&&getFacilityPlacement(state,b).floor===this.activeFloor).sort((a,b)=>this.facilityPoint(a)[1]-this.facilityPoint(b)[1]);
    const bubbles=layoutProductionBubbles(ordered.map(building=>{
      const point=this.facilityPoint(building),height=FACILITY_SIZE[building.type][1];
      return{id:building.id,x:this.dx+point[0]*this.scale,y:this.dy+(point[1]-height-18)*this.scale,width:building.readyAt===null?44:48,height:48};
    }),{left:this.safeViewport.left,top:this.safeViewport.top,right:this.width-this.safeViewport.right,bottom:this.height-this.safeViewport.bottom});
    this.constructionGrid();
    for (const building of ordered) {
      const point = this.facilityPoint(building), [width, height] = FACILITY_SIZE[building.type];
      const selected = building.id === this.selectedFacilityId;
      if (selected) {
        this.ctx.save(); this.ctx.shadowColor = '#fff2a1'; this.ctx.shadowBlur = 14;
        this.ellipse(point[0], point[1] - 3, width * .56, 23, '#fbea9c45', '#ffefa4', 2.5); this.ctx.restore();
      }
      const alpha = building.id === this.movingBuildingId ? .4 : 1;
      if (facilityArtReady()) {
        const direction=state?getFacilityPlacement(state,building).rotation:0;
        drawFacility(this.ctx, building.type, point[0], point[1], width, height, alpha, building.level,direction,
          matrix=>this.layoutPaintGeometry.push({kind:'facility',id:building.id,floor:this.activeFloor,direction,anchor:point,matrix,sourceSlopes:FACILITY_BASE_SLOPES[building.type],level:building.level}));
      }
      else drawWorldSprite(this.ctx, building.type === 'waterworks' ? 'tank' : building.type === 'greenhouse' ? 'solar' : 'furniture', point[0], point[1], width * .76, height * .76, alpha);
      this.hits.push({ kind: 'facility', x: point[0], y: point[1] - height/2, radius: 61,
        bounds:[point[0]-width/2,point[1]-height,point[0]+width/2,point[1]+8],plotId: building.id });
    }
    if(state&&!selectedType&&!this.planningMode)for(const building of ordered){
      const position=bubbles.get(building.id)!;if(!position.displaced)continue;
      const point=this.facilityPoint(building),height=FACILITY_SIZE[building.type][1],pixel=1/this.scale;
      const boxHeight=48,bubble:Point=[(position.x-this.dx)/this.scale,(position.y-this.dy)/this.scale];
      this.line([[bubble[0],bubble[1]+boxHeight/2*pixel],[point[0],point[1]-height*.72]],'#9b966b96',1.1*pixel);
      this.ellipse(point[0],point[1]-height*.72,1.8*pixel,1.8*pixel,'#b5ac7b');
    }
    const shortNames: Record<BuildingType, string> = { workshop: '공방', kitchen: '부엌', waterworks: '정수소', greenhouse: '온실', watchtower: '감시소', petHouse: '보리 집' };
    for (const building of ordered) {
      const point = this.facilityPoint(building), [, height] = FACILITY_SIZE[building.type];
      const pixel = 1 / this.scale, caption = `${shortNames[building.type]} ${building.level}`;
      if (building.id === this.selectedFacilityId || building.id === this.movingBuildingId) {
        this.round(point[0] - 37 * pixel, point[1] + 5 * pixel, 74 * pixel, 19 * pixel, 8 * pixel, '#fff9e9ed', '#b8ac85');
        this.label(caption, point[0], point[1] + 18 * pixel, 10 * pixel, '#53654b', 700);
      }
      // Placement previews own the map while building: production controls must
      // not cover a free slot or intercept a placement confirmation.
      if (!state || selectedType || this.planningMode) continue;
      const anchor:Point=[point[0],point[1]-height-18],position=bubbles.get(building.id)!;
      const bubble:Point=[(position.x-this.dx)/this.scale,(position.y-this.dy)/this.scale];
      const definition = BUILDINGS[building.type],amount=definition.yieldAmount*building.level;
      const ready=building.readyAt!==null&&state.totalMinutes>=building.readyAt;
      const status=building.readyAt===null?'idle':ready?'ready':'running';
      const duration=building.readyAt===null?0:building.readyAt-(building.startedAt??state.totalMinutes);
      const progress=status==='ready'?1:status==='running'&&duration>0
        ?Math.max(0,Math.min(1,(state.totalMinutes-(building.startedAt??state.totalMinutes))/duration)):0;
      const remaining=building.readyAt===null?null:gameMinutesToSeconds(building.readyAt-state.totalMinutes);
      const width=status==='idle'?44:48,boxHeight=48;
      const bounds:[number,number,number,number]=[bubble[0]-width/2*pixel,bubble[1]-boxHeight/2*pixel,bubble[0]+width/2*pixel,bubble[1]+boxHeight/2*pixel];
      if(status==='ready'){this.ctx.save();this.ctx.shadowColor='#3f4b2938';this.ctx.shadowBlur=7*pixel;this.ctx.shadowOffsetY=2*pixel;}
      this.round(bounds[0],bounds[1],width*pixel,boxHeight*pixel,13*pixel,
        status==='ready'?'#fff1ba':status==='running'?'#edf2ddf5':'#f3f3dcf5',status==='ready'?'#b99b55':'#b1bc98');
      if(status==='ready')this.ctx.restore();
      const art=this.resourceIllustration(definition.yieldResource,bubble[0]-(status==='ready'?7:0)*pixel,
        bubble[1]-(status==='running'?9:5)*pixel,28*pixel);
      let hit:'facility-start'|'facility-collect'|'facility'|null=null;
      if(status==='idle'){
        this.label('생산',bubble[0],bubble[1]+18*pixel,9*pixel,'#596d49',700);
        hit='facility-start';
      }else if(status==='ready'){
        this.label(`+${amount}`,bubble[0]+13*pixel,bubble[1]-3*pixel,9*pixel,'#68713e',800);
        this.label('받기',bubble[0],bubble[1]+18*pixel,9*pixel,'#796638',700);
        hit='facility-collect';
      }else{
        this.label(formatGameDuration(building.readyAt!-state.totalMinutes),bubble[0],bubble[1]+12*pixel,9*pixel,'#52714b',700);
        this.round(bubble[0]-18*pixel,bubble[1]+19*pixel,36*pixel,3*pixel,1.5*pixel,'#687c5733');
        if(progress>0)this.round(bubble[0]-18*pixel,bubble[1]+19*pixel,36*progress*pixel,3*pixel,1.5*pixel,'#88ae7c');
        hit='facility';
      }
      if(hit)this.hits.push({kind:hit,x:bubble[0],y:bubble[1],radius:width/2*pixel,bounds,plotId:building.id});
      // Record the actual painted product and complete finger target, so QA can
      // compare the item image with the real batch rather than an icon alias.
      this.productionItems.push({id:building.id,slot:building.slot,floor:this.activeFloor,resource:definition.yieldResource,
        amount,state:status,progress,remainingSeconds:remaining,itemArt:art,bounds,
        screenBounds:bounds.map((value,index)=>(index%2?this.dy:this.dx)+value*this.scale)as[number,number,number,number],
        hit,displaced:position.displaced,anchor});
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
      const direction=this.state?getLayoutDirection(this.state,{kind:'plot',id:plot.id}):0;
      const mid = this.p(u + 35, v + 36, 112);
      // A resident behind a planter belongs behind its wood and leaves as well.
      // Every bed edge uses the same projection as the truck and collision box.
      // Painted wood/soil textures remain, without the atlas's tilted base.
      this.drawAlignedPlanter(u,v,direction,plot.id);
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
        const [first,second]=cropPositions[k],[plantU,plantV]=direction===0?[first,second]:[second,first], [x, y] = this.p(u + plantU, v + plantV, 107);
        const mature = progress >= 1, medium = progress > .35;
        const growthScale = mature ? 1 : medium ? .7 + progress * .24 : .38 + progress * .8;
        const width = CROP_PLANT_SIZE[cropId][0] * growthScale, height = CROP_PLANT_SIZE[cropId][1] * growthScale;
        this.ctx.save(); this.ctx.translate(x, y); this.ctx.rotate(Math.sin(this.time * 1.1 + k + i) * .018);
        if (!drawCropSprite(this.ctx, cropId, 'plant', 0, 3, width, height)) drawWorldSprite(this.ctx, mature ? 'carrot' : medium ? 'carrotYoung' : 'sprout', 0, 3, width, height);
        this.ctx.restore();
      }
      if(this.state&&getFarmPlotCare(this.state,plot).fertilized){
        const point=this.p(u+35,v+67,120),pixel=1/this.scale;
        this.round(point[0]-19*pixel,point[1]-7*pixel,38*pixel,15*pixel,7*pixel,'#edf3d9f5','#8caa6b');
        this.label('영양 +2',point[0],point[1]+3*pixel,8*pixel,'#537246',800);
      }
      if (eligibleTarget && !working) {
        const center = this.p(u + 34, v + 34, 115);
        this.ctx.save(); this.ctx.globalAlpha = queueIndex >= 0 ? .95 : .65;
        if (this.farmMode === 'plant') drawCropSprite(this.ctx, this.plantingCropId, 'seed', center[0], center[1] + 4, 18, 24);
        else {
          const hint = this.p(u + 53, v + 46, 125);
          this.ellipse(hint[0], hint[1], 10, 10, '#fff9e9e8', waterTool ? '#88bed5' : '#ccb16c', 1);
          if (waterTool) this.waterDrop(hint[0], hint[1] + 1, 7);
          else if(this.farmMode==='fertilize')this.sprig(hint[0],hint[1]+8,.55);
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
      const marker = this.p(u + (direction===0?63:9), v + (direction===0?9:63), 107);
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
        this.drawAlignedPlanter(u,v,0);
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

  private drawAlignedPlanter(u:number,v:number,direction:LayoutDirection,plotId?:number) {
    const face=(coordinates:[number,number,number][],fill:string)=>{
      const points=coordinates.map(([du,dv,z])=>this.p(u+du,v+dv,z)) as [Point,Point,Point,Point];
      this.poly(points,fill,'#735339',.9);paintWorldQuad(this.ctx,'wood',points,.05);return points;
    };
    // The 69×68 bed footprint is unchanged; only its art and row direction turn.
    face([[0,68,106],[69,68,106],[69,68,96],[0,68,96]],'#b28b56');
    face([[69,0,106],[69,68,106],[69,68,96],[69,0,96]],'#927048');
    const soil:[Point,Point,Point,Point]=[this.p(u+6,v+6,106),this.p(u+63,v+6,106),this.p(u+63,v+62,106),this.p(u+6,v+62,106)];
    this.poly(soil,'#493321','',0);paintWorldQuad(this.ctx,'soil',soil,.07);
    const rows:Point[][]=[];
    for(const row of[18,36,54]){
      const start=direction===0?this.p(u+8,v+row,106.2):this.p(u+row,v+8,106.2);
      const end=direction===0?this.p(u+61,v+row,106.2):this.p(u+row,v+60,106.2);
      rows.push([start,end]);
      this.line([start,end],'#2e22197a',1.5);
      this.line([[start[0],start[1]-.7],[end[0],end[1]-.7]],'#94754b70',.7);
    }
    face([[0,0,107],[69,0,107],[63,6,107],[6,6,107]],'#d9b47b');
    face([[69,0,107],[69,68,107],[63,62,107],[63,6,107]],'#c5a06b');
    face([[69,68,107],[0,68,107],[6,62,107],[63,62,107]],'#e4c18a');
    face([[0,68,107],[0,0,107],[6,6,107],[6,62,107]],'#d4ae74');
    for(const[du,dv]of[[1,1],[65,1],[65,64],[1,64]]){
      this.box(u+du,v+dv,97,3,3,14,'#7d987d','#577965','#486955','#826643');
      const[x,y]=this.p(u+du+2,v+dv+3,104);this.ellipse(x,y,1.15,.9,'#cfb274');
    }
    this.layoutPaintGeometry.push({kind:'plot',id:plotId??null,floor:this.activeFloor,direction,
      bed:[this.p(u,v,107),this.p(u+69,v,107),this.p(u+69,v+68,107),this.p(u,v+68,107)],soil,rows,preview:plotId===undefined});
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
    const progress = hero.progress;
    const outfit=this.state?getEquippedOutfit(this.state):'default';
    const drawn=drawHero(this.ctx, { x, y, scale: WORLD_HERO_SCALE, gender: this.state?.gender ?? 'female', pose: hero.pose, facing: hero.facing, time: hero.time, progress, climbing: hero.climbing,outfit,reducedMotion:this.reducedMotion });
    if(drawn.toolContact)this.heroToolContact=[drawn.toolContact.x,drawn.toolContact.y];
    this.canvas.dataset.survivorOutfit=JSON.stringify({...drawn,pose:hero.pose,facing:hero.facing,floor:this.currentHeroLocation().floor??1,activeFloor:this.activeFloor,scale:WORLD_HERO_SCALE,x,y});
    this.hits.push({ kind: 'character', x, y: y - 64 * WORLD_HERO_SCALE, radius: 60 * WORLD_HERO_SCALE });
    this.pulse('character', x, y - 64 * WORLD_HERO_SCALE, 54 * WORLD_HERO_SCALE);
    if (this.action && this.action.elapsed >= this.action.walk && this.action.elapsed <= this.action.walk + this.action.work) {
      const cropName = CROPS[this.action.cropId].name;
      const labels: Record<SceneAction, string> = { plant: `${cropName} 씨앗을 톡톡`, water: '물을 듬뿍', fertilize:'흙에 영양을 나눠요', harvest: `${cropName} 수확!`, chop: '나무를 차곡차곡', expand: '우리 트럭을 넓혀요', expandFarm: progress < .5 ? '새 밭에 흙을 채워요' : '튼튼하게 밭을 만들어요', gather: progress < .6 ? '쓸 만한 재료를 찾아요' : '가방에 차곡차곡', build: '새 시설을 튼튼하게', upgrade: '시설을 손보고 있어요', 'pet-gate':this.petGateClosing&&this.petsOnPassage().length?'친구가 지나가길 기다려요':this.petGatePendingOpen?'동물 문을 열어요':'동물 문을 닫아요' };
      const node=this.action.groundResourceId?getGroundResourceNode(this.action.groundResourceId):undefined;
      const workLabels={tree:'도끼로 차근차근 벌목',scrap:'고철을 두드려 모아요',seed:'씨앗을 따서 담아요',water:'샘물을 떠서 담아요'};
      const label = node?workLabels[node.kind]:labels[this.action.kind];
      const top = y - 128 * WORLD_HERO_SCALE - 32;
      this.round(x - 58, top, 116, 23, 11, '#fffae8e8', '#bda982');
      this.label(label, x, top + 15, 10, '#526750', 700);
    }
  }

  private ramp() {
    const {top,bottom,width,rise}=getTruckAccessGeometry(this.state?.deckLevel??1);
    this.accessStairPaint=drawTruckAccessStairs(this.ctx,top,bottom,{width,rise});
    const pixel=1/this.scale,x=bottom[0],y=bottom[1]-19;
    this.hits.push({kind:'road-entry',x,y,radius:0,bounds:[x-23*pixel,y-22*pixel,x+23*pixel,y+22*pixel]});
  }

  private petPassage() {
    for(const path of this.activePetPassageLeases()){
      const leased=drawPetPassage(this.ctx,this.state?.deckLevel??1,true,{points:path.points});
      this.petPassageLeasedPaint.push({...path,drawn:leased.drawn,painted:leased.painted});
    }
    const art=drawPetPassage(this.ctx,this.state?.deckLevel??1,getPetPassage(this.state??{}).open);
    this.petPassagePaint={drawn:art.drawn,painted:art.painted};
    const detail=this.getPetPassageSceneState(),[x,y]=detail.gate.worldPoint,bounds=detail.gate.worldBounds;
    this.hits.push({kind:'pet-gate',x,y,radius:0,bounds});
    // The physical paw sign belongs to the painted village. The HUD provides
    // the finger-sized control without covering this small access ramp.
  }

  private groundTrails() {
    for(const grove of GROUND_REGIONS){
    const nodes=GROUND_RESOURCE_NODES.filter(node=>node.regionId===grove.id);
    const damp=grove.id==='spring'||grove.id==='east-creek',grit=grove.id==='salvage'||grove.id==='north-ruins';
    const points: Point[] = [];
    // The authored clear corridor is navigation space. The worn earth is a
    // narrower, irregular footpath with grass at its edges, never a UI shape.
    for (let segment = 0; segment < grove.path.length - 1; segment++) {
      const from = grove.path[segment], to = grove.path[segment + 1];
      const count = Math.ceil(Math.hypot(to[0] - from[0], to[1] - from[1]) / 17);
      for (let i = 0; i < count; i++) {
        const t = i / count;
        points.push([from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t]);
      }
    }
    points.push([...grove.path[grove.path.length - 1]]);
    const edge = (side: number, spread:number) => points.map((point, index): Point => {
      const before = points[Math.max(0, index - 1)], after = points[Math.min(points.length - 1, index + 1)];
      const dx = after[0] - before[0], dy = after[1] - before[1], length = Math.hypot(dx, dy) || 1;
      const taper = Math.min(1, (index + 1) / 4, (points.length - index) / 5);
      const width = (15 + Math.sin(index * 1.37 + side) * 4 + Math.sin(index * .43) * 3) * taper*spread;
      return [point[0] - dy / length * width * side, point[1] + dx / length * width * side];
    });
    // Three very quiet broken edges read as earth worn into the surrounding
    // material, rather than a solid strip laid on top of the map.
    for(const[spread,opacity]of [[1.8,'06'],[1.25,'08'],[.7,'0a']]as const)
      this.poly([...edge(1,spread),...edge(-1,spread).reverse()],`${damp?'#8d9478':grit?'#b1a38a':'#aca084'}${opacity}`,'',0);
    for (let i = 2; i < points.length - 2; i++) {
      const [x,y] = points[i], drift = Math.sin(i * 2.43) * 21;
      if (i % 2 === 0) this.groundFleck(x+drift,y+Math.cos(i*1.81)*5,i,grit?'grit':'leaf',.75);
      if (i % 3 === 0) {
        const before=points[i-1],after=points[i+1],dx=after[0]-before[0],dy=after[1]-before[1],length=Math.hypot(dx,dy)||1;
        const side=i%2?1:-1,offset=26+Math.sin(i*1.13)*9;
        this.groundFleck(x-dy/length*offset*side,y+dx/length*offset*side,i,damp?'reed':'grass',.8);
      }
    }
    // Litter, grit and small grass strokes continue between neighbouring
    // resources. No repeated underbrush cutout supplies another circular base.
    // These marks are ground texture only; all resource identities and touch
    // silhouettes remain attached to their original nodes.
    for(let index=0;index<nodes.length;index++){
      const node=nodes[index],next=nodes[index+1];
      const seed=node.point[0]*.037+node.point[1]*.019;
      const grass=node.kind==='tree'||node.kind==='seed',water=node.kind==='water';
      for(let mark=0;mark<7;mark++){
        const angle=seed+mark*2.39996,radius=27+(mark%3)*11;
        const x=node.point[0]+Math.cos(angle)*radius,y=node.point[1]+Math.sin(angle)*radius*.46;
        this.groundFleck(x,y,index*7+mark,water?'reed':grass?mark%3?'leaf':'grass':'grit',.7+mark%2*.15);
      }
      if(next&&Math.hypot(next.point[0]-node.point[0],next.point[1]-node.point[1])<235){
        for(let mark=1;mark<5;mark++){
          const t=mark/5,x=node.point[0]+(next.point[0]-node.point[0])*t+Math.sin(seed+mark*3)*12,
            y=node.point[1]+(next.point[1]-node.point[1])*t+Math.cos(seed+mark*2)*8;
          this.groundFleck(x,y,index*11+mark,grass?'leaf':'grit',.8);
        }
      }
    }
    // One modest waymarker belongs to each clearing, not each resource.
    const [x,y] = grove.path[0];
    this.ctx.save();this.ctx.translate(x - 53, y + 35);this.ctx.rotate(-.09);
    this.ellipse(0, 3, 14, 4, '#283d3020');
    this.line([[0,-25],[0,3]],'#7b7960',2.6);
    this.poly([[-29,-40],[28,-38],[30,-18],[-28,-20]],'#b0a385','#72735b',.85);
    this.line([[-23,-34],[23,-33]],'#d0c5a44d',.7);
    const name=({'grove':'숲길','seed-meadow':'씨앗 풀밭','salvage':'고철 공터','spring':'숲 샘터','west-grove':'서쪽 숲','north-ruins':'북쪽 쉼터','east-creek':'동쪽 샘가'}as Record<string,string>)[grove.id];
    this.label(name,0,-26,8,'#495744',700);this.ctx.restore();
    }
  }

  /** Small matte marks use the ground plane, not miniature prop sprites. */
  private groundFleck(x:number,y:number,seed:number,kind:'grass'|'leaf'|'grit'|'reed',size:number){
    if(kind==='grass'||kind==='reed'){
      const color=kind==='reed'?'#687d683f':'#75805d38',height=(kind==='reed'?6:4)*size;
      this.line([[x-3*size,y+size],[x-size,y-height*.76],[x,y]],color,.85*size);
      this.line([[x,y],[x+2.5*size,y-height],[x+4*size,y-.4*size]],color,.85*size);
    }else if(kind==='leaf'){
      const drift=Math.sin(seed*1.73)*2.2*size;
      this.poly([[x-2.8*size,y],[x+drift,y-1.5*size],[x+3.4*size,y-.2*size],[x+.7*size,y+1.4*size]],
        seed%3?'#8a805d32':'#ab956c35','',0);
    }else{
      this.poly([[x-2.1*size,y],[x-.6*size,y-1.4*size],[x+2.6*size,y-.8*size],[x+2*size,y+.9*size],[x-.8*size,y+size]],'#7d7d6834','',0);
      this.line([[x-1.2*size,y-1.1*size],[x+.9*size,y-.8*size]],'#ddd1ae36',.65*size);
    }
  }

  private groundSpriteBounds(node:GroundResourceNode):[number,number,number,number] {
    return getGroundVisualBounds(node);
  }
  private groundResources() {
    const now=Date.now(),visualNow=performance.now()/1000,artReady=groundArtReady();
    const heroLocation=this.currentHeroLocation();
    const cooldownLabels: {node:GroundResourceNode;seconds:number}[]=[];
    const paintNode=(node:GroundResourceNode,index:number)=>{
      const stock=this.state?getGatheringNode(this.state,node.id,now):undefined,
        ready=stock?.ready??true,active=this.action?.groundResourceId===node.id,
        cutState=this.treeCuts.get(node.id),cutAt=cutState?.at,cut=cutAt===undefined?Infinity:visualNow-cutAt,
        falling=node.kind==='tree'&&cut>=0&&cut<.65,
        locallyCut=active&&cutAt!==undefined,
        available=ready&&!locallyCut,
        visual=node.kind==='tree'?falling?'falling':available?'tree':'stump':ready?'resource':'depleted';
      if(ready&&!active&&cut>=.65)this.treeCuts.delete(node.id);
      const[x,y]=node.point,s=node.scale,bounds=this.groundSpriteBounds(node);
      const art=getGroundResourceVisual(node,visual);
      let painted=false;
      if(node.kind==='tree'){
        if(!available||falling){
          const stump=getGroundResourceVisual(node,'stump');
          painted=drawGroundSprite(this.ctx,'stump',x,y,stump.width,stump.height,1,stump.variant);
        }
        if(available||falling){
          const work=active?this.actionProgress():0;
          const motion=sampleGatheringMotion('chop',work);
          // A tree in front of the hero keeps its depth, but lets the working
          // character remain visible through the foliage.
          const behind=heroLocation.surface==='road'&&heroLocation.point[1]<y&&
            heroLocation.point[0]>bounds[0]-12&&heroLocation.point[0]<bounds[2]+12&&
            heroLocation.point[1]>bounds[1];
          this.ctx.save();this.ctx.translate(x,y);
          const fallDirection=cutState?.direction??(x>=heroLocation.point[0]?1:-1);
          const recoil=motion.impact*Math.sin((motion.phase-GATHERING_CONTACT_PHASE)*Math.PI*9)*.024;
          this.ctx.rotate(falling?fallDirection*this.ease(cut/.65)*(this.reducedMotion ? .15 : 1.35):
            work>0?recoil*(this.reducedMotion ? .3 : 1):this.reducedMotion?0:Math.sin(this.time*.65+index)*.003);
          const alpha=(falling?Math.max(0,1-(cut/.65)**2):1)*(behind?.65:1);
          painted=drawGroundSprite(this.ctx,'tree',0,0,art.width,art.height,alpha,art.variant)||painted;
          this.ctx.restore();
        }
      }else if(ready){
        const motion=active?sampleGatheringMotion(gatheringKindForResource(node.resource),this.actionProgress()):undefined;
        this.ctx.save();this.ctx.translate(x,y);
        if(motion&&!this.reducedMotion&&node.kind!=='water')
          this.ctx.rotate(motion.impact*Math.sin((motion.phase-GATHERING_CONTACT_PHASE)*Math.PI*8)*(node.kind==='seed'?.045:.018));
        painted=drawGroundSprite(this.ctx,art.sprite,0,0,art.width,art.height,1,art.variant);
        this.ctx.restore();
      }else if(node.kind==='water'){
        // The rock-lined spring remains in the landscape while replenishing.
        painted=drawGroundSprite(this.ctx,'water',x,y,art.width,art.height,.45,art.variant);
      }else{
        painted=drawGroundSprite(this.ctx,art.sprite,x,y,art.width,art.height,.55,art.variant);
      }
      if(!ready&&(active||this.resourceFocus?.nodeId===node.id))cooldownLabels.push({node,seconds:stock?.remainingSeconds??0});
      const hitBounds=getGroundVisualBounds(node,visual),polygon=getGroundVisualPolygon(node,visual),hit='ground-resource' as const;
      const target:Point=[(bounds[0]+bounds[2])/2,(bounds[1]+bounds[3])/2];
      if(hit)this.hits.push({kind:hit,plotId:index,nodeId:node.id,siteId:node.siteId,x:target[0],y:target[1],radius:0,bounds:hitBounds,polygon});
      this.pulse(`ground:${node.id}`,x,y,34*s);
      const screenBounds=bounds.map((value,i)=>(i%2?this.dy:this.dx)+value*this.scale);
      this.groundResourcePaint.push({id:node.id,index,siteId:node.siteId,regionId:node.regionId,kind:node.kind,resource:node.resource,
        point:{x,y},approaches:node.approaches,solidBounds:node.bounds,spriteBounds:bounds,screenBounds,hitBounds,hitPolygon:polygon,
        art:{sprite:art.sprite,variant:art.variant,width:art.width,height:art.height,ready:artReady,painted,sourceAtlas:'ground-props',anchor:{x,y},bounds:getGroundVisualBounds(node,visual)},
        x:this.dx+target[0]*this.scale,y:this.dy+target[1]*this.scale,ready,remainingSeconds:stock?.remainingSeconds??0,
        yieldAmount:stock?.yieldAmount??null,energyCost:stock?.energyCost??null,visual,hit,active});
    };
    // Feet decide depth on the ground, so an actor behind a trunk cannot
    // float over its crown. Deck and passage actors retain their own layers.
    const order=GROUND_RESOURCE_NODES.map((node,index)=>({y:node.point[1],paint:()=>paintNode(node,index)}));
    if(heroLocation.surface==='road')order.push({y:heroLocation.point[1],paint:()=>this.hero()});
    this.ensurePets();
    for(const id of this.state?getUnlockedUnitIds(this.state):['dog','cat']as UnitId[]){
      const motion=this.petMotion.get(id);
      if(motion?.location.surface==='road'&&(motion.location.floor??1)===this.activeFloor)
        order.push({y:motion.location.point[1],paint:()=>this.drawPets(false,id)});
    }
    order.sort((a,b)=>a.y-b.y).forEach(item=>item.paint());
    for(const{node,seconds}of cooldownLabels){
      const[x,y]=node.point,pixel=Math.min(1/this.scale,2.1);
      this.round(x-19*pixel,y+17*node.scale,38*pixel,15*pixel,7*pixel,'#e8eeddf0','#9cac8c');
      this.label(`${seconds}초`,x,y+17*node.scale+10.5*pixel,8.5*pixel,'#55724e',700);
    }
  }

  private groundMarkers() {
    if(this.activeFloor!==1||this.constructionMode||this.planningMode||this.farmFocus||this.farmMode)return;
    // General gathering controls belong to the screen edge. Keep the world
    // clear of category pills; only the explicitly selected or working node
    // receives a label. Resource sprites retain their own polygon hit targets.
    const targetId=this.action?.groundResourceId??this.resourceFocus?.nodeId;
    if(!targetId)return;
    const now=Date.now(),hero=this.currentHeroLocation().point;
    const candidates=GROUND_RESOURCE_NODES.flatMap<GroundMarkerInput>((node,index)=>{
      if(node.id!==targetId)return[];
      const stock=this.state?getGatheringNode(this.state,node.id,now):undefined;
      const sprite=this.groundSpriteBounds(node),screen=sprite.map((v,i)=>(i%2?this.dy:this.dx)+v*this.scale)as[number,number,number,number];
      return[{id:node.id,index,kind:node.kind,resource:node.resource,ready:stock?.ready??true,
        active:this.action?.groundResourceId===node.id,affordable:!this.state||this.state.energy>=(stock?.energyCost??0),remainingSeconds:stock?.remainingSeconds??0,
        anchor:[this.dx+node.point[0]*this.scale,this.dy+node.point[1]*this.scale],spriteBounds:screen,
        distance:Math.hypot(node.point[0]-hero[0],node.point[1]-hero[1])}];
    });
    const viewport={left:this.safeViewport.left,top:this.safeViewport.top,right:this.width-this.safeViewport.right,bottom:this.height-this.safeViewport.bottom};
    const placementViewport={...viewport};
    const canvasBounds=this.canvas.getBoundingClientRect();
    const hud=[...document.querySelectorAll<HTMLElement>('.scene-top,.truck-floor-controls,.settlement-objective,.road-controls')]
      .map(element=>({element,bounds:element.getBoundingClientRect()}))
      .filter(({bounds})=>bounds.width>0&&bounds.height>0&&bounds.bottom>canvasBounds.top&&bounds.top<canvasBounds.bottom);
    const hudBottom=(includeRoad:boolean)=>Math.max(viewport.top,...hud.filter(({element})=>includeRoad||!element.classList.contains('road-controls'))
      .map(({bounds})=>bounds.bottom-canvasBounds.top+14));
    const belowHud=hudBottom(true);
    if(placementViewport.bottom-belowHud>=52)placementViewport.top=Math.max(placementViewport.top,belowHud);
    else{
      // In a short landscape view the road toolbar owns the left column.
      // Keep real finger targets in the free column, with space around DOM
      // buttons so mobile browsers cannot redirect touches to nearby controls.
      placementViewport.top=Math.max(placementViewport.top,hudBottom(false));
      const toolbar=hud.find(({element})=>element.classList.contains('road-controls'))?.bounds;
      if(toolbar&&placementViewport.right-(toolbar.right-canvasBounds.left+14)>=80)
        placementViewport.left=Math.max(placementViewport.left,toolbar.right-canvasBounds.left+14);
    }
    const activeHero=this.action?.groundResourceId&&this.currentHeroLocation().surface==='road'?
      [{left:this.dx+hero[0]*this.scale-40*WORLD_HERO_SCALE*this.scale-6,top:this.dy+(hero[1]-132*WORLD_HERO_SCALE)*this.scale-6,
        right:this.dx+hero[0]*this.scale+40*WORLD_HERO_SCALE*this.scale+6,bottom:this.dy+hero[1]*this.scale+8}]:[];
    const gatheringControls=[...document.querySelectorAll<HTMLElement>('.gathering-dock,.gathering-tray')]
      .map(element=>element.getBoundingClientRect())
      .filter(bounds=>bounds.width>0&&bounds.height>0&&bounds.bottom>canvasBounds.top&&bounds.top<canvasBounds.bottom)
      .map(bounds=>({left:bounds.left-canvasBounds.left,top:bounds.top-canvasBounds.top,
        right:bounds.right-canvasBounds.left,bottom:bounds.bottom-canvasBounds.top}));
    const markers=layoutGroundMarkers(candidates,this.scale,viewport,placementViewport,[...activeHero,...gatheringControls]),c=this.ctx,dpr=Math.min(window.devicePixelRatio||1,2);
    c.save();c.setTransform(dpr,0,0,dpr,0,0);
    for(const marker of markers){
      const[left,top,right,bottom]=marker.screenBounds,cx=(left+right)/2,cy=(top+bottom)/2,
        ready=marker.status==='ready',working=marker.status==='working',color=working?'#846d37':ready?'#3d704b':'#82765d';
      const connectorLength=Math.hypot(marker.anchor[0]-cx,marker.anchor[1]-bottom);
      if(connectorLength>6&&connectorLength<100){
        c.globalAlpha=.65;this.line([[cx,bottom],[marker.anchor[0],marker.anchor[1]]],'#e9dfb8',1.3);c.globalAlpha=1;
      }
      c.shadowColor='#203a3024';c.shadowBlur=4;c.shadowOffsetY=2;
      this.round(left,top,right-left,bottom-top,10,working?'#f9edc9f5':ready?'#fff9e9f5':'#efebdded',working?'#bc9a50':ready?'#8da677':'#bcb69d');
      c.shadowBlur=0;c.shadowOffsetY=0;
      const itemArt=this.resourceIllustration(marker.resource,left+14,cy-1,20);
      this.label(marker.label,left+44,top+14,11,color,750);
      const status=working?'작업 중':marker.status==='cooldown'?`${marker.remainingSeconds}초`:marker.status==='unaffordable'?'기력 부족':marker.count>1?`채집 ${marker.readyCount}/${marker.count}`:'터치 채집';
      this.label(status,left+44,top+27,8,color,600);
      const hitBounds=marker.hitScreenBounds.map((v,i)=>(v-(i%2?this.dy:this.dx))/this.scale)as[number,number,number,number];
      const node=GROUND_RESOURCE_NODES[marker.index];
      this.hits.push({kind:'ground-resource',plotId:marker.index,nodeId:marker.nodeId,siteId:node.siteId,x:(cx-this.dx)/this.scale,y:(cy-this.dy)/this.scale,radius:0,bounds:hitBounds,marker:true});
      this.groundMarkerPaint.push({...marker,icon:marker.resource,itemArt});
    }
    c.restore();
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
    if((this.currentHeroLocation().floor??1)!==this.activeFloor)return;
    const hero = this.heroState(), [hx, hy] = hero.point, progress = this.actionProgress();
    const [u, v] = this.plotPosition(action.plotIndex), target = this.p(u + 29, v + 33, 110);
    const c = this.ctx;
    if(action.kind==='fertilize'){
      for(let i=0;i<12;i++){
        const t=(progress*2.6+i*.093)%1,sx=hx+24*WORLD_HERO_SCALE,sy=hy-36*WORLD_HERO_SCALE,
          x=sx+(target[0]-sx+(i%4-1.5)*11)*t,y=sy+(target[1]-sy+Math.floor(i/4)*5)*t-Math.sin(t*Math.PI)*15;
        this.ellipse(x,y,2.2,1.3,'#927247','#c0a27c',.6);
      }
      if(progress>.65)for(let i=0;i<3;i++)this.sprig(target[0]-15+i*15,target[1],.25+(progress-.65)*.3);
    } else if (action.kind === 'plant') {
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
    } else if (action.kind === 'chop' || action.kind === 'gather') {
      const node=action.groundResourceId?getGroundResourceNode(action.groundResourceId):undefined;
      if(node)this.gatheringEffects(node,hero,progress);
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
      const placement=action.facilityPlacement??this.legacyPlacement(action.facilitySlot),facility=projectDeckPoint([placement.x,placement.y],placement.floor,5);
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

  /** Small physical responses begin when the animated hand or tool connects. */
  private gatheringEffects(node:GroundResourceNode,hero:HeroSceneState,progress:number) {
    const motion=sampleGatheringMotion(gatheringKindForResource(node.resource),progress);
    if(!motion.contact)return;
    if(this.gatheringContact?.nodeId!==node.id||this.gatheringContact.cycle!==motion.cycle){
      const fallback:Point=[hero.point[0]+hero.facing*34*WORLD_HERO_SCALE,hero.point[1]-24*WORLD_HERO_SCALE];
      this.gatheringContact={nodeId:node.id,cycle:motion.cycle,point:this.heroToolContact?[...this.heroToolContact]:fallback};
    }
    const [sx,sy]=this.gatheringContact.point,c=this.ctx;
    const age=Math.max(0,Math.min(1,(motion.phase-GATHERING_CONTACT_PHASE)/(1-GATHERING_CONTACT_PHASE)));
    const fade=(1-age)**2,amount=this.reducedMotion ? .45 : 1;
    c.save();c.globalAlpha=fade*amount;
    if(node.kind==='tree'){
      for(let i=0;i<(this.reducedMotion?3:8);i++){
        const toss=this.seed(i+motion.cycle*17+Number(node.id.slice(-2))),
          x=sx+hero.facing*(9+toss*25)*age+(i%3-1)*age*5,
          y=sy-(11+toss*20)*age+36*age*age;
        c.save();c.translate(x,y);c.rotate((i%2?1:-1)*age*5+i);
        this.poly([[-2.3,-.9],[1.9,-1.3],[3,.4],[-1.6,1.2]],i%3?'#d1b37d':'#a38253','#806746',.45);
        c.restore();
      }
    }else if(node.kind==='scrap'){
      for(let i=0;i<(this.reducedMotion?2:5);i++){
        const angle=-Math.PI*.87+i*.39,x=sx+Math.cos(angle)*age*(17+i*3),y=sy+Math.sin(angle)*age*21+age*age*19;
        this.line([[x,y],[x+Math.cos(angle)*2.8,y+Math.sin(angle)*2.8]],i%2?'#d9ba7c':'#9d7950',1.2);
      }
      if(motion.impact>.3){
        this.line([[sx-3,sy-1],[sx+2,sy+1]],'#eddbad',1.2);
        this.line([[sx,sy-4],[sx,sy+2]],'#eddbad',1.2);
      }
    }else if(node.kind==='seed'){
      // Picked pods arc into the carried pouch after each visible hand pull.
      const settle=this.ease(age),packX=hero.point[0]-hero.facing*7*WORLD_HERO_SCALE,packY=hero.point[1]-41*WORLD_HERO_SCALE;
      for(let i=0;i<2;i++){
        const x=sx+(packX-sx)*settle+i*3,y=sy+(packY-sy)*settle-Math.sin(age*Math.PI)*(10+i*3);
        this.ellipse(x,y,1.3,2,i?'#b59c63':'#d5bd80','#8d7a4e',.5);
      }
      if(motion.impact>.1)this.line([[sx-3,sy-1],[sx-1,sy-4],[sx+1,sy-1]],'#a9b67a',1);
    }else{
      // The dipped vessel disturbs its own bank, rather than emitting a
      // constant stream before the scoop reaches the water.
      const radius=4+age*17;
      this.ellipse(sx,sy+3,radius,radius*.32,'','#afc8b2',1.15);
      this.ellipse(sx+1,sy+4,radius*.64,radius*.21,'','#d2dcc3',.8);
      for(let i=0;i<(this.reducedMotion?2:4);i++){
        const x=sx+(i-1.5)*age*7,y=sy-Math.sin(age*Math.PI)*(8+i%2*5)+age*4;
        this.ellipse(x,y,.9,1.6,i%2?'#a7c6bf':'#d5dfce');
      }
    }
    c.restore();
  }

  private pulse(kind: string, x: number, y: number, radius: number) {
    if (this.focused !== kind || performance.now() > this.focusedUntil) return;
    const c = this.ctx; c.save(); c.globalAlpha = .55 + Math.sin(this.time * 5) * .25; c.setLineDash([4, 6]);
    c.beginPath(); c.ellipse(x, y, radius, radius * .62, 0, 0, Math.PI * 2); c.strokeStyle = '#fff4bd'; c.lineWidth = 3; c.stroke(); c.restore();
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
