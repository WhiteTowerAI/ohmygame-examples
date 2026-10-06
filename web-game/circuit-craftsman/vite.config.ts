import { readFile } from 'node:fs/promises';
import { defineConfig } from 'vite';
import { ART_FILES } from './src/art-files';

export default defineConfig(({ command }) => ({
  base: './',
  publicDir: command === 'serve' ? 'public' : false,
  optimizeDeps: { include: ['logic-solver'] },
  plugins: [{
    name: 'circuit-runtime-art',
    apply: 'build',
    async generateBundle() {
      for (const file of new Set(Object.values(ART_FILES))) {
        this.emitFile({ type: 'asset', fileName: `art/circuit-craftsman/${file}`, source: await readFile(`public/art/circuit-craftsman/${file}`) });
      }
      for (const family of ['noto-sans-sc', 'nunito']) {
        this.emitFile({ type: 'asset', fileName: `licenses/${family}.txt`, source: await readFile(`src/fonts/${family}-LICENSE.txt`) });
      }
      for (const [name, file] of [['phaser', 'phaser/LICENSE.md'], ['lucide', 'lucide/LICENSE'], ['logic-solver', 'logic-solver/LICENSE']]) {
        this.emitFile({ type: 'asset', fileName: `licenses/${name}.txt`, source: await readFile(`node_modules/${file}`) });
      }
    },
  }],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/phaser')) return 'phaser';
          if (id.includes('node_modules/lucide')) return 'icons';
        },
      },
    },
  },
  worker: { format: 'es' },
}));
