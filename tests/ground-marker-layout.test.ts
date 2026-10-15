import test from 'node:test';
import assert from 'node:assert/strict';
import { GROUND_RESOURCE_NODES, type GroundResourceNode } from '../src/ground-resources';
import { getGroundVisualBounds } from '../src/ground-visuals';
import { layoutGroundMarkers, type GroundMarker, type GroundMarkerInput, type GroundMarkerViewport } from '../src/ground-marker-layout';
import { GROUND_REGIONS } from '../src/ground-regions';

type Point=[number,number];
const forest=GROUND_RESOURCE_NODES.filter(node=>node.regionId==='grove');
const portrait:GroundMarkerViewport={left:0,top:0,right:344,bottom:600};
const narrow:GroundMarkerViewport={left:0,top:100,right:844,bottom:188};
const deepFreeze=<T>(value:T):T=>{
  if(value&&typeof value==='object'){
    Object.freeze(value);
    for(const child of Object.values(value))deepFreeze(child);
  }
  return value;
};
const project=(nodes:readonly GroundResourceNode[],scale:number,offset:Point,hero:Point=[0,900]):GroundMarkerInput[]=>nodes.map(node=>({
  id:node.id,index:GROUND_RESOURCE_NODES.indexOf(node),kind:node.kind,resource:node.resource,
  ready:true,active:false,affordable:true,remainingSeconds:0,
  anchor:[offset[0]+node.point[0]*scale,offset[1]+node.point[1]*scale],
  spriteBounds:getGroundVisualBounds(node).map((value,index)=>offset[index%2]+value*scale)as[number,number,number,number],
  distance:Math.hypot(node.point[0]-hero[0],node.point[1]-hero[1]),
}));
function fitted(nodes:readonly GroundResourceNode[],viewport:GroundMarkerViewport,requestedScale?:number){
  const sprites=nodes.map(node=>getGroundVisualBounds(node)),
    left=Math.min(...sprites.map(bounds=>bounds[0])),top=Math.min(...sprites.map(bounds=>bounds[1])),
    right=Math.max(...sprites.map(bounds=>bounds[2])),bottom=Math.max(...sprites.map(bounds=>bounds[3])),
    scale=requestedScale??Math.min((viewport.right-viewport.left)/(right-left),(viewport.bottom-viewport.top)/(bottom-top))*.96,
    offset:Point=[(viewport.left+viewport.right)/2-(left+right)/2*scale,
      (viewport.top+viewport.bottom)/2-(top+bottom)/2*scale];
  return{scale,nodes:project(nodes,scale,offset)};
}
function assertTouchable(markers:readonly GroundMarker[],viewport:GroundMarkerViewport,label:string){
  for(const marker of markers){
    const[left,top,right,bottom]=marker.hitScreenBounds,[artLeft,artTop,artRight,artBottom]=marker.screenBounds;
    assert.ok(Math.abs(right-left-68)<1e-7,`${label}: ${marker.nodeId} keeps its CSS width`);
    assert.ok(Math.abs(bottom-top-44)<1e-7,`${label}: ${marker.nodeId} retains a full 44px touch height`);
    assert.ok(Math.abs(artRight-artLeft-68)<1e-7);assert.ok(Math.abs(artBottom-artTop-34)<1e-7);
    assert.ok(left>=viewport.left-1e-7&&top>=viewport.top-1e-7&&right<=viewport.right+1e-7&&bottom<=viewport.bottom+1e-7,
      `${label}: complete ${marker.nodeId} target ${marker.hitScreenBounds} stays inside ${JSON.stringify(viewport)}`);
    assert.ok(artLeft>=left&&artRight<=right&&artTop>=top&&artBottom<=bottom);
  }
  for(let i=0;i<markers.length;i++)for(let j=i+1;j<markers.length;j++){
    const[a,b,c,d]=markers[i].hitScreenBounds,[e,f,g,h]=markers[j].hitScreenBounds;
    assert.ok(c<=e+1e-7||g<=a+1e-7||d<=f+1e-7||h<=b+1e-7,
      `${label}: ${markers[i].nodeId} and ${markers[j].nodeId} keep independently tappable targets`);
  }
}

