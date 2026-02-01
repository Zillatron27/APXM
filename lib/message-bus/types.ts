/**
 * Event bus type definitions
 */

import type { ProcessedMessage } from '../socket-io/types';

/** Handler for any message */
export type MessageHandler = (message: ProcessedMessage) => void;

/** CustomEvent detail structure */
export interface APXMEventDetail {
  messageType: string;
  payload: unknown;
  timestamp: number;
  direction: 'inbound' | 'outbound';
  rawSize: number;
}

/** Custom event type declaration */
declare global {
  interface WindowEventMap {
    'apxm-message': CustomEvent<APXMEventDetail>;
  }
}
