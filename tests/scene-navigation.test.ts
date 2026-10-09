import test from 'node:test';
import assert from 'node:assert/strict';
import { createNavigationWorld, defaultHeroLocation, groundLocation, planNavigation, projectDeckPoint,
  unprojectDeckPoint, sampleNavigation, FARM_POSITIONS, SETTLEMENT_POSITIONS,
  HERO_BODY_RADIUS, circleOverlapsPolygon, blocksActorStep, planWorkNavigation, planYieldNavigation, distanceToSegment,
  type NavigationLocation, type NavigationPath, type NavigationPoint, type NavigationWorld } from '../src/scene-navigation.ts';
import { WALK_SPEED, CLIMB_SPEED } from '../src/scene-motion.ts';
import { getFloorStairs, type TruckFloor } from '../src/truck-layout.ts';
import { createPetPatrol, stepPetPatrol } from '../src/scene-patrol.ts';

const deck = (u:number,v:number,floor:TruckFloor=1):NavigationLocation => ({surface:'deck',floor,point:projectDeckPoint([u,v],floor)});
const road = (x:number,y:number):NavigationLocation => ({surface:'road',point:[x,y]});
const distance = (a:readonly number[],b:readonly number[]) => Math.hypot(a[0]-b[0],a[1]-b[1]);
const closePoint = (actual:readonly number[],expected:readonly number[]) => assert.ok(distance(actual,expected)<1e-6,`${actual} != ${expected}`);
const requirePath = (world:NavigationWorld,from:NavigationLocation,to:NavigationLocation):NavigationPath => {
  const path=planNavigation(world,from,to);assert.ok(path,`${from.surface} ${from.point} → ${to.surface} ${to.point}`);return path;
};
const assertClear = (world:NavigationWorld,path:NavigationPath) => {
  for(let elapsed=0;elapsed<=path.motion.duration;elapsed+=.013){
    const sample=sampleNavigation(path,elapsed);
    if(sample.location.surface==='ladder')continue;
    const p=sample.location.surface==='deck'?unprojectDeckPoint(sample.point,sample.location.floor??1):sample.point;
    for(const obstacle of world.obstacles.filter(o=>o.surface===sample.location.surface&&(o.surface==='road'||o.floor===(sample.location.floor??1)))){
      const r=obstacle.bounds;
      assert.ok(!(p[0]>r.left+1e-5&&p[0]<r.right-1e-5&&p[1]>r.top+1e-5&&p[1]<r.bottom-1e-5),'feet never cross a planted bed/building/tree footprint');
      const polygon=[[r.left,r.top],[r.right,r.top],[r.right,r.bottom],[r.left,r.bottom]].map(p=>obstacle.surface==='deck'?projectDeckPoint(p as NavigationPoint,obstacle.floor??1):p as NavigationPoint);
      assert.equal(circleOverlapsPolygon(sample.point,world.radius,polygon),false,'the complete body footprint clears the obstacle, not only its center');
    }
  }
};

test('projected ground identifies empty floors and rejects beds, buildings, railings and distant road',()=>{
  const world=createNavigationWorld(1,3,[0]);
  for(const p of [[-74,14],[120,-20],[-240,70]]as NavigationPoint[]){
    closePoint(unprojectDeckPoint(projectDeckPoint(p)),p);
    assert.equal(groundLocation(world,projectDeckPoint(p))?.surface,'deck');
  }
  for(const p of [[-82,75],[-42,-106],[-238,-104],[-317,10],[0,140]]as NavigationPoint[])
    assert.equal(groundLocation(world,projectDeckPoint(p)),undefined);
  assert.equal(groundLocation(world,[270,655])?.surface,'road');
  for(const p of [[97,601],[184,564],[999,999],[NaN,20]]as NavigationPoint[])assert.equal(groundLocation(world,p),undefined);
});

test('a direct empty-floor walk keeps exact retained endpoints, ramps and the shared twofold pace',()=>{
  const world=createNavigationWorld(1,3,[]),from=deck(-74,14),to=deck(155,14);
  const path=requirePath(world,from,to);
  assert.equal(path.points.length,2);assert.equal(path.climbSegments.length,0);
  assert.equal(WALK_SPEED,400);assert.equal(CLIMB_SPEED,240);
  closePoint(sampleNavigation(path,0).point,from.point);closePoint(sampleNavigation(path,path.motion.duration).point,to.point);
  closePoint(sampleNavigation(path,path.returnMotion.duration,true).point,from.point);
  assert.ok(Math.abs(path.motion.travelSeconds-distance(from.point,to.point)/400)<1e-9);
  const departure=distance(sampleNavigation(path,0).point,sampleNavigation(path,.005).point);
  const cruise=distance(sampleNavigation(path,.2).point,sampleNavigation(path,.205).point);
  assert.ok(departure<cruise*.2,'small footsteps at departure precede normal walking speed');
  const alreadyThere=requirePath(world,to,to);
  assert.equal(alreadyThere.motion.duration,0);assert.equal(alreadyThere.returnMotion.duration,0);
  closePoint(sampleNavigation(alreadyThere,0).point,to.point);closePoint(sampleNavigation(alreadyThere,10,true).point,to.point);
});

test('visibility paths go around a farm rather than cutting diagonally through its soil',()=>{
  const world=createNavigationWorld(1,3,[]),from=deck(-150,80),to=deck(155,80),path=requirePath(world,from,to);
  assert.ok(path.points.length>2);assert.ok(path.motion.distance>distance(from.point,to.point));assertClear(world,path);
  assert.equal(planNavigation(world,from,deck(-90,65)),undefined,'an occupied destination cannot be admitted as an escape');
});

test('all eight deck sizes keep every farm and facility reachable through their clear aisles',()=>{
  for(let level=1;level<=8;level++){
    const world=createNavigationWorld(level,level*3,Array.from({length:level*2},(_,i)=>i));
    const targets=[...FARM_POSITIONS.slice(0,level*3).map(([u,v])=>deck(u-13,v+39)),
      ...SETTLEMENT_POSITIONS.slice(0,level*2).map(([u,v])=>deck(u+83,v+83)),road(142,590),road(211,578)];
    for(const target of targets){const path=requirePath(world,defaultHeroLocation(),target);assertClear(world,path);
      closePoint(sampleNavigation(path,path.motion.duration).point,target.point);
      closePoint(sampleNavigation(path,path.returnMotion.duration,true).point,defaultHeroLocation().point);}
  }
});

