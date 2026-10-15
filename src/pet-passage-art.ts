import { getPetPassageGeometry, PET_PASSAGE_LINK_ID } from './pet-passage';
import { unprojectTruckPoint } from './truck-layout';

type Point = [number, number];
const offset = (p: Point, n: Point, amount: number): Point => [p[0] + n[0] * amount, p[1] + n[1] * amount];
const mix = (a: Point, b: Point, t: number): Point => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
function polygon(c: CanvasRenderingContext2D, points: Point[], fill: string, stroke = '', width = 1) {
  c.beginPath(); points.forEach((p, i) => i ? c.lineTo(...p) : c.moveTo(...p)); c.closePath();
  c.fillStyle = fill; c.fill();
  if (stroke && width > 0) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(); }
}
function line(c: CanvasRenderingContext2D, a: Point, b: Point, color: string, width: number) {
  c.beginPath(); c.moveTo(...a); c.lineTo(...b); c.strokeStyle = color; c.lineWidth = width; c.stroke();
}
function bolt(c: CanvasRenderingContext2D, p: Point, radius = 1) {
  c.fillStyle = '#c5a46a'; c.beginPath(); c.ellipse(p[0], p[1], radius, radius * .72, 0, 0, Math.PI * 2); c.fill();
  line(c, [p[0] - radius * .48, p[1]], [p[0] + radius * .48, p[1]], '#735d38', .45);
}

