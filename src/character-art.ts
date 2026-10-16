import survivorAtlasUrl from './assets/haven-hero-survivors.webp';
import survivorActionsUrl from './assets/haven-hero-actions.webp';
import survivorLocomotionUrl from './assets/haven-hero-locomotion.webp';
import survivorGatheringUrl from './assets/haven-hero-gathering.webp';

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

// Sculpted miniature survivors share the original registered joints. Tools
// cross nominal cell edges, so each crop follows the actual isolated figure.
const frames: Record<SurvivorGender, Record<FramePose, SurvivorFrame>> = {
  female: {
    idle: { sheet: 'survivors', x: 84, y: 23, width: 234, height: 481, footX: 218, footY: 499 },
    walkA: { sheet: 'locomotion', x: 66, y: 21, width: 327, height: 498, footX: 227, footY: 514, referenceHeight: 490 },
    walkB: { sheet: 'locomotion', x: 438, y: 20, width: 296, height: 495, footX: 615, footY: 510, referenceHeight: 490 },
    climbA: { sheet: 'locomotion', x: 847, y: 24, width: 287, height: 496, footX: 981, footY: 515, referenceHeight: 490,
      clip: [[847, 24], [1134, 24], [1134, 510], [1032, 510], [1032, 520], [920, 520], [920, 510], [847, 510]] },
    climbB: { sheet: 'locomotion', x: 1197, y: 22, width: 282, height: 497, footX: 1362, footY: 514, referenceHeight: 490,
      clip: [[1197, 22], [1479, 22], [1479, 510], [1390, 510], [1390, 519], [1300, 519], [1300, 510], [1197, 510]] },
    gatherReach: { sheet: 'gathering', x: 132, y: 73, width: 431, height: 556, footX: 324, footY: 609, referenceHeight: 820, effectAnchor: { x: 427, y: 571 } },
    gatherStow: { sheet: 'gathering', x: 705, y: 52, width: 410, height: 567, footX: 888, footY: 609, referenceHeight: 820, effectAnchor: { x: 1013, y: 430 } },
    attack: { sheet: 'survivors', x: 1177, y: 45, width: 350, height: 453, footX: 1334, footY: 492 },
    sow: { sheet: 'actions', x: 70, y: 39, width: 318, height: 468, footX: 216, footY: 502, effectAnchor: { x: 370, y: 357 } },
    water: { sheet: 'actions', x: 445, y: 38, width: 332, height: 469, footX: 591, footY: 502, effectAnchor: { x: 765, y: 389 } },
    harvest: { sheet: 'actions', x: 826, y: 122, width: 297, height: 386, footX: 954, footY: 503, effectAnchor: { x: 1034, y: 388 } },
    chop: { sheet: 'actions', x: 1156, y: 38, width: 361, height: 473, footX: 1330, footY: 506, effectAnchor: { x: 1438, y: 458 } },
  },
  male: {
    idle: { sheet: 'survivors', x: 85, y: 510, width: 237, height: 486, footX: 211, footY: 991 },
    walkA: { sheet: 'locomotion', x: 64, y: 505, width: 331, height: 501, footX: 229, footY: 1001, referenceHeight: 490 },
    walkB: { sheet: 'locomotion', x: 461, y: 510, width: 283, height: 497, footX: 625, footY: 1002, referenceHeight: 490 },
    climbA: { sheet: 'locomotion', x: 846, y: 514, width: 286, height: 494, footX: 982, footY: 1003, referenceHeight: 490,
      clip: [[846, 514], [914, 514], [914, 523], [1132, 523], [1132, 1008], [846, 1008]] },
    climbB: { sheet: 'locomotion', x: 1191, y: 515, width: 294, height: 493, footX: 1360, footY: 1003, referenceHeight: 490,
      clip: [[1191, 523], [1389, 523], [1389, 515], [1485, 515], [1485, 1008], [1191, 1008]] },
    gatherReach: { sheet: 'gathering', x: 114, y: 651, width: 468, height: 558, footX: 325, footY: 1193, referenceHeight: 850, effectAnchor: { x: 435, y: 1161 } },
    gatherStow: { sheet: 'gathering', x: 728, y: 636, width: 429, height: 564, footX: 911, footY: 1193, referenceHeight: 850, effectAnchor: { x: 1042, y: 1044 } },
    attack: { sheet: 'survivors', x: 1163, y: 515, width: 364, height: 481, footX: 1329, footY: 991 },
    sow: { sheet: 'actions', x: 46, y: 506, width: 349, height: 484, footX: 214, footY: 985, effectAnchor: { x: 383, y: 846 } },
    water: { sheet: 'actions', x: 440, y: 506, width: 337, height: 485, footX: 595, footY: 986, effectAnchor: { x: 767, y: 875 } },
    harvest: { sheet: 'actions', x: 828, y: 581, width: 310, height: 404, footX: 957, footY: 980, effectAnchor: { x: 1023, y: 885 } },
    chop: { sheet: 'actions', x: 1156, y: 509, width: 365, height: 482, footX: 1332, footY: 986, effectAnchor: { x: 1450, y: 954 } },
  },
};

const standingHeights: Record<SurvivorGender, number> = { female: 473, male: 480 };
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
  // The rig moves the original painted limbs; its body never swaps to a
  // second static drawing halfway through a tool stroke.
  if (pose === 'mine') return frames[gender].chop;
  if (pose === 'pluck' || pose === 'scoop') return frames[gender].gatherReach;
  if (pose === 'attack' || pose === 'skill') return frames[gender].attack;
  if (pose === 'sow' || pose === 'water' || pose === 'harvest' || pose === 'chop') return frames[gender][pose];
  return frames[gender].idle;
}

/** Portraits show the exact same compact survivor who lives on the truck. */
export const portraitCrops = {
  female: { x: 82, y: 15, size: 245, backdrop: '#e7d8ac' },
  male: { x: 81, y: 502, size: 245, backdrop: '#d9ddba' },
} as const;
