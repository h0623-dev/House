/** Pure shared dimensions for the painted chassis and its road collision hull.
 * This file imports no canvas code or browser images: navigation can use it too. */
export type TruckBodyPoint = [number,number];
export interface TruckBodyBounds { left:number;end:number;back:number;front:number }
export type TruckBodyProject=(u:number,v:number,z:number)=>TruckBodyPoint;
export const TRUCK_BODY_METRICS={
  deckZ:94,topInset:14,bottomZ:7,nearOffset:3,
  wheelWidth:68,wheelHeight:84,wheelBottomZ:-29,
  archHalf:39,archTopZ:53,
  frameLeftInset:9,frameEndExtension:14,frameBackInset:17,
  frameTopZ:21,frameBottomZ:6,
} as const;

/** Two distinct axle groups; only the longest expanded chassis has six axles. */
export function getTruckBodyWheelPositions(b:TruckBodyBounds):number[]{
  const length=b.end-b.left,step=Math.min(92,Math.max(76,length*.15));
  if(length>880)return[b.left+77,b.left+77+step,b.left+77+step*2,b.end-77-step*2,b.end-77-step,b.end-77];
  return[b.left+74,b.left+74+step,b.end-74-step,b.end-74];
}

// Opaque outline measured from haven-truck-miniature.png's 449×507 wheel crop.
// Pixel coordinates deliberately exclude the surrounding transparent atlas pad.
const WHEEL_OUTLINE:readonly TruckBodyPoint[]=[
  [180,10],[226,10],[300,30],[346,60],[381,100],[415,160],[436,230],[439,300],
  [423,370],[384,430],[327,470],[277,490],[252,495],[195,495],[172,490],
  [138,470],[91,430],[51,370],[20,300],[6,230],[16,160],[38,100],[76,60],[126,30],
];

/** Visible solid vertices. The surrounding cast shadow remains walkable.
 * The caller can combine these with the deck/cab and take a convex hull. */
export function getTruckBodyFootprintVertices(b:TruckBodyBounds,p:TruckBodyProject,deckZ:number=TRUCK_BODY_METRICS.deckZ):TruckBodyPoint[]{
  const m=TRUCK_BODY_METRICS,points:TruckBodyPoint[]=[],near=b.front+m.nearOffset;
  const box=(left:number,end:number,back:number,front:number,bottom:number,top:number)=>{
    for(const z of[bottom,top])for(const[u,v]of[[left,back],[end,back],[end,front],[left,front]])points.push(p(u,v,z));
  };
  box(b.left,b.end,b.back+3,near,m.bottomZ,deckZ-m.topInset);
  box(b.left+m.frameLeftInset,b.end+m.frameEndExtension,b.front-m.frameBackInset,b.front+9,m.frameBottomZ,m.frameTopZ);
  for(const u of getTruckBodyWheelPositions(b)){
    const anchor=p(u,near,m.wheelBottomZ);
    for(const[x,y]of WHEEL_OUTLINE){
      const dx=(x/449-.5)*m.wheelWidth,dy=(y/507-1)*m.wheelHeight;
      // One world pixel of outward padding admits no visible tire penetration.
      points.push([anchor[0]+dx+(dx<0?-1:1),anchor[1]+dy+(dy<-m.wheelHeight/2?-1:1)]);
    }
  }
  return points;
}
