import { heroFrame, portraitCrops, survivorAtlasUrl, type SurvivorFrame, type SurvivorGender } from './character-art';
import type { EquippedOutfitId } from './shop';

type Anchor = readonly [x: number, y: number, width: number, height?: number];
interface OutfitAnchors { hat: Anchor; neck: Anchor; apron: Anchor; pack: Anchor; back?: boolean }
type Shape = { path: string; fill: string; stroke?: string; width?: number };
type Layer = 'hat' | 'neck' | 'apron' | 'pack';
export interface OutfitDrawLayer { kind: Layer; x: number; y: number; scaleX: number; scaleY: number; paths: number }

// These are measured on the original drawings, rather than assuming that a
// crouching farmer's head is in the same place as a standing or climbing one.
const anchors: Record<SurvivorGender, Record<string, OutfitAnchors>> = {
  female: {
    'survivors:84': { hat:[225,109,164], neck:[226,218,103], apron:[234,307,81,129], pack:[137,262,65,99] },
    'survivors:1177': { hat:[1365,139,164], neck:[1365,246,106], apron:[1313,323,86,123], pack:[1232,277,79,119] },
    'locomotion:66': { hat:[261,103,168], neck:[253,217,107], apron:[242,296,87,128], pack:[150,252,79,125] },
    'locomotion:438': { hat:[655,113,168], neck:[648,228,104], apron:[623,304,79,126], pack:[533,258,77,122] },
    'locomotion:847': { hat:[982,103,169], neck:[984,200,105], apron:[983,281,86,129], pack:[989,271,115,138], back:true },
    'locomotion:1197': { hat:[1340,103,164], neck:[1342,211,104], apron:[1342,287,86,122], pack:[1354,275,115,138], back:true },
    'gathering:132': { hat:[411,169,250], neck:[398,350,165], apron:[310,433,93,120], pack:[226,363,125,175] },
    'gathering:705': { hat:[950,142,248], neck:[941,310,163], apron:[849,408,107,124], pack:[798,342,124,172] },
    'actions:70': { hat:[249,124,169], neck:[246,235,104], apron:[224,311,81,110], pack:[143,253,64,101] },
    'actions:445': { hat:[629,121,169], neck:[623,233,107], apron:[588,306,71,101], pack:[527,259,74,109] },
    'actions:826': { hat:[1000,213,169], neck:[998,315,106], apron:[939,362,64,65], pack:[884,334,82,113] },
    'actions:1156': { hat:[1331,127,167], neck:[1345,239,104], apron:[1303,310,79,122], pack:[1237,264,78,118] },
  },
  male: {
    'survivors:85': { hat:[225,586,166], neck:[235,698,106], apron:[242,787,77,133], pack:[123,737,80,130] },
    'survivors:1163': { hat:[1364,603,170], neck:[1355,711,110], apron:[1308,798,89,132], pack:[1227,744,81,121] },
    'locomotion:64': { hat:[259,593,171], neck:[251,709,108], apron:[226,793,84,126], pack:[149,756,88,131] },
    'locomotion:461': { hat:[661,597,171], neck:[648,721,108], apron:[616,803,80,123], pack:[536,754,85,127] },
    'locomotion:846': { hat:[982,604,171], neck:[983,703,108], apron:[983,788,87,126], pack:[1006,779,118,143], back:true },
    'locomotion:1191': { hat:[1340,604,170], neck:[1343,711,108], apron:[1343,795,87,126], pack:[1358,783,118,143], back:true },
    'gathering:114': { hat:[415,734,262], neck:[406,925,170], apron:[316,1004,95,123], pack:[211,953,132,175] },
    'gathering:728': { hat:[970,717,258], neck:[965,911,172], apron:[875,992,105,124], pack:[790,941,131,173] },
    'actions:46': { hat:[248,603,171], neck:[250,727,108], apron:[226,807,86,126], pack:[125,755,81,123] },
    'actions:440': { hat:[629,604,171], neck:[627,723,108], apron:[589,803,72,104], pack:[529,754,85,128] },
    'actions:828': { hat:[1000,697,171], neck:[999,811,108], apron:[941,860,63,67], pack:[888,835,85,121] },
    'actions:1156': { hat:[1338,612,171], neck:[1345,728,109], apron:[1307,809,82,128], pack:[1240,756,82,123] },
  },
};

