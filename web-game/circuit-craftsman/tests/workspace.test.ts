import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';
import { ART_FILES } from '../src/art-files';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (path: string) => readFileSync(resolve(root, path));

test('case retains runtime artwork and original Canvas sources without build or export copies', () => {
  const assets = JSON.parse(read('canvas/assets.json').toString()).assets;
  const runtime = new Set(Object.values(ART_FILES).map(path => `public/art/circuit-craftsman/${path}`));
  for (const asset of Object.values(assets) as { path: string }[]) {
    assert(runtime.has(asset.path) || asset.path === 'assets/concept.webp' || asset.path === 'assets/imported/output.webp', asset.path);
    assert(existsSync(resolve(root, asset.path)), asset.path);
  }
  assert.deepEqual(readdirSync(resolve(root, 'assets')).filter(file => file !== '.DS_Store').sort(), ['concept.webp', 'imported']);
  for (const directory of ['art', 'scripts', 'assets/generated', 'assets/circuit-v2', 'assets/ui-v3', 'assets/localization']) assert(!existsSync(resolve(root, directory)), directory);
  assert.equal(assets['localization-v4-final-logo-en'].path, `public/art/circuit-craftsman/${ART_FILES['logo-small-en']}`);
  const metadata = JSON.parse(read('package.json').toString());
  for (const name of ['@resvg/resvg-js', '@fontsource/noto-sans-sc', '@fontsource/nunito']) {
    assert(!metadata.dependencies?.[name] && !metadata.devDependencies?.[name], name);
  }
  assert(!metadata.scripts['art:pack']);
});

test('font subsets remain embedded once with both distribution licenses', () => {
  let count = 0;
  postcss.parse(read('src/fonts.css').toString()).walkDecls('src', declaration => {
    const base64 = declaration.value.match(/data:font\/woff2;base64,([^']+)/)?.[1];
    assert(base64, 'Every font source is local and embedded');
    assert.equal(Buffer.from(base64, 'base64').subarray(0, 4).toString(), 'wOF2');
    count++;
  });
  assert(count > 0);
  assert(!readdirSync(resolve(root, 'src/fonts')).some(file => /\.woff2?$/.test(file)));
  for (const family of ['noto-sans-sc', 'nunito']) assert(read(`src/fonts/${family}-LICENSE.txt`).length > 100);
});
