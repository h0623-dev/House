import creaturesAtlasUrl from './assets/creatures-anime.png';

/** The same illustrated companion and infected roam the deck and battlefields. */
export type PetPose = 'idle' | 'walk' | 'run' | 'pounce' | 'celebrate';
export type ZombieKind = 'walker' | 'runner' | 'boss';
export type ZombiePose = 'idle' | 'walk' | 'attack' | 'hurt' | 'defeat';
export interface PetOptions {
  x: number; y: number; scale: number; time: number;
  facing: 1 | -1; pose?: PetPose; progress?: number;
}
export interface ZombieOptions {
  x: number; y: number; scale: number; time: number;
  kind: ZombieKind; facing?: 1 | -1;
  pose: ZombiePose; progress?: number; alpha?: number;
}

interface CreatureFrame {
  x: number; y: number; width: number; height: number;
  footX: number; footY: number;
  /** Atlas-local contour keeps a neighbour's outstretched boot or glove out. */
  contour?: readonly (readonly [number, number])[];
}

// Measured alpha silhouettes, with a small transparent margin around each.
// Nominal grid crops would include the adjacent runner's boot or boss's glove.
const dogFrames: Record<'idle' | 'walk' | 'run' | 'pounce', CreatureFrame> = {
  idle: { x: 42, y: 73, width: 309, height: 377, footX: 196, footY: 445 },
  walk: { x: 405, y: 99, width: 318, height: 342, footX: 566, footY: 437 },
  run: { x: 764, y: 121, width: 395, height: 339, footX: 968, footY: 455 },
  pounce: { x: 1175, y: 90, width: 352, height: 310, footX: 1338, footY: 395 },
};
const infectedFrames: Record<ZombieKind | 'strike', CreatureFrame> = {
  walker: {
    x: 17, y: 492, width: 363, height: 492, footX: 184, footY: 979,
    contour: [[17, 492], [380, 492], [380, 805], [346, 805], [346, 984], [17, 984]],
  },
  runner: {
    x: 356, y: 505, width: 388, height: 463, footX: 551, footY: 962,
    contour: [[385, 505], [744, 505], [744, 968], [356, 968], [356, 805], [385, 805]],
  },
  boss: {
    x: 753, y: 479, width: 418, height: 514, footX: 961, footY: 987,
    contour: [[753, 479], [1171, 479], [1171, 835], [1151, 835], [1151, 993], [753, 993]],
  },
  strike: {
    x: 1155, y: 513, width: 368, height: 475, footX: 1337, footY: 982,
    contour: [[1180, 513], [1523, 513], [1523, 988], [1155, 988], [1155, 834], [1180, 834]],
  },
};

export const creatureImage = new Image();
creatureImage.decoding = 'async';
creatureImage.src = creaturesAtlasUrl;
const TAU = Math.PI * 2;
const clamp = (value: number): number => Math.max(0, Math.min(1, value));

function shadow(c: CanvasRenderingContext2D, radius: number, alpha = .19): void {
  const gradient = c.createRadialGradient(0, 1, 0, 0, 1, radius);
  gradient.addColorStop(0, `rgba(49,47,32,${alpha})`);
  gradient.addColorStop(.65, `rgba(49,47,32,${alpha * .55})`);
  gradient.addColorStop(1, 'rgba(49,47,32,0)');
  c.save(); c.scale(1, .21); c.fillStyle = gradient;
  c.beginPath(); c.arc(0, 5, radius, 0, TAU); c.fill(); c.restore();
}

function drawFrame(c: CanvasRenderingContext2D, frame: CreatureFrame, height: number,
  referenceHeight = frame.footY - frame.y): void {
  const unit = height / referenceHeight;
  c.save();
  c.imageSmoothingEnabled = true;
  c.imageSmoothingQuality = 'high';
  if (frame.contour) {
    c.beginPath();
    frame.contour.forEach(([x, y], index) => {
      const px = (x - frame.footX) * unit, py = (y - frame.footY) * unit;
      if (index === 0) c.moveTo(px, py); else c.lineTo(px, py);
    });
    c.closePath(); c.clip();
  }
  c.drawImage(creatureImage, frame.x, frame.y, frame.width, frame.height,
    (frame.x - frame.footX) * unit, (frame.y - frame.footY) * unit,
    frame.width * unit, frame.height * unit);
  c.restore();
}

/** A subtle loading silhouette, replaced as soon as the bundled atlas decodes. */
function loadingSilhouette(c: CanvasRenderingContext2D, pet: boolean, height: number): void {
  c.save(); c.globalAlpha *= .23;
  c.fillStyle = pet ? '#bb956b' : '#80976c';
  c.beginPath(); c.ellipse(0, -height * .48, pet ? height * .37 : height * .19,
    height * .33, 0, 0, TAU); c.fill();
  c.beginPath(); c.ellipse(height * (pet ? .22 : 0), -height * .82,
    height * .15, height * .17, 0, 0, TAU); c.fill(); c.restore();
}

