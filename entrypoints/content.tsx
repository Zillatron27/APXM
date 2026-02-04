import { createRoot } from 'react-dom/client';
import { App } from '../components/App';
import { initMessageBridge, onMessage, onMessageType } from '../lib/message-bus/content-bridge';
import { useConnectionStore } from '../stores/connection';
import { useSettingsStore, waitForSettingsHydration } from '../stores/settings';
import { initMessageHandlers } from '../stores/message-handlers';
import { populateStoresFromFio } from '../lib/fio';
import '../assets/styles.css';

export default defineContentScript({
  matches: ['https://apex.prosperousuniverse.com/*'],
  runAt: 'document_start',
  cssInjectionMode: 'ui',

  async main(ctx) {
    // 1. Inject main-world interceptor (includes script blocker)
    // This blocks Prun scripts, installs proxies, then restores scripts
    injectScript('/ws-interceptor.js', { keepInDom: true });

    // 2. Init message bridge (handler registry)
    initMessageBridge();

    // 3. Register entity store handlers
    initMessageHandlers();

    // 4. Register connection state handlers
    onMessage((msg) => {
      const state = useConnectionStore.getState();
      state.incrementMessageCount();
      state.setLastMessageTimestamp(msg.timestamp);

      // Fallback connection detection: if we receive any message, we're connected
      if (!state.connected) {
        state.setConnected(true);
      }
    });

    // Also detect explicit connection message
    onMessageType('CLIENT_CONNECTION_OPENED', () => {
      useConnectionStore.getState().setConnected(true);
    });

    // 5. Auto-fetch FIO data if credentials are saved (after settings hydrate)
    waitForSettingsHydration().then(() => {
      const settings = useSettingsStore.getState();
      if (settings.fio.apiKey && settings.fio.username) {
        populateStoresFromFio({
          apiKey: settings.fio.apiKey,
          username: settings.fio.username,
        }).then((result) => {
          if (result.success) {
            useSettingsStore.getState().setFioLastFetch(Date.now());
          }
        });
      }
    });

    // 6. Mount React overlay in Shadow DOM
    const ui = await createShadowRootUi(ctx, {
      name: 'apxm-overlay',
      position: 'inline',
      anchor: 'body',
      append: 'first',
      onMount(container) {
        const root = createRoot(container);
        root.render(<App />);
        return root;
      },
      onRemove(root) {
        root?.unmount();
      },
    });

    ui.mount();
  },
});
