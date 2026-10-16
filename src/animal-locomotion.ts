import type {UnitId} from './units';

/** Ground travel is species-specific; animation and path following share these limits. */
export interface AnimalLocomotionProfile {
  readonly gait:'walk'|'hop';
  /** World pixels per second before the common game-speed multiplier. */
  readonly cruiseSpeed:number;
  readonly acceleration:number;
  readonly braking:number;
  readonly turnRate:number;
  readonly minTurnSeconds:number;
  readonly movingTurnLimit:number;
  readonly minLegDistance:number;
  readonly restSeconds:number;
}
const profiles:Readonly<Record<UnitId,AnimalLocomotionProfile>>={
  dog:{gait:'walk',cruiseSpeed:22,acceleration:48,braking:64,turnRate:6.5,minTurnSeconds:.14,movingTurnLimit:.22,minLegDistance:55,restSeconds:3},
  cat:{gait:'walk',cruiseSpeed:19,acceleration:40,braking:66,turnRate:7.2,minTurnSeconds:.12,movingTurnLimit:.25,minLegDistance:42,restSeconds:5},
  rabbit:{gait:'hop',cruiseSpeed:23,acceleration:76,braking:82,turnRate:7.8,minTurnSeconds:.12,movingTurnLimit:.22,minLegDistance:35,restSeconds:7},
  fox:{gait:'walk',cruiseSpeed:24,acceleration:48,braking:66,turnRate:6.4,minTurnSeconds:.16,movingTurnLimit:.22,minLegDistance:65,restSeconds:5},
  boar:{gait:'walk',cruiseSpeed:18,acceleration:30,braking:42,turnRate:4.3,minTurnSeconds:.23,movingTurnLimit:.17,minLegDistance:60,restSeconds:6},
  owl:{gait:'hop',cruiseSpeed:13,acceleration:46,braking:58,turnRate:6.3,minTurnSeconds:.16,movingTurnLimit:.2,minLegDistance:26,restSeconds:10},
  monkey:{gait:'walk',cruiseSpeed:21,acceleration:52,braking:66,turnRate:7.5,minTurnSeconds:.13,movingTurnLimit:.25,minLegDistance:45,restSeconds:6},
  elephant:{gait:'walk',cruiseSpeed:14,acceleration:16,braking:24,turnRate:2.5,minTurnSeconds:.38,movingTurnLimit:.12,minLegDistance:100,restSeconds:8},
  giraffe:{gait:'walk',cruiseSpeed:16,acceleration:20,braking:30,turnRate:2.9,minTurnSeconds:.34,movingTurnLimit:.14,minLegDistance:95,restSeconds:8},
  panda:{gait:'walk',cruiseSpeed:14,acceleration:21,braking:32,turnRate:3.8,minTurnSeconds:.28,movingTurnLimit:.16,minLegDistance:45,restSeconds:13},
  deer:{gait:'walk',cruiseSpeed:23,acceleration:44,braking:58,turnRate:4.8,minTurnSeconds:.21,movingTurnLimit:.18,minLegDistance:85,restSeconds:7},
};
export const getAnimalLocomotion=(id:UnitId):AnimalLocomotionProfile=>profiles[id];
export const animalHeadingDelta=(from:number,to:number):number=>Math.atan2(Math.sin(to-from),Math.cos(to-from));

/** Preserve a side only for genuinely vertical movement, never a backwards diagonal. */
export function animalFacingForHeading(heading:number,current:1|-1):1|-1{
  const horizontal=Math.cos(heading);
  return Math.abs(horizontal)<1e-4?current:horizontal>0?1:-1;
}
export function getAnimalTurnDuration(id:UnitId,from:number,to:number):number{
  const profile=profiles[id];
  return Math.max(profile.minTurnSeconds,Math.abs(animalHeadingDelta(from,to))/profile.turnRate);
}
export function advanceAnimalHeading(from:number,to:number,delta:number,id:UnitId):number{
  const limit=Math.max(0,delta)*profiles[id].turnRate;
  return from+Math.max(-limit,Math.min(limit,animalHeadingDelta(from,to)));
}
export interface AnimalHeadingState {
  id:UnitId;heading:number;facing:1|-1;facingBlend:number;speed:number;blend:number;
  turnRemaining:number;turnFrom:1|-1;nextFacing:1|-1;turnHeading:number;
  turnDuration?:number;turnStartHeading?:number;locomotionSpeed?:number;
}
/**
 * A changed course first plants the feet and turns the complete animal in place.
 * The caller must keep its path time and ground location unchanged on false.
 * A true result always exposes the accepted travel vector, without heading lag.
 */
export function orientAnimalForTravel(state:AnimalHeadingState,heading:number,delta:number,
  {reducedMotion=false}:{reducedMotion?:boolean}={}):boolean{
  const profile=profiles[state.id],wanted=animalFacingForHeading(heading,state.facing),change=Math.abs(animalHeadingDelta(state.heading,heading));
  if(reducedMotion){state.heading=heading;state.facing=wanted;state.facingBlend=wanted;state.turnRemaining=0;return true;}
  if(state.turnRemaining>0&&Math.abs(animalHeadingDelta(state.turnHeading,heading))>profile.movingTurnLimit){
    // A new obstacle can replace a route during a turn. Continue from the actual
    // current orientation instead of snapping to an abandoned course.
    state.turnRemaining=0;
  }
  if(state.turnRemaining<=0&&(state.facing!==wanted||change>profile.movingTurnLimit)){
    state.turnFrom=state.facing;state.nextFacing=wanted;state.turnHeading=heading;
    state.turnStartHeading=state.heading;state.turnDuration=getAnimalTurnDuration(state.id,state.heading,heading);
    state.turnRemaining=state.turnDuration;
  }
  if(state.turnRemaining>0){
    state.speed=0;state.blend=0;state.locomotionSpeed=0;
    const duration=state.turnDuration??getAnimalTurnDuration(state.id,state.turnStartHeading??state.heading,state.turnHeading);
    state.turnRemaining=Math.max(0,state.turnRemaining-Math.max(0,delta));
    const progress=1-state.turnRemaining/duration,t=progress*progress*(3-2*progress),start=state.turnStartHeading??state.heading;
    state.heading=start+animalHeadingDelta(start,state.turnHeading)*t;
    // Whole-body facing changes once. An animal is never flattened through a
    // zero horizontal scale while turning, including a rider's saddle anchor.
    state.facing=progress<.5?state.turnFrom:state.nextFacing;state.facingBlend=state.facing;
    if(!state.turnRemaining){state.heading=state.turnHeading;state.facing=state.nextFacing;state.facingBlend=state.facing;}
    return false;
  }
  state.heading=heading;state.facing=wanted;state.facingBlend=wanted;
  return true;
}
