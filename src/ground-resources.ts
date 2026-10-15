import { getConvexPolygonClearance, getTruckGroundFootprint } from './truck-ground';
import type { OutdoorSiteId } from './outdoor-sites';
import { GROUND_REGIONS, type GroundRegionId } from './ground-regions';

export type GroundPoint = [number, number];
export interface GroundBounds { left: number; top: number; right: number; bottom: number }
type TreeNumber = '01'|'02'|'03'|'04'|'05'|'06'|'07'|'08'|'09'|'10'|'11'|'12'|'13'|'14'|'15'|'16'|'17'|'18'|'19'|'20'|'21'|'22';
type PatchNumber = '01'|'02'|'03'|'04'|'05'|'06'|'07'|'08'|'09'|'10';
export type GroundResourceId = `tree-${TreeNumber}`|`scrap-${PatchNumber}`|`seed-${PatchNumber}`|`water-${PatchNumber}`;
export type GroundResourceKind = 'tree'|'scrap'|'seed'|'water';
export type GroundResource = 'wood'|'scrap'|'seeds'|'water';
export interface GroundResourceNode {
  readonly id: GroundResourceId;
  readonly name: string;
  readonly siteId: OutdoorSiteId;
  readonly zoneId: OutdoorSiteId;
  /** Physical place, independent of its legacy resource family/site. */
  readonly regionId: GroundRegionId;
  readonly kind: GroundResourceKind;
  readonly action: 'chop'|'gather';
  readonly resource: GroundResource;
  readonly point: GroundPoint;
  /** Only the physical trunk or ground prop is solid, never its high canopy. */
  readonly bounds: GroundBounds;
  readonly approaches: GroundPoint[];
  readonly scale: number;
  /** One stable node receives the old site's depletion when a save migrates. */
  readonly legacySiteId?: OutdoorSiteId;
}
export interface GroundResourceZone {
  readonly id: OutdoorSiteId;
  readonly name: string;
  /** Includes the painted tree crowns, full approaches and ground trail. */
  readonly bounds: GroundBounds;
  readonly path: GroundPoint[];
  readonly pathWidth: number;
}

/** Authored world coordinates stay fixed when the truck expands. The dense
 * crowns flank a genuine 132-pixel trail; each trunk remains an individual
 * physical resource rather than belonging to a decorative forest image.
 * Paths outside the forest describe clear walking corridors, not roads to
 * paint: the meadow, salvage clearing and stream have their own ground art. */
export const GROUND_RESOURCE_ZONES: readonly GroundResourceZone[] = [
  {id:'grove',name:'숲 벌목장',bounds:{left:-215,top:755,right:575,bottom:1425},
    path:[[145,845],[145,1045],[220,1180],[260,1350]],pathWidth:132},
  {id:'seed-meadow',name:'씨앗 풀밭',bounds:{left:455,top:855,right:900,bottom:1250},
    path:[[647,930],[652,1025],[675,1110],[676,1180]],pathWidth:100},
  {id:'salvage',name:'고철 수거장',bounds:{left:830,top:840,right:1285,bottom:1250},
    path:[[1040,920],[1025,1010],[1080,1160]],pathWidth:100},
  {id:'spring',name:'숲 샘터',bounds:{left:1200,top:830,right:1640,bottom:1260},
    path:[[1400,900],[1390,995],[1435,1135],[1450,1180]],pathWidth:100},
];
export const GROUND_RESOURCE_BOUNDS: GroundBounds = {
  left: Math.min(...GROUND_REGIONS.map(region=>region.bounds.left)),
  top: Math.min(...GROUND_REGIONS.map(region=>region.bounds.top)),
  right: Math.max(...GROUND_REGIONS.map(region=>region.bounds.right)),
  bottom: Math.max(...GROUND_REGIONS.map(region=>region.bounds.bottom)),
};
/** The largest existing animal keeps its complete body at every work stop. */
export const GROUND_RESOURCE_APPROACH_RADIUS = 30.8;
const APPROACH_MARGIN = GROUND_RESOURCE_APPROACH_RADIUS + 2;
const maximumTruck = getTruckGroundFootprint(8).polygon;
type NodeSpec = readonly [GroundResourceId, GroundPoint, number, GroundRegionId?];
const TREE_SPECS: readonly NodeSpec[] = [
  ['tree-01',[-15,930],1.17],['tree-02',[-100,950],1.08],
  ['tree-03',[35,1030],1.24],['tree-04',[-110,1045],.99],
  ['tree-05',[-55,1135],1.13],['tree-06',[80,1160],1.25],
  ['tree-07',[-115,1225],1.07],['tree-08',[40,1280],1.18],
  ['tree-09',[260,945],1.21],['tree-10',[365,975],1.09],
  ['tree-11',[435,1010],1.16],['tree-12',[275,1045],1.27],
  ['tree-13',[390,1100],1.02],['tree-14',[340,1200],1.20],
  ['tree-15',[465,1200],1.10],['tree-16',[375,1290],1.23],
];
const PATCH_SPECS: readonly NodeSpec[] = [
  ['seed-01',[568,965],1.04],['seed-02',[745,1000],1.12],
  ['seed-03',[600,1140],.98],['seed-04',[782,1115],1.07],
  ['scrap-01',[938,980],1.03],['scrap-02',[1125,942],1.12],
  ['scrap-03',[976,1138],.96],['scrap-04',[1178,1088],1.06],
  ['water-01',[1310,950],1.04],['water-02',[1510,975],.97],
  ['water-03',[1343,1115],1.09],['water-04',[1530,1150],1.13],
];
/** Append-only: old IDs, positions, indices and the four seed rotations stay
 * unchanged. New resources live west, north and east of the truck, rather
 * than extending the old row of southern gathering sites. */