test('overview markers show four real resource groups with Korean names and the correct product icons',()=>{
  for(const viewport of [portrait,narrow]){
    const fixture=fitted(GROUND_RESOURCE_NODES,viewport);
    assert.ok(fixture.scale<.65);
    const input=deepFreeze(fixture.nodes),before=structuredClone(input),markers=layoutGroundMarkers(input,fixture.scale,viewport);
    assert.equal(markers.length,4);
    assert.deepEqual(markers.map(marker=>[marker.resource,marker.label,marker.count,marker.readyCount]).sort(),
      [['wood','나무',22,22],['scrap','고철',10,10],['seeds','씨앗',10,10],['water','샘물',10,10]].sort());
    assert.equal(markers.reduce((total,marker)=>total+marker.count,0),52,
      'one compact control per resource type preserves the expanded seven-region catalog');
    assert.deepEqual(markers.flatMap(marker=>marker.nodeIds).sort(),GROUND_RESOURCE_NODES.map(node=>node.id).sort());
    assert.ok(markers.every(marker=>marker.status==='ready'&&marker.remainingSeconds===0));
    assertTouchable(markers,viewport,`overview ${viewport.right}×${viewport.bottom-viewport.top}`);
    assert.deepEqual(input,before,'projecting the controls cannot alter node readiness, navigation anchors or sprite contacts');
  }
});

test('selected mixed regions keep all eight local resources in four controls without including another place',()=>{
  for(const regionId of ['west-grove','north-ruins','east-creek'] as const)for(const viewport of [portrait,narrow]){
    const region=GROUND_REGIONS.find(region=>region.id===regionId)!,
      nodes=GROUND_RESOURCE_NODES.filter(node=>node.regionId===regionId),fixture=fitted(nodes,viewport),
      input=deepFreeze(fixture.nodes.map((node,index)=>({...node,ready:index%2===1,
        remainingSeconds:index%2===1?0:3,distance:index%2===1?100:1}))),before=structuredClone(input),
      markers=layoutGroundMarkers(input,fixture.scale,viewport);
    assert.ok(region.name);assert.equal(nodes.length,8);assert.equal(markers.length,4);
    assert.deepEqual(markers.map(marker=>[marker.resource,marker.count,marker.readyCount]).sort(),
      [['wood',2,1],['scrap',2,1],['seeds',2,1],['water',2,1]].sort());
    assert.deepEqual(markers.flatMap(marker=>marker.nodeIds).sort(),nodes.map(node=>node.id).sort());
    for(const marker of markers){
      assert.ok(marker.nodeIds.every(id=>GROUND_RESOURCE_NODES.find(node=>node.id===id)!.regionId===regionId),
        `${regionId}'s visible control cannot include the same resource family in a different physical place`);
      assert.equal(marker.nodeId,input.find(node=>node.resource===marker.resource&&node.ready)!.id,
        'a nearer depleted local node cannot replace the ready local collection target');
      assert.equal(marker.status,'ready');
    }
    assertTouchable(markers,viewport,`${regionId} ${viewport.right}×${viewport.bottom-viewport.top}`);
    assert.deepEqual(input,before,'regional collection labels preserve the original catalog indices, contacts and ready times');
  }
});

test('an overview collection control chooses the closest ready resource and keeps active work selected',()=>{
  const fixture=fitted(forest,portrait,.35),nodes=fixture.nodes.map((node,index)=>({...node,
    ready:index===3||index===9,remainingSeconds:index===3||index===9?0:5+index,distance:index===0?0:index===3?90:index===9?20:100+index}));
  let marker=layoutGroundMarkers(nodes,fixture.scale,portrait)[0];
  assert.equal(marker.nodeId,'tree-10','a close depleted tree cannot steal a ready collection control');
  assert.equal(marker.readyCount,2);assert.equal(marker.count,16);assert.equal(marker.status,'ready');
  const active=nodes.map(node=>({...node,active:node.id==='tree-04'}));
  marker=layoutGroundMarkers(active,fixture.scale,portrait)[0];
  assert.equal(marker.nodeId,'tree-04');assert.equal(marker.status,'working');
  assert.equal(marker.index,GROUND_RESOURCE_NODES.findIndex(node=>node.id==='tree-04'));
  assert.deepEqual(marker.nodeIds,[...forest.map(node=>node.id)],'changing the lead preserves the whole visible group');
});

test('fully depleted groups show the earliest actual remaining seconds and unaffordable groups keep a clear energy state',()=>{
  const fixture=fitted(forest,portrait,.35),depleted=fixture.nodes.map((node,index)=>({...node,ready:false,
    affordable:false,remainingSeconds:index===8?7:index===0?180:30+index,distance:index}));
  const original=structuredClone(depleted),waiting=layoutGroundMarkers(deepFreeze(depleted),fixture.scale,portrait)[0];
  assert.equal(waiting.nodeId,'tree-09');assert.equal(waiting.status,'cooldown');
  assert.equal(waiting.remainingSeconds,7);assert.equal(waiting.readyCount,0);
  assert.deepEqual(depleted,original,'a cooldown display cannot decrement or rewrite the persisted timer');
  const tired=fixture.nodes.map(node=>({...node,affordable:false})),energy=layoutGroundMarkers(tired,fixture.scale,portrait)[0];
  assert.equal(energy.status,'unaffordable');assert.equal(energy.readyCount,16);assert.equal(energy.remainingSeconds,0);
  const working=layoutGroundMarkers(tired.map(node=>({...node,active:node.id===energy.nodeId})),fixture.scale,portrait)[0];
  assert.equal(working.status,'working','a running chore keeps its control despite having spent energy');
});

