import { heroFrame, heroImages, type SurvivorFrame } from './character-art';

/** The village and expeditions share one compact, painted survivor. */
export type HeroPose = 'idle' | 'walk' | 'sow' | 'water' | 'harvest' | 'chop' | 'attack' | 'skill' | 'hurt' | 'celebrate';
export interface HeroOptions {
  x: number; y: number; scale: number; time: number;
  gender: 'female' | 'male'; pose: HeroPose; facing: 1 | -1; progress?: number;
}
const TAU = Math.PI * 2;
const WORK_POSES = new Set<HeroPose>(['sow', 'water', 'harvest', 'chop']);
const clamp = (value: number) => Math.max(0, Math.min(1, value));

/** A stationary, warm contact shadow keeps the boots on the painted deck. */
function drawContactShadow(c: CanvasRenderingContext2D, spread = 1): void {
  c.save(); c.scale(1, .25);
  const gradient = c.createRadialGradient(0, 0, 1, 0, 0, 23 * spread);
  gradient.addColorStop(0, 'rgba(62,52,32,.22)');
  gradient.addColorStop(.48, 'rgba(62,52,32,.13)');
  gradient.addColorStop(1, 'rgba(62,52,32,0)');
  c.fillStyle = gradient; c.beginPath(); c.arc(0, 0, 23 * spread, 0, TAU); c.fill();
  c.restore();
}

/** A quiet, similarly proportioned loading figure avoids a different art style flashing in. */
function drawLoadingHero(c: CanvasRenderingContext2D, o: HeroOptions): void {
  const female = o.gender === 'female';
  const stride = o.pose === 'walk' ? Math.sin(o.time * 9) * 5 : 0;
  const skin = '#e5c4a0', hair = female ? '#77593c' : '#4f5746';
  c.save(); c.translate(o.x, o.y); c.scale(o.scale * o.facing, o.scale);
  drawContactShadow(c);
  c.lineCap = 'round'; c.lineJoin = 'round';
  const oval = (x: number, y: number, rx: number, ry: number, color: string) => {
    c.fillStyle = color; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fill();
  };
  const limb = (x1: number, y1: number, x2: number, y2: number, width: number, color: string) => {
    c.strokeStyle = color; c.lineWidth = width; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
  };
  // Broad boots, covered legs and a round head match the final atlas silhouette.
  limb(-10, -36, -10 + stride, -10, 14, '#6f7054');
  limb(10, -36, 10 - stride, -10, 14, '#79795a');
  oval(-8 + stride, -5, 10, 5, '#795c40'); oval(12 - stride, -5, 10, 5, '#795c40');
  oval(0, -56, 23, 30, '#7f8961');
  oval(0, -62, 15, 24, '#b8ba8b');
  limb(-18, -74, -23 - stride * .45, -46, 12, '#7f8961');
  limb(19, -74, 24 + stride * .45, -47, 12, '#919b6c');
  oval(-23 - stride * .45, -43, 5, 6, skin); oval(24 + stride * .45, -44, 5, 6, skin);
  oval(0, -79, 19, 8, '#c3a066');
  if (female) oval(-22, -90, 9, 22, hair);
  oval(0, -103, 27, 25, hair); oval(3, -100, 23, 22, skin);
  oval(-7, -117, 20, 10, hair); oval(16, -116, 13, 11, hair);
  oval(-7, -101, 2.2, 3, '#5b5140'); oval(13, -100, 2.2, 3, '#5b5140');
  c.strokeStyle = '#a37b5c'; c.lineWidth = 1.3; c.beginPath(); c.arc(4, -94, 4, .2, Math.PI - .2); c.stroke();
  c.restore();
}

function drawIllustration(c: CanvasRenderingContext2D, frame: SurvivorFrame): void {
  const image = heroImages[frame.sheet];
  // A crouch is shorter than a standing pose. Scaling every crop to the same
  // height made the old working poses visibly inflate their heads and bodies.
  const unit = 128 / (frame.referenceHeight ?? frame.footY - frame.y);
  c.save();
  c.drawImage(image, frame.x, frame.y, frame.width, frame.height,
    (frame.x - frame.footX) * unit, (frame.y - frame.footY) * unit,
    frame.width * unit, frame.height * unit);
  c.restore();
}

