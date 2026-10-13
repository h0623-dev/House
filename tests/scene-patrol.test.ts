import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {createPetPatrol,getPetGroundRadius,stepPetPatrol} from '../src/scene-patrol';
import {circleOverlapsPolygon,createNavigationWorld,defaultHeroLocation,planNavigation,planYieldNavigation,projectDeckPoint,blocksActorStep,sampleNavigation,
  distanceToSegment,type NavigationActor,type NavigationLocation,type NavigationPath,type NavigationPoint,type NavigationWorld} from '../src/scene-navigation';
import {createGame,type GameState} from '../src/game';
import type {PetPatrolState} from '../src/scene-patrol';
import {UNIT_IDS} from '../src/units';
import {FLOOR_HEIGHT,getFloorStairs,type TruckFloor} from '../src/truck-layout';
const length=(a:readonly number[],b:readonly number[])=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const scale=(id:string)=>id==='dog'?.78:id==='boar'?.7:.73;
const hero=defaultHeroLocation();

// Captured v0.21 feet retain their original deck UV or stair-segment progress.
// Only the authored separation between floors changes; no body or path is invented.
const CAPTURED_FLOOR_HEIGHT=176;
const capturedDeckPoint=(point:NavigationPoint,floor:TruckFloor):NavigationPoint=>
  [point[0],point[1]-(floor-1)*(FLOOR_HEIGHT-CAPTURED_FLOOR_HEIGHT)];
const capturedStairPoint=(point:NavigationPoint,upper:2|3):NavigationPoint=>{
  const stair=getFloorStairs(7,upper),current=[stair.lowerEntry,stair.bottom,stair.top,stair.upperEntry],
    floorIds=[stair.lowerFloor,stair.lowerFloor,stair.upperFloor,stair.upperFloor],
    offsets=floorIds.map(floor=>(floor-1)*(FLOOR_HEIGHT-CAPTURED_FLOOR_HEIGHT)),
    original=current.map((p,index)=>[p[0],p[1]+offsets[index]]as NavigationPoint);
  let segment=0;
  for(let index=1;index<original.length-1;index++)
    if(distanceToSegment(point,original[index],original[index+1])<distanceToSegment(point,original[segment],original[segment+1]))segment=index;
  assert.ok(distanceToSegment(point,original[segment],original[segment+1])<1e-6,'a captured stair body remains on its original physical link');
  const from=original[segment],to=original[segment+1],ratio=(point[0]-from[0])/(to[0]-from[0]);
  return [point[0],point[1]-(offsets[segment]+ratio*(offsets[segment+1]-offsets[segment]))];
};


test('all six companions spawn outside actual footprints and retain separate paw envelopes',()=>{
 const actors:NavigationActor[]=[{id:'hero',location:hero,radius:7}];
 for(const [index,id]of UNIT_IDS.entries()){
  const radius=getPetGroundRadius(id,scale(id)),world=createNavigationWorld(4,12,[0,1,2,3,4,5,6,7],{radius,actors});
  const pet=createPetPatrol(id,world,hero,actors,index,scale(id));assert.ok(pet,id);
  assert.equal(pet.radius,radius);assert.ok(radius>=18);
  for(const actor of actors)assert.ok(length(pet.location.point,actor.location.point)>=radius+actor.radius,'ground envelopes are separated at spawn');
  for(const obstacle of world.obstacles.filter(o=>o.surface==='deck'&&o.floor===1)){
   const b=obstacle.bounds;
   const polygon=[[b.left,b.top],[b.right,b.top],[b.right,b.bottom],[b.left,b.bottom]].map(point=>projectDeckPoint(point,1));
   assert.equal(circleOverlapsPolygon(pet.location.point,radius,polygon),false,'the actual projected circle clears house, crops and facilities');
  }
  actors.push({id,location:pet.location,radius});
 }
});

