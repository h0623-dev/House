import { paintWorldQuad, worldImages } from './world-art';
import { FLOOR_HEIGHT } from './truck-layout';
import { drawTruckAccessStairs } from './truck-stair-art';

export type TruckFloorId = 1 | 2 | 3;
export type FloorArtPoint = [number, number];
export interface FloorArtBounds { left:number;end:number;back:number;front:number }
export interface FloorArtLevel { id:TruckFloorId;z:number }
export interface FloorArtStairway {
  from:TruckFloorId;to:TruckFloorId;top:FloorArtPoint;bottom:FloorArtPoint;
  /** Canonical shared stair footprint, in truck UV units. */
  reserved?:{left:number;top:number;right:number;bottom:number};
}
export interface FloorRailGap { edge:'back'|'front'|'left'|'right';from:number;to:number }
export interface TruckFloorArtOptions {
  /** Raw physical projection, without a selected-floor offset. */
  project:(u:number,v:number,z:number)=>FloorArtPoint;
  bounds:FloorArtBounds;
  /** Absolute wood-surface heights supplied by the shared physical layout. */
  floors:readonly FloorArtLevel[];
  selectedFloor:TruckFloorId;
  stairways?:readonly FloorArtStairway[];
  railGaps?:readonly FloorRailGap[];
  pass:'structure'|'surface'|'back'|'front';
  night?:number;
}
export interface TruckFloorArtGeometry {
  floor:TruckFloorId;
  z:number;
  surface:readonly FloorArtPoint[];
  otherFloors:readonly {floor:TruckFloorId;z:number;rim:readonly FloorArtPoint[]}[];
  stairways:readonly FloorArtStairway[];
}
const clamp=(n:number):number=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0));

function polygon(c:CanvasRenderingContext2D,points:readonly FloorArtPoint[],fill:string,stroke='',width=1):void{
  c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();
  if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}
}
function line(c:CanvasRenderingContext2D,a:FloorArtPoint,b:FloorArtPoint,color:string,width=1):void{
  c.beginPath();c.moveTo(...a);c.lineTo(...b);c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.stroke();
}
function quad(o:TruckFloorArtOptions,z:number,inset=0):[FloorArtPoint,FloorArtPoint,FloorArtPoint,FloorArtPoint]{
  const b=o.bounds,p=o.project;return[p(b.left+inset,b.back+inset,z),p(b.end-inset,b.back+inset,z),p(b.end-inset,b.front-inset,z),p(b.left+inset,b.front-inset,z)];
}
function fascia(c:CanvasRenderingContext2D,o:TruckFloorArtOptions,z:number,opacity=1):void{
  const b=o.bounds,p=o.project;
  c.save();c.globalAlpha*=opacity;
  for(const face of [
    [p(b.left,b.front,z),p(b.end,b.front,z),p(b.end,b.front,z-10),p(b.left,b.front,z-10)],
    [p(b.end,b.back,z),p(b.end,b.front,z),p(b.end,b.front,z-10),p(b.end,b.back,z-10)],
  ] as [FloorArtPoint,FloorArtPoint,FloorArtPoint,FloorArtPoint][]){
    polygon(c,face,'#aa8758');c.save();c.globalAlpha=.56;paintWorldQuad(c,'wood',face,.035);c.restore();polygon(c,face,'','#746545',.7);
    line(c,face[2],face[3],'#374d3570',1.6);
  }
  line(c,p(b.left,b.front,z),p(b.end,b.front,z),'#efd19a',2);
  line(c,p(b.end,b.back,z),p(b.end,b.front,z),'#e3c38a',1.5);
  c.restore();
}
function stairLanding(c:CanvasRenderingContext2D,center:FloorArtPoint):void{
  // The cross-axis follows projected truck u; this is the same 91-UV-wide
  // passage reserved by the shared navigation geometry.
  const across:FloorArtPoint=[41,41*.34/.91],depth:FloorArtPoint=[7.1,-8.9];
  const corners=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b])=>[
    center[0]+across[0]*a+depth[0]*b,center[1]+across[1]*a+depth[1]*b,
  ] as FloorArtPoint) as [FloorArtPoint,FloorArtPoint,FloorArtPoint,FloorArtPoint];
  polygon(c,corners,'#d7b47e','#9b8154',.8);paintWorldQuad(c,'wood',corners,-.015);
  line(c,corners[2],corners[3],'#e7c990',1.4);
}
/** The same warm oak and olive stair construction connects every floor.
 * Physical endpoints and the reserved free-placement footprint stay unchanged. */
