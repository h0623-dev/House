import { heroImages, type SurvivorFrame, type SurvivorGender } from './character-art';
import { sampleGatheringMotion, type GatheringMotionKind } from './gathering-motion';
import { drawGatheringTool } from './gathering-tools';

type Point = readonly [number, number];
type Polygon = readonly Point[];
interface PaintedPart { canvas: HTMLCanvasElement; x: number; y: number; pivot: Point; end: Point }
interface ArmSource { upper: Polygon; fore: Polygon; shoulder: Point; elbow: Point; hand: Point }
interface RigCache { body: HTMLCanvasElement; upper: PaintedPart; fore: PaintedPart }

// Measured contours isolate the original sleeves, bare arms and gloves. The
// original face, hair, clothes, backpack, legs and boots remain the same art.
const armSources: Record<SurvivorGender, ArmSource> = {
  female: {
    upper: [[1273, 230], [1303, 225], [1331, 244], [1348, 262], [1326, 282], [1299, 276], [1277, 261]],
    fore: [[1324, 254], [1358, 247], [1392, 230], [1420, 211], [1443, 223], [1441, 245], [1408, 266], [1365, 282], [1330, 284]],
    shoulder: [1288, 246], elbow: [1332, 266], hand: [1425, 234],
  },
  male: {
    upper: [[1269, 728], [1303, 726], [1331, 745], [1350, 763], [1326, 787], [1298, 779], [1274, 763]],
    fore: [[1324, 755], [1358, 750], [1393, 733], [1422, 712], [1449, 725], [1445, 750], [1410, 770], [1366, 786], [1330, 787]],
    shoulder: [1288, 746], elbow: [1332, 768], hand: [1428, 737],
  },
};
const bodyMasks: Record<SurvivorGender, { standing: Polygon[]; crouching: Polygon[]; torso: Polygon; knee: Polygon }> = {
  female: {
    standing: [
      [[1270, 226], [1306, 222], [1339, 242], [1380, 233], [1400, 207], [1449, 193], [1470, 225], [1464, 258], [1407, 283], [1340, 292], [1286, 283], [1269, 263]],
      [[1400, 278], [1430, 281], [1468, 155], [1490, 169], [1535, 151], [1535, 75], [1477, 52], [1448, 58], [1425, 142]],
    ],
    crouching: [
      [[267, 428], [311, 418], [339, 442], [345, 473], [369, 520], [398, 540], [410, 598], [389, 624], [351, 615], [332, 579], [328, 551], [303, 509], [275, 478], [257, 451]],
      [[386, 561], [494, 567], [507, 604], [478, 631], [386, 625]],
    ],
    torso: [[1282, 230], [1340, 236], [1384, 264], [1364, 324], [1294, 326], [1264, 275]],
    knee: [[260, 434], [303, 427], [349, 453], [358, 529], [333, 574], [276, 579], [248, 527]],
  },
  male: {
    standing: [
      [[1266, 724], [1308, 722], [1339, 742], [1383, 735], [1403, 709], [1452, 695], [1472, 729], [1467, 759], [1410, 785], [1340, 794], [1284, 784], [1266, 762]],
      [[1405, 779], [1434, 783], [1470, 657], [1491, 671], [1535, 654], [1535, 558], [1477, 546], [1448, 551], [1439, 604], [1434, 674]],
    ],
    crouching: [
      [[246, 962], [300, 948], [336, 977], [345, 1020], [374, 1090], [402, 1125], [411, 1193], [379, 1214], [342, 1191], [325, 1120], [291, 1064], [264, 1031], [245, 997]],
      [[386, 1145], [503, 1151], [512, 1199], [482, 1223], [385, 1216]],
    ],
    torso: [[1280, 731], [1343, 734], [1386, 768], [1366, 827], [1291, 829], [1260, 777]],
    knee: [[249, 977], [306, 963], [355, 1006], [362, 1090], [334, 1154], [270, 1156], [238, 1096]],
  },
};

