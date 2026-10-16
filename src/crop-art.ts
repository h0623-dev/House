import inventoryAtlasUrl from './assets/haven-crops-inventory-v047.png';
import growthAtlasUrl from './assets/haven-crops-growth-v047.png';
import { CROPS, type CropId } from './crops';

export type CropArtKind = 'seed' | 'produce' | 'plant';
export type CropGrowthStage = 'sprout' | 'young' | 'mature';
export const cropArtUrl = inventoryAtlasUrl;
export const cropGrowthArtUrl = growthAtlasUrl;

type Frame = { x: number; y: number; width: number; height: number };
const inventorySize = { width: 2172, height: 724 };
const growthSize = { width: 1774, height: 887 };

/** Each plant has a distinct seedling, leafy young stage and ripe silhouette. */
export const cropGrowthArtFrames: Record<CropGrowthStage, Record<CropId, Frame>> = {
  sprout: {
    carrot: { x: 60, y: 56, width: 172, height: 186 },
    potato: { x: 360, y: 68, width: 175, height: 174 },
    tomato: { x: 655, y: 57, width: 176, height: 185 },
    corn: { x: 951, y: 78, width: 183, height: 164 },
    strawberry: { x: 1246, y: 92, width: 173, height: 150 },
    pumpkin: { x: 1527, y: 81, width: 191, height: 161 },
  },
  young: {
    carrot: { x: 23, y: 287, width: 245, height: 243 },
    potato: { x: 327, y: 281, width: 240, height: 246 },
    tomato: { x: 628, y: 272, width: 226, height: 258 },
    corn: { x: 914, y: 279, width: 243, height: 249 },
    strawberry: { x: 1221, y: 348, width: 228, height: 181 },
    pumpkin: { x: 1494, y: 340, width: 260, height: 190 },
  },
  mature: {
    carrot: { x: 13, y: 549, width: 275, height: 293 },
    potato: { x: 308, y: 555, width: 284, height: 291 },
    tomato: { x: 603, y: 540, width: 282, height: 306 },
    corn: { x: 905, y: 543, width: 257, height: 303 },
    strawberry: { x: 1184, y: 630, width: 272, height: 217 },
    pumpkin: { x: 1469, y: 594, width: 295, height: 254 },
  },
};

/** Inventory and world frames share species, while retaining their own atlas. */
export const cropArtFrames: Record<CropArtKind, Record<CropId, Frame>> = {
  seed: {
    carrot: { x: 52, y: 34, width: 286, height: 311 },
    potato: { x: 410, y: 34, width: 283, height: 315 },
    tomato: { x: 757, y: 35, width: 290, height: 318 },
    corn: { x: 1119, y: 34, width: 290, height: 321 },
    strawberry: { x: 1480, y: 31, width: 291, height: 321 },
    pumpkin: { x: 1838, y: 35, width: 290, height: 317 },
  },
  produce: {
    carrot: { x: 12, y: 360, width: 339, height: 329 },
    potato: { x: 381, y: 397, width: 324, height: 276 },
    tomato: { x: 727, y: 370, width: 351, height: 309 },
    corn: { x: 1105, y: 359, width: 355, height: 339 },
    strawberry: { x: 1490, y: 382, width: 316, height: 298 },
    pumpkin: { x: 1815, y: 375, width: 333, height: 309 },
  },
  plant: cropGrowthArtFrames.mature,
};

const inventoryImage = new Image();
inventoryImage.decoding = 'async';
inventoryImage.src = inventoryAtlasUrl;
const growthImage = new Image();
growthImage.decoding = 'async';
growthImage.src = growthAtlasUrl;

export function cropArtReady(): boolean {
  return inventoryImage.complete && inventoryImage.naturalWidth > 0
    && growthImage.complete && growthImage.naturalWidth > 0;
}

/** Accessible inventory art is the same produce used by the growing plant. */
export function cropIcon(cropId: CropId, kind: CropArtKind = 'seed'): string {
  const frame = cropArtFrames[kind][cropId];
  const crop = CROPS[cropId];
  const label = kind === 'seed' ? crop.seedName : kind === 'plant' ? `${crop.name} 작물` : crop.name;
  const source = kind === 'plant' ? growthAtlasUrl : inventoryAtlasUrl;
  const size = kind === 'plant' ? growthSize : inventorySize;
  return `<svg class="icon illustrated-icon crop-icon" viewBox="${frame.x} ${frame.y} ${frame.width} ${frame.height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${label}" focusable="false" style="overflow:hidden"><image href="${source}" x="0" y="0" width="${size.width}" height="${size.height}"/></svg>`;
}

/** Keep the soil mound on the same world footpoint at every growth stage. */
export function drawCropSprite(
  ctx: CanvasRenderingContext2D,
  cropId: CropId,
  kind: CropArtKind,
  x: number,
  y: number,
  width: number,
  height: number,
  growthProgress = 1,
): boolean {
  const image = kind === 'plant' ? growthImage : inventoryImage;
  if (!image.complete || image.naturalWidth === 0) return false;
  const stage: CropGrowthStage = growthProgress < .28 ? 'sprout' : growthProgress < .78 ? 'young' : 'mature';
  const frame = kind === 'plant' ? cropGrowthArtFrames[stage][cropId] : cropArtFrames[kind][cropId];
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(image, frame.x, frame.y, frame.width, frame.height, x - width / 2, y - height, width, height);
  ctx.restore();
  return true;
}
