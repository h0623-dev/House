import test from 'node:test';
import assert from 'node:assert/strict';
import { createNavigationWorld, defaultHeroLocation, groundLocation, planNavigation, projectDeckPoint,
  sampleNavigation, circleOverlapsPolygon, distanceToSegment, HERO_BODY_RADIUS, blocksActorStep,
  type NavigationLocation, type NavigationPoint } from '../src/scene-navigation';
import { getFloorBounds, type TruckFloor } from '../src/truck-layout';
import { getPetPassageGeometry, PET_PASSAGE_LINK_ID } from '../src/pet-passage';
import { WALK_SPEED, CLIMB_SPEED } from '../src/scene-motion';
import { getTruckGroundFootprint } from '../src/truck-ground';
import { GROUND_RESOURCE_BOUNDS } from '../src/ground-resources';

const road = (point: NavigationPoint): NavigationLocation => ({ surface: 'road', point });
const distance = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0] - b[0], a[1] - b[1]);
function projectedBody(level: number): NavigationPoint[] {
  const d = getFloorBounds(level), ground = [[d.left, d.back], [d.end, d.back], [d.end, d.front], [d.left, d.front]]
    .map(point => { const p = projectDeckPoint(point); return [p[0], p[1] + 95] as NavigationPoint; });
  // Roof and chassis have a vertical screen separation; the two front-facing
  // fascia edges complete the silhouette rather than filling its bounding box.
  return [[ground[0][0], ground[0][1] - 95], [ground[1][0], ground[1][1] - 95], ground[1], ground[2], ground[3],
    [ground[3][0], ground[3][1] - 95]];
}
function segmentDistance(a: NavigationPoint, b: NavigationPoint, c: NavigationPoint, d: NavigationPoint) {
  const rx=b[0]-a[0],ry=b[1]-a[1],sx=d[0]-c[0],sy=d[1]-c[1],det=rx*sy-ry*sx;
  if(Math.abs(det)>1e-9){const cx=c[0]-a[0],cy=c[1]-a[1],t=(cx*sy-cy*sx)/det,u=(cx*ry-cy*rx)/det;
    if(t>=0&&t<=1&&u>=0&&u<=1)return 0;}
  return Math.min(distanceToSegment(a,c,d),distanceToSegment(b,c,d),distanceToSegment(c,a,b),distanceToSegment(d,a,b));
}

test('road selection rejects the projected truck body for every deck size and complete actor radius', () => {
  for(let level=1;level<=8;level++)for(const radius of[HERO_BODY_RADIUS,24.82,25.74,30.8]){
    const floors:TruckFloor[]=level>=7?[1,2,3]:level>=4?[1,2]:[1];
    const world=createNavigationWorld(level,3,[],{floors,radius}),outside=road([270,820]),under=road([480,420]);
    assert.ok(groundLocation(world,outside.point,1,'road'));
    assert.equal(groundLocation(world,under.point,1,'road'),undefined,`level ${level} radius ${radius} rejects underbody feet`);
    assert.equal(planNavigation(world,outside,under),undefined,'a fabricated road target cannot bypass physical body validation');
    for(const floor of floors){
      const start={...defaultHeroLocation(),floor,point:projectDeckPoint([-160,-25],floor)},target:NavigationLocation={surface:'deck',floor,point:projectDeckPoint([155,-23],floor)};
      assert.ok(groundLocation(world,start.point,floor));assert.ok(planNavigation(world,start,target),'the ground blocker does not reserve living-deck space');
    }
  }
});

test('roads within the truck bounding box but outside its actual isometric body stay directly walkable', () => {
  for(const radius of[HERO_BODY_RADIUS,24.82,25.74,30.8]){
    const world=createNavigationWorld(1,3,[],{radius}),from=road([430,590]),to=road([460,595]),body=projectedBody(1);
    assert.equal(circleOverlapsPolygon(from.point,radius,body),false);assert.equal(circleOverlapsPolygon(to.point,radius,body),false);
    assert.ok(groundLocation(world,from.point,1,'road'));assert.ok(groundLocation(world,to.point,1,'road'));
    const route=planNavigation(world,from,to);assert.ok(route);assert.equal(route.points.length,2,'a screen bounding box cannot block this clear diagonal exterior route');
    assert.equal(route.climbSegments.length,0);
  }
});

