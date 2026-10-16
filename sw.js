/* Road Haven atomic web content 0.52.0 */
(function serviceWorkerRuntime(manifest) {
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
      if (request.mode === 'navigate' && (relative === '' || relative === 'index.html' || relative === 'play.html'
        || relative === 'play-v' + manifest.version + '.html')) {
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
})({"schema":1,"buildId":"4a4839927c3d947c12bb59252af61fece24820bd87f78e20851c967bd58ef80b","version":"0.52.0","contentVersion":52,"base":"/House/","files":[{"path":".nojekyll","bytes":0,"sha256":"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"},{"path":"assets/battle-bridge-CshNqkaE.png","bytes":3680793,"sha256":"371c397ced7ca06ce87cc4638d7140988573c78f29ff70c713c0a8a9b9c499a0"},{"path":"assets/battle-checkpoint-DRTJ197s.png","bytes":3604385,"sha256":"fad9daef2c707dddf4f37fbc81ba20106b3fb16132dc612d8bceda53b87b59b0"},{"path":"assets/battle-forest-C51K6LMV.png","bytes":3873328,"sha256":"acce40107ff1dd6f4f7d5567c6e2a934c500aaf9890a55616b817761f5b5d391"},{"path":"assets/companions-cat-anime-DLqNb3YX.png","bytes":1697241,"sha256":"cd7531285cb2d7ac072fd84df4a76626ecdf54befd27706955fda2d091419a5e"},{"path":"assets/creatures-anime-DdNIkJKd.png","bytes":2493525,"sha256":"5d1cf1176a79a677bdd135316f2f24d5abda68748747d78e28e9b16c8e03b060"},{"path":"assets/dm-sans-latin-ext-wght-normal-BOFOeGcA.woff2","bytes":18228,"sha256":"a5d38fe99f930275684999b462c7123faa063d9e44e73b4b241723d884aa0f49"},{"path":"assets/dm-sans-latin-wght-normal-Xz1IZZA0.woff2","bytes":36932,"sha256":"9fea608a947e67020c33cad9a6fe3d60c54119dfb8cff87768a8117a15ed7543"},{"path":"assets/haven-companions-cat-4rV17IN9.png","bytes":1231350,"sha256":"039df732c96633a8b57d7325551d7fb284c7be39304cc9602a31b214f90b1e3e"},{"path":"assets/haven-companions-dog-C_Avxq7A.png","bytes":1190045,"sha256":"06638659fcac56a8627ad152f5f926bbebbd91cd8347418b4dd1d033e02d069e"},{"path":"assets/haven-companions-reserve-CxrKZcaR.png","bytes":1068795,"sha256":"bd0e1d1eaa3db362e10292819da4f9d7d53e8420a87745a3349bfa3b2e751396"},{"path":"assets/haven-companions-safari-DNVy2oTC.png","bytes":1405068,"sha256":"e57b867628279dd2a64f0280eb445896e319d9142bd3d237ee3f3a3a031dd585"},{"path":"assets/haven-crops-growth-v047-Cv41UhXq.png","bytes":1801043,"sha256":"b719458c528a4d64c368d9a947291aa837c088099504d58be430cab688407f0d"},{"path":"assets/haven-crops-inventory-v047-DXmSSy5k.png","bytes":1989167,"sha256":"db91a19b1236d84224cc420ac5f0400c0cfef0dfbaf066aea60fc61debc0b871"},{"path":"assets/haven-facilities-v047-BhSn5R0l.png","bytes":2739855,"sha256":"70199098851b3e6d5ab6e718286f237b2b29d7628a097e66b82b7f7473af48a8"},{"path":"assets/haven-ground-landscape-RYW0cYT7.png","bytes":3873656,"sha256":"5fbdb3070149b5cc2e1a30ec3f1e5cf1c6322b838348d393d9f22a7aded9171a"},{"path":"assets/haven-ground-props-CwPWevi3.png","bytes":2564318,"sha256":"bba973f06c22bc69d19909d71c35aed1132fccecbac100f92dc0c1e01b3833c0"},{"path":"assets/haven-hero-actions-3fYZ4U9d.webp","bytes":1218026,"sha256":"53dd17bf1dcd5119f76175056a5df90d0858a5cdbf4775c8570dca2bf6afc921"},{"path":"assets/haven-hero-gathering-DD8A19bE.webp","bytes":1090974,"sha256":"ccaf91335771ae23bdba8b4c8b0320462174b9da082bbc443355e386a35ee329"},{"path":"assets/haven-hero-locomotion-_aPy7ZT_.webp","bytes":1190408,"sha256":"305f9430462782224edf2cc0b867f869f2a9c716344f80c825e1976ed4600154"},{"path":"assets/haven-hero-survivors-B2sShSwV.webp","bytes":1167606,"sha256":"f50c3d64b081dfbeb2bada9ee032e6ba73ce0ffd29da2b3e4a1aeaaea32a4e1d"},{"path":"assets/haven-infected-miniature-C5ZFEKhB.webp","bytes":482444,"sha256":"19f42092e741ae6532b0a0efaecaeebfef6e0dbecd52e7d01509212a6ac77111"},{"path":"assets/haven-items-miniature-CWyvCdAf.png","bytes":2296104,"sha256":"ac7202af9c9ce885b4a2d8d211f502929cf6e4101d948d37fc5bef90575c3e1a"},{"path":"assets/haven-truck-miniature-BEm5SmxQ.png","bytes":1851066,"sha256":"639db3e773a00df8e81a86636197465d212e715bf7ce419cb9f703a6dc89e207"},{"path":"assets/index-DNPvt_Au.css","bytes":295622,"sha256":"efc9dfbb6480b67cd71f7116d4ead0d6df8926c7efe22588685056d66e2d45ce"},{"path":"assets/index-DzCzuSxz.js","bytes":725904,"sha256":"f9a11fd9fd49035337a800afa17ca62f969cc3824c925934a2f44eb60a5fa9de"},{"path":"assets/pwa/road-haven-icon.png","bytes":3288409,"sha256":"8727a08b900599142a9882fa61e8f4c617ba8b8fc7df6292e182432be871991d"},{"path":"assets/skills-farm-anime-yMjBbn83.png","bytes":2786844,"sha256":"8c1c807a3c14355038ec31b552e14368818b18e8993f98424bb4670c4a02c933"},{"path":"assets/world-atlas-anime-j_pxBRxb.png","bytes":2951449,"sha256":"67f9c68491f282743b8245898b7e6c04e7f4072829cdf66639bec59ae7d2a57f"},{"path":"assets/world-parts-anime-CnA5nLkl.png","bytes":2821651,"sha256":"304e0e30cb1525a5a899057f7e00427061de2e5317012bbdbc457e7f840fb32c"},{"path":"assets/world-road-anime-CqYNuSrz.png","bytes":3665828,"sha256":"57384e426b7df1967ea42dd0e05b098315618ed35cd219dbd9ca04679877c78a"},{"path":"fonts/NotoSansKR-Variable.ttf","bytes":10414588,"sha256":"194018e6b2b293a7964f037b25c0249ce1418bc9ab3c971060a03aa57861e252"},{"path":"fonts/OFL-DMSans.txt","bytes":4502,"sha256":"6fbd040a29c2037a765dfb9f2561e9965b5c95c6dcb5dce516089d63d5f17af7"},{"path":"fonts/OFL-NotoSansKR.txt","bytes":4388,"sha256":"1c05c68c34f9708415aada51f17e1b0092d2cea709bf4a94cd38114f9e73d7d9"},{"path":"index.html","bytes":1280,"sha256":"877885c07a1ac1ddd401a2c76c26bf9cfc34586c43ab9d33b36c50ac99e84926"},{"path":"manifest.webmanifest","bytes":540,"sha256":"ba64070d12c73e525aefbc3c8e041c05e5c37907675377f7391f2f3cd960b731"}]});
