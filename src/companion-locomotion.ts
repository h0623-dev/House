import type { UnitId } from './units';

/** Actual screen-space travel, independent of the accelerated village clock. */
export interface CompanionGaitInput {
  distance: number;
  speed: number;
  heading: number;
  /** Scene smooths starts/stops; omitted values derive strength from speed. */
  blend?: number;
  /** Signed, eased old→new facing during a stopped turn; steady values ±1. */
  facingBlend?: number;
  reducedMotion?: boolean;
}
export type CompanionPaw = 'frontNear' | 'frontFar' | 'hindNear' | 'hindFar';
export interface CompanionPawStep {
  phase: number;
  planted: boolean;
  /** Nominal sprite pixels along the actual direction of travel. */
  along: number;
  lift: number;
}
export interface CompanionGaitSample {
  phase: number;
  stride: number;
  strength: number;
  heading: number;
  bodyY: number;
  bodyRoll: number;
  headTilt: number;
  tailTilt: number;
  paws: Record<CompanionPaw, CompanionPawStep>;
}

const TAU = Math.PI * 2;
export const COMPANION_STANCE_FRACTION = .64;
export const COMPANION_STRIDE: Readonly<Record<UnitId, number>> = {
  dog: 20, cat: 18, rabbit: 16, fox: 20, boar: 19, owl: 12,
};
const lift: Readonly<Record<UnitId, number>> = {
  dog: 4.2, cat: 3.6, rabbit: 4.6, fox: 3.8, boar: 2.5, owl: 1.8,
};
const finite = (n: number, fallback = 0): number => Number.isFinite(n) ? n : fallback;
const clamp = (n: number): number => Math.max(0, Math.min(1, n));
const fraction = (n: number): number => ((n % 1) + 1) % 1;
const smooth = (n: number): number => n * n * (3 - 2 * n);

/** A grounded paw moves back by exactly the distance the body moves forward. */
function pawStep(phase: number, stride: number, height: number, strength: number): CompanionPawStep {
  const p = fraction(phase), duty = COMPANION_STANCE_FRACTION;
  if(strength<.001)return {phase:p,planted:true,along:0,lift:0};
  const reach = stride * duty / 2;
  if (p < duty) {
    return { phase: p, planted: true, along: (reach - stride * p) * strength, lift: 0 };
  }
  const swing = (p - duty) / (1 - duty);
  return { phase: p, planted: false,
    along: (-reach + 2 * reach * smooth(swing)) * strength,
    lift: Math.sin(swing * Math.PI) ** 2 * height * strength };
}

/** No time parameter: stationary companions cannot keep marching or sliding. */
export function sampleCompanionGait(id: UnitId, input: CompanionGaitInput, scale = 1): CompanionGaitSample {
  const stride = COMPANION_STRIDE[id];
  const safeScale = Math.max(.05, Math.abs(finite(scale, 1)));
  const speed = Math.max(0, finite(input.speed)) / safeScale;
  const strength = input.reducedMotion ? 0
    : clamp(input.blend === undefined ? smooth(clamp(speed / 12)) : finite(input.blend));
  const phase = fraction(Math.max(0, finite(input.distance)) / (stride * safeScale));
  const swing = Math.sin(phase * TAU), weight = Math.sin(phase * TAU * 2);
  return {
    phase, stride, strength, heading: finite(input.heading),
    bodyY: -.65 * Math.abs(weight) * strength,
    bodyRoll: swing * .012 * strength,
    headTilt: -weight * .017 * strength,
    tailTilt: swing * .065 * strength,
    paws: {
      frontNear: pawStep(phase, stride, lift[id], strength),
      hindFar: pawStep(phase, stride, lift[id], strength),
      frontFar: pawStep(phase + .5, stride, lift[id], strength),
      hindNear: pawStep(phase + .5, stride, lift[id], strength),
    },
  };
}
