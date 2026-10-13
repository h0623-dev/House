import test from 'node:test';
import assert from 'node:assert/strict';
import { createNavigationWorld, defaultHeroLocation, getPetPassageLink, groundLocation, planNavigation,
  projectDeckPoint, sampleNavigation, circleOverlapsPolygon, blocksActorStep, distanceToSegment, type NavigationLocation, type NavigationWorld } from '../src/scene-navigation';
import { createPetPatrol, getPetGroundRadius, stepPetPatrol } from '../src/scene-patrol';
import { getPetPassageGeometry, PET_PASSAGE_LINK_ID, PET_PASSAGE_WIDTH } from '../src/pet-passage';
import type { TruckFloor } from '../src/truck-layout';
const distance = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const deck = (point: [number, number], floor: TruckFloor = 1): NavigationLocation => ({ surface: 'deck', floor, point });
const road = (point: [number, number]): NavigationLocation => ({ surface: 'road', point });
const radiusFor = (id: 'dog' | 'cat' | 'boar') => getPetGroundRadius(id, id === 'dog' ? .78 : id === 'boar' ? .7 : .73);
function clear(world: NavigationWorld, location: NavigationLocation) {
  if (location.surface !== 'deck' && location.surface !== 'road') return;
  for (const obstacle of world.obstacles.filter(o => o.surface === location.surface && (o.surface === 'road' || o.floor === location.floor))) {
    const r = obstacle.bounds, polygon = [[r.left, r.top], [r.right, r.top], [r.right, r.bottom], [r.left, r.bottom]]
      .map(p => oPoint(obstacle.surface, p, obstacle.floor));
    assert.equal(circleOverlapsPolygon(location.point, world.radius, polygon), false);
  }
}
function oPoint(surface: 'deck' | 'road', p: number[], floor?: TruckFloor): [number, number] {
  return surface === 'deck' ? projectDeckPoint(p, floor ?? 1) : [p[0], p[1]];
}
function segmentDistance(a: [number, number], b: [number, number], c: [number, number], d: [number, number]) {
  const rx=b[0]-a[0],ry=b[1]-a[1],sx=d[0]-c[0],sy=d[1]-c[1],det=rx*sy-ry*sx;
  if(Math.abs(det)>1e-9){
    const cx=c[0]-a[0],cy=c[1]-a[1],t=(cx*sy-cy*sx)/det,u=(cx*ry-cy*rx)/det;
    if(t>=0&&t<=1&&u>=0&&u<=1)return 0;
  }
  return Math.min(distanceToSegment(a,c,d),distanceToSegment(b,c,d),distanceToSegment(c,a,b),distanceToSegment(d,a,b));
}

test('every pet bridge segment and every gate approach clears the whole human ladder and grove at all eight sizes', () => {
  const radius=radiusFor('boar');
  for(let level=1;level<=8;level++){
    const world=createNavigationWorld(level,Math.min(24,level*3),[]),geometry=getPetPassageGeometry(level),human=world.links.find(link=>link.id==='road-1')!;
    for(let petIndex=1;petIndex<geometry.points.length;petIndex++){
      const a=geometry.points[petIndex-1],b=geometry.points[petIndex];
      for(let humanIndex=1;humanIndex<human.points.length;humanIndex++)
        assert.ok(segmentDistance(a,b,human.points[humanIndex-1],human.points[humanIndex])>=radius+world.radius+8-1e-7,
          `level${level} keeps both complete bodies apart along entire real links`);
      for(const approach of geometry.heroApproaches)
        assert.ok(distanceToSegment(approach,a,b)>=radius+world.radius+2-1e-7,
          `level${level} leaves every real gate operator outside the full bridge corridor`);
      for(let step=0;step<=100;step++){
        const t=step/100,p:[number,number]=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
        for(const obstacle of world.obstacles.filter(obstacle=>obstacle.surface==='road')){
          const r=obstacle.bounds;
          assert.equal(circleOverlapsPolygon(p,radius+2,[[r.left,r.top],[r.right,r.top],[r.right,r.bottom],[r.left,r.bottom]]),false,
            'the entire bridge clears real roadside trunks and resource footprints');
        }
        assert.equal(circleOverlapsPolygon(p,radius+2,[[31.5,423],[162.5,423],[162.5,601],[31.5,601]]),false,
          'the complete pet also clears the actual painted main grove canopy');
      }
    }
  }
});

