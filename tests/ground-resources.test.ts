import test from 'node:test';
import assert from 'node:assert/strict';
import { GROUND_RESOURCE_APPROACH_RADIUS, GROUND_RESOURCE_BOUNDS, GROUND_RESOURCE_NODES,
  GROUND_RESOURCE_ZONES, LEGACY_GROUND_RESOURCE_IDS, getGroundResourceNode, getGroundResourceZone,
  type GroundBounds, type GroundPoint } from '../src/ground-resources';
import { GROUND_REGIONS, getGroundRegion } from '../src/ground-regions';
import { circleOverlapsPolygon, createNavigationWorld, groundLocation, navigationObstaclePolygon,
  planNavigation, sampleNavigation, sweptCircleOverlapsPolygon } from '../src/scene-navigation';
import { getTruckGroundFootprint } from '../src/truck-ground';
import { getPetPassageGeometry } from '../src/pet-passage';
import { getGroundResourceVisual, getGroundSpriteFrame, getGroundVisualBounds, getGroundVisualPolygon } from '../src/ground-visuals';

const rect = (bounds:GroundBounds):GroundPoint[] => [[bounds.left,bounds.top],[bounds.right,bounds.top],
  [bounds.right,bounds.bottom],[bounds.left,bounds.bottom]];
const distance = (a:readonly number[],b:readonly number[]) => Math.hypot(a[0]-b[0],a[1]-b[1]);
const road = (point:GroundPoint) => ({surface:'road' as const,point});

test('the fixed ground catalog contains individually addressable trees and multiple nodes of every resource',()=>{
  assert.equal(GROUND_RESOURCE_NODES.length,52);
  assert.equal(new Set(GROUND_RESOURCE_NODES.map(node=>node.id)).size,52);
  assert.deepEqual(['wood','scrap','seeds','water'].map(resource=>
    GROUND_RESOURCE_NODES.filter(node=>node.resource===resource).length),[22,10,10,10]);
  assert.deepEqual(GROUND_RESOURCE_NODES.filter(node=>node.legacySiteId).map(node=>node.legacySiteId).sort(),
    ['grove','salvage','seed-meadow','spring'].sort());
  for(const node of GROUND_RESOURCE_NODES){
    assert.equal(getGroundResourceNode(node.id),node);
    assert.equal(node.zoneId,node.siteId);
    assert.equal(getGroundRegion(node.regionId)?.id,node.regionId);
    assert.ok(node.name);assert.ok(node.approaches.length>=4,`${node.id} offers several full-body work stops`);
    assert.equal(getGroundResourceZone(node.siteId)?.id,node.zoneId);
    if(node.legacySiteId)assert.ok(node.id.endsWith('-01'));
  }
  assert.equal(getGroundResourceNode('grove'),undefined);
  assert.equal(getGroundResourceNode('tree-23'),undefined);
  assert.equal(getGroundResourceNode(null),undefined);
  assert.equal(getGroundResourceZone('missing'),undefined);
});

test('the original twenty-eight identities, selection indices, positions, scale and area geometry remain unchanged',()=>{
  const original = [
    ['tree-01',[-15,930],1.17],['tree-02',[-100,950],1.08],['tree-03',[35,1030],1.24],['tree-04',[-110,1045],.99],
    ['tree-05',[-55,1135],1.13],['tree-06',[80,1160],1.25],['tree-07',[-115,1225],1.07],['tree-08',[40,1280],1.18],
    ['tree-09',[260,945],1.21],['tree-10',[365,975],1.09],['tree-11',[435,1010],1.16],['tree-12',[275,1045],1.27],
    ['tree-13',[390,1100],1.02],['tree-14',[340,1200],1.20],['tree-15',[465,1200],1.10],['tree-16',[375,1290],1.23],
    ['seed-01',[568,965],1.04],['seed-02',[745,1000],1.12],['seed-03',[600,1140],.98],['seed-04',[782,1115],1.07],
    ['scrap-01',[938,980],1.03],['scrap-02',[1125,942],1.12],['scrap-03',[976,1138],.96],['scrap-04',[1178,1088],1.06],
    ['water-01',[1310,950],1.04],['water-02',[1510,975],.97],['water-03',[1343,1115],1.09],['water-04',[1530,1150],1.13],
  ];
  assert.deepEqual(GROUND_RESOURCE_NODES.slice(0,28).map(node=>[node.id,node.point,node.scale]),original);
  assert.deepEqual(LEGACY_GROUND_RESOURCE_IDS,original.map(([id])=>id));
  for(const zone of GROUND_RESOURCE_ZONES){
    const region=getGroundRegion(zone.id)!;
    assert.deepEqual(region.bounds,zone.bounds);assert.deepEqual(region.path,zone.path);assert.equal(region.pathWidth,zone.pathWidth);
    assert.ok(GROUND_RESOURCE_NODES.filter(node=>node.regionId===zone.id).every(node=>node.siteId===zone.id));
  }
});

