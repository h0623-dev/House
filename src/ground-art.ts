import landscapeUrl from './assets/haven-ground-landscape.png';
import propsUrl from './assets/haven-ground-props.png';
import { GROUND_BACKGROUND_BOUNDS, GROUND_LANDSCAPE_BOUNDS, getGroundBackgroundViewport,
  getGroundContactShadow, type GroundSprite } from './ground-visuals';
import { GROUND_ART_PALETTE, GROUND_LANDSCAPE_EDGE_FADE, GROUND_SOIL_BASE, GROUND_SOIL_TEXTURE_SIZE,
  GROUND_SOIL_TEXTURE_WORLD_SCALE, createGroundSoilPixels, harmonizeGroundPixels, type GroundPalette } from './ground-palette';
import { paintGatheringGround } from './ground-material';

export const groundArtUrls = { landscape: landscapeUrl, props: propsUrl } as const;
let landscapeImage: HTMLImageElement | undefined;
let propsImage: HTMLImageElement | undefined;
const displayPaintings = new WeakMap<HTMLImageElement, HTMLCanvasElement>();
let soilTexture: HTMLCanvasElement | undefined;
const soilPatterns = new WeakMap<CanvasRenderingContext2D, CanvasPattern>();
interface ResourcePainting {
  readonly canvas: HTMLCanvasElement;
  readonly anchorX: number;
  readonly anchorY: number;
}
interface HavenFrame {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly anchor: readonly [number, number];
  readonly contour?: readonly (readonly [number, number])[];
}
const resourcePaintings = new WeakMap<HTMLImageElement, Map<string, ResourcePainting>>();

/** Frames belong only to the new artwork. The authored world-space trunk,
 * work stop, node identity and navigation footprints are left untouched.
 * Contacts are measured at roots / the centre of the water surface. */
const HAVEN_FRAMES = {
  oak: { x: 0, y: 40, width: 432, height: 514, anchor: [230, 522] },
  birch: { x: 423, y: 30, width: 293, height: 521, anchor: [554, 526] },
  spread: { x: 702, y: 68, width: 568, height: 490, anchor: [1005, 530], contour: [
    [1026,68],[863,104],[759,169],[711,277],[705,351],[767,429],[891,493],
    [900,550],[1098,552],[1110,468],[1259,384],[1268,315],[1238,218],[1157,133],
  ] },
  stump: { x: 1226, y: 276, width: 309, height: 282, anchor: [1377, 520], contour: [
    [1305,285],[1405,287],[1455,326],[1468,400],[1533,490],[1499,536],
    [1370,555],[1230,510],[1230,468],[1284,430],[1296,358],
  ] },
  scrap: { x: 15, y: 621, width: 409, height: 331, anchor: [216, 920] },
  seed: { x: 428, y: 621, width: 369, height: 341, anchor: [610, 931] },
  water: { x: 801, y: 682, width: 408, height: 284, anchor: [1008, 863] },
  underbrush: { x: 1221, y: 643, width: 314, height: 326, anchor: [1385, 935] },
} as const satisfies Record<string, HavenFrame>;
const TREE_FRAMES = ['oak', 'birch', 'spread'] as const;
function havenFrame(sprite: GroundSprite, variant: number): HavenFrame {
  const index = Number.isFinite(variant) ? ((Math.floor(variant) % 3) + 3) % 3 : 0;
  return sprite === 'tree' ? HAVEN_FRAMES[TREE_FRAMES[index]] : HAVEN_FRAMES[sprite];
}

const smooth = (from: number, to: number, value: number) => {
  const t = Math.max(0, Math.min(1, (value - from) / (to - from)));
  return t * t * (3 - 2 * t);
};

/** Preserve the sculpted foliage, bark and stones at useful zoom resolution.
 * Alpha cleanup removes the generator's faint matte, without a coloured
 * rectangle or a separate grassy island underneath each collectible. */
function resourcePainting(image: HTMLImageElement, sprite: GroundSprite, variant: number): ResourcePainting | undefined {
  let paintings = resourcePaintings.get(image);
  if (!paintings) { paintings = new Map(); resourcePaintings.set(image, paintings); }
  const key = `${sprite}:${variant}`, cached = paintings.get(key);
  if (cached) return cached;
  const frame = havenFrame(sprite, variant),
    brushWidth = sprite === 'tree' ? 384 : sprite === 'stump' ? 192 : 256,
    canvas = document.createElement('canvas');
  canvas.width = brushWidth; canvas.height = Math.round(brushWidth * frame.height / frame.width);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return undefined;
  context.imageSmoothingEnabled = true; context.imageSmoothingQuality = 'high';
  context.save();
  if (frame.contour) {
    context.beginPath();
    frame.contour.forEach(([x, y], index) => {
      const px = (x - frame.x) * canvas.width / frame.width, py = (y - frame.y) * canvas.height / frame.height;
      if (index) context.lineTo(px, py); else context.moveTo(px, py);
    });
    context.closePath(); context.clip();
  }
  context.drawImage(image, frame.x, frame.y, frame.width, frame.height, 0, 0, canvas.width, canvas.height);
  context.restore();
  const painting = context.getImageData(0, 0, canvas.width, canvas.height);
  harmonizeGroundPixels(painting.data, GROUND_ART_PALETTE.props);
  for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
    const offset = (y * canvas.width + x) * 4, alpha = painting.data[offset + 3];
    const opacity = smooth(18, 218, alpha);
    painting.data[offset + 3] = Math.round(opacity * 255);
  }
  context.putImageData(painting, 0, 0);
  const result = { canvas, anchorX: (frame.anchor[0] - frame.x) / frame.width,
    anchorY: (frame.anchor[1] - frame.y) / frame.height };
  paintings.set(key, result);
  return result;
}

