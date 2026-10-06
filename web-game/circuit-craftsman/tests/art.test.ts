import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { ART_FILES } from '../src/art-files';
import { artBytes, webpInfo } from './image';

const manifest = JSON.parse(readFileSync(new URL('../public/art/circuit-craftsman/manifest.json', import.meta.url), 'utf8'));

test('all runtime artwork is complete WebP with matching dimensions and hashes', () => {
  assert.equal(manifest.assetCount, Object.keys(ART_FILES).length);
  assert.equal(manifest.assets.length, manifest.assetCount);
  assert.equal(new Set(manifest.assets.map((asset: any) => asset.id)).size, manifest.assetCount);
  for (const [id, file] of Object.entries(ART_FILES)) {
    assert(!file.includes('..'), id);
    assert(file.endsWith('.webp'), id);
    const bytes = artBytes(id as keyof typeof ART_FILES);
    assert(bytes.length > 1024, id);
    const info = webpInfo(bytes);
    const entry = manifest.assets.find((asset: any) => asset.id === id);
    assert(entry, id);
    assert.equal(entry.file, file, id);
    assert.deepEqual([info.width, info.height], [entry.width, entry.height], id);
    assert.equal(entry.bytes, bytes.length, id);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256, id);
    if (!id.startsWith('background-')) {
      assert.equal(info.mode, 'lossless', id);
      assert.equal(entry.compression.mode, 'lossless', id);
      assert.equal(entry.compression.alphaChangedPixels, 0, id);
      assert.equal(entry.compression.visibleRgbChangedPixels, 0, id);
    }
  }
});

test('public images are exactly the runtime set, without unused sprites or large PNG copies', () => {
  const root = new URL('../public/art/circuit-craftsman/', import.meta.url);
  function files(directory: URL, prefix = ''): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
      const path = `${prefix}${entry.name}`;
      return entry.isDirectory() ? files(new URL(`${entry.name}/`, directory), `${path}/`) : /\.(png|webp|jpe?g)$/i.test(entry.name) ? [path] : [];
    });
  }
  assert.deepEqual(files(root).sort(), [...new Set(Object.values(ART_FILES))].sort());
  assert(manifest.assets.reduce((sum: number, asset: any) => sum + asset.bytes, 0) < 6 * 1024 * 1024);
});
