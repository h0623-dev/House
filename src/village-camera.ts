import type { GameState } from './game';
import { getFarmCapacity } from './game';
import { getSettlement, isFacilitySlotAvailable, type BuildingType } from './settlement';
import { FARM_POSITIONS, SETTLEMENT_POSITIONS, getFloorSlots, getHomeLocation, getHousePosition,
  getSlotFloor, getSlotLocalIndex, projectTruckPoint, FLOOR_HEIGHT, type TruckFloor } from './truck-layout';

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
  const bounds:VillageBounds[]=[],home=getHomeLocation(state);
  if(home.floor===floor){
    const[x,y]=projectTruckPoint(getHousePosition(home),floor,-1);
    bounds.push({left:x-66,top:y-151,right:x+66,bottom:y+15});
  }
  for(const building of getSettlement(state).buildings.filter(b=>getSlotFloor(b.slot)===floor)){
    const[x,y]=projectTruckPoint(SETTLEMENT_POSITIONS[getSlotLocalIndex(building.slot)],floor),[w,h]=VILLAGE_FACILITY_SIZE[building.type];
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
  const slots=getFloorSlots(state,floor),firstFree=slots.find(slot=>isFacilitySlotAvailable(state,slot));
  const anchors=firstFree===undefined?[]:[firstFree];
  // An empty new storey starts at its available construction area, rather than a
  // distant cab on another floor. The catalogue can still show every open slot.
  if(!bounds.length)anchors.push(...slots.slice(0,2));
  for(const slot of new Set(anchors)){
    const[x,y]=projectTruckPoint(SETTLEMENT_POSITIONS[getSlotLocalIndex(slot)],floor);
    bounds.push({left:x-73,top:y-138,right:x+73,bottom:y+38});
  }
  return bounds.length?mergeVillageBounds(bounds):{left:260,top:120-(floor-1)*FLOOR_HEIGHT,right:700,bottom:460-(floor-1)*FLOOR_HEIGHT};
}
/** Fit roofs, production controls and beds inside the actual unobscured map. */
export function fitVillageCamera(bounds:VillageBounds,availableWidth:number,availableHeight:number){
  const width=Math.max(100,availableWidth),height=Math.max(70,availableHeight),padding=28;
  const maxScale=width>height*1.4?1.15:.92;
  return { x:(bounds.left+bounds.right)/2,y:(bounds.top+bounds.bottom)/2,
    width:Math.max(bounds.right-bounds.left+padding*2,480,width/maxScale),
    height:Math.max(bounds.bottom-bounds.top+padding*2,300,height/maxScale),zoom:1 };
}
