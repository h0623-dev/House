import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceTime, beginHunt, cancelHunt, createGame, getSeedInventory, loadGame, performAction, SAVE_KEY, saveGame, setCompanionTeam, tick, type GameState, type SaveStorage } from '../src/game.ts';
import { CROP_IDS } from '../src/crops.ts';
import { buildFacility, collectProduction, getSettlement, startProduction } from '../src/settlement.ts';
import { claimGrowthQuest } from '../src/growth-quests.ts';
import { rotateLayoutTarget } from '../src/layout-direction.ts';
import { fulfillVillageOrder, getVillageOrder } from '../src/village-orders.ts';
import { getReadyTeam, getSelectedTeam, getUnitRoster, getUnlockedUnitIds } from '../src/units.ts';
import { buyShopOutfit, buyShopPet, buyShopSeed, cloneShopFields, equipShopOutfit, getEquippedOutfit, getOwnedPetIds, getShop, OUTFIT_IDS, SHOP_OUTFITS, SHOP_PET_PRICES, SHOP_SALE_PRICES, SHOP_SEED_PRICES, sellShopResource, validateShopProgress, type ShopProgress } from '../src/shop.ts';

function storage(): SaveStorage {
  const values = new Map<string, string>();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); } };
}
/** Explicit unearned material fixture; every coin still comes from a real domain sale. */
function funded(food = 1000): GameState {
  let state = createGame(); state.resources.food = food;
  while (state.resources.food >= 99) state = sellShopResource(state, 'food', 99).state;
  if (state.resources.food) state = sellShopResource(state, 'food', state.resources.food).state;
  return state;
}
function reload(state: GameState): GameState {
  const memory = storage(); assert.equal(saveGame(state, memory), true);
  const loaded = loadGame(memory); assert.ok(loaded); return loaded;
}
function noMutation(state: GameState, run: () => { state: GameState; ok: boolean }): void {
  const before = structuredClone(state), result = run();
  assert.equal(result.ok, false); assert.equal(result.state, state); assert.deepEqual(state, before);
}

test('legacy saves open a zero-coin shop without grants, animal loss, or saved-field mutation', () => {
  const old = createGame('male'); old.companions!.dog = { health: 51.5, xp: 85 }; old.animalReserve!.fox = { health: 18, xp: 240 };
  const memory = storage(), before = structuredClone(old); memory.setItem(SAVE_KEY, JSON.stringify(old));
  const loaded = loadGame(memory)!; assert.deepEqual(loaded, old);
  const shop = getShop(loaded); assert.equal(shop.coins, 0); assert.deepEqual(shop.adoptedPets, []); assert.deepEqual(shop.ownedOutfits, []);
  assert.equal(getEquippedOutfit(loaded), 'default'); assert.deepEqual(getOwnedPetIds(loaded), ['dog', 'cat']);
  shop.coins = 99; shop.adoptedPets.push('owl'); shop.ownedOutfits.push('road'); shop.equippedOutfits.male = 'road';
  assert.deepEqual(cloneShopFields(loaded), {}); assert.deepEqual(old, before); assert.deepEqual(loaded, before);
  assert.equal(Object.hasOwn(reload(loaded), 'shop'), false);
});

test('a real harvest sells its exact food value and funds selected seeds without inventing a second reward', () => {
  const harvest = performAction(createGame(), 'harvest', 1, undefined, { advanceClock: false }); assert.equal(harvest.ok, true);
  const before = structuredClone(harvest.state), sold = sellShopResource(harvest.state, 'food', 4); assert.equal(sold.ok, true);
  assert.equal(sold.state.resources.food, before.resources.food - 4); assert.equal(getShop(sold.state).coins, 12);
  assert.equal(sold.state.xp, before.xp); assert.deepEqual(sold.state.plots, before.plots); assert.deepEqual(harvest.state, before);
  const bought = buyShopSeed(sold.state, 'carrot', 3); assert.equal(bought.ok, true);
  assert.equal(getShop(bought.state).coins, 6); assert.equal(bought.state.resources.seeds, sold.state.resources.seeds + 3);
  assert.equal(getSeedInventory(bought.state).carrot, getSeedInventory(sold.state).carrot + 3);
  assert.equal(bought.state.xp, before.xp); assert.deepEqual(reload(bought.state).shop, bought.state.shop);
});

