import { CROPS, CROP_IDS, isCropId, type CropId } from './crops';
export { CROPS, CROP_IDS, type CropId } from './crops';

export type Resource = 'wood' | 'scrap' | 'food' | 'water' | 'seeds';
export type Gender = 'female' | 'male';
export type Action = 'gather' | 'chop' | 'hunt' | 'water' | 'plant' | 'harvest' | 'expand' | 'rest' | 'pet' | 'repair';
export interface Plot { id: number; plantedAt: number | null; watered: boolean; cropId?: CropId }
export interface Expedition { id: number; stage: number }
export interface HuntResult {
  outcome: 'victory' | 'defeat' | 'retreat';
  stage: number;
  remainingHealth: number;
  enemiesDefeated: number;
  /** Active battle duration in real seconds, excluding paused time. */
  duration: number;
}
export interface ActionResult { state: GameState; ok: boolean; message: string }
export interface GameState {
  version: 1;
  name: string;
  gender: Gender;
  day: number;
  minutes: number;
  health: number;
  energy: number;
  morale: number;
  resources: Record<Resource, number>;
  /** Missing only in older saves. resources.seeds remains the inventory total. */
  seedInventory?: Record<CropId, number>;
  plots: Plot[];
  deckLevel: number;
  truckHealth: number;
  petName: string;
  xp: number;
  level: number;
  quests: string[];
  log: string[];
  lastSaved: number;
  totalMinutes: number;
  stats: { harvests: number; gathers: number; hunts: number; expansions: number; chops: number; battlesWon: number; defeatedEnemies: number };
  expedition: Expedition | null;
}
export interface Quest {
  id: string;
  title: string;
  description: string;
  current: number;
  target: number;
  reward: string;
  complete: boolean;
}
export interface SaveStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const SAVE_KEY = 'road-haven-save-v1';
export const CROP_MINUTES = CROPS.carrot.growMinutes;
/** One normally earned seed pack can fill three plots of the discovered variety. */
export const SEED_PACK_SIZE = 3;
export const MAX_DECK_LEVEL = 6;
export const resourceLabels: Record<Resource, string> = {
  wood: '목재', scrap: '고철', food: '식량', water: '물', seeds: '씨앗',
};
const resourceKeys = Object.keys(resourceLabels) as Resource[];
const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

export function createGame(gender: Gender = 'female', name?: string): GameState {
  return {
    version: 1,
    name: name?.trim().slice(0, 16) || (gender === 'male' ? '하루' : '유나'),
    gender,
    day: 1,
    minutes: 480,
    totalMinutes: 480,
    health: 100,
    energy: 85,
    morale: 90,
    resources: { wood: 24, scrap: 12, food: 8, water: 16, seeds: 23 },
    seedInventory: { carrot: 8, potato: 3, tomato: 3, corn: 3, strawberry: 3, pumpkin: 3 },
    plots: [
      { id: 1, plantedAt: 240, watered: true, cropId: 'carrot' },
      { id: 2, plantedAt: 420, watered: false, cropId: 'carrot' },
      { id: 3, plantedAt: null, watered: false },
    ],
    deckLevel: 1,
    truckHealth: 100,
    petName: '보리',
    xp: 0,
    level: 1,
    quests: [],
    log: ['2187년, 서울 외곽. 도로 위에서 우리의 작은 일상이 시작됐다.'],
    lastSaved: 0,
    stats: { harvests: 0, gathers: 0, hunts: 0, expansions: 0, chops: 0, battlesWon: 0, defeatedEnemies: 0 },
    expedition: null,
  };
}

function copy(state: GameState): GameState {
  return {
    ...state, resources: { ...state.resources }, seedInventory: getSeedInventory(state),
    plots: state.plots.map(plot => plot.plantedAt === null ? { ...plot } : { ...plot, cropId: getPlotCropId(plot) }),
    quests: [...state.quests], log: [...state.log], stats: { ...state.stats },
    expedition: state.expedition ? { ...state.expedition } : null,
  };
}

export function getSeedInventory(state: GameState): Record<CropId, number> {
  return state.seedInventory ? { ...state.seedInventory } : {
    carrot: state.resources.seeds, potato: 0, tomato: 0, corn: 0, strawberry: 0, pumpkin: 0,
  };
}

export function getSeedCount(state: GameState, cropId: CropId): number {
  return getSeedInventory(state)[cropId];
}

