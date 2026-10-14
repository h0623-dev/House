import { getTruckGroundFootprint } from './truck-ground';

/** Original roadside places share one identity between map hits, work and rewards. */
export type OutdoorSiteId='grove'|'salvage'|'seed-meadow'|'spring';
type Point=[number,number];
export interface OutdoorSite {
  id:OutdoorSiteId;name:string;resource:'wood'|'scrap'|'seeds'|'water';kind:'chop'|'gather';
  point:Point;approaches:Point[];bounds:{left:number;top:number;right:number;bottom:number};
}
export const OUTDOOR_SITES:readonly OutdoorSite[]=[
  {id:'grove',name:'작은 벌목장',resource:'wood',kind:'chop',point:[97,601],
    approaches:[[142,590],[174,590],[142,659],[97,668],[174,644]],bounds:{left:63,top:576,right:127,bottom:624}},
  {id:'salvage',name:'고철 수거장',resource:'scrap',kind:'gather',point:[760,700],
    approaches:[[820,700],[760,760],[700,700],[760,640]],bounds:{left:741,top:684,right:779,bottom:714}},
  {id:'seed-meadow',name:'씨앗 풀밭',resource:'seeds',kind:'gather',point:[415,750],
    approaches:[[475,750],[415,810],[355,750],[415,690]],bounds:{left:396,top:734,right:434,bottom:764}},
  {id:'spring',name:'도로 샘터',resource:'water',kind:'gather',point:[950,600],
    approaches:[[1010,600],[950,660],[890,600],[950,540]],bounds:{left:931,top:584,right:969,bottom:614}},
];
export interface OutdoorTree {id:'grove-main'|'grove-west'|'grove-south'|'roadside-right'|'roadside-left';point:Point;bounds:OutdoorSite['bounds'];scale:number;grove:boolean}
const OUTDOOR_TREES:readonly OutdoorTree[]=[
  {id:'grove-main',point:[97,601],bounds:{left:63,top:576,right:127,bottom:624},scale:131/111,grove:true},
  {id:'grove-west',point:[34,574],bounds:{left:12,top:559,right:55,bottom:583},scale:.87,grove:true},
  {id:'grove-south',point:[29,619],bounds:{left:13,top:607,right:45,bottom:628},scale:.57,grove:true},
  {id:'roadside-right',point:[1054,733],bounds:{left:1033,top:718,right:1077,bottom:746},scale:1.29,grove:false},
  {id:'roadside-left',point:[-58,739],bounds:{left:-76,top:727,right:-40,bottom:750},scale:1.03,grove:false},
];
// Include the entire largest animal and a small rounding margin when sites move.
const EXTERIOR_CLEARANCE=30.8+2;
const corners=(bounds:OutdoorSite['bounds']):Point[]=>[[bounds.left,bounds.top],[bounds.right,bounds.top],
  [bounds.right,bounds.bottom],[bounds.left,bounds.bottom]];
const translateBounds=(bounds:OutdoorSite['bounds'],dy:number)=>({...bounds,top:bounds.top+dy,bottom:bounds.bottom+dy});
function pointSegmentDistance(point:Point,a:Point,b:Point):number {
  const dx=b[0]-a[0],dy=b[1]-a[1],length=dx*dx+dy*dy,
    t=length?Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dy)/length)):0;
  return Math.hypot(point[0]-a[0]-t*dx,point[1]-a[1]-t*dy);
}
function segmentDistance(a:Point,b:Point,c:Point,d:Point):number {
  const rx=b[0]-a[0],ry=b[1]-a[1],sx=d[0]-c[0],sy=d[1]-c[1],det=rx*sy-ry*sx;
  if(Math.abs(det)>1e-9){const cx=c[0]-a[0],cy=c[1]-a[1],t=(cx*sy-cy*sx)/det,u=(cx*ry-cy*rx)/det;
    if(t>=0&&t<=1&&u>=0&&u<=1)return 0;}
  return Math.min(pointSegmentDistance(a,c,d),pointSegmentDistance(b,c,d),pointSegmentDistance(c,a,b),pointSegmentDistance(d,a,b));
}
function frontTranslation(polygon:Point[],footprints:OutdoorSite['bounds'][],approaches:Point[]):number {
  const points=[...footprints.flatMap(corners),...approaches],
    edges=polygon.map((a,index)=>({a,b:polygon[(index+1)%polygon.length]})),
    outside=(point:Point)=>edges.some(({a,b})=>(b[0]-a[0])*(point[1]-a[1])-(b[1]-a[1])*(point[0]-a[0])<0)
      &&edges.every(({a,b})=>pointSegmentDistance(point,a,b)>=EXTERIOR_CLEARANCE);
  // A valid old shoulder may wrap around a cab corner. Keep it in place even
  // when no single supporting face contains every approach at once.
  if(points.every(outside)&&footprints.every(bounds=>{
    const rect=corners(bounds);
    return rect.every((a,index)=>edges.every(({a:c,b:d})=>segmentDistance(a,rect[(index+1)%rect.length],c,d)>=EXTERIOR_CLEARANCE));
  }))return 0;
  const frontFaces=edges.flatMap(({a,b})=>{
    const length=Math.hypot(b[0]-a[0],b[1]-a[1]),nx=(b[1]-a[1])/length,ny=(a[0]-b[0])/length;
    return ny>1e-7?[{a,nx,ny}]:[];
  });
  return Math.max(0,Math.min(...frontFaces.map(({a,nx,ny})=>Math.max(...points.map(point=>
    (EXTERIOR_CLEARANCE-nx*(point[0]-a[0])-ny*(point[1]-a[1]))/ny)))));
}
function shoulderTrees(polygon:Point[]):OutdoorTree[] {
  return OUTDOOR_TREES.filter(tree=>!tree.grove).map<OutdoorTree>(tree=>{
    const dy=frontTranslation(polygon,[tree.bounds],[]);
    return {...tree,point:[tree.point[0],tree.point[1]+dy],bounds:translateBounds(tree.bounds,dy)};
  });
}

