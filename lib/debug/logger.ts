/**
 * Conditional debug logging for APXM
 */

import type { ProcessedMessage } from '../socket-io/types';

/**
 * Log a processed message with direction indicator
 */
export function logMessage(message: ProcessedMessage): void {
  const direction = message.direction === 'inbound' ? '←' : '→';
  const sizeKB = (message.rawSize / 1024).toFixed(1);
  const ts = new Date(message.timestamp).toISOString();

  console.log(`[APXM] ${direction} ${message.messageType} | ${sizeKB}KB | ${ts}`);

  if (window.__APXM_DEBUG__) {
    console.log('[APXM] Payload:', message.payload);
  }
}
