import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baselines = JSON.parse(readFileSync(path.join(repositoryRoot, 'canvas-baselines.json'), 'utf8')).examples;

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}

export function canvasFingerprint(value) {
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}

/** Packaging may change media bytes, but must preserve imported authoring state. */
export function checkCanvasPreservation(directory, id) {
  const baseline = baselines[id];
  if (!baseline) return existsSync(path.join(directory, 'canvas/index.json'))
    ? [`${id}: add an imported Canvas baseline after comparing with the original project`]
    : [];
  const errors = [];
  for (const [file, expected] of Object.entries(baseline.files)) {
    try {
      const value = JSON.parse(readFileSync(path.join(directory, file), 'utf8'));
      if (canvasFingerprint(value) !== expected) errors.push(`${id}: ${file} changed imported Canvas state; review the intended edit before updating its baseline`);
      if (file === 'canvas/assets.json') {
        for (const [assetId, asset] of Object.entries(value.assets)) {
          const relative = path.relative(directory, path.resolve(directory, asset.path));
          if (!relative || relative.startsWith('..') || path.isAbsolute(relative) || !existsSync(path.join(directory, relative))) {
            errors.push(`${id}: Canvas asset ${assetId} is not a bundled local file: ${asset.path}`);
          }
        }
      }
    } catch (error) {
      errors.push(`${id}: ${file}: ${error.message}`);
    }
  }
  return errors;
}