test('a close forest view keeps one readable group instead of covering sixteen trees with labels',()=>{
  const fixture=fitted(forest,portrait,.65),markers=layoutGroundMarkers(fixture.nodes,fixture.scale,portrait);
  assert.equal(markers.length,1,'all sixteen visible trees share a single compact resource control');
  assert.equal(markers[0].count,16);assert.equal(markers[0].readyCount,16);
  assert.deepEqual(markers[0].nodeIds.slice().sort(),forest.map(node=>node.id).sort());
  assertTouchable(markers,portrait,'close full forest 344 portrait');
  for(const scale of [.08,.64,.65,1,2.4]){
    const view=fitted(GROUND_RESOURCE_NODES,portrait,scale),visible=view.nodes.filter(node=>
      node.spriteBounds[2]>=portrait.left&&node.spriteBounds[0]<=portrait.right
      &&node.spriteBounds[3]>=portrait.top&&node.spriteBounds[1]<=portrait.bottom),
      controls=layoutGroundMarkers(view.nodes,scale,portrait);
    assert.ok(controls.length<=4,`zoom ${scale} never produces a wall of individual resource labels`);
    assert.equal(new Set(controls.map(marker=>marker.resource)).size,controls.length);
    assert.deepEqual(controls.flatMap(marker=>marker.nodeIds).sort(),visible.map(node=>node.id).sort(),
      'a compact label preserves each visible underlying resource identity');
    assertTouchable(controls,portrait,`compact resource groups zoom ${scale}`);
  }
});

test('touch controls retain their CSS dimensions when the world zoom changes and clipped sprites cannot create offscreen controls',()=>{
  const node=GROUND_RESOURCE_NODES[0];
  for(const scale of [.08,.64,.65,1,2.4]){
    const fixture=fitted([node],portrait,scale),markers=layoutGroundMarkers(fixture.nodes,scale,portrait);
    assert.equal(markers.length,1);assertTouchable(markers,portrait,`zoom ${scale}`);
    const absent=fixture.nodes.map(input=>({...input,spriteBounds:[-200,-200,-100,-100]as[number,number,number,number]}));
    assert.equal(layoutGroundMarkers(absent,scale,portrait).length,0,'an entirely clipped prop has no phantom control');
    const grazing=fixture.nodes.map(input=>({...input,spriteBounds:[-30,portrait.top+20,.5,portrait.top+60]as[number,number,number,number]}));
    const edge=layoutGroundMarkers(grazing,scale,portrait);
    assert.equal(edge.length,1,'a partly visible resource remains actionable');
    assertTouchable(edge,portrait,`clipped edge zoom ${scale}`);
  }
});

test('narrow landscape close views keep every visible crown actionable without overlapping or clipping touch targets',()=>{
  const scale=.65,xOffset=(narrow.right+narrow.left)/2-175*scale;
  let largestVisible=0;
  // A real camera can pan across the forest while the HUD leaves only an
  // 88px-high safe area. Use measured atlas crowns, not collapsed fake nodes.
  for(let worldTop=760;worldTop<=1300;worldTop+=20){
    const nodes=project(forest,scale,[xOffset,narrow.top-worldTop*scale]),
      visible=nodes.filter(node=>node.spriteBounds[2]>=narrow.left&&node.spriteBounds[0]<=narrow.right
        &&node.spriteBounds[3]>=narrow.top&&node.spriteBounds[1]<=narrow.bottom),
      markers=layoutGroundMarkers(nodes,scale,narrow);
    largestVisible=Math.max(largestVisible,visible.length);
    assert.deepEqual(markers.flatMap(marker=>marker.nodeIds).sort(),visible.map(node=>node.id).sort(),
      'crowded views preserve the identity of every visible resource even if controls must group');
    assertTouchable(markers,narrow,`landscape forest top=${worldTop} (${visible.length} crowns)`);
  }
  assert.ok(largestVisible>=12,'this covers the actual dense-crown case that cannot fit twelve separate 68×44 targets in 844×88');
});

