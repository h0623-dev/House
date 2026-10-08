import { getCropProgress, type GameState } from './game';
import { drawHero, type HeroPose } from './actors';

type Point = [number, number];
type Selectable = 'farm' | 'truck' | 'pet' | 'character' | 'grove';
type Hit = { kind: Selectable; x: number; y: number; radius: number };
type SceneAction = 'plant' | 'water' | 'harvest' | 'chop' | 'expand' | 'gather';
type Chore = { kind: SceneAction; elapsed: number; duration: number; walk: number; work: number; path: Point[]; plotIndex: number; resolve: () => void };

/** Original, resolution-independent artwork. All coordinates are in our little world. */
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
  private camera = { x: 480, y: 350, zoom: 1 };
  private treeCutAt = -100;
  private disposed = false;
  private suspended = false;
  private animate = (timestamp: number) => {
    if (document.hidden || this.suspended) { this.frame = 0; return; }
    this.frame = requestAnimationFrame(this.animate);
    if (timestamp - this.lastFrame < (this.reducedMotion && !this.action ? 250 : 32)) return;
    const delta = this.lastFrame ? Math.min((timestamp - this.lastFrame) / 1000, .1) : 0;
    this.lastFrame = timestamp;
    this.time += delta;
    if (this.action) {
      this.action.elapsed += delta;
      if (this.action.kind === 'chop' && this.action.elapsed >= this.action.walk + this.action.work * .78 && this.treeCutAt < this.time - 15) this.treeCutAt = this.time;
      if (this.action.elapsed >= this.action.duration) {
        const finished = this.action; this.action = null; this.zone = 'home'; finished.resolve();
      }
    }
    this.render();
  };
  private visibility = () => {
    if (document.hidden) { cancelAnimationFrame(this.frame); this.frame = 0; }
    else if (!this.frame && !this.suspended) { this.lastFrame = 0; this.frame = requestAnimationFrame(this.animate); }
  };
  private pointer = (event: PointerEvent) => {
    if (this.action) return;
    const rect = this.canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left - this.dx) / this.scale;
    const y = (event.clientY - rect.top - this.dy) / this.scale;
    const hit = [...this.hits].reverse().find(item => Math.hypot(item.x - x, item.y - y) < item.radius);
    if (hit) { this.focus(hit.kind); this.onSelect(hit.kind); }
  };

  constructor(private canvas: HTMLCanvasElement, private onSelect: (kind: Selectable) => void) {
    this.ctx = canvas.getContext('2d')!;
    canvas.setAttribute('aria-label', '미래 대한민국의 트럭 집. 텃밭과 반려견, 캐릭터, 도로 옆 벌목장을 눌러 보세요.');
    canvas.addEventListener('pointerup', this.pointer);
    document.addEventListener('visibilitychange', this.visibility);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    this.resize();
    this.frame = requestAnimationFrame(this.animate);
  }

  setState(state: GameState) { this.state = state; }
  setSuspended(value: boolean) {
    this.suspended = value;
    if (value) { cancelAnimationFrame(this.frame); this.frame = 0; }
    else this.visibility();
  }
  setZone(zone: 'home' | 'grove') { if (!this.action) this.zone = zone; }
  /** Resolves only after the visible walk, work and return have finished. */
  playAction(kind: SceneAction, plotId?: number): Promise<void> {
    if (this.disposed) return Promise.resolve();
    if (this.action) return Promise.reject(new Error('이미 행동 중이에요.'));
    const state = this.state;
    let plotIndex = state?.plots.findIndex(plot => plot.id === plotId) ?? -1;
    if (plotIndex < 0 && state) plotIndex = state.plots.findIndex(plot => kind === 'plant' ? plot.plantedAt === null : kind === 'water' ? plot.plantedAt !== null && !plot.watered : getCropProgress(state, plot) >= 1);
    plotIndex = Math.max(0, plotIndex);
    const home = this.p(-74, 14, 95), [u, v] = this.plotPosition(plotIndex);
    let path: Point[] = [home, this.p(u - 9, 12, 95), this.p(u - 9, v + 39, 95)];
    let walk = 1.15, work = 2.2;
    if (kind === 'chop' || kind === 'gather') {
      const front = this.deckBounds().front;
      path = [home, this.p(-168, 16, 95), this.p(-176, front - 13, 95), this.rampTop(), this.rampBottom(), [146, 560], [142, 590]];
      walk = 1.6; work = kind === 'chop' ? 2.5 : 1.8;
      if (kind === 'chop') this.treeCutAt = -100;
    } else if (kind === 'expand') {
      path = [home, this.p(-156, 16, 95), this.p(-157, this.deckBounds().front - 19, 95)];
      walk = .85; work = 2.25;
    }
    this.zone = 'home';
    return new Promise(resolve => { this.action = { kind, elapsed: 0, duration: walk * 2 + work, walk, work, path, plotIndex, resolve }; });
  }
  focus(kind: string) { this.focused = kind; this.focusedUntil = performance.now() + 2400; }
  resize() {
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
    this.action?.resolve(); this.action = null;
    cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    this.canvas.removeEventListener('pointerup', this.pointer);
    document.removeEventListener('visibilitychange', this.visibility);
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
  private round(x: number, y: number, width: number, height: number, radius: number, fill: string, stroke = '') {
    const c = this.ctx; c.beginPath(); c.roundRect(x, y, width, height, radius); c.fillStyle = fill; c.fill();
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = 1.8; c.stroke(); }
  }
  private label(text: string, x: number, y: number, size: number, color: string, weight = 600, align: CanvasTextAlign = 'center') {
    this.ctx.fillStyle = color; this.ctx.font = `${weight} ${size}px "Pretendard", "Noto Sans KR", system-ui, sans-serif`;
    this.ctx.textAlign = align; this.ctx.fillText(text, x, y);
  }
  private box(u: number, v: number, z: number, w: number, d: number, h: number, top: string, front: string, side: string, outline = '#68705b') {
    this.poly([this.p(u, v + d, z), this.p(u + w, v + d, z), this.p(u + w, v + d, z + h), this.p(u, v + d, z + h)], front, outline);
    this.poly([this.p(u + w, v, z), this.p(u + w, v + d, z), this.p(u + w, v + d, z + h), this.p(u + w, v, z + h)], side, outline);
    this.poly([this.p(u, v, z + h), this.p(u + w, v, z + h), this.p(u + w, v + d, z + h), this.p(u, v + d, z + h)], top, outline);
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
    let target = { x: homeX, y: homeY, zoom: 1 };
    if (this.zone === 'grove') target = { x: 180, y: 515, zoom: 2.15 };
    const action = this.action;
    if (action) {
      const entry = this.ease(action.elapsed / action.walk), exit = this.ease((action.duration - action.elapsed) / action.walk), amount = Math.min(entry, exit);
      const targetPoint = action.path[action.path.length - 1];
      const logging = action.kind === 'chop' || action.kind === 'gather';
      const focusX = logging ? 160 : targetPoint[0] + 35;
      const focusY = logging ? 523 : targetPoint[1] - 45;
      const zoom = action.kind === 'expand' ? 1.08 : logging ? 2.2 : 1.78;
      target = { x: homeX + (focusX - homeX) * amount, y: homeY + (focusY - homeY) * amount, zoom: 1 + (zoom - 1) * amount };
    }
    const blend = this.reducedMotion ? .6 : .13;
    this.camera.x += (target.x - this.camera.x) * blend;
    this.camera.y += (target.y - this.camera.y) * blend;
    this.camera.zoom += (target.zoom - this.camera.zoom) * blend;
    const minX = Math.min(-10, this.p(left, front)[0] - 28);
    const logicalWidth = Math.max(990, 958 - minX);
    const logicalHeight = 735 + Math.max(0, level - 3) * 17;
    this.scale = Math.min(this.width / logicalWidth, this.height / logicalHeight) * this.camera.zoom;
    this.dx = this.width / 2 - this.camera.x * this.scale;
    this.dy = this.height / 2 - this.camera.y * this.scale;
  }

  private render() {
    const c = this.ctx;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, this.width, this.height);
    c.fillStyle = '#e1e8d9'; c.fillRect(0, 0, this.width, this.height);
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
  }

  private environment() {
    const c = this.ctx;
    // Soft silhouettes keep a sense of the world beyond the little safe haven.
    c.save(); c.globalAlpha = .5;
    for (let i = 0; i < 17; i++) {
      const x = -80 + i * 73, h = 48 + this.seed(i) * 110, y = 90 + Math.sin(i) * 17;
      this.round(x, y - h, 48 + this.seed(i + 6) * 27, h, 3, '#b9cdbd');
      for (let r = 0; r < 5; r++) for (let col = 0; col < 3; col++) {
        this.round(x + 10 + col * 14, y - h + 12 + r * 18, 5, 8, 1, '#d5dfcf');
      }
      if (i % 3 === 0) this.line([[x + 17, y - h], [x + 17, y - h - 17]], '#b9cdbd', 2);
    }
    // A far-away Seoul tower.
    this.line([[702, 40], [708, -32], [714, 40]], '#a9c4b1', 6);
    this.round(696, -24, 24, 8, 3, '#a9c4b1'); this.line([[708, -24], [708, -51]], '#a9c4b1', 2);
    c.restore();
    this.poly([this.p(-950, -292, -50), this.p(950, -292, -50), this.p(950, 288, -50), this.p(-950, 288, -50)], '#c4d3be', '');
    this.poly([this.p(-950, -255, -50), this.p(950, -255, -50), this.p(950, 255, -50), this.p(-950, 255, -50)], '#aebcb1', '');
    this.poly([this.p(-950, -242, -50), this.p(950, -242, -50), this.p(950, 242, -50), this.p(-950, 242, -50)], '#b8c3b8', '');
    for (const v of [-224, 224]) this.line([this.p(-950, v, -49), this.p(950, v, -49)], '#ecedcf', 3);
    for (let u = -1050; u < 1000; u += 170) {
      for (const v of [-85, 87]) this.line([this.p(u, v, -49), this.p(u + 83, v, -49)], '#e2e6d7', 5);
      // Small road repairs, cracks and weeds are intentionally quiet.
      const v = this.seed(u) * 380 - 190;
      const q = this.p(u + 33, v, -48);
      this.line([[q[0] - 17, q[1] - 6], [q[0], q[1] - 2], [q[0] + 7, q[1] + 6], [q[0] + 27, q[1] + 10]], '#9eafa2', 1.5);
      this.grass(q[0] + 8, q[1] + 7, .6);
    }
    for (let i = 0; i < 58; i++) {
      const u = this.seed(i + 40) * 1600 - 800;
      const side = i % 2 ? 1 : -1;
      const q = this.p(u, side * (264 + this.seed(i + 70) * 100), -49);
      this.ellipse(q[0], q[1], 20 + this.seed(i) * 28, 9 + this.seed(i) * 12, i % 3 ? '#c8d7bf' : '#d6dfc7');
      this.grass(q[0], q[1], .6 + this.seed(i) * .6);
      if (i % 11 === 0) this.rock(q[0] + 15, q[1] + 2, .9);
    }
    this.tree(115, 225, 1.07); this.tree(65, 296, .73); this.tree(858, 124, .77);
    this.tree(927, 184, 1.1); this.tree(1025, 211, .7);
    this.roadSign(766, 201);
    this.zombie(202 + Math.sin(this.time * .14) * 6, 468, .75, .2);
    this.zombie(832, 368 + Math.sin(this.time * .16) * 5, .67, 1.2);
    this.zombie(330, 670, .7, 2.2);
  }

  private grass(x: number, y: number, s: number) {
    const sway = Math.sin(this.time * 1.2 + x) * 1.3;
    this.line([[x - 7 * s, y], [x - 11 * s + sway, y - 11 * s]], '#92ac82', 2 * s);
    this.line([[x - 2 * s, y + 1], [x - 2 * s + sway, y - 16 * s]], '#7f9d76', 2 * s);
    this.line([[x + 2 * s, y + 1], [x + 8 * s + sway, y - 9 * s]], '#98b184', 2.5 * s);
  }
  private rock(x: number, y: number, s: number) {
    this.poly([[x - 12 * s, y], [x - 7 * s, y - 10 * s], [x + 7 * s, y - 12 * s], [x + 15 * s, y - 2 * s], [x + 9 * s, y + 5 * s]], '#a9b8a1', '#99aa94', 1);
    this.line([[x - 7 * s, y - 10 * s], [x + 2 * s, y - 4 * s], [x + 15 * s, y - 2 * s]], '#c4ceba', 1);
  }
  private tree(x: number, y: number, s: number) {
    this.ellipse(x + 10 * s, y, 43 * s, 13 * s, '#a5b9a052');
    this.line([[x, y - 1], [x - 2 * s, y - 56 * s]], '#99a48a', 10 * s);
    this.line([[x, y - 26 * s], [x + 24 * s, y - 56 * s]], '#99a48a', 5 * s);
    const blobs = [[-27, -59, 30], [16, -83, 36], [35, -47, 32], [-4, -45, 37], [-18, -91, 27]];
    for (const [dx, dy, r] of blobs) this.ellipse(x + dx * s, y + dy * s, r * s, r * .87 * s, '#9fb892');
    this.ellipse(x - 20 * s, y - 81 * s, 27 * s, 24 * s, '#b1c69c');
    this.ellipse(x + 15 * s, y - 98 * s, 24 * s, 18 * s, '#b6cba2');
    this.ellipse(x + 37 * s, y - 64 * s, 20 * s, 17 * s, '#abc39a');
  }
  private roadSign(x: number, y: number) {
    this.line([[x - 26, y + 42], [x - 26, y - 14]], '#879d8a', 5);
    this.line([[x + 36, y + 49], [x + 36, y - 8]], '#879d8a', 5);
    this.poly([[x - 55, y - 61], [x + 71, y - 44], [x + 71, y + 8], [x - 55, y - 9]], '#628c7a', '#dbe6ce', 3);
    this.ctx.save(); this.ctx.transform(1, .135, 0, 1, x, y);
    this.label('서울  SEOUL', 8, -31, 13, '#edf2df', 700);
    this.label('↑  12 km', 8, -12, 11, '#d9e7cf', 500);
    this.ctx.restore();
    this.grass(x - 30, y + 43, 1.3);
  }

  private zombie(x: number, y: number, s: number, phase: number) {
    const c = this.ctx; c.save(); c.translate(x, y); c.scale(s, s); c.globalAlpha = .72;
    const bob = Math.sin(this.time * 1.3 + phase) * 1.5;
    this.ellipse(2, 2, 17, 6, '#81948332');
    this.line([[-5, -12], [-6 + bob, 0]], '#6e8578', 7);
    this.line([[5, -12], [7 - bob, 0]], '#6e8578', 7);
    this.round(-11, -34 + bob, 22, 24, 7, '#8b9e87');
    this.line([[-10, -27 + bob], [-22, -25 + bob]], '#8b9e87', 7);
    this.line([[9, -26 + bob], [19, -22 + bob]], '#8b9e87', 7);
    this.ellipse(0, -43 + bob, 14, 14, '#a1b58f', '#829881');
    this.poly([[-12, -49 + bob], [-8, -60 + bob], [0, -55 + bob], [8, -57 + bob], [12, -48 + bob]], '#7e9280', '');
    this.ellipse(-5, -43 + bob, 2.3, 2.8, '#516658'); this.ellipse(5, -43 + bob, 2.3, 2.8, '#516658');
    this.line([[-3, -36 + bob], [3, -36 + bob]], '#6e8370', 1.5); c.restore();
  }

  private truck() {
    const { level, left, end, front: deckFront } = this.deckBounds();
    const extra = end - 234;
    // A transparent ground shadow gives the entire home weight.
    this.poly([this.p(-277, -129, -45), this.p(362, -129, -45), this.p(385, deckFront + 35, -45), this.p(-250, deckFront + 35, -45)], '#536a6030', '');
    this.box(-265, -125, -6, 590, 249, 63, '#557770', '#3c6660', '#38625b', '#3c5c55');
    this.box(-254, -124, 31, 486 + extra, 254, 47, '#7ca493', '#77a996', '#5e8c7f', '#476e62');
    // Cargo side panels, luggage hatch, delicate gold line.
    for (let u = -240; u < 225; u += 82) {
      this.poly([this.p(u, 130, 37), this.p(u + 71, 130, 37), this.p(u + 71, 130, 69), this.p(u, 130, 69)], '#84b19c', '#527f6e', 1);
      this.line([this.p(u + 29, 131, 60), this.p(u + 43, 131, 60)], '#c5d4b4', 2.4);
    }
    this.line([this.p(-254, 131, 77), this.p(end, 131, 77)], '#e6c989', 4);
    for (const u of [-182, -104, 150, 300]) this.wheel(u, 135);
    if (level > 1) for (const u of [-230, -80, 80, 215]) this.line([this.p(u, 130, 31), this.p(u, deckFront - 5, 79)], '#8b805f', 9);
    // Deck, with every timber board visible.
    this.box(left, -137, 78, end - left, deckFront + 138, 15, '#e4c28c', '#bc9669', '#caab78', '#927c56');
    this.poly([this.p(left + 1, -136, 94), this.p(end, -136, 94), this.p(end, deckFront, 94), this.p(left + 1, deckFront, 94)], '#e2c595', '#a78b61', 2);
    for (let u = left + 13; u < end; u += 24) this.line([this.p(u, -135, 94), this.p(u, deckFront - 1, 94)], '#bda077', 1);
    for (let v = 141; v < deckFront; v += 36) this.line([this.p(left + 1, v, 94), this.p(end, v, 94)], '#b8996a', 2);
    for (let u = left + 18; u < end; u += 72) for (const v of [-111, deckFront - 23]) {
      const q = this.p(u, v, 94); this.ellipse(q[0], q[1], 1.5, .8, '#aa8d64');
    }
    this.railing(left + 1, -133, end, -133, 94, false);
    this.railing(left + 2, -133, left + 2, deckFront - 2, 94, false);
    this.house();
    this.solar();
    this.waterTank();
    this.cozyCorner();
    this.farm();
    // Tiny lantern and a crate make the deck feel lived in.
    this.box(-96, -93, 94, 35, 28, 28, '#c59a64', '#ae8456', '#bc9461', '#8f754e');
    this.line([this.p(-93, -64, 102), this.p(-63, -64, 116)], '#94734c', 2);
    this.line([this.p(-93, -64, 116), this.p(-63, -64, 102)], '#94734c', 2);
    const dogU = 90 + Math.sin(this.time * .37) * 55;
    const dogV = -14 + Math.cos(this.time * .37) * 15;
    const dog = this.p(dogU, dogV, 95);
    this.dog(dog[0], dog[1], .92, Math.cos(this.time * .37) > 0);
    this.hits.push({kind: 'pet', x: dog[0], y: dog[1] - 15, radius: 29});
    this.cabin();
    // Front edge fencing is purposely low so all farm interactions remain visible.
    this.railing(left + 3, deckFront, -244, deckFront, 94, true);
    this.railing(-206, deckFront, end, deckFront, 94, true);
    this.bunting();
    this.flowerPot(left + 25, deckFront - 21, 95, '#e5a082');
    this.flowerPot(end - 16, deckFront - 16, 95, '#80a896');
    this.ramp();
    if (level >= 2) {
      const q = this.p(70, deckFront - 17, 96);
      this.label(`LIVING DECK · LV.${Math.floor(level)}`, q[0], q[1], 9, '#947a53', 700);
    }
    if (this.action?.kind === 'expand') this.buildingDeck();
    const center = this.p(276, 27, 120);
    this.hits.unshift({kind: 'truck', x: center[0], y: center[1] + 55, radius: 97});
    this.pulse('pet', dog[0], dog[1] - 15, 29);
    this.pulse('truck', center[0], center[1] + 50, 71);
  }

  private wheel(u: number, v: number) {
    const [x, y] = this.p(u, v, -4);
    this.ellipse(x + 1, y - 4, 29, 37, '#374d47', '#2f443f', 2.4);
    this.ellipse(x + 3, y - 4, 23, 30, '#465852', '#64766a', 2);
    this.ellipse(x + 4, y - 4, 12, 17, '#a7b0a0', '#2f4a41', 3);
    this.ellipse(x + 5, y - 4, 5, 7, '#5d7467');
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 3) this.ellipse(x + 4 + Math.cos(a) * 9, y - 4 + Math.sin(a) * 13, 1.5, 2, '#e1dcc4');
    this.line([[x - 21, y - 24], [x - 13, y - 29]], '#6e7d6f', 2);
    this.line([[x - 24, y - 9], [x - 17, y - 13]], '#6e7d6f', 2);
  }

  private cabin() {
    // The cabin is custom shaped, rather than a flat rectangular sprite.
    this.box(230, -126, 28, 127, 252, 94, '#9bc0a5', '#70aa94', '#80b29b', '#456f60');
    this.poly([this.p(235, -125, 123), this.p(316, -125, 161), this.p(368, -109, 125), this.p(368, 124, 125), this.p(316, 126, 161), this.p(235, 126, 123)], '#92bca2', '#517b68', 2);
    this.poly([this.p(316, -127, 161), this.p(367, -110, 124), this.p(367, 124, 124), this.p(316, 127, 161)], '#a8c8ab', '#517b68', 1.8);
    // Wide split front windshield.
    this.poly([this.p(323, -102, 150), this.p(362, -91, 124), this.p(362, 102, 124), this.p(323, 106, 150)], '#3f6e69', '#d8dec2', 3.2);
    this.line([this.p(323, 2, 150), this.p(362, 2, 124)], '#c8d7b9', 3);
    this.poly([this.p(326, -91, 146), this.p(336, -87, 140), this.p(353, 81, 129), this.p(342, 84, 136)], '#8eb7a744', '');
    this.line([this.p(357, 13, 126), this.p(347, 45, 134)], '#294b47', 2);
    this.line([this.p(357, -80, 126), this.p(347, -48, 134)], '#294b47', 2);
    // Driver window and cream stripe.
    this.poly([this.p(246, 128, 114), this.p(311, 128, 149), this.p(343, 128, 123), this.p(343, 128, 95), this.p(246, 128, 79)], '#3d6b64', '#d2d9b9', 2.6);
    this.line([this.p(252, 129, 87), this.p(304, 129, 129)], '#7ca597', 3);
    this.line([this.p(243, 129, 67), this.p(350, 129, 88)], '#e8d5a2', 7);
    this.line([this.p(266, 130, 70), this.p(287, 130, 73)], '#3e6d60', 3);
    this.poly([this.p(357, -126, 27), this.p(368, -126, 93), this.p(368, 126, 93), this.p(357, 126, 27)], '#71a590', '#4c7663', 2);
    this.poly([this.p(368, -68, 47), this.p(369, -68, 76), this.p(369, 68, 76), this.p(368, 68, 47)], '#426c5e', '#bbceb0', 2);
    for (let z = 53; z < 75; z += 7) this.line([this.p(370, -61, z), this.p(370, 61, z)], '#739989', 2);
    for (const v of [-103, 103]) {
      const q = this.p(370, v, 74); this.ellipse(q[0], q[1], 9, 9, '#f9e9b8', '#496e5e', 2);
      this.ellipse(q[0] - 2, q[1] - 2, 4, 4, '#fff6d4');
      const b = this.p(370, v, 49); this.ellipse(b[0], b[1], 5, 3.5, '#e9a666');
    }
    this.box(361, -139, 23, 20, 278, 14, '#d2d1ad', '#9eab92', '#afbba0', '#567765');
    const plate = this.p(383, 0, 28);
    this.ctx.save(); this.ctx.translate(plate[0], plate[1]); this.ctx.rotate(-.59);
    this.round(-22, -7, 44, 13, 3, '#ede8ce', '#6b8570'); this.label('우리집 01', 0, 2, 7, '#546d59'); this.ctx.restore();
    // Mirrors, roof luggage, and a sprig by the window.
    this.line([this.p(323, 129, 110), this.p(333, 154, 118)], '#4a6858', 3);
    const mirror = this.p(333, 154, 118); this.round(mirror[0] - 5, mirror[1] - 10, 11, 19, 4, '#426f63', '#c2cdb0');
    this.box(247, -83, 135, 42, 49, 23, '#d3aa73', '#b58c59', '#c59a68', '#8c7d58');
    this.line([this.p(263, -84, 160), this.p(263, -32, 160)], '#6c7c57', 4);
    this.box(247, 20, 136, 39, 47, 18, '#799181', '#607e6a', '#6b8a74', '#54735e');
  }

  private house() {
    const u = -243, v = -112, w = 149, d = 115, ground = 94, wall = 108;
    this.box(u, v, ground, w, d, wall, '#f5dec0', '#ecd7af', '#dac59c', '#9c8c67');
    for (let z = 110; z < 200; z += 16) this.line([this.p(u, v + d + .5, z), this.p(u + w, v + d + .5, z)], '#d5ba92', 1);
    // Side window, tiny doorstep, and a glowing amber doorway.
    this.poly([this.p(-210, 4, 130), this.p(-163, 4, 130), this.p(-163, 4, 174), this.p(-210, 4, 174)], '#678c7d', '#ac8d60', 6);
    this.poly([this.p(-205, 5, 135), this.p(-168, 5, 135), this.p(-168, 5, 169), this.p(-205, 5, 169)], '#b4ccb2', '#f5e6c6', 2);
    this.line([this.p(-186, 6, 133), this.p(-186, 6, 172)], '#f7e8c8', 3);
    this.line([this.p(-208, 6, 151), this.p(-166, 6, 151)], '#f7e8c8', 3);
    this.box(-215, 3, 124, 58, 12, 9, '#b59f70', '#aa8d60', '#b29465', '#907b55');
    for (let i = 0; i < 5; i++) { const q = this.p(-211 + i * 11, 11, 135); this.sprig(q[0], q[1], .66, i % 2 ? '#e7b88e' : '#df8e76'); }
    this.poly([this.p(-93, -76, 96), this.p(-93, -30, 96), this.p(-93, -30, 172), this.p(-93, -76, 172)], '#698e7d', '#8b815e', 3);
    this.poly([this.p(-92, -68, 137), this.p(-92, -38, 137), this.p(-92, -38, 165), this.p(-92, -68, 165)], '#f3d699', '#cad1ac', 2);
    const knob = this.p(-90, -38, 119); this.ellipse(knob[0], knob[1], 2.5, 2.5, '#e5c889');
    this.box(-94, -84, 95, 20, 64, 6, '#d3b48a', '#b29570', '#b59b71');
    // Gabled terracotta roof: separate lit and shaded slopes.
    this.poly([this.p(-93, -120, 204), this.p(-93, -55, 258), this.p(-93, 14, 204)], '#e3bc8c', '#9a805d', 2);
    this.poly([this.p(-254, -122, 204), this.p(-88, -122, 204), this.p(-88, -55, 258), this.p(-254, -55, 258)], '#ca8761', '#9e6d51', 2.2);
    this.poly([this.p(-254, -55, 258), this.p(-88, -55, 258), this.p(-88, 15, 204), this.p(-254, 15, 204)], '#e0a16f', '#a97855', 2.4);
    for (let r = 1; r <= 4; r++) {
      const rv = -55 + r * 14, rz = 258 - r * 10.8;
      this.line([this.p(-252, rv, rz + 1), this.p(-89, rv, rz + 1)], '#bf835e', 2);
      for (let ru = -247 + (r % 2) * 13; ru < -90; ru += 27) this.line([this.p(ru, rv, rz + 1), this.p(ru, rv - 13, rz + 11)], '#c38a63', 1);
    }
    this.line([this.p(-257, -54, 260), this.p(-85, -54, 260)], '#edba86', 5);
    this.line([this.p(-255, 16, 204), this.p(-87, 16, 204)], '#edbd8c', 6);
    this.box(-209, -85, 232, 27, 25, 50, '#d4c2a2', '#b19f87', '#bdae92', '#8d8d73');
    this.box(-213, -89, 280, 35, 33, 8, '#e0cdae', '#baac91', '#c9b99c', '#8f8e74');
    for (let i = 0; i < 3; i++) {
      const age = (this.time * .24 + i / 3) % 1, s = 5 + age * 11;
      const q = this.p(-195, -73, 292 + age * 54);
      this.ctx.globalAlpha = (1 - age) * .32; this.ellipse(q[0] + Math.sin(age * 4) * 9, q[1], s, s * .7, '#fcf5dc'); this.ctx.globalAlpha = 1;
    }
    const window = this.p(-92, -55, 209); this.ellipse(window[0], window[1], 9, 10, '#708e76', '#e7d3ae', 3);
    this.line([[window[0] - 5, window[1]], [window[0] + 5, window[1]]], '#d7cea8', 1.6);
    this.line([[window[0], window[1] - 6], [window[0], window[1] + 6]], '#d7cea8', 1.6);
    // A small sign on the house.
    const sign = this.p(-129, 6, 185); this.ctx.save(); this.ctx.translate(...sign); this.ctx.rotate(.355);
    this.round(-25, -8, 50, 15, 3, '#f5e8c7', '#aa936b'); this.label('SWEET HOME', 0, 2, 6, '#7d8059', 700); this.ctx.restore();
  }

  private solar() {
    for (let i = 0; i < 2; i++) {
      const u = -45 + i * 59, v = -112;
      this.box(u, v, 95, 52, 68, 8, '#aac3ac', '#657f6c', '#869a83', '#5c7d6b');
      this.poly([this.p(u, v, 123), this.p(u + 52, v, 123), this.p(u + 52, v + 66, 103), this.p(u, v + 66, 103)], '#4e7a85', '#c5d5be', 3);
      for (let col = 1; col < 4; col++) this.line([this.p(u + col * 13, v, 123), this.p(u + col * 13, v + 66, 103)], '#9bbbbb', 1);
      for (let row = 1; row < 4; row++) this.line([this.p(u, v + row * 16.5, 123 - row * 5), this.p(u + 52, v + row * 16.5, 123 - row * 5)], '#9bbbbb', 1);
    }
  }

  private waterTank() {
    const [x, y] = this.p(-206, 88, 94);
    this.ellipse(x + 5, y, 32, 14, '#9b8f6c40');
    this.round(x - 24, y - 62, 48, 56, 9, '#a5c4b3', '#6d9180');
    this.ellipse(x, y - 10, 24, 9, '#a5c4b3', '#6d9180');
    this.ellipse(x, y - 63, 24, 10, '#c5d7ba', '#6d9180');
    this.ellipse(x, y - 67, 8, 3.5, '#87a997', '#6d9180');
    this.line([[x - 23, y - 44], [x - 6, y - 40], [x + 9, y - 40], [x + 23, y - 44]], '#779e8c', 3);
    this.line([[x - 23, y - 23], [x - 6, y - 19], [x + 9, y - 19], [x + 23, y - 23]], '#779e8c', 3);
    this.line([[x + 19, y - 15], [x + 32, y - 11], [x + 32, y - 3]], '#718e7a', 5);
    this.line([[x + 29, y - 19], [x + 35, y - 19]], '#d6aa6a', 3);
    this.ellipse(x + 3, y - 33, 5, 7, '#e6e8cd');
  }

  private cozyCorner() {
    // A knitted rug, wooden chair, crate table and enamel mug.
    this.poly([this.p(83, -111, 96), this.p(205, -111, 96), this.p(205, -28, 96), this.p(83, -28, 96)], '#c9a27f', '#eedcc0', 3);
    this.poly([this.p(91, -104, 96), this.p(197, -104, 96), this.p(197, -35, 96), this.p(91, -35, 96)], '', '#e3c7a4', 2);
    for (let u = 94; u < 199; u += 18) this.line([this.p(u, -107, 96), this.p(u, -111, 96)], '#e9d4b2', 2);
    this.box(98, -98, 96, 43, 37, 24, '#d9b079', '#b3946c', '#c8a374', '#927c5e');
    this.box(96, -100, 117, 47, 39, 7, '#d7b594', '#b89672', '#c19e79', '#927c5e');
    this.box(96, -104, 123, 46, 7, 34, '#d8b183', '#c3a075', '#b48f68', '#947e5a');
    for (let u = 106; u < 138; u += 13) this.line([this.p(u, -96, 126), this.p(u, -96, 151)], '#e5c397', 4);
    this.box(162, -72, 96, 35, 32, 18, '#ccae7e', '#af956c', '#b79a6e', '#98845f');
    const cup = this.p(180, -59, 115); this.round(cup[0] - 4, cup[1] - 9, 8, 10, 2, '#f6e7ca', '#aa9672');
    this.ellipse(cup[0] + 5, cup[1] - 5, 3, 3, '', '#f6e7ca', 2);
    this.flowerPot(191, -99, 96, '#b49e72');
  }

  private farm() {
    const plots = this.state?.plots ?? [{ id: 1, plantedAt: null, watered: false }, { id: 2, plantedAt: null, watered: false }, { id: 3, plantedAt: null, watered: false }];
    const count = Math.min(plots.length, 8);
    for (let i = 0; i < count; i++) {
      const [u, v] = this.plotPosition(i), plot = plots[i];
      this.box(u, v, 95, 69, 68, 10, '#a8845c', '#b99666', '#c5a371', '#987b53');
      this.poly([this.p(u + 6, v + 6, 106), this.p(u + 63, v + 6, 106), this.p(u + 63, v + 62, 106), this.p(u + 6, v + 62, 106)], plot.watered ? '#786b4d' : '#9f8058', '#8c704b', 1);
      for (let j = 0; j < 3; j++) this.line([this.p(u + 11, v + 15 + j * 18, 107), this.p(u + 58, v + 15 + j * 18, 107)], plot.watered ? '#635f44' : '#826d4e', 2);
      for (let k = 0; k < 6; k++) {
        const [x, y] = this.p(u + 17 + (k % 2) * 30, v + 15 + Math.floor(k / 2) * 18, 107);
        if (plot.plantedAt !== null) {
          const progress = this.state ? getCropProgress(this.state, plot) : 0;
          const mature = progress >= 1;
          const s = .35 + progress * .55;
          if (mature) this.poly([[x - 3, y - 2], [x + 4, y - 2], [x + 1, y + 7]], '#e6a05d', '#b87a45', .8);
          this.sprig(x, y - 2, s);
        } else {
          this.ellipse(x, y, 2, 1.2, '#685b3f');
        }
      }
      // Wooden plant label.
      const marker = this.p(u + 63, v + 9, 107); this.line([[marker[0], marker[1]], [marker[0], marker[1] - 14]], '#e5c899', 2);
      this.round(marker[0] - 5, marker[1] - 21, 11, 8, 2, '#eddbb4', '#ab946d');
      const mid = this.p(u + 35, v + 36, 112);
      this.hits.push({kind: 'farm', x: mid[0], y: mid[1], radius: 45});
      this.pulse('farm', mid[0], mid[1], 34);
    }
    // Additional deck space is visibly useful even before its next unlock.
    if (count < 4) {
      const c = this.ctx; c.save(); c.setLineDash([4, 5]);
      this.poly([this.p(133, 42, 95), this.p(202, 42, 95), this.p(202, 110, 95), this.p(133, 110, 95)], '#d1b98840', '#a9946f', 1.5); c.restore();
      const q = this.p(167, 76, 98); this.label('+', q[0], q[1] + 6, 25, '#a1906b', 400);
      this.hits.push({kind: 'truck', x: q[0], y: q[1], radius: 32});
    }
  }

  private sprig(x: number, y: number, s: number, flower?: string) {
    const sway = Math.sin(this.time * 1.3 + x * .05) * 1.3;
    this.line([[x, y + 3], [x + sway, y - 17 * s]], '#668456', 1.8 * s);
    this.poly([[x, y - 4 * s], [x - 11 * s, y - 12 * s], [x - 10 * s, y - 18 * s], [x - 3 * s, y - 16 * s]], '#82a267', '#648553', .6);
    this.poly([[x, y - 7 * s], [x + 3 * s, y - 19 * s], [x + 12 * s, y - 22 * s], [x + 10 * s, y - 12 * s]], '#9ab475', '#728b57', .6);
    this.poly([[x, y - 10 * s], [x - 5 * s, y - 23 * s], [x, y - 29 * s], [x + 4 * s, y - 18 * s]], '#a0bd7c', '#758e5e', .6);
    if (flower) {
      for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5; this.ellipse(x + Math.cos(a) * 4 * s, y - 24 * s + Math.sin(a) * 4 * s, 3.7 * s, 3.7 * s, flower); }
      this.ellipse(x, y - 24 * s, 2.3 * s, 2.3 * s, '#f4da9c');
    }
  }

  private flowerPot(u: number, v: number, z: number, color: string) {
    const [x, y] = this.p(u, v, z);
    this.poly([[x - 11, y - 19], [x + 11, y - 19], [x + 8, y], [x - 8, y]], color, '#8b8865', 1.3);
    this.ellipse(x, y - 19, 12, 5, color, '#8b8865');
    this.ellipse(x, y - 19, 8, 3, '#8f7855');
    this.sprig(x - 3, y - 18, .87, '#edc184'); this.sprig(x + 4, y - 17, .63, '#e6a38b');
  }

  private railing(u: number, v: number, endU: number, endV: number, z: number, front: boolean) {
    const dist = Math.hypot(endU - u, endV - v), n = Math.ceil(dist / 76), high = front ? 26 : 39;
    for (let i = 0; i <= n; i++) {
      const pu = u + (endU - u) * i / n, pv = v + (endV - v) * i / n;
      this.line([this.p(pu, pv, z), this.p(pu, pv, z + high)], '#ad946c', 5);
      const q = this.p(pu, pv, z + high); this.ellipse(q[0], q[1], 3.5, 2, '#e7cea0');
    }
    this.line([this.p(u, v, z + high - 5), this.p(endU, endV, z + high - 5)], '#b49b73', 4);
    this.line([this.p(u, v, z + high - 4), this.p(endU, endV, z + high - 4)], '#e0c89d', 1.4);
  }

  private bunting() {
    const a = this.p(-271, -127, 224), b = this.p(228, -127, 186);
    this.line([this.p(228, -127, 93), b], '#a58f67', 4);
    const c = this.ctx; c.beginPath(); c.moveTo(...a); c.quadraticCurveTo((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 42, ...b);
    c.strokeStyle = '#7a8563'; c.lineWidth = 1.5; c.stroke();
    const colors = ['#dd9a77', '#e2c488', '#85a990', '#d7bba3', '#80a9a0'];
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
    drawHero(this.ctx, { x, y, scale: .81, gender: this.state?.gender ?? 'female', pose: hero.pose, facing: hero.facing, time: this.reducedMotion && !this.action ? 0 : this.time, progress });
    this.hits.push({ kind: 'character', x, y: y - 47, radius: 39 });
    this.pulse('character', x, y - 47, 42);
    if (this.action && hero.pose !== 'walk') {
      const labels: Record<SceneAction, string> = { plant: '씨앗을 톡톡', water: '물을 듬뿍', harvest: '당근 수확!', chop: '나무를 차곡차곡', expand: '우리 집을 넓혀요', gather: '쓸 만한 재료 발견!' };
      const label = labels[this.action.kind];
      this.round(x - 58, y - 132, 116, 23, 11, '#fffae8e8', '#bda982');
      this.label(label, x, y - 117, 10, '#526750', 700);
    }
  }

  private ramp() {
    const [tx, ty] = this.rampTop(), [bx, by] = this.rampBottom();
    this.poly([[tx - 16, ty], [tx + 16, ty + 8], [bx + 16, by + 8], [bx - 16, by]], '#c7a577', '#927d5b', 2);
    for (let i = 0; i <= 11; i++) {
      const t = i / 11, x = tx + (bx - tx) * t, y = ty + (by - ty) * t;
      this.line([[x - 15, y], [x + 15, y + 8]], '#e3c69a', 4);
      if (i % 3 === 0) for (const dx of [-17, 17]) this.line([[x + dx, y + 4], [x + dx, y - 18]], '#a8906b', 3);
    }
    for (const dx of [-17, 17]) this.line([[tx + dx, ty - 19], [bx + dx, by - 15]], '#b29b74', 3);
    // The footpath leads directly to the accessible logging grove.
    this.ctx.save(); this.ctx.setLineDash([5, 9]);
    this.line([[bx, by + 9], [157, 552], [151, 571], [130, 590]], '#e4d3a1', 3); this.ctx.restore();
  }

  private loggingGrove() {
    const c = this.ctx;
    this.ellipse(97, 594, 102, 44, '#b0c399');
    this.ellipse(111, 596, 76, 30, '#c8d2a7');
    this.tree(37, 570, .87); this.tree(45, 609, .57);
    this.grass(16, 625, 1.5); this.grass(180, 608, 1.4);
    this.rock(182, 574, .75);
    const cut = this.time - this.treeCutAt;
    const falling = cut >= 0 && cut < .8, stump = cut >= .8 && cut < 15;
    const work = this.action?.kind === 'chop' ? this.actionProgress() : 0;
    this.ellipse(96, 607, 30, 10, '#708a6540');
    // Keep a stump visible while the felled tree is being turned into timber.
    this.round(87, 590, 19, 20, 4, '#ac875b', '#7f7450');
    this.ellipse(96.5, 590, 10, 5, '#d5b17e', '#8e7855');
    this.ellipse(96.5, 590, 5, 2.5, '', '#b49364');
    if (!stump) {
      c.save(); c.translate(97, 592);
      const swing = falling ? -this.ease(cut / .8) * 1.42 : work > .03 ? Math.sin(work * Math.PI * 24) * .02 : Math.sin(this.time * .7) * .006;
      c.rotate(swing);
      this.line([[0, 4], [0, -93]], '#8f7751', 16);
      this.line([[0, -49], [-24, -79]], '#8f7751', 7);
      this.line([[0, -63], [22, -99]], '#8f7751', 6);
      this.line([[-4, -9], [-3, -75]], '#c5a471', 3);
      for (const [x, y, rx, ry, color] of [[-28, -92, 35, 27, '#81a06c'], [17, -114, 39, 34, '#92b177'], [35, -78, 30, 27, '#88a76e'], [-6, -67, 37, 26, '#94ae78'], [-16, -126, 31, 25, '#b0c58b']] as [number, number, number, number, string][]) this.ellipse(x, y, rx, ry, color, '#709362', 1.1);
      this.ellipse(16, -133, 21, 15, '#bed093');
      this.line([[-20, -82], [-9, -86]], '#c1d295', 2); this.line([[22, -103], [33, -109]], '#c1d295', 2);
      c.restore();
    }
    // Neatly stacked logs and an axe identify this as a real work area.
    for (let i = 0; i < 4; i++) {
      const x = 178 + (i % 2) * 13, y = 624 - Math.floor(i / 2) * 11;
      this.line([[x - 35, y - 11], [x, y]], '#a38359', 11);
      this.ellipse(x, y, 6, 6, '#dabb82', '#8d7954');
      this.ellipse(x, y, 3, 3, '', '#b29160', 1);
    }
    this.line([[69, 629], [69, 649]], '#9b855d', 4);
    this.line([[134, 629], [134, 649]], '#9b855d', 4);
    this.round(48, 622, 108, 30, 7, '#f4e4b7', '#a88f62');
    this.label('작은 벌목장', 102, 642, 13, '#5d7450', 800);
    this.hits.push({kind: 'grove', x: 98, y: 554, radius: 86});
    this.hits.push({kind: 'grove', x: 101, y: 636, radius: 44});
    this.pulse('grove', 100, 588, 74);
    if (this.zone === 'grove' && !this.action) {
      this.round(16, 421, 182, 30, 12, '#fff9e7f0', '#bcaa7a');
      this.label('나무를 눌러 벌목을 시작해요', 107, 441, 11, '#56724b', 700);
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
        const sx = hx + 28, sy = hy - 37;
        this.ellipse(sx + (target[0] - sx + (i % 3 - 1) * 13) * t, sy + (target[1] - sy + Math.floor(i / 3) * 5) * t - Math.sin(t * Math.PI) * 19, 2, 1.2, '#eed29a', '#957044', .7);
      }
      if (progress > .7) for (let i = 0; i < 3; i++) this.sprig(target[0] - 14 + i * 14, target[1], (progress - .7) * .9);
    } else if (action.kind === 'water') {
      for (let i = 0; i < 18; i++) {
        const t = (progress * 4 + i * .071) % 1, spread = (i % 5 - 2) * 5;
        const sx = hx + 38, sy = hy - 27;
        const x = sx + (target[0] - sx + spread) * t, y = sy + (target[1] - sy) * t + t * t * 4;
        this.line([[x, y], [x - 1.6, y - 4]], '#8dcde6', 1.8);
      }
      c.globalAlpha = progress * .3; this.ellipse(...target, 27, 11, '#4a9eb2'); c.globalAlpha = 1;
    } else if (action.kind === 'harvest') {
      for (let i = 0; i < 3; i++) {
        const t = Math.max(0, Math.min(1, (progress - i * .19) * 2));
        const x = target[0] + i * 8 - 8 + (hx + 25 - target[0]) * t, y = target[1] - Math.sin(t * Math.PI) * 41 + (hy - 15 - target[1]) * t;
        c.save(); c.translate(x, y); c.rotate(t * 2 + i * .4);
        this.poly([[-4, -6], [4, -6], [0, 10]], '#eeaa59', '#b77b43', 1);
        this.line([[0, -5], [-5, -14]], '#79a05e', 3); this.line([[0, -5], [3, -15]], '#93b66d', 3); c.restore();
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
      this.round(hx - 25, hy - 57, 18, 16, 3, '#d6b17a', '#a1875c');
      this.line([[hx - 25, hy - 49], [hx - 7, hy - 49]], '#f2d598', 2);
    } else if (action.kind === 'expand' && progress < .83) {
      c.save(); c.translate(hx + 25, hy - 37); c.rotate(-.8 + Math.sin(progress * Math.PI * 10) * .9);
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
    const c = this.ctx; c.save(); c.translate(x, y); c.scale(right ? s : -s, s);
    const bob = Math.sin(this.time * 6) * 1.3;
    this.ellipse(0, 0, 22, 6, '#897f5940');
    for (const [dx, phase] of [[-11, 0], [6, 1.7], [-4, 3], [13, 4]]) this.line([[dx, -12 + bob], [dx + Math.sin(this.time * 6 + phase) * 2, -1]], '#b88654', 5);
    this.ellipse(-3, -17 + bob, 20, 13, '#d7a468', '#a48655');
    this.ellipse(-1, -12 + bob, 14, 7, '#f0d8a9');
    // The unmistakable curled Shiba tail.
    c.beginPath(); c.arc(-23, -24 + bob, 8, -.2, Math.PI * 1.65); c.strokeStyle = '#a48655'; c.lineWidth = 9; c.stroke();
    c.beginPath(); c.arc(-23, -24 + bob, 8, -.2, Math.PI * 1.65); c.strokeStyle = '#e8bb7e'; c.lineWidth = 6; c.stroke();
    this.ellipse(15, -28 + bob, 15, 14, '#dfac6d', '#a48655');
    this.poly([[3, -36 + bob], [4, -50 + bob], [15, -40 + bob]], '#d6a064', '#a48655', 1.3);
    this.poly([[19, -40 + bob], [30, -47 + bob], [29, -32 + bob]], '#d6a064', '#a48655', 1.3);
    this.poly([[6, -39 + bob], [6, -46 + bob], [12, -40 + bob]], '#e6c6a0', '');
    this.poly([[22, -39 + bob], [28, -43 + bob], [27, -36 + bob]], '#e6c6a0', '');
    this.ellipse(20, -22 + bob, 11, 8, '#f4dfb7');
    this.ellipse(10, -30 + bob, 2, 2.5, '#4c5141'); this.ellipse(24, -29 + bob, 2, 2.5, '#4c5141');
    this.ellipse(22, -23 + bob, 2.8, 2, '#53513f');
    this.line([[18, -16 + bob], [22, -15 + bob], [26, -17 + bob]], '#a88458', 1);
    this.line([[7, -15 + bob], [20, -13 + bob]], '#699b88', 4);
    this.ellipse(18, -11 + bob, 2.5, 3, '#e2c07c'); c.restore();
  }

  private pulse(kind: string, x: number, y: number, radius: number) {
    if (this.focused !== kind || performance.now() > this.focusedUntil) return;
    const c = this.ctx; c.save(); c.globalAlpha = .55 + Math.sin(this.time * 5) * .25; c.setLineDash([4, 6]);
    c.beginPath(); c.ellipse(x, y, radius, radius * .62, 0, 0, Math.PI * 2); c.strokeStyle = '#fff4bd'; c.lineWidth = 3; c.stroke(); c.restore();
  }
  private foreground() {
    this.tree(-46, 731, 1.02); this.tree(956, 695, 1.27);
    this.grass(167, 631, 1.4); this.grass(867, 720, 1.5);
    this.rock(172, 695, 1.2); this.rock(990, 562, 1.1);
    for (let i = 0; i < 8; i++) {
      const x = 130 + this.seed(i + 31) * 760, y = 702 + this.seed(i + 9) * 100;
      this.sprig(x, y, .6, i % 2 ? '#e1bf7f' : '#e9d9b2');
    }
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
