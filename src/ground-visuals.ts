import { GROUND_POND_SHORE_POLYGON, type GroundResourceId, type GroundResourceNode } from './ground-resources';

export type GroundTreeVariant = 0 | 1 | 2;
export type GroundSprite = 'tree' | 'stump' | 'scrap' | 'seed' | 'water' | 'underbrush';
export type GroundVisualPoint = readonly [number, number];
export type GroundVisualBounds = [number, number, number, number];

export interface GroundSpriteFrame {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  /** Contact position in original atlas pixels, rather than the crop bottom. */
  readonly anchor: GroundVisualPoint;
  /** A measured source contour excludes neighbouring atlas props. */
  readonly contour: readonly GroundVisualPoint[];
}

/** One continuous painting covers the highway and neighbouring wilderness.
 * It remains attached to the world when the camera moves or zooms and supplies
 * materials, foliage and a stream, but no interactive gathering objects. */
export const GROUND_LANDSCAPE_BOUNDS = { left: -650, top: -420, right: 2150, bottom: 1750 } as const;
export const GROUND_LANDSCAPE_SOURCE_SIZE = { width: 1448, height: 1086 } as const;
export const GROUND_PROPS_SOURCE_SIZE = { width: 1536, height: 1024 } as const;
const landscapeWidth = GROUND_LANDSCAPE_BOUNDS.right - GROUND_LANDSCAPE_BOUNDS.left,
  landscapeHeight = GROUND_LANDSCAPE_BOUNDS.bottom - GROUND_LANDSCAPE_BOUNDS.top;
/** Portrait overviews expose more background than the playable core. Fixed
 * reflected neighbours keep the world covered without camera-driven scaling. */
export const GROUND_BACKGROUND_BOUNDS = {
  left: GROUND_LANDSCAPE_BOUNDS.left - landscapeWidth * 12,
  top: GROUND_LANDSCAPE_BOUNDS.top - landscapeHeight * 6,
  right: GROUND_LANDSCAPE_BOUNDS.right + landscapeWidth * 12,
  bottom: GROUND_LANDSCAPE_BOUNDS.bottom + landscapeHeight * 6,
} as const;
const backgroundColumns = Array.from({ length: 25 }, (_, index) => index - 12),
  backgroundRows = Array.from({ length: 13 }, (_, index) => index - 6);
export const GROUND_BACKGROUND_TILES = backgroundRows.flatMap(row => backgroundColumns.map(column => ({
  column, row, mirrorX: Math.abs(column) % 2 === 1, mirrorY: Math.abs(row) % 2 === 1,
  bounds: {
    left: GROUND_LANDSCAPE_BOUNDS.left + column * landscapeWidth,
    top: GROUND_LANDSCAPE_BOUNDS.top + row * landscapeHeight,
    right: GROUND_LANDSCAPE_BOUNDS.right + column * landscapeWidth,
    bottom: GROUND_LANDSCAPE_BOUNDS.bottom + row * landscapeHeight,
  },
})));

export interface GroundBackgroundViewport { left: number; top: number; right: number; bottom: number }
export interface GroundCanvasTransform { a: number; b: number; c: number; d: number; e: number; f: number }

/** Invert the actual backing-canvas transform, including device pixel ratio.
 * The result only culls invisible tiles; it never changes their world geometry. */
export function getGroundBackgroundViewport(transform: GroundCanvasTransform, canvasWidth: number,
  canvasHeight: number): GroundBackgroundViewport | undefined {
  const { a, b, c, d, e, f } = transform, determinant = a * d - b * c;
  if (!Number.isFinite(determinant) || determinant === 0) return undefined;
  const corners = [[0, 0], [canvasWidth, 0], [canvasWidth, canvasHeight], [0, canvasHeight]].map(([x, y]) => [
    (d * x - c * y + c * f - d * e) / determinant,
    (-b * x + a * y + b * e - a * f) / determinant,
  ]);
  return { left: Math.min(...corners.map(point => point[0])), top: Math.min(...corners.map(point => point[1])),
    right: Math.max(...corners.map(point => point[0])), bottom: Math.max(...corners.map(point => point[1])) };
}

export function getGroundVisibleBackgroundTiles(viewport: GroundBackgroundViewport) {
  return GROUND_BACKGROUND_TILES.filter(tile => tile.bounds.right >= viewport.left && tile.bounds.left <= viewport.right
    && tile.bounds.bottom >= viewport.top && tile.bounds.top <= viewport.bottom);
}

/** Source measurements come from the original transparent painting. These
 * contours are important: the spreading crown crosses the neighbouring grid
 * cell, while its lower-right crop overlaps the stump's cell. Canvas clipping
 * retains the complete crown without including a piece of a different prop. */