test('deck-to-road paths use only the real ladder and climb it in both directions',()=>{
  const world=createNavigationWorld(1,3,[0,1]),destination=road(270,655);
  const outbound=requirePath(world,deck(155,-20),destination),inbound=requirePath(world,destination,deck(155,-20));
  for(const path of [outbound,inbound]){
    assert.deepEqual([...new Set(path.segments.filter(s=>s.link).map(s=>s.link))],['road-1']);
    const index=path.motion.segments.findIndex(s=>distance(s.from,path===outbound?world.ladder.top:world.ladder.bottom)<1e-6&&distance(s.to,path===outbound?world.ladder.bottom:world.ladder.top)<1e-6),segment=path.motion.segments[index];
    assert.equal(segment.surface,'climb');assert.ok(segment.seconds>=.36);
    closePoint(segment.from,path===outbound?world.ladder.top:world.ladder.bottom);
    closePoint(segment.to,path===outbound?world.ladder.bottom:world.ladder.top);
    const before=path.motion.segments.slice(0,index).reduce((sum,s)=>sum+s.seconds,0)+path.motion.rampSeconds/2;
    const sample=sampleNavigation(path,before+segment.seconds/2);
    assert.equal(sample.location.surface,'ladder');assert.equal(sample.pose,'climb');
    assert.equal(sample.climbing,path===outbound?'down':'up');assertClear(world,path);
  }
});

test('retargeting a climber or stopping at the rail entrance starts from the exact physical feet',()=>{
  const world=createNavigationWorld(1,3,[]),mid=world.ladder.top.map((v,i)=>(v+world.ladder.bottom[i])/2)as NavigationPoint;
  for(const target of [deck(155,-20),road(270,655)]){
    const path=requirePath(world,{surface:'ladder',point:mid},target);
    closePoint(sampleNavigation(path,0).point,mid);assert.equal(path.motion.segments[0].surface,'climb');
    closePoint(sampleNavigation(path,path.returnMotion.duration,true).point,mid);
  }
  const gate=world.ladder.entry.map((v,i)=>v+(world.ladder.top[i]-v)*.8)as NavigationPoint;
  const route=requirePath(world,{surface:'deck',point:gate},deck(155,-20));
  closePoint(route.points[0],gate);closePoint(route.points[1],world.ladder.entry);assertClear(world,route);
  assert.equal(planNavigation(world,{surface:'ladder',point:[mid[0]+20,mid[1]]},deck(155,-20)),undefined,'a remote point cannot invent a ladder');
});

test('a retargeted walk keeps its sampled start and every frame remains bounded by surface speed',()=>{
  const world=createNavigationWorld(2,6,[0,1,2,3]);
  const first=requirePath(world,defaultHeroLocation(),deck(210,14));
  const retained=sampleNavigation(first,first.motion.duration*.41);
  const next=requirePath(world,retained.location,road(270,655));closePoint(sampleNavigation(next,0).point,retained.point);
  let previous=sampleNavigation(next,0);
  for(let t=.005;t<next.motion.duration;t+=.005){const current=sampleNavigation(next,t);
    assert.ok(distance(current.point,previous.point)<=WALK_SPEED*.005+1e-6,'retarget never jumps or speeds through waypoints');
    assert.ok(current.distance>=previous.distance);previous=current;}
  closePoint(sampleNavigation(next,900).point,next.target.point);
});

test('construction or a newly added bed covering the actor permits only a physical exit and a safe return',()=>{
  const before=createNavigationWorld(1,3,[]),standing=deck(20,-60);
  assert.ok(groundLocation(before,standing.point));
  const built=createNavigationWorld(1,3,[0]),path=requirePath(built,standing,deck(41,-23));
  closePoint(sampleNavigation(path,0).point,standing.point);assert.equal(path.returnIndex,1);
  assert.ok(groundLocation(built,path.returnLocation.point),'the return anchor is outside the new building');
  const clearance=HERO_BODY_RADIUS*Math.hypot(.47,.67)/.6555;
  closePoint(path.returnLocation.point,projectDeckPoint([23+clearance+.5,-60]));
  const halfway=sampleNavigation(path,path.motion.segments[0].seconds/2+path.motion.rampSeconds/2);
  assert.ok(distance(halfway.point,standing.point)>0&&distance(halfway.point,path.returnLocation.point)>0,'exit is animated rather than teleported');
  closePoint(sampleNavigation(path,path.returnMotion.duration,true).point,path.returnLocation.point);
  assert.ok(distance(path.returnLocation.point,standing.point)>0);
  const larger=createNavigationWorld(2,3,[]),futureBed=deck(160,80);
  assert.ok(groundLocation(larger,futureBed.point));
  const planted=createNavigationWorld(2,4,[]),escape=requirePath(planted,futureBed,defaultHeroLocation());
  assert.ok(groundLocation(planted,escape.returnLocation.point));assert.equal(escape.returnIndex,1);
  assert.equal(planNavigation(built,standing,deck(-42,-106)),undefined,'egress does not make other occupied destinations valid');
});

test('chores launched from a road position use the ladder and return to that road position',()=>{
  const world=createNavigationWorld(3,9,[0,1,2,3,4,5]),retained=road(270,655);
  for(const destination of [deck(-145,79),deck(41,-195),road(142,590)]){
    const path=requirePath(world,retained,destination);
    closePoint(sampleNavigation(path,0).point,retained.point);
    closePoint(sampleNavigation(path,path.returnMotion.duration,true).point,retained.point);
    assert.equal(path.returnIndex,0);assertClear(world,path);
    assert.deepEqual([...new Set(path.segments.filter(s=>s.link).map(s=>s.link))],destination.surface==='deck'?['road-1']:[]);
  }
});

test('invalid floors and mutated caller coordinates cannot affect a planned route',()=>{
  const world=createNavigationWorld(1,3,[]),start=defaultHeroLocation(),target=deck(155,-20),path=requirePath(world,start,target);
  const actualStart=[...start.point],actualEnd=[...target.point];start.point[0]=999;target.point[1]=-999;
  closePoint(sampleNavigation(path,0).point,actualStart);closePoint(sampleNavigation(path,path.motion.duration).point,actualEnd);
  for(const from of [road(400,500),deck(-400,20),{surface:'deck',point:[NaN,20]}as NavigationLocation,{surface:'unknown',point:[270,655]}as unknown as NavigationLocation])
    assert.equal(planNavigation(world,from,defaultHeroLocation()),undefined);
  assert.equal(planNavigation(world,defaultHeroLocation(),{surface:'ladder',point:world.ladder.top}),undefined);
});

