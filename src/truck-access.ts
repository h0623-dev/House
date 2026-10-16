import { getFloorBounds, projectTruckPoint, type TruckPoint } from './truck-layout';
import { getConvexPolygonClearance, getTruckGroundFootprint } from './truck-ground';

/** The deck and the road retain the same real height on every truck size. */
export const TRUCK_DECK_GROUND_RISE = 95;
/** The people and animal doorway is one real staircase, widened by expansion. */
export const TRUCK_ACCESS_WIDTH = 76;
export function getTruckAccessWidth(level: number): number { return level >= 6 ? 112 : level >= 4 ? 96 : TRUCK_ACCESS_WIDTH; }
const landingCache = new Map<string, TruckPoint>();

/** Find the closest outside landing without shortening the painted truck body. */
export function getTruckAccessLanding(level: number, anchorUV: TruckPoint, outwardUV: TruckPoint,
  clearance: number, minimumRun: number): TruckPoint {
  const key = [level, ...anchorUV, ...outwardUV, clearance, minimumRun].join(':');
  const cached = landingCache.get(key);
  if (cached) return [...cached];
  const hull = getTruckGroundFootprint(level).polygon;
  const pointAt = (run: number): TruckPoint => {
    const point = projectTruckPoint([anchorUV[0] + outwardUV[0] * run, anchorUV[1] + outwardUV[1] * run]);
    return [point[0], point[1] + TRUCK_DECK_GROUND_RISE];
  };
  let blocked = minimumRun, clear = minimumRun;
  if (getConvexPolygonClearance(hull, pointAt(clear)) < clearance) {
    clear = Math.max(32, minimumRun + 32);
    while (getConvexPolygonClearance(hull, pointAt(clear)) < clearance) clear += 32;
    for (let step = 0; step < 24; step++) {
      const middle = (blocked + clear) / 2;
      if (getConvexPolygonClearance(hull, pointAt(middle)) >= clearance) clear = middle;
      else blocked = middle;
    }
  }
  const landing = pointAt(clear);
  // Expansion animation can request fractional levels; do not retain every frame.
  if (landingCache.size >= 128) landingCache.clear();
  landingCache.set(key, landing);
  return [...landing];
}

/** One compact L stair hugs the left side of the living truck. All callers use
 * this same centreline: ground, flight, flat landing, gate and deck entry. The
 * small landing turns the walk before the descending flight; it is never an
 * inclined board stretched between two unrelated exits. */
export function getTruckAccessGeometry(level: number) {
  const { left, front } = getFloorBounds(level), width = getTruckAccessWidth(level), half = width / 2;
  const uAxisLength = Math.hypot(.91, .34), vAxisLength = Math.hypot(.67, .47),
    halfU = half / uAxisLength, halfV = half / vAxisLength,
    gateV = front - 74, outsideU = left - (half + 18) / .91;
  const entryUV: TruckPoint = [left + 78, gateV], topUV: TruckPoint = [left + 8, gateV],
    landingUV: TruckPoint = [outsideU, gateV], flightTopUV: TruckPoint = [outsideU, gateV + halfV];
  const entry = projectTruckPoint(entryUV), top = projectTruckPoint(topUV),
    landing = projectTruckPoint(landingUV), flightTop = projectTruckPoint(flightTopUV),
    bottom = getTruckAccessLanding(level, flightTopUV, [0, 1], half + 3, 116);
  const landingQuad: [TruckPoint, TruckPoint, TruckPoint, TruckPoint] = [
    [outsideU - halfU, gateV - halfV], [topUV[0] + 2, gateV - halfV],
    [topUV[0] + 2, gateV + halfV], [outsideU - halfU, gateV + halfV],
  ].map(point => projectTruckPoint(point)) as [TruckPoint, TruckPoint, TruckPoint, TruckPoint];
  const cross: TruckPoint = [.91 / uAxisLength, .34 / uAxisLength],
    points: TruckPoint[] = [bottom, flightTop, landing, top, entry],
    outline = [...points, ...landingQuad];
  return { entryUV, topUV, landingUV, flightTopUV, entry, top, landing, flightTop, bottom, points,
    width, rise: TRUCK_DECK_GROUND_RISE, cross, landingQuad,
    flights: [{ top: flightTop, bottom, rise: TRUCK_DECK_GROUND_RISE, cross }],
    // Used by the deck preview to keep a real open doorway for paid layouts.
    reserved: { left: left + 2, right: entryUV[0] + 16, top: gateV - halfV, bottom: gateV + halfV },
    bounds: { left: Math.min(...outline.map(point => point[0])) - half,
      top: Math.min(...outline.map(point => point[1])) - half - 30,
      right: Math.max(...outline.map(point => point[0])) + half,
      bottom: Math.max(...outline.map(point => point[1])) + half + 5 } };
}
