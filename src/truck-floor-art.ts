import { paintWorldQuad, drawWorldFence } from './world-art';

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
  /** Absolute wood-surface heights: normally 94,270,446. */
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
    polygon(c,face,'#557e6b');paintWorldQuad(c,'metal',face,.09);polygon(c,face,'','#65513a',1);
  }
  line(c,p(b.left,b.front,z),p(b.end,b.front,z),'#d4b26e',2);
  line(c,p(b.end,b.back,z),p(b.end,b.front,z),'#c9a567',1.4);
  c.restore();
}
function post(c:CanvasRenderingContext2D,o:TruckFloorArtOptions,u:number,v:number,bottom:number,top:number):void{
  const p=o.project,w=4;
  const front:[FloorArtPoint,FloorArtPoint,FloorArtPoint,FloorArtPoint]=[p(u-w,v+w,top),p(u+w,v+w,top),p(u+w,v+w,bottom),p(u-w,v+w,bottom)];
  const side:[FloorArtPoint,FloorArtPoint,FloorArtPoint,FloorArtPoint]=[p(u+w,v-w,top),p(u+w,v+w,top),p(u+w,v+w,bottom),p(u+w,v-w,bottom)];
  polygon(c,front,'#537666','#62513b',.7);paintWorldQuad(c,'metal',front,.05);
  polygon(c,side,'#3d5d52','#574835',.7);paintWorldQuad(c,'metal',side,.19);
  polygon(c,[p(u-w,v-w,top),p(u+w,v-w,top),p(u+w,v+w,top),p(u-w,v+w,top)],'#d8b878','#79613d',.7);
  for(const floor of o.floors){
    if(floor.z<bottom||floor.z>top)continue;
    line(c,p(u-w,v+w,floor.z-7),p(u+w,v+w,floor.z-7),'#d4b470',2.6);
    const bolt=p(u,v+w,floor.z-13);c.beginPath();c.arc(...bolt,1.25,0,Math.PI*2);c.fillStyle='#d8b77a';c.fill();
  }
}
function brace(c:CanvasRenderingContext2D,a:FloorArtPoint,b:FloorArtPoint):void{
  line(c,a,b,'#405b4d',4);line(c,[a[0]-1,a[1]-.4],[b[0]-1,b[1]-.4],'#8d9b70',1.2);
  for(const p of [a,b]){c.beginPath();c.arc(...p,2,0,Math.PI*2);c.fillStyle='#c4a368';c.fill();}
}
function stairLanding(c:CanvasRenderingContext2D,center:FloorArtPoint):void{
  // The cross-axis follows projected truck u; this is the same 91-UV-wide
  // passage reserved by the shared navigation geometry.
  const across:FloorArtPoint=[41,41*.34/.91],depth:FloorArtPoint=[7.1,-8.9];
  const corners=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b])=>[
    center[0]+across[0]*a+depth[0]*b,center[1]+across[1]*a+depth[1]*b,
  ] as FloorArtPoint) as [FloorArtPoint,FloorArtPoint,FloorArtPoint,FloorArtPoint];
  polygon(c,corners,'#b89960','#6e5a3c',1);paintWorldQuad(c,'wood',corners,.06);
  line(c,corners[2],corners[3],'#d4b26e',1.4);
}
function stairRail(c:CanvasRenderingContext2D,top:FloorArtPoint,bottom:FloorArtPoint):void{
  const height=22;
  for(let t=0;t<=1.001;t+=.25){
    const foot:FloorArtPoint=[top[0]+(bottom[0]-top[0])*t,top[1]+(bottom[1]-top[1])*t],cap:FloorArtPoint=[foot[0],foot[1]-height];
    line(c,foot,cap,'#665339',4.2);line(c,[foot[0]-.6,foot[1]],[cap[0]-.6,cap[1]],'#73906a',2.5);
    c.beginPath();c.ellipse(foot[0],foot[1],3.5,1.25,0,0,Math.PI*2);c.fillStyle='#506b54';c.fill();
    c.beginPath();c.arc(cap[0],cap[1],2.1,0,Math.PI*2);c.fillStyle='#d5b77a';c.fill();
  }
  const a:FloorArtPoint=[top[0],top[1]-height],b:FloorArtPoint=[bottom[0],bottom[1]-height];
  line(c,a,b,'#67583c',4.8);line(c,[a[0]-.6,a[1]-.6],[b[0]-.6,b[1]-.6],'#8b9867',2.8);
  line(c,[a[0]-.7,a[1]-1.5],[b[0]-.7,b[1]-1.5],'#dbc48b',.8);
}

/** One broad painted flight; no repeated internal ladder rails. Feet endpoints
 * stay unchanged, and the ~90-UV width fits the shared 91-UV stair footprint. */
