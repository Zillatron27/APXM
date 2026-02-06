/**
 * Main-world WebSocket interceptor script
 *
 * This script runs in the main world (page context) to:
 * 1. Block Prun scripts from loading
 * 2. Install WebSocket/XHR proxies
 * 3. Restore blocked scripts (now through proxied WebSocket)
 */

import { installWebSocketProxy, installXHRProxy, setMessageCallback } from '../lib/socket-io/middleware';
import { emitMessage } from '../lib/message-bus/main-world';
import { logMessage } from '../lib/debug/logger';
import type { ProcessedMessage } from '../lib/socket-io/types';

/**
 * Check if a script should be blocked (same-origin Prun scripts)
 */
function shouldBlockScript(src: string): boolean {
  if (!src) return false;

  // Block relative paths (Prun uses /static/js/main.abc123.js)
  if (src.startsWith('/')) return true;

  // Block same-origin absolute URLs
  try {
    const url = new URL(src, location.origin);
    if (url.origin === location.origin) return true;
  } catch {
    return false;
  }

  return false;
}

/**
 * Block a script by moving src to textContent
 */
function blockScript(script: HTMLScriptElement, blocked: HTMLScriptElement[]): void {
  if (script.src && shouldBlockScript(script.src)) {
    console.log('[APXM] Blocking script:', script.src);
    script.textContent = script.src;
    script.removeAttribute('src');
    blocked.push(script);
  }
}

/**
 * Install script blocker via MutationObserver
 */
function installScriptBlocker(): void {
  // Skip if already installed
  if (window.__APXM_OBSERVER__) return;

  const blocked: HTMLScriptElement[] = [];
  window.__APXM_BLOCKED_SCRIPTS__ = blocked;

  // Check existing scripts
  const existingScripts = document.getElementsByTagName('script');
  for (let i = 0; i < existingScripts.length; i++) {
    blockScript(existingScripts[i], blocked);
  }

  // Create observer for new scripts
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeName === 'SCRIPT') {
          blockScript(node as HTMLScriptElement, blocked);
        } else if ((node as Element).getElementsByTagName) {
          const scripts = (node as Element).getElementsByTagName('script');
          for (let i = 0; i < scripts.length; i++) {
            blockScript(scripts[i], blocked);
          }
        }
      }
    }
  });

  window.__APXM_OBSERVER__ = observer;
  observer.observe(document, { childList: true, subtree: true });

  console.log('[APXM] Script blocker installed');
}

/**
 * Validate a URL for restoration
 */
function isValidUrl(s: string): boolean {
  return s.startsWith('/') || s.startsWith('https://');
}

/**
 * Restore blocked scripts in-place
 */
function restoreBlockedScripts(): void {
  // Disconnect observer first
  window.__APXM_OBSERVER__?.disconnect();

  const blocked = window.__APXM_BLOCKED_SCRIPTS__ || [];
  console.log(`[APXM] Restoring ${blocked.length} blocked scripts`);

  for (const script of blocked) {
    if (script.textContent && isValidUrl(script.textContent)) {
      script.src = script.textContent;
      script.textContent = '';
    }
  }
}

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
  document.documentElement.dataset.apxmInterceptor = 'ready';

  console.log('[APXM] Interceptor ready');
});
