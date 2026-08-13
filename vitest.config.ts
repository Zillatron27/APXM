import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: {
    // Vitest realizes define entries as globalThis properties, so source
    // references to the bare __DEV__ identifier resolve through globalThis —
    // tests can exercise the production path with vi.stubGlobal('__DEV__', false)
    // (see logger.test.ts's suppression suite).
    __DEV__: 'true',
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['**/*.test.ts', '**/*.test.tsx'],
    exclude: ['node_modules', '.wxt', '.output'],
  },
});