test('all six seed varieties use the displayed per-seed price and keep the aggregate inventory exact', () => {
  let state = funded(), spent = 0; const initial = structuredClone(state), inventory = getSeedInventory(state);
  for (const cropId of CROP_IDS) {
    const before = structuredClone(state), bought = buyShopSeed(state, cropId, 5); assert.equal(bought.ok, true); assert.deepEqual(state, before);
    state = bought.state; spent += SHOP_SEED_PRICES[cropId] * 5;
    assert.equal(getShop(state).coins, getShop(initial).coins - spent); assert.equal(getSeedInventory(state)[cropId], inventory[cropId] + 5);
    assert.equal(CROP_IDS.reduce((sum, id) => sum + getSeedInventory(state)[id], 0), state.resources.seeds);
  }
  const loaded = reload(state); assert.deepEqual(loaded.seedInventory, state.seedInventory); assert.deepEqual(loaded.plots, initial.plots);
});

test('sales of food, wood, and scrap pay only their transparent rates and never sell seeds or water', () => {
  const state = createGame(), initial = structuredClone(state);
  for (const resource of ['food', 'wood', 'scrap'] as const) {
    const result = sellShopResource(state, resource, 5); assert.equal(result.ok, true);
    assert.equal(result.state.resources[resource], state.resources[resource] - 5); assert.equal(getShop(result.state).coins, SHOP_SALE_PRICES[resource] * 5);
    const expected = { ...initial.resources, [resource]: initial.resources[resource] - 5 }; assert.deepEqual(result.state.resources, expected);
  }
  for (const resource of ['water', 'seeds', '__proto__', 'coins']) noMutation(state, () => sellShopResource(state, resource, 1));
  assert.deepEqual(state, initial);
});

test('paid outfits are reusable for both genders, require ownership, and grant no health, speed, or XP', () => {
  let state = funded(), spent = 0; const original = structuredClone(state);
  noMutation(state, () => equipShopOutfit(state, 'garden'));
  for (const id of OUTFIT_IDS) {
    const previousOutfit = getEquippedOutfit(state);
    const bought = buyShopOutfit(state, id); assert.equal(bought.ok, true); state = bought.state; spent += SHOP_OUTFITS[id].price;
    assert.equal(getEquippedOutfit(state), previousOutfit); const equipped = equipShopOutfit(state, id); assert.equal(equipped.ok, true); state = equipped.state;
    assert.equal(getEquippedOutfit(state), id); assert.equal(getEquippedOutfit(state, 'male'), 'default');
    noMutation(state, () => buyShopOutfit(state, id)); noMutation(state, () => equipShopOutfit(state, id));
  }
  state = { ...state, gender: 'male' }; state = equipShopOutfit(state, 'garden').state;
  assert.equal(getEquippedOutfit(state, 'male'), 'garden'); assert.equal(getEquippedOutfit(state, 'female'), 'explorer');
  assert.equal(getShop(state).coins, getShop(original).coins - spent);
  assert.deepEqual(state.companions, original.companions); assert.deepEqual(state.animalReserve, original.animalReserve);
  for (const field of ['xp', 'health', 'energy', 'totalMinutes', 'deckLevel'] as const) assert.equal(state[field], original[field]);
  const loaded = reload(state); assert.deepEqual(loaded.shop, state.shop);
  const base = equipShopOutfit(loaded, 'default'); assert.equal(base.ok, true); assert.equal(getShop(base.state).coins, getShop(loaded).coins);
  assert.equal(getEquippedOutfit(base.state, 'female'), 'explorer');
});

test('early pet adoption preserves HP and XP and supports saved formations and persisted battles below the deck unlock', () => {
  let state = funded(140); state.companions!.dog = { health: 64, xp: 160 }; state.animalReserve!.fox = { health: 27.5, xp: 319 }; state.animalReserve!.owl = { health: 42, xp: 80 };
  const roster = getUnitRoster(state); let spent = 0;
  for (const id of ['rabbit', 'fox', 'boar', 'owl'] as const) {
    const bought = buyShopPet(state, id); assert.equal(bought.ok, true); state = bought.state; spent += SHOP_PET_PRICES[id];
    assert.equal(getShop(state).coins, 420 - spent); assert.deepEqual(getUnitRoster(state), roster); assert.deepEqual(getSelectedTeam(state), ['dog', 'cat']);
    noMutation(state, () => buyShopPet(state, id));
  }
  assert.equal(state.deckLevel, 1); assert.deepEqual(getUnlockedUnitIds(state), ['dog', 'cat', 'rabbit', 'fox', 'boar', 'owl']);
  const selected = setCompanionTeam(state, ['dog', 'fox', 'owl']); assert.equal(selected.ok, true); state = reload(selected.state);
  assert.deepEqual(getReadyTeam(state), ['dog', 'fox', 'owl']); assert.deepEqual(getUnitRoster(state), roster);
  const hunting = beginHunt(state, 1); assert.equal(hunting.ok, true); state = reload(hunting.state);
  assert.deepEqual(state.expedition!.unitParticipantIds, ['dog', 'fox', 'owl']); assert.deepEqual(getUnitRoster(state), roster);
  const ended = cancelHunt(state); assert.equal(ended.ok, true); assert.deepEqual(reload(ended.state).shop, selected.state.shop);
});

