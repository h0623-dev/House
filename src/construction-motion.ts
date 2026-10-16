/** Three deliberate hammer strikes share the complete construction work span. */
export const HAMMER_STROKES = 3;
export const HAMMER_IMPACT_PHASE = .59;
export const HAMMER_CONTACT_END_PHASE = .69;
export const HAMMER_HEAD_DISTANCE = 28;

export interface HammerMotion {
  cycleIndex: number;
  cyclePhase: number;
  impact: boolean;
  hand: { x: number; y: number };
  hammerAngle: number;
  /** Center of the visible iron head in right-facing hero/feet coordinates. */
  head: { x: number; y: number };
}

const clamp = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const smooth = (value: number) => { const t = clamp(value); return t * t * (3 - 2 * t); };
const mix = (a: number, b: number, value: number) => a + (b - a) * value;

/**
 * Pure motion shared by the painted arms, hammer and scene impact effects.
 * Progress covers the entire work action, rather than an individual strike.
 */
export function sampleHammerMotion(progress: number): HammerMotion {
  const total = clamp(progress) * HAMMER_STROKES;
  const cycleIndex = Math.min(HAMMER_STROKES - 1, Math.floor(total));
  const cyclePhase = Math.min(1, total - cycleIndex);
  const resting = { x: 18, y: -53, angle: .58 };
  const raised = { x: 0, y: -103, angle: -.35 };
  const striking = { x: 29, y: -42, angle: 1.18 };
  let from = resting, to = raised, fraction = 0;
  if (cyclePhase < .34) {
    fraction = smooth(cyclePhase / .34);
  } else if (cyclePhase < .44) {
    from = raised; to = raised;
  } else if (cyclePhase < HAMMER_IMPACT_PHASE) {
    from = raised; to = striking;
    // Acceleration into the nail is fast; recovery deliberately takes longer.
    const strike = (cyclePhase - .44) / (HAMMER_IMPACT_PHASE - .44);
    fraction = strike * strike;
  } else if (cyclePhase < HAMMER_CONTACT_END_PHASE) {
    from = striking; to = striking;
  } else {
    from = striking; to = resting;
    fraction = smooth((cyclePhase - HAMMER_CONTACT_END_PHASE) / (1 - HAMMER_CONTACT_END_PHASE));
  }
  const hand = { x: mix(from.x, to.x, fraction), y: mix(from.y, to.y, fraction) };
  const hammerAngle = mix(from.angle, to.angle, fraction);
  return {
    cycleIndex, cyclePhase,
    impact: cyclePhase >= HAMMER_IMPACT_PHASE && cyclePhase < HAMMER_CONTACT_END_PHASE,
    hand, hammerAngle,
    head: { x: hand.x + Math.sin(hammerAngle) * HAMMER_HEAD_DISTANCE, y: hand.y - Math.cos(hammerAngle) * HAMMER_HEAD_DISTANCE },
  };
}

/** The same head point returned by drawHero().toolContact, before camera transforms. */
export function hammerContactAt(progress: number, x: number, y: number, scale: number, facing: 1 | -1): { x: number; y: number } {
  const { head } = sampleHammerMotion(progress);
  return { x: x + head.x * scale * facing, y: y + head.y * scale };
}
