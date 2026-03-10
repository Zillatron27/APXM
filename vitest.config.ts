import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@apxm/bridge': resolve(__dirname, 'types/bridge.ts'),
    },
  },
  define: {
    __DEV__: 'true',
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['**/*.test.ts'],
    exclude: ['node_modules', '.wxt', '.output', 'shell/node_modules'],
  },
});
