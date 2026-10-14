import type { GameState } from './game';
import { getRoadBounds } from './scene-navigation';
import { GROUND_RESOURCE_ZONES } from './ground-resources';
import { getPetPassageGeometry } from './pet-passage';
import { getFloorBounds, projectTruckPoint, type TruckFloor } from './truck-layout';
import { getVillageContentBounds, mergeVillageBounds, type VillageBounds } from './village-camera';

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
    for (const zone of GROUND_RESOURCE_ZONES) bounds.push(zone.bounds);
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
