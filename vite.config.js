/*
 * PURPOSE:    Vite build config (static site; deploys to Vercel as-is).
 * USED BY:    npm run dev / build / preview
 * DEPENDS ON: vite
 * UNITS:      n/a
 */
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: { target: 'es2022', outDir: 'dist' },
});
