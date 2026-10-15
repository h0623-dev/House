import atlasUrl from './assets/companions-safari-anime.png';
import type { CompanionOptions } from './companion-art';
import type { CompanionGaitSample, CompanionPaw } from './companion-locomotion';
import { UNITS, type UnitId } from './units';

export const SAFARI_UNIT_IDS = ['monkey', 'elephant', 'giraffe', 'panda', 'deer'] as const;
export type SafariUnitId = typeof SAFARI_UNIT_IDS[number];
export function isSafariUnitId(id: UnitId): id is SafariUnitId {
  return (SAFARI_UNIT_IDS as readonly UnitId[]).includes(id);
}

type Point = readonly [number, number];
interface Frame {
  x: number; y: number; width: number; height: number; footX: number; footY: number;
  /** Tight row gutters can share a y-range; keep the neighboring antlers out. */
  clip?: readonly Point[];
}
interface Limb { hip: Point; knee: Point; foot: Point; contour: readonly Point[] }
interface SafariArt {
  unit: number; shadow: number;
  frames: Record<'idle' | 'walk' | 'attack' | 'down', Frame>;
  portrait: readonly [number, number, number, number];
  description: string; wash: string;
  body: readonly Point[]; head: readonly Point[]; neck: Point;
  tail: readonly Point[]; tailRoot: Point;
  trunk?: { contour: readonly Point[]; root: Point };
  limbs: Record<CompanionPaw, Limb>;
}

