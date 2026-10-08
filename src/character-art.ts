import survivorAtlasUrl from './assets/survivors-anime.png';
import survivorActionsUrl from './assets/survivors-actions.png';
import survivorLocomotionUrl from './assets/survivors-locomotion.png';
import survivorGatheringUrl from './assets/survivors-gathering.png';

export { survivorAtlasUrl, survivorActionsUrl, survivorLocomotionUrl, survivorGatheringUrl };
export const survivorAtlasSize = { width: 1536, height: 1024 } as const;
export type SurvivorGender = 'female' | 'male';
export interface SurvivorFrame {
  sheet: 'survivors' | 'actions' | 'locomotion' | 'gathering';
  x: number; y: number; width: number; height: number;
  /** Coordinates of the grounded feet in the original atlas. */
  footX: number; footY: number;
  /** Standing source height shared by every pose; crouches stay shorter. */
  referenceHeight?: number;
  /** Source coordinates of the seed hand, watering spout, or tool contact. */
  effectAnchor?: { x: number; y: number };
  /** A source-space outline excludes neighbouring poses at tight atlas seams. */
  clip?: ReadonlyArray<readonly [number, number]>;
}
type FramePose = 'idle' | 'walkA' | 'walkB' | 'climbA' | 'climbB' | 'gatherReach' | 'gatherStow' | 'attack' | 'sow' | 'water' | 'harvest' | 'chop';

// Measured silhouettes of the matching miniature-village survivors. Tools
// cross nominal cell edges, so each crop follows the actual isolated figure.
const frames: Record<SurvivorGender, Record<FramePose, SurvivorFrame>> = {
  female: {
    idle: { sheet: 'survivors', x: 97, y: 35, width: 225, height: 462, footX: 218, footY: 491 },
    walkA: { sheet: 'locomotion', x: 76, y: 26, width: 316, height: 494, footX: 227, footY: 511, referenceHeight: 486 },
    walkB: { sheet: 'locomotion', x: 458, y: 26, width: 281, height: 492, footX: 615, footY: 510, referenceHeight: 486 },
    climbA: { sheet: 'locomotion', x: 828, y: 26, width: 300, height: 495, footX: 981, footY: 514, referenceHeight: 486,
      clip: [[828, 26], [1128, 26], [1128, 521], [920, 521], [920, 510], [828, 510]] },
    climbB: { sheet: 'locomotion', x: 1222, y: 28, width: 270, height: 493, footX: 1362, footY: 514, referenceHeight: 486,
      clip: [[1222, 28], [1492, 28], [1492, 510], [1390, 510], [1390, 521], [1222, 521]] },
    gatherReach: { sheet: 'gathering', x: 132, y: 73, width: 431, height: 556, footX: 324, footY: 609, referenceHeight: 820, effectAnchor: { x: 427, y: 571 } },
    gatherStow: { sheet: 'gathering', x: 705, y: 52, width: 410, height: 567, footX: 888, footY: 609, referenceHeight: 820, effectAnchor: { x: 1013, y: 430 } },
    attack: { sheet: 'survivors', x: 1181, y: 67, width: 348, height: 423, footX: 1334, footY: 484 },
    sow: { sheet: 'actions', x: 92, y: 59, width: 284, height: 433, footX: 216, footY: 486, effectAnchor: { x: 361, y: 366 } },
    water: { sheet: 'actions', x: 468, y: 52, width: 308, height: 440, footX: 591, footY: 486, effectAnchor: { x: 763, y: 388 } },
    harvest: { sheet: 'actions', x: 849, y: 135, width: 266, height: 356, footX: 954, footY: 485, effectAnchor: { x: 1034, y: 388 } },
    chop: { sheet: 'actions', x: 1184, y: 54, width: 344, height: 439, footX: 1330, footY: 487, effectAnchor: { x: 1438, y: 458 } },
  },
  male: {
    idle: { sheet: 'survivors', x: 88, y: 512, width: 237, height: 481, footX: 211, footY: 988 },
    walkA: { sheet: 'locomotion', x: 72, y: 522, width: 321, height: 484, footX: 229, footY: 998, referenceHeight: 484 },
    walkB: { sheet: 'locomotion', x: 477, y: 522, width: 275, height: 486, footX: 625, footY: 1000, referenceHeight: 484 },
    climbA: { sheet: 'locomotion', x: 838, y: 512, width: 285, height: 496, footX: 982, footY: 1000, referenceHeight: 484,
      clip: [[838, 512], [914, 512], [914, 523], [1123, 523], [1123, 1008], [838, 1008]] },
    climbB: { sheet: 'locomotion', x: 1210, y: 516, width: 286, height: 492, footX: 1360, footY: 1000, referenceHeight: 484,
      clip: [[1210, 523], [1389, 523], [1389, 516], [1496, 516], [1496, 1008], [1210, 1008]] },
    gatherReach: { sheet: 'gathering', x: 114, y: 651, width: 468, height: 558, footX: 325, footY: 1193, referenceHeight: 850, effectAnchor: { x: 435, y: 1161 } },
    gatherStow: { sheet: 'gathering', x: 728, y: 636, width: 429, height: 564, footX: 911, footY: 1193, referenceHeight: 850, effectAnchor: { x: 1042, y: 1044 } },
    attack: { sheet: 'survivors', x: 1164, y: 527, width: 365, height: 465, footX: 1329, footY: 986 },
    sow: { sheet: 'actions', x: 70, y: 533, width: 321, height: 460, footX: 214, footY: 987, effectAnchor: { x: 375, y: 843 } },
    water: { sheet: 'actions', x: 461, y: 534, width: 316, height: 460, footX: 595, footY: 988, effectAnchor: { x: 763, y: 873 } },
    harvest: { sheet: 'actions', x: 841, y: 614, width: 282, height: 373, footX: 957, footY: 981, effectAnchor: { x: 1023, y: 885 } },
    chop: { sheet: 'actions', x: 1176, y: 533, width: 352, height: 460, footX: 1332, footY: 987, effectAnchor: { x: 1450, y: 954 } },
  },
};

const standingHeights: Record<SurvivorGender, number> = { female: 453, male: 473 };
for (const gender of ['female', 'male'] as const) {
  for (const frame of Object.values(frames[gender])) frame.referenceHeight ??= standingHeights[gender];
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
  locomotion: imageAsset(survivorLocomotionUrl),
  gathering: imageAsset(survivorGatheringUrl),
};

export function heroFrame(gender: SurvivorGender, pose: string, time: number, progress?: number, climbing?: 'up' | 'down'): SurvivorFrame {
  // Distance-driven contact/passing poses bend the legs as well as swinging arms.
  if (pose === 'walk') return frames[gender][Math.sin(time * 9) >= 0 ? 'walkA' : 'walkB'];
  if (pose === 'climb') return frames[gender][Math.sin(time * 6 * (climbing === 'down' ? -1 : 1)) >= 0 ? 'climbA' : 'climbB'];
  if (pose === 'gather') return frames[gender][(progress ?? ((time / 3.8) % 1)) < .6 ? 'gatherReach' : 'gatherStow'];
  if (pose === 'attack' || pose === 'skill') return frames[gender].attack;
  if (pose === 'sow' || pose === 'water' || pose === 'harvest' || pose === 'chop') return frames[gender][pose];
  return frames[gender].idle;
}

/** Portraits show the exact same compact survivor who lives on the truck. */
export const portraitCrops = {
  female: { x: 94, y: 22, size: 240, backdrop: '#e6d8ad' },
  male: { x: 91, y: 501, size: 240, backdrop: '#d5d9b5' },
} as const;
