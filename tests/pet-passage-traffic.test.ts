import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { createGame, type GameState } from '../src/game';
import { getPetPassageGeometry, setPetPassageOpen } from '../src/pet-passage';
import { blocksActorStep, getPetPassageLink, groundLocation, planNavigation, sampleNavigation, circleOverlapsPolygon, navigationObstaclePolygon,
  sweptCircleOverlapsPolygon, type NavigationActor, type NavigationLocation, type NavigationWorld } from '../src/scene-navigation';
import type { PetPatrolState } from '../src/scene-patrol';
import type { UnitId } from '../src/units';
const distance=(a:readonly number[],b:readonly number[])=>Math.hypot(a[0]-b[0],a[1]-b[1]);
type TrafficScene={state:GameState;heroLocation:NavigationLocation;action:null|{kind:string;elapsed:number;duration:number};lastFrame:number;
  petMotion:Map<UnitId,PetPatrolState>;petYields:Map<UnitId,unknown>;petGateWaitElapsed:number;
  setState(state:GameState):void;ensurePets():void;currentHeroLocation():NavigationLocation;physicalActors():NavigationActor[];
  petNavigationWorld(radius:number,actors:NavigationActor[],motion?:PetPatrolState):NavigationWorld;
  advancePets(delta:number):void;animate(timestamp:number):void;playPetPassageGate(open:boolean):Promise<void>};

