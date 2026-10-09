import { COMPANIONS, COMPANION_IDS, MAX_COMPANION_XP, cloneCompanions, getCompanionLevel, getCompanions, type CompanionProgress, type CompanionRoster } from './companions';

export const UNIT_IDS = ['dog', 'cat', 'rabbit', 'fox', 'boar', 'owl'] as const;
export type UnitId = typeof UNIT_IDS[number];
export const RESERVE_UNIT_IDS = ['rabbit', 'fox', 'boar', 'owl'] as const;
export type ReserveUnitId = typeof RESERVE_UNIT_IDS[number];
export type UnitRoster = Record<UnitId, CompanionProgress>;
export type AnimalReserve = Record<ReserveUnitId, CompanionProgress>;
export type ReserveHealth = Record<ReserveUnitId, number>;
export type UnitHealth = Record<UnitId, number>;
export type UnitSkillId = 'dash' | 'sweep' | 'mend' | 'volley' | 'fortify' | 'burst';
export interface UnitProgressState {
  deckLevel: number;
  companions?: CompanionRoster;
  animalReserve?: AnimalReserve;
  companionTeam?: UnitId[];
  maxCompanionTeamSize?: number;
}
export const UNITS = {
  dog: { id: 'dog', name: COMPANIONS.dog.name, role: 'frontguard', roleLabel: '앞줄 수호', unlockDeck: 1, baseMaxHealth: 120, healthPerLevel: 8, skillId: 'dash', skillLabel: '보리 돌진', skillDescription: '집중 공격 · 보호', attackInterval: 2.3, attackDamage: 5, damagePerLevel: .8 },
  cat: { id: 'cat', name: COMPANIONS.cat.name, role: 'fastattack', roleLabel: '빠른 공격', unlockDeck: 1, baseMaxHealth: 90, healthPerLevel: 6, skillId: 'sweep', skillLabel: '나비 발톱', skillDescription: '모든 적 공격', attackInterval: 1.45, attackDamage: 9, damagePerLevel: 1.4 },
  rabbit: { id: 'rabbit', name: '루루', role: 'support', roleLabel: '치유 지원', unlockDeck: 2, baseMaxHealth: 95, healthPerLevel: 6, skillId: 'mend', skillLabel: '루루의 보살핌', skillDescription: '동료 회복 · 보호', attackInterval: 2.5, attackDamage: 4, damagePerLevel: .7 },
  fox: { id: 'fox', name: '루비', role: 'ranged', roleLabel: '원거리 사격', unlockDeck: 3, baseMaxHealth: 100, healthPerLevel: 7, skillId: 'volley', skillLabel: '루비의 연속 사격', skillDescription: '강한 적 집중 공격', attackInterval: 1.8, attackDamage: 9, damagePerLevel: 1.2 },
  boar: { id: 'boar', name: '도도', role: 'tank', roleLabel: '튼튼한 방패', unlockDeck: 4, baseMaxHealth: 160, healthPerLevel: 10, skillId: 'fortify', skillLabel: '도도의 든든한 방패', skillDescription: '동료 보호 · 도발', attackInterval: 2.7, attackDamage: 8, damagePerLevel: 1 },
  owl: { id: 'owl', name: '모모', role: 'mage', roleLabel: '마법 범위 공격', unlockDeck: 5, baseMaxHealth: 85, healthPerLevel: 5, skillId: 'burst', skillLabel: '모모의 달빛 마법', skillDescription: '모든 적 공격 · 둔화', attackInterval: 2.1, attackDamage: 8, damagePerLevel: 1.3 },
} as const;

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const percentage = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100;
export function isUnitId(value: unknown): value is UnitId { return typeof value === 'string' && UNIT_IDS.includes(value as UnitId); }
export function validateAnimalReserve(value: unknown): value is AnimalReserve {
  return record(value) && Object.keys(value).length === RESERVE_UNIT_IDS.length && RESERVE_UNIT_IDS.every(id => {
    const progress = value[id];
    return record(progress) && Object.keys(progress).length === 2 && percentage(progress.health)
      && typeof progress.xp === 'number' && Number.isInteger(progress.xp) && progress.xp >= 0 && progress.xp <= MAX_COMPANION_XP;
  });
}
export function validateReserveHealth(value: unknown): value is ReserveHealth {
  return record(value) && Object.keys(value).length === RESERVE_UNIT_IDS.length && RESERVE_UNIT_IDS.every(id => percentage(value[id]));
}
export function validateCompanionTeam(value: unknown, state: Pick<UnitProgressState, 'deckLevel'>): value is UnitId[] {
  return Array.isArray(value) && value.length >= 1 && value.length <= 3 && new Set(value).size === value.length
    && value.every(id => isUnitId(id) && UNITS[id].unlockDeck <= state.deckLevel);
}
export function getUnitRoster(state: Pick<UnitProgressState, 'companions' | 'animalReserve'>): UnitRoster {
  const legacy = getCompanions(state);
  return { ...legacy, ...Object.fromEntries(RESERVE_UNIT_IDS.map(id => [id, state.animalReserve ? { ...state.animalReserve[id] } : { health: 100, xp: 0 }])) } as UnitRoster;
}
export function getUnlockedUnitIds(state: Pick<UnitProgressState, 'deckLevel'>): UnitId[] { return UNIT_IDS.filter(id => UNITS[id].unlockDeck <= state.deckLevel); }
export function getSelectedTeam(state: UnitProgressState): UnitId[] { return state.companionTeam ? [...state.companionTeam] : [...COMPANION_IDS]; }
export function getReadyTeam(state: UnitProgressState): UnitId[] {
  const roster = getUnitRoster(state), unlocked = getUnlockedUnitIds(state);
  return getSelectedTeam(state).filter(id => unlocked.includes(id) && roster[id].health > 0);
}
export function getMaxTeamSize(state: UnitProgressState): number { return Math.max(state.maxCompanionTeamSize ?? 0, getSelectedTeam(state).length); }
/** Preserve absent legacy fields while isolating every saved progress record and team. */
export function cloneUnitProgressFields(state: Pick<UnitProgressState, 'companions' | 'animalReserve' | 'companionTeam' | 'maxCompanionTeamSize'>): Pick<UnitProgressState, 'companions' | 'animalReserve' | 'companionTeam' | 'maxCompanionTeamSize'> {
  return {
    ...(state.companions ? { companions: cloneCompanions(state.companions) } : {}),
    ...(state.animalReserve ? { animalReserve: Object.fromEntries(RESERVE_UNIT_IDS.map(id => [id, { ...state.animalReserve![id] }])) as AnimalReserve } : {}),
    ...(state.companionTeam ? { companionTeam: [...state.companionTeam] } : {}),
    ...(state.maxCompanionTeamSize !== undefined ? { maxCompanionTeamSize: state.maxCompanionTeamSize } : {}),
  };
}
export function getUnitLevel(progress: CompanionProgress): number { return getCompanionLevel(progress); }
export function getUnitMaxHealth(id: UnitId, progress: CompanionProgress): number {
  const definition = UNITS[id];
  return definition.baseMaxHealth + (getUnitLevel(progress) - 1) * definition.healthPerLevel;
}

