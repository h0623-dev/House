/** One display palette for the ground painting and its interactive props.
 * The original PNGs remain untouched; their alpha and measured silhouettes
 * also remain the source of touch and collision geometry. */
export interface GroundPalette {
  readonly saturation: number;
  readonly contrast: number;
  readonly midpoint: number;
  readonly tint: readonly [number, number, number];
}

export const GROUND_ART_PALETTE = {
  // Lift the shared midtones instead of washing out the painting with a pale
  // screen overlay. Warm greens and earth retain their painted separation.
  landscape: { saturation: .88, contrast: .91, midpoint: 140, tint: [3, 4, 0] },
  props: { saturation: .74, contrast: .89, midpoint: 138, tint: [4, 5, 1] },
} as const satisfies Record<string, GroundPalette>;

export const GROUND_SOIL_TEXTURE_SIZE = 256;
export const GROUND_SOIL_TEXTURE_WORLD_SCALE = 4;
export const GROUND_SOIL_BASE = '#bec19e';
/** Source pixels; a short soft edge merges the single authored painting into
 * the quiet terrain beyond it, without reflecting roads or stream banks. */
export const GROUND_LANDSCAPE_EDGE_FADE = 90;

/** A small, deterministic, nearly flat moss/soil texture has no roads, trees
 * or other recognisable features which could repeat beyond the playable map.
 * Its periodic broad colour field and tiny grain remain deliberately subtle. */
export function createGroundSoilPixels(): Uint8ClampedArray {
  const size = GROUND_SOIL_TEXTURE_SIZE, pixels = new Uint8ClampedArray(size * size * 4);
  let seed = 0x7f4a31c9;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const phaseX = x / size * Math.PI * 2, phaseY = y / size * Math.PI * 2,
      field = Math.sin(phaseX) * Math.cos(phaseY) * 1.5 + Math.sin(phaseX + phaseY) * .7,
      grain = ((seed >>> 24) / 255 - .5) * 3, light = field + grain,
      offset = (y * size + x) * 4;
    pixels[offset] = Math.round(190 + light);
    pixels[offset + 1] = Math.round(193 + light);
    pixels[offset + 2] = Math.round(158 + light);
    pixels[offset + 3] = 255;
  }
  return pixels;
}

/** Baked once into a same-origin display canvas, rather than using a filter
 * or reading pixels on every frame. Transparent edge pixels keep their alpha. */
export function harmonizeGroundPixels(pixels: Uint8ClampedArray, palette: GroundPalette): void {
  for (let offset = 0; offset < pixels.length; offset += 4) {
    if (pixels[offset + 3] === 0) continue;
    const red = pixels[offset], green = pixels[offset + 1], blue = pixels[offset + 2],
      light = red * .2126 + green * .7152 + blue * .0722,
      base = (light - 128) * palette.contrast + palette.midpoint;
    pixels[offset] = Math.round(base + (red - light) * palette.saturation + palette.tint[0]);
    pixels[offset + 1] = Math.round(base + (green - light) * palette.saturation + palette.tint[1]);
    pixels[offset + 2] = Math.round(base + (blue - light) * palette.saturation + palette.tint[2]);
  }
}