test('outside road routes sweep around the full body at unchanged speed instead of crossing it between clear endpoints', () => {
  for(const radius of[HERO_BODY_RADIUS,24.82,25.74,30.8]){
    const world=createNavigationWorld(1,3,[],{radius}),from=road([190,500]),to=road([1000,450]),body=getTruckGroundFootprint(1).polygon;
    assert.equal(circleOverlapsPolygon(from.point,radius,body),false);assert.equal(circleOverlapsPolygon(to.point,radius,body),false);
    const route=planNavigation(world,from,to);assert.ok(route);assert.ok(route.points.length>2,'clear endpoints require a physical detour');
    for(let i=0;i<route.segments.length;i++){
      assert.equal(route.surfaces[i],'road');assert.equal(route.segments[i].fromFloor,0);assert.equal(route.segments[i].toFloor,0);
      for(let edge=0;edge<body.length;edge++)assert.ok(segmentDistance(route.points[i],route.points[i+1],body[edge],body[(edge+1)%body.length])>=radius-.01,
        'even a single fast accepted segment cannot cross a body edge');
    }
    let previous=sampleNavigation(route,0);
    for(let elapsed=.005;elapsed<route.motion.duration;elapsed+=.005){const sample=sampleNavigation(route,elapsed);
      assert.equal(circleOverlapsPolygon(sample.point,radius,body),false);assert.ok(distance(previous.point,sample.point)<=WALK_SPEED*.005+1e-6);previous=sample;}
    assert.ok(distance(sampleNavigation(route,route.returnMotion.duration,true).point,from.point)<1e-7);
  }
});

test('all built floors retain a real human ladder and compact pet passage to body-clear ground at every expansion', () => {
  for(let level=1;level<=8;level++){
    const floors:TruckFloor[]=level>=7?[1,2,3]:level>=4?[1,2]:[1];
    const hero=createNavigationWorld(level,3,[],{floors}),landing=road(hero.ladder.bottom);
    assert.ok(groundLocation(hero,landing.point,1,'road'),`level ${level} human ground landing remains usable`);
    for(const floor of floors)for(const reverse of[false,true]){
      const onDeck:NavigationLocation={surface:'deck',floor,point:projectDeckPoint([155,14],floor)},from=reverse?landing:onDeck,to=reverse?onDeck:landing;
      const route=planNavigation(hero,from,to);assert.ok(route);assert.ok(route.segments.some(segment=>segment.link==='road-1'));
      assert.ok(route.motion.segments.filter(segment=>segment.surface==='climb').every(segment=>Math.abs(segment.seconds-segment.distance/CLIMB_SPEED)<1e-7));
      assert.ok(distance(sampleNavigation(route,route.motion.duration).point,to.point)<1e-7);
      assert.ok(distance(sampleNavigation(route,route.returnMotion.duration,true).point,from.point)<1e-7);
    }
    const pet=createNavigationWorld(level,3,[],{radius:30.8,floors,actor:'pet',petPassageOpen:true}),geometry=getPetPassageGeometry(level),ground=road(geometry.ground);
    assert.ok(groundLocation(pet,ground.point,1,'road'),`level ${level} largest paws fit the actual ground entrance`);
    for(const reverse of[false,true]){
      const entry:NavigationLocation={surface:'deck',floor:1,point:geometry.entry},route=planNavigation(pet,reverse?ground:entry,reverse?entry:ground);
      assert.ok(route,`level ${level} preserves ${reverse?'up':'down'} pet passage`);assert.deepEqual([...new Set(route.segments.map(segment=>segment.link))],[PET_PASSAGE_LINK_ID]);assert.equal(route.climbSegments.length,0);
      assert.ok(route.motion.distance<=330,'the authored compact flight stays compact');
    }
  }
});

