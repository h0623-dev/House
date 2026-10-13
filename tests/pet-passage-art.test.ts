import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { createGame } from '../src/game';
import { getPetPassageGeometry } from '../src/pet-passage';
import { getPetPassageLink } from '../src/scene-navigation';
type Point = [number, number];
const distance = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const midpoint = (a: Point, b: Point): Point => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

test('actual ramp canvas geometry paints an active old lease before the current gate without changing feet or adding a second interaction', async () => {
  const priorImage = globalThis.Image;
  const hook = registerHooks({ load(url, context, next) {
    if (/\.(png|webp|jpg|svg)$/.test(url)) return { format: 'module', source: `export default ${JSON.stringify(url)};`, shortCircuit: true };
    return next(url, context);
  } });
  globalThis.Image = class { complete = false; naturalWidth = 0 } as unknown as typeof Image;
  let drawPetPassage: typeof import('../src/pet-passage-art').drawPetPassage;
  let Scene: typeof import('../src/scene').Scene;
  try {
    ({ drawPetPassage } = await import('../src/pet-passage-art'));
    ({ Scene } = await import('../src/scene'));
  } finally { hook.deregister(); globalThis.Image = priorImage; }
  let points: Point[] = [], closed = false;
  const wood: Point[][] = [], caps: Point[] = [];
  const c = { fillStyle: '', save() {}, restore() {}, stroke() {}, clip() {},
    ellipse(x:number,y:number,rx:number,ry:number) { if(rx===38&&ry===38)caps.push([x,y]); }, roundRect() {}, fillText() {},
    beginPath() { points = []; closed = false; }, moveTo(x: number, y: number) { points.push([x, y]); },
    lineTo(x: number, y: number) { points.push([x, y]); }, closePath() { closed = true; },
    fill() { if (closed && this.fillStyle === '#b38b57') wood.push(points.map(point => [...point])); },
  } as unknown as CanvasRenderingContext2D;
  const old = getPetPassageLink(1), retained = structuredClone(old), current = getPetPassageGeometry(8);
  const art = drawPetPassage(c, 8, true, { points: old.points });
  assert.deepEqual(old, retained, 'painting cannot alter leased navigation coordinates');
  assert.deepEqual(art.geometry.points, old.points); assert.equal(art.painted, false, 'the test stubs image loading rather than claiming decoded screenshots');
  const reversed = [...old.points].reverse();
  assert.equal(wood.length, old.points.length - 1);
  assert.deepEqual(caps, [...old.points].reverse().slice(1,-1), 'actual canvas commands support the full 38px turn circle at every retained bend');
  for (let index = 0; index < wood.length; index++) {
    const quad = wood[index];
    assert.ok(distance(midpoint(quad[0], quad[1]), reversed[index]) < 1e-7);
    assert.ok(distance(midpoint(quad[2], quad[3]), reversed[index + 1]) < 1e-7);
    assert.ok(Math.abs(distance(quad[0], quad[1]) - 76) < 1e-7, 'the actual painted landing keeps full body width');
  }
  assert.ok(distance(art.geometry.entry, current.entry) > 90, 'the override really retains the old expanded-edge displacement');
  const state = createGame(); state.deckLevel = 8;
  const halfway: Point = midpoint(old.points[0], old.points[1]);
  const dog = { id: 'dog', location: { surface: 'ramp', floor: 1, link: old.id, point: halfway }, passageLease: old };
  const stale = { id: 'cat', location: { surface: 'deck', floor: 1, point: current.entry }, passageLease: old };
  const scene = Object.assign(Object.create(Scene!.prototype), { state, ctx: c, petMotion: new Map([['dog', dog], ['cat', stale]]),
    petPassageLeasedPaint: [], petPassagePaint: { drawn: false, painted: false }, hits: [], scale: .35, dx: 10, dy: 20,
    activeFloor: 1, action: null, constructionMode: null, planningMode: null, suspended: false, disposed: false,
    petGateClosing: false, petGatePendingOpen: null, canvas: { dataset: {} } }) as {
      petPassage(): void; getPetPassageSceneState(): { leasedPaths: { owners: string[]; points: Point[]; drawn: boolean }[]; gate: { worldPoint: Point }; gateBounds: number[] };
      hits: { kind: string; x: number; y: number }[]; petMotion: Map<string, typeof dog | typeof stale>;
    };
  const before = structuredClone({ state, dog, stale }); wood.length = 0; caps.length = 0;
  scene.petPassage(); const detail = scene.getPetPassageSceneState();
  assert.equal(wood.length, old.points.length + current.points.length - 2, 'one active old walkway is painted first, then the current walkway');
  assert.deepEqual(detail.leasedPaths.map(path => path.owners), [['dog']]);
  assert.deepEqual(detail.leasedPaths[0].points, old.points); assert.equal(detail.leasedPaths[0].drawn, true);
  assert.equal(scene.hits.length, 1); assert.equal(scene.hits[0].kind, 'pet-gate');
  assert.deepEqual(detail.gate.worldPoint, [current.hinge[0], current.hinge[1] - 16]);
  assert.ok(detail.gateBounds[2] - detail.gateBounds[0] >= 48); assert.ok(detail.gateBounds[3] - detail.gateBounds[1] >= 48);
  assert.deepEqual({ state, dog, stale }, before, 'rendering never moves a companion or changes saved growth');
  scene.petMotion.delete('dog');
  assert.deepEqual(scene.getPetPassageSceneState().leasedPaths, [], 'the old walkway disappears when its last real crossing finishes');
});
