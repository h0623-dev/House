import test from 'node:test';
import assert from 'node:assert/strict';
import { GROUND_RESOURCE_APPROACH_RADIUS, GROUND_RESOURCE_BOUNDS, GROUND_RESOURCE_NODES,
  GROUND_RESOURCE_ZONES, getGroundResourceNode, getGroundResourceZone,
  type GroundBounds, type GroundPoint } from '../src/ground-resources';
import { circleOverlapsPolygon, createNavigationWorld, groundLocation, navigationObstaclePolygon,
  planNavigation, sampleNavigation, sweptCircleOverlapsPolygon } from '../src/scene-navigation';
import { getTruckGroundFootprint } from '../src/truck-ground';
import { getPetPassageGeometry } from '../src/pet-passage';

const rect = (bounds:GroundBounds):GroundPoint[] => [[bounds.left,bounds.top],[bounds.right,bounds.top],
  [bounds.right,bounds.bottom],[bounds.left,bounds.bottom]];
const distance = (a:readonly number[],b:readonly number[]) => Math.hypot(a[0]-b[0],a[1]-b[1]);
const road = (point:GroundPoint) => ({surface:'road' as const,point});

test('the fixed ground catalog contains individually addressable trees and multiple nodes of every resource',()=>{
  assert.equal(GROUND_RESOURCE_NODES.length,28);
  assert.equal(new Set(GROUND_RESOURCE_NODES.map(node=>node.id)).size,28);
  assert.deepEqual(['wood','scrap','seeds','water'].map(resource=>
    GROUND_RESOURCE_NODES.filter(node=>node.resource===resource).length),[16,4,4,4]);
  assert.deepEqual(GROUND_RESOURCE_NODES.filter(node=>node.legacySiteId).map(node=>node.legacySiteId).sort(),
    ['grove','salvage','seed-meadow','spring'].sort());
  for(const node of GROUND_RESOURCE_NODES){
    assert.equal(getGroundResourceNode(node.id),node);
    assert.equal(node.zoneId,node.siteId);
    assert.ok(node.name);assert.ok(node.approaches.length>=4,`${node.id} offers several full-body work stops`);
    assert.equal(getGroundResourceZone(node.siteId)?.id,node.zoneId);
    if(node.legacySiteId)assert.ok(node.id.endsWith('-01'));
  }
  assert.equal(getGroundResourceNode('grove'),undefined);
  assert.equal(getGroundResourceNode('tree-17'),undefined);
  assert.equal(getGroundResourceNode(null),undefined);
  assert.equal(getGroundResourceZone('missing'),undefined);
});

test('all eight truck silhouettes leave complete individual ground props and approach circles detached',()=>{
  const authored=JSON.stringify(GROUND_RESOURCE_NODES);
  for(let level=1;level<=8;level++){
    const body=getTruckGroundFootprint(level).polygon;
    for(const node of GROUND_RESOURCE_NODES){
      const footprint=rect(node.bounds);
      for(let edge=0;edge<footprint.length;edge++)assert.equal(
        sweptCircleOverlapsPolygon(footprint[edge],footprint[(edge+1)%footprint.length],GROUND_RESOURCE_APPROACH_RADIUS+2,body),false,
        `level ${level}: the complete ${node.id} footprint stays outside the actual maximum-width chassis`);
      for(const point of node.approaches){
        assert.equal(circleOverlapsPolygon(point,GROUND_RESOURCE_APPROACH_RADIUS+2,body),false,
          `level ${level}: ${node.id} leaves the complete largest animal outside the truck`);
        for(const other of GROUND_RESOURCE_NODES)assert.equal(
          circleOverlapsPolygon(point,GROUND_RESOURCE_APPROACH_RADIUS+2,rect(other.bounds)),false,
          `${node.id} work stops do not send an animal into ${other.id}`);
      }
    }
    assert.equal(JSON.stringify(GROUND_RESOURCE_NODES),authored,'truck growth cannot translate ground resources');
  }
});