test('natural patrol uses continuous retained feet and actual travel for gait',()=>{
 const radius=getPetGroundRadius('dog',.78),world=createNavigationWorld(4,12,[0,1],{radius}),pet=createPetPatrol('dog',world,hero,[],0,.78);assert.ok(pet);
 let actual=0,moving=0,waiting=0;
 for(let frame=0;frame<600;frame++){
  const before=[...pet.location.point],oldDistance=pet.distance,heading=pet.heading;
  stepPetPatrol(pet,world,hero,[],.05);const moved=length(before,pet.location.point);actual+=moved;
  assert.ok(moved<=44*.05+1e-6,'patrol cannot jump past its shared cruise speed');
  assert.ok(Math.abs(pet.heading-heading)<=8*.05+1e-6,'heading turns at a bounded physical rate');
  assert.ok(Math.abs(pet.distance-oldDistance-moved)<1e-7,'gait distance is exactly visible travel');
  if(moved>.001)moving++;else waiting++;
 }
 assert.ok(moving>100&&waiting>10,'purposeful walks alternate with planted stops');
 assert.ok(actual>250);assert.ok(Math.abs(actual-pet.distance)<1e-6);
});

test('a facing reversal eases while planted and reduced motion cannot advance a route',()=>{
 const radius=getPetGroundRadius('cat',.73),world=createNavigationWorld(4,0,[],{radius}),pet=createPetPatrol('cat',world,hero,[],0,.73);assert.ok(pet);
 pet.location={surface:'deck',floor:1,point:projectDeckPoint([200,0])};pet.facing=1;pet.facingBlend=1;pet.heading=0;pet.pauseRemaining=0;
 pet.route=planNavigation(world,pet.location,{surface:'deck',floor:1,point:projectDeckPoint([-110,0])})??null;assert.ok(pet.route);
 const planted=[...pet.location.point],startDistance=pet.distance;
 stepPetPatrol(pet,world,hero,[],.05);assert.equal(pet.turnRemaining,.3);
 const faces=[];
 for(let n=0;n<6;n++){stepPetPatrol(pet,world,hero,[],.05);faces.push(pet.facingBlend);assert.deepEqual(pet.location.point,planted);assert.equal(pet.distance,startDistance);}
 assert.ok(faces.every((f,index)=>!index||f<=faces[index-1]));assert.ok(Math.abs(faces.at(-1)!+1)<1e-6);
 for(let n=0;n<10;n++)stepPetPatrol(pet,world,hero,[],.05);
 const retained={point:[...pet.location.point],distance:pet.distance,elapsed:pet.elapsed};
 for(let n=0;n<100;n++)stepPetPatrol(pet,world,hero,[],.05,{reducedMotion:true});
 assert.deepEqual(pet.location.point,retained.point);assert.equal(pet.distance,retained.distance);assert.equal(pet.elapsed,retained.elapsed);assert.equal(pet.speed,0);
});

test('following either upper floor traverses every built stairway without teleporting',()=>{
 const radius=getPetGroundRadius('boar',.7),world=createNavigationWorld(7,3,[0],{radius,floors:[1,2,3]});
 for(const floor of[2,3]as const){
  const pet=createPetPatrol('boar',world,hero,[],0,.7);assert.ok(pet);
  const upstairs:NavigationLocation={surface:'deck',floor,point:projectDeckPoint([150,14],floor)},links=new Set<string>();
  let reached=false;
  for(let n=0;n<1800;n++){
   const before=[...pet.location.point];stepPetPatrol(pet,world,upstairs,[],.05);
   assert.ok(length(before,pet.location.point)<=44*.05+1e-6,'floor changes keep physical feet continuous');
   if(pet.location.surface==='ladder')links.add(pet.location.link!);
   if(pet.location.surface==='deck'&&pet.location.floor===floor){reached=true;break;}
  }
  assert.ok(reached);assert.deepEqual([...links],floor===2?['1-2']:['1-2','2-3']);
 }
});

