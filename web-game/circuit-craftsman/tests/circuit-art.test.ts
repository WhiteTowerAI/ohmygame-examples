import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import geometry from '../src/circuit-art-geometry.json';
import { BASE_MASK, DIRECTIONS, rotateMask } from '../src/game/rules';
import type { TileKind } from '../src/game/rules';
import type { ArtKey } from '../src/assets';
import { image, pixelTestOptions } from './image';

function rotate(source: PNG): PNG {
  const target = new PNG({ width: source.width, height: source.height });
  for (let y = 0; y < source.height; y++) for (let x = 0; x < source.width; x++) {
    const input = (y * source.width + x) * 4;
    source.data.copy(target.data, (x * source.width + source.width - 1 - y) * 4, input, input + 4);
  }
  return target;
}
function section(pixels: PNG, ordinal: number): number[] {
  const edge = geometry.faceInset + 2;
  const result: number[] = [];
  for (let i = 70; i < pixels.width - 70; i++) {
    const x = ordinal === 0 || ordinal === 2 ? i : ordinal === 1 ? pixels.width - 1 - edge : edge;
    const y = ordinal === 1 || ordinal === 3 ? i : ordinal === 2 ? pixels.height - 1 - edge : edge;
    if (pixels.data[(y * pixels.width + x) * 4 + 3] > 16) result.push(i);
  }
  return result;
}

test('lit and unlit bulbs share alpha, silhouette, plate and base; only glass changes', pixelTestOptions, () => {
  const off = image('tile-bulb-off'), on = image('tile-bulb-on');
  assert.deepEqual([on.width, on.height], [geometry.textureSize, geometry.textureSize]);
  assert.deepEqual([off.width, off.height], [on.width, on.height]);
  let changed = 0, offLight = 0, onLight = 0;
  for (let p = 0; p < off.data.length; p += 4) {
    assert.equal(on.data[p + 3], off.data[p + 3], `Alpha at pixel ${p / 4}`);
    if (!on.data.subarray(p, p + 3).equals(off.data.subarray(p, p + 3))) {
      const y = Math.floor(p / 4 / off.width);
      assert(y >= geometry.glassTop && y <= geometry.glassBottom, `Structure unchanged at pixel ${p / 4}`);
      changed++;
      offLight += .2126 * off.data[p] + .7152 * off.data[p + 1] + .0722 * off.data[p + 2];
      onLight += .2126 * on.data[p] + .7152 * on.data[p + 1] + .0722 * on.data[p + 2];
    }
  }
  assert.equal(changed, 10059);
  assert((onLight - offLight) / changed > 20, 'The same glass is visibly illuminated');
});

test('pipe, source and bulb contacts retain identical width and alignment after every rotation', pixelTestOptions, () => {
  const types: [ArtKey, TileKind][] = [['tile-straight', 'straight'], ['tile-elbow', 'elbow'], ['tile-tee', 'tee'], ['tile-cross', 'cross'], ['tile-power', 'power'], ['tile-bulb-off', 'bulb'], ['tile-bulb-on', 'bulb']];
  for (const [id, kind] of types) {
    let pixels = image(id);
    for (let turns = 0; turns < 4; turns++) {
      const mask = rotateMask(BASE_MASK[kind], turns);
      DIRECTIONS.forEach((direction, ordinal) => {
        if (!(mask & direction.bit)) return;
        const locations = section(pixels, ordinal);
        assert.equal(locations.length, geometry.collarWidth, `${id} rotation ${turns} port ${ordinal}`);
        assert.equal(locations[0], geometry.center - geometry.collarWidth / 2);
        assert.equal(locations.at(-1), geometry.center + geometry.collarWidth / 2 - 1);
      });
      pixels = rotate(pixels);
    }
  }
});

test('finished pipe sprites use one fixed body diameter on every branch', pixelTestOptions, () => {
  const plate = image('tile-empty');
  for (const kind of ['straight', 'elbow', 'tee', 'cross'] as const) {
    const pixels = image(`tile-${kind}`);
    DIRECTIONS.forEach(direction => {
      if (!(BASE_MASK[kind] & direction.bit)) return;
      const locations: number[] = [];
      for (let i = 75; i < 181; i++) {
        const x = direction.dx ? direction.dx > 0 ? 200 : 55 : i;
        const y = direction.dy ? direction.dy > 0 ? 200 : 55 : i;
        const p = (y * pixels.width + x) * 4;
        if (!pixels.data.subarray(p, p + 3).equals(plate.data.subarray(p, p + 3))) locations.push(i);
      }
      assert.equal(locations.length, geometry.pipeWidth, `${kind} branch ${direction.bit}`);
      assert.equal(locations[0], geometry.center - geometry.pipeWidth / 2);
    });
  }
});

test('manifest registration retains the runtime geometry contract', () => {
  const manifest = JSON.parse(readFileSync(new URL('../public/art/circuit-craftsman/manifest.json', import.meta.url), 'utf8'));
  assert.deepEqual(manifest.geometry, geometry);
  for (const id of ['tile-straight', 'tile-elbow', 'tile-tee', 'tile-cross', 'tile-power', 'tile-bulb-off', 'tile-bulb-on']) {
    const entry = manifest.assets.find((asset: any) => asset.id === id);
    assert.equal(entry.width, geometry.textureSize);
    assert.equal(entry.height, geometry.textureSize);
    assert.equal(entry.registration.pipeWidth, geometry.pipeWidth);
    assert.equal(entry.registration.contactWidth, geometry.collarWidth);
  }
});
