import { recoverEnergy, ENERGY_RECOVERY_INTERVAL_MS } from '../../src/energy-recovery.ts';
import type { GameState } from '../../src/game.ts';

/** Explicit simulated wall time for domain fixtures; never a manual energy grant. */
export function waitForEnergy(state: GameState, target = 100): GameState {
  const baseline = state.energyRecovery?.checkedAt ?? 1_000_000;
  const anchored = recoverEnergy(state, baseline);
  const points = Math.max(0, Math.ceil(target - anchored.energy));
  const elapsed = Math.max(0, points * ENERGY_RECOVERY_INTERVAL_MS - (anchored.energyRecovery?.carryMs ?? 0));
  return recoverEnergy(anchored, baseline + elapsed);
}
