import infectedAtlasUrl from './assets/haven-infected-miniature.webp';
import type { ZombieKind, ZombieOptions } from './creatures';

interface InfectedFrame {
  x: number; y: number; width: number; height: number;
  footX: number; footY: number;
}
interface InfectedArt {
  /** Every pose in a row shares one scale, including bent-knee steps. */
  referenceHeight: number;
  frames: readonly [InfectedFrame, InfectedFrame, InfectedFrame];
}

// Tight alpha bounds keep the preceding row's boot pixels out of the crop.
// Roots and soles use atlas coordinates; a row shares one pixel-to-world unit
// instead of enlarging a bent-knee pose to the standing pose's height.
const art: Record<ZombieKind, InfectedArt> = {
  walker: { referenceHeight: 420, frames: [
    { x: 133, y: 15, width: 215, height: 417, footX: 245, footY: 435 },
    { x: 512, y: 16, width: 249, height: 420, footX: 645, footY: 435 },
    { x: 909, y: 15, width: 259, height: 418, footX: 1045, footY: 435 },
  ] },
  runner: { referenceHeight: 397, frames: [
    { x: 124, y: 440, width: 226, height: 395, footX: 245, footY: 837 },
    { x: 514, y: 441, width: 261, height: 396, footX: 645, footY: 837 },
    { x: 913, y: 440, width: 256, height: 396, footX: 1045, footY: 837 },
  ] },
  boss: { referenceHeight: 406, frames: [
    { x: 104, y: 838, width: 288, height: 405, footX: 245, footY: 1244 },
    { x: 485, y: 839, width: 328, height: 405, footX: 645, footY: 1244 },
    { x: 865, y: 840, width: 340, height: 403, footX: 1045, footY: 1244 },
  ] },
};

const image = new Image();
image.decoding = 'async';
image.src = infectedAtlasUrl;
const TAU = Math.PI * 2;
const clamp = (value: number): number => Math.max(0, Math.min(1, value));

function shadow(c: CanvasRenderingContext2D, boss: boolean, fade: number): void {
  c.save();
  c.scale(1, .24);
  const radius = boss ? 36 : 27;
  const wash = c.createRadialGradient(0, 0, 1, 0, 0, radius);
  wash.addColorStop(0, `rgba(54,48,30,${.2 * fade})`);
  wash.addColorStop(.6, `rgba(54,48,30,${.1 * fade})`);
  wash.addColorStop(1, 'rgba(54,48,30,0)');
  c.fillStyle = wash;
  c.beginPath(); c.arc(0, 0, radius, 0, TAU); c.fill();
  c.restore();
}

/** Both the road cameos and combat use these same opaque, grounded figures. */
export function drawMiniatureInfected(c: CanvasRenderingContext2D, o: ZombieOptions): void {
  const config = art[o.kind], height = o.kind === 'boss' ? 152 : 128;
  const t = o.reducedMotion ? 0 : o.time;
  const moving = o.pose === 'walk' && !o.reducedMotion;
  const progress = clamp(o.progress ?? .5);
  const impulse = Math.sin(progress * Math.PI);
  const defeat = o.pose === 'defeat' ? progress : 0;
  // Use the authored contact and return silhouettes without stretching or
  // cross-fading limbs. The two contact drawings share a forward boot, so this
  // is a short illustrated step cycle, not an independent two-leg skeletal rig.
  const beat = Math.floor(t * (o.kind === 'runner' ? 6.4 : o.kind === 'boss' ? 3 : 4)) % 4;
  const frameIndex = moving ? ([1, 0, 2, 0] as const)[beat] : o.pose === 'attack' ? 2 : 0;
  const frame = config.frames[frameIndex];
  c.save();
  c.translate(o.x, o.y);
  c.scale(o.scale * (o.facing ?? 1), o.scale);
  c.globalAlpha *= clamp(o.alpha ?? 1);
  shadow(c, o.kind === 'boss', 1 - defeat);
  c.globalAlpha *= 1 - defeat;
  if (o.pose === 'attack') {
    c.translate(impulse * 4, 0);
    c.rotate(o.reducedMotion ? 0 : impulse * .055);
  } else if (o.pose === 'hurt') {
    c.translate(o.reducedMotion ? 0 : -impulse * 3, 0);
    c.rotate(o.reducedMotion ? 0 : -impulse * .065);
  } else if (o.pose === 'defeat') {
    c.rotate(o.reducedMotion ? 0 : defeat * .24);
    c.scale(1, 1 - defeat * .12);
  } else if (!moving) {
    // Breathing changes the chest height very slightly while soles stay put.
    c.scale(1, 1 + Math.sin(t * 1.7) * .003);
  }
  if (frame && image.complete && image.naturalWidth) {
    const unit = height / config.referenceHeight;
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = 'high';
    c.drawImage(image, frame.x, frame.y, frame.width, frame.height,
      (frame.x - frame.footX) * unit, (frame.y - frame.footY) * unit,
      frame.width * unit, frame.height * unit);
  } else {
    // Only a quiet compact placeholder while this bundled sheet decodes;
    // never fall back to the old long-limbed infected atlas.
    c.globalAlpha *= .3;
    c.fillStyle = '#81977b';
    c.beginPath(); c.ellipse(0, -height * .72, height * .2, height * .22, 0, 0, TAU); c.fill();
    c.fillStyle = '#68765b';
    c.beginPath(); c.roundRect(-height * .16, -height * .5, height * .32, height * .45, 9); c.fill();
  }
  if (o.pose === 'attack' && impulse > .4) {
    c.save();
    c.globalAlpha *= impulse * .4;
    c.strokeStyle = '#e8d2a1'; c.lineWidth = 1.5; c.lineCap = 'round';
    c.beginPath(); c.ellipse(height * .23, -height * .47, height * .14, height * .09, -.2, -.5, 1.1); c.stroke();
    c.restore();
  }
  c.restore();
}