// Alpha bounds and foot anchors belong to each silhouette, rather than a grid:
// the tall giraffe and the elephant's extended trunk must never lose a pixel.
const artById: Record<SafariUnitId, SafariArt> = {
  monkey: {
    unit: 56 / 196, shadow: 24, portrait: [126, 47, 146, 146],
    description: '초록 스카프와 작은 가방을 두른 원숭이 몽이', wash: '#dce1bf',
    frames: {
      idle: { x: 50, y: 47, width: 219, height: 204, footX: 172, footY: 244 },
      walk: { x: 364, y: 47, width: 232, height: 202, footX: 480, footY: 242 },
      attack: { x: 681, y: 47, width: 271, height: 202, footX: 796, footY: 242 },
      down: { x: 1014, y: 75, width: 184, height: 179, footX: 1105, footY: 246 },
    },
    body: [[100,142],[140,135],[183,145],[201,165],[205,201],[187,219],[148,220],[113,214],[91,188]],
    head: [[135,47],[267,47],[267,152],[242,169],[210,174],[178,157],[141,150],[130,111]], neck: [185,151],
    tail: [[50,49],[127,49],[140,84],[129,120],[112,132],[119,153],[147,175],[128,198],[94,178],[84,142],[77,127],[57,113],[50,85]], tailRoot: [116,182],
    limbs: {
      hindFar: { hip: [135,195], knee: [139,216], foot: [151,240], contour: [[119,179],[151,180],[158,206],[151,222],[164,231],[169,246],[142,249],[127,235],[120,215]] },
      hindNear: { hip: [109,191], knee: [99,216], foot: [109,240], contour: [[94,175],[125,181],[127,207],[113,222],[117,233],[128,238],[122,249],[94,248],[86,235],[90,210]] },
      frontFar: { hip: [204,179], knee: [205,208], foot: [204,235], contour: [[194,166],[216,174],[215,203],[210,222],[222,231],[220,244],[198,245],[188,234],[192,210]] },
      frontNear: { hip: [183,177], knee: [189,211], foot: [226,241], contour: [[170,164],[196,167],[198,197],[200,216],[222,229],[238,232],[242,246],[219,249],[198,239],[183,223],[172,199]] },
    },
  },
  elephant: {
    unit: 110 / 204, shadow: 59, portrait: [140, 265, 180, 180],
    description: '청록 스카프를 두른 아기 코끼리 코코', wash: '#d2dfd5',
    frames: {
      idle: { x: 34, y: 265, width: 291, height: 212, footX: 183, footY: 468 },
      walk: { x: 341, y: 269, width: 326, height: 207, footX: 483, footY: 467 },
      attack: { x: 666, y: 256, width: 299, height: 221, footX: 802, footY: 468 },
      down: { x: 973, y: 320, width: 260, height: 159, footX: 1100, footY: 470 },
    },
    body: [[78,299],[122,287],[164,294],[190,322],[226,354],[248,383],[248,424],[219,439],[164,435],[125,433],[90,431],[65,405],[63,355]],
    head: [[141,265],[278,265],[304,291],[309,326],[299,354],[284,365],[275,385],[257,398],[228,393],[203,371],[183,383],[148,370],[126,340]], neck: [196,350],
    tail: [[34,335],[65,324],[79,341],[64,372],[57,400],[57,428],[43,430],[36,416],[40,385]], tailRoot: [66,347],
    trunk: { contour: [[276,339],[298,341],[298,375],[300,402],[311,420],[324,411],[325,435],[313,446],[296,445],[285,433],[278,409],[272,381]], root: [284,352] },
    limbs: {
      hindFar: { hip: [137,405], knee: [139,435], foot: [141,465], contour: [[119,385],[151,389],[158,418],[154,442],[161,458],[158,474],[125,474],[119,461],[124,435]] },
      hindNear: { hip: [87,404], knee: [79,438], foot: [82,465], contour: [[67,382],[107,386],[108,418],[96,442],[101,460],[96,475],[64,475],[57,460],[61,429]] },
      frontFar: { hip: [234,400], knee: [233,435], foot: [237,465], contour: [[216,381],[249,383],[255,414],[250,443],[257,460],[252,474],[219,474],[214,462],[219,436]] },
      frontNear: { hip: [185,403], knee: [186,439], foot: [190,467], contour: [[166,382],[205,384],[212,420],[206,443],[211,461],[205,476],[173,476],[167,463],[170,435]] },
    },
  },
  giraffe: {
    unit: 145 / 283, shadow: 38, portrait: [143, 478, 115, 115],
    description: '초록 스카프와 갈색 반점이 있는 기린 길리', wash: '#e9deaf',
    frames: {
      idle: { x: 49, y: 479, width: 206, height: 291, footX: 152, footY: 760 },
      walk: { x: 349, y: 477, width: 232, height: 292, footX: 467, footY: 760 },
      attack: { x: 674, y: 475, width: 242, height: 294, footX: 788, footY: 760 },
      down: { x: 991, y: 520, width: 217, height: 238, footX: 1101, footY: 750 },
    },
    body: [[102,625],[135,612],[172,617],[192,641],[206,673],[201,699],[173,708],[139,702],[111,703],[91,683],[87,655]],
    head: [[143,479],[252,479],[256,558],[228,571],[215,596],[211,646],[188,663],[164,648],[163,600],[158,564],[143,548]], neck: [184,647],
    tail: [[49,639],[84,631],[116,643],[118,661],[96,666],[84,679],[61,691],[50,681]], tailRoot: [107,650],
    limbs: {
      hindFar: { hip: [134,682], knee: [137,716], foot: [145,756], contour: [[123,672],[146,676],[150,704],[148,729],[156,749],[158,767],[139,768],[130,756],[129,728],[124,708]] },
      hindNear: { hip: [106,679], knee: [92,721], foot: [86,756], contour: [[92,663],[116,668],[118,700],[103,728],[97,750],[99,765],[77,769],[72,755],[79,724],[87,694]] },
      frontFar: { hip: [197,680], knee: [203,721], foot: [214,755], contour: [[186,663],[209,668],[214,703],[215,732],[225,752],[226,766],[205,767],[197,753],[196,725],[188,698]] },
      frontNear: { hip: [171,682], knee: [175,722], foot: [185,757], contour: [[159,664],[185,669],[187,704],[185,730],[196,753],[196,768],[175,770],[165,755],[166,728],[161,701]] },
    },
  },
  panda: {
    unit: 85 / 192, shadow: 36, portrait: [132, 776, 145, 145],
    description: '노란 스카프를 두른 둥근 판다 판이', wash: '#e9d8b5',
    frames: {
      idle: { x: 37, y: 776, width: 235, height: 200, footX: 156, footY: 968 },
      walk: { x: 354, y: 771, width: 240, height: 203, footX: 473, footY: 970 },
      attack: { x: 663, y: 769, width: 298, height: 207, footX: 788, footY: 970,
        clip: [[663,769],[961,769],[961,966],[845,966],[845,976],[663,976]] },
      down: { x: 992, y: 825, width: 232, height: 148, footX: 1107, footY: 965 },
    },
    body: [[69,817],[106,806],[151,815],[184,843],[208,884],[214,918],[193,945],[152,949],[111,940],[79,945],[50,918],[41,878]],
    head: [[133,775],[268,775],[274,870],[252,897],[215,908],[183,894],[154,874],[137,848],[124,819]], neck: [183,878],
    tail: [[42,868],[67,861],[78,884],[75,908],[51,920],[37,902]], tailRoot: [67,890],
    limbs: {
      hindFar: { hip: [120,912], knee: [123,941], foot: [132,963], contour: [[104,890],[134,898],[143,926],[138,944],[149,955],[148,974],[119,976],[109,964],[108,942]] },
      hindNear: { hip: [77,909], knee: [67,940], foot: [73,962], contour: [[57,888],[93,892],[98,918],[84,942],[87,958],[87,973],[56,976],[47,962],[49,940]] },
      frontFar: { hip: [217,913], knee: [216,939], foot: [227,962], contour: [[201,892],[233,896],[239,921],[230,942],[242,955],[241,975],[211,976],[202,961],[202,937]] },
      frontNear: { hip: [177,913], knee: [176,941], foot: [185,966], contour: [[158,890],[193,897],[202,922],[191,945],[204,960],[201,976],[167,978],[157,962],[160,938]] },
    },
  },
  deer: {
    unit: 95 / 240, shadow: 32, portrait: [141, 976, 132, 132],
    description: '작은 뿔과 초록 스카프를 두른 사슴 루아', wash: '#dbdfba',
    frames: {
      idle: { x: 62, y: 978, width: 205, height: 247, footX: 157, footY: 1216 },
      walk: { x: 373, y: 972, width: 237, height: 247, footX: 478, footY: 1211 },
      attack: { x: 673, y: 966, width: 256, height: 257, footX: 785, footY: 1215,
        clip: [[845,966],[929,966],[929,1223],[673,1223],[673,974],[845,974]] },
      down: { x: 1005, y: 1024, width: 212, height: 196, footX: 1108, footY: 1212 },
    },
    body: [[101,1084],[139,1076],[177,1084],[207,1109],[219,1139],[204,1156],[174,1162],[140,1156],[104,1157],[86,1134],[87,1105]],
    head: [[142,977],[270,977],[269,1070],[252,1097],[221,1102],[216,1132],[192,1137],[177,1111],[177,1080],[159,1063]], neck: [194,1116],
    tail: [[63,1040],[98,1044],[114,1068],[113,1091],[104,1127],[88,1138],[72,1116],[62,1078]], tailRoot: [104,1114],
    limbs: {
      hindFar: { hip: [134,1141], knee: [137,1177], foot: [145,1210], contour: [[123,1126],[145,1132],[153,1157],[148,1181],[157,1202],[157,1219],[137,1221],[130,1206],[130,1178]] },
      hindNear: { hip: [104,1137], knee: [89,1177], foot: [87,1212], contour: [[91,1121],[116,1129],[120,1155],[102,1183],[99,1202],[101,1220],[80,1224],[73,1210],[78,1179]] },
      frontFar: { hip: [209,1136], knee: [212,1177], foot: [222,1210], contour: [[197,1121],[222,1126],[225,1156],[223,1183],[231,1203],[232,1219],[210,1220],[204,1207],[202,1177]] },
      frontNear: { hip: [175,1141], knee: [177,1177], foot: [187,1214], contour: [[162,1123],[187,1128],[191,1158],[186,1184],[198,1205],[198,1223],[176,1225],[167,1210],[168,1181]] },
    },
  },
};