function softenPaintingEdges(context: CanvasRenderingContext2D, width: number, height: number): void {
  const edge = GROUND_LANDSCAPE_EDGE_FADE;
  context.save();
  context.globalCompositeOperation = 'destination-in';
  for (const [x1, y1, length] of [[width, 0, width], [0, height, height]]) {
    const fade = context.createLinearGradient(0, 0, x1, y1);
    fade.addColorStop(0, 'rgba(255,255,255,0)');
    fade.addColorStop(edge / length, 'rgba(255,255,255,1)');
    fade.addColorStop(1 - edge / length, 'rgba(255,255,255,1)');
    fade.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = fade; context.fillRect(0, 0, width, height);
  }
  context.restore();
}

function groundSoilPattern(c: CanvasRenderingContext2D): CanvasPattern | undefined {
  const cached = soilPatterns.get(c);
  if (cached) return cached;
  if (!soilTexture && typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = GROUND_SOIL_TEXTURE_SIZE;
    const context = canvas.getContext('2d');
    if (context) {
      const image = context.createImageData(canvas.width, canvas.height);
      image.data.set(createGroundSoilPixels()); context.putImageData(image, 0, 0);
      soilTexture = canvas;
    }
  }
  const pattern = soilTexture ? c.createPattern(soilTexture, 'repeat') : null;
  if (pattern) soilPatterns.set(c, pattern);
  return pattern ?? undefined;
}

/** Each original atlas/painting is graded only after it has decoded, once.
 * Keep this independent of camera, time, viewport and resource regeneration. */
function displayPainting(image: HTMLImageElement, palette: GroundPalette, softEdges = false): CanvasImageSource {
  const cached = displayPaintings.get(image);
  if (cached) return cached;
  if (typeof document === 'undefined') return image;
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return image;
  context.drawImage(image, 0, 0);
  const painting = context.getImageData(0, 0, canvas.width, canvas.height);
  harmonizeGroundPixels(painting.data, palette);
  context.putImageData(painting, 0, 0);
  if (softEdges) {
    paintGatheringGround(context, canvas.width, canvas.height);
    softenPaintingEdges(context, canvas.width, canvas.height);
  }
  displayPaintings.set(image, canvas);
  return canvas;
}

function loadImage(url: string): HTMLImageElement | undefined {
  if (typeof Image === 'undefined') return undefined;
  const image = new Image();
  image.decoding = 'async';
  image.src = url;
  return image;
}

/** Lazily loading also keeps importing the rendering module safe in a host
 * with no browser Image constructor. Geometry lives in ground-visuals.ts. */
export const groundImages = {
  get landscape() { return landscapeImage ??= loadImage(landscapeUrl); },
  get props() { return propsImage ??= loadImage(propsUrl); },
};

function ready(image: HTMLImageElement | undefined): image is HTMLImageElement {
  return Boolean(image?.complete && image.naturalWidth && image.naturalHeight);
}

export function groundArtReady(): boolean {
  const landscape = groundImages.landscape, props = groundImages.props;
  return ready(landscape) && ready(props);
}

export function drawGroundLandscape(c: CanvasRenderingContext2D): boolean {
  const image = groundImages.landscape;
  if (!ready(image)) return false;
  const viewport = getGroundBackgroundViewport(c.getTransform(), c.canvas.width, c.canvas.height) ?? GROUND_BACKGROUND_BOUNDS,
    painting = displayPainting(image, GROUND_ART_PALETTE.landscape, true),
    pattern = groundSoilPattern(c), groundScale = GROUND_SOIL_TEXTURE_WORLD_SCALE;
  c.save();
  c.imageSmoothingEnabled = true;
  // Coverage follows the actual viewport, but the quiet texture stays fixed
  // in world coordinates. Never reflect recognisable roads or stream banks.
  c.save(); c.scale(groundScale, groundScale);
  c.fillStyle = pattern ?? GROUND_SOIL_BASE;
  c.fillRect((viewport.left - 1) / groundScale, (viewport.top - 1) / groundScale,
    (viewport.right - viewport.left + 2) / groundScale, (viewport.bottom - viewport.top + 2) / groundScale);
  c.restore();
  const { left, top, right, bottom } = GROUND_LANDSCAPE_BOUNDS;
  c.drawImage(painting, left, top, right - left, bottom - top);
  c.restore();
  return true;
}

/** Each new model is rooted at the existing interactive world contact.
 * The renderer, not the saved resource geometry, owns its source crop. */
export function drawGroundSprite(c: CanvasRenderingContext2D, sprite: GroundSprite, x: number, y: number,
  width: number, height: number, alpha: number = 1, variant: number = 0): boolean {
  const image = groundImages.props;
  if (!ready(image)) return false;
  const painting = resourcePainting(image, sprite, variant), shadow = getGroundContactShadow(sprite, width, height);
  if (!painting) return false;
  const left = x - painting.anchorX * width, top = y - painting.anchorY * height;
  c.save();
  c.globalAlpha *= Math.max(0, Math.min(1, alpha));
  c.imageSmoothingEnabled = true;
  c.save();
  c.translate(x + shadow.offsetX, y + shadow.offsetY);
  c.scale(shadow.radiusX, shadow.radiusY);
  const shade = c.createRadialGradient(0, 0, .08, 0, 0, 1);
  shade.addColorStop(0, `rgba(65, 71, 39, ${shadow.opacity * .8})`);
  shade.addColorStop(.55, `rgba(65, 71, 39, ${shadow.opacity * .33})`);
  shade.addColorStop(1, 'rgba(65, 71, 39, 0)');
  c.fillStyle = shade; c.fillRect(-1, -1, 2, 2);
  c.restore();
  c.drawImage(painting.canvas, left, top, width, height);
  c.restore();
  return true;
}
