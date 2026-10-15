import landscapeUrl from './assets/ground-landscape.png';
import propsUrl from './assets/ground-props.png';
import { GROUND_BACKGROUND_BOUNDS, GROUND_LANDSCAPE_BOUNDS, getGroundBackgroundViewport,
  getGroundContactShadow, getGroundSpriteBounds, getGroundSpriteFrame, type GroundSprite } from './ground-visuals';
import { GROUND_ART_PALETTE, GROUND_LANDSCAPE_EDGE_FADE, GROUND_SOIL_BASE, GROUND_SOIL_TEXTURE_SIZE,
  GROUND_SOIL_TEXTURE_WORLD_SCALE, createGroundSoilPixels, harmonizeGroundPixels, type GroundPalette } from './ground-palette';

export const groundArtUrls = { landscape: landscapeUrl, props: propsUrl } as const;
let landscapeImage: HTMLImageElement | undefined;
let propsImage: HTMLImageElement | undefined;
const displayPaintings = new WeakMap<HTMLImageElement, HTMLCanvasElement>();
let soilTexture: HTMLCanvasElement | undefined;
const soilPatterns = new WeakMap<CanvasRenderingContext2D, CanvasPattern>();

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
  if (softEdges) softenPaintingEdges(context, canvas.width, canvas.height);
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

/** Draw the harmonized transparent atlas at its unchanged measured contact.
 * Cropping and contour clipping happen only on the game's display canvas. */
export function drawGroundSprite(c: CanvasRenderingContext2D, sprite: GroundSprite, x: number, y: number,
  width: number, height: number, alpha: number = 1, variant: number = 0): boolean {
  const image = groundImages.props;
  if (!ready(image)) return false;
  const frame = getGroundSpriteFrame(sprite, variant), [left, top] = getGroundSpriteBounds(sprite, x, y, width, height, variant),
    painting = displayPainting(image, GROUND_ART_PALETTE.props), shadow = getGroundContactShadow(sprite, width, height);
  c.save();
  c.globalAlpha *= Math.max(0, Math.min(1, alpha));
  c.imageSmoothingEnabled = true;
  c.save();
  c.translate(x + shadow.offsetX, y + shadow.offsetY);
  c.scale(shadow.radiusX, shadow.radiusY);
  const shade = c.createRadialGradient(0, 0, .08, 0, 0, 1);
  shade.addColorStop(0, `rgba(54, 66, 43, ${shadow.opacity})`);
  shade.addColorStop(.55, `rgba(54, 66, 43, ${shadow.opacity * .48})`);
  shade.addColorStop(1, 'rgba(54, 66, 43, 0)');
  c.fillStyle = shade; c.fillRect(-1, -1, 2, 2);
  c.restore();
  c.beginPath();
  frame.contour.forEach(([sourceX, sourceY], index) => {
    const px = x + (sourceX - frame.anchor[0]) * width / frame.width,
      py = y + (sourceY - frame.anchor[1]) * height / frame.height;
    if (index) c.lineTo(px, py); else c.moveTo(px, py);
  });
  c.closePath();
  c.clip();
  c.drawImage(painting, frame.x, frame.y, frame.width, frame.height, left, top, width, height);
  c.restore();
  return true;
}
