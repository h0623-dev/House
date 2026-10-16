import type { ActionResult, GameState, Resource } from './game';
import { reconcileFarmEconomyFood, validateFarmEconomy } from './farm-economy';
import { getShop, validateShopProgress } from './shop';
import { isUnitId, UNITS, type UnitId } from './units';

/** A real Korean calendar day, independent of the accelerated village clock. */
export type CozyDateKey = string;
export type CozyDayPeriod = 'morning' | 'afternoon' | 'evening' | 'night';
export type CozyDayGoalId = 'friend' | 'forage' | 'decorate';
export type CozyGiftResource = Exclude<Resource, 'seeds'>;
export interface CozyAnimalProgress {
  affinity: number;
  petDay?: CozyDateKey;
  giftDay?: CozyDateKey;
  requestDay?: CozyDateKey;
}
export interface CozyDailyProgress {
  day: CozyDateKey;
  baseline: { harvests: number; gathers: number; chops: number };
  petted: UnitId[];
  decorations: number;
  claimed: CozyDayGoalId[];
}
export interface CozyLifeProgress {
  version: 1;
  animals: Partial<Record<UnitId, CozyAnimalProgress>>;
  daily?: CozyDailyProgress;
}
type CozyState = GameState & { cozyLife?: CozyLifeProgress };
type CozyFields = { cozyLife?: CozyLifeProgress };
export interface CozyAnimalProfile {
  personality: string;
  likes: string;
  gift: { resource: CozyGiftResource; amount: number; label: string };
  request: { title: string; description: string; costs: Partial<Record<CozyGiftResource, number>>; rewardCoins: number };
  activities: Record<CozyDayPeriod, string>;
  greetings: Record<CozyDayPeriod, string>;
  friendship: readonly [string, string, string];
}

