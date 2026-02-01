/**
 * Socket.IO decoder pipeline
 *
 * Decodes engine.io and socket.io packets to extract game messages.
 * Uses decodePacket for WebSocket (single packet) and decodePayload for XHR (batched).
 */

import { decodePacket, decodePayload, Packet as EIOPacket } from 'engine.io-parser';
import { Decoder, Packet as SIOPacket, PacketType } from 'socket.io-parser';
import type { GameMessage, MessageDirection, ProcessedMessage } from './types';

/**
 * Decode a single WebSocket message (single engine.io packet)
 */
export function decodeWebSocketMessage(
  data: string,
  direction: MessageDirection
): ProcessedMessage | null {
  try {
    const rawSize = data.length;
    const packet = decodePacket(data);
    return processEngineIOPacket(packet, direction, rawSize);
  } catch (error) {
    console.error('[APXM] Failed to decode WebSocket message:', error);
    return null;
  }
}

/**
 * Decode XHR polling response (batched engine.io packets)
 */
export function decodeXHRPayload(
  data: string,
  direction: MessageDirection
): ProcessedMessage[] {
  const messages: ProcessedMessage[] = [];
  const rawSize = data.length;

  try {
    const packets = decodePayload(data);
    for (const packet of packets) {
      const processed = processEngineIOPacket(packet, direction, rawSize);
      if (processed) {
        messages.push(processed);
      }
    }
  } catch (error) {
    console.error('[APXM] Failed to decode XHR payload:', error);
  }

  return messages;
}

/**
 * Process a single engine.io packet
 */
function processEngineIOPacket(
  packet: EIOPacket,
  direction: MessageDirection,
  rawSize: number
): ProcessedMessage | null {
  // Only process message packets (type === 'message')
  // Ignore ping/pong/open/close (transport level)
  if (packet.type !== 'message') {
    return null;
  }

  const sioPacket = decodeSIOPacket(packet.data);
  if (!sioPacket) {
    return null;
  }

  return processSIOPacket(sioPacket, direction, rawSize);
}

/**
 * Decode a socket.io packet from engine.io message data
 */
function decodeSIOPacket(data: unknown): SIOPacket | null {
  if (typeof data !== 'string') {
    return null;
  }

  const decoder = new Decoder();
  let decodedPacket: SIOPacket | null = null;

  decoder.on('decoded', (packet: SIOPacket) => {
    decodedPacket = packet;
  });

  try {
    decoder.add(data);
  } catch (error) {
    console.error('[APXM] Failed to decode SIO packet:', error);
    return null;
  }

  return decodedPacket;
}

/**
 * Process a socket.io packet and extract game message
 */
function processSIOPacket(
  packet: SIOPacket,
  direction: MessageDirection,
  rawSize: number
): ProcessedMessage | null {
  const timestamp = Date.now();

  // SIO type 0 = CONNECT
  if (packet.type === PacketType.CONNECT) {
    return {
      messageType: 'CLIENT_CONNECTION_OPENED',
      payload: packet.data,
      timestamp,
      direction,
      rawSize,
    };
  }

  // SIO type 2 = EVENT
  if (packet.type === PacketType.EVENT) {
    const data = packet.data as unknown[];

    // Prun uses ['event', payload] format
    if (Array.isArray(data) && data[0] === 'event' && data[1] !== undefined) {
      const payload = data[1] as Record<string, unknown>;
      const messageType = (payload.messageType as string) || 'UNKNOWN';

      return {
        messageType,
        payload,
        timestamp,
        direction,
        rawSize,
      };
    }
  }

  return null;
}

/**
 * Check if a message type indicates connection established
 */
export function isConnectionMessage(messageType: string): boolean {
  return messageType === 'CLIENT_CONNECTION_OPENED';
}
