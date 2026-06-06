import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'APXM',
    description: 'A mobile browser extension for Prosperous Universe',
    permissions: ['storage'],
    host_permissions: [
      'https://apex.prosperousuniverse.com/*',
      'https://rest.fnar.net/*',
    ],
    web_accessible_resources: [
      {
        resources: ['ws-interceptor.js', 'icon-48.png'],
        matches: ['https://apex.prosperousuniverse.com/*'],
      },
    ],
    browser_specific_settings: {
      gecko: {
        id: 'apxm@27bit.dev',
        strict_min_version: '142.0',
        // WXT's manifest types lag this AMO field, but Firefox requires it for
        // the data-collection disclosure. Valid at runtime; types are behind.
        // @ts-expect-error -- data_collection_permissions not yet in WXT types
        data_collection_permissions: {
          required: ['none'],
          optional: [],
        },
      },
      gecko_android: {
        strict_min_version: '120.0',
      },
    },
  },
  vite: () => ({
    define: {
      // Debug-logging flag. True for the HMR dev server (`wxt dev`, where
      // NODE_ENV is development) OR when APXM_DEV=true is set explicitly for a
      // loadable debug build. We do NOT key debug builds off NODE_ENV=development
      // because that flips React to the jsxDEV runtime, which WXT's production
      // build pipeline does not bundle — the overlay then crashes with
      // "jsxDEV is not a function". A debug build stays NODE_ENV=production
      // (working jsx runtime) and just turns logging on. See buglog bug-002.
      __DEV__: JSON.stringify(
        process.env.NODE_ENV !== 'production' || process.env.APXM_DEV === 'true'
      ),
    },
    build: {
      // Ensure compatibility with Firefox ESR
      target: 'es2020',
    },
  }),
});
