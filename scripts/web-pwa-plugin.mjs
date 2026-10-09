import { createHash } from 'node:crypto';
import { readFile, writeFile, readdir, rm } from 'node:fs/promises';
import path from 'node:path';

const hash = data => createHash('sha256').update(data).digest('hex');
const normalizeBase = base => `/${String(base).replace(/^\/+|\/+$/g, '')}/`.replace(/^\/\/$/, '/');

async function listFiles(folder, prefix = '') {
  const result = [];
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const name = prefix + entry.name;
    if (entry.isDirectory()) result.push(...await listFiles(path.join(folder, entry.name), name + '/'));
    else if (entry.isFile() && !['sw.js', 'web-update.json'].includes(name)) result.push(name);
  }
  return result.sort();
}

/** Reusable by the release verifier and valid future-build browser fixtures. */
export async function createPwaRelease(outDir, { version, contentVersion, base = '/House/' }) {
  if (!/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(version) || !Number.isSafeInteger(contentVersion) || contentVersion < 1) throw Error('Invalid PWA release version');
  base = normalizeBase(base);
  const indexPath = path.join(outDir, 'index.html');
  let index = (await readFile(indexPath, 'utf8')).replace(/<meta\s+name="road-haven-(?:build|version)"[^>]*>/g, '');
  await writeFile(indexPath, index);
  const files = [];
  for (const name of await listFiles(outDir)) {
    const bytes = await readFile(path.join(outDir, name));
    files.push({ path: name, bytes: bytes.length, sha256: hash(bytes) });
  }
  const buildId = hash(JSON.stringify({ version, contentVersion, base, files }));
  index = index.replace('</head>', `<meta name="road-haven-build" content="${buildId}"><meta name="road-haven-version" content="${version}"></head>`);
  await writeFile(indexPath, index);
  const indexEntry = files.find(file => file.path === 'index.html');
  indexEntry.bytes = Buffer.byteLength(index);
  indexEntry.sha256 = hash(index);
  const manifest = { schema: 1, buildId, version, contentVersion, base, files };
  await writeFile(path.join(outDir, 'web-update.json'), JSON.stringify(manifest, null, 2) + '\n');
  await writeFile(path.join(outDir, 'sw.js'), generateServiceWorker(manifest));
  return manifest;
}

/** No runtime dependencies: every worker contains its immutable release hashes. */
export function generateServiceWorker(manifest) {
  return `/* Road Haven atomic web content ${manifest.version} */\n(${serviceWorkerRuntime.toString()})(${JSON.stringify(manifest)});\n`;
}

