import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/game.ts';
import { buildFacility, buildTruckFloor, moveHome } from '../src/settlement.ts';
import { fitVillageCamera, getVillageContentBounds } from '../src/village-camera.ts';
import { getHousePosition, projectTruckPoint } from '../src/truck-layout.ts';

function screenPoint(point:readonly number[],bounds:ReturnType<typeof getVillageContentBounds>,width:number,height:number){
  const camera=fitVillageCamera(bounds,width,height),scale=Math.min(width/camera.width,height/camera.height);
  return[(point[0]-camera.x)*scale+width/2,(point[1]-camera.y)*scale+height/2];
}
test('new village framing contains the real cottage roof and all three beds in portrait and short landscape',()=>{
  const state=createGame(),before=structuredClone(state),bounds=getVillageContentBounds(state,1),[x,y]=projectTruckPoint(getHousePosition(state),1,-1);
  for(const[width,height]of[[360,540],[390,590],[844,160]]){
    for(const point of[[x-61,y-143],[x+61,y+5],[bounds.left,bounds.top],[bounds.right,bounds.bottom]]){
      const[sx,sy]=screenPoint(point,bounds,width,height);assert.ok(sx>=0&&sx<=width&&sy>=0&&sy<=height,`full sprite ${point} at ${width}×${height}`);
    }
  }
  assert.deepEqual(state,before);
});
test('a relocated third-storey home and its facilities frame that storey without including the first-storey farm',()=>{
  let state=createGame();state.deckLevel=7;state.resources.wood=state.resources.scrap=10_000;
  state=buildTruckFloor(state).state;state=buildTruckFloor(state).state;
  const moved=moveHome(state,{floor:3,slot:0});assert.equal(moved.ok,true,moved.message);state=moved.state;
  const built=buildFacility(state,'waterworks',33);assert.equal(built.ok,true,built.message);state=built.state;
  const before=structuredClone(state),bounds=getVillageContentBounds(state,3),ground=getVillageContentBounds(state,1);
  assert.ok(bounds.bottom<ground.bottom-150);const[x,y]=projectTruckPoint(getHousePosition({floor:3,slot:0}),3,-1);
  for(const[width,height]of[[390,570],[844,150]]){
    for(const point of[[x-61,y-143],[x+61,y+5],[bounds.left,bounds.top],[bounds.right,bounds.bottom]]){
      const[sx,sy]=screenPoint(point,bounds,width,height);assert.ok(sx>=0&&sx<=width&&sy>=0&&sy<=height);
    }
  }
  assert.deepEqual(state,before);
});
test('an empty purchased floor has finite construction framing and changing HUD space still fits its bounds',()=>{
  let state=createGame();state.deckLevel=4;state.resources.wood=state.resources.scrap=10_000;state=buildTruckFloor(state).state;
  const bounds=getVillageContentBounds(state,2);
  for(const[width,height]of[[360,380],[390,600],[740,90]]){
    const frame=fitVillageCamera(bounds,width,height);assert.ok(Object.values(frame).every(Number.isFinite));
    for(const p of[[bounds.left,bounds.top],[bounds.right,bounds.bottom]]){
      const[x,y]=screenPoint(p,bounds,width,height);assert.ok(x>=0&&x<=width&&y>=0&&y<=height);
    }
  }
});