test('all 48 facilities on three built floors remain reachable and chores return through the actual stairs',()=>{
  const world=createNavigationWorld(8,24,Array.from({length:48},(_,i)=>i),{floors:[1,2,3],home:{floor:3,slot:0}}),origin=defaultHeroLocation();
  for(let slot=0;slot<48;slot++){
    const floor=(Math.floor(slot/16)+1)as TruckFloor,[u,v]=SETTLEMENT_POSITIONS[slot%16],target=deck(u+83,v+83,floor),path=requirePath(world,origin,target);
    closePoint(sampleNavigation(path,0).point,origin.point);closePoint(sampleNavigation(path,path.motion.duration).point,target.point);
    closePoint(sampleNavigation(path,path.returnMotion.duration,true).point,origin.point);
    assert.equal(path.returnIndex,0);assert.equal(sampleNavigation(path,path.motion.duration).location.floor,floor);
    assert.deepEqual([...new Set(path.segments.flatMap(segment=>segment.link?[segment.link]:[]))],floor===1?[]:floor===2?['1-2']:['1-2','2-3']);
    for(const segment of path.motion.segments){
      const index=path.motion.segments.indexOf(segment),metadata=path.segments[index];
      if(!metadata.link){const middle=segment.from.map((n,axis)=>(n+segment.to[axis])/2)as NavigationPoint;
        assert.ok(groundLocation(world,middle,metadata.toFloor as TruckFloor),'every floor segment retains full-body ground clearance');}
    }
  }
  assert.equal(planNavigation(createNavigationWorld(8,24,[],{floors:[1]}),origin,deck(155,14,2)),undefined,'level alone cannot invent an unbuilt second floor');
  assert.equal(planNavigation(createNavigationWorld(8,24,[],{floors:[1,2]}),origin,deck(155,14,3)),undefined,'an unbuilt third floor has no route');
});

test('retargeting either direction halfway along an upper stair retains the exact feet and correct floor',()=>{
  const world=createNavigationWorld(7,21,[],{floors:[1,2,3]}),stair=getFloorStairs(7,3),mid=stair.bottom.map((n,i)=>(n+stair.top[i])/2)as NavigationPoint;
  for(const destination of [deck(155,14,1),deck(155,14,2),deck(155,14,3),road(270,655)]){
    const path=requirePath(world,{surface:'ladder',floor:2,link:'2-3',point:mid},destination);
    closePoint(sampleNavigation(path,0).point,mid);closePoint(sampleNavigation(path,path.returnMotion.duration,true).point,mid);
    closePoint(sampleNavigation(path,path.motion.duration).point,destination.point);
    assert.equal(sampleNavigation(path,.001).location.link,'2-3');assert.equal(path.motion.segments[0].surface,'climb');
    assert.equal(sampleNavigation(path,path.motion.duration).location.floor,destination.floor);
    assertClear(world,path);
  }
});

test('nearby circles preserve the exact chore return point and fast movement cannot cross another body',()=>{
  const origin=deck(0,14),nearby={id:'dog',radius:26,location:{surface:'deck' as const,floor:1 as const,point:[origin.point[0]+35,origin.point[1]]as NavigationPoint}},
    world=createNavigationWorld(1,3,[],{actors:[nearby]}),target=deck(-170,14);
  assert.ok(distance(origin.point,nearby.location.point)>HERO_BODY_RADIUS+nearby.radius);
  assert.ok(groundLocation(world,origin.point),'a clear physical circle stays valid inside the conservative routing box');
  const path=requirePath(world,origin,target);assert.equal(path.returnIndex,0);
  closePoint(sampleNavigation(path,path.returnMotion.duration,true).point,origin.point);
  const from=deck(-100,14),to=deck(100,14),blocking={id:'cat',radius:25,location:origin};
  assert.equal(blocksActorStep(from,to,HERO_BODY_RADIUS,[blocking])?.id,'cat','swept collision catches crossing even when both endpoints are clear');
  assert.equal(blocksActorStep(from,to,HERO_BODY_RADIUS,[{...blocking,location:deck(0,14,2)}]),undefined,'separate physical floors do not block each other');
  assert.equal(circleOverlapsPolygon([0,0],7,[[7,7],[20,7],[20,20],[7,20]]),false,'a nearby polygon corner is not a circle collision');
});

test('an immobile companion at the usual work edge is routed around, while an occupied stair remains closed',()=>{
  const origin=defaultHeroLocation(),dog={id:'dog',radius:25.74,location:deck(44.137228312,0)},
    world=createNavigationWorld(1,3,[0],{actors:[dog]}),approaches=[deck(41,-23),deck(-125,-23),deck(41,-189),deck(-125,-189),deck(41,-106)];
  assert.ok(groundLocation(createNavigationWorld(1,3,[0],{radius:dog.radius}),dog.location.point),'the fallen companion is itself on valid physical ground');
  assert.equal(planNavigation(world,origin,approaches[0]),undefined,'the usual work edge is physically occupied');
  const path=planWorkNavigation(world,origin,approaches);assert.ok(path,'a different reachable work edge keeps the chore possible');
  assert.ok(distance(path.target.point,approaches[0].point)>1);assert.equal(path.returnIndex,0);
  for(const returning of [false,true])for(let t=0;t<(returning?path.returnMotion:path.motion).duration;t+=.01)
    assert.ok(distance(sampleNavigation(path,t,returning).point,dog.location.point)>=dog.radius+HERO_BODY_RADIUS-.01,'outbound and return keep the entire immobile body clear');
  closePoint(sampleNavigation(path,path.returnMotion.duration,true).point,origin.point);
  const upstairs=createNavigationWorld(4,12,[],{floors:[1,2]}),link=upstairs.links.find(link=>link.id==='1-2')!,
    frozen={id:'cat',radius:24.82,location:{surface:'ladder' as const,floor:1 as const,link:'1-2',point:[...link.points[1]]as NavigationPoint}};
  assert.equal(planWorkNavigation({...upstairs,actors:[frozen]},origin,[deck(155,14,2)]),undefined,'a blocked single stair is rejected before actionBusy can trap healing');
  assert.ok(planWorkNavigation({...upstairs,actors:[frozen]},origin,[deck(155,14,1)]),'an unrelated same-floor task stays possible');
});

