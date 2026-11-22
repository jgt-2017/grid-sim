/*
 * PURPOSE:    Vite build config (static site; deploys to Vercel as-is).
 * USED BY:    npm run dev / build / preview
 * DEPENDS ON: vite
 * UNITS:      n/a
 */
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    outDir: 'dist',
    // three.js is ~600 kB on its own; keep it in a separate, long-cached chunk
    chunkSizeWarningLimit: 800,
    rollupOptions: { output: { manualChunks: { three: ['three'] } } },
  },
});
