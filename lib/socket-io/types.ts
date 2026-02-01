/**
 * Socket.IO packet and message type definitions
 */

import type { Packet as EIOPacket } from 'engine.io-parser';
import type { Packet as SIOPacket } from 'socket.io-parser';

export type { EIOPacket, SIOPacket };

/** Direction of message flow */
export type MessageDirection = 'inbound' | 'outbound';

/** Decoded game message from Prun server */
export interface GameMessage {
  messageType: string;
  payload: unknown;
}

/** Processed message with metadata */
export interface ProcessedMessage extends GameMessage {
  timestamp: number;
  direction: MessageDirection;
  rawSize: number;
}

/** Window augmentations for script blocking */
declare global {
  interface Window {
    __APXM_BLOCKED_SCRIPTS__?: HTMLScriptElement[];
    __APXM_OBSERVER__?: MutationObserver;
    __APXM_DEBUG__?: boolean;
  }
}
