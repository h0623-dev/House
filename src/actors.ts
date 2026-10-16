import { heroFrame, heroImages, type SurvivorFrame } from './character-art';
import { drawSurvivorOutfit, type OutfitDrawLayer } from './outfit-art';
import type { EquippedOutfitId } from './shop';
import { drawGatheringBody, drawGatheringLimbs, isGatheringRigPose } from './gathering-rig';

/** The village and expeditions share one compact, painted survivor. */
export type HeroPose = 'idle' | 'walk' | 'climb' | 'gather' | 'sow' | 'water' | 'harvest' | 'chop' | 'mine' | 'pluck' | 'scoop' | 'attack' | 'skill' | 'hurt' | 'celebrate' | 'pet' | 'ride';
export interface HeroOptions {
  x: number; y: number; scale: number; time: number;
  gender: 'female' | 'male'; pose: HeroPose; facing: 1 | -1; progress?: number;
  climbing?: 'up' | 'down';
  outfit?: EquippedOutfitId;
  reducedMotion?: boolean;
  /** Small companions are stroked from a crouch; tall animals from standing. */
  pettingHeight?: 'low' | 'high';
}
export interface HeroDrawResult { outfit: EquippedOutfitId; gender: 'female' | 'male'; frame: string; imageReady: boolean; layers: OutfitDrawLayer[]; toolContact?: { x: number; y: number } }
const TAU = Math.PI * 2;
const WORK_POSES = new Set<HeroPose>(['gather', 'sow', 'water', 'harvest', 'chop', 'mine', 'pluck', 'scoop']);
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
  if (frame.clip) {
    c.beginPath();
    frame.clip.forEach(([x, y], index) => {
      const cx = (x - frame.footX) * unit, cy = (y - frame.footY) * unit;
      if (index === 0) c.moveTo(cx, cy); else c.lineTo(cx, cy);
    });
    c.closePath(); c.clip();
  }
  c.drawImage(image, frame.x, frame.y, frame.width, frame.height,
    (frame.x - frame.footX) * unit, (frame.y - frame.footY) * unit,
    frame.width * unit, frame.height * unit);
  c.restore();
}

type InteractionPoint = readonly [number, number];
type InteractionPolygon = ReadonlyArray<InteractionPoint>;
interface InteractionPart { canvas: HTMLCanvasElement; x: number; y: number; pivot: InteractionPoint; end: InteractionPoint }
interface InteractionRig { body: HTMLCanvasElement; upper: InteractionPart; fore: InteractionPart; openFore: InteractionPart; thigh: InteractionPart; shin: InteractionPart }