test('every expansion detours outside-to-outside road sweeps around the cab and body for the full hero and paw envelopes', () => {
  for(let level=1;level<=8;level++)for(const radius of[HERO_BODY_RADIUS,24.82,25.74,30.8]){
    const world=createNavigationWorld(level,3,[],{radius}),body=getTruckGroundFootprint(level).polygon,
      from=road([world.road.left+20,485]),to=road([world.road.right-20,485]);
    assert.ok(groundLocation(world,from.point,1,'road'),`level ${level} radius ${radius} begins on real exterior road`);
    assert.ok(groundLocation(world,to.point,1,'road'),`level ${level} radius ${radius} targets real exterior road`);
    const route=planNavigation(world,from,to);assert.ok(route);assert.ok(route.points.length>2,'the blocked straight sweep requires a detour');
    assert.equal(route.climbSegments.length,0);
    for(let i=0;i<route.segments.length;i++){
      assert.equal(route.surfaces[i],'road');
      assert.equal(circleOverlapsPolygon(route.points[i],radius,body),false);
      assert.equal(circleOverlapsPolygon(route.points[i+1],radius,body),false);
      for(let edge=0;edge<body.length;edge++)assert.ok(segmentDistance(route.points[i],route.points[i+1],body[edge],body[(edge+1)%body.length])>=radius-.01,
        `level ${level} radius ${radius} keeps the entire swept body outside the truck and cab`);
    }
    let previous=sampleNavigation(route,0);
    for(let elapsed=.05;elapsed<route.motion.duration;elapsed+=.05){const sample=sampleNavigation(route,elapsed);
      assert.equal(circleOverlapsPolygon(sample.point,radius,body),false);
      assert.ok(distance(previous.point,sample.point)<=WALK_SPEED*.05+1e-6);previous=sample;}
    assert.ok(distance(sampleNavigation(route,route.motion.duration).point,to.point)<1e-7);
    assert.ok(distance(sampleNavigation(route,route.returnMotion.duration,true).point,from.point)<1e-7);
  }
});

test('retained old road feet animate out of a newly solid body and cannot return to an invalid underbody target', () => {
  for(const radius of[HERO_BODY_RADIUS,24.82,25.74,30.8]){
    const world=createNavigationWorld(8,3,[],{radius}),retained=road([480,420]),outside=road([270,world.road.bottom-40]);
    assert.equal(groundLocation(world,retained.point,1,'road'),undefined);
    const route=planNavigation(world,retained,outside);assert.ok(route);
    assert.ok(distance(sampleNavigation(route,0).point,retained.point)<1e-7,'migration keeps the original feet');
    assert.equal(route.returnIndex,1);assert.ok(groundLocation(world,route.returnLocation.point,1,'road'));
    assert.equal(planNavigation(world,outside,retained),undefined,'legacy egress grants no new entry');
    const first=route.motion.segments[0],half=sampleNavigation(route,route.motion.rampSeconds/2+first.seconds/2);
    assert.ok(distance(half.point,retained.point)>0&&distance(half.point,route.returnLocation.point)>0,'egress is real continuous walking');
    let previous=sampleNavigation(route,0);
    for(let elapsed=.005;elapsed<route.motion.duration;elapsed+=.005){const sample=sampleNavigation(route,elapsed);
      assert.ok(distance(previous.point,sample.point)<=WALK_SPEED*.005+1e-6);previous=sample;}
    assert.ok(distance(sampleNavigation(route,route.returnMotion.duration,true).point,route.returnLocation.point)<1e-7,'returning retains the new body-clear anchor');
  }
});

test('the actual painted cabin is solid independently of the living deck and transparent image margins stay exterior', () => {
  const world=createNavigationWorld(1,3,[]),d=getFloorBounds(1),cab=projectDeckPoint([d.end+95,(d.back+d.front)/2]),
    paintedCab:NavigationPoint=[cab[0]+4,cab[1]+168-94];
  assert.equal(circleOverlapsPolygon(paintedCab,HERO_BODY_RADIUS,projectedBody(1)),false,'this visible cabin point lies beyond the deck and chassis alone');
  assert.equal(groundLocation(world,paintedCab,1,'road'),undefined,'the real cabin paint also blocks road feet');
  assert.ok(groundLocation(world,[430,590],1,'road'),'a transparent margin outside the measured cab contour remains a real road');
});