test('the compact outside flight paints no wood over farm, building or stair footprints at any deck size', () => {
  for (let level = 1; level <= 8; level++) {
    const slots = Array.from({ length: Math.min(16, level * 2) }, (_, index) => index),
      world = createNavigationWorld(level, Math.min(24, level * 3), slots, { floors: level >= 7 ? [1, 2, 3] : level >= 4 ? [1, 2] : [1] }),
      geometry = getPetPassageGeometry(level), paintedRadius = geometry.width / 2;
    const length = geometry.points.slice(1).reduce((sum, point, index) => sum + distance(point, geometry.points[index]), 0);
    assert.ok(length <= 330, 'one short flight replaces the former 548–636px bridge');
    assert.ok(length / 44 < 7.5, 'the unmodified 44px/s walking speed crosses the compact flight within 7.5 seconds');
    assert.equal(geometry.points.length, 3, 'there is one sloped flight and one real gate landing');
    for (let index = 1; index < geometry.points.length; index++) {
      const a = geometry.points[index - 1], b = geometry.points[index];
      for (let step = 0; step <= 100; step++) {
        const amount = step / 100, point: [number, number] = [a[0] + (b[0] - a[0]) * amount, a[1] + (b[1] - a[1]) * amount];
        for (const obstacle of world.obstacles.filter(obstacle => obstacle.surface === 'deck' && obstacle.floor === 1)) {
          const r = obstacle.bounds, polygon = [[r.left, r.top], [r.right, r.top], [r.right, r.bottom], [r.left, r.bottom]]
            .map(corner => projectDeckPoint(corner as [number, number]));
          assert.equal(circleOverlapsPolygon(point, paintedRadius, polygon), false,
            `level ${level} keeps the entire painted wood width outside every ${obstacle.kind} footprint`);
        }
      }
    }
  }
});

test('an idle hero on the actual human landing never blocks dog, cat or boar walking either bridge direction', () => {
  for(let level=1;level<=8;level++)for(const id of['dog','cat','boar']as const){
    const radius=radiusFor(id),scale=id==='dog'?.78:id==='boar'?.7:.73,geometry=getPetPassageGeometry(level);
    const human=createNavigationWorld(level,3,[]),hero=deck(human.ladder.entry),actor={id:'hero',radius:7,location:hero};
    const world=createNavigationWorld(level,3,[],{radius,actors:[actor],actor:'pet',petPassageOpen:true});
    for(const[start,target]of[[deck(geometry.entry),road(geometry.ground)],[road(geometry.ground),deck(geometry.entry)]]){
      const pet=createPetPatrol(id,world,hero,[],0,scale);assert.ok(pet);
      assert.ok(groundLocation(world,start.point,1,start.surface==='road'?'road':undefined));
      const route=planNavigation(world,start,target);assert.ok(route);
      pet.location=structuredClone(start);pet.route=route;pet.pauseRemaining=0;
      const first=route.points[1],heading=Math.atan2(first[1]-start.point[1],first[0]-start.point[0]);
      pet.heading=heading;pet.facing=Math.cos(heading)>=0?1:-1;pet.facingBlend=pet.facing;
      let arrived=false;
      for(let frame=0;frame<700;frame++){
        const before=structuredClone(pet.location),walked=pet.distance;stepPetPatrol(pet,world,hero,[],.05);
        const moved=distance(before.point,pet.location.point);
        assert.ok(moved<=44*.05+1e-6);assert.ok(Math.abs(pet.distance-walked-moved)<1e-6);
        assert.equal(blocksActorStep(before,pet.location,radius,[actor]),undefined,'accepted sweeps retain both complete bodies');
        assert.notEqual(pet.blockedReason,'actor:hero');
        if(pet.location.surface===target.surface&&distance(pet.location.point,target.point)<1e-6){arrived=true;break;}
      }
      assert.ok(arrived,`level${level} ${id} ${start.surface}→${target.surface} reaches real endpoint while hero stays at ladder landing`);
    }
  }
});