export const safariCompanionImage = new Image();
safariCompanionImage.decoding = 'async';
safariCompanionImage.src = atlasUrl;
export function safariCompanionArtReady(): boolean {
  return safariCompanionImage.complete && safariCompanionImage.naturalWidth > 0;
}

const TAU = Math.PI * 2;
const projectionOf = (o: CompanionOptions): number => {
  const value = o.gait?.facingBlend;
  return value === undefined || !Number.isFinite(value) ? o.facing : Math.max(-1, Math.min(1, value));
};
const localPoint = (art: SafariArt, point: Point, projection = 1): Point =>
  [(point[0] - art.frames.idle.footX) * art.unit * projection,
    (point[1] - art.frames.idle.footY) * art.unit];

function part(c: CanvasRenderingContext2D, art: SafariArt, contour: readonly Point[], projection = 1,
  cut?: { y: number; upper: boolean; pawTop: number; pawOnly?: boolean }): void {
  if (!contour.length) return;
  const frame = art.frames.idle;
  c.save(); c.scale(projection, 1); c.beginPath();
  contour.forEach((point, index) => {
    const [x, y] = localPoint(art, point);
    if (index) c.lineTo(x, y); else c.moveTo(x, y);
  });
  c.closePath(); c.clip();
  if (cut) {
    const boundary = (cut.y - frame.footY) * art.unit;
    const pawTop = (cut.pawTop - frame.footY) * art.unit;
    c.beginPath();
    if (cut.pawOnly) c.rect(-250, pawTop - .6, 500, 250);
    else if (cut.upper) c.rect(-250, -250, 500, boundary + 251);
    else c.rect(-250, boundary - 1, 500, pawTop - boundary + 1.7);
    c.clip();
  }
  c.drawImage(safariCompanionImage, frame.x, frame.y, frame.width, frame.height,
    (frame.x - frame.footX) * art.unit, (frame.y - frame.footY) * art.unit,
    frame.width * art.unit, frame.height * art.unit);
  c.restore();
}

