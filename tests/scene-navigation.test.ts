import test from 'node:test';
import assert from 'node:assert/strict';
import { createNavigationWorld, defaultHeroLocation, groundLocation, planNavigation, projectDeckPoint,
  unprojectDeckPoint, sampleNavigation, FARM_POSITIONS, SETTLEMENT_POSITIONS,
  type NavigationLocation, type NavigationPath, type NavigationPoint, type NavigationWorld } from '../src/scene-navigation.ts';
import { WALK_SPEED, CLIMB_SPEED } from '../src/scene-motion.ts';

const deck = (u:number,v:number):NavigationLocation => ({surface:'deck',point:projectDeckPoint([u,v])});
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
    const p=sample.location.surface==='deck'?unprojectDeckPoint(sample.point):sample.point;
    for(const obstacle of world.obstacles.filter(o=>o.surface===sample.location.surface)){
      const r=obstacle.bounds;
      assert.ok(!(p[0]>r.left+1e-5&&p[0]<r.right-1e-5&&p[1]>r.top+1e-5&&p[1]<r.bottom-1e-5),'feet never cross a planted bed/building/tree footprint');
    }
  }
};

test('projected ground identifies empty floors and rejects beds, buildings, railings and distant road',()=>{
  const world=createNavigationWorld(1,3,[0]);
  for(const p of [[-74,14],[120,-20],[-240,70]]as NavigationPoint[]){
    closePoint(unprojectDeckPoint(projectDeckPoint(p)),p);
    assert.equal(groundLocation(world,projectDeckPoint(p))?.surface,'deck');
  }
  for(const p of [[-82,75],[-42,-106],[-238,-104],[-277,10],[0,140]]as NavigationPoint[])
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
    const targets=[...FARM_POSITIONS.slice(0,level*3).map(([u,v])=>deck(u-9,v+39)),
      ...SETTLEMENT_POSITIONS.slice(0,level*2).map(([u,v])=>deck(u+67,v+67)),road(142,590),road(211,578)];
    for(const target of targets){const path=requirePath(world,defaultHeroLocation(),target);assertClear(world,path);
      closePoint(sampleNavigation(path,path.motion.duration).point,target.point);
      closePoint(sampleNavigation(path,path.returnMotion.duration,true).point,defaultHeroLocation().point);}
  }
});

test('deck-to-road paths use only the real ladder and climb it in both directions',()=>{
  const world=createNavigationWorld(1,3,[0,1]),destination=road(270,655);
  const outbound=requirePath(world,deck(155,-20),destination),inbound=requirePath(world,destination,deck(155,-20));
  for(const path of [outbound,inbound]){
    assert.equal(path.climbSegments.length,1);const index=path.climbSegments[0],segment=path.motion.segments[index];
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
  const built=createNavigationWorld(1,3,[0]),path=requirePath(built,standing,deck(25,-39));
  closePoint(sampleNavigation(path,0).point,standing.point);assert.equal(path.returnIndex,1);
  assert.ok(groundLocation(built,path.returnLocation.point),'the return anchor is outside the new building');
  assert.ok(distance(path.returnLocation.point,standing.point)<5,'egress chooses the nearby clear edge');
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
  for(const destination of [deck(-125,81),deck(25,-211),road(142,590)]){
    const path=requirePath(world,retained,destination);
    closePoint(sampleNavigation(path,0).point,retained.point);
    closePoint(sampleNavigation(path,path.returnMotion.duration,true).point,retained.point);
    assert.equal(path.returnIndex,0);assertClear(world,path);
    assert.equal(path.climbSegments.length,destination.surface==='deck'?1:0);
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
