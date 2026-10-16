import { drawWorldSprite, paintWorldQuad } from './world-art';
import { getTruckBodyWheelPositions, TRUCK_BODY_METRICS, type TruckBodyPoint, type TruckBodyBounds } from './truck-body-geometry';

export type { TruckBodyPoint, TruckBodyBounds } from './truck-body-geometry';
export interface TruckBodyArtOptions {
  project:(u:number,v:number,z:number)=>TruckBodyPoint;
  bounds:TruckBodyBounds;
  pass:'shadow'|'body';
  deckZ?:number;
}
type Quad=[TruckBodyPoint,TruckBodyPoint,TruckBodyPoint,TruckBodyPoint];

function polygon(c:CanvasRenderingContext2D,points:readonly TruckBodyPoint[],fill:string|CanvasGradient,stroke='',width=1):void{
  c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();
  if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}
}
function line(c:CanvasRenderingContext2D,a:TruckBodyPoint,b:TruckBodyPoint,color:string,width=1):void{
  c.beginPath();c.moveTo(...a);c.lineTo(...b);c.strokeStyle=color;c.lineWidth=width;c.stroke();
}
function bolt(c:CanvasRenderingContext2D,p:TruckBodyPoint,r=1.15):void{
  c.beginPath();c.ellipse(p[0],p[1],r,r*.8,0,0,Math.PI*2);c.fillStyle='#c4a161';c.fill();
  c.beginPath();c.arc(p[0]-.2,p[1]-.3,r*.38,0,Math.PI*2);c.fillStyle='#e3ca8c';c.fill();
}
function trailingIvy(c:CanvasRenderingContext2D,at:TruckBodyPoint,length:number,lean:number):void{
  const [x,y]=at;
  c.beginPath();c.moveTo(x,y);c.bezierCurveTo(x+lean*9,y+length*.24,x-lean*4,y+length*.6,x+lean*6,y+length);
  c.strokeStyle='#4b633c';c.lineWidth=1.4;c.stroke();
  for(let i=0;i<7;i++){
    const t=(i+.6)/7,side=i%2?-1:1,lx=x+Math.sin(t*5)*lean*3.5,ly=y+t*length,
      tip:TruckBodyPoint=[lx+side*(5.8-t*1.7),ly-3.6];
    c.beginPath();c.moveTo(lx,ly);c.bezierCurveTo(lx+side*5,ly+1.8,tip[0]+side*2,tip[1]+2,...tip);
    c.bezierCurveTo(tip[0]-side*1.4,tip[1]-1.6,lx+side*.5,ly-4,lx,ly);c.closePath();
    c.fillStyle=i%3===0?'#a7b66a':i%3===1?'#80964e':'#637f43';c.fill();
    line(c,[lx,ly],[tip[0]-.3,tip[1]+.6],'#d2cf8466',.45);
  }
}

/** The deck is carried by an articulated olive chassis with open wheel arches.
 * Every surface follows the shared UV projection; nothing changes navigation. */
