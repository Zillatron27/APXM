import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'APXM — Mobile PrUn Interface',
    permissions: ['storage'],
    host_permissions: [
      'https://apex.prosperousuniverse.com/*',
      'https://rest.fnar.net/*',
    ],
    web_accessible_resources: [
      {
        resources: ['ws-interceptor.js'],
        matches: ['https://apex.prosperousuniverse.com/*'],
      },
    ],
    browser_specific_settings: {
      gecko: {
        id: 'apxm@27bit.dev',
        strict_min_version: '109.0',
        data_collection_permissions: {
          data_collection: false,
        },
      },
    },
  },
  vite: () => ({
    build: {
      // Ensure compatibility with Firefox ESR
      target: 'es2020',
    },
  }),
});
