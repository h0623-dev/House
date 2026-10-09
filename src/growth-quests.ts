import type { ActionResult, GameState, Resource } from './game';
import { CROP_IDS, type CropId } from './crops';
import { getBuiltTypes, getSettlement, getLegacySettlement, getUpgradedFacilityRecord, getHighestFacilityLevel, type BuildingType } from './settlement';
import { cloneTruckLayoutFields } from './truck-layout';
import { cloneCompanions } from './companions';
import { cloneUnitProgressFields, getMaxTeamSize, getUnlockedUnitIds } from './units';

export type GrowthQuestStatus = 'locked' | 'active' | 'ready' | 'claimed';
export interface GrowthQuestProgress { claimed: string[] }
export interface GrowthQuestReward {
  resources?: Partial<Record<Resource, number>>;
  seeds?: Partial<Record<CropId, number>>;
  xp: number;
}
export interface GrowthQuestDestination {
  kind: 'gather' | 'harvest' | 'plant' | 'water' | 'build' | 'collect' | 'upgrade' | 'chop' | 'hunt' | 'expand' | 'companions';
  buildingType?: BuildingType;
}
type Metric = 'gathers' | 'harvests' | 'plantings' | 'waterings' | 'chops' | 'deck' | 'collections' | 'building' | 'buildingTypes' | 'upgradedFacilities' | 'battlesWon' | 'highestFacilityLevel' | 'unlockedUnits' | 'maxTeamSize';
export interface GrowthQuestDefinition {
  id: string;
  chapter: number;
  title: string;
  description: string;
  story: string;
  hint: string;
  target: number;
  reward: GrowthQuestReward;
  destination: GrowthQuestDestination;
  metric: Metric;
}
export interface GrowthQuestView extends GrowthQuestDefinition { current: number; status: GrowthQuestStatus }
export const GROWTH_CHAPTERS = [
  { id: 1, title: '도로 위 첫 아침', description: '보급품과 첫 생활 시설을 마련해요.', story: '2187년 대한민국. 좀비가 가득한 도로에서도 우리의 작은 집을 만들 수 있어요.' },
  { id: 2, title: '우리집이 자라는 날', description: '밭과 부엌을 돌보고 생활 공간을 넓혀요.', story: '직접 심은 씨앗과 따뜻한 한 끼가 트럭 위의 하루를 바꿔요.' },
  { id: 3, title: '함께 움직이는 마을', description: '목재와 공방으로 생산의 흐름을 만들어요.', story: '한 시설이 만든 물자는 또 다른 시설과 새로운 공간의 재료가 돼요.' },
  { id: 4, title: '보리와 도로 너머로', description: '반려견과 농장, 사냥을 함께 성장시켜요.', story: '보리와 함께 안전한 길을 찾아요. 돌아올 트럭 마을이 있어 든든해요.' },
  { id: 5, title: '여섯 이웃의 트럭', description: '온실과 감시소를 더해 생활 시설을 갖춰요.', story: '다양한 시설이 서로를 도우며 도로 위에서도 일상이 풍성해져요.' },
  { id: 6, title: '우리의 로드헤이븐', description: '시설을 개선하고 가장 넓은 마을을 완성해요.', story: '작은 씨앗 하나에서 시작한 우리집. 이제 이 트럭은 우리가 함께 살아가는 마을이에요.' },
  { id: 7, title: '새 친구들과 더 먼 길로', description: '동료를 만나고 생산과 트럭을 한 단계 더 키워요.', story: '강아지와 고양이 곁에 새 친구들이 찾아왔어요. 저마다 다른 재능으로 함께 먼 길을 준비해요.' },
  { id: 8, title: '끝없이 이어지는 우리집', description: '최고의 시설과 여덟 번째 데크를 완성해요.', story: '친구들의 기술과 마을의 생산이 함께 자라요. 먼 미래의 도로 위에서도 우리의 일상은 계속돼요.' },
] as const;