export function drawTruckBody(c:CanvasRenderingContext2D,o:TruckBodyArtOptions):void{
  const b=o.bounds,p=o.project,m=TRUCK_BODY_METRICS,deck=o.deckZ??m.deckZ,top=deck-m.topInset,bottom=m.bottomZ,
    wheels=getTruckBodyWheelPositions(b),near=b.front+m.nearOffset;
  c.save();c.lineJoin='round';c.lineCap='round';
  if(o.pass==='shadow'){
    const shadow:Quad=[p(b.left-12,b.back+5,-28),p(b.end+128,b.back+5,-28),p(b.end+144,b.front+37,-28),p(b.left-12,b.front+37,-28)];
    c.shadowColor='rgba(40,47,28,.18)';c.shadowBlur=16;c.shadowOffsetY=7;
    polygon(c,shadow,'rgba(40,47,28,.15)');c.shadowBlur=0;
    polygon(c,[p(b.left+12,b.back+22,-25),p(b.end+100,b.back+22,-25),p(b.end+110,b.front+14,-25),p(b.left+12,b.front+14,-25)],'rgba(32,42,26,.11)');
    c.restore();return;
  }

  // Open undercarriage: a narrow frame, cross members and actual axle hubs.
  polygon(c,[p(b.left+m.frameLeftInset,b.front-m.frameBackInset,m.frameTopZ),p(b.end+m.frameEndExtension,b.front-m.frameBackInset,m.frameTopZ),p(b.end+m.frameEndExtension,b.front-m.frameBackInset,m.frameBottomZ),p(b.left+m.frameLeftInset,b.front-m.frameBackInset,m.frameBottomZ)],'#354237','#26352b',1);
  line(c,p(b.left+m.frameLeftInset+4,b.front-m.frameBackInset+1,m.frameTopZ+1),p(b.end+m.frameEndExtension-2,b.front-m.frameBackInset+1,m.frameTopZ+1),'#8b8b60',1.6);
  for(const u of wheels){
    line(c,p(u,b.front-36,8),p(u,b.front+9,8),'#3c4537',7);
    const foot=p(u,near,m.wheelBottomZ);
    c.save();c.globalAlpha=.16;c.beginPath();c.ellipse(foot[0]+3,foot[1]+1,29,7,.27,0,Math.PI*2);c.fillStyle='#1d2a20';c.fill();c.restore();
    drawWorldSprite(c,'wheel',foot[0],foot[1],m.wheelWidth,m.wheelHeight);
  }

  // The cab-end frame is darker than the sunlit long side.
  const end:Quad=[p(b.end,b.back+3,top),p(b.end,b.front+3,top),p(b.end,b.front+3,bottom),p(b.end,b.back+3,bottom)];
  polygon(c,end,'#506348','#354c3b',1);
  c.save();c.globalAlpha=.55;paintWorldQuad(c,'metal',end,.07);c.restore();
  for(let v=b.back+25;v<b.front-15;v+=94){
    line(c,p(b.end+.3,v,top-4),p(b.end+.3,v,bottom+4),'#31473388',1);
    line(c,p(b.end+.4,v+2,top-4),p(b.end+.4,v+2,bottom+4),'#b2b48b80',.7);
    bolt(c,p(b.end+1,v+8,top-8),.95);
  }

  // One continuous panel silhouette, cut around the wheels. The wheel painting
  // extends a few pixels behind its arch, so tire tops sit inside the chassis.
  const side:Quad=[p(b.left,near,top),p(b.end,near,top),p(b.end,near,bottom),p(b.left,near,bottom)];
  const archHalf=m.archHalf,archHeight=m.archTopZ;
  const traceSide=()=>{
    c.beginPath();c.moveTo(...p(b.left,near,top));c.lineTo(...p(b.end,near,top));c.lineTo(...p(b.end,near,bottom));
    for(const u of [...wheels].reverse()){
      c.lineTo(...p(u+archHalf,near,bottom));
      const control=p(u+archHalf*.87,near,archHeight),peak=p(u,near,archHeight);
      c.quadraticCurveTo(...control,...peak);
      const other=p(u-archHalf*.87,near,archHeight),exit=p(u-archHalf,near,bottom);
      c.quadraticCurveTo(...other,...exit);
    }
    c.lineTo(...p(b.left,near,bottom));c.closePath();
  };
  c.save();traceSide();c.clip();
  const a=p(b.left,near,top),d=p(b.left,near,bottom),finish=c.createLinearGradient(a[0],a[1],d[0],d[1]);
  finish.addColorStop(0,'#74835b');finish.addColorStop(.22,'#61754f');finish.addColorStop(1,'#455b43');
  polygon(c,side,finish);
  c.save();c.globalAlpha=.59;paintWorldQuad(c,'metal',side,.025);c.restore();
  // Sparse access doors and slender vertical frame straps remain legible at
  // gameplay scale, without turning the whole truck into a gold-edged box.
  const panelCount=Math.max(4,Math.round((b.end-b.left)/118));
  for(let i=0;i<panelCount;i++){
    const from=b.left+(b.end-b.left)*i/panelCount+9,to=b.left+(b.end-b.left)*(i+1)/panelCount-9;
    const panel:Quad=[p(from,near+1,top-10),p(to,near+1,top-10),p(to,near+1,bottom+10),p(from,near+1,bottom+10)];
    polygon(c,panel,'rgba(155,170,111,.055)','#344a3680',.75);
    line(c,p(from+2,near+1,top-12),p(to-2,near+1,top-12),'#b1b4875c',.85);
    const mid=(from+to)/2;
    line(c,p(mid-6,near+2,top-22),p(mid+6,near+2,top-22),'#d1b578',2.1);
    for(const u of[from+3,to-3])for(const z of[top-15,bottom+16])bolt(c,p(u,near+2,z),.82);
    const strap=to+7;
    polygon(c,[p(strap-2,near+2,top-1),p(strap+3,near+2,top-1),p(strap+3,near+2,bottom-1),p(strap-2,near+2,bottom-1)],'#465c43');
    line(c,p(strap-1,near+3,top-2),p(strap-1,near+3,bottom),'#a6ae7770',.85);
    bolt(c,p(strap,near+3,top-7),1.1);
  }
  c.restore();traceSide();c.strokeStyle='#354a37';c.lineWidth=1.1;c.stroke();
  line(c,p(b.left,near,top),p(b.end,near,top),'#b6ba88',1.5);
  line(c,p(b.left,near,top-3),p(b.end,near,top-3),'#455e3c',1.5);
  for(const u of wheels){
    c.beginPath();c.moveTo(...p(u+archHalf+1,near+1,bottom));
    c.quadraticCurveTo(...p(u+archHalf*.88,near+1,archHeight+3),...p(u,near+1,archHeight+3));
    c.quadraticCurveTo(...p(u-archHalf*.88,near+1,archHeight+3),...p(u-archHalf-1,near+1,bottom));
    c.strokeStyle='#8b9570';c.lineWidth=2.6;c.stroke();
  }
  // Brass belongs to a few hinges and tail lamps, rather than every outline.
  for(const u of[b.left+6,b.end-6]){
    const q=p(u,near+4,top-8);polygon(c,[[q[0]-3,q[1]-4],[q[0]+3,q[1]-2],[q[0]+3,q[1]+4],[q[0]-3,q[1]+2]],'#bd9c5f','#6c7149',.6);
  }
  const lamp=p(b.left+8,near+4,bottom+12);
  c.fillStyle='#c26e41';c.beginPath();c.ellipse(lamp[0],lamp[1],2.6,3.1,.2,0,Math.PI*2);c.fill();
  trailingIvy(c,p(b.left+26,near+5,top+4),42,-1);
  trailingIvy(c,p(b.end-43,near+5,top+4),48,1);
  c.restore();
}
