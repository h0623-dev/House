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
export function getOutdoorSite(id:unknown):OutdoorSite|undefined{return OUTDOOR_SITES.find(site=>site.id===id);}
export function getOutdoorSiteIndex(id:OutdoorSiteId):number{return OUTDOOR_SITES.findIndex(site=>site.id===id);}
