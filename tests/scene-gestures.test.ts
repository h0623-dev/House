import test from 'node:test';
import assert from 'node:assert/strict';
import { anchoredCameraChange, clampMapZoom, MapPinchGesture } from '../src/scene-gestures.ts';

test('pinch consumes both releases and does not turn its last finger into a map tap', () => {
  const gesture = new MapPinchGesture();
  assert.equal(gesture.down(1, { x: 100, y: 200 }), false);
  assert.equal(gesture.down(2, { x: 200, y: 200 }), true);
  const movement = gesture.move(2, { x: 300, y: 200 });
  assert.deepEqual(movement, { consumed: true, change: { from: { x: 150, y: 200 }, to: { x: 200, y: 200 }, ratio: 2 } });
  assert.equal(gesture.up(1), true);
  assert.deepEqual(gesture.move(2, { x: 310, y: 210 }), { consumed: true, change: null });
  assert.equal(gesture.up(2), true);
  assert.equal(gesture.active, false);
  assert.equal(gesture.down(3, { x: 10, y: 20 }), false);
  assert.equal(gesture.up(3), false);
});

test('third fingers, cancellation and fresh touches do not reuse a stale pinch baseline', () => {
  const gesture = new MapPinchGesture();
  gesture.down(1, { x: 0, y: 0 }); gesture.down(2, { x: 100, y: 0 }); gesture.down(3, { x: 200, y: 0 });
  assert.equal(gesture.up(1), true);
  assert.equal(gesture.move(3, { x: 300, y: 0 }).change?.ratio, 2);
  gesture.reset();
  assert.equal(gesture.active, false); assert.deepEqual(gesture.pointerIds, []);
  assert.equal(gesture.down(4, { x: 50, y: 50 }), false);
  gesture.down(5, { x: 50, y: 50 });
  assert.ok(Number.isFinite(gesture.move(5, { x: 51, y: 50 }).change!.ratio));
});

test('clamped zoom preserves the world anchor under a moving pinch midpoint', () => {
  for (const nextZoom of [.1, .75, 1, 1.6, 2.5, 9]) {
    const camera = { x: 400, y: 300 }, scale = .6, center = { x: 195, y: 310 };
    const origin = { x: center.x - camera.x * scale, y: center.y - camera.y * scale };
    const from = { x: 260, y: 370 }, to = { x: 250, y: 340 };
    const result = anchoredCameraChange({ camera, scale, zoom: 1, nextZoom, origin, center, from, to });
    const world = { x: (from.x - origin.x) / scale, y: (from.y - origin.y) / scale };
    assert.ok(Math.abs(center.x + (world.x - camera.x - result.delta.x) * scale * result.ratio - to.x) < 1e-9);
    assert.ok(Math.abs(center.y + (world.y - camera.y - result.delta.y) * scale * result.ratio - to.y) < 1e-9);
    assert.equal(result.zoom, clampMapZoom(nextZoom));
  }
  assert.equal(clampMapZoom(NaN), 1); assert.equal(clampMapZoom(Infinity), 1);
});
