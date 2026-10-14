import { getFloorBounds, projectTruckPoint, type TruckPoint, type TruckRect } from './truck-layout';

/** Road feet stay outside the roof, chassis and actual painted cab contour. */
export function getTruckGroundFootprint(level: number): { polygon: TruckPoint[]; bounds: TruckRect } {
  const d=getFloorBounds(level),ground=[[d.left,d.back],[d.end,d.back],[d.end,d.front],[d.left,d.front]]
    .map(point=>{const p=projectTruckPoint(point);return[p[0],p[1]+95]as TruckPoint;}),
    roof:TruckPoint[]=[[ground[0][0],ground[0][1]-95],[ground[1][0],ground[1][1]-95],
      ground[1],ground[2],ground[3],[ground[3][0],ground[3][1]-95]],
    cab=projectTruckPoint([d.end+95,(d.back+d.front)/2]),
    // Measured opaque contour of the existing 617x559 cabin crop, scaled to
    // its real 230x208 paint and rounded outward by at most two world pixels.
    cabOffsets:TruckPoint[]=[[-114,-117],[-63,-173],[6,-207],[92,-162],[112,-59],[94,-31],[4,1],[-49,1],[-63,-8],[-114,-95]],
    // These are the actual two rendered chassis boxes. The lower side extends
    // 46 UV beyond the deck end, and its bottom lies six pixels below ground.
    lower=boxCorners(d.left+12,d.end+46,d.back+10,d.front-9,-6,57),
    upper=boxCorners(d.left+15,d.end-13,d.back+8,d.front,31,78),
    // Measured opaque wheel contour, expanded outward by .75 screen pixels.
    // Transparent sprite margins and the truck's separate shadow stay walkable.
    wheelOffsets:TruckPoint[]=[[-27.8,-46.47],[-24.1,-58.64],[-11.26,-69.39],[9.53,-69.73],[25.92,-41.9],
      [24.18,-17.75],[18.19,-8.65],[.5,-.74],[-8.23,-1.98],[-21.65,-16.13]],wheels:TruckPoint[]=[];
  for(let u=d.left+62;u<d.end+30;u+=136){
    const anchor=projectTruckPoint([u,d.front+9]);
    wheels.push(...wheelOffsets.map(point=>[anchor[0]+1+point[0],anchor[1]+129+point[1]]as TruckPoint));
  }
  const polygon=convexHull([...roof,...lower,...upper,...wheels,...cabOffsets.map(point=>[cab[0]+4+point[0],cab[1]+168+point[1]]as TruckPoint)]);
  return {polygon,bounds:{left:Math.min(...polygon.map(point=>point[0])),top:Math.min(...polygon.map(point=>point[1])),
    right:Math.max(...polygon.map(point=>point[0])),bottom:Math.max(...polygon.map(point=>point[1]))}};
}

function boxCorners(left:number,right:number,back:number,front:number,bottom:number,top:number):TruckPoint[] {
  return [bottom,top].flatMap(height=>[[left,back],[right,back],[right,front],[left,front]].map(point=>{
    const p=projectTruckPoint(point);return[p[0],p[1]+95-height]as TruckPoint;
  }));
}

function convexHull(points:TruckPoint[]):TruckPoint[] {
  const sorted=[...points].sort((a,b)=>a[0]-b[0]||a[1]-b[1]),
    turn=(a:TruckPoint,b:TruckPoint,c:TruckPoint)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  const half=(vertices:TruckPoint[])=>{const hull:TruckPoint[]=[];
    for(const point of vertices){while(hull.length>1&&turn(hull[hull.length-2],hull[hull.length-1],point)<=0)hull.pop();hull.push(point);}return hull;};
  return [...half(sorted).slice(0,-1),...half(sorted.reverse()).slice(0,-1)];
}

/** Signed screen distance: positive outside the body, negative underneath it. */
export function getTruckGroundClearance(level:number,point:readonly number[]):number {
  return getConvexPolygonClearance(getTruckGroundFootprint(level).polygon,point);
}

/** The layout's convex footprints have clockwise screen-space vertex order. */
export function getConvexPolygonClearance(polygon:readonly TruckPoint[],point:readonly number[]):number {
  let inside=true,nearest=Infinity;
  polygon.forEach((a,index)=>{
    const b=polygon[(index+1)%polygon.length],dx=b[0]-a[0],dy=b[1]-a[1],length=dx*dx+dy*dy,
      amount=length?Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dy)/length)):0;
    if(dx*(point[1]-a[1])-dy*(point[0]-a[0])<0)inside=false;
    nearest=Math.min(nearest,Math.hypot(point[0]-a[0]-dx*amount,point[1]-a[1]-dy*amount));
  });
  return inside?-nearest:nearest;
}
