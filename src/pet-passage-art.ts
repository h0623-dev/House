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
  c.fillStyle = '#d7b775'; c.beginPath(); c.ellipse(p[0], p[1], radius, radius * .65, 0, 0, Math.PI * 2); c.fill();
}

/** The little paw gate belongs to the shared stair's deck opening. Painting
 * this animal control never creates a second permanent ramp beside the truck. */
export function drawPetPassage(c: CanvasRenderingContext2D, level: number, open: boolean,
  options: { points?: readonly Point[]; stairs?: boolean } = {}) {
  const base = getPetPassageGeometry(level);
  const points = options.points && options.points.length >= 3 && options.points.every(p => p.length === 2 && p.every(Number.isFinite))
    ? options.points.map(p => [...p] as Point) : base.points;
  const hinge = points[points.length - 2], entry = points[points.length - 1], ground = points[0],
    inwardLength = Math.hypot(entry[0]-hinge[0],entry[1]-hinge[1]),
    cross: Point = inwardLength > .001 ? [(entry[0]-hinge[0])/inwardLength,(entry[1]-hinge[1])/inwardLength] : base.cross,
    // A leased five-point stair retains its old width and flat landing after
    // truck expansion. Its flight/landing offset is exactly half that width.
    landingOffset: Point | null = points.length >= 5 ? [points[1][0]-points[2][0],points[1][1]-points[2][1]] : null,
    leasedWidth = landingOffset ? Math.hypot(...landingOffset)*2 : base.width,
    width = leasedWidth >= 48 && leasedWidth <= 128 ? leasedWidth : base.width,
    landingQuad: [Point,Point,Point,Point] = landingOffset ? [
      offset(offset(points[2],cross,-width/2),landingOffset,-1),
      offset(offset(hinge,cross,2*Math.hypot(.91,.34)),landingOffset,-1),
      offset(offset(hinge,cross,2*Math.hypot(.91,.34)),landingOffset,1),
      offset(offset(points[2],cross,-width/2),landingOffset,1),
    ] : base.landingQuad,
    geometry = { ...base, points, width, cross, landingQuad, ground, hinge, top: hinge, entry,
      entryUV: unprojectTruckPoint(entry), hingeUV: unprojectTruckPoint(hinge),
      bounds: { left: Math.min(...points.map(p => p[0])) - width / 2, top: Math.min(...points.map(p => p[1])) - width / 2 - 32,
        right: Math.max(...points.map(p => p[0])) + width / 2, bottom: Math.max(...points.map(p => p[1])) + width / 2 } },
    half = geometry.width / 2, gateNorm = Math.hypot(.67, .47), gateCross: Point = [-.67 / gateNorm, .47 / gateNorm],
    first = offset(hinge, gateCross, -half), second = offset(hinge, gateCross, half),
    inwardNorm = Math.hypot(.91, .34), inward: Point = [.91 / inwardNorm, .34 / inwardNorm],
    end = open ? offset(first, inward, geometry.width * .94) : second;
  c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
  // Retain physical paint only for the short-lived lease of an older route.
  // The current shared stair is painted once by the truck access renderer.
  if (options.stairs) drawTruckAccessStairs(c, hinge, ground, { width: geometry.width, rise: base.rise, points,
    cross, ...(points.length >= 5 ? { landingQuad } : {}) });

  // Small timber posts, olive metal collars and brass caps share the truck rail.
  for (const post of [first, second]) {
    const left: Point = [post[0]-2.8,post[1]+1], right: Point = [post[0]+2.8,post[1]+2.8];
    polygon(c, [left,right,[right[0],right[1]-29],[left[0],left[1]-29]], '#bb8b4c', '#5a5839', .7);
    line(c, [post[0]-2,post[1]], [post[0]-2,post[1]-26], '#efd09a', 1.1);
    for (const y of [3,24]) {
      polygon(c, [[post[0]-3.5,post[1]-y],[post[0]+3.5,post[1]-y+2],
        [post[0]+3.5,post[1]-y-2],[post[0]-3.5,post[1]-y-4]], '#466548', '#2e4835', .6);
      bolt(c, [post[0]+.8,post[1]-y-.2], .8);
    }
    polygon(c, [[post[0]-4,post[1]-29],[post[0],post[1]-32],[post[0]+4,post[1]-29],[post[0],post[1]-26]], '#d8b66d', '#7b7349', .7);
  }
  const rail = (height: number, color: string, thickness: number) =>
    line(c, [first[0],first[1]-height], [end[0],end[1]-height], color, thickness);
  rail(23,'#294732',3.6); rail(23.7,'#d8b275',1.7); rail(5,'#47664a',2.5);
  for (const t of [.18,.38,.6,.82]) {
    const p = mix(first,end,t); line(c,[p[0],p[1]-5],[p[0],p[1]-23],'#537254',1.9);
    line(c,[p[0]-.35,p[1]-6],[p[0]-.35,p[1]-22],'#9ca87b',.45);
  }
  const plank: [Point,Point,Point,Point] = [[first[0],first[1]-17],[end[0],end[1]-17],
    [end[0],end[1]-10],[first[0],first[1]-10]];
  polygon(c,plank,'#c5995f','#4b5d3e',.7); paintWorldQuad(c,'wood',plank,-.02);
  for (const t of [.08,.92]) bolt(c,[first[0]+(end[0]-first[0])*t,first[1]+(end[1]-first[1])*t-13.3],.8);
  // A paw is an actual tiny enamel badge on the gate, not a floating HUD card.
  const badge = mix(first,end,.55), sign: Point = [badge[0],badge[1]-14];
  c.fillStyle = '#fff0ca'; c.strokeStyle = '#ac9258'; c.lineWidth = .8;
  c.beginPath(); c.roundRect(sign[0]-6,sign[1]-6,12,12,2); c.fill(); c.stroke();
  c.fillStyle = '#4c6846'; c.beginPath(); c.ellipse(sign[0],sign[1]+1.5,2.5,2,0,0,Math.PI*2); c.fill();
  for (const [x,y] of [[-3,-1],[-1,-2.6],[1.3,-2.6],[3.1,-.8]]) {
    c.beginPath(); c.ellipse(sign[0]+x,sign[1]+y,1,1.2,0,0,Math.PI*2); c.fill();
  }
  c.restore();
  const gatePoints=[first,second,end];
  return { drawn: true, painted: true, linkId: PET_PASSAGE_LINK_ID, surface: 'ramp' as const, open, geometry,
    gatePoint: [hinge[0],hinge[1]-16] as Point,
    gateBounds: { left: Math.min(...gatePoints.map(p=>p[0]))-7, top: Math.min(...gatePoints.map(p=>p[1]))-34,
      right: Math.max(...gatePoints.map(p=>p[0]))+7, bottom: Math.max(...gatePoints.map(p=>p[1]))+5 } };
}
