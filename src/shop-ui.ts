import { getSeedCount, resourceLabels, type GameState, type Gender } from './game';
import { CROP_IDS, CROPS, isCropId } from './crops';
import { cropIcon } from './crop-art';
import { companionPortrait } from './companion-art';
import { icon } from './icons';
import { survivorOutfitPreview } from './outfit-art';
import { gameMinutesToSeconds } from './game-time';
import { UNIT_IDS, UNITS, isUnitId, canAnimalBoardTruck, getAnimalDeckUnlockLevel } from './units';
import {
  getShop, getOwnedPetIds, getEquippedOutfit, isOutfitId, isShopSaleResource,
  OUTFIT_IDS, SHOP_OUTFITS, SHOP_SEED_PRICES, SHOP_PET_PRICES, SHOP_SALE_PRICES,
  type EquippedOutfitId,
} from './shop';

export type ShopTab = 'seeds' | 'pets' | 'outfits' | 'sell';
export type ShopQuantity = 1 | 5 | 10;
export type ShopPurchaseKind = 'seed' | 'pet' | 'outfit' | 'sale';
export const SHOP_TABS: readonly ShopTab[] = ['seeds', 'pets', 'outfits', 'sell'];
const tabLabels: Record<ShopTab, string> = { seeds: '씨앗', pets: '애완동물', outfits: '의상', sell: '판매' };
const tabIcons: Record<ShopTab, string> = { seeds: 'seeds', pets: 'paw', outfits: 'outfit', sell: 'food' };
const petKinds = { dog: '강아지', cat: '고양이', rabbit: '토끼', fox: '여우', boar: '멧돼지', owl: '부엉이', monkey: '원숭이', elephant: '코끼리', giraffe: '기린', panda: '판다', deer: '사슴' };
const saleResources = ['food', 'wood', 'scrap'] as const;
let coinArtId = 0;
function coinIcon(): string {
  const id = `shop-coin-${++coinArtId}`;
  return `<svg class="icon shop-coin-icon" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#ffe6a0"/><stop offset=".55" stop-color="#d8ac58"/><stop offset="1" stop-color="#bd873a"/></linearGradient></defs><ellipse cx="18" cy="21" rx="10" ry="7" fill="#c09043" stroke="#8d6b37" stroke-width="1.1"/><circle cx="14" cy="13" r="10" fill="url(#${id})" stroke="#8d6b37" stroke-width="1.1"/><circle cx="14" cy="13" r="7.2" fill="none" stroke="#f6d889" stroke-width="1.4"/><path d="M14 7L15.8 11L20 12L16.8 15L17.3 19L14 17L10.7 19L11.2 15L8 12L12.2 11Z" fill="#ffe5a2" stroke="#a47c3f" stroke-width=".8"/></svg>`;
}
function categoryIcon(tab: ShopTab): string {
  if (tab !== 'outfits') return icon(tabIcons[tab]);
  return `<svg class="icon shop-outfit-icon" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M11 5Q16 9 21 5L29 10L24 16L21 14L23 27Q16 30 9 27L11 14L8 16L3 10Z" fill="#a5b889" stroke="#687851" stroke-width="1.2" stroke-linejoin="round"/><path d="M11 5Q16 15 21 5M16 11V27M10 24Q16 26 22 24" fill="none" stroke="#e7e5bb" stroke-width="1.3"/><circle cx="17.7" cy="15" r=".8" fill="#8d774c"/><circle cx="17.7" cy="19" r=".8" fill="#8d774c"/></svg>`;
}
const coin = (amount: number) => `<span class="shop-coins">${coinIcon()}<b>${amount.toLocaleString('ko-KR')}</b><small>코인</small></span>`;
const saleName = (id: typeof saleResources[number]) => id === 'food' ? '식량 묶음' : resourceLabels[id];

function quantityPicker(quantity: ShopQuantity, sale = false): string {
  return `<div class="shop-quantity"><span>${sale ? '판매' : '구매'} 수량</span><div role="group" aria-label="${sale ? '판매' : '구매'} 수량">${([1, 5, 10] as const).map(n => `<button data-shop-qty="${n}" aria-pressed="${quantity === n}">${n}개</button>`).join('')}</div></div>`;
}

function purchaseButton(kind: ShopPurchaseKind, id: string, label: string, cost: number): string {
  const name = kind === 'seed' && isCropId(id) ? CROPS[id].seedName : kind === 'pet' && isUnitId(id) ? UNITS[id].name : kind === 'outfit' && isOutfitId(id) ? SHOP_OUTFITS[id].name : id;
  return `<button class="shop-buy" data-shop-buy-kind="${kind}" data-shop-item="${id}" aria-label="${name} ${label} · ${cost}코인"><span>${label}</span>${coin(cost)}</button>`;
}

