import survivorAtlasUrl from './assets/survivors-anime.png';
import survivorActionsUrl from './assets/survivors-actions.png';

export { survivorAtlasUrl, survivorActionsUrl };
export const survivorAtlasSize = { width: 1536, height: 1024 } as const;
export type SurvivorGender = 'female' | 'male';
export interface SurvivorFrame {
  sheet: 'survivors' | 'actions';
  x: number; y: number; width: number; height: number;
  /** Coordinates of the grounded feet in the original atlas. */
  footX: number; footY: number;
  /** Standing source height shared by every pose; crouches stay shorter. */
  referenceHeight?: number;
  /** Source coordinates of the seed hand, watering spout, or tool contact. */
  effectAnchor?: { x: number; y: number };
}
type FramePose = 'idle' | 'walkA' | 'walkB' | 'attack' | 'sow' | 'water' | 'harvest' | 'chop';

// Measured silhouettes of the matching miniature-village survivors. Tools
// cross nominal cell edges, so each crop follows the actual isolated figure.
const frames: Record<SurvivorGender, Record<FramePose, SurvivorFrame>> = {
  female: {
    idle: { sheet: 'survivors', x: 97, y: 35, width: 225, height: 462, footX: 218, footY: 491 },
    walkA: { sheet: 'survivors', x: 462, y: 40, width: 283, height: 450, footX: 602, footY: 484 },
    walkB: { sheet: 'survivors', x: 835, y: 40, width: 252, height: 452, footX: 967, footY: 486 },
    attack: { sheet: 'survivors', x: 1181, y: 67, width: 348, height: 423, footX: 1334, footY: 484 },
    sow: { sheet: 'actions', x: 92, y: 59, width: 284, height: 433, footX: 216, footY: 486, effectAnchor: { x: 361, y: 366 } },
    water: { sheet: 'actions', x: 468, y: 52, width: 308, height: 440, footX: 591, footY: 486, effectAnchor: { x: 763, y: 388 } },
    harvest: { sheet: 'actions', x: 849, y: 135, width: 266, height: 356, footX: 954, footY: 485, effectAnchor: { x: 1034, y: 388 } },
    chop: { sheet: 'actions', x: 1184, y: 54, width: 344, height: 439, footX: 1330, footY: 487, effectAnchor: { x: 1438, y: 458 } },
  },
  male: {
    idle: { sheet: 'survivors', x: 88, y: 512, width: 237, height: 481, footX: 211, footY: 988 },
    walkA: { sheet: 'survivors', x: 455, y: 517, width: 300, height: 473, footX: 605, footY: 984 },
    walkB: { sheet: 'survivors', x: 825, y: 517, width: 284, height: 473, footX: 969, footY: 984 },
    attack: { sheet: 'survivors', x: 1164, y: 527, width: 365, height: 465, footX: 1329, footY: 986 },
    sow: { sheet: 'actions', x: 70, y: 533, width: 321, height: 460, footX: 214, footY: 987, effectAnchor: { x: 375, y: 843 } },
    water: { sheet: 'actions', x: 461, y: 534, width: 316, height: 460, footX: 595, footY: 988, effectAnchor: { x: 763, y: 873 } },
    harvest: { sheet: 'actions', x: 841, y: 614, width: 282, height: 373, footX: 957, footY: 981, effectAnchor: { x: 1023, y: 885 } },
    chop: { sheet: 'actions', x: 1176, y: 533, width: 352, height: 460, footX: 1332, footY: 987, effectAnchor: { x: 1450, y: 954 } },
  },
};

const standingHeights: Record<SurvivorGender, number> = { female: 453, male: 473 };
for (const gender of ['female', 'male'] as const) {
  for (const frame of Object.values(frames[gender])) frame.referenceHeight = standingHeights[gender];
}

function imageAsset(url: string): HTMLImageElement {
  const image = new Image();
  image.decoding = 'async';
  image.src = url;
  return image;
}

export const heroImages = {
  survivors: imageAsset(survivorAtlasUrl),
  actions: imageAsset(survivorActionsUrl),
};

export function heroFrame(gender: SurvivorGender, pose: string, time: number): SurvivorFrame {
  // Both walking poses keep the same identity, head size, and ground anchor.
  if (pose === 'walk') return frames[gender][Math.sin(time * 9) >= 0 ? 'walkA' : 'walkB'];
  if (pose === 'attack' || pose === 'skill') return frames[gender].attack;
  if (pose === 'sow' || pose === 'water' || pose === 'harvest' || pose === 'chop') return frames[gender][pose];
  return frames[gender].idle;
}

/** Portraits show the exact same compact survivor who lives on the truck. */
export const portraitCrops = {
  female: { x: 94, y: 22, size: 240, backdrop: '#e6d8ad' },
  male: { x: 91, y: 501, size: 240, backdrop: '#d5d9b5' },
} as const;
