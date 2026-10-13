import { getPetPassageGeometry, PET_PASSAGE_LINK_ID } from './pet-passage';
import { paintWorldQuad } from './world-art';
import { unprojectTruckPoint } from './truck-layout';
type Point = [number, number];
const offset = (p: Point, n: Point, amount: number): Point => [p[0] + n[0] * amount, p[1] + n[1] * amount];
function polygon(c: CanvasRenderingContext2D, points: Point[], fill: string, stroke = '#655540', width = 1.6) {
  c.beginPath(); points.forEach((p, i) => i ? c.lineTo(...p) : c.moveTo(...p)); c.closePath();
  c.fillStyle = fill; c.fill(); c.strokeStyle = stroke; c.lineWidth = width; c.stroke();
}
/** Original geometry uses the same painted wood as the truck's live deck. */
export function drawPetPassage(c: CanvasRenderingContext2D, level: number, open: boolean, options: { points?: readonly Point[] } = {}) {
  const base = getPetPassageGeometry(level);
  const points = options.points && options.points.length >= 3 && options.points.every(point => point.length === 2 && point.every(Number.isFinite))
    ? options.points.map(point => [...point] as Point) : base.points;
  const geometry = { ...base, points, ground: points[0], hinge: points[points.length - 2], entry: points[points.length - 1],
    entryUV: unprojectTruckPoint(points[points.length - 1]), hingeUV: unprojectTruckPoint(points[points.length - 2]),
    bounds: { left: Math.min(...points.map(p => p[0])) - base.width / 2,
      top: Math.min(...points.map(p => p[1])) - base.width / 2 - 32,
      right: Math.max(...points.map(p => p[0])) + base.width / 2,
      bottom: Math.max(...points.map(p => p[1])) + base.width / 2 } };
  const route = [...geometry.points].reverse(), half = geometry.width / 2;
  let painted = true;
  c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
  for (let index = 0; index < route.length - 1; index++) {
    const a = route[index], b = route[index + 1], length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n: Point = [-(b[1] - a[1]) / length, (b[0] - a[0]) / length];
    const corners: [Point, Point, Point, Point] = [offset(a, n, -half), offset(a, n, half), offset(b, n, half), offset(b, n, -half)];
    const shadow = corners.map(p => [p[0] + 3, p[1] + 5] as Point);
    polygon(c, shadow, 'rgba(47,44,30,.12)', 'rgba(47,44,30,.04)', .4);
    polygon(c, corners.map(p => [p[0], p[1] + 3] as Point), '#75684d', '', 0);
    polygon(c, corners, '#c3a16e', '#8c7656', .85); painted = paintWorldQuad(c, 'wood', corners, .015) && painted;
    c.strokeStyle = 'rgba(112,86,54,.3)'; c.lineWidth = .85;
    for (let distance = 18; distance < length; distance += 20) {
      const p: Point = [a[0] + (b[0] - a[0]) * distance / length, a[1] + (b[1] - a[1]) * distance / length];
      c.beginPath(); c.moveTo(...offset(p, n, -half + 3)); c.lineTo(...offset(p, n, half - 3)); c.stroke();
    }
    // Low raised edges preserve the painted paw silhouette on the wide walkway.
    for (const side of [-1, 1]) {
      const from = offset(a, n, side * (half - 2)), to = offset(b, n, side * (half - 2));
      c.beginPath(); c.moveTo(from[0], from[1] - 3); c.lineTo(to[0], to[1] - 3);
      c.strokeStyle = '#668074'; c.lineWidth = 2.6; c.stroke();
      c.strokeStyle = '#bbc6a8'; c.lineWidth = .7; c.stroke();
    }
  }
  // Full paw circles need wood beyond the outer corner of perpendicular flights.
  // These open junctions soften the rail ends without fencing across a turn.
  for (const point of route.slice(1, -1)) {
    c.save(); c.fillStyle = 'rgba(47,44,30,.10)'; c.beginPath(); c.ellipse(point[0] + 3, point[1] + 5, half + 1, half + 1, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(point[0], point[1], half, half, 0, 0, Math.PI * 2); c.fillStyle = '#c3a16e'; c.fill();
    c.clip();
    const cap: [Point, Point, Point, Point] = [[point[0] - half, point[1] - half], [point[0] + half, point[1] - half],
      [point[0] + half, point[1] + half], [point[0] - half, point[1] + half]];
    painted = paintWorldQuad(c, 'wood', cap, .015) && painted;
    c.restore();
  }
  const a = geometry.hinge, b = geometry.entry, length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const n: Point = [-(b[1] - a[1]) / length, (b[0] - a[0]) / length];
  const first = offset(a, n, -half + 3), second = offset(a, n, half - 3);
  for (const post of [first, second]) {
    polygon(c, [[post[0] - 2, post[1]], [post[0] + 2, post[1]], [post[0] + 2, post[1] - 22], [post[0] - 2, post[1] - 22]], '#718a78', '#5d7567', .7);
    c.fillStyle = '#d7c998'; c.beginPath(); c.ellipse(post[0], post[1] - 23, 3.4, 2.2, 0, 0, Math.PI * 2); c.fill();
  }
  const gateEnd: Point = open ? [first[0] - (b[0] - a[0]) / length * 46, first[1] - (b[1] - a[1]) / length * 46] : second;
  for (const height of [8, 18]) {
    c.beginPath(); c.moveTo(first[0], first[1] - height); c.lineTo(gateEnd[0], gateEnd[1] - height);
    c.strokeStyle = '#a0885f'; c.lineWidth = 3; c.stroke(); c.strokeStyle = '#e3cba1'; c.lineWidth = .8; c.stroke();
  }
  for (let amount = .2; amount < 1; amount += .2) {
    const x = first[0] + (gateEnd[0] - first[0]) * amount, y = first[1] + (gateEnd[1] - first[1]) * amount;
    c.beginPath(); c.moveTo(x, y - 5); c.lineTo(x, y - 20); c.strokeStyle = '#79927b'; c.lineWidth = 2.4; c.stroke();
  }
  // A small paw sign communicates who can use this route without a UI overlay.
  const sign: Point = [geometry.entry[0] + 12, geometry.entry[1] - 35];
  c.fillStyle = '#f0ddb5'; c.strokeStyle = '#8d754d'; c.lineWidth = 1.3;
  c.beginPath(); c.roundRect(sign[0] - 12, sign[1] - 12, 24, 24, 5); c.fill(); c.stroke();
  c.fillStyle = '#607465'; c.beginPath(); c.ellipse(sign[0], sign[1] + 3, 5, 4, 0, 0, Math.PI * 2); c.fill();
  for (const [x, y] of [[-6, -2], [-2, -5], [3, -5], [7, -1]]) { c.beginPath(); c.ellipse(sign[0] + x, sign[1] + y, 2.1, 2.6, 0, 0, Math.PI * 2); c.fill(); }
  c.restore();
  return { drawn: true, painted, linkId: PET_PASSAGE_LINK_ID, surface: 'ramp' as const, open, geometry,
    gatePoint: [a[0], a[1] - 16] as Point, gateBounds: { left: a[0] - 43, top: a[1] - 62, right: a[0] + 43, bottom: a[1] + 27 } };
}