function seedCards(state: GameState, quantity: ShopQuantity): string {
  return `${quantityPicker(quantity)}<div class="shop-product-grid">${CROP_IDS.map(id => {
    const crop = CROPS[id], price = SHOP_SEED_PRICES[id];
    return `<article class="shop-product shop-seed-card" data-shop-product="${id}"><div class="shop-seed-art">${cropIcon(id, 'seed')}</div><h3>${crop.seedName}</h3><p class="shop-crop-yield">${cropIcon(id, 'produce')}<span>${gameMinutesToSeconds(crop.growMinutes)}초 성장 · 식량 +${crop.food}</span></p><div class="shop-stock"><span>보유 <b data-shop-stock="${id}">${getSeedCount(state, id)}개</b></span><span>1개 ${coin(price)}</span></div>${purchaseButton('seed', id, `${quantity}개 구매`, price * quantity)}</article>`;
  }).join('')}</div><p class="shop-note">구매한 씨앗은 씨앗 인벤토리에 들어가요.<br>고른 씨앗으로 빈 밭을 연속해서 심을 수 있어요.</p>`;
}

function petCards(state: GameState): string {
  const shop = getShop(state), owned = getOwnedPetIds(state);
  return `<p class="shop-intro">11종의 친구가 한 마리씩 함께 살아요.<br>큰 동물은 지상에서 지내고, 트럭을 넓히면 올라올 수 있어요.</p><div class="shop-product-grid">${UNIT_IDS.map(id => {
    const unit = UNITS[id], hasPet = owned.includes(id), paid = shop.adoptedPets.includes(id);
    const obtained = paid ? '이미 함께하는 동료 · 1마리' : '우리 마을 동료 · 1마리';
    const habitat = canAnimalBoardTruck(id,state.deckLevel) ? getAnimalDeckUnlockLevel(id)>1?'지상·트럭 1층에서 생활해요':'지상·트럭에서 생활해요' : `지상 생활 · 데크 Lv.${getAnimalDeckUnlockLevel(id)}부터 탑승`; 
    return `<article class="shop-product shop-pet-card ${hasPet ? 'shop-owned' : ''}" data-shop-product="${id}"><div class="shop-pet-art">${companionPortrait(id)}</div><h3>${unit.name}<small>${petKinds[id]}</small></h3><p class="shop-pet-role">${unit.roleLabel}</p><p class="shop-pet-detail">${habitat}</p><p class="shop-pet-detail">${unit.skillDescription}</p><span class="shop-ownership">${hasPet ? `${icon('check')}${obtained}` : `데크 Lv.${unit.unlockDeck} 성장으로도 만나요`}</span>${hasPet ? `<button class="shop-owned-action" data-open="pet" aria-label="${unit.name} 동료 편성 열기">${icon('paw')}동료 편성</button>` : purchaseButton('pet', id, '친구 만나기', SHOP_PET_PRICES[id])}</article>`;
  }).join('')}</div><p class="shop-note">각 동물은 한 마리씩 보유하며 중복 구매하지 않아요.<br>전투에 함께할 동료는 동료 편성에서 직접 골라 주세요.</p>`;
}

function outfitPreview(gender: Gender, outfit: EquippedOutfitId, secondary = false): string {
  return `<div class="shop-outfit-preview ${secondary ? 'shop-preview-secondary' : ''}" data-shop-preview-gender="${gender}" data-shop-preview-outfit="${outfit}">${survivorOutfitPreview(gender, outfit)}<small>${gender === 'female' ? '여자' : '남자'}</small></div>`;
}

