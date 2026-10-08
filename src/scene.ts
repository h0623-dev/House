import { CROPS, getCropProgress, getPlotCropId, type CropId, type GameState, type Plot } from './game';
import { drawHero, type HeroPose } from './actors';
import { drawPet, drawZombie } from './creatures';
import { drawWorldSprite, paintWorldQuad, drawWorldRoad, drawWorldFence, drawWorldStairs, worldArtReady } from './world-art';
import { drawCropSprite } from './crop-art';

type Point = [number, number];
type Selectable = 'farm' | 'truck' | 'pet' | 'character' | 'grove' | 'grove-work';
type Hit = { kind: Selectable; x: number; y: number; radius: number; bounds?: [number, number, number, number]; plotId?: number };
type SceneAction = 'plant' | 'water' | 'harvest' | 'chop' | 'expand' | 'gather';
type FarmAction = 'plant' | 'water' | 'harvest';
type FarmStroke = { pointerId: number; last: Point; visited: Set<number> };
const isFarmAction = (kind: SceneAction): kind is FarmAction => kind === 'plant' || kind === 'water' || kind === 'harvest';
type Chore = { kind: SceneAction; elapsed: number; duration: number; walk: number; work: number; path: Point[]; plotIndex: number; cropId: CropId; resolve: () => void };
// The hero belongs to the truck's scale: a person fits comfortably beside its house and planters.
const WORLD_HERO_SCALE = .68;
const CROP_PLANT_SIZE: Record<CropId, Point> = { carrot: [21, 34], potato: [26, 27], tomato: [24, 35], corn: [19, 40], strawberry: [22, 25], pumpkin: [29, 27] };
const CROP_SEED_COLOR: Record<CropId, string> = { carrot: '#d29b57', potato: '#bfab72', tomato: '#cfad6c', corn: '#efc955', strawberry: '#9d7150', pumpkin: '#ead5a1' };

/** A live isometric home built from our original painted anime environment art. */
export class Scene {
  private ctx: CanvasRenderingContext2D;
  private state: GameState | null = null;
  private frame = 0;
  private width = 1;
  private height = 1;
  private scale = 1;
  private dx = 0;
  private dy = 0;
  private time = 0;
  private hits: Hit[] = [];
  private focused = '';
  private focusedUntil = 0;
  private observer: ResizeObserver;
  private lastFrame = 0;
  private reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  private action: Chore | null = null;
  private zone: 'home' | 'grove' = 'home';
  private selectedPlotId: number | null = null;
  private farmFocus = false;
  private farmMode: FarmAction | null = null;
  private farmStroke: FarmStroke | null = null;
  private cancelledFarmPointer: number | null = null;
  private queuedPlotIds: number[] = [];
  private plantingCropId: CropId = 'carrot';
  private camera = { x: 480, y: 350, zoom: 1 };
  private treeCutAt = -100;
  private disposed = false;
  private suspended = false;
  private animate = (timestamp: number) => {
    if (document.hidden || this.suspended) { this.frame = 0; return; }
    this.frame = requestAnimationFrame(this.animate);
    if (timestamp - this.lastFrame < (this.reducedMotion && !this.action ? 250 : 32)) return;
    const elapsed = this.lastFrame ? Math.max(0, (timestamp - this.lastFrame) / 1000) : 0;
    const delta = Math.min(elapsed, .1);
    this.lastFrame = timestamp;
    this.time += delta;
    if (this.action) {
      this.action.elapsed += elapsed;
      if (this.action.kind === 'chop' && this.action.elapsed >= this.action.walk + this.action.work * .78 && this.treeCutAt < this.time - 15) this.treeCutAt = this.time;
      if (this.action.elapsed >= this.action.duration) {
        const finished = this.action; this.action = null; this.zone = 'home'; finished.resolve();
      }
    }
    this.render();
  };
  private visibility = () => {
    if (document.hidden) { this.endFarmStroke(); cancelAnimationFrame(this.frame); this.frame = 0; }
    else if (!this.frame && !this.suspended) { this.lastFrame = 0; this.frame = requestAnimationFrame(this.animate); }
  };
  private blur = () => this.endFarmStroke();
  private pointerDown = (event: PointerEvent) => {
    if (!event.isPrimary || event.button !== 0) return;
    this.cancelledFarmPointer = null;
    if (!this.farmMode || this.action && !isFarmAction(this.action.kind) || this.suspended) return;
    this.endFarmStroke();
    this.cancelledFarmPointer = null;
    this.farmStroke = { pointerId: event.pointerId, last: [event.clientX, event.clientY], visited: new Set() };
    this.canvas.setPointerCapture(event.pointerId);
    event.preventDefault();
    this.paintFarmPoint(event.clientX, event.clientY, false);
  };
  private pointerMove = (event: PointerEvent) => {
    const stroke = this.farmStroke;
    if (!stroke || event.pointerId !== stroke.pointerId || !this.farmMode) return;
    event.preventDefault();
    const [fromX, fromY] = stroke.last;
    const steps = Math.max(1, Math.ceil(Math.hypot(event.clientX - fromX, event.clientY - fromY) / 10));
    stroke.last = [event.clientX, event.clientY];
    // Sparse touch events still paint every planter crossed by a fast swipe.
    for (let step = 1; step <= steps && this.farmStroke === stroke; step++) {
      const amount = step / steps;
      this.paintFarmPoint(fromX + (event.clientX - fromX) * amount, fromY + (event.clientY - fromY) * amount, true);
    }
  };
  private pointerCancel = (event: PointerEvent) => {
    if (event.type === 'lostpointercapture') {
      if (event.pointerId === this.farmStroke?.pointerId) this.endFarmStroke();
      return;
    }
    if (event.pointerId === this.farmStroke?.pointerId) this.endFarmStroke(false);
    if (event.pointerId === this.cancelledFarmPointer) this.cancelledFarmPointer = null;
  };
  private pointer = (event: PointerEvent) => {
    if (event.pointerId === this.cancelledFarmPointer) { this.cancelledFarmPointer = null; return; }
    if (event.pointerId === this.farmStroke?.pointerId) { this.pointerMove(event); this.endFarmStroke(false); return; }
    if (this.action || this.farmMode) return;
    const { candidates, plots, x, y } = this.pointerHits(event.clientX, event.clientY);
    const foreground = [...candidates].reverse().find(item => (item.kind === 'pet' || item.kind === 'character') && Math.hypot(item.x - x, item.y - y) < item.radius);
    const workTree = candidates.find(item => item.kind === 'grove-work');
    const hit = foreground ?? workTree ?? plots[0] ?? candidates[candidates.length - 1];
    if (hit) { this.focus(hit.kind); this.onSelect(hit.kind, hit.plotId); }
  };

