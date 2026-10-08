import { readFile } from 'node:fs/promises';
import { defineConfig } from 'vite';
export default defineConfig({
  base: './',
  plugins: [{
    name: 'runtime-licenses',
    apply: 'build',
    async generateBundle() {
      for (const [name, file] of [
        ['phaser.txt', 'node_modules/phaser/LICENSE.md'],
        ['eventemitter3.txt', 'node_modules/eventemitter3/LICENSE'],
        ['project.txt', 'LICENSE'],
        ['credits.md', 'CREDITS.md'],
      ]) {
        this.emitFile({ type: 'asset', fileName: `licenses/${name}`, source: await readFile(file) });
      }
    },
  }],
  build: { chunkSizeWarningLimit: 1600 },
});
