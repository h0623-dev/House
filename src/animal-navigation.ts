import {animalFacingForHeading,animalHeadingDelta,getAnimalLocomotion} from './animal-locomotion';
import {sampleNavigation,type NavigationPath,type NavigationSurface} from './scene-navigation';
import type {UnitId} from './units';

function routeLeg(route:NavigationPath,elapsed:number){
  const travelled=sampleNavigation(route,elapsed).distance,segments=route.motion.segments;
  let before=0,index=0;
  for(;index<segments.length-1;index++){
    if(travelled<before+segments[index].distance-1e-7)break;
    before+=segments[index].distance;
  }
  const segment=segments[index],heading=segment?Math.atan2(segment.to[1]-segment.from[1],segment.to[0]-segment.from[0]):0;
  return{travelled,index,segment,heading,legDistance:segment?Math.max(0,before+segment.distance-travelled):0};
}

/** A future sharp bend is a physical stop, not a diagonal shortcut between legs. */
export function getAnimalRouteLeg(route:NavigationPath,elapsed:number,id:UnitId):{
  heading:number;remainingDistance:number;legDistance:number;stopDistance:number;surface:NavigationSurface;
}{
  const leg=routeLeg(route,elapsed),profile=getAnimalLocomotion(id),segments=route.motion.segments;
  let stopDistance=leg.legDistance,heading=leg.heading;
  for(let index=leg.index+1;index<segments.length;index++){
    const next=segments[index],nextHeading=Math.atan2(next.to[1]-next.from[1],next.to[0]-next.from[0]);
    if(Math.abs(animalHeadingDelta(heading,nextHeading))>profile.movingTurnLimit
      ||animalFacingForHeading(heading,1)!==animalFacingForHeading(nextHeading,1))break;
    stopDistance+=next.distance;heading=nextHeading;
  }
  return{heading:leg.heading,remainingDistance:Math.max(0,route.motion.distance-leg.travelled),legDistance:leg.legDistance,
    stopDistance,surface:route.surfaces[leg.index]??route.target.surface};
}

/** Invert the motion route's departure/arrival easing without changing its geometry. */
function elapsedForDistance(route:NavigationPath,wanted:number):number{
  const motion=route.motion;
  if(wanted>=motion.distance-1e-8)return motion.duration;
  let remaining=Math.max(0,wanted),travelTime=0;
  for(const segment of motion.segments){
    if(remaining<=segment.distance){travelTime+=segment.seconds*remaining/segment.distance;break;}
    remaining-=segment.distance;travelTime+=segment.seconds;
  }
  const ramp=motion.rampSeconds;
  if(!ramp)return travelTime;
  if(travelTime<ramp/2)return Math.sqrt(2*ramp*travelTime);
  if(travelTime>motion.travelSeconds-ramp/2)return motion.duration-Math.sqrt(Math.max(0,2*ramp*(motion.travelSeconds-travelTime)));
  return travelTime+ramp/2;
}

/** Consume clear ground distance up to one real path vertex; callers retain collision checks. */
export function getAnimalRouteTravel(route:NavigationPath,elapsed:number,travelDistance:number){
  const leg=routeLeg(route,elapsed),wanted=Math.min(route.motion.distance,leg.travelled+leg.legDistance,
    leg.travelled+Math.max(0,Number.isFinite(travelDistance)?travelDistance:0)),nextElapsed=elapsedForDistance(route,wanted);
  return{elapsed:nextElapsed,sample:sampleNavigation(route,nextElapsed)};
}
