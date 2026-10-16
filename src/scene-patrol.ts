import {GAME_SPEED_MULTIPLIER} from './game-speed';
import {blocksActorStep,getPatrolTargets,planNavigation,planYieldNavigation,isNavigationLinkSurface,
  circleOverlapsPolygon,navigationObstaclePolygon,sweptCircleOverlapsPolygon,
  type NavigationActor,type NavigationLocation,type NavigationPath,type NavigationWorld,type NavigationLink} from './scene-navigation';
import type {TruckFloor} from './truck-layout';
import type {UnitId} from './units';
import {PET_PASSAGE_LINK_ID} from './pet-passage';
import {animalHeadingDelta,getAnimalLocomotion,orientAnimalForTravel} from './animal-locomotion';
import {getAnimalRouteLeg,getAnimalRouteTravel} from './animal-navigation';

export interface PetPatrolState {
  id:UnitId;location:NavigationLocation;route:NavigationPath|null;
  elapsed:number;distance:number;speed:number;heading:number;facing:1|-1;
  facingBlend:number;blend:number;turnRemaining:number;blockedReason:string|null;radius:number;
  pauseRemaining:number;retryRemaining:number;targetSequence:number;
  turnFrom:1|-1;nextFacing:1|-1;turnHeading:number;worldKey:string;desiredFloor:TruckFloor;desiredSurface?:'deck'|'road';
  turnDuration?:number;turnStartHeading?:number;locomotionSpeed?:number;
  passageLease?:NavigationLink;
  waitingForPassage?:string;
  /** Each roadside resident keeps a quiet part of the clearing instead of crowding the hero. */
  home?:NavigationLocation;habitatIndex?:number;visits?:number;
  routine?:PetRoutine;routineFocus?:NavigationLocation;routineRest?:number;routinePace?:number;friendship?:number;
}
export type PetRoutine='following'|'sunbathing'|'foraging'|'wandering'|'resting'|'watching'|'grazing';
export interface PetRoutineContext { minutes:number;friendship?:number;garden?:NavigationLocation;sunnySpot?:NavigationLocation }
/** A species has a daily rhythm; paths still use the same clear physical surfaces. */
export function setPetPatrolRoutine(state:PetPatrolState,context:PetRoutineContext):void {
  const minute=((context.minutes%1440)+1440)%1440,night=minute<390||minute>=1140,profile=getAnimalLocomotion(state.id);
  state.friendship=Math.max(0,context.friendship??0);
  state.routinePace=1;state.routineRest=profile.restSeconds;
  delete state.routineFocus;
  if(state.id==='dog'){state.routine=night?'resting':'following';state.routineRest=night?12:3;state.routinePace=.9;}
  else if(state.id==='cat'){
    state.routine=night?'wandering':'sunbathing';state.routineRest=night?5:16;state.routinePace=.72;
    if(!night&&context.sunnySpot)state.routineFocus=copy(context.sunnySpot);
  }else if(state.id==='monkey'){
    state.routine=night?'resting':'foraging';state.routineRest=night?14:6;state.routinePace=.95;
    if(!night&&context.garden)state.routineFocus=copy(context.garden);
  }else if(state.id==='rabbit'){state.routine=night?'resting':'foraging';state.routineRest=night?13:7;state.routinePace=.8;}
  else if(state.id==='owl'){state.routine=night?'watching':'resting';state.routineRest=night?5:24;state.routinePace=night?.9:.65;}
  else if(state.id==='elephant'||state.id==='giraffe'||state.id==='deer'||state.id==='panda'){
    state.routine=night?'resting':'grazing';state.routineRest=night?18:state.id==='panda'?13:8;state.routinePace=state.id==='panda'?.72:.82;
  }else{state.routine=night?'resting':'wandering';state.routineRest=night?14:6;state.routinePace=.85;}
}
const nominalRadius:Readonly<Record<UnitId,number>>={dog:33,cat:34,rabbit:25,fox:33,boar:44,owl:31,
  monkey:22/.73,elephant:44/.82,giraffe:34/.82,panda:32/.78,deer:29/.78};
