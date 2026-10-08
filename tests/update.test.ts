import test from 'node:test';
import assert from 'node:assert/strict';
import { checkUpdate, parseRelease, shouldOfferUpdate, parseAutomaticUpdateState, initializeAutoUpdates, prepareAutomaticUpdate, installPreparedUpdate, isNativeUpdateSupported, type Release } from '../src/update.ts';

const validRelease: Release = {
  version: '0.2.0',
  versionCode: 2,
  apkUrl: 'https://github.com/h0623-dev/House/releases/download/v0.2.0/road-haven.apk',
  sha256: 'b'.repeat(64),
  notes: '새로운 텃밭과 도로 탐험이 추가됐어요.',
  publishedAt: '2026-10-08T00:00:00Z',
};

test('a release manifest preserves the APK URL, integrity metadata, and Korean release notes', () => {
  const input = Object.freeze({ ...validRelease });
  assert.deepEqual(parseRelease(input), validRelease);
  assert.equal(parseRelease({ ...validRelease, version: '1.2.3-beta.1', sha256: 'A'.repeat(64) }).version, '1.2.3-beta.1');
});

test('APK downloads reject insecure protocols and URL-embedded credentials', () => {
  for (const apkUrl of [
    'http://example.com/game.apk',
    'javascript:alert(1)',
    'data:application/octet-stream;base64,AA==',
    'file:///tmp/game.apk',
    '//example.com/game.apk',
    'game.apk',
    'https://username:password@example.com/game.apk',
    'https://username@example.com/game.apk',
    'https://@example.com/game.apk',
    'https://example.com/game.apk#fragment',
    'https://example.com/game.apk#',
  ]) {
    assert.throws(() => parseRelease({ ...validRelease, apkUrl }), undefined, apkUrl);
  }
});

test('version codes must support an unambiguous numeric upgrade comparison', () => {
  for (const versionCode of [0, -1, 1.5, '2', NaN, Infinity, 2100000001, Number.MAX_SAFE_INTEGER + 1, null, undefined]) {
    assert.throws(() => parseRelease({ ...validRelease, versionCode }), undefined, String(versionCode));
  }
  for (const version of ['1', '1.2', 'v1.2.3', 'latest', '', 123, null]) {
    assert.throws(() => parseRelease({ ...validRelease, version }), undefined, String(version));
  }
});

test('compatible signed game content does not require another Android engine installation', () => {
  const contentRelease = parseRelease({ ...validRelease, version:'0.9.0', versionCode:9, minimumNativeVersionCode:8 });
  assert.equal(shouldOfferUpdate(contentRelease, 8, true), false);
  assert.equal(shouldOfferUpdate(contentRelease, 7, true), true);
  assert.equal(shouldOfferUpdate(contentRelease, 8, false), true);
  assert.equal(shouldOfferUpdate({ ...contentRelease, minimumNativeVersionCode:undefined }, 8, true), true);
  for (const minimumNativeVersionCode of [0, -1, 1.5, '8', 10, NaN, Infinity, null]) {
    assert.throws(() => parseRelease({ ...contentRelease, minimumNativeVersionCode }));
  }
});

test('native download state keeps verified version and normalizes progress safely', () => {
  assert.deepEqual(parseAutomaticUpdateState({ status:'downloading', progress:37.8, message:'받는 중', version:'0.9.0', versionCode:9, downloadedBytes:400, totalBytes:1000, revision:3 }), {
    status:'downloading', progress:38, message:'받는 중', version:'0.9.0', versionCode:9, downloadedBytes:400, totalBytes:1000, revision:3,
  });
  assert.equal(parseAutomaticUpdateState({status:'ready',progress:110,message:'설치 준비됨'}).progress,100);
  assert.equal(parseAutomaticUpdateState({status:'permission',progress:-1,message:'Android 설치 허용'}).progress,0);
  assert.equal(parseAutomaticUpdateState({status:'error',progress:0,message:'재시도',downloadedBytes:-4}).downloadedBytes,undefined);
  for(const data of [null,{}, {status:'installed',progress:100,message:'bad'}, {status:'ready',progress:NaN,message:'bad'}, {status:'ready',progress:100}])assert.throws(()=>parseAutomaticUpdateState(data));
});

test('web previews never start native APK download or installation automatically', async () => {
  assert.equal(isNativeUpdateSupported(),false);
  let callbacks=0;
  assert.equal((await initializeAutoUpdates(()=>callbacks++)).status,'idle');
  assert.equal(callbacks,1);
  assert.equal((await prepareAutomaticUpdate(validRelease)).status,'idle');
  await assert.rejects(installPreparedUpdate(),/Android/);
});

test('missing or malformed checksum, publication date, or release notes invalidate the manifest', () => {
  for (const patch of [
    { sha256: '' }, { sha256: 'a'.repeat(63) }, { sha256: 'a'.repeat(65) },
    { sha256: 'z'.repeat(64) }, { sha256: 123 },
    { publishedAt: 'not-a-date' }, { publishedAt: '' }, { publishedAt: 123 },
    { notes: 'x'.repeat(5001) }, { notes: null }, { apkUrl: null },
  ]) {
    assert.throws(() => parseRelease({ ...validRelease, ...patch }));
  }
  for (const key of Object.keys(validRelease)) {
    const incomplete = { ...validRelease } as Record<string, unknown>;
    delete incomplete[key];
    assert.throws(() => parseRelease(incomplete), undefined, `missing ${key}`);
  }
});

test('unexpected JSON roots fail validation without reaching the download flow', () => {
  for (const data of [undefined, null, [], true, 2, 'release', {}]) {
    assert.throws(() => parseRelease(data));
  }
});

test('an unconfigured deployment reports its state without making a network request', async () => {
  const originalFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => { requests += 1; throw Error('unexpected network request'); };
  try {
    const result = await checkUpdate();
    assert.equal(result.status, 'unconfigured');
    assert.equal(result.release, undefined);
    assert.equal(requests, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
