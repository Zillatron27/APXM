/**
 * Map Module
 *
 * Initializes the Helm galaxy map and registers bridge message listeners.
 * Step 2: console.log received data only — rendering comes in Step 3.
 */

import { createMap } from '@27bit/helm';
import type { ApxmInitMessage, ApxmUpdateMessage } from './types/bridge';

let messageListener: ((event: MessageEvent) => void) | null = null;

export function initMap(container: HTMLElement): void {
  createMap(container);

  messageListener = (event: MessageEvent) => {
    const data = event.data;
    if (!data || typeof data !== 'object') return;

    if (data.type === 'apxm-init') {
      const msg = data as ApxmInitMessage;
      console.log('[APXM Shell] Received init snapshot:', msg.snapshot);
    } else if (data.type === 'apxm-update') {
      const msg = data as ApxmUpdateMessage;
      console.log('[APXM Shell] Received update:', msg.update.entityType, msg.update.data);
    }
  };

  window.addEventListener('message', messageListener);
  console.log('[APXM Shell] Map initialized, listening for bridge messages');
}
