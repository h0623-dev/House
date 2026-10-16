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
  earTilt: number;
  trunkTilt: number;
  wingTilt: number;
  paws: Record<CompanionPaw, CompanionPawStep>;
}

const TAU = Math.PI * 2;
/** Kept for consumers that use the ordinary dog walking stance. */
export const COMPANION_STANCE_FRACTION = .7;
export const COMPANION_STRIDE: Readonly<Record<UnitId, number>> = {
  dog: 20, cat: 19, rabbit: 17, fox: 21, boar: 15, owl: 10,
  monkey: 18, elephant: 35, giraffe: 39, panda: 24, deer: 31,
};
interface SpeciesGait {
  /** Fraction on the ground; heavy animals maintain three supporting feet. */
  duty: number;
  lift: number;
  offsets: Record<CompanionPaw, number>;
  body: number;
  roll: number;
  head: number;
  tail: number;
}
const lateralWalk = { frontNear: 0, hindFar: .75, frontFar: .5, hindNear: .25 };
const species: Readonly<Record<UnitId, SpeciesGait>> = {
  dog: { duty: .7, lift: 3.7, offsets: lateralWalk, body: .35, roll: .009, head: .018, tail: .085 },
  cat: { duty: .72, lift: 3.3, offsets: { frontNear: 0, hindFar: .78, frontFar: .5, hindNear: .28 }, body: .2, roll: .006, head: .009, tail: .045 },
  // Rabbits land on the forefeet, fold the hocks, then push with both hindfeet.
  rabbit: { duty: .5, lift: 4, offsets: { frontNear: .44, frontFar: .47, hindNear: 0, hindFar: .035 }, body: 2.9, roll: .032, head: .035, tail: .02 },
  fox: { duty: .71, lift: 3.2, offsets: { frontNear: 0, hindFar: .73, frontFar: .5, hindNear: .23 }, body: .22, roll: .008, head: .013, tail: .075 },
  boar: { duty: .78, lift: 1.9, offsets: lateralWalk, body: .18, roll: .012, head: .025, tail: .035 },
  // Owls make short two-footed ground hops, with folded wings for balance.
  owl: { duty: .62, lift: 2.1, offsets: { frontNear: 0, frontFar: 0, hindNear: 0, hindFar: .015 }, body: 2.3, roll: .01, head: .017, tail: .018 },
  // The near arm and near leg oppose one another; each contact is staggered.
  monkey: { duty: .69, lift: 3.1, offsets: { frontNear: 0, hindFar: .08, frontFar: .5, hindNear: .58 }, body: .45, roll: .016, head: .018, tail: .11 },
  elephant: { duty: .79, lift: 2.5, offsets: lateralWalk, body: .16, roll: .005, head: .012, tail: .035 },
  // A giraffe's lateral-sequence walk approaches a pace, never a dog trot.
  giraffe: { duty: .73, lift: 4.3, offsets: { frontNear: 0, hindNear: .14, frontFar: .5, hindFar: .64 }, body: .35, roll: .008, head: .009, tail: .055 },
  panda: { duty: .78, lift: 2.5, offsets: { frontNear: 0, hindFar: .7, frontFar: .5, hindNear: .2 }, body: .28, roll: .017, head: .02, tail: .018 },
  deer: { duty: .67, lift: 4.9, offsets: { frontNear: 0, hindFar: .07, frontFar: .5, hindNear: .57 }, body: .42, roll: .008, head: .014, tail: .075 },
};
const finite = (n: number, fallback = 0): number => Number.isFinite(n) ? n : fallback;
const clamp = (n: number): number => Math.max(0, Math.min(1, n));
const fraction = (n: number): number => ((n % 1) + 1) % 1;
const smooth = (n: number): number => n * n * (3 - 2 * n);

/** A grounded paw moves back by exactly the distance the body moves forward. */
function pawStep(phase: number, stride: number, height: number, strength: number, duty: number): CompanionPawStep {
  const p = fraction(phase);
  if (strength < .001) return { phase: p, planted: true, along: 0, lift: 0 };
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
  const heading = finite(input.heading), style = species[id];
  // A turn changes the travel direction, never the historical stride phase.
  // Keeping this denominator fixed also preserves a planted foot's travel.
  const stride = COMPANION_STRIDE[id];
  const safeScale = Math.max(.05, Math.abs(finite(scale, 1)));
  const speed = Math.max(0, finite(input.speed)) / safeScale;
  const strength = input.reducedMotion ? 0
    : clamp(input.blend === undefined ? smooth(clamp(speed / 12)) : finite(input.blend));
  const phase = fraction(Math.max(0, finite(input.distance)) / (stride * safeScale));
  const swing = Math.sin(phase * TAU), weight = Math.sin(phase * TAU * 2);
  const airborne = Math.sin(Math.PI * clamp((phase - style.duty) / (1 - style.duty)));
  const bound = id === 'rabbit' ? Math.max(0, Math.sin((phase - .3) * TAU)) : airborne;
  const hopping = id === 'rabbit' || id === 'owl';
  return {
    phase, stride, strength, heading,
    bodyY: (hopping ? -bound * style.body : (1 - Math.cos(phase * TAU * 2)) * style.body / 2) * strength,
    bodyRoll: (hopping ? -Math.cos(phase * TAU) : swing) * style.roll * strength,
    headTilt: -weight * style.head * strength,
    tailTilt: Math.sin(phase * TAU - .45) * style.tail * strength,
    earTilt: (id === 'rabbit' ? Math.sin(phase * TAU - .65) * .08
      : id === 'elephant' ? Math.sin(phase * TAU - .4) * .028 : -weight * .016) * strength,
    trunkTilt: id === 'elephant' ? -swing * .038 * strength : 0,
    wingTilt: id === 'owl' ? bound * .055 * strength : 0,
    paws: {
      frontNear: pawStep(phase + style.offsets.frontNear, stride, style.lift, strength, style.duty),
      frontFar: pawStep(phase + style.offsets.frontFar, stride, style.lift, strength, style.duty),
      hindNear: pawStep(phase + style.offsets.hindNear, stride, style.lift, strength, style.duty),
      hindFar: pawStep(phase + style.offsets.hindFar, stride, style.lift, strength, style.duty),
    },
  };
}