test('a separate right-hand control dock preserves visible resources and the nearest ready target outside that dock',()=>{
  const dock:GroundMarkerViewport={left:500,top:narrow.top,right:narrow.right,bottom:narrow.bottom},
    worldArea:GroundMarkerViewport={left:narrow.left,top:narrow.top,right:440,bottom:narrow.bottom},
    fixture=fitted(GROUND_RESOURCE_NODES,worldArea),
    input=deepFreeze(fixture.nodes.map(node=>node.kind==='tree'?{...node,
      ready:node.id==='tree-04'||node.id==='tree-10',remainingSeconds:node.id==='tree-04'||node.id==='tree-10'?0:120,
      distance:node.id==='tree-01'?0:node.id==='tree-10'?4:40}:node)),before=structuredClone(input);
  assert.ok(input.every(node=>node.spriteBounds[2]<dock.left),
    'every real prop is on the visible map to the left of the separate placement region');
  const ordinary=layoutGroundMarkers(input,fixture.scale,narrow),docked=layoutGroundMarkers(input,fixture.scale,narrow,dock);
  assert.equal(docked.length,4,'placement bounds cannot mistakenly filter out map-visible resource groups');
  assert.deepEqual(docked.flatMap(marker=>marker.nodeIds).sort(),GROUND_RESOURCE_NODES.map(node=>node.id).sort());
  assert.deepEqual(docked.map(marker=>[marker.nodeId,marker.resource,marker.readyCount,marker.status]),
    ordinary.map(marker=>[marker.nodeId,marker.resource,marker.readyCount,marker.status]),
    'moving controls beside the truck cannot retarget their actual resource or change readiness');
  assert.equal(docked.find(marker=>marker.resource==='wood')?.nodeId,'tree-10',
    'the closest ready tree remains selected even when a depleted tree is nearer and all trees are outside the dock');
  assertTouchable(docked,dock,'separate right-hand landscape dock');
  assert.deepEqual(input,before,'docking controls leaves all original IDs, contacts and timer inputs unchanged');
});

test('working-hero clearance moves compact resource controls without hiding the resident or changing their targets',()=>{
  const viewport:GroundMarkerViewport={left:0,top:0,right:844,bottom:500},scale=.65,
    seed=GROUND_RESOURCE_NODES.find(node=>node.id==='seed-03')!,
    hero=seed.approaches.find(point=>point[1]<seed.point[1]-60)!,offset:Point=[-.5,-432.5],
    foot:Point=[offset[0]+hero[0]*scale,offset[1]+hero[1]*scale],
    avoid=deepFreeze([{left:foot[0]-24,top:foot[1]-62,right:foot[0]+24,bottom:foot[1]+8}]),
    input=deepFreeze(project(GROUND_RESOURCE_NODES,scale,offset,hero).map(node=>({...node,active:node.id===seed.id}))),
    before=structuredClone(input),avoidBefore=structuredClone(avoid),
    ordinary=layoutGroundMarkers(input,scale,viewport),clear=layoutGroundMarkers(input,scale,viewport,viewport,avoid),
    intersects=(bounds:readonly number[],box:GroundMarkerViewport)=>bounds[0]<box.right&&bounds[2]>box.left
      &&bounds[1]<box.bottom&&bounds[3]>box.top;
  assert.equal(ordinary.length,4,'the actual close seed-meadow projection also includes forest, salvage and a spring edge');
  assert.ok(ordinary.some(marker=>intersects(marker.hitScreenBounds,avoid[0])),
    'the measured working position really would be covered without clearance');
  assert.equal(clear.length,4,'clearing the hero does not create individual labels or remove resource controls');
  assert.deepEqual(clear.map(marker=>[marker.nodeId,marker.nodeIds,marker.status]),
    ordinary.map(marker=>[marker.nodeId,marker.nodeIds,marker.status]),
    'avoiding the resident preserves the selected active job and every other real collection target');
  assert.equal(clear.find(marker=>marker.resource==='seeds')?.nodeId,'seed-03');
  assert.equal(clear.find(marker=>marker.resource==='seeds')?.status,'working');
  for(const marker of clear)for(const box of avoid){
    const[left,top,right,bottom]=marker.hitScreenBounds;
    assert.ok(right+4<=box.left||left-4>=box.right||bottom+4<=box.top||top-4>=box.bottom,
      `${marker.nodeId}'s complete finger target leaves a clear margin around the working hero`);
  }
  assert.ok(clear.some((marker,index)=>marker.hitScreenBounds.some((value,edge)=>value!==ordinary[index].hitScreenBounds[edge])),
    'the fixture requires an actual placement change');
  assertTouchable(clear,viewport,'four resource groups around a working hero');
  assert.deepEqual(input,before,'hero avoidance cannot change resource state or physical approach coordinates');
  assert.deepEqual(avoid,avoidBefore,'the caller retains the original measured hero footprint');
});
