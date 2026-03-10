/**
 * Desktop Bridge Orchestrator
 *
 * Detects APXM shell page iframes, manages handshake lifecycle,
 * and wires up store subscriptions for postMessage data flow.
 */

import { startHandshake, isAllowedOrigin } from './handshake';
import { subscribeToStores } from './subscriptions';
import type { ApxmBridgeMessage } from '../../types/bridge';

interface ActiveBridge {
  iframe: HTMLIFrameElement;
  cleanup: () => void;
}

let activeBridge: ActiveBridge | null = null;
let observer: MutationObserver | null = null;

function getIframeOrigin(iframe: HTMLIFrameElement): string | null {
  try {
    return new URL(iframe.src).origin;
  } catch {
    return null;
  }
}

function isApxmIframe(iframe: HTMLIFrameElement): boolean {
  const origin = getIframeOrigin(iframe);
  return origin !== null && isAllowedOrigin(origin);
}

function waitForIframeLoad(iframe: HTMLIFrameElement): Promise<void> {
  return new Promise((resolve) => {
    // If iframe has already loaded its target src, proceed immediately
    try {
      if (iframe.contentWindow?.location.href !== 'about:blank') {
        resolve();
        return;
      }
    } catch {
      // Cross-origin — contentWindow.location is inaccessible, meaning it already navigated
      resolve();
      return;
    }
    iframe.addEventListener('load', () => resolve(), { once: true });
  });
}

async function connectToIframe(iframe: HTMLIFrameElement): Promise<void> {
  // Already connected to this iframe
  if (activeBridge?.iframe === iframe) return;

  // Disconnect previous bridge if any
  disconnectBridge();

  // Wait for iframe to navigate to its src before sending postMessage
  await waitForIframeLoad(iframe);

  console.log('[APXM Bridge] Found shell iframe, starting handshake...');
  const success = await startHandshake(iframe);
  if (!success) return;

  // Determine target origin for postMessage
  const targetOrigin = getIframeOrigin(iframe);
  if (!targetOrigin || !iframe.contentWindow) return;

  const contentWindow = iframe.contentWindow;
  const postFn = (message: ApxmBridgeMessage) => {
    contentWindow.postMessage(message, targetOrigin);
  };

  const cleanup = subscribeToStores(postFn);
  activeBridge = { iframe, cleanup };
}

function disconnectBridge(): void {
  if (activeBridge) {
    console.log('[APXM Bridge] Disconnecting from shell iframe');
    activeBridge.cleanup();
    activeBridge = null;
  }
}

function scanForIframes(): void {
  const iframes = document.querySelectorAll('iframe');
  for (const iframe of iframes) {
    if (isApxmIframe(iframe)) {
      connectToIframe(iframe);
      return;
    }
  }
}

function handleMutations(mutations: MutationRecord[]): void {
  for (const mutation of mutations) {
    // Handle iframe src attribute changes (APEX may insert iframe first, set src after)
    if (mutation.type === 'attributes' && mutation.target instanceof HTMLIFrameElement) {
      if (isApxmIframe(mutation.target)) {
        connectToIframe(mutation.target);
      } else if (activeBridge?.iframe === mutation.target) {
        // src changed away from our shell — disconnect
        disconnectBridge();
      }
      continue;
    }

    // Check for added iframes
    for (const node of mutation.addedNodes) {
      if (node instanceof HTMLIFrameElement && isApxmIframe(node)) {
        connectToIframe(node);
        return;
      }
      // Also check children of added nodes (e.g., a div containing an iframe)
      if (node instanceof HTMLElement) {
        const iframes = node.querySelectorAll('iframe');
        for (const iframe of iframes) {
          if (isApxmIframe(iframe)) {
            connectToIframe(iframe);
            return;
          }
        }
      }
    }

    // Check for removed iframes — disconnect if our bridge iframe was removed
    if (activeBridge) {
      for (const node of mutation.removedNodes) {
        if (
          node === activeBridge.iframe ||
          (node instanceof HTMLElement && node.contains(activeBridge.iframe))
        ) {
          disconnectBridge();
          return;
        }
      }
    }
  }
}

function handleIncomingMessages(event: MessageEvent): void {
  if (!isAllowedOrigin(event.origin)) return;

  const data = event.data;
  if (!data || typeof data !== 'object') return;

  if (data.type === 'apxm-buffer-command') {
    // Step 2: log only, actual dispatch comes in Step 3+
    console.log('[APXM Bridge] Received buffer command:', data.command);
  }
}

/**
 * Initializes the desktop bridge.
 * Scans for existing iframes and watches for new ones via MutationObserver.
 */
export function initDesktopBridge(): void {
  console.log('[APXM] Desktop bridge initializing...');

  // Listen for incoming messages from shell
  window.addEventListener('message', handleIncomingMessages);

  // Scan existing DOM
  scanForIframes();

  // Watch for future iframe insertions/removals
  observer = new MutationObserver(handleMutations);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src'],
  });
}
