import { worldArtReady } from './world-art';

export type AccessStairPoint = [number, number];
type Quad = [AccessStairPoint, AccessStairPoint, AccessStairPoint, AccessStairPoint];
function polygon(c: CanvasRenderingContext2D, points: readonly AccessStairPoint[], fill: string, stroke = '', width = 1) {
  c.beginPath(); points.forEach((point, index) => index ? c.lineTo(...point) : c.moveTo(...point)); c.closePath();
  c.fillStyle = fill; c.fill();
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(); }
}
function line(c: CanvasRenderingContext2D, a: AccessStairPoint, b: AccessStairPoint, color: string, width: number) {
  c.beginPath(); c.moveTo(...a); c.lineTo(...b); c.strokeStyle = color; c.lineWidth = width; c.stroke();
}

const FINISH = {
  wood: ['#b79662', '#c7a46b', '#ac884f'],
  woodEdge: '#ddbc80', riser: '#7b613d', grain: 'rgba(93,63,31,.25)',
  green: '#395e4c', greenShade: '#244739', greenLight: '#7e9073',
  brass: '#c5a46a', bolt: '#645638', rubber: '#30372d',
};

/** Six horizontal treads and separate vertical risers fold out from the truck.
 * The planar run excludes the deck height: no board spans the whole slope. */
