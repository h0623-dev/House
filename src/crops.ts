export const CROP_IDS = ['carrot', 'potato', 'tomato', 'corn', 'strawberry', 'pumpkin'] as const;
export type CropId = typeof CROP_IDS[number];

export interface CropDefinition {
  id: CropId;
  name: string;
  seedName: string;
  /** Stored game minutes; the shared village pace determines elapsed real seconds. */
  growMinutes: number;
  food: number;
  seedReturn: number;
  xp: number;
  description: string;
}

export const CROPS: Record<CropId, CropDefinition> = {
  carrot: { id: 'carrot', name: '당근', seedName: '당근 씨앗', growMinutes: 180, food: 4, seedReturn: 2, xp: 15, description: '빨리 자라는 익숙한 텃밭 친구예요.' },
  potato: { id: 'potato', name: '감자', seedName: '감자 씨앗', growMinutes: 240, food: 5, seedReturn: 2, xp: 17, description: '따뜻한 한 끼를 든든하게 채워 줘요.' },
  tomato: { id: 'tomato', name: '토마토', seedName: '토마토 씨앗', growMinutes: 270, food: 6, seedReturn: 2, xp: 20, description: '붉게 익으면 싱싱한 식량이 돼요.' },
  corn: { id: 'corn', name: '옥수수', seedName: '옥수수 씨앗', growMinutes: 300, food: 7, seedReturn: 2, xp: 22, description: '노란 알갱이가 가득한 풍성한 작물이에요.' },
  strawberry: { id: 'strawberry', name: '딸기', seedName: '딸기 씨앗', growMinutes: 360, food: 8, seedReturn: 2, xp: 25, description: '조금 기다리면 달콤한 열매를 만날 수 있어요.' },
  pumpkin: { id: 'pumpkin', name: '호박', seedName: '호박 씨앗', growMinutes: 420, food: 10, seedReturn: 2, xp: 28, description: '천천히 자라는 대신 넉넉한 식량을 줘요.' },
};

export function isCropId(value: unknown): value is CropId {
  return typeof value === 'string' && (CROP_IDS as readonly string[]).includes(value);
}
