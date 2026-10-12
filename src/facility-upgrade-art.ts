import type { BuildingType } from './settlement';

type Detail={path:string;fill:string;light?:string;stroke?:string};
const COLORS:Record<BuildingType,string>={workshop:'#789579',kitchen:'#b87955',waterworks:'#6c9bad',greenhouse:'#7f9d66',watchtower:'#72918a',petHouse:'#8eaa79'};
const IMPROVEMENTS:Record<BuildingType,Detail[]>={
  workshop:[{path:'M31 28L53 33L59 40L35 35Z',fill:'#76907b',light:'#b7c7a0'},
    {path:'M35 35L59 40L58 44L34 39Z',fill:'#536b57'}],
  kitchen:[{path:'M57 49L77 44L86 51L65 58Z',fill:'#ba7953',light:'#e9c088'},
    {path:'M65 58L86 51L86 55L65 62Z',fill:'#955c3e'}],
  waterworks:[{path:'M63 14L89 26L84 32L58 20Z',fill:'#5d95a0',light:'#aad0ca'},
    {path:'M67 18L64 23M76 22L72 27M84 26L81 31',fill:'none',stroke:'#d3e5d1'}],
  greenhouse:[{path:'M19 29L39 15L68 25L50 40Z',fill:'#8bbaa0',light:'#c1d5ac'},
    {path:'M24 28L52 37M33 20L61 30M36 20L30 31M50 21L43 34',fill:'none',stroke:'#e3e9bd'}],
  watchtower:[{path:'M25 22L50 11L76 23L54 35Z',fill:'#668e8a',light:'#a2b8a0'},
    {path:'M25 22L54 35L76 23L76 27L54 39L25 26Z',fill:'#c9aa68'}],
  petHouse:[{path:'M60 43L80 36L91 45L70 53Z',fill:'#81a376',light:'#c2ce94'},
    {path:'M70 53L91 45L91 49L70 57Z',fill:'#58764e'}],
};

/** Small original additions stay inside the existing painted building box. */
export function getFacilityUpgradeDetails(type:BuildingType,level:number):readonly Detail[]{
  const stage=Math.max(1,Math.min(5,Math.floor(level))),details:Detail[]=[];
  if(stage>=2){
    details.push({path:'M72 79L81 75L93 81L83 86Z',fill:'#c7a473',light:'#e8c99a'},
      {path:'M72 79L83 86L83 97L72 90Z',fill:'#a5784e'},
      {path:'M83 86L93 81L93 92L83 97Z',fill:COLORS[type],light:'#c4cba0'},
      {path:'M76 82L76 89M88 86L88 91',fill:'none',stroke:'#edcea0'});
  }
  if(stage>=3)details.push(...IMPROVEMENTS[type]);
  if(stage>=4){
    details.push({path:'M8 77L18 73L30 79L19 85Z',fill:'#82a475',light:'#bfd095'},
      {path:'M8 77L19 85L19 91L8 84Z',fill:'#ac8258'},
      {path:'M19 85L30 79L30 85L19 91Z',fill:'#8b6845'},
      {path:'M13 76Q11 67 17 71Q18 62 23 70Q31 67 26 77L20 81Z',fill:'#76994d',light:'#aec47a'});
  }
  if(stage>=5){
    details.push({path:'M47 62L56 58L65 64L65 74L57 80L47 75Z',fill:'#d3b16c',light:'#f1d495'},
      {path:'M55 63L57 66L61 67L58 70L59 74L55 72L52 74L52 70L49 68L53 67Z',fill:'#fff0b9',stroke:'#ab8145'});
  }
  return details;
}
const paths=new Map<string,Path2D>();
export function drawFacilityUpgradeDetails(c:CanvasRenderingContext2D,type:BuildingType,level:number,x:number,y:number,width:number,height:number){
  const details=getFacilityUpgradeDetails(type,level);if(!details.length)return;
  c.save();c.translate(x,y);c.scale(width/100,height/100);c.lineWidth=.8;c.lineJoin='round';c.lineCap='round';
  for(const detail of details){
    let path=paths.get(detail.path);if(!path){path=new Path2D(detail.path);paths.set(detail.path,path);}
    if(detail.fill!=='none'){
      if(detail.light){const gradient=c.createLinearGradient(0,0,0,100);gradient.addColorStop(0,detail.light);gradient.addColorStop(1,detail.fill);c.fillStyle=gradient;}
      else c.fillStyle=detail.fill;
      c.fill(path);
    }
    c.strokeStyle=detail.stroke??'#795a3f';c.stroke(path);
  }
  c.restore();
}
export function facilityUpgradeDetailsSvg(type:BuildingType,level:number):string{
  const details=getFacilityUpgradeDetails(type,level),prefix=`facility-detail-${type}-${level}`;
  const gradients=details.map((detail,index)=>detail.light?`<linearGradient id="${prefix}-${index}" x2="0" y2="1"><stop stop-color="${detail.light}"/><stop offset="1" stop-color="${detail.fill}"/></linearGradient>`:'').join('');
  return`${gradients?`<defs>${gradients}</defs>`:''}<g stroke-width=".8" stroke-linejoin="round" stroke-linecap="round">${details.map((detail,index)=>`<path d="${detail.path}" fill="${detail.light?`url(#${prefix}-${index})`:detail.fill}" stroke="${detail.stroke??'#795a3f'}"/>`).join('')}</g>`;
}
