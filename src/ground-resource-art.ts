import { groundImages } from './ground-art';
import { GROUND_ART_PALETTE, harmonizeGroundPixels } from './ground-palette';
import { GROUND_POND_SHORE_POLYGON, type GroundResourceNode } from './ground-resources';

type Point = readonly [number, number];
interface PondOptions { ready: boolean; reducedMotion?: boolean; remaining?: number; active?: boolean }
interface ScrapOptions { ready: boolean; impact?: number }
interface Painting { canvas: HTMLCanvasElement; left: number; top: number; width: number; height: number }
const pondPaintings = new Map<string, Painting>();

/** The same shoreline supplies the painted water, hit area and walking bank.
 * Quadratic corners stay inside the authored solid polygon. */
function shoreline(c: CanvasRenderingContext2D, points: readonly Point[], x: number, y: number, scale = 1) {
  const p = points.map(([px, py]) => [x + (px - x) * scale, y + (py - y) * scale]);
  c.beginPath();
  const last = p[p.length - 1], first = p[0];
  c.moveTo((last[0] + first[0]) / 2, (last[1] + first[1]) / 2);
  p.forEach((point, index) => {
    const next = p[(index + 1) % p.length];
    c.quadraticCurveTo(point[0], point[1], (point[0] + next[0]) / 2, (point[1] + next[1]) / 2);
  });
  c.closePath();
}

function random(seed: number) {
  let state = seed >>> 0;
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
}

function ellipse(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string) {
  c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fillStyle = color; c.fill();
}

function bankGrass(c: CanvasRenderingContext2D, x: number, y: number, seed: number, size = 1) {
  const rng = random(seed), count = 5 + Math.floor(rng() * 5);
  ellipse(c, x + 1, y + 1, 8 * size, 2.4 * size, '#46543121');
  for (let i = 0; i < count; i++) {
    const dx = (rng() - .5) * 10 * size, height = (6 + rng() * 14) * size,
      bend = (rng() - .5) * 14 * size;
    c.beginPath(); c.moveTo(x + dx - .7 * size, y);
    c.quadraticCurveTo(x + dx + bend * .25, y - height * .7, x + dx + bend, y - height);
    c.quadraticCurveTo(x + dx + bend * .4 + 1.2 * size, y - height * .5, x + dx + 1.3 * size, y + 1);
    c.closePath();
    const blade = c.createLinearGradient(0, y - height, 0, y);
    blade.addColorStop(0, i % 3 ? '#b3b95d' : '#c6c570'); blade.addColorStop(.45, '#82994b');
    blade.addColorStop(1, '#576f3e'); c.fillStyle = blade; c.fill();
  }
}

function stone(c: CanvasRenderingContext2D, x: number, y: number, size: number, seed: number) {
  const rng = random(seed), width = size * (1 + rng() * .35), height = size * .56;
  ellipse(c, x + 2, y + height * .6, width * .9, height * .5, '#354e3c28');
  c.beginPath(); c.moveTo(x - width, y + height * .3); c.lineTo(x - width * .8, y - height * .55);
  c.lineTo(x - width * .2, y - height); c.lineTo(x + width * .58, y - height * .74);
  c.lineTo(x + width, y + height * .1); c.lineTo(x + width * .48, y + height * .64);
  c.lineTo(x - width * .5, y + height * .7); c.closePath();
  const surface = c.createLinearGradient(x - width, y - height, x + width * .5, y + height);
  surface.addColorStop(0, '#c1bea0'); surface.addColorStop(.4, '#a8aa90'); surface.addColorStop(1, '#727d68');
  c.fillStyle = surface; c.fill(); c.save(); c.clip();
  c.beginPath(); c.moveTo(x - width * .8, y - height * .52); c.lineTo(x - width * .16, y - height * .89);
  c.lineTo(x + width * .5, y - height * .67); c.lineWidth = .8; c.strokeStyle = '#e8dcad8c'; c.stroke();
  for (let i = 0; i < 35; i++) {
    const px = x + (rng() - .5) * width * 2.1, py = y + (rng() - .5) * height * 2;
    ellipse(c, px, py, .3 + rng() * 1.4, .2 + rng() * .7, i % 2 ? '#e7dbad25' : '#42574922');
  }
  for (let i = 0; i < 6; i++) ellipse(c, x - width * .6 + rng() * width * .8,
    y - height * .25 + rng() * height * .5, size * (.12 + rng() * .17), size * .1, '#7d8f4866');
  c.restore();
}