export function drawTruckStairway(c:CanvasRenderingContext2D,top:FloorArtPoint,bottom:FloorArtPoint):void{
  drawTruckAccessStairs(c,top,bottom,{width:86,rise:FLOOR_HEIGHT,treadCount:12});
  stairLanding(c,bottom);stairLanding(c,top);
}
function wideStairs(c:CanvasRenderingContext2D,stairs:FloorArtStairway):void{
  drawTruckStairway(c,stairs.top,stairs.bottom);
}
function stairWell(c:CanvasRenderingContext2D,o:TruckFloorArtOptions,floor:FloorArtLevel,stairs:FloorArtStairway):void{
  const r=stairs.reserved;if(!r)return;const p=o.project;
  const corners:[FloorArtPoint,FloorArtPoint,FloorArtPoint,FloorArtPoint]=[
    p(r.left,r.top,floor.z),p(r.right,r.top,floor.z),p(r.right,r.bottom,floor.z),p(r.left,r.bottom,floor.z),
  ];
  polygon(c,corners,'#54624d','#6b5438',1.5);
  c.save();c.beginPath();corners.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.clip();
  const shade=c.createLinearGradient(0,Math.min(...corners.map(p=>p[1])),0,Math.max(...corners.map(p=>p[1])));
  shade.addColorStop(0,'#2e443cf2');shade.addColorStop(1,'#8b805be0');c.fillStyle=shade;c.fill();
  wideStairs(c,stairs);c.restore();
  for(let i=0;i<corners.length;i++)line(c,corners[i],corners[(i+1)%corners.length],'#c9a769',1.3);
}
function rail(c:CanvasRenderingContext2D,o:TruckFloorArtOptions,edge:FloorRailGap['edge'],z:number,front:boolean):void{
  const b=o.bounds,p=o.project,horizontal=edge==='back'||edge==='front';
  const start=horizontal?b.left+4:b.back+4,end=horizontal?b.end-4:b.front-4;
  const project=(value:number)=>horizontal?p(value,edge==='front'?b.front:b.back+4,z):p(edge==='left'?b.left+4:b.end,value,z);
  const gaps=(o.railGaps??[]).filter(g=>g.edge===edge).map(g=>({from:Math.max(start,Math.min(end,g.from)),to:Math.max(start,Math.min(end,g.to))})).sort((a,b)=>a.from-b.from);
  const segments:[number,number][]=[];let at=start;
  for(const gap of gaps){if(gap.from>at)segments.push([at,gap.from]);at=Math.max(at,gap.to);}if(at<end)segments.push([at,end]);
  for(const[a,b]of segments){
    const n=Math.max(1,Math.ceil((b-a)/128)),height=front?26:34;
    for(let i=0;i<n;i++){
      const start=project(a+(b-a)*i/n),end=project(a+(b-a)*(i+1)/n);
      const point=(p:FloorArtPoint,lift:number):FloorArtPoint=>[p[0],p[1]-lift];
      const beam:[FloorArtPoint,FloorArtPoint,FloorArtPoint,FloorArtPoint]=[point(start,6),point(end,6),point(end,17),point(start,17)];
      polygon(c,beam,'#b2905e','#706346',.6);
      c.save();c.globalAlpha=.7;paintWorldQuad(c,'wood',beam,.025);c.restore();
      line(c,point(start,17),point(end,17),'#e0c28b',1.2);
      line(c,point(start,height-3),point(end,height-3),'#3e5743',3.1);
      line(c,point(start,height-4),point(end,height-4),'#929c6e',.9);
      const mid:FloorArtPoint=[(start[0]+end[0])/2,(start[1]+end[1])/2];
      line(c,point(mid,17),point(mid,height-3),'#607452',1.8);
    }
    for(let i=0;i<=n;i++){
      const at=project(a+(b-a)*i/n);
      railPost(c,at,height,(i===0||i===n||i%3===0),o.night??0,front);
    }
  }
}
/** Actual vertical posts and restrained lanterns stay upright on both deck axes.
 * The previous full fence image distorted its uprights on the short UV edge. */
