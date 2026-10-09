import test from 'node:test';
import assert from 'node:assert/strict';
import { CLIMB_SPEED, WALK_SPEED, createMotionRoute, sampleMotionRoute, type MotionPoint, type MotionRoute } from '../src/scene-motion.ts';
import { realDuration } from '../src/game-speed.ts';

const p = (u: number, v: number, z = 95): MotionPoint => [480 + u * .91 - v * .67, 420 + u * .34 + v * .47 - z];
const close = (actual: number, expected: number, tolerance = .00001) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} ≠ ${expected}`);
const distance = (a: MotionPoint, b: MotionPoint) => Math.hypot(a[0] - b[0], a[1] - b[1]);

test('walking takes time proportional to distance and slows on the ladder in both directions', () => {
  const route = createMotionRoute([[0, 0], [100, 0], [100, 120], [200, 120]], [1]);
  close(route.travelSeconds, 100 / WALK_SPEED + 120 / CLIMB_SPEED + 100 / WALK_SPEED);
  close(route.duration, route.travelSeconds + realDuration(.18) / 2);
  assert.deepEqual(sampleMotionRoute(route, 0).point, [0, 0]);
  assert.deepEqual(sampleMotionRoute(route, route.duration).point, [200, 120]);
  assert.deepEqual(sampleMotionRoute(route, 0, true).point, [200, 120]);
  assert.deepEqual(sampleMotionRoute(route, route.duration, true).point, [0, 0]);
  const halfway = route.rampSeconds / 2 + 100 / WALK_SPEED + 60 / CLIMB_SPEED;
  close(sampleMotionRoute(route, halfway).point[0], 100);
  close(sampleMotionRoute(route, halfway).point[1], 60);
  assert.equal(sampleMotionRoute(route, halfway).pose, 'climb');
  assert.equal(sampleMotionRoute(route, halfway).climbing, 'down');
  assert.equal(sampleMotionRoute(route, halfway, true).climbing, 'up');
  assert.equal(sampleMotionRoute(route, realDuration(.5)).pose, 'walk');
  assert.equal(sampleMotionRoute(route, route.duration - realDuration(.5)).pose, 'walk');
});

test('responsive field work retains its v17 improvement at twofold pace without changing route, gait, ladder direction or endpoints', () => {
  // Literal v0.16 timing for this fixed path, independent of the new speed helper.
  const original: MotionRoute = {
    segments: [
      { from: [0, 0], to: [100, 0], surface: 'walk', distance: 100, seconds: 1 / 3 },
      { from: [100, 0], to: [100, 120], surface: 'climb', distance: 120, seconds: 2 / 3 },
      { from: [100, 120], to: [200, 120], surface: 'walk', distance: 100, seconds: 1 / 3 },
    ],
    origin: [0, 0], destination: [200, 120], distance: 320,
    travelSeconds: 4 / 3, rampSeconds: .06, duration: 4.18 / 3,
  };
  const faster = createMotionRoute([[0, 0], [100, 0], [100, 120], [200, 120]], [1]);
  assert.equal(WALK_SPEED, 400); assert.equal(CLIMB_SPEED, 240);
  // The historical fixture ran at 3x; current 2x with the retained 2x field
  // improvement runs at 4x, so its path takes 3/4 of that historical time.
  close(faster.duration, original.duration * .75);
  close(faster.rampSeconds, .045);
  for (const returning of [false, true]) for (let elapsed = 0; elapsed <= original.duration; elapsed += .025) {
    const before = sampleMotionRoute(original, elapsed, returning), after = sampleMotionRoute(faster, elapsed * .75, returning);
    close(after.point[0], before.point[0]); close(after.point[1], before.point[1]);
    close(after.distance, before.distance); close(after.progress, before.progress);
    assert.equal(after.pose, before.pose); assert.equal(after.facing, before.facing); assert.equal(after.climbing, before.climbing);
  }
});

test('motion does not cut across corners, jump at waypoints, or exceed its surface speed', () => {
  const route = createMotionRoute([[0, 0], [150, 0], [150, 240], [350, 240]], [1]);
  for (const returning of [false, true]) {
    let previous = sampleMotionRoute(route, 0, returning);
    for (let elapsed = .01; elapsed <= route.duration; elapsed += .01) {
      const current = sampleMotionRoute(route, elapsed, returning), [x, y] = current.point;
      assert.ok(y === 0 || x === 150 || y === 240, 'feet remain on the polyline');
      assert.ok(distance(current.point, previous.point) <= WALK_SPEED * .01 + .00001, 'no waypoint jump');
      assert.ok(current.distance >= previous.distance, 'gait progresses with traveled distance');
      if (current.pose === 'climb' && previous.pose === 'climb') assert.ok(distance(current.point, previous.point) <= CLIMB_SPEED * .01 + .00001);
      previous = current;
    }
  }
  const departure = distance(sampleMotionRoute(route, 0).point, sampleMotionRoute(route, realDuration(.01)).point);
  const cruising = distance(sampleMotionRoute(route, realDuration(1)).point, sampleMotionRoute(route, realDuration(1.01)).point);
  const arrival = distance(sampleMotionRoute(route, route.duration - realDuration(.01)).point, sampleMotionRoute(route, route.duration).point);
  assert.ok(departure < cruising * .1 && arrival < cruising * .1, 'departure and arrival ease without sliding at rest');
});

test('actual truck paths provide readable road work and comfortable single-plot farming', () => {
  const home = p(-74, 14), gatherTotals: number[] = [];
  const deckFronts = [141, 216, 216, 249, 296, 321, 361, 401];
  for (let deck = 1; deck <= 8; deck++) {
    const front = deckFronts[deck - 1];
    const road = createMotionRoute([home, p(-168, 16), p(-176, front - 13), p(-225, front - 3), [140, 527], [181, 549], [211, 578]], [3]);
    const total = road.duration * 2 + realDuration(2.4);
    gatherTotals.push(total);
    assert.ok(total >= 3.75 && total <= 6.15, `deck ${deck} road gathering lasts ${total}s`);
    const ladder = road.segments.find(segment => segment.surface === 'climb')!;
    assert.ok(ladder.seconds >= .36, 'both climbing directions preserve separate steps at the twofold pace');
  }
  assert.ok(gatherTotals[5] > gatherTotals[0], 'a larger deck no longer speeds up the survivor');
  for (const [u, v] of [[-116, 42], [-33, 42], [50, 42], [133, 42], [-116, 122], [-33, 122], [50, 122], [133, 122]]) {
    const farm = createMotionRoute([home, p(u - 9, 12), p(u - 9, v + 39)]);
    const total = farm.duration * 2 + realDuration(1.65);
    assert.ok(total >= 1.275 && total <= 2.55, `plot ${u}/${v} lasts ${total}s`);
    const previous = farm.duration * 4 + realDuration(2.2);
    assert.ok(total < previous * .75, 'the retained field-work improvement saves at least 25% against the pre-v17 routine at the same shared pace');
  }
});

test('duplicate points and delayed frames keep bounded positions and exact endpoints', () => {
  const points: [number, number][] = [[5, 10], [5, 10], [105, 10], [105, 10]];
  const route = createMotionRoute(points);
  points[0][0] = 999;
  assert.deepEqual(sampleMotionRoute(route, -.5).point, [5, 10], 'source path cannot mutate a live route');
  assert.deepEqual(sampleMotionRoute(route, 350).point, [105, 10], 'a late frame finishes at the endpoint');
  assert.deepEqual(sampleMotionRoute(route, 350, true).point, [5, 10]);
  const stationary = createMotionRoute([[2, 3], [2, 3]]);
  assert.equal(stationary.duration, 0);
  assert.deepEqual(sampleMotionRoute(stationary, 10).point, [2, 3]);
  assert.throws(() => createMotionRoute([]));
  assert.throws(() => createMotionRoute([[0, Number.NaN]]));
});