/** Keep the four places along the truck's front shoulder as its chassis grows.
 * A supporting front face separates every complete footprint and approach from
 * the actual isometric body, without reserving its empty screen-box corners. */
export function getOutdoorSites(level=1):readonly OutdoorSite[] {
  const polygon=getTruckGroundFootprint(level).polygon,trees=shoulderTrees(polygon);
  return OUTDOOR_SITES.map<OutdoorSite>(site=>{
    // The old first grove approach clips a large animal against its own trunk.
    // All other original approaches, and all valid level-one props, stay put.
    const approaches:Point[]=site.approaches.map((point,index)=>site.id==='grove'&&index===0?[160,590]:[...point]);
    const footprints=[site.bounds,...(site.id==='grove'?OUTDOOR_TREES.filter(tree=>tree.grove).map(tree=>tree.bounds):[])];
    let dy=frontTranslation(polygon,footprints,approaches);
    // An expanding spring shoulder passes the existing right-hand tree. Move
    // below its trunk only when a complete approach or prop would meet it.
    for(const tree of trees){
      for(const [x,y]of approaches){
        const gap=Math.max(tree.bounds.left-x,x-tree.bounds.right,0);
        if(gap<EXTERIOR_CLEARANCE&&y+dy>=tree.bounds.top-EXTERIOR_CLEARANCE&&y+dy<=tree.bounds.bottom+EXTERIOR_CLEARANCE)
          dy=Math.max(dy,tree.bounds.bottom+Math.sqrt(EXTERIOR_CLEARANCE**2-gap**2)-y);
      }
      for(const bounds of footprints){
        const gap=Math.max(tree.bounds.left-bounds.right,bounds.left-tree.bounds.right,0);
        if(gap<EXTERIOR_CLEARANCE&&bounds.bottom+dy>=tree.bounds.top-EXTERIOR_CLEARANCE&&bounds.top+dy<=tree.bounds.bottom+EXTERIOR_CLEARANCE)
          dy=Math.max(dy,tree.bounds.bottom+Math.sqrt(EXTERIOR_CLEARANCE**2-gap**2)-bounds.top);
      }
    }
    return {...site,point:[site.point[0],site.point[1]+dy],approaches:approaches.map(([x,y])=>[x,y+dy]),
      bounds:translateBounds(site.bounds,dy)};
  });
}
export function getOutdoorSite(id:unknown,level=1):OutdoorSite|undefined{return getOutdoorSites(level).find(site=>site.id===id);}
/** Grove art and all three physical trunks share the site's one translation. */
export function getOutdoorTrees(level=1):readonly OutdoorTree[] {
  const polygon=getTruckGroundFootprint(level).polygon,trees=shoulderTrees(polygon),
    grove=getOutdoorSite('grove',level)!,dy=grove.point[1]-OUTDOOR_SITES[0].point[1];
  return OUTDOOR_TREES.map<OutdoorTree>(tree=>tree.grove?{...tree,point:[tree.point[0],tree.point[1]+dy],
    bounds:translateBounds(tree.bounds,dy)}:trees.find(positioned=>positioned.id===tree.id)!);
}
export function getOutdoorSiteIndex(id:OutdoorSiteId):number{return OUTDOOR_SITES.findIndex(site=>site.id===id);}