const finite=(n:number,fallback=0)=>Number.isFinite(n)?n:fallback;
const distance=(a:readonly number[],b:readonly number[])=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const copy=(location:NavigationLocation):NavigationLocation=>({...location,point:[...location.point]});
const floorOf=(location:NavigationLocation):TruckFloor=>location.floor??1;

/** Includes stance reach and visible paw contours, not merely the body center. */
export function getPetGroundRadius(id:UnitId,scale:number):number{
  return nominalRadius[id]*Math.max(.05,Math.abs(finite(scale,1)));
}
function actorsFor(world:NavigationWorld,hero:NavigationLocation,others:readonly NavigationActor[]):NavigationActor[]{
  const actors=new Map(world.actors.map(actor=>[actor.id,actor]));
  for(const actor of others)actors.set(actor.id,actor);
  if(!actors.has('hero'))actors.set('hero',{id:'hero',location:hero,radius:7});
  return [...actors.values()];
}
function geometryKey(world:NavigationWorld):string{
  return JSON.stringify([world.floors,world.obstacles,world.links,world.road,world.petMaxFloor]);
}
function sameSurface(a:NavigationLocation,b:NavigationLocation):boolean{
  return a.surface===b.surface&&(a.surface==='road'||floorOf(a)===floorOf(b));
}
function clearOfActors(location:NavigationLocation,radius:number,actors:readonly NavigationActor[],extra=3):boolean{
  return !actors.some(actor=>sameSurface(location,actor.location)&&distance(location.point,actor.location.point)<radius+actor.radius+extra);
}

