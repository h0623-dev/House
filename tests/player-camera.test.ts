import test from 'node:test';
import assert from 'node:assert/strict';
import { framePlayerCamera, keepPlayerVisible } from '../src/player-camera.ts';
import { createNavigationWorld, defaultHeroLocation, getRoadBounds, planNavigation, projectDeckPoint, sampleNavigation } from '../src/scene-navigation.ts';

const usableViewports = [[344, 390], [360, 440], [390, 470], [844, 160]] as const;

test('the real deck-to-road route retains one close resident scale through ladder travel and arrival', () => {
  const world = createNavigationWorld(1, 3, []);
  const route = planNavigation(world, defaultHeroLocation(), { surface: 'road', point: [490, 620] });
  assert.ok(route);
  assert.ok(route.climbSegments.length, 'the fixture uses the physical ladder rather than a ground-only path');
  const surfaces = new Set<string>();
  for (const [width, height] of usableViewports) {
    const start = framePlayerCamera(route.start.point, width, height);
    for (let step = 0; step <= 100; step++) {
      const sample = sampleNavigation(route, route.motion.duration * step / 100);
      surfaces.add(sample.location.surface);
      const frame = framePlayerCamera(sample.location.point, width, height);
      const scale = Math.min(width / frame.width, height / frame.height) * frame.zoom;
      assert.ok(Math.abs(scale - start.scale) < 1e-12, 'movement phases never fit the yard or alter actor size');
      assert.ok(scale >= .8, 'short landscape keeps a readable protagonist');
      const screenX = width / 2 + (sample.location.point[0] - frame.x) * scale;
      const screenFoot = height / 2 + (sample.location.point[1] - frame.y) * scale;
      const screenHead = screenFoot - 128 * .64 * scale;
      assert.equal(screenX, width / 2);
      assert.ok(screenHead >= 8 && screenFoot <= height - 8, 'the complete original hero fits the usable map');
    }
  }
  assert.ok(surfaces.has('deck') && surfaces.has('ladder') && surfaces.has('road'));
});

test('expanding the road and walking to opposite edges changes camera position rather than magnification', () => {
  for (const [width, height] of usableViewports) {
    const initial = framePlayerCamera(defaultHeroLocation().point, width, height);
    for (const level of [1, 4, 8]) {
      const road = getRoadBounds(level);
      for (const point of [[road.left + 20, road.top + 20], [road.right - 20, road.bottom - 20]] as const) {
        const frame = framePlayerCamera(point, width, height);
        assert.equal(frame.scale, initial.scale);
        assert.equal(frame.width, initial.width);
        assert.equal(frame.height, initial.height);
        assert.ok(Math.abs((point[0] - frame.x) * frame.scale) < 1e-12, 'the hero keeps the centre even on a much larger map');
      }
    }
  }
});

test('the user magnification keeps its exact multiplier on every physical surface and storey', () => {
  const points = [defaultHeroLocation().point, [140, 479], [490, 620], projectDeckPoint([-74, 14], 2), projectDeckPoint([-74, 14], 3)] as const;
  for (const [width, height] of usableViewports) {
    for (const zoom of [.75, 1, 1.75, 2.5]) {
      const first = framePlayerCamera(points[0], width, height);
      for (const point of points) {
        const frame = framePlayerCamera(point, width, height);
        assert.ok(Math.abs(Math.min(width / frame.width, height / frame.height) * zoom - first.scale * zoom) < 1e-12);
      }
    }
  }
});

test('normal follow smoothing on the actual human-ladder return cannot clip a fitting hero in short landscape', () => {
  const world = createNavigationWorld(1, 3, []);
  const route = planNavigation(world, { surface: 'road', point: [...world.ladder.bottom] },
    { surface: 'deck', floor: 1, point: [...world.ladder.entry] });
  assert.ok(route);
  assert.ok(route.climbSegments.length);
  const width = 844, height = 112, frame = framePlayerCamera(route.start.point, width, height), scale = frame.scale * 1.25;
  let camera = { x: frame.x, y: frame.y }, priorUnconfined = { ...camera }, previouslyClipped = 0;
  const before = structuredClone(route);
  for (let elapsed = 0; elapsed <= route.motion.duration + 1 / 30; elapsed += 1 / 30) {
    const feet = sampleNavigation(route, Math.min(elapsed, route.motion.duration)).location.point;
    const target = framePlayerCamera(feet, width, height);
    priorUnconfined = { x: priorUnconfined.x + (target.x - priorUnconfined.x) * .32,
      y: priorUnconfined.y + (target.y - priorUnconfined.y) * .32 };
    if (height / 2 + (feet[1] - 81.92 - priorUnconfined.y) * scale < 8) previouslyClipped++;
    const smoothed = { x: camera.x + (target.x - camera.x) * .32, y: camera.y + (target.y - camera.y) * .32 };
    const unchanged = { ...smoothed };
    camera = keepPlayerVisible(smoothed, feet, width, height, scale);
    assert.deepEqual(smoothed, unchanged, 'camera correction never changes the caller input');
    const head = height / 2 + (feet[1] - 81.92 - camera.y) * scale;
    const sole = height / 2 + (feet[1] - camera.y) * scale;
    assert.ok(head >= 8 - 1e-9 && sole <= height - 4 + 1e-9, 'every real upward ladder frame keeps the complete body visible');
    assert.equal(scale, frame.scale * 1.25, 'chosen125% magnification is retained');
  }
  assert.ok(previouslyClipped > 0, 'this actual route and normal smoothing reproduce the observed regression');
  assert.deepEqual(route, before, 'camera adjustment cannot move feet, alter physics, or rewrite the route');
});

test('an explicit zoom too large for short landscape stays unchanged and crops around the hero body centre', () => {
  const feet = [140, 527] as const, scale = .8 * 2.5, width = 844, height = 112;
  const corrected = keepPlayerVisible({ x: -5000, y: 9000 }, feet, width, height, scale);
  const head = height / 2 + (feet[1] - 81.92 - corrected.y) * scale;
  const sole = height / 2 + (feet[1] - corrected.y) * scale;
  assert.ok(head < 8 && sole > height - 4, 'the helper does not claim an oversized zoom can fit the full original body');
  assert.ok(Math.abs((head + sole) / 2 - (height + 4) / 2) < 1e-9, 'both ends crop around the visible body centre');
  assert.ok(width / 2 + (feet[0] - corrected.x) * scale <= width - 24 + 1e-9, 'feet stay within the horizontal map');
  assert.equal(scale, 2, 'no automatic zoom reduction is introduced');
});

test('follow correction leaves a comfortably visible camera exactly unchanged', () => {
  const camera = { x: 403.28, y: 270.42 }, feet = [403.28, 306.42] as const;
  assert.deepEqual(keepPlayerVisible(camera, feet, 390, 538, 1.0833333333333333), camera);
});
