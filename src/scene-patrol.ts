import {GAME_SPEED_MULTIPLIER} from './game-speed';
import {WALK_SPEED} from './scene-motion';
import {blocksActorStep,getPatrolTargets,planNavigation,sampleNavigation,
  type NavigationActor,type NavigationLocation,type NavigationPath,type NavigationWorld} from './scene-navigation';
import type {TruckFloor} from './truck-layout';
import type {UnitId} from './units';

export interface PetPatrolState {
  id:UnitId;location:NavigationLocation;route:NavigationPath|null;
  elapsed:number;distance:number;speed:number;heading:number;facing:1|-1;
  facingBlend:number;blend:number;turnRemaining:number;blockedReason:string|null;radius:number;
  pauseRemaining:number;retryRemaining:number;targetSequence:number;
  turnFrom:1|-1;nextFacing:1|-1;turnHeading:number;worldKey:string;desiredFloor:TruckFloor;
}
const nominalRadius:Readonly<Record<UnitId,number>>={dog:33,cat:34,rabbit:25,fox:33,boar:44,owl:31};
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
  return JSON.stringify([world.floors,world.obstacles,world.links,world.road]);
}
function sameSurface(a:NavigationLocation,b:NavigationLocation):boolean{
  return a.surface===b.surface&&(a.surface==='road'||floorOf(a)===floorOf(b));
}
function clearOfActors(location:NavigationLocation,radius:number,actors:readonly NavigationActor[],extra=3):boolean{
  return !actors.some(actor=>sameSurface(location,actor.location)&&distance(location.point,actor.location.point)<radius+actor.radius+extra);
}

/** A clear physical spawn is chosen once; later floor changes always use stairs. */
export function createPetPatrol(id:UnitId,world:NavigationWorld,hero:NavigationLocation,
  others:NavigationActor[],index:number,scale:number):PetPatrolState|undefined{
  const radius=getPetGroundRadius(id,scale),actors=actorsFor(world,hero,others),floor=floorOf(hero);
  const candidates=getPatrolTargets({...world,actors},floor).filter(location=>clearOfActors(location,radius,actors));
  candidates.sort((a,b)=>distance(a.point,hero.point)-distance(b.point,hero.point));
  const location=candidates[Math.min(candidates.length-1,Math.max(0,index)*3)];if(!location)return;
  const facing:1|-1=hero.point[0]>=location.point[0]?1:-1,heading=facing===1?0:Math.PI;
  return{id,location:copy(location),route:null,elapsed:0,distance:0,speed:0,heading,facing,facingBlend:facing,
    blend:0,turnRemaining:0,blockedReason:null,radius,pauseRemaining:.55+Math.max(0,index)*.23,retryRemaining:0,
    targetSequence:Math.max(0,index)*11,turnFrom:facing,nextFacing:facing,turnHeading:heading,worldKey:geometryKey(world),desiredFloor:floor};
}
function chooseRoute(state:PetPatrolState,world:NavigationWorld,hero:NavigationLocation,
  actors:NavigationActor[]):NavigationPath|undefined{
  const destinationFloor=floorOf(hero),sameFloor=state.location.surface==='deck'&&floorOf(state.location)===destinationFloor;
  let candidates=getPatrolTargets({...world,actors},destinationFloor)
    .filter(location=>clearOfActors(location,state.radius,actors,7))
    .filter(location=>!sameFloor||distance(location.point,state.location.point)>55);
  candidates.sort((a,b)=>{
    const score=(location:NavigationLocation)=>sameFloor?Math.abs(distance(location.point,state.location.point)-120):distance(location.point,hero.point);
    return score(a)-score(b);
  });
  candidates=candidates.slice(0,24);
  if(!candidates.length)return;
  const offset=state.targetSequence%candidates.length;state.targetSequence++;
  for(let attempt=0;attempt<candidates.length;attempt++){
    const target=candidates[(offset+attempt)%candidates.length],route=planNavigation({...world,actors},state.location,target);
    if(route&&route.motion.distance>1)return route;
  }
}
function stop(state:PetPatrolState,delta:number):void{
  state.speed=0;state.blend=Math.max(0,state.blend*(1-Math.min(1,delta*10)));
}

/** Advance only accepted swept steps. Waiting, turning and blocked paths plant feet. */
export function stepPetPatrol(state:PetPatrolState,world:NavigationWorld,hero:NavigationLocation,
  others:NavigationActor[],delta:number,{reducedMotion=false}:{reducedMotion?:boolean}={}):void{
  const dt=Math.max(0,Math.min(.1,finite(delta)));if(!dt)return;
  if(reducedMotion){stop(state,dt);state.blend=0;return;}
  const actors=actorsFor(world,hero,others),key=geometryKey(world),desiredFloor=floorOf(hero);
  if(key!==state.worldKey||desiredFloor!==state.desiredFloor){
    state.worldKey=key;state.desiredFloor=desiredFloor;state.route=null;state.elapsed=0;state.retryRemaining=0;state.pauseRemaining=0;
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
  const nextElapsed=Math.min(state.route.motion.duration,state.elapsed+dt*(22*GAME_SPEED_MULTIPLIER/WALK_SPEED));
  const sample=sampleNavigation(state.route,nextElapsed),from=state.location,to=sample.location,travel=distance(from.point,to.point);
  const locked=to.surface==='ladder'
    ? actors.find(actor=>actor.location.surface==='ladder'&&actor.location.link===to.link) : undefined;
  const blocked=locked??blocksActorStep(from,to,state.radius,actors);
  if(blocked){state.blockedReason=`actor:${blocked.id}`;state.route=null;state.elapsed=0;state.retryRemaining=.45;stop(state,dt);return;}
  if(travel>1e-7){
    const heading=Math.atan2(to.point[1]-from.point[1],to.point[0]-from.point[0]),direction=Math.cos(heading);
    const facing:1|-1=direction>.18?1:direction<-.18?-1:state.facing;
    if(facing!==state.facing){
      state.turnRemaining=.3;state.turnFrom=state.facing;state.nextFacing=facing;state.turnHeading=heading;
      state.facingBlend=state.facing;stop(state,dt);return;
    }
    state.heading=headingToward(state.heading,heading,dt);
  }
  state.location=copy(to);state.elapsed=nextElapsed;state.distance+=travel;state.speed=travel/dt;
  state.blend+=((state.speed>.05?1:0)-state.blend)*Math.min(1,dt*10);state.blockedReason=null;
  if(nextElapsed>=state.route.motion.duration){state.route=null;state.elapsed=0;state.pauseRemaining=.7+(state.targetSequence%4)*.18;}
}
