import cropAtlasUrl from './assets/crops-anime.png';
import { CROPS, type CropId } from './crops';

export type CropArtKind = 'seed' | 'produce' | 'plant';
export const cropArtUrl = cropAtlasUrl;

type Frame = { x: number; y: number; width: number; height: number };
const atlasWidth = 1774;
const atlasHeight = 887;

// Original transparent artwork: columns are carrot, potato, tomato, corn,
// strawberry and pumpkin; rows are seed packets, produce and mature plants.
// Measure each painted silhouette, with eight pixels of transparent padding,
// rather than cutting the tallest corn leaves at a nominal grid boundary.
export const cropArtFrames: Record<CropArtKind, Record<CropId, Frame>> = {
  seed: {
    carrot: { x: 54, y: 62, width: 216, height: 230 },
    potato: { x: 349, y: 64, width: 217, height: 230 },
    tomato: { x: 642, y: 66, width: 214, height: 225 },
    corn: { x: 930, y: 64, width: 216, height: 230 },
    strawberry: { x: 1224, y: 63, width: 214, height: 229 },
    pumpkin: { x: 1507, y: 62, width: 216, height: 229 },
  },
  produce: {
    carrot: { x: 41, y: 339, width: 242, height: 220 },
    potato: { x: 338, y: 365, width: 230, height: 184 },
    tomato: { x: 635, y: 357, width: 222, height: 184 },
    corn: { x: 917, y: 350, width: 237, height: 203 },
    strawberry: { x: 1213, y: 357, width: 237, height: 188 },
    pumpkin: { x: 1508, y: 351, width: 230, height: 196 },
  },
  plant: {
    carrot: { x: 43, y: 588, width: 238, height: 236 },
    potato: { x: 331, y: 594, width: 244, height: 236 },
    tomato: { x: 624, y: 578, width: 236, height: 254 },
    corn: { x: 918, y: 582, width: 234, height: 251 },
    strawberry: { x: 1204, y: 613, width: 244, height: 214 },
    pumpkin: { x: 1488, y: 600, width: 247, height: 231 },
  },
};

const cropImage = new Image();
cropImage.decoding = 'async';
cropImage.src = cropAtlasUrl;

export function cropArtReady(): boolean {
  return cropImage.complete && cropImage.naturalWidth > 0;
}

/** Accessible illustrated icon, cropped from the bundled atlas without raster edits. */
export function cropIcon(cropId: CropId, kind: CropArtKind = 'seed'): string {
  const frame = cropArtFrames[kind][cropId];
  const crop = CROPS[cropId];
  const label = kind === 'seed' ? crop.seedName : kind === 'plant' ? `${crop.name} 작물` : crop.name;
  return `<svg class="icon illustrated-icon crop-icon" viewBox="${frame.x} ${frame.y} ${frame.width} ${frame.height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${label}" focusable="false" style="overflow:hidden"><image href="${cropAtlasUrl}" x="0" y="0" width="${atlasWidth}" height="${atlasHeight}"/></svg>`;
}

/** The middle of the sprite's base is grounded at (x, y), like world-art sprites. */
export function drawCropSprite(
  ctx: CanvasRenderingContext2D,
  cropId: CropId,
  kind: CropArtKind,
  x: number,
  y: number,
  width: number,
  height: number,
): boolean {
  if (!cropArtReady()) return false;
  const frame = cropArtFrames[kind][cropId];
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(cropImage, frame.x, frame.y, frame.width, frame.height, x - width / 2, y - height, width, height);
  ctx.restore();
  return true;
}
