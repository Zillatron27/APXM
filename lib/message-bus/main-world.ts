/**
 * Main-world message bus
 *
 * Dispatches messages via CustomEvents for cross-world communication.
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
 * Emit a message to all handlers and dispatch CustomEvent
 */
export function emitMessage(message: ProcessedMessage): void {
  // Call main-world handlers
  for (const handler of anyHandlers) {
    try {
      handler(message);
    } catch (error) {
      console.error('[APXM] Handler error:', error);
    }
  }

  const handlers = typeHandlers.get(message.messageType);
  if (handlers) {
    for (const handler of handlers) {
      try {
        handler(message);
      } catch (error) {
        console.error('[APXM] Handler error:', error);
      }
    }
  }

  // Dispatch CustomEvent for content script bridge
  const detail: APXMEventDetail = {
    messageType: message.messageType,
    payload: message.payload,
    timestamp: message.timestamp,
    direction: message.direction,
    rawSize: message.rawSize,
  };

  window.dispatchEvent(new CustomEvent('apxm-message', { detail }));
}