test('all eight deck sizes keep the complete largest pet and hero operation edges clear of every built footprint', () => {
  for (let level = 1; level <= 8; level++) {
    const floors: TruckFloor[] = level >= 7 ? [1, 2, 3] : level >= 4 ? [1, 2] : [1];
    const slots = floors.flatMap(floor => Array.from({ length: Math.min(16, level * 2) }, (_, i) => (floor - 1) * 16 + i));
    const geometry = getPetPassageGeometry(level), radius = radiusFor('boar');
    const pet = createNavigationWorld(level, Math.min(24, level * 3), slots, { radius, floors, actor: 'pet', petPassageOpen: true });
    const hero = createNavigationWorld(level, Math.min(24, level * 3), slots, { floors });
    assert.ok(PET_PASSAGE_WIDTH >= radius * 2 + 10);
    assert.deepEqual(groundLocation(pet, geometry.entry, 1), deck(geometry.entry));
    assert.deepEqual(groundLocation(pet, geometry.ground, 1, 'road'), road(geometry.ground));
    for (const approach of geometry.heroApproaches) {
      assert.equal(groundLocation(hero, approach, 1)?.surface, 'deck');
      assert.ok(distance(approach, geometry.entry) > radius + hero.radius + 2, 'operating hero leaves the largest full pet body room at the ramp entrance');
    }
    for (const [start, target] of [[deck(geometry.entry), road(geometry.ground)], [road(geometry.ground), deck(geometry.entry)]]) {
      const path = planNavigation(pet, start, target); assert.ok(path, `level ${level} gives a clear ramp`);
      assert.deepEqual([...new Set(path.segments.flatMap(segment => segment.link ? [segment.link] : []))], [PET_PASSAGE_LINK_ID]);
      assert.equal(path.climbSegments.length, 0);
      for (let elapsed = 0; elapsed < path.motion.duration; elapsed += .017) {
        const sample = sampleNavigation(path, elapsed); assert.equal(sample.pose, 'walk'); clear(pet, sample.location);
      }
      const arrived = sampleNavigation(path, path.motion.duration).location;
      assert.equal(arrived.surface, target.surface); assert.equal(arrived.floor, target.floor);
      assert.ok(distance(arrived.point, target.point) < 1e-7, 'arrival retains the authored endpoint within floating-point projection precision');
    }
  }
});

test('hero and pet links are distinct, and a closed pet gate denies both direction entries', () => {
  const geometry = getPetPassageGeometry(4), start = deck(geometry.entry), target = road(geometry.ground);
  const hero = createNavigationWorld(4, 3, [], { floors: [1, 2], petPassageOpen: true });
  assert.ok(hero.links.some(link => link.id === 'road-1')); assert.ok(!hero.links.some(link => link.id === PET_PASSAGE_LINK_ID));
  const closed = createNavigationWorld(4, 3, [], { floors: [1, 2], actor: 'pet' });
  assert.ok(!closed.links.some(link => link.lower === 0));
  assert.equal(planNavigation(closed, start, target), undefined); assert.equal(planNavigation(closed, target, start), undefined);
  assert.ok(closed.links.some(link => link.id === '1-2'), 'upper floor pets retain the actual shared stairs');
});

