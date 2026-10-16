import type { GameState } from './game';
import { getRoadBounds } from './scene-navigation';
import { GROUND_REGIONS } from './ground-regions';
import { getPetPassageGeometry } from './pet-passage';
import { getTruckAccessGeometry } from './truck-access';
import { getTruckGroundFootprint } from './truck-ground';
import { getFloorBounds, projectTruckPoint, type TruckFloor } from './truck-layout';
import { getVillageContentBounds, mergeVillageBounds, type VillageBounds } from './village-camera';

/** The actual home silhouette, independent of the far-away gathering map.
 * The shared truck projection is at deck height; Scene's raw projection is
 * 95 pixels lower. Derive the cab from its painted bottom rather than mixing
 * those two origins and adding empty ground below the truck. */
export function getTruckHomeBounds(state: GameState, floor: TruckFloor, level = state.deckLevel): VillageBounds {
  if (floor !== 1) return getHomeOverviewBounds(state, floor, level);
  const deck = getFloorBounds(level, floor);
  const corners = [[deck.left, deck.back], [deck.end, deck.back], [deck.end, deck.front], [deck.left, deck.front]]
    .map(point => projectTruckPoint(point, floor));
  const cab = projectTruckPoint([deck.end + 95, (deck.back + deck.front) / 2], 1);
  const body = getTruckGroundFootprint(level).bounds;
  return mergeVillageBounds([
    // Include the miniature rails, back lamps and finished roof line.
    { left: Math.min(...corners.map(point => point[0])) - 22,
      top: Math.min(...corners.map(point => point[1])) - 52,
      right: Math.max(...corners.map(point => point[0])) + 22,
      bottom: Math.max(...corners.map(point => point[1])) + 18 },
    { left: body.left - 12, top: body.top - 12, right: body.right + 12, bottom: body.bottom + 14 },
    // 230 × 208 cab at x + 4, bottom y + 168, matching the live draw.
    { left: cab[0] - 119, top: cab[1] - 48, right: cab[0] + 127, bottom: cab[1] + 176 },
    getVillageContentBounds(state, floor),
    getTruckAccessGeometry(level).bounds,
    getPetPassageGeometry(level).bounds,
  ]);
}

/** A home composition leaves room for the left woodland and right water bank
 * without shrinking to distant resource regions. The truck targets 68% of a
 * landscape viewport's width; short phone viewports use the height limit so
 * wheels and the road landing remain visible. Manual pan/zoom is applied by
 * Scene after this frame and must not be reset by walking or chores. */
export function frameTruckHome(bounds: VillageBounds, availableWidth: number, availableHeight: number) {
  const width = Math.max(100, availableWidth), height = Math.max(70, availableHeight);
  const landscape = width > height * 1.15;
  const bodyWidth = Math.max(1, bounds.right - bounds.left), bodyHeight = Math.max(1, bounds.bottom - bounds.top);
  const sideOccupancy = landscape ? .68 : .9;
  // Reserve screen pixels, not world units: the same breathing room remains
  // useful when a purchased expansion changes the dimensions of the truck.
  const verticalMargin = Math.min(24, height * .055);
  const scale = Math.min(width * sideOccupancy / bodyWidth, (height - verticalMargin * 2) / bodyHeight);
  return { x: (bounds.left + bounds.right) / 2, y: (bounds.top + bounds.bottom) / 2,
    width: width / scale, height: height / scale, zoom: 1, scale };
}

/** Camera bounds never change navigation, collision footprints or actor feet.
 * Ground belongs to the first-floor overview; other tabs show only that floor. */
export function getHomeOverviewBounds(state: GameState, floor: TruckFloor, level = state.deckLevel): VillageBounds {
  const deck = getFloorBounds(level, floor);
  const corners = [[deck.left, deck.back], [deck.end, deck.back], [deck.end, deck.front], [deck.left, deck.front]]
    .map(point => projectTruckPoint(point, floor));
  const bounds: VillageBounds[] = [{
    left: Math.min(...corners.map(point => point[0])) - 28,
    top: Math.min(...corners.map(point => point[1])) - 98,
    right: Math.max(...corners.map(point => point[0])) + 28,
    bottom: Math.max(...corners.map(point => point[1])) + (floor === 1 ? 115 : 32),
  }, getVillageContentBounds(state, floor)];
  if (floor === 1) {
    const cabin = projectTruckPoint([deck.end + 95, (deck.back + deck.front) / 2], 1, -107);
    bounds.push({ left: cabin[0] - 126, top: cabin[1] - 147, right: cabin[0] + 134, bottom: cabin[1] + 61 });
    const road = getRoadBounds(level);
    // At either road edge the complete original resident, rather than just its
    // feet, remains inside the overview. Animals retain their full paw radius.
    bounds.push({ left: road.left - 32, top: road.top - 84, right: road.right + 32, bottom: road.bottom + 32 });
    bounds.push(getPetPassageGeometry(level).bounds);
    for (const region of GROUND_REGIONS) bounds.push(region.bounds);
  }
  return mergeVillageBounds(bounds);
}

/** Fit the whole playable map to the actual area between the phone HUDs.
 * Ordinary movement and chores cannot change these bounds or magnification. */
export function frameHomeOverview(bounds: VillageBounds, availableWidth: number, availableHeight: number) {
  const width = Math.max(100, availableWidth), height = Math.max(70, availableHeight);
  const margin = 16;
  const scale = Math.min((width - margin * 2) / Math.max(1, bounds.right - bounds.left),
    (height - margin * 2) / Math.max(1, bounds.bottom - bounds.top));
  return { x: (bounds.left + bounds.right) / 2, y: (bounds.top + bounds.bottom) / 2,
    width: width / scale, height: height / scale, zoom: 1, scale };
}
