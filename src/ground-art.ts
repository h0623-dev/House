import landscapeUrl from './assets/ground-landscape.png';
import propsUrl from './assets/ground-props.png';
import { GROUND_BACKGROUND_TILES, getGroundBackgroundViewport, getGroundVisibleBackgroundTiles,
  getGroundSpriteBounds, getGroundSpriteFrame, type GroundSprite } from './ground-visuals';

export const groundArtUrls = { landscape: landscapeUrl, props: propsUrl } as const;
let landscapeImage: HTMLImageElement | undefined;
let propsImage: HTMLImageElement | undefined;

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
  const viewport = getGroundBackgroundViewport(c.getTransform(), c.canvas.width, c.canvas.height),
    visibleTiles = viewport ? getGroundVisibleBackgroundTiles(viewport) : GROUND_BACKGROUND_TILES;
  c.save();
  c.imageSmoothingEnabled = true;
  for (const tile of visibleTiles) {
    const { left, top, right, bottom } = tile.bounds, width = right - left, height = bottom - top;
    c.save();
    c.translate(tile.mirrorX ? right : left, tile.mirrorY ? bottom : top);
    c.scale(tile.mirrorX ? -1 : 1, tile.mirrorY ? -1 : 1);
    c.drawImage(image, 0, 0, width, height);
    c.restore();
  }
  c.restore();
  return true;
}

/** Draw the untouched transparent source atlas at its measured foot contact.
 * Cropping and contour clipping happen only on the game's display canvas. */
export function drawGroundSprite(c: CanvasRenderingContext2D, sprite: GroundSprite, x: number, y: number,
  width: number, height: number, alpha: number = 1, variant: number = 0): boolean {
  const image = groundImages.props;
  if (!ready(image)) return false;
  const frame = getGroundSpriteFrame(sprite, variant), [left, top] = getGroundSpriteBounds(sprite, x, y, width, height, variant);
  c.save();
  c.globalAlpha *= Math.max(0, Math.min(1, alpha));
  c.imageSmoothingEnabled = true;
  c.beginPath();
  frame.contour.forEach(([sourceX, sourceY], index) => {
    const px = x + (sourceX - frame.anchor[0]) * width / frame.width,
      py = y + (sourceY - frame.anchor[1]) * height / frame.height;
    if (index) c.lineTo(px, py); else c.moveTo(px, py);
  });
  c.closePath();
  c.clip();
  c.drawImage(image, frame.x, frame.y, frame.width, frame.height, left, top, width, height);
  c.restore();
  return true;
}