function quest(id: string, chapter: number, title: string, description: string, metric: Metric, target: number,
  destination: GrowthQuestDestination, reward: GrowthQuestReward, hint: string): GrowthQuestDefinition {
  if (reward.resources) Object.freeze(reward.resources);
  if (reward.seeds) Object.freeze(reward.seeds);
  return Object.freeze({ id, chapter, title, description, metric, target, destination: Object.freeze(destination),
    reward: Object.freeze(reward), hint, story: GROWTH_CHAPTERS[chapter - 1].story });
}
export const GROWTH_QUESTS: readonly GrowthQuestDefinition[] = Object.freeze([
  quest('road-supplies', 1, '첫 보급품을 찾아요', '주변 도로를 1번 탐색하기', 'gathers', 1, { kind: 'gather' }, { resources: { wood: 6, scrap: 3 }, xp: 10 }, '탐색으로 목재·고철·물·씨앗을 모아요. 기력이 부족하면 먼저 쉬어요.'),
  quest('first-carrot', 1, '작은 농부의 첫 수확', '텃밭에서 작물 1밭 수확하기', 'harvests', 1, { kind: 'harvest' }, { resources: { water: 4 }, seeds: { carrot: 3 }, xp: 15 }, '처음부터 익어 있는 1번 밭을 수확해 보세요.'),
  quest('rainwater-home', 1, '물을 모으는 우리집', '빗물 정수소 건설하기', 'building', 1, { kind: 'build', buildingType: 'waterworks' }, { resources: { wood: 8, scrap: 4 }, xp: 20 }, '빈 건설 자리에 빗물 정수소를 놓아요. 목재 12·고철 4가 필요해요.'),
  quest('first-delivery', 1, '우리 손으로 만든 물자', '생활 시설 생산품 1번 받기', 'collections', 1, { kind: 'collect', buildingType: 'waterworks' }, { resources: { wood: 12, scrap: 6 }, xp: 20 }, '정수소에서 생산을 시작해요. 완성 후 수령해 주세요. 휴식해도 게임 시간이 흘러요.'),
  quest('new-seeds', 2, '두 밭에 새 씨앗', '씨앗을 총 2밭에 심기', 'plantings', 2, { kind: 'plant' }, { resources: { water: 4 }, seeds: { potato: 3, tomato: 3 }, xp: 20 }, '씨앗을 선택한 뒤 빈 밭 두 곳을 눌러요. 이미 자라는 밭은 수확하면 비워져요.'),
  quest('tender-watering', 2, '물 한 방울의 정성', '작물에 총 2밭 물 주기', 'waterings', 2, { kind: 'water' }, { resources: { wood: 10, scrap: 6 }, xp: 20 }, '씨앗을 심은 밭에 물을 주세요. 실제로 돌본 밭만 목표에 기록돼요.'),
  quest('warm-kitchen', 2, '따뜻한 한 끼를 준비해요', '트럭 부엌 건설하기', 'building', 1, { kind: 'build', buildingType: 'kitchen' }, { resources: { food: 4, water: 6 }, xp: 25 }, '목재 16·고철 6으로 부엌을 지어요. 물을 사용해 식량을 생산할 수 있어요.'),
  quest('wider-deck', 2, '조금 더 넓은 우리집', '트럭 데크 2단계 만들기', 'deck', 2, { kind: 'expand' }, { resources: { wood: 20, scrap: 10 }, xp: 30 }, '데크를 확장하면 새 밭 1곳과 건설 자리 2곳이 생겨요.'),
  quest('forest-logs', 3, '숲길에서 모은 통나무', '벌목장에서 나무 총 3번 베기', 'chops', 3, { kind: 'chop' }, { resources: { wood: 8, scrap: 4 }, xp: 25 }, '나무를 직접 눌러 벌목해요. 한 번에 목재 18과 씨앗 꾸러미를 얻어요.'),
  quest('recycle-workshop', 3, '버려진 부품의 새 쓰임', '재활용 공방 건설하기', 'building', 1, { kind: 'build', buildingType: 'workshop' }, { resources: { wood: 10, scrap: 8 }, xp: 30 }, '데크 2단계에서 공방을 지어요. 목재를 고철로 바꾸는 생산 흐름을 만들어요.'),
  quest('steady-deliveries', 3, '마을의 생산이 이어져요', '생활 시설 생산품 총 4번 받기', 'collections', 4, { kind: 'collect' }, { resources: { food: 4, water: 6 }, xp: 30 }, '시설마다 한 묶음씩 생산해요. 완성품을 받고 다음 생산을 시작해 주세요.'),
  quest('better-facility', 3, '더 든든한 생활 시설', '시설 1곳을 2단계로 개선하기', 'upgradedFacilities', 1, { kind: 'upgrade' }, { resources: { wood: 24, scrap: 12 }, xp: 35 }, '생산품을 먼저 받은 뒤 시설을 개선해요. 한 번에 생산하는 양이 늘어나요.'),
  quest('boris-home', 4, '동물 친구들의 작은 집', '동료의 쉼터 건설하기', 'building', 1, { kind: 'build', buildingType: 'petHouse' }, { resources: { food: 4, wood: 8 }, xp: 35 }, '쉼터는 목재를 생산하고 모든 출전 동료의 공격력을 레벨마다 4%씩 높여요.'),
  quest('full-baskets', 4, '풍성해진 우리 텃밭', '작물 총 8밭 수확하기', 'harvests', 8, { kind: 'harvest' }, { resources: { water: 6 }, seeds: { corn: 3, strawberry: 3 }, xp: 40 }, '물 주기와 수확을 이어가요. 수확하면 같은 씨앗도 돌아와 다시 심을 수 있어요.'),
  quest('safe-road', 4, '돌아올 마을이 있어요', '동물 친구들과 전투 스테이지 1번 승리하기', 'battlesWon', 1, { kind: 'hunt' }, { resources: { wood: 20, scrap: 12 }, xp: 40 }, '강아지 보리와 고양이 나비가 싸워요. 건강한 동물 친구와 기력 16을 준비하고 기술을 사용해 보세요.'),
  quest('third-deck', 4, '새로운 이웃을 맞을 자리', '트럭 데크 3단계 만들기', 'deck', 3, { kind: 'expand' }, { resources: { wood: 30, scrap: 16 }, xp: 45 }, '목재와 고철을 모아 마을을 넓혀요. 새 시설 두 종류가 열려요.'),
  quest('greenhouse-garden', 5, '계절을 돌보는 온실', '작은 온실 건설하기', 'building', 1, { kind: 'build', buildingType: 'greenhouse' }, { resources: { water: 8, wood: 10 }, xp: 45 }, '데크 3단계에서 온실을 지어요. 물을 공급해 식량을 안정적으로 생산해요.'),
  quest('road-scanner', 5, '도로를 살피는 새 눈', '도로 감시소 건설하기', 'building', 1, { kind: 'build', buildingType: 'watchtower' }, { resources: { wood: 16, scrap: 10 }, xp: 45 }, '감시소의 스캐너로 폐부품을 찾아요. 생산에 추가 재료는 필요하지 않아요.'),
  quest('six-neighbors', 5, '여섯 시설이 함께해요', '서로 다른 생활 시설 6종 건설하기', 'buildingTypes', 6, { kind: 'build' }, { resources: { wood: 30, scrap: 18 }, xp: 50 }, '정수소·부엌·공방·보리의 집·온실·감시소를 모두 만나 보세요. 건설 경험은 시설을 교체해도 남아요.'),
  quest('fourth-deck', 5, '트럭 위 마을의 풍경', '트럭 데크 4단계 만들기', 'deck', 4, { kind: 'expand' }, { resources: { wood: 36, scrap: 20 }, xp: 55 }, '생산과 탐색으로 자원을 모아요. 더 넓은 데크에서 시설을 배치해 보세요.'),
  quest('three-upgrades', 6, '정성이 쌓인 세 곳', '서로 다른 시설 3곳을 2단계로 개선하기', 'upgradedFacilities', 3, { kind: 'upgrade' }, { resources: { wood: 40, scrap: 24 }, xp: 60 }, '각 시설의 개선 경험이 남아요. 같은 시설을 교체해 반복 개선해도 수가 늘어나지는 않아요.'),
  quest('busy-village', 6, '물자가 오가는 마을', '생활 시설 생산품 총 12번 받기', 'collections', 12, { kind: 'collect' }, { resources: { wood: 32, scrap: 20, food: 8 }, xp: 60 }, '개선한 시설에서 더 많은 물자를 받아요. 받을 때마다 마을의 생산 실적이 쌓여요.'),
  quest('fifth-deck', 6, '우리집의 넓은 내일', '트럭 데크 5단계 만들기', 'deck', 5, { kind: 'expand' }, { resources: { wood: 80, scrap: 36 }, xp: 75 }, '마지막 확장을 준비해요. 부족한 목재는 벌목, 고철은 공방·감시소·탐색으로 보급해요.'),
  quest('road-haven', 6, '우리가 만든 로드헤이븐', '트럭 데크 6단계 완성하기', 'deck', 6, { kind: 'expand' }, { resources: { food: 20, water: 20 }, seeds: { carrot: 3, potato: 3, tomato: 3, corn: 3, strawberry: 3, pumpkin: 3 }, xp: 120 }, '가장 넓은 트럭 마을을 완성했어요. 새로운 농사와 배치로 나만의 일상을 이어가요.'),
  quest('advanced-facility', 7, '더 빠르게 돌아가는 마을', '생활 시설 1곳을 Lv.4로 개선하기', 'highestFacilityLevel', 4, { kind: 'upgrade' }, { resources: { wood: 36, scrap: 18 }, xp: 75 }, '시설을 선택하면 현재와 다음 레벨의 생산량·시간·필요 재료를 볼 수 있어요. 물자를 받은 뒤 한 단계씩 개선해요.'),
  quest('three-friend-team', 7, '셋이서 지키는 우리집', '동물 동료 3명으로 탐험 팀 편성하기', 'maxTeamSize', 3, { kind: 'companions' }, { resources: { food: 12, water: 12 }, xp: 75 }, '동료 창에서 만난 동물 중 서로 다른 세 명을 골라 편성을 저장해요. 한 번 완성한 편성 기록은 이후 바꿔도 남아요.'),
  quest('six-animal-friends', 7, '저마다 다른 여섯 재능', '동물 동료 6명을 모두 만나기', 'unlockedUnits', 6, { kind: 'companions' }, { resources: { wood: 48, scrap: 24 }, xp: 80 }, '데크가 자라면 토끼·여우·멧돼지·부엉이를 만나요. 동료 창에서 역할과 고유 기술을 확인해 주세요.'),
  quest('seventh-deck', 7, '도로 위의 새로운 자리', '트럭 데크 7단계 만들기', 'deck', 7, { kind: 'expand' }, { resources: { wood: 64, scrap: 32 }, xp: 90 }, '데크를 확장하면 건설 자리가 두 곳 더 열려요. 생산과 벌목으로 재료를 모으고 새 밭도 늘려요.'),
  quest('fifth-level-facility', 8, '우리 마을의 최고 시설', '생활 시설 1곳을 Lv.5로 개선하기', 'highestFacilityLevel', 5, { kind: 'upgrade' }, { resources: { wood: 48, scrap: 24, water: 12 }, xp: 90 }, 'Lv.5 시설은 더 많은 물자를 빠르게 만들어요. 쉼터는 동료 공격력, 감시소는 적 피해 감소 효과도 커져요.'),
  quest('twenty-four-deliveries', 8, '모두를 위한 풍성한 물자', '생활 시설 생산품 총 24번 받기', 'collections', 24, { kind: 'collect' }, { resources: { wood: 64, scrap: 32, food: 16 }, xp: 90 }, '개선한 정수소·부엌·공방의 생산을 이어가요. 새로 받은 생산품만 기록되며 완성품을 중복 수령할 수 없어요.'),
  quest('five-road-victories', 8, '동료들의 든든한 발걸음', '동물 전투 스테이지 총 5번 승리하기', 'battlesWon', 5, { kind: 'hunt' }, { resources: { wood: 80, scrap: 40, food: 12 }, xp: 100 }, '앞줄 수호·공격·치유 역할을 함께 편성해 도전해요. 지친 친구는 트럭에서 쉬고, 승리한 동료들은 경험치를 얻어요.'),
  quest('eighth-deck-home', 8, '끝없이 이어지는 우리집', '트럭 데크 8단계 완성하기', 'deck', 8, { kind: 'expand' }, { resources: { food: 24, water: 24 }, seeds: { carrot: 3, potato: 3, tomato: 3, corn: 3, strawberry: 3, pumpkin: 3 }, xp: 140 }, '여덟 번째 데크와 건설 자리 16곳을 완성했어요. 동료들의 편성과 최고 시설로 우리만의 생활을 이어가요.'),
]);