test('already earned pets remain free across old saves and adoption never charges for those friends', () => {
  let state = createGame(); state.resources.wood = state.resources.scrap = 10000;
  for (let level = 1; level < 5; level++) { state.energy = 100; const expanded = performAction(state, 'expand', undefined, undefined, { advanceClock: false }); assert.equal(expanded.ok, true); state = expanded.state; }
  const old = reload(state), before = structuredClone(old); assert.equal(Object.hasOwn(old, 'shop'), false);
  for (const id of ['dog', 'cat', 'rabbit', 'fox', 'boar', 'owl']) noMutation(old, () => buyShopPet(old, id));
  assert.equal(getOwnedPetIds(old).length, 6); assert.deepEqual(old, before);
});

test('invalid IDs, quantities, and insufficient wallets reject every purchase or sale atomically', () => {
  const empty = createGame(), rich = funded();
  for (const quantity of [0, -1, 1.5, 100, 100000000, NaN, Infinity, '5', null, undefined]) {
    if (quantity !== undefined) noMutation(rich, () => buyShopSeed(rich, 'carrot', quantity));
    noMutation(rich, () => sellShopResource(rich, 'wood', quantity));
  }
  for (const id of [null, 'garlic', '__proto__', 1]) noMutation(rich, () => buyShopSeed(rich, id, 1));
  for (const id of [null, 'wolf', '__proto__', 1]) noMutation(rich, () => buyShopPet(rich, id));
  for (const id of [null, 'gold', '__proto__', 'default', 1]) noMutation(rich, () => buyShopOutfit(rich, id));
  noMutation(empty, () => buyShopSeed(empty, 'carrot')); noMutation(empty, () => buyShopPet(empty, 'rabbit')); noMutation(empty, () => buyShopOutfit(empty, 'garden'));
  noMutation(empty, () => sellShopResource(empty, 'food', empty.resources.food + 1));
});

test('shop saves reject unknown fields, duplicate ownership, impossible balances, and unowned equipped outfits', () => {
  const base = getShop(createGame()), memory = storage();
  const bad: unknown[] = [null, [], {}, { ...base, version: 2 }, { ...base, coins: -1 }, { ...base, coins: 1.5 }, { ...base, coins: '10' }, { ...base, coins: 100000001 },
    { ...base, extra: true }, { ...base, adoptedPets: ['dog'] }, { ...base, adoptedPets: ['rabbit', 'rabbit'] }, { ...base, adoptedPets: ['wolf'] },
    { ...base, ownedOutfits: ['road', 'road'] }, { ...base, ownedOutfits: ['unknown'] }, { ...base, equippedOutfits: { female: 'garden', male: 'default' } },
    { ...base, equippedOutfits: { female: 'default' } }, { ...base, equippedOutfits: { female: 'default', male: 'default', extra: 'default' } }];
  for (const invalid of bad) {
    assert.equal(validateShopProgress(invalid), false); const damaged = { ...createGame(), shop: invalid } as GameState;
    memory.setItem(SAVE_KEY, JSON.stringify(damaged)); assert.equal(loadGame(memory), null); assert.equal(saveGame(damaged, memory), false);
    noMutation(damaged, () => sellShopResource(damaged, 'food', 1)); noMutation(damaged, () => buyShopSeed(damaged, 'carrot', 1));
  }
});