  constructor(private canvas: HTMLCanvasElement, private onSelect: (kind: Selectable, plotId?: number) => void) {
    this.ctx = canvas.getContext('2d')!;
    canvas.setAttribute('aria-label', '미래 대한민국의 트럭 집. 텃밭과 반려견, 캐릭터, 도로 옆 벌목장을 눌러 보세요.');
    canvas.addEventListener('pointerdown', this.pointerDown);
    canvas.addEventListener('pointermove', this.pointerMove);
    canvas.addEventListener('pointerup', this.pointer);
    canvas.addEventListener('pointercancel', this.pointerCancel);
    canvas.addEventListener('lostpointercapture', this.pointerCancel);
    document.addEventListener('visibilitychange', this.visibility);
    window.addEventListener('blur', this.blur);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    this.resize();
    this.frame = requestAnimationFrame(this.animate);
  }

  setState(state: GameState) {
    this.state = state;
    if (this.selectedPlotId !== null && !state.plots.some(plot => plot.id === this.selectedPlotId)) this.selectedPlotId = null;
  }
  setSelectedPlot(plotId: number | null) { this.selectedPlotId = plotId; }
  setFarmFocus(enabled: boolean) { this.farmFocus = enabled; }
  /** A farming tool stays selected while taps or a finger swipe queue further plots. */
  setFarmMode(mode: FarmAction | null, queuedPlotIds: number[] = [], selectedSeed: CropId = 'carrot') {
    if (mode !== this.farmMode) this.endFarmStroke();
    this.farmMode = mode;
    this.canvas.style.touchAction = mode ? 'none' : 'manipulation';
    this.queuedPlotIds = mode ? [...queuedPlotIds] : [];
    this.plantingCropId = selectedSeed;
    if (mode && !this.action) this.zone = 'home';
  }
  setPlantingMode(enabled: boolean, queuedPlotIds: number[] = [], selectedSeed: CropId = 'carrot') { this.setFarmMode(enabled ? 'plant' : null, queuedPlotIds, selectedSeed); }
  setSuspended(value: boolean) {
    this.suspended = value;
    if (value) { this.endFarmStroke(); cancelAnimationFrame(this.frame); this.frame = 0; }
    else this.visibility();
  }
  setZone(zone: 'home' | 'grove') { if (!this.action) this.zone = zone; }
  /** Resolves only after the visible walk, work and return have finished. */
  playAction(kind: SceneAction, plotId?: number, selectedCropId?: CropId): Promise<void> {
    if (this.disposed) return Promise.resolve();
    if (this.action) return Promise.reject(new Error('이미 행동 중이에요.'));
    const state = this.state;
    let plotIndex = state?.plots.findIndex(plot => plot.id === plotId) ?? -1;
    if (plotIndex < 0 && state) plotIndex = state.plots.findIndex(plot => kind === 'plant' ? plot.plantedAt === null : kind === 'water' ? plot.plantedAt !== null && !plot.watered : getCropProgress(state, plot) >= 1);
    plotIndex = Math.max(0, plotIndex);
    const cropId = kind === 'plant' ? selectedCropId ?? this.plantingCropId : getPlotCropId(state?.plots[plotIndex] ?? { id: 0, plantedAt: null, watered: false });
    const home = this.p(-74, 14, 95), [u, v] = this.plotPosition(plotIndex);
    let path: Point[] = [home, this.p(u - 9, 12, 95), this.p(u - 9, v + 39, 95)];
    let walk = .7, work = 1.7;
    if (kind === 'chop' || kind === 'gather') {
      const front = this.deckBounds().front;
      path = [home, this.p(-168, 16, 95), this.p(-176, front - 13, 95), this.rampTop(), this.rampBottom(), [146, 560], [142, 590]];
      walk = .9; work = kind === 'chop' ? 1.9 : 1.45;
      if (kind === 'chop') this.treeCutAt = -100;
    } else if (kind === 'expand') {
      path = [home, this.p(-156, 16, 95), this.p(-157, this.deckBounds().front - 19, 95)];
      walk = .7; work = 1.85;
    }
    this.zone = 'home';
    this.lastFrame = performance.now();
    return new Promise(resolve => { this.action = { kind, elapsed: 0, duration: walk * 2 + work, walk, work, path, plotIndex, cropId, resolve }; });
  }
  focus(kind: string) { this.focused = kind; this.focusedUntil = performance.now() + 2400; }
  resize() {
    this.endFarmStroke();
    const bounds = this.canvas.getBoundingClientRect();
    this.width = bounds.width || 850;
    this.height = bounds.height || 650;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.width * dpr);
    this.canvas.height = Math.round(this.height * dpr);
    this.render();
  }
  destroy() {
    this.disposed = true;
    this.endFarmStroke(false);
    this.action?.resolve(); this.action = null;
    cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    this.canvas.removeEventListener('pointerdown', this.pointerDown);
    this.canvas.removeEventListener('pointermove', this.pointerMove);
    this.canvas.removeEventListener('pointerup', this.pointer);
    this.canvas.removeEventListener('pointercancel', this.pointerCancel);
    this.canvas.removeEventListener('lostpointercapture', this.pointerCancel);
    document.removeEventListener('visibilitychange', this.visibility);
    window.removeEventListener('blur', this.blur);
  }

  private endFarmStroke(suppressUp = true) {
    const stroke = this.farmStroke;
    this.farmStroke = null;
    if (!stroke) return;
    this.cancelledFarmPointer = suppressUp ? stroke.pointerId : null;
    if (this.canvas.hasPointerCapture(stroke.pointerId)) this.canvas.releasePointerCapture(stroke.pointerId);
  }
  private pointerHits(clientX: number, clientY: number) {
    const rect = this.canvas.getBoundingClientRect();
    const x = (clientX - rect.left - this.dx) / this.scale, y = (clientY - rect.top - this.dy) / this.scale;
    const withinCanvas = clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
    const candidates = withinCanvas ? this.hits.filter(item => item.bounds
      ? x >= item.bounds[0] && y >= item.bounds[1] && x <= item.bounds[2] && y <= item.bounds[3]
      : Math.hypot(item.x - x, item.y - y) < Math.max(item.radius, 22 / this.scale)) : [];
    const plots = candidates.filter(item => item.kind === 'farm').sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y));
    return { candidates, plots, x, y };
  }
  private eligibleFarmPlot(plot: Plot) {
    if (this.farmMode === 'plant') return plot.plantedAt === null;
    if (this.farmMode === 'water') return plot.plantedAt !== null && !plot.watered;
    return this.farmMode === 'harvest' && this.state !== null && getCropProgress(this.state, plot) >= 1;
  }
  private paintFarmPoint(clientX: number, clientY: number, swiping: boolean) {
    const stroke = this.farmStroke;
    if (!stroke || !this.farmMode || this.action && !isFarmAction(this.action.kind)) return;
    const hit = this.pointerHits(clientX, clientY).plots[0];
    if (hit?.plotId === undefined || stroke.visited.has(hit.plotId)) return;
    const plot = this.state?.plots.find(item => item.id === hit.plotId);
    if (swiping && (!plot || !this.eligibleFarmPlot(plot))) return;
    stroke.visited.add(hit.plotId);
    this.focus('farm'); this.onSelect('farm', hit.plotId);
  }

  private p(u: number, v: number, z = 0): Point { return [480 + u * .91 - v * .67, 420 + u * .34 + v * .47 - z]; }
  private poly(points: Point[], fill: string, stroke = '#586759', weight = 1.7) {
    const c = this.ctx;
    c.beginPath(); points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath();
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = weight; c.lineJoin = 'round'; c.stroke(); }
  }
  private line(points: Point[], color: string, width = 1.6) {
    const c = this.ctx; c.beginPath(); points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
    c.strokeStyle = color; c.lineWidth = width; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke();
  }
  private ellipse(x: number, y: number, rx: number, ry: number, fill: string, stroke = '', weight = 1.5) {
    const c = this.ctx; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = weight; c.stroke(); }
  }
  private waterDrop(x: number, y: number, size: number) {
    const c = this.ctx; c.beginPath(); c.moveTo(x, y - size);
    c.bezierCurveTo(x + size, y, x + size * .6, y + size * .6, x, y + size * .6);
    c.bezierCurveTo(x - size * .6, y + size * .6, x - size, y, x, y - size);
    c.fillStyle = '#9dd7e9'; c.fill(); c.strokeStyle = '#578da8'; c.lineWidth = 1.1; c.stroke();
    this.line([[x - size * .3, y], [x - size * .2, y + size * .23]], '#edfbff', 1.5);
  }
  private round(x: number, y: number, width: number, height: number, radius: number, fill: string, stroke = '') {
    const c = this.ctx; c.beginPath(); c.roundRect(x, y, width, height, radius); c.fillStyle = fill; c.fill();
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = 1.8; c.stroke(); }
  }
  private label(text: string, x: number, y: number, size: number, color: string, weight = 600, align: CanvasTextAlign = 'center') {
    this.ctx.fillStyle = color; this.ctx.font = `${weight} ${size}px "Noto Sans KR Variable", system-ui, sans-serif`;
    this.ctx.textAlign = align; this.ctx.fillText(text, x, y);
  }
  private box(u: number, v: number, z: number, w: number, d: number, h: number, top: string, front: string, side: string, outline = '#68705b') {
    const faces: [Point, Point, Point, Point][] = [
      [this.p(u, v + d, z), this.p(u + w, v + d, z), this.p(u + w, v + d, z + h), this.p(u, v + d, z + h)],
      [this.p(u + w, v, z), this.p(u + w, v + d, z), this.p(u + w, v + d, z + h), this.p(u + w, v, z + h)],
      [this.p(u, v, z + h), this.p(u + w, v, z + h), this.p(u + w, v + d, z + h), this.p(u, v + d, z + h)],
    ];
    const material = ['#557770', '#7ca493', '#799181'].includes(top) ? 'metal' : 'wood';
    for (let i = 0; i < faces.length; i++) {
      this.poly(faces[i], [front, side, top][i], '', 0);
      paintWorldQuad(this.ctx, material, faces[i], [.22, .1, -.04][i]);
      this.poly(faces[i], '', outline, .95);
    }
  }
  private seed(i: number) { const n = Math.sin(i * 78.233 + 13.17) * 43758.5453; return n - Math.floor(n); }

  private ease(value: number) { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); }
  private actionProgress() { return this.action ? Math.max(0, Math.min(1, (this.action.elapsed - this.action.walk) / this.action.work)) : 0; }
  private deckBounds() {
    let level = this.state?.deckLevel ?? 1;
    if (this.action?.kind === 'expand') level += this.ease(this.actionProgress());
    const step = Math.max(0, Math.min(5, level - 1));
    return { level, left: -278 - step * 14, end: 234 + step * 9, front: 141 + step * 36 };
  }
  private plotPosition(index: number): Point {
    return [[-116, 42], [-33, 42], [50, 42], [133, 42], [-116, 122], [-33, 122], [50, 122], [133, 122]][index] as Point ?? [-116, 42];
  }
  private rampTop(): Point { return this.p(-225, this.deckBounds().front - 3, 95); }
  private rampBottom(): Point { return [140, 527]; }
  private followPath(path: Point[], progress: number): { point: Point; facing: 1 | -1 } {
    const lengths = path.slice(1).map((point, i) => Math.hypot(point[0] - path[i][0], point[1] - path[i][1]));
    let remaining = lengths.reduce((a, b) => a + b, 0) * Math.max(0, Math.min(1, progress));
    for (let i = 0; i < lengths.length; i++) {
      if (remaining <= lengths[i] || i === lengths.length - 1) {
        const t = lengths[i] ? Math.min(1, remaining / lengths[i]) : 1;
        return { point: [path[i][0] + (path[i + 1][0] - path[i][0]) * t, path[i][1] + (path[i + 1][1] - path[i][1]) * t], facing: path[i + 1][0] >= path[i][0] ? 1 : -1 };
      }
      remaining -= lengths[i];
    }
    return { point: path[0], facing: 1 };
  }
  private heroState(): { point: Point; pose: HeroPose; facing: 1 | -1; progress: number } {
    const action = this.action;
    if (!action) return { point: this.p(-74, 14, 95), pose: 'idle', facing: 1, progress: 0 };
    if (action.elapsed < action.walk) return { ...this.followPath(action.path, action.elapsed / action.walk), pose: 'walk', progress: 0 };
    if (action.elapsed > action.walk + action.work) return { ...this.followPath([...action.path].reverse(), (action.elapsed - action.walk - action.work) / action.walk), pose: 'walk', progress: 1 };
    const poses: Record<SceneAction, HeroPose> = { plant: 'sow', water: 'water', harvest: 'harvest', chop: 'chop', expand: this.actionProgress() > .83 ? 'celebrate' : 'idle', gather: 'sow' };
    return { point: action.path[action.path.length - 1], pose: poses[action.kind], facing: action.kind === 'chop' || action.kind === 'gather' ? -1 : 1, progress: this.actionProgress() };
  }
  private updateCamera() {
    const { level, left, front } = this.deckBounds();
    const homeX = 480 - (level - 1) * 12, homeY = 350 + (level - 1) * 6;
    const showFarm = this.farmFocus || this.farmMode !== null;
    let target = showFarm && this.zone === 'home' ? { x: 468, y: 350, zoom: 1.48 } : { x: homeX, y: homeY, zoom: 1 };
    if (this.zone === 'grove') target = { x: 180, y: 515, zoom: 2.15 };
    const action = this.action;
    // A stable whole-farm view lets additional taps queue while the hero works.
    if (action && !(this.farmMode && isFarmAction(action.kind))) {
      const entry = this.ease(action.elapsed / action.walk), exit = this.ease((action.duration - action.elapsed) / action.walk), amount = Math.min(entry, exit);
      const targetPoint = action.path[action.path.length - 1];
      const logging = action.kind === 'chop' || action.kind === 'gather';
      const focusX = logging ? 160 : targetPoint[0] + 35;
      const focusY = logging ? 523 : targetPoint[1] - 45;
      const zoom = action.kind === 'expand' ? 1.08 : logging ? 2.2 : 1.78;
      target = { x: target.x + (focusX - target.x) * amount, y: target.y + (focusY - target.y) * amount, zoom: target.zoom + (zoom - target.zoom) * amount };
    }
    const blend = this.reducedMotion ? .6 : .13;
    this.camera.x += (target.x - this.camera.x) * blend;
    this.camera.y += (target.y - this.camera.y) * blend;
    this.camera.zoom += (target.zoom - this.camera.zoom) * blend;
    const minX = Math.min(-10, this.p(left, front)[0] - 28);
    const logicalWidth = Math.max(showFarm ? 860 : 920 + (level - 1) * 24, 828 - minX);
    const logicalHeight = 560 + Math.max(0, level - 3) * 17;
    // The same scene supports the phone HUD and the standalone art preview.
    const css = getComputedStyle(this.canvas);
    const safeTop = Math.max(0, parseFloat(css.getPropertyValue('--world-safe-top')) || 0);
    const safeBottom = Math.max(0, parseFloat(css.getPropertyValue('--world-safe-bottom')) || 0);
    const availableHeight = Math.max(100, this.height - safeTop - safeBottom);
    this.scale = Math.min(this.width / logicalWidth, availableHeight / logicalHeight) * this.camera.zoom;
    this.dx = this.width / 2 - this.camera.x * this.scale;
    this.dy = safeTop + availableHeight / 2 - this.camera.y * this.scale;
  }

  private render() {
    const c = this.ctx;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, this.width, this.height);
    c.fillStyle = '#776c47'; c.fillRect(0, 0, this.width, this.height);
    this.updateCamera();
    c.translate(this.dx, this.dy); c.scale(this.scale, this.scale);
    this.hits = [];
    this.environment();
    this.truck();
    this.foreground();
    this.loggingGrove();
    this.hero();
    this.workEffects();
    this.fireflies();
    // Assets are cached before the next frame; the fallback never hides interactions.
    if (!worldArtReady()) this.label('그림을 불러오는 중…', 470, 45, 13, '#fff2d0');
  }

  private environment() {
    if (!drawWorldRoad(this.ctx)) {
      const sky = this.ctx.createLinearGradient(0, -200, 0, 800); sky.addColorStop(0, '#efe8cc'); sky.addColorStop(1, '#7e8060');
      this.ctx.fillStyle = sky; this.ctx.fillRect(-1000, -600, 3000, 2000);
    }
    // Foreground trees share the same painted line work as the survivors.
    this.tree(72, 226, 1.04); this.tree(25, 307, .72); this.tree(891, 196, .88);
    this.tree(1006, 252, .95);
    this.roadSign(788, 202);
    this.zombie(88 + Math.sin(this.time * .14) * 6, 423, .75, .2);
    this.zombie(970, 507 + Math.sin(this.time * .16) * 5, .67, 1.2);
    this.zombie(755, 644, .7, 2.2);
  }

  private grass(x: number, y: number, s: number) {
    drawWorldSprite(this.ctx, 'forest', x, y + 4 * s, 37 * s, 31 * s, .88);
  }
  private rock(x: number, y: number, s: number) {
    drawWorldSprite(this.ctx, 'forest', x, y + 6 * s, 59 * s, 50 * s);
  }
  private tree(x: number, y: number, s: number) {
    const c = this.ctx; c.save(); c.translate(x, y); c.rotate(Math.sin(this.time * .65 + x) * .002);
    drawWorldSprite(c, 'tree', 0, 0, 111 * s, 146 * s); c.restore();
  }
  private roadSign(x: number, y: number) {
    this.line([[x - 26, y + 42], [x - 26, y - 14]], '#4b4b32', 4);
    this.line([[x + 36, y + 49], [x + 36, y - 8]], '#4b4b32', 4);
    const sign: [Point, Point, Point, Point] = [[x - 55, y - 61], [x + 71, y - 44], [x + 71, y + 8], [x - 55, y - 9]];
    this.poly(sign, '#31594a', '', 0); paintWorldQuad(this.ctx, 'metal', sign, .14); this.poly(sign, '', '#d9b873', 2);
    this.ctx.save(); this.ctx.transform(1, .135, 0, 1, x, y);
    this.label('서울  SEOUL', 8, -31, 12, '#fff0ca', 700);
    this.label('↑  12 km', 8, -12, 10, '#efdfb5', 600);
    this.ctx.restore(); this.grass(x - 30, y + 43, 1.3);
  }

  private zombie(x: number, y: number, s: number, phase: number) {
    drawZombie(this.ctx, { x, y, scale: s * .49, time: this.reducedMotion ? phase : this.time + phase, kind: 'walker', pose: 'walk', facing: phase > 1 ? -1 : 1, alpha: .76 });
  }

  private truck() {
    const { level, left, end, front: deckFront } = this.deckBounds();
    const extra = end - 234;
    this.poly([this.p(-277, -129, -45), this.p(362, -129, -45), this.p(385, deckFront + 35, -45), this.p(-250, deckFront + 35, -45)], '#291c1850', '');
    this.box(-265, -125, -6, 590, 249, 63, '#557770', '#3c6660', '#38625b', '#3e3328');
    this.box(-254, -124, 31, 486 + extra, 254, 47, '#7ca493', '#77a996', '#5e8c7f', '#3e3328');
    for (let u = -240; u < 225; u += 82) {
      const face: [Point, Point, Point, Point] = [this.p(u, 130, 37), this.p(u + 71, 130, 37), this.p(u + 71, 130, 69), this.p(u, 130, 69)];
      paintWorldQuad(this.ctx, 'metal', face, .08); this.poly(face, '', '#403524', .8);
      this.line([this.p(u + 29, 131, 60), this.p(u + 43, 131, 60)], '#e2ba65', 2.4);
    }
    this.line([this.p(-254, 131, 77), this.p(end, 131, 77)], '#d1a24f', 3);
    for (const u of [-182, -104, 150, 300]) this.wheel(u, 135);
    if (level > 1) for (const u of [-230, -80, 80, 215]) this.line([this.p(u, 130, 31), this.p(u, deckFront - 5, 79)], '#80613c', 8);
    this.box(left, -137, 78, end - left, deckFront + 138, 15, '#e4c28c', '#bc9669', '#caab78', '#655037');
    const deck: [Point, Point, Point, Point] = [this.p(left + 1, -136, 94), this.p(end, -136, 94), this.p(end, deckFront, 94), this.p(left + 1, deckFront, 94)];
    this.poly(deck, '#d8ab64', '', 0); paintWorldQuad(this.ctx, 'wood', deck, -.025); this.poly(deck, '', '#715135', 1.6);
    for (let v = -111; v < deckFront; v += 24) {
      this.line([this.p(left + 1, v, 94), this.p(end, v, 94)], '#72533155', .9);
      this.line([this.p(left + 1, v + 1, 94), this.p(end, v + 1, 94)], '#ffe1a34d', .7);
    }
    for (let v = 141; v < deckFront; v += 36) this.line([this.p(left + 1, v, 94), this.p(end, v, 94)], '#80613c', 1.5);
    this.railing(left + 1, -133, end, -133, 94, false);
    this.railing(left + 2, -133, left + 2, deckFront - 2, 94, false);
    this.house(); this.solar(); this.waterTank(); this.cozyCorner(); this.farm();
    drawWorldSprite(this.ctx, 'crate', ...this.p(-102, -89, 96), 36, 37);
    const dogU = 90 + Math.sin(this.time * .37) * 55;
    const dogV = -14 + Math.cos(this.time * .37) * 15;
    const dog = this.p(dogU, dogV, 95);
    this.dog(dog[0], dog[1], .78, Math.cos(this.time * .37) > 0);
    this.hits.push({kind: 'pet', x: dog[0], y: dog[1] - 15, radius: 29});
    this.cabin();
    this.railing(left + 3, deckFront, -244, deckFront, 94, true);
    this.railing(-206, deckFront, end, deckFront, 94, true);
    this.bunting();
    this.flowerPot(left + 25, deckFront - 21, 95, '#e5a082');
    this.flowerPot(end - 16, deckFront - 16, 95, '#80a896');
    this.ramp();
    if (level >= 2) {
      const q = this.p(70, deckFront - 17, 96);
      this.label(`LIVING DECK · LV.${Math.floor(level)}`, q[0], q[1], 9, '#694f2c', 700);
    }
    if (this.action?.kind === 'expand') this.buildingDeck();
    const center = this.p(276, 27, 120);
    this.hits.unshift({kind: 'truck', x: center[0], y: center[1] + 55, radius: 97});
    this.pulse('pet', dog[0], dog[1] - 15, 29);
    this.pulse('truck', center[0], center[1] + 50, 71);
  }

  private wheel(u: number, v: number) {
    const [x, y] = this.p(u, v, -4);
    drawWorldSprite(this.ctx, 'wheel', x + 1, y + 30, 55, 72);
  }

  private cabin() {
    const [x, y] = this.p(325, 6, -12);
    drawWorldSprite(this.ctx, 'cabin', x + 4, y + 61, 280, 254);
  }

  private house() {
    const [x, y] = this.p(-184, -20, 94);
    drawWorldSprite(this.ctx, 'cottage', x, y + 5, 213, 246);
    for (let i = 0; i < 3; i++) {
      const age = (this.time * .24 + i / 3) % 1, r = 5 + age * 10;
      this.ctx.globalAlpha = (1 - age) * .21;
      this.ellipse(x - 34 + Math.sin(age * 4) * 8, y - 221 - age * 45, r, r * .72, '#fff1d7');
    }
    this.ctx.globalAlpha = 1;
  }

  private solar() {
    const [x, y] = this.p(-7, -96, 95);
    drawWorldSprite(this.ctx, 'solar', x, y + 7, 95, 92);
  }

  private waterTank() {
    const [x, y] = this.p(-212, 87, 94);
    drawWorldSprite(this.ctx, 'tank', x, y + 5, 52, 75);
  }

  private cozyCorner() {
    const [x, y] = this.p(140, -53, 96);
    drawWorldSprite(this.ctx, 'furniture', x, y + 4, 139, 84);
  }

  private farm() {
    const plots = this.state?.plots ?? [{ id: 1, plantedAt: null, watered: false }, { id: 2, plantedAt: null, watered: false }, { id: 3, plantedAt: null, watered: false }];
    const count = Math.min(plots.length, 8);
    for (let i = 0; i < count; i++) {
      const [u, v] = this.plotPosition(i), plot = plots[i];
      const mid = this.p(u + 35, v + 36, 112);
      // A painted empty planter provides warm woodgrain and rich detailed soil.
      drawWorldSprite(this.ctx, 'planter', mid[0], mid[1] + 31, 109, 71);
      const soil: [Point, Point, Point, Point] = [this.p(u + 6, v + 6, 106), this.p(u + 63, v + 6, 106), this.p(u + 63, v + 62, 106), this.p(u + 6, v + 62, 106)];
      if (plot.watered) {
        this.ctx.save(); this.ctx.globalAlpha = .25; this.poly(soil, '#251c12', '', 0); this.ctx.restore();
      }
      const queueIndex = this.queuedPlotIds.indexOf(plot.id);
      const working = this.action !== null && isFarmAction(this.action.kind) && this.action.plotIndex === i;
      const eligibleTarget = this.farmMode !== null && this.eligibleFarmPlot(plot);
      const waterTool = this.farmMode === 'water';
      const targetColor = waterTool ? '#a4d8ee' : this.farmMode === 'harvest' ? '#f5dc86' : '#bfdca2';
      if (plot.id === this.selectedPlotId || working || queueIndex >= 0 || eligibleTarget) {
        const color = working ? this.action?.kind === 'water' ? '#daf7ff' : '#ffec9a'
          : queueIndex >= 0 ? waterTool ? '#85c9e6' : '#ffce74'
          : plot.id === this.selectedPlotId ? waterTool ? '#d3f1fc' : '#ffec9a' : targetColor;
        this.ctx.save(); this.ctx.shadowColor = color; this.ctx.shadowBlur = working ? 10 : 5;
        if (queueIndex >= 0 && !working) this.ctx.setLineDash([5, 4]);
        this.poly([this.p(u, v, 108), this.p(u + 69, v, 108), this.p(u + 69, v + 68, 108), this.p(u, v + 68, 108)], waterTool ? '#aadfee24' : working ? '#ffe79d26' : '#bde39f16', color, working ? 3 : 2);
        this.ctx.restore();
      }
      const progress = this.state ? getCropProgress(this.state, plot) : 0;
      const cropId = getPlotCropId(plot);
      const cropPositions: Point[] = cropId === 'pumpkin' ? [[20, 19], [47, 28], [30, 48]]
        : cropId === 'corn' || cropId === 'tomato' || cropId === 'potato' ? [[18, 20], [45, 20], [18, 46], [45, 46]]
        : [[17, 15], [47, 15], [17, 33], [47, 33], [17, 51], [47, 51]];
      if (plot.plantedAt !== null) for (let k = 0; k < cropPositions.length; k++) {
        const [plantU, plantV] = cropPositions[k], [x, y] = this.p(u + plantU, v + plantV, 107);
        const mature = progress >= 1, medium = progress > .35;
        const growthScale = mature ? 1 : medium ? .7 + progress * .24 : .38 + progress * .8;
        const width = CROP_PLANT_SIZE[cropId][0] * growthScale, height = CROP_PLANT_SIZE[cropId][1] * growthScale;
        this.ctx.save(); this.ctx.translate(x, y); this.ctx.rotate(Math.sin(this.time * 1.1 + k + i) * .018);
        if (!drawCropSprite(this.ctx, cropId, 'plant', 0, 3, width, height)) drawWorldSprite(this.ctx, mature ? 'carrot' : medium ? 'carrotYoung' : 'sprout', 0, 3, width, height);
        this.ctx.restore();
      }
      if (eligibleTarget && !working) {
        const center = this.p(u + 34, v + 34, 115);
        this.ctx.save(); this.ctx.globalAlpha = queueIndex >= 0 ? .95 : .65;
        if (this.farmMode === 'plant') drawCropSprite(this.ctx, this.plantingCropId, 'seed', center[0], center[1] + 4, 18, 24);
        else {
          const hint = this.p(u + 53, v + 46, 125);
          this.ellipse(hint[0], hint[1], 10, 10, '#fff9e9e8', waterTool ? '#88bed5' : '#ccb16c', 1);
          if (waterTool) this.waterDrop(hint[0], hint[1] + 1, 7);
          else drawCropSprite(this.ctx, cropId, 'produce', hint[0], hint[1] + 8, 17, 17);
        }
        this.ctx.restore();
        if (queueIndex >= 0) {
          this.round(center[0] - 22, center[1] + 7, 44, 16, 8, waterTool ? '#d8eff9f0' : '#ffe9b6f0', waterTool ? '#75a8bb' : '#a7844a');
          this.label(`대기 ${queueIndex + 1}`, center[0], center[1] + 18, 9, waterTool ? '#406d82' : '#735935', 700);
        } else if (this.farmMode === 'plant') {
          this.label('+', center[0] + 15, center[1] + 4, 17, '#e7f4c8', 700);
        }
      }
      const marker = this.p(u + 63, v + 9, 107);
      this.line([[marker[0], marker[1]], [marker[0], marker[1] - 14]], '#ccae75', 2);
      this.round(marker[0] - 5, marker[1] - 21, 11, 8, 2, '#f1dbad', '#86673e');
      this.hits.push({kind: 'farm', x: mid[0], y: mid[1], radius: 45, plotId: plot.id});
      this.pulse('farm', mid[0], mid[1], 34);
      if (this.farmFocus || this.farmMode || plot.id === this.selectedPlotId) {
        const label = this.p(u + 11, v + 7, 123);
        this.ellipse(label[0], label[1], 9, 9, plot.id === this.selectedPlotId ? '#ffdf93' : '#fffae6', '#84613b', 1);
        this.label(String(i + 1), label[0], label[1] + 3.2, 10, '#4d462c');
      }
    }
    if (count < 4) {
      const c = this.ctx; c.save(); c.setLineDash([4, 5]);
      this.poly([this.p(133, 42, 95), this.p(202, 42, 95), this.p(202, 110, 95), this.p(133, 110, 95)], '#d1b98840', '#806642', 1.5); c.restore();
      const q = this.p(167, 76, 98); this.label('+', q[0], q[1] + 6, 25, '#806642', 400);
      this.hits.push({kind: 'truck', x: q[0], y: q[1], radius: 32});
    }
  }

  private sprig(x: number, y: number, s: number, flower?: string) {
    drawWorldSprite(this.ctx, flower ? 'flowers' : 'sprout', x, y + 3, (flower ? 29 : 18) * s, (flower ? 30 : 29) * s);
  }

  private flowerPot(u: number, v: number, z: number, color: string) {
    const [x, y] = this.p(u, v, z);
    drawWorldSprite(this.ctx, 'flowers', x, y + 2, 31, 35);
    void color;
  }

  private railing(u: number, v: number, endU: number, endV: number, z: number, front: boolean) {
    const dist = Math.hypot(endU - u, endV - v), n = Math.max(1, Math.ceil(dist / 155)), high = front ? 24 : 35;
    for (let i = 0; i < n; i++) {
      const a = i / n, b = (i + 1) / n;
      drawWorldFence(this.ctx, this.p(u + (endU - u) * a, v + (endV - v) * a, z), this.p(u + (endU - u) * b, v + (endV - v) * b, z), high);
    }
  }

  private bunting() {
    const a = this.p(-271, -127, 224), b = this.p(228, -127, 186);
    this.line([this.p(228, -127, 93), b], '#a58f67', 4);
    const c = this.ctx; c.beginPath(); c.moveTo(...a); c.quadraticCurveTo((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 42, ...b);
    c.strokeStyle = '#625137'; c.lineWidth = 1.2; c.stroke();
    const colors = ['#b86f44', '#ceac61', '#537e45', '#d5bd82', '#39654e'];
    for (let i = 1; i < 15; i++) {
      const t = i / 15;
      const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t + 84 * t * (1 - t);
      const sway = Math.sin(this.time * 1.6 + i) * 2;
      if (i % 2) this.poly([[x - 8, y - 2], [x + 8, y + 2], [x + sway, y + 20]], colors[i % colors.length], '#7e8c6860', .6);
      else { this.line([[x, y], [x, y + 6]], '#738064', 1); this.ellipse(x, y + 9, 3.3, 4.4, '#fbefb4', '#bea878', .6); }
    }
  }

  private hero() {
    const hero = this.heroState(), [x, y] = hero.point;
    let progress = hero.progress;
    if (hero.pose === 'chop') progress = (progress * 3) % 1;
    drawHero(this.ctx, { x, y, scale: WORLD_HERO_SCALE, gender: this.state?.gender ?? 'female', pose: hero.pose, facing: hero.facing, time: this.reducedMotion && !this.action ? 0 : this.time, progress });
    this.hits.push({ kind: 'character', x, y: y - 64 * WORLD_HERO_SCALE, radius: 60 * WORLD_HERO_SCALE });
    this.pulse('character', x, y - 64 * WORLD_HERO_SCALE, 54 * WORLD_HERO_SCALE);
    if (this.action && hero.pose !== 'walk') {
      const cropName = CROPS[this.action.cropId].name;
      const labels: Record<SceneAction, string> = { plant: `${cropName} 씨앗을 톡톡`, water: '물을 듬뿍', harvest: `${cropName} 수확!`, chop: '나무를 차곡차곡', expand: '우리 집을 넓혀요', gather: '쓸 만한 재료 발견!' };
      const label = labels[this.action.kind];
      const top = y - 128 * WORLD_HERO_SCALE - 32;
      this.round(x - 58, top, 116, 23, 11, '#fffae8e8', '#bda982');
      this.label(label, x, top + 15, 10, '#526750', 700);
    }
  }

  private ramp() {
    const top = this.rampTop(), bottom = this.rampBottom();
    drawWorldStairs(this.ctx, top, bottom);
    this.ctx.save(); this.ctx.setLineDash([5, 9]);
    this.line([[bottom[0], bottom[1] + 9], [157, 552], [151, 571], [130, 590]], '#e8c987', 2); this.ctx.restore();
  }

  private loggingGrove() {
    const c = this.ctx;
    drawWorldSprite(c, 'forest', 99, 628, 196, 159);
    this.tree(34, 574, .87); this.tree(29, 619, .57);
    const cut = this.time - this.treeCutAt, falling = cut >= 0 && cut < .8, stump = cut >= .8 && cut < 15;
    const work = this.action?.kind === 'chop' ? this.actionProgress() : 0;
    drawWorldSprite(c, 'stump', 100, 616, 79, 56);
    if (!stump) {
      c.save(); c.translate(97, 601);
      const swing = falling ? -this.ease(cut / .8) * 1.42 : work > .03 ? Math.sin(work * Math.PI * 24) * .02 : Math.sin(this.time * .7) * .006;
      c.rotate(swing); drawWorldSprite(c, 'tree', 0, 0, 131, 178); c.restore();
    }
    drawWorldSprite(c, 'stump', 183, 629, 70, 49);
    this.line([[69, 629], [69, 650]], '#8a693d', 3);
    this.line([[134, 629], [134, 650]], '#8a693d', 3);
    this.round(48, 622, 108, 30, 7, '#f4e4b7', '#8f6b3d');
    this.label('작은 벌목장', 102, 642, 13, '#4d572f', 800);
    // A tree tap starts work, while the sign opens the grove. Cover the painted canopies too.
    this.hits.push({kind: 'grove-work', x: 97, y: 512, radius: 0, bounds: [31, 423, 163, 616]});
    this.hits.push({kind: 'grove-work', x: 34, y: 511, radius: 0, bounds: [-15, 447, 83, 574]});
    this.hits.push({kind: 'grove-work', x: 29, y: 577, radius: 0, bounds: [-3, 536, 61, 619]});
    this.hits.push({kind: 'grove', x: 101, y: 636, radius: 44});
    this.pulse('grove', 100, 588, 74);
    this.pulse('grove-work', 100, 588, 74);
    if (this.zone === 'grove' && !this.action) {
      this.round(16, 421, 182, 30, 12, '#fff9e7f0', '#bcaa7a');
      this.label('나무를 눌러 벌목을 시작해요', 107, 441, 11, '#4d572f', 700);
    }
  }

  private buildingDeck() {
    const action = this.action;
    if (!action || action.elapsed < action.walk || action.elapsed > action.walk + action.work) return;
    const { left, end, front } = this.deckBounds();
    const oldFront = 141 + ((this.state?.deckLevel ?? 1) - 1) * 36;
    this.ctx.save(); this.ctx.globalAlpha = .32 + Math.sin(this.time * 9) * .12;
    this.poly([this.p(left, oldFront, 96), this.p(end, oldFront, 96), this.p(end, front, 96), this.p(left, front, 96)], '#fff1a5', '#fff4bd', 2);
    this.ctx.restore();
    const progress = this.actionProgress();
    for (let i = 0; i < 10; i++) {
      const q = this.p(left + (end - left) * i / 9, front - 3, 98), phase = (progress * 3 + i * .15) % 1;
      this.ctx.globalAlpha = Math.sin(phase * Math.PI);
      this.line([[q[0] - 4, q[1] - phase * 28], [q[0] + 4, q[1] - phase * 28]], '#fff8b9', 2);
      this.line([[q[0], q[1] - phase * 28 - 4], [q[0], q[1] - phase * 28 + 4]], '#fff8b9', 2);
    }
    this.ctx.globalAlpha = 1;
  }

  private workEffects() {
    const action = this.action;
    if (!action || action.elapsed < action.walk || action.elapsed > action.walk + action.work) return;
    const hero = this.heroState(), [hx, hy] = hero.point, progress = this.actionProgress();
    const [u, v] = this.plotPosition(action.plotIndex), target = this.p(u + 29, v + 33, 110);
    const c = this.ctx;
    if (action.kind === 'plant') {
      for (let i = 0; i < 9; i++) {
        const t = (progress * 2.5 + i * .12) % 1;
        const sx = hx + 28 * WORLD_HERO_SCALE, sy = hy - 37 * WORLD_HERO_SCALE;
        this.ellipse(sx + (target[0] - sx + (i % 3 - 1) * 13) * t, sy + (target[1] - sy + Math.floor(i / 3) * 5) * t - Math.sin(t * Math.PI) * 19, 2, 1.2, CROP_SEED_COLOR[action.cropId], '#957044', .7);
      }
      if (progress > .7) for (let i = 0; i < 3; i++) {
        const grow = (progress - .7) / .3;
        if (!drawCropSprite(c, action.cropId, 'plant', target[0] - 14 + i * 14, target[1], 8 + grow * 4, 8 + grow * 8)) this.sprig(target[0] - 14 + i * 14, target[1], (progress - .7) * .9);
      }
    } else if (action.kind === 'water') {
      for (let i = 0; i < 18; i++) {
        const t = (progress * 4 + i * .071) % 1, spread = (i % 5 - 2) * 5;
        const sx = hx + 38 * WORLD_HERO_SCALE, sy = hy - 27 * WORLD_HERO_SCALE;
        const x = sx + (target[0] - sx + spread) * t, y = sy + (target[1] - sy) * t + t * t * 4;
        this.line([[x, y], [x - 1.6, y - 4]], '#8dcde6', 1.8);
      }
      c.globalAlpha = progress * .3; this.ellipse(...target, 27, 11, '#4a9eb2'); c.globalAlpha = 1;
    } else if (action.kind === 'harvest') {
      for (let i = 0; i < 3; i++) {
        const t = Math.max(0, Math.min(1, (progress - i * .19) * 2));
        const x = target[0] + i * 8 - 8 + (hx + 25 * WORLD_HERO_SCALE - target[0]) * t, y = target[1] - Math.sin(t * Math.PI) * 41 + (hy - 15 * WORLD_HERO_SCALE - target[1]) * t;
        c.save(); c.translate(x, y); c.rotate(t * 2 + i * .4);
        const produceSize: Point = action.cropId === 'carrot' || action.cropId === 'corn' ? [16, 27] : [22, 22];
        if (!drawCropSprite(c, action.cropId, 'produce', 0, 9, produceSize[0], produceSize[1])) drawWorldSprite(c, 'carrot', 0, 9, 16, 30);
        c.restore();
      }
    } else if (action.kind === 'chop') {
      const cut = this.time - this.treeCutAt;
      if (cut < 0 || cut > .8) for (let i = 0; i < 12; i++) {
        const t = (progress * 3 + i * .057) % 1;
        const x = 98 + Math.cos(i * 1.2) * t * 40, y = 578 - Math.sin(t * Math.PI) * (15 + i * 2) + t * 21;
        c.save(); c.translate(x, y); c.rotate(t * 6 + i); this.round(-3, -1, 6, 2, 1, '#e0bf81'); c.restore();
      }
      if (progress > .8) {
        this.round(111, 514 - (progress - .8) * 55, 82, 26, 12, '#f6e8be', '#b5a175');
        this.label('목재 +18', 152, 532 - (progress - .8) * 55, 12, '#617947', 800);
      }
    } else if (action.kind === 'gather') {
      c.save(); c.translate(hx, hy); c.scale(WORLD_HERO_SCALE, WORLD_HERO_SCALE);
      this.round(-25, -57, 18, 16, 3, '#d6b17a', '#a1875c');
      this.line([[-25, -49], [-7, -49]], '#f2d598', 2); c.restore();
    } else if (action.kind === 'expand' && progress < .83) {
      c.save(); c.translate(hx + 25 * WORLD_HERO_SCALE, hy - 37 * WORLD_HERO_SCALE); c.scale(WORLD_HERO_SCALE, WORLD_HERO_SCALE); c.rotate(-.8 + Math.sin(progress * Math.PI * 10) * .9);
      this.line([[0, 0], [0, -29]], '#9e7750', 5); this.round(-12, -34, 25, 10, 3, '#8faaa0', '#617e75'); c.restore();
    }
    if (action.kind !== 'expand' && action.kind !== 'chop' && progress > .78) {
      for (let i = 0; i < 6; i++) {
        const x = target[0] + Math.cos(i) * 32, y = target[1] - 12 + Math.sin(i) * 22;
        this.line([[x - 3, y], [x + 3, y]], '#fff4b0', 2); this.line([[x, y - 3], [x, y + 3]], '#fff4b0', 2);
      }
    }
  }

  private dog(x: number, y: number, s: number, right: boolean) {
    drawPet(this.ctx, { x, y, scale: s, time: this.reducedMotion ? 0 : this.time, facing: right ? 1 : -1, pose: 'walk' });
  }

  private pulse(kind: string, x: number, y: number, radius: number) {
    if (this.focused !== kind || performance.now() > this.focusedUntil) return;
    const c = this.ctx; c.save(); c.globalAlpha = .55 + Math.sin(this.time * 5) * .25; c.setLineDash([4, 6]);
    c.beginPath(); c.ellipse(x, y, radius, radius * .62, 0, 0, Math.PI * 2); c.strokeStyle = '#fff4bd'; c.lineWidth = 3; c.stroke(); c.restore();
  }
  private foreground() {
    this.tree(-58, 739, 1.03); this.tree(1054, 733, 1.29);
    drawWorldSprite(this.ctx, 'forest', 943, 754, 165, 141);
    drawWorldSprite(this.ctx, 'forest', 8, 724, 143, 122);
    this.grass(859, 740, 1.5);
  }
  private fireflies() {
    for (let i = 0; i < 9; i++) {
      const x = 140 + this.seed(i + 76) * 760 + Math.sin(this.time * .35 + i) * 12;
      const y = 160 + this.seed(i + 91) * 390 + Math.cos(this.time * .5 + i) * 8;
      this.ctx.globalAlpha = .24 + Math.sin(this.time + i) * .16;
      this.ellipse(x, y, 2.1, 2.1, '#fff9d7');
    }
    this.ctx.globalAlpha = 1;
    // Two small birds on the quiet horizon.
    const bx = 510 + Math.sin(this.time * .1) * 25, by = 90 + Math.cos(this.time * .5) * 2;
    this.line([[bx - 7, by - 2], [bx, by + 1], [bx + 7, by - 3]], '#91aa93', 1.7);
    this.line([[bx + 23, by + 10], [bx + 28, by + 12], [bx + 33, by + 9]], '#a0b39b', 1.5);
  }
}
