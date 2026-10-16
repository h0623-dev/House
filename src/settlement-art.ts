import atlasUrl from './assets/haven-facilities-v047.png';
import type { BuildingType } from './settlement';
import { drawFacilityUpgradeDetails, facilityUpgradeDetailsSvg } from './facility-upgrade-art';
import { alignArtContext, type AlignedArtTransform } from './layout-art-projection';
import type { LayoutDirection } from './layout-direction';

/** Warm miniature work stations, independently framed with alpha gutters. */
export const FACILITY_ART_URL = atlasUrl;
export const FACILITY_FRAMES: Record<BuildingType, { x:number; y:number; width:number; height:number }> = {
 workshop: {x:39,y:22,width:471,height:481},
 kitchen: {x:543,y:28,width:470,height:474},
 waterworks: {x:1067,y:33,width:451,height:470},
 greenhouse: {x:41,y:526,width:484,height:452},
 watchtower: {x:595,y:495,width:379,height:482},
 petHouse: {x:1045,y:566,width:475,height:415},
};
const art = new Image();
art.decoding='async';
art.src=atlasUrl;
export function facilityArtReady(){return art.complete&&art.naturalWidth>0;}
/** Measured front platform edges before fitting to the live deck axes. */
export const FACILITY_BASE_SLOPES: Record<BuildingType,[number,number]> = {
 workshop:[117/254,-91/199], kitchen:[114/263,-83/186], waterworks:[117/250,-91/180],
 greenhouse:[116/256,-86/204], watchtower:[83/180,-74/181], petHouse:[94/250,-89/204],
};

/** Fit each facility into its box, anchored at the bottom centre. */
export function drawFacility(c:CanvasRenderingContext2D,type:BuildingType,x:number,y:number,width:number,height:number,alpha=1,level=1,direction:LayoutDirection=0,onPaint?:(matrix:AlignedArtTransform)=>void):boolean{
 if(!facilityArtReady())return false;
 const f=FACILITY_FRAMES[type],scale=Math.min(width/f.width,height/f.height),w=f.width*scale,h=f.height*scale;
 c.save();c.globalAlpha*=alpha;c.imageSmoothingEnabled=true;
 const [positive,negative]=FACILITY_BASE_SLOPES[type],matrix=alignArtContext(c,x,y,w,h,positive,negative,direction);
 c.drawImage(art,f.x,f.y,f.width,f.height,-w/2,-h,w,h);
 drawFacilityUpgradeDetails(c,type,level,-w/2,-h,w,h);
 if(level>=4){
  const flagX=w*.23,flagY=-h*.89,size=Math.max(8,w*.17);
  c.strokeStyle='#7c6541';c.lineWidth=Math.max(1,w*.025);c.beginPath();c.moveTo(flagX,flagY+size*1.9);c.lineTo(flagX,flagY);c.stroke();
  c.fillStyle=level>=5?'#4b8392':'#6f9158';c.strokeStyle='#f3df9e';c.lineWidth=Math.max(1,w*.018);
  c.beginPath();c.moveTo(flagX,flagY);c.lineTo(flagX+size*1.45,flagY+size*.1);c.lineTo(flagX+size*1.16,flagY+size*.65);c.lineTo(flagX+size*1.45,flagY+size*1.1);c.lineTo(flagX,flagY+size);c.closePath();c.fill();c.stroke();
  // The level number remains readable in the opposite-facing pennant.
  c.save();c.translate(flagX+size*.56,flagY+size*.53);if(direction===1)c.scale(-1,1);
  c.fillStyle='#fff4cf';c.font=`700 ${Math.max(7,size*.75)}px sans-serif`;c.textAlign='center';c.textBaseline='middle';c.fillText(String(level),0,0);c.restore();
 }
 c.restore();onPaint?.(matrix);return true;
}
export function facilityIcon(type:BuildingType,level=1):string{
 const f=FACILITY_FRAMES[type];
 const flagX=f.x+f.width*.68,flagY=f.y+f.height*.04,size=f.width*.14;
 const flag=level>=4?`<path d="M${flagX} ${flagY+size*1.9}V${flagY}" stroke="#7c6541" stroke-width="${size*.1}"/><path d="M${flagX} ${flagY}l${size*1.5} ${size*.1}l${-size*.3} ${size*.5}l${size*.3} ${size*.5}l${-size*1.5} ${-size*.1}z" fill="${level>=5?'#4b8392':'#6f9158'}" stroke="#f3df9e" stroke-width="${size*.08}"/><text x="${flagX+size*.6}" y="${flagY+size*.57}" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="${size*.8}" font-weight="700" fill="#fff4cf">${level}</text>`:'';
 const details=level>=2?`<g transform="translate(${f.x} ${f.y}) scale(${f.width/100} ${f.height/100})">${facilityUpgradeDetailsSvg(type,level)}</g>`:'';
 return `<svg class="facility-art" data-facility-art-level="${level}" viewBox="${f.x} ${f.y} ${f.width} ${f.height}" aria-hidden="true" focusable="false"><image href="${atlasUrl}" width="1536" height="1024"/>${details}${flag}</svg>`;
}
