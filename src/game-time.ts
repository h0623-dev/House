/** The village clock advances by two game minutes per active real second. */
export const GAME_MINUTES_PER_SECOND = 2;

/** Round up so a running countdown never displays zero before completion. */
export function gameMinutesToSeconds(value: number): number {
  return Math.ceil(Math.max(0, value) / GAME_MINUTES_PER_SECOND);
}

export function formatGameDuration(value: number): string {
  return `${gameMinutesToSeconds(value)}초`;
}
