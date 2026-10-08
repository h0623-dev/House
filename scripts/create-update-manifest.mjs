import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const [apkPath, apkUrl, rawVersionCode] = process.argv.slice(2);
if (!apkPath || !apkUrl || !rawVersionCode) {
  throw new Error('Usage: node scripts/create-update-manifest.mjs APK_PATH HTTPS_APK_URL VERSION_CODE');
}
const url = new URL(apkUrl);
if (url.protocol !== 'https:' || url.username || url.password) {
  throw new Error('The APK must have a public HTTPS URL without embedded credentials.');
}
const versionCode = Number(rawVersionCode);
if (!Number.isSafeInteger(versionCode) || versionCode < 1 || versionCode > 2100000000) {
  throw new Error('VERSION_CODE must be an integer from 1 to 2100000000.');
}
const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const { minNativeVersionCode } = JSON.parse(readFileSync(new URL('../content-release.json', import.meta.url), 'utf8'));
if (!Number.isSafeInteger(minNativeVersionCode) || minNativeVersionCode < 1 || minNativeVersionCode > versionCode) {
  throw new Error('Content compatibility must specify a valid minimum native version.');
}
const sha256 = createHash('sha256').update(readFileSync(apkPath)).digest('hex');
const output = join(dirname(apkPath), 'update.json');
writeFileSync(output, JSON.stringify({
  version,
  versionCode,
  minimumNativeVersionCode: minNativeVersionCode,
  apkUrl: url.href,
  sha256,
  notes: process.env.RELEASE_NOTES || `로드헤이븐 ${version} 업데이트`,
  publishedAt: new Date().toISOString(),
}, null, 2) + '\n');
console.log(`Update manifest ready: ${output}`);
