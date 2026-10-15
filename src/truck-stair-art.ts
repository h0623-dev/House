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

/** Small, individually finished treads follow the real walking endpoints.
 * A deck-size texture stretched down this flight used to read as a bright slide. */
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
  const treadQuads: Quad[] = [], painted = worldArtReady();
  c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
  polygon(c, [edge(.75, -1, 8), edge(.75, 1, 8), edge(1, 1, 8), edge(1, -1, 8)], 'rgba(35,43,32,.13)');
  polygon(c, [edge(0, -1, 4), edge(0, 1, 4), edge(1, 1, 4), edge(1, -1, 4)], '#586252');
  for (const side of [-1, 1]) line(c, edge(0, side, 3), edge(1, side, 3), '#52685b', 3.2);
  // Sparse rail posts let the wood and climbing character read at village scale.
  const rail = (side: number) => {
    for (const amount of [0, .33, .66, 1]) {
      const foot = edge(amount, side), head: AccessStairPoint = [foot[0], foot[1] - 18];
      line(c, foot, head, '#52685b', 2.6);
      line(c, [foot[0] - .5, foot[1]], [head[0] - .5, head[1]], '#b4baa1', .7);
      c.beginPath(); c.ellipse(head[0], head[1], 1.8, 1.2, 0, 0, Math.PI * 2); c.fillStyle = '#c3c4a7'; c.fill();
    }
    const a = edge(0, side, -18), b = edge(1, side, -18);
    line(c, a, b, '#52685b', 3); line(c, [a[0], a[1] - .8], [b[0], b[1] - .8], '#c3c4a7', .7);
  };
  rail(-1);
  const count = Math.max(5, Math.ceil(length / 20));
  for (let index = 0; index < count; index++) {
    const from = index / count, to = (index + 1) / count,
      tread: Quad = [edge(from, -1), edge(from, 1), edge(to, 1), edge(to, -1)];
    polygon(c, [edge(to, -1), edge(to, 1), edge(to, 1, 2.5), edge(to, -1, 2.5)], '#7f7861');
    polygon(c, tread, ['#aaa083', '#b2a58a', '#a69a80'][index % 3]);
    // Grain follows the short board across the flight, rather than magnifying
    // the truck atlas into another large orange rectangle.
    for (const amount of [.32, .69]) {
      const at = from + (to - from) * amount;
      line(c, edge(at, -.8), edge(at, .65), 'rgba(83,77,57,.18)', .55);
    }
    line(c, tread[2], tread[3], '#736e58', .85);
    line(c, [tread[2][0], tread[2][1] - .7], [tread[3][0], tread[3][1] - .7], '#d0c4a3', .65);
    for (const side of [-.8, .8]) {
      const nail = edge(from + (to - from) * .56, side);
      c.beginPath(); c.ellipse(nail[0], nail[1], .8, .5, 0, 0, Math.PI * 2); c.fillStyle = '#64705e'; c.fill();
    }
    treadQuads.push(tread);
  }
  rail(1); c.restore();
  return { drawn: true, painted, width, top: [...top] as AccessStairPoint, bottom: [...bottom] as AccessStairPoint, treadQuads };
}
