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
import { logMessage } from '../lib/debug/logger';

/**
 * Handle processed messages
 */
function handleMessage(message: ProcessedMessage): void {
  logMessage(message);
  emitMessage(message);
}

export default defineUnlistedScript(() => {
  console.log('[APXM] Installing interceptor...');

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

  // Signal readiness to content script via shared DOM attribute
  document.documentElement.dataset.prunLinkInterceptor = 'ready';

  console.log('[APXM] Interceptor ready');
});