export function getPlotCropId(plot: Plot): CropId {
  return plot.cropId ?? 'carrot';
}

function addSeeds(state: GameState, cropId: CropId, amount: number) {
  const inventory = state.seedInventory ??= getSeedInventory(state);
  inventory[cropId] += amount;
  state.resources.seeds += amount;
}

function discoveredSeed(state: GameState): CropId {
  return CROP_IDS[(state.stats.gathers + state.stats.chops + 1) % CROP_IDS.length];
}

function addLog(state: GameState, message: string) {
  state.log = [`${state.day}일차 · ${message}`, ...state.log].slice(0, 30);
}

export function getCropProgress(state: GameState, plot: Plot): number {
  if (plot.plantedAt === null) return 0;
  const elapsed = Math.max(0, state.totalMinutes - plot.plantedAt);
  const growMinutes = CROPS[getPlotCropId(plot)].growMinutes;
  return plot.watered ? clamp(elapsed / growMinutes, 0, 1) : clamp(elapsed / (growMinutes * 2), 0, 0.7);
}

export function expansionCost(state: GameState): { wood: number; scrap: number } {
  return { wood: 24 + (state.deckLevel - 1) * 16, scrap: 12 + (state.deckLevel - 1) * 8 };
}

export function questList(state: GameState): Quest[] {
  const definitions = [
    { id: 'first-harvest', title: '작은 농부의 첫걸음', description: '트럭 텃밭에서 작물 3개 수확하기', current: state.stats.harvests, target: 3, reward: '당근 씨앗 5 · 식량 4' },
    { id: 'road-scout', title: '도로 위의 보물찾기', description: '주변 도로에서 자원 3번 탐색하기', current: state.stats.gathers, target: 3, reward: '목재 12 · 고철 6' },
    { id: 'bigger-home', title: '조금 더 넓은 우리 집', description: '트럭 생활 공간 1번 확장하기', current: state.stats.expansions, target: 1, reward: '물 8 · 경험치 30' },
  ];
  return definitions.map(quest => ({ ...quest, current: Math.min(quest.current, quest.target), complete: quest.current >= quest.target }));
}

function grantQuests(state: GameState) {
  for (const quest of questList(state)) {
    if (!quest.complete || state.quests.includes(quest.id)) continue;
    state.quests.push(quest.id);
    if (quest.id === 'first-harvest') { addSeeds(state, 'carrot', 5); state.resources.food += 4; }
    if (quest.id === 'road-scout') { state.resources.wood += 12; state.resources.scrap += 6; }
    if (quest.id === 'bigger-home') { state.resources.water += 8; state.xp += 30; }
    addLog(state, `목표 달성! ${quest.title} · ${quest.reward}`);
  }
  state.level = Math.floor(state.xp / 120) + 1;
}

/** One real second is two in-game minutes. No offline time is applied on load. */
export function tick(state: GameState, seconds = 1): GameState {
  if (state.expedition || !Number.isFinite(seconds) || seconds <= 0) return state;
  return advanceTime(state, seconds * 2);
}

/** Daily provisions and zombie damage are applied once for every midnight crossed. */
export function advanceTime(state: GameState, minutes: number): GameState {
  if (!Number.isFinite(minutes) || minutes <= 0) return state;
  const next = copy(state);
  const total = next.totalMinutes + minutes;
  const daysPassed = Math.floor(total / 1440) - Math.floor(next.totalMinutes / 1440);
  next.totalMinutes = total;
  next.minutes = total % 1440;
  next.day = Math.floor(total / 1440) + 1;
  if (daysPassed > 0) {
    // Aggregate long jumps instead of looping across potentially years of saved time.
    const foodShortage = Math.max(0, daysPassed * 2 - next.resources.food);
    const waterShortage = Math.max(0, daysPassed * 3 - next.resources.water);
    next.resources.food = Math.max(0, next.resources.food - daysPassed * 2);
    next.resources.water = Math.max(0, next.resources.water - daysPassed * 3);
    next.health = clamp(next.health - foodShortage * 3 - waterShortage * 4, 1);
    next.truckHealth = clamp(next.truckHealth - daysPassed * 7);
    next.morale = clamp(next.morale - daysPassed * 3);
    addLog(next, '새 아침. 식량 2 · 물 3을 사용했어요. 밤사이 좀비가 트럭을 조금 손상시켰어요.');
    if (foodShortage || waterShortage) addLog(next, '식량이나 물이 부족해요. 도로 탐색과 사냥으로 보급해 주세요!');
  }
  return next;
}