test('seven actual places spread mixed resources west, north and east instead of making a longer southern strip',()=>{
  assert.equal(GROUND_REGIONS.length,7);assert.equal(new Set(GROUND_REGIONS.map(region=>region.id)).size,7);
  assert.equal(getGroundRegion('__proto__'),undefined);assert.equal(getGroundRegion(null),undefined);
  const truck=getTruckGroundFootprint(8).bounds,centers:GroundPoint[]=[];
  for(const id of ['west-grove','north-ruins','east-creek']as const){
    const region=getGroundRegion(id)!,nodes=GROUND_RESOURCE_NODES.filter(node=>node.regionId===id);
    assert.equal(nodes.length,8);assert.equal(new Set(nodes.map(node=>node.siteId)).size,4);
    assert.deepEqual(['tree','seed','scrap','water'].map(kind=>nodes.filter(node=>node.kind===kind).length),[2,2,2,2]);
    assert.ok(nodes.every(node=>!LEGACY_GROUND_RESOURCE_IDS.includes(node.id)&&!node.legacySiteId));
    assert.ok(region.name&&region.description);assert.ok(region.path.length>=3);
    const center:GroundPoint=[nodes.reduce((sum,node)=>sum+node.point[0],0)/nodes.length,
      nodes.reduce((sum,node)=>sum+node.point[1],0)/nodes.length];centers.push(center);
    if(id==='west-grove')assert.ok(nodes.every(node=>node.point[0]<truck.left-100));
    if(id==='east-creek')assert.ok(nodes.every(node=>node.point[0]>truck.right+100));
    if(id==='north-ruins')assert.ok(nodes.every(node=>node.point[1]<100),'north resources are genuinely above the former y>=930 strip');
    assert.ok(Math.max(...nodes.map(node=>node.point[0]))-Math.min(...nodes.map(node=>node.point[0]))>=100);
    assert.ok(Math.max(...nodes.map(node=>node.point[1]))-Math.min(...nodes.map(node=>node.point[1]))>=200);
    for(const tree of nodes.filter(node=>node.kind==='tree'))assert.ok(nodes.some(other=>other!==tree&&other.kind==='tree'
      &&distance(tree.point,other.point)<111*(tree.scale+other.scale)/2),'each new woodland contains a real overlapping cluster');
  }
  for(let first=0;first<centers.length;first++)for(let second=first+1;second<centers.length;second++)
    assert.ok(distance(centers[first],centers[second])>1000,'new resource destinations are geographically separate');
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
  const grove=getGroundResourceZone('grove')!,trees=GROUND_RESOURCE_NODES.filter(node=>node.kind==='tree'&&node.regionId==='grove');
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
  for(const zone of GROUND_REGIONS){
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
    const zone=getGroundRegion(node.regionId)!;
    for(const [x,y] of node.approaches){
      assert.ok(x-GROUND_RESOURCE_APPROACH_RADIUS>=zone.bounds.left&&x+GROUND_RESOURCE_APPROACH_RADIUS<=zone.bounds.right);
      assert.ok(y-GROUND_RESOURCE_APPROACH_RADIUS>=zone.bounds.top&&y+GROUND_RESOURCE_APPROACH_RADIUS<=zone.bounds.bottom);
    }
  }
  for(const zone of GROUND_REGIONS){
    assert.ok(zone.bounds.left>=GROUND_RESOURCE_BOUNDS.left&&zone.bounds.right<=GROUND_RESOURCE_BOUNDS.right);
    assert.ok(zone.bounds.top>=GROUND_RESOURCE_BOUNDS.top&&zone.bounds.bottom<=GROUND_RESOURCE_BOUNDS.bottom);
    for(const [x,y] of zone.path){
      assert.ok(x-zone.pathWidth/2>=zone.bounds.left&&x+zone.pathWidth/2<=zone.bounds.right);
      assert.ok(y-zone.pathWidth/2>=zone.bounds.top&&y+zone.pathWidth/2<=zone.bounds.bottom);
    }
  }
});

