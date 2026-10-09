import { build } from 'esbuild';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// A portable browser copy: the game, CSS and fonts all live in one HTML file.
// Run from any directory with: node scripts/build-standalone.mjs
const root = fileURLToPath(new URL('../', import.meta.url));
const packageInfo = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const result = await build({
  absWorkingDir: root,
  entryPoints: ['src/main.ts'],
  outfile: 'standalone.js',
  bundle: true,
  write: false,
  minify: true,
  platform: 'browser',
  format: 'iife',
  target: ['es2022'],
  // The offline file has no remote update endpoint or injected environment values.
  define: { 'import.meta.env': '{}', '__ROAD_HAVEN_WEB_PWA__': 'false' },
  loader: {
    '.ttf': 'dataurl',
    '.woff': 'dataurl',
    '.woff2': 'dataurl',
    '.png': 'dataurl',
    '.jpg': 'dataurl',
    '.svg': 'dataurl',
  },
  plugins: [{
    name: 'public-fonts',
    setup(builder) {
      builder.onResolve({ filter: /^\/fonts\// }, ({ path: asset }) => ({
        path: path.join(root, 'public', asset),
      }));
    },
  }],
});
const javascript = result.outputFiles.find(file => file.path.endsWith('.js'))?.text;
const stylesheet = result.outputFiles.find(file => file.path.endsWith('.css'))?.text;
if (!javascript || !stylesheet || result.outputFiles.length !== 2) {
  throw new Error('Expected one JavaScript bundle and one self-contained stylesheet.');
}
if (/url\((?!["']?data:)/i.test(stylesheet)) {
  throw new Error('The portable stylesheet still references an external resource.');
}
const licenses = await Promise.all([
  readFile(path.join(root, 'public/fonts/OFL-NotoSansKR.txt'), 'utf8'),
  readFile(path.join(root, 'node_modules/@fontsource-variable/dm-sans/LICENSE'), 'utf8'),
]);
const source = await readFile(path.join(root, 'index.html'), 'utf8');
const html = source
  .replace(/<(?:link|meta)\b[^>]*\bdata-pwa-only\b[^>]*>\s*/g, '')
  .replace(/<title>.*?<\/title>/, '<title>RoadHaven browser play · 로드헤이븐</title>')
  .replace('</head>', () => `<link rel="icon" href="data:,"><style>${stylesheet.replace(/<\/style/gi, '<\\/style')}</style></head>`)
  .replace('<script type="module" src="/src/main.ts"></script>',
    () => `<noscript>로드헤이븐을 플레이하려면 브라우저에서 JavaScript를 켜 주세요.</noscript><script>${javascript.replace(/<\/script/gi, '<\\/script')}</script>`);
const licensedHtml = html.replace('</body>', () => `<script type="text/plain" id="font-licenses">${licenses.join('\n\n').replace(/<\/script/gi, '<\\/script')}</script></body>`);
const output = path.join(root, 'artifacts', `road-haven-${packageInfo.version}-play.html`);
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, licensedHtml);
console.log(`${output} (${Buffer.byteLength(licensedHtml)} bytes)`);