/** Animal thoughts are original dialogue, with gifts backed by actual inventory. */
export const COZY_ANIMAL_PROFILES: Readonly<Record<UnitId, CozyAnimalProfile>> = {
  dog: {
    personality: '꼬리부터 인사하는 다정한 산책 친구', likes: '든든한 먹거리와 함께하는 산책',
    gift: { resource: 'food', amount: 2, label: '든든한 간식' },
    request: { title: '산책 뒤 간식 시간', description: '한 바퀴 돌고 오니 배가 고픈가 봐요. 간식과 깨끗한 물을 챙겨 주세요.', costs: { food: 3, water: 1 }, rewardCoins: 12 },
    activities: { morning: '아침 산책 중', afternoon: '꼬리 흔들며 놀기', evening: '트럭 곁을 지키는 중', night: '발치에서 쉬는 중' },
    greetings: { morning: '오늘도 같이 걸을까? 아침 냄새가 좋아!', afternoon: '여기 시원해! 잠깐 같이 놀자.', evening: '오늘도 무사히 돌아왔네. 기다리고 있었어!', night: '이제 푹 쉬어. 내가 곁에 있을게.' },
    friendship: ['네 발소리를 조금씩 알아가는 중이에요.', '보리가 당신이 오는 쪽으로 꼬리를 흔들어요.', '보리에게 가장 편한 자리는 당신 곁이에요.'],
  },
  cat: {
    personality: '햇볕 좋은 자리를 찾아다니는 느긋한 친구', likes: '작은 간식과 조용한 낮잠 자리',
    gift: { resource: 'food', amount: 1, label: '작은 간식' },
    request: { title: '나비의 작은 낮잠 준비', description: '푹신한 자리를 마련할 나무 조각과 낮잠 전 간식을 부탁해요.', costs: { wood: 2, food: 1 }, rewardCoins: 10 },
    activities: { morning: '햇살 받으며 기지개', afternoon: '따뜻한 곳에서 낮잠', evening: '느긋하게 주변 구경', night: '고요한 밤 산책 중' },
    greetings: { morning: '이 햇볕, 꽤 괜찮네. 옆자리는 비워 뒀어.', afternoon: '조금만 더 잘래. 여기 바람이 좋아.', evening: '오늘은 어디 다녀왔어? 낯선 풀 냄새가 나.', night: '다들 잠들면 달빛이 더 잘 보여.' },
    friendship: ['나비가 살짝 눈을 맞춰 줘요.', '나비가 편안하게 배를 보이며 쉬어요.', '나비가 당신 손에 머리를 살며시 비벼요.'],
  },
  rabbit: {
    personality: '조심스럽지만 호기심 많은 텃밭 친구', likes: '신선한 먹거리와 풀 향기',
    gift: { resource: 'food', amount: 2, label: '신선한 먹거리' },
    request: { title: '루루의 텃밭 소풍', description: '숲 가장자리로 소풍을 가려 해요. 먹거리와 물을 조금 나눠 주세요.', costs: { food: 2, water: 2 }, rewardCoins: 11 },
    activities: { morning: '이슬 맺힌 풀 구경', afternoon: '짧게 깡충거리며 놀기', evening: '텃밭 주변을 살피는 중', night: '귀를 접고 쉬는 중' },
    greetings: { morning: '풀잎에 물방울이 반짝여. 같이 볼래?', afternoon: '여기서 저기까지, 깡충! 너도 해 볼래?', evening: '오늘 텃밭은 얼마나 자랐을까?', night: '작은 소리도 잘 들리는 밤이야. 포근해.' },
    friendship: ['루루가 귀를 세우고 당신을 살펴봐요.', '루루가 가까이 와서 코를 씰룩여요.', '루루가 안심하고 당신 곁에 웅크려요.'],
  },
  fox: {
    personality: '길가의 작은 변화를 먼저 찾는 영리한 친구', likes: '맛있는 간식과 반짝이는 발견',
    gift: { resource: 'food', amount: 2, label: '소풍 간식' },
    request: { title: '루비의 길가 보물함', description: '찾아 둔 작은 물건을 담을 상자를 만들고 싶대요. 목재와 고철을 모아 주세요.', costs: { wood: 3, scrap: 2 }, rewardCoins: 14 },
    activities: { morning: '숲 가장자리 살피기', afternoon: '꼬리 따라 빙글 놀기', evening: '새로운 길 냄새 맡기', night: '달빛 아래 둘러보는 중' },
    greetings: { morning: '저쪽 길에 작은 발자국이 생겼어. 누구 걸까?', afternoon: '그늘에서 쉬면 좋은 생각이 떠올라.', evening: '해 질 때 풀빛이 달라지는 거, 봤어?', night: '쉿, 밤에는 숲이 다른 이야기를 해 줘.' },
    friendship: ['루비가 호기심 어린 눈으로 다가와요.', '루비가 찾은 작은 발견을 함께 구경해요.', '루비가 당신과 걷는 길을 가장 좋아해요.'],
  },
  boar: {
    personality: '먹는 즐거움과 흙 냄새를 아는 듬직한 친구', likes: '푸짐한 먹거리와 부드러운 흙',
    gift: { resource: 'food', amount: 3, label: '푸짐한 간식' },
    request: { title: '도도의 든든한 한 끼', description: '오늘도 마을을 지켜 준 도도에게 푸짐한 먹거리와 물을 준비해 주세요.', costs: { food: 4, water: 2 }, rewardCoins: 16 },
    activities: { morning: '흙 냄새 맡으며 산책', afternoon: '풀밭을 킁킁 살피기', evening: '느긋하게 몸 풀기', night: '든든하게 쉬는 중' },
    greetings: { morning: '흙 냄새 좋다! 오늘도 든든하게 시작하자.', afternoon: '서두르지 않아도 돼. 좋은 건 천천히 찾자.', evening: '오늘 일한 만큼 저녁도 맛있을 거야.', night: '배도 마음도 든든하네. 잘 자!' },
    friendship: ['도도가 코를 킁킁거리며 인사해요.', '도도가 당신 옆에서 편히 몸을 눕혀요.', '도도는 당신이 부르면 가장 먼저 고개를 들어요.'],
  },
  owl: {
    personality: '고요한 풍경과 밤하늘을 좋아하는 관찰자', likes: '둥지용 목재와 조용한 저녁',
    gift: { resource: 'wood', amount: 2, label: '둥지용 나뭇가지' },
    request: { title: '모모의 아늑한 둥지', description: '바람을 막을 둥지를 손보고 싶대요. 목재와 작은 고철을 건네 주세요.', costs: { wood: 4, scrap: 1 }, rewardCoins: 13 },
    activities: { morning: '눈을 감고 쉬는 중', afternoon: '그늘에서 깃털 고르기', evening: '날개 펴며 기지개', night: '밤하늘 바라보는 중' },
    greetings: { morning: '벌써 아침이네. 오늘 꿈에는 숲이 나왔어.', afternoon: '잠깐 쉬어 가도 괜찮아. 그늘이 시원하거든.', evening: '자, 이제 별을 기다려 볼까?', night: '저 별은 어제도 여기 있었어. 우리 집처럼.' },
    friendship: ['모모가 천천히 눈을 깜박여 줘요.', '모모가 낮은 울음으로 당신을 반겨요.', '모모가 당신과 함께 볼 밤하늘을 기다려요.'],
  },
  monkey: {
    personality: '재미있는 놀이를 찾아내는 장난꾸러기', likes: '달콤한 먹거리와 새로운 놀이',
    gift: { resource: 'food', amount: 2, label: '달콤한 간식' },
    request: { title: '몽이의 놀이 쉼터', description: '작은 놀이판을 만들고 싶대요. 목재와 놀고 나서 먹을 간식을 준비해 주세요.', costs: { wood: 3, food: 2 }, rewardCoins: 14 },
    activities: { morning: '손발 쭉 펴며 기지개', afternoon: '신나게 장난치는 중', evening: '친구들 주변 구경', night: '작게 웅크려 쉬는 중' },
    greetings: { morning: '오늘은 뭘 하고 놀까? 벌써 신나!', afternoon: '이거 봐! 방금 재미있는 걸 찾았어.', evening: '오늘 한 일 중에 뭐가 제일 재밌었어?', night: '내일 놀이도 생각해 뒀어. 비밀이야!' },
    friendship: ['몽이가 살짝 손을 흔들어요.', '몽이가 당신을 놀이 친구로 불러요.', '몽이는 좋은 걸 찾으면 당신에게 먼저 보여 줘요.'],
  },
  elephant: {
    personality: '천천히 걸으며 모두를 챙기는 온화한 친구', likes: '깨끗한 물과 넓은 그늘',
    gift: { resource: 'water', amount: 3, label: '시원한 물' },
    request: { title: '코코의 시원한 물 한 모금', description: '느긋하게 산책한 코코가 물을 찾고 있어요. 먹거리도 조금 곁들여 주세요.', costs: { water: 5, food: 2 }, rewardCoins: 18 },
    activities: { morning: '코 흔들며 느린 산책', afternoon: '큰 그늘에서 쉬기', evening: '마을을 느긋하게 둘러보기', night: '조용히 서서 쉬는 중' },
    greetings: { morning: '천천히 가자. 걸으면서 볼 게 많거든.', afternoon: '이 큰 그늘, 함께 써도 좋아.', evening: '모두 돌아왔네. 오늘도 좋은 하루였어.', night: '작은 친구들이 편히 자면 나도 마음이 놓여.' },
    friendship: ['코코가 코끝을 살며시 흔들어요.', '코코가 발걸음을 맞춰 함께 걸어요.', '코코는 당신에게 등을 맡겨도 안심해요.'],
  },
  giraffe: {
    personality: '멀리 보이는 풍경도 함께 나누는 다정한 친구', likes: '싱싱한 먹거리와 숲 풍경',
    gift: { resource: 'food', amount: 3, label: '싱싱한 먹거리' },
    request: { title: '길리의 초록 소풍', description: '멀리 보이는 숲을 구경하며 먹을 소풍 도시락과 물을 준비해 주세요.', costs: { food: 3, water: 3 }, rewardCoins: 17 },
    activities: { morning: '멀리 숲 바라보기', afternoon: '목을 천천히 풀며 쉬기', evening: '노을 구경하는 중', night: '친구들 곁에서 쉬는 중' },
    greetings: { morning: '저 멀리 나무에도 새잎이 났어!', afternoon: '위에서 보면 우리 마을이 참 아담하고 예뻐.', evening: '노을이 보여? 오늘은 분홍빛이 조금 섞였어.', night: '다들 여기 있구나. 가까이 있으니 좋다.' },
    friendship: ['길리가 고개를 기울이며 인사해요.', '길리가 당신 눈높이로 살며시 몸을 낮춰요.', '길리는 멀리서도 당신을 알아보고 다가와요.'],
  },
  panda: {
    personality: '편안한 자리를 나눠 주는 포근한 친구', likes: '넉넉한 먹거리와 느긋한 휴식',
    gift: { resource: 'food', amount: 3, label: '포근한 간식 시간' },
    request: { title: '판이의 느긋한 쉼터', description: '편안한 쉼터를 꾸밀 목재와 쉬면서 먹을 간식을 조금 부탁해요.', costs: { wood: 3, food: 3 }, rewardCoins: 17 },
    activities: { morning: '느긋하게 아침 맞기', afternoon: '풀밭에 앉아 쉬기', evening: '몸을 둥글게 말며 놀기', night: '포근하게 잠든 중' },
    greetings: { morning: '일어났어? 오늘은 천천히 시작하자.', afternoon: '아무것도 안 하는 시간도 필요하잖아.', evening: '여기 앉아 봐. 하루 이야기를 듣고 싶어.', night: '내일도 이 자리에서 만나자. 잘 자.' },
    friendship: ['판이가 고개를 들고 가만히 바라봐요.', '판이가 당신 옆에 편안히 자리를 잡아요.', '판이에게 당신과 쉬는 시간은 가장 포근해요.'],
  },
  deer: {
    personality: '바람과 잎사귀 소리에 귀 기울이는 숲 친구', likes: '신선한 먹거리와 조용한 숲길',
    gift: { resource: 'food', amount: 2, label: '숲 소풍 간식' },
    request: { title: '루아의 숲길 도시락', description: '숲길을 둘러볼 루아에게 가벼운 먹거리와 물을 나눠 주세요.', costs: { food: 2, water: 3 }, rewardCoins: 13 },
    activities: { morning: '가벼운 걸음으로 산책', afternoon: '풀 냄새 맡으며 쉬기', evening: '바람 소리에 귀 기울이기', night: '조용한 풀밭에서 쉬기' },
    greetings: { morning: '아침 바람이 부드러워. 같이 숲길을 걸을래?', afternoon: '풀 향기를 맡으면 마음이 차분해져.', evening: '오늘 바람 소리는 어제와 조금 달라.', night: '조용한 밤이야. 여기서는 안심이 돼.' },
    friendship: ['루아가 조심스레 고개를 돌려요.', '루아가 당신 곁에서 풀 향기를 맡아요.', '루아는 당신과 걸을 때 귀를 편안히 내려요.'],
  },
};

