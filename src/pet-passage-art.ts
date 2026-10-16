import { getPetPassageGeometry, PET_PASSAGE_LINK_ID } from './pet-passage';
import { unprojectTruckPoint } from './truck-layout';
import { paintWorldQuad } from './world-art';
import { drawTruckAccessStairs } from './truck-stair-art';

type Point = [number, number];
const offset = (p: Point, n: Point, amount: number): Point => [p[0] + n[0] * amount, p[1] + n[1] * amount];
const mix = (a: Point, b: Point, t: number): Point => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
function polygon(c: CanvasRenderingContext2D, points: Point[], fill: string, stroke = '', width = 1) {
  c.beginPath(); points.forEach((p, i) => i ? c.lineTo(...p) : c.moveTo(...p)); c.closePath();
  c.fillStyle = fill; c.fill();
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(); }
}
function line(c: CanvasRenderingContext2D, a: Point, b: Point, color: string, width: number) {
  c.beginPath(); c.moveTo(...a); c.lineTo(...b); c.strokeStyle = color; c.lineWidth = width; c.stroke();
}
function bolt(c: CanvasRenderingContext2D, p: Point, radius = 1) {
  c.fillStyle = '#c5a46a'; c.beginPath(); c.ellipse(p[0], p[1], radius, radius * .65, 0, 0, Math.PI * 2); c.fill();
}

/** Width belongs to the horizontal ground plane. A screen-perpendicular width
 * turns a foreshortened ramp into an upright door in this camera. */
function groundCross(a: Point, b: Point, rise: number): Point {
  const x = b[0] - a[0], y = b[1] - a[1] - rise;
  const du = (.47 * x + .67 * y) / .6555, dv = (-.34 * x + .91 * y) / .6555;
  const cross: Point = [.91 * dv + .67 * du, .34 * dv - .47 * du];
  const norm = Math.hypot(...cross) || 1;
  if (cross[1] < 0) return [-cross[0] / norm, -cross[1] / norm];
  return [cross[0] / norm, cross[1] / norm];
}

export function drawPetPassage(c: CanvasRenderingContext2D, level: number, open: boolean, options: { points?: readonly Point[] } = {}) {
  const base = getPetPassageGeometry(level);
  const points = options.points && options.points.length >= 3 && options.points.every(p => p.length === 2 && p.every(Number.isFinite))
    ? options.points.map(p => [...p] as Point) : base.points;
  const hinge = points[points.length - 2], entry = points[points.length - 1], ground = points[0];
  const geometry = { ...base, points, ground, hinge, entry, entryUV: unprojectTruckPoint(entry), hingeUV: unprojectTruckPoint(hinge),
    bounds: { left: Math.min(...points.map(p => p[0])) - base.width / 2, top: Math.min(...points.map(p => p[1])) - base.width / 2 - 32,
      right: Math.max(...points.map(p => p[0])) + base.width / 2, bottom: Math.max(...points.map(p => p[1])) + base.width / 2 } };
  const half = geometry.width / 2, cross = groundCross(hinge, ground, base.rise),
    at = (t: number, side: number, lift = 0): Point => {
      const p = offset(mix(hinge, ground, t), cross, side * half); return [p[0], p[1] - lift];
    };
  c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
  // The pet route is built as a supported staircase, in the same timber and
  // olive metal as the truck. Every riser drops vertically and every tread
  // stays horizontal: no oversized inclined board or detached hanging panel.
  drawTruckAccessStairs(c, hinge, ground, { width: geometry.width, rise: base.rise, cross, treadCount: 8 });
  // The deck gate follows the truck's side rail rather than the slope's image.
  const gateNorm = Math.hypot(.67, .47), gateCross: Point = [-.67 / gateNorm, .47 / gateNorm];
  const first = offset(hinge, gateCross, -half), second = offset(hinge, gateCross, half);
  const landing: [Point, Point, Point, Point] = [first, second, at(.045, 1), at(.045, -1)];
  polygon(c, landing, '#d7b57f', '#7f8057', .6); paintWorldQuad(c, 'wood', landing, -.02);
  for (const side of [-.8, .8]) {
    const mount = offset(hinge, gateCross, side * half);
    bolt(c, mount, 1.5);
  }
  for (const p of [first, second]) {
    line(c, p, [p[0], p[1] - 18], '#617454', 3.3); bolt(c, [p[0], p[1] - 18], 1.8);
  }
  const length = Math.hypot(entry[0] - hinge[0], entry[1] - hinge[1]) || 1;
  const end = open ? offset(first, [(entry[0] - hinge[0]) / length, (entry[1] - hinge[1]) / length], 30) : second;
  for (const height of [5, 15]) line(c, [first[0], first[1] - height], [end[0], end[1] - height], '#617454', 2.1);
  for (const t of [.2, .4, .6, .8]) { const p = mix(first, end, t); line(c, [p[0], p[1] - 5], [p[0], p[1] - 15], '#8d9c75', 1.4); }
  const sign = [first[0], first[1] - 26];
  c.fillStyle = '#fff0cf'; c.strokeStyle = '#b49d6d'; c.lineWidth = .7;
  c.beginPath(); c.roundRect(sign[0] - 7, sign[1] - 6, 14, 13, 2.5); c.fill(); c.stroke();
  c.fillStyle = '#536a43'; c.beginPath(); c.ellipse(sign[0], sign[1] + 1.5, 2.8, 2.3, 0, 0, Math.PI * 2); c.fill();
  for (const [x, y] of [[-3.5, -1], [-1.2, -2.8], [1.6, -2.8], [3.8, -.7]]) {
    c.beginPath(); c.ellipse(sign[0] + x, sign[1] + y, 1.2, 1.4, 0, 0, Math.PI * 2); c.fill();
  }
  c.restore();
  return { drawn: true, painted: true, linkId: PET_PASSAGE_LINK_ID, surface: 'ramp' as const, open, geometry,
    gatePoint: [hinge[0], hinge[1] - 16] as Point,
    gateBounds: { left: hinge[0] - half - 5, top: hinge[1] - half - 22, right: hinge[0] + half + 5, bottom: hinge[1] + half + 8 } };
}
