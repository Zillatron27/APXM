/**
 * WebSocket/XHR proxy middleware
 *
 * Intercepts all Socket.IO communication for message capture.
 */

import { decodeWebSocketMessage, decodeXHRPayload } from './decoder';
import type { ProcessedMessage } from './types';

/** Callback for processed messages */
type MessageCallback = (message: ProcessedMessage) => void;

let messageCallback: MessageCallback | null = null;

/**
 * Set the callback for processed messages
 */
export function setMessageCallback(callback: MessageCallback): void {
  messageCallback = callback;
}

/**
 * Emit a processed message to the callback
 */
function emitMessage(message: ProcessedMessage): void {
  if (messageCallback) {
    try {
      messageCallback(message);
    } catch (error) {
      console.error('[APXM] Message callback error:', error);
    }
  }
}

/**
 * Process inbound message data
 */
function processInboundMessage(data: string | ArrayBuffer): void {
  if (typeof data !== 'string') {
    // Binary messages not used by Prun
    return;
  }

  const message = decodeWebSocketMessage(data, 'inbound');
  if (message) {
    emitMessage(message);
  }
}

/**
 * Process outbound message data
 */
function processOutboundMessage(data: string | ArrayBuffer): void {
  if (typeof data !== 'string') {
    return;
  }

  const message = decodeWebSocketMessage(data, 'outbound');
  if (message) {
    emitMessage(message);
  }
}

/**
 * Install WebSocket proxy
 */
export function installWebSocketProxy(): void {
  const OriginalWebSocket = window.WebSocket;

  window.WebSocket = new Proxy(OriginalWebSocket, {
    construct(target, args: [string, (string | string[])?]) {
      const ws = new target(...args);

      return new Proxy(ws, {
        set(target, prop, value) {
          if (prop === 'onmessage') {
            target.onmessage = (e: MessageEvent) => {
              try {
                processInboundMessage(e.data);
              } catch (error) {
                console.error('[APXM] Error processing inbound message:', error);
              }
              value(e);
            };
            return true;
          }
          return Reflect.set(target, prop, value);
        },

        get(target, prop) {
          // Intercept send() for outbound logging
          if (prop === 'send') {
            return (data: string | ArrayBuffer) => {
              try {
                processOutboundMessage(data);
              } catch (error) {
                console.error('[APXM] Error processing outbound message:', error);
              }
              target.send(data);
            };
          }

          // Intercept addEventListener for 'message' events
          if (prop === 'addEventListener') {
            return (type: string, listener: EventListener, options?: AddEventListenerOptions | boolean) => {
              if (type === 'message') {
                const wrappedListener = (e: Event) => {
                  try {
                    processInboundMessage((e as MessageEvent).data);
                  } catch (error) {
                    console.error('[APXM] Error processing inbound message:', error);
                  }
                  listener(e);
                };
                target.addEventListener(type, wrappedListener, options);
              } else {
                target.addEventListener(type, listener, options);
              }
            };
          }

          const v = Reflect.get(target, prop);
          return typeof v === 'function' ? v.bind(target) : v;
        },
      });
    },
  });
}

/**
 * Install XHR proxy for Socket.IO polling fallback
 */
export function installXHRProxy(): void {
  const OriginalXHR = window.XMLHttpRequest;

  window.XMLHttpRequest = new Proxy(OriginalXHR, {
    construct(target) {
      const xhr = new target();
      let isSocketIO = false;

      return new Proxy(xhr, {
        get(target, prop) {
          const value = Reflect.get(target, prop);
          return typeof value === 'function' ? value.bind(target) : value;
        },

        set(target, prop, value) {
          if (prop === 'onreadystatechange') {
            target.onreadystatechange = function () {
              if (target.readyState === 4 && target.status === 200 && isSocketIO) {
                try {
                  const messages = decodeXHRPayload(target.responseText, 'inbound');
                  for (const message of messages) {
                    emitMessage(message);
                  }
                } catch (error) {
                  console.error('[APXM] Error processing XHR response:', error);
                }
              }
              value.call(target);
            };
            return true;
          }
          return Reflect.set(target, prop, value);
        },
      });

      // Track if this is a Socket.IO request
      const originalOpen = xhr.open;
      xhr.open = function (method: string, url: string | URL, async?: boolean, username?: string | null, password?: string | null) {
        const urlStr = url.toString();
        isSocketIO = urlStr.includes('socket.io') || urlStr.includes('engine.io');
        return originalOpen.call(this, method, url, async ?? true, username ?? null, password ?? null);
      };

      return xhr;
    },
  });
}
