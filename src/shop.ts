import type { ActionResult, GameState, Gender, Resource } from './game';
import { CROP_IDS, CROPS, isCropId, type CropId } from './crops';
import { getUnlockedUnitIds, isUnitId, RESERVE_UNIT_IDS, UNITS, type UnitId } from './units';
import { reconcileFarmEconomyFood, validateFarmEconomy } from './farm-economy';

export const OUTFIT_IDS = ['garden', 'road', 'explorer'] as const;
export type OutfitId = typeof OUTFIT_IDS[number];
export type EquippedOutfitId = 'default' | OutfitId;
/** Coins are earned by selling game resources, never by a real-money payment. */
export interface ShopProgress {
  version: 1;
  coins: number;
  adoptedPets: UnitId[];
  ownedOutfits: OutfitId[];
  equippedOutfits: Record<Gender, EquippedOutfitId>;
}
export type ShopSaleResource = 'food' | 'wood' | 'scrap';
export const SHOP_SEED_PRICES: Readonly<Record<CropId, number>> = { carrot: 2, potato: 3, tomato: 4, corn: 5, strawberry: 7, pumpkin: 9 };
export const SHOP_PET_PRICES: Readonly<Record<UnitId, number>> = { dog: 0, cat: 0, rabbit: 60, fox: 90, boar: 120, owl: 150 };
export const SHOP_SALE_PRICES: Readonly<Record<ShopSaleResource, number>> = { food: 3, wood: 1, scrap: 2 };
export const SHOP_OUTFITS: Readonly<Record<OutfitId, { id: OutfitId; name: string; description: string; price: number }>> = {
  garden: { id: 'garden', name: '텃밭 나들이', description: '밀짚모자와 앞치마로 즐기는 트럭 텃밭의 하루', price: 40 },
  road: { id: 'road', name: '도로 여행자', description: '파란 모자와 붉은 스카프로 떠나는 작은 여행', price: 60 },
  explorer: { id: 'explorer', name: '숲속 탐험가', description: '초록 모자와 배낭을 챙긴 용감한 탐험가', price: 80 },
};
const LIMIT = 100_000_000;
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const integer = (value: unknown, min = 0, max = LIMIT): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
export function isOutfitId(value: unknown): value is OutfitId { return typeof value === 'string' && OUTFIT_IDS.includes(value as OutfitId); }
export function isShopSaleResource(value: unknown): value is ShopSaleResource { return typeof value === 'string' && Object.hasOwn(SHOP_SALE_PRICES, value); }

/** Reading an old save supplies a detached empty shop without inventing rewards. */
export function getShop(state: Pick<GameState, 'shop'>): ShopProgress {
  const shop = state.shop;
  return shop ? { version: 1, coins: shop.coins, adoptedPets: [...shop.adoptedPets], ownedOutfits: [...shop.ownedOutfits], equippedOutfits: { ...shop.equippedOutfits } }
    : { version: 1, coins: 0, adoptedPets: [], ownedOutfits: [], equippedOutfits: { female: 'default', male: 'default' } };
}
export function getEquippedOutfit(state: Pick<GameState, 'shop' | 'gender'>, gender: Gender = state.gender): EquippedOutfitId {
  return state.shop?.equippedOutfits[gender] ?? 'default';
}
export function getOwnedPetIds(state: Pick<GameState, 'shop' | 'deckLevel'>): UnitId[] { return getUnlockedUnitIds(state); }
export function cloneShopFields(state: Pick<GameState, 'shop'>): Pick<GameState, 'shop'> { return state.shop ? { shop: getShop(state) } : {}; }

