import { circleOverlapsPolygon, groundLocation, projectDeckPoint,
  type NavigationActor, type NavigationLocation, type NavigationObstacle, type NavigationPoint,
  type NavigationWorld } from './scene-navigation';
import type { TruckFloor } from './truck-layout';

export interface PlacementPetRelocation { id: string; from: NavigationLocation; to: NavigationLocation; radius: number }
type PlacementWorld = (radius: number, actors: NavigationActor[]) => NavigationWorld;
const copy = (location: NavigationLocation): NavigationLocation => ({ ...location, point: [...location.point] });
const distance = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const polygon = (obstacle: NavigationObstacle): NavigationPoint[] => {
  const r = obstacle.bounds;
  return [[r.left, r.top], [r.right, r.top], [r.right, r.bottom], [r.left, r.bottom]]
    .map(point => projectDeckPoint(point, obstacle.floor ?? 1));
};

/** Placement removes a resident from the footprint, never from ordinary walking collisions. */
export function actorIntersectsPlacement(actor: NavigationActor, obstacles: readonly NavigationObstacle[]): boolean {
  return actor.location.surface === 'deck' && obstacles.some(obstacle =>
    obstacle.surface === 'deck' && (obstacle.floor ?? 1) === (actor.location.floor ?? 1)
    && circleOverlapsPolygon(actor.location.point, actor.radius, polygon(obstacle)));
}

function nearestClearDeckLocation(world: NavigationWorld, origin: NavigationLocation, floor: TruckFloor): NavigationLocation | undefined {
  const deck = world.floors.find(value => value.id === floor); if (!deck) return;
  const bounds = deck.deck;
  const corners = [[bounds.left, bounds.top], [bounds.right, bounds.top], [bounds.right, bounds.bottom], [bounds.left, bounds.bottom]]
    .map(point => projectDeckPoint(point, floor));
  const limit = Math.max(...corners.map(point => distance(point, origin.point)));
  // Search outwards in physical screen space: the first clear ring gives a
  // nearby landing, rather than sending a pet to a fixed spawn or another floor.
  // Four-pixel sampling also fits narrow clear spaces between full-sized bodies.
  for (let radius = 0; radius <= limit + 4; radius += 4) {
    const count = Math.max(1, Math.ceil(2 * Math.PI * radius / 4));
    for (let step = 0; step < count; step++) {
      const angle = step * 2 * Math.PI / count;
      const point: NavigationPoint = [origin.point[0] + Math.cos(angle) * radius, origin.point[1] + Math.sin(angle) * radius];
      const location = groundLocation(world, point, floor);
      if (location?.surface === 'deck') return location;
    }
  }
}

/** Plan every jump before applying any, so a failed placement cannot move one pet or charge materials. */
export function planPlacementPetRelocations(obstacles: readonly NavigationObstacle[], actors: readonly NavigationActor[],
  createWorld: PlacementWorld): PlacementPetRelocation[] | undefined {
  const moving = actors.filter(actor => actorIntersectsPlacement(actor, obstacles));
  if (!moving.length) return [];
  const movingIds = new Set(moving.map(actor => actor.id));
  const reserved = actors.filter(actor => !movingIds.has(actor.id)).map(actor => ({ ...actor, location: copy(actor.location) }));
  const relocations: PlacementPetRelocation[] = [];
  // Reserve the largest bodies first; smaller companions can still use the
  // remaining spaces without ever accepting an overlap with another landing.
  for (const actor of [...moving].sort((a, b) => b.radius - a.radius)) {
    const world = createWorld(actor.radius + 2, reserved);
    const preferred = actor.location.floor ?? 1;
    const floors = world.floors.map(floor => floor.id).sort((a, b) =>
      Number(b === preferred) - Number(a === preferred) || Math.abs(a - preferred) - Math.abs(b - preferred) || a - b);
    let destination: NavigationLocation | undefined;
    for (const floor of floors) {
      destination = nearestClearDeckLocation(world, actor.location, floor);
      if (destination) break;
    }
    if (!destination) return;
    const relocation = { id: actor.id, from: copy(actor.location), to: copy(destination), radius: actor.radius };
    relocations.push(relocation);
    reserved.push({ id: actor.id, radius: actor.radius, location: copy(destination) });
  }
  return relocations;
}
