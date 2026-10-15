import test from 'node:test';
import assert from 'node:assert/strict';
import { GROUND_ART_PALETTE, GROUND_SOIL_TEXTURE_SIZE, createGroundSoilPixels, harmonizeGroundPixels } from '../src/ground-palette';
import { getGroundContactShadow } from '../src/ground-visuals';

test('ground display grading preserves every source alpha, including soft foliage edges', () => {
  const input = new Uint8ClampedArray([83, 64, 19, 0, 210, 230, 35, 1, 185, 210, 42, 128, 46, 72, 38, 255]);
  for (const palette of Object.values(GROUND_ART_PALETTE)) {
    const pixels = input.slice();
    harmonizeGroundPixels(pixels, palette);
    assert.deepEqual([...pixels.filter((_, index) => index % 4 === 3)], [0, 1, 128, 255]);
    assert.deepEqual([...pixels.slice(0, 4)], [...input.slice(0, 4)], 'fully transparent atlas gaps stay untouched');
    assert.notDeepEqual([...pixels.slice(4, 7)], [...input.slice(4, 7)]);
  }
});

test('the prop palette lowers acid-yellow chroma and lifts dark material without clipping detail', () => {
  const pixels = new Uint8ClampedArray([210, 230, 35, 255, 20, 31, 11, 255, 90, 100, 70, 255, 190, 200, 170, 255]);
  harmonizeGroundPixels(pixels, GROUND_ART_PALETTE.props);
  assert.ok(pixels[1] - pixels[2] < (230 - 35) * .72, 'leaves move toward the same subdued sage palette as the terrain');
  assert.ok(pixels[4] > 20 && pixels[6] > 11, 'deep bark/rock shadows remain readable against the ground');
  assert.ok(pixels[12] > pixels[8] && pixels[13] > pixels[9] && pixels[14] > pixels[10], 'material light/shadow ordering survives grading');
  for (const value of pixels) assert.ok(value >= 0 && value <= 255);
});

test('contact shadows stay small, ground-aligned and proportional at every resource scale', () => {
  for (const sprite of ['tree', 'stump', 'scrap', 'seed', 'water', 'underbrush'] as const) {
    const shadow = getGroundContactShadow(sprite, 100, sprite === 'tree' ? 150 : 70),
      doubled = getGroundContactShadow(sprite, 200, sprite === 'tree' ? 300 : 140);
    assert.ok(shadow.radiusY < shadow.radiusX / 2, `${sprite} has a ground-plane contact rather than an upright halo`);
    assert.ok(shadow.radiusX < 50 && shadow.radiusY < 15);
    assert.equal(doubled.radiusX, shadow.radiusX * 2); assert.equal(doubled.radiusY, shadow.radiusY * 2);
    assert.equal(doubled.offsetX, shadow.offsetX * 2); assert.equal(doubled.offsetY, shadow.offsetY * 2);
    assert.equal(doubled.opacity, shadow.opacity);
  }
});

test('the outer terrain is deterministic quiet moss and soil with full opacity and no high-contrast repeated features', () => {
  const pixels = createGroundSoilPixels();
  assert.deepEqual(pixels, createGroundSoilPixels());
  assert.equal(pixels.length, GROUND_SOIL_TEXTURE_SIZE * GROUND_SOIL_TEXTURE_SIZE * 4);
  const minimum = [255, 255, 255], maximum = [0, 0, 0];
  for (let offset = 0; offset < pixels.length; offset += 4) {
    assert.equal(pixels[offset + 3], 255, 'outside coverage is fully opaque');
    for (let channel = 0; channel < 3; channel++) {
      minimum[channel] = Math.min(minimum[channel], pixels[offset + channel]);
      maximum[channel] = Math.max(maximum[channel], pixels[offset + channel]);
    }
    assert.ok(pixels[offset + 1] > pixels[offset] && pixels[offset] > pixels[offset + 2], 'the entire quiet border shares one moss/earth hue');
  }
  for (let channel = 0; channel < 3; channel++) assert.ok(maximum[channel] - minimum[channel] <= 8, 'terrain grain cannot become another high-contrast foliage pattern');
});
