import { getFloorBounds, projectTruckPoint, type TruckPoint } from './truck-layout';
import { getConvexPolygonClearance, getTruckGroundFootprint } from './truck-ground';

/** The deck and the road retain the same real height on every truck size. */
export const TRUCK_DECK_GROUND_RISE = 95;
export const TRUCK_ACCESS_WIDTH = 42;
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

/** The existing deck doorway stays fixed so paid free-placement layouts remain valid. */
export function getTruckAccessGeometry(level: number) {
  const { front } = getFloorBounds(level);
  const entryUV: TruckPoint = [-225, front - 60], topUV: TruckPoint = [-225, front - 3];
  const entry = projectTruckPoint(entryUV), top = projectTruckPoint(topUV);
  const bottom = getTruckAccessLanding(level, topUV, [0, 1], TRUCK_ACCESS_WIDTH / 2 + 2, 53);
  const points = [bottom, top, entry], half = TRUCK_ACCESS_WIDTH / 2;
  return { entryUV, topUV, entry, top, bottom, points, width: TRUCK_ACCESS_WIDTH, rise: TRUCK_DECK_GROUND_RISE,
    bounds: { left: Math.min(...points.map(point => point[0])) - half,
      top: Math.min(...points.map(point => point[1])) - half - 26,
      right: Math.max(...points.map(point => point[0])) + half,
      bottom: Math.max(...points.map(point => point[1])) + half } };
}