test('the captured roadside-return deadlock has a full-body detour from the retained feet to the same target',()=>{
  for(const floor of[1,2,3]as const){
    const offset=(floor-1)*176,start:NavigationLocation={surface:'deck',floor,point:[657.0723859545961,324.43059685150104-offset]},
      target:NavigationLocation={surface:'deck',floor,point:[762.1095055507535,324.92665331145355-offset]},
      dog={id:'dog',radius:25.74,location:{surface:'deck' as const,floor,point:[687.4061738611254,310.29717118725637-offset]as NavigationPoint}},
      world=createNavigationWorld(floor===1?1:7,floor===1?3:21,[],{floors:floor===1?[1]:[1,2,3],actors:[dog]});
    assert.equal(blocksActorStep(start,target,HERO_BODY_RADIUS,[dog])?.id,'dog','the original straight motion is physically blocked');
    const route=requirePath(world,start,target);assert.ok(route.points.length>2,'retrying the actual circle produces a detour');
    closePoint(sampleNavigation(route,0).point,start.point);closePoint(sampleNavigation(route,route.motion.duration).point,target.point);
    assertClear(world,route);
    let previous=sampleNavigation(route,0);
    for(let elapsed=.005;elapsed<route.motion.duration;elapsed+=.005){const current=sampleNavigation(route,elapsed);
      assert.ok(distance(previous.point,current.point)<=WALK_SPEED*.005+1e-6,'the detour keeps the existing pace');
      assert.equal(blocksActorStep(previous.location,current.location,HERO_BODY_RADIUS,[dog]),undefined,'every swept step clears the full body');
      previous=current;
    }
  }
});

test('the captured occupied destination is released by a short physical pet yield without resetting feet or gait',()=>{
  const hero:NavigationLocation={surface:'deck',floor:1,point:[192.26430885419757,320.8224204861031]},
    target:NavigationLocation={surface:'deck',floor:1,point:[133.50343101864772,333.50676269531255]},
    dog:NavigationLocation={surface:'deck',floor:1,point:[159.0155066966043,316.3295851410267]},
    heroActor={id:'hero',radius:HERO_BODY_RADIUS,location:hero},dogActor={id:'dog',radius:25.74,location:dog},
    petWorld=createNavigationWorld(2,4,[],{radius:dogActor.radius,actors:[heroActor]});
  assert.equal(planNavigation(createNavigationWorld(2,4,[],{actors:[dogActor]}),hero,target),undefined,'the accepted destination became occupied after the original tap');
  const yieldRoute=planYieldNavigation(petWorld,dog,[hero,target]);assert.ok(yieldRoute);closePoint(yieldRoute.points[0],dog.point);
  assert.ok(yieldRoute.motion.distance<55,'a short clear move succeeds where long patrol destinations cannot');
  const pet=createPetPatrol('dog',petWorld,hero,[heroActor],0,.78);assert.ok(pet);
  Object.assign(pet,{location:{...dog,point:[...dog.point]},route:yieldRoute,elapsed:0,retryRemaining:0,pauseRemaining:0,
    distance:545.9765081868268,heading:3.498099034844142,facing:-1,facingBlend:-1,blend:0,blockedReason:null});
  const initialDistance=pet.distance;let travelled=0;
  for(let frame=0;frame<200&&pet.route;frame++){
    const before=[...pet.location.point];stepPetPatrol(pet,petWorld,hero,[heroActor],.032);
    const step=distance(before,pet.location.point);travelled+=step;
    assert.ok(step<=44*.032+1e-6,'yielding uses the existing patrol cruise speed and planted turns');
    assert.ok(distance(hero.point,pet.location.point)>=HERO_BODY_RADIUS+pet.radius-.01);
  }
  assert.equal(pet.route,null,'the short yielding step really finishes');
  assert.ok(Math.abs(pet.distance-initialDistance-travelled)<1e-6,'gait retains all previous travel and adds only physical movement');
  assert.ok(distance(target.point,pet.location.point)>=HERO_BODY_RADIUS+pet.radius+2-.01,'the same accepted destination is now physically clear');
  const actualDog={...dogActor,location:pet.location},remaining=requirePath(createNavigationWorld(2,4,[],{actors:[actualDog]}),hero,target);
  for(let t=0;t<remaining.motion.duration;t+=.005)assert.ok(distance(sampleNavigation(remaining,t).point,pet.location.point)>=HERO_BODY_RADIUS+pet.radius-.01);
  closePoint(sampleNavigation(remaining,remaining.motion.duration).point,target.point);
  const occupied={...petWorld,actors:[{id:'immobile',radius:2000,location:hero}]},retained=[...dog.point];
  assert.equal(planYieldNavigation(occupied,dog,[hero,target]),undefined,'no feasible physical yielding step is never invented');
  closePoint(dog.point,retained);
});

test('expanding around built stairs keeps an in-flight companion on its physical route with continuous feet and gait',()=>{
  for(const [beforeLevel,afterLevel,upper]of[[4,5,2],[7,8,3]]as const){
    const floors=upper===2?[1,2]as const:[1,2,3]as const,hero=deck(155,14,upper),
      before=createNavigationWorld(beforeLevel,beforeLevel+2,[],{floors,radius:24.82}),
      after=createNavigationWorld(afterLevel,beforeLevel+3,[],{floors,radius:24.82}),
      link=before.links.find(link=>link.id===`${upper-1}-${upper}`)!,
      midpoint=link.points[1].map((n,axis)=>(n+link.points[2][axis])/2)as NavigationPoint,
      retained:NavigationLocation={surface:'ladder',floor:(upper-1)as TruckFloor,link:link.id,point:midpoint},
      initial=requirePath(before,retained,hero),pet=createPetPatrol('cat',before,hero,[],0,.73);assert.ok(pet);
    Object.assign(pet,{location:{...retained,point:[...retained.point]},route:initial,elapsed:0,pauseRemaining:0,retryRemaining:0,
      distance:1174.976628208377,heading:-1.1258780758768754,facing:1,facingBlend:1,blend:0,blockedReason:null});
    const oldLink=before.links.find(link=>link.id===retained.link)!,newLink=after.links.find(link=>link.id===retained.link)!;
    assert.deepEqual(newLink.points,oldLink.points,'expansion grows around the actual already-built stair');
    closePoint(sampleNavigation(requirePath(after,retained,hero),0).point,retained.point);
    let travel=0,climbingFrames=0;
    for(let frame=0;frame<500&&pet.location.surface==='ladder';frame++){
      const previous={...pet.location,point:[...pet.location.point]as NavigationPoint};stepPetPatrol(pet,after,hero,[],.032);
      const step=distance(previous.point,pet.location.point);travel+=step;
      assert.ok(step<=44*.032+1e-6,'geometry revalidation never jumps or accelerates the resident');
      assert.equal(blocksActorStep(previous,pet.location,pet.radius,[{id:'hero',radius:HERO_BODY_RADIUS,location:hero}]),undefined);
      if(pet.location.surface==='ladder'){climbingFrames++;assert.equal(pet.location.link,retained.link);}
    }
    assert.ok(climbingFrames>0);assert.equal(pet.location.surface,'deck');assert.equal(pet.location.floor,upper);
    assert.ok(travel>1);assert.ok(Math.abs(pet.distance-1174.976628208377-travel)<1e-6,'gait preserves retained travel through geometry revalidation');
  }
});

