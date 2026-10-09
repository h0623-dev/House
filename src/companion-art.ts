import catAtlasUrl from './assets/companions-cat-anime.png';
import reserveAtlasUrl from './assets/companions-reserve-anime.png';
import { creatureImage, drawPet, petPortrait, type PetPose } from './creatures';
import { UNITS, type ReserveUnitId, type UnitId } from './units';

/** The same animal illustrations are used in the truck village and expeditions. */
export type CompanionPose = 'idle' | 'walk' | 'run' | 'attack' | 'skill' | 'hurt' | 'down' | 'celebrate';
export interface CompanionOptions {
  id: UnitId;
  /** x/y are the feet, in world coordinates. */
  x: number; y: number; scale: number; time: number;
  facing: 1 | -1; pose?: CompanionPose; progress?: number;
}

interface CatFrame {
  x: number; y: number; width: number; height: number;
  footX: number; footY: number;
}

// Bounds and feet measured from the bundled 1254px atlas. The pounce is wider
// than an ordinary grid cell, so cutting the sheet into quarters clips its paw.
const catFrames: Record<'idle' | 'walk' | 'pounce' | 'celebrate', CatFrame> = {
  idle: { x: 63, y: 86, width: 537, height: 535, footX: 333, footY: 612 },
  walk: { x: 666, y: 103, width: 580, height: 508, footX: 948, footY: 601 },
  pounce: { x: 49, y: 685, width: 735, height: 434, footX: 426, footY: 1110 },
  celebrate: { x: 805, y: 670, width: 433, height: 513, footX: 1068, footY: 1176 },
};
/** One fixed ratio prevents a cat from growing when it changes animation. */
const CAT_PIXEL_UNIT = 58 / 520;
type ReservePose = 'idle' | 'walk' | 'attack' | 'down';
interface ReserveArt {
  /** All four poses share this ratio, including shorter sleeping silhouettes. */
  pixelUnit: number;
  frames: Record<ReservePose, CatFrame>;
  portrait: readonly [number, number, number, number];
  description: string;
  wash: string;
}

// Individual alpha bounds were measured after generating transparent gutters.
// Every crop has >=4px of breathing room around its own silhouette; none contains
// another animal's ears, tail, hoof, wing, or the atlas's very faint gutter noise.
const reserveArt: Record<ReserveUnitId, ReserveArt> = {
  rabbit: {
    pixelUnit: 56 / 237, portrait: [121, 104, 180, 180],
    description: '약초 가방과 초록 스카프를 두른 토끼 루루', wash: '#d7e4bd',
    frames: {
      idle: { x: 93, y: 96, width: 178, height: 248, footX: 192, footY: 338 },
      walk: { x: 383, y: 107, width: 195, height: 231, footX: 478, footY: 332 },
      attack: { x: 691, y: 103, width: 199, height: 240, footX: 793, footY: 337 },
      down: { x: 997, y: 192, width: 201, height: 150, footX: 1095, footY: 336 },
    },
  },
  fox: {
    pixelUnit: 60 / 220, portrait: [177, 413, 139, 139],
    description: '파란 스카프를 두른 주황 여우 루비', wash: '#c7dfde',
    frames: {
      idle: { x: 47, y: 415, width: 253, height: 231, footX: 186, footY: 640 },
      walk: { x: 353, y: 418, width: 257, height: 222, footX: 486, footY: 634 },
      attack: { x: 660, y: 431, width: 296, height: 214, footX: 808, footY: 639 },
      down: { x: 1009, y: 464, width: 205, height: 180, footX: 1114, footY: 638 },
    },
  },
  boar: {
    pixelUnit: 64 / 203, portrait: [162, 738, 160, 160],
    description: '빨간 스카프와 가죽 보호대를 두른 멧돼지 도도', wash: '#e4c9b7',
    frames: {
      idle: { x: 49, y: 706, width: 263, height: 214, footX: 183, footY: 914 },
      walk: { x: 363, y: 705, width: 263, height: 214, footX: 500, footY: 913 },
      attack: { x: 661, y: 719, width: 277, height: 196, footX: 805, footY: 909 },
      down: { x: 983, y: 754, width: 232, height: 154, footX: 1098, footY: 902 },
    },
  },
  owl: {
    pixelUnit: 52 / 199, portrait: [108, 980, 160, 160],
    description: '보라 리본과 달빛 펜던트를 두른 부엉이 모모', wash: '#ded3e6',
    frames: {
      idle: { x: 73, y: 982, width: 184, height: 210, footX: 186, footY: 1186 },
      walk: { x: 373, y: 979, width: 204, height: 207, footX: 493, footY: 1180 },
      attack: { x: 663, y: 977, width: 294, height: 213, footX: 812, footY: 1184 },
      down: { x: 1016, y: 996, width: 184, height: 183, footX: 1110, footY: 1173 },
    },
  },
};
const TAU = Math.PI * 2;
const clamp = (value: number): number => Math.max(0, Math.min(1, value));