/** Unknown, repeated, unowned, or damaged purchase records reject the save. */
export function validateShopProgress(value: unknown): value is ShopProgress {
  if (!record(value) || Object.keys(value).length !== 5 || !['version', 'coins', 'adoptedPets', 'ownedOutfits', 'equippedOutfits'].every(key => Object.hasOwn(value, key))
    || value.version !== 1 || !integer(value.coins) || !Array.isArray(value.adoptedPets) || value.adoptedPets.length > RESERVE_UNIT_IDS.length
    || new Set(value.adoptedPets).size !== value.adoptedPets.length || !value.adoptedPets.every(id => isUnitId(id) && RESERVE_UNIT_IDS.includes(id as typeof RESERVE_UNIT_IDS[number]))
    || !Array.isArray(value.ownedOutfits) || value.ownedOutfits.length > OUTFIT_IDS.length || new Set(value.ownedOutfits).size !== value.ownedOutfits.length || !value.ownedOutfits.every(isOutfitId)
    || !record(value.equippedOutfits) || Object.keys(value.equippedOutfits).length !== 2 || !['female', 'male'].every(key => Object.hasOwn(value.equippedOutfits as object, key))) return false;
  const owned = value.ownedOutfits;
  return ['female', 'male'].every(gender => {
    const outfit = (value.equippedOutfits as Record<string, unknown>)[gender];
    return outfit === 'default' || isOutfitId(outfit) && owned.includes(outfit);
  });
}
function seedStock(state: GameState): Record<CropId, number> {
  return state.seedInventory ? { ...state.seedInventory } : { carrot: state.resources.seeds, potato: 0, tomato: 0, corn: 0, strawberry: 0, pumpkin: 0 };
}
function blocked(state: GameState): string | null {
  if (state.expedition) return '탐험을 마친 뒤 트럭 상점을 이용해 주세요.';
  if (Object.hasOwn(state, 'farmEconomy') && !validateFarmEconomy(state.farmEconomy, state)) return '수확물과 영양 관리 기록을 확인할 수 없어요. 저장 상태를 확인해 주세요.';
  if (Object.hasOwn(state, 'shop') && !validateShopProgress(state.shop)) return '상점의 구매 기록을 확인할 수 없어요. 저장 상태를 확인해 주세요.';
  if (!record(state.resources) || Object.hasOwn(state, 'seedInventory') && (!record(state.seedInventory) || Object.keys(state.seedInventory).length !== CROP_IDS.length)) return '보유 자원과 씨앗의 저장 상태를 확인해 주세요.';
  const stock = seedStock(state);
  if (!['wood', 'scrap', 'food', 'water', 'seeds'].every(key => integer(state.resources[key as Resource]))
    || Object.keys(stock).length !== CROP_IDS.length || !CROP_IDS.every(id => integer(stock[id]))
    || CROP_IDS.reduce((sum, id) => sum + stock[id], 0) !== state.resources.seeds) return '보유 자원과 씨앗의 저장 상태를 확인해 주세요.';
  return null;
}
function fail(state: GameState, message: string): ActionResult { return { state, ok: false, message }; }
function purchase(state: GameState, cost: number): GameState | null {
  if (!integer(cost, 1) || getShop(state).coins < cost) return null;
  const next = structuredClone(state);
  next.shop = getShop(state);
  next.shop.coins -= cost;
  return next;
}
function success(state: GameState, message: string): ActionResult { return { state, ok: true, message }; }

