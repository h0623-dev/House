import atlasUrl from './assets/haven-facilities-v047.png';
import type { BuildingType } from './settlement';
import { drawFacilityUpgradeDetails, facilityUpgradeDetailsSvg } from './facility-upgrade-art';
import type { AlignedArtTransform } from './layout-art-projection';
import type { LayoutDirection } from './layout-direction';
import { FACILITY_FRAMES, getFacilityArtLayout } from './facility-art-layout';
export { FACILITY_FRAMES, FACILITY_BASE_CORNERS, FACILITY_BASE_SLOPES, getFacilityArtBounds } from './facility-art-layout';

/** Warm miniature work stations, independently framed with alpha gutters. */
export const FACILITY_ART_URL = atlasUrl;
const art = new Image();
art.decoding='async';
art.src=atlasUrl;
export function facilityArtReady(){return art.complete&&art.naturalWidth>0;}
/** The timber base occupies its paid cells and is centred on the deck placement. */
export function drawFacility(c:CanvasRenderingContext2D,type:BuildingType,x:number,y:number,_width:number,_height:number,alpha=1,level=1,direction:LayoutDirection=0,onPaint?:(matrix:AlignedArtTransform)=>void):boolean{
 if(!facilityArtReady())return false;
 const {frame:f,sourceLeft:left,sourceTop:top,matrix}=getFacilityArtLayout(type,direction),w=f.width,h=f.height;
 c.save();c.globalAlpha*=alpha;c.imageSmoothingEnabled=true;
 c.translate(x,y);c.transform(matrix.xScale,matrix.yShear,0,matrix.yScale,0,0);
 c.drawImage(art,f.x,f.y,f.width,f.height,left,top,w,h);
 drawFacilityUpgradeDetails(c,type,level,left,top,w,h);
 if(level>=4){
  const flagX=left+w*.73,flagY=top+h*.11,size=w*.14;
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
