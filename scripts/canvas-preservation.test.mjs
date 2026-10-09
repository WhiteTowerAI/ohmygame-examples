import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { checkCanvasPreservation } from './canvas-preservation.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'web-game/circuit-craftsman');
const baseline = JSON.parse(await readFile(path.join(root, 'canvas-baselines.json'), 'utf8')).examples['circuit-craftsman'];

async function fixture(run) {
  const directory = await mkdtemp(path.join(tmpdir(), 'canvas-preservation-test-'));
  try {
    for (const file of Object.keys(baseline.files)) {
      await mkdir(path.dirname(path.join(directory, file)), { recursive: true });
      await writeFile(path.join(directory, file), await readFile(path.join(source, file)));
    }
    const manifest = JSON.parse(await readFile(path.join(directory, 'canvas/assets.json'), 'utf8'));
    for (const asset of Object.values(manifest.assets)) {
      await mkdir(path.dirname(path.join(directory, asset.path)), { recursive: true });
      await writeFile(path.join(directory, asset.path), 'local media');
    }
    await run(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function edit(directory, file, change) {
  const target = path.join(directory, file);
  const value = JSON.parse(await readFile(target, 'utf8'));
  change(value);
  await writeFile(target, JSON.stringify(value));
}

test('unchanged authoring state accepts compressed media at the original paths', () => fixture(async directory => {
  assert.deepEqual(checkCanvasPreservation(directory, 'circuit-craftsman'), []);
}));

test('a new Canvas import cannot silently skip preservation checks', () => fixture(async directory => {
  assert(checkCanvasPreservation(directory, 'new-canvas-example').some(error => error.includes('baseline')));
}));

test('examples without a Canvas do not need an imported Canvas baseline', () => fixture(async directory => {
  await rm(path.join(directory, 'canvas'), { recursive: true });
  assert.deepEqual(checkCanvasPreservation(directory, 'new-code-example'), []);
}));

test('packaging cannot drop a node or convert generation into a static asset', () => fixture(async directory => {
  const file = 'canvas/boards/47645234-e63f-4538-aa06-a70d07e8263f.json';
  await edit(directory, file, board => { board.nodes.find(node => node.type === 'image').type = 'asset'; });
  assert(checkCanvasPreservation(directory, 'circuit-craftsman').some(error => error.includes(file)));
  await writeFile(path.join(directory, file), await readFile(path.join(source, file)));
  await edit(directory, file, board => { board.nodes.pop(); });
  assert(checkCanvasPreservation(directory, 'circuit-craftsman').some(error => error.includes(file)));
}));

test('packaging cannot rearrange nodes or replace their viewport', () => fixture(async directory => {
  const file = 'canvas/editor/47645234-e63f-4538-aa06-a70d07e8263f.json';
  await edit(directory, file, layout => {
    Object.values(layout.nodes)[0].x += 100;
    layout.viewport.zoom = 0.1;
  });
  assert(checkCanvasPreservation(directory, 'circuit-craftsman').some(error => error.includes(file)));
}));

test('packaging cannot reset generation history or discard media provenance', () => fixture(async directory => {
  await writeFile(path.join(directory, 'canvas/jobs.json'), '[]');
  await writeFile(path.join(directory, '.data/assets.json'), '{}');
  const errors = checkCanvasPreservation(directory, 'circuit-craftsman');
  assert(errors.some(error => error.includes('canvas/jobs.json')));
  assert(errors.some(error => error.includes('.data/assets.json')));
}));

test('all registered source images must remain bundled locally', () => fixture(async directory => {
  await rm(path.join(directory, 'assets/imported/output.webp'));
  assert(checkCanvasPreservation(directory, 'circuit-craftsman').some(error => error.includes('assets/imported/output.webp')));
}));