test('maximum wallet and seed bounds and damaged seed aggregates prevent resource creation', () => {
  const state = funded(); state.shop!.coins = 100000000;
  noMutation(state, () => sellShopResource(state, 'wood', 1));
  state.seedInventory = { carrot: 100000000, potato: 0, tomato: 0, corn: 0, strawberry: 0, pumpkin: 0 }; state.resources.seeds = 100000000;
  noMutation(state, () => buyShopSeed(state, 'potato', 1)); assert.ok(reload(state));
  state.resources.seeds--; noMutation(state, () => buyShopSeed(state, 'carrot', 1)); noMutation(state, () => sellShopResource(state, 'wood', 1));
  const missing = createGame(); delete missing.seedInventory; const sold = sellShopResource(missing, 'food', 4); assert.equal(sold.ok, true);
  const bought = buyShopSeed(sold.state, 'potato', 2); assert.equal(bought.ok, true); assert.equal(bought.state.seedInventory!.carrot, missing.resources.seeds); assert.equal(bought.state.seedInventory!.potato, 2); assert.ok(reload(bought.state));
  const damaged = { ...createGame(), seedInventory: null } as unknown as GameState; noMutation(damaged, () => sellShopResource(damaged, 'food', 1));
});

test('all shop transactions refuse during a persisted expedition without changing materials or ownership', () => {
  let state = funded(); state = buyShopOutfit(state, 'garden').state; state = beginHunt(state, 1).state; assert.ok(state.expedition);
  for (const run of [() => buyShopSeed(state, 'carrot', 1), () => buyShopPet(state, 'fox'), () => buyShopOutfit(state, 'road'), () => equipShopOutfit(state, 'garden'), () => sellShopResource(state, 'wood', 1)]) noMutation(state, run);
});

test('shopping leaves active crops, production deadlines, deck directions, formation, and simulation clocks exact', () => {
  let state = funded(); state.resources.wood = 100; state = buildFacility(state, 'waterworks', 0).state; state = startProduction(state, 1).state; state = rotateLayoutTarget(state, { kind: 'plot', id: 1 }).state;
  const original = structuredClone(state), beforeCoin = getShop(state).coins;
  state = buyShopSeed(state, 'strawberry', 5).state; state = buyShopPet(state, 'fox').state; state = buyShopOutfit(state, 'road').state; state = equipShopOutfit(state, 'road').state;
  assert.deepEqual(getSettlement(state), getSettlement(original)); assert.deepEqual(state.plots, original.plots); assert.deepEqual(state.layoutDirections, original.layoutDirections);
  assert.deepEqual(state.companionTeam, original.companionTeam); assert.deepEqual(getUnitRoster(state), getUnitRoster(original));
  for (const field of ['day', 'minutes', 'totalMinutes', 'energy', 'health', 'morale', 'truckHealth', 'xp', 'level', 'lastSaved', 'deckLevel'] as const) assert.equal(state[field], original[field]);
  assert.equal(getShop(state).coins, beforeCoin - 35 - 90 - 60); assert.deepEqual(state.log, original.log); assert.ok(reload(state));
});

test('ordinary farming, production, growth rewards, deliveries, rotations, and battle actions deep-copy paid metadata', () => {
  let state = funded(); state.resources.wood = 100; state.resources.water = 100;
  state = buyShopPet(state, 'fox').state; state = buyShopOutfit(state, 'garden').state; state = equipShopOutfit(state, 'garden').state;
  state = performAction(state, 'gather', undefined, undefined, { advanceClock: false }).state;
  const built = buildFacility(state, 'waterworks', 0).state, producing = startProduction(built, 1).state;
  const variants = [tick(state, 1), advanceTime(state, 1), performAction(state, 'water', 2, undefined, { advanceClock: false }).state,
    claimGrowthQuest(state, 'road-supplies').state, fulfillVillageOrder(state, getVillageOrder(state).id).state, built, producing,
    collectProduction(advanceTime(producing, 90), 1).state, rotateLayoutTarget(state, { kind: 'plot', id: 1 }).state,
    setCompanionTeam(state, ['dog', 'fox']).state, beginHunt(state, 1).state, { ...state, ...cloneShopFields(state) }];
  for (const next of variants) {
    assert.notEqual(next, state); assert.deepEqual(next.shop, state.shop); assert.notEqual(next.shop, state.shop);
    assert.notEqual(next.shop!.adoptedPets, state.shop!.adoptedPets); assert.notEqual(next.shop!.ownedOutfits, state.shop!.ownedOutfits); assert.notEqual(next.shop!.equippedOutfits, state.shop!.equippedOutfits);
    const before = structuredClone(state.shop); next.shop!.adoptedPets.length = 0; next.shop!.ownedOutfits.length = 0; next.shop!.equippedOutfits.female = 'default'; assert.deepEqual(state.shop, before);
  }
});