test('a closed-gate lease finishes retained ramp feet while refusing every new deck or ground entrant', () => {
  const radius = radiusFor('boar'), geometry = getPetPassageGeometry(1), link = getPetPassageLink(1);
  const open = createNavigationWorld(1, 3, [], { radius, actor: 'pet', petPassageOpen: true });
  const route = planNavigation(open, deck(geometry.entry), road(geometry.ground)); assert.ok(route);
  const halfway = sampleNavigation(route, route.motion.duration * .5).location; assert.equal(halfway.surface, 'ramp');
  // A later expansion keeps the leased old physical walkway. It does not
  // substitute coordinates from the new truck edge under the moving body.
  const closed = createNavigationWorld(8, 24, [0, 1], { radius, floors: [1, 2, 3], actor: 'pet', petPassageLease: link });
  assert.equal(closed.links.find(l => l.id === PET_PASSAGE_LINK_ID)?.entryAllowed, false);
  for (const target of [road(geometry.ground), deck(geometry.entry)]) {
    const exit = planNavigation(closed, halfway, target); assert.ok(exit);
    assert.deepEqual(sampleNavigation(exit, 0).point, halfway.point);
    assert.deepEqual(sampleNavigation(exit, exit.motion.duration).point, target.point);
    assert.equal(exit.climbSegments.length, 0);
  }
  assert.equal(planNavigation(closed, deck(geometry.entry), road(geometry.ground)), undefined);
  assert.equal(planNavigation(closed, road(geometry.ground), deck(geometry.entry)), undefined);
});

test('closing during a real patrol preserves in-flight motion and lets the pet finish before staying on its actual side', () => {
  for (const id of ['dog', 'cat', 'boar'] as const) {
    const radius = radiusFor(id), scale = id === 'dog' ? .78 : id === 'boar' ? .7 : .73;
    const open = createNavigationWorld(1, 3, [], { radius, actor: 'pet', petPassageOpen: true });
    const hero = defaultHeroLocation(), outdoor = road([600, 820]);
    const pet = createPetPatrol(id, open, hero, [], 0, scale); assert.ok(pet);
    let entered = false;
    for (let frame = 0; frame < 1400; frame++) {
      stepPetPatrol(pet, open, outdoor, [], .05);
      if (pet.location.surface === 'ramp') { entered = true; break; }
    }
    assert.ok(entered, `${id} physically entered its own ramp`);
    const retained = pet.route; assert.ok(retained);
    const closed = createNavigationWorld(1, 3, [], { radius, actor: 'pet', petPassageLease: getPetPassageLink(1) });
    const before = structuredClone(pet.location), elapsed = pet.elapsed;
    stepPetPatrol(pet, closed, outdoor, [], .05);
    assert.equal(pet.route, retained, 'the lease keeps the original motion route object');
    assert.ok(pet.elapsed >= elapsed); assert.ok(distance(before.point, pet.location.point) <= 44 * .05 + 1e-6);
    let finished = false;
    for (let frame = 0; frame < 1600; frame++) {
      const prior = structuredClone(pet.location), oldDistance = pet.distance;
      stepPetPatrol(pet, closed, outdoor, [], .05);
      assert.ok(distance(prior.point, pet.location.point) <= 44 * .05 + 1e-6);
      assert.ok(Math.abs(pet.distance - oldDistance - distance(prior.point, pet.location.point)) < 1e-6);
      if (pet.location.surface === 'road') { finished = true; break; }
    }
    assert.ok(finished, `${id} finishes descent without teleporting`);
    let walkedOnGround = 0;
    for (let frame = 0; frame < 700; frame++) {
      const prior = [...pet.location.point]; stepPetPatrol(pet, closed, hero, [], .05);
      assert.equal(pet.location.surface, 'road', 'closed-gate following never substitutes a deck spawn');
      walkedOnGround += distance(prior, pet.location.point); clear(closed, pet.location);
    }
    assert.ok(walkedOnGround > 50, 'a shut gate leaves natural patrol on the current side available');
  }
});

