import atlasUrl from './assets/world-atlas-anime.png';
import partsUrl from './assets/world-parts-anime.png';
import roadUrl from './assets/world-road-anime.png';

/** Measured crops from the original, transparent painted environment atlases. */
export const worldArtUrls = { atlas: atlasUrl, parts: partsUrl, road: roadUrl };
type Sheet = 'atlas' | 'parts' | 'road';
type Point = [number, number];
type Frame = { sheet: Sheet; x: number; y: number; width: number; height: number };
const spriteContours: Partial<Record<WorldSprite, Point[]>> = {
  // The large truck and cottage intentionally share the atlas row. Exclude
  // detached cabin/leaf fragments rather than cropping the finished house.
  cottage: [[552, 62], [637, 62], [637, 111], [724, 111], [794, 259], [817, 286], [803, 307], [824, 340], [824, 513], [739, 558], [603, 558], [524, 509], [488, 455], [488, 291], [451, 280], [451, 242], [476, 216], [538, 178], [552, 159]],
  tree: [[836, 60], [1202, 60], [1202, 567], [887, 567], [812, 465], [809, 237]],
};
const frames = {
  cottage: { sheet: 'atlas', x: 451, y: 62, width: 374, height: 498 },
  tree: { sheet: 'atlas', x: 809, y: 60, width: 393, height: 507 },
  tank: { sheet: 'atlas', x: 1207, y: 181, width: 146, height: 201 },
  solar: { sheet: 'atlas', x: 1305, y: 150, width: 221, height: 210 },
  furniture: { sheet: 'atlas', x: 1195, y: 358, width: 334, height: 193 },
  crate: { sheet: 'atlas', x: 1202, y: 350, width: 162, height: 181 },
  planter: { sheet: 'atlas', x: 25, y: 602, width: 375, height: 341 },
  sprout: { sheet: 'atlas', x: 434, y: 746, width: 83, height: 131 },
  carrotYoung: { sheet: 'atlas', x: 511, y: 673, width: 143, height: 222 },
  carrot: { sheet: 'atlas', x: 650, y: 610, width: 152, height: 297 },
  forest: { sheet: 'atlas', x: 812, y: 615, width: 393, height: 347 },
  wood: { sheet: 'atlas', x: 1240, y: 609, width: 256, height: 82 },
  metal: { sheet: 'atlas', x: 1240, y: 722, width: 256, height: 81 },
  soil: { sheet: 'atlas', x: 1240, y: 846, width: 256, height: 86 },
  cabin: { sheet: 'parts', x: 17, y: 16, width: 617, height: 559 },
  wheel: { sheet: 'parts', x: 633, y: 127, width: 353, height: 428 },
  stairs: { sheet: 'parts', x: 1048, y: 9, width: 488, height: 574 },
  stump: { sheet: 'parts', x: 28, y: 613, width: 528, height: 370 },
  fence: { sheet: 'parts', x: 565, y: 603, width: 459, height: 369 },
  flowers: { sheet: 'parts', x: 1062, y: 584, width: 459, height: 416 },
} satisfies Record<string, Frame>;
export type WorldSprite = keyof typeof frames;

function asset(url: string) { const image = new Image(); image.decoding = 'async'; image.src = url; return image; }
export const worldImages = { atlas: asset(atlasUrl), parts: asset(partsUrl), road: asset(roadUrl) };
export function worldArtReady() { return Object.values(worldImages).every(image => image.complete && image.naturalWidth > 0); }

/** Anchored at the middle of the base; all cropping stays on the canvas. */
export function drawWorldSprite(c: CanvasRenderingContext2D, name: WorldSprite, x: number, y: number, width: number, height: number, alpha = 1) {
  const frame = frames[name], image = worldImages[frame.sheet];
  if (!image.complete || !image.naturalWidth) return;
  c.save(); c.globalAlpha *= alpha; c.imageSmoothingEnabled = true;
  const contour = spriteContours[name];
  if (contour) {
    c.beginPath(); contour.forEach(([sx, sy], index) => {
      const px = x - width / 2 + (sx - frame.x) * width / frame.width;
      const py = y - height + (sy - frame.y) * height / frame.height;
      if (index) c.lineTo(px, py); else c.moveTo(px, py);
    }); c.closePath(); c.clip();
  }
  c.drawImage(image, frame.x, frame.y, frame.width, frame.height, x - width / 2, y - height, width, height);
  c.restore();
}