function railPost(c:CanvasRenderingContext2D,p:FloorArtPoint,height:number,lantern:boolean,night:number,front:boolean):void{
  const [x,y]=p,w=3.1,top=y-height;
  polygon(c,[[x-w,y+1],[x+w,y+2],[x+w,top],[x-w,top-1]],'#4f694a','#364c38',.7);
  polygon(c,[[x+w,y+2],[x+w+2,y],[x+w+2,top-2],[x+w,top]],'#334e38');
  line(c,[x-w+.8,y],[x-w+.8,top],'#a5ac78',.8);
  polygon(c,[[x-w-1,top-1],[x+w,top+1],[x+w+2,top-2],[x-w+1,top-4]],'#c7ad73','#79754b',.55);
  for(const at of[y-4,top+5]){c.beginPath();c.arc(x-.4,at,.9,0,Math.PI*2);c.fillStyle='#d2b271';c.fill();}
  if(!lantern)return;
  const h=front?10:12,ly=top-3;
  if(night>.01){
    const glow=c.createRadialGradient(x,ly-h*.5,1,x,ly-h*.5,17);glow.addColorStop(0,`rgba(255,221,132,${.12+clamp(night)*.24})`);glow.addColorStop(1,'rgba(255,217,122,0)');
    c.fillStyle=glow;c.beginPath();c.arc(x,ly-h*.5,17,0,Math.PI*2);c.fill();
  }
  const glass=c.createLinearGradient(x-3,ly-h,x+3,ly);glass.addColorStop(0,'#fff8ce');glass.addColorStop(.6,'#f9e3a1');glass.addColorStop(1,'#dcb56b');
  c.fillStyle=glass;c.strokeStyle='#9c8a55';c.lineWidth=.75;c.beginPath();c.roundRect(x-3,ly-h,6,h,1);c.fill();c.stroke();
  line(c,[x,ly-h],[x,ly],'#9c8d55',.55);
  polygon(c,[[x-4,ly-h],[x,ly-h-3],[x+4,ly-h],[x+3,ly-h+1],[x-3,ly-h+1]],'#8a8858','#5b6b45',.5);
  line(c,[x-3.5,ly],[x+3.5,ly],'#ad935b',1.1);
}

/** Board dimensions stay physical as the truck expands: one warm oak painting
 * per staggered plank, instead of one giant grain stretched over the whole map. */
function paintWoodSurface(c:CanvasRenderingContext2D,o:TruckFloorArtOptions,z:number):void{
  const b=o.bounds,p=o.project,surface=quad(o,z,1),rowDepth=23,pieceLength=156;
  polygon(c,surface,'#d6b17b');
  c.save();c.beginPath();surface.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.clip();
  for(let row=0,v=b.back+1;v<b.front;row++,v+=rowDepth){
    const lastV=Math.min(b.front,v+rowDepth),offset=(row%3)*pieceLength/3;
    for(let column=0,u=b.left+1-offset;u<b.end;column++,u+=pieceLength){
      const from=Math.max(b.left+1,u),to=Math.min(b.end,u+pieceLength),points:[FloorArtPoint,FloorArtPoint,FloorArtPoint,FloorArtPoint]=[p(from,v,z),p(to,v,z),p(to,lastV,z),p(from,lastV,z)];
      const tone=(row*7+column*11)%5;
      polygon(c,points,['#dab985','#dfbf8b','#d5af79','#e2be88','#dcb47c'][tone]);
      c.save();c.globalAlpha=.56;paintWorldQuad(c,'wood',points,0);c.restore();
      line(c,p(from,v,z),p(to,v,z),'#fff0c45c',.65);
      line(c,p(to,v,z),p(to,lastV,z),'#7b5b373b',.6);
      if((row+column)%3===0){
        const mid=(from+to)/2+.1;
        line(c,p(Math.max(from+4,mid-22),v+rowDepth*.38,z),p(Math.min(to-4,mid+26),v+rowDepth*.38,z),'#815e3420',.5);
      }
    }
    line(c,p(b.left+1,lastV,z),p(b.end,lastV,z),'#7a5d383d',.75);
    line(c,p(b.left+1,lastV+.9,z),p(b.end,lastV+.9,z),'#fff1ca5c',.7);
  }
  const shade=c.createLinearGradient(...p(b.left,b.back,z),...p(b.end,b.front,z));shade.addColorStop(0,'rgba(255,244,214,.08)');shade.addColorStop(1,'rgba(112,78,38,.025)');
  c.beginPath();surface.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=shade;c.fill();c.restore();polygon(c,surface,'','#a2865d',.9);
}