function path(c: CanvasRenderingContext2D, polygon: Polygon): void {
  c.beginPath(); polygon.forEach(([x, y], index) => index ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath();
}

function cutPart(image: HTMLImageElement, polygon: Polygon, pivot: Point, end: Point): PaintedPart | undefined {
  const x = Math.floor(Math.min(...polygon.map(p => p[0]))), y = Math.floor(Math.min(...polygon.map(p => p[1])));
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(Math.max(...polygon.map(p => p[0]))) - x + 2;
  canvas.height = Math.ceil(Math.max(...polygon.map(p => p[1]))) - y + 2;
  const c = canvas.getContext('2d'); if (!c) return undefined;
  c.translate(-x, -y); path(c, polygon); c.clip(); c.drawImage(image, 0, 0);
  return { canvas, x, y, pivot, end };
}

const caches = new Map<string, RigCache>();
function preparedRig(gender: SurvivorGender, frame: SurvivorFrame, crouching: boolean): RigCache | undefined {
  const key = `${gender}:${crouching ? 'crouch' : 'stand'}`;
  const cached = caches.get(key); if (cached) return cached;
  const image = heroImages[frame.sheet], actions = heroImages.actions;
  if (!image.complete || !image.naturalWidth || !actions.complete || !actions.naturalWidth) return undefined;
  const source = armSources[gender];
  const upper = cutPart(actions, source.upper, source.shoulder, source.elbow);
  const fore = cutPart(actions, source.fore, source.elbow, source.hand);
  const body = document.createElement('canvas'); body.width = frame.width; body.height = frame.height;
  const c = body.getContext('2d'); if (!c || !upper || !fore) return undefined;
  c.drawImage(image, frame.x, frame.y, frame.width, frame.height, 0, 0, frame.width, frame.height);
  c.translate(-frame.x, -frame.y);
  const masks = bodyMasks[gender][crouching ? 'crouching' : 'standing'];
  c.globalCompositeOperation = 'destination-out';
  for (const mask of masks) { path(c, mask); c.fill(); }
  c.globalCompositeOperation = 'source-over';
  // Only reconstruct cloth that used to be hidden behind the moving arms.
  // Clip the repair to both the cut area and the measured torso/knee contour.
  c.save(); c.beginPath();
  for (const mask of masks) { mask.forEach(([x, y], index) => index ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); }
  c.clip();
  const patch = crouching ? bodyMasks[gender].knee : bodyMasks[gender].torso;
  const top = Math.min(...patch.map(p => p[1])), bottom = Math.max(...patch.map(p => p[1]));
  const cloth = c.createLinearGradient(patch[0][0], top, patch[0][0] + 78, bottom);
  cloth.addColorStop(0, crouching ? '#6f7460' : '#8b956c');
  cloth.addColorStop(.48, crouching ? '#858873' : '#737f5a');
  cloth.addColorStop(1, crouching ? '#596052' : '#535f44');
  path(c, patch); c.fillStyle = cloth; c.fill();
  c.strokeStyle = crouching ? '#5e6655' : '#a1aa80'; c.lineWidth = 3; c.lineCap = 'round';
  c.beginPath(); c.moveTo(patch[0][0] + 35, top + 11); c.quadraticCurveTo(patch[0][0] + 62, top + 30, patch[0][0] + 55, bottom - 9); c.stroke();
  c.restore();
  const prepared = { body, upper, fore }; caches.set(key, prepared); return prepared;
}

export function isGatheringRigPose(pose: string): pose is GatheringMotionKind {
  return pose === 'chop' || pose === 'mine' || pose === 'pluck' || pose === 'scoop';
}

/** Boots and torso are independent of the arm animation: no rotating cutout. */
export function drawGatheringBody(c: CanvasRenderingContext2D, gender: SurvivorGender, frame: SurvivorFrame, kind: GatheringMotionKind): boolean {
  const rig = preparedRig(gender, frame, kind === 'pluck' || kind === 'scoop'); if (!rig) return false;
  const unit = 128 / (frame.referenceHeight ?? frame.footY - frame.y);
  c.drawImage(rig.body, (frame.x - frame.footX) * unit, (frame.y - frame.footY) * unit, frame.width * unit, frame.height * unit);
  return true;
}

function joint(shoulder: Point, hand: Point, upperLength: number, foreLength: number): Point {
  const dx = hand[0] - shoulder[0], dy = hand[1] - shoulder[1];
  const distance = Math.max(.001, Math.min(upperLength + foreLength - .01, Math.hypot(dx, dy)));
  const direction = Math.atan2(dy, dx), along = (upperLength * upperLength - foreLength * foreLength + distance * distance) / (2 * distance);
  const bend = Math.sqrt(Math.max(0, upperLength * upperLength - along * along));
  return [shoulder[0] + Math.cos(direction) * along - Math.sin(direction) * bend,
    shoulder[1] + Math.sin(direction) * along + Math.cos(direction) * bend];
}

function segment(c: CanvasRenderingContext2D, part: PaintedPart, start: Point, end: Point, width = 1): void {
  const sx = part.end[0] - part.pivot[0], sy = part.end[1] - part.pivot[1];
  const tx = end[0] - start[0], ty = end[1] - start[1];
  const scale = Math.hypot(tx, ty) / Math.max(.001, Math.hypot(sx, sy));
  c.save(); c.translate(start[0], start[1]); c.rotate(Math.atan2(ty, tx) - Math.atan2(sy, sx)); c.scale(scale, scale * width);
  c.drawImage(part.canvas, part.x - part.pivot[0], part.y - part.pivot[1]); c.restore();
}

/** Paint the two articulated arms around a shared, rotating grip/tool. */
export function drawGatheringLimbs(c: CanvasRenderingContext2D, gender: SurvivorGender, frame: SurvivorFrame,
  kind: GatheringMotionKind, progress: number, reducedMotion = false): { x: number; y: number } | undefined {
  const crouching = kind === 'pluck' || kind === 'scoop', rig = preparedRig(gender, frame, crouching); if (!rig) return undefined;
  const motion = sampleGatheringMotion(kind, progress), hand: Point = [motion.hand.x, motion.hand.y];
  const shoulder: Point = crouching ? [-5, -31] : [-11, -68];
  const elbow = joint(shoulder, hand, crouching ? 17 : 20, crouching ? 24 : 27);
  if (!crouching) {
    const angle = motion.toolAngle, backHand: Point = [hand[0] + Math.cos(angle) * 3 + Math.sin(angle) * 8, hand[1] + Math.sin(angle) * 3 - Math.cos(angle) * 8];
    const backShoulder: Point = [0, -73], backElbow = joint(backShoulder, backHand, 18, 26);
    c.save(); c.globalAlpha *= .92;
    segment(c, rig.upper, backShoulder, backElbow, .9); segment(c, rig.fore, backElbow, backHand, .92); c.restore();
  }
  segment(c, rig.upper, shoulder, elbow, crouching ? .94 : 1);
  c.save(); c.translate(hand[0], hand[1]);
  // Every tool follows the wrist. Large flourish lines are optional, the
  // actual hand/tool stroke remains readable with reduced motion enabled.
  if (!reducedMotion && !crouching && motion.phase > .34 && motion.phase < .48) {
    c.save(); c.globalAlpha *= .18; c.strokeStyle = '#f3dfb0'; c.lineWidth = 1.5; c.lineCap = 'round';
    c.beginPath(); c.arc(-4, -17, 34, -1.9, -.25); c.stroke(); c.restore();
  }
  const contact = drawGatheringTool(c, kind, motion.toolAngle); c.restore();
  segment(c, rig.fore, elbow, hand, crouching ? .94 : 1);
  return { x: hand[0] + contact.x, y: hand[1] + contact.y };
}