test('upper-floor followers descend every existing stair and then walk their exclusive ground ramp', () => {
  const radius = radiusFor('boar'), world = createNavigationWorld(7, 3, [0], {
    radius, floors: [1, 2, 3], activeFloor: 3, actor: 'pet', petPassageOpen: true,
  });
  const upstairs = deck(projectDeckPoint([150, 14], 3), 3), outdoor = road([600, 820]);
  const pet = createPetPatrol('boar', world, upstairs, [], 0, .7); assert.ok(pet); assert.equal(pet.location.floor, 3);
  const links = new Set<string>(); let reached = false;
  for (let frame = 0; frame < 3000; frame++) {
    const before = structuredClone(pet.location); stepPetPatrol(pet, world, outdoor, [], .05);
    assert.ok(distance(before.point, pet.location.point) <= 44 * .05 + 1e-6);
    if (pet.location.link) links.add(pet.location.link);
    if (pet.location.surface === 'road') { reached = true; break; }
  }
  assert.ok(reached); assert.deepEqual([...links], ['2-3', '1-2', PET_PASSAGE_LINK_ID]);
  assert.ok(!links.has('road-1'), 'no pet route uses the human ladder');
});

test('an occupied ramp plants the next full pet body before entry rather than letting companions overlap', () => {
  const radius = radiusFor('dog'), world = createNavigationWorld(1, 3, [], { radius, actor: 'pet', petPassageOpen: true });
  const geometry = getPetPassageGeometry(1), hero = defaultHeroLocation(), outdoor = road([600, 820]);
  const pet = createPetPatrol('dog', world, hero, [], 0, .78); assert.ok(pet);
  const route = planNavigation(world, deck(geometry.entry), road(geometry.ground)); assert.ok(route);
  pet.location = deck(geometry.entry); pet.route = route; pet.elapsed = 0; pet.pauseRemaining = 0; pet.desiredSurface = 'road';
  const occupying = sampleNavigation(route, route.motion.duration * .5).location;
  const before = structuredClone(pet.location), walked = pet.distance;
  stepPetPatrol(pet, world, outdoor, [{ id: 'boar', radius: radiusFor('boar'), location: occupying }], .05);
  assert.equal(pet.blockedReason, 'actor:boar'); assert.deepEqual(pet.location, before);
  assert.equal(pet.distance, walked); assert.equal(pet.speed, 0); assert.equal(pet.passageLease, undefined);
});

test('closing the ground gate cannot strand a follower halfway along an unrelated upper-floor stair', () => {
  const radius = radiusFor('boar'), open = createNavigationWorld(7, 3, [0], {
    radius, floors: [1, 2, 3], activeFloor: 3, actor: 'pet', petPassageOpen: true,
  });
  const upstairs = deck(projectDeckPoint([150, 14], 3), 3), outdoor = road([600, 820]);
  const pet = createPetPatrol('boar', open, upstairs, [], 0, .7); assert.ok(pet);
  let entered = false;
  for (let frame = 0; frame < 1000; frame++) {
    stepPetPatrol(pet, open, outdoor, [], .05);
    const link = open.links.find(link => link.id === pet.location.link);
    if (pet.location.surface === 'ladder' && link && link.points.every(point => distance(point, pet.location.point) > 35)) { entered = true; break; }
  }
  assert.ok(entered); const held = structuredClone(pet.location), closed = createNavigationWorld(7, 3, [0], {
    radius, floors: [1, 2, 3], activeFloor: 3, actor: 'pet', petPassageOpen: false,
  });
  let exited = false;
  for (let frame = 0; frame < 1600; frame++) {
    const before = structuredClone(pet.location); stepPetPatrol(pet, closed, outdoor, [], .05);
    assert.ok(distance(before.point, pet.location.point) <= 44 * .05 + 1e-6);
    assert.notEqual(pet.location.surface, 'ramp');
    if (pet.location.surface === 'deck') { exited = true; break; }
  }
  assert.ok(exited); assert.ok(distance(pet.location.point, held.point) > 1);
  assert.ok((pet.location.floor ?? 1) >= 2, 'the pet leaves onto a physically connected upper floor rather than inventing a ground crossing');
});
