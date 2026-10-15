import type { GameState } from './game';
import { getFarmCapacity } from './game';
import { getSettlement, type BuildingType } from './settlement';
import { getFacilityPlacement } from './deck-placement';
import { FARM_POSITIONS, getFloorBounds, projectTruckPoint, FLOOR_HEIGHT, type TruckFloor } from './truck-layout';

export type VillageBounds = { left:number; top:number; right:number; bottom:number };
export const VILLAGE_FACILITY_SIZE: Record<BuildingType, [number,number]> = {
  workshop:[126,119], kitchen:[120,112], waterworks:[116,118], greenhouse:[126,105], watchtower:[111,146], petHouse:[106,90],
};
export function mergeVillageBounds(bounds:readonly VillageBounds[]):VillageBounds {
  return { left:Math.min(...bounds.map(b=>b.left)), top:Math.min(...bounds.map(b=>b.top)),
    right:Math.max(...bounds.map(b=>b.right)), bottom:Math.max(...bounds.map(b=>b.bottom)) };
}
/** Camera-only bounds: these never become building or actor collision shapes. */
export function getVillageContentBounds(state:GameState,floor:TruckFloor):VillageBounds {
  const bounds:VillageBounds[]=[];
  for(const building of getSettlement(state).buildings.filter(b=>getFacilityPlacement(state,b).floor===floor)){
    const placement=getFacilityPlacement(state,building),[x,y]=projectTruckPoint([placement.x,placement.y],floor),[w,h]=VILLAGE_FACILITY_SIZE[building.type];
    // Production bubbles and the finished roof are part of the visible village.
    bounds.push({left:x-w/2-8,top:y-h-44,right:x+w/2+8,bottom:y+25});
  }
  if(floor===1){
    const count=Math.min(state.plots.length+1,getFarmCapacity(state),FARM_POSITIONS.length);
    for(const[u,v]of FARM_POSITIONS.slice(0,count)){
      const[x,y]=projectTruckPoint([u+35,v+36],1,17);
      bounds.push({left:x-60,top:y-63,right:x+60,bottom:y+38});
    }
  }
  // New storeys show the editable deck instead of an obsolete numbered slot.
  if(!bounds.length){
    const deck=getFloorBounds(state.deckLevel,floor),corners=[[deck.left,deck.back],[deck.end,deck.back],[deck.end,deck.front],[deck.left,deck.front]].map(point=>projectTruckPoint(point,floor));
    bounds.push({left:Math.min(...corners.map(point=>point[0]))-18,top:Math.min(...corners.map(point=>point[1]))-64,
      right:Math.max(...corners.map(point=>point[0]))+18,bottom:Math.max(...corners.map(point=>point[1]))+18});
  }
  return bounds.length?mergeVillageBounds(bounds):{left:260,top:120-(floor-1)*FLOOR_HEIGHT,right:700,bottom:460-(floor-1)*FLOOR_HEIGHT};
}
/** Fit roofs, production controls and beds inside the actual unobscured map. */
export function fitVillageCamera(bounds:VillageBounds,availableWidth:number,availableHeight:number){
  const width=Math.max(100,availableWidth),height=Math.max(70,availableHeight),padding=28;
  const maxScale=width>height*1.4?1.15:.92;
  // Product bubbles remain finger-sized as the deck zooms out. Reserve their
  // actual screen pixels before fitting roofs, instead of padding only in world
  // units, which becomes too small on an expanded truck in portrait.
  const side=24,top=20,bottom=0;
  const scale=Math.min(maxScale,(width-side*2)/Math.max(bounds.right-bounds.left+padding*2,480),
    (height-top-bottom)/Math.max(bounds.bottom-bounds.top+padding*2,300));
  return { x:(bounds.left+bounds.right)/2,y:(bounds.top+bounds.bottom)/2-(top-bottom)/(2*scale),
    width:width/scale,height:height/scale,zoom:1 };
}