export function drawTruckStairway(c:CanvasRenderingContext2D,top:FloorArtPoint,bottom:FloorArtPoint):void{
  const across:FloorArtPoint=[41,41*.34/.91],length=Math.hypot(bottom[0]-top[0],bottom[1]-top[1]);
  if(length<.001)return;
  const edge=(t:number,side:1|-1,down=0):FloorArtPoint=>[
    top[0]+(bottom[0]-top[0])*t+across[0]*side,
    top[1]+(bottom[1]-top[1])*t+across[1]*side+down,
  ];
  c.save();
  polygon(c,[edge(0,-1,4),edge(0,1,4),edge(1,1,4),edge(1,-1,4)],'#66563b');
  stairRail(c,edge(0,-1),edge(1,-1));
  const steps=Math.max(4,Math.ceil(length/16));
  for(let index=0;index<steps;index++){
    const start=index/steps,end=(index+1)/steps;
    const tread:[FloorArtPoint,FloorArtPoint,FloorArtPoint,FloorArtPoint]=[edge(start,-1),edge(start,1),edge(end,1),edge(end,-1)];
    polygon(c,[edge(end,-1),edge(end,1),edge(end,1,3.2),edge(end,-1,3.2)],'#8b6e46','#6e543a',.6);
    polygon(c,tread,'#c8a269');paintWorldQuad(c,'wood',tread,index%2?.055:.015);
    line(c,tread[2],tread[3],'#6c5339',1);line(c,[tread[2][0],tread[2][1]-.7],[tread[3][0],tread[3][1]-.7],'#edcb89',.65);
  }
  stairLanding(c,bottom);stairLanding(c,top);stairRail(c,edge(0,1),edge(1,1));c.restore();
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
  const gradient=c.createLinearGradient(0,-9,0,10);gradient.addColorStop(0,'#6f8b68');gradient.addColorStop(1,'#3f6554');
  c.fillStyle=gradient;c.strokeStyle='#d5b778';c.lineWidth=1.3;c.beginPath();c.roundRect(-48,-9,96,22,3);c.fill();c.stroke();
  for(const x of[-43,43]){c.beginPath();c.arc(x,2,1.3,0,Math.PI*2);c.fillStyle='#e0c28c';c.fill();}
  c.fillStyle='#fff1c9';c.textAlign='center';c.textBaseline='middle';c.font='700 10px "Noto Sans KR Variable", sans-serif';
  c.fillText(`${floor.id}층 생활 데크`,0,2);c.restore();
}

/** Draw one readable active map, with the other physical floors shown as rims. */
export function drawTruckFloor(c:CanvasRenderingContext2D,o:TruckFloorArtOptions):TruckFloorArtGeometry{
  const floor=o.floors.find(f=>f.id===o.selectedFloor)??o.floors[0]??{id:1 as const,z:94};
  const geometry:TruckFloorArtGeometry={floor:floor.id,z:floor.z,surface:quad(o,floor.z,1),
    otherFloors:o.floors.filter(f=>f.id!==floor.id).map(f=>({floor:f.id,z:f.z,rim:quad(o,f.z)})),stairways:o.stairways??[]};
  const b=o.bounds,p=o.project;c.save();
  if(o.pass==='structure'){
    if(o.floors.length>1){
      const low=Math.min(...o.floors.map(f=>f.z))-13,high=Math.max(...o.floors.map(f=>f.z))+4;
      c.save();c.globalAlpha*=.68;
      for(const[u,v]of[[b.left+8,b.back+8],[b.end-8,b.back+8],[b.left+8,b.front-8],[b.end-8,b.front-8]])post(c,o,u,v,low,high);
      for(const f of o.floors.slice(1)){
        brace(c,p(b.left+8,b.front-8,f.z-24),p(b.left+82,b.front-8,f.z-134));
        brace(c,p(b.end-8,b.front-8,f.z-24),p(b.end-82,b.front-8,f.z-134));
      }c.restore();
      for(const other of geometry.otherFloors){
        const above=other.z>floor.z;c.save();c.globalAlpha *= above ? .16 : .3;
        polygon(c,other.rim,'','#729074',1.4);fascia(c,o,other.z);c.restore();
      }
    }
    for(const stairs of o.stairways??[]){
      if(stairs.from===floor.id)continue;
      c.save();c.globalAlpha *= (stairs.from===floor.id||stairs.to===floor.id) ? .95 : .3;
      wideStairs(c,stairs);c.restore();
    }
  }else if(o.pass==='surface'){
    fascia(c,o,floor.z);const surface=quad(o,floor.z,1);
    polygon(c,surface,'#d8ad6e');paintWorldQuad(c,'wood',surface,-.025);polygon(c,surface,'','#73543a',1.4);
    for(let v=b.back+24;v<b.front;v+=24){
      line(c,p(b.left+1,v,floor.z),p(b.end-1,v,floor.z),'#79533559',.9);
      line(c,p(b.left+1,v+1,floor.z),p(b.end-1,v+1,floor.z),'#ffdfaa54',.7);
    }
    if(o.night){c.save();c.globalAlpha*=clamp(o.night)*.1;polygon(c,surface,'#263e45');c.restore();}
  }else if(o.pass==='back'){
    for(const stairs of o.stairways??[])if(stairs.to===floor.id)stairWell(c,o,floor,stairs);
    for(const stairs of o.stairways??[])if(stairs.from===floor.id)wideStairs(c,stairs);
    rail(c,o,'back',floor.z,false);rail(c,o,'left',floor.z,false);
  }else{
    rail(c,o,'front',floor.z,true);rail(c,o,'right',floor.z,true);floorPlate(c,o,floor);
  }
  c.restore();return geometry;
}