/** Starts one persisted expedition. Materials are only awarded after a battle victory. */
export function beginHunt(state: GameState, stage: number): ActionResult {
  const fail = (message: string): ActionResult => ({ state, ok: false, message });
  if (state.expedition) return fail('이미 사냥을 떠났어요. 먼저 현재 전투를 마무리해 주세요.');
  if (!Number.isInteger(stage) || stage < 1 || stage > 3) return fail('1~3 구역 중 사냥터를 선택해 주세요.');
  if (state.health < 15) return fail('건강이 부족해요. 체력을 15 이상 회복한 뒤 사냥을 떠나 주세요.');
  if (state.energy < 16) return fail('기운이 부족해요. 사냥을 떠나려면 기력 16이 필요해요.');
  const next = copy(state);
  next.energy -= 16;
  next.stats.hunts += 1;
  next.expedition = { id: next.stats.hunts, stage };
  const message = `${stage}구역으로 사냥을 떠났어요. 좀비를 물리치고 안전하게 돌아오세요!`;
  addLog(next, message);
  return { state: next, ok: true, message };
}

/** A matching expedition token prevents duplicate or stale battle callbacks from awarding loot. */
export function finishHunt(state: GameState, result: HuntResult, expeditionId: number): ActionResult {
  const fail = (message: string): ActionResult => ({ state, ok: false, message });
  if (!state.expedition || !Number.isInteger(expeditionId) || state.expedition.id !== expeditionId) {
    return fail('이미 마무리했거나 현재 사냥과 다른 전투 결과예요.');
  }
  if (!isRecord(result) || result.stage !== state.expedition.stage || !['victory', 'defeat', 'retreat'].includes(result.outcome)
    || typeof result.remainingHealth !== 'number' || !Number.isFinite(result.remainingHealth)
    || !isInteger(result.enemiesDefeated, 0, 1000) || !isNumber(result.duration, 0, 3600)) {
    return fail('전투 결과를 확인할 수 없어요. 현재 사냥을 마무리하거나 철수해 주세요.');
  }
  let next = copy(state);
  next.expedition = null;
  next.health = clamp(result.remainingHealth, 1);
  next.stats.defeatedEnemies += result.enemiesDefeated;
  let message: string;
  if (result.outcome === 'victory') {
    const food = 6 + result.stage * 2;
    const scrap = result.stage * 2;
    next.resources.food += food;
    next.resources.wood += 2;
    next.resources.scrap += scrap;
    next.xp += 20 + result.stage * 10;
    next.stats.battlesWon += 1;
    next.morale = clamp(next.morale + 5);
    message = `${result.stage}구역 사냥 성공! 좀비 ${result.enemiesDefeated}마리 처치 · 식량 +${food} · 목재 +2 · 고철 +${scrap}`;
  } else if (result.outcome === 'defeat') {
    next.morale = clamp(next.morale - 5);
    message = `${result.stage}구역에서 힘겹게 돌아왔어요. 보급품은 얻지 못했지만, 트럭에서 쉬고 다시 도전할 수 있어요.`;
  } else {
    message = `${result.stage}구역에서 안전을 위해 철수했어요. 보급품 없이 트럭으로 돌아왔어요.`;
  }
  next = advanceTime(next, result.duration * 2);
  addLog(next, message);
  grantQuests(next);
  return { state: next, ok: true, message };
}

/** Recover an interrupted expedition after an app restart without granting unearned loot. */
export function cancelHunt(state: GameState): ActionResult {
  if (!state.expedition) return { state, ok: false, message: '진행 중인 사냥이 없어요.' };
  return finishHunt(state, {
    outcome: 'retreat', stage: state.expedition.stage, remainingHealth: state.health,
    enemiesDefeated: 0, duration: 0,
  }, state.expedition.id);
}