function outfitCards(state: GameState): string {
  const shop = getShop(state), equipped = getEquippedOutfit(state), otherGender: Gender = state.gender === 'female' ? 'male' : 'female';
  return `<p class="shop-intro">트럭 위 일상에 나만의 옷을 입혀요.<br>한 번 구매하면 남녀 캐릭터 모두 사용할 수 있어요.</p><article class="shop-default-outfit"><div class="shop-default-art">${outfitPreview(state.gender, 'default')}</div><div><h3>편안한 기본 의상</h3><p>처음부터 가진 기본 옷</p><button class="shop-owned-action" data-shop-equip="default" ${equipped === 'default' ? 'disabled' : ''}>${icon(equipped === 'default' ? 'check' : 'refresh')}${equipped === 'default' ? '입고 있어요' : '기본 의상 입기'}</button></div></article><div class="shop-outfit-list">${OUTFIT_IDS.map(id => {
    const outfit = SHOP_OUTFITS[id], owned = shop.ownedOutfits.includes(id), worn = equipped === id;
    return `<article class="shop-product shop-outfit-card ${owned ? 'shop-owned' : ''}" data-shop-product="${id}"><div class="shop-outfit-pair">${outfitPreview(state.gender, id)}${outfitPreview(otherGender, id, true)}</div><div class="shop-outfit-copy"><span class="shop-outfit-status">${worn ? '지금 입고 있어요' : owned ? '가지고 있는 의상' : '남녀 공용'}</span><h3>${outfit.name}</h3><p>${outfit.description}</p></div><div class="shop-outfit-action">${owned ? `<button class="shop-owned-action" data-shop-equip="${id}" ${worn ? 'disabled' : ''}>${icon(worn ? 'check' : 'refresh')}${worn ? '입고 있어요' : '이 의상 입기'}</button>` : purchaseButton('outfit', id, '의상 구매', outfit.price)}</div></article>`;
  }).join('')}</div><p class="shop-note">구매 후 입기 버튼으로 갈아입어요.<br>남녀 캐릭터의 착용 선택은 각각 저장돼요.</p>`;
}

function saleCards(state: GameState, quantity: ShopQuantity): string {
  return `<p class="shop-intro">남는 물자를 판매해 코인을 모아요.<br>코인으로 씨앗·동료·의상을 구매할 수 있어요.</p>${quantityPicker(quantity, true)}<div class="shop-sale-list">${saleResources.map(id => {
    const enough = state.resources[id] >= quantity, total = SHOP_SALE_PRICES[id] * quantity;
    return `<article class="shop-product shop-sale-card" data-shop-product="${id}"><span class="shop-sale-art">${icon(id)}</span><div class="shop-sale-copy"><h3>${saleName(id)}</h3><span>보유 <b data-shop-stock="${id}">${state.resources[id]}개</b></span><small>1개 판매 ${coin(SHOP_SALE_PRICES[id])}</small></div><button class="shop-sale-button" data-shop-buy-kind="sale" data-shop-item="${id}" aria-label="${saleName(id)} ${quantity}개 판매 · 코인 ${total}개 받기" ${!enough ? 'disabled' : ''}><span>${enough ? `${quantity}개 판매` : '물자가 부족해요'}</span>${coin(total)}</button></article>`;
  }).join('')}</div><p class="shop-sale-warning">${icon('truck')}식량은 휴식과 작물 영양에, 목재와 고철은 건설에도 써요.<br>이번에 판매할 수량을 확인해 주세요.</p><p class="shop-note">수확물은 전체 식량에 포함돼요. 식량을 판매하면 일반 식량부터 사용하고, 부족하면 당근·감자·토마토·옥수수·딸기·호박 순서로 보관한 작물도 줄어요.<br>판매를 확정하기 전에는 물자가 줄어들지 않아요.</p>`;
}

/** Cards display saved stock and real ownership; opening the shop never grants currency. */
export function renderShop(state: GameState, tab: ShopTab = 'seeds', quantity: ShopQuantity = 1): string {
  const shop = getShop(state);
  const content = tab === 'pets' ? petCards(state) : tab === 'outfits' ? outfitCards(state) : tab === 'sell' ? saleCards(state, quantity) : seedCards(state, quantity);
  return `<section class="truck-shop" data-shop-panel="${tab}"><div class="shop-wallet"><span class="shop-wallet-art">${icon('bag')}</span><div><small>우리 트럭 상점</small><strong>오늘의 작은 장보기</strong></div><div class="shop-wallet-coins" aria-label="보유 코인 ${shop.coins}개">${coin(shop.coins)}<small>보유 코인</small></div></div><nav class="shop-tabs" aria-label="상점 품목">${SHOP_TABS.map(id => `<button data-shop-tab="${id}" aria-pressed="${tab === id}">${categoryIcon(id)}<span>${tabLabels[id]}</span></button>`).join('')}</nav>${shop.coins === 0 && tab !== 'sell' ? `<div class="shop-first-coins"><span>남는 물자를 팔아 코인을 모아 보세요.</span><button data-shop-tab="sell">판매하기 ${icon('arrow')}</button></div>` : ''}<div class="shop-category" data-shop-category="${tab}">${content}</div></section>`;
}

