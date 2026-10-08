import { createHash, createPublicKey, sign, verify } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root=fileURLToPath(new URL('..',import.meta.url));
const [directory='dist',publicUrl]=process.argv.slice(2);
if(!publicUrl)throw Error('Usage: node scripts/create-content-release.mjs DIST_DIRECTORY HTTPS_CONTENT_ZIP_URL');
const {version}=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));
const {versionCode:contentVersion}=JSON.parse(readFileSync(join(root,'release-version.json'),'utf8'));
const config=JSON.parse(readFileSync(join(root,'content-release.json'),'utf8'));
const {minNativeVersionCode,maxNativeVersionCode}=config;
if(![contentVersion,minNativeVersionCode,maxNativeVersionCode].every(n=>Number.isSafeInteger(n)&&n>=1&&n<=2100000000)||minNativeVersionCode>maxNativeVersionCode||maxNativeVersionCode>contentVersion)throw Error('Invalid native/content compatibility versions.');
const name=`road-haven-${version}-content.zip`,url=new URL(publicUrl);
if(url.protocol!=='https:'||url.hostname!=='raw.githubusercontent.com'||url.port||url.username||url.password||url.search||url.hash||url.pathname!==`/h0623-dev/House/gh-pages/content/${name}`)throw Error('Use the pinned public content destination and expected archive filename.');
const source=resolve(root,directory),files={},hash=data=>createHash('sha256').update(data).digest('hex');
let bytes=0;
function scan(folder){for(const entry of readdirSync(folder,{withFileTypes:true})){
 const file=join(folder,entry.name),name=relative(source,file).replaceAll('\\','/');
 if(entry.isSymbolicLink())throw Error('Content release must not include symbolic links.');
 if(entry.isDirectory()){scan(file);continue;}
 if(name==='.nojekyll')continue;
 if(!entry.isFile()||!(name==='index.html'||name.startsWith('assets/')||name.startsWith('fonts/'))||!name.match(/^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*$/)||name.split('/').some(s=>s==='.'||s==='..'))throw Error(`Unexpected content file: ${name}`);
 bytes+=statSync(file).size;files[name]=hash(readFileSync(file));
}}
scan(source);
if(!files['index.html']||Object.keys(files).length>200||bytes>200*1024*1024)throw Error('Content bundle exceeds the validated format.');
const artifacts=join(root,'artifacts');mkdirSync(artifacts,{recursive:true});
const archive=join(artifacts,name);
execFileSync('python3',['-c',"import pathlib,sys,zipfile; root=pathlib.Path(sys.argv[1]); names=sys.argv[3:]; z=zipfile.ZipFile(sys.argv[2],'w',zipfile.ZIP_DEFLATED); [z.write(root/n,n) for n in names]; z.close()",source,archive,...Object.keys(files).sort()]);
if(statSync(archive).size>100*1024*1024)throw Error('Content archive exceeds the download limit.');
const payload=Buffer.from(JSON.stringify({version,contentVersion,minNativeVersionCode,maxNativeVersionCode,url:url.href,sha256:hash(readFileSync(archive)),files,publishedAt:new Date().toISOString()}));
const keyPath=process.env.CONTENT_SIGNING_KEY_PATH||'/workspace/.road-haven-signing/content-update-private.pem';
const privateKey=readFileSync(keyPath),signature=sign('sha256',payload,privateKey);
const pinnedKey=readFileSync(join(root,'android/app/src/main/java/com/roadhaven/game/ContentUpdatePlugin.java'),'utf8').match(/(?:PINNED_)?PUBLIC_KEY\s*=\s*"([A-Za-z0-9+/=]+)"/)?.[1];
if(!pinnedKey||!verify('sha256',payload,createPublicKey({key:Buffer.from(pinnedKey,'base64'),format:'der',type:'spki'}),signature))throw Error('Content signing key does not match the native pinned key.');
const envelope={payload:payload.toString('base64'),signature:signature.toString('base64')};
writeFileSync(join(artifacts,'game-update.json'),JSON.stringify(envelope,null,2)+'\n');
writeFileSync(join(artifacts,`${name}.sha256`),`${hash(readFileSync(archive))}  ${name}\n`);
console.log(`Signed content release: ${name}; ${Object.keys(files).length} files; native versions ${minNativeVersionCode}–${maxNativeVersionCode}.`);
