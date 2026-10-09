import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Capture what is actually about to execute, before a browser or input starts.
// Final release checks require both immutable build manifests to exist.
export async function captureExecutionInputs(testUrl, { snapshotId, finalSnapshot, dependencies = [] }) {
 const root = fileURLToPath(new URL('../', import.meta.url));
 const testPath = relative(root, fileURLToPath(testUrl));
 const hash = async path => createHash('sha256').update(await readFile(resolve(root, path))).digest('hex');
 if (testPath.startsWith('..')) throw Error('The release test must be inside the repository');
 const directDependencyHashes = {};
 for (const path of ['tests/release-execution-inputs.mjs', ...dependencies]) {
  if (path.startsWith('/') || path.split('/').includes('..')) throw Error('Unsafe test dependency path');
  directDependencyHashes[path] = await hash(path);
 }
 const result = { testPath, testSha256: await hash(testPath), directDependencyHashes };
 if (finalSnapshot) {
  if (!/^v\d{3}-r[1-9]\d*$/.test(snapshotId)) throw Error('A final test requires an immutable snapshot ID');
  const manifestPath = `artifacts/qa-snapshot-${snapshotId}.json`;
  const sourceCapturePath = `artifacts/native-${snapshotId.split('-')[0]}-build-source-snapshot.json`;
  const manifest = JSON.parse(await readFile(resolve(root, manifestPath), 'utf8'));
  if (manifest.snapshotId !== snapshotId) throw Error('Snapshot identity differs from this execution');
  Object.assign(result, { snapshotManifestPath: manifestPath, snapshotManifestSha256: await hash(manifestPath),
   sourceCapturePath, sourceCaptureSha256: await hash(sourceCapturePath) });
 }
 return result;
}
