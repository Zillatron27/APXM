/**
 * Main-world WebSocket interceptor script
 *
 * Thin orchestrator: wires shared library components to block Prun scripts,
 * install proxies, and emit decoded messages to the content script bridge.
 */

import { installWebSocketProxy, installXHRProxy, setMessageCallback } from '@prun/link/socket-io';
import { emitMessage } from '@prun/link/message-bus/main-world';
import { installScriptBlocker, restoreBlockedScripts } from '@prun/link/script-control';
import type { ProcessedMessage } from '@prun/link';
import { log, logMessage } from '../lib/debug/logger';

/**
 * Handle processed messages
 */
function handleMessage(message: ProcessedMessage): void {
  logMessage(message);
  emitMessage(message);
}

export default defineUnlistedScript(() => {
  log('Installing interceptor...');

  // Detect a competing @prun/link interceptor (Helm extension, rprun, or
  // another APXM-family tool). They all set the same shared readiness
  // attribute, so if it is already present before we install, one ran first
  // — and @prun/link has no idempotency guard, so a second proxy wraps the
  // first and can starve it. This catches the "APXM injected second"
  // ordering; the reverse is caught by the honest "no data" overlay.
  const competingInterceptor =
    document.documentElement.dataset.prunLinkInterceptor === 'ready';

  // 1. Install script blocker FIRST (blocks Prun from loading)
  installScriptBlocker();

  // 2. Set up message callback
  setMessageCallback(handleMessage);

  // 3. Install WebSocket proxy
  installWebSocketProxy();

  // 4. Install XHR proxy (for polling fallback)
  installXHRProxy();

  // 5. Restore blocked scripts (they now load through proxied WebSocket)
  restoreBlockedScripts();

  if (competingInterceptor) {
    document.documentElement.dataset.prunLinkConflict = 'true';
    log('Competing @prun/link interceptor detected — APXM may be starved');
  }

  // Shared readiness signal for any external @prun/link consumer.
  document.documentElement.dataset.prunLinkInterceptor = 'ready';
  // APXM's own completion signal. The content script gates on THIS, not the
  // shared attribute, so it waits for our interceptor specifically (a shared
  // 'ready' could be another extension's) and reads the conflict flag, set
  // above, without racing.
  document.documentElement.dataset.apxmInterceptor = 'ready';

  log('Interceptor ready');
});
