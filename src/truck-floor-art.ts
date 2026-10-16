import { paintWorldQuad, drawWorldFence } from './world-art';
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
    [p(b.left,b.front,z),p(b.end,b.front,z),p(b.end,b.front,z-12),p(b.left,b.front,z-12)],
    [p(b.end,b.back,z),p(b.end,b.front,z),p(b.end,b.front,z-12),p(b.end,b.back,z-12)],
  ] as [FloorArtPoint,FloorArtPoint,FloorArtPoint,FloorArtPoint][]){
    polygon(c,face,'#677653');paintWorldQuad(c,'metal',face,.035);polygon(c,face,'','#69704b',.7);
    line(c,face[2],face[3],'#38463366',1.8);
  }
  line(c,p(b.left,b.front,z),p(b.end,b.front,z),'#e3c087',2);
  line(c,p(b.end,b.back,z),p(b.end,b.front,z),'#cfb27d',1.4);
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
    const n=Math.max(1,Math.ceil((b-a)/155));
    for(let i=0;i<n;i++)drawWorldFence(c,project(a+(b-a)*i/n),project(a+(b-a)*(i+1)/n),front?23:31);
  }
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
  const b=o.bounds,p=o.project;c.save();
  if(o.pass==='structure'){
    // Tall posts, ghost rims and complete flights used to cover the work area.
    // The selected floor's fascia/rails and clipped local stairwell suffice.
  }else if(o.pass==='surface'){
    fascia(c,o,floor.z);const surface=quad(o,floor.z,1);
    polygon(c,surface,'#d7b47f');paintWorldQuad(c,'wood',surface,-.025);polygon(c,surface,'','#9a7c51',1.2);
    for(let v=b.back+24;v<b.front;v+=24){
      line(c,p(b.left+1,v,floor.z),p(b.end-1,v,floor.z),'#94744840',.65);
      line(c,p(b.left+1,v+1,floor.z),p(b.end-1,v+1,floor.z),'#fff0c668',.7);
    }
    if(o.night){c.save();c.globalAlpha*=clamp(o.night)*.1;polygon(c,surface,'#263e45');c.restore();}
  }else if(o.pass==='back'){
    for(const stairs of geometry.stairways)stairWell(c,o,floor,stairs);
    rail(c,o,'back',floor.z,false);rail(c,o,'left',floor.z,false);
  }else{
    rail(c,o,'front',floor.z,true);rail(c,o,'right',floor.z,true);floorPlate(c,o,floor);
  }
  c.restore();return geometry;
}
