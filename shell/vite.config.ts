import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@apxm/bridge': resolve(__dirname, '../types/bridge.ts'),
    },
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
  },
});