function serviceWorkerRuntime(manifest) {
  const base = new URL(manifest.base, self.location.origin).href;
  const prefix = `road-haven-web:${manifest.base}:`;
  const cacheName = prefix + manifest.buildId;
  const controlName = `road-haven-web-control:${manifest.base}`;
  const completeURL = new URL('.road-haven-complete', base).href;
  const clientURL = id => new URL('.road-haven-client/' + encodeURIComponent(id), base).href;
  let transaction;
  const reply = (event, value) => event.ports?.[0]?.postMessage(value);
  const hex = buffer => [...new Uint8Array(buffer)].map(n => n.toString(16).padStart(2, '0')).join('');
  const scopedClients = async () => (await self.clients.matchAll({ type: 'window', includeUncontrolled: true }))
    .filter(client => client.url.startsWith(base));
  const broadcast = async data => { for (const client of await scopedClients()) client.postMessage(data); };
  const marker = async name => {
    if (!(await caches.keys()).includes(name)) return undefined;
    const response = await (await caches.open(name)).match(completeURL);
    return response ? response.json() : undefined;
  };
  const pin = async (id, buildId, acknowledged = false) => {
    if (id && /^[a-f0-9]{64}$/.test(buildId)) await (await caches.open(controlName)).put(clientURL(id), new Response(JSON.stringify({ buildId, acknowledged })));
  };
  const pinned = async id => {
    const response = id && await (await caches.open(controlName)).match(clientURL(id));
    return response ? response.json() : undefined;
  };

  self.addEventListener('install', event => event.waitUntil((async () => {
    let existingComplete = false;
    try {
      const previous = await marker(cacheName);
      existingComplete = !!previous;
      const cache = await caches.open(cacheName);
      if (previous) {
        if (previous.buildId !== manifest.buildId) throw Error('Cache release mismatch');
        for (const file of manifest.files) {
          const response = await cache.match(new URL(file.path, base).href);
          if (!response || hex(await crypto.subtle.digest('SHA-256', await response.arrayBuffer())) !== file.sha256) throw Error('Existing release cache incomplete');
        }
        return;
      }
      const total = manifest.files.reduce((sum, file) => sum + file.bytes, 0);
      let bytesDone = 0;
      let downloadedBytes = 0, reusedBytes = 0;
      const previousReleases = [];
      for (const name of await caches.keys()) {
        if (!name.startsWith(prefix) || name === cacheName) continue;
        const release = await marker(name);
        if (release?.files) previousReleases.push({ cache: await caches.open(name), release });
      }
      await broadcast({ type: 'WEB_UPDATE_STATE', state: { status: 'downloading', progress: 0, version: manifest.version, contentVersion: manifest.contentVersion, message: '새로운 게임을 안전하게 준비하고 있어요.' }, buildId: manifest.buildId });
      // Sequential reads bound Safari memory while the previous complete cache stays untouched.
      for (const file of manifest.files) {
        const url = new URL(file.path, base);
        if (url.origin !== self.location.origin || !url.href.startsWith(base) || file.path.includes('..')) throw Error('Invalid release file path');
        let response;
        for (const previous of previousReleases) {
          if (!previous.release.files.some(old => old.path === file.path && old.sha256 === file.sha256 && old.bytes === file.bytes)) continue;
          const candidate = await previous.cache.match(url.href);
          if (!candidate) continue;
          const bytes = await candidate.clone().arrayBuffer();
          if (bytes.byteLength === file.bytes && hex(await crypto.subtle.digest('SHA-256', bytes)) === file.sha256) {
            response = candidate;reusedBytes += file.bytes;break;
          }
        }
        if (!response) {
          response = await fetch(new Request(url.href, { cache: 'no-store', credentials: 'same-origin' }));
          downloadedBytes += file.bytes;
        }
        if (!response.ok || response.type === 'opaque' || response.redirected) throw Error('Release download failed: ' + file.path);
        const bytes = await response.clone().arrayBuffer();
        if (bytes.byteLength !== file.bytes || hex(await crypto.subtle.digest('SHA-256', bytes)) !== file.sha256) throw Error('Release file verification failed: ' + file.path);
        await cache.put(url.href, response);
        bytesDone += file.bytes;
        await broadcast({ type: 'WEB_UPDATE_STATE', state: { status: 'downloading', progress: Math.min(99, Math.floor(bytesDone / total * 100)), version: manifest.version, contentVersion: manifest.contentVersion, message: '새로운 게임을 안전하게 준비하고 있어요.' }, buildId: manifest.buildId });
      }
      await cache.put(completeURL, new Response(JSON.stringify({ ...manifest, firstInstall: !self.registration.active, downloadedBytes, reusedBytes })));
    } catch (error) {
      if (!existingComplete) await caches.delete(cacheName);
      await broadcast({ type: 'WEB_UPDATE_STATE', state: { status: 'error', progress: 0, message: '연결되면 새 게임을 다시 준비해요. 지금 마을은 그대로 이어갈 수 있어요.' }, buildId: manifest.buildId });
      throw error;
    }
  })()));

  self.addEventListener('activate', event => event.waitUntil((async () => {
    const completed = await marker(cacheName);
    if (!completed) throw Error('Unverified release cannot activate');
    // First installation does not take over an already running legacy document.
    // Subsequent workers claim only after peer approvals/freezes and the
    // initiating game's final canonical save.
    if (!completed.firstInstall) await self.clients.claim();
    await broadcast({ type: 'WEB_UPDATE_ACTIVATED', buildId: manifest.buildId });
  })()));

  async function cleanAcknowledgedCaches() {
    const clients = await scopedClients();
    if (!clients.length) return;
    for (const client of clients) {
      const progress = await pinned(client.id);
      if (!progress || progress.buildId !== manifest.buildId || !progress.acknowledged) return;
    }
    for (const name of await caches.keys()) {
      if (!name.startsWith(prefix) || name === cacheName) continue;
      const release = await marker(name);
      // ACK of the running release must never erase a waiting or installing
      // successor. Content version numbers advance on each published patch.
      if (release && release.contentVersion < manifest.contentVersion) await caches.delete(name);
    }
  }

  async function finishTransaction(accepted, reason) {
    const current = transaction;
    if (!current || current.finishing) return;
    current.finishing = true;
    clearTimeout(current.timer);
    let clients = await scopedClients();
    if (accepted && clients.some(client => current.votes.get(client.id) !== true)) { accepted = false; reason = 'Another game is not ready'; }
    if (accepted) {
      // Peers can hold older in-memory saves and must not overwrite shared
      // primary storage. The frozen initiating tab is the canonical writer.
      const initiator = clients.find(client => client.id === current.initiator);
      if (!initiator) accepted = false;
      else {
        const saved = new Promise(resolve => {
          current.finalSaveResolve = resolve;
          current.timer = setTimeout(() => resolve(false), 6000);
        });
        initiator.postMessage({ type: 'WEB_UPDATE_FINALIZE', token: current.token, buildId: manifest.buildId });
        accepted = await saved;
        if (!accepted) reason = 'The initiating game could not save';
      }
      clients = await scopedClients();
      if (clients.some(client => current.votes.get(client.id) !== true)) { accepted = false; reason = 'Another game opened during the save'; }
    }
    transaction = undefined;
    clearTimeout(current.timer);
    if (accepted) {
      for (const client of clients) client.postMessage({ type: 'WEB_UPDATE_COMMIT', token: current.token, buildId: manifest.buildId });
    } else {
      for (const client of clients) client.postMessage({ type: 'WEB_UPDATE_ABORT', token: current.token, buildId: manifest.buildId });
    }
    current.resolve({ accepted, reason });
    // Complete every transaction message event before the browser activates
    // this waiting worker. Awaiting skipWaiting from its own waitUntil chain
    // can keep that event alive and prevent the controller transition.
    if (accepted) void self.skipWaiting();
  }

  self.addEventListener('message', event => {
    const data = event.data || {};
    if (data.type === 'WEB_UPDATE_GET_STATE') event.waitUntil((async () => {
      const completed = await marker(cacheName);
      reply(event, { buildId: manifest.buildId, installStats: completed ? { downloadedBytes: completed.downloadedBytes, reusedBytes: completed.reusedBytes } : undefined, state: { status: completed && data.waiting ? 'ready' : 'idle', progress: completed ? 100 : 0, version: manifest.version, contentVersion: manifest.contentVersion, message: completed && data.waiting ? '새 게임이 준비됐어요. 안전하게 저장한 뒤 자동으로 이어갈게요.' : '최신 게임으로 여행하고 있어요.' } });
    })());
    if (data.type === 'WEB_UPDATE_BOOT' || data.type === 'WEB_UPDATE_ACK') event.waitUntil((async () => {
      await pin(event.source?.id, data.buildId, data.type === 'WEB_UPDATE_ACK');
      if (data.type === 'WEB_UPDATE_ACK') await cleanAcknowledgedCaches();
      reply(event, { accepted: true });
    })());
    if (data.type === 'WEB_UPDATE_ACTIVATE') event.waitUntil((async () => {
      if (transaction || !(await marker(cacheName)) || !event.source?.id) { reply(event, { accepted: false }); return; }
      const clients = await scopedClients();
      // Two tabs can cross the asynchronous cache/client lookups together.
      // Reserve the transaction only after a second synchronous ownership check.
      if (transaction) { reply(event, { accepted: false }); return; }
      const token = data.token;
      let resolve;
      const result = new Promise(done => { resolve = done; });
      transaction = { token, initiator: event.source.id, votes: new Map([[event.source.id, true]]), resolve,
        timer: setTimeout(() => { void finishTransaction(false, 'Another game has not saved yet'); }, 6000) };
      for (const client of clients) {
        if (client.id === event.source.id) continue;
        client.postMessage({ type: 'WEB_UPDATE_PREPARE', token, buildId: manifest.buildId });
      }
      if (clients.every(client => transaction?.votes.get(client.id) === true)) await finishTransaction(true);
      reply(event, await result);
    })());
    if (data.type === 'WEB_UPDATE_VOTE' && transaction && data.token === transaction.token) event.waitUntil((async () => {
      transaction.votes.set(event.source?.id, data.ready === true);
      if (data.ready !== true) await finishTransaction(false, 'Another game is busy');
      else if ((await scopedClients()).every(client => transaction?.votes.get(client.id) === true)) await finishTransaction(true);
    })());
    if (data.type === 'WEB_UPDATE_FINALIZED' && transaction && transaction.finishing
      && data.token === transaction.token && event.source?.id === transaction.initiator) {
      transaction.finalSaveResolve?.(data.saved === true);
    }
  });

  self.addEventListener('fetch', event => {
    const request = event.request;
    const url = new URL(request.url);
    if (request.method !== 'GET' || url.origin !== self.location.origin || !url.href.startsWith(base)) return;
    const relative = url.pathname.slice(new URL(base).pathname.length);
    if (relative === 'sw.js' || relative === 'web-update.json') return;
    event.respondWith((async () => {
      if (request.mode === 'navigate' && (relative === '' || relative === 'index.html')) {
        await pin(event.resultingClientId, manifest.buildId);
        return await (await caches.open(cacheName)).match(new URL('index.html', base).href)
          || new Response('The verified game cache is unavailable.', { status: 503 });
      }
      const progress = await pinned(event.clientId);
      const selectedName = progress ? prefix + progress.buildId : cacheName;
      const release = await marker(selectedName);
      if (release?.files.some(file => file.path === relative)) {
        return await (await caches.open(selectedName)).match(new URL(relative, base).href)
          || new Response('The verified game file is unavailable.', { status: 503 });
      }
      // Old hashed chunks requested during a saved tab's reload stay with their
      // old cache. Listed version assets never fall back to another release.
      if (relative.startsWith('assets/') || relative.startsWith('fonts/')) {
        return new Response('This asset does not belong to the selected game version.', { status: 503 });
      }
      return fetch(request);
    })());
  });
}

