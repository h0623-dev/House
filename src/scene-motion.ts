import { GAME_SPEED_MULTIPLIER, realDuration } from './game-speed';

export type MotionPoint = readonly [number, number];
export type MotionSurface = 'walk' | 'climb';
export interface MotionSegment {
  readonly from: MotionPoint;
  readonly to: MotionPoint;
  readonly surface: MotionSurface;
  readonly distance: number;
  readonly seconds: number;
}
export interface MotionRoute {
  readonly segments: readonly MotionSegment[];
  readonly origin: MotionPoint;
  readonly destination: MotionPoint;
  readonly distance: number;
  readonly travelSeconds: number;
  readonly rampSeconds: number;
  readonly duration: number;
}
export interface MotionSample {
  point: [number, number];
  facing: 1 | -1;
  pose: MotionSurface;
  progress: number;
  distance: number;
  climbing?: 'up' | 'down';
}

// Short chores stay responsive, while geometry still governs every visible step.
export const FIELD_WORK_SPEED_MULTIPLIER = 2;
export const WALK_SPEED = 100 * GAME_SPEED_MULTIPLIER * FIELD_WORK_SPEED_MULTIPLIER;
export const CLIMB_SPEED = 60 * GAME_SPEED_MULTIPLIER * FIELD_WORK_SPEED_MULTIPLIER;
const finitePoint = (point: MotionPoint): boolean => point.length === 2 && point.every(Number.isFinite);

/** Geometry sets journey time; a long truck or ladder cannot become a faster walk. */
export function createMotionRoute(points: readonly MotionPoint[], climbSegments: readonly number[] = []): MotionRoute {
  if (!points.length || !points.every(finitePoint)) throw new Error('이동 경로 좌표를 확인해 주세요.');
  const segments: MotionSegment[] = [];
  for (let index = 1; index < points.length; index++) {
    const from: MotionPoint = [...points[index - 1]], to: MotionPoint = [...points[index]];
    const distance = Math.hypot(to[0] - from[0], to[1] - from[1]);
    if (!distance) continue;
    const surface = climbSegments.includes(index - 1) ? 'climb' : 'walk';
    segments.push({ from, to, distance, surface, seconds: distance / (surface === 'climb' ? CLIMB_SPEED : WALK_SPEED) });
  }
  const travelSeconds = segments.reduce((sum, segment) => sum + segment.seconds, 0);
  const rampSeconds = Math.min(realDuration(.18) / FIELD_WORK_SPEED_MULTIPLIER, travelSeconds * .2);
  return { segments, origin: [...points[0]], destination: [...points[points.length - 1]],
    distance: segments.reduce((sum, segment) => sum + segment.distance, 0), travelSeconds, rampSeconds, duration: travelSeconds + rampSeconds };
}

/** Accelerate at departure and stop at arrival; never restart the gait at a waypoint. */
export function sampleMotionRoute(route: MotionRoute, elapsed: number, returning = false): MotionSample {
  const time = Number.isFinite(elapsed) ? Math.max(0, Math.min(route.duration, elapsed)) : 0;
  const ramp = route.rampSeconds;
  const travel = !ramp ? 0 : time < ramp ? time * time / (2 * ramp)
    : time > route.duration - ramp ? route.travelSeconds - (route.duration - time) ** 2 / (2 * ramp)
    : time - ramp / 2;
  const segments = returning ? [...route.segments].reverse() : route.segments;
  let remaining = travel, distance = 0;
  for (let index = 0; index < segments.length; index++) {
    const segment = segments[index];
    if (remaining <= segment.seconds || index === segments.length - 1) {
      const progress = Math.max(0, Math.min(1, remaining / segment.seconds));
      const from = returning ? segment.to : segment.from, to = returning ? segment.from : segment.to;
      return { point: [from[0] + (to[0] - from[0]) * progress, from[1] + (to[1] - from[1]) * progress],
        facing: to[0] >= from[0] ? 1 : -1, pose: segment.surface, progress, distance: distance + segment.distance * progress,
        ...(segment.surface === 'climb' ? { climbing: to[1] > from[1] ? 'down' as const : 'up' as const } : {}) };
    }
    distance += segment.distance;
    remaining -= segment.seconds;
  }
  return { point: [...(returning ? route.origin : route.destination)], facing: 1, pose: 'walk', progress: 1, distance: route.distance };
}
