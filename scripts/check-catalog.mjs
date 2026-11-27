// Validates catalog.json. Every example has the required fields and a folder
// OhMyGame can use for its kind:
// - a game (`kind` "game" or left out) is a web game with a WebP cover and an
//   AGENTS.md. It needs package.json with dev and build scripts, or, played as
//   it is, an index.html and no package.json, as an interactive story is;
// - a starter (`kind` "starter") is files a new project starts from, of the
//   general or web-game type, with nothing to play. Its folder is copied as it
//   is; it may have a WebP cover and an SVG, PNG or WebP icon.
// Prints the paths of the games with a build, one per line, for CI to build.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const catalog = JSON.parse(readFileSync(path.join(root, 'catalog.json'), 'utf8'));
const errors = [];
const ids = new Set();
const builds = [];

if (catalog.version !== 1 || !Array.isArray(catalog.examples)) errors.push('catalog.json must be { version: 1, examples: [] }');
for (const example of catalog.examples ?? []) {
  const label = example.id ?? JSON.stringify(example);
  const kind = example.kind ?? 'game';
  if (kind !== 'game' && kind !== 'starter') errors.push(`${label}: unsupported kind ${kind}`);
  for (const field of ['id', 'type', 'name', 'description', 'path', ...(kind === 'game' ? ['cover'] : [])]) {
    if (typeof example[field] !== 'string' || !example[field].trim()) errors.push(`${label}: missing ${field}`);
  }
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(example.id ?? '')) errors.push(`${label}: id must be kebab-case`);
  if (ids.has(example.id)) errors.push(`${label}: duplicate id`);
  ids.add(example.id);
  const types = kind === 'starter' ? ['general', 'web-game'] : ['web-game'];
  if (!types.includes(example.type)) errors.push(`${label}: unsupported type ${example.type} for a ${kind}`);
  if (!existsSync(path.join(root, example.path ?? '', '.'))) errors.push(`${label}: ${example.path} not found`);
  if (example.cover !== undefined) {
    if (!existsSync(path.join(root, example.cover))) errors.push(`${label}: cover not found`);
    if (!example.cover.endsWith('.webp')) errors.push(`${label}: cover must be a .webp image (OhMyGame stores project covers as WebP)`);
  }
  if (example.icon !== undefined) {
    if (!existsSync(path.join(root, example.icon))) errors.push(`${label}: icon not found`);
    if (!/\.(svg|png|webp)$/.test(example.icon)) errors.push(`${label}: icon must be an .svg, .png or .webp image`);
  }
  if (kind === 'starter') continue;
  if (!existsSync(path.join(root, example.path ?? '', 'AGENTS.md'))) errors.push(`${label}: ${example.path}/AGENTS.md not found`);
  const packagePath = path.join(root, example.path ?? '', 'package.json');
  if (!existsSync(packagePath)) {
    if (!existsSync(path.join(root, example.path ?? '', 'index.html'))) errors.push(`${label}: ${example.path} needs package.json or index.html`);
    continue;
  }
  const scripts = JSON.parse(readFileSync(packagePath, 'utf8')).scripts ?? {};
  for (const script of ['dev', 'build']) {
    if (typeof scripts[script] !== 'string') errors.push(`${label}: package.json needs a "${script}" script`);
  }
  builds.push(example.path);
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(builds.join('\n'));
