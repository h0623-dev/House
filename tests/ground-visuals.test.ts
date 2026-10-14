import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GROUND_RESOURCE_APPROACH_RADIUS, GROUND_RESOURCE_NODES, GROUND_RESOURCE_ZONES } from '../src/ground-resources';
import { GROUND_BACKGROUND_BOUNDS, GROUND_BACKGROUND_TILES, GROUND_LANDSCAPE_BOUNDS, GROUND_LANDSCAPE_SOURCE_SIZE, GROUND_PROPS_SOURCE_SIZE, GROUND_SPRITE_FRAMES,
  getGroundResourceVisual, getGroundSpriteBounds, getGroundSpriteFrame, getGroundTreeVariant,
  getGroundVisualBounds, getGroundVisualPolygon, getGroundBackgroundViewport, getGroundVisibleBackgroundTiles } from '../src/ground-visuals';
import { getRoadBounds } from '../src/scene-navigation';
import { getTruckGroundFootprint } from '../src/truck-ground';

const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-9);
const inPolygon = (point: readonly number[], polygon: readonly (readonly number[])[]) => {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const [x, y] = polygon[index], [px, py] = polygon[previous];
    if ((y > point[1]) !== (py > point[1]) && point[0] < (px - x) * (point[1] - y) / (py - y) + x) inside = !inside;
  }
  return inside;
};
const insideLandscape = (x: number, y: number, radius = 0) => {
  assert.ok(x - radius >= GROUND_LANDSCAPE_BOUNDS.left && x + radius <= GROUND_LANDSCAPE_BOUNDS.right,
    `the continuous painting covers horizontal world position ${x} and radius ${radius}`);
  assert.ok(y - radius >= GROUND_LANDSCAPE_BOUNDS.top && y + radius <= GROUND_LANDSCAPE_BOUNDS.bottom,
    `the continuous painting covers vertical world position ${y} and radius ${radius}`);
};

test('ground frame measurements match the untouched PNGs and contain complete contact positions', () => {
  for (const [name, dimensions] of [['ground-props.png', GROUND_PROPS_SOURCE_SIZE],
    ['ground-landscape.png', GROUND_LANDSCAPE_SOURCE_SIZE]] as const) {
    const png = readFileSync(new URL(`../src/assets/${name}`, import.meta.url));
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    assert.equal(png.subarray(12, 16).toString(), 'IHDR');
    assert.equal(png.readUInt32BE(16), dimensions.width, `${name} width still agrees with the measured source`);
    assert.equal(png.readUInt32BE(20), dimensions.height, `${name} height still agrees with the measured source`);
  }
  for (const [name, frame] of Object.entries(GROUND_SPRITE_FRAMES)) {
    assert.ok(frame.width > 0 && frame.height > 0);
    assert.ok(frame.x >= 0 && frame.x + frame.width <= GROUND_PROPS_SOURCE_SIZE.width, `${name} crop stays inside the original atlas`);
    assert.ok(frame.y >= 0 && frame.y + frame.height <= GROUND_PROPS_SOURCE_SIZE.height);
    assert.ok(inPolygon(frame.anchor, frame.contour), `${name} uses a contact within its own painted prop`);
    for (const [x, y] of frame.contour) {
      assert.ok(x >= frame.x && x <= frame.x + frame.width);
      assert.ok(y >= frame.y && y <= frame.y + frame.height);
    }
  }
});

test('the spreading crown survives source cell crossings while neighbouring stump and birch are excluded', () => {
  const crown = GROUND_SPRITE_FRAMES.spread;
  assert.ok(Math.min(...crown.contour.map(point => point[0])) < 806, 'the crown retains its originally painted left branches');
  assert.ok(Math.max(...crown.contour.map(point => point[0])) > 1230, 'the crown retains its originally painted right branches');
  assert.equal(inPolygon([1270, 580], crown.contour), false, 'the adjacent stump root cannot leak into a tree crop');
  assert.equal(inPolygon([760, 349], crown.contour), false, 'the adjoining birch leaves cannot leak into the spreading tree');
  assert.equal(inPolygon([794, 229], GROUND_SPRITE_FRAMES.birch.contour), false,
    'the narrow birch never includes the spreading tree branch from the neighbouring cell');
});

test('all resource sprites retain their actual foot contact when scaled or translated', () => {
  for (const node of GROUND_RESOURCE_NODES) {
    const art = getGroundResourceVisual(node), frame = getGroundSpriteFrame(art.sprite, art.variant),
      [left, top, right, bottom] = getGroundVisualBounds(node);
    close(left + (frame.anchor[0] - frame.x) * (right - left) / frame.width, node.point[0]);
    close(top + (frame.anchor[1] - frame.y) * (bottom - top) / frame.height, node.point[1]);
    const translated = getGroundSpriteBounds(art.sprite, node.point[0] + 731, node.point[1] - 408,
      art.width * 2, art.height * 2, art.variant);
    close(translated[0] - (node.point[0] + 731), (left - node.point[0]) * 2);
    close(translated[1] - (node.point[1] - 408), (top - node.point[1]) * 2);
    close(translated[2] - (node.point[0] + 731), (right - node.point[0]) * 2);
    close(translated[3] - (node.point[1] - 408), (bottom - node.point[1]) * 2);
    assert.ok(bottom > node.point[1], 'the contact position does not incorrectly pin foliage and roots to the crop bottom');
    const polygon = getGroundVisualPolygon(node);
    assert.ok(inPolygon(node.point, polygon), `${node.id}'s visible art remains attached to its physical resource location`);
    for (const [x, y] of polygon) assert.ok(x >= left && x <= right && y >= top && y <= bottom);
  }
});

