import { paintWorldQuad, worldArtReady } from './world-art';

export type AccessStairPoint = [number, number];
type Quad = [AccessStairPoint, AccessStairPoint, AccessStairPoint, AccessStairPoint];
export interface AccessStairOptions {
  width?: number; rise?: number; treadCount?: number; cross?: AccessStairPoint;
  /** Shared ground -> flight -> landing -> gate -> deck walk centreline. */
  points?: readonly AccessStairPoint[];
  landingQuad?: Quad;
}
function polygon(c: CanvasRenderingContext2D, points: readonly AccessStairPoint[], fill: string, stroke = '', width = 1) {
  c.beginPath(); points.forEach((point, index) => index ? c.lineTo(...point) : c.moveTo(...point)); c.closePath();
  c.fillStyle = fill; c.fill();
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(); }
}
function line(c: CanvasRenderingContext2D, a: AccessStairPoint, b: AccessStairPoint, color: string, width: number) {
  c.beginPath(); c.moveTo(...a); c.lineTo(...b); c.strokeStyle = color; c.lineWidth = width; c.stroke();
}
const mix = (a: AccessStairPoint, b: AccessStairPoint, t: number): AccessStairPoint => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const lowered = (a: AccessStairPoint, drop: number): AccessStairPoint => [a[0], a[1] + drop];
const FINISH = {
  wood: ['#d9ae71', '#e2bb80', '#ce9f62'], woodEdge: '#ffe0a0',
  riser: '#ac7a44', riserShade: '#805936', grain: 'rgba(105,66,32,.17)',
  green: '#49694c', greenShade: '#2e4936', greenLight: '#9ba77a',
  brass: '#d7b46c', bolt: '#74623d', rubber: '#343f31',
};

/** The stair is a built object: horizontal wooden treads, vertical risers, two
 * olive stringers and a supported flat corner landing. The height is never
 * baked into the width axis, so the landing cannot turn into a standing panel. */