export const catCompanionImage = new Image();
catCompanionImage.decoding = 'async';
catCompanionImage.src = catAtlasUrl;
export const reserveCompanionImage = new Image();
reserveCompanionImage.decoding = 'async';
reserveCompanionImage.src = reserveAtlasUrl;

export function companionArtReady(): boolean {
  return creatureImage.complete && creatureImage.naturalWidth > 0
    && catCompanionImage.complete && catCompanionImage.naturalWidth > 0
    && reserveCompanionImage.complete && reserveCompanionImage.naturalWidth > 0;
}

function groundShadow(c: CanvasRenderingContext2D, moving: boolean): void {
  const radius = moving ? 27 : 22;
  const gradient = c.createRadialGradient(0, 0, 0, 0, 0, radius);
  gradient.addColorStop(0, 'rgba(49,47,32,.17)');
  gradient.addColorStop(.68, 'rgba(49,47,32,.07)');
  gradient.addColorStop(1, 'rgba(49,47,32,0)');
  c.save(); c.scale(1, .21); c.fillStyle = gradient;
  c.beginPath(); c.arc(0, 4, radius, 0, TAU); c.fill(); c.restore();
}

function drawCat(c: CanvasRenderingContext2D, time: number, pose: CompanionPose, progress?: number): void {
  const moving = pose === 'walk' || pose === 'run';
  const striking = pose === 'attack' || pose === 'skill';
  const phase = progress === undefined ? (time * 1.25) % 1 : clamp(progress);
  const leap = striking ? Math.sin(phase * Math.PI) : 0;
  const gait = Math.sin(time * (pose === 'run' ? 10 : 7));
  const happy = pose === 'celebrate' ? Math.abs(Math.sin(time * 5.5)) : 0;
  const frame = striking ? catFrames.pounce
    : pose === 'celebrate' ? catFrames.celebrate
    : pose === 'run' ? (gait > .1 ? catFrames.pounce : catFrames.walk)
    : pose === 'walk' ? (gait > -.15 ? catFrames.walk : catFrames.idle)
    : catFrames.idle;
  groundShadow(c, moving || striking);
  c.save();
  c.translate(0, moving ? -Math.abs(gait) * (pose === 'run' ? 2.5 : 1.3)
    : -leap * 9 - happy * 5 + Math.sin(time * 2.3) * .4);
  c.rotate(striking ? -.04 * leap : moving ? gait * .025 : Math.sin(time * 2) * .007);
  if (catCompanionImage.complete && catCompanionImage.naturalWidth) {
    c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
    c.drawImage(catCompanionImage, frame.x, frame.y, frame.width, frame.height,
      (frame.x - frame.footX) * CAT_PIXEL_UNIT, (frame.y - frame.footY) * CAT_PIXEL_UNIT,
      frame.width * CAT_PIXEL_UNIT, frame.height * CAT_PIXEL_UNIT);
  } else {
    c.save(); c.globalAlpha *= .23; c.fillStyle = '#baad96';
    c.beginPath(); c.ellipse(0, -25, 19, 18, 0, 0, TAU); c.fill();
    c.beginPath(); c.ellipse(15, -42, 10, 12, 0, 0, TAU); c.fill(); c.restore();
  }
  if (striking && leap > .18) {
    c.save(); c.globalAlpha *= leap * .68;
    c.strokeStyle = pose === 'skill' ? '#ffda88' : '#fff0c8';
    c.lineCap = 'round'; c.lineWidth = pose === 'skill' ? 1.9 : 1.3;
    for (let index = 0; index < 3; index++) {
      c.beginPath(); c.moveTo(33 + index * 3, -19 - index * 5);
      c.quadraticCurveTo(44 + index * 3, -24 - index * 5, 48 + index * 3, -34 - index * 5);
      c.stroke();
    }
    c.restore();
  }
  c.restore();
}

