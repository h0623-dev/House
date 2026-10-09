import { createMotionRoute, sampleMotionRoute, type MotionPoint, type MotionRoute } from './scene-motion';
import { FARM_POSITIONS, SETTLEMENT_POSITIONS, getFloorBounds, getFloorStairs, getHouseFootprint,
  projectTruckPoint, unprojectTruckPoint, type HomeLocation, type TruckFloor } from './truck-layout';
export { FARM_POSITIONS, SETTLEMENT_POSITIONS, DECK_FRONTS } from './truck-layout';
export const navigationDeckBounds = getFloorBounds;
export const projectDeckPoint = projectTruckPoint;
export const unprojectDeckPoint = unprojectTruckPoint;
export const HERO_BODY_RADIUS = 7;
export const PET_BODY_RADIUS = 6;
export type NavigationSurface = 'deck' | 'road' | 'ladder';
export type NavigationPoint = [number, number];
export interface NavigationLocation { point: NavigationPoint; surface: NavigationSurface; floor?: TruckFloor; link?: string }
export interface NavigationRect { left: number; top: number; right: number; bottom: number }
export interface NavigationObstacle { surface: 'deck' | 'road'; floor?: TruckFloor; kind?: string; bounds: NavigationRect }
export interface NavigationActor { id: string; location: NavigationLocation; radius: number }
export interface NavigationFloor { id: TruckFloor; deck: NavigationRect; outer: NavigationRect }
export interface NavigationLink { id: string; lower: 0 | TruckFloor; upper: TruckFloor; points: NavigationPoint[] }
export interface NavigationWorld {
  deck: NavigationRect; deckOuter: NavigationRect; road: NavigationRect; roadOuter: NavigationRect; activeFloor: TruckFloor;
  floors: NavigationFloor[]; radius: number; actors: NavigationActor[];
  obstacles: NavigationObstacle[]; links: NavigationLink[];
  ladder: { entry: NavigationPoint; top: NavigationPoint; bottom: NavigationPoint };
}
export interface NavigationPath {
  points: NavigationPoint[]; surfaces: NavigationSurface[]; climbSegments: number[];
  segments: { fromFloor: number; toFloor: number; link?: string }[];
  start: NavigationLocation; target: NavigationLocation; motion: MotionRoute;
  returnLocation: NavigationLocation; returnMotion: MotionRoute; returnIndex: number;
}
export interface NavigationWorldOptions {
  floors?: readonly TruckFloor[]; home?: HomeLocation; activeFloor?: TruckFloor; radius?: number; actors?: NavigationActor[];
}
export const defaultHeroLocation = (): NavigationLocation => ({surface:'deck',point:projectDeckPoint([-74,14]),floor:1});
const inside = (p: MotionPoint,r:NavigationRect) => p[0]>=r.left-1e-7&&p[0]<=r.right+1e-7&&p[1]>=r.top-1e-7&&p[1]<=r.bottom+1e-7;
const finite = (p:MotionPoint) => p.length===2&&p.every(Number.isFinite);
const distance = (a:MotionPoint,b:MotionPoint) => Math.hypot(a[0]-b[0],a[1]-b[1]);
const copyLocation = (p:NavigationLocation):NavigationLocation => ({...p,point:[...p.point]});
const floorId = (p:NavigationLocation):number => p.surface==='road'?0:p.floor??1;
const margin = (radius:number) => ({x:radius*Math.hypot(.47,.67)/.6555,y:radius*Math.hypot(.34,.91)/.6555});
const inflate = (r:NavigationRect,x:number,y=x):NavigationRect => ({left:r.left-x,top:r.top-y,right:r.right+x,bottom:r.bottom+y});

