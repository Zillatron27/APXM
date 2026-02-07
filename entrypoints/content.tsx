import { createRoot } from 'react-dom/client';
import { App } from '../components/App';
import type { ProcessedMessage } from '@prun/link';
import { initMessageBridge, onMessage } from '@prun/link/message-bus/content-bridge';
import { useConnectionStore } from '../stores/connection';
import { useSettingsStore, waitForSettingsHydration } from '../stores/settings';
import { initMessageHandlers, processMessage } from '../stores/message-handlers';
import { beginEntityBatch, endEntityBatch } from '../stores/entities';
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
    //    Always poll — not just in debug mode. Without this wait, the bridge
    //    initializes before the interceptor is ready (race condition on Orion).
    const interceptorReady = await pollForAttribute('prunLinkInterceptor', 'ready', 3000);
    if (debug) markStep(4, interceptorReady ? 'ok' : 'fail');
    if (!interceptorReady) {
      if (debug) markFailed(4, 'timeout (3s)');
      console.warn('[APXM] Interceptor failed to initialize within 3s — aborting');
      return;
    }

    // 3. Init message bridge (handler registry)
    initMessageBridge();
    if (debug) markStep(5, 'ok');

    // 4. Build message handler map (local to APXM, not registered on bridge)
    initMessageHandlers();

    // 5. Batched message processor
    //
    // Messages are queued and processed in a setTimeout(0) callback with
    // entity store shadow batching to prevent React error #185 (maximum
    // update depth exceeded).
    //
    // Problem: During PrUn's login burst, dozens of messages arrive in
    // rapid succession. Each Zustand setState synchronously notifies
    // React 19 via useSyncExternalStore, which forces immediate render
    // commits (bypasses all batching). React's nestedUpdateCount
    // accumulates across commits within a single task and throws at 50.
    //
    // Two-layer defense:
    // 1. setTimeout(0) — runs in a fresh macro task where React's
    //    nestedUpdateCount is guaranteed to be 0. The ~4ms delay also
    //    collects more messages per batch than queueMicrotask would.
    // 2. Entity store shadow state — beginEntityBatch() redirects all
    //    mutations to plain Maps (no Zustand set(), no listeners, no
    //    renders). endEntityBatch() flushes each store's final state
    //    with one set() call: max 7 renders instead of ~60.
    let firstMessageSeen = false;
    const messageQueue: ProcessedMessage[] = [];
    let batchScheduled = false;

    onMessage((msg) => {
      if (debug && !firstMessageSeen) {
        firstMessageSeen = true;
        markStep(6, 'ok', msg.messageType);
      }

      messageQueue.push(msg);
      if (!batchScheduled) {
        batchScheduled = true;
        setTimeout(() => {
          const batch = messageQueue.splice(0);
          batchScheduled = false;

          beginEntityBatch();
          try {
            for (const m of batch) {
              try {
                processMessage(m);
              } catch (error) {
                console.error('[APXM] Message handler error:', error);
              }
            }
          } finally {
            // Flush all entity stores — one set() per store, max 7 renders
            endEntityBatch();
          }

          // Single connection store update for the entire batch
          if (batch.length > 0) {
            const last = batch[batch.length - 1];
            useConnectionStore.setState((s) => ({
              messageCount: s.messageCount + batch.length,
              lastMessageTimestamp: last.timestamp,
              ...(s.connected ? {} : { connected: true }),
            }));
          }
        }, 0);
      }
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