test('the painted lower chassis side extending beyond the deck also blocks whole road bodies', () => {
  for(const level of[1,4,8]){
    const world=createNavigationWorld(level,3,[]),d=getFloorBounds(level),
      side=projectDeckPoint([d.end+35,d.front-9]),paintedFace:NavigationPoint=[side[0],side[1]+95-12];
    assert.equal(groundLocation(world,paintedFace,1,'road'),undefined,`level ${level} cannot stand within the actual lower chassis face`);
  }
});

test('an opaque wheel point below the actual chassis also blocks road feet', () => {
  const world=createNavigationWorld(8,3,[]),paintedWheel:NavigationPoint=[711.74,869.59];
  assert.equal(groundLocation(world,paintedWheel,1,'road'),undefined,'the real wheel pixels are truck body, even below the deck and chassis');
});

test('the captured paid-deck ramp landing allows a full cat to pass the parked dog into the exterior road', () => {
  const retained:NavigationLocation={surface:'deck',floor:1,point:[114.04356045435364,329.42656546521204]},
    dog={id:'dog',radius:25.74,location:road([-207.1076052811586,447.7995220449949])},
    hero={id:'hero',radius:HERO_BODY_RADIUS,location:road([140,658.13])},
    world=createNavigationWorld(7,9,[17,32,33],{radius:24.82,floors:[1,2,3],actor:'pet',petPassageOpen:true,actors:[dog,hero]}),
    target=road([32.51999999999998,809.74]),body=getTruckGroundFootprint(7).polygon;
  assert.ok(groundLocation(world,retained.point,1),'the captured waiting cat has clear real deck feet');
  assert.ok(groundLocation(world,getPetPassageGeometry(7).ground,1,'road'),'the parked dog already clears the landing itself');
  const route=planNavigation(world,retained,target);assert.ok(route,'landing access must continue into a real exterior road beyond the parked full dog');
  let previous=sampleNavigation(route,0);
  for(let elapsed=.005;elapsed<route.motion.duration;elapsed+=.005){const sample=sampleNavigation(route,elapsed);
    assert.equal(blocksActorStep(previous.location,sample.location,world.radius,[dog,hero]),undefined);
    if(sample.location.surface==='road')assert.equal(circleOverlapsPolygon(sample.point,world.radius,body),false);
    previous=sample;
  }
  assert.ok(distance(sampleNavigation(route,route.motion.duration).point,target.point)<1e-7);
});

test('the paid-deck passing band admits the full largest paws and the initial ground surrounds the fixed forest', () => {
  assert.ok(createNavigationWorld(1,3,[]).roadOuter.left<=GROUND_RESOURCE_BOUNDS.left-2*30.8,
    'the first-level ground includes the authored forest and room for complete animals to pass');
  const retained:NavigationLocation={surface:'deck',floor:1,point:[114.04356045435364,329.42656546521204]},
    parked={id:'dog',radius:25.74,location:road([-207.1076052811586,447.7995220449949])},
    world=createNavigationWorld(7,9,[17,32,33],{radius:30.8,floors:[1,2,3],actor:'pet',petPassageOpen:true,actors:[parked]}),
    target=road([32.51999999999998,809.74]);
  assert.ok(groundLocation(world,retained.point,1));
  const route=planNavigation(world,retained,target);assert.ok(route,'largest real paw radius can pass the full parked dog inside the road bounds');
  for(let elapsed=0;elapsed<route.motion.duration;elapsed+=.005){const sample=sampleNavigation(route,elapsed);
    if(sample.location.surface==='road')assert.ok(groundLocation(world,sample.point,1,'road'),'full largest paws stay on actual body-clear road');
  }
});