/** The same physical footprints feed navigation, placement previews and collision checks. */
export function createNavigationWorld(level:number,plotCount:number,facilitySlots:readonly number[],options:NavigationWorldOptions={}):NavigationWorld {
  const radius=options.radius??HERO_BODY_RADIUS,clearance=margin(radius),ids=options.floors??[1],activeFloor=options.activeFloor??1;
  const floors=ids.map(id=>{const d=getFloorBounds(level,id);return{id,
    outer:{left:d.left,top:d.back,right:d.end,bottom:d.front},
    deck:{left:d.left+6+clearance.x,top:d.back+6+clearance.y,right:d.end-6-clearance.x,bottom:d.front-6-clearance.y}};});
  const home=options.home??{floor:1,slot:0},obstacles:NavigationObstacle[]=[{surface:'deck',floor:home.floor,kind:'house',bounds:getHouseFootprint(home)}];
  for(const [u,v]of FARM_POSITIONS.slice(0,plotCount))obstacles.push({surface:'deck',floor:1,kind:'farm',bounds:{left:u,top:v,right:u+69,bottom:v+68}});
  for(const slot of facilitySlots){const position=SETTLEMENT_POSITIONS[slot%16],floor=(Math.floor(slot/16)+1)as TruckFloor;
    if(position&&ids.includes(floor)){const[u,v]=position;obstacles.push({surface:'deck',floor,kind:'facility',bounds:{left:u-65,top:v-65,right:u+65,bottom:v+65}});}}
  obstacles.push({surface:'road',kind:'tree',bounds:{left:63,top:576,right:127,bottom:624}},
    {surface:'road',kind:'tree',bounds:{left:12,top:559,right:55,bottom:583}},
    {surface:'road',kind:'crate',bounds:{left:166,top:552,right:201,bottom:575}});
  const front=getFloorBounds(level).front,ladder={entry:projectDeckPoint([-225,front-60]),top:projectDeckPoint([-225,front-3]),bottom:[140,527]as NavigationPoint};
  const links:NavigationLink[]=[{id:'road-1',lower:0,upper:1,points:[ladder.bottom,ladder.top,ladder.entry]}];
  for(const upper of ids.filter(id=>id>1)){
    const stair=getFloorStairs(level,upper as 2|3);
    links.push({id:String(stair.lowerFloor)+'-'+String(upper),lower:stair.lowerFloor,upper,
      points:[stair.lowerEntry,stair.bottom,stair.top,stair.upperEntry]});
    for(const floor of [stair.lowerFloor,upper])obstacles.push({surface:'deck',floor,kind:'stairs',bounds:{...stair.reserved}});
  }
  const active=floors.find(f=>f.id===activeFloor)??floors[0];
  return {deck:active.deck,deckOuter:active.outer,activeFloor:active.id,floors,radius,actors:(options.actors??[]).map(a=>({...a,location:copyLocation(a.location)})),
    obstacles,links,roadOuter:{left:65,top:505,right:340,bottom:685},road:{left:65+radius,top:505+radius,right:340-radius,bottom:685-radius},ladder};
}
function obstaclesFor(world:NavigationWorld,floor:number):NavigationRect[] {
  const clearance=floor?margin(world.radius):{x:world.radius,y:world.radius};
  const result=world.obstacles.filter(o=>floor?o.surface==='deck'&&o.floor===floor:o.surface==='road').map(o=>inflate(o.bounds,clearance.x,clearance.y));
  for(const actor of world.actors.filter(a=>floorId(a.location)===floor)){
    const point=floor?unprojectDeckPoint(actor.location.point,floor as TruckFloor):actor.location.point,
      m=floor?margin(world.radius+actor.radius):{x:world.radius+actor.radius,y:world.radius+actor.radius};
    result.push({left:point[0]-m.x,top:point[1]-m.y,right:point[0]+m.x,bottom:point[1]+m.y});
  }
  return result;
}
function actorsFor(world:NavigationWorld,floor:number) {
  return world.actors.filter(actor=>floorId(actor.location)===floor);
}
function staticFor(world:NavigationWorld,floor:number) {
  return world.obstacles.filter(obstacle=>floor?obstacle.surface==='deck'&&obstacle.floor===floor:obstacle.surface==='road');
}
function obstaclePolygon(obstacle:NavigationObstacle):NavigationPoint[] {
  const r=obstacle.bounds;
  return [[r.left,r.top],[r.right,r.top],[r.right,r.bottom],[r.left,r.bottom]].map(point=>obstacle.surface==='deck'
    ?projectDeckPoint(point as NavigationPoint,obstacle.floor??1):point as NavigationPoint);
}
function occupied(world:NavigationWorld,floor:number,point:MotionPoint) {
  return staticFor(world,floor).some(obstacle=>circleOverlapsPolygon(point,world.radius,obstaclePolygon(obstacle)))
    ||actorsFor(world,floor).some(actor=>distance(point,actor.location.point)<world.radius+actor.radius-.01);
}
function crossesObstacle(world:NavigationWorld,floor:number,from:MotionPoint,to:MotionPoint,obstacle:NavigationObstacle) {
  const uvFrom=floor?unprojectDeckPoint(from,floor as TruckFloor):from,
    uvTo=floor?unprojectDeckPoint(to,floor as TruckFloor):to,clearance=floor?margin(world.radius):{x:world.radius,y:world.radius};
  if(!crossesRect(uvFrom,uvTo,inflate(obstacle.bounds,clearance.x,clearance.y)))return false;
  const polygon=obstaclePolygon(obstacle);
  if(crossesRect(uvFrom,uvTo,obstacle.bounds))return true;
  return polygon.some((point,index)=>{
    const next=polygon[(index+1)%polygon.length];
    return Math.min(distanceToSegment(point,from,to),distanceToSegment(next,from,to),
      distanceToSegment(from,point,next),distanceToSegment(to,point,next))<world.radius-.01;
  });
}
function boundsFor(world:NavigationWorld,floor:number) { return floor?world.floors.find(f=>f.id===floor)?.deck:world.road; }
export function groundLocation(world:NavigationWorld,point:MotionPoint,floor=world.activeFloor):NavigationLocation|undefined {
  if(!finite(point))return;
  const deck=world.floors.find(f=>f.id===floor),uv=unprojectDeckPoint(point,floor);
  if(deck&&inside(uv,deck.outer)){
    if(inside(uv,deck.deck)&&!occupied(world,floor,point))return{surface:'deck',floor,point:[...point]};
    return;
  }
  if(floor===1&&inside(point,world.road)&&!occupied(world,0,point))return{surface:'road',point:[...point]};
}
function crossesRect(a:MotionPoint,b:MotionPoint,r:NavigationRect):boolean {
  let low=0,high=1;
  for(let axis=0;axis<2;axis++){
    const min=(axis?r.top:r.left)+1e-6,max=(axis?r.bottom:r.right)-1e-6,delta=b[axis]-a[axis];
    if(Math.abs(delta)<1e-9){if(a[axis]<=min||a[axis]>=max)return false;}
    else {const first=(min-a[axis])/delta,last=(max-a[axis])/delta;low=Math.max(low,Math.min(first,last));high=Math.min(high,Math.max(first,last));if(low>=high)return false;}
  }
  return high>0&&low<1&&low<high;
}
function floorPath(world:NavigationWorld,floor:number,from:MotionPoint,to:MotionPoint):NavigationPoint[]|undefined {
  // This graph reuses the same immutable nodes for many edges. Project each
  // node and static footprint once per call; exact collision semantics stay intact.
  const projected=new Map<MotionPoint,NavigationPoint>(),
    convert=(p:MotionPoint):NavigationPoint=>floor?unprojectDeckPoint(p,floor as TruckFloor):[...p],
    project=(p:MotionPoint):NavigationPoint=>{
      let result=projected.get(p);if(!result){result=floor?projectDeckPoint(p,floor as TruckFloor):[...p];projected.set(p,result);}return result;
    };
  const start=convert(from),target=convert(to),bounds=boundsFor(world,floor);if(!bounds)return;
  const clearance=floor?margin(world.radius):{x:world.radius,y:world.radius},actors=actorsFor(world,floor),
    solids=staticFor(world,floor).map(obstacle=>({raw:obstacle.bounds,bounds:inflate(obstacle.bounds,clearance.x,clearance.y),polygon:obstaclePolygon(obstacle)})),
    obstacles=obstaclesFor(world,floor),valid=(p:MotionPoint)=>inside(p,bounds)
      &&!solids.some(solid=>inside(p,solid.bounds)&&circleOverlapsPolygon(project(p),world.radius,solid.polygon))
      &&!actors.some(actor=>distance(project(p),actor.location.point)<world.radius+actor.radius-.01);
  if(!valid(start)||!valid(target))return;
  const clear=(a:MotionPoint,b:MotionPoint)=>{
    const from=project(a),to=project(b);
    return !solids.some(solid=>{
      if(!crossesRect(a,b,solid.bounds))return false;
      if(crossesRect(a,b,solid.raw))return true;
      return solid.polygon.some((point,index)=>{
        const next=solid.polygon[(index+1)%solid.polygon.length];
        return Math.min(distanceToSegment(point,from,to),distanceToSegment(next,from,to),
          distanceToSegment(from,point,next),distanceToSegment(to,point,next))<world.radius-.01;
      });
    })&&!actors.some(actor=>distanceToSegment(actor.location.point,from,to)<world.radius+actor.radius-.01);
  };
  if(clear(start,target))return[project(start),project(target)];
  const nodes:NavigationPoint[]=[start,target];
  for(const r of obstacles)for(const p of [[r.left-.5,r.top-.5],[r.right+.5,r.top-.5],[r.right+.5,r.bottom+.5],[r.left-.5,r.bottom+.5]]as NavigationPoint[])if(valid(p))nodes.push(p);
  const cost=nodes.map(()=>Infinity),previous=nodes.map(()=>-1),visited=new Set<number>();cost[0]=0;
  while(visited.size<nodes.length){
    let current=-1;for(let i=0;i<nodes.length;i++)if(!visited.has(i)&&(current<0||cost[i]<cost[current]))current=i;
    if(current<0||!Number.isFinite(cost[current]))return;if(current===1)break;visited.add(current);
    for(let next=0;next<nodes.length;next++)if(!visited.has(next)&&clear(nodes[current],nodes[next])){
      const total=cost[current]+distance(project(nodes[current]),project(nodes[next]));if(total<cost[next]){cost[next]=total;previous[next]=current;}
    }
  }
  if(!Number.isFinite(cost[1]))return;
  const path:NavigationPoint[]=[];for(let i=1;i>=0;i=previous[i])path.unshift(project(nodes[i]));return path;
}
function escapePoint(world:NavigationWorld,location:NavigationLocation):NavigationPoint|undefined {
  if(location.surface==='ladder')return;
  const floor=floorId(location),project=(p:MotionPoint):NavigationPoint=>floor?projectDeckPoint(p,floor as TruckFloor):[...p],
    start=floor?unprojectDeckPoint(location.point,floor as TruckFloor):location.point,bounds=boundsFor(world,floor);if(!bounds||!inside(start,bounds))return;
  // Visibility nodes use conservative UV boxes. Only a real physical overlap can
  // change the retained return point; a nearby diagonal pet must not do so.
  if(!occupied(world,floor,location.point))return;
  const obstacles=obstaclesFor(world,floor),containing=obstacles.filter(r=>inside(start,r));if(!containing.length)return;
  const candidates:NavigationPoint[]=[];
  for(const r of containing)candidates.push([r.left-.5,start[1]],[r.right+.5,start[1]],[start[0],r.top-.5],[start[0],r.bottom+.5],
    [r.left-.5,r.top-.5],[r.right+.5,r.top-.5],[r.right+.5,r.bottom+.5],[r.left-.5,r.bottom+.5]);
  const otherObstacles=staticFor(world,floor).filter(obstacle=>!circleOverlapsPolygon(location.point,world.radius,obstaclePolygon(obstacle))),
    otherActors=actorsFor(world,floor).filter(actor=>distance(location.point,actor.location.point)>=world.radius+actor.radius-.01);
  return candidates.filter(p=>inside(p,bounds)&&!occupied(world,floor,project(p)))
    .filter(p=>!otherObstacles.some(obstacle=>crossesObstacle(world,floor,location.point,project(p),obstacle))
      &&!otherActors.some(actor=>distanceToSegment(actor.location.point,location.point,project(p))<world.radius+actor.radius-.01))
    .sort((a,b)=>distance(project(start),project(a))-distance(project(start),project(b))).map(project)[0];
}
/** Multi-floor routes always use a built stair link; selecting a view never teleports feet. */
export function planNavigation(world:NavigationWorld,start:NavigationLocation,target:NavigationLocation):NavigationPath|undefined {
  if(!finite(start.point)||!finite(target.point)||!['deck','road','ladder'].includes(start.surface)||(target.surface!=='deck'&&target.surface!=='road'))return;
  const points:NavigationPoint[]=[[...start.point]],surfaces:NavigationSurface[]=[],segments:NavigationPath['segments']=[];
  const append=(point:MotionPoint,surface:NavigationSurface,fromFloor:number,toFloor=fromFloor,link?:string)=>{
    if(distance(points[points.length-1],point)>1e-6){points.push([...point]);surfaces.push(surface);segments.push({fromFloor,toFloor,...(link?{link}:{})});}
  };
  const floor=(id:number,destination:MotionPoint)=>{const path=floorPath(world,id,points[points.length-1],destination);if(!path)return false;
    for(const point of path.slice(1))append(point,id?'deck':'road',id);return true;};
  const pointFloor=(link:NavigationLink,index:number)=>link.lower===0?index===0?0:1:index<2?link.lower:link.upper;
  const appendLink=(link:NavigationLink,indices:number[])=>{
    for(let n=1;n<indices.length;n++)append(link.points[indices[n]],'ladder',pointFloor(link,indices[n-1]),pointFloor(link,indices[n]),link.id);
  };
  let current=floorId(start),returnIndex=0;
  if(start.surface==='ladder'){
    const found=world.links.flatMap(link=>link.points.slice(1).map((p,index)=>({link,index,a:link.points[index],b:p})))
      .find(({link,a,b})=>(!start.link||start.link===link.id)&&Math.abs(distance(a,start.point)+distance(start.point,b)-distance(a,b))<.01);
    if(!found)return;
    const towardUpper=floorId(target)>=found.link.upper,indices=towardUpper?found.link.points.map((_,i)=>i).slice(found.index+1):found.link.points.map((_,i)=>i).slice(0,found.index+1).reverse();
    append(found.link.points[indices[0]],'ladder',pointFloor(found.link,found.index),pointFloor(found.link,indices[0]),found.link.id);
    appendLink(found.link,indices);
    current=towardUpper?found.link.upper:found.link.lower;
  }else{
    if(start.surface==='deck'&&current===1&&!inside(unprojectDeckPoint(start.point),world.floors[0].deck)){
      const {entry,top}=world.ladder;if(Math.abs(distance(entry,start.point)+distance(start.point,top)-distance(entry,top))<.01)append(entry,'ladder',1,1,'road-1');
    }
    const escaped=escapePoint(world,{...start,point:points[points.length-1]});
    if(escaped){append(escaped,start.surface,current);returnIndex=points.length-1;}
  }
  const destination=floorId(target);
  while(current!==destination){
    const up=current<destination,link=world.links.find(l=>up?l.lower===current:l.upper===current);if(!link)return;
    const route=up?link.points:[...link.points].reverse();if(!floor(current,route[0]))return;
    appendLink(link,up?link.points.map((_,i)=>i):link.points.map((_,i)=>i).reverse());
    current=up?link.upper:link.lower;
  }
  if(!floor(current,target.point))return;
  const climbSegments=surfaces.flatMap((surface,index)=>surface==='ladder'?[index]:[]),motion=createMotionRoute(points,climbSegments),
    returnMotion=returnIndex?createMotionRoute(points.slice(returnIndex),climbSegments.filter(i=>i>=returnIndex).map(i=>i-returnIndex)):motion;
  return{points,surfaces,segments,climbSegments,start:copyLocation(start),target:copyLocation(target),motion,returnIndex,returnMotion,
    returnLocation:{point:[...points[returnIndex]],surface:returnIndex?surfaces[returnIndex-1]:start.surface,...(returnIndex&&floorId(start)?{floor:floorId(start)as TruckFloor}:start.floor?{floor:start.floor}:{}),...(start.link?{link:start.link}:{})}};
}
/** Immobile companions remain physical blockers; choose another real work edge. */
export function planWorkNavigation(world:NavigationWorld,start:NavigationLocation,approaches:readonly NavigationLocation[]):NavigationPath|undefined {
  for(const target of approaches){
    const route=planNavigation(world,start,target);if(!route)continue;
    if(route.segments.some(segment=>segment.link&&world.actors.some(actor=>actor.location.surface==='ladder'&&actor.location.link===segment.link)))continue;
    return route;
  }
}
/** A healthy resident can take a short clear step when long patrols cannot yield. */
export function planYieldNavigation(world:NavigationWorld,start:NavigationLocation,reserved:readonly NavigationLocation[],reservedRadius=HERO_BODY_RADIUS):NavigationPath|undefined {
  const reservedLinks=new Set([...(start.surface==='ladder'&&start.link?[start.link]:[]),...reserved.flatMap(location=>location.surface==='ladder'&&location.link?[location.link]:[])]),
    occupiedLinks=world.links.filter(link=>reservedLinks.has(link.id)),
    landingReservations:NavigationLocation[]=occupiedLinks.flatMap(link=>link.points.map((point,index)=>({point,surface:(link.lower===0&&index===0?'road':'deck')as NavigationSurface,
      ...(link.lower===0&&index===0?{}:{floor:(link.lower===0?1:index<2?link.lower:link.upper)as TruckFloor})}))),
    bases:{point:NavigationPoint;floor:number}[]=start.surface==='ladder'
    ?occupiedLinks.filter(link=>link.id===start.link).flatMap(link=>[{point:link.points[0],floor:link.lower},{point:link.points[link.points.length-1],floor:link.upper}])
    :[{point:start.point,floor:floorId(start)}];
  const collectCandidates=(reaches:readonly number[])=>{
    const candidates:NavigationLocation[]=[];
    for(const base of bases)for(const reach of reaches)for(let direction=0;direction<16;direction++){
      const angle=direction*Math.PI/8,point:NavigationPoint=[base.point[0]+Math.cos(angle)*reach,base.point[1]+Math.sin(angle)*reach],
        location=groundLocation(world,point,(base.floor||1)as TruckFloor);
      if(!location||floorId(location)!==base.floor)continue;
      if([...reserved,...landingReservations].some(goal=>floorId(goal)===base.floor&&distance(point,goal.point)<world.radius+reservedRadius+2))continue;
      if(occupiedLinks.some(link=>(base.floor===link.lower||base.floor===link.upper)&&link.points.slice(1).some((to,index)=>
        distanceToSegment(point,link.points[index],to)<world.radius+reservedRadius+2)))continue;
      candidates.push(location);
    }
    return candidates;
  };
  const candidates=collectCandidates([18,28,42,56]);
  candidates.sort((a,b)=>distance(start.point,a.point)-distance(start.point,b.point));
  for(const destination of candidates){const route=planNavigation(world,start,destination);if(route&&route.motion.distance>1)return route;}
  // Larger companions at a rail can need more room than the first short step.
  // Preserve every existing successful exit; only compare longer routes when all short exits failed.
  let fallback:NavigationPath|undefined;
  for(const destination of collectCandidates([84,112])){
    const route=planNavigation(world,start,destination);
    if(route&&route.motion.distance>1&&(!fallback||route.motion.duration<fallback.motion.duration))fallback=route;
  }
  return fallback;
}
export function sampleNavigation(path:NavigationPath,elapsed:number,returning=false){
  const route=returning?path.returnMotion:path.motion,motion=sampleMotionRoute(route,elapsed,returning);
  const segments=returning?[...route.segments].reverse():route.segments,surfaces=returning?[...path.surfaces.slice(path.returnIndex)].reverse():path.surfaces,
    metadata=returning?[...path.segments.slice(path.returnIndex)].reverse().map(s=>({...s,fromFloor:s.toFloor,toFloor:s.fromFloor})):path.segments;
  let remaining=motion.distance,location=copyLocation(returning?path.returnLocation:path.target);
  if(elapsed<route.duration)for(let i=0;i<segments.length;i++){
    if(remaining<segments[i].distance-1e-7){const m=metadata[i],floor=(remaining/segments[i].distance<.5?m.fromFloor:m.toFloor)||1;
      location={point:[...motion.point],surface:surfaces[i],...(surfaces[i]!=='road'?{floor:floor as TruckFloor}:{}),...(m.link?{link:m.link}:{})};break;}
    remaining-=segments[i].distance;
  }
  return{...motion,location:{...location,point:[...motion.point]as NavigationPoint}};
}
export function distanceToSegment(point:MotionPoint,from:MotionPoint,to:MotionPoint):number {
  const dx=to[0]-from[0],dy=to[1]-from[1],denominator=dx*dx+dy*dy,
    ratio=denominator?Math.max(0,Math.min(1,((point[0]-from[0])*dx+(point[1]-from[1])*dy)/denominator)):0;
  return distance(point,[from[0]+dx*ratio,from[1]+dy*ratio]);
}
export function circleOverlapsPolygon(point:MotionPoint,radius:number,polygon:readonly MotionPoint[]):boolean {
  let inside=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
    const a=polygon[i],b=polygon[j];
    if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
    if(distanceToSegment(point,a,b)<radius-.01)return true;
  }
  return inside;
}
/** Swept feet, rather than endpoints alone, stop fast actors crossing a companion. */
export function blocksActorStep(from:NavigationLocation,to:NavigationLocation,radius:number,actors:readonly NavigationActor[]):NavigationActor|undefined {
  return actors.find(a=>{
    const same=(to.surface==='ladder'||a.location.surface==='ladder')
      ?(to.link!==undefined&&to.link===a.location.link)||floorId(to)===floorId(a.location)
      :floorId(to)===floorId(a.location)&&to.surface===a.location.surface;
    return same&&distanceToSegment(a.location.point,from.point,to.point)<radius+a.radius-.01;
  });
}
export function getPatrolTargets(world:NavigationWorld,floor:TruckFloor):NavigationLocation[] {
  const bounds=world.floors.find(f=>f.id===floor)?.deck;if(!bounds)return[];
  const result:NavigationLocation[]=[];
  const rows=new Set<number>([0,14]);for(let v=bounds.top+12;v<bounds.bottom-12;v+=48)rows.add(v);
  for(const v of rows)for(let u=bounds.left+12;u<bounds.right-12;u+=52){
    const location=groundLocation(world,projectDeckPoint([u,v],floor),floor);if(location?.surface==='deck')result.push(location);
  }
  return result;
}
