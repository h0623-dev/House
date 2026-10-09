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
export function drawFacility(c:CanvasRenderingContext2D,type:BuildingType,x:number,y:number,width:number,height:number,alpha=1,level=1):boolean{
 if(!facilityArtReady())return false;
 const f=FACILITY_FRAMES[type],scale=Math.min(width/f.width,height/f.height),w=f.width*scale,h=f.height*scale;
 c.save();c.globalAlpha*=alpha;c.imageSmoothingEnabled=true;
 c.drawImage(art,f.x,f.y,f.width,f.height,x-w/2,y-h,w,h);
 if(level>=4){
  const flagX=x+w*.23,flagY=y-h*.89,size=Math.max(8,w*.17);
  c.strokeStyle='#7c6541';c.lineWidth=Math.max(1,w*.025);c.beginPath();c.moveTo(flagX,flagY+size*1.9);c.lineTo(flagX,flagY);c.stroke();
  c.fillStyle=level>=5?'#4b8392':'#6f9158';c.strokeStyle='#f3df9e';c.lineWidth=Math.max(1,w*.018);
  c.beginPath();c.moveTo(flagX,flagY);c.lineTo(flagX+size*1.45,flagY+size*.1);c.lineTo(flagX+size*1.16,flagY+size*.65);c.lineTo(flagX+size*1.45,flagY+size*1.1);c.lineTo(flagX,flagY+size);c.closePath();c.fill();c.stroke();
  c.fillStyle='#fff4cf';c.font=`700 ${Math.max(7,size*.75)}px sans-serif`;c.textAlign='center';c.textBaseline='middle';c.fillText(String(level),flagX+size*.56,flagY+size*.53);
 }
 c.restore();return true;
}
export function facilityIcon(type:BuildingType,level=1):string{
 const f=FACILITY_FRAMES[type];
 const flagX=f.x+f.width*.68,flagY=f.y+f.height*.04,size=f.width*.14;
 const flag=level>=4?`<path d="M${flagX} ${flagY+size*1.9}V${flagY}" stroke="#7c6541" stroke-width="${size*.1}"/><path d="M${flagX} ${flagY}l${size*1.5} ${size*.1}l${-size*.3} ${size*.5}l${size*.3} ${size*.5}l${-size*1.5} ${-size*.1}z" fill="${level>=5?'#4b8392':'#6f9158'}" stroke="#f3df9e" stroke-width="${size*.08}"/><text x="${flagX+size*.6}" y="${flagY+size*.57}" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="${size*.8}" font-weight="700" fill="#fff4cf">${level}</text>`:'';
 return `<svg class="facility-art" data-facility-art-level="${level}" viewBox="${f.x} ${f.y} ${f.width} ${f.height}" aria-hidden="true" focusable="false"><image href="${atlasUrl}" width="1536" height="1024"/>${flag}</svg>`;
}
