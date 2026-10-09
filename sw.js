/* Road Haven atomic web content 0.20.0 */
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
})({"schema":1,"buildId":"6c8d1d39ab876a394e09657c452da60b3bdbe0fd897e0371e882cf93fdb432eb","version":"0.20.0","contentVersion":20,"base":"/House/","files":[{"path":".nojekyll","bytes":0,"sha256":"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"},{"path":"assets/battle-bridge-CshNqkaE.png","bytes":3680793,"sha256":"371c397ced7ca06ce87cc4638d7140988573c78f29ff70c713c0a8a9b9c499a0"},{"path":"assets/battle-checkpoint-DRTJ197s.png","bytes":3604385,"sha256":"fad9daef2c707dddf4f37fbc81ba20106b3fb16132dc612d8bceda53b87b59b0"},{"path":"assets/battle-forest-C51K6LMV.png","bytes":3873328,"sha256":"acce40107ff1dd6f4f7d5567c6e2a934c500aaf9890a55616b817761f5b5d391"},{"path":"assets/companions-cat-anime-DLqNb3YX.png","bytes":1697241,"sha256":"cd7531285cb2d7ac072fd84df4a76626ecdf54befd27706955fda2d091419a5e"},{"path":"assets/companions-reserve-anime-D_ilhqwL.png","bytes":1466917,"sha256":"c0268d933f6e1f29c76fb20cbc8f32f9f0b29bda2b17f6f7b918b46a27e61e6a"},{"path":"assets/creatures-anime-DdNIkJKd.png","bytes":2493525,"sha256":"5d1cf1176a79a677bdd135316f2f24d5abda68748747d78e28e9b16c8e03b060"},{"path":"assets/crops-anime-D9C4XKsQ.png","bytes":1735166,"sha256":"57ac079b21e0e7b97d66562fbf1dff65faba73d2b43bd9e6c06aa39f6c204d29"},{"path":"assets/dm-sans-latin-ext-wght-normal-BOFOeGcA.woff2","bytes":18228,"sha256":"a5d38fe99f930275684999b462c7123faa063d9e44e73b4b241723d884aa0f49"},{"path":"assets/dm-sans-latin-wght-normal-Xz1IZZA0.woff2","bytes":36932,"sha256":"9fea608a947e67020c33cad9a6fe3d60c54119dfb8cff87768a8117a15ed7543"},{"path":"assets/index-CWqW4lop.js","bytes":325403,"sha256":"37183d3eb48da3e4cdd6cb58871a212e3cbe638684cc336995d8821c3c839953"},{"path":"assets/index-CfkaeVvu.css","bytes":154678,"sha256":"cd6ebc9a5c9283dc4b7764dbbe427527a2ec39f060cfcbbaa9b722138f91042a"},{"path":"assets/items-anime-BFjuG2x0.png","bytes":2446531,"sha256":"d7d62a625c2f1929a8479e780059e433347eb032ece4fee12be2e4d64783a842"},{"path":"assets/pwa/road-haven-icon.png","bytes":3288409,"sha256":"8727a08b900599142a9882fa61e8f4c617ba8b8fc7df6292e182432be871991d"},{"path":"assets/settlement-buildings-BujeG0ZI.png","bytes":2573254,"sha256":"ebc9837dc05533cf466108aa95939474b65ea68f5edd93cffa607efd29d0e587"},{"path":"assets/skills-farm-anime-yMjBbn83.png","bytes":2786844,"sha256":"8c1c807a3c14355038ec31b552e14368818b18e8993f98424bb4670c4a02c933"},{"path":"assets/survivors-actions-DljXGqPS.png","bytes":2386618,"sha256":"16100023bd05e12aece0cb46910d6b4b5356b6e257e4cdf758a9f78b9794b06d"},{"path":"assets/survivors-anime-B10LrHeL.png","bytes":2302538,"sha256":"739489bddecb6f08bcd7383783a85bc8f3a059cb973961bc7b3362afe5dc4915"},{"path":"assets/survivors-gathering-CwcR0tbO.png","bytes":1706850,"sha256":"9909fc86921be824e365c1ed533fecc4bdbc026b8779c91f114ebfaa8b531769"},{"path":"assets/survivors-locomotion-DGF7tlBo.png","bytes":2307891,"sha256":"242526090add97d0644cc04e085747102d16a9821acbc1040de009314582c4d0"},{"path":"assets/world-atlas-anime-j_pxBRxb.png","bytes":2951449,"sha256":"67f9c68491f282743b8245898b7e6c04e7f4072829cdf66639bec59ae7d2a57f"},{"path":"assets/world-parts-anime-CnA5nLkl.png","bytes":2821651,"sha256":"304e0e30cb1525a5a899057f7e00427061de2e5317012bbdbc457e7f840fb32c"},{"path":"assets/world-road-anime-CqYNuSrz.png","bytes":3665828,"sha256":"57384e426b7df1967ea42dd0e05b098315618ed35cd219dbd9ca04679877c78a"},{"path":"fonts/NotoSansKR-Variable.ttf","bytes":10414588,"sha256":"194018e6b2b293a7964f037b25c0249ce1418bc9ab3c971060a03aa57861e252"},{"path":"fonts/OFL-DMSans.txt","bytes":4502,"sha256":"6fbd040a29c2037a765dfb9f2561e9965b5c95c6dcb5dce516089d63d5f17af7"},{"path":"fonts/OFL-NotoSansKR.txt","bytes":4388,"sha256":"1c05c68c34f9708415aada51f17e1b0092d2cea709bf4a94cd38114f9e73d7d9"},{"path":"index.html","bytes":1280,"sha256":"0af0850b4f0d7e02b7115677f7133b51cc3bd0068c79c2424ad32b9874cf2a30"},{"path":"manifest.webmanifest","bytes":510,"sha256":"58e1774f8de2bc0dbbcfc16bd08bcf18fc528afa00cbd27d922e563e35768f7e"}]});