test('companions follow to the wider ground beneath the truck and return through their open walking ramp',()=>{
 for(const id of['dog','cat','boar']as const){
  const radius=getPetGroundRadius(id,scale(id)),world=createNavigationWorld(1,3,[],{radius,actor:'pet',petPassageOpen:true}),
   pet=createPetPatrol(id,world,hero,[],0,scale(id));assert.ok(pet);
  const outdoor:NavigationLocation={surface:'road',point:[600,820]},links=new Set<string>();
  let reachedGround=false,reachedDeck=false;
  for(let frame=0;frame<2000;frame++){
   const before=structuredClone(pet.location),beforeDistance=pet.distance;
   stepPetPatrol(pet,world,outdoor,[],.05);
   const moved=length(before.point,pet.location.point);
   assert.ok(moved<=44*.05+1e-6,'following outdoors uses continuous twofold patrol pace');
   assert.ok(Math.abs(pet.distance-beforeDistance-moved)<1e-6,'road gait measures accepted travel only');
   assert.equal(blocksActorStep(before,pet.location,radius,[{id:'hero',location:outdoor,radius:7}]),undefined);
   if(pet.location.surface==='ramp'){links.add(pet.location.link!);assert.equal(pet.route?.climbSegments.length,0);}
   if(pet.location.surface==='road'){
    for(const obstacle of world.obstacles.filter(obstacle=>obstacle.surface==='road')){
     const b=obstacle.bounds,polygon=[[b.left,b.top],[b.right,b.top],[b.right,b.bottom],[b.left,b.bottom]];
     assert.equal(circleOverlapsPolygon(pet.location.point,radius,polygon),false,'the whole paw envelope clears trees and outdoor resource piles');
    }
    if(length(pet.location.point,outdoor.point)<160){reachedGround=true;break;}
   }
  }
  assert.ok(reachedGround,`${id} reaches the actual outdoor resident`);assert.deepEqual([...links],['pet-road-1']);
  links.clear();
  for(let frame=0;frame<2000;frame++){
   const before=[...pet.location.point];stepPetPatrol(pet,world,hero,[],.05);
   assert.ok(length(before,pet.location.point)<=44*.05+1e-6,'returning cannot teleport to a deck patrol point');
   if(pet.location.surface==='ramp')links.add(pet.location.link!);
   if(pet.location.surface==='deck'){reachedDeck=true;break;}
  }
  assert.ok(reachedDeck,`${id} returns to the actual deck`);assert.deepEqual([...links],['pet-road-1']);
 }
});

test('an occupied stair link and a swept actor crossing hold feet without false progress',()=>{
 const radius=getPetGroundRadius('dog',.78),world=createNavigationWorld(7,0,[],{radius,floors:[1,2]}),pet=createPetPatrol('dog',world,hero,[],0,.78);assert.ok(pet);
 const link=world.links.find(l=>l.id==='1-2')!,blocker:NavigationActor={id:'cat',radius:24,location:{surface:'ladder',floor:2,link:'1-2',point:[...link.points[2]]}};
 pet.location={surface:'ladder',floor:1,link:'1-2',point:[...link.points[1]]};pet.pauseRemaining=0;
 const upstairs:NavigationLocation={surface:'deck',floor:2,point:projectDeckPoint([150,14],2)},before=[...pet.location.point];
 // Plan before another animal arrives; the assertion below covers the runtime
 // whole-link lock, while the planner independently rejects occupied landings.
 pet.route=planNavigation(world,pet.location,upstairs)??null;assert.ok(pet.route);pet.desiredFloor=2;
 stepPetPatrol(pet,world,upstairs,[blocker],.05);
 assert.equal(pet.blockedReason,'actor:cat');assert.deepEqual(pet.location.point,before);assert.equal(pet.distance,0);
 const empty=createNavigationWorld(4,0,[],{radius}),a=createPetPatrol('dog',empty,hero,[],0,.78);assert.ok(a);
 a.location={surface:'deck',floor:1,point:projectDeckPoint([200,0])};a.pauseRemaining=0;a.facing=-1;a.facingBlend=-1;
 a.route=planNavigation(empty,a.location,{surface:'deck',floor:1,point:projectDeckPoint([-110,0])})??null;assert.ok(a.route);
 const crossing:NavigationActor={id:'rabbit',radius:18,location:{...a.location,point:[a.location.point[0]-.5,a.location.point[1]]}};
 const retained=[...a.location.point];stepPetPatrol(a,empty,hero,[crossing],.05);
 assert.equal(a.blockedReason,'actor:rabbit');assert.deepEqual(a.location.point,retained);assert.equal(a.elapsed,0);assert.equal(a.distance,0);
});

