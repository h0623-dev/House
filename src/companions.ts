export const COMPANION_IDS = ['dog', 'cat'] as const;
export type CompanionId = typeof COMPANION_IDS[number];
/** Health is a percentage, so leveling never grants recovery or loses current health. */
export interface CompanionProgress { health: number; xp: number }
export type CompanionRoster = Record<CompanionId, CompanionProgress>;
export type CompanionHealth = Record<CompanionId, number>;
export const MAX_COMPANION_XP = 720;

export const COMPANIONS = {
  dog: { id: 'dog', name: '보리', role: 'frontguard', roleLabel: '앞줄 수호', baseMaxHealth: 120, healthPerLevel: 8 },
  cat: { id: 'cat', name: '나비', role: 'fastattack', roleLabel: '빠른 공격', baseMaxHealth: 90, healthPerLevel: 6 },
} as const;

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const health = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100;

export function isCompanionId(value: unknown): value is CompanionId {
  return typeof value === 'string' && COMPANION_IDS.includes(value as CompanionId);
}

export function validateCompanionHealth(value: unknown): value is CompanionHealth {
  return record(value) && Object.keys(value).length === COMPANION_IDS.length && COMPANION_IDS.every(id => health(value[id]));
}

/** Only missing legacy rosters receive defaults; present malformed saves are rejected. */
export function validateCompanions(value: unknown): value is CompanionRoster {
  return record(value) && Object.keys(value).length === COMPANION_IDS.length && COMPANION_IDS.every(id => {
    const progress = value[id];
    return record(progress) && Object.keys(progress).length === 2 && health(progress.health)
      && typeof progress.xp === 'number' && Number.isInteger(progress.xp) && progress.xp >= 0 && progress.xp <= MAX_COMPANION_XP;
  });
}

export function cloneCompanions(roster: CompanionRoster): CompanionRoster {
  return { dog: { ...roster.dog }, cat: { ...roster.cat } };
}

/** Detached reads cannot alter a saved animal's health or progression. */
export function getCompanions(state: { companions?: CompanionRoster }): CompanionRoster {
  return state.companions ? cloneCompanions(state.companions) : { dog: { health: 100, xp: 0 }, cat: { health: 100, xp: 0 } };
}

export function getCompanionLevel(progress: CompanionProgress): number {
  return Math.min(10, Math.floor(progress.xp / 80) + 1);
}

export function getCompanionMaxHealth(id: CompanionId, progress: CompanionProgress): number {
  const definition = COMPANIONS[id];
  return definition.baseMaxHealth + (getCompanionLevel(progress) - 1) * definition.healthPerLevel;
}
