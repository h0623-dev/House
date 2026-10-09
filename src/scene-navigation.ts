import { createMotionRoute, sampleMotionRoute, type MotionPoint, type MotionRoute } from './scene-motion';

export type NavigationSurface = 'deck' | 'road' | 'ladder';
export type NavigationPoint = [number, number];
export interface NavigationLocation { point: NavigationPoint; surface: NavigationSurface }
export interface NavigationRect { left: number; top: number; right: number; bottom: number }
export interface NavigationObstacle { surface: 'deck' | 'road'; bounds: NavigationRect }
export interface NavigationWorld {
  deck: NavigationRect; deckOuter: NavigationRect; road: NavigationRect;
  obstacles: NavigationObstacle[];
  ladder: { entry: NavigationPoint; top: NavigationPoint; bottom: NavigationPoint };
}
export interface NavigationPath {
  points: NavigationPoint[]; surfaces: NavigationSurface[]; climbSegments: number[];
  start: NavigationLocation; target: NavigationLocation; motion: MotionRoute;
  /** A newly built footprint may cover the old feet; returning stops at its safe exit. */
  returnLocation: NavigationLocation; returnMotion: MotionRoute; returnIndex: number;
}
export const FARM_POSITIONS: NavigationPoint[] = [[-116,42],[-33,42],[50,42],[133,42],[-116,122],[-33,122],[50,122],[133,122],
  [216,42],[216,122],[299,42],[299,122],[-116,202],[-33,202],[50,202],[133,202],[216,202],[299,202],[-116,282],[-33,282],[50,282],[133,282],[216,282],[299,282]];
export const SETTLEMENT_POSITIONS: NavigationPoint[] = [[-42,-106],[124,-106],[-42,-278],[124,-278],[-42,-450],[124,-450],[290,-106],[456,-106],
  [290,-278],[456,-278],[290,-450],[456,-450],[-42,-622],[124,-622],[290,-622],[456,-622]];