export function drawTruckAccessStairs(c: CanvasRenderingContext2D, top: AccessStairPoint, bottom: AccessStairPoint,
  options: AccessStairOptions = {}) {
  const width = Math.max(48, Math.min(128, options.width ?? 76)), half = width / 2,
    path = options.points, flightTop: AccessStairPoint = path && path.length >= 5 ? path[1] : top,
    flightBottom: AccessStairPoint = path && path.length >= 3 ? path[0] : bottom,
    length = Math.hypot(flightBottom[0] - flightTop[0], flightBottom[1] - flightTop[1]);
  if (length < .001) return { drawn: false, painted: false, width, top, bottom, treadQuads: [] as Quad[] };
  const rise = Math.max(0, options.rise ?? 95), count = Math.max(6, Math.min(12, options.treadCount ?? 8)),
    stepRise = rise / count, run: AccessStairPoint = [flightBottom[0] - flightTop[0], flightBottom[1] - flightTop[1] - rise],
    cross = options.cross ?? [.91, .34] as AccessStairPoint, norm = Math.hypot(...cross) || 1,
    across: AccessStairPoint = [half * cross[0] / norm, half * cross[1] / norm];
  const point = (runAmount: number, drop: number, side = 0, lift = 0): AccessStairPoint => [
    flightTop[0] + run[0] * runAmount + across[0] * side,
    flightTop[1] + run[1] * runAmount + drop + across[1] * side - lift,
  ];
  const foot = (amount: number, side: number, lift = 0) => point(amount, rise * amount, side, lift);
  const bolt = (at: AccessStairPoint, radius = 1) => {
    c.beginPath(); c.ellipse(at[0], at[1], radius, radius * .65, .34, 0, Math.PI * 2); c.fillStyle = FINISH.brass; c.fill();
    line(c, [at[0] - radius * .3, at[1]], [at[0] + radius * .3, at[1]], FINISH.bolt, .4);
  };
  const treadQuads: Quad[] = [], painted = worldArtReady(), landingQuad = options.landingQuad;
  c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
  // Soft contact shadows stay on the road, below both support feet and landing.
  polygon(c, [point(0, rise, -1.08, -4), point(0, rise, 1.08, -4),
    point(1.09, rise, 1.08, -4), point(1.09, rise, -1.08, -4)], 'rgba(35,48,30,.13)');
  if (landingQuad) polygon(c, landingQuad.map(p => lowered(p, rise + 5)), 'rgba(35,48,30,.10)');

  const railPiece = (a: AccessStairPoint, b: AccessStairPoint, subdivisions: number, height = 27) => {
    for (let index = 0; index <= subdivisions; index++) {
      const base = mix(a, b, index / subdivisions), head = lowered(base, -height);
      line(c, lowered(base, 3), head, FINISH.greenShade, 3.5);
      line(c, [base[0] - .6, base[1]], [head[0] - .6, head[1]], FINISH.greenLight, .8);
      bolt(lowered(base, 1.5), 1.25);
    }
    const aHead = lowered(a, -height), bHead = lowered(b, -height);
    line(c, aHead, bHead, FINISH.greenShade, 4.4);
    line(c, lowered(aHead, -.7), lowered(bHead, -.7), '#bc9258', 2.3);
    line(c, lowered(a, -height * .46), lowered(b, -height * .46), FINISH.green, 1.8);
  };

  if (landingQuad) {
    const [outerBack, innerBack, innerFront, outerFront] = landingQuad;
    // Real legs meet the road; the deck-side edge bolts to the truck frame.
    for (const leg of [outerBack, outerFront]) {
      const base = lowered(leg, rise), head = lowered(leg, 5);
      line(c, base, head, FINISH.greenShade, 5);
      line(c, [base[0] - .6, base[1]], [head[0] - .6, head[1]], FINISH.greenLight, 1.1);
      polygon(c, [[base[0]-6,base[1]-2],[base[0]+5,base[1]+1],[base[0]+4,base[1]+4],[base[0]-7,base[1]+1]], FINISH.rubber);
      bolt(lowered(leg, 8), 1.5);
    }
    line(c, lowered(outerBack, 9), lowered(outerFront, rise - 7), FINISH.green, 2.8);
    polygon(c, [outerBack, innerBack, lowered(innerBack, 7), lowered(outerBack, 7)], FINISH.riserShade, FINISH.greenShade, .7);
    polygon(c, [outerFront, innerFront, lowered(innerFront, 7), lowered(outerFront, 7)], FINISH.riser, FINISH.greenShade, .7);
    polygon(c, [outerBack, outerFront, lowered(outerFront, 7), lowered(outerBack, 7)], FINISH.green, FINISH.greenShade, .8);
    polygon(c, landingQuad, '#dabb83', '#8d704b', .7);
    paintWorldQuad(c, 'wood', landingQuad, -.02); polygon(c, landingQuad, 'rgba(255,231,179,.10)');
    for (const amount of [.22, .47, .72]) line(c, mix(outerBack, outerFront, amount), mix(innerBack, innerFront, amount), 'rgba(104,72,36,.21)', .6);
    line(c, outerFront, innerFront, FINISH.woodEdge, 1.4);
    // The front edge is open exactly where the flight joins the landing.
    railPiece(outerBack, innerBack, 2);
    railPiece(outerBack, outerFront, 1);
    const flightNear = point(0, 0, 1);
    if (Math.hypot(innerFront[0]-flightNear[0],innerFront[1]-flightNear[1])>9) railPiece(flightNear, innerFront, 1);
  }

  // Paired sloping metal stringers support the individual horizontal boards.
  for (const side of [-1, 1]) {
    polygon(c, [foot(0, side * 1.035, -1), foot(1, side * 1.035, -1),
      foot(1, side * 1.035, -10), foot(0, side * 1.035, -10)], FINISH.greenShade, '#263e2d', .65);
    line(c, foot(0, side * 1.035, -1), foot(1, side * 1.035, -1), FINISH.greenLight, 1.2);
  }
  railPiece(foot(0, -1.05), foot(1, -1.05), 3);
  for (let index = 0; index < count; index++) {
    const from = index / count, to = (index + 1) / count, drop = index * stepRise,
      tread: Quad = [point(from, drop, -1), point(from, drop, 1), point(to, drop, 1), point(to, drop, -1)];
    polygon(c, [point(to, drop, -1), point(to, drop, 1), point(to, drop + stepRise, 1), point(to, drop + stepRise, -1)], FINISH.riser, FINISH.riserShade, .6);
    line(c, point(to, drop + stepRise - 2.5, -.93), point(to, drop + stepRise - 2.5, .93), 'rgba(86,57,30,.21)', 1);
    polygon(c, tread, FINISH.wood[index % FINISH.wood.length], '#8f7149', .55);
    paintWorldQuad(c, 'wood', tread, index % 2 ? -.025 : .015);
    polygon(c, tread, 'rgba(255,232,186,.10)');
    for (const amount of [.28, .67]) {
      const at = from + (to - from) * amount, a = point(at, drop, -.84), b = point(at, drop, .82);
      c.beginPath(); c.moveTo(...a); c.bezierCurveTo(a[0] + across[0] * .46, a[1] + across[1] * .46 - .4,
        b[0] - across[0] * .42, b[1] - across[1] * .42 + .4, ...b); c.strokeStyle = FINISH.grain; c.lineWidth = .5; c.stroke();
    }
    line(c, tread[2], tread[3], FINISH.woodEdge, 1.25);
    for (const side of [-.87, .87]) bolt(point(from + (to - from) * .5, drop, side), .85);
    treadQuads.push(tread);
  }
  for (const side of [-1.05, 1.05]) {
    const a = foot(1, side), b = foot(1.08, side);
    polygon(c, [[a[0]-5,a[1]-1],[a[0]+5,a[1]+2],[b[0]+5,b[1]+3],[b[0]-5,b[1]]], FINISH.rubber, '#49513b', .6);
    bolt(foot(.98, side, -3), 1.2);
  }
  railPiece(foot(0, 1.05), foot(1, 1.05), 3);
  c.restore();
  return { drawn: true, painted, width, top: [...top] as AccessStairPoint, bottom: [...bottom] as AccessStairPoint,
    flightTop: [...flightTop] as AccessStairPoint, treadQuads, ...(landingQuad ? { landingQuad } : {}) };
}