/** x/y are the soles; scale=1 produces a 65px-tall illustrated Bori. */
export function drawPet(c: CanvasRenderingContext2D, o: PetOptions): void {
  const pose = o.pose ?? 'idle', t = o.time;
  const moving = pose === 'walk' || pose === 'run';
  const phase = o.progress === undefined ? (t * 1.25) % 1 : clamp(o.progress);
  const pounce = pose === 'pounce' ? Math.sin(phase * Math.PI) : 0;
  const celebrate = pose === 'celebrate' ? Math.abs(Math.sin(t * 5.5)) : 0;
  // Two genuinely different illustrated gait silhouettes keep feet readable.
  const gait = Math.sin(t * (pose === 'run' ? 10 : 7));
  const frame = pose === 'pounce' ? dogFrames.pounce
    : pose === 'run' ? (gait > -.45 ? dogFrames.run : dogFrames.walk)
    : pose === 'walk' ? (gait > -.15 ? dogFrames.walk : dogFrames.idle)
    : dogFrames.idle;
  c.save(); c.translate(o.x, o.y); c.scale(o.scale * o.facing, o.scale);
  shadow(c, moving || pose === 'pounce' ? 28 : 23, .17);
  const bob = moving ? -Math.abs(gait) * (pose === 'run' ? 3 : 1.5)
    : -celebrate * 7 - pounce * 14 + Math.sin(t * 2.3) * .45;
  c.translate(0, bob); c.rotate(pose === 'pounce' ? -.045 * pounce
    : moving ? gait * .025 : Math.sin(t * 2) * .008);
  // A pounce has a shorter silhouette than standing, but Bori never grows
  // between poses: all four illustrations use the same pixel-to-world ratio.
  if (creatureImage.complete && creatureImage.naturalWidth) drawFrame(c, frame, 65, 372);
  else loadingSilhouette(c, true, 65);
  if (pose === 'pounce' && pounce > .18) {
    c.save(); c.globalAlpha *= pounce * .55; c.strokeStyle = '#fff0ba';
    c.lineCap = 'round'; c.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      c.beginPath(); c.moveTo(-39 - i * 5, -23 - i * 8);
      c.lineTo(-28 - i * 4, -24 - i * 8); c.stroke();
    }
    c.restore();
  }
  c.restore();
}

/** x/y are the soles; normal infected are 128px tall, the guard is 152px. */
export function drawZombie(c: CanvasRenderingContext2D, o: ZombieOptions): void {
  const t = o.time, h = o.kind === 'boss' ? 152 : 128;
  const phase = o.progress === undefined ? (t * 1.35) % 1 : clamp(o.progress);
  const impulse = Math.sin(phase * Math.PI);
  const moving = o.pose === 'walk';
  const stride = Math.sin(t * (o.kind === 'runner' ? 9.5 : 5.5));
  const frame = o.kind === 'walker' && o.pose === 'attack' ? infectedFrames.strike
    : infectedFrames[o.kind];
  const defeat = o.pose === 'defeat' ? phase : 0;
  c.save(); c.translate(o.x, o.y); c.scale(o.scale * (o.facing ?? 1), o.scale);
  c.globalAlpha *= clamp(o.alpha ?? 1) * (1 - defeat);
  shadow(c, o.kind === 'boss' ? 34 : 26, .19);
  c.translate(o.pose === 'attack' ? impulse * 5 : o.pose === 'hurt' ? -impulse * 5 : 0,
    moving ? -Math.abs(stride) * 1.7 : Math.sin(t * 2.1) * .65);
  c.rotate(o.pose === 'hurt' ? -.085 * impulse
    : o.pose === 'attack' ? .038 + impulse * .05
    : o.pose === 'defeat' ? defeat * .23
    : moving ? stride * .025 : Math.sin(t * 1.8) * .008);
  if (o.pose === 'hurt') c.globalAlpha *= .67 + Math.abs(Math.sin(t * 19)) * .33;
  if (creatureImage.complete && creatureImage.naturalWidth) drawFrame(c, frame, h);
  else loadingSilhouette(c, false, h);
  if (o.pose === 'attack' && impulse > .35) {
    c.save(); c.globalAlpha *= impulse * .5; c.strokeStyle = '#ead49b';
    c.lineWidth = 1.6; c.lineCap = 'round'; c.beginPath();
    c.ellipse(27, -h * .54, 22, 15, -.25, -.5, 1.1); c.stroke(); c.restore();
  }
  c.restore();
}

/** Bori's exact atlas face, used by companion dialogs and party skill badges. */
let portraitSequence = 0;
export function petPortrait(): string {
  const id = `bori-portrait-${++portraitSequence}`;
  return `<svg class="pet-portrait" viewBox="0 0 100 100" role="img" aria-label="초록 스카프를 두른 진돗개 보리"><defs><clipPath id="${id}-crop"><circle cx="50" cy="50" r="47"/></clipPath><radialGradient id="${id}-wash"><stop stop-color="#faf4d9"/><stop offset="1" stop-color="#d7e0b9"/></radialGradient></defs><circle cx="50" cy="50" r="49" fill="url(#${id}-wash)" stroke="#b8ae79" stroke-width="1.3"/><g clip-path="url(#${id}-crop)"><svg x="4" y="4" width="92" height="92" viewBox="190 69 177 177"><image href="${creaturesAtlasUrl}" width="1536" height="1024"/></svg></g></svg>`;
}