test('actual two-resident Scene clears ordinary active bridge traffic without teleporting or reversing an admitted close',async t=>{
 const globals:Record<string,unknown>={window:{matchMedia:()=>({matches:false}),addEventListener(){},devicePixelRatio:1},
  document:{hidden:false,addEventListener(){}},Image:class{complete=false;naturalWidth=0;},ResizeObserver:class{observe(){}},
  requestAnimationFrame:()=>1,cancelAnimationFrame:()=>{}};
 const descriptors=Object.fromEntries(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 for(const[key,value]of Object.entries(globals))Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});
 const hook=registerHooks({load(url,context,next){if(/\.(png|webp|jpg|svg)$/.test(url))return{format:'module',source:`export default ${JSON.stringify(url)};`,shortCircuit:true};return next(url,context);}});
 let restore:(()=>void)|undefined;
 try{
  const{Scene}=await import('../src/scene');hook.deregister();
  const prototype=Scene.prototype as unknown as{render():void},original=prototype.render;prototype.render=()=>{};restore=()=>{prototype.render=original;};
  function fixture(direction:'down'|'up'){
   const canvas={getContext:()=>({}),style:{},dataset:{},setAttribute(){},addEventListener(){},dispatchEvent(){},getBoundingClientRect:()=>({width:344,height:740})};
   const scene=new Scene(canvas as unknown as HTMLCanvasElement,()=>{})as unknown as TrafficScene,state=createGame();
   state.petPassage={version:1,open:true};scene.setState(state);
   scene.heroLocation=direction==='down'?{surface:'road',point:[140,527]}:{surface:'deck',floor:1,point:[220.98,286.57]};scene.ensurePets();
   const dog=scene.petMotion.get('dog')!,cat=scene.petMotion.get('cat')!,link=getPetPassageLink(1),geometry=getPetPassageGeometry(1);
   dog.location={surface:'deck',floor:1,point:[geometry.entry[0]+25,geometry.entry[1]-40]};
   const flightLength=distance(geometry.ground,geometry.hinge),catPoint:[number,number]=direction==='down'
    ?[geometry.entry[0]+(geometry.hinge[0]-geometry.entry[0])*.2,geometry.entry[1]+(geometry.hinge[1]-geometry.entry[1])*.2]
    :[geometry.hinge[0]+(geometry.ground[0]-geometry.hinge[0])*40/flightLength,geometry.hinge[1]+(geometry.ground[1]-geometry.hinge[1])*40/flightLength];
   cat.location={surface:'ramp',floor:1,link:link.id,point:catPoint};
   Object.assign(dog,{route:null,elapsed:0,pauseRemaining:0,retryRemaining:0,turnRemaining:0,blockedReason:'no-clear-patrol-route',distance:688.9139973557782,
    heading:9.53931284974002,facing:-1,facingBlend:-1,desiredFloor:1,desiredSurface:direction==='down'?'road':'deck'});
   Object.assign(cat,{elapsed:0,pauseRemaining:0,retryRemaining:0,turnRemaining:0,blockedReason:'actor:dog',distance:654.2319540816592,
    heading:7.349585307179608,facing:1,facingBlend:1,desiredFloor:1,desiredSurface:direction==='down'?'road':'deck',passageLease:link});
   const world=scene.petNavigationWorld(cat.radius,[],cat),target:NavigationLocation=
    direction==='down'?{surface:'road',point:[...geometry.ground]}:{surface:'deck',floor:1,point:[...geometry.entry]};
   cat.route=planNavigation(world,cat.location,target)??null;assert.ok(cat.route);
   assert.ok(groundLocation(scene.petNavigationWorld(dog.radius,[]),dog.location.point,1),'the geometry-derived blocking resident starts inside a real clear deck footprint');
   const first=cat.route.points[1];cat.heading=Math.atan2(first[1]-catPoint[1],first[0]-catPoint[0]);cat.facing=Math.cos(cat.heading)>=0?1:-1;cat.facingBlend=cat.facing;
   for(const pet of[dog,cat]){const w=scene.petNavigationWorld(pet.radius,[],pet);pet.worldKey=JSON.stringify([w.floors,w.obstacles,w.links,w.road]);}
   assert.ok(distance(dog.location.point,cat.location.point)>=dog.radius+cat.radius-.01,'captured or explicitly derived bodies start without overlap');
   return{scene,dog,cat,target};
  }
  function step(scene:TrafficScene,run:()=>void){
   const before=new Map([...scene.petMotion].map(([id,pet])=>[id,structuredClone(pet)])),heroBefore=scene.currentHeroLocation();run();
   const hero=scene.currentHeroLocation();assert.equal(blocksActorStep(heroBefore,hero,7,[...before.values()].map(pet=>({id:pet.id,location:pet.location,radius:pet.radius}))),undefined);
   const actors:NavigationActor[]=[{id:'hero',location:hero,radius:7},...[...before.values()].map(pet=>({id:pet.id,location:pet.location,radius:pet.radius}))];
   for(const[id,prior]of before){const pet=scene.petMotion.get(id)!,moved=distance(prior.location.point,pet.location.point);
    assert.ok(moved<=44*.05+1e-6);assert.ok(Math.abs(pet.distance-prior.distance-moved)<1e-6);assert.equal(pet.radius,prior.radius);
    assert.equal(blocksActorStep(prior.location,pet.location,pet.radius,actors.filter(actor=>actor.id!==id)),undefined);
    actors.find(actor=>actor.id===id)!.location=structuredClone(pet.location);
   }
  }
  for(const direction of['down','up']as const)await t.test(`${direction} active ordinary owner clears a healthy deck blocker and completes with both full bodies`,()=>{
   const{scene,dog,cat,target}=fixture(direction),before=structuredClone(scene.state),retained=structuredClone(dog.location),ownerRoute=cat.route;
   step(scene,()=>scene.advancePets(.05));assert.ok(scene.petYields.has('dog'),'a normal active ramp lease has priority without a preexisting forced owner yield');
   assert.ok(distance(dog.location.point,retained.point)<=44*.05+1e-6,'accepting priority never relocates waiting feet');
   let ownerArrived=false,allOnSide=false,movedDog=0,parkedFrames=0,parked:NavigationLocation|null=null;
   for(let frame=0;frame<900;frame++){
    const old=[...dog.location.point];step(scene,()=>scene.advancePets(.05));movedDog+=distance(old,dog.location.point);
    if(cat.location.surface==='ramp')assert.equal(cat.route,ownerRoute,'the original owner route object and direction remain admitted');
    if(cat.location.surface==='ramp'&&scene.petYields.has('dog')&&!dog.route){
      if(parked)assert.deepEqual(dog.location,parked,'the waiting resident stays planted outside the corridor until its owner really exits');
      else parked=structuredClone(dog.location);
      parkedFrames++;
    }
    if(cat.location.surface===target.surface)ownerArrived=true;
    if(ownerArrived&&dog.location.surface===target.surface){allOnSide=true;break;}
   }
   assert.ok(ownerArrived&&allOnSide,JSON.stringify({ownerArrived,allOnSide,pets:[...scene.petMotion].map(([id,pet])=>({id,location:pet.location,blockedReason:pet.blockedReason,route:pet.route?.points,waiting:pet.waitingForPassage})),yields:[...scene.petYields]}));assert.ok(movedDog>15,'the blocker clears by actual walking');assert.ok(parkedFrames>2);assert.deepEqual(scene.state,before);
  });
  await t.test('two geometry-derived road approaches queue nearby before either owns the compact flight instead of wandering away from their open follow intent',()=>{
   const{scene,dog,cat}=fixture('down');scene.heroLocation={surface:'deck',floor:1,point:[220.98,286.57]};
   const geometry=getPetPassageGeometry(1),captures=[{pet:dog,start:[-10,485],target:[...geometry.entry],travel:5,gaitDistance:2986.683829432326},
    {pet:cat,start:[90,400],target:[geometry.entry[0]+50,geometry.entry[1]-45],travel:7,gaitDistance:2810.205382518471}];
   for(const capture of captures){
    const pet=capture.pet;delete pet.passageLease;
    const world=scene.petNavigationWorld(pet.radius,[]),route=planNavigation(world,{surface:'road',point:[...capture.start]as[number,number]},
      {surface:'deck',floor:1,point:[...capture.target]as[number,number]});assert.ok(route);
    const wanted=capture.travel;let lo=0,hi=route.motion.duration;
    for(let n=0;n<70;n++){const mid=(lo+hi)/2;if(sampleNavigation(route,mid).distance<wanted)lo=mid;else hi=mid;}
    const sampled=sampleNavigation(route,(lo+hi)/2);pet.location=sampled.location;
    const first=route.points[1],heading=Math.atan2(first[1]-capture.start[1],first[0]-capture.start[0]);
    Object.assign(pet,{route,elapsed:(lo+hi)/2,pauseRemaining:0,retryRemaining:0,turnRemaining:0,blockedReason:null,desiredFloor:1,desiredSurface:'deck',
      worldKey:JSON.stringify([world.floors,world.obstacles,world.links,world.road]),heading,distance:capture.gaitDistance,facing:Math.cos(heading)>=0?1:-1});
    pet.facingBlend=pet.facing;assert.equal(pet.location.surface,'road');assert.ok(Math.abs(sampled.distance-wanted)<1e-6,'the geometry-derived existing route retains actual accepted approach progress');
   }
   const before=structuredClone(scene.state);let queued=false,planted=0,arrived=false;
   for(let frame=0;frame<824;frame++){
    const prior=new Map([...scene.petMotion].map(([id,pet])=>[id,structuredClone(pet)]));step(scene,()=>scene.advancePets(.05));
    for(const[id,pet]of scene.petMotion){
      if(pet.waitingForPassage&&pet.route){
        queued=true;assert.ok(!pet.route.surfaces.includes('ramp'),'a queue move stays on the current physical side');
        assert.ok(pet.route.motion.distance<=112+1e-6,'waiting uses a nearby real clearance step, not a distant road patrol');
      }
      if(pet.waitingForPassage&&!pet.route&&!prior.get(id)!.route){assert.deepEqual(pet.location,prior.get(id)!.location);planted++;}
    }
    if([...scene.petMotion.values()].every(pet=>pet.location.surface==='deck')){arrived=true;break;}
   }
   assert.ok(queued&&planted>2);assert.ok(arrived,'both actual approaches finish within the unchanged 41.20-second regression budget');
   assert.deepEqual(scene.state,before);
  });
  await t.test('the compact corner landing clears the complete yielded planning envelope before provisional admission',()=>{
   const{scene,dog,cat}=fixture('down'),link=getPetPassageLink(1),geometry=getPetPassageGeometry(1);
   dog.location={surface:'deck',floor:1,point:[geometry.entry[0]+60,geometry.entry[1]-40]};
   cat.location={surface:'road',point:[...geometry.ground]};delete cat.passageLease;
   const dogWorld=scene.petNavigationWorld(dog.radius,[]),catWorld=scene.petNavigationWorld(cat.radius,[]),
    queue:NavigationLocation={surface:'deck',floor:1,point:[dog.location.point[0]+18,dog.location.point[1]]},
    dogRoute=planNavigation(dogWorld,dog.location,queue),catRoute=planNavigation(catWorld,cat.location,
      {surface:'road',point:[geometry.ground[0],geometry.ground[1]+56]});
   assert.ok(dogRoute&&catRoute);assert.ok(Math.abs(dogRoute.motion.distance-18)<1e-6);
   for(const pet of[dog,cat])assert.ok(groundLocation(scene.petNavigationWorld(pet.radius,[]),pet.location.point,1,
    pet.location.surface==='road'?'road':undefined),'each full resident starts inside a clear physical footprint');
   Object.assign(dog,{route:dogRoute,elapsed:0,waitingForPassage:link.id,pauseRemaining:0,retryRemaining:0,blockedReason:null,
    desiredSurface:'road',desiredFloor:1,distance:453.60043495621517,heading:0,facing:1,facingBlend:1,turnRemaining:0,
    worldKey:JSON.stringify([dogWorld.floors,dogWorld.obstacles,dogWorld.links,dogWorld.road])});
   Object.assign(cat,{route:catRoute,elapsed:0,pauseRemaining:0,retryRemaining:0,blockedReason:null,desiredSurface:'road',desiredFloor:1,
    distance:338.25892516918924,heading:Math.PI/2,facing:1,facingBlend:1,turnRemaining:0,
    worldKey:JSON.stringify([catWorld.floors,catWorld.obstacles,catWorld.links,catWorld.road])});
   const before=structuredClone(scene.state);let arrived=false,queuedAtTarget=false,clearedBeforeEntry=false,parkedDuringApproach=0;
   for(let frame=0;frame<824;frame++){
    const prior=structuredClone(cat);step(scene,()=>scene.advancePets(.05));
    if(dog.waitingForPassage&&!dog.route&&distance(dog.location.point,queue.point)<1e-6)queuedAtTarget=true;
    if(scene.petYields.has('cat')&&dog.location.surface==='deck'){
     clearedBeforeEntry=true;assert.equal(dog.passageLease,undefined,'provisional admission never grants a physical lease before ramp entry');
     assert.equal(scene.physicalActors().find(actor=>actor.id==='dog')?.passageIntent,link.id);
     if(!cat.route&&!prior.route){
      assert.deepEqual(cat.location,prior.location,'the clear landing resident stays planted during the admitted approach');parkedDuringApproach++;
      const combined=cat.radius+dog.radius+2,delta=cat.location.point.map((value,index)=>Math.abs(value-geometry.ground[index]));
      assert.ok(delta[0]>=combined-1e-6||delta[1]>=combined-1e-6,
        'the full yielded body clears the road landing planning box as well as the physical paw circles');
     }
    }
    if([...scene.petMotion.values()].every(pet=>pet.location.surface==='road')){arrived=true;break;}
   }
   assert.ok(queuedAtTarget&&clearedBeforeEntry&&parkedDuringApproach>2);assert.ok(arrived,'both full bodies finish inside the unchanged 41.20-second regression budget');
   assert.deepEqual(scene.state,before);
  });
  await t.test('the actual paid-deck capture releases a queued cat past the yielded full dog without changing the passage deadline',()=>{
   const{scene,dog,cat}=fixture('down'),state=structuredClone(scene.state);
   state.deckLevel=7;state.plots=Array.from({length:9},(_,index)=>({...structuredClone(state.plots[0]),id:index+1}));
   state.truckLayout={version:1,floors:3,home:{floor:3,slot:1},placements:[{id:1,slot:17}],
    upperBuildings:[{id:17,type:'waterworks',slot:33,level:2,startedAt:644,readyAt:680},
     {id:18,type:'kitchen',slot:32,level:1,startedAt:null,readyAt:null}],nextBuildingId:19};
   scene.setState(state);scene.heroLocation={surface:'road',point:[140,658.13]};scene.petYields.clear();
   const passage=getPetPassageLink(7),parked:NavigationLocation={surface:'road',point:[-207.1076052811586,447.7995220449949]},
    dogFrom:NavigationLocation={surface:'road',point:[parked.point[0],391.7995220449949]},
    catFrom:NavigationLocation={surface:'deck',floor:1,point:[114.04356045435364,329.42656546521204]};
   Object.assign(dog,{location:structuredClone(parked),route:null,elapsed:0,pauseRemaining:0,retryRemaining:0,turnRemaining:0,
    blockedReason:null,distance:2122.2783242529217,heading:-4.71238898038469,facing:-1,facingBlend:-1,desiredFloor:1,desiredSurface:'road'});
   Object.assign(cat,{location:structuredClone(catFrom),route:null,elapsed:0,pauseRemaining:0,retryRemaining:0,turnRemaining:0,
    blockedReason:'no-clear-patrol-route',waitingForPassage:passage.id,distance:959.2461066365452,
    heading:-12.566370614359172,facing:1,facingBlend:1,desiredFloor:1,desiredSurface:'road'});
   delete dog.passageLease;delete cat.passageLease;
   const dogWorld=scene.petNavigationWorld(dog.radius,scene.physicalActors().filter(actor=>actor.id!=='dog')),
    yielded=planNavigation(dogWorld,dogFrom,parked);assert.ok(yielded);
   scene.petYields.set('dog',{route:yielded,reserved:[{surface:'ramp',floor:1,link:passage.id,point:[...passage.points[0]]}],
    reservedRadius:cat.radius,passage,passageOwner:'cat'});
   for(const pet of[dog,cat]){const world=scene.petNavigationWorld(pet.radius,scene.physicalActors().filter(actor=>actor.id!==pet.id));
    pet.worldKey=JSON.stringify([world.floors,world.obstacles,world.links,world.road]);}
   const before=structuredClone(scene.state);let reached=false,walkedRamp=false,releasedQueue=false;
   for(let frame=0;frame<441;frame++){
    step(scene,()=>scene.advancePets(.05));
    if(cat.location.surface==='ramp')walkedRamp=true;
    if(!cat.waitingForPassage)releasedQueue=true;
    for(const pet of[dog,cat]){
     const world=scene.petNavigationWorld(pet.radius,[]),body=world.obstacles.find(obstacle=>obstacle.kind==='truck-body')!;
     if(pet.location.surface==='road')assert.equal(circleOverlapsPolygon(pet.location.point,pet.radius,navigationObstaclePolygon(body)),false);
     if(pet.route)for(let index=0;index<pet.route.surfaces.length;index++)if(pet.route.surfaces[index]==='road')
      assert.equal(sweptCircleOverlapsPolygon(pet.route.points[index],pet.route.points[index+1],pet.radius,navigationObstaclePolygon(body)),false);
    }
    if(cat.location.surface==='road'){reached=true;break;}
   }
   assert.ok(reached&&walkedRamp&&releasedQueue,'the captured wait clears through real full-body walking within the existing 22.065-second native deadline');
   assert.deepEqual(scene.state,before,'queue clearance preserves the paid save and every resource');
  });
  await t.test('closing with the captured blocked descending cat lets that original road lease exit before actual gate work resolves',async()=>{
   const{scene,dog,cat}=fixture('down'),originalRoute=cat.route,before=structuredClone(scene.state);let resolved=false,rejected='';
   const operation=scene.playPetPassageGate(false).then(()=>{resolved=true;},error=>{rejected=error.message;});
   scene.lastFrame=1000;let tick=1000,catReachedRoad=false,maxWait=0;
   for(let frame=0;frame<900&&scene.action;frame++){
    tick+=50;step(scene,()=>scene.animate(tick));maxWait=Math.max(maxWait,scene.petGateWaitElapsed);
    if(cat.location.surface==='ramp')assert.equal(cat.route,originalRoute,'hero surface changes cannot reverse a blocked admitted descent');
    if(cat.location.surface==='road')catReachedRoad=true;
   }
   await operation;assert.equal(rejected,'');assert.equal(resolved,true);assert.ok(catReachedRoad,'the admitted descending paws finish on the road before close resolution');
   assert.notEqual(dog.location.surface,'ramp','closing never admits the waiting deck pet');assert.ok(maxWait<16);
   assert.deepEqual(scene.state,before,'physical gate animation awards no resources or changes saved progress');
   const closed=setPetPassageOpen(scene.state,false);assert.ok(closed.ok);scene.setState(closed.state);
   assert.equal(scene.state.petPassage?.open,false);assert.deepEqual({...scene.state,petPassage:before.petPassage},before);
  });
 }finally{hook.deregister();restore?.();for(const[key,descriptor]of Object.entries(descriptors)){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);}}
});