function pivot(c: CanvasRenderingContext2D, art: SafariArt, point: Point,
  angle: number, projection: number, draw: () => void): void {
  const [x, y] = localPoint(art, point, projection);
  c.save(); c.translate(x, y); c.rotate(angle); c.translate(-x, -y); draw(); c.restore();
}

function solidPart(c: CanvasRenderingContext2D, art: SafariArt,
  contour: readonly Point[], projection: number, minimum: number): void {
  const center = (Math.min(...contour.map(point => point[0])) + Math.max(...contour.map(point => point[0]))) / 2;
  const x = (center - art.frames.idle.footX) * art.unit;
  const width = (projection < 0 ? -1 : 1) * Math.max(minimum, Math.abs(projection));
  c.save(); c.translate(x * projection, 0); c.scale(width, 1); c.translate(-x, 0);
  part(c, art, contour); c.restore();
}

function leg(c: CanvasRenderingContext2D, art: SafariArt, name: CompanionPaw,
  gait: CompanionGaitSample, projection: number): void {
  const limb = art.limbs[name], paw = gait.paws[name];
  const width = (projection < 0 ? -1 : 1) * Math.max(.58, Math.abs(projection));
  const originalHip = localPoint(art, limb.hip, width);
  const originalKnee = localPoint(art, limb.knee, width);
  const originalFoot = localPoint(art, limb.foot, width);
  const hipX = (limb.hip[0] - art.frames.idle.footX) * art.unit * projection;
  const cos = Math.cos(gait.bodyRoll), sin = Math.sin(gait.bodyRoll);
  const hip: Point = [hipX * cos - originalHip[1] * sin, hipX * sin + originalHip[1] * cos + gait.bodyY];
  const foot: Point = [(limb.foot[0] - art.frames.idle.footX) * art.unit * projection + Math.cos(gait.heading) * paw.along,
    originalFoot[1] + Math.sin(gait.heading) * paw.along - paw.lift];
  const upper = Math.hypot(originalKnee[0] - originalHip[0], originalKnee[1] - originalHip[1]);
  const lower = Math.hypot(originalFoot[0] - originalKnee[0], originalFoot[1] - originalKnee[1]);
  const reach = Math.max(.001, Math.hypot(foot[0] - hip[0], foot[1] - hip[1]));
  const stretch = Math.max(1, reach / (upper + lower) * 1.001);
  const a = upper * stretch, b = lower * stretch;
  const direction = Math.atan2(foot[1] - hip[1], foot[0] - hip[0]);
  const bend = (originalFoot[0] - originalHip[0]) * (originalKnee[1] - originalHip[1])
    - (originalFoot[1] - originalHip[1]) * (originalKnee[0] - originalHip[0]) >= 0 ? 1 : -1;
  const angle = direction + bend * Math.acos(Math.max(-1, Math.min(1, (reach * reach + a * a - b * b) / (2 * reach * a))));
  const knee: Point = [hip[0] + Math.cos(angle) * a, hip[1] + Math.sin(angle) * a];
  const originalUpper = Math.atan2(originalKnee[1] - originalHip[1], originalKnee[0] - originalHip[0]);
  const originalLower = Math.atan2(originalFoot[1] - originalKnee[1], originalFoot[0] - originalKnee[0]);
  const pawTop = limb.foot[1] - 2.7 / art.unit;
  c.save(); c.translate(hip[0], hip[1]); c.rotate(angle - originalUpper); c.scale(stretch, stretch);
  c.translate(-originalHip[0], -originalHip[1]);
  part(c, art, limb.contour, width, { y: limb.knee[1], upper: true, pawTop }); c.restore();
  const lowerAngle = Math.atan2(foot[1] - knee[1], foot[0] - knee[0]) - originalLower;
  c.save(); c.translate(knee[0], knee[1]); c.rotate(lowerAngle); c.scale(stretch, stretch);
  c.translate(-originalKnee[0], -originalKnee[1]);
  part(c, art, limb.contour, width, { y: limb.knee[1], upper: false, pawTop }); c.restore();
  // A tiny overlap at the knee seals the cut while the planted foot stays flat.
  c.save(); c.translate(knee[0], knee[1]); c.rotate((angle - originalUpper + lowerAngle) / 2);
  c.beginPath(); c.arc(0, 0, 1.8, 0, TAU); c.clip(); c.translate(-originalKnee[0], -originalKnee[1]);
  part(c, art, limb.contour, width); c.restore();
  c.save(); c.translate(foot[0], foot[1]); c.rotate(paw.planted ? 0 : -paw.lift * .02);
  c.translate(-originalFoot[0], -originalFoot[1]);
  part(c, art, limb.contour, width, { y: limb.knee[1], upper: false, pawTop, pawOnly: true }); c.restore();
}

