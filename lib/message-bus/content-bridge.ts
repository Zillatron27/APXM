/**
 * Content script message bridge
 *
 * Receives CustomEvents from main-world and forwards to registered handlers.
 */

import type { ProcessedMessage } from '../socket-io/types';
import type { APXMEventDetail, MessageHandler } from './types';

const anyHandlers: MessageHandler[] = [];
const typeHandlers = new Map<string, MessageHandler[]>();

/**
 * Register a handler for all messages
 */
export function onMessage(handler: MessageHandler): () => void {
  anyHandlers.push(handler);
  return () => {
    const index = anyHandlers.indexOf(handler);
    if (index !== -1) {
      anyHandlers.splice(index, 1);
    }
  };
}

/**
 * Register a handler for a specific message type
 */
export function onMessageType(type: string, handler: MessageHandler): () => void {
  if (!typeHandlers.has(type)) {
    typeHandlers.set(type, []);
  }
  typeHandlers.get(type)!.push(handler);

  return () => {
    const handlers = typeHandlers.get(type);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  };
}

/**
 * Initialize the message bridge to listen for CustomEvents
 */
export function initMessageBridge(): void {
  window.addEventListener('apxm-message', (e: CustomEvent<APXMEventDetail>) => {
    const detail = e.detail;
    const message: ProcessedMessage = {
      messageType: detail.messageType,
      payload: detail.payload,
      timestamp: detail.timestamp,
      direction: detail.direction,
      rawSize: detail.rawSize,
    };

    // Call handlers
    for (const handler of anyHandlers) {
      try {
        handler(message);
      } catch (error) {
        console.error('[APXM] Content bridge handler error:', error);
      }
    }

    const handlers = typeHandlers.get(message.messageType);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(message);
        } catch (error) {
          console.error('[APXM] Content bridge handler error:', error);
        }
      }
    }
  });
}