function recoveryHeart(c: CanvasRenderingContext2D, time: number): void {
  c.save(); c.translate(-10, -29 + Math.sin(time * 2) * 1.2);
  c.globalAlpha *= .74; c.fillStyle = '#cf977f';
  c.beginPath(); c.moveTo(0, 2); c.bezierCurveTo(-9, -3, -4, -9, 0, -5);
  c.bezierCurveTo(4, -9, 9, -3, 0, 2); c.fill(); c.restore();
}

function drawReserve(c: CanvasRenderingContext2D, id: ReserveUnitId,
  time: number, pose: CompanionPose, progress?: number): void {
  const art = reserveArt[id], moving = pose === 'walk' || pose === 'run';
  const striking = pose === 'attack' || pose === 'skill';
  const phase = progress === undefined ? (time * 1.25) % 1 : clamp(progress);
  const impulse = striking ? Math.sin(phase * Math.PI) : 0;
  const gait = Math.sin(time * (pose === 'run' ? 10 : 7));
  const frame = pose === 'down' ? art.frames.down : striking ? art.frames.attack
    : moving && gait > -.15 ? art.frames.walk : art.frames.idle;
  groundShadow(c, moving || id === 'boar');
  c.save();
  // Support, ranged and magic companions cast from their own feet. Only the
  // front-line boar leans into a charge; none becomes a jumping humanoid.
  const celebrate = pose === 'celebrate' ? Math.abs(Math.sin(time * 5.5)) * 3 : 0;
  const bob = pose === 'down' ? 0 : moving ? -Math.abs(gait) * (id === 'rabbit' ? 2.6 : id === 'owl' ? 1 : 1.3)
    : -celebrate + (id === 'boar' && striking ? -impulse * 1.2 : Math.sin(time * 2.3) * .35);
  c.translate(id === 'boar' && striking ? impulse * 2 : 0, bob);
  c.rotate(pose === 'down' ? 0 : moving ? gait * .02 : id === 'boar' && striking ? -.025 * impulse : Math.sin(time * 2) * .006);
  if (reserveCompanionImage.complete && reserveCompanionImage.naturalWidth) {
    c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
    c.drawImage(reserveCompanionImage, frame.x, frame.y, frame.width, frame.height,
      (frame.x - frame.footX) * art.pixelUnit, (frame.y - frame.footY) * art.pixelUnit,
      frame.width * art.pixelUnit, frame.height * art.pixelUnit);
  } else {
    c.save(); c.globalAlpha *= .23; c.fillStyle = '#b9a387';
    c.beginPath(); c.ellipse(0, -23, id === 'boar' ? 26 : 18, 20, 0, 0, TAU); c.fill(); c.restore();
  }
  if (pose === 'skill' && impulse > .12) {
    c.save(); c.globalAlpha *= impulse * .55;
    c.lineWidth = 1.3; c.strokeStyle = id === 'rabbit' ? '#c9e7a4' : id === 'owl' ? '#e9dafa' : '#ffe0a3';
    if (id === 'rabbit') {
      c.beginPath(); c.ellipse(0, -4, 26, 6, 0, 0, TAU); c.stroke();
      for (const [x, y] of [[-15, -35], [25, -27]]) {
        c.beginPath(); c.moveTo(x, y - 3); c.lineTo(x + 3, y); c.lineTo(x, y + 3); c.lineTo(x - 3, y); c.closePath(); c.stroke();
      }
    } else if (id === 'owl') {
      c.beginPath(); c.ellipse(0, -27, 26, 9, -.08, 0, TAU); c.stroke();
      c.beginPath(); c.arc(0, -40, 8, -.8, 1.3); c.stroke();
    } else if (id === 'fox') {
      for (let index = 0; index < 2; index++) {
        c.beginPath(); c.moveTo(35 + index * 4, -24 - index * 4); c.lineTo(41 + index * 4, -27 - index * 4); c.stroke();
      }
    }
    c.restore();
  }
  c.restore();
}