/** Fixed-price purchases use one atomic commit; a refusal returns the input unchanged. */
export function buyShopSeed(state: GameState, cropId: unknown, quantity: unknown = 1): ActionResult {
  const reason = blocked(state); if (reason) return fail(state, reason);
  if (!isCropId(cropId) || !integer(quantity, 1, 99)) return fail(state, '원하는 씨앗과 1~99개 수량을 선택해 주세요.');
  const stock = seedStock(state);
  if (!integer(stock[cropId] + quantity) || !integer(state.resources.seeds + quantity)) return fail(state, '씨앗 보관량이 가득해요. 씨앗을 심은 뒤 구매해 주세요.');
  const next = purchase(state, SHOP_SEED_PRICES[cropId] * quantity);
  if (!next) return fail(state, '코인이 부족해요. 식량이나 재료를 판매해 코인을 모아 주세요.');
  stock[cropId] += quantity; next.seedInventory = stock; next.resources.seeds += quantity;
  return success(next, `${CROPS[cropId].seedName} ${quantity}개를 샀어요.`);
}
export function buyShopPet(state: GameState, petId: unknown): ActionResult {
  const reason = blocked(state); if (reason) return fail(state, reason);
  if (!isUnitId(petId)) return fail(state, '함께할 동물 친구를 선택해 주세요.');
  if (getOwnedPetIds(state).includes(petId)) return fail(state, '이미 함께하는 동물 친구예요. 탐험 편성에서 만나 보세요.');
  const next = purchase(state, SHOP_PET_PRICES[petId]);
  if (!next) return fail(state, '코인이 부족해요. 식량이나 재료를 판매해 코인을 모아 주세요.');
  next.shop!.adoptedPets.push(petId);
  return success(next, `${UNITS[petId].name}와 함께하게 되었어요! 탐험 편성에서 선택해 주세요.`);
}
export function buyShopOutfit(state: GameState, outfitId: unknown): ActionResult {
  const reason = blocked(state); if (reason) return fail(state, reason);
  if (!isOutfitId(outfitId)) return fail(state, '구매할 의상을 선택해 주세요.');
  if (getShop(state).ownedOutfits.includes(outfitId)) return fail(state, '이미 가지고 있는 의상이에요. 입기 버튼으로 갈아입어 보세요.');
  const next = purchase(state, SHOP_OUTFITS[outfitId].price);
  if (!next) return fail(state, '코인이 부족해요. 식량이나 재료를 판매해 코인을 모아 주세요.');
  next.shop!.ownedOutfits.push(outfitId);
  return success(next, `${SHOP_OUTFITS[outfitId].name} 의상을 샀어요. 입기 버튼으로 갈아입어 보세요.`);
}
export function equipShopOutfit(state: GameState, outfitId: unknown): ActionResult {
  const reason = blocked(state); if (reason) return fail(state, reason);
  if (outfitId !== 'default' && (!isOutfitId(outfitId) || !getShop(state).ownedOutfits.includes(outfitId))) return fail(state, '가지고 있는 의상만 입을 수 있어요.');
  if (getEquippedOutfit(state) === outfitId) return fail(state, '이미 입고 있는 의상이에요.');
  const next = structuredClone(state); next.shop = getShop(state); next.shop.equippedOutfits[state.gender] = outfitId;
  return success(next, outfitId === 'default' ? '편안한 기본 의상으로 갈아입었어요.' : `${SHOP_OUTFITS[outfitId].name} 의상으로 갈아입었어요.`);
}
export function sellShopResource(state: GameState, resource: unknown, quantity: unknown): ActionResult {
  const reason = blocked(state); if (reason) return fail(state, reason);
  if (!isShopSaleResource(resource) || !integer(quantity, 1, 99)) return fail(state, '판매할 식량·목재·고철과 1~99개 수량을 선택해 주세요.');
  if (state.resources[resource] < quantity) return fail(state, '판매할 물자가 부족해요. 수확·생산·채집으로 모아 주세요.');
  const coins = SHOP_SALE_PRICES[resource] * quantity;
  if (!integer(getShop(state).coins + coins)) return fail(state, '코인 지갑이 가득해요. 상점에서 코인을 사용한 뒤 판매해 주세요.');
  const next = structuredClone(state); next.shop = getShop(state); next.resources[resource] -= quantity; next.shop.coins += coins;
  if (resource === 'food') reconcileFarmEconomyFood(next);
  const name = resource === 'food' ? '식량' : resource === 'wood' ? '목재' : '고철';
  return success(next, `${name} ${quantity}개를 판매하고 코인 ${coins}개를 받았어요.`);
}
