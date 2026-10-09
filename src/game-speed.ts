/** Shared gameplay pace, relative to the original movement and simulation timings. */
export const GAME_SPEED_MULTIPLIER = 2;

/** Convert an original gameplay duration to elapsed real seconds at the current pace. */
export const realDuration = (baseSeconds: number): number => baseSeconds / GAME_SPEED_MULTIPLIER;