export function performAction(state: GameState, action: Action, plotId?: number, cropId: CropId = 'carrot'): ActionResult {
  let next = copy(state);
  const fail = (message: string) => ({ state, ok: false, message });
  if (state.expedition) return fail('사냥을 마친 뒤 트럭에서 다시 활동할 수 있어요.');
  if (action === 'hunt') return fail('사냥터를 선택하고 직접 좀비를 물리쳐 보급품을 얻어 주세요.');
  const energyCosts: Record<Action, number> = {
    gather: 10, chop: 10, hunt: 16, water: 3, plant: 4, harvest: 4, expand: 15, rest: 0, pet: 0, repair: 6,
  };
  if (!Object.hasOwn(energyCosts, action)) return fail('아직 할 수 없는 행동이에요.');
  if (state.energy < energyCosts[action]) return fail('기운이 부족해요. 먼저 침대에서 쉬어 주세요.');
  let message = '';
  let duration = 0;
  let xp = 0;

  switch (action) {
    case 'gather': {
      const foundSeed = discoveredSeed(next);
      next.resources.wood += 10;
      next.resources.scrap += 5;
      next.resources.water += 4;
      addSeeds(next, foundSeed, SEED_PACK_SIZE);
      next.stats.gathers += 1;
      message = `도로 탐색 완료! 목재 +10 · 고철 +5 · 물 +4 · ${CROPS[foundSeed].seedName} +${SEED_PACK_SIZE}`;
      duration = 35;
      xp = 12;
      break;
    }
    case 'chop': {
      const foundSeed = discoveredSeed(next);
      next.resources.wood += 18;
      addSeeds(next, foundSeed, SEED_PACK_SIZE);
      next.stats.chops += 1;
      message = `도끼로 나무를 베고 통나무를 모았어요. 목재 +18 · ${CROPS[foundSeed].seedName} +${SEED_PACK_SIZE}`;
      duration = 35;
      xp = 14;
      break;
    }
    case 'plant': {
      if (!isCropId(cropId)) return fail('씨앗 인벤토리에서 심을 씨앗을 선택해 주세요.');
      const plot = next.plots.find(item => plotId === undefined ? item.plantedAt === null : item.id === plotId);
      if (!plot) return fail('빈 텃밭이 없어요. 작물을 수확하거나 트럭을 확장해 주세요.');
      if (plot.plantedAt !== null) return fail('이미 작물이 자라는 텃밭이에요.');
      if (getSeedCount(next, cropId) < 1) return fail(`${CROPS[cropId].seedName}이 부족해요. 다른 씨앗을 고르거나 도로를 탐색해 주세요.`);
      addSeeds(next, cropId, -1);
      plot.plantedAt = next.totalMinutes;
      plot.watered = false;
      plot.cropId = cropId;
      message = `${CROPS[cropId].seedName}을 심었어요. 물을 주면 더 잘 자라요!`;
      duration = 10;
      xp = 5;
      break;
    }
    case 'water': {
      const plots = next.plots.filter(plot => plot.plantedAt !== null && !plot.watered && (plotId === undefined || plot.id === plotId));
      if (!plots.length) return fail('물을 줄 작물이 없어요. 빈 텃밭에 씨앗부터 심어 주세요.');
      if (next.resources.water < plots.length) return fail(`물을 ${plots.length}개 모아 주세요. 도로 탐색으로 보급할 수 있어요.`);
      next.resources.water -= plots.length;
      plots.forEach(plot => { plot.watered = true; });
      message = `텃밭 ${plots.length}곳에 물을 주었어요. ${plots.length === 1 ? CROPS[getPlotCropId(plots[0])].name : '작물'}이 쑥쑥 자라고 있어요!`;
      duration = 10;
      xp = 4;
      break;
    }
    case 'harvest': {
      const plots = next.plots.filter(plot => getCropProgress(next, plot) >= 1 && (plotId === undefined || plot.id === plotId));
      if (!plots.length) return fail('아직 다 자란 작물이 없어요. 물을 주고 조금 기다려 주세요.');
      let food = 0;
      let seeds = 0;
      const names = new Set<string>();
      plots.forEach(plot => {
        const crop = CROPS[getPlotCropId(plot)];
        food += crop.food;
        seeds += crop.seedReturn;
        xp += crop.xp;
        names.add(crop.name);
        addSeeds(next, crop.id, crop.seedReturn);
        plot.plantedAt = null;
        plot.watered = false;
        delete plot.cropId;
      });
      next.resources.food += food;
      next.stats.harvests += plots.length;
      next.morale = clamp(next.morale + 3);
      message = `싱싱한 ${[...names].join(' · ')} ${plots.length}밭 수확! 식량 +${food} · 씨앗 +${seeds}`;
      duration = 15;
      break;
    }
    case 'expand': {
      if (next.deckLevel >= MAX_DECK_LEVEL) return fail('현재 만들 수 있는 가장 넓은 트럭이에요!');
      const cost = expansionCost(next);
      if (next.resources.wood < cost.wood || next.resources.scrap < cost.scrap) return fail(`확장하려면 목재 ${cost.wood} · 고철 ${cost.scrap}이 필요해요.`);
      next.resources.wood -= cost.wood;
      next.resources.scrap -= cost.scrap;
      next.deckLevel += 1;
      next.stats.expansions += 1;
      next.plots.push({ id: Math.max(...next.plots.map(plot => plot.id)) + 1, plantedAt: null, watered: false });
      next.morale = clamp(next.morale + 10);
      message = '우리 집이 더 넓어졌어요! 생활 공간과 새 텃밭 +1';
      duration = 60;
      xp = 35;
      break;
    }
    case 'rest': {
      const meal = next.resources.food >= 1 && next.resources.water >= 1;
      if (meal) { next.resources.food -= 1; next.resources.water -= 1; }
      next.energy = clamp(next.energy + (meal ? 55 : 35));
      next.health = clamp(next.health + (meal ? 12 : 3));
      next.morale = clamp(next.morale + 5);
      message = meal ? '따뜻한 식사를 하고 쉬었어요. 기운 +55 · 체력 +12' : '잠깐 눈을 붙였어요. 기운 +35 · 체력 +3';
      duration = 90;
      break;
    }
    case 'pet':
      next.morale = clamp(next.morale + 12);
      next.energy = clamp(next.energy + 3);
      message = `${next.petName}가 꼬리를 흔들어요. 함께라서 오늘도 든든해요! 기분 +12`;
      duration = 5;
      break;
    case 'repair':
      if (next.truckHealth >= 100) return fail('트럭이 튼튼해요. 지금은 수리하지 않아도 괜찮아요.');
      if (next.resources.scrap < 4) return fail('수리하려면 고철 4개가 필요해요.');
      next.resources.scrap -= 4;
      next.truckHealth = clamp(next.truckHealth + 30);
      message = '트럭을 수리했어요. 트럭 내구도 +30';
      duration = 25;
      xp = 10;
      break;
  }

  next.energy = clamp(next.energy - energyCosts[action]);
  next.xp += xp;
  next = advanceTime(next, duration);
  addLog(next, message);
  grantQuests(next);
  return { state: next, ok: true, message };
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isNumber = (value: unknown, min: number, max: number): value is number => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const isInteger = (value: unknown, min: number, max: number): value is number => isNumber(value, min, max) && Number.isInteger(value);
const isText = (value: unknown, max: number): value is string => typeof value === 'string' && value.length > 0 && value.length <= max;

/** Save files are untrusted input: reject damaged states instead of inventing resources. */
function validateSave(value: unknown): value is GameState {
  if (!isRecord(value) || value.version !== 1 || !['female', 'male'].includes(value.gender as string)) return false;
  if (!isText(value.name, 16) || !isText(value.petName, 24)) return false;
  if (!isInteger(value.day, 1, 1_000_000) || !isNumber(value.minutes, 0, 1439.999999999) || !isNumber(value.totalMinutes, 0, 1_440_000_000)) return false;
  if (Math.abs((value.day - 1) * 1440 + value.minutes - value.totalMinutes) > 0.0001) return false;
  if (!['health', 'energy', 'morale', 'truckHealth'].every(key => isNumber(value[key], 0, 100))) return false;
  if (!isInteger(value.deckLevel, 1, MAX_DECK_LEVEL) || !isInteger(value.xp, 0, 100_000_000) || !isInteger(value.level, 1, 1_000_000)) return false;
  if (value.level !== Math.floor(value.xp / 120) + 1 || !isInteger(value.lastSaved, 0, 100_000_000_000_000)) return false;
  if (!isRecord(value.resources) || !resourceKeys.every(key => isInteger((value.resources as Record<string, unknown>)[key], 0, 100_000_000))) return false;
  if (!isRecord(value.seedInventory) || Object.keys(value.seedInventory).length !== CROP_IDS.length
    || !CROP_IDS.every(id => isInteger((value.seedInventory as Record<string, unknown>)[id], 0, 100_000_000))) return false;
  const seedTotal = CROP_IDS.reduce((total, id) => total + Number((value.seedInventory as Record<string, unknown>)[id]), 0);
  if (seedTotal !== value.resources.seeds) return false;
  if (!Array.isArray(value.plots) || value.plots.length !== value.deckLevel + 2) return false;
  const ids = new Set<number>();
  for (const plot of value.plots) {
    if (!isRecord(plot) || !isInteger(plot.id, 1, 100) || ids.has(plot.id) || typeof plot.watered !== 'boolean') return false;
    if (plot.plantedAt !== null && !isNumber(plot.plantedAt, 0, value.totalMinutes)) return false;
    if (plot.plantedAt === null && plot.watered) return false;
    if (Object.hasOwn(plot, 'cropId') && (plot.plantedAt === null || !isCropId(plot.cropId))) return false;
    if (plot.plantedAt !== null && !isCropId(plot.cropId)) return false;
    ids.add(plot.id);
  }
  if (!isRecord(value.stats) || !['harvests', 'gathers', 'hunts', 'expansions', 'chops', 'battlesWon', 'defeatedEnemies'].every(key => isInteger((value.stats as Record<string, unknown>)[key], 0, 100_000_000))) return false;
  if (value.stats.expansions !== value.deckLevel - 1) return false;
  if (Number(value.stats.battlesWon) > Number(value.stats.hunts)) return false;
  if (value.expedition !== null) {
    if (!isRecord(value.expedition) || !isInteger(value.expedition.id, 1, 100_000_000)
      || value.expedition.id !== value.stats.hunts || !isInteger(value.expedition.stage, 1, 3)
      || Number(value.stats.battlesWon) >= Number(value.stats.hunts)) return false;
  }
  if (!Array.isArray(value.quests) || value.quests.length > 3 || new Set(value.quests).size !== value.quests.length) return false;
  if (!value.quests.every(id => ['first-harvest', 'road-scout', 'bigger-home'].includes(id))) return false;
  if (!Array.isArray(value.log) || value.log.length > 30 || !value.log.every(entry => isText(entry, 400))) return false;
  const candidate = value as unknown as GameState;
  if (candidate.quests.some(id => !questList(candidate).find(quest => quest.id === id)?.complete)) return false;
  return true;
}

/** Existing seeds and growing carrots keep their quantities; migration never grants a starter pack. */
function migrateCropFields(value: unknown): unknown {
  if (!isRecord(value) || value.version !== 1) return value;
  const result = { ...value };
  if (!Object.hasOwn(value, 'seedInventory') && isRecord(value.resources)) {
    result.seedInventory = {
      carrot: value.resources.seeds, potato: 0, tomato: 0, corn: 0, strawberry: 0, pumpkin: 0,
    };
  }
  if (Array.isArray(value.plots)) {
    result.plots = value.plots.map(plot => isRecord(plot) && plot.plantedAt !== null && !Object.hasOwn(plot, 'cropId')
      ? { ...plot, cropId: 'carrot' } : plot);
  }
  return result;
}

export function saveGame(state: GameState, storage?: SaveStorage): boolean {
  try {
    const target = storage ?? globalThis.localStorage;
    const candidate = migrateCropFields(state);
    if (!target || !validateSave(candidate)) return false;
    target.setItem(SAVE_KEY, JSON.stringify({ ...candidate, lastSaved: Date.now() }));
    return true;
  } catch { return false; }
}

export function loadGame(storage?: SaveStorage): GameState | null {
  try {
    const target = storage ?? globalThis.localStorage;
    const raw = target?.getItem(SAVE_KEY);
    if (!raw || raw.length > 50_000) return null;
    let value: unknown = JSON.parse(raw);
    // Version 1 saves before interactive battles have neither an expedition nor these counters.
    // Only missing fields receive defaults; present but malformed fields must still be rejected.
    if (isRecord(value) && value.version === 1 && isRecord(value.stats)) {
      const stats = { ...value.stats };
      for (const key of ['chops', 'battlesWon', 'defeatedEnemies']) {
        if (!Object.hasOwn(stats, key)) stats[key] = 0;
      }
      value = { ...value, stats, expedition: Object.hasOwn(value, 'expedition') ? value.expedition : null };
    }
    value = migrateCropFields(value);
    return validateSave(value) ? value : null;
  } catch { return null; }
}
