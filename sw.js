/* Road Haven atomic web content 0.66.0 */
(function serviceWorkerRuntime(manifest) {
  const base = new URL(manifest.base, self.location.origin).href;
  const prefix = `road-haven-web:${manifest.base}:`;
  const cacheName = prefix + manifest.buildId;
  const controlName = `road-haven-web-control:${manifest.base}`;
  const completeURL = new URL('.road-haven-complete', base).href;
  const clientURL = id => new URL('.road-haven-client/' + encodeURIComponent(id), base).href;
  const bootstrapClients = new Set();
  let transaction;
  const reply = (event, value) => event.ports?.[0]?.postMessage(value);
  const hex = buffer => [...new Uint8Array(buffer)].map(n => n.toString(16).padStart(2, '0')).join('');
  const logicalURL = file => {
    const url = new URL(file.path, base);
    if (url.origin !== self.location.origin || !url.href.startsWith(base)
      || !/^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*$/.test(file.path)
      || file.path.split('/').some(part => part === '.' || part === '..')) throw Error('Invalid release file path');
    return url;
  };
  const downloadURL = file => {
    const logical = logicalURL(file);
    if (!file.sourceUrl) return logical;
    const source = manifest.remoteSource;
    if (source?.repository !== 'h0623-dev/House' || typeof source.commit !== 'string' || !/^[a-f0-9]{40}$/.test(source.commit)
      || !/^play\/(?:assets|fonts)\//.test(file.path)) throw Error('Invalid remote asset source');
    // Small immutable snapshots may split one release across CDN size limits.
    // Omitted lists preserve the original single-commit manifest contract.
    const commits = source.commits === undefined ? [source.commit] : source.commits;
    if (!Array.isArray(commits) || commits.length < 1 || commits.length > 4 || commits[0] !== source.commit
      || commits.some(commit => typeof commit !== 'string' || !/^[a-f0-9]{40}$/.test(commit))
      || new Set(commits).size !== commits.length) throw Error('Invalid remote asset commit pins');
    if (!commits.some(commit => file.sourceUrl === `https://cdn.jsdelivr.net/gh/h0623-dev/House@${commit}/${file.path.slice(5)}`)) {
      throw Error('Remote asset host, repository, immutable commit or file path changed');
    }
    return new URL(file.sourceUrl);
  };
  const mediaType = name => name.endsWith('.js') ? 'application/javascript' : name.endsWith('.css') ? 'text/css'
    : name.endsWith('.png') ? 'image/png' : name.endsWith('.webp') ? 'image/webp'
    : name.endsWith('.ttf') ? 'font/ttf' : name.endsWith('.woff2') ? 'font/woff2'
    : name.endsWith('.txt') ? 'text/plain' : undefined;
  const fetchFile = async source => {
    const external = source.origin !== self.location.origin;
    const controller = new AbortController();
    // Includes response-body reads: a connected but stalled CDN must not leave
    // the first-visit loading screen waiting forever.
    const timer = setTimeout(() => controller.abort(), 180000);
    try {
      const response = await fetch(new Request(source.href, { cache: 'no-store',
        mode: external ? 'cors' : 'same-origin', credentials: external ? 'omit' : 'same-origin',
        redirect: 'error', signal: controller.signal }));
      if (!response.ok || response.type === 'opaque' || response.redirected) throw Error('Release download failed');
      const bytes = await response.clone().arrayBuffer();
      return { response, bytes };
    } finally { clearTimeout(timer); }
  };
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
      for (const file of manifest.files) {
        logicalURL(file); downloadURL(file);
        if (!Number.isSafeInteger(file.bytes) || file.bytes < 0 || !/^[a-f0-9]{64}$/.test(file.sha256)) throw Error('Invalid release file metadata');
      }
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
        const url = logicalURL(file), source = downloadURL(file);
        let response, downloaded;
        for (const previous of previousReleases) {
          // CDN-backed releases use the old compatibility path as their real
          // logical URL. Reuse identical images/fonts from canonical old caches.
          const old = previous.release.files.find(old => (old.path === file.path
            || (file.sourceUrl && old.path === file.path.slice(5)))
            && old.sha256 === file.sha256 && old.bytes === file.bytes);
          if (!old) continue;
          const candidate = await previous.cache.match(new URL(old.path, base).href);
          if (!candidate) continue;
          const bytes = await candidate.clone().arrayBuffer();
          if (bytes.byteLength === file.bytes && hex(await crypto.subtle.digest('SHA-256', bytes)) === file.sha256) {
            response = candidate;reusedBytes += file.bytes;break;
          }
        }
        if (!response) {
          const result = await fetchFile(source); response = result.response; downloaded = result.bytes;
          downloadedBytes += file.bytes;
        }
        if (!response.ok || response.type === 'opaque' || response.redirected) throw Error('Release download failed: ' + file.path);
        const bytes = downloaded ?? await response.clone().arrayBuffer();
        if (bytes.byteLength !== file.bytes || hex(await crypto.subtle.digest('SHA-256', bytes)) !== file.sha256) throw Error('Release file verification failed: ' + file.path);
        if (file.sourceUrl) {
          const wantedType = mediaType(file.path), receivedType = response.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase();
          if (!wantedType || (receivedType !== wantedType
            && !(wantedType === 'application/javascript' && receivedType === 'text/javascript'))) throw Error('Remote file MIME type mismatch: ' + file.path);
          // CORS granted access to the bytes. A fresh basic response keeps
          // same-origin image/canvas/font requests safe, including getImageData.
          response = new Response(bytes, { status: 200, headers: { 'Content-Type': wantedType,
            'Cache-Control': 'public, max-age=31536000, immutable' } });
        }
        await cache.put(url.href, response);
        bytesDone += file.bytes;
        await broadcast({ type: 'WEB_UPDATE_STATE', state: { status: 'downloading', progress: Math.min(99, Math.floor(bytesDone / total * 100)), version: manifest.version, contentVersion: manifest.contentVersion, message: '새로운 게임을 안전하게 준비하고 있어요.' }, buildId: manifest.buildId });
      }
      await cache.put(completeURL, new Response(JSON.stringify({ ...manifest, firstInstall: !self.registration.active, downloadedBytes, reusedBytes })));
    } catch (error) {
      if (!existingComplete) await caches.delete(cacheName);
      await broadcast({ type: 'WEB_UPDATE_STATE', state: { status: 'error', progress: 0, message: '연결되면 새 게임을 다시 준비해요. 지금 마을은 그대로 이어갈 수 있어요.' }, buildId: manifest.buildId,
        reason: error?.name === 'QuotaExceededError' || error?.name === 'SecurityError' ? 'storage' : 'download' });
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
    if (accepted && current.bootstrap) {
      // A bootstrap never opens or writes the shared game save. It may replace
      // an old worker only while every document is a declared bootstrap. A
      // real game is never asked to discard its in-memory save by this path.
      clients = await scopedClients();
      if (clients.some(client => !bootstrapClients.has(client.id) || current.votes.get(client.id) !== true)) { accepted = false; reason = 'Another game must save first'; }
    } else if (accepted) {
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
      bootstrapClients.delete(event.source?.id);
      await pin(event.source?.id, data.buildId, data.type === 'WEB_UPDATE_ACK');
      if (data.type === 'WEB_UPDATE_ACK') await cleanAcknowledgedCaches();
      reply(event, { accepted: true });
    })());
    if (data.type === 'WEB_UPDATE_BOOTSTRAP_HELLO' || data.type === 'WEB_UPDATE_BOOTSTRAP_EXIT') event.waitUntil((async () => {
      if (!manifest.remoteSource || data.buildId !== manifest.buildId || !event.source?.id
        || !event.source.url.startsWith(base)) { reply(event, { accepted: false }); return; }
      if (data.type === 'WEB_UPDATE_BOOTSTRAP_HELLO') bootstrapClients.add(event.source.id);
      else bootstrapClients.delete(event.source.id);
      reply(event, { accepted: true });
    })());
    if (data.type === 'WEB_UPDATE_ACTIVATE' || data.type === 'WEB_UPDATE_BOOTSTRAP_ACTIVATE') event.waitUntil((async () => {
      if (transaction || !(await marker(cacheName)) || !event.source?.id) { reply(event, { accepted: false }); return; }
      const clients = await scopedClients();
      const bootstrap = data.type === 'WEB_UPDATE_BOOTSTRAP_ACTIVATE';
      if (bootstrap && (!manifest.remoteSource || data.buildId !== manifest.buildId
        || !bootstrapClients.has(event.source.id)
        || clients.some(client => !bootstrapClients.has(client.id)))) { reply(event, { accepted: false, reason: 'Another game must save first' }); return; }
      // Two tabs can cross the asynchronous cache/client lookups together.
      // Reserve the transaction only after a second synchronous ownership check.
      if (transaction) { reply(event, { accepted: false }); return; }
      const token = data.token;
      let resolve;
      const result = new Promise(done => { resolve = done; });
      transaction = { token, initiator: event.source.id, bootstrap, votes: new Map([[event.source.id, true]]), resolve,
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
      const historicalMatch = relative.match(/^play-v(\d+)\.(\d+)\.(\d+)\.html$/);
      const currentVersion = manifest.version.split('.').map(Number);
      const historicalVersion = historicalMatch?.slice(1).map(Number);
      const historicalEntry = manifest.remoteSource && historicalVersion && historicalVersion.every(Number.isSafeInteger)
        && (historicalVersion[0] < currentVersion[0] || (historicalVersion[0] === currentVersion[0]
          && (historicalVersion[1] < currentVersion[1] || (historicalVersion[1] === currentVersion[1] && historicalVersion[2] <= currentVersion[2]))));
      if (request.mode === 'navigate' && (relative === '' || relative === 'index.html' || relative === 'play.html'
        || relative === 'play-v' + manifest.version + '.html' || historicalEntry)) {
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
})({"schema":2,"buildId":"5bc787d9678fb5911ed0efa36dd7e5458b09f731a393f8f98896f5b1b95dc1d0","version":"0.66.0","contentVersion":72,"base":"/House/","remoteSource":{"repository":"h0623-dev/House","commit":"95dcc8f828046857fcf3fcd7dc2b5bbd0f9c1006","commits":["95dcc8f828046857fcf3fcd7dc2b5bbd0f9c1006","c74477ebe4214d536fce14d76d3223d09c90ee19"]},"files":[{"path":"index.html","bytes":9830,"sha256":"e39594f22515076b7caac8b15261cf8e58fb30b78372a65fd6a4322024c57ece"},{"path":"manifest.webmanifest","bytes":677,"sha256":"6283a48e187236409bdf0948b840df57c95ccccfc2f31b6c8bac248ca30f8cdc"},{"path":"play/assets/app-brand-v063.webp","sourceUrl":"https://cdn.jsdelivr.net/gh/h0623-dev/House@c74477ebe4214d536fce14d76d3223d09c90ee19/assets/app-brand-v063.webp","bytes":268436,"sha256":"719159d79d87ac334dc9f5a91f31f8bce43e412f5fb5258373765155578a713e"},{"path":"play/assets/battle-bridge-CshNqkaE.png","sourceUrl":"https://cdn.jsdelivr.net/gh/h0623-dev/House@95dcc8f828046857fcf3fcd7dc2b5bbd0f9c1006/assets/battle-bridge-CshNqkaE.png","bytes":3680793,"sha256":"371c397ced7ca06ce87cc4638d7140988573c78f29ff70c713c0a8a9b9c499a0"},{"path":"play/assets/battle-checkpoint-DRTJ197s.png","sourceUrl":"https://cdn.jsdelivr.net/gh/h0623-dev/House@95dcc8f828046857fcf3fcd7dc2b5bbd0f9c1006/assets/battle-checkpoint-DRTJ197s.png","bytes":3604385,"sha256":"fad9daef2c707dddf4f37fbc81ba20106b3fb16132dc612d8bceda53b87b59b0"},{"path":"play/assets/battle-forest-C51K6LMV.png","sourceUrl":"https://cdn.jsdelivr.net/gh/h0623-dev/House@95dcc8f828046857fcf3fcd7dc2b5bbd0f9c1006/assets/battle-forest-C51K6LMV.png","bytes":3873328,"sha256":"acce40107ff1dd6f4f7d5567c6e2a934c500aaf9890a55616b817761f5b5d391"},{"path":"play/assets/creatures-anime-DdNIkJKd.png","sourceUrl":"https://cdn.jsdelivr.net/gh/h0623-dev/House@95dcc8f828046857fcf3fcd7dc2b5bbd0f9c1006/assets/creatures-anime-DdNIkJKd.png","bytes":2493525,"sha256":"5d1cf1176a79a677bdd135316f2f24d5abda68748747d78e28e9b16c8e03b060"},{"path":"play/assets/dm-sans-latin-ext-wght-normal-BOFOeGcA.woff2","sourceUrl":"https://cdn.jsdelivr.net/gh/h0623-dev/House@c74477ebe4214d536fce14d76d3223d09c90ee19/assets/dm-sans-latin-ext-wght-normal-BOFOeGcA.woff2","bytes":18228,"sha256":"a5d38fe99f930275684999b462c7123faa063d9e44e73b4b241723d884aa0f49"},{"path":"play/assets/dm-sans-latin-wght-normal-Xz1IZZA0.woff2","sourceUrl":"https://cdn.jsdelivr.net/gh/h0623-dev/House@c74477ebe4214d536fce14d76d3223d09c90ee19/assets/dm-sans-latin-wght-normal-Xz1IZZA0.woff2","bytes":36932,"sha256":"9fea608a947e67020c33cad9a6fe3d60c54119dfb8cff87768a8117a15ed7543"},{"path":"play/assets/haven-animal-direction-large-v0571-Bx6vOst-.webp","sourceUrl":"https://cdn.jsdelivr.net/gh/h0623-dev/House@95dcc8f828046857fcf3fcd7dc2b5bbd0f9c1006/assets/haven-animal-direction-large-v0571-Bx6vOst-.webp","bytes":182860,"sha256":"2695e69eb415e82f132da9857a2e84cc863a09f4da9034fc3aefdeb08579ac32"},{"path":"play/assets/haven-animal-direction-small-v0571-jofbioND.webp","sourceUrl":"https://cdn.jsdelivr.net/gh/h0623-dev/House@c74477ebe4214d536fce14d76d3223d09c90ee19/assets/haven-animal-direction-small-v0571-jofbioND.webp","bytes":283274,"sha256":"5f0c1e3c950963f5e08fafeae12cdf0a3a8cc021fc0be09cd620fadfe67774a4"},{"path":"play/assets/haven-animal-direction-woodland-v0571-Dc8p_bLu.webp","sourceUrl":"https://cdn.jsdelivr.net/gh/h0623-dev/House@c74477ebe4214d536fce14d76d3223d09c90ee19/assets/haven-animal-direction-woodland-v0571-Dc8p_bLu.webp","bytes":324084,"sha256":"453f33bb3e05e7cbd27fc41ca9ac6d7d9728a527da76ad9616d43ad5aaab242c"},{"path":"play/assets/haven-coast-ground-v058-BK-lhyVd.webp","sourceUrl":"https://cdn.jsdelivr.net/gh/h0623-dev/House@c74477ebe4214d536fce14d76d3223d09c90ee19/assets/haven-coast-ground-v058-BK-lhyVd.webp","bytes":720018,"sha256":"20cf84418cb2a3a7dcda435993589a4ea67e7e43cccf35d52571a72f1c189c9a"},{"path":"play/assets/haven-coast-haeon-portrait-v058-JncC1QQ0.webp","sourceUrl":"https://cdn.jsdelivr.net/gh/h0623-dev/House@c74477ebe4214d536fce14d76d3223d09c90ee19/assets/haven-coast-haeon-portrait-v058-JncC1QQ0.webp","bytes":12464,"sha256":"802717487f72391f982e24a204deb226eb35530efbfed3acdd03ade561074910"},{"path":"play/assets/haven-coast-props-v058-pBolghog.webp","sourceUrl":"https://cdn.jsdelivr.net/gh/h0623-dev/House@c74477ebe4214d536fce14d76d3223d09c90ee19/assets/haven-coast-props-v058-pBolghog.webp","bytes":501254,"sha256":"aa3b6d396e0824d388a776bb3250478788d332cae8c0c9617772784ad0da75a5"},{"path":"play/assets/haven-companions-cat-4rV17IN9.png","sourceUrl":"https://cdn.jsdelivr.net/gh/h0623-dev/House@c74477ebe4214d536fce14d76d3223d09c90ee19/assets/haven-companions-cat-4rV17IN9.png","bytes":1231350,"sha256":"039df732c96633a8b57d7325551d7fb284c7be39304cc9602a31b214f90b1e3e"},{"path":"play/assets/haven-companions-dog-C_Avxq7A.png","sourceUrl":"https://cdn.jsdelivr.net/gh/h0623-dev/House@c74477ebe4214d536fce14d76d3223d09c90ee19/assets/haven-companions-dog-C_Avxq7A.png","bytes":1190045,"sha256":"06638659fcac56a8627ad152f5f926bbebbd91cd8347418b4dd1d033e02d069e"},{"path":"play/assets/haven-companions-reserve-CxrKZcaR.png","sourceUrl":"https://cdn.jsdelivr.net/gh/h0623-dev/House@c74477ebe4214d536fce14d76d3223d09c90ee19/assets/haven-companions-reserve-CxrKZcaR.png","bytes":1068795,"sha256":"bd0e1d1eaa3db362e10292819da4f9d7d53e8420a87745a3349bfa3b2e751396"},{"path":"play/assets/haven-companions-safari-DNVy2oTC.png","sourceUrl":"https://cdn.jsdelivr.net/gh/h0623-dev/House@c74477ebe4214d536fce14d76d3223d09c90ee19/assets/haven-companions-safari-DNVy2oTC.png","bytes":1405068,"sha256":"e57b867628279dd2a64f0280eb445896e319d9142bd3d237ee3f3a3a031dd585"},{"path":"play/assets/haven-crops-growth-v047-Cv41UhXq.png","sourceUrl":"https://cdn.jsdelivr.net/gh/h0623-dev/House@c74477ebe4214d536fce14d76d3223d09c90ee19/assets/haven-crops-growth-v047-Cv41UhXq.png","bytes":1801043,"sha256":"b719458c528a4d64c368d9a947291aa837c088099504d58be430cab688407f0d"},{"path":"play/assets/haven-crops-inventory-v047-DXmSSy5k.png","sourceUrl":"https://cdn.jsdelivr.net/gh/h0623-dev/House@c74477ebe4214d536fce14d76d3223d09c90ee19/assets/haven-crops-inventory-v047-DXmSSy5k.png","bytes":1989167,"sha256":"db91a19b1236d84224cc420ac5f0400c0cfef0dfbaf066aea60fc61debc0b871"},{"path":"play/assets/haven-facilities-v047-BhSn5R0l.png","sourceUrl":"https://cdn.jsdelivr.net/gh/h0623-dev/House@95dcc8f828046857fcf3fcd7dc2b5bbd0f9c1006/assets/haven-facilities-v047-BhSn5R0l.png","bytes":2739855,"sha256":"70199098851b3e6d5ab6e718286f237b2b29d7628a097e66b82b7f7473af48a8"},{"path":"play/assets/haven-gathering-biome-v059-CX-DH5Y1.webp","sourceUrl":"https://cdn.jsdelivr.net/gh/h0623-dev/House@c74477ebe4214d536fce14d76d3223d09c90ee19/assets/haven-gathering-biome-v059-CX-DH5Y1.webp","bytes":827056,"sha256":"29599650a2585599528d0234ca2c33e6581b38b488b57cef47fcded80f0f0559"},{"path":"play/assets/haven-ground-coast-v060-DhYjME8l.webp","sourceUrl":"https://cdn.jsdelivr.net/gh/h0623-dev/House@c74477ebe4214d536fce14d76d3223d09c90ee19/assets/haven-ground-coast-v060-DhYjME8l.webp","bytes":368014,"sha256":"ecc63b7fa686908fd618462cadacf46a70c74a9eee99677793ec252dea17bdec"},{"path":"play/assets/haven-ground-home-v060-BBeSihfz.webp","sourceUrl":"https://cdn.jsdelivr.net/gh/h0623-dev/House@c74477ebe4214d536fce14d76d3223d09c90ee19/assets/haven-ground-home-v060-BBeSihfz.webp","bytes":403390,"sha256":"d300a40e8ffe87a7c2a7d684fd3e6c7d3293ae0c3b66d012564ab97341cc5d4e"},{"path":"play/assets/haven-ground-landscape-RYW0cYT7.png","sourceUrl":"https://cdn.jsdelivr.net/gh/h0623-dev/House@95dcc8f828046857fcf3fcd7dc2b5bbd0f9c1006/assets/haven-ground-landscape-RYW0cYT7.png","bytes":3873656,"sha256":"5fbdb3070149b5cc2e1a30ec3f1e5cf1c6322b838348d393d9f22a7aded9171a"},{"path":"play/assets/haven-ground-props-CwPWevi3.png","sourceUrl":"https://cdn.jsdelivr.net/gh/h0623-dev/House@95dcc8f828046857fcf3fcd7dc2b5bbd0f9c1006/assets/haven-ground-props-CwPWevi3.png","bytes":2564318,"sha256":"bba973f06c22bc69d19909d71c35aed1132fccecbac100f92dc0c1e01b3833c0"},{"path":"play/assets/haven-hero-actions-3fYZ4U9d.webp","sourceUrl":"https://cdn.jsdelivr.net/gh/h0623-dev/House@c74477ebe4214d536fce14d76d3223d09c90ee19/assets/haven-hero-actions-3fYZ4U9d.webp","bytes":1218026,"sha256":"53dd17bf1dcd5119f76175056a5df90d0858a5cdbf4775c8570dca2bf6afc921"},{"path":"play/assets/haven-hero-gathering-DD8A19bE.webp","sourceUrl":"https://cdn.jsdelivr.net/gh/h0623-dev/House@c74477ebe4214d536fce14d76d3223d09c90ee19/assets/haven-hero-gathering-DD8A19bE.webp","bytes":1090974,"sha256":"ccaf91335771ae23bdba8b4c8b0320462174b9da082bbc443355e386a35ee329"},{"path":"play/assets/haven-hero-locomotion-_aPy7ZT_.webp","sourceUrl":"https://cdn.jsdelivr.net/gh/h0623-dev/House@c74477ebe4214d536fce14d76d3223d09c90ee19/assets/haven-hero-locomotion-_aPy7ZT_.webp","bytes":1190408,"sha256":"305f9430462782224edf2cc0b867f869f2a9c716344f80c825e1976ed4600154"},{"path":"play/assets/haven-hero-survivors-B2sShSwV.webp","sourceUrl":"https://cdn.jsdelivr.net/gh/h0623-dev/House@c74477ebe4214d536fce14d76d3223d09c90ee19/assets/haven-hero-survivors-B2sShSwV.webp","bytes":1167606,"sha256":"f50c3d64b081dfbeb2bada9ee032e6ba73ce0ffd29da2b3e4a1aeaaea32a4e1d"},{"path":"play/assets/haven-infected-miniature-C5ZFEKhB.webp","sourceUrl":"https://cdn.jsdelivr.net/gh/h0623-dev/House@c74477ebe4214d536fce14d76d3223d09c90ee19/assets/haven-infected-miniature-C5ZFEKhB.webp","bytes":482444,"sha256":"19f42092e741ae6532b0a0efaecaeebfef6e0dbecd52e7d01509212a6ac77111"},{"path":"play/assets/haven-items-miniature-CWyvCdAf.png","sourceUrl":"https://cdn.jsdelivr.net/gh/h0623-dev/House@95dcc8f828046857fcf3fcd7dc2b5bbd0f9c1006/assets/haven-items-miniature-CWyvCdAf.png","bytes":2296104,"sha256":"ac7202af9c9ce885b4a2d8d211f502929cf6e4101d948d37fc5bef90575c3e1a"},{"path":"play/assets/haven-pond-collection-v057-BwMDn_8q.webp","sourceUrl":"https://cdn.jsdelivr.net/gh/h0623-dev/House@c74477ebe4214d536fce14d76d3223d09c90ee19/assets/haven-pond-collection-v057-BwMDn_8q.webp","bytes":118562,"sha256":"a55dde51df672fe8487ba734fe69dcc7a8b6f57ee2af4734497b84342e43a027"},{"path":"play/assets/haven-pond-dock-v057-CHcZyQ3C.webp","sourceUrl":"https://cdn.jsdelivr.net/gh/h0623-dev/House@c74477ebe4214d536fce14d76d3223d09c90ee19/assets/haven-pond-dock-v057-CHcZyQ3C.webp","bytes":51854,"sha256":"ba408fd6055d785c54ac05a084a7d3952d1c9158f649e89233241487c249f9b7"},{"path":"play/assets/haven-traveler-cart-v056-Dbr70YZj.webp","sourceUrl":"https://cdn.jsdelivr.net/gh/h0623-dev/House@c74477ebe4214d536fce14d76d3223d09c90ee19/assets/haven-traveler-cart-v056-Dbr70YZj.webp","bytes":85160,"sha256":"ac69d5a9713aa1b699bf6c4c47d929ccfa503bde1eb19d4434b2206d5b8f8644"},{"path":"play/assets/haven-traveler-flowerpot-v056-B3ATqdX_.webp","sourceUrl":"https://cdn.jsdelivr.net/gh/h0623-dev/House@95dcc8f828046857fcf3fcd7dc2b5bbd0f9c1006/assets/haven-traveler-flowerpot-v056-B3ATqdX_.webp","bytes":39806,"sha256":"53a94b7d8300ff78f851fa9b6824223e49b91c800b66d98ab61656d30f8fadd4"},{"path":"play/assets/haven-traveler-nameplate-v056-D926XsTL.webp","sourceUrl":"https://cdn.jsdelivr.net/gh/h0623-dev/House@c74477ebe4214d536fce14d76d3223d09c90ee19/assets/haven-traveler-nameplate-v056-D926XsTL.webp","bytes":39492,"sha256":"1042100a3922a4c30f1912fc75c4fe715dedd3ceb5358b2e56b7be0701d19a2f"},{"path":"play/assets/haven-traveler-yeondu-portrait-v056-CX_QEtwn.webp","sourceUrl":"https://cdn.jsdelivr.net/gh/h0623-dev/House@c74477ebe4214d536fce14d76d3223d09c90ee19/assets/haven-traveler-yeondu-portrait-v056-CX_QEtwn.webp","bytes":11140,"sha256":"43ee592c4112a4993eb5e8cb7a30403f88f3ac2039c6754297f602207a50b09d"},{"path":"play/assets/haven-traveler-yeondu-v056-DhtoYDaD.webp","sourceUrl":"https://cdn.jsdelivr.net/gh/h0623-dev/House@c74477ebe4214d536fce14d76d3223d09c90ee19/assets/haven-traveler-yeondu-v056-DhtoYDaD.webp","bytes":60956,"sha256":"4dcbbda979843ba9fa382eb3709db64816a6415e334bb8dbe8a9410fcf5a49c1"},{"path":"play/assets/haven-truck-miniature-BEm5SmxQ.png","sourceUrl":"https://cdn.jsdelivr.net/gh/h0623-dev/House@c74477ebe4214d536fce14d76d3223d09c90ee19/assets/haven-truck-miniature-BEm5SmxQ.png","bytes":1851066,"sha256":"639db3e773a00df8e81a86636197465d212e715bf7ce419cb9f703a6dc89e207"},{"path":"play/assets/index-BtUmn-ao.css","sourceUrl":"https://cdn.jsdelivr.net/gh/h0623-dev/House@c74477ebe4214d536fce14d76d3223d09c90ee19/assets/index-BtUmn-ao.css","bytes":457725,"sha256":"dcc7a894cb92122827c1d506dd7cf28cb5745f8beaeb578cb6b68afc419b1796"},{"path":"play/assets/index-gmLjrAHk.js","sourceUrl":"https://cdn.jsdelivr.net/gh/h0623-dev/House@c74477ebe4214d536fce14d76d3223d09c90ee19/assets/index-gmLjrAHk.js","bytes":946661,"sha256":"5d20eac1f7f56f8e7de07a76ac48d61bf9c49d6d4776d6716bb65043e787e4ad"},{"path":"play/assets/pwa/road-haven-icon-maskable.png","sourceUrl":"https://cdn.jsdelivr.net/gh/h0623-dev/House@c74477ebe4214d536fce14d76d3223d09c90ee19/assets/pwa/road-haven-icon-maskable.png","bytes":554703,"sha256":"b93a2d309f01a070e0f8bcc7d47ecb75b0723de7424486c0f350bd511f9445ef"},{"path":"play/assets/pwa/road-haven-icon.png","sourceUrl":"https://cdn.jsdelivr.net/gh/h0623-dev/House@c74477ebe4214d536fce14d76d3223d09c90ee19/assets/pwa/road-haven-icon.png","bytes":910374,"sha256":"f6a8eb6bc461f31f79adcf7d4ea9c270ec7b8d33f09b3822f91ddb2c42554d0c"},{"path":"play/assets/road-haven-bootstrap-1a9e6608d667b49e.css","sourceUrl":"https://cdn.jsdelivr.net/gh/h0623-dev/House@95dcc8f828046857fcf3fcd7dc2b5bbd0f9c1006/assets/road-haven-bootstrap-1a9e6608d667b49e.css","bytes":4988,"sha256":"1a9e6608d667b49e8acfa78a37056d68c2081156292f02c063e2a54986ec7dec"},{"path":"play/assets/skills-farm-anime-yMjBbn83.png","sourceUrl":"https://cdn.jsdelivr.net/gh/h0623-dev/House@95dcc8f828046857fcf3fcd7dc2b5bbd0f9c1006/assets/skills-farm-anime-yMjBbn83.png","bytes":2786844,"sha256":"8c1c807a3c14355038ec31b552e14368818b18e8993f98424bb4670c4a02c933"},{"path":"play/assets/world-atlas-anime-j_pxBRxb.png","sourceUrl":"https://cdn.jsdelivr.net/gh/h0623-dev/House@95dcc8f828046857fcf3fcd7dc2b5bbd0f9c1006/assets/world-atlas-anime-j_pxBRxb.png","bytes":2951449,"sha256":"67f9c68491f282743b8245898b7e6c04e7f4072829cdf66639bec59ae7d2a57f"},{"path":"play/assets/world-parts-anime-CnA5nLkl.png","sourceUrl":"https://cdn.jsdelivr.net/gh/h0623-dev/House@95dcc8f828046857fcf3fcd7dc2b5bbd0f9c1006/assets/world-parts-anime-CnA5nLkl.png","bytes":2821651,"sha256":"304e0e30cb1525a5a899057f7e00427061de2e5317012bbdbc457e7f840fb32c"},{"path":"play/assets/world-road-anime-CqYNuSrz.png","sourceUrl":"https://cdn.jsdelivr.net/gh/h0623-dev/House@95dcc8f828046857fcf3fcd7dc2b5bbd0f9c1006/assets/world-road-anime-CqYNuSrz.png","bytes":3665828,"sha256":"57384e426b7df1967ea42dd0e05b098315618ed35cd219dbd9ca04679877c78a"},{"path":"play/fonts/NotoSansKR-Variable.ttf","sourceUrl":"https://cdn.jsdelivr.net/gh/h0623-dev/House@95dcc8f828046857fcf3fcd7dc2b5bbd0f9c1006/fonts/NotoSansKR-Variable.ttf","bytes":10414588,"sha256":"194018e6b2b293a7964f037b25c0249ce1418bc9ab3c971060a03aa57861e252"},{"path":"play/fonts/OFL-DMSans.txt","sourceUrl":"https://cdn.jsdelivr.net/gh/h0623-dev/House@95dcc8f828046857fcf3fcd7dc2b5bbd0f9c1006/fonts/OFL-DMSans.txt","bytes":4502,"sha256":"6fbd040a29c2037a765dfb9f2561e9965b5c95c6dcb5dce516089d63d5f17af7"},{"path":"play/fonts/OFL-NotoSansKR.txt","sourceUrl":"https://cdn.jsdelivr.net/gh/h0623-dev/House@c74477ebe4214d536fce14d76d3223d09c90ee19/fonts/OFL-NotoSansKR.txt","bytes":4388,"sha256":"1c05c68c34f9708415aada51f17e1b0092d2cea709bf4a94cd38114f9e73d7d9"}]});
