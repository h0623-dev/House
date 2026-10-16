import type { ActionResult, GameState } from './game';
import { projectTruckPoint, type TruckPoint } from './truck-layout';
import { getTruckAccessGeometry, getTruckAccessWidth } from './truck-access';

export interface PetPassageProgress { version: 1; open: boolean }
export const PET_PASSAGE_LINK_ID = 'road-1';
/** Largest admitted animal's planted feet, shared with road passing clearance. */
export const PET_PASSAGE_MAX_BODY_RADIUS = 44;
/** The small truck admits only the smaller species. */
export const PET_PASSAGE_WIDTH = 76;
export const getPetPassageWidth = getTruckAccessWidth;
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
  return { state: next, ok: true, message: open ? '동물 통로 문을 열었어요. 친구들이 같은 계단으로 따라와요.' : '동물 통로 문을 닫았어요. 친구들이 지금 있는 곳에 머물러요.' };
}
/** Pets and the survivor share the identical physical stair. The pet gate
 * controls animal admission without creating another bridge beside the truck. */
export function getPetPassageGeometry(level: number) {
  const access = getTruckAccessGeometry(level), [u, v] = access.entryUV;
  // Operate the gate from inside the deck, clear of the shared upper exit.
  // Even the nearest candidate leaves room for a 44px animal and the hero.
  const heroApproaches: TruckPoint[] = [[u + 80, v], [u + 88, v - 22], [u + 88, v + 22],
    [u + 104, v - 40], [u + 104, v + 40]].map(point => projectTruckPoint(point));
  return { ...access, hingeUV: access.topUV, hinge: access.top, ground: access.bottom, heroApproaches };
}