/** The caller commits only after this explicit stock and wallet summary is accepted. */
export function renderShopPurchaseConfirmation(state: GameState, kind: ShopPurchaseKind, id: string, quantity: ShopQuantity = 1): string {
  let title: string, art: string, unitPrice: number, stock: number | undefined, actualQuantity = quantity, detail: string;
  if (kind === 'seed' && isCropId(id)) {
    title = CROPS[id].seedName; art = cropIcon(id, 'seed'); unitPrice = SHOP_SEED_PRICES[id]; stock = getSeedCount(state, id);
    detail = '구매한 씨앗은 씨앗 인벤토리에 추가돼요.';
  } else if (kind === 'pet' && isUnitId(id)) {
    title = `${UNITS[id].name} · ${petKinds[id]}`; art = companionPortrait(id); unitPrice = SHOP_PET_PRICES[id]; actualQuantity = 1;
    detail = '보유 동료로 합류해요. 출전 편성은 직접 선택해 주세요.';
  } else if (kind === 'outfit' && isOutfitId(id)) {
    title = SHOP_OUTFITS[id].name; art = outfitPreview(state.gender, id); unitPrice = SHOP_OUTFITS[id].price; actualQuantity = 1;
    detail = '남녀 공용 의상이에요. 구매한 뒤 입기로 갈아입어요.';
  } else if (kind === 'sale' && isShopSaleResource(id)) {
    title = saleName(id); art = icon(id); unitPrice = SHOP_SALE_PRICES[id]; stock = state.resources[id];
    detail = id === 'food' ? '식량은 휴식·여행·작물 영양에도 필요해요. 일반 식량이 부족하면 보관한 작물도 순서대로 사용해요.' : '목재와 고철은 건설과 확장에도 필요해요.';
  } else {
    return `<section class="truck-shop"><p class="shop-intro">선택한 물건을 찾을 수 없어요. 상점에서 다시 골라 주세요.</p><button class="shop-owned-action full-width" data-shop-back>상점으로 돌아가기</button></section>`;
  }
  const coins = getShop(state).coins, total = unitPrice * actualQuantity, selling = kind === 'sale';
  const alreadyOwned = kind === 'pet' && isUnitId(id) && getOwnedPetIds(state).includes(id) || kind === 'outfit' && isOutfitId(id) && getShop(state).ownedOutfits.includes(id);
  const stockEnough = !selling || (stock ?? 0) >= actualQuantity;
  const fundsEnough = selling || coins >= total;
  const canConfirm = !alreadyOwned && stockEnough && fundsEnough && total > 0;
  const afterCoins = fundsEnough ? coin(selling ? coins + total : coins - total) : '<strong class="shop-confirm-unavailable">코인 부족</strong>';
  const afterStock = stock !== undefined ? stockEnough ? `${stock} → ${selling ? stock - actualQuantity : stock + actualQuantity}개` : '물자 부족' : '';
  const quantityUnit = kind === 'pet' ? '마리' : kind === 'outfit' ? '벌' : '개';
  return `<section class="truck-shop shop-confirmation" data-shop-confirmation="${kind}" data-shop-item="${id}"><div class="shop-confirm-art">${art}</div><h3>${title}</h3><p class="shop-confirm-count">${kind === 'pet' ? '함께할 친구' : selling ? '판매 수량' : '구매 수량'} <strong>${actualQuantity}${quantityUnit}</strong></p><div class="shop-confirm-summary"><div><span>${selling ? '받을 코인' : '총 구매 가격'}</span>${coin(total)}</div><div><span>보유 코인</span>${coin(coins)}</div><div class="shop-confirm-after"><span>${selling ? '판매 후 코인' : '구매 후 코인'}</span>${afterCoins}</div>${stock !== undefined ? `<div><span>${selling ? '판매 후 보유' : '구매 후 보유'}</span><strong>${afterStock}</strong></div>` : ''}</div><p class="shop-confirm-detail">${detail}</p>${!fundsEnough ? `<p class="shop-confirm-unavailable">코인 ${total - coins}개가 더 필요해요.</p><button class="shop-owned-action full-width" data-shop-tab="sell">${icon('food')}물자 판매로 코인 모으기</button>` : !stockEnough ? `<p class="shop-confirm-unavailable">판매할 물자가 부족해요.</p>` : alreadyOwned ? `<p class="shop-confirm-unavailable">이미 가지고 있는 ${kind === 'pet' ? '동료' : '의상'}예요.</p>` : ''}<button class="shop-confirm-button" data-shop-confirm-kind="${kind}" data-shop-item="${id}" data-shop-quantity="${actualQuantity}" aria-label="${title} ${actualQuantity}${quantityUnit} ${selling ? '판매' : '구매'} 확정 · ${total}코인" ${!canConfirm ? 'disabled' : ''}>${selling ? coinIcon() : icon('check')}${selling ? `${actualQuantity}개 팔고 코인 받기` : kind === 'pet' ? '코인으로 친구 만나기' : '코인으로 구매 확정'}</button><button class="shop-cancel-button" data-shop-back>취소하고 돌아가기</button></section>`;
}