/** A clear physical spawn is chosen once; later floor changes always use stairs. */
export function createPetPatrol(id:UnitId,world:NavigationWorld,hero:NavigationLocation,
  others:NavigationActor[],index:number,scale:number,{initialSurface}:{initialSurface?:'road'|'deck'}={}):PetPatrolState|undefined{
  const radius=getPetGroundRadius(id,scale),actors=actorsFor(world,hero,others),floor=floorOf(hero),
    desiredSurface=world.petMaxFloor===0?'road':initialSurface??(hero.surface==='road'?'road':'deck'),
    candidates=getPatrolTargets({...world,actors},desiredSurface==='road'?0:Math.min(floor,world.petMaxFloor??3)as TruckFloor)
      .filter(location=>clearOfActors(location,radius,actors,9));
  const body=world.obstacles.find(obstacle=>obstacle.kind==='truck-body')?.bounds,
    center:readonly[number,number]=body?[(body.left+body.right)/2,(body.top+body.bottom)/2]:hero.point,
    side=Math.max(0,index-2)%4,ring=Math.floor(Math.max(0,index-2)/4),offset=105+ring*75+radius,
    anchor:readonly[number,number]=desiredSurface==='road'&&body
      ?side===0?[body.left-offset,center[1]+ring*45]:side===1?[body.right+offset,center[1]-ring*50]
        :side===2?[center[0]+ring*70,body.bottom+offset]:[center[0]-ring*65,body.top-offset]
      :hero.point;
  candidates.sort((a,b)=>distance(a.point,anchor)-distance(b.point,anchor));
  const location=candidates[desiredSurface==='road'?0:Math.min(candidates.length-1,Math.max(0,index)*3)];if(!location)return;
  const facing:1|-1=hero.point[0]>=location.point[0]?1:-1,heading=facing===1?0:Math.PI;
  return{id,location:copy(location),home:copy(location),habitatIndex:index,visits:0,route:null,elapsed:0,distance:0,speed:0,locomotionSpeed:0,heading,facing,facingBlend:facing,
    blend:0,turnRemaining:0,blockedReason:null,radius,pauseRemaining:1.8+Math.max(0,index)*.47,retryRemaining:0,
    targetSequence:Math.max(0,index)*11,turnFrom:facing,nextFacing:facing,turnHeading:heading,worldKey:geometryKey(world),
    desiredFloor:floor,desiredSurface};
}
/** Daily routines choose an anchor while physical stairs remain the only floor connection. */
export function getPetPatrolDestination(state:PetPatrolState,world:NavigationWorld,hero:NavigationLocation):NavigationLocation{
  const maxFloor=world.petMaxFloor??3,home=state.home,focus=state.routineFocus;
  if(focus&&(focus.surface==='road'||floorOf(focus)<=maxFloor))return copy(focus);
  // The dog greets and accompanies the resident. Other animals keep their own
  // neighbourhood and never all trail behind the player in a single file.
  const follows=state.id==='dog'&&state.routine!=='resting'
    ||state.id==='monkey'&&state.routine==='foraging'&&!focus&&(state.visits??0)%4===0;
  if(follows&&maxFloor>0){
    if(hero.surface==='road')return copy(hero);
    return{surface:'deck',floor:Math.min(floorOf(hero),maxFloor)as TruckFloor,
      point:floorOf(hero)<=maxFloor?[...hero.point]:[...world.ladder.entry]};
  }
  if(home&&(home.surface==='road'||floorOf(home)<=maxFloor))return copy(home);
  if(maxFloor===0)return{surface:'road',point:[...world.ladder.bottom]};
  return{surface:'deck',floor:1,point:[...world.ladder.entry]};
}
function chooseRoute(state:PetPatrolState,world:NavigationWorld,hero:NavigationLocation,
  actors:NavigationActor[]):NavigationPath|undefined{
  const destination=getPetPatrolDestination(state,world,hero),destinationFloor=floorOf(destination),destinationSurface=destination.surface==='road'?'road':'deck',
    sameFloor=state.location.surface===destinationSurface&&(destinationSurface==='road'||floorOf(state.location)===destinationFloor),profile=getAnimalLocomotion(state.id);
  const attempt=(floor:TruckFloor|0,following:boolean)=>{
  let candidates=getPatrolTargets({...world,actors},floor)
    .filter(location=>clearOfActors(location,state.radius,actors,7))
    .filter(location=>following&&!sameFloor||distance(location.point,state.location.point)>profile.minLegDistance);
  candidates.sort((a,b)=>{
    const score=(location:NavigationLocation)=>{
      const targetHeading=Math.atan2(location.point[1]-state.location.point[1],location.point[0]-state.location.point[0]),
        // Heavy residents favour a longer forward stroll instead of repeatedly
        // choosing a new goal directly behind their own hindquarters.
        turnCost=Math.abs(animalHeadingDelta(state.heading,targetHeading))*(profile.cruiseSpeed/profile.turnRate)*1.5;
      if(!following)return Math.abs(distance(location.point,state.location.point)-Math.max(65,profile.minLegDistance*1.4))+turnCost;
      if(!sameFloor)return distance(location.point,destination.point)+turnCost;
      const followDog=state.id==='dog'&&state.routine==='following',
        radius=followDog?Math.max(60,96-(state.friendship??0)*.3):state.routine==='sunbathing'?40:state.routine==='resting'?58:state.id==='monkey'?90:state.id==='rabbit'?120:170;
      return Math.abs(distance(location.point,destination.point)-radius)
        +Math.abs(distance(location.point,state.location.point)-(followDog?110:Math.max(60,profile.minLegDistance)))*.22+turnCost;
    };
    return score(a)-score(b);
  });
  candidates=candidates.slice(0,24);
  if(!candidates.length)return;
  // Vary a few equally suitable neighbours without abandoning the daily anchor.
  const offset=state.targetSequence%Math.min(4,candidates.length);state.targetSequence++;
  for(let attempt=0;attempt<candidates.length;attempt++){
    const target=candidates[(offset+attempt)%candidates.length],route=planNavigation({...world,actors},state.location,target);
    if(route&&state.location.surface!=='ramp'&&route.segments.some(segment=>segment.link&&actors.some(actor=>
      isNavigationLinkSurface(actor.location.surface)&&actor.location.link===segment.link||actor.passageIntent===segment.link)))continue;
    if(route&&route.motion.distance>1)return route;
  }
  };
  const following=attempt(destinationSurface==='road'?0:destinationFloor,true);
  if(following){delete state.waitingForPassage;return following;}
  // A shut gate changes which side is available, rather than freezing an animal
  // until the hero returns. Keep patrolling this real surface without crossing.
  if(world.actor==='pet'&&!sameFloor&&state.location.surface!=='ramp'){
    const crossing=actors.filter(actor=>isNavigationLinkSurface(actor.location.surface)&&actor.location.link===PET_PASSAGE_LINK_ID);
    if(world.petPassageOpen){
      if(state.waitingForPassage)return;
      const passage=world.links.find(link=>link.surface==='ramp');
      if(passage){
        const reserved:NavigationLocation[]=[{surface:'ramp',floor:passage.upper,link:passage.id,
          point:[...passage.points[passage.points.length-1]]},...crossing.map(actor=>actor.location)];
        const radius=Math.max(state.radius,...actors.filter(actor=>actor.id!=='hero').map(actor=>actor.radius));
        const yieldRoute=planYieldNavigation({...world,actors},state.location,reserved,radius);
        if(yieldRoute&&yieldRoute.motion.distance>1){state.waitingForPassage=passage.id;return yieldRoute;}
      }
      return;
    }
    delete state.waitingForPassage;
    if(crossing.length){
      const yieldRoute=planYieldNavigation({...world,actors},state.location,crossing.map(actor=>actor.location),Math.max(...crossing.map(actor=>actor.radius)));
      if(yieldRoute&&yieldRoute.motion.distance>1)return yieldRoute;
    }
    return attempt(state.location.surface==='road'?0:floorOf(state.location),false);
  }
}
function stop(state:PetPatrolState,delta:number):void{
  state.speed=0;state.locomotionSpeed=0;state.blend=Math.max(0,state.blend*(1-Math.min(1,delta*10)));
}

