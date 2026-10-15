import { createHash, createPublicKey, generateKeyPairSync, randomBytes } from 'node:crypto';
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const configPath = join(root, 'landscape-release.json');
const config = JSON.parse(readFileSync(configPath, 'utf8'));
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const { versionCode } = JSON.parse(readFileSync(join(root, 'release-version.json'), 'utf8'));
const signingDir = resolve(root, '../.road-haven-landscape-signing');
const credentialsPath = join(signingDir, 'credentials.json');
const keyStore = join(signingDir, 'landscape.keystore');
const contentKey = join(signingDir, 'content-update-private.pem');
const javaHome = process.env.JAVA_HOME || '/workspace/java/current';
const androidHome = process.env.ANDROID_HOME || '/workspace/android-sdk';
const keytool = join(javaHome, 'bin/keytool');
const apksigner = join(androidHome, 'build-tools/35.0.0/apksigner');
const digest = data => createHash('sha256').update(data).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
function need(condition, message) { if (!condition) throw Error(message); }
need(config.applicationId === 'com.roadhaven.landscape' && config.branch === 'landscape-releases', 'This script only builds the separately installed landscape application.');
need(existsSync(keytool) && existsSync(apksigner), 'Install the existing JDK21 and Android35 developer tools first.');
const initial = process.argv.includes('--initialize-signing');
if (initial) {
  need(config.apkCertificateSha256 === null && config.contentPublicKeyBase64 === null, 'This app already has a signing identity. Restore it; never generate a replacement.');
  need(!existsSync(signingDir), 'A signing directory already exists; preserve and inspect it instead of overwriting.');
  mkdirSync(signingDir, { mode: 0o700 });
  const storePassword = randomBytes(32).toString('base64url');
  const keyAlias = 'road-haven-landscape';
  const credentials = { storePassword, keyAlias };
  // Only this brand-new application is authorized to create a signing identity.
  // Password values stay in a private file and child environment, never argv/logs.
  writeFileSync(credentialsPath, json(credentials), { flag: 'wx', mode: 0o600 });
  execFileSync(keytool, ['-genkeypair', '-keystore', keyStore, '-storetype', 'PKCS12',
    '-storepass:env', 'ROAD_HAVEN_STORE_PASSWORD', '-keypass:env', 'ROAD_HAVEN_STORE_PASSWORD',
    '-alias', keyAlias, '-keyalg', 'RSA', '-keysize', '3072', '-sigalg', 'SHA256withRSA',
    '-validity', '10000', '-dname', 'CN=Road Haven Landscape,O=Road Haven,C=KR', '-noprompt'],
  { env: { ...process.env, ROAD_HAVEN_STORE_PASSWORD: storePassword }, stdio: ['ignore', 'ignore', 'inherit'] });
  chmodSync(keyStore, 0o600);
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  writeFileSync(contentKey, privateKey.export({ format: 'pem', type: 'pkcs8' }), { flag: 'wx', mode: 0o600 });
  const publicDer = publicKey.export({ format: 'der', type: 'spki' });
  const certificate = execFileSync(keytool, ['-exportcert', '-keystore', keyStore,
    '-storepass:env', 'ROAD_HAVEN_STORE_PASSWORD', '-alias', keyAlias],
  { env: { ...process.env, ROAD_HAVEN_STORE_PASSWORD: storePassword }, stdio: ['ignore', 'pipe', 'pipe'] });
  config.apkCertificateSha256 = digest(certificate);
  config.contentPublicKeyBase64 = publicDer.toString('base64');
  config.contentPublicKeySha256 = digest(publicDer);
  need(config.apkCertificateSha256 !== '98e59ea18bbe1b20f7c0e172bbed1414e2a8b3a25d20471b00c80c35e5995be4', 'Separate app must have its own APK certificate.');
  writeFileSync(configPath, json(config));
  const backup = resolve(root, '../.road-haven-landscape-signing-backup.zip');
  need(!existsSync(backup), 'Preserve the existing private signing backup.');
  execFileSync('python3', ['-c',
    'import pathlib,sys,zipfile; p=pathlib.Path(sys.argv[1]); z=zipfile.ZipFile(sys.argv[2],"x",zipfile.ZIP_DEFLATED); [z.write(p/n,n) for n in ["credentials.json","landscape.keystore","content-update-private.pem"]]; z.close()', signingDir, backup]);
  chmodSync(backup, 0o600);
  console.log('Created the separate app signing identity and private backup outside Git.');
}
need(config.apkCertificateSha256 && config.contentPublicKeyBase64 && config.contentPublicKeySha256, 'Initialize this new app once with --initialize-signing; otherwise restore its original keys.');
need(existsSync(credentialsPath) && existsSync(keyStore) && existsSync(contentKey), 'Restore the separate app signing directory. Missing keys must never be regenerated.');
const credentials = JSON.parse(readFileSync(credentialsPath, 'utf8'));
const publicDer = createPublicKey(readFileSync(contentKey)).export({ format: 'der', type: 'spki' });
need(digest(publicDer) === config.contentPublicKeySha256 && publicDer.toString('base64') === config.contentPublicKeyBase64, 'Content signing key does not match the saved landscape identity.');
const keyEnv = { ...process.env, ROAD_HAVEN_STORE_PASSWORD: credentials.storePassword };
const certificate = execFileSync(keytool, ['-exportcert', '-keystore', keyStore,
  '-storepass:env', 'ROAD_HAVEN_STORE_PASSWORD', '-alias', credentials.keyAlias],
{ env: keyEnv, stdio: ['ignore', 'pipe', 'pipe'] });
need(digest(certificate) === config.apkCertificateSha256, 'APK signing key does not match the saved landscape identity.');
const channel = `https://raw.githubusercontent.com/h0623-dev/House/${config.branch}`;
const webDir = `artifacts/native-landscape-v${versionCode.toString().padStart(3, '0')}`;
const output = join(root, 'artifacts', `road-haven-landscape-${version}.apk`);
need(!existsSync(output), 'A versioned landscape APK already exists; preserve it and increase the version for a new release.');
const env = {
  ...process.env, JAVA_HOME: javaHome, PATH: `${javaHome}/bin:${process.env.PATH}`,
  ANDROID_HOME: androidHome, ANDROID_SDK_ROOT: androidHome,
  ANDROID_USER_HOME: resolve(root, '../.android'), ANDROID_SDK_HOME: resolve(root, '..'),
  GRADLE_USER_HOME: resolve(root, '../.gradle'),
  APP_VERSION_CODE: String(versionCode), VITE_APP_VERSION_CODE: String(versionCode), VITE_APP_VERSION: version,
  VITE_PWA_ENABLED: '0', VITE_UPDATE_MANIFEST_URL: `${channel}/update.json`,
  ROAD_HAVEN_APP_ID: config.applicationId, ROAD_HAVEN_APP_LABEL: config.appName,
  ROAD_HAVEN_WEB_DIR: webDir, ROAD_HAVEN_CONTENT_MANIFEST_URL: `${channel}/game-update.json`,
  ROAD_HAVEN_CONTENT_PUBLIC_KEY_BASE64: config.contentPublicKeyBase64,
  ANDROID_KEYSTORE_PATH: keyStore, ANDROID_KEYSTORE_PASSWORD: credentials.storePassword,
  ANDROID_KEY_ALIAS: credentials.keyAlias, ANDROID_KEY_PASSWORD: credentials.storePassword,
};
function run(executable, args, cwd = root) { execFileSync(executable, args, { cwd, env, stdio: 'inherit' }); }
run('npm', ['run', 'build', '--', '--outDir', webDir, '--emptyOutDir']);
run('npx', ['--no-install', 'cap', 'sync', 'android']);
run('./gradlew', ['assembleRelease', '--no-daemon', '--max-workers=4', '--console=plain'], join(root, 'android'));
const builtApk = join(root, 'android/app/build/outputs/apk/release/app-release.apk');
const signature = execFileSync(apksigner, ['verify', '--verbose', '--print-certs', builtApk], { env, encoding: 'utf8' });
need(signature.includes(`certificate SHA-256 digest: ${config.apkCertificateSha256}`), 'Built APK certificate differs from the saved landscape identity.');
const badging = execFileSync(join(androidHome, 'build-tools/35.0.0/aapt'), ['dump', 'badging', builtApk], { env, encoding: 'utf8' });
need(badging.includes(`name='${config.applicationId}'`) && badging.includes(`versionCode='${versionCode}'`), 'APK identity or version differs from the separate app configuration.');
need(badging.includes(`application-label:'${config.appName}'`), 'APK launcher label must distinguish it from the original app.');
mkdirSync(dirname(output), { recursive: true });
copyFileSync(builtApk, output);
writeFileSync(`${output}.sha256`, `${digest(readFileSync(output))}  ${output.split('/').pop()}\n`);
writeFileSync(join(root, 'artifacts/landscape-build-info.json'), json({
  version, versionCode, applicationId: config.applicationId, appName: config.appName,
  apkCertificateSha256: config.apkCertificateSha256, contentPublicKeySha256: config.contentPublicKeySha256,
  nativeWebDirectory: webDir, apkPath: output, apkSha256: digest(readFileSync(output)),
  updateManifest: `${channel}/update.json`, contentManifest: `${channel}/game-update.json`,
}));
console.log(`Signed separately installed landscape APK ready: ${output}`);
