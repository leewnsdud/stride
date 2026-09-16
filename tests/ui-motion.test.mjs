import test from 'node:test';
import assert from 'node:assert/strict';
import {trackInputModality, allowUiMotion, reveal} from '../src/ui-motion.mjs';

test('pointer-only motion honors reduced motion and removes its listeners', () => {
  const oldDocument = globalThis.document, oldWindow = globalThis.window;
  const listeners = new Map();
  let reduced = false;
  globalThis.document = {documentElement:{dataset:{}},addEventListener:(key,fn)=>listeners.set(key,fn),removeEventListener:(key)=>listeners.delete(key)};
  globalThis.window = {matchMedia:()=>({matches:reduced})};
  try {
    const dispose = trackInputModality();
    listeners.get('keydown')();
    assert.equal(allowUiMotion(),false);
    listeners.get('pointerdown')();
    assert.equal(allowUiMotion(),true);
    reduced = true;
    assert.equal(allowUiMotion(),false);
    dispose();
    assert.equal(listeners.size,0);
  } finally {globalThis.document=oldDocument;globalThis.window=oldWindow;}
});

test('repeated navigation resumes the current presentation and cancels stale motion', () => {
  const original = {document:globalThis.document,window:globalThis.window,getComputedStyle:globalThis.getComputedStyle};
  const listeners = new Map();
  globalThis.document = {documentElement:{dataset:{}},addEventListener:(key,fn)=>listeners.set(key,fn),removeEventListener:()=>{}};
  globalThis.window = {matchMedia:()=>({matches:false})};
  globalThis.getComputedStyle = ()=>({opacity:'.72',transform:'matrix(1, 0, 0, 1, 3, 0)'});
  let cancelled=0, frames;
  const element={getAnimations:()=>[{cancel:()=>cancelled++}],animate:(values)=>{frames=values;}};
  try {
    trackInputModality(); listeners.get('pointerdown')();
    reveal(element);
    assert.equal(cancelled,1);
    assert.deepEqual(frames[0],{opacity:'.72',transform:'matrix(1, 0, 0, 1, 3, 0)'});
    frames=undefined; listeners.get('keydown')(); reveal(element);
    assert.equal(cancelled,2);
    assert.equal(frames,undefined);
  } finally {Object.assign(globalThis,original);}
});
