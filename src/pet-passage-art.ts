import { getPetPassageGeometry, PET_PASSAGE_LINK_ID } from './pet-passage';
import { paintWorldQuad } from './world-art';
import { unprojectTruckPoint } from './truck-layout';
type Point = [number, number];
const offset = (p: Point, n: Point, amount: number): Point => [p[0] + n[0] * amount, p[1] + n[1] * amount];
function polygon(c: CanvasRenderingContext2D, points: Point[], fill: string, stroke = '#655540', width = 1.6) {
  c.beginPath(); points.forEach((p, i) => i ? c.lineTo(...p) : c.moveTo(...p)); c.closePath();
  c.fillStyle = fill; c.fill();
  if (stroke && width > 0) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(); }
}
function line(c: CanvasRenderingContext2D, a: Point, b: Point, color: string, width: number) {
  c.beginPath(); c.moveTo(...a); c.lineTo(...b); c.strokeStyle = color; c.lineWidth = width; c.stroke();
}
/** A low, truck-mounted timber gangway. Short individually painted planks keep
 * the deck material at its authored scale instead of stretching an entire atlas
 * patch down the flight. The unchanged full-width floor carries every pet. */
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
  // The landing has a small contact shadow rather than an opaque second ramp.
  c.fillStyle = 'rgba(34,42,30,.16)'; c.beginPath();
  c.ellipse(geometry.ground[0] + 3, geometry.ground[1] + 5, half + 5, 11, -.08, 0, Math.PI * 2); c.fill();
  // The full paw turn floor sits underneath both flights. Only the little
  // outside corner stays visible, rather than a round platform covering them.
  for (const point of route.slice(1, -1)) {
    c.save(); c.fillStyle = 'rgba(34,42,30,.10)'; c.beginPath(); c.ellipse(point[0] + 2, point[1] + 4, half + 1, half + 1, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(point[0], point[1], half, half, 0, 0, Math.PI * 2); c.fillStyle = '#b0a185'; c.fill();
    c.clip();
    for (let y = -half; y < half; y += 14) {
      const bottom = Math.min(half, y + 14);
      const cap: [Point, Point, Point, Point] = [[point[0] - half, point[1] + y], [point[0] + half, point[1] + y],
        [point[0] + half, point[1] + bottom], [point[0] - half, point[1] + bottom]];
      c.save(); c.globalAlpha *= .17; painted = paintWorldQuad(c, 'wood', cap, .08) && painted; c.restore();
      line(c, cap[2], cap[3], 'rgba(65,67,49,.27)', .7);
    }
    c.restore();
  }
  for (let index = 0; index < route.length - 1; index++) {
    const a = route[index], b = route[index + 1], length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (length < .001) continue;
    const n: Point = [-(b[1] - a[1]) / length, (b[0] - a[0]) / length];
    const at = (amount: number, side: number, inset = 0): Point => offset([
      a[0] + (b[0] - a[0]) * amount, a[1] + (b[1] - a[1]) * amount,
    ], n, side * (half - inset));
    const corners: [Point, Point, Point, Point] = [offset(a, n, -half), offset(a, n, half), offset(b, n, half), offset(b, n, -half)];
    polygon(c, corners.map(p => [p[0] + 4, p[1] + 8] as Point), 'rgba(34,42,30,.12)', '', 0);
    polygon(c, corners.map(p => [p[0], p[1] + 4] as Point), '#596454', '#485345', .7);
    polygon(c, corners, '#b0a185', '#6b6b55', .85);
    const count = Math.max(2, Math.ceil(length / 15));
    for (let plank = 0; plank < count; plank++) {
      const from = plank / count, to = (plank + 1) / count;
      const quad: [Point, Point, Point, Point] = [at(from, -1, 3), at(from, 1, 3), at(to, 1, 3), at(to, -1, 3)];
      polygon(c, quad, ['#aaa083', '#b2a58a', '#a69a7f', '#ada188'][plank % 4], '', 0);
      c.save(); c.globalAlpha *= .17;
      painted = paintWorldQuad(c, 'wood', quad, .08) && painted;
      c.restore();
      line(c, quad[2], quad[3], 'rgba(65,67,49,.44)', .8);
      line(c, [quad[2][0], quad[2][1] - .8], [quad[3][0], quad[3][1] - .8], 'rgba(224,216,185,.48)', .65);
      // A quiet cross-grain line and paired bolts read as built timber without
      // competing with the painted pets or making the path look like a ladder.
      if (plank % 2 === 0) {
        line(c, at((from + to) / 2, -1, 10), at((from + to) / 2, 1, 16), 'rgba(77,75,54,.15)', .65);
        for (const side of [-1, 1]) {
          const bolt = at((from + to) / 2, side, 7);
          c.beginPath(); c.ellipse(...bolt, .9, .7, 0, 0, Math.PI * 2); c.fillStyle = '#66725d'; c.fill();
        }
      }
    }
    // Slim sage metal sills, with a pale top edge, sit below the pets' bodies.
    for (const side of [-1, 1]) {
      const from = offset(a, n, side * (half - 2)), to = offset(b, n, side * (half - 2));
      line(c, from, to, '#52685b', 3);
      line(c, [from[0], from[1] - 2], [to[0], to[1] - 2], '#bcc2a7', .85);
      // Two small stanchions and an ankle-height rail make the sloping flight
      // legible without a large fence floating above the painted truck.
      if (index === route.length - 2) {
        for (const amount of [.08, .88]) {
          const foot = at(amount, side, 2);
          line(c, foot, [foot[0], foot[1] - 9], '#52685b', 2.1);
        }
        const first = at(.08, side, 2), last = at(.88, side, 2);
        line(c, [first[0], first[1] - 9], [last[0], last[1] - 9], '#647866', 2);
        line(c, [first[0], first[1] - 9.8], [last[0], last[1] - 9.8], '#b3bda0', .6);
      }
    }
  }
  const a = geometry.hinge, b = geometry.entry, length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const n: Point = [-(b[1] - a[1]) / length, (b[0] - a[0]) / length];
  const first = offset(a, n, -half + 3), second = offset(a, n, half - 3);
  for (const post of [first, second]) {
    polygon(c, [[post[0] - 1.8, post[1]], [post[0] + 1.8, post[1]], [post[0] + 1.8, post[1] - 18], [post[0] - 1.8, post[1] - 18]], '#647b68', '#4d6153', .7);
    c.fillStyle = '#bcb89a'; c.beginPath(); c.ellipse(post[0], post[1] - 18.5, 2.5, 1.5, 0, 0, Math.PI * 2); c.fill();
  }
  const gateEnd: Point = open ? [first[0] - (b[0] - a[0]) / length * 32, first[1] - (b[1] - a[1]) / length * 32] : second;
  for (const height of [6, 15]) {
    line(c, [first[0], first[1] - height], [gateEnd[0], gateEnd[1] - height], '#6e7c62', 2.3);
    line(c, [first[0], first[1] - height - .5], [gateEnd[0], gateEnd[1] - height - .5], '#bec3a5', .65);
  }
  for (let amount = .2; amount < 1; amount += .2) {
    const x = first[0] + (gateEnd[0] - first[0]) * amount, y = first[1] + (gateEnd[1] - first[1]) * amount;
    line(c, [x, y - 4], [x, y - 16], '#78896d', 1.8);
  }
  // A small paw sign communicates who can use this route without a UI overlay.
  const sign: Point = [first[0], first[1] - 25];
  c.fillStyle = '#dbd3b8'; c.strokeStyle = '#72816a'; c.lineWidth = .9;
  c.beginPath(); c.roundRect(sign[0] - 8, sign[1] - 7, 16, 15, 3); c.fill(); c.stroke();
  c.fillStyle = '#607465'; c.beginPath(); c.ellipse(sign[0], sign[1] + 2, 3.2, 2.6, 0, 0, Math.PI * 2); c.fill();
  for (const [x, y] of [[-4, -1], [-1.4, -3], [1.9, -3], [4.4, -.7]]) { c.beginPath(); c.ellipse(sign[0] + x, sign[1] + y, 1.35, 1.65, 0, 0, Math.PI * 2); c.fill(); }
  c.restore();
  return { drawn: true, painted, linkId: PET_PASSAGE_LINK_ID, surface: 'ramp' as const, open, geometry,
    gatePoint: [a[0], a[1] - 16] as Point, gateBounds: { left: a[0] - 43, top: a[1] - 62, right: a[0] + 43, bottom: a[1] + 27 } };
}