export const GROUND_SPRITE_FRAMES = {
  oak: { x: 3, y: 52, width: 433, height: 597, anchor: [238, 586], contour: [
    [24,258],[15,371],[53,535],[57,545],[73,579],[74,580],[101,597],[169,628],
    [172,629],[207,634],[251,636],[255,636],[265,633],[326,612],[347,596],
    [364,579],[380,558],[381,556],[423,396],[424,391],[415,256],[413,248],
    [411,243],[410,241],[363,162],[317,107],[315,105],[309,100],[252,74],
    [245,71],[209,64],[161,84],[145,94],[105,123],[98,130],[78,153],[73,161],[33,228],
  ] },
  birch: { x: 424, y: 49, width: 349, height: 595, anchor: [617, 600], contour: [
    [588,61],[503,109],[496,116],[450,194],[449,196],[447,201],[442,239],
    [436,311],[436,312],[447,389],[500,597],[527,615],[590,629],[624,631],
    [626,631],[656,622],[660,620],[672,613],[705,589],[708,586],[709,584],
    [760,349],[760,346],[758,300],[730,160],[727,153],[726,151],[681,109],
    [630,65],[624,62],[619,61],
  ] },
  spread: { x: 757, y: 86, width: 517, height: 563, anchor: [1005, 603], contour: [
    [1022,98],[887,119],[884,120],[882,121],[846,145],[845,146],[840,153],
    [794,229],[773,266],[769,275],[769,279],[775,408],[841,581],[844,588],
    [846,590],[856,597],[870,604],[934,629],[941,631],[991,636],[994,636],
    [1012,635],[1020,634],[1063,628],[1107,614],[1119,610],[1141,588],
    [1248,459],[1252,454],[1261,433],[1261,425],[1245,352],[1243,346],
    [1184,244],[1157,199],[1155,196],[1148,189],[1060,120],[1031,99],[1028,98],
  ] },
  stump: { x: 1215, y: 415, width: 307, height: 232, anchor: [1370, 618], contour: [
    [1509,553],[1475,482],[1433,448],[1414,435],[1410,433],[1405,431],
    [1394,428],[1390,427],[1384,427],[1349,430],[1344,431],[1340,432],
    [1337,433],[1335,434],[1330,437],[1312,455],[1295,473],[1246,534],
    [1235,551],[1227,573],[1227,574],[1241,590],[1242,591],[1248,594],
    [1295,615],[1322,627],[1327,629],[1344,634],[1346,634],[1446,633],
    [1457,631],[1461,629],[1496,601],[1498,599],[1501,595],[1506,582],
  ] },
  scrap: { x: 3, y: 723, width: 408, height: 250, anchor: [204, 947], contour: [
    [240,735],[99,766],[52,780],[27,827],[15,875],[15,877],[26,896],
    [36,909],[37,910],[65,935],[127,951],[131,952],[277,960],[280,960],
    [314,959],[319,958],[337,953],[340,952],[342,950],[397,894],[398,877],
    [398,875],[396,856],[376,834],[371,829],[323,787],[245,736],[243,735],
  ] },
  seed: { x: 424, y: 665, width: 344, height: 309, anchor: [601, 945], contour: [
    [587,677],[585,677],[559,688],[453,746],[436,811],[436,812],[440,906],
    [451,921],[457,927],[493,944],[554,957],[588,961],[593,961],[697,947],
    [715,936],[748,913],[750,911],[755,855],[755,853],[748,811],[709,728],[690,692],
  ] },
  water: { x: 764, y: 669, width: 428, height: 309, anchor: [1001, 879], contour: [
    [1006,681],[872,698],[848,720],[809,762],[781,800],[776,819],[776,891],
    [777,894],[797,930],[849,957],[896,963],[979,965],[1018,965],[1024,963],
    [1107,934],[1112,932],[1143,908],[1146,905],[1172,878],[1179,843],
    [1179,839],[1172,810],[1157,789],[1154,786],[1068,707],[1035,689],[1007,681],
  ] },
  underbrush: { x: 1198, y: 702, width: 337, height: 268, anchor: [1371, 947], contour: [
    [1522,881],[1513,842],[1487,769],[1468,747],[1467,746],[1423,715],
    [1393,714],[1392,714],[1386,715],[1245,752],[1238,754],[1235,755],
    [1233,756],[1231,758],[1210,867],[1210,869],[1227,913],[1228,914],
    [1264,945],[1289,949],[1344,957],[1430,957],[1468,951],[1490,944],[1511,923],[1522,883],
  ] },
} as const satisfies Record<string, GroundSpriteFrame>;

const treeFrames = ['oak', 'birch', 'spread'] as const;

