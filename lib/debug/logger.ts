/**
 * Conditional debug logging for APXM
 *
 * Production builds (__DEV__ === false): all logging is suppressed
 * unless ?apxm_debug is present in the URL.
 * Dev builds (__DEV__ === true): all logging is active.
 */

import type { ProcessedMessage } from '@prun/link';

declare global {
  interface Window {
    __APXM_DEBUG__?: boolean;
  }
}

function isLoggingEnabled(): boolean {
  return __DEV__ || location.search.includes('apxm_debug');
}

/** General-purpose log (gated by dev/debug mode) */
export function log(...args: unknown[]): void {
  if (isLoggingEnabled()) console.log('[APXM]', ...args);
}

/** Warning log (gated by dev/debug mode) */
export function warn(...args: unknown[]): void {
  if (isLoggingEnabled()) console.warn('[APXM]', ...args);
}

/** Error log — always active, even in production */
export function error(...args: unknown[]): void {
  console.error('[APXM]', ...args);
}

/**
 * Log a processed message with direction indicator
 */
export function logMessage(message: ProcessedMessage): void {
  if (!isLoggingEnabled()) return;

  const direction = message.direction === 'inbound' ? '←' : '→';
  const sizeKB = (message.rawSize / 1024).toFixed(1);
  const ts = new Date(message.timestamp).toISOString();

  console.log(`[APXM] ${direction} ${message.messageType} | ${sizeKB}KB | ${ts}`);

  if (window.__APXM_DEBUG__) {
    console.log('[APXM] Payload:', message.payload);
  }
}
