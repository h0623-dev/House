import { getBuildingFootprint } from './deck-placement';
import { DECK_ART_SLOPES, type AlignedArtTransform } from './layout-art-projection';
import type { LayoutDirection } from './layout-direction';
import type { BuildingType } from './settlement';

type ArtPoint = readonly [number, number];
export interface FacilityArtFrame { x:number; y:number; width:number; height:number }
export interface FacilityArtBounds { left:number; top:number; right:number; bottom:number; width:number; height:number }

export const FACILITY_FRAMES: Record<BuildingType, FacilityArtFrame> = {
  workshop:{x:39,y:22,width:471,height:481},
  kitchen:{x:543,y:28,width:470,height:474},
  waterworks:{x:1067,y:33,width:451,height:470},
  greenhouse:{x:41,y:526,width:484,height:452},
  watchtower:{x:595,y:495,width:379,height:482},
  petHouse:{x:1045,y:566,width:475,height:415},
};

/** The underside of each painted timber platform, in atlas pixels. */
export const FACILITY_BASE_CORNERS: Record<BuildingType,{left:ArtPoint;front:ArtPoint;right:ArtPoint}> = {
  workshop:{left:[47,373],front:[300,489],right:[500,400]},
  kitchen:{left:[552,374],front:[815,488],right:[1004,405]},
  waterworks:{left:[1076,374],front:[1326,491],right:[1508,400]},
  greenhouse:{left:[50,848],front:[306,966],right:[516,880]},
  watchtower:{left:[604,880],front:[784,965],right:[966,889]},
  petHouse:{left:[1055,876],front:[1307,970],right:[1511,881]},
};

export const FACILITY_BASE_SLOPES = Object.fromEntries(
  Object.entries(FACILITY_BASE_CORNERS).map(([type,base])=>[type,[
    (base.front[1]-base.left[1])/(base.front[0]-base.left[0]),
    (base.right[1]-base.front[1])/(base.right[0]-base.front[0]),
  ]]),
) as Record<BuildingType,[number,number]>;

export interface FacilityArtLayout {
  frame: FacilityArtFrame;
  /** Draw the original source pixels relative to the physical platform centre. */
  sourceLeft:number;
  sourceTop:number;
  matrix: AlignedArtTransform;
  bounds: FacilityArtBounds;
}

const cache = new Map<string,FacilityArtLayout>();
const BASE_OCCUPANCY = .88;

/**
 * Fit the measured base inside the paid cell footprint, with 12% clearance.
 * Walls stay vertical; a rectangular cell footprint never stretches a roof.
 * No height cap can shrink the floor plate independently of its occupied cells.
 */
export function getFacilityArtLayout(type:BuildingType,direction:LayoutDirection=0):FacilityArtLayout {
  const key=`${type}:${direction}`,cached=cache.get(key);
  if(cached)return cached;
  const frame=FACILITY_FRAMES[type],base=FACILITY_BASE_CORNERS[type];
  const footprint=getBuildingFootprint(type,direction);
  const positiveRun=base.front[0]-base.left[0],negativeRun=base.right[0]-base.front[0];
  const positiveTarget=direction===0?footprint.width*.91:footprint.depth*.67;
  const negativeTarget=direction===0?footprint.depth*.67:footprint.width*.91;
  const scale=BASE_OCCUPANCY*Math.min(positiveTarget/positiveRun,negativeTarget/negativeRun);
  const [positive,negative]=FACILITY_BASE_SLOPES[type];
  const yScale=(DECK_ART_SLOPES.u-DECK_ART_SLOPES.v)/(positive-negative);
  const yShear=(direction===0?DECK_ART_SLOPES.u:-DECK_ART_SLOPES.v)-positive*yScale;
  const matrix:AlignedArtTransform={xScale:(direction===0?1:-1)*scale,yShear:yShear*scale,yScale:yScale*scale};
  const centerX=(base.left[0]+base.right[0])/2,centerY=(base.left[1]+base.right[1])/2;
  const sourceLeft=frame.x-centerX,sourceTop=frame.y-centerY;
  const points=[[sourceLeft,sourceTop],[sourceLeft+frame.width,sourceTop],
    [sourceLeft+frame.width,sourceTop+frame.height],[sourceLeft,sourceTop+frame.height]]
    .map(([x,y])=>[x*matrix.xScale,x*matrix.yShear+y*matrix.yScale]);
  const left=Math.min(...points.map(p=>p[0])),right=Math.max(...points.map(p=>p[0]));
  const top=Math.min(...points.map(p=>p[1])),bottom=Math.max(...points.map(p=>p[1]));
  const layout={frame,sourceLeft,sourceTop,matrix,bounds:{left,top,right,bottom,width:right-left,height:bottom-top}};
  cache.set(key,layout);
  return layout;
}

/** Relative to facilityPoint: the centre of the occupied deck cells, not its toe. */
export function getFacilityArtBounds(type:BuildingType,direction:LayoutDirection=0):FacilityArtBounds {
  return getFacilityArtLayout(type,direction).bounds;
}
