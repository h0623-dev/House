import test from 'node:test';
import assert from 'node:assert/strict';
import { alignArtContext, DECK_ART_SLOPES, getAlignedArtTransform, type AlignedArtTransform } from '../src/layout-art-projection.ts';
import { projectTruckPoint } from '../src/truck-layout.ts';
import type { LayoutDirection } from '../src/layout-direction.ts';

type Point = [number, number];
/** Independently measured atlas foundation edges and the allocated drawing boxes. */
const measured = [
  { name: 'workshop', width: 490, height: 450, positive: [257,98], negative: [204,-93] },
  { name: 'kitchen', width: 457, height: 459, positive: [219,68], negative: [210,-76] },
  { name: 'waterworks', width: 459, height: 430, positive: [214,89], negative: [216,-85] },
  { name: 'greenhouse', width: 491, height: 444, positive: [232,93], negative: [226,-96] },
  { name: 'watchtower', width: 442, height: 492, positive: [220,82], negative: [195,-92] },
  { name: 'petHouse', width: 472, height: 390, positive: [205,103], negative: [221,-96] },
  // The cottage is fitted nonuniformly from its 374×498 frame into 122×143.
  { name: 'home', width: 122, height: 143,
    positive: [136*122/374,49*143/498], negative: [85*122/374,-44*143/498] },
];
const origin = projectTruckPoint([0,0]);
const deckU = projectTruckPoint([1,0]).map((value,index) => value-origin[index]) as Point;
const deckV = projectTruckPoint([0,1]).map((value,index) => value-origin[index]) as Point;
const apply = (matrix: AlignedArtTransform, point: readonly number[]): Point =>
  [point[0]*matrix.xScale, point[0]*matrix.yShear+point[1]*matrix.yScale];
const cross = (a:Point,b:Point) => a[0]*b[1]-a[1]*b[0];
const dot = (a:Point,b:Point) => a[0]*b[0]+a[1]*b[1];

test('all measured house and facility foundations align with actual deck axes in both facings', () => {
  assert.ok(Math.abs(DECK_ART_SLOPES.u-deckU[1]/deckU[0])<1e-12);
  assert.ok(Math.abs(DECK_ART_SLOPES.v-deckV[1]/deckV[0])<1e-12);
  for (const art of measured) for (const direction of [0,1] as LayoutDirection[]) {
    const matrix = getAlignedArtTransform(art.width,art.height,
      art.positive[1]/art.positive[0],art.negative[1]/art.negative[0],direction);
    const positive = apply(matrix,art.positive), negative = apply(matrix,art.negative);
    const positiveAxis = direction===0 ? deckU : deckV, negativeAxis = direction===0 ? deckV : deckU;
    assert.ok(Math.abs(cross(positive,positiveAxis))<1e-9,`${art.name}/${direction}: front edge follows deck`);
    assert.ok(Math.abs(cross(negative,negativeAxis))<1e-9,`${art.name}/${direction}: adjacent edge follows deck`);
    assert.ok(dot(positive,positiveAxis)>0,`${art.name}/${direction}: first edge faces the intended axis`);
    assert.ok(dot(negative,negativeAxis)<0,`${art.name}/${direction}: adjacent edge reverses the other axis`);
    assert.equal(Math.sign(matrix.xScale),direction===0?1:-1,`${art.name}: opposite facing is visually distinct`);
  }
});

test('fitting keeps roofs within their allocated height and vertical walls upright in both facings', () => {
  for (const art of measured) for (const direction of [0,1] as LayoutDirection[]) {
    const matrix = getAlignedArtTransform(art.width,art.height,
      art.positive[1]/art.positive[0],art.negative[1]/art.negative[0],direction);
    assert.ok(Number.isFinite(matrix.xScale)&&Number.isFinite(matrix.yShear)&&Number.isFinite(matrix.yScale));
    assert.ok(matrix.yScale>0&&Math.abs(matrix.xScale)>0&&Math.abs(matrix.xScale)<=1);
    const leftTop = apply(matrix,[-art.width/2,-art.height]), rightTop = apply(matrix,[art.width/2,-art.height]);
    for (const corner of [leftTop,rightTop]) {
      assert.ok(Math.abs(corner[0])<=art.width/2+1e-9,`${art.name}/${direction}: roof remains within width`);
      assert.ok(corner[1]>=-art.height-1e-9,`${art.name}/${direction}: roof stays inside the allocated top edge`);
    }
    const wallBottom = apply(matrix,[art.width*.23,-art.height*.1]);
    const wallTop = apply(matrix,[art.width*.23,-art.height*.7]);
    assert.equal(wallBottom[0],wallTop[0],`${art.name}/${direction}: wall has no horizontal tilt`);
    assert.ok(wallTop[1]<wallBottom[1],`${art.name}/${direction}: upright walls retain top/bottom order`);
  }
});

test('Canvas placement anchors the aligned drawing and introduces no sideways component on vertical walls', () => {
  for (const direction of [0,1] as LayoutDirection[]) {
    const calls: { name:string; values:number[] }[] = [];
    const context = {
      translate: (...values:number[]) => { calls.push({name:'translate',values}); },
      transform: (...values:number[]) => { calls.push({name:'transform',values}); },
    } as unknown as CanvasRenderingContext2D;
    alignArtContext(context,640,215,490,450,98/257,-93/204,direction);
    assert.deepEqual(calls.map(call=>call.name),['translate','transform']);
    assert.deepEqual(calls[0].values,[640,215]);
    const [a,b,c,d,e,f] = calls[1].values;
    assert.equal(c,0,'vertical image vectors have zero horizontal displacement');
    assert.equal(e,0); assert.equal(f,0,'the caller-controlled foundation anchor remains fixed');
    assert.ok(d>0&&Number.isFinite(b)&&Math.sign(a)===(direction===0?1:-1));
  }
});