/** x/y are the soles; a standing survivor is 128 world pixels at scale 1. */
export function drawHero(c: CanvasRenderingContext2D, o: HeroOptions): void {
  const frame = heroFrame(o.gender, o.pose, o.time);
  const image = heroImages[frame.sheet];
  if (!image.complete || !image.naturalWidth) {
    drawLoadingHero(c, o);
    return;
  }
  const t = o.time, walking = o.pose === 'walk', working = WORK_POSES.has(o.pose);
  const combat = o.pose === 'attack' || o.pose === 'skill';
  const phase = o.progress === undefined ? (t * (o.pose === 'chop' ? 1.45 : 1.1)) % 1 : clamp(o.progress);
  const impulse = Math.sin(phase * Math.PI), stride = Math.sin(t * 9);
  const bob = walking ? -Math.abs(stride) * 1.35
    : o.pose === 'celebrate' ? -Math.abs(Math.sin(t * 6)) * 4 : 0;
  const lean = walking ? stride * .009
    : o.pose === 'chop' ? -.035 + impulse * .075
    : o.pose === 'sow' || o.pose === 'harvest' ? Math.sin(t * 4.4) * .011
    : combat ? -.022 + impulse * .055 : o.pose === 'hurt' ? -.045 : 0;
  const breath = walking || combat ? 0 : Math.sin(t * 2.2) * .0025;
  const press = working ? Math.sin(phase * TAU) * .006 : combat ? -impulse * .012 : 0;
  c.save(); c.translate(o.x, o.y); c.scale(o.scale * o.facing, o.scale);
  drawContactShadow(c, combat || o.pose === 'chop' ? 1.08 : 1);
  // Breathing scales around the soles instead of lifting a flat cutout off the ground.
  c.translate(0, bob); c.rotate(lean); c.scale(1 - breath * .35, 1 + breath + press);
  if (o.pose === 'hurt') c.globalAlpha *= .72 + Math.abs(Math.sin(t * 16)) * .28;
  c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
  drawIllustration(c, frame);

  const unit = 128 / (frame.referenceHeight ?? frame.footY - frame.y);
  const originX = frame.effectAnchor ? (frame.effectAnchor.x - frame.footX) * unit : 25;
  const originY = frame.effectAnchor ? (frame.effectAnchor.y - frame.footY) * unit : -43;
  // Small effects use the same muted, sunlit palette as the miniature garden.
  if (o.pose === 'sow') {
    for (let n = 0; n < 5; n++) {
      const p = (t * 1.3 + n / 5) % 1;
      c.fillStyle = n % 2 ? '#ddc17e' : '#b79053';
      c.beginPath(); c.ellipse(originX + p * 17, originY + p * p * 29, .9, 1.35, -.5, 0, TAU); c.fill();
    }
  }
  if (o.pose === 'water') {
    c.save();
    const alpha = c.globalAlpha;
    for (let n = 0; n < 8; n++) {
      const p = (t * 1.5 + n / 8) % 1;
      c.globalAlpha = alpha * .8 * (1 - p);
      c.fillStyle = n % 2 ? '#c0d9cc' : '#81b4b1';
      c.beginPath(); c.ellipse(originX + p * 14 + (n % 2) * 2, originY + p * 27, .8, 1.55, -.3, 0, TAU); c.fill();
    }
    c.restore();
  }
  if (o.pose === 'harvest') {
    c.save();
    const alpha = c.globalAlpha;
    for (let n = 0; n < 3; n++) {
      const p = (t * .85 + n / 3) % 1;
      c.globalAlpha = alpha * Math.sin(p * Math.PI) * .6; c.fillStyle = '#b9c98b';
      const x = originX + Math.sin(n * 3) * 8, y = originY - p * 15;
      c.beginPath(); c.ellipse(x, y, 1.5, 3.2, -.7 + n * .7, 0, TAU); c.fill();
    }
    c.restore();
  }
  if (o.pose === 'chop' && impulse > .6) {
    c.save(); c.globalAlpha *= (impulse - .6) * 1.4;
    for (let n = 0; n < 4; n++) {
      const p = (t * 1.6 + n * .19) % 1;
      c.fillStyle = n % 2 ? '#c49f66' : '#8b704b';
      c.fillRect(originX + p * 18, originY - Math.sin(p * Math.PI) * 11 + n, 2.3, 1.3);
    }
    c.restore();
  }
  if (combat && impulse > .3) {
    c.save(); c.globalAlpha *= impulse * .5;
    c.strokeStyle = o.pose === 'skill' ? '#c7dcb3' : '#e9d5a5';
    c.lineWidth = o.pose === 'skill' ? 3 : 1.8;
    c.beginPath(); c.ellipse(18, -60, 39, 31, -.4, -1.1, 1.2); c.stroke(); c.restore();
  }
  c.restore();
}