test('meadow, salvage and water resources occupy staggered clearings instead of matching rows',()=>{
  const midpoint=(a:GroundPoint,b:GroundPoint):GroundPoint=>[(a[0]+b[0])/2,(a[1]+b[1])/2];
  for(const id of ['seed-meadow','salvage','spring'] as const){
    const zone=getGroundResourceZone(id)!,nodes=GROUND_RESOURCE_NODES.filter(node=>node.regionId===id);
    assert.equal(nodes.length,4);
    assert.equal(new Set(nodes.map(node=>node.point[0])).size,4,`${id} does not place its props in two identical columns`);
    assert.equal(new Set(nodes.map(node=>node.point[1])).size,4,`${id} does not place its props in two identical rows`);
    // Opposite corners of a rectangle or parallelogram share a midpoint.
    // Reject that regular four-prop layout even when it has been rotated.
    for(const [a,b,c,d] of [[0,1,2,3],[0,2,1,3],[0,3,1,2]])assert.ok(
      distance(midpoint(nodes[a].point,nodes[b].point),midpoint(nodes[c].point,nodes[d].point))>5,
      `${id}'s props do not form a symmetric four-corner grid`);
    assert.ok(zone.path.length>=3,`${id} includes an authored bend through the clear space`);
    assert.ok(new Set(zone.path.map(point=>point[0])).size>=3,`${id}'s clear corridor does not repeat a vertical column`);
    for(let index=1;index<zone.path.length;index++)for(const node of GROUND_RESOURCE_NODES)assert.equal(
      sweptCircleOverlapsPolygon(zone.path[index-1],zone.path[index],zone.pathWidth/2,rect(node.bounds)),false,
      `${id} keeps the full corridor clear despite staggering ${node.id}`);
  }
});

test('all measured prop variants retain their contact point and complete artwork outside every truck hull',()=>{
  const treeVariants=new Set<number>();
  for(const node of GROUND_RESOURCE_NODES)for(const visual of node.kind==='tree'?[undefined,'stump']:[undefined]){
    const art=getGroundResourceVisual(node,visual),frame=getGroundSpriteFrame(art.sprite,art.variant),
      polygon=getGroundVisualPolygon(node,visual),[left,top,right,bottom]=getGroundVisualBounds(node,visual),
      zone=getGroundRegion(node.regionId)!,envelope=rect({left,top,right,bottom});
    if(node.kind==='tree'&&visual===undefined)treeVariants.add(art.variant);
    assert.ok(left>=zone.bounds.left&&right<=zone.bounds.right&&top>=zone.bounds.top&&bottom<=zone.bounds.bottom,
      `${node.id}'s ${visual??'living'} measured sprite stays inside its actual ground region`);
    assert.ok(circleOverlapsPolygon(node.point,0,polygon),`${node.id}'s contact remains inside its measured painted silhouette`);
    assert.ok(frame.anchor[0]>=frame.x&&frame.anchor[0]<=frame.x+frame.width
      &&frame.anchor[1]>=frame.y&&frame.anchor[1]<=frame.y+frame.height,
      'the measured contact belongs to the selected atlas crop');
    assert.ok(Math.abs(left+(frame.anchor[0]-frame.x)*art.width/frame.width-node.point[0])<1e-8
      &&Math.abs(top+(frame.anchor[1]-frame.y)*art.height/frame.height-node.point[1])<1e-8,
      `${node.id}'s different crop margins cannot offset the artwork from its physical contact`);
    for(const point of polygon)assert.ok(point[0]>=left&&point[0]<=right&&point[1]>=top&&point[1]<=bottom,
      'the actual clipped contour fits inside its measured crop');
    for(let level=1;level<=8;level++)for(const painted of [polygon,envelope])for(let edge=0;edge<painted.length;edge++)assert.equal(
      sweptCircleOverlapsPolygon(painted[edge],painted[(edge+1)%painted.length],GROUND_RESOURCE_APPROACH_RADIUS,getTruckGroundFootprint(level).polygon),false,
      `level ${level}: the full measured ${node.id} ${visual??'living'} artwork stays visually detached from the chassis`);
  }
  assert.equal(treeVariants.size,3,'all three differently measured tree variants participate in the hull-clearance audit');
});

test('all eight truck levels admit full hero and largest-pet swept routes to every independent ground node',()=>{
  for(let level=1;level<=8;level++)for(const radius of [7,GROUND_RESOURCE_APPROACH_RADIUS]){
    const world=createNavigationWorld(level,3,[],{radius,actor:radius===7?'hero':'pet',petPassageOpen:true});
    assert.equal(world.obstacles.filter(obstacle=>obstacle.surface==='road'&&obstacle.kind!=='truck-body').length,52,
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