const shapes: Record<Exclude<EquippedOutfitId, 'default'>, Partial<Record<Layer, Shape[]>>> = {
  garden: {
    hat: [
      {path:'M-23-3Q-22-29 0-30Q22-29 23-3Z',fill:'cloth'},
      {path:'M-31 0Q-24-11 0-8Q26-10 33 0Q30 8 1 10Q-25 8-31 0Z',fill:'light'},
      {path:'M-23-7Q0-2 23-7L23-2Q0 3-23-2Z',fill:'#829367'},
      {path:'M-17-22L-19-10M-10-26L-12-9M-2-28L-3-8M7-27L7-8M15-23L16-9',fill:'none',stroke:'#b59355',width:.8},
      {path:'M16-6Q20-15 26-11Q25-5 18-4M18-5Q20-1 26-2',fill:'#b6c276',stroke:'#63734b',width:.8},
    ],
    neck: [
      {path:'M-21-5Q-4 0 18-5L16 5Q2 13-17 4Z',fill:'cloth'},
      {path:'M-15 2Q0 7 12 1',fill:'none',stroke:'#c0aa6d',width:1.2},
    ],
    apron: [
      {path:'M-12-25Q0-21 12-25L14-6Q18 16 23 35Q1 44-23 35L-15-6Z',fill:'cloth'},
      {path:'M-11-25L-15-35M11-25L15-35',fill:'none',stroke:'#a6aa78',width:3},
      {path:'M-12 5Q0 9 12 5L11 22Q1 28-11 22Z',fill:'light'},
      {path:'M-1 9L-1 22M-18 31Q0 36 18 31',fill:'none',stroke:'#b5a876',width:.8},
      {path:'M4 13Q3 7 7 7Q12 7 11 13L8 20Z',fill:'#d29854',stroke:'#987846',width:.6},
      {path:'M7 8L6 4M8 8L11 4',fill:'none',stroke:'#798651',width:1.2},
    ],
  },
  road: {
    hat: [
      {path:'M-24-3Q-24-28-3-29Q20-28 22-7L15 0Z',fill:'cloth'},
      {path:'M-21-2Q-1-8 20-5L34 1Q28 9 15 7L-20 4Z',fill:'light'},
      {path:'M-2-26Q4-15 4-6M-20-10Q-2-16 17-10',fill:'none',stroke:'#506c75',width:.9},
      {path:'M3-17L12-17L12-10L3-10Z',fill:'#e6d6a6',stroke:'#4f626a',width:.8},
      {path:'M6-14H9',fill:'none',stroke:'#68818a',width:1},
    ],
    neck: [
      {path:'M-22-5Q-5 1 19-5L17 6Q-2 13-18 4Z',fill:'cloth'},
      {path:'M7 5Q16 4 21 8L16 28L7 22Z',fill:'light'},
      {path:'M-16 1Q0 7 15 0M11 9L14 20',fill:'none',stroke:'#8c5446',width:1.1},
      {path:'M14 24L15 27M17 24L18 27',fill:'none',stroke:'#ddb185',width:.8},
    ],
  },
  explorer: {
    hat: [
      {path:'M-22-3L-17-24Q-3-31 18-22L22-3Z',fill:'cloth'},
      {path:'M-29 0Q-20-6 0-5Q21-7 31 0L27 6Q7 11-26 6Z',fill:'light'},
      {path:'M-21-8Q1-3 21-8L22-3Q0 3-22-3Z',fill:'#9f7953'},
      {path:'M-13-21Q-2-25 10-21M-23 3Q0 8 24 2',fill:'none',stroke:'#a1ad79',width:1},
      {path:'M14-14L20-14L20-8L14-8Z',fill:'#d5b880',stroke:'#735f43',width:.7},
    ],
    neck: [
      {path:'M-22-5Q0 1 19-5L16 5Q0 12-18 4Z',fill:'#d7c797'},
      {path:'M7 5L17 4L17 19L9 17Z',fill:'#bfad7e'},
      {path:'M-15 0Q0 6 13 0',fill:'none',stroke:'#a4946f',width:1.1},
    ],
    pack: [
      {path:'M-21-25Q-27-20-25 15Q-24 28-17 31L19 30Q28 23 26-16Q24-25 17-27Z',fill:'cloth'},
      {path:'M-21-24Q0-34 22-24L24-14Q0-7-23-15Z',fill:'light'},
      {path:'M-17 0Q0-4 18 0L18 20Q0 26-18 20Z',fill:'light'},
      {path:'M-9-20L-9 20M11-20L11 20',fill:'none',stroke:'#a48358',width:3},
      {path:'M-13-10L-5-10L-5-3L-13-3ZM7-10L15-10L15-3L7-3Z',fill:'#e2c78c',stroke:'#785f43',width:.8},
      {path:'M-3 8L5 8L5 16L-3 16Z',fill:'#d8d1a4',stroke:'#687a53',width:.8},
      {path:'M-25-9Q-31-6-28 14L-23 16M25-8Q31-4 28 13L24 15',fill:'cloth'},
    ],
  },
};