// Original painted pixels form the moving joints, so affection and riding do
// not replace the survivor with a differently styled procedural character.
const interactionSources = {
  female: {
    shoulder: [1288, 246], elbow: [1332, 266], hand: [1425, 234],
    upper: [[1273, 230], [1303, 225], [1331, 244], [1348, 262], [1326, 282], [1299, 276], [1277, 261]],
    fore: [[1324, 254], [1358, 247], [1392, 230], [1420, 211], [1443, 223], [1441, 245], [1408, 266], [1365, 282], [1330, 284]],
    openFore: [[279, 307], [303, 305], [328, 326], [350, 331], [369, 345], [376, 361], [369, 375], [350, 376], [322, 359], [306, 351], [286, 333]],
    openElbow: [290, 319], openHand: [357, 355],
    hip: [199, 324], knee: [182, 401], ankle: [171, 463],
    thigh: [[168, 308], [220, 312], [225, 355], [207, 408], [157, 423], [146, 405]],
    shin: [[153, 395], [209, 406], [202, 440], [199, 478], [182, 491], [144, 481], [133, 460]],
    standingArms: [
      [[138, 222], [179, 219], [188, 259], [172, 299], [174, 330], [178, 358], [154, 378], [126, 359], [135, 323], [139, 291]],
      [[265, 237], [293, 238], [302, 275], [313, 321], [317, 352], [300, 366], [275, 354], [272, 317], [263, 281]],
    ],
    petArms: [
      [[267, 428], [311, 418], [339, 442], [345, 473], [369, 520], [398, 540], [410, 629], [351, 629], [328, 551], [303, 509], [275, 478], [257, 451]],
      [[439, 364], [563, 364], [563, 629], [411, 629], [411, 544], [432, 494], [420, 441]],
    ],
    kneePatch: [[260, 434], [303, 427], [349, 453], [358, 529], [333, 574], [276, 579], [248, 527]],
  },
  male: {
    shoulder: [1288, 746], elbow: [1332, 768], hand: [1428, 737],
    upper: [[1269, 728], [1303, 726], [1331, 745], [1350, 763], [1326, 787], [1298, 779], [1274, 763]],
    fore: [[1324, 755], [1358, 750], [1393, 733], [1422, 712], [1449, 725], [1445, 750], [1410, 770], [1366, 786], [1330, 787]],
    openFore: [[291, 793], [315, 790], [342, 812], [363, 816], [384, 831], [392, 846], [384, 861], [365, 862], [336, 844], [320, 837], [299, 817]],
    openElbow: [304, 804], openHand: [371, 840],
    hip: [192, 811], knee: [169, 898], ankle: [161, 957],
    thigh: [[161, 791], [222, 792], [223, 844], [201, 905], [150, 922], [126, 895]],
    shin: [[137, 883], [197, 896], [194, 930], [193, 975], [180, 989], [137, 984], [120, 963]],
    standingArms: [
      [[126, 698], [172, 691], [184, 739], [165, 770], [161, 805], [172, 836], [152, 851], [119, 838], [117, 807], [125, 766]],
      [[265, 714], [294, 718], [306, 757], [316, 791], [319, 820], [300, 836], [277, 820], [275, 789], [266, 751]],
    ],
    petArms: [
      [[246, 962], [300, 948], [336, 977], [345, 1020], [374, 1090], [402, 1125], [411, 1209], [342, 1209], [325, 1120], [291, 1064], [264, 1031], [245, 997]],
      [[439, 947], [582, 947], [582, 1209], [411, 1209], [411, 1125], [432, 1073], [420, 1025]],
    ],
    kneePatch: [[249, 977], [306, 963], [355, 1006], [362, 1090], [334, 1154], [270, 1156], [238, 1096]],
  },
} as const;

