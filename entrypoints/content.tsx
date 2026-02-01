import { createRoot } from 'react-dom/client';
import { App } from '../components/App';
import { initMessageBridge, onMessage, onMessageType } from '../lib/message-bus/content-bridge';
import { useGameState } from '../stores/gameState';
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

    // 3. Register Zustand update handlers
    onMessage((msg) => {
      const state = useGameState.getState();
      state.incrementMessageCount();
      state.setLastMessageTimestamp(msg.timestamp);

      // Fallback connection detection: if we receive any message, we're connected
      if (!state.connected) {
        state.setConnected(true);
      }
    });

    // Also detect explicit connection message
    onMessageType('CLIENT_CONNECTION_OPENED', () => {
      useGameState.getState().setConnected(true);
    });

    // 4. Mount React overlay in Shadow DOM
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