function repairCoveredRampExit(state:PetPatrolState,world:NavigationWorld,actors:NavigationActor[]):NavigationPath|undefined {
  const target=state.route!.target,live={...world,actors},retained=planNavigation(live,state.location,target);
  if(retained)return retained;
  // The former goal may itself lie under the expanded body. Keep this admitted
  // owner's roadward direction and use the nearest real exterior road instead.
  const candidates=getPatrolTargets(live,0).sort((a,b)=>distance(a.point,target.point)-distance(b.point,target.point));
  for(const destination of candidates){const route=planNavigation(live,state.location,destination);if(route)return route;}
}

/** Advance only accepted swept steps. Waiting, turning and blocked paths plant feet. */
export function stepPetPatrol(state:PetPatrolState,world:NavigationWorld,hero:NavigationLocation,
  others:NavigationActor[],delta:number,{reducedMotion=false}:{reducedMotion?:boolean}={}):void{
  const dt=Math.max(0,Math.min(.1,finite(delta)));if(!dt)return;
  if(reducedMotion){stop(state,dt);state.blend=0;return;}
  const actors=actorsFor(world,hero,others),key=geometryKey(world),destination=getPetPatrolDestination(state,world,hero),
    desiredFloor=floorOf(destination),desiredSurface=destination.surface==='road'?'road':'deck';
  if(key!==state.worldKey||desiredFloor!==state.desiredFloor||desiredSurface!==(state.desiredSurface??'deck')){
    // A gate close or a deck expansion cannot discard feet halfway down a ramp.
    // The scene supplies this animal's immutable physical link lease until exit.
    const crossing=state.location.surface==='ramp'&&state.route?.segments.some(segment=>segment.link===state.location.link);
    state.worldKey=key;state.desiredFloor=desiredFloor;state.desiredSurface=desiredSurface;
    if(!crossing){state.route=null;state.elapsed=0;state.retryRemaining=0;state.pauseRemaining=0;state.locomotionSpeed=0;}
  }
  if(state.pauseRemaining>0||state.retryRemaining>0){
    state.pauseRemaining=Math.max(0,state.pauseRemaining-dt);state.retryRemaining=Math.max(0,state.retryRemaining-dt);stop(state,dt);return;
  }
  if(!state.route){
    state.route=chooseRoute(state,world,hero,actors)??null;state.elapsed=0;
    if(!state.route){state.blockedReason='no-clear-patrol-route';state.retryRemaining=.75;stop(state,dt);return;}
    state.blockedReason=null;
  }
  const body=state.location.surface==='ramp'&&state.passageLease&&state.route.target.surface==='road'
    ?world.obstacles.find(obstacle=>obstacle.surface==='road'&&obstacle.kind==='truck-body'):undefined;
  if(body){
    const polygon=navigationObstaclePolygon(body),route=state.route,
      covered=circleOverlapsPolygon(route.target.point,state.radius,polygon)||route.surfaces.some((surface,index)=>surface==='road'
        &&sweptCircleOverlapsPolygon(route.points[index],route.points[index+1],state.radius,polygon));
    if(covered){
      const repaired=repairCoveredRampExit(state,world,actors);
      if(!repaired){state.blockedReason='no-clear-ramp-exit';state.retryRemaining=.75;stop(state,dt);return;}
      state.route=repaired;state.elapsed=0;state.blockedReason=null;
    }
  }
  const profile=getAnimalLocomotion(state.id),leg=getAnimalRouteLeg(state.route,state.elapsed,state.id),
    // Small residents slow down on real steps; large boarders already have a
    // deliberately measured gait. No species accelerates through a sharp bend.
    linkPace=isNavigationLinkSurface(leg.surface)? .65:1,
    cruise=profile.cruiseSpeed*(state.routinePace??1)*GAME_SPEED_MULTIPLIER*linkPace,
    acceleration=profile.acceleration*GAME_SPEED_MULTIPLIER,braking=profile.braking*GAME_SPEED_MULTIPLIER,
    targetSpeed=Math.min(cruise,Math.sqrt(2*braking*leg.stopDistance)),motor=Math.max(0,state.locomotionSpeed??0),
    nextMotor=motor<targetSpeed?Math.min(targetSpeed,motor+acceleration*dt):Math.max(targetSpeed,motor-braking*dt),
    budget=leg.stopDistance<.015?leg.legDistance:(motor+nextMotor)*dt/2,
    proposal=getAnimalRouteTravel(state.route,state.elapsed,budget),nextElapsed=proposal.elapsed,sample=proposal.sample,
    from=state.location,to=sample.location,travel=distance(from.point,to.point);
  const locked=isNavigationLinkSurface(to.surface)
    ? actors.find(actor=>isNavigationLinkSurface(actor.location.surface)&&actor.location.link===to.link) : undefined;
  const blocked=locked??blocksActorStep(from,to,state.radius,actors);
  if(blocked){
    state.blockedReason=`actor:${blocked.id}`;
    // An admitted animal owns its original exit direction until its feet leave
    // the bridge. A hero returning to shut the gate cannot reverse this lease.
    if(state.location.surface!=='ramp'||!state.passageLease){state.route=null;state.elapsed=0;}
    state.retryRemaining=.45;state.turnRemaining=0;stop(state,dt);return;
  }
  if(travel>1e-7){
    const heading=Math.atan2(to.point[1]-from.point[1],to.point[0]-from.point[0]);
    if(!orientAnimalForTravel(state,heading,dt))return;
  }
  if(to.surface==='ramp'&&from.surface!=='ramp'){
    const link=world.links.find(link=>link.id===to.link);
    if(link)state.passageLease={...link,points:link.points.map(point=>[...point])};
  }else if(to.surface!=='ramp')delete state.passageLease;
  state.location=copy(to);state.elapsed=nextElapsed;state.distance+=travel;state.speed=travel/dt;state.locomotionSpeed=nextMotor;
  state.blend+=((state.speed>.05?1:0)-state.blend)*Math.min(1,dt*10);state.blockedReason=null;
  if(nextElapsed>=state.route.motion.duration){state.route=null;state.elapsed=0;state.locomotionSpeed=0;state.visits=(state.visits??0)+1;state.pauseRemaining=(state.routineRest??profile.restSeconds)+(state.targetSequence%5)*.7;}
}
