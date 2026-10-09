import { GAME_SPEED_MULTIPLIER } from './game-speed';

/** Stored game minutes keep their scale; the active village clock follows the shared pace. */
export const GAME_MINUTES_PER_SECOND = 2 * GAME_SPEED_MULTIPLIER;

/** Round up so a running countdown never displays zero before completion. */
export function gameMinutesToSeconds(value: number): number {
  return Math.ceil(Math.max(0, value) / GAME_MINUTES_PER_SECOND);
}

export function formatGameDuration(value: number): string {
  return `${gameMinutesToSeconds(value)}초`;
}