function makePond(node: GroundResourceNode): Painting | undefined {
  if (typeof document === 'undefined') return undefined;
  const pad = 35, left = node.bounds.left - pad, top = node.bounds.top - pad,
    width = node.bounds.right - node.bounds.left + pad * 2,
    height = node.bounds.bottom - node.bounds.top + pad * 2, canvas = document.createElement('canvas');
  canvas.width = Math.ceil(width * 2); canvas.height = Math.ceil(height * 2);
  const c = canvas.getContext('2d'); if (!c) return undefined;
  c.scale(2, 2); c.translate(-left, -top);
  const [x, y] = node.point, shore = GROUND_POND_SHORE_POLYGON, rng = random(0x427bd81);

  // Broken translucent loam disappears into the existing grass painting.
  for (const [spread, color] of [[1.13, '#7680480a'], [1.09, '#71804b12'], [1.055, '#8c936625']] as const) {
    shoreline(c, shore, x, y, spread); c.fillStyle = color; c.fill();
  }
  shoreline(c, shore, x, y, 1.01);
  const bank = c.createLinearGradient(x - 90, y - 75, x + 95, y + 95);
  bank.addColorStop(0, '#8c9258'); bank.addColorStop(.42, '#a9a169');
  bank.addColorStop(.8, '#b6a879'); bank.addColorStop(1, '#989859'); c.fillStyle = bank; c.fill();
  c.save(); c.clip();
  // Pigment-scale grit and leaf litter gives the shore a soil material, not a ring of rocks.
  for (let i = 0; i < 1150; i++) {
    const px = node.bounds.left + rng() * (width - pad * 2), py = node.bounds.top + rng() * (height - pad * 2);
    ellipse(c, px, py, .3 + rng() * 2.1, .2 + rng() * .7,
      ['#dbcf9e35', '#465c3525', '#77875026', '#c3b27b29'][i % 4]);
  }
  c.restore();

  shoreline(c, shore, x, y, .895);
  const water = c.createLinearGradient(x - 85, y - 80, x + 75, y + 85);
  water.addColorStop(0, '#456d60'); water.addColorStop(.22, '#50887a');
  water.addColorStop(.53, '#70a494'); water.addColorStop(.79, '#8bb6a0'); water.addColorStop(1, '#adb999');
  c.fillStyle = water; c.fill(); c.save(); c.clip();
  const source = groundImages.props;
  if (source?.complete && source.naturalWidth) {
    // Retain a little of the existing painted water's fine caustic detail.
    // Only its open water is sampled; the old circular rock enclosure is absent.
    c.save(); c.globalAlpha = .19;
    c.drawImage(source, 995, 806, 70, 44, x - 136, y - 78, 272, 156); c.restore();
  }
  const depth = c.createRadialGradient(x + 10, y - 12, 8, x, y, 135);
  depth.addColorStop(0, '#345f632c'); depth.addColorStop(.5, '#3b7f7215'); depth.addColorStop(1, '#d1c58b3d');
  c.fillStyle = depth; c.fillRect(left, top, width, height);
  // Submerged stones and dappled sky are visible through the shallow edge.
  for (let i = 0; i < 270; i++) {
    const a = rng() * Math.PI * 2, r = Math.sqrt(rng()), px = x + Math.cos(a) * 139 * r,
      py = y + Math.sin(a) * 80 * r, size = .3 + rng() * (r > .72 ? 3.4 : 1.8);
    ellipse(c, px, py, size * 1.5, size * .52, r > .72 ? '#ddd1a924' : '#c6dfc216');
  }
  c.lineCap = 'round';
  for (let i = 0; i < 43; i++) {
    const px = x - 122 + rng() * 240, py = y - 60 + rng() * 118,
      length = 3 + rng() * 16;
    c.beginPath(); c.moveTo(px, py); c.bezierCurveTo(px + length * .28, py - 1.2,
      px + length * .62, py + 1.4, px + length, py - .3);
    c.strokeStyle = i % 3 ? '#d8e6c220' : '#edf3d740'; c.lineWidth = .5 + rng() * .65; c.stroke();
  }
  // Reflections remain soft vertical masses rather than bright blue emblems.
  const reflection = c.createLinearGradient(x, y - 88, x, y + 10);
  reflection.addColorStop(0, '#32563b2e'); reflection.addColorStop(.8, '#507f4e00');
  c.fillStyle = reflection; c.fillRect(left, top, width, 135);
  c.restore();
  shoreline(c, shore, x, y, .895); c.lineWidth = 1.5; c.strokeStyle = '#dae2b54a'; c.stroke();

  // A few grouped stones leave most of the bank open for gathering.
  stone(c, x - 98, y - 47, 9, 14); stone(c, x - 112, y - 39, 5, 31);
  stone(c, x + 93, y + 49, 8, 21); stone(c, x + 106, y + 43, 5, 9);
  stone(c, x + 36, y - 72, 6, 8);
  const tufts: readonly [number, number, number][] = [
    [-126,-24,1.04],[-111,-48,1.12],[-81,-64,.88],[-43,-73,.85],
    [32,-73,.92],[61,-64,1.08],[105,-42,1.14],[132,-9,.82],
    [126,21,.72],[96,52,1.02],[58,66,.78],[-64,66,.73],[-100,47,.85],[-130,12,.83],
  ];
  tufts.forEach(([dx, dy, scale], index) => bankGrass(c, x + dx, y + dy, 100 + index * 37, scale));
  return { canvas, left, top, width, height };
}

