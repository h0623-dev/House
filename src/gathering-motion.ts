/** One timeline drives the survivor's joints and the material being worked. */
export type GatheringMotionKind = 'chop' | 'mine' | 'pluck' | 'scoop';
export const GATHERING_CONTACT_PHASE = .48;

export interface GatheringMotion {
  phase: number;
  cycle: number;
  strikeIndex: number;
  contact: boolean;
  impact: number;
  reach: number;
  lift: number;
  hand: { x: number; y: number };
  toolAngle: number;
  bodyLean: number;
}

export function gatheringKindForResource(resource: 'wood' | 'scrap' | 'seeds' | 'water'): GatheringMotionKind {
  return resource === 'wood' ? 'chop' : resource === 'scrap' ? 'mine' : resource === 'water' ? 'scoop' : 'pluck';
}

const clamp = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const cyclesFor = (kind: GatheringMotionKind) => kind === 'chop' || kind === 'mine' ? 3 : 2;
const ease = (value: number) => { const p = clamp(value); return p * p * (3 - 2 * p); };
type Key = readonly [phase: number, handX: number, handY: number, angle: number];
const strikes: readonly Key[] = [[0, 7, -58, 1.05], [.24, -9, -94, -.8], [.34, -9, -94, -.8], [.48, 12, -52, 1.9], [.56, 13, -51, 1.96], [.78, 9, -58, 1.16], [1, 7, -58, 1.05]];
const plucks: readonly Key[] = [[0, 12, -25, 0], [.25, 20, -15, .2], [.48, 28, -9, .35], [.58, 26, -11, .25], [.84, 12, -32, -.4], [1, 12, -25, 0]];
const scoops: readonly Key[] = [[0, 14, -27, -.1], [.28, 24, -14, -.35], [.48, 29, -8, -.55], [.62, 27, -12, -.3], [.85, 16, -31, .05], [1, 14, -27, -.1]];

export function gatheringFinalContactProgress(kind: GatheringMotionKind): number {
  const cycles = cyclesFor(kind);
  return (cycles - 1 + GATHERING_CONTACT_PHASE) / cycles;
}

/** progress is the whole job, never a separately clocked cosmetic animation. */
export function sampleGatheringMotion(kind: GatheringMotionKind, progress: number): GatheringMotion {
  const scaled = clamp(progress) * cyclesFor(kind), cycle = Math.min(cyclesFor(kind) - 1, Math.floor(scaled));
  const phase = scaled - cycle;
  const keys = kind === 'chop' || kind === 'mine' ? strikes : kind === 'scoop' ? scoops : plucks;
  let a = keys[0], b = keys[1];
  for (let n = 1; n < keys.length; n++) { b = keys[n]; if (phase <= b[0]) break; a = b; }
  const blend = ease((phase - a[0]) / Math.max(.001, b[0] - a[0]));
  const hand = { x: a[1] + (b[1] - a[1]) * blend, y: a[2] + (b[2] - a[2]) * blend };
  const impactAge = phase - GATHERING_CONTACT_PHASE;
  return { phase, cycle, strikeIndex: cycle, contact: phase >= GATHERING_CONTACT_PHASE,
    impact: impactAge >= 0 && impactAge < .2 ? Math.pow(1 - impactAge / .2, 2) : 0,
    reach: ease(phase / GATHERING_CONTACT_PHASE), lift: ease((phase - .58) / .26), hand,
    toolAngle: a[3] + (b[3] - a[3]) * blend,
    bodyLean: (kind === 'chop' || kind === 'mine') ? -.025 + .055 * ease((phase - .34) / .14) - .03 * ease((phase - .56) / .22) : Math.sin(phase * Math.PI) * .025 };
}
