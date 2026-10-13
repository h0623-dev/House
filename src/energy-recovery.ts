import type { GameState } from './game';

export interface EnergyRecoveryProgress {
  version: 1;
  /** Real device time; deliberately independent of the faster village clock. */
  checkedAt: number;
  /** Elapsed real milliseconds toward the next single point. */
  carryMs: number;
}

export const ENERGY_RECOVERY_PER_MINUTE = 3;
export const ENERGY_RECOVERY_INTERVAL_MS = 20_000;
const MAX_DEVICE_TIME = 100_000_000_000_000;
const validTime = (value: unknown): value is number => typeof value === 'number'
  && Number.isSafeInteger(value) && value >= 0 && value <= MAX_DEVICE_TIME;

export function validateEnergyRecovery(value: unknown): value is EnergyRecoveryProgress {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const progress = value as Record<string, unknown>;
  return Object.keys(progress).length === 3 && progress.version === 1
    && validTime(progress.checkedAt) && typeof progress.carryMs === 'number'
    && Number.isInteger(progress.carryMs) && progress.carryMs >= 0
    && progress.carryMs < ENERGY_RECOVERY_INTERVAL_MS;
}

export function cloneEnergyRecoveryFields(state: Pick<GameState, 'energyRecovery'>): Pick<GameState, 'energyRecovery'> {
  return state.energyRecovery ? { energyRecovery: { ...state.energyRecovery } } : {};
}

/**
 * Called for real-time ticks and resumption, including while the village is
 * paused or an expedition is running. Legacy saves begin now, without guessing
 * an old absence. Full energy never banks time for the next activity.
 */
export function recoverEnergy(state: GameState, now = Date.now()): GameState {
  if (!validTime(now) || !Number.isFinite(state.energy) || state.energy < 0 || state.energy > 100) return state;
  if (Object.hasOwn(state, 'energyRecovery') && !validateEnergyRecovery(state.energyRecovery)) return state;
  const previous = state.energyRecovery;
  if (previous && now <= previous.checkedAt) return state;
  const next = structuredClone(state);
  if (!previous || state.energy === 100) {
    next.energyRecovery = { version: 1, checkedAt: now, carryMs: 0 };
    return next;
  }
  const elapsed = now - previous.checkedAt + previous.carryMs;
  const points = Math.floor(elapsed / ENERGY_RECOVERY_INTERVAL_MS);
  next.energy = Math.min(100, state.energy + points);
  next.energyRecovery = { version: 1, checkedAt: now,
    carryMs: next.energy === 100 ? 0 : elapsed % ENERGY_RECOVERY_INTERVAL_MS };
  return next;
}

/** UI countdown only; reading it never initializes a save or grants energy. */
export function secondsUntilEnergyRecovery(state: Pick<GameState, 'energy' | 'energyRecovery'>, now = Date.now()): number {
  if (state.energy >= 100) return 0;
  const progress = state.energyRecovery;
  if (!progress || !validateEnergyRecovery(progress) || !validTime(now)) return ENERGY_RECOVERY_INTERVAL_MS / 1000;
  if (now < progress.checkedAt) return Math.ceil((progress.checkedAt - now + ENERGY_RECOVERY_INTERVAL_MS - progress.carryMs) / 1000);
  const elapsed = now - progress.checkedAt + progress.carryMs;
  return elapsed >= ENERGY_RECOVERY_INTERVAL_MS ? 0 : Math.ceil((ENERGY_RECOVERY_INTERVAL_MS - elapsed) / 1000);
}
