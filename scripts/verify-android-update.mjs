import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const [previousApk, nextApk] = process.argv.slice(2);
if (!previousApk || !nextApk) {
  throw new Error('Usage: node scripts/verify-android-update.mjs PREVIOUS_APK NEXT_APK');
}
const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || '/workspace/android-sdk';
const buildTools = join(sdk, 'build-tools', '35.0.0');

function run(tool, args) {
  const result = spawnSync(join(buildTools, tool), args, { encoding: 'utf8' });
  if (result.error || result.status !== 0) {
    throw new Error(`${tool} verification failed: ${result.error?.message || result.stderr || result.stdout}`);
  }
  return result.stdout;
}

function inspect(apk) {
  const signature = run('apksigner', ['verify', '--print-certs', apk]);
  const signers = [...signature.matchAll(/^Signer #\d+ certificate SHA-256 digest: ([a-f\d]+)$/gmi)]
    .map((match) => match[1].toLowerCase()).sort();
  if (!signers.length) throw new Error(`No verified signing certificate found in ${apk}`);
  const metadata = run('aapt', ['dump', 'badging', apk]);
  const app = metadata.match(/^package: name='([^']+)' versionCode='(\d+)' versionName='([^']+)'/m);
  if (!app) throw new Error(`Cannot read Android package identity from ${apk}`);
  return { packageName: app[1], versionCode: Number(app[2]), version: app[3], signers };
}

const previous = inspect(previousApk);
const next = inspect(nextApk);
if (previous.packageName !== next.packageName) {
  throw new Error('APK package IDs differ; this would install a separate app.');
}
if (JSON.stringify(previous.signers) !== JSON.stringify(next.signers)) {
  throw new Error('APK signing certificates differ; Android cannot update the installed app in place. Restore its original signing key.');
}
if (next.versionCode <= previous.versionCode) {
  throw new Error(`The new Android version code (${next.versionCode}) must exceed the installed version (${previous.versionCode}).`);
}
console.log(JSON.stringify({
  updateCompatible: true,
  packageName: next.packageName,
  previousVersion: previous.version,
  nextVersion: next.version,
  previousVersionCode: previous.versionCode,
  nextVersionCode: next.versionCode,
  signerSha256: next.signers,
}, null, 2));