function shadow(c: CanvasRenderingContext2D, radius: number): void {
  const gradient = c.createRadialGradient(0, 0, 0, 0, 0, radius);
  gradient.addColorStop(0, 'rgba(49,47,32,.16)'); gradient.addColorStop(.65, 'rgba(49,47,32,.06)');
  gradient.addColorStop(1, 'rgba(49,47,32,0)');
  c.save(); c.scale(1, .22); c.fillStyle = gradient; c.beginPath(); c.arc(0, 3, radius, 0, TAU); c.fill(); c.restore();
}

/** Local foot coordinates: the caller owns world translation, scale and pose-facing. */
export function drawSafariCompanion(c: CanvasRenderingContext2D, o: CompanionOptions,
  gait?: CompanionGaitSample): void {
  if (!isSafariUnitId(o.id) || !safariCompanionArtReady()) return;
  const art = artById[o.id], pose = o.pose ?? 'idle';
  shadow(c, art.shadow);
  c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
  if (gait && (pose === 'idle' || pose === 'walk' || pose === 'run')) {
    const projection = projectionOf(o), still = o.gait?.reducedMotion ? 0 : 1 - gait.strength;
    for (const name of ['hindFar', 'frontFar', 'hindNear', 'frontNear'] as const) leg(c, art, name, gait, projection);
    c.save(); c.translate(0, gait.bodyY); c.rotate(gait.bodyRoll);
    pivot(c, art, art.tailRoot, gait.tailTilt + Math.sin(o.time * 1.2) * .025 * still, projection,
      () => part(c, art, art.tail, projection));
    solidPart(c, art, art.body, projection, .56);
    pivot(c, art, art.neck, gait.headTilt * (o.id === 'giraffe' ? .6 : 1), projection,
      () => solidPart(c, art, art.head, projection, .8));
    if (art.trunk) pivot(c, art, art.trunk.root,
      gait.tailTilt * .55 + Math.sin(o.time * 1.35) * .018 * still, projection,
      () => part(c, art, art.trunk!.contour, projection));
    c.restore();
    return;
  }
  const striking = pose === 'attack' || pose === 'skill';
  const phase = o.progress === undefined ? (o.time * 1.1) % 1 : Math.max(0, Math.min(1, o.progress));
  const impulse = striking ? Math.sin(phase * Math.PI) : 0;
  const frame = pose === 'down' ? art.frames.down : striking || pose === 'celebrate' ? art.frames.attack
    : pose === 'walk' || pose === 'run' ? art.frames.walk : art.frames.idle;
  c.save();
  // Heavy animals keep their weight on the road; no whole-sprite hopping.
  const lively = o.id === 'monkey' ? 1 : .35;
  c.translate(striking ? impulse * lively : 0, pose === 'down' ? 0 : -impulse * lively);
  if (frame.clip) {
    c.beginPath();
    frame.clip.forEach(([x, y], index) => {
      const px = (x - frame.footX) * art.unit, py = (y - frame.footY) * art.unit;
      if (index) c.lineTo(px, py); else c.moveTo(px, py);
    });
    c.closePath(); c.clip();
  }
  c.drawImage(safariCompanionImage, frame.x, frame.y, frame.width, frame.height,
    (frame.x - frame.footX) * art.unit, (frame.y - frame.footY) * art.unit,
    frame.width * art.unit, frame.height * art.unit);
  c.restore();
}

