/**
 * Desktop Bridge Handshake
 *
 * Extension sends apxm-hello to iframe, waits for apxm-hello-ack reply.
 * Validates message origin against allowed list.
 */

import type { ApxmHelloAckMessage } from '../../types/bridge';
import { BUILD_VERSION } from '../constants';

const ALLOWED_ORIGINS = ['https://apxm.27bit.dev'];
if (__DEV__) {
  ALLOWED_ORIGINS.push('http://localhost:5173', 'http://localhost:5174');
}

const HANDSHAKE_TIMEOUT_MS = 3000;

export function isAllowedOrigin(origin: string): boolean {
  return ALLOWED_ORIGINS.includes(origin);
}

/**
 * Initiates handshake with an iframe's content window.
 * Resolves true on successful ack, false on timeout.
 */
export function startHandshake(iframe: HTMLIFrameElement): Promise<boolean> {
  return new Promise((resolve) => {
    const contentWindow = iframe.contentWindow;
    if (!contentWindow) {
      console.warn('[APXM Bridge] iframe has no contentWindow');
      resolve(false);
      return;
    }

    let settled = false;

    function onMessage(event: MessageEvent): void {
      if (settled) return;
      if (!isAllowedOrigin(event.origin)) return;

      const data = event.data;
      if (
        data &&
        typeof data === 'object' &&
        data.type === 'apxm-hello-ack'
      ) {
        const ack = data as ApxmHelloAckMessage;
        settled = true;
        window.removeEventListener('message', onMessage);
        clearTimeout(timer);
        console.log(`[APXM Bridge] Handshake complete (shell version: ${ack.version})`);
        resolve(true);
      }
    }

    window.addEventListener('message', onMessage);

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        window.removeEventListener('message', onMessage);
        console.warn('[APXM Bridge] Handshake timeout — no ack received within 3s');
        resolve(false);
      }
    }, HANDSHAKE_TIMEOUT_MS);

    // Determine target origin from iframe src
    let targetOrigin: string;
    try {
      targetOrigin = new URL(iframe.src).origin;
    } catch {
      console.warn('[APXM Bridge] Could not parse iframe src:', iframe.src);
      settled = true;
      window.removeEventListener('message', onMessage);
      clearTimeout(timer);
      resolve(false);
      return;
    }

    if (!isAllowedOrigin(targetOrigin)) {
      console.warn('[APXM Bridge] iframe origin not allowed:', targetOrigin);
      settled = true;
      window.removeEventListener('message', onMessage);
      clearTimeout(timer);
      resolve(false);
      return;
    }

    contentWindow.postMessage(
      { type: 'apxm-hello', version: BUILD_VERSION },
      targetOrigin,
    );
  });
}
