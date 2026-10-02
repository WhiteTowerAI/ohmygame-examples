// Validates catalog.json: every example has the required fields, its folder
// is a runnable web game (package.json with dev and build scripts) and its
// cover exists. Prints the example paths, one per line, for CI to build.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const catalog = JSON.parse(readFileSync(path.join(root, 'catalog.json'), 'utf8'));
const errors = [];
const ids = new Set();

if (catalog.version !== 1 || !Array.isArray(catalog.examples)) errors.push('catalog.json must be { version: 1, examples: [] }');
for (const example of catalog.examples ?? []) {
  const label = example.id ?? JSON.stringify(example);
  for (const field of ['id', 'type', 'name', 'description', 'path', 'cover']) {
    if (typeof example[field] !== 'string' || !example[field].trim()) errors.push(`${label}: missing ${field}`);
  }
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(example.id ?? '')) errors.push(`${label}: id must be kebab-case`);
  if (ids.has(example.id)) errors.push(`${label}: duplicate id`);
  ids.add(example.id);
  if (example.type !== 'web-game') errors.push(`${label}: unsupported type ${example.type}`);
  if (!existsSync(path.join(root, example.cover ?? ''))) errors.push(`${label}: cover not found`);
  const packagePath = path.join(root, example.path ?? '', 'package.json');
  if (!existsSync(packagePath)) {
    errors.push(`${label}: ${example.path}/package.json not found`);
    continue;
  }
  const scripts = JSON.parse(readFileSync(packagePath, 'utf8')).scripts ?? {};
  for (const script of ['dev', 'build']) {
    if (typeof scripts[script] !== 'string') errors.push(`${label}: package.json needs a "${script}" script`);
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(catalog.examples.map((example) => example.path).join('\n'));
