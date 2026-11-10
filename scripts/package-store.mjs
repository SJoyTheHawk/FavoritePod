import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { strToU8, zipSync } from 'fflate';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const manifest = JSON.parse(await readFile(join(dist, 'manifest.json'), 'utf8'));
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));

if (manifest.version !== pkg.version || !/^\d+(?:\.\d+){0,3}$/.test(manifest.version)) {
  throw new Error(
    'Build version does not match package.json. Run npm run package:store.',
  );
}

// Keep the key in local builds for a stable unpacked ID. Store uploads reject it.
delete manifest.key;

const files = {};
async function collect(directory, prefix = '') {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === '.DS_Store' || entry.name.startsWith('._')) continue;
    const name = prefix + entry.name;
    if (entry.isDirectory()) {
      await collect(join(directory, entry.name), name + '/');
    } else if (entry.isFile()) {
      files[name] =
        name === 'manifest.json'
          ? strToU8(JSON.stringify(manifest, null, 2) + '\n')
          : await readFile(join(directory, entry.name));
    }
  }
}
await collect(dist);

const release = join(root, 'release');
await mkdir(release, { recursive: true });
const output = join(release, `favoritepod-${manifest.version}.zip`);
await writeFile(output + '.tmp', zipSync(files));
await rename(output + '.tmp', output);
console.log(`Store upload ready: ${output}`);
console.log('Verified packaging: manifest.json is at the ZIP root; key is omitted.');