test('the captured dog yields around a hero held on the stair instead of repeatedly planning through its body',()=>{
  const hero:NavigationLocation={surface:'ladder',floor:1,link:'1-2',point:[221.8896224924786,229.48585785025378]},
    dog:NavigationLocation={surface:'deck',floor:1,point:[194.93286666752502,248.10948525284655]},
    cat={id:'cat',radius:24.82,location:{surface:'deck' as const,floor:1 as const,point:[121.2068415687196,323.3151386316462]as NavigationPoint}},
    heroActor={id:'hero',radius:HERO_BODY_RADIUS,location:hero},others=[heroActor,cat],
    world=createNavigationWorld(4,6,[17,18],{floors:[1,2],radius:25.74,actors:others}),
    next={...hero,point:[hero.point[0]-.9455,hero.point[1]+1.983]as NavigationPoint},target:NavigationLocation={surface:'deck',floor:1,point:[182.36,380.19]},
    route=planYieldNavigation(world,dog,[next,target]);assert.ok(route);closePoint(route.points[0],dog.point);
  const failedBefore:NavigationLocation={surface:'deck',floor:1,point:[184.2177305613025,222.24085834253054]};
  assert.equal(blocksActorStep(dog,failedBefore,25.74,others)?.id,'hero','the former straight path really crosses the stationary stair body');
  const pet=createPetPatrol('dog',world,hero,others,0,.78);assert.ok(pet);
  Object.assign(pet,{location:{...dog,point:[...dog.point]},route,elapsed:0,pauseRemaining:0,retryRemaining:0,
    distance:1194.341839858348,heading:10.602875205865576,facing:-1,facingBlend:-1,blend:0,blockedReason:'actor:hero'});
  let travelled=0,seconds=0;
  for(let frame=0;frame<400&&pet.route;frame++){
    const before={...pet.location,point:[...pet.location.point]as NavigationPoint};stepPetPatrol(pet,world,hero,others,.032);seconds+=.032;
    const step=distance(before.point,pet.location.point);travelled+=step;
    assert.ok(step<=44*.032+1e-6);assert.equal(blocksActorStep(before,pet.location,pet.radius,others),undefined);
  }
  assert.equal(pet.route,null);assert.ok(travelled>1);assert.ok(seconds<16,'yield completes inside the existing chore stall limit');
  assert.ok(Math.abs(pet.distance-1194.341839858348-travelled)<1e-6,'planting and turning never reset accumulated paw phase');
  const yielded={id:'dog',radius:pet.radius,location:pet.location};
  assert.equal(blocksActorStep(hero,next,HERO_BODY_RADIUS,[yielded,cat]),undefined,'the exact originally blocked stair step can proceed');
  const link=world.links.find(link=>link.id===hero.link)!;
  for(let i=1;i<link.points.length;i++)
    assert.equal(blocksActorStep({surface:'ladder',floor:1,link:link.id,point:link.points[i-1]},
      {surface:'ladder',floor:1,link:link.id,point:link.points[i]},HERO_BODY_RADIUS,[yielded]),undefined,'yielding clears the whole stair corridor, not just the next step');
});

test('a temporarily occupied stair retains a reachable ground destination until the moving companion clears it',()=>{
  const hero:NavigationLocation={surface:'deck',floor:2,point:[810.3965867888622,-84.35098263471545]},
    target:NavigationLocation={surface:'deck',floor:1,point:[253.16366801784113,511.3472249495062]},
    catLocation:NavigationLocation={surface:'ladder',floor:1,link:'1-2',point:[159.89579074083665,329.4201169429952]},
    dog={id:'dog',radius:25.74,location:{surface:'deck' as const,floor:2 as const,point:[405.5772380296471,37.54357816313969]as NavigationPoint}},
    catActor={id:'cat',radius:24.82,location:catLocation},actors=[dog,catActor],
    live=createNavigationWorld(7,9,[17,18],{floors:[1,2,3],actors}),
    permanent=createNavigationWorld(7,9,[17,18],{floors:[1,2,3]});
  assert.ok(groundLocation(live,target.point,1),'the exact tapped floor remains physically empty');
  assert.equal(planNavigation(live,hero,target),undefined,'the passing cat temporarily covers the required lower entry');
  const accepted=requirePath(permanent,hero,target);closePoint(sampleNavigation(accepted,0).point,hero.point);
  closePoint(accepted.target.point,target.point);
  assert.equal(planNavigation({...permanent,actors:[catActor]},hero,target),undefined,'an immobile owner of the same passage cannot use the healthy-pet fallback');
  assert.equal(planNavigation(createNavigationWorld(7,9,[],{floors:[1]}),hero,target),undefined,'a missing upper floor cannot become a route');
  assert.equal(planNavigation(permanent,hero,deck(-100,60)),undefined,'static farm boundaries still reject occupied ground');
  const heroActor={id:'hero',radius:HERO_BODY_RADIUS,location:hero},catOthers=[dog,heroActor],
    catWorld=createNavigationWorld(7,9,[17,18],{floors:[1,2,3],radius:24.82,actors:catOthers}),
    moving=createPetPatrol('cat',catWorld,hero,catOthers,0,.73);assert.ok(moving);
  const passing=requirePath(catWorld,catLocation,deck(-74,14,2));
  Object.assign(moving,{location:{...catLocation,point:[...catLocation.point]},route:passing,elapsed:0,pauseRemaining:0,retryRemaining:0,
    distance:1974.6948352668865,heading:11.954643649303325,facing:1,facingBlend:1,blend:1,blockedReason:null});
  let travelled=0;
  for(let frame=0;frame<600&&moving.route;frame++){
    const before={...moving.location,point:[...moving.location.point]as NavigationPoint};stepPetPatrol(moving,catWorld,hero,catOthers,.032);
    const step=distance(before.point,moving.location.point);travelled+=step;
    assert.ok(step<=44*.032+1e-6);assert.equal(blocksActorStep(before,moving.location,moving.radius,catOthers),undefined);
  }
  assert.equal(moving.route,null);assert.equal(moving.location.floor,2);
  assert.ok(Math.abs(moving.distance-1974.6948352668865-travelled)<1e-6);
  const clearedActors=[dog,{...catActor,location:moving.location}],ready=requirePath({...live,actors:clearedActors},hero,accepted.target);
  for(let t=0;t<ready.motion.duration;t+=.005)
    assert.equal(blocksActorStep(sampleNavigation(ready,t).location,sampleNavigation(ready,t+.005).location,HERO_BODY_RADIUS,clearedActors),undefined);
  closePoint(sampleNavigation(ready,ready.motion.duration).point,target.point);
});