function progress(state: GameState, definition: GrowthQuestDefinition): number {
  switch (definition.metric) {
    case 'deck': return state.deckLevel;
    case 'building': return Number(getBuiltTypes(state).includes(definition.destination.buildingType!));
    case 'buildingTypes': return getBuiltTypes(state).length;
    case 'collections': return getSettlement(state).stats?.collections ?? 0;
    case 'upgradedFacilities': return getUpgradedFacilityRecord(state);
    case 'highestFacilityLevel': return getHighestFacilityLevel(state);
    case 'unlockedUnits': return getUnlockedUnitIds(state).length;
    case 'maxTeamSize': return getMaxTeamSize(state);
    default: return state.stats[definition.metric] ?? 0;
  }
}
function cloneReward(reward: GrowthQuestReward): GrowthQuestReward {
  return { xp: reward.xp, ...(reward.resources ? { resources: { ...reward.resources } } : {}), ...(reward.seeds ? { seeds: { ...reward.seeds } } : {}) };
}
export function getGrowthQuests(state: GameState): GrowthQuestView[] {
  const claimed = state.growthQuests?.claimed ?? [];
  return GROWTH_QUESTS.map((definition, index) => {
    const current = Math.min(definition.target, Math.max(0, progress(state, definition)));
    const status: GrowthQuestStatus = index < claimed.length ? 'claimed' : index > claimed.length ? 'locked' : current >= definition.target ? 'ready' : 'active';
    return { ...definition, reward: cloneReward(definition.reward), destination: { ...definition.destination }, current, status };
  });
}
export function getActiveGrowthQuest(state: GameState): GrowthQuestView | null {
  return getGrowthQuests(state).find(quest => quest.status === 'active' || quest.status === 'ready') ?? null;
}
export function validateGrowthQuests(value: unknown, state: GameState): value is GrowthQuestProgress {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  if (Object.keys(candidate).length !== 1 || !Array.isArray(candidate.claimed) || candidate.claimed.length > GROWTH_QUESTS.length) return false;
  return candidate.claimed.every((id, index) => id === GROWTH_QUESTS[index].id && progress(state, GROWTH_QUESTS[index]) >= GROWTH_QUESTS[index].target);
}
const resourceKeys: Resource[] = ['wood', 'scrap', 'food', 'water', 'seeds'];
const integer = (value: number) => Number.isSafeInteger(value) && value >= 0 && value <= 100_000_000;
export function claimGrowthQuest(state: GameState, id: string): ActionResult {
  const fail = (message: string): ActionResult => ({ state, ok: false, message });
  if (state.expedition) return fail('사냥을 마친 뒤 트럭에서 성장 목표 보상을 받아 주세요.');
  if (Object.hasOwn(state, 'growthQuests') && !validateGrowthQuests(state.growthQuests, state)) return fail('성장 목표의 저장 상태를 확인해 주세요.');
  const claimed = state.growthQuests?.claimed ?? [], definition = GROWTH_QUESTS[claimed.length];
  if (!definition || id !== definition.id) return fail('현재 성장 목표부터 차례로 보상을 받아 주세요. 이미 받은 보상은 다시 받을 수 없어요.');
  if (progress(state, definition) < definition.target) return fail('목표를 달성한 뒤 보상을 받을 수 있어요.');
  const reward = definition.reward;
  const seeds = state.seedInventory ? { ...state.seedInventory } : { carrot: state.resources.seeds, potato: 0, tomato: 0, corn: 0, strawberry: 0, pumpkin: 0 };
  if (!resourceKeys.every(key => integer(state.resources[key])) || !CROP_IDS.every(id => integer(seeds[id]))
    || CROP_IDS.reduce((sum, id) => sum + seeds[id], 0) !== state.resources.seeds || !integer(state.xp)) return fail('보유 자원과 경험치의 저장 상태를 확인해 주세요.');
  let seedTotal = 0;
  for (const cropId of CROP_IDS) {
    const amount = (reward.seeds?.[cropId] ?? 0) + (cropId === 'carrot' ? reward.resources?.seeds ?? 0 : 0);
    if (!integer(seeds[cropId] + amount)) return fail('씨앗 보관량이 가득해요. 씨앗을 사용한 뒤 보상을 받아 주세요.');
    seeds[cropId] += amount; seedTotal += seeds[cropId];
  }
  if (!integer(seedTotal) || !integer(state.xp + reward.xp)) return fail('씨앗이나 경험치 보관량을 확인한 뒤 보상을 받아 주세요.');
  for (const key of resourceKeys.filter(key => key !== 'seeds')) {
    if (!integer(state.resources[key] + (reward.resources?.[key] ?? 0))) return fail('자원 보관량이 가득해요. 자원을 사용한 뒤 보상을 받아 주세요.');
  }
  const next: GameState = {
    ...state, resources: { ...state.resources, seeds: seedTotal }, seedInventory: seeds,
    plots: state.plots.map(plot => ({ ...plot })), quests: [...state.quests], stats: { ...state.stats },
    ...(state.settlement ? { settlement: getLegacySettlement(state) } : {}),
    ...cloneTruckLayoutFields(state),
    ...(state.villageOrders ? { villageOrders: { ...state.villageOrders } } : {}),
    ...(state.companions ? { companions: cloneCompanions(state.companions) } : {}),
    ...cloneUnitProgressFields(state),
    ...(state.facilityHistory ? { facilityHistory: { ...state.facilityHistory,
      builtTypes: [...state.facilityHistory.builtTypes], upgradedFacilityIds: [...state.facilityHistory.upgradedFacilityIds] } } : {}),
    expedition: null,
    growthQuests: { claimed: [...claimed, definition.id] },
    log: [`${state.day}일차 · 성장 목표 완료! ${definition.title} · 보상을 받았어요.`, ...state.log].slice(0, 30),
    xp: state.xp + reward.xp,
  };
  for (const key of resourceKeys.filter(key => key !== 'seeds')) next.resources[key] += reward.resources?.[key] ?? 0;
  next.level = Math.floor(next.xp / 120) + 1;
  return { state: next, ok: true, message: `${definition.title} 보상을 받았어요! 다음 목표와 함께 우리 마을을 키워요.` };
}