export function drawTruckAccessStairs(c: CanvasRenderingContext2D, top: AccessStairPoint, bottom: AccessStairPoint,
  options: { width?: number; rise?: number } = {}) {
  const width = Math.max(40, Math.min(56, options.width ?? 42)), half = width / 2,
    length = Math.hypot(bottom[0] - top[0], bottom[1] - top[1]);
  if (length < .001) return { drawn: false, painted: false, width, top, bottom, treadQuads: [] as Quad[] };
  const rise = Math.max(0, options.rise ?? 95), count = 6, stepRise = rise / count,
    run: AccessStairPoint = [bottom[0] - top[0], bottom[1] - top[1] - rise],
    slope = .34 / .91, norm = Math.hypot(1, slope), across: AccessStairPoint = [half / norm, half * slope / norm];
  const point = (runAmount: number, drop: number, side = 0, lift = 0): AccessStairPoint => [
    top[0] + run[0] * runAmount + across[0] * side,
    top[1] + run[1] * runAmount + drop + across[1] * side + lift,
  ];
  const foot = (amount: number, side: number, lift = 0) => point(amount, rise * amount, side, lift);
  const bolt = (at: AccessStairPoint, radius = 1) => {
    c.beginPath(); c.ellipse(at[0], at[1], radius, radius * .64, .34, 0, Math.PI * 2);
    c.fillStyle = FINISH.brass; c.fill();
    line(c, [at[0] - radius * .35, at[1]], [at[0] + radius * .35, at[1]], FINISH.bolt, .4);
  };
  const treadQuads: Quad[] = [], painted = worldArtReady();
  c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
  // The shadow lies on the road plane, beneath the open metal frame.
  polygon(c, [point(.08, rise, -1.03, 3), point(.08, rise, 1.03, 3),
    point(1.1, rise, 1.03, 3), point(1.1, rise, -1.03, 3)], 'rgba(37,46,28,.10)');
  polygon(c, [point(.77, rise, -.9, 1), point(.77, rise, .9, 1),
    point(1.09, rise, .9, 1), point(1.09, rise, -.9, 1)], 'rgba(37,46,28,.13)');

  // Short fold-out stays and road pads visibly hold up the flight.
  for (const side of [-1, 1]) {
    const upper = point(.45, stepRise * 2 + 5, side * .9), lower = point(.78, rise - 2, side * .9);
    line(c, upper, lower, FINISH.greenShade, 4);
    line(c, [upper[0] - .4, upper[1]], [lower[0] - .4, lower[1]], FINISH.greenLight, .7);
    const a = point(.73, rise, side * .9 - .11), b = point(.73, rise, side * .9 + .11),
      d = point(.86, rise, side * .9 - .11), e = point(.86, rise, side * .9 + .11);
    polygon(c, [a, b, e, d], FINISH.rubber);
    bolt(upper, 1.3);
    line(c, foot(0, side, 6), foot(1, side, 3), FINISH.greenShade, 3.4);
  }

  // A pair of small brass hinge plates meets the truck's deck edge.
  for (const side of [-.8, .8]) {
    polygon(c, [point(-.065, -1, side - .12), point(-.065, -1, side + .12),
      point(.065, 1.5, side + .12), point(.065, 1.5, side - .12)], FINISH.green, FINISH.greenShade, .6);
    line(c, point(0, 0, side - .13), point(0, 0, side + .13), FINISH.brass, 2.5);
    bolt(point(-.04, -1.5, side), .8);
  }

  // Slim handrails have an open centre rather than solid side panels.
  const rail = (side: number) => {
    for (const amount of [0, .5, 1]) {
      const base = foot(amount, side), head: AccessStairPoint = [base[0], base[1] - 22];
      line(c, base, head, FINISH.green, 2.1);
      line(c, [base[0] - .4, base[1]], [head[0] - .4, head[1]], FINISH.greenLight, .55);
      bolt([base[0], base[1] + 1], 1);
    }
    const a = foot(0, side, -22), b = foot(1, side, -22);
    line(c, a, b, FINISH.greenShade, 3);
    line(c, [a[0] - .25, a[1] - .65], [b[0] - .25, b[1] - .65], FINISH.wood[0], 1.5);
    line(c, a, foot(-.055, side, -18), FINISH.green, 2.1);
    line(c, b, foot(1.035, side, -17), FINISH.green, 2.1);
  };
  rail(-1);
  for (let index = 0; index < count; index++) {
    const from = index / count, to = (index + 1) / count, drop = index * stepRise,
      tread: Quad = [point(from, drop, -1), point(from, drop, 1), point(to, drop, 1), point(to, drop, -1)];
    // The front face drops straight down, while the tread stays in the deck's
    // two horizontal projection axes. This makes a real stepped silhouette.
    polygon(c, [point(to, drop, -1), point(to, drop, 1),
      point(to, drop + stepRise, 1), point(to, drop + stepRise, -1)], FINISH.riser, '#665637', .6);
    line(c, point(to, drop + stepRise - 2, -.9), point(to, drop + stepRise - 2, .9), 'rgba(60,52,31,.18)', .7);
    polygon(c, tread, FINISH.wood[index % FINISH.wood.length], '#8b6d43', .6);
    for (const amount of [.25, .65]) {
      const at = from + (to - from) * amount;
      const a = point(at, drop, -.83), b = point(at, drop, .76);
      c.beginPath(); c.moveTo(...a);
      c.bezierCurveTo(a[0] + across[0] * .45, a[1] + across[1] * .45 - .6,
        b[0] - across[0] * .42, b[1] - across[1] * .42 + .5, ...b);
      c.strokeStyle = FINISH.grain; c.lineWidth = .45; c.stroke();
    }
    line(c, tread[2], tread[3], FINISH.woodEdge, 1);
    for (const side of [-.85, .85]) {
      bolt(point(from + (to - from) * .46, drop, side), .7);
      line(c, point(from, drop + 1, side * 1.16), point(to, drop + 1, side * 1.16), FINISH.green, 2.7);
      line(c, point(to, drop + 1, side * 1.16), point(to, drop + stepRise + 1, side * 1.16), FINISH.green, 2.7);
    }
    treadQuads.push(tread);
  }
  for (const side of [-.87, .87]) {
    polygon(c, [point(.97, rise, side - .13, 1), point(.97, rise, side + .13, 1),
      point(1.07, rise, side + .13, 1), point(1.07, rise, side - .13, 1)], FINISH.rubber, '#596049', .5);
  }
  rail(1);
  c.restore();
  return { drawn: true, painted, width, top: [...top] as AccessStairPoint, bottom: [...bottom] as AccessStairPoint, treadQuads };
}