test('three deterministic tree silhouettes coexist without changing collision footprints or catalog state', () => {
  const before = JSON.stringify(GROUND_RESOURCE_NODES), trees = GROUND_RESOURCE_NODES.filter(node => node.kind === 'tree');
  assert.deepEqual([...new Set(trees.map(node => getGroundTreeVariant(node.id)))].sort(), [0, 1, 2]);
  for (const node of trees) {
    assert.deepEqual(getGroundResourceVisual(node), getGroundResourceVisual(JSON.parse(JSON.stringify(node))));
    const bounds = getGroundVisualBounds(node);
    assert.ok(bounds[1] < node.bounds.top - 80 * node.scale, 'a tall painted crown does not become a tall physical wall');
    assert.ok(bounds[2] - bounds[0] > node.bounds.right - node.bounds.left, 'canopy hit geometry remains distinct from the small solid trunk');
  }
  assert.equal(JSON.stringify(GROUND_RESOURCE_NODES), before, 'rendering geometry cannot mutate physical nodes or approaches');
});

test('the full world painting covers every truck, resource silhouette and complete work-stop circle', () => {
  for (let level = 1; level <= 8; level++) {
    for (const [x, y] of getTruckGroundFootprint(level).polygon) insideLandscape(x, y);
    const road = getRoadBounds(level);
    insideLandscape(road.left, road.top); insideLandscape(road.right, road.bottom);
  }
  for (const node of GROUND_RESOURCE_NODES) {
    const bounds = getGroundVisualBounds(node);
    insideLandscape(bounds[0], bounds[1]); insideLandscape(bounds[2], bounds[3]);
    for (const [x, y] of node.approaches) insideLandscape(x, y, GROUND_RESOURCE_APPROACH_RADIUS);
  }
  for (const zone of GROUND_RESOURCE_ZONES) {
    insideLandscape(zone.bounds.left, zone.bounds.top); insideLandscape(zone.bounds.right, zone.bounds.bottom);
    for (const [x, y] of zone.path) insideLandscape(x, y, zone.pathWidth / 2);
  }
});

test('cut trees use compact anchored stumps and pools preserve the painted ground-plane proportions', () => {
  for (const node of GROUND_RESOURCE_NODES) {
    const art = getGroundResourceVisual(node);
    if (node.kind === 'tree') {
      const stump = getGroundResourceVisual(node, 'stump'), bounds = getGroundVisualBounds(node, 'stump');
      assert.equal(stump.sprite, 'stump');
      assert.ok(stump.height < art.height / 3 && stump.width < art.width / 2);
      assert.ok(inPolygon(node.point, getGroundVisualPolygon(node, 'stump')));
      assert.ok(bounds[1] < node.point[1] && bounds[3] > node.point[1]);
    } else if (node.kind === 'water') {
      const source = GROUND_SPRITE_FRAMES.water;
      close(art.height / art.width, source.height / source.width);
      assert.ok(art.width > art.height, 'the pool remains an oblique ground surface rather than a tall flat icon');
    }
  }
});