function interactionPath(c: CanvasRenderingContext2D, points: InteractionPolygon): void {
  c.beginPath(); points.forEach(([x, y], index) => index ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath();
}

function interactionPart(image: HTMLImageElement, points: InteractionPolygon, pivot: InteractionPoint, end: InteractionPoint): InteractionPart | undefined {
  const x = Math.floor(Math.min(...points.map(point => point[0]))), y = Math.floor(Math.min(...points.map(point => point[1])));
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(Math.max(...points.map(point => point[0]))) - x + 2;
  canvas.height = Math.ceil(Math.max(...points.map(point => point[1]))) - y + 2;
  const c = canvas.getContext('2d'); if (!c) return undefined;
  c.translate(-x, -y); interactionPath(c, points); c.clip(); c.drawImage(image, 0, 0);
  return { canvas, x, y, pivot, end };
}

const interactionRigs = new Map<string, InteractionRig>();
function interactionRig(gender: HeroOptions['gender'], frame: SurvivorFrame, pose: 'crouch' | 'stand' | 'seat'): InteractionRig | undefined {
  const key = `${gender}:${pose}`, cached = interactionRigs.get(key); if (cached) return cached;
  const image = heroImages[frame.sheet], actions = heroImages.actions, survivor = heroImages.survivors;
  if (![image, actions, survivor].every(asset => asset.complete && asset.naturalWidth)) return undefined;
  const source = interactionSources[gender];
  const upper = interactionPart(actions, source.upper, source.shoulder, source.elbow);
  const fore = interactionPart(actions, source.fore, source.elbow, source.hand);
  const openFore = interactionPart(actions, source.openFore, source.openElbow, source.openHand);
  const thigh = interactionPart(survivor, source.thigh, source.hip, source.knee);
  const shin = interactionPart(survivor, source.shin, source.knee, source.ankle);
  if (!upper || !fore || !openFore || !thigh || !shin) return undefined;
  const body = document.createElement('canvas'); body.width = frame.width; body.height = frame.height;
  const c = body.getContext('2d'); if (!c) return undefined;
  c.drawImage(image, frame.x, frame.y, frame.width, frame.height, 0, 0, frame.width, frame.height);
  c.translate(-frame.x, -frame.y);
  c.globalCompositeOperation = 'destination-out';
  const masks = pose === 'crouch' ? source.petArms : source.standingArms;
  for (const mask of masks) { interactionPath(c, mask); c.fill(); }
  if (pose === 'seat') c.fillRect(frame.x - 2, source.hip[1] - 4, frame.width + 4, frame.height);
  c.globalCompositeOperation = 'source-over';
  if (pose === 'crouch') {
    // The original near arm crosses the knee. Repaint only that occluded
    // cloth, keeping the original face, hair, torso, backpack and boots.
    c.save(); interactionPath(c, masks[0]); c.clip();
    const patch = source.kneePatch, top = Math.min(...patch.map(point => point[1]));
    const cloth = c.createLinearGradient(patch[0][0], top, patch[0][0] + 80, top + 160);
    cloth.addColorStop(0, '#858873'); cloth.addColorStop(.55, '#70785f'); cloth.addColorStop(1, '#596052');
    interactionPath(c, patch); c.fillStyle = cloth; c.fill();
    c.strokeStyle = '#a1a488'; c.lineWidth = 3; c.lineCap = 'round';
    c.beginPath(); c.moveTo(patch[0][0] + 27, top + 20); c.quadraticCurveTo(patch[0][0] + 65, top + 40, patch[0][0] + 55, top + 110); c.stroke();
    c.restore();
  }
  const prepared = { body, upper, fore, openFore, thigh, shin }; interactionRigs.set(key, prepared); return prepared;
}

function interactionSegment(c: CanvasRenderingContext2D, part: InteractionPart, start: InteractionPoint, end: InteractionPoint, width = 1): void {
  const sx = part.end[0] - part.pivot[0], sy = part.end[1] - part.pivot[1];
  const dx = end[0] - start[0], dy = end[1] - start[1], scale = Math.hypot(dx, dy) / Math.hypot(sx, sy);
  c.save(); c.translate(start[0], start[1]); c.rotate(Math.atan2(dy, dx) - Math.atan2(sy, sx)); c.scale(scale, scale * width);
  c.drawImage(part.canvas, part.x - part.pivot[0], part.y - part.pivot[1]); c.restore();
}

function interactionElbow(shoulder: InteractionPoint, hand: InteractionPoint, upperLength: number, foreLength: number): InteractionPoint {
  const dx = hand[0] - shoulder[0], dy = hand[1] - shoulder[1], distance = Math.max(.01, Math.min(upperLength + foreLength - .01, Math.hypot(dx, dy)));
  const direction = Math.atan2(dy, dx), along = (upperLength * upperLength - foreLength * foreLength + distance * distance) / (2 * distance);
  const bend = Math.sqrt(Math.max(0, upperLength * upperLength - along * along));
  return [shoulder[0] + Math.cos(direction) * along - Math.sin(direction) * bend, shoulder[1] + Math.sin(direction) * along + Math.cos(direction) * bend];
}

function interactionArm(c: CanvasRenderingContext2D, rig: InteractionRig, shoulder: InteractionPoint, hand: InteractionPoint, crouch: boolean, width = 1, openPalm = false): void {
  const elbow = interactionElbow(shoulder, hand, crouch ? 16 : 20, crouch ? 22 : 25);
  interactionSegment(c, rig.upper, shoulder, elbow, width); interactionSegment(c, openPalm ? rig.openFore : rig.fore, elbow, hand, width);
}

function drawHeroInteraction(c: CanvasRenderingContext2D, o: HeroOptions): HeroDrawResult | undefined {
  const riding = o.pose === 'ride', crouching = !riding && o.pettingHeight !== 'high';
  const frame = heroFrame(o.gender, crouching ? 'pluck' : 'idle', o.time);
  const rig = interactionRig(o.gender, frame, riding ? 'seat' : crouching ? 'crouch' : 'stand'); if (!rig) return undefined;
  const outfit = o.outfit ?? 'default', unit = 128 / (frame.referenceHeight ?? frame.footY - frame.y);
  // Progress controls a gentle arrival/departure; repeated hand strokes use
  // their own clock and therefore cannot turn into one long tool swing.
  const progress = o.progress === undefined ? .5 : clamp(o.progress);
  const settle = Math.min(1, progress / .12, (1 - progress) / .14);
  const stroke = o.reducedMotion ? 0 : Math.sin(o.time * 4.8), breath = o.reducedMotion ? 0 : Math.sin(o.time * 2.1) * .32;
  c.save(); c.translate(o.x, o.y); c.scale(o.scale * o.facing, o.scale);
  if (!riding) drawContactShadow(c, crouching ? .92 : 1);
  c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
  if (riding) {
    // This anchor is the seat, not the soles. The pelvis stays planted while
    // the thigh, bent knee and hanging boot stay still against the animal.
    const saddle = -1 + breath * .25;
    c.save(); c.globalAlpha *= .88;
    interactionSegment(c, rig.thigh, [-8, saddle], [10, 13 + saddle], .87);
    interactionSegment(c, rig.shin, [10, 13 + saddle], [5, 32 + saddle], .9); c.restore();
    const hipY = (interactionSources[o.gender].hip[1] - frame.footY) * unit;
    c.save(); c.translate(0, -hipY + saddle);
    c.drawImage(rig.body, (frame.x - frame.footX) * unit, (frame.y - frame.footY) * unit, frame.width * unit, frame.height * unit);
    const layers = drawSurvivorOutfit(c, o.gender, frame, outfit); c.restore();
    interactionSegment(c, rig.thigh, [0, saddle], [20, 14 + saddle]);
    interactionSegment(c, rig.shin, [20, 14 + saddle], [15, 36 + saddle]);
    interactionArm(c, rig, [0, -28 + saddle], [28, -10 + saddle], false, .9);
    interactionArm(c, rig, [-12, -27 + saddle], [20, -8 + saddle], false);
    c.restore();
    return { outfit, gender: o.gender, frame: `ride:${frame.sheet}:${frame.x}`, imageReady: true, layers };
  }
  c.translate(0, breath);
  c.drawImage(rig.body, (frame.x - frame.footX) * unit, (frame.y - frame.footY) * unit, frame.width * unit, frame.height * unit);
  const layers = drawSurvivorOutfit(c, o.gender, frame, outfit);
  // The quiet hand rests on a knee/hip. The open front wrist follows the
  // companion's head with a slow back-and-forth stroke, without any tool.
  interactionArm(c, rig, crouching ? [12, -33] : [16, -69], crouching ? [17, -17] : [18, -45], crouching, .86);
  const hand: InteractionPoint = crouching
    ? [17 + settle * (12 + stroke * 4), -14 - settle * (9 + Math.cos(o.time * 4.8) * 1.2)]
    : [12 + settle * (22 + stroke * 3.5), -44 - settle * (25 + Math.cos(o.time * 4.8) * 1.2)];
  interactionArm(c, rig, crouching ? [-5, -31] : [-13, -68], hand, crouching, 1, true);
  c.restore();
  return { outfit, gender: o.gender, frame: `pet:${frame.sheet}:${frame.x}`, imageReady: true, layers };
}

/** x/y are the soles, or the hip/seat for 'ride'; standing height is 128 at scale 1. */
export function drawHero(c: CanvasRenderingContext2D, o: HeroOptions): HeroDrawResult {
  if (o.pose === 'pet' || o.pose === 'ride') {
    const interaction = drawHeroInteraction(c, o); if (interaction) return interaction;
  }
  const frame = heroFrame(o.gender, o.pose, o.time, o.progress, o.climbing);
  const image = heroImages[frame.sheet];
  const outfit=o.outfit??'default',frameId=`${frame.sheet}:${frame.x}`;
  if (!image.complete || !image.naturalWidth) {
    drawLoadingHero(c, o);
    return {outfit,gender:o.gender,frame:frameId,imageReady:false,layers:[]};
  }
  const t = o.time, walking = o.pose === 'walk', climbing = o.pose === 'climb', working = WORK_POSES.has(o.pose);
  const gathering = isGatheringRigPose(o.pose) ? o.pose : undefined;
  const combat = o.pose === 'attack' || o.pose === 'skill';
  const phase = o.progress === undefined ? (t * (o.pose === 'chop' ? 1.45 : 1.1)) % 1 : clamp(o.progress);
  const impulse = Math.sin(phase * Math.PI), stride = Math.sin(t * 9);
  const bob = walking ? -Math.abs(stride) * .8
    : o.pose === 'celebrate' ? -Math.abs(Math.sin(t * 6)) * 4 : 0;
  const lean = o.pose === 'sow' || o.pose === 'harvest' ? Math.sin(t * 4.4) * .011
    : combat ? -.022 + impulse * .055 : o.pose === 'hurt' ? -.045 : 0;
  const breath = walking || climbing || combat || gathering ? 0 : Math.sin(t * 2.2) * .0025;
  const press = gathering ? 0 : working ? Math.sin(phase * TAU) * .006 : combat ? -impulse * .012 : 0;
  c.save(); c.translate(o.x, o.y); c.scale(o.scale * o.facing, o.scale);
  // Climbing feet grip ladder rungs; a ground shadow here looked detached.
  if (!climbing) drawContactShadow(c, combat || o.pose === 'chop' ? 1.08 : o.pose === 'gather' ? .9 : 1);
  // Breathing scales around the soles instead of lifting a flat cutout off the ground.
  c.translate(0, bob); c.rotate(lean); c.scale(1 - breath * .35, 1 + breath + press);
  if (o.pose === 'hurt') c.globalAlpha *= .72 + Math.abs(Math.sin(t * 16)) * .28;
  c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
  const articulated = gathering && drawGatheringBody(c, o.gender, frame, gathering);
  if (!articulated) drawIllustration(c, frame);
  const layers=drawSurvivorOutfit(c,o.gender,frame,outfit);
  const contact = articulated && gathering
    ? drawGatheringLimbs(c, o.gender, frame, gathering, o.progress === undefined ? (t / 2.3) % 1 : clamp(o.progress), o.reducedMotion)
    : undefined;

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
  if (combat && impulse > .3) {
    c.save(); c.globalAlpha *= impulse * .5;
    c.strokeStyle = o.pose === 'skill' ? '#c7dcb3' : '#e9d5a5';
    c.lineWidth = o.pose === 'skill' ? 3 : 1.8;
    c.beginPath(); c.ellipse(18, -60, 39, 31, -.4, -1.1, 1.2); c.stroke(); c.restore();
  }
  c.restore();
  return {outfit,gender:o.gender,frame:frameId,imageReady:true,layers,
    ...(contact ? {toolContact:{x:o.x + contact.x * o.scale * o.facing, y:o.y + contact.y * o.scale}} : {})};
}
