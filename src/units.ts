import { COMPANIONS, COMPANION_IDS, MAX_COMPANION_XP, cloneCompanions, getCompanionLevel, getCompanions, type CompanionProgress, type CompanionRoster } from './companions';
import type { ShopProgress } from './shop';

export const UNIT_IDS = ['dog', 'cat', 'rabbit', 'fox', 'boar', 'owl', 'monkey', 'elephant', 'giraffe', 'panda', 'deer'] as const;
export type UnitId = typeof UNIT_IDS[number];
export const LEGACY_RESERVE_UNIT_IDS = ['rabbit', 'fox', 'boar', 'owl'] as const;
export const RESERVE_UNIT_IDS = ['rabbit', 'fox', 'boar', 'owl', 'monkey', 'elephant', 'giraffe', 'panda', 'deer'] as const;
export type ReserveUnitId = typeof RESERVE_UNIT_IDS[number];
export type UnitRoster = Record<UnitId, CompanionProgress>;
export type AnimalReserve = Record<ReserveUnitId, CompanionProgress>;
export type ReserveHealth = Record<ReserveUnitId, number>;
export type UnitHealth = Record<UnitId, number>;
export type UnitSkillFamily = 'dash' | 'sweep' | 'mend' | 'volley' | 'fortify' | 'burst';
export type UnitSkillId = UnitSkillFamily | 'fruit' | 'stomp' | 'leaf' | 'paw' | 'antler';
export interface UnitProgressState {
  deckLevel: number;
  companions?: CompanionRoster;
  animalReserve?: AnimalReserve;
  companionTeam?: UnitId[];
  maxCompanionTeamSize?: number;
  shop?: ShopProgress;
}
export const UNITS = {
  dog: { id: 'dog', name: COMPANIONS.dog.name, speciesLabel: '강아지', sizeLabel: '소형', deckUnlockLevel: 1, role: 'frontguard', roleLabel: '앞줄 수호', unlockDeck: 1, baseMaxHealth: 120, healthPerLevel: 8, skillId: 'dash', skillLabel: '보리 돌진', skillDescription: '집중 공격 · 보호', attackInterval: 2.3, attackDamage: 5, damagePerLevel: .8 },
  cat: { id: 'cat', name: COMPANIONS.cat.name, speciesLabel: '고양이', sizeLabel: '소형', deckUnlockLevel: 1, role: 'fastattack', roleLabel: '빠른 공격', unlockDeck: 1, baseMaxHealth: 90, healthPerLevel: 6, skillId: 'sweep', skillLabel: '나비 발톱', skillDescription: '모든 적 공격', attackInterval: 1.45, attackDamage: 9, damagePerLevel: 1.4 },
  rabbit: { id: 'rabbit', name: '루루', speciesLabel: '토끼', sizeLabel: '소형', deckUnlockLevel: 1, role: 'support', roleLabel: '치유 지원', unlockDeck: 1, baseMaxHealth: 95, healthPerLevel: 6, skillId: 'mend', skillLabel: '루루의 보살핌', skillDescription: '동료 회복 · 보호', attackInterval: 2.5, attackDamage: 4, damagePerLevel: .7 },
  fox: { id: 'fox', name: '루비', speciesLabel: '여우', sizeLabel: '중형', deckUnlockLevel: 1, role: 'ranged', roleLabel: '원거리 사격', unlockDeck: 1, baseMaxHealth: 100, healthPerLevel: 7, skillId: 'volley', skillLabel: '루비의 연속 사격', skillDescription: '강한 적 집중 공격', attackInterval: 1.8, attackDamage: 9, damagePerLevel: 1.2 },
  boar: { id: 'boar', name: '도도', speciesLabel: '멧돼지', sizeLabel: '중형', deckUnlockLevel: 1, role: 'tank', roleLabel: '튼튼한 방패', unlockDeck: 1, baseMaxHealth: 160, healthPerLevel: 10, skillId: 'fortify', skillLabel: '도도의 든든한 방패', skillDescription: '동료 보호 · 도발', attackInterval: 2.7, attackDamage: 8, damagePerLevel: 1 },
  owl: { id: 'owl', name: '모모', speciesLabel: '부엉이', sizeLabel: '소형', deckUnlockLevel: 1, role: 'mage', roleLabel: '마법 범위 공격', unlockDeck: 1, baseMaxHealth: 85, healthPerLevel: 5, skillId: 'burst', skillLabel: '모모의 달빛 마법', skillDescription: '모든 적 공격 · 둔화', attackInterval: 2.1, attackDamage: 8, damagePerLevel: 1.3 },
  monkey: { id: 'monkey', name: '몽이', speciesLabel: '원숭이', sizeLabel: '소형', deckUnlockLevel: 1, role: 'ranged', roleLabel: '과일 던지기', unlockDeck: 1, baseMaxHealth: 95, healthPerLevel: 6, skillId: 'fruit', skillLabel: '몽이의 과일 세례', skillDescription: '강한 적에게 과일 3연타', attackInterval: 1.7, attackDamage: 8, damagePerLevel: 1.1 },
  elephant: { id: 'elephant', name: '코코', speciesLabel: '코끼리', sizeLabel: '대형', deckUnlockLevel: 6, role: 'tank', roleLabel: '든든한 수호자', unlockDeck: 1, baseMaxHealth: 190, healthPerLevel: 11, skillId: 'stomp', skillLabel: '코코의 대지 울림', skillDescription: '모든 적 공격 · 둔화', attackInterval: 3.1, attackDamage: 12, damagePerLevel: 1.2 },
  giraffe: { id: 'giraffe', name: '길리', speciesLabel: '기린', sizeLabel: '대형', deckUnlockLevel: 5, role: 'support', roleLabel: '초록잎 보살핌', unlockDeck: 1, baseMaxHealth: 130, healthPerLevel: 8, skillId: 'leaf', skillLabel: '길리의 초록잎', skillDescription: '동료 회복 · 보호', attackInterval: 2.8, attackDamage: 6, damagePerLevel: .9 },
  panda: { id: 'panda', name: '판이', speciesLabel: '판다', sizeLabel: '대형', deckUnlockLevel: 4, role: 'tank', roleLabel: '포근한 방패', unlockDeck: 1, baseMaxHealth: 155, healthPerLevel: 9, skillId: 'paw', skillLabel: '판이의 든든한 품', skillDescription: '동료 보호 · 도발', attackInterval: 2.6, attackDamage: 7, damagePerLevel: 1 },
  deer: { id: 'deer', name: '루아', speciesLabel: '사슴', sizeLabel: '중형', deckUnlockLevel: 3, role: 'fastattack', roleLabel: '날렵한 돌진', unlockDeck: 1, baseMaxHealth: 110, healthPerLevel: 7, skillId: 'antler', skillLabel: '루아의 숲길 돌진', skillDescription: '집중 공격 · 보호', attackInterval: 1.9, attackDamage: 8, damagePerLevel: 1.2 },
} as const;