test('a moving cat promptly exits the nearest stair landing so a held chore can descend and return safely',()=>{
  const hero:NavigationLocation={surface:'deck',floor:2,point:[315.9111302836496,88.78070839974015]},
    catLocation:NavigationLocation={surface:'ladder',floor:1,link:'1-2',point:[172.5546048669048,320.54005330232053]},
    target:NavigationLocation={surface:'deck',floor:1,point:[135.46,413.09]},
    dog={id:'dog',radius:25.74,location:{surface:'deck' as const,floor:1 as const,point:[514.8188907413205,336.53839366541376]as NavigationPoint}},
    heroActor={id:'hero',radius:HERO_BODY_RADIUS,location:hero},others=[heroActor,dog],
    world=createNavigationWorld(5,7,[17,18],{floors:[1,2],radius:24.82,actors:others}),
    link=world.links.find(link=>link.id==='1-2')!,
    entry:NavigationLocation={surface:'ladder',floor:2,link:link.id,point:link.points[link.points.length-1]},
    exit=planYieldNavigation(world,catLocation,[entry,target]);assert.ok(exit);
  assert.equal(exit.target.floor,1,'the nearby lower landing is chosen instead of a long climb toward the waiting hero');
  closePoint(exit.points[0],catLocation.point);
  const pet=createPetPatrol('cat',world,hero,others,0,.73);assert.ok(pet);
  Object.assign(pet,{location:{...catLocation,point:[...catLocation.point]},route:exit,elapsed:0,pauseRemaining:0,retryRemaining:0,
    distance:1891.0555882575545,heading:-.6117269650558347,facing:1,facingBlend:1,blend:1,blockedReason:null});
  assert.equal(pet.blockedReason,null,'the captured moving companion has not yet reached a physical body collision');
  let travelled=0,seconds=0,turnFrames=0;
  for(let frame=0;frame<500&&pet.route;frame++){
    const previous={...pet.location,point:[...pet.location.point]as NavigationPoint};
    stepPetPatrol(pet,world,hero,others,.032);seconds+=.032;
    const step=distance(previous.point,pet.location.point);travelled+=step;
    assert.ok(step<=44*.032+1e-6,'the early exit keeps normal ground and climbing speeds');
    assert.equal(blocksActorStep(previous,pet.location,pet.radius,others),undefined);
    if(pet.turnRemaining){turnFrames++;closePoint(pet.location.point,previous.point);}
  }
  assert.equal(pet.route,null);assert.equal(pet.location.surface,'deck');assert.equal(pet.location.floor,1);
  assert.ok(turnFrames>0,'the retreat changes direction with planted feet');
  assert.ok(seconds<16,'the complete corridor exit fits the unchanged chore stall limit');
  assert.ok(Math.abs(pet.distance-1891.0555882575545-travelled)<1e-6,'retreat preserves the existing accumulated paw phase');
  const yielded={id:'cat',radius:pet.radius,location:pet.location},actors=[yielded,dog],
    remaining=requirePath(createNavigationWorld(5,7,[17,18],{floors:[1,2],actors}),hero,target);
  for(const returning of [false,true])for(let t=0;t<remaining.motion.duration;t+=.005){
    const from=sampleNavigation(remaining,t,returning).location,to=sampleNavigation(remaining,t+.005,returning).location;
    assert.equal(blocksActorStep(from,to,HERO_BODY_RADIUS,actors),undefined,'the exact outbound and return keep full resident clearance');
    if(to.surface==='ladder')assert.equal(actors.some(actor=>actor.location.surface==='ladder'&&actor.location.link===to.link),false);
  }
  closePoint(sampleNavigation(remaining,remaining.motion.duration).point,target.point);
  closePoint(sampleNavigation(remaining,remaining.returnMotion.duration,true).point,hero.point);
});