const REGIONAL_SPECS: readonly NodeSpec[] = [
  ['tree-17',[-450,650],1.12,'west-grove'],['tree-18',[-370,685],1.04,'west-grove'],
  ['seed-05',[-455,830],1.02,'west-grove'],['seed-06',[-345,980],1.04,'west-grove'],
  ['scrap-05',[-450,1050],1.02,'west-grove'],['scrap-06',[-340,1150],1.03,'west-grove'],
  ['water-05',[-340,560],1.02,'west-grove'],['water-06',[-345,845],1.04,'west-grove'],
  ['tree-19',[110,-160],1.10,'north-ruins'],['tree-20',[195,-130],1.02,'north-ruins'],
  ['seed-07',[-40,-140],1,'north-ruins'],['seed-08',[340,-230],1.05,'north-ruins'],
  ['scrap-07',[60,65],1,'north-ruins'],['scrap-08',[485,-240],1.03,'north-ruins'],
  ['water-07',[-20,50],1.03,'north-ruins'],['water-08',[405,-125],1.04,'north-ruins'],
  ['tree-21',[1845,580],1.12,'east-creek'],['tree-22',[1920,615],1.04,'east-creek'],
  ['seed-09',[1840,790],1.02,'east-creek'],['seed-10',[1980,870],1.04,'east-creek'],
  ['scrap-09',[1840,1005],1.02,'east-creek'],['scrap-10',[1980,1095],1.03,'east-creek'],
  ['water-09',[1980,475],1.02,'east-creek'],['water-10',[1840,1210],1.04,'east-creek'],
];
const kindDetails: Record<GroundResourceKind,{siteId:OutdoorSiteId;resource:GroundResource;name:string;halfWidth:number;halfHeight:number}> = {
  tree:{siteId:'grove',resource:'wood',name:'숲 나무',halfWidth:18,halfHeight:12},
  scrap:{siteId:'salvage',resource:'scrap',name:'고철 더미',halfWidth:20,halfHeight:15},
  seed:{siteId:'seed-meadow',resource:'seeds',name:'씨앗 풀',halfWidth:18,halfHeight:13},
  water:{siteId:'spring',resource:'water',name:'샘물 웅덩이',halfWidth:21,halfHeight:15},
};
const distanceToBounds = ([x,y]:GroundPoint,bounds:GroundBounds) =>
  Math.hypot(Math.max(bounds.left-x,x-bounds.right,0),Math.max(bounds.top-y,y-bounds.bottom,0));
const groundNode = ([id,point,scale,regionId]:NodeSpec):GroundResourceNode => {
  const kind = id.split('-')[0] as GroundResourceKind,details=kindDetails[kind],
    width=details.halfWidth*scale,height=details.halfHeight*scale;
  return {id,name:`${details.name} ${Number(id.slice(-2))}`,kind,action:kind==='tree'?'chop':'gather',resource:details.resource,
    siteId:details.siteId,zoneId:details.siteId,regionId:regionId??details.siteId,point:[...point],scale,
    bounds:{left:point[0]-width,top:point[1]-height,right:point[0]+width,bottom:point[1]+height},
    approaches:[],...(id.endsWith('-01')?{legacySiteId:details.siteId}:{})};
};
export const LEGACY_GROUND_RESOURCE_IDS: readonly GroundResourceId[] = [...TREE_SPECS,...PATCH_SPECS].map(([id])=>id);
const nodes = [...TREE_SPECS,...PATCH_SPECS,...REGIONAL_SPECS].map(groundNode);
/** Eight surrounding candidates let people approach the nearest clear side.
 * Authoring filters reserve the full animal circle around every living trunk
 * and prop, including the selected one, plus the maximum truck silhouette. */
export const GROUND_RESOURCE_NODES: readonly GroundResourceNode[] = nodes.map(node=>{
  const stopDistance=node.kind==='tree'?66:68,
    candidates=Array.from({length:8},(_,index)=>{
      const angle=index*Math.PI/4;
      return [node.point[0]+Math.cos(angle)*stopDistance,node.point[1]+Math.sin(angle)*stopDistance] as GroundPoint;
    }),approaches=candidates.filter(point=>getConvexPolygonClearance(maximumTruck,point)>=APPROACH_MARGIN
      &&nodes.every(other=>distanceToBounds(point,other.bounds)>=APPROACH_MARGIN));
  return {...node,approaches};
});

export function getGroundResourceNode(id:unknown):GroundResourceNode|undefined {
  return GROUND_RESOURCE_NODES.find(node=>node.id===id);
}
export function getGroundResourceZone(id:unknown):GroundResourceZone|undefined {
  return GROUND_RESOURCE_ZONES.find(zone=>zone.id===id);
}