const LIMIT = 100_000_000;
const KST_OFFSET = 9 * 60 * 60 * 1_000;
const GOAL_IDS: readonly CozyDayGoalId[] = ['friend', 'forage', 'decorate'];
const RESOURCE_NAMES: Record<CozyGiftResource, string> = { food: '식량', water: '물', wood: '목재', scrap: '고철' };
const PERIOD_LABELS: Record<CozyDayPeriod, string> = { morning: '아침', afternoon: '낮', evening: '저녁', night: '밤' };
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const integer = (value: unknown, max = LIMIT): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= max;
const exactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean => Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const validNow = (now: number): boolean => Number.isFinite(now) && now >= 0 && now <= 253_402_214_399_999;
function validDay(value: unknown): value is CozyDateKey {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function getCozyDateKey(now = Date.now()): CozyDateKey { return new Date(now + KST_OFFSET).toISOString().slice(0, 10); }
export function getCozyDayPeriod(now = Date.now(), gameMinutes?: number): CozyDayPeriod {
  const minutes = gameMinutes !== undefined && Number.isFinite(gameMinutes)
    ? ((gameMinutes % 1_440) + 1_440) % 1_440 : new Date(now + KST_OFFSET).getUTCHours() * 60;
  return minutes >= 390 && minutes < 660 ? 'morning' : minutes >= 660 && minutes < 1_020 ? 'afternoon' : minutes >= 1_020 && minutes < 1_140 ? 'evening' : 'night';
}
export function getAnimalDailyActivity(id: UnitId, now = Date.now(), gameMinutes?: number): string { return COZY_ANIMAL_PROFILES[id].activities[getCozyDayPeriod(now, gameMinutes)]; }
export function getAnimalAffinity(state: CozyFields, id: UnitId): number { return state.cozyLife?.animals[id]?.affinity ?? 0; }

/** Missing legacy progress stays empty: neither a menu read nor a migration gives rewards. */
export function getCozyLife(state: CozyFields): CozyLifeProgress {
  const progress = state.cozyLife;
  return progress ? {
    version: 1,
    animals: Object.fromEntries(Object.entries(progress.animals).map(([id, animal]) => [id, { ...animal }])),
    ...(progress.daily ? { daily: { ...progress.daily, baseline: { ...progress.daily.baseline }, petted: [...progress.daily.petted], claimed: [...progress.daily.claimed] } } : {}),
  } : { version: 1, animals: {} };
}
export function cloneCozyLifeFields(state: CozyFields): CozyFields { return state.cozyLife ? { cozyLife: getCozyLife(state) } : {}; }
export function validateCozyLifeProgress(value: unknown): value is CozyLifeProgress {
  if (!record(value) || Object.keys(value).some(key => !['version', 'animals', 'daily'].includes(key)) || value.version !== 1 || !record(value.animals)) return false;
  for (const [id, animal] of Object.entries(value.animals)) {
    if (!isUnitId(id) || !record(animal) || !integer(animal.affinity, 100)
      || Object.keys(animal).some(key => !['affinity', 'petDay', 'giftDay', 'requestDay'].includes(key))) return false;
    for (const field of ['petDay', 'giftDay', 'requestDay']) if (Object.hasOwn(animal, field) && !validDay(animal[field])) return false;
  }
  if (!Object.hasOwn(value, 'daily')) return true;
  const daily = value.daily;
  return record(daily) && exactKeys(daily, ['day', 'baseline', 'petted', 'decorations', 'claimed']) && validDay(daily.day)
    && record(daily.baseline) && exactKeys(daily.baseline, ['harvests', 'gathers', 'chops'])
    && Object.values(daily.baseline).every(value => integer(value)) && integer(daily.decorations, 1)
    && Array.isArray(daily.petted) && daily.petted.every(isUnitId) && new Set(daily.petted).size === daily.petted.length
    && Array.isArray(daily.claimed) && daily.claimed.every(id => GOAL_IDS.includes(id as CozyDayGoalId)) && new Set(daily.claimed).size === daily.claimed.length;
}
function baseline(state: GameState): CozyDailyProgress['baseline'] {
  return { harvests: state.stats.harvests, gathers: state.stats.gathers, chops: state.stats.chops };
}
function dayProgress(state: CozyState, now: number): CozyDailyProgress {
  const day = getCozyDateKey(now), saved = state.cozyLife?.daily;
  // A clock moving backwards cannot reopen a previously claimed daily board.
  return saved && saved.day >= day ? { ...saved, baseline: { ...saved.baseline }, petted: [...saved.petted], claimed: [...saved.claimed] }
    : { day, baseline: baseline(state), petted: [], decorations: 0, claimed: [] };
}
function blocked(state: CozyState, now: number): string | null {
  if (!validNow(now)) return '기기의 날짜와 시간을 확인해 주세요.';
  if (state.expedition) return '탐험을 마친 뒤 동물 친구들과 시간을 보내 주세요.';
  if (Object.hasOwn(state, 'cozyLife') && !validateCozyLifeProgress(state.cozyLife)) return '친구들과 보낸 하루의 기록을 확인할 수 없어요.';
  if (state.cozyLife?.daily && state.cozyLife.daily.day > getCozyDateKey(now)) return '날짜가 이전으로 바뀌었어요. 기기의 날짜와 시간을 확인해 주세요.';
  if (Object.hasOwn(state, 'farmEconomy') && !validateFarmEconomy(state.farmEconomy, state)) return '수확물의 보관 기록을 확인할 수 없어요.';
  if (Object.hasOwn(state, 'shop') && !validateShopProgress(state.shop)) return '코인 지갑 기록을 확인할 수 없어요.';
  if (!Object.values(state.resources).every(value => integer(value)) || !Object.values(baseline(state)).every(value => integer(value))) return '물자와 일상 활동 기록을 확인할 수 없어요.';
  return null;
}
function detached(state: CozyState, now: number): CozyState {
  const next: CozyState = structuredClone(state);
  next.cozyLife = getCozyLife(state); next.cozyLife.daily = dayProgress(state, now);
  return next;
}
function fail(state: GameState, message: string): ActionResult { return { state, ok: false, message }; }
function success(state: GameState, message: string): ActionResult {
  state.log = [`${state.day}일차 · ${message}`, ...state.log].slice(0, 30);
  return { state, ok: true, message };
}
/** Commit at load and real midnight, before harvesting, so yesterday's counters never complete today's goals. */
export function initializeCozyDay(state: CozyState, now = Date.now()): GameState {
  // Taking a baseline is not a paid interaction and is safe even during an expedition.
  if (!validNow(now) || state.cozyLife && !validateCozyLifeProgress(state.cozyLife)
    || !Object.values(baseline(state)).every(value => integer(value))) return state;
  if (state.cozyLife?.daily && state.cozyLife.daily.day >= getCozyDateKey(now)) return state;
  return detached(state, now);
}

export interface CozyAnimalLifeView {
  id: UnitId;
  name: string;
  speciesLabel: string;
  personality: string;
  likes: string;
  affinity: number;
  affinityLabel: string;
  heartLevel: number;
  dialogue: string;
  activity: string;
  periodLabel: string;
  petReady: boolean;
  gift: { resource: CozyGiftResource; amount: number; label: string; ready: boolean; done: boolean };
  request: { id: string; title: string; description: string; costs: Partial<Record<CozyGiftResource, number>>; rewardCoins: number; rewardAffinity: number; ready: boolean; done: boolean };
}
export function getAnimalLifeView(state: CozyState, id: UnitId, now = Date.now()): CozyAnimalLifeView {
  const profile = COZY_ANIMAL_PROFILES[id], animal = state.cozyLife?.animals[id], day = getCozyDateKey(now), period = getCozyDayPeriod(now, state.minutes);
  const affinity = animal?.affinity ?? 0, canAct = !state.expedition && (!state.cozyLife?.daily || state.cozyLife.daily.day <= day);
  const giftDone = animal?.giftDay === day, requestDone = animal?.requestDay === day;
  const bond = affinity < 25 ? 0 : affinity < 65 ? 1 : 2;
  const dialogue = `${profile.greetings[period]}${affinity >= 25 ? ` ${profile.friendship[bond]}` : ''}`;
  return {
    id, name: UNITS[id].name, speciesLabel: UNITS[id].speciesLabel, personality: profile.personality, likes: profile.likes,
    affinity, affinityLabel: affinity < 15 ? '알아가는 사이' : affinity < 40 ? '반가운 친구' : affinity < 70 ? '다정한 친구' : affinity < 100 ? '마음을 나눈 친구' : '둘도 없는 단짝',
    heartLevel: Math.floor(affinity / 20), dialogue, activity: profile.activities[period], periodLabel: PERIOD_LABELS[period],
    petReady: canAct && animal?.petDay !== day,
    gift: { ...profile.gift, ready: canAct && !giftDone && state.resources[profile.gift.resource] >= profile.gift.amount, done: giftDone },
    request: { ...profile.request, costs: { ...profile.request.costs }, id: `${day}:${id}`, rewardAffinity: 7,
      ready: canAct && !requestDone && Object.entries(profile.request.costs).every(([resource, amount]) => state.resources[resource as CozyGiftResource] >= amount!), done: requestDone },
  };
}

/** Call only after the real petting animation finishes successfully, never when its panel opens. */
export function petAnimalLife(state: CozyState, id: unknown, now = Date.now()): ActionResult {
  const reason = blocked(state, now); if (reason) return fail(state, reason);
  if (!isUnitId(id)) return fail(state, '함께할 동물 친구를 선택해 주세요.');
  const day = getCozyDateKey(now);
  if (state.cozyLife?.animals[id]?.petDay === day) return fail(state, `${UNITS[id].name}와 오늘의 첫 인사를 이미 나눴어요. 쓰다듬기는 계속할 수 있어요.`);
  const next = detached(state, now), animal = next.cozyLife!.animals[id] ??= { affinity: 0 };
  const earned = Math.min(4, 100 - animal.affinity); animal.affinity += earned; animal.petDay = day;
  if (!next.cozyLife!.daily!.petted.includes(id)) next.cozyLife!.daily!.petted.push(id);
  return success(next, `${UNITS[id].name}와 따뜻한 인사를 나눴어요.${earned ? ` 친밀도 +${earned}` : ''}`);
}
export function giftAnimalLife(state: CozyState, id: unknown, now = Date.now()): ActionResult {
  const reason = blocked(state, now); if (reason) return fail(state, reason);
  if (!isUnitId(id)) return fail(state, '선물할 동물 친구를 선택해 주세요.');
  const view = getAnimalLifeView(state, id, now);
  if (view.gift.done) return fail(state, `${view.name}에게 오늘의 선물을 이미 건넸어요. 내일 다시 만나요.`);
  if (!view.gift.ready) return fail(state, `${RESOURCE_NAMES[view.gift.resource]} ${view.gift.amount}개가 필요해요.`);
  const next = detached(state, now), animal = next.cozyLife!.animals[id] ??= { affinity: 0 };
  next.resources[view.gift.resource] -= view.gift.amount;
  if (view.gift.resource === 'food') reconcileFarmEconomyFood(next);
  const earned = Math.min(6, 100 - animal.affinity); animal.affinity += earned; animal.giftDay = getCozyDateKey(now);
  return success(next, `${view.name}에게 ${view.gift.label}을 건넸어요.${earned ? ` 친밀도 +${earned}` : ''}`);
}
export function completeAnimalRequest(state: CozyState, id: unknown, now = Date.now(), expectedRequestId?: string): ActionResult {
  const reason = blocked(state, now); if (reason) return fail(state, reason);
  if (!isUnitId(id)) return fail(state, '부탁을 들어줄 동물 친구를 선택해 주세요.');
  const view = getAnimalLifeView(state, id, now), request = view.request;
  if (expectedRequestId !== undefined && expectedRequestId !== request.id) return fail(state, '새로운 하루의 부탁으로 바뀌었어요. 다시 확인해 주세요.');
  if (request.done) return fail(state, `${view.name}의 오늘 부탁은 이미 완료했어요.`);
  if (!request.ready) return fail(state, '부탁에 필요한 물자를 모은 뒤 건네 주세요.');
  if (!integer(getShop(state).coins + request.rewardCoins)) return fail(state, '코인 지갑이 가득해요. 코인을 사용한 뒤 부탁을 완료해 주세요.');
  const next = detached(state, now), animal = next.cozyLife!.animals[id] ??= { affinity: 0 };
  for (const [resource, amount] of Object.entries(request.costs)) next.resources[resource as CozyGiftResource] -= amount!;
  if (request.costs.food) reconcileFarmEconomyFood(next);
  next.shop = getShop(state); next.shop.coins += request.rewardCoins;
  const earned = Math.min(request.rewardAffinity, 100 - animal.affinity); animal.affinity += earned; animal.requestDay = getCozyDateKey(now);
  return success(next, `${view.name}의 부탁을 들어줬어요! 코인 +${request.rewardCoins}${earned ? ` · 친밀도 +${earned}` : ''}`);
}

export interface CozyDayGoal {
  id: CozyDayGoalId;
  day: CozyDateKey;
  title: string;
  description: string;
  current: number;
  target: number;
  complete: boolean;
  claimed: boolean;
  rewards: { coins: number; wood?: number; water?: number };
}
export function getCozyDayGoals(state: CozyState, now = Date.now()): CozyDayGoal[] {
  const daily = dayProgress(state, now), currentStats = baseline(state);
  const forage = Math.max(0, currentStats.harvests - daily.baseline.harvests) + Math.max(0, currentStats.gathers - daily.baseline.gathers) + Math.max(0, currentStats.chops - daily.baseline.chops);
  const definitions: { id: CozyDayGoalId; title: string; description: string; current: number; target: number; rewards: CozyDayGoal['rewards'] }[] = [
    { id: 'friend', title: '다정한 하루 인사', description: '동물 친구 한 마리를 직접 쓰다듬어요.', current: daily.petted.length, target: 1, rewards: { coins: 8 } },
    { id: 'forage', title: '오늘의 작은 수확', description: '작물 수확이나 지상 채집을 합쳐 3번 해요.', current: forage, target: 3, rewards: { coins: 10, water: 2 } },
    { id: 'decorate', title: '우리집에 작은 취향', description: '마음에 드는 장식 한 개를 트럭에 배치해요.', current: daily.decorations, target: 1, rewards: { coins: 10, wood: 2 } },
  ];
  return definitions.map(goal => ({ ...goal, day: daily.day, current: Math.min(goal.target, goal.current), complete: goal.current >= goal.target, claimed: daily.claimed.includes(goal.id) }));
}
/** Commit after placing a paid, owned decoration from storage. Moving, storing, crafting, or viewing never counts. */
export function recordCozyDecoration(state: CozyState, now = Date.now()): ActionResult {
  const reason = blocked(state, now); if (reason) return fail(state, reason);
  if (state.cozyLife?.daily?.day === getCozyDateKey(now) && state.cozyLife.daily.decorations === 1) return { state, ok: true, message: '' };
  const next = detached(state, now); next.cozyLife!.daily!.decorations = 1;
  return { state: next, ok: true, message: '' };
}
export function claimCozyDayReward(state: CozyState, goalId: unknown, now = Date.now(), expectedDay?: string): ActionResult {
  const reason = blocked(state, now); if (reason) return fail(state, reason);
  const goal = getCozyDayGoals(state, now).find(item => item.id === goalId);
  if (!goal) return fail(state, '오늘의 작은 일상을 선택해 주세요.');
  if (expectedDay !== undefined && expectedDay !== goal.day) return fail(state, '새로운 하루가 시작됐어요. 오늘의 일상을 다시 확인해 주세요.');
  if (goal.claimed) return fail(state, '오늘 이 일상의 선물은 이미 받았어요.');
  if (!goal.complete) return fail(state, '작은 일상을 마친 뒤 선물을 받아 주세요.');
  if (!integer(getShop(state).coins + goal.rewards.coins) || !integer(state.resources.wood + (goal.rewards.wood ?? 0))
    || !integer(state.resources.water + (goal.rewards.water ?? 0))) return fail(state, '코인이나 물자가 가득해요. 조금 사용한 뒤 선물을 받아 주세요.');
  const next = detached(state, now); next.cozyLife!.daily!.claimed.push(goal.id);
  next.shop = getShop(state); next.shop.coins += goal.rewards.coins;
  next.resources.wood += goal.rewards.wood ?? 0; next.resources.water += goal.rewards.water ?? 0;
  return success(next, `${goal.title} 선물을 받았어요! 코인 +${goal.rewards.coins}${goal.rewards.wood ? ` · 목재 +${goal.rewards.wood}` : ''}${goal.rewards.water ? ` · 물 +${goal.rewards.water}` : ''}`);
}
