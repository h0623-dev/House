import survivorAtlasUrl from './assets/survivors-anime.png';
import survivorActionsUrl from './assets/survivors-actions.png';

export { survivorAtlasUrl, survivorActionsUrl };
export type SurvivorGender = 'female' | 'male';
export interface SurvivorFrame {
  sheet: 'survivors' | 'actions';
  x: number; y: number; width: number; height: number;
  /** Coordinates of the grounded feet in the original atlas. */
  footX: number; footY: number;
  /** Optional contour that removes detached particles from a neighbour. */
  trimBottomLeft?: { x: number; y: number };
}

// These are measured silhouette rectangles, rather than nominal grid cells.
// The battle boots and the watering particles cross a grid boundary in the
// illustration, so crops deliberately exclude every neighbouring character.
const frames: Record<SurvivorGender, Record<string, SurvivorFrame>> = {
  female: {
    idle: { sheet: 'survivors', x: 70, y: 3, width: 241, height: 491, footX: 197, footY: 489 },
    walk: { sheet: 'survivors', x: 413, y: 3, width: 287, height: 494, footX: 579, footY: 492 },
    garden: { sheet: 'survivors', x: 809, y: 5, width: 304, height: 487, footX: 948, footY: 487 },
    attack: { sheet: 'survivors', x: 1158, y: 2, width: 354, height: 496, footX: 1331, footY: 493 },
    sow: { sheet: 'actions', x: 74, y: 6, width: 290, height: 496, footX: 184, footY: 497 },
    water: { sheet: 'actions', x: 418, y: 2, width: 321, height: 509, footX: 569, footY: 506 },
    harvest: { sheet: 'actions', x: 838, y: 41, width: 299, height: 461, footX: 973, footY: 497 },
    chop: { sheet: 'actions', x: 1168, y: 12, width: 360, height: 498, footX: 1346, footY: 505 },
  },
  male: {
    idle: { sheet: 'survivors', x: 69, y: 525, width: 216, height: 490, footX: 186, footY: 1010 },
    walk: { sheet: 'survivors', x: 407, y: 525, width: 288, height: 499, footX: 554, footY: 1020 },
    garden: { sheet: 'survivors', x: 801, y: 529, width: 311, height: 487, footX: 945, footY: 1011 },
    attack: { sheet: 'survivors', x: 1129, y: 534, width: 394, height: 489, footX: 1327, footY: 1018 },
    sow: { sheet: 'actions', x: 37, y: 530, width: 346, height: 485, footX: 186, footY: 1010 },
    water: { sheet: 'actions', x: 421, y: 522, width: 352, height: 495, footX: 583, footY: 1012 },
    harvest: { sheet: 'actions', x: 813, y: 540, width: 325, height: 470, footX: 967, footY: 1005, trimBottomLeft: { x: 860, y: 780 } },
    chop: { sheet: 'actions', x: 1151, y: 515, width: 362, height: 500, footX: 1330, footY: 1010 },
  },
};

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
  if (pose === 'walk') return frames[gender][Math.sin(time * 8.5) > -.18 ? 'walk' : 'idle'];
  if (pose === 'attack' || pose === 'skill') return frames[gender].attack;
  return frames[gender][pose] ?? frames[gender].idle;
}

/** A face-and-shoulders crop of the exact same character used in the world. */
export const portraitCrops = {
  female: { x: 125, y: 2, size: 202, backdrop: '#f2e6c9' },
  male: { x: 99, y: 520, size: 193, backdrop: '#dce8dc' },
} as const;