/** One landscape-sized pond, with ten shared uses owned by gathering.ts.
 * Depletion removes its water and vegetation. A very quiet dry depression
 * explains the reserved terrain without leaving a blue icon or stone well. */
export function drawGatheringPond(c: CanvasRenderingContext2D, node: GroundResourceNode,
  timeSeconds: number, options: PondOptions): boolean {
  if (!options.ready) {
    c.save();
    shoreline(c, GROUND_POND_SHORE_POLYGON, node.point[0], node.point[1], .98);
    c.fillStyle = '#b7a27713'; c.fill();
    shoreline(c, GROUND_POND_SHORE_POLYGON, node.point[0], node.point[1], .81);
    const dry = c.createRadialGradient(node.point[0], node.point[1], 2, node.point[0], node.point[1], 140);
    dry.addColorStop(0, '#8979560c'); dry.addColorStop(1, '#ad936400'); c.fillStyle = dry; c.fill();
    c.restore(); return true;
  }
  const key = `${node.id}:${node.bounds.left}:${node.bounds.top}:${node.bounds.right}:${node.bounds.bottom}:${groundImages.props?.naturalWidth ?? 0}`;
  let painting = pondPaintings.get(key);
  if (!painting) {
    painting = makePond(node); if (!painting) return false;
    pondPaintings.clear(); pondPaintings.set(key, painting);
  }
  c.save(); c.imageSmoothingEnabled = true;
  c.drawImage(painting.canvas, painting.left, painting.top, painting.width, painting.height);
  if (!options.reducedMotion) {
    const [x, y] = node.point;
    shoreline(c, GROUND_POND_SHORE_POLYGON, x, y, .88); c.clip();
    for (let i = 0; i < 5; i++) {
      const phase = (timeSeconds * .16 + i * .233) % 1, alpha = Math.sin(phase * Math.PI) * .2,
        px = x + [-54, 43, -5, 88, -84][i], py = y + [15, -24, 42, 22, -30][i];
      c.beginPath(); c.ellipse(px, py, 8 + phase * 24, 2 + phase * 7.5, -.04, .12, Math.PI * 1.84);
      c.lineWidth = .8; c.strokeStyle = `rgba(231,241,211,${alpha})`; c.stroke();
    }
  }
  c.restore(); return true;
}

interface ScrapFrame { x: number; y: number; width: number; height: number; contour: readonly Point[] }
type ScrapPart = 'plate' | 'panel' | 'tire' | 'engine';
const SCRAP_FRAMES: Record<ScrapPart, ScrapFrame> = {
  plate: { x: 140, y: 628, width: 135, height: 180, contour: [
    [143,673],[237,630],[254,665],[273,766],[237,798],[169,801],
  ] },
  panel: { x: 278, y: 692, width: 116, height: 151, contour: [
    [306,697],[388,734],[361,831],[281,797],
  ] },
  tire: { x: 43, y: 750, width: 164, height: 171, contour: [
    [111,754],[158,752],[193,773],[205,806],[199,846],[176,886],[139,912],
    [102,918],[67,903],[47,876],[47,837],[68,795],
  ] },
  engine: { x: 197, y: 745, width: 184, height: 194, contour: [
    [246,749],[278,755],[292,774],[342,791],[348,818],[377,850],[370,883],
    [348,908],[328,927],[292,937],[230,918],[200,892],[199,846],[215,813],[218,776],
  ] },
};
const scrapParts = new Map<ScrapPart, HTMLCanvasElement>();

/** Isolate genuinely different objects from the original illustration.
 * Repeating the complete pile five times would retain its icon appearance. */
function scrapPart(kind: ScrapPart): HTMLCanvasElement | undefined {
  const cached = scrapParts.get(kind); if (cached) return cached;
  const image = groundImages.props;
  if (!image?.complete || !image.naturalWidth || typeof document === 'undefined') return undefined;
  const frame = SCRAP_FRAMES[kind], canvas = document.createElement('canvas');
  canvas.width = frame.width; canvas.height = frame.height;
  const c = canvas.getContext('2d', { willReadFrequently: true }); if (!c) return undefined;
  c.save(); c.beginPath();
  frame.contour.forEach(([x, y], i) => i ? c.lineTo(x - frame.x, y - frame.y) : c.moveTo(x - frame.x, y - frame.y));
  c.closePath(); c.clip();
  c.drawImage(image, frame.x, frame.y, frame.width, frame.height, 0, 0, frame.width, frame.height); c.restore();
  const pixels = c.getImageData(0, 0, canvas.width, canvas.height);
  harmonizeGroundPixels(pixels.data, GROUND_ART_PALETTE.props);
  for (let i = 3; i < pixels.data.length; i += 4) {
    const alpha = Math.max(0, Math.min(1, (pixels.data[i] - 18) / 200));
    pixels.data[i] = Math.round(alpha * alpha * (3 - 2 * alpha) * 255);
  }
  c.putImageData(pixels, 0, 0); scrapParts.set(kind, canvas); return canvas;
}