export const DECK_FRONTS = [141,216,216,249,296,321,361,401];
export function navigationDeckBounds(level: number) {
  const step = Math.max(0,Math.min(7,level-1)), lower = Math.floor(step), upper = Math.ceil(step), amount = step-lower;
  const ends = [234,282,330,558,582,606,634,662], backs = [-184,-356,-528,-544,-560,-576,-744,-768];
  return {level,left:-278-step*14,end:ends[lower]+(ends[upper]-ends[lower])*amount,
    back:backs[lower]+(backs[upper]-backs[lower])*amount,front:DECK_FRONTS[lower]+(DECK_FRONTS[upper]-DECK_FRONTS[lower])*amount};
}
export const projectDeckPoint = ([u,v]: MotionPoint): NavigationPoint => [480+u*.91-v*.67,325+u*.34+v*.47];
export function unprojectDeckPoint([x,y]: MotionPoint): NavigationPoint {
  return [(.47*(x-480)+.67*(y-325))/.6555,(-.34*(x-480)+.91*(y-325))/.6555];
}
export const defaultHeroLocation = (): NavigationLocation => ({surface:'deck',point:projectDeckPoint([-74,14])});
const inside = (point: MotionPoint,r:NavigationRect) => point[0]>=r.left-1e-7&&point[0]<=r.right+1e-7&&point[1]>=r.top-1e-7&&point[1]<=r.bottom+1e-7;
const finite = (point: MotionPoint) => point.length===2&&point.every(Number.isFinite);
const metric = (a:MotionPoint,b:MotionPoint) => Math.hypot(a[0]-b[0],a[1]-b[1]);
export function createNavigationWorld(level:number,plotCount:number,facilitySlots:readonly number[]):NavigationWorld {
  const d=navigationDeckBounds(level);
  const obstacles:NavigationObstacle[]=[{surface:'deck',bounds:{left:-278,top:-162,right:-180,bottom:-58}}];
  for(const [u,v]of FARM_POSITIONS.slice(0,plotCount))obstacles.push({surface:'deck',bounds:{left:u-3,top:v-3,right:u+72,bottom:v+71}});
  for(const slot of facilitySlots){const position=SETTLEMENT_POSITIONS[slot];if(position){const[u,v]=position;obstacles.push({surface:'deck',bounds:{left:u-65,top:v-65,right:u+65,bottom:v+65}});}}
  obstacles.push({surface:'road',bounds:{left:63,top:576,right:127,bottom:624}},
    {surface:'road',bounds:{left:12,top:559,right:55,bottom:583}},
    {surface:'road',bounds:{left:166,top:552,right:201,bottom:575}});
  return {deck:{left:d.left+6,top:d.back+6,right:d.end-6,bottom:d.front-6},
    deckOuter:{left:d.left,top:d.back,right:d.end,bottom:d.front},road:{left:65,top:505,right:340,bottom:685},obstacles,
    ladder:{entry:projectDeckPoint([-225,d.front-10]),top:projectDeckPoint([-225,d.front-3]),bottom:[140,527]}};
}
export function groundLocation(world:NavigationWorld,point:MotionPoint):NavigationLocation|undefined {
  if(!finite(point))return;
  const uv=unprojectDeckPoint(point);
  if(inside(uv,world.deckOuter)){
    if(inside(uv,world.deck)&&!world.obstacles.some(o=>o.surface==='deck'&&inside(uv,o.bounds)))return {surface:'deck',point:[...point]};
    return;
  }
  if(inside(point,world.road)&&!world.obstacles.some(o=>o.surface==='road'&&inside(point,o.bounds)))return {surface:'road',point:[...point]};
}
// A segment may touch the padded perimeter but never enter an obstacle's interior.
function crossesRect(a:MotionPoint,b:MotionPoint,r:NavigationRect):boolean {
  let low=0,high=1;
  for(let axis=0;axis<2;axis++){
    const min=(axis?r.top:r.left)+1e-6,max=(axis?r.bottom:r.right)-1e-6,delta=b[axis]-a[axis];
    if(Math.abs(delta)<1e-9){if(a[axis]<=min||a[axis]>=max)return false;}
    else {const first=(min-a[axis])/delta,last=(max-a[axis])/delta;low=Math.max(low,Math.min(first,last));high=Math.min(high,Math.max(first,last));if(low>=high)return false;}
  }
  return high>0&&low<1&&low<high;
}
/** Exact obstacle corners form a small visibility graph; paths never cut diagonally through beds. */
function floorPath(world:NavigationWorld,surface:'deck'|'road',from:MotionPoint,to:MotionPoint):NavigationPoint[]|undefined {
  const convert=surface==='deck'?unprojectDeckPoint:(p:MotionPoint):NavigationPoint=>[...p];
  const project=surface==='deck'?projectDeckPoint:(p:MotionPoint):NavigationPoint=>[...p];
  const start=convert(from),target=convert(to),bounds=surface==='deck'?world.deck:world.road;
  const obstacles=world.obstacles.filter(o=>o.surface===surface).map(o=>o.bounds);
  const valid=(p:MotionPoint)=>inside(p,bounds)&&!obstacles.some(r=>inside(p,r));
  if(!valid(start)||!valid(target))return;
  const clear=(a:MotionPoint,b:MotionPoint)=>!obstacles.some(r=>crossesRect(a,b,r));
  if(clear(start,target))return [project(start),project(target)];
  const nodes:NavigationPoint[]=[start,target];
  for(const r of obstacles)for(const p of [[r.left-.5,r.top-.5],[r.right+.5,r.top-.5],[r.right+.5,r.bottom+.5],[r.left-.5,r.bottom+.5]]as NavigationPoint[])if(valid(p))nodes.push(p);
  const cost=nodes.map(()=>Infinity),previous=nodes.map(()=>-1),visited=new Set<number>();cost[0]=0;
  while(visited.size<nodes.length){
    let current=-1;for(let i=0;i<nodes.length;i++)if(!visited.has(i)&&(current<0||cost[i]<cost[current]))current=i;
    if(current<0||!Number.isFinite(cost[current]))return;if(current===1)break;visited.add(current);
    for(let next=0;next<nodes.length;next++)if(!visited.has(next)&&clear(nodes[current],nodes[next])){
      const total=cost[current]+metric(project(nodes[current]),project(nodes[next]));if(total<cost[next]){cost[next]=total;previous[next]=current;}
    }
  }
  if(!Number.isFinite(cost[1]))return;
  const path:NavigationPoint[]=[];for(let i=1;i>=0;i=previous[i])path.unshift(project(nodes[i]));return path;
}
/** Only the containing footprints can be crossed while escaping newly occupied feet. */
function escapePoint(world:NavigationWorld,location:NavigationLocation):NavigationPoint|undefined {
  if(location.surface==='ladder')return;
  const surface=location.surface,convert=surface==='deck'?unprojectDeckPoint:(p:MotionPoint):NavigationPoint=>[...p];
  const project=surface==='deck'?projectDeckPoint:(p:MotionPoint):NavigationPoint=>[...p];
  const start=convert(location.point),bounds=surface==='deck'?world.deck:world.road;
  if(!inside(start,bounds))return;
  const obstacles=world.obstacles.filter(o=>o.surface===surface).map(o=>o.bounds),containing=obstacles.filter(r=>inside(start,r));
  if(!containing.length)return;
  const valid=(p:MotionPoint)=>inside(p,bounds)&&!obstacles.some(r=>inside(p,r));
  const candidates:NavigationPoint[]=[];
  for(const r of containing){
    candidates.push([r.left-.5,start[1]],[r.right+.5,start[1]],[start[0],r.top-.5],[start[0],r.bottom+.5],
      [r.left-.5,r.top-.5],[r.right+.5,r.top-.5],[r.right+.5,r.bottom+.5],[r.left-.5,r.bottom+.5]);
  }
  return candidates.filter(valid).filter(p=>!obstacles.some(r=>!containing.includes(r)&&crossesRect(start,p,r)))
    .sort((a,b)=>metric(project(start),project(a))-metric(project(start),project(b))).map(project)[0];
}
export function planNavigation(world:NavigationWorld,start:NavigationLocation,target:NavigationLocation):NavigationPath|undefined {
  if(!finite(start.point)||!finite(target.point)||!['deck','road','ladder'].includes(start.surface)||(target.surface!=='deck'&&target.surface!=='road'))return;
  const points:NavigationPoint[]=[[...start.point]],surfaces:NavigationSurface[]=[];
  const append=(point:MotionPoint,surface:NavigationSurface)=>{if(metric(points[points.length-1],point)>1e-6){points.push([...point]);surfaces.push(surface);}};
  const floor=(surface:'deck'|'road',destination:MotionPoint)=>{
    const path=floorPath(world,surface,points[points.length-1],destination);if(!path)return false;
    for(const point of path.slice(1))append(point,surface);return true;
  };
  let surface=start.surface,returnIndex=0;
  if(surface==='deck'){
    // The seven-pixel entrance is the sole allowed passage through the front rail.
    const entry=world.ladder.entry,top=world.ladder.top;
    if(!inside(unprojectDeckPoint(start.point),world.deck)&&Math.abs(metric(entry,start.point)+metric(start.point,top)-metric(entry,top))<.01){
      append(entry,'deck');
    }
  }
  const escape=escapePoint(world,{point:points[points.length-1],surface});
  if(escape){append(escape,surface);returnIndex=points.length-1;}
  if(surface==='ladder'){
    // Retargeting on a tread goes to the appropriate endpoint from that exact
    // physical position instead of projecting a climber onto the deck or road.
    const top=world.ladder.top,bottom=world.ladder.bottom;
    const length=metric(top,bottom),sum=metric(top,start.point)+metric(start.point,bottom);
    if(Math.abs(sum-length)>.01)return;
    surface=target.surface;append(surface==='deck'?top:bottom,'ladder');
    if(surface==='deck')append(world.ladder.entry,'deck');
  }
  if(surface!==target.surface){
    if(surface==='deck'){
      if(!floor('deck',world.ladder.entry))return;append(world.ladder.top,'deck');append(world.ladder.bottom,'ladder');
    }else{
      if(!floor('road',world.ladder.bottom))return;append(world.ladder.top,'ladder');append(world.ladder.entry,'deck');
    }
    surface=target.surface;
  }
  if(!floor(surface,target.point))return;
  const climbSegments=surfaces.flatMap((surface,index)=>surface==='ladder'?[index]:[]);
  const motion=createMotionRoute(points,climbSegments),returnMotion=returnIndex?createMotionRoute(points.slice(returnIndex),climbSegments.filter(i=>i>=returnIndex).map(i=>i-returnIndex)):motion;
  return {points,surfaces,climbSegments,start:{point:[...start.point],surface:start.surface},target:{point:[...target.point],surface:target.surface},motion,
    returnIndex,returnMotion,returnLocation:{point:[...points[returnIndex]],surface:returnIndex?surfaces[returnIndex-1]:start.surface}};
}
export function sampleNavigation(path:NavigationPath,elapsed:number,returning=false){
  const route=returning?path.returnMotion:path.motion,motion=sampleMotionRoute(route,elapsed,returning);
  let remaining=motion.distance,surface:NavigationSurface=returning?path.returnLocation.surface:path.target.surface;
  const segments=returning?[...route.segments].reverse():route.segments;
  const surfaces=returning?[...path.surfaces.slice(path.returnIndex)].reverse():path.surfaces;
  if(elapsed<route.duration)for(let i=0;i<segments.length;i++){
    if(remaining<segments[i].distance-1e-7){surface=surfaces[i];break;}remaining-=segments[i].distance;
  }
  return {...motion,location:{point:[...motion.point]as NavigationPoint,surface}};
}
