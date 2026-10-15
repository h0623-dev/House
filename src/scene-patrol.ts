import {GAME_SPEED_MULTIPLIER} from './game-speed';
import {WALK_SPEED} from './scene-motion';
import {blocksActorStep,getPatrolTargets,planNavigation,planYieldNavigation,sampleNavigation,isNavigationLinkSurface,
  circleOverlapsPolygon,navigationObstaclePolygon,sweptCircleOverlapsPolygon,
  type NavigationActor,type NavigationLocation,type NavigationPath,type NavigationWorld,type NavigationLink} from './scene-navigation';
import type {TruckFloor} from './truck-layout';
import type {UnitId} from './units';

export interface PetPatrolState {
  id:UnitId;location:NavigationLocation;route:NavigationPath|null;
  elapsed:number;distance:number;speed:number;heading:number;facing:1|-1;
  facingBlend:number;blend:number;turnRemaining:number;blockedReason:string|null;radius:number;
  pauseRemaining:number;retryRemaining:number;targetSequence:number;
  turnFrom:1|-1;nextFacing:1|-1;turnHeading:number;worldKey:string;desiredFloor:TruckFloor;desiredSurface?:'deck'|'road';
  passageLease?:NavigationLink;
  waitingForPassage?:string;
  /** Each roadside resident keeps a quiet part of the clearing instead of crowding the hero. */
  home?:NavigationLocation;habitatIndex?:number;visits?:number;
}
const nominalRadius:Readonly<Record<UnitId,number>>={dog:33,cat:34,rabbit:25,fox:33,boar:44,owl:31,
  monkey:22/.73,elephant:44/.82,giraffe:34/.82,panda:32/.78,deer:29/.78};