/** A short timber paw ramp mounted to the truck, in the same wood/green/brass
 * materials as the human steps. The deck already supports entry -> hinge: it
 * needs a small threshold, not a second ramp or a circular turning platform. */
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
  const half = geometry.width / 2, route = [...geometry.points].reverse();
  const hinge = geometry.hinge, entry = geometry.entry, firstFlight = route[2];
  const flightLength = Math.hypot(firstFlight[0] - hinge[0], firstFlight[1] - hinge[1]) || 1;
  const down: Point = [(firstFlight[0] - hinge[0]) / flightLength, (firstFlight[1] - hinge[1]) / flightLength];
  const cross: Point = [-down[1], down[0]];
  const groundPrevious = points[1], groundLength = Math.hypot(geometry.ground[0] - groundPrevious[0], geometry.ground[1] - groundPrevious[1]) || 1;
  const groundDown: Point = [(geometry.ground[0] - groundPrevious[0]) / groundLength, (geometry.ground[1] - groundPrevious[1]) / groundLength];
  const groundCross: Point = [-groundDown[1], groundDown[0]];
  c.save(); c.lineCap = 'round'; c.lineJoin = 'round';

  // Two narrow rubber feet plant the ramp on the road; there is no large
  // grey landing plate hiding the terrain underneath it.
  for (const side of [-1, 1]) {
    const foot = offset(geometry.ground, groundCross, side * (half - 6));
    c.fillStyle = 'rgba(34,42,30,.19)'; c.beginPath();
    c.ellipse(foot[0] + 1.5, foot[1] + 3, 10, 4, Math.atan2(groundCross[1], groundCross[0]), 0, Math.PI * 2); c.fill();
    const left = offset(foot, groundCross, -6), right = offset(foot, groundCross, 6);
    polygon(c, [offset(left, groundDown, -3), offset(right, groundDown, -3), offset(right, groundDown, 3), offset(left, groundDown, 3)], '#3a4436', '#28372c', .65);
  }

  // The first segment is existing deck. Only the outside flight gets timber;
  // this also keeps in-flight leased routes attached during a deck expansion.
  for (let index = 1; index < route.length - 1; index++) {
    const a = route[index], b = route[index + 1], length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (length < .001) continue;
    const n: Point = [-(b[1] - a[1]) / length, (b[0] - a[0]) / length];
    const at = (t: number, side: number, inset = 0): Point => offset(mix(a, b, t), n, side * (half - inset));
    const corners: [Point, Point, Point, Point] = [at(0, -1), at(0, 1), at(1, 1), at(1, -1)];

    // Visible side thickness makes this a light truck fitting, rather than a
    // flat slab pasted over the road. All 76 world pixels remain usable floor.
    for (const side of [-1, 1]) {
      const top = at(0, side), bottom = at(1, side);
      polygon(c, [top, bottom, [bottom[0], bottom[1] + 5], [top[0], top[1] + 5]], side === 1 ? '#244739' : '#395e4c', '#294735', .65);
    }
    polygon(c, corners, '#b79662', '#705d3d', .8);
    const plankCount = Math.max(3, Math.ceil(length / 13));
    for (let plank = 0; plank < plankCount; plank++) {
      const from = plank / plankCount, to = (plank + 1) / plankCount;
      const quad: Point[] = [at(from, -1, 2.5), at(from, 1, 2.5), at(to, 1, 2.5), at(to, -1, 2.5)];
      polygon(c, quad, ['#b79662', '#c2a06a', '#b18f59', '#bb9a63'][plank % 4]);
      line(c, quad[2], quad[3], 'rgba(88,65,34,.55)', .7);
      line(c, offset(quad[2], [0, -1], .8), offset(quad[3], [0, -1], .8), 'rgba(245,220,171,.55)', .65);
      // Fine, broken grain stays at the scale of these actual short boards.
      // No atlas is stretched down the full length of the slope.
      const middle = (from + to) / 2;
      line(c, at(middle, -1, 11 + plank % 3), at(middle + (to - from) * .12, 1, 19), 'rgba(110,77,39,.17)', .55);
      if (plank % 2 === 0) {
        const grip = at(to - (to - from) * .18, -1, 7), gripEnd = at(to - (to - from) * .18, 1, 7);
        line(c, [grip[0], grip[1] + 1], [gripEnd[0], gripEnd[1] + 1], '#8b6e43', 2.1);
        line(c, grip, gripEnd, '#d4b47d', 1.4);
        bolt(c, offset(grip, n, 3), .85); bolt(c, offset(gripEnd, n, -3), .85);
      }
    }
    // Low side guards keep the timber readable and leave the pets visible.
    for (const side of [-1, 1]) {
      const start = at(0, side, 1.5), end = at(1, side, 1.5);
      line(c, start, end, '#395e4c', 3);
      line(c, [start[0], start[1] - 1], [end[0], end[1] - 1], '#7b9572', .7);
      for (const t of [.1, .9]) {
        const foot = at(t, side, 1.5);
        line(c, foot, [foot[0], foot[1] - 8], '#395e4c', 2.1);
        bolt(c, [foot[0], foot[1] - 2], .85);
      }
      const first = at(.1, side, 1.5), last = at(.9, side, 1.5);
      line(c, [first[0], first[1] - 8], [last[0], last[1] - 8], '#395e4c', 1.8);
      line(c, [first[0], first[1] - 8.6], [last[0], last[1] - 8.6], '#c5a46a', .55);
    }
  }

  // A small hinged threshold meets the actual top of the flight. Nothing is
  // added along the full entry -> hinge path over the truck's existing deck.
  const sillA = offset(hinge, cross, -half), sillB = offset(hinge, cross, half);
  polygon(c, [offset(sillA, down, -4), offset(sillB, down, -4), offset(sillB, down, 4), offset(sillA, down, 4)], '#395e4c', '#244739', .8);
  line(c, offset(sillA, down, -3), offset(sillB, down, -3), '#93a286', .7);
  for (const side of [-1, 1]) {
    const mount = offset(hinge, cross, side * (half - 9));
    line(c, offset(mount, down, -5), offset(mount, down, 5), '#c5a46a', 4);
    bolt(c, mount, 1.1);
  }

  // The gate swings beside the opening, rather than leaving a fence across
  // the active route. Its position and scene hit contract stay at the hinge.
  const first = offset(hinge, cross, -half + 2), second = offset(hinge, cross, half - 2);
  for (const post of [first, second]) {
    polygon(c, [[post[0] - 1.8, post[1]], [post[0] + 1.8, post[1]], [post[0] + 1.8, post[1] - 18], [post[0] - 1.8, post[1] - 18]], '#395e4c', '#244739', .65);
    c.fillStyle = '#c5a46a'; c.beginPath(); c.ellipse(post[0], post[1] - 18.5, 2.4, 1.4, 0, 0, Math.PI * 2); c.fill();
    bolt(c, [post[0], post[1] - 4], .85);
  }
  const deckLength = Math.hypot(entry[0] - hinge[0], entry[1] - hinge[1]) || 1;
  const gateEnd: Point = open ? offset(first, [(entry[0] - hinge[0]) / deckLength, (entry[1] - hinge[1]) / deckLength], 32) : second;
  for (const height of [5, 15]) {
    line(c, [first[0], first[1] - height], [gateEnd[0], gateEnd[1] - height], '#395e4c', 2.3);
    line(c, [first[0], first[1] - height - .6], [gateEnd[0], gateEnd[1] - height - .6], '#91a47e', .65);
  }
  for (let amount = .2; amount < 1; amount += .2) {
    const p = mix(first, gateEnd, amount);
    line(c, [p[0], p[1] - 5], [p[0], p[1] - 15], '#527358', 1.6);
  }
  bolt(c, [first[0], first[1] - 15], 1.1);
  const latch = mix(first, gateEnd, .9);
  line(c, [latch[0], latch[1] - 11], [latch[0] + 3, latch[1] - 11], '#c5a46a', 1.5);

  // The cream paw plaque belongs to the fitting, not to the HUD.
  const sign: Point = [first[0], first[1] - 25];
  c.fillStyle = '#f1e4bc'; c.strokeStyle = '#8d7953'; c.lineWidth = .8;
  c.beginPath(); c.roundRect(sign[0] - 7, sign[1] - 6, 14, 13, 2.5); c.fill(); c.stroke();
  c.fillStyle = '#395e4c'; c.beginPath(); c.ellipse(sign[0], sign[1] + 1.5, 2.8, 2.3, 0, 0, Math.PI * 2); c.fill();
  for (const [x, y] of [[-3.5, -1], [-1.2, -2.8], [1.6, -2.8], [3.8, -.7]]) {
    c.beginPath(); c.ellipse(sign[0] + x, sign[1] + y, 1.2, 1.4, 0, 0, Math.PI * 2); c.fill();
  }
  c.restore();
  return { drawn: true, painted: true, linkId: PET_PASSAGE_LINK_ID, surface: 'ramp' as const, open, geometry,
    gatePoint: [hinge[0], hinge[1] - 16] as Point, gateBounds: { left: hinge[0] - 43, top: hinge[1] - 62, right: hinge[0] + 43, bottom: hinge[1] + 27 } };
}
