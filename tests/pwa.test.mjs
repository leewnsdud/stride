import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const script = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
function worker(fetch) {
  const events = {}, added = [], deleted = [];
  const offline = new Response('offline');
  vm.runInNewContext(script, {
    URL, Response, fetch,
    self: { location: {origin:'https://stride.example'}, addEventListener: (type, fn) => events[type] = fn, skipWaiting: async () => {}, clients: {claim: async () => {}} },
    caches: {open: async () => ({addAll: async urls => added.push(...urls)}), match: async () => offline, keys: async () => ['stride-offline-v0','stride-offline-v1','stride-offline-v2','stride-offline-v3','unrelated-cache'], delete: async key => deleted.push(key)},
  });
  const dispatch = request => { let response; events.fetch({request,respondWith: value => response = value}); return response; };
  return {events,dispatch,added,deleted,offline};
}
test('install metadata and PNGs describe a standalone app', () => {
  const manifest = JSON.parse(readFileSync(new URL('../public/manifest.webmanifest',import.meta.url),'utf8'));
  assert.equal(manifest.display,'standalone');
  assert.equal(manifest.start_url,'/');
  assert.equal(manifest.id,'/');
  for (const size of [180,192,512]) {
    const png = readFileSync(new URL(`../public/icons/stride-v3-${size}.png`,import.meta.url));
    assert.equal(png.readUInt32BE(16),size);
    assert.equal(png.readUInt32BE(20),size);
  }
});
test('offline install caches only generic resources and owns only its cache versions', async () => {
  const w = worker(); let job;
  w.events.install({waitUntil:p=>job=p}); await job;
  assert.deepEqual(w.added,['/offline.html','/icons/stride-192.png']);
  w.events.activate({waitUntil:p=>job=p}); await job;
  assert.deepEqual(w.deleted,['stride-offline-v0','stride-offline-v1','stride-offline-v2']);
});
test('API, mutations, third-party requests and bundles are never intercepted', () => {
  const w = worker(() => {throw Error('must not fetch')});
  for (const request of [
    {url:'https://stride.example/api/state',method:'GET',mode:'navigate'},
    {url:'https://stride.example/api/coach',method:'POST'},
    {url:'https://other.example/',method:'GET',mode:'navigate'},
    {url:'https://stride.example/assets/main.js',method:'GET',mode:'cors'},
  ]) assert.equal(w.dispatch(request),undefined);
});
test('fresh navigation preserves authorization errors and falls back only for disconnect/server failure', async () => {
  const request = {url:'https://stride.example/',method:'GET',mode:'navigate'};
  for(const status of [200,403]) {
    const response = new Response('network',{status});
    const w = worker(async () => response);
    assert.equal(await w.dispatch(request),response);
  }
  for(const fetch of [async()=>{throw Error('offline')},async()=>new Response('unavailable',{status:503})]) {
    const w = worker(fetch);
    assert.equal(await w.dispatch(request),w.offline);
  }
});