test('a dog blocking a leased cat exit yields with both full bodies so the original hero destination remains reachable',()=>{
  const hero:NavigationLocation={surface:'deck',floor:2,point:[313.7885732381797,89.82704048894999]},
    target:NavigationLocation={surface:'deck',floor:1,point:[253.09952348758029,511.2168795072115]},
    catLocation:NavigationLocation={surface:'ladder',floor:1,link:'1-2',point:[184.37623988714822,308.16278826418306]},
    dogLocation:NavigationLocation={surface:'deck',floor:1,point:[141.46693971433362,335.0162739474959]},
    heroActor={id:'hero',radius:HERO_BODY_RADIUS,location:hero},catActor={id:'cat',radius:24.82,location:catLocation},
    dogActor={id:'dog',radius:25.74,location:dogLocation},
    catWorld=createNavigationWorld(7,9,[17,18],{floors:[1,2,3],radius:catActor.radius,actors:[heroActor,dogActor]}),
    link=catWorld.links.find(link=>link.id==='1-2')!,
    entry:NavigationLocation={surface:'ladder',floor:2,link:link.id,point:link.points[link.points.length-1]},
    exit=planYieldNavigation({...catWorld,actors:[heroActor]},catLocation,[entry,target]);assert.ok(exit);
  assert.equal(planNavigation(catWorld,catLocation,exit.target),undefined,'the captured lower-landing dog blocks the existing cat exit');
  const others=[heroActor,catActor],dogWorld=createNavigationWorld(7,9,[17,18],{floors:[1,2,3],radius:dogActor.radius,actors:others}),
    dogExit=planYieldNavigation(dogWorld,dogLocation,[entry,target,catLocation,exit.target],catActor.radius);assert.ok(dogExit);
  const dog=createPetPatrol('dog',dogWorld,hero,others,0,.78);assert.ok(dog);
  Object.assign(dog,{location:{...dogLocation,point:[...dogLocation.point]},route:dogExit,elapsed:0,pauseRemaining:0,retryRemaining:0,
    distance:2539.3311842666158,heading:.8867021907384723,facing:1,facingBlend:1,blend:0,blockedReason:'no-clear-patrol-route'});
  let dogTravel=0,seconds=0;
  for(let frame=0;frame<500&&dog.route;frame++){
    const previous={...dog.location,point:[...dog.location.point]as NavigationPoint};stepPetPatrol(dog,dogWorld,hero,others,.032);seconds+=.032;
    const step=distance(previous.point,dog.location.point);dogTravel+=step;
    assert.ok(step<=44*.032+1e-6);assert.equal(blocksActorStep(previous,dog.location,dog.radius,others),undefined);
  }
  assert.equal(dog.route,null);assert.ok(dogTravel>1);assert.ok(Math.abs(dog.distance-2539.3311842666158-dogTravel)<1e-6);
  const clearedDog={...dogActor,location:dog.location};
  for(let i=1;i<link.points.length;i++)assert.equal(blocksActorStep(
    {surface:'ladder',floor:1,link:link.id,point:link.points[i-1]},
    {surface:'ladder',floor:1,link:link.id,point:link.points[i]},catActor.radius,[clearedDog]),undefined,
    'the dog clears the larger cat envelope along the whole corridor, not only the smaller hero envelope');
  const catOthers=[heroActor,clearedDog],ready={...catWorld,actors:catOthers},remaining=requirePath(ready,catLocation,exit.target),
    cat=createPetPatrol('cat',ready,hero,catOthers,0,.73);assert.ok(cat);
  Object.assign(cat,{location:{...catLocation,point:[...catLocation.point]},route:remaining,elapsed:0,pauseRemaining:0,retryRemaining:0,
    distance:2651.7011230911507,heading:8.298899884892519,facing:-1,facingBlend:-1,blend:0,blockedReason:'actor:dog'});
  let catTravel=0;
  for(let frame=0;frame<500&&cat.route;frame++){
    const previous={...cat.location,point:[...cat.location.point]as NavigationPoint};stepPetPatrol(cat,ready,hero,catOthers,.032);seconds+=.032;
    const step=distance(previous.point,cat.location.point);catTravel+=step;
    assert.ok(step<=44*.032+1e-6);assert.equal(blocksActorStep(previous,cat.location,cat.radius,catOthers),undefined);
  }
  assert.equal(cat.route,null);assert.equal(cat.location.surface,'deck');assert.ok(seconds<16,'the complete dependency clears within the unchanged stall limit');
  assert.ok(Math.abs(cat.distance-2651.7011230911507-catTravel)<1e-6);
  const clearedActors=[clearedDog,{...catActor,location:cat.location}],
    heroRoute=requirePath(createNavigationWorld(7,9,[17,18],{floors:[1,2,3],actors:clearedActors}),hero,target);
  for(let t=0;t<heroRoute.motion.duration;t+=.005)assert.equal(blocksActorStep(
    sampleNavigation(heroRoute,t).location,sampleNavigation(heroRoute,t+.005).location,HERO_BODY_RADIUS,clearedActors),undefined);
  closePoint(sampleNavigation(heroRoute,heroRoute.motion.duration).point,target.point);
});

test('both occupied stair exits clear physically before the waiting cat receives its first viable yield route',()=>{
  const hero:NavigationLocation={surface:'deck',floor:2,point:[327.7866068091878,82.92659381193752]},
    target:NavigationLocation={surface:'deck',floor:1,point:[253.09952348758029,511.2168795072115]},
    catLocation:NavigationLocation={surface:'ladder',floor:2,link:'1-2',point:[300.0805947488223,99.10764248963211]},
    dogLocation:NavigationLocation={surface:'deck',floor:1,point:[145.2405254946055,339.66994433167076]},
    heroActor={id:'hero',radius:HERO_BODY_RADIUS,location:hero},catActor={id:'cat',radius:24.82,location:catLocation},
    dogActor={id:'dog',radius:25.74,location:dogLocation},
    closed=createNavigationWorld(7,9,[17,18],{floors:[1,2,3],radius:catActor.radius,actors:[heroActor,dogActor]}),
    link=closed.links.find(link=>link.id==='1-2')!,
    entry:NavigationLocation={surface:'ladder',floor:2,link:link.id,point:link.points[link.points.length-1]};
  assert.equal(planYieldNavigation(closed,catLocation,[entry,target]),undefined,'neither occupied landing can create the initial cat lease');
  assert.ok(distance(dogLocation.point,link.points[0])<.04,'the actual dog covers the lower floor-path entry');
  assert.ok(distance(hero.point,entry.point)<HERO_BODY_RADIUS+catActor.radius,'the held hero covers the upper entry');
  const dogOthers=[heroActor,catActor],dogWorld=createNavigationWorld(7,9,[17,18],{floors:[1,2,3],radius:dogActor.radius,actors:dogOthers}),
    dogExit=planYieldNavigation(dogWorld,dogLocation,[entry,target,catLocation],catActor.radius);assert.ok(dogExit);
  const dog=createPetPatrol('dog',dogWorld,hero,dogOthers,0,.78);assert.ok(dog);
  Object.assign(dog,{location:{...dogLocation,point:[...dogLocation.point]},route:dogExit,elapsed:0,pauseRemaining:0,retryRemaining:0,
    distance:2286.0194742358844,heading:.3287823772403647,facing:1,facingBlend:1,blend:0,blockedReason:'no-clear-patrol-route'});
  let seconds=0,dogTravel=0;
  for(let frame=0;frame<500&&dog.route;frame++){
    const previous={...dog.location,point:[...dog.location.point]as NavigationPoint};stepPetPatrol(dog,dogWorld,hero,dogOthers,.032);seconds+=.032;
    const step=distance(previous.point,dog.location.point);dogTravel+=step;
    assert.ok(step<=44*.032+1e-6);assert.equal(blocksActorStep(previous,dog.location,dog.radius,dogOthers),undefined);
  }
  assert.equal(dog.route,null);assert.ok(Math.abs(dog.distance-2286.0194742358844-dogTravel)<1e-6);
  closePoint(catActor.location.point,catLocation.point);
  for(let i=1;i<link.points.length;i++)assert.ok(distanceToSegment(dog.location.point,link.points[i-1],link.points[i])>=dog.radius+catActor.radius+2-.01);
  const clearedDog={...dogActor,location:dog.location},catOthers=[heroActor,clearedDog],
    ready={...closed,actors:catOthers},catExit=planYieldNavigation(ready,catLocation,[entry,target]);assert.ok(catExit);
  closePoint(catExit.points[0],catLocation.point);
  const cat=createPetPatrol('cat',ready,hero,catOthers,0,.73);assert.ok(cat);
  Object.assign(cat,{location:{...catLocation,point:[...catLocation.point]},route:catExit,elapsed:0,pauseRemaining:0,retryRemaining:0,
    distance:2647.530530024362,heading:11.954643649303296,facing:1,facingBlend:1,blend:0,blockedReason:'no-clear-patrol-route'});
  let catTravel=0;
  for(let frame=0;frame<800&&cat.route;frame++){
    const previous={...cat.location,point:[...cat.location.point]as NavigationPoint};stepPetPatrol(cat,ready,hero,catOthers,.032);seconds+=.032;
    const step=distance(previous.point,cat.location.point);catTravel+=step;
    assert.ok(step<=44*.032+1e-6);assert.equal(blocksActorStep(previous,cat.location,cat.radius,catOthers),undefined);
  }
  assert.equal(cat.route,null);assert.equal(cat.location.surface,'deck');assert.equal(cat.location.floor,1);
  assert.ok(Math.abs(cat.distance-2647.530530024362-catTravel)<1e-6);
  const actors=[clearedDog,{...catActor,location:cat.location}],
    heroRoute=requirePath(createNavigationWorld(7,9,[17,18],{floors:[1,2,3],actors}),hero,target);
  assert.ok(seconds+heroRoute.motion.duration<20,'even sequential physical exits and descent fit the unchanged journey bound');
  for(const returning of[false,true])for(let t=0;t<heroRoute.motion.duration;t+=.005)
    assert.equal(blocksActorStep(sampleNavigation(heroRoute,t,returning).location,sampleNavigation(heroRoute,t+.005,returning).location,HERO_BODY_RADIUS,actors),undefined);
  closePoint(sampleNavigation(heroRoute,heroRoute.motion.duration).point,target.point);
  closePoint(sampleNavigation(heroRoute,heroRoute.returnMotion.duration,true).point,hero.point);
});

