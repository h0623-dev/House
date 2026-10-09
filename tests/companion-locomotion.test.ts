import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleCompanionGait, COMPANION_STRIDE } from '../src/companion-locomotion.ts';
import { UNIT_IDS } from '../src/units.ts';

const close=(actual:number,expected:number):void=>assert.ok(Math.abs(actual-expected)<1e-9,`${actual} ≠ ${expected}`);

test('grounded paws cancel actual body travel on horizontal and sloping paths at village scale',()=>{
  for(const id of ['dog','cat'] as const)for(const scale of [.73,.78,1])for(const heading of [0,.45,-.8,Math.PI]){
    const distance=COMPANION_STRIDE[id]*scale*.12,delta=.7;
    const a=sampleCompanionGait(id,{distance,speed:20,heading,blend:1},scale);
    const b=sampleCompanionGait(id,{distance:distance+delta,speed:20,heading,blend:1},scale);
    for(const name of ['frontNear','hindFar'] as const){
      assert.equal(a.paws[name].planted,true);assert.equal(b.paws[name].planted,true);
      close(a.paws[name].lift,0);close(b.paws[name].lift,0);
      const localDelta=(b.paws[name].along-a.paws[name].along)*scale;
      close(delta*Math.cos(heading)+localDelta*Math.cos(heading),0);
      close(delta*Math.sin(heading)+localDelta*Math.sin(heading),0);
    }
  }
});

test('opposite diagonal legs share contact while the other diagonal performs a continuous lifted swing',()=>{
  for(const id of ['dog','cat'] as const){
    const distance=COMPANION_STRIDE[id]*.32;
    const sample=sampleCompanionGait(id,{distance,speed:20,heading:0});
    assert.deepEqual(sample.paws.frontNear,sample.paws.hindFar);
    assert.deepEqual(sample.paws.frontFar,sample.paws.hindNear);
    assert.equal(sample.paws.frontNear.planted,true);
    assert.equal(sample.paws.frontFar.planted,false);
    assert.ok(sample.paws.frontFar.lift>3);
    const before=sampleCompanionGait(id,{distance:COMPANION_STRIDE[id]*(.64-1e-6),speed:20,heading:0});
    const after=sampleCompanionGait(id,{distance:COMPANION_STRIDE[id]*(.64+1e-6),speed:20,heading:0});
    assert.ok(Math.abs(before.paws.frontNear.along-after.paws.frontNear.along)<.0001);
    assert.ok(after.paws.frontNear.lift<1e-8,'toe lift starts without an abrupt jump');
  }
});

test('stride depends on distance and scale, with stopped and reduced-motion feet settling without extra steps',()=>{
  for(const id of UNIT_IDS){
    const half=sampleCompanionGait(id,{distance:COMPANION_STRIDE[id]*.5*.73,speed:20,heading:1},.73);
    close(half.phase,.5);
    const slow=sampleCompanionGait(id,{distance:7,speed:1,heading:0});
    const fast=sampleCompanionGait(id,{distance:7,speed:35,heading:0});
    close(slow.phase,fast.phase);
    const stopped=sampleCompanionGait(id,{distance:7,speed:0,heading:0});
    const reduced=sampleCompanionGait(id,{distance:7,speed:35,heading:0,blend:1,reducedMotion:true});
    for(const sample of [stopped,reduced]){
      assert.equal(sample.strength,0);close(sample.bodyY,0);
      for(const paw of Object.values(sample.paws)){close(paw.along,0);close(paw.lift,0);assert.equal(paw.planted,true);}
    }
  }
});

test('all six locomotion samples remain finite for an absent or malformed movement measurement',()=>{
  for(const id of UNIT_IDS){
    const sample=sampleCompanionGait(id,{distance:NaN,speed:Infinity,heading:NaN,blend:NaN},0);
    for(const value of [sample.phase,sample.stride,sample.strength,sample.heading,sample.bodyY,sample.bodyRoll,sample.headTilt,sample.tailTilt])assert.ok(Number.isFinite(value));
    for(const paw of Object.values(sample.paws))for(const value of [paw.phase,paw.along,paw.lift])assert.ok(Number.isFinite(value));
  }
});