export function getGroundTreeVariant(id: GroundResourceId | string): GroundTreeVariant {
  const index = Number(id.match(/\d+$/)?.[0] ?? 1);
  return (Number.isFinite(index) ? (Math.max(1, index) - 1) % 3 : 0) as GroundTreeVariant;
}

export function getGroundSpriteFrame(sprite: GroundSprite, variant: number = 0): GroundSpriteFrame {
  const index = Number.isFinite(variant) ? ((Math.floor(variant) % 3) + 3) % 3 : 0;
  return sprite === 'tree' ? GROUND_SPRITE_FRAMES[treeFrames[index]] : GROUND_SPRITE_FRAMES[sprite];
}

export interface GroundResourceVisual {
  readonly sprite: GroundSprite;
  readonly variant: GroundTreeVariant;
  readonly width: number;
  readonly height: number;
}

export interface GroundContactShadow {
  readonly offsetX: number;
  readonly offsetY: number;
  readonly radiusX: number;
  readonly radiusY: number;
  readonly opacity: number;
}

/** Small world-space shadows touch the measured root/prop anchor. Their
 * ground-plane proportions never inherit the height of a tree crown. */
export function getGroundContactShadow(sprite: GroundSprite, width: number, height: number): GroundContactShadow {
  const tree = sprite === 'tree', pool = sprite === 'water';
  return {
    offsetX: width * .025,
    offsetY: height * (pool ? .10 : .018),
    radiusX: width * (tree ? .29 : pool ? .43 : .37),
    radiusY: width * (tree ? .095 : pool ? .13 : .10),
    opacity: pool ? .15 : tree ? .23 : .19,
  };
}

export function getGroundResourceVisual(node: GroundResourceNode, visual?: string): GroundResourceVisual {
  const variant = getGroundTreeVariant(node.id);
  if (node.kind === 'water') return { sprite: 'water', variant,
    width: node.bounds.right - node.bounds.left + 16, height: node.bounds.bottom - node.bounds.top + 23 };
  if (node.kind === 'scrap') return { sprite: 'scrap', variant, width: 96 * node.scale, height: 78 * node.scale };
  if (node.kind === 'tree') {
    if (visual === 'stump') return { sprite: 'stump', variant, width: 46 * node.scale, height: 32 * node.scale };
    return { sprite: 'tree', variant, width: [111, 96, 120][variant] * node.scale,
      height: [146, 152, 146][variant] * node.scale };
  }
  if (visual === 'depleted' && node.kind === 'seed')
    return { sprite: 'underbrush', variant, width: 34 * node.scale, height: 22 * node.scale };
  const sprite = node.kind, frame = getGroundSpriteFrame(sprite);
  // Preserve the original ground-plane perspective within the prop budget.
  const width = 86 * node.scale;
  return { sprite, variant, width, height: Math.min(84 * node.scale, width * frame.height / frame.width) };
}

export function getGroundSpriteBounds(sprite: GroundSprite, x: number, y: number,
  width: number, height: number, variant: number = 0): GroundVisualBounds {
  const frame = getGroundSpriteFrame(sprite, variant), left = x - (frame.anchor[0] - frame.x) * width / frame.width,
    top = y - (frame.anchor[1] - frame.y) * height / frame.height;
  return [left, top, left + width, top + height];
}

export function getGroundVisualBounds(node: GroundResourceNode, visual?: string): GroundVisualBounds {
  if (node.kind === 'water') return [node.bounds.left - 8, node.bounds.top - 13, node.bounds.right + 8, node.bounds.bottom + 10];
  if (node.kind === 'scrap') return [node.point[0] - 48 * node.scale, node.point[1] - 47 * node.scale,
    node.point[0] + 48 * node.scale, node.point[1] + 31 * node.scale];
  const art = getGroundResourceVisual(node, visual);
  return getGroundSpriteBounds(art.sprite, node.point[0], node.point[1], art.width, art.height, art.variant);
}

/** The painted silhouette can serve precise resource hit testing without
 * changing the much smaller physical trunk/prop collision footprint. */
export function getGroundVisualPolygon(node: GroundResourceNode, visual?: string): [number, number][] {
  if (node.kind === 'water') return GROUND_POND_SHORE_POLYGON.map(([x, y]) => [x, y]);
  if (node.kind === 'scrap') return [[-42,-14],[-31,-43],[-11,-47],[38,-36],[48,10],[37,31],[-37,30],[-48,6]]
    .map(([x, y]) => [node.point[0] + x * node.scale, node.point[1] + y * node.scale]);
  const art = getGroundResourceVisual(node, visual), frame = getGroundSpriteFrame(art.sprite, art.variant);
  return frame.contour.map(([x, y]) => [node.point[0] + (x - frame.anchor[0]) * art.width / frame.width,
    node.point[1] + (y - frame.anchor[1]) * art.height / frame.height]);
}
