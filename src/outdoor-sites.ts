import { GROUND_RESOURCE_NODES, getGroundResourceZone, type GroundResourceId } from './ground-resources';

/** Legacy region identities remain useful for rewards, quests and area focus. */
export type OutdoorSiteId='grove'|'salvage'|'seed-meadow'|'spring';
type Point=[number,number];
export interface OutdoorSite {
  id:OutdoorSiteId;name:string;resource:'wood'|'scrap'|'seeds'|'water';kind:'chop'|'gather';
  point:Point;approaches:Point[];bounds:{left:number;top:number;right:number;bottom:number};
}
const SITE_IDS:readonly OutdoorSiteId[]=['grove','salvage','seed-meadow','spring'];
/** The old four-site API represents the first individual node of each area.
 * Coordinates are authored on the ground and do not follow truck growth. */
export const OUTDOOR_SITES:readonly OutdoorSite[]=SITE_IDS.map(id=>{
  const node=GROUND_RESOURCE_NODES.find(node=>node.legacySiteId===id)!;
  return {id,name:getGroundResourceZone(id)!.name,resource:node.resource,kind:node.action,
    point:[...node.point],approaches:node.approaches.map(point=>[...point]),bounds:{...node.bounds}};
});
const copySite=(site:OutdoorSite):OutdoorSite=>({...site,point:[...site.point],
  approaches:site.approaches.map(point=>[...point]),bounds:{...site.bounds}});
export function getOutdoorSites(_level=1):readonly OutdoorSite[] {return OUTDOOR_SITES.map(copySite);}
export function getOutdoorSite(id:unknown,level=1):OutdoorSite|undefined {return getOutdoorSites(level).find(site=>site.id===id);}
export function getOutdoorSiteIndex(id:OutdoorSiteId):number {return SITE_IDS.indexOf(id);}

export interface OutdoorTree {id:GroundResourceId;point:Point;bounds:OutdoorSite['bounds'];scale:number;grove:boolean}
/** Every painted tree is one independently felled resource with a real trunk. */
export function getOutdoorTrees(_level=1):readonly OutdoorTree[] {
  return GROUND_RESOURCE_NODES.filter(node=>node.kind==='tree').map(node=>({id:node.id,point:[...node.point],
    bounds:{...node.bounds},scale:node.scale,grove:true}));
}
