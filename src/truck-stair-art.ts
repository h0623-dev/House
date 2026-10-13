import { paintWorldQuad } from './world-art';

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

/** Narrow truck access stairs use the exact walking endpoints, painted deck
 * timber and quiet metal handrails. Upper-floor stair footprints stay separate. */
export function drawTruckAccessStairs(c: CanvasRenderingContext2D, top: AccessStairPoint, bottom: AccessStairPoint,
  options: { width?: number } = {}) {
  const width = Math.max(40, Math.min(56, options.width ?? 48)), half = width / 2,
    length = Math.hypot(bottom[0] - top[0], bottom[1] - top[1]);
  if (length < .001) return { drawn: false, painted: false, width, top, bottom, treadQuads: [] as Quad[] };
  const slope = .34 / .91, norm = Math.hypot(1, slope), across: AccessStairPoint = [half / norm, half * slope / norm];
  const edge = (amount: number, side: number, lift = 0): AccessStairPoint => [
    top[0] + (bottom[0] - top[0]) * amount + across[0] * side,
    top[1] + (bottom[1] - top[1]) * amount + across[1] * side + lift,
  ];
  const treadQuads: Quad[] = []; let painted = true;
  c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
  polygon(c, [edge(0, -1, 5), edge(0, 1, 5), edge(1, 1, 5), edge(1, -1, 5)], '#75664a');
  // Sparse rail posts let the wood and climbing character read at village scale.
  const rail = (side: number) => {
    for (const amount of [0, .33, .66, 1]) {
      const foot = edge(amount, side), head: AccessStairPoint = [foot[0], foot[1] - 18];
      line(c, foot, head, '#5b7469', 3);
      line(c, [foot[0] - .5, foot[1]], [head[0] - .5, head[1]], '#a7b6a0', .8);
      c.beginPath(); c.ellipse(head[0], head[1], 2.3, 1.6, 0, 0, Math.PI * 2); c.fillStyle = '#ceb582'; c.fill();
    }
    const a = edge(0, side, -18), b = edge(1, side, -18);
    line(c, a, b, '#557269', 3.5); line(c, [a[0], a[1] - .8], [b[0], b[1] - .8], '#bac9af', .9);
  };
  rail(-1);
  const count = Math.max(5, Math.ceil(length / 20));
  for (let index = 0; index < count; index++) {
    const from = index / count, to = (index + 1) / count,
      tread: Quad = [edge(from, -1), edge(from, 1), edge(to, 1), edge(to, -1)];
    polygon(c, [edge(to, -1), edge(to, 1), edge(to, 1, 2.8), edge(to, -1, 2.8)], '#a18154');
    polygon(c, tread, '#c7a674'); painted = paintWorldQuad(c, 'wood', tread, .02) && painted;
    line(c, tread[2], tread[3], '#886b47', .8);
    line(c, [tread[2][0], tread[2][1] - .7], [tread[3][0], tread[3][1] - .7], '#e0c597', .65);
    treadQuads.push(tread);
  }
  rail(1); c.restore();
  return { drawn: true, painted, width, top: [...top] as AccessStairPoint, bottom: [...bottom] as AccessStairPoint, treadQuads };
}
