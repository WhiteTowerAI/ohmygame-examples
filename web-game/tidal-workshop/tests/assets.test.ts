import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const read = (file: string) => readFileSync(file, 'utf8');

test('every harbor sprite and progression icon has a transparent WebP asset', async () => {
  const scene = read('src/harbor.ts');
  const list = scene.match(/export const SPRITES = \[([^\]]+)\]/)![1];
  const sprites = [...list.matchAll(/'([^']+)'/g)].map(match => match[1]);
  const manifest = JSON.parse(read('assets/manifests/art.json'));
  assert.deepEqual(new Set(sprites), new Set(Object.keys(manifest)));
  for (const key of sprites) {
    const entry = manifest[key];
    assert.equal(entry.file, `${key}.webp`);
    const image = await sharp(`public/art/${entry.file}`).metadata();
    assert.equal(image.format, 'webp');
    assert.equal(image.width, entry.width);
    assert.equal(image.height, entry.height);
    assert.equal(image.hasAlpha, true);
  }
  for (const file of ['economy.ts', 'hexes.ts', 'progression.ts']) {
    for (const [, icon] of read(`src/${file}`).matchAll(/['"](icon-[a-z-]+)['"]/g)) {
      assert.ok(sprites.includes(icon), `${file}: missing ${icon}`);
    }
  }
  for (const [, key] of read('src/main.ts').matchAll(/art\('([^']+)'/g)) {
    assert.ok(sprites.includes(key), `DOM artwork: missing ${key}`);
  }
  assert.deepEqual(new Set(readdirSync('public/art')), new Set([...sprites.map(key => `${key}.webp`), 'sea.webp']));
});

test('HUD material paths are source assets, not duplicate public copies', async () => {
  const urls = [...read('src/hud.css').matchAll(/url\('([^']+)'\)/g)].map(match => match[1]);
  assert.equal(urls.length, 5);
  for (const url of urls) {
    const file = url.startsWith('/') ? path.resolve(url.slice(1)) : path.resolve('src', url);
    assert.ok(existsSync(file), url);
    assert.equal((await sharp(file).metadata()).format, 'webp');
  }
  assert.equal(existsSync('public/ui'), false);
});

test('downloaded canvas sources and document media are self-contained', () => {
  const { assets } = JSON.parse(read('canvas/assets.json'));
  for (const asset of Object.values(assets) as { path: string }[]) {
    assert.ok(existsSync(asset.path), asset.path);
  }
  for (const file of readdirSync('canvas/boards')) {
    const board = JSON.parse(read(`canvas/boards/${file}`));
    for (const node of board.nodes) {
      if (node.data.assetId) assert.ok(assets[node.data.assetId], node.id);
      for (const reference of node.data.images ?? []) {
        if (reference.type === 'library') assert.ok(assets[reference.assetId], reference.assetId);
        if (reference.type === 'node') assert.ok(board.nodes.some((item: { id: string }) => item.id === reference.nodeId), reference.nodeId);
      }
    }
  }
  for (const file of readdirSync('canvas/documents')) {
    for (const [, link] of read(`canvas/documents/${file}`).matchAll(/\]\(([^)]+)\)/g)) {
      if (!/^https?:/.test(link)) assert.ok(existsSync(path.resolve('canvas/documents', link)), link);
    }
  }
});