test('fixed reflected neighbours cover wide and tall phone overviews with matching source edges and no tile gaps', () => {
  const width = GROUND_LANDSCAPE_BOUNDS.right - GROUND_LANDSCAPE_BOUNDS.left,
    height = GROUND_LANDSCAPE_BOUNDS.bottom - GROUND_LANDSCAPE_BOUNDS.top;
  assert.equal(GROUND_BACKGROUND_TILES.length, 325);
  assert.equal(new Set(GROUND_BACKGROUND_TILES.map(tile => `${tile.column},${tile.row}`)).size, 325);
  const core = GROUND_BACKGROUND_TILES.find(tile => tile.column === 0 && tile.row === 0)!;
  assert.deepEqual(core.bounds, GROUND_LANDSCAPE_BOUNDS);
  assert.equal(core.mirrorX, false); assert.equal(core.mirrorY, false);
  assert.equal(GROUND_BACKGROUND_BOUNDS.left, Math.min(...GROUND_BACKGROUND_TILES.map(tile => tile.bounds.left)));
  assert.equal(GROUND_BACKGROUND_BOUNDS.top, Math.min(...GROUND_BACKGROUND_TILES.map(tile => tile.bounds.top)));
  assert.equal(GROUND_BACKGROUND_BOUNDS.right, Math.max(...GROUND_BACKGROUND_TILES.map(tile => tile.bounds.right)));
  assert.equal(GROUND_BACKGROUND_BOUNDS.bottom, Math.max(...GROUND_BACKGROUND_TILES.map(tile => tile.bounds.bottom)));
  assert.equal(GROUND_BACKGROUND_BOUNDS.right - GROUND_BACKGROUND_BOUNDS.left, width * 25);
  assert.equal(GROUND_BACKGROUND_BOUNDS.bottom - GROUND_BACKGROUND_BOUNDS.top, height * 13);
  assert.ok(GROUND_BACKGROUND_BOUNDS.left < -8698 && GROUND_BACKGROUND_BOUNDS.right > 10102
    && GROUND_BACKGROUND_BOUNDS.top < -1863 && GROUND_BACKGROUND_BOUNDS.bottom > 3795,
    'the actual paid wide-phone overview remains entirely on painted background');
  for (const tile of GROUND_BACKGROUND_TILES) {
    assert.equal(tile.bounds.right - tile.bounds.left, width);
    assert.equal(tile.bounds.bottom - tile.bounds.top, height);
    const right = GROUND_BACKGROUND_TILES.find(other => other.column === tile.column + 1 && other.row === tile.row),
      below = GROUND_BACKGROUND_TILES.find(other => other.row === tile.row + 1 && other.column === tile.column);
    if (right) {
      assert.equal(tile.bounds.right, right.bounds.left, 'horizontal neighbours have no gap');
      assert.equal(tile.mirrorX ? 0 : GROUND_LANDSCAPE_SOURCE_SIZE.width,
        right.mirrorX ? GROUND_LANDSCAPE_SOURCE_SIZE.width : 0,
        'touching horizontal edges show the same original source pixels');
    }
    if (below) {
      assert.equal(tile.bounds.bottom, below.bounds.top, 'vertical neighbours have no gap');
      assert.equal(tile.mirrorY ? 0 : GROUND_LANDSCAPE_SOURCE_SIZE.height,
        below.mirrorY ? GROUND_LANDSCAPE_SOURCE_SIZE.height : 0,
        'touching vertical edges show the same original source pixels');
    }
  }
});

test('background culling inverts backing-canvas scale, translation and rotation without changing tile geometry', () => {
  assert.deepEqual(getGroundBackgroundViewport({ a: 2, b: 0, c: 0, d: 2, e: 100, f: 200 }, 1000, 600),
    { left: -50, top: -100, right: 450, bottom: 200 });
  assert.deepEqual(getGroundBackgroundViewport({ a: 0, b: 2, c: -2, d: 0, e: 500, f: 200 }, 1000, 600),
    { left: -100, top: -250, right: 200, bottom: 250 });
  assert.equal(getGroundBackgroundViewport({ a: 0, b: 0, c: 0, d: 0, e: 0, f: 0 }, 1000, 600), undefined);
  const before = JSON.stringify(GROUND_BACKGROUND_TILES), actualWide = { left: -8698, top: -1863, right: 10102, bottom: 3795 },
    visible = getGroundVisibleBackgroundTiles(actualWide);
  assert.ok(visible.length > 9 && visible.length < 40, 'a wide overview draws visible tiles instead of all 325 background tiles');
  for (const point of [[actualWide.left, actualWide.top], [actualWide.right, actualWide.top],
    [actualWide.right, actualWide.bottom], [actualWide.left, actualWide.bottom], [0, 0]])
    assert.ok(visible.some(tile => point[0] >= tile.bounds.left && point[0] <= tile.bounds.right
      && point[1] >= tile.bounds.top && point[1] <= tile.bounds.bottom), 'culling keeps every visible world corner covered');
  const focused = getGroundVisibleBackgroundTiles({ left: 600, top: 900, right: 1200, bottom: 1300 });
  assert.equal(focused.length, 1, 'a close resource view draws only the core tile');
  assert.equal(focused[0], GROUND_BACKGROUND_TILES.find(tile => tile.column === 0 && tile.row === 0));
  assert.equal(JSON.stringify(GROUND_BACKGROUND_TILES), before, 'different camera viewports cannot resize or reposition tiles');
});

test('depleted seed and scrap remnants have accurate compact art bounds while pools retain their own shape', () => {
  for (const node of GROUND_RESOURCE_NODES.filter(node => node.kind !== 'tree')) {
    const ready = getGroundResourceVisual(node), depleted = getGroundResourceVisual(node, 'depleted'),
      bounds = getGroundVisualBounds(node, 'depleted');
    if (node.kind === 'water') assert.deepEqual(depleted, ready, 'an empty pool remains anchored to its painted rock-lined shape');
    else {
      assert.equal(depleted.sprite, 'underbrush');
      close(depleted.width, 34 * node.scale); close(depleted.height, 22 * node.scale);
      close(bounds[2] - bounds[0], depleted.width); close(bounds[3] - bounds[1], depleted.height);
      assert.ok(depleted.width < ready.width / 2 && depleted.height < ready.height / 2);
      assert.ok(inPolygon(node.point, getGroundVisualPolygon(node, 'depleted')),
        'the smaller painted remnant stays on the original solid resource location');
    }
  }
});
