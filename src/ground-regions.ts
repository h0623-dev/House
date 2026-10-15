import type { OutdoorSiteId } from './outdoor-sites';
import type { GroundBounds, GroundPoint } from './ground-resources';

/** A place on the ground is independent of the resource family it contains. */
export type GroundRegionId = OutdoorSiteId | 'west-grove' | 'north-ruins' | 'east-creek';
export interface GroundRegion {
  readonly id: GroundRegionId;
  readonly name: string;
  readonly description: string;
  readonly bounds: GroundBounds;
  readonly path: GroundPoint[];
  readonly pathWidth: number;
}

/** Authored clearings surround the truck. The original four places retain
 * their complete geometry; each new place mixes resources along its own trail. */
export const GROUND_REGIONS: readonly GroundRegion[] = [
  {id:'grove',name:'남쪽 숲길',description:'울창한 숲길에서 나무를 한 그루씩 베어요.',
    bounds:{left:-215,top:755,right:575,bottom:1425},
    path:[[145,845],[145,1045],[220,1180],[260,1350]],pathWidth:132},
  {id:'seed-meadow',name:'남쪽 씨앗 풀밭',description:'풀 사이에서 여러 작물의 씨앗을 찾아요.',
    bounds:{left:455,top:855,right:900,bottom:1250},
    path:[[647,930],[652,1025],[675,1110],[676,1180]],pathWidth:100},
  {id:'salvage',name:'남쪽 고철 공터',description:'도로에 남은 고철을 모아 트럭을 가꿔요.',
    bounds:{left:830,top:840,right:1285,bottom:1250},
    path:[[1040,920],[1025,1010],[1080,1160]],pathWidth:100},
  {id:'spring',name:'남동쪽 샘터',description:'바위틈의 샘물을 한 웅덩이씩 길어요.',
    bounds:{left:1200,top:830,right:1640,bottom:1260},
    path:[[1400,900],[1390,995],[1435,1135],[1450,1180]],pathWidth:100},
  {id:'west-grove',name:'서쪽 그늘 숲',description:'트럭 서쪽의 숲길을 따라 나무·풀·고철·샘물을 찾아요.',
    bounds:{left:-580,top:400,right:-235,bottom:1280},
    path:[[-525,460],[-527,760],[-525,1030],[-522,1215]],pathWidth:100},
  {id:'north-ruins',name:'북쪽 옛 쉼터',description:'옛 쉼터에 되살아난 나무와 풀, 남겨진 고철과 샘물을 찾아요.',
    bounds:{left:-140,top:-350,right:620,bottom:190},
    path:[[-70,-260],[40,-280],[220,-270],[270,-155]],pathWidth:100},
  {id:'east-creek',name:'동쪽 개울길',description:'개울가를 거닐며 나무·씨앗·고철·물을 두루 모아요.',
    bounds:{left:1710,top:360,right:2080,bottom:1320},
    path:[[1765,425],[1760,700],[1762,1000],[1765,1250]],pathWidth:100},
];

export function getGroundRegion(id: unknown): GroundRegion | undefined {
  return GROUND_REGIONS.find(region => region.id === id);
}
