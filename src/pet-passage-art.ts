import { getPetPassageGeometry, PET_PASSAGE_LINK_ID } from './pet-passage';
import { unprojectTruckPoint } from './truck-layout';

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
    }, roadAt = (t: number, side: number): Point => {
      const p = at(t, side); return [p[0], p[1] + base.rise * (1 - t)];
    };
  c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
  // Road shadow, upright supports and diagonal stays establish the real height.
  polygon(c, [roadAt(.08, -1), roadAt(.08, 1), roadAt(1.06, 1), roadAt(1.06, -1)], 'rgba(43,55,32,.10)');
  for (const t of [.58, .9]) {
    for (const side of [-.88, .88]) {
      const top = at(t, side, -4), foot = roadAt(t, side);
      c.fillStyle = 'rgba(40,48,30,.16)'; c.beginPath(); c.ellipse(foot[0], foot[1] + 2, 8, 3.2, 0, 0, Math.PI * 2); c.fill();
      line(c, top, foot, '#294b3b', 3.2);
      line(c, [top[0] - .5, top[1]], [foot[0] - .5, foot[1]], '#7c9070', .7);
      line(c, offset(foot, cross, -5), offset(foot, cross, 5), '#303d30', 3.5);
      bolt(c, top, 1.2);
      if (t === .58) line(c, at(.25, side, -4), foot, '#49664d', 2.1);
    }
    line(c, roadAt(t, -.88), roadAt(t, .88), '#3f5d42', 2.3);
  }
  for (const side of [-1, 1]) {
    const a = at(0, side), b = at(1, side);
    polygon(c, [a, b, [b[0], b[1] + 5], [a[0], a[1] + 5]], '#294b3b', '#263e30', .65);
  }
  polygon(c, [at(0, -1), at(0, 1), at(1, 1), at(1, -1)], '#b79662', '#76603d', .8);
  const boards = Math.max(8, Math.ceil(Math.hypot(ground[0] - hinge[0], ground[1] - hinge[1]) / 13));
  for (let index = 0; index < boards; index++) {
    const a = index / boards, b = (index + 1) / boards;
    polygon(c, [at(a, -.96), at(a, .96), at(b, .96), at(b, -.96)], ['#bc9a62', '#c4a46d', '#b2915a'][index % 3]);
    line(c, at(b, -.96), at(b, .96), 'rgba(89,66,35,.48)', .6);
    line(c, at((a + b) / 2, -.78), at((a + b) / 2 + .003, .65), 'rgba(99,71,34,.15)', .45);
    if (index % 2 === 1) {
      const t = b - (b - a) * .17;
      line(c, at(t, -.86, .2), at(t, .86, .2), '#8b7049', 2.6);
      line(c, at(t, -.86, 1.2), at(t, .86, 1.2), '#dec08b', 1.2);
      bolt(c, at(t, -.82, 1.5), .8); bolt(c, at(t, .82, 1.5), .8);
    }
  }
  // Low open rails leave pets visible, while the paws share the same centreline.
  for (const side of [-1, 1]) {
    line(c, at(0, side), at(1, side), '#3d6047', 2.7);
    for (const t of [.04, .47, .94]) line(c, at(t, side), at(t, side, 11), '#3c6047', 2);
    line(c, at(.04, side, 11), at(.94, side, 11), '#4a6b4e', 2);
    line(c, at(.04, side, 11.6), at(.94, side, 11.6), '#bfaa77', .55);
  }
  // The deck gate follows the truck's side rail rather than the slope's image.
  const gateNorm = Math.hypot(.67, .47), gateCross: Point = [-.67 / gateNorm, .47 / gateNorm];
  const first = offset(hinge, gateCross, -half), second = offset(hinge, gateCross, half);
  polygon(c, [first, second, at(.045, 1), at(.045, -1)], '#bfa06a', '#49614a', .7);
  for (const side of [-.8, .8]) {
    const mount = offset(hinge, gateCross, side * half);
    bolt(c, mount, 1.5);
  }
  for (const p of [first, second]) {
    line(c, p, [p[0], p[1] - 18], '#3a5c46', 3.3); bolt(c, [p[0], p[1] - 18], 1.8);
  }
  const length = Math.hypot(entry[0] - hinge[0], entry[1] - hinge[1]) || 1;
  const end = open ? offset(first, [(entry[0] - hinge[0]) / length, (entry[1] - hinge[1]) / length], 30) : second;
  for (const height of [5, 15]) line(c, [first[0], first[1] - height], [end[0], end[1] - height], '#496a4f', 2.1);
  for (const t of [.2, .4, .6, .8]) { const p = mix(first, end, t); line(c, [p[0], p[1] - 5], [p[0], p[1] - 15], '#688160', 1.4); }
  const sign = [first[0], first[1] - 26];
  c.fillStyle = '#f1e4bc'; c.strokeStyle = '#8d7953'; c.lineWidth = .7;
  c.beginPath(); c.roundRect(sign[0] - 7, sign[1] - 6, 14, 13, 2.5); c.fill(); c.stroke();
  c.fillStyle = '#43634b'; c.beginPath(); c.ellipse(sign[0], sign[1] + 1.5, 2.8, 2.3, 0, 0, Math.PI * 2); c.fill();
  for (const [x, y] of [[-3.5, -1], [-1.2, -2.8], [1.6, -2.8], [3.8, -.7]]) {
    c.beginPath(); c.ellipse(sign[0] + x, sign[1] + y, 1.2, 1.4, 0, 0, Math.PI * 2); c.fill();
  }
  c.restore();
  return { drawn: true, painted: true, linkId: PET_PASSAGE_LINK_ID, surface: 'ramp' as const, open, geometry,
    gatePoint: [hinge[0], hinge[1] - 16] as Point,
    gateBounds: { left: hinge[0] - half - 5, top: hinge[1] - half - 22, right: hinge[0] + half + 5, bottom: hinge[1] + half + 8 } };
}