test('the captured upper-stair cat keeps its original short exit before any larger fallback is considered',()=>{
  const hero:NavigationLocation={surface:'deck',floor:3,point:[201.01874252325058,-7.388790750274325]},
    cat:NavigationLocation={surface:'ladder',floor:3,link:'2-3',point:[165.4937408880556,17.519316093453497]},
    dog={id:'dog',radius:25.74,location:{surface:'deck' as const,floor:2 as const,point:[53.23080108845005,172.83331392512872]as NavigationPoint}},
    reserved:NavigationLocation[]=[{surface:'ladder',floor:3,link:'2-3',point:[194.44942271628653,-2.7928786218727426]},
      {surface:'deck',floor:1,point:[241.16319545200903,259.34724411737346]}],
    world=createNavigationWorld(7,9,[17,32,33],{floors:[1,2,3],home:{floor:3,slot:1},radius:24.82,actors:[{id:'hero',radius:7,location:hero},dog]}),
    exit=planYieldNavigation(world,cat,reserved);assert.ok(exit);
  const expected:NavigationPoint[]=[[165.4937408880556,17.519316093453497],[164.77999999999997,18.019999999999982],
    [70.22999999999999,216.32],[34.04999999999998,241.7],[-5.547979746446714,202.1020202535533]];
  assert.deepEqual(exit.points,expected,'the already successful original-tier path is byte-for-byte unchanged');
  assert.deepEqual(exit.surfaces,['ladder','ladder','ladder','deck']);
  assert.equal(exit.motion.distance,320.75363871240035);
  assert.equal(exit.target.floor,2);closePoint(exit.target.point,expected.at(-1)!);
});

test('the captured narrow landing finds the shortest full-body fallback and still refuses an impossible exit',()=>{
  const hero:NavigationLocation={surface:'deck',floor:3,point:[201.01874252325058,-7.388790750274325]},
    dog:NavigationLocation={surface:'deck',floor:2,point:[33.114950215089124,241.0999586170223]},
    cat:NavigationLocation={surface:'ladder',floor:2,link:'2-3',point:[73.17694806575022,210.13935693878082]},
    protectedTarget:NavigationLocation={surface:'deck',floor:2,point:[-5.547979746446686,202.10202025355335]},
    reserved:NavigationLocation[]=[{surface:'ladder',floor:3,link:'2-3',point:[194.44942271628653,-2.7928786218727426]},
      {surface:'deck',floor:1,point:[241.16319545200903,259.34724411737346]},cat,protectedTarget],
    actors=[{id:'hero',radius:7,location:hero},{id:'cat',radius:24.82,location:cat}],
    world=createNavigationWorld(7,9,[17,32,33],{floors:[1,2,3],home:{floor:3,slot:1},radius:25.74,actors}),
    retained=structuredClone({dog,reserved}),exit=planYieldNavigation(world,dog,reserved,24.82);assert.ok(exit);
  assert.equal(exit.target.surface,'deck');assert.equal(exit.target.floor,2);
  assert.equal(exit.points.length,2,'the 112-unit direct route wins over the nearer endpoint with a 225-unit detour');
  assert.ok(Math.abs(exit.motion.distance-112)<1e-8);assertClear(world,exit);
  const link=world.links.find(link=>link.id==='2-3')!;
  for(let i=1;i<link.points.length;i++)assert.ok(distanceToSegment(exit.target.point,link.points[i-1],link.points[i])>=25.74+24.82+2-.01);
  assert.ok(distance(exit.target.point,protectedTarget.point)>=25.74+24.82+2-.01);
  for(let t=0;t<exit.motion.duration;t+=.016)assert.equal(blocksActorStep(
    sampleNavigation(exit,t).location,sampleNavigation(exit,t+.016).location,25.74,actors),undefined);
  assert.deepEqual({dog,reserved},retained,'planning preserves all retained feet and reservations');
  assert.equal(planYieldNavigation({...world,actors:[...actors,{id:'immobile',radius:2000,location:dog}]},dog,reserved,24.82),undefined);
});