function bentPipe(c: CanvasRenderingContext2D, x: number, y: number, angle: number) {
  c.save(); c.translate(x, y); c.rotate(angle);
  c.beginPath(); c.moveTo(-15, 0); c.lineTo(-1, 3); c.quadraticCurveTo(5, 5, 6, 0); c.lineTo(9, -7);
  c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = '#524536'; c.lineWidth = 6; c.stroke();
  const metal = c.createLinearGradient(0, -8, 0, 7);
  metal.addColorStop(0, '#b88f60'); metal.addColorStop(.45, '#9d7651'); metal.addColorStop(1, '#665440');
  c.strokeStyle = metal; c.lineWidth = 4; c.stroke();
  c.strokeStyle = '#dbc39a8c'; c.lineWidth = .75; c.stroke();
  ellipse(c, -15.2, -.1, 2.2, 2.6, '#67533e'); ellipse(c, -15.5, -.1, 1.1, 1.8, '#353e35');
  c.restore();
}

/** Five separate salvage pieces share one physical cluster. Their feet stay
 * within the enlarged 80×54 collision area; no circular sprite bases remain. */
export function drawGroundScrapCluster(c: CanvasRenderingContext2D, node: GroundResourceNode,
  options: ScrapOptions): boolean {
  if (!options.ready) {
    c.save(); c.translate(node.point[0], node.point[1]); c.scale(node.scale, node.scale);
    ellipse(c, 0, 4, 34, 15, '#806c4210');
    for (const [x, y, angle] of [[-21, 0, -.2], [8, 9, .25], [24, -9, -.3]]) {
      c.save(); c.translate(x, y); c.rotate(angle); c.fillStyle = '#8d704e55';
      c.fillRect(-3.6, -1.4, 7.2, 2.8); c.fillStyle = '#c9b58a4d'; c.fillRect(-3.1, -1.6, 4.5, .6); c.restore();
    }
    bankGrass(c, -29, 8, 71, .24); bankGrass(c, 30, 13, 91, .24);
    c.restore(); return true;
  }
  const kinds: ScrapPart[] = ['plate', 'panel', 'tire', 'engine'], parts = kinds.map(scrapPart);
  if (parts.some(part => !part)) return false;
  const number = Number(node.id.match(/\d+$/)?.[0] ?? 1), variant = number % 4,
    mirror = variant % 2 ? -1 : 1, jitter = Math.sin(number * 2.31);
  c.save(); c.translate(node.point[0], node.point[1]); c.scale(node.scale * mirror, node.scale);
  const ground = c.createRadialGradient(0, 8, 1, 0, 8, 45);
  ground.addColorStop(0, '#4f55341a'); ground.addColorStop(.65, '#665d3710'); ground.addColorStop(1, '#665d3700');
  c.save(); c.scale(1, .52); c.fillStyle = ground; c.fillRect(-47, -35, 94, 94); c.restore();
  const layouts: readonly [ScrapPart, number, number, number, number][] = [
    ['plate', -14 + jitter * 3, -9, 27, -.2 + variant * .12],
    ['panel', 24 - jitter * 2, -3, 25, .24 - variant * .1],
    ['tire', -26 + variant, 13, 29, -.13 + jitter * .13],
    ['engine', 9 - variant, 14, 31, .06 - jitter * .08],
  ];
  for (const [kind, x, y, width, angle] of layouts) {
    const image = parts[kinds.indexOf(kind)]!, height = width * image.height / image.width;
    ellipse(c, x + 1, y + 1, width * .44, width * .13, '#3b423829');
    c.save(); c.translate(x, y); c.rotate(angle + (options.impact ?? 0) * (kind === 'engine' ? .025 : .008));
    c.drawImage(image, -width / 2, -height * .88, width, height); c.restore();
  }
  bentPipe(c, -2 + jitter * 3, 23 - variant * .5, -.19 + jitter * .18);
  // Small grass blades overlap just the outside corners, rooting the pieces
  // in the meadow without giving every group the same grassy circular island.
  bankGrass(c, -39, 10, 43 + number, .37); bankGrass(c, 35, 20, 97 + number, .31);
  c.restore(); return true;
}