/** Ownership is independent of the room needed to live safely on the truck. */
export function getAnimalDeckUnlockLevel(id: UnitId): number { return UNITS[id].deckUnlockLevel; }
export function canAnimalBoardTruck(id: UnitId, deckLevel: number): boolean {
  return Number.isFinite(deckLevel) && deckLevel >= getAnimalDeckUnlockLevel(id);
}
const SKILL_FAMILIES: Readonly<Record<UnitSkillId, UnitSkillFamily>> = {
  dash: 'dash', sweep: 'sweep', mend: 'mend', volley: 'volley', fortify: 'fortify', burst: 'burst',
  fruit: 'volley', stomp: 'burst', leaf: 'mend', paw: 'fortify', antler: 'dash',
};
export function getUnitSkillFamily(skill: UnitSkillId): UnitSkillFamily { return SKILL_FAMILIES[skill]; }

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
/** Only missing newly introduced animals receive defaults; existing progress is never repaired or replaced. */
export function normalizeAnimalReserve(value: unknown): AnimalReserve | null {
  if (!record(value) || Object.keys(value).some(id => !RESERVE_UNIT_IDS.includes(id as ReserveUnitId))
    || LEGACY_RESERVE_UNIT_IDS.some(id => !Object.hasOwn(value, id))) return null;
  const candidate = Object.fromEntries(RESERVE_UNIT_IDS.map(id => [id, Object.hasOwn(value, id) ? value[id] : { health: 100, xp: 0 }]));
  return validateAnimalReserve(candidate) ? candidate : null;
}
/** A battle begun by the previous version preserves animals that did not yet participate. */
export function normalizeReserveHealth(value: unknown, roster: UnitRoster): ReserveHealth | null {
  if (!record(value) || Object.keys(value).some(id => !RESERVE_UNIT_IDS.includes(id as ReserveUnitId))
    || LEGACY_RESERVE_UNIT_IDS.some(id => !Object.hasOwn(value, id))) return null;
  const candidate = Object.fromEntries(RESERVE_UNIT_IDS.map(id => [id, Object.hasOwn(value, id) ? value[id] : roster[id].health]));
  return validateReserveHealth(candidate) ? candidate : null;
}
export function validateCompanionTeam(value: unknown, state: Pick<UnitProgressState, 'deckLevel' | 'shop'>): value is UnitId[] {
  return Array.isArray(value) && value.length >= 1 && value.length <= 3 && new Set(value).size === value.length
    && value.every(id => isUnitId(id) && getUnlockedUnitIds(state).includes(id));
}
export function getUnitRoster(state: Pick<UnitProgressState, 'companions' | 'animalReserve'>): UnitRoster {
  const legacy = getCompanions(state);
  return { ...legacy, ...Object.fromEntries(RESERVE_UNIT_IDS.map(id => [id, state.animalReserve?.[id] ? { ...state.animalReserve[id] } : { health: 100, xp: 0 }])) } as UnitRoster;
}
/** Exactly one of each species belongs to every village, including older saves. */
export function getUnlockedUnitIds(_state: Pick<UnitProgressState, 'deckLevel' | 'shop'>): UnitId[] { return [...UNIT_IDS]; }
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
    ...(state.animalReserve ? { animalReserve: Object.fromEntries(RESERVE_UNIT_IDS.map(id => [id, { ...(state.animalReserve![id] ?? { health: 100, xp: 0 }) }])) as AnimalReserve } : {}),
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
