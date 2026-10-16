import type { BuildingType } from './settlement';

type Detail={path:string;fill:string;light?:string;stroke?:string};
const COLORS:Record<BuildingType,string>={workshop:'#536e53',kitchen:'#bf9158',waterworks:'#7d9b9d',greenhouse:'#62846a',watchtower:'#657d58',petHouse:'#a9b58a'};
const IMPROVEMENTS:Record<BuildingType,Detail[]>={
  workshop:[{path:'M28 63L37 66L37 73L28 70Z',fill:'#546e55',light:'#9ba783'},
    {path:'M30 64L35 66M32 65V69',fill:'none',stroke:'#e3bd70'}],
  kitchen:[{path:'M66 61L72 58L77 61L71 64Z',fill:'#d6ad62',light:'#f2d597'},
    {path:'M68 61Q71 57 74 60',fill:'none',stroke:'#8a6c42'}],
  waterworks:[{path:'M49 40L66 46L66 49L49 43Z',fill:'#a2b1a1',light:'#dfd3a7'},
    {path:'M53 42L53 45M62 45L62 48',fill:'none',stroke:'#c29c56'}],
  greenhouse:[{path:'M27 53L31 51L31 72L27 74Z',fill:'#719b78',light:'#b8c5a0'},
    {path:'M28 55L30 54M28 68L30 67',fill:'none',stroke:'#e7ca84'}],
  watchtower:[{path:'M31 54L39 58L39 62L31 58Z',fill:'#d8c79f',light:'#f0dfb7'},
    {path:'M34 56L36 57L36 60L34 59Z',fill:'#78936a'}],
  petHouse:[{path:'M72 72L79 69L84 72L77 75Z',fill:'#d4bc8e',light:'#eee0b9'},
    {path:'M74 72L77 70L81 72L77 74Z',fill:'#9daf87'}],
};

/** Restrained brass fittings and supplies preserve the open miniature stations. */
export function getFacilityUpgradeDetails(type:BuildingType,level:number):readonly Detail[]{
  const stage=Math.max(1,Math.min(5,Math.floor(level))),details:Detail[]=[];
  if(stage>=2){
    details.push({path:'M47 92L54 95L61 92L61 94L54 97L47 94Z',fill:'#b99551',light:'#ebcd86'},
      {path:'M49 93L49 94M59 93L59 94',fill:'none',stroke:'#766142'});
  }
  if(stage>=3)details.push(...IMPROVEMENTS[type]);
  if(stage>=4){
    details.push({path:'M12 76Q8 71 11 68Q15 68 15 74Q15 65 19 65Q23 68 17 76Z',fill:COLORS[type],light:'#b4c28f'},
      {path:'M12 75Q14 71 17 70',fill:'none',stroke:'#78935f'});
  }
  if(stage>=5){
    details.push({path:'M53 83L57 81L61 83L61 88L57 91L53 89Z',fill:'#bd9955',light:'#eed393'},
      {path:'M57 83L58 85L60 85L58 87L58 89L57 88L55 89L55 87L54 85L56 85Z',fill:'#fff0b9',stroke:'#ae8848'});
  }
  return details;
}
const paths=new Map<string,Path2D>();
export function drawFacilityUpgradeDetails(c:CanvasRenderingContext2D,type:BuildingType,level:number,x:number,y:number,width:number,height:number){
  const details=getFacilityUpgradeDetails(type,level);if(!details.length)return;
  c.save();c.translate(x,y);c.scale(width/100,height/100);c.lineWidth=.55;c.lineJoin='round';c.lineCap='round';
  for(const detail of details){
    let path=paths.get(detail.path);if(!path){path=new Path2D(detail.path);paths.set(detail.path,path);}
    if(detail.fill!=='none'){
      if(detail.light){const gradient=c.createLinearGradient(0,0,0,100);gradient.addColorStop(0,detail.light);gradient.addColorStop(1,detail.fill);c.fillStyle=gradient;}
      else c.fillStyle=detail.fill;
      c.fill(path);
    }
    c.strokeStyle=detail.stroke??'#92784e';c.stroke(path);
  }
  c.restore();
}
export function facilityUpgradeDetailsSvg(type:BuildingType,level:number):string{
  const details=getFacilityUpgradeDetails(type,level),prefix=`facility-detail-${type}-${level}`;
  const gradients=details.map((detail,index)=>detail.light?`<linearGradient id="${prefix}-${index}" x2="0" y2="1"><stop stop-color="${detail.light}"/><stop offset="1" stop-color="${detail.fill}"/></linearGradient>`:'').join('');
  return`${gradients?`<defs>${gradients}</defs>`:''}<g stroke-width=".55" stroke-linejoin="round" stroke-linecap="round">${details.map((detail,index)=>`<path d="${detail.path}" fill="${detail.light?`url(#${prefix}-${index})`:detail.fill}" stroke="${detail.stroke??'#92784e'}"/>`).join('')}</g>`;
}
