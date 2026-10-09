import catAtlasUrl from './assets/companions-cat-anime.png';
import { creatureImage, drawPet, petPortrait, type PetPose } from './creatures';
import type { CompanionId } from './companions';

/** The same animal illustrations are used in the truck village and expeditions. */
export type CompanionPose = 'idle' | 'walk' | 'run' | 'attack' | 'skill' | 'hurt' | 'down' | 'celebrate';
export interface CompanionOptions {
  id: CompanionId;
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
const TAU = Math.PI * 2;
const clamp = (value: number): number => Math.max(0, Math.min(1, value));

export const catCompanionImage = new Image();
catCompanionImage.decoding = 'async';
catCompanionImage.src = catAtlasUrl;

export function companionArtReady(): boolean {
  return creatureImage.complete && creatureImage.naturalWidth > 0
    && catCompanionImage.complete && catCompanionImage.naturalWidth > 0;
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

/** At scale=1 Bori stands 65px tall, and Nabi is a smaller 58px companion. */
export function drawCompanion(c: CanvasRenderingContext2D, o: CompanionOptions): void {
  const pose = o.pose ?? 'idle';
  c.save(); c.translate(o.x, o.y); c.scale(o.scale * o.facing, o.scale);
  if (pose === 'hurt') c.globalAlpha *= .65 + Math.abs(Math.sin(o.time * 19)) * .35;
  if (pose === 'down') {
    // A defeated companion rests safely; neither blood nor a death silhouette.
    c.globalAlpha *= .65; c.scale(1, .55); c.rotate(-.1);
  }
  if (o.id === 'dog') {
    const dogPose: PetPose = pose === 'attack' || pose === 'skill' ? 'pounce'
      : pose === 'hurt' || pose === 'down' ? 'idle' : pose;
    drawPet(c, { x: 0, y: 0, scale: 1, time: pose === 'down' ? 0 : o.time,
      facing: 1, pose: dogPose, progress: o.progress });
  } else drawCat(c, pose === 'down' ? 0 : o.time, pose, o.progress);
  if (pose === 'down') recoveryHeart(c, o.time);
  c.restore();
}

let catPortraitSequence = 0;
/** Portraits crop the exact gameplay art, keeping the party and village coherent. */
export function companionPortrait(id: CompanionId): string {
  if (id === 'dog') return petPortrait();
  const clipId = `nabi-portrait-${++catPortraitSequence}`;
  return `<svg class="pet-portrait companion-portrait" viewBox="0 0 100 100" role="img" aria-label="주황 스카프를 두른 고양이 나비"><defs><clipPath id="${clipId}-crop"><circle cx="50" cy="50" r="47"/></clipPath><radialGradient id="${clipId}-wash"><stop stop-color="#faf4d9"/><stop offset="1" stop-color="#e5cbb2"/></radialGradient></defs><circle cx="50" cy="50" r="49" fill="url(#${clipId}-wash)" stroke="#b8ae79" stroke-width="1.3"/><g clip-path="url(#${clipId}-crop)"><svg x="4" y="4" width="92" height="92" viewBox="319 72 286 286"><image href="${catAtlasUrl}" width="1254" height="1254"/></svg></g></svg>`;
}
