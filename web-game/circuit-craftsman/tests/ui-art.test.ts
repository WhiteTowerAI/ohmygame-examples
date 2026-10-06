import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ART_FILES } from '../src/art-files';
import { image, pixelTestOptions, artBytes, webpInfo } from './image';
const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('settings frame preserves transparent exterior, opaque ice-blue face and native switches', pixelTestOptions, () => {
  const panel = image('settings-panel');
  assert.deepEqual([panel.width, panel.height], [768, 544]);
  assert.equal(panel.data[3], 0);
  const center = (Math.floor(panel.height / 2) * panel.width + Math.floor(panel.width / 2)) * 4;
  assert.equal(panel.data[center + 3], 255);
  assert(panel.data[center + 2] >= panel.data[center + 1], 'The enamel face is ice blue, not green');
  const main = read('src/main.ts');
  assert(main.includes('role="switch" data-setting="sound"'));
  assert(main.includes('role="switch" data-setting="motion"'));
  assert(main.includes('--settings-image'));
});

test('graded backgrounds and settings share runtime WebP files with the compact Canvas', () => {
  const canvas = JSON.parse(read('canvas/assets.json')).assets;
  const manifest = JSON.parse(read('public/art/circuit-craftsman/manifest.json'));
  assert.equal(canvas['ui-v3-final-settings-panel'].path, `public/art/circuit-craftsman/${ART_FILES['settings-panel']}`);
  for (const key of ['street', 'campus', 'station', 'square'] as const) {
    const id = `background-${key}` as const;
    const info = webpInfo(artBytes(id));
    assert.deepEqual([info.width, info.height], [1536, 1024]);
    assert.equal(canvas[`ui-v3-final-${id}`].path, `public/art/circuit-craftsman/${ART_FILES[id]}`);
    assert.equal(manifest.assets.find((entry: any) => entry.id === id).compression.mode, 'existing-webp');
  }
});