export function safariPawContacts(o: CompanionOptions, gait: CompanionGaitSample): Record<CompanionPaw,
  { x: number; y: number; phase: number; planted: boolean; lift: number }> | undefined {
  if (!isSafariUnitId(o.id)) return;
  const art = artById[o.id], projection = projectionOf(o);
  return Object.fromEntries((['frontNear', 'frontFar', 'hindNear', 'hindFar'] as const).map(name => {
    const foot = localPoint(art, art.limbs[name].foot, projection), paw = gait.paws[name];
    return [name, { x: o.x + (foot[0] + Math.cos(gait.heading) * paw.along) * o.scale,
      y: o.y + (foot[1] + Math.sin(gait.heading) * paw.along - paw.lift) * o.scale,
      phase: paw.phase, planted: paw.planted, lift: paw.lift * o.scale }];
  })) as Record<CompanionPaw, { x: number; y: number; phase: number; planted: boolean; lift: number }>;
}

let portraitSequence = 0;
export function safariCompanionPortrait(id: SafariUnitId): string {
  const art = artById[id], clipId = `${id}-portrait-${++portraitSequence}`;
  return `<svg class="pet-portrait companion-portrait" viewBox="0 0 100 100" role="img" aria-label="${art.description}"><title>${UNITS[id].name}</title><defs><clipPath id="${clipId}-crop"><circle cx="50" cy="50" r="47"/></clipPath><radialGradient id="${clipId}-wash"><stop stop-color="#faf4d9"/><stop offset="1" stop-color="${art.wash}"/></radialGradient></defs><circle cx="50" cy="50" r="49" fill="url(#${clipId}-wash)" stroke="#b8ae79" stroke-width="1.3"/><g clip-path="url(#${clipId}-crop)"><svg x="4" y="4" width="92" height="92" viewBox="${art.portrait.join(' ')}"><image href="${atlasUrl}" width="1254" height="1254"/></svg></g></svg>`;
}
