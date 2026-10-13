import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { createGame, type GameState } from '../src/game';
import { setPetPassageOpen } from '../src/pet-passage';
import { blocksActorStep, getPetPassageLink, planNavigation, sampleNavigation, type NavigationActor, type NavigationLocation, type NavigationWorld } from '../src/scene-navigation';
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
   const dog=scene.petMotion.get('dog')!,cat=scene.petMotion.get('cat')!,link=getPetPassageLink(1);
   dog.location={surface:'deck',floor:1,point:direction==='down'?[310.39136199088125,247.13035770010035]:[310.98,214.6]};
   cat.location={surface:'ramp',floor:1,link:link.id,point:direction==='down'?[266.98,221.21635340872288]:[266.98,239.6]};
   Object.assign(dog,{route:null,elapsed:0,pauseRemaining:0,retryRemaining:0,turnRemaining:0,blockedReason:'no-clear-patrol-route',distance:688.9139973557782,
    heading:9.53931284974002,facing:-1,facingBlend:-1,desiredFloor:1,desiredSurface:direction==='down'?'road':'deck'});
   Object.assign(cat,{elapsed:0,pauseRemaining:0,retryRemaining:0,turnRemaining:0,blockedReason:'actor:dog',distance:654.2319540816592,
    heading:7.349585307179608,facing:1,facingBlend:1,desiredFloor:1,desiredSurface:direction==='down'?'road':'deck',passageLease:link});
   const world=scene.petNavigationWorld(cat.radius,scene.physicalActors().filter(actor=>actor.id!=='cat'),cat),target:NavigationLocation=
    direction==='down'?{surface:'road',point:[200,660]}:{surface:'deck',floor:1,point:[254.32,240.68]};
   cat.route=planNavigation(world,cat.location,target)??null;assert.ok(cat.route);
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
   assert.ok(ownerArrived&&allOnSide);assert.ok(movedDog>15,'the blocker clears by actual walking');assert.ok(parkedFrames>2);assert.deepEqual(scene.state,before);
  });
  await t.test('two captured road approaches queue nearby before either owns the bridge instead of wandering away from their open follow intent',()=>{
   const{scene,dog,cat}=fixture('down');scene.heroLocation={surface:'deck',floor:1,point:[220.98,286.57]};
   const captures=[{pet:dog,point:[245.6113972561556,651.0576006349254],start:[323.74,635.74],target:[257.5868329816346,218.9554353092894],heading:9.231177331065641,gaitDistance:2986.683829432326},
    {pet:cat,point:[183.21848330577143,608.3273738113288],start:[158.17508840879066,531.2152744352333],target:[225.81960629771248,240.1161166387058],heading:20.106331928668794,gaitDistance:2810.205382518471}];
   for(const capture of captures){
    const pet=capture.pet;pet.location={surface:'road',point:[...capture.point]as[number,number]};delete pet.passageLease;
    const world=scene.petNavigationWorld(pet.radius,[]),route=planNavigation(world,{surface:'road',point:[...capture.start]as[number,number]},
      {surface:'deck',floor:1,point:[...capture.target]as[number,number]});assert.ok(route);
    const wanted=distance(capture.start,capture.point);let lo=0,hi=route.motion.duration;
    for(let n=0;n<70;n++){const mid=(lo+hi)/2;if(sampleNavigation(route,mid).distance<wanted)lo=mid;else hi=mid;}
    Object.assign(pet,{route,elapsed:(lo+hi)/2,pauseRemaining:0,retryRemaining:0,turnRemaining:0,blockedReason:null,desiredFloor:1,desiredSurface:'deck',
      worldKey:JSON.stringify([world.floors,world.obstacles,world.links,world.road]),heading:capture.heading,distance:capture.gaitDistance,facing:capture.start[0]>200?-1:1});
    pet.facingBlend=pet.facing;assert.ok(distance(sampleNavigation(route,pet.elapsed).point,capture.point)<1e-6,'the actual native approach progress is retained');
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
   assert.ok(queued&&planted>2);assert.ok(arrived,'both actual approaches finish within the original 41.20-second distance-based budget');
   assert.deepEqual(scene.state,before);
  });
  await t.test('the captured DEV4 deck queue clears a recently exited full-size road resident before provisional admission within the original budget',()=>{
   const{scene,dog,cat}=fixture('down'),link=getPetPassageLink(1);
   dog.location={surface:'deck',floor:1,point:[494.04803813220036,247.44296971136947]};
   cat.location={surface:'deck',floor:1,point:[464.7350580654301,288.6440833091128]};delete cat.passageLease;
   const dogWorld=scene.petNavigationWorld(dog.radius,[]),catWorld=scene.petNavigationWorld(cat.radius,[]),
    queue:NavigationLocation={surface:'deck',floor:1,point:[512.0480381322004,247.44296971136947]},
    dogRoute=planNavigation(dogWorld,dog.location,queue),catRoute=planNavigation(catWorld,cat.location,{surface:'road',point:[194.82,692.82]});
   assert.ok(dogRoute&&catRoute);assert.ok(Math.abs(dogRoute.motion.distance-18)<1e-6);
   assert.deepEqual(catRoute.points.slice(1,-1),[...link.points].reverse(),'the retained cat follows the exact captured bridge');
   Object.assign(dog,{route:dogRoute,elapsed:0,waitingForPassage:link.id,pauseRemaining:0,retryRemaining:0,blockedReason:null,
    desiredSurface:'road',desiredFloor:1,distance:453.60043495621517,heading:9.973902520084476,facing:-1,facingBlend:-.9315445239999884,
    turnRemaining:.26669999999999705,turnFrom:-1,nextFacing:1,turnHeading:0,worldKey:JSON.stringify([dogWorld.floors,dogWorld.obstacles,dogWorld.links,dogWorld.road])});
   Object.assign(cat,{route:catRoute,elapsed:0,pauseRemaining:0,retryRemaining:0,blockedReason:null,desiredSurface:'road',desiredFloor:1,
    distance:338.25892516918924,heading:-7.616785307179591,facing:1,facingBlend:-.166310005481489,turnRemaining:.13329999999999925,
    turnFrom:1,nextFacing:-1,turnHeading:Math.atan2(240.68-cat.location.point[1],254.32-cat.location.point[0]),
    worldKey:JSON.stringify([catWorld.floors,catWorld.obstacles,catWorld.links,catWorld.road])});
   const rampDistance=link.points.slice(1).reduce((sum,point,index)=>sum+distance(point,link.points[index]),0),
    originalApproach=distance([579.9613735013033,272.40135140562234],link.points.at(-1)!)+distance([464.2828553765412,288.6440833091128],link.points.at(-1)!),
    remainingBudget=(rampDistance*2+originalApproach)/44+12-(16660.9-14061)/1000,before=structuredClone(scene.state);
   let arrived=false,queuedAtCapturedTarget=false,clearedBeforeEntry=false,parkedDuringApproach=0;
   for(let frame=0;frame<Math.floor(remainingBudget/.05);frame++){
    const prior=structuredClone(cat);step(scene,()=>scene.advancePets(.05));
    if(dog.waitingForPassage&&!dog.route&&distance(dog.location.point,queue.point)<1e-6)queuedAtCapturedTarget=true;
    if(scene.petYields.has('cat')&&dog.location.surface==='deck'){
     clearedBeforeEntry=true;assert.equal(dog.passageLease,undefined,'provisional admission never grants a physical lease before ramp entry');
     assert.equal(scene.physicalActors().find(actor=>actor.id==='dog')?.passageIntent,link.id);
     if(!cat.route&&!prior.route){assert.deepEqual(cat.location,prior.location,'the clear landing resident remains planted while the admitted route approaches');parkedDuringApproach++;}
    }
    if([...scene.petMotion.values()].every(pet=>pet.location.surface==='road')){arrived=true;break;}
   }
   assert.ok(queuedAtCapturedTarget&&clearedBeforeEntry&&parkedDuringApproach>2);assert.ok(arrived,'both full bodies finish inside the original native distance-based deadline');
   assert.deepEqual(scene.state,before);
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
