import { createHash, createPublicKey, sign, verify } from 'node:crypto';
import { copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const [webDirectory, apkFile, outputDirectory] = process.argv.slice(2);
if (!webDirectory || !apkFile) {
  throw Error('Usage: node scripts/create-landscape-release.mjs NATIVE_WEB_DIRECTORY SIGNED_APK [OUTPUT_DIRECTORY]');
}
const requireRelease = (condition, message) => { if (!condition) throw Error(message); };
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const jsonFile = path => JSON.parse(readFileSync(path, 'utf8'));
const writeJson = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n');
const { version } = jsonFile(join(root, 'package.json'));
const { versionCode } = jsonFile(join(root, 'release-version.json'));
const config = jsonFile(join(root, 'landscape-release.json'));
const minimumNativeVersionCode = config.minimumNativeVersionCode ?? 42;
requireRelease(typeof version === 'string' && /^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/.test(version) && version.length <= 48, 'Landscape release requires a safe package version without filename-unsafe build metadata.');
requireRelease([versionCode, minimumNativeVersionCode].every(value => Number.isSafeInteger(value) && value >= 42 && value <= 2100000000) && minimumNativeVersionCode <= versionCode, 'Landscape native compatibility must start at 42 or later and not exceed the release version code.');
requireRelease(config.branch === 'landscape-releases' && config.applicationId === 'com.roadhaven.landscape', 'Landscape releases must use their separate app ID and landscape-releases branch.');
requireRelease(typeof config.appName === 'string' && config.appName.length > 0, 'Landscape release must specify its app label.');
requireRelease(/^[a-f0-9]{64}$/.test(config.apkCertificateSha256 || '') && /^[a-f0-9]{64}$/.test(config.contentPublicKeySha256 || ''), 'Landscape signing fingerprints must be recorded before packaging.');
requireRelease(config.apkCertificateSha256 !== '98e59ea18bbe1b20f7c0e172bbed1414e2a8b3a25d20471b00c80c35e5995be4' && config.contentPublicKeySha256 !== '8e7cea1e83713bc89bf09bf5368ca044dfaeaacb924a2094c0cd9d1c1cbd895a', 'Landscape app must retain its separate signing identity.');
const endpoint = `https://raw.githubusercontent.com/h0623-dev/House/${config.branch}`;
const apkName = `road-haven-landscape-${version}.apk`;
const contentName = `road-haven-landscape-${version}-content.zip`;
const web = resolve(root, webDirectory), apk = resolve(root, apkFile);
const output = resolve(root, outputDirectory || `artifacts/landscape-release-${version}`);
requireRelease(!existsSync(output), 'Release output already exists; preserve its earlier files.');
requireRelease(!lstatSync(web).isSymbolicLink() && statSync(web).isDirectory() && !lstatSync(apk).isSymbolicLink() && statSync(apk).isFile(), 'Native web input and signed APK must be regular paths.');
requireRelease(statSync(apk).size > 0 && statSync(apk).size < 100 * 1024 * 1024, 'APK exceeds the GitHub per-file size limit.');

// These are packaging/signature checks, not game execution or gameplay tests.
const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || '/workspace/android-sdk';
const tools = join(sdk, 'build-tools', process.env.ANDROID_BUILD_TOOLS_VERSION || '35.0.0');
const run = (name, args) => execFileSync(join(tools, name), args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
const signature = run('apksigner', ['verify', '--print-certs', apk]);
const certificates = [...signature.matchAll(/^Signer #\d+ certificate SHA-256 digest: ([a-f\d]+)$/gmi)].map(match => match[1].toLowerCase());
requireRelease(certificates.length === 1 && certificates[0] === config.apkCertificateSha256, 'APK signing certificate differs from the recorded landscape identity. Restore its key; do not replace the fingerprint.');
const badging = run('aapt', ['dump', 'badging', apk]);
const identity = badging.match(/^package: name='([^']+)' versionCode='(\d+)' versionName='([^']+)'/m);
requireRelease(identity && identity[1] === config.applicationId && Number(identity[2]) === versionCode && identity[3] === version, 'Signed APK package or version differs from the landscape release configuration.');
const label = badging.match(/^application-label:'([^']+)'$/m)?.[1];
requireRelease(label === config.appName, 'Signed APK label differs from the landscape release configuration.');

const generatedPath = resolve(root, process.env.LANDSCAPE_BUILD_CONFIG_PATH || 'android/app/build/generated/source/buildConfig/release/com/roadhaven/game/BuildConfig.java');
const generated = readFileSync(generatedPath, 'utf8');
const generatedString = name => {
  const encoded = generated.match(new RegExp(`\\b${name}\\s*=\\s*("(?:[^"\\\\]|\\\\.)*")\\s*;`))?.[1];
  return encoded ? JSON.parse(encoded) : undefined;
};
const generatedCode = Number(generated.match(/\bVERSION_CODE\s*=\s*(\d+)\s*;/)?.[1]);
requireRelease(generatedString('APPLICATION_ID') === config.applicationId && generatedString('VERSION_NAME') === version && generatedCode === versionCode, 'Generated native BuildConfig does not match the signed APK release.');
requireRelease(generatedString('ROAD_HAVEN_CONTENT_MANIFEST_URL') === `${endpoint}/game-update.json`, 'Generated native content updater uses the wrong release channel.');
requireRelease(generatedString('ROAD_HAVEN_CONTENT_PUBLIC_KEY_BASE64') === config.contentPublicKeyBase64, 'Generated native content public pin differs from the recorded landscape identity.');

const keyPath = resolve(root, process.env.LANDSCAPE_CONTENT_SIGNING_KEY_PATH || '../.road-haven-landscape-signing/content-update-private.pem');
const privateKey = readFileSync(keyPath);
const publicKey = createPublicKey(privateKey);
requireRelease(publicKey.asymmetricKeyType === 'ec' && publicKey.asymmetricKeyDetails?.namedCurve === 'prime256v1', 'Landscape content signing requires its P-256 private key.');
const publicDer = publicKey.export({ format: 'der', type: 'spki' });
requireRelease(sha256(publicDer) === config.contentPublicKeySha256 && publicDer.toString('base64') === config.contentPublicKeyBase64, 'Content private key differs from the recorded landscape public pin. Restore its key; do not replace the fingerprint.');

const files = {};
let expandedBytes = 0;
function scan(folder) {
  for (const entry of readdirSync(folder, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const path = join(folder, entry.name), name = relative(web, path).replaceAll('\\', '/');
    requireRelease(!entry.isSymbolicLink(), 'Native web release cannot contain symbolic links.');
    if (entry.isDirectory()) { scan(path); continue; }
    requireRelease(entry.isFile() && /^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*$/.test(name) && !name.split('/').some(part => part === '.' || part === '..'), `Unsafe native content path: ${name}`);
    requireRelease(name === 'index.html' || name.startsWith('assets/') || name.startsWith('fonts/'), `Non-native or PWA output is not allowed: ${name}`);
    expandedBytes += statSync(path).size;
    files[name] = sha256(readFileSync(path));
  }
}
scan(web);
requireRelease(files['index.html'] && Object.keys(files).length <= 200 && expandedBytes <= 200 * 1024 * 1024, 'Native content exceeds the supported file count/size or lacks index.html.');
const bundledJavaScript = Object.keys(files).filter(name => name.endsWith('.js')).map(name => readFileSync(join(web, name), 'utf8')).join('\n');
requireRelease(bundledJavaScript.includes(`${endpoint}/update.json`) && !bundledJavaScript.includes('https://raw.githubusercontent.com/h0623-dev/House/gh-pages/update.json'), 'Native web input must use the independent APK update channel.');

// Bind the content archive to the web files actually included in this signed APK.
const apkWeb = JSON.parse(execFileSync('python3', ['-c', `import hashlib,json,sys,zipfile
with zipfile.ZipFile(sys.argv[1]) as z:
 result={}
 for n in z.namelist():
  if not n.startswith('assets/public/') or n.endswith('/'): continue
  p=n[len('assets/public/'):]
  if p=='index.html' or p.startswith(('assets/','fonts/')):
   if p in result: raise ValueError('Duplicate APK web entry')
   result[p]=hashlib.sha256(z.read(n)).hexdigest()
 print(json.dumps(result,sort_keys=True))`, apk], { encoding: 'utf8', maxBuffer: 1024 * 1024 }));
const sortedEntries = value => JSON.stringify(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));
requireRelease(sortedEntries(apkWeb) === sortedEntries(files), 'Fresh web input differs from the web content bundled in the signed APK.');

mkdirSync(join(output, 'downloads'), { recursive: true });
mkdirSync(join(output, 'content'), { recursive: true });
const archive = join(output, 'content', contentName);
execFileSync('python3', ['-c', "import pathlib,sys,zipfile; root=pathlib.Path(sys.argv[1]); names=sys.argv[3:]; z=zipfile.ZipFile(sys.argv[2],'w',zipfile.ZIP_DEFLATED); [z.write(root/n,n) for n in names]; z.close()", web, archive, ...Object.keys(files).sort()]);
requireRelease(statSync(archive).size < 100 * 1024 * 1024, 'Content ZIP exceeds the native/GitHub download limit.');
const publishedAt = new Date().toISOString();
const payload = Buffer.from(JSON.stringify({ version, contentVersion: versionCode,
  minNativeVersionCode: minimumNativeVersionCode, maxNativeVersionCode: versionCode,
  url: `${endpoint}/content/${contentName}`, sha256: sha256(readFileSync(archive)), files, publishedAt }));
const contentSignature = sign('sha256', payload, privateKey);
requireRelease(verify('sha256', payload, publicKey, contentSignature), 'Content signature could not be authenticated with the pinned landscape key.');
copyFileSync(apk, join(output, 'downloads', apkName));
writeJson(join(output, 'game-update.json'), { payload: payload.toString('base64'), signature: contentSignature.toString('base64') });
writeJson(join(output, 'update.json'), { version, versionCode, minimumNativeVersionCode,
  apkUrl: `${endpoint}/downloads/${apkName}`, sha256: sha256(readFileSync(apk)),
  notes: process.env.LANDSCAPE_RELEASE_NOTES || `로드헤이븐 가로 ${version} 업데이트 · 기존 앱과 별도로 설치되는 가로 화면 앱이에요.`, publishedAt });
console.log(JSON.stringify({ output, applicationId: config.applicationId, version, versionCode,
  nativeCompatibility: [minimumNativeVersionCode, versionCode], contentFiles: Object.keys(files).length,
  contentBytes: statSync(archive).size, apkBytes: statSync(apk).size,
  apkCertificateSha256: config.apkCertificateSha256, contentPublicKeySha256: config.contentPublicKeySha256,
  privateKeysPublished: false, legacyChannelChanged: false }, null, 2));
