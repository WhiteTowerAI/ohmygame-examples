#!/usr/bin/env node
// Replaces general/claude-code-game-studios with a release of
// Donchitos/Claude-Code-Game-Studios, as cloning it would give, less the
// files about developing the template itself, and records the release in
// credits/claude-code-game-studios.md.
//
//   node scripts/sync-claude-code-game-studios.mjs v1.3.0
//
// Then read the diff, the hooks and scripts under .claude included, since
// Claude Code runs them in projects started from it, and open a PR.

import { spawn } from 'node:child_process';
import { lstat, mkdir, mkdtemp, readdir, rm, rename, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const REPOSITORY = 'Donchitos/Claude-Code-Game-Studios';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const STARTER = path.join(root, 'general', 'claude-code-game-studios');
const CREDITS = path.join(root, 'credits', 'claude-code-game-studios.md');
/** About developing the template, not using it. */
const LEFT_OUT = ['.github', 'CONTRIBUTING.md', 'SECURITY.md'];

const tag = process.argv[2];
if (!tag || !/^v\d+\.\d+\.\d+$/.test(tag)) {
  console.error('Usage: node scripts/sync-claude-code-game-studios.mjs vX.Y.Z');
  process.exit(1);
}

const github = async (url) => {
  const response = await fetch(url, { headers: { accept: 'application/vnd.github+json', 'user-agent': 'ohmygame-examples' } });
  if (!response.ok) throw new Error(`${url}: ${response.status} ${response.statusText}`);
  return response;
};

const { sha: commit } = await (await github(`https://api.github.com/repos/${REPOSITORY}/commits/${tag}`)).json();
const scratch = await mkdtemp(path.join(tmpdir(), 'ccgs-'));
try {
  const archive = path.join(scratch, 'release.tar.gz');
  await writeFile(archive, Buffer.from(await (await github(`https://codeload.github.com/${REPOSITORY}/tar.gz/${commit}`)).arrayBuffer()));
  const source = path.join(scratch, 'source');
  await mkdir(source);
  await run('tar', ['-xzf', archive, '-C', source, '--strip-components=1']);
  // Only files and folders: a starter is copied into projects as it is.
  await keepFilesAndFolders(source);
  for (const item of LEFT_OUT) await rm(path.join(source, item), { recursive: true, force: true });

  await rm(STARTER, { recursive: true, force: true });
  await mkdir(path.dirname(STARTER), { recursive: true });
  await rename(source, STARTER);
  await mkdir(path.dirname(CREDITS), { recursive: true });
  await writeFile(CREDITS, credits(commit));
  console.log(`general/claude-code-game-studios is ${REPOSITORY} ${tag} (${commit}).`);
  console.log('Read the diff, hooks and scripts included, then open a PR.');
} finally {
  await rm(scratch, { recursive: true, force: true });
}

async function keepFilesAndFolders(directory) {
  for (const item of await readdir(directory)) {
    const at = path.join(directory, item);
    const stats = await lstat(at);
    if (stats.isDirectory()) await keepFilesAndFolders(at);
    else if (!stats.isFile()) await rm(at);
  }
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'ignore', 'inherit'] });
    child.once('error', reject);
    child.once('close', (code) => code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}`)));
  });
}

function credits(sha) {
  return `# Claude Code Game Studios

\`general/claude-code-game-studios/\` is [Claude Code Game Studios](https://github.com/${REPOSITORY})
by Donchitos, release ${tag} (commit \`${sha}\`), under the MIT license in its
\`LICENSE\`. It is copied as released, except that what is about developing the
template is left out: ${LEFT_OUT.map((item) => `\`${item}\``).join(', ')}.

\`icons/claude-code-game-studios.svg\` was drawn for OhMyGame: a film
clapperboard with a game controller's D-pad and buttons. It is not a mark of
Claude Code Game Studios or of Anthropic, and is under this repository's
license.

Made with \`scripts/sync-claude-code-game-studios.mjs\`.
`;
}
