import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@apxm/bridge': resolve(__dirname, '../types/bridge.ts'),
    },
  },
  css: {
    // Prevent Vite from walking up to the parent APXM repo's postcss.config.cjs
    // (which requires tailwindcss — not a shell dependency)
    postcss: {},
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
  },
});
