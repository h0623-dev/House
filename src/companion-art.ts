import catAtlasUrl from './assets/companions-cat-anime.png';
import reserveAtlasUrl from './assets/companions-reserve-anime.png';
import { creatureImage, drawPet, petPortrait, type PetPose } from './creatures';
import { UNITS, type ReserveUnitId, type UnitId } from './units';
import { sampleCompanionGait, type CompanionGaitInput, type CompanionGaitSample, type CompanionPaw } from './companion-locomotion';
export { sampleCompanionGait } from './companion-locomotion';
export type { CompanionGaitInput, CompanionGaitSample } from './companion-locomotion';

/** The same animal illustrations are used in the truck village and expeditions. */
export type CompanionPose = 'idle' | 'walk' | 'run' | 'attack' | 'skill' | 'hurt' | 'down' | 'celebrate';
export interface CompanionOptions {
  id: UnitId;
  /** x/y are the feet, in world coordinates. */
  x: number; y: number; scale: number; time: number;
  facing: 1 | -1; pose?: CompanionPose; progress?: number;
  /** Village movement supplies real distance; combat/rest retain their poses. */
  gait?: CompanionGaitInput;
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
type ArtPoint = readonly [number, number];
interface PuppetLimb {
  hip: ArtPoint; knee: ArtPoint; foot: ArtPoint;
  contour: readonly ArtPoint[];
}
interface QuadrupedArt {
  frame: CatFrame;
  unit: number;
  body: readonly ArtPoint[];
  head: readonly ArtPoint[];
  neck: ArtPoint;
  tail: readonly ArtPoint[];
  tailRoot: ArtPoint;
  limbs: Record<CompanionPaw, PuppetLimb>;
}

// Puppet contours reuse only pixels from each animal's original standing art.
// Legs overlap the torso at the hips and at each knee. Feet, rather than the
// whole illustration, travel through grounded stance and lifted swing phases.
const quadrupedArt: Record<'dog' | 'cat', QuadrupedArt> = {
  dog: {
    frame: { x: 42, y: 73, width: 309, height: 377, footX: 196, footY: 445 }, unit: 65 / 372,
    body: [[76,245],[107,224],[150,222],[181,229],[202,245],[231,259],[270,279],[299,292],[297,333],[285,348],[270,352],[254,354],[234,345],[219,350],[199,350],[172,349],[141,337],[104,330],[80,304]],
    head: [[184,73],[352,73],[352,282],[273,300],[218,271],[203,239],[186,224]], neck: [241,249],
    tail: [[42,102],[196,102],[198,232],[173,257],[116,251],[62,224],[42,180]], tailRoot: [125,248],
    limbs: {
      hindFar: { hip:[145,302],knee:[142,365],foot:[179,411],contour:[[135,284],[172,294],[162,333],[154,355],[174,383],[195,402],[192,420],[171,424],[148,399],[132,375],[125,335]] },
      hindNear: { hip:[109,301],knee:[79,369],foot:[80,425],contour:[[84,275],[136,291],[131,331],[107,355],[97,391],[101,409],[93,432],[58,434],[58,413],[67,382],[76,329]] },
      frontFar: { hip:[280,302],knee:[279,367],foot:[284,424],contour:[[261,270],[298,273],[297,346],[290,385],[301,415],[293,432],[265,432],[266,409],[270,382],[267,341]] },
      frontNear: { hip:[245,316],knee:[241,379],foot:[247,440],contour:[[231,286],[270,300],[267,356],[264,399],[276,426],[267,450],[224,450],[217,429],[226,391],[230,347]] },
    },
  },
  cat: {
    frame: catFrames.idle, unit: CAT_PIXEL_UNIT,
    body: [[99,344],[150,311],[253,286],[356,300],[436,344],[473,392],[480,446],[449,463],[416,458],[374,475],[317,478],[274,463],[220,451],[167,468],[110,464],[99,418]],
    head: [[343,86],[600,86],[600,384],[531,428],[471,439],[392,409],[332,357],[255,302],[251,236],[329,237],[343,229]], neck: [451,352],
    tail: [[63,98],[281,98],[285,252],[262,302],[198,338],[123,349],[81,317],[61,254]], tailRoot: [147,357],
    limbs: {
      hindFar: { hip:[240,452],knee:[229,516],foot:[284,571],contour:[[201,432],[264,434],[265,478],[243,509],[251,533],[285,550],[317,551],[324,584],[272,586],[237,565],[218,523],[220,486]] },
      hindNear: { hip:[138,449],knee:[112,524],foot:[121,595],contour:[[107,408],[166,419],[165,470],[143,510],[132,549],[160,577],[154,607],[87,607],[82,581],[91,537],[103,486]] },
      frontFar: { hip:[465,431],knee:[479,505],foot:[494,588],contour:[[438,400],[493,409],[498,462],[489,513],[489,551],[519,572],[527,602],[462,608],[450,583],[454,536],[441,476]] },
      frontNear: { hip:[380,448],knee:[377,525],foot:[397,605],contour:[[352,409],[406,425],[411,475],[401,517],[400,563],[434,589],[424,620],[357,620],[347,595],[357,550],[350,496]] },
    },
  },
};
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

function puppetPart(c: CanvasRenderingContext2D, image: HTMLImageElement,
  art: QuadrupedArt, contour: readonly ArtPoint[], cut?: { kneeY: number; upper: boolean; pawTop?: number; pawOnly?: boolean }, projection=1): void {
  const { frame, unit } = art;
  c.save();c.scale(projection,1);c.beginPath();
  contour.forEach(([x,y], index) => {
    const px=(x-frame.footX)*unit, py=(y-frame.footY)*unit;
    if (index===0) c.moveTo(px,py); else c.lineTo(px,py);
  });
  c.closePath(); c.clip();
  if (cut) {
    const boundary=(cut.kneeY-frame.footY)*unit;
    c.beginPath();
    // A short overlap covers the animated knee without cutting a visible seam.
    if(cut.pawOnly)c.rect(-120,(cut.pawTop!-frame.footY)*unit-.55,240,120);
    else if(cut.upper)c.rect(-120,-120,240,boundary+120+.8);
    else c.rect(-120,boundary-.8,240,(cut.pawTop!-frame.footY)*unit-boundary+1.35);
    c.clip();
  }
  c.drawImage(image,frame.x,frame.y,frame.width,frame.height,
    (frame.x-frame.footX)*unit,(frame.y-frame.footY)*unit,
    frame.width*unit,frame.height*unit);
  c.restore();
}

function puppetPivot(c: CanvasRenderingContext2D, art: QuadrupedArt,
  pivot: ArtPoint, angle: number, draw:()=>void, projection=1): void {
  const x=(pivot[0]-art.frame.footX)*art.unit*projection, y=(pivot[1]-art.frame.footY)*art.unit;
  c.save();c.translate(x,y);c.rotate(angle);c.translate(-x,-y);draw();c.restore();
}

function puppetLeg(c: CanvasRenderingContext2D, image: HTMLImageElement, art: QuadrupedArt,
  name: CompanionPaw, gait: CompanionGaitSample, projection: number): void {
  const leg=art.limbs[name], {frame,unit}=art;
  const limbProjection=(projection<0?-1:1)*Math.max(.56,Math.abs(projection));
  const point=([x,y]:ArtPoint):ArtPoint=>[(x-frame.footX)*unit*limbProjection,(y-frame.footY)*unit];
  const originalHip=point(leg.hip), originalKnee=point(leg.knee), originalFoot=point(leg.foot);
  const cos=Math.cos(gait.bodyRoll),sin=Math.sin(gait.bodyRoll);
  const hipX=(leg.hip[0]-frame.footX)*unit*projection;
  const hip:ArtPoint=[hipX*cos-originalHip[1]*sin,
    hipX*sin+originalHip[1]*cos+gait.bodyY];
  const paw=gait.paws[name];
  const foot:ArtPoint=[(leg.foot[0]-frame.footX)*unit*projection+Math.cos(gait.heading)*paw.along,
    originalFoot[1]+Math.sin(gait.heading)*paw.along-paw.lift];
  const upper=Math.hypot(originalKnee[0]-originalHip[0],originalKnee[1]-originalHip[1]);
  const lower=Math.hypot(originalFoot[0]-originalKnee[0],originalFoot[1]-originalKnee[1]);
  const reach=Math.max(.001,Math.hypot(foot[0]-hip[0],foot[1]-hip[1]));
  // The small extension accommodates a sloping isometric path, preserving the
  // planted paw rather than moving the whole cutout sideways under the body.
  const stretch=Math.max(1,reach/(upper+lower)*1.001);
  const a=upper*stretch,b=lower*stretch;
  const direction=Math.atan2(foot[1]-hip[1],foot[0]-hip[0]);
  const bend=(originalFoot[0]-originalHip[0])*(originalKnee[1]-originalHip[1])
    -(originalFoot[1]-originalHip[1])*(originalKnee[0]-originalHip[0])>=0?1:-1;
  const angle=direction+bend*Math.acos(Math.max(-1,Math.min(1,(reach*reach+a*a-b*b)/(2*reach*a))));
  const knee:ArtPoint=[hip[0]+Math.cos(angle)*a,hip[1]+Math.sin(angle)*a];
  const originalUpper=Math.atan2(originalKnee[1]-originalHip[1],originalKnee[0]-originalHip[0]);
  const originalLower=Math.atan2(originalFoot[1]-originalKnee[1],originalFoot[0]-originalKnee[0]);
  c.save();c.translate(hip[0],hip[1]);c.rotate(angle-originalUpper);c.scale(stretch,stretch);
  c.translate(-originalHip[0],-originalHip[1]);
  puppetPart(c,image,art,leg.contour,{kneeY:leg.knee[1],upper:true},limbProjection);c.restore();
  c.save();c.translate(knee[0],knee[1]);
  c.rotate(Math.atan2(foot[1]-knee[1],foot[0]-knee[0])-originalLower);c.scale(stretch,stretch);
  c.translate(-originalKnee[0],-originalKnee[1]);
  const pawTop=leg.foot[1]-2.6/unit;
  puppetPart(c,image,art,leg.contour,{kneeY:leg.knee[1],upper:false,pawTop},limbProjection);c.restore();
  c.save();c.translate(knee[0],knee[1]);
  c.rotate((angle-originalUpper+Math.atan2(foot[1]-knee[1],foot[0]-knee[0])-originalLower)/2);
  c.beginPath();c.arc(0,0,1.65,0,TAU);c.clip();c.translate(-originalKnee[0],-originalKnee[1]);
  puppetPart(c,image,art,leg.contour,undefined,limbProjection);c.restore();
  c.save();c.translate(foot[0],foot[1]);
  // Contact paws keep their orientation on the deck; the shin can bend above
  // them. Lifted toes tilt only during the swing, never rock a planted foot.
  c.rotate(paw.planted?0:-paw.lift*.025);
  c.translate(-originalFoot[0],-originalFoot[1]);
  puppetPart(c,image,art,leg.contour,{kneeY:leg.knee[1],upper:false,pawTop,pawOnly:true},limbProjection);c.restore();
}

function facingProjection(o:CompanionOptions):number{
  const value=o.gait?.facingBlend;
  return value===undefined||!Number.isFinite(value)?o.facing:Math.max(-1,Math.min(1,value));
}

/** Each part approaches its own turn center; the animal stays solid/readable. */
function projectedPart(c:CanvasRenderingContext2D,image:HTMLImageElement,art:QuadrupedArt,
  contour:readonly ArtPoint[],projection:number,minimumWidth:number):void{
  const center=(Math.min(...contour.map(p=>p[0]))+Math.max(...contour.map(p=>p[0])))/2;
  const x=(center-art.frame.footX)*art.unit;
  const width=(projection<0?-1:1)*Math.max(minimumWidth,Math.abs(projection));
  c.save();c.translate(x*projection,0);c.scale(width,1);c.translate(-x,0);
  puppetPart(c,image,art,contour);c.restore();
}

function drawWalkingQuadruped(c: CanvasRenderingContext2D, o: CompanionOptions,
  gait: CompanionGaitSample): void {
  if(o.id!=='dog'&&o.id!=='cat')return;
  const art=quadrupedArt[o.id],image=o.id==='dog'?creatureImage:catCompanionImage;
  if(!image.complete||!image.naturalWidth)return;
  groundShadow(c,gait.strength>.15);
  c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';
  // Grounded feet remain independent of the torso's subtle weight transfer.
  const projection=facingProjection(o);
  for(const paw of ['hindFar','frontFar','hindNear','frontNear'] as const)puppetLeg(c,image,art,paw,gait,projection);
  c.save();c.translate(0,gait.bodyY);c.rotate(gait.bodyRoll);
  const idleTail=o.gait?.reducedMotion?0:Math.sin(o.time*1.4)*.025*(1-gait.strength);
  puppetPivot(c,art,art.tailRoot,gait.tailTilt+idleTail,()=>puppetPart(c,image,art,art.tail,undefined,projection),projection);
  projectedPart(c,image,art,art.body,projection,.5);
  puppetPivot(c,art,art.neck,gait.headTilt+Math.sin(gait.heading)*.018*gait.strength,
    ()=>projectedPart(c,image,art,art.head,projection,.75),projection);
  c.restore();
}

/** The actual rendered paw centers, for scene hit/animation diagnostics. */
export function companionPawContacts(o: CompanionOptions): Record<CompanionPaw,
  { x:number;y:number;phase:number;planted:boolean;lift:number }> | undefined {
  if((o.id!=='dog'&&o.id!=='cat')||!o.gait
    ||!['idle','walk','run'].includes(o.pose??'idle'))return;
  const art=quadrupedArt[o.id],gait=sampleCompanionGait(o.id,o.gait,o.scale);
  const projection=facingProjection(o);
  const result={} as NonNullable<ReturnType<typeof companionPawContacts>>;
  for(const name of ['frontNear','frontFar','hindNear','hindFar'] as const){
    const paw=gait.paws[name],foot=art.limbs[name].foot;
    result[name]={
      x:o.x+((foot[0]-art.frame.footX)*art.unit*projection+Math.cos(gait.heading)*paw.along)*o.scale,
      y:o.y+((foot[1]-art.frame.footY)*art.unit+Math.sin(gait.heading)*paw.along-paw.lift)*o.scale,
      phase:paw.phase,planted:paw.planted,lift:paw.lift*o.scale,
    };
  }
  return result;
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
  const gait=o.gait?sampleCompanionGait(o.id,o.gait,o.scale):undefined;
  const naturalWalk=gait&&(pose==='idle'||pose==='walk'||pose==='run')
    &&(o.id==='dog'?creatureImage.complete&&creatureImage.naturalWidth>0
      :o.id==='cat'?catCompanionImage.complete&&catCompanionImage.naturalWidth>0:false);
  c.save(); c.translate(o.x, o.y); c.scale(o.scale * (naturalWalk?1:o.facing), o.scale);
  if (pose === 'hurt') c.globalAlpha *= .65 + Math.abs(Math.sin(o.time * 19)) * .35;
  if (pose === 'down') {
    // Existing dog/cat keep their prior resting pose. The new atlas supplies
    // genuine peacefully sleeping silhouettes, so those are never flattened.
    c.globalAlpha *= o.id === 'dog' || o.id === 'cat' ? .65 : .78;
    if (o.id === 'dog' || o.id === 'cat') { c.scale(1, .55); c.rotate(-.1); }
  }
  if(naturalWalk)drawWalkingQuadruped(c,o,gait);
  else if (o.id === 'dog') {
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
