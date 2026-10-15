import { link, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Older workers intercept /assets and the root document. Keep this entry and
 * its executable files on an otherwise unused path, without clearing saves,
 * unregistering workers, or taking over other running games. */
export async function createWebEntry(outDir, { base = '/House/', version }) {
  if (!/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(version)) throw Error('Invalid web entry version');
  if (!base.startsWith('/') || !base.endsWith('/') || base.includes('..') || base.includes('//')) throw Error('Invalid web entry base');
  // Only this freshly generated output is replaced. Published historical
  // aliases remain immutable, and hashed shared assets avoid 65 MB per patch.
  await rm(path.join(outDir, 'play'), { recursive: true, force: true });
  let aliases = 0;
  const rewrite = value => value.replaceAll(base + 'assets/', base + 'play/assets/')
    .replaceAll(base + 'fonts/', base + 'play/fonts/');
  async function publish(folder) {
    const source = path.join(outDir, folder), target = path.join(outDir, 'play', folder);
    await mkdir(target, { recursive: true });
    for (const entry of await readdir(source, { withFileTypes: true })) {
      const name = path.join(folder, entry.name);
      if (entry.isDirectory()) await publish(name);
      else if (entry.isFile()) {
        if (/\.(?:js|css)$/.test(entry.name)) {
          await writeFile(path.join(outDir, 'play', name), rewrite(await readFile(path.join(outDir, name), 'utf8')));
        } else {
          // Avoid another full local copy of painted art. GitHub Pages stores
          // these as ordinary files with the same existing Git blob bytes.
          await link(path.join(outDir, name), path.join(outDir, 'play', name));
        }
        aliases++;
      }
    }
  }
  await publish('assets');
  await publish('fonts');
  let html = await readFile(path.join(outDir, 'index.html'), 'utf8');
  html = rewrite(html);
  if (!html.includes(`src="${base}play/assets/`)) throw Error('The compiled game module is missing from the web entry');
  html = html.replace('</body>', `<small aria-label="실행 게임 버전" style="position:fixed;right:8px;bottom:calc(env(safe-area-inset-bottom,0px) + 3px);z-index:12;pointer-events:none;color:#345b47;background:#fff7dfd9;border-radius:4px;padding:2px 5px;font:10px sans-serif">v${version}</small></body>`);
  await writeFile(path.join(outDir, 'play.html'), html);
  const versioned = `play-v${version}.html`;
  await writeFile(path.join(outDir, versioned), html);
  return { path: base + 'play.html', versionedPath: base + versioned, version, aliases };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [outDir, version, base = '/House/'] = process.argv.slice(2);
  if (!outDir || !version) throw Error('Usage: create-web-entry.mjs OUT_DIR VERSION [BASE]');
  console.log(JSON.stringify(await createWebEntry(outDir, { base, version })));
}
