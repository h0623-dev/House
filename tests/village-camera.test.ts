import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/game.ts';
import { buildFacility, buildTruckFloor, getSettlement, moveHome } from '../src/settlement.ts';
import { fitVillageCamera, getVillageContentBounds, VILLAGE_FACILITY_SIZE } from '../src/village-camera.ts';
import { layoutProductionBubbles } from '../src/production-bubble-layout.ts';
import { FARM_POSITIONS, SETTLEMENT_POSITIONS, getFloorSlots, getSlotFloor, getSlotLocalIndex, getTruckFloorCount, projectTruckPoint } from '../src/truck-layout.ts';

function screenPoint(point:readonly number[],bounds:ReturnType<typeof getVillageContentBounds>,width:number,height:number){
  const camera=fitVillageCamera(bounds,width,height),scale=Math.min(width/camera.width,height/camera.height);
  return[(point[0]-camera.x)*scale+width/2,(point[1]-camera.y)*scale+height/2];
}
test('new village framing contains all three beds and a free facility slot in portrait and short landscape',()=>{
  const state=createGame(),before=structuredClone(state),bounds=getVillageContentBounds(state,1),
    corners=[...FARM_POSITIONS.slice(0,3).flatMap(([u,v])=>{
      const[x,y]=projectTruckPoint([u+35,v+36],1,17);return[[x-60,y-63],[x+60,y+38]];
    }),[bounds.left,bounds.top],[bounds.right,bounds.bottom]];
  for(const[width,height]of[[360,540],[390,590],[844,160]]){
    for(const point of corners){
      const[sx,sy]=screenPoint(point,bounds,width,height);assert.ok(sx>=0&&sx<=width&&sy>=0&&sy<=height,`full sprite ${point} at ${width}×${height}`);
    }
  }
  assert.deepEqual(state,before);
});
test('third-storey facilities frame only that storey and ignore every legacy cottage location',()=>{
  let state=createGame();state.deckLevel=7;state.resources.wood=state.resources.scrap=10_000;
  state=buildTruckFloor(state).state;state=buildTruckFloor(state).state;
  const moved=moveHome(state,{floor:3,slot:0});assert.equal(moved.ok,true,moved.message);state=moved.state;
  const built=buildFacility(state,'waterworks',33);assert.equal(built.ok,true,built.message);state=built.state;
  const before=structuredClone(state),bounds=getVillageContentBounds(state,3),ground=getVillageContentBounds(state,1);
  assert.ok(bounds.bottom<ground.bottom-150);const[x,y]=projectTruckPoint(SETTLEMENT_POSITIONS[1],3);
  for(const floor of[1,2,3]as const){
    const alternate={...state,truckLayout:{...state.truckLayout!,home:{floor,slot:4}}};
    assert.deepEqual(getVillageContentBounds(alternate,3),bounds,'inert cottage data cannot widen or shift the frame');
  }
  for(const[width,height]of[[390,570],[844,150]]){
    for(const point of[[x-66,y-162],[x+66,y+25],[bounds.left,bounds.top],[bounds.right,bounds.bottom]]){
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

test('actual roofs and 48×48 production targets stay inside the camera at first and full expansion',()=>{
  for(const level of[1,8]){
    let state=createGame();state.deckLevel=level;state.resources.wood=state.resources.scrap=10_000;
    if(level===8){state=buildTruckFloor(state).state;state=buildTruckFloor(state).state;}
    for(const floor of[1,2,3]as const){
      if(floor>getTruckFloorCount(state))continue;
      for(const slot of getFloorSlots(state,floor)){
        const built=buildFacility(state,level>=3&&slot%2?'watchtower':'waterworks',slot);
        assert.equal(built.ok,true,built.message);state=built.state;
      }
      const bounds=getVillageContentBounds(state,floor);
      for(const[width,height]of[[360,540],[390,590],[844,160],[640,112]]){
        const buildings=getSettlement(state).buildings.filter(item=>getSlotFloor(item.slot)===floor),
          anchors=buildings.map(building=>{
            const[x,y]=projectTruckPoint(SETTLEMENT_POSITIONS[getSlotLocalIndex(building.slot)],floor),
              [roofWidth,roofHeight]=VILLAGE_FACILITY_SIZE[building.type];
            for(const corner of[[x-roofWidth/2,y-roofHeight],[x+roofWidth/2,y]]){
              const[sx,sy]=screenPoint(corner,bounds,width,height);
              assert.ok(sx>=0&&sx<=width&&sy>=0&&sy<=height,
                `the actual facility roof at ${level}:${floor}:${building.slot} fits ${width}×${height}`);
            }
            const[sx,sy]=screenPoint([x,y-roofHeight-18],bounds,width,height);
            return{id:building.id,x:sx,y:sy,width:48,height:48};
          }), positions=layoutProductionBubbles(anchors,{left:0,top:0,right:width,bottom:height});
        assert.equal(positions.size,anchors.length,'every original product stays attached to its real facility identity');
        for(const anchor of anchors){
          const position=positions.get(anchor.id)!;
          assert.ok(position.x-24>=0&&position.x+24<=width&&position.y-24>=0&&position.y+24<=height,
            `the full product target ${level}:${floor}:${anchor.id} fits ${width}×${height}`);
        }
        for(let i=0;i<anchors.length;i++)for(let j=i+1;j<anchors.length;j++){
          const first=positions.get(anchors[i].id)!,second=positions.get(anchors[j].id)!;
          assert.ok(Math.abs(first.x-second.x)>=48-1e-6||Math.abs(first.y-second.y)>=48-1e-6,
            `products ${anchors[i].id}/${anchors[j].id} remain separately tappable at ${width}×${height}`);
        }
      }
    }
  }
});
