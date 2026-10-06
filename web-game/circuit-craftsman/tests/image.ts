import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { ART_FILES } from '../src/art-files';
import type { ArtKey } from '../src/assets';

export function webpInfo(bytes: Buffer): { width: number; height: number; mode: 'lossless' | 'lossy' } {
  assert.equal(bytes.subarray(0, 4).toString(), 'RIFF');
  assert.equal(bytes.subarray(8, 12).toString(), 'WEBP');
  assert.equal(bytes.readUInt32LE(4) + 8, bytes.length, 'Complete WebP container');
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const type = bytes.subarray(offset, offset + 4).toString();
    const length = bytes.readUInt32LE(offset + 4);
    assert(offset + 8 + length <= bytes.length, 'Complete WebP chunk');
    const chunk = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === 'VP8L') {
      assert(length >= 5);
      assert.equal(chunk[0], 0x2f);
      const dimensions = chunk.readUInt32LE(1);
      assert.equal(dimensions >>> 29, 0, 'Supported lossless WebP version');
      return { width: (dimensions & 0x3fff) + 1, height: ((dimensions >>> 14) & 0x3fff) + 1, mode: 'lossless' };
    }
    if (type === 'VP8 ') {
      assert(length >= 10);
      assert.deepEqual([...chunk.subarray(3, 6)], [0x9d, 0x01, 0x2a]);
      return { width: chunk.readUInt16LE(6) & 0x3fff, height: chunk.readUInt16LE(8) & 0x3fff, mode: 'lossy' };
    }
    offset += 8 + length + (length & 1);
  }
  throw new Error('WebP pixel stream is missing');
}

export const pixelTestOptions = {
  skip: spawnSync('ffmpeg', ['-version']).status === 0 ? false : 'ffmpeg is required for decoded-pixel regression; header and hash tests always run',
};
const cache = new Map<ArtKey, PNG>();
export function image(key: ArtKey): PNG {
  const cached = cache.get(key);
  if (cached) return cached;
  const path = fileURLToPath(new URL(`../public/art/circuit-craftsman/${ART_FILES[key]}`, import.meta.url));
  const result = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', path, '-frames:v', '1', '-threads', '1', '-f', 'image2pipe', '-vcodec', 'png', 'pipe:1'], {
    maxBuffer: 64 * 1024 * 1024, timeout: 10_000,
  });
  assert.equal(result.status, 0, String(result.error ?? result.stderr));
  const pixels = PNG.sync.read(result.stdout);
  // Invisible RGB is not retained by WebP and cannot affect rendering.
  for (let p = 0; p < pixels.data.length; p += 4) if (pixels.data[p + 3] === 0) pixels.data.fill(0, p, p + 3);
  cache.set(key, pixels);
  return pixels;
}

export function artBytes(key: ArtKey): Buffer {
  return readFileSync(new URL(`../public/art/circuit-craftsman/${ART_FILES[key]}`, import.meta.url));
}