test('the actual scene clears a blocked intermediate landing early without replacing the moving cat lease',async()=>{
 // Only painting imports are stubbed. The tested Scene patrol, leases and planner are the actual product methods.
 const priorImage=globalThis.Image,hook=registerHooks({load(url,context,next){
  if(/\.(png|webp|jpg|svg)$/.test(url))return{format:'module',source:`export default ${JSON.stringify(url)};`,shortCircuit:true};
  return next(url,context);
 }});
 globalThis.Image=class {} as typeof Image;
 let Scene:typeof import('../src/scene').Scene;
 try{({Scene}=await import('../src/scene'));}finally{hook.deregister();globalThis.Image=priorImage;}
 type Lease={route:NavigationPath;reserved:NavigationLocation[];reservedRadius:number};
 type PatrolScene={state:GameState;heroLocation:NavigationLocation;action:null;activeFloor:3;reducedMotion:boolean;
  petMotion:Map<string,PetPatrolState>;petYields:Map<string,Lease>;advancePets(delta:number):void;navigationWorld(radius:number,actors:NavigationActor[]):NavigationWorld;
  petNavigationWorld(radius:number,actors:NavigationActor[]):NavigationWorld};
 const state=createGame();state.deckLevel=7;state.plots=Array.from({length:9},(_,i)=>({id:i+1,plantedAt:null,watered:false}));
 state.settlement={buildings:[{id:1,type:'waterworks',slot:0,level:1,startedAt:null,readyAt:null}],nextBuildingId:2,stats:{productions:0,collections:0}};
 state.truckLayout={version:1,floors:3,home:{floor:3,slot:1},placements:[{id:1,slot:17}],
  upperBuildings:[{id:17,type:'waterworks',slot:33,level:2,startedAt:null,readyAt:null},{id:18,type:'kitchen',slot:32,level:1,startedAt:null,readyAt:null}],nextBuildingId:19};
 const heldHero:NavigationLocation={surface:'deck',floor:3,point:capturedDeckPoint([201.01874252325058,-7.388790750274325],3)},
  dogLocation:NavigationLocation={surface:'deck',floor:2,point:capturedDeckPoint([33.114950215089124,241.0999586170223],2)},
  catLocation:NavigationLocation={surface:'ladder',floor:3,link:'2-3',point:capturedStairPoint([135.66530947605872,79.08232819563777],3)},
  reserved:NavigationLocation[]=[{surface:'ladder',floor:3,link:'2-3',point:capturedStairPoint([194.44942271628653,-2.7928786218727426],3)},
   {surface:'deck',floor:1,point:[241.16319545200903,259.34724411737346]}],
  beforeCat:NavigationLocation={surface:'ladder',floor:3,link:'2-3',point:capturedStairPoint([165.4937408880556,17.519316093453497],3)},
  priorDog:NavigationActor={id:'dog',radius:25.74,location:{surface:'deck',floor:2,point:capturedDeckPoint([53.23080108845005,172.83331392512872],2)}},
  heroActor={id:'hero',radius:7,location:heldHero},
  catWorld=createNavigationWorld(7,9,[17,32,33],{floors:[1,2,3],home:{floor:3,slot:1},radius:24.82,actors:[heroActor,priorDog],actor:'pet'}),
  originalCat=planYieldNavigation(catWorld,beforeCat,reserved)!;
 assert.ok(originalCat);
 // The same captured stair progress takes longer at the unchanged climbing pace.
 const segment=originalCat.motion.segments.findIndex(part=>distanceToSegment(catLocation.point,part.from,part.to)<1e-6);assert.ok(segment>=0);
 const capturedDistance=originalCat.motion.segments.slice(0,segment).reduce((total,part)=>total+part.distance,0)
   +length(originalCat.motion.segments[segment].from,catLocation.point);
 let lower=0,upper=originalCat.motion.duration;
 for(let iteration=0;iteration<60;iteration++){
  const middle=(lower+upper)/2;if(sampleNavigation(originalCat,middle).distance<capturedDistance)lower=middle;else upper=middle;
 }
 const capturedElapsed=(lower+upper)/2;
 assert.ok(length(sampleNavigation(originalCat,capturedElapsed).point,catLocation.point)<1e-6);
 function capturedScene(){
  const scene=Object.assign(Object.create(Scene.prototype),{state:structuredClone(state),heroLocation:structuredClone(heldHero),action:null,activeFloor:3,reducedMotion:false,
   petMotion:new Map(),petYields:new Map()}) as PatrolScene;
  for(const [id,location,radius,distance,heading,facing]of[
   ['dog',dogLocation,25.74,2304.1688700639174,-11.995837236168049,1],
   ['cat',catLocation,24.82,2081.4330261337745,14.582085192072077,-1]]as const){
   const world=scene.petNavigationWorld(radius,[]),pet=createPetPatrol(id,world,heldHero,[],0,scale(id));assert.ok(pet);
   Object.assign(pet,{location:structuredClone(location),radius,distance,heading,facing,facingBlend:facing,turnRemaining:0,pauseRemaining:0,
    retryRemaining:id==='dog'?.45:0,blockedReason:id==='dog'?'actor:cat':null,desiredFloor:3,
    route:id==='cat'?originalCat:null,elapsed:id==='cat'?capturedElapsed:0,worldKey:JSON.stringify([world.floors,world.obstacles,world.links,world.road])});
   scene.petMotion.set(id,pet);
  }
  scene.petYields.set('cat',{route:originalCat,reserved:structuredClone(reserved),reservedRadius:7});return scene;
 }
 const scene=capturedScene(),catLease=scene.petYields.get('cat')!,dog=scene.petMotion.get('dog')!,cat=scene.petMotion.get('cat')!,beforeState=structuredClone(scene.state);
 scene.advancePets(.032);
 const dogLease=scene.petYields.get('dog');assert.ok(dogLease,'the stopped resident yields while the cat is still moving, before their bodies collide');
 assert.equal(scene.petYields.get('cat'),catLease);assert.equal(cat.route,originalCat);
 assert.deepEqual(dog.location,dogLocation,'accepting a yield never changes the retained feet');
 assert.equal(dog.distance,2304.1688700639174);assert.equal(dog.heading,-11.995837236168049);
 assert.equal(dogLease.route.target.floor,2);assert.equal(dogLease.route.target.surface,'deck');
 let travel=0;
 for(let frame=0;frame<150&&scene.petYields.has('dog');frame++){
  const before=structuredClone(dog.location),beforeDistance=dog.distance,actors=[heroActor,{id:'cat',location:structuredClone(cat.location),radius:cat.radius}];
  scene.advancePets(.032);const moved=length(before.point,dog.location.point);travel+=moved;
  assert.ok(moved<=44*.032+1e-6);assert.equal(blocksActorStep(before,dog.location,dog.radius,actors),undefined);
  assert.ok(Math.abs(dog.distance-beforeDistance-moved)<1e-6);
  assert.equal(scene.petYields.get('cat'),catLease);assert.equal(cat.route,originalCat,'the original cat exit never gets replanned');
 }
 assert.ok(travel>50);assert.equal(scene.petYields.has('dog'),false);assert.equal(cat.location.surface,'ladder');
 assert.deepEqual(scene.heroLocation,heldHero);assert.deepEqual(scene.state,beforeState,'yielding cannot alter saved progress');
 for(const variant of['distant','different-floor','unleased','unhealthy','unrelated-blocker','reduced-motion']as const){
  const other=capturedScene(),resident=other.petMotion.get('dog')!;
  if(variant==='distant')resident.location={surface:'deck',floor:2,point:projectDeckPoint([150,14],2)};
  if(variant==='different-floor')resident.location={...resident.location,floor:1};
  if(variant==='unleased')other.petYields.delete('cat');
  if(variant==='unhealthy')other.state.companions.cat.health=0;
  if(variant==='unrelated-blocker')resident.blockedReason='actor:hero';
  if(variant==='reduced-motion')other.reducedMotion=true;
  other.advancePets(.032);assert.equal(other.petYields.has('dog'),false,variant);
 }
});