const palette = {
  garden:{cloth:['#e4d5a1','#bba26d'],light:['#f4e6b8','#ccb780'],outline:'#826a48'},
  road:{cloth:['#839a9b','#526d77'],light:['#9eb1ab','#627d84'],outline:'#4d5b58'},
  explorer:{cloth:['#9aa779','#617449'],light:['#b0ba85','#7b8b59'],outline:'#536245'},
} as const;

function frameAnchors(gender: SurvivorGender, frame: SurvivorFrame): OutfitAnchors {
  return anchors[gender][`${frame.sheet}:${frame.x}`];
}
function layerTransform(anchor: Anchor, frame: SurvivorFrame, layer: Layer): readonly [number, number, number, number] {
  const unit=128/(frame.referenceHeight??frame.footY-frame.y);
  const width=layer==='hat'?64:layer==='neck'?44:layer==='apron'?46:56;
  const height=layer==='apron'?68:layer==='pack'?62:width;
  return [(anchor[0]-frame.footX)*unit,(anchor[1]-frame.footY)*unit,anchor[2]*unit/width,(anchor[3]??anchor[2])*unit/height];
}
function visibleLayers(points: OutfitAnchors, outfit: Exclude<EquippedOutfitId,'default'>): Layer[] {
  // A rear-facing climber wears the apron on the hidden side of the body.
  return points.back ? outfit==='explorer'?['pack','neck','hat']:['neck','hat']
    : outfit==='garden'?['apron','neck','hat']:outfit==='explorer'?['pack','neck','hat']:['neck','hat'];
}
function colors(outfit: Exclude<EquippedOutfitId,'default'>, layer: Layer) {
  if(outfit==='road'&&layer==='neck')return {cloth:['#c78063','#a85d4d'],light:['#d99b78','#b97459'],outline:'#815344'};
  return palette[outfit];
}

/** Painted, physical accessories follow the measured pose before the outer gait transform. */
export function drawSurvivorOutfit(c: CanvasRenderingContext2D, gender: SurvivorGender, frame: SurvivorFrame, outfit: EquippedOutfitId='default'): OutfitDrawLayer[] {
  if(outfit==='default')return [];
  const points=frameAnchors(gender,frame);
  const drawn: OutfitDrawLayer[]=[];
  for(const layer of visibleLayers(points,outfit)) {
    const parts=shapes[outfit][layer]; if(!parts)continue;
    const [x,y,sx,sy]=layerTransform(points[layer],frame,layer),p=colors(outfit,layer);
    c.save();c.translate(x,y);c.scale(sx,sy);c.lineCap='round';c.lineJoin='round';
    // Side-facing drawings already contain the nearer shoulder and sleeve.
    // Keep those original foreground pixels in front of the pack.
    if(layer==='pack'&&!points.back){c.beginPath();c.moveTo(-34,-38);c.lineTo(10,-38);c.lineTo(7,35);c.lineTo(-34,35);c.closePath();c.clip();}
    const cloth=c.createLinearGradient(-20,-25,22,30),light=c.createLinearGradient(-18,-16,23,22);
    p.cloth.forEach((color,index)=>cloth.addColorStop(index,color));p.light.forEach((color,index)=>light.addColorStop(index,color));
    for(const part of parts){const path=new Path2D(part.path);c.fillStyle=part.fill==='cloth'?cloth:part.fill==='light'?light:part.fill;if(part.fill!=='none')c.fill(path);c.strokeStyle=part.stroke??p.outline;c.lineWidth=part.width??1.15;c.stroke(path);}
    c.restore();
    drawn.push({kind:layer,x,y,scaleX:sx,scaleY:sy,paths:parts.length});
  }
  return drawn;
}