export interface UnitBattleBonuses { attackMultiplier: number; enemyDamageMultiplier: number }
/** Highest current level wins; placing duplicates does not stack battle buffs. */
export function getUnitBattleBonuses(state: { settlement?: { buildings: { type: string; level: number }[] }; truckLayout?: { upperBuildings: { type: string; level: number }[] } }): UnitBattleBonuses {
  const buildings = [...state.settlement?.buildings ?? [], ...state.truckLayout?.upperBuildings ?? []];
  const level = (type: string): number => Math.max(0, ...buildings.filter(building => building.type === type)
    .map(building => Number.isInteger(building.level) ? Math.min(5, Math.max(0, building.level)) : 0));
  return { attackMultiplier: 1 + level('petHouse') * .04, enemyDamageMultiplier: 1 - level('watchtower') * .03 };
}
export function validateUnitBattleBonuses(value: unknown): value is UnitBattleBonuses {
  return record(value) && Object.keys(value).length === 2
    && typeof value.attackMultiplier === 'number' && Number.isFinite(value.attackMultiplier) && value.attackMultiplier >= 1 && value.attackMultiplier <= 1.2
    && typeof value.enemyDamageMultiplier === 'number' && Number.isFinite(value.enemyDamageMultiplier) && value.enemyDamageMultiplier >= .85 && value.enemyDamageMultiplier <= 1;
}
