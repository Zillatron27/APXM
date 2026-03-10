import { createRoot } from 'react-dom/client';
import { App } from '../components/App';
import type { ProcessedMessage } from '@prun/link';
import { initMessageBridge, onMessage } from '@prun/link/message-bus/content-bridge';
import { useConnectionStore } from '../stores/connection';
import { useSettingsStore, waitForSettingsHydration } from '../stores/settings';
import { initMessageHandlers, processMessage } from '../stores/message-handlers';
import { beginEntityBatch, endEntityBatch } from '../stores/entities';
import { populateStoresFromFio } from '../lib/fio';
import { rehydrateAllStores } from '../stores/cache';
import { warn, error as logError } from '../lib/debug/logger';
import { isDebugEnabled, createOverlay, markStep, markFailed, pollForAttribute, ensureDiagnosticsVisible } from '../lib/diagnostics';
import { initRefreshMode, isAutoRefreshEnabled } from '../lib/buffer-refresh';
import { executeBatchRefresh } from '../lib/buffer-refresh';
import { initDesktopBridge } from '../lib/desktop-bridge';
import { useSitesStore } from '../stores/entities';
import { useSiteSourceStore } from '../stores/site-data-sources';
import '../assets/styles.css';

export default defineContentScript({
  matches: ['https://apex.prosperousuniverse.com/*'],
  runAt: 'document_start',
  cssInjectionMode: 'ui',

  async main(ctx) {
    // Suppress Chrome MV3 "Extension context invalidated" rejections.
    // Our storage adapter handles this per-call, but WXT framework internals
    // or timing gaps can leak rejections we don't control.
    window.addEventListener('unhandledrejection', (e) => {
      if (String(e.reason).includes('Extension context invalidated')) {
        e.preventDefault();
      }
    });

    // Desktop detection — on desktop without ?apxm_force, run data pipeline
    // and bridge but skip the mobile UI overlay.
    const isMobile = window.matchMedia('(pointer: coarse)').matches;
    const forceEnabled = new URLSearchParams(window.location.search).has('apxm_force');
    const isDesktopBridgeMode = !isMobile && !forceEnabled;

    const debug = isDebugEnabled();

    if (debug) {
      createOverlay();
      markStep(1, 'ok');
      markStep(2, 'ok', isMobile ? 'mobile detected' : forceEnabled ? 'forced via ?apxm_force' : 'desktop bridge mode');
    }

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
      warn('Interceptor failed to initialize within 3s — aborting');
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
              } catch (err) {
                logError('Message handler error:', err);
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
              ...(s.apexUnresponsive ? { apexUnresponsive: false } : {}),
            }));
          }
        }, 0);
      }
    });

    // 5b. Detect unresponsive APEX — if no messages arrive within 5s, flag it
    const APEX_TIMEOUT_MS = 5000;
    setTimeout(() => {
      if (useConnectionStore.getState().messageCount === 0) {
        useConnectionStore.getState().setApexUnresponsive(true);
      }
    }, APEX_TIMEOUT_MS);

    // 6. Rehydrate entity stores from cache (after settings hydrate)
    await waitForSettingsHydration();
    await rehydrateAllStores();

    // Mark rehydrated sites as cache-sourced for per-site staleness indicators
    const rehydratedSites = useSitesStore.getState().getAll();
    if (rehydratedSites.length > 0) {
      const ts = useSitesStore.getState().lastUpdated ?? Date.now();
      useSiteSourceStore.getState().markAllSites(
        rehydratedSites.map((s) => s.siteId), 'cache', ts
      );
    }

    // 6b. FIO fetch (fire-and-forget, concurrent with React mount)
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

    // Desktop bridge: start iframe detection and store subscriptions
    if (!isMobile) {
      initDesktopBridge();
    }

    if (isDesktopBridgeMode) {
      console.log('[APXM] Desktop mode — bridge active, mobile UI skipped.');
      return;
    }

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

    // 8. Replace page favicon with APXM icon
    const faviconUrl = browser.runtime.getURL('/icon-48.png');
    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.type = 'image/png';
    link.href = faviconUrl;

    if (debug) {
      markStep(7, 'ok');
      ensureDiagnosticsVisible();
    }

    // 8. Initialize buffer refresh mode from URL param
    initRefreshMode();

    // 9. Auto-refresh: when mode is 'auto', wait for sites to load then
    //    batch-refresh all bases. Uses Zustand subscribe() to react to
    //    store state rather than a second onMessage listener.
    if (isAutoRefreshEnabled()) {
      const unsub = useSitesStore.subscribe((state) => {
        if (state.fetched && state.getAll().length > 0) {
          unsub();
          // 2s delay ensures the full login burst completes before
          // refresh begins — avoids competing with message processing
          setTimeout(() => {
            const siteIds = useSitesStore.getState().getAll().map((s) => s.siteId);
            executeBatchRefresh({ siteIds });
          }, 2000);
        }
      });
    }
  },
});
