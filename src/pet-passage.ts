import type { ActionResult, GameState } from './game';
import { getFloorBounds, getFloorStairs, projectTruckPoint, type TruckPoint } from './truck-layout';
import { getConvexPolygonClearance, getTruckGroundClearance } from './truck-ground';

export interface PetPassageProgress { version: 1; open: boolean }
export const PET_PASSAGE_LINK_ID = 'pet-road-1';
/** The existing full boar paw envelope at its authored .7 scene scale. */
export const PET_PASSAGE_MAX_BODY_RADIUS = 30.8;
/** Wide enough for the full 61.6 world-pixel boar paw envelope. */
export const PET_PASSAGE_WIDTH = 76;
export function getPetPassage(state: Pick<GameState, 'petPassage'>): PetPassageProgress {
  return { version: 1, open: state.petPassage?.open ?? false };
}
export function clonePetPassageFields(state: Pick<GameState, 'petPassage'>): Pick<GameState, 'petPassage'> {
  return state.petPassage ? { petPassage: getPetPassage(state) } : {};
}
export function validatePetPassage(value: unknown): value is PetPassageProgress {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const gate = value as Record<string, unknown>;
  return Object.keys(gate).length === 2 && Object.hasOwn(gate, 'version') && Object.hasOwn(gate, 'open')
    && gate.version === 1 && typeof gate.open === 'boolean';
}
/** The scene commits this only after the hero reaches and operates the real gate. */
export function setPetPassageOpen(state: GameState, open: unknown): ActionResult {
  const fail = (message: string): ActionResult => ({ state, ok: false, message });
  if (typeof open !== 'boolean') return fail('동물 통로 문을 열지 닫을지 선택해 주세요.');
  if (Object.hasOwn(state, 'petPassage') && !validatePetPassage(state.petPassage)) return fail('동물 통로의 저장 상태를 확인해 주세요.');
  if (state.expedition) return fail('탐험을 마친 뒤 동물 통로 문을 조작해 주세요.');
  if (getPetPassage(state).open === open) return fail(open ? '동물 통로 문이 이미 열려 있어요.' : '동물 통로 문이 이미 닫혀 있어요.');
  const next = structuredClone(state);
  next.petPassage = { version: 1, open };
  return { state: next, ok: true, message: open ? '동물 통로 문을 열었어요. 친구들이 경사로로 따라와요.' : '동물 통로 문을 닫았어요. 친구들이 지금 있는 곳에 머물러요.' };
}
export function getPetPassageGeometry(level: number) {
  const { left,front } = getFloorBounds(level);
  // One short outside flight keeps the complete largest pet beside the truck,
  // clear of the human stairs and of every painted farm and building footprint.
  // The road landing also stays above the grove's canopy, with full paw room.
  let v=Math.max(0,front-210);
  if(level>=4){
    const stairs=getFloorStairs(level,2).reserved,
      footprint:TruckPoint[]=[[stairs.left,stairs.top],[stairs.right,stairs.top],[stairs.right,stairs.bottom],[stairs.left,stairs.bottom]].map(point=>projectTruckPoint(point));
    // At the first two-floor size, a front-shifted gate would paint its full
    // wood width across the built stairwell. Place it on the clear front side.
    if(getConvexPolygonClearance(footprint,projectTruckPoint([left+70,v]))<PET_PASSAGE_WIDTH/2)v=front-60;
  }
  const entryUV: TruckPoint = [left + 70, v], hingeUV: TruckPoint = [left + 8, v], entry = projectTruckPoint(entryUV),
    hinge = projectTruckPoint(hingeUV), ground: TruckPoint = [-9, 391],clearance=PET_PASSAGE_WIDTH/2+2;
  if(getTruckGroundClearance(level,ground)<clearance){
    let blocked=ground[0],clear=blocked-64;
    while(getTruckGroundClearance(level,[clear,ground[1]])<clearance)clear-=64;
    for(let n=0;n<40;n++){const middle=(clear+blocked)/2;
      if(getTruckGroundClearance(level,[middle,ground[1]])>=clearance)clear=middle;else blocked=middle;}
    ground[0]=clear;
  }
  const points: TruckPoint[] = [ground, hinge, entry];
  const heroApproaches: TruckPoint[] = [[entry[0] + 30, hinge[1] - 42],
    [entry[0] + 35, hinge[1] - 48], [entry[0] + 40, hinge[1] - 54]];
  return { entryUV, hingeUV, entry, hinge, ground, points, heroApproaches, width: PET_PASSAGE_WIDTH,
    bounds: { left: Math.min(...points.map(p => p[0])) - PET_PASSAGE_WIDTH / 2,
      top: Math.min(...points.map(p => p[1])) - PET_PASSAGE_WIDTH / 2 - 32,
      right: Math.max(...points.map(p => p[0])) + PET_PASSAGE_WIDTH / 2,
      bottom: Math.max(...points.map(p => p[1])) + PET_PASSAGE_WIDTH / 2 } };
}