/** Feet anchors are shared; nominal heights are 52–65px across all six animals. */
export function drawCompanion(c: CanvasRenderingContext2D, o: CompanionOptions): void {
  const pose = o.pose ?? 'idle';
  c.save(); c.translate(o.x, o.y); c.scale(o.scale * o.facing, o.scale);
  if (pose === 'hurt') c.globalAlpha *= .65 + Math.abs(Math.sin(o.time * 19)) * .35;
  if (pose === 'down') {
    // Existing dog/cat keep their prior resting pose. The new atlas supplies
    // genuine peacefully sleeping silhouettes, so those are never flattened.
    c.globalAlpha *= o.id === 'dog' || o.id === 'cat' ? .65 : .78;
    if (o.id === 'dog' || o.id === 'cat') { c.scale(1, .55); c.rotate(-.1); }
  }
  if (o.id === 'dog') {
    const dogPose: PetPose = pose === 'attack' || pose === 'skill' ? 'pounce'
      : pose === 'hurt' || pose === 'down' ? 'idle' : pose;
    drawPet(c, { x: 0, y: 0, scale: 1, time: pose === 'down' ? 0 : o.time,
      facing: 1, pose: dogPose, progress: o.progress });
  } else if (o.id === 'cat') drawCat(c, pose === 'down' ? 0 : o.time, pose, o.progress);
  else drawReserve(c, o.id, pose === 'down' ? 0 : o.time, pose, o.progress);
  if (pose === 'down') recoveryHeart(c, o.time);
  c.restore();
}

let catPortraitSequence = 0;
/** Portraits crop the exact gameplay art, keeping the party and village coherent. */
export function companionPortrait(id: UnitId): string {
  if (id === 'dog') return petPortrait();
  if (id !== 'cat') {
    const art = reserveArt[id], clipId = `${id}-portrait-${++catPortraitSequence}`;
    return `<svg class="pet-portrait companion-portrait" viewBox="0 0 100 100" role="img" aria-label="${art.description}"><title>${UNITS[id].name}</title><defs><clipPath id="${clipId}-crop"><circle cx="50" cy="50" r="47"/></clipPath><radialGradient id="${clipId}-wash"><stop stop-color="#faf4d9"/><stop offset="1" stop-color="${art.wash}"/></radialGradient></defs><circle cx="50" cy="50" r="49" fill="url(#${clipId}-wash)" stroke="#b8ae79" stroke-width="1.3"/><g clip-path="url(#${clipId}-crop)"><svg x="4" y="4" width="92" height="92" viewBox="${art.portrait.join(' ')}"><image href="${reserveAtlasUrl}" width="1254" height="1254"/></svg></g></svg>`;
  }
  const clipId = `nabi-portrait-${++catPortraitSequence}`;
  return `<svg class="pet-portrait companion-portrait" viewBox="0 0 100 100" role="img" aria-label="주황 스카프를 두른 고양이 나비"><defs><clipPath id="${clipId}-crop"><circle cx="50" cy="50" r="47"/></clipPath><radialGradient id="${clipId}-wash"><stop stop-color="#faf4d9"/><stop offset="1" stop-color="#e5cbb2"/></radialGradient></defs><circle cx="50" cy="50" r="49" fill="url(#${clipId}-wash)" stroke="#b8ae79" stroke-width="1.3"/><g clip-path="url(#${clipId}-crop)"><svg x="4" y="4" width="92" height="92" viewBox="319 72 286 286"><image href="${catAtlasUrl}" width="1254" height="1254"/></svg></g></svg>`;
}
