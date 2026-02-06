import { createRoot } from 'react-dom/client';
import { App } from '../components/App';
import { initMessageBridge, onMessage, onMessageType } from '../lib/message-bus/content-bridge';
import { useConnectionStore } from '../stores/connection';
import { useSettingsStore, waitForSettingsHydration } from '../stores/settings';
import { initMessageHandlers } from '../stores/message-handlers';
import { populateStoresFromFio } from '../lib/fio';
import { isDebugEnabled, createOverlay, markStep, markFailed, pollForAttribute } from '../lib/diagnostics';
import '../assets/styles.css';

/**
 * Determine if APXM should inject on this device.
 * APXM is mobile-only by default, but desktop can be enabled via storage override.
 */
async function shouldInject(): Promise<boolean> {
  const isMobile =
    window.matchMedia?.('(pointer: coarse)')?.matches ||
    (!window.matchMedia && navigator.maxTouchPoints > 0);

  if (isMobile) return true;

  // Desktop — check for override
  try {
    const stored = await browser.storage.local.get('apxm_force_enable');
    if (stored.apxm_force_enable === true) {
      console.log('[APXM] Desktop detected but force-enable override is set');
      return true;
    }
  } catch {
    /* storage access failed */
  }

  console.log(
    '[APXM] Desktop detected — APXM is designed for mobile devices.\n' +
      'To override: browser.storage.local.set({ apxm_force_enable: true })'
  );
  return false;
}

export default defineContentScript({
  matches: ['https://apex.prosperousuniverse.com/*'],
  runAt: 'document_start',
  cssInjectionMode: 'ui',

  async main(ctx) {
    const debug = isDebugEnabled();

    if (debug) {
      createOverlay();
      markStep(1, 'ok');
    }

    // Mobile detection — debug mode bypasses but still reports the result
    const mobile = await shouldInject();
    if (debug) {
      markStep(2, mobile ? 'ok' : 'fail', mobile ? 'mobile detected' : 'not mobile');
    }
    if (!mobile && !debug) return;

    // 1. Inject main-world interceptor (includes script blocker)
    injectScript('/ws-interceptor.js', { keepInDom: true });
    if (debug) markStep(3, 'ok');

    // 2. Poll for interceptor readiness via shared DOM attribute
    if (debug) {
      const interceptorReady = await pollForAttribute('apxmInterceptor', 'ready', 3000);
      if (interceptorReady) {
        markStep(4, 'ok');
      } else {
        markFailed(4, 'timeout (3s)');
      }
    }

    // 3. Init message bridge (handler registry)
    initMessageBridge();
    if (debug) markStep(5, 'ok');

    // 4. Register entity store handlers
    initMessageHandlers();

    // 5. Register connection state handlers
    let firstMessageSeen = false;

    onMessage((msg) => {
      if (debug && !firstMessageSeen) {
        firstMessageSeen = true;
        markStep(6, 'ok', msg.messageType);
      }

      // Single batched set() to avoid cascading React re-renders during
      // PrUn's login burst (dozens of messages in rapid succession).
      useConnectionStore.setState((s) => ({
        messageCount: s.messageCount + 1,
        lastMessageTimestamp: msg.timestamp,
        ...(s.connected ? {} : { connected: true }),
      }));
    });

    onMessageType('CLIENT_CONNECTION_OPENED', () => {
      useConnectionStore.getState().setConnected(true);
    });

    // 6. Auto-fetch FIO data if credentials are saved (after settings hydrate)
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

    // 7. Mount React overlay in Shadow DOM
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
    if (debug) markStep(7, 'ok');
  },
});