let illustrationId=0;
/** Same paths, colors and pose anchors as the in-world outfit, used by the shop and profile. */
export function survivorOutfitSvgLayers(gender: SurvivorGender, frame: SurvivorFrame, outfit: EquippedOutfitId='default'): string {
  if(outfit==='default')return '';
  const points=frameAnchors(gender,frame),unit=128/(frame.referenceHeight??frame.footY-frame.y);
  const prefix=`outfit-${++illustrationId}`;
  return visibleLayers(points,outfit).map(layer=>{
    const parts=shapes[outfit][layer];if(!parts)return '';
    const [x,y,sx,sy]=layerTransform(points[layer],frame,layer),p=colors(outfit,layer),id=`${prefix}-${layer}`;
    const gradients=`<defs><linearGradient id="${id}-cloth" gradientUnits="userSpaceOnUse" x1="-20" y1="-25" x2="22" y2="30"><stop stop-color="${p.cloth[0]}"/><stop offset="1" stop-color="${p.cloth[1]}"/></linearGradient><linearGradient id="${id}-light" gradientUnits="userSpaceOnUse" x1="-18" y1="-16" x2="23" y2="22"><stop stop-color="${p.light[0]}"/><stop offset="1" stop-color="${p.light[1]}"/></linearGradient></defs>`;
    const clip=layer==='pack'&&!points.back?`<defs><clipPath id="${id}-foreground"><path d="M-34-38H10L7 35H-34Z"/></clipPath></defs>`:'';
    return `<g transform="translate(${frame.footX+x/unit} ${frame.footY+y/unit}) scale(${sx/unit} ${sy/unit})" stroke-linecap="round" stroke-linejoin="round">${gradients}${clip}<g${clip?` clip-path="url(#${id}-foreground)"`:''}>${parts.map(part=>`<path d="${part.path}" fill="${part.fill==='cloth'||part.fill==='light'?`url(#${id}-${part.fill})`:part.fill}" stroke="${part.stroke??p.outline}" stroke-width="${part.width??1.15}"/>`).join('')}</g></g>`;
  }).join('');
}

export function survivorOutfitPreview(gender: SurvivorGender, outfit: EquippedOutfitId='default', cls=''): string {
  const frame=heroFrame(gender,'idle',0),margin=48,x=frame.x-margin,y=frame.y-margin,width=frame.width+margin*2,height=frame.height+margin*2;
  return `<svg class="survivor-outfit-preview ${cls}" viewBox="${x} ${y} ${width} ${height}" role="img" aria-label="${gender==='female'?'여자':'남자'} 생존자 의상 미리보기" data-outfit-preview="${outfit}"><ellipse cx="${frame.footX}" cy="${frame.footY+8}" rx="90" ry="15" fill="#776443" opacity=".12"/><svg x="${frame.x}" y="${frame.y}" width="${frame.width}" height="${frame.height}" viewBox="${frame.x} ${frame.y} ${frame.width} ${frame.height}"><image href="${survivorAtlasUrl}" width="1536" height="1024"/></svg>${survivorOutfitSvgLayers(gender,frame,outfit)}</svg>`;
}

export function survivorOutfitPortrait(gender: SurvivorGender, outfit: EquippedOutfitId='default', cls=''): string {
  const crop=portraitCrops[gender],frame=heroFrame(gender,'idle',0);
  return `<svg class="portrait ${cls}" viewBox="${crop.x} ${crop.y} ${crop.size} ${crop.size}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" data-outfit="${outfit}" style="border-radius:20%;overflow:hidden"><rect x="${crop.x}" y="${crop.y}" width="${crop.size}" height="${crop.size}" rx="${crop.size*.2}" fill="${crop.backdrop}"/><circle cx="${crop.x+crop.size*.74}" cy="${crop.y+crop.size*.2}" r="${crop.size*.38}" fill="#fff9e5" opacity=".52"/><image href="${survivorAtlasUrl}" x="0" y="0" width="1536" height="1024"/>${survivorOutfitSvgLayers(gender,frame,outfit)}</svg>`;
}