// Keep one raster only. Expansion interpolates the physical bounds every frame;
// retaining all those intermediate surfaces would keep dozens of large images.
let woodCache:{key:string;canvas:HTMLCanvasElement;left:number;top:number;width:number;height:number}|null=null;
function woodSurface(c:CanvasRenderingContext2D,o:TruckFloorArtOptions,z:number):void{
  if(typeof document==='undefined'){paintWoodSurface(c,o,z);return;}
  const corners=quad(o,z,0),left=Math.floor(Math.min(...corners.map(p=>p[0])))-2,
    top=Math.floor(Math.min(...corners.map(p=>p[1])))-2,
    width=Math.ceil(Math.max(...corners.map(p=>p[0]))-left)+3,
    height=Math.ceil(Math.max(...corners.map(p=>p[1]))-top)+3;
  const transform=c.getTransform(),deviceScale=Math.hypot(transform.a,transform.b),
    requested=Math.max(1,Math.min(2,Math.ceil(deviceScale*2)/2)),
    resolution=Math.min(requested,2048/Math.max(1,width),1536/Math.max(1,height)),
    ready=worldImages.havenTruck.complete&&worldImages.havenTruck.naturalWidth>0;
  const key=[o.bounds.left,o.bounds.end,o.bounds.back,o.bounds.front,z,...corners.flat(),resolution,ready?1:0].join(':');
  if(woodCache?.key!==key){
    const canvas=woodCache?.canvas??document.createElement('canvas');
    canvas.width=Math.max(1,Math.ceil(width*resolution));canvas.height=Math.max(1,Math.ceil(height*resolution));
    const paint=canvas.getContext('2d');
    if(!paint){paintWoodSurface(c,o,z);return;}
    paint.setTransform(resolution,0,0,resolution,-left*resolution,-top*resolution);
    paintWoodSurface(paint,o,z);
    woodCache={key,canvas,left,top,width,height};
  }
  c.drawImage(woodCache.canvas,0,0,width*resolution,height*resolution,left,top,width,height);
}
function floorPlate(c:CanvasRenderingContext2D,o:TruckFloorArtOptions,floor:FloorArtLevel):void{
  const b=o.bounds,p=o.project,anchor=p(Math.min(b.end-75,b.left+130),b.front+1,floor.z-10);
  c.save();c.translate(...anchor);c.transform(1,.34/.91,0,1,0,0);
  const gradient=c.createLinearGradient(0,-9,0,10);gradient.addColorStop(0,'#80926b');gradient.addColorStop(1,'#586b49');
  c.fillStyle=gradient;c.strokeStyle='#d6bd84';c.lineWidth=1.3;c.beginPath();c.roundRect(-48,-9,96,22,3);c.fill();c.stroke();
  for(const x of[-43,43]){c.beginPath();c.arc(x,2,1.3,0,Math.PI*2);c.fillStyle='#e0c28c';c.fill();}
  c.fillStyle='#fff1c9';c.textAlign='center';c.textBaseline='middle';c.font='700 10px "Noto Sans KR Variable", sans-serif';
  c.fillText(`${floor.id}층 생활 데크`,0,2);c.restore();
}

/** Draw only the active floor. Other floors remain physical navigation data. */
export function drawTruckFloor(c:CanvasRenderingContext2D,o:TruckFloorArtOptions):TruckFloorArtGeometry{
  const floor=o.floors.find(f=>f.id===o.selectedFloor)??o.floors[0]??{id:1 as const,z:94};
  const geometry:TruckFloorArtGeometry={floor:floor.id,z:floor.z,surface:quad(o,floor.z,1),
    otherFloors:[],stairways:(o.stairways??[]).filter(stairs=>stairs.from===floor.id||stairs.to===floor.id)};
  c.save();
  if(o.pass==='structure'){
    // Tall posts, ghost rims and complete flights used to cover the work area.
    // The selected floor's fascia/rails and clipped local stairwell suffice.
  }else if(o.pass==='surface'){
    fascia(c,o,floor.z);const surface=quad(o,floor.z,1);woodSurface(c,o,floor.z);
    if(o.night){c.save();c.globalAlpha*=clamp(o.night)*.1;polygon(c,surface,'#263e45');c.restore();}
  }else if(o.pass==='back'){
    for(const stairs of geometry.stairways)stairWell(c,o,floor,stairs);
    rail(c,o,'back',floor.z,false);rail(c,o,'left',floor.z,false);
  }else{
    rail(c,o,'front',floor.z,true);rail(c,o,'right',floor.z,true);floorPlate(c,o,floor);
  }
  c.restore();return geometry;
}