test('forest crowns form natural clusters around a continuous trail wide enough for two complete animals',()=>{
  const grove=getGroundResourceZone('grove')!,trees=GROUND_RESOURCE_NODES.filter(node=>node.kind==='tree');
  assert.ok(grove.path.length>=4,'the forest contains a visible winding walkable path');
  assert.ok(grove.pathWidth>=2*GROUND_RESOURCE_APPROACH_RADIUS*2+4);
  for(const tree of trees){
    assert.ok(trees.some(other=>other!==tree&&distance(tree.point,other.point)<111*(tree.scale+other.scale)/2),
      `${tree.id} belongs to a cluster with overlapping painted crowns`);
    const crown={left:tree.point[0]-111*tree.scale/2,right:tree.point[0]+111*tree.scale/2,
      top:tree.point[1]-146*tree.scale,bottom:tree.point[1]};
    assert.ok(crown.left>=grove.bounds.left&&crown.right<=grove.bounds.right&&crown.top>=grove.bounds.top&&crown.bottom<=grove.bounds.bottom);
    for(let edge=0;edge<4;edge++)assert.equal(
      sweptCircleOverlapsPolygon(rect(crown)[edge],rect(crown)[(edge+1)%4],GROUND_RESOURCE_APPROACH_RADIUS,getTruckGroundFootprint(8).polygon),false,
      `${tree.id}'s entire painted crown also looks detached from the maximum truck silhouette`);
  }
  for(const zone of GROUND_RESOURCE_ZONES){
    assert.ok(zone.pathWidth>=100);
    for(let index=1;index<zone.path.length;index++){
      const from=zone.path[index-1],to=zone.path[index];
      for(const node of GROUND_RESOURCE_NODES)assert.equal(
        sweptCircleOverlapsPolygon(from,to,zone.pathWidth/2,rect(node.bounds)),false,
        `${zone.id}'s entire painted trail width remains clear of ${node.id}`);
      for(let level=1;level<=8;level++)assert.equal(
        sweptCircleOverlapsPolygon(from,to,zone.pathWidth/2,getTruckGroundFootprint(level).polygon),false,
        `${zone.id}'s trail stays outside truck level ${level}`);
    }
  }
});

test('zone bounds include complete work-stop circles and the two-animal forest trail',()=>{
  for(const node of GROUND_RESOURCE_NODES){
    const zone=getGroundResourceZone(node.zoneId)!;
    for(const [x,y] of node.approaches){
      assert.ok(x-GROUND_RESOURCE_APPROACH_RADIUS>=zone.bounds.left&&x+GROUND_RESOURCE_APPROACH_RADIUS<=zone.bounds.right);
      assert.ok(y-GROUND_RESOURCE_APPROACH_RADIUS>=zone.bounds.top&&y+GROUND_RESOURCE_APPROACH_RADIUS<=zone.bounds.bottom);
    }
  }
  for(const zone of GROUND_RESOURCE_ZONES){
    assert.ok(zone.bounds.left>=GROUND_RESOURCE_BOUNDS.left&&zone.bounds.right<=GROUND_RESOURCE_BOUNDS.right);
    assert.ok(zone.bounds.top>=GROUND_RESOURCE_BOUNDS.top&&zone.bounds.bottom<=GROUND_RESOURCE_BOUNDS.bottom);
    for(const [x,y] of zone.path){
      assert.ok(x-zone.pathWidth/2>=zone.bounds.left&&x+zone.pathWidth/2<=zone.bounds.right);
      assert.ok(y-zone.pathWidth/2>=zone.bounds.top&&y+zone.pathWidth/2<=zone.bounds.bottom);
    }
  }
});

test('all eight truck levels admit full hero and largest-pet swept routes to every independent ground node',()=>{
  for(let level=1;level<=8;level++)for(const radius of [7,GROUND_RESOURCE_APPROACH_RADIUS]){
    const world=createNavigationWorld(level,3,[],{radius,actor:radius===7?'hero':'pet',petPassageOpen:true});
    assert.equal(world.obstacles.filter(obstacle=>obstacle.surface==='road'&&obstacle.kind!=='truck-body').length,28,
      'the live navigation world includes every individual ground trunk and prop');
    const start=road(radius===7?world.ladder.bottom:getPetPassageGeometry(level).ground);
    assert.ok(groundLocation(world,start.point,1,'road'));
    for(const node of GROUND_RESOURCE_NODES){
      assert.equal(groundLocation(world,node.point,1,'road'),undefined,'individual trunks and gathering props remain solid');
      for(const approach of node.approaches){
        assert.ok(groundLocation(world,approach,1,'road'),`${node.id} admits the full radius ${radius}`);
        const route=planNavigation(world,start,road(approach));
        assert.ok(route,`level ${level} radius ${radius} reaches ${node.id} through physical ground`);
        assert.equal(route.climbSegments.length,0);
        for(let index=0;index<route.segments.length;index++)for(const obstacle of world.obstacles.filter(obstacle=>obstacle.surface==='road'))
          assert.equal(sweptCircleOverlapsPolygon(route.points[index],route.points[index+1],radius,navigationObstaclePolygon(obstacle)),false,
            `the full level ${level} radius ${radius} route to ${node.id} clears every trunk and the chassis`);
        assert.ok(distance(sampleNavigation(route,route.motion.duration).point,approach)<1e-7);
        assert.ok(distance(sampleNavigation(route,route.returnMotion.duration,true).point,start.point)<1e-7);
      }
    }
  }
});
