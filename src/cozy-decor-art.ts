import { projectTruckPoint, type TruckPoint, type TruckRect } from './truck-layout';
import { COZY_DECOR_ITEMS, getDecorFootprint, type CozyDecorId, type CozyDecorPlacement } from './cozy-decor-geometry';

type Projector = (u: number, v: number, z?: number) => TruckPoint;
export interface CozyDecorArtOptions { alpha?: number; selected?: boolean }
const TAU = Math.PI * 2;
function poly(c: CanvasRenderingContext2D, points: readonly TruckPoint[], fill: string, stroke = '', width = .7) {
  c.beginPath(); points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath();
  if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(); }
}
function line(c: CanvasRenderingContext2D, a: TruckPoint, b: TruckPoint, color: string, width = 1) {
  c.beginPath(); c.moveTo(...a); c.lineTo(...b); c.strokeStyle = color; c.lineWidth = width; c.lineCap = 'round'; c.stroke();
}
function ellipse(c: CanvasRenderingContext2D, p: TruckPoint, rx: number, ry: number, fill: string, stroke = '', rotation = 0) {
  c.beginPath(); c.ellipse(...p, rx, ry, rotation, 0, TAU); c.fillStyle = fill; c.fill();
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = .6; c.stroke(); }
}
function planeEllipse(c: CanvasRenderingContext2D, p: Projector, u: number, v: number, z: number, ru: number, rv: number, fill: string, stroke = '') {
  poly(c, Array.from({ length: 32 }, (_, i) => p(u + Math.cos(i / 32 * TAU) * ru, v + Math.sin(i / 32 * TAU) * rv, z)), fill, stroke);
}
function cube(c: CanvasRenderingContext2D, p: Projector, u: number, v: number, z: number, width: number, depth: number, height: number, colors: readonly [string, string, string], outline = '#675b3c') {
  const corners = [[u - width / 2, v - depth / 2], [u + width / 2, v - depth / 2], [u + width / 2, v + depth / 2], [u - width / 2, v + depth / 2]];
  const top = corners.map(([a, b]) => p(a, b, z + height)), bottom = corners.map(([a, b]) => p(a, b, z));
  const faces = corners.map((_, i) => ({ i, y: (bottom[i][1] + bottom[(i + 1) % 4][1]) / 2 })).sort((a, b) => a.y - b.y);
  for (const { i } of faces) { const next = (i + 1) % 4; poly(c, [bottom[i], bottom[next], top[next], top[i]], colors[i % 2 ? 2 : 1], outline, .5); }
  poly(c, top, colors[0], outline, .6);
  line(c, top[2], top[3], '#ffe6ad9c', .8);
}
function wood(c: CanvasRenderingContext2D, p: Projector, u: number, v: number, z: number, w: number, d: number, h: number) {
  cube(c, p, u, v, z, w, d, h, ['#c9a16d', '#a87b4b', '#8b6b43']);
  for (let i = 0; i < 3; i++) line(c, p(u - w * .41, v + (i - 1) * d * .27, z + h + .1), p(u + w * .4, v + (i - 1) * d * .27, z + h + .1), '#7b5c363c', .55);
}
function leaf(c: CanvasRenderingContext2D, a: TruckPoint, b: TruckPoint, color: string, width = 2.5) {
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1, nx = -dy / len * width, ny = dx / len * width;
  c.beginPath(); c.moveTo(...a); c.quadraticCurveTo((a[0] + b[0]) / 2 + nx, (a[1] + b[1]) / 2 + ny, ...b);
  c.quadraticCurveTo((a[0] + b[0]) / 2 - nx, (a[1] + b[1]) / 2 - ny, ...a); c.fillStyle = color; c.fill();
}
function flower(c: CanvasRenderingContext2D, at: TruckPoint, hue: string, scale = 1) {
  for (let i = 0; i < 5; i++) { const angle = i * TAU / 5; ellipse(c, [at[0] + Math.cos(angle) * 1.65 * scale, at[1] + Math.sin(angle) * 1.65 * scale], 1.6 * scale, 1.15 * scale, hue, '', angle); }
  ellipse(c, at, 1.1 * scale, 1.1 * scale, '#ebba55'); ellipse(c, [at[0] - .3, at[1] - .3], .3 * scale, .3 * scale, '#fff4bc');
}
function planter(c: CanvasRenderingContext2D, p: Projector, time: number) {
  planeEllipse(c, p, 0, 1, .2, 14, 13, '#39483329');
  wood(c, p, 0, 0, 1, 25, 23, 11);
  cube(c, p, 0, 0, 11, 28, 26, 3, ['#dfba83', '#be935d', '#a17a4b']);
  cube(c, p, 0, 0, 14, 22, 20, .5, ['#67533b', '#67533b', '#67533b'], '#8d744d');
  for (const u of [-10, 10]) for (const v of [-9, 9]) { cube(c, p, u, v, 0, 3, 3, 12, ['#75875b', '#556c49', '#40583f']); ellipse(c, p(u, v, 7), .75, .75, '#e0c47e'); }
  for (let i = 0; i < 11; i++) {
    const u = ((i * 11) % 19) - 9, v = ((i * 7) % 17) - 8, height = 7 + i % 4 * 2, sway = Math.sin(time * .9 + i) * .45,
      root = p(u, v, 14), top = p(u + sway, v, 14 + height);
    line(c, root, top, '#4f7540', .8);
    leaf(c, p(u, v, 16 + height * .2), p(u - 4, v - 1, 16 + height * .5), i % 2 ? '#729451' : '#587c43', 1.9);
    leaf(c, p(u, v, 16 + height * .35), p(u + 3, v + 1, 17 + height * .62), '#88a45d', 1.7);
    flower(c, top, ['#fff0c5', '#edbb9d', '#f0d565', '#e5a9ac'][i % 4], .8 + (i % 2) * .16);
  }
}
function bench(c: CanvasRenderingContext2D, p: Projector) {
  planeEllipse(c, p, 0, 2, .2, 29, 12, '#3c48342b');
  for (const u of [-22, 22]) {
    for (const v of [-8, 8]) wood(c, p, u, v, .5, 4, 4, v === -8 ? 36 : 16);
    wood(c, p, u, 0, 5, 5, 22, 3);
  }
  for (const v of [-8, 0, 8]) wood(c, p, 0, v, 17, 58, 6.7, 3);
  for (const z of [25, 33]) wood(c, p, 0, -9, z, 58, 3.5, 5.5);
  for (const u of [-24, 24]) {
    wood(c, p, u, 0, 25, 4, 25, 3);
    for (const z of [28, 36]) ellipse(c, p(u, -11, z), .9, .9, '#d8c18b', '#766b46');
  }
  cube(c, p, 14, 2, 20.5, 14, 13, 2.5, ['#e6c7a0', '#cb9d74', '#bc8e66'], '#bc9474');
  for (let i = -1; i <= 1; i++) line(c, p(8, 2 + i * 3, 23.1), p(20, 2 + i * 3, 23.1), '#f8e6be', .7);
}
function lamp(c: CanvasRenderingContext2D, p: Projector, time: number) {
  planeEllipse(c, p, 0, 0, .2, 12, 11, '#344b3429');
  cube(c, p, 0, 0, .5, 18, 18, 3, ['#a6a179', '#7c8262', '#647359']);
  cube(c, p, 0, 0, 3.5, 11, 11, 5, ['#879064', '#5b7450', '#3f6048']);
  cube(c, p, 0, 0, 8, 4, 4, 47, ['#8e9c6a', '#637f57', '#3f6149']);
  for (const z of [15, 48]) cube(c, p, 0, 0, z, 5.6, 5.6, 2, ['#b5ad79', '#9c925d', '#7f824e']);
  const centre = p(0, 0, 61), glow = c.createRadialGradient(...centre, 1, ...centre, 22);
  glow.addColorStop(0, '#ffe6a145'); glow.addColorStop(1, '#ffe6a100'); c.fillStyle = glow; c.beginPath(); c.arc(...centre, 22, 0, TAU); c.fill();
  cube(c, p, 0, 0, 54, 13, 13, 2, ['#b5ac79', '#71805c', '#4f684e']);
  const warmth = 186 + Math.sin(time * 1.5) * 4;
  cube(c, p, 0, 0, 56, 10, 10, 14, ['#fff3bb', `rgb(255,${warmth + 40},151)`, '#e5b66e'], '#9b8552');
  for (const u of [-5, 5]) for (const v of [-5, 5]) cube(c, p, u, v, 55, 1.3, 1.3, 16, ['#a5ab74', '#667e54', '#4f6747']);
  cube(c, p, 0, 0, 70, 15, 15, 2.5, ['#8e9d66', '#6b8155', '#49684b']);
  poly(c, [p(-9, -9, 72.5), p(9, -9, 72.5), p(0, 0, 81)], '#9eaa70', '#5a734e');
  poly(c, [p(9, -9, 72.5), p(9, 9, 72.5), p(0, 0, 81)], '#647e53', '#4e6c49');
  poly(c, [p(9, 9, 72.5), p(-9, 9, 72.5), p(0, 0, 81)], '#7f935f', '#58734c');
  poly(c, [p(-9, 9, 72.5), p(-9, -9, 72.5), p(0, 0, 81)], '#b1b77b', '#657c51');
}
function rug(c: CanvasRenderingContext2D, p: Projector) {
  const cream = '#ebd9b2', red = '#b06e55';
  planeEllipse(c, p, 0, 0, .1, 30, 29, '#4f48361c');
  cube(c, p, 0, 0, .3, 59, 59, .7, [cream, '#c3ab81', '#af9a76'], '#bba781');
  for (let u = -27; u < 27; u += 9) for (let v = -27; v < 27; v += 9) {
    const parity = Math.round((u + 27) / 9 + (v + 27) / 9) % 2;
    poly(c, [p(u, v, 1.1), p(u + 9, v, 1.1), p(u + 9, v + 9, 1.1), p(u, v + 9, 1.1)], parity ? '#c48e6c85' : '#f9edcb');
  }
  for (const v of [-28, 28]) line(c, p(-28, v, 1.3), p(28, v, 1.3), red, 1);
  for (const u of [-28, 28]) line(c, p(u, -28, 1.3), p(u, 28, 1.3), red, 1);
  for (let u = -27; u <= 27; u += 3) for (const sign of [-1, 1]) line(c, p(u, sign * 29.6, .8), p(u + .7, sign * 31, .6), '#e7d5ae', .8);
  // Low woven basket and folded napkin stay inside the reserved, walkable rug.
  cube(c, p, 16, -16, 1.3, 13, 11, 7, ['#d4b375', '#b48a52', '#987344'], '#8b6c44');
  for (let i = 0; i < 5; i++) line(c, p(10 + i * 2.6, -21, 8.4), p(10 + i * 2.6, -11, 8.4), '#f3d299', .55);
  for (const z of [3, 5, 7]) line(c, p(9.5, -10.4, z), p(22.5, -10.4, z), '#d2ad6a', .5);
  const a = p(11, -16, 8), b = p(21, -16, 8), middle = p(16, -16, 17);
  c.beginPath(); c.moveTo(...a); c.quadraticCurveTo(...middle, ...b); c.strokeStyle = '#9e7846'; c.lineWidth = 1.4; c.stroke();
  cube(c, p, -12, 11, 1.3, 15, 13, .6, ['#fcf0ca', '#d8c69d', '#d8c69d'], '#ccbb96');
  planeEllipse(c, p, -12, 11, 2, 4.5, 4.5, '#d2a873', '#9d8156'); planeEllipse(c, p, -12, 11, 2.5, 3.6, 3.6, '#f7e9c3');
}
function birdbath(c: CanvasRenderingContext2D, p: Projector, time: number) {
  planeEllipse(c, p, 0, 0, .2, 13, 12, '#39513b27');
  cube(c, p, 0, 0, .5, 18, 18, 3, ['#c5c1a0', '#a19f84', '#848b73'], '#8c937b');
  cube(c, p, 0, 0, 3.5, 8, 8, 19, ['#c7c6aa', '#aaa98f', '#8e9980'], '#929b82');
  planeEllipse(c, p, 0, 0, 21, 13, 13, '#929d85');
  planeEllipse(c, p, 0, 0, 25, 14, 14, '#cdd1b0', '#82947b');
  planeEllipse(c, p, 0, 0, 25.5, 11, 11, '#87b5ad', '#b5ccbc');
  planeEllipse(c, p, -1, -1, 25.8, 7.8, 6.5, '#a5c9bb');
  const shimmer = Math.sin(time * .85) * .6;
  line(c, p(-6 + shimmer, -2, 26), p(-1 + shimmer, -2, 26), '#edf2d6b0', .8);
  line(c, p(2 - shimmer, 4, 26), p(6 - shimmer, 4, 26), '#edf2d696', .7);
  for (let i = 0; i < 3; i++) { const u = -8 + i * 7, v = 9; leaf(c, p(u, v, 1), p(u + 4, v + 2, 6), '#7b9560', 2); }
}
function arch(c: CanvasRenderingContext2D, p: Projector, time: number) {
  planeEllipse(c, p, 0, 0, .2, 28, 11, '#3c4f3424');
  for (const u of [-25, 25]) {
    cube(c, p, u, 0, 0, 9, 13, 3, ['#a8ae7b', '#788a60', '#59734e']);
    wood(c, p, u, 0, 3, 4, 4, 63);
    cube(c, p, u, 0, 62, 6, 6, 4, ['#b9bd86', '#7c9662', '#5f7c51']);
    for (let i = 0; i < 9; i++) {
      const z = 10 + i * 5.4, sway = Math.sin(i * 1.8), start = p(u, 0, z);
      leaf(c, start, p(u + sway * 5, 1.5, z + 4), i % 2 ? '#678849' : '#8ba666', 2.1);
      if (i % 3 === 0) flower(c, p(u + sway * 3, 1, z + 2), '#f3d1ac', .7);
    }
  }
  wood(c, p, 0, 0, 64, 57, 5, 3);
  const pennantColors = ['#af745a', '#d3b66f', '#859d68', '#d7baa0', '#71978c'];
  const projected = (u: number, zOffset = 0) => p(u, .8, 59 - (1 - (u / 25) ** 2) * 6 + zOffset);
  const rope = Array.from({ length: 15 }, (_, i) => projected(-25 + i * 50 / 14));
  c.beginPath(); rope.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.strokeStyle = '#8d7950'; c.lineWidth = .75; c.stroke();
  for (let i = 0; i < 5; i++) {
    const u = -19 + i * 9.4, z = 59 - (1 - (u / 25) ** 2) * 6, sway = Math.sin(time * .85 + i * .65) * .7;
    poly(c, [p(u - 3.5, .8, z), p(u + 3.5, .8, z), p(u + sway, .8, z - 8)], pennantColors[i], '#8b7b53', .4);
  }
}
const heights: Record<CozyDecorId, number> = { flowerPlanter: 31, oakBench: 41, warmLamp: 84, picnicRug: 18, birdbath: 30, buntingArch: 70 };
function projector(placement: CozyDecorPlacement): Projector {
  const base = projectTruckPoint([placement.x, placement.y], placement.floor);
  return (u, v, z = 0) => {
    const a = placement.rotation ? -v : u, b = placement.rotation ? u : v;
    return [base[0] + a * .91 - b * .67, base[1] + a * .34 + b * .47 - z];
  };
}
/** Absolute bounds use the same paid footprint, floor height and rotation as paint. */
export function getDecorArtBounds(placement: CozyDecorPlacement): TruckRect {
  const p = projector(placement), definition = COZY_DECOR_ITEMS[placement.item], halfU = definition.columns * 16, halfV = definition.rows * 16,
    corners = [[-halfU, -halfV], [halfU, -halfV], [halfU, halfV], [-halfU, halfV]].map(([u, v]) => p(u, v));
  const lampPadding = placement.item === 'warmLamp' ? 8 : 2;
  return { left: Math.min(...corners.map(point => point[0])) - lampPadding, right: Math.max(...corners.map(point => point[0])) + lampPadding,
    top: Math.min(...corners.map(point => point[1])) - heights[placement.item], bottom: Math.max(...corners.map(point => point[1])) + 2 };
}
/** Original small furniture is drawn in the truck's real UV projection, without stretched image plates. */
export function drawCozyDecoration(c: CanvasRenderingContext2D, placement: CozyDecorPlacement, time = 0, options: CozyDecorArtOptions = {}): void {
  const p = projector(placement);
  c.save(); c.globalAlpha *= options.alpha ?? 1; c.lineJoin = 'round'; c.lineCap = 'round';
  if (options.selected) {
    const size = getDecorFootprint(placement.item, placement.rotation), hw = size.width / 2, hd = size.depth / 2,
      base = projectTruckPoint([placement.x, placement.y], placement.floor), at = (u: number, v: number): TruckPoint => [base[0] + u * .91 - v * .67, base[1] + u * .34 + v * .47];
    poly(c, [at(-hw, -hd), at(hw, -hd), at(hw, hd), at(-hw, hd)], '#d9edaf35', '#e9db91', 1.4);
  }
  switch (placement.item) {
    case 'flowerPlanter': planter(c, p, time); break;
    case 'oakBench': bench(c, p); break;
    case 'warmLamp': lamp(c, p, time); break;
    case 'picnicRug': rug(c, p); break;
    case 'birdbath': birdbath(c, p, time); break;
    case 'buntingArch': arch(c, p, time); break;
  }
  c.restore();
}
/** Compact original SVG illustrations share the warm oak, sage and cream palette of world furniture. */
export function cozyDecorIcon(item: CozyDecorId): string {
  const scenes: Record<CozyDecorId, string> = {
    flowerPlanter: '<path d="M17 43 39 35 60 45 38 56Z" fill="#d7b37c"/><path d="m17 43 21 10v14L18 56Z" fill="#a97c49"/><path d="m38 53 22-8-1 15-21 7Z" fill="#8b6c46"/><path d="m20 43 19-6 17 8-18 7Z" fill="#66533d"/><path d="M26 44V28m12 18V22m11 21V30" stroke="#65864c" stroke-width="2"/><path d="m26 38-8-6 8 1m12 1 9-6-9 1m11 10 8-5-8 1" fill="#89a45b"/><g fill="#f0c7b0" stroke="#d69d85"><circle cx="26" cy="27" r="5"/><circle cx="49" cy="29" r="5"/></g><circle cx="38" cy="21" r="5" fill="#f2db91"/><g fill="#e3b44f"><circle cx="26" cy="27" r="1.7"/><circle cx="38" cy="21" r="1.7"/><circle cx="49" cy="29" r="1.7"/></g>',
    oakBench: '<path d="M14 33 53 20v20L14 53Z" fill="#ac8150" stroke="#796443"/><path d="M14 28 53 15v8L14 36Zm0 13 39-13v8L14 49Z" fill="#d2ae77" stroke="#8b6d45"/><path d="m13 48 39-13 15 9-39 14Z" fill="#dbb984" stroke="#8b6d45"/><path d="m13 48 15 10v5L13 53Zm15 10 39-14v5L28 63Z" fill="#ad8454"/><path d="M17 52v13m43-17v13M27 59v12m27-23V31" stroke="#786447" stroke-width="4"/><path d="m18 45 42-14m-34 22 35-12" stroke="#f4d39a"/><path d="m42 43 10-3 7 4-11 4Z" fill="#e4ba91"/>',
    warmLamp: '<path d="m26 63 14-5 14 7-14 6Z" fill="#b8b384"/><path d="m26 63 14 8v4l-14-7Zm14 8 14-6v4l-14 6Z" fill="#70815b"/><path d="M40 64V28" stroke="#58734f" stroke-width="5"/><path d="M39 62V29" stroke="#a6b579" stroke-width="1"/><path d="m30 17 10-4 11 6v18l-11 4-10-5Z" fill="#f5d291" stroke="#617c54" stroke-width="2"/><path d="m40 23 11-4v18l-11 4Z" fill="#dfb878"/><path d="M40 23v18m-10-24 10 6 11-4" fill="none" stroke="#7a8a59" stroke-width="2"/><path d="m27 17 13-10 14 12-14 5Z" fill="#9eac70" stroke="#607b51"/><path d="m40 7 14 12-14 5Z" fill="#718854"/><path d="M36 27v6" stroke="#fff6d2" stroke-width="2"/>',
    picnicRug: '<path d="m8 47 34-17 31 19-35 20Z" fill="#eeddb6" stroke="#b99a73"/><path d="m17 42 30 22m-19-28 31 22m-22-27 31 22M15 52l34-18m-23 25 35-18m-23 25 35-18" stroke="#bf876e" stroke-width="5" opacity=".65"/><path d="m11 46 28 18 31-16M10 50l28 18 33-18" fill="none" stroke="#f9ebcb"/><path d="m47 30 13-5 12 7-13 6Z" fill="#d1ad71"/><path d="m47 30 12 8v10l-12-8Zm12 8 13-6v10l-13 6Z" fill="#a77f4f" stroke="#856d48"/><path d="M52 31c-3-16 17-14 13 0" fill="none" stroke="#9d7a48" stroke-width="2"/><path d="m51 37 8 5m-8-1 8 5m3-8 7-3m-7 7 7-3" stroke="#e0bf83"/>',
    birdbath: '<path d="m26 62 14-6 14 8-14 7Z" fill="#c9c8a5"/><path d="m26 62 14 9 14-7v6l-14 7-14-9Z" fill="#8d9b81"/><path d="m35 35 10 2v26l-10-1Z" fill="#b5b79a" stroke="#8d9b81"/><ellipse cx="40" cy="33" rx="23" ry="11" fill="#8c9f85"/><ellipse cx="40" cy="28" rx="24" ry="11" fill="#d2d6b2" stroke="#9aa88e"/><ellipse cx="40" cy="28" rx="19" ry="7" fill="#93c0b4"/><path d="m29 26 11-2m2 6 10-2" stroke="#e9f0d3" stroke-width="2" stroke-linecap="round"/><path d="m29 62-9-4 7 10m23-5 11-4-8 10" fill="#7c995c"/>',
    buntingArch: '<path d="M16 64V20m48 44V20" stroke="#a48251" stroke-width="5"/><path d="m14 18 50-1v5l-50 1Z" fill="#c7aa73" stroke="#8f794e"/><path d="M16 24q24 18 48 0" fill="none" stroke="#8f794e"/><path d="m20 27 8 4-6 9Zm13 7 8 1-4 10Zm15 0 9-3-1 10Z" fill="#bf876b" stroke="#8e7850" stroke-width=".5"/><path d="m33 34 8 1-4 10Z" fill="#cbb16d"/><path d="m48 34 9-3-1 10Z" fill="#8ba070"/><path d="M17 58q-9-12 1-24m46 24q8-13-1-25" fill="none" stroke="#769654" stroke-width="2"/><path d="m15 47-7-6 8 1m1-8 8-5-7 9m47 10 8-7-8 2m-2-8-7-6 7 1" fill="#8ba66a"/><g fill="#edcbb2"><circle cx="14" cy="42" r="3"/><circle cx="66" cy="51" r="3"/></g><path d="m11 66 5-3 6 3-6 4Zm47 0 6-3 6 3-6 4Z" fill="#879765"/>',
  };
  return `<svg class="cozy-decor-icon" viewBox="0 0 80 80" aria-hidden="true" focusable="false"><ellipse cx="40" cy="68" rx="30" ry="8" fill="#46563c" opacity=".12"/>${scenes[item]}</svg>`;
}
