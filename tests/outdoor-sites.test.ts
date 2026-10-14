import test from 'node:test';
import assert from 'node:assert/strict';
import { getOutdoorSite, getOutdoorSiteIndex, getOutdoorSites, getOutdoorTrees, OUTDOOR_SITES } from '../src/outdoor-sites';
import { getTruckGroundFootprint } from '../src/truck-ground';
import { GROUND_RESOURCE_NODES } from '../src/ground-resources';
import { getPetPassageGeometry } from '../src/pet-passage';
import { circleOverlapsPolygon, createNavigationWorld, distanceToSegment, groundLocation, navigationObstaclePolygon,
  planNavigation, sampleNavigation, type NavigationPoint } from '../src/scene-navigation';

const road=(point:NavigationPoint)=>({surface:'road' as const,point});
const corners=(r:{left:number;top:number;right:number;bottom:number}):NavigationPoint[]=>
  [[r.left,r.top],[r.right,r.top],[r.right,r.bottom],[r.left,r.bottom]];
function segmentDistance(a:NavigationPoint,b:NavigationPoint,c:NavigationPoint,d:NavigationPoint):number {
  const rx=b[0]-a[0],ry=b[1]-a[1],sx=d[0]-c[0],sy=d[1]-c[1],det=rx*sy-ry*sx;
  if(Math.abs(det)>1e-9){const cx=c[0]-a[0],cy=c[1]-a[1],t=(cx*sy-cy*sx)/det,u=(cx*ry-cy*rx)/det;
    if(t>=0&&t<=1&&u>=0&&u<=1)return 0;}
  return Math.min(distanceToSegment(a,c,d),distanceToSegment(b,c,d),distanceToSegment(c,a,b),distanceToSegment(d,a,b));
}

test('legacy places represent stable first individual nodes and return detached geometry copies',()=>{
  const sites=getOutdoorSites(),trees=getOutdoorTrees();
  assert.deepEqual(sites.map(site=>site.id),['grove','salvage','seed-meadow','spring']);
  for(const[index,site]of sites.entries()){
    const node=GROUND_RESOURCE_NODES.find(node=>node.legacySiteId===site.id)!;
    assert.deepEqual(site.point,node.point);assert.deepEqual(site.bounds,node.bounds);assert.deepEqual(site.approaches,node.approaches);
    assert.equal(site.kind,node.action);assert.equal(site.resource,node.resource);
    assert.equal(getOutdoorSiteIndex(site.id),index);assert.deepEqual(getOutdoorSite(site.id),site);
  }
  assert.equal(getOutdoorSite('invalid'),undefined);assert.equal(trees.length,16);
  assert.deepEqual(trees.map(tree=>tree.id),GROUND_RESOURCE_NODES.filter(node=>node.kind==='tree').map(node=>node.id));
  const original=JSON.stringify({sites:getOutdoorSites(),trees:getOutdoorTrees()});
  sites[0].point[1]=0;sites[0].approaches[0][0]=0;sites[0].bounds.top=0;trees[0].point[1]=0;
  assert.equal(JSON.stringify({sites:getOutdoorSites(),trees:getOutdoorTrees()}),original);
  assert.deepEqual(OUTDOOR_SITES[0].point,GROUND_RESOURCE_NODES[0].point);
});

test('all eight expansions leave the complete fixed ground places and sixteen individual trunks separate from the chassis',()=>{
  for(let level=1;level<=8;level++){
    const body=getTruckGroundFootprint(level).polygon,sites=getOutdoorSites(level),trees=getOutdoorTrees(level);
    assert.deepEqual(sites,getOutdoorSites(1),'the truck cannot pull ground resources along as it grows');
    assert.deepEqual(trees,getOutdoorTrees(1),'the whole forest uses permanent world coordinates');
    for(const site of sites){
      for(const point of [...corners(site.bounds),...site.approaches])
        assert.equal(circleOverlapsPolygon(point,30.8,body),false,`level ${level} ${site.id} keeps the complete largest body outside the truck`);
      const footprint=corners(site.bounds);
      for(let edge=0;edge<footprint.length;edge++)for(let bodyEdge=0;bodyEdge<body.length;bodyEdge++)
        assert.ok(segmentDistance(footprint[edge],footprint[(edge+1)%footprint.length],body[bodyEdge],body[(bodyEdge+1)%body.length])>=30.8,
          `level ${level} ${site.id} keeps the entire prop footprint and paw margin clear`);
      for(const approach of site.approaches)for(const tree of trees)
        assert.equal(circleOverlapsPolygon(approach,30.8,corners(tree.bounds)),false,
          `level ${level} ${site.id} does not send complete animals into a tree`);
    }
    for(const tree of trees)for(const point of corners(tree.bounds))assert.equal(circleOverlapsPolygon(point,30.8,body),false);
  }
});

test('every site and approach admits real exterior hero and largest-pet routes at all eight levels',()=>{
  for(let level=1;level<=8;level++)for(const radius of[7,30.8]){
    const world=createNavigationWorld(level,3,[],{radius,actor:radius===7?'hero':'pet',petPassageOpen:true}),
      start=road(radius===7?world.ladder.bottom:getPetPassageGeometry(level).ground),body=getTruckGroundFootprint(level).polygon;
    assert.ok(groundLocation(world,start.point,1,'road'),`level ${level} radius ${radius} starts on its real clear landing`);
    for(const site of getOutdoorSites(level)){
      assert.equal(groundLocation(world,site.point,1,'road'),undefined,'resource and tree trunks remain solid');
      for(const approach of site.approaches){
        assert.ok(groundLocation(world,approach,1,'road'),`level ${level} ${site.id} radius ${radius} fits its full approach`);
        const route=planNavigation(world,start,road(approach));assert.ok(route,`level ${level} ${site.id} radius ${radius} has an exterior route`);
        assert.equal(route.climbSegments.length,0);assert.equal(route.returnIndex,0);
        for(let index=0;index<route.segments.length;index++){
          assert.equal(route.surfaces[index],'road');assert.equal(route.segments[index].fromFloor,0);assert.equal(route.segments[index].toFloor,0);
          for(const obstacle of world.obstacles.filter(obstacle=>obstacle.surface==='road')){
            const polygon=navigationObstaclePolygon(obstacle);
            for(let edge=0;edge<polygon.length;edge++)
              assert.ok(segmentDistance(route.points[index],route.points[index+1],polygon[edge],polygon[(edge+1)%polygon.length])>=radius-.01,
                `level ${level} ${site.id} swept radius ${radius} stays outside ${obstacle.kind}`);
          }
          for(let edge=0;edge<body.length;edge++)
            assert.ok(segmentDistance(route.points[index],route.points[index+1],body[edge],body[(edge+1)%body.length])>=radius-.01,
              'a complete accepted sweep cannot pass through the truck between clear endpoints');
        }
        const arrived=sampleNavigation(route,route.motion.duration).point,returned=sampleNavigation(route,route.returnMotion.duration,true).point;
        assert.ok(Math.hypot(arrived[0]-approach[0],arrived[1]-approach[1])<1e-7);
        assert.ok(Math.hypot(returned[0]-start.point[0],returned[1]-start.point[1])<1e-7);
      }
    }
  }
});
