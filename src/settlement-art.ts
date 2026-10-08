import atlasUrl from './assets/settlement-buildings.png';
import type { BuildingType } from './settlement';

/** Original facilities, measured independently so adjacent sprites never leak. */
export const FACILITY_ART_URL = atlasUrl;
export const FACILITY_FRAMES: Record<BuildingType, { x:number; y:number; width:number; height:number }> = {
 workshop: {x:24,y:35,width:490,height:450},
 kitchen: {x:548,y:23,width:457,height:459},
 waterworks: {x:1070,y:63,width:459,height:430},
 greenhouse: {x:29,y:532,width:491,height:444},
 watchtower: {x:564,y:491,width:442,height:492},
 petHouse: {x:1062,y:586,width:472,height:390},
};
const art = new Image();
art.decoding='async';
art.src=atlasUrl;
export function facilityArtReady(){return art.complete&&art.naturalWidth>0;}

/** Fit each facility into its box, anchored at the bottom centre. */
export function drawFacility(c:CanvasRenderingContext2D,type:BuildingType,x:number,y:number,width:number,height:number,alpha=1):boolean{
 if(!facilityArtReady())return false;
 const f=FACILITY_FRAMES[type],scale=Math.min(width/f.width,height/f.height),w=f.width*scale,h=f.height*scale;
 c.save();c.globalAlpha*=alpha;c.imageSmoothingEnabled=true;
 c.drawImage(art,f.x,f.y,f.width,f.height,x-w/2,y-h,w,h);
 c.restore();return true;
}
export function facilityIcon(type:BuildingType):string{
 const f=FACILITY_FRAMES[type];
 return `<svg class="facility-art" viewBox="${f.x} ${f.y} ${f.width} ${f.height}" aria-hidden="true" focusable="false"><image href="${atlasUrl}" width="1536" height="1024"/></svg>`;
}