const finite=(n:number,fallback=0)=>Number.isFinite(n)?n:fallback;
const distance=(a:readonly number[],b:readonly number[])=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const copy=(location:NavigationLocation):NavigationLocation=>({...location,point:[...location.point]});
const floorOf=(location:NavigationLocation):TruckFloor=>location.floor??1;
const smooth=(n:number)=>n*n*(3-2*n);
const angleDelta=(from:number,to:number)=>Math.atan2(Math.sin(to-from),Math.cos(to-from));
const headingToward=(from:number,to:number,delta:number)=>from+Math.max(-delta*8,Math.min(delta*8,angleDelta(from,to)));

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
  return{id,location:copy(location),home:copy(location),habitatIndex:index,visits:0,route:null,elapsed:0,distance:0,speed:0,heading,facing,facingBlend:facing,
    blend:0,turnRemaining:0,blockedReason:null,radius,pauseRemaining:1.8+Math.max(0,index)*.47,retryRemaining:0,
    targetSequence:Math.max(0,index)*11,turnFrom:facing,nextFacing:facing,turnHeading:heading,worldKey:geometryKey(world),
    desiredFloor:floor,desiredSurface};
}
/** Small followers accompany the hero; the other residents take turns exploring and resting outside. */
export function getPetPatrolDestination(state:PetPatrolState,world:NavigationWorld,hero:NavigationLocation):NavigationLocation{
  const maxFloor=world.petMaxFloor??3,followers=state.id==='dog'||state.id==='cat'||state.id==='monkey',
    outdoorTurn=!followers&&(Math.floor((state.visits??0)/3)+(state.habitatIndex??0))%3===0;
  if(maxFloor===0||outdoorTurn){
    if(hero.surface==='road'&&maxFloor>0&&!outdoorTurn)return copy(hero);
    const home=state.home;
    return{surface:'road',point:home?.surface==='road'?[...home.point]:[...world.ladder.bottom]};
  }
  if(hero.surface==='road')return copy(hero);
  const floor=Math.min(floorOf(hero),maxFloor)as TruckFloor;
  return{surface:'deck',floor,point:floor===floorOf(hero)?[...hero.point]:[...world.ladder.entry]};
}
function chooseRoute(state:PetPatrolState,world:NavigationWorld,hero:NavigationLocation,
  actors:NavigationActor[]):NavigationPath|undefined{
  const destination=getPetPatrolDestination(state,world,hero),destinationFloor=floorOf(destination),destinationSurface=destination.surface==='road'?'road':'deck',
    sameFloor=state.location.surface===destinationSurface&&(destinationSurface==='road'||floorOf(state.location)===destinationFloor);
  const attempt=(floor:TruckFloor|0,following:boolean)=>{
  let candidates=getPatrolTargets({...world,actors},floor)
    .filter(location=>clearOfActors(location,state.radius,actors,7))
    .filter(location=>following&&!sameFloor||distance(location.point,state.location.point)>55);
  candidates.sort((a,b)=>{
    const score=(location:NavigationLocation)=>!following||sameFloor?Math.abs(distance(location.point,state.location.point)-120)
      +Math.max(0,distance(location.point,destination.point)-310)*.7:distance(location.point,destination.point);
    return score(a)-score(b);
  });
  candidates=candidates.slice(0,24);
  if(!candidates.length)return;
  const offset=state.targetSequence%candidates.length;state.targetSequence++;
  for(let attempt=0;attempt<candidates.length;attempt++){
    const target=candidates[(offset+attempt)%candidates.length],route=planNavigation({...world,actors},state.location,target);
    if(route&&state.location.surface!=='ramp'&&route.segments.some(segment=>segment.link&&actors.some(actor=>
      actor.location.surface==='ramp'&&actor.location.link===segment.link||actor.passageIntent===segment.link)))continue;
    if(route&&route.motion.distance>1)return route;
  }
  };
  const following=attempt(destinationSurface==='road'?0:destinationFloor,true);
  if(following){delete state.waitingForPassage;return following;}
  // A shut gate changes which side is available, rather than freezing an animal
  // until the hero returns. Keep patrolling this real surface without crossing.
  if(world.actor==='pet'&&!sameFloor&&state.location.surface!=='ramp'){
    const crossing=actors.filter(actor=>actor.location.surface==='ramp');
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
  state.speed=0;state.blend=Math.max(0,state.blend*(1-Math.min(1,delta*10)));
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
    if(!crossing){state.route=null;state.elapsed=0;state.retryRemaining=0;state.pauseRemaining=0;}
  }
  if(state.turnRemaining>0){
    stop(state,dt);state.heading=headingToward(state.heading,state.turnHeading,dt);
    state.turnRemaining=Math.max(0,state.turnRemaining-dt);
    state.facingBlend=state.turnFrom+(state.nextFacing-state.turnFrom)*smooth(1-state.turnRemaining/.3);
    if(state.turnRemaining===0){state.facing=state.nextFacing;state.facingBlend=state.facing;}
    return;
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
  const pace=state.id==='elephant'?15:state.id==='giraffe'?17:state.id==='panda'?16:state.id==='deer'?21:22;
  const nextElapsed=Math.min(state.route.motion.duration,state.elapsed+dt*(pace*GAME_SPEED_MULTIPLIER/WALK_SPEED));
  const sample=sampleNavigation(state.route,nextElapsed),from=state.location,to=sample.location,travel=distance(from.point,to.point);
  const locked=isNavigationLinkSurface(to.surface)
    ? actors.find(actor=>isNavigationLinkSurface(actor.location.surface)&&actor.location.link===to.link) : undefined;
  const blocked=locked??blocksActorStep(from,to,state.radius,actors);
  if(blocked){
    state.blockedReason=`actor:${blocked.id}`;
    // An admitted animal owns its original exit direction until its feet leave
    // the bridge. A hero returning to shut the gate cannot reverse this lease.
    if(state.location.surface!=='ramp'||!state.passageLease){state.route=null;state.elapsed=0;}
    state.retryRemaining=.45;stop(state,dt);return;
  }
  if(travel>1e-7){
    const heading=Math.atan2(to.point[1]-from.point[1],to.point[0]-from.point[0]),direction=Math.cos(heading);
    const facing:1|-1=direction>.18?1:direction<-.18?-1:state.facing;
    if(facing!==state.facing){
      state.turnRemaining=.3;state.turnFrom=state.facing;state.nextFacing=facing;state.turnHeading=heading;
      state.facingBlend=state.facing;stop(state,dt);return;
    }
    state.heading=headingToward(state.heading,heading,dt);
  }
  if(to.surface==='ramp'&&from.surface!=='ramp'){
    const link=world.links.find(link=>link.id===to.link);
    if(link)state.passageLease={...link,points:link.points.map(point=>[...point])};
  }else if(to.surface!=='ramp')delete state.passageLease;
  state.location=copy(to);state.elapsed=nextElapsed;state.distance+=travel;state.speed=travel/dt;
  state.blend+=((state.speed>.05?1:0)-state.blend)*Math.min(1,dt*10);state.blockedReason=null;
  if(nextElapsed>=state.route.motion.duration){state.route=null;state.elapsed=0;state.visits=(state.visits??0)+1;state.pauseRemaining=2.2+(state.targetSequence%5)*.6;}
}
