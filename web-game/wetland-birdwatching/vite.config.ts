import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset URLs so the build runs from any sub-path or a static host.
  base: './',
  build: {
    rollupOptions: {
      // three.js is most of the bundle and changes far less often than the game.
      output: { manualChunks: { three: ['three'] } },
    },
    // three.js alone is ~550 kB minified.
    chunkSizeWarningLimit: 800,
  },
});