export function webPwaPlugin() {
  let config;
  let enabled = false;
  return {
    name: 'road-haven-atomic-web-pwa',
    apply: 'build',
    config(userConfig, environment) {
      const web = environment.command === 'build' &&
        (normalizeBase(userConfig.base ?? '/') === '/House/' || process.env.VITE_PWA_ENABLED === '1');
      return { define: {
        __ROAD_HAVEN_WEB_PWA__: JSON.stringify(web),
        'import.meta.env.VITE_WEB_PWA_ENABLED': JSON.stringify(web),
      } };
    },
    configResolved(resolved) {
      config = resolved;
      enabled = normalizeBase(config.base) === '/House/' || process.env.VITE_PWA_ENABLED === '1';
      config.define ??= {};
      config.define['import.meta.env.VITE_WEB_PWA_ENABLED'] = JSON.stringify(enabled);
      // Vite emits import.meta.env objects for optional property access. Keep
      // that object consistent with the directly substituted member as well.
      config.env ??= {};
      config.env.VITE_WEB_PWA_ENABLED = enabled;
    },
    transformIndexHtml(html) {
      return enabled ? html : html.replace(/<(?:link|meta)\b[^>]*\bdata-pwa-only(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?[^>]*>/gi, '');
    },
    async closeBundle() {
      const outDir = path.resolve(config.root, config.build.outDir);
      if (!enabled) {
        for (const name of ['manifest.webmanifest', 'sw.js', 'web-update.json']) await rm(path.join(outDir, name), { force: true });
        return;
      }
      const app = JSON.parse(await readFile(path.join(config.root, 'package.json'), 'utf8'));
      const release = JSON.parse(await readFile(path.join(config.root, 'release-version.json'), 'utf8'));
      await createPwaRelease(outDir, { version: process.env.VITE_APP_VERSION || app.version,
        contentVersion: Number(process.env.VITE_APP_VERSION_CODE || release.versionCode), base: config.base });
    },
  };
}