/** Project painted materials onto live geometry, so deck expansion is real. */
export function paintWorldQuad(c: CanvasRenderingContext2D, material: 'wood' | 'metal' | 'soil', corners: [Point, Point, Point, Point], shade = 0) {
  const frame = frames[material], image = worldImages[frame.sheet];
  if (!image.complete || !image.naturalWidth) return false;
  const [a, b, , d] = corners;
  c.save(); c.beginPath(); corners.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); c.clip();
  c.transform((b[0] - a[0]) / frame.width, (b[1] - a[1]) / frame.width, (d[0] - a[0]) / frame.height, (d[1] - a[1]) / frame.height, a[0], a[1]);
  c.drawImage(image, frame.x, frame.y, frame.width, frame.height, 0, 0, frame.width, frame.height);
  if (shade) { c.fillStyle = shade > 0 ? `rgba(43,28,15,${shade})` : `rgba(255,240,190,${-shade})`; c.fillRect(0, 0, frame.width, frame.height); }
  c.restore(); return true;
}

export function drawWorldRoad(c: CanvasRenderingContext2D) {
  const image = worldImages.road;
  if (!image.complete || !image.naturalWidth) return false;
  // Enlarged beyond the camera bounds, including the lumber-yard close-up.
  c.drawImage(image, -600, -435, 2200, 1466.67);
  return true;
}

/** Painted fence projected from its posts onto either direction of the deck. */
export function drawWorldFence(c: CanvasRenderingContext2D, start: Point, end: Point, height: number) {
  const image = worldImages.parts;
  if (!image.complete || !image.naturalWidth) return;
  const a: Point = [612, 776], b: Point = [979, 964], up: Point = [612, 630];
  const sx = b[0] - a[0], sy = b[1] - a[1], ux = up[0] - a[0], uy = up[1] - a[1];
  const det = sx * uy - sy * ux;
  const dx = end[0] - start[0], dy = end[1] - start[1];
  const m11 = dx * uy / det, m21 = (dy * uy + height * sy) / det;
  const m12 = -dx * ux / det, m22 = (-height * sx - dy * ux) / det;
  const f = frames.fence;
  c.save(); c.transform(m11, m21, m12, m22, start[0] - m11 * a[0] - m12 * a[1], start[1] - m21 * a[0] - m22 * a[1]);
  c.drawImage(image, f.x, f.y, f.width, f.height, f.x, f.y, f.width, f.height); c.restore();
}

/** Keep the moving ramp connected to its deck at every expansion level. */
export function drawWorldStairs(c: CanvasRenderingContext2D, top: Point, bottom: Point) {
  const image = worldImages.parts;
  if (!image.complete || !image.naturalWidth) return;
  const a: Point = [1460, 197], b: Point = [1190, 550], left: Point = [1310, 150];
  const sx = b[0] - a[0], sy = b[1] - a[1], ux = left[0] - a[0], uy = left[1] - a[1], det = sx * uy - sy * ux;
  const dx = bottom[0] - top[0], dy = bottom[1] - top[1], lx = -33, ly = -12;
  const m11 = (dx * uy - lx * sy) / det, m21 = (dy * uy - ly * sy) / det;
  const m12 = (lx * sx - dx * ux) / det, m22 = (ly * sx - dy * ux) / det;
  const f = frames.stairs;
  c.save(); c.transform(m11, m21, m12, m22, top[0] - m11 * a[0] - m12 * a[1], top[1] - m21 * a[0] - m22 * a[1]);
  c.drawImage(image, f.x, f.y, f.width, f.height, f.x, f.y, f.width, f.height); c.restore();
}
