import { describe, it, expect } from 'vitest';
import { encodePayload, Packet as EIOPacket } from 'engine.io-parser';
import { Encoder, PacketType } from 'socket.io-parser';
import { decodeWebSocketMessage, decodeXHRPayload, isConnectionMessage } from '../decoder';

/**
 * Helper to encode a Socket.IO packet wrapped in Engine.IO
 */
function encodeGameMessage(messageType: string, payload: Record<string, unknown> = {}): string {
  const sioEncoder = new Encoder();
  const sioPacket = {
    type: PacketType.EVENT,
    nsp: '/',
    data: ['event', { messageType, ...payload }],
  };
  const [encoded] = sioEncoder.encode(sioPacket);
  // Engine.IO message type is '4' prefix for message
  return '4' + encoded;
}

/**
 * Helper to encode a Socket.IO CONNECT packet
 */
function encodeConnectPacket(): string {
  const sioEncoder = new Encoder();
  const sioPacket = {
    type: PacketType.CONNECT,
    nsp: '/',
    data: { sid: 'test-session-id' },
  };
  const [encoded] = sioEncoder.encode(sioPacket);
  return '4' + encoded;
}

/**
 * Helper to encode batched packets for XHR
 */
function encodeBatchedPayload(packets: EIOPacket[]): string {
  let result = '';
  encodePayload(packets, (encoded) => {
    result = encoded;
  });
  return result;
}

describe('decodeWebSocketMessage', () => {
  it('decodes a valid game message', () => {
    const encoded = encodeGameMessage('SITE_SITES', { sites: [] });
    const result = decodeWebSocketMessage(encoded, 'inbound');

    expect(result).not.toBeNull();
    expect(result!.messageType).toBe('SITE_SITES');
    expect(result!.direction).toBe('inbound');
    expect(result!.payload).toHaveProperty('messageType', 'SITE_SITES');
    expect(result!.payload).toHaveProperty('sites');
  });

  it('decodes outbound messages', () => {
    const encoded = encodeGameMessage('FLT_SUBMIT', { flightId: '123' });
    const result = decodeWebSocketMessage(encoded, 'outbound');

    expect(result).not.toBeNull();
    expect(result!.messageType).toBe('FLT_SUBMIT');
    expect(result!.direction).toBe('outbound');
  });

  it('decodes CONNECT packet as CLIENT_CONNECTION_OPENED', () => {
    const encoded = encodeConnectPacket();
    const result = decodeWebSocketMessage(encoded, 'inbound');

    expect(result).not.toBeNull();
    expect(result!.messageType).toBe('CLIENT_CONNECTION_OPENED');
  });

  it('returns null for ping packets', () => {
    // Engine.IO ping is type '2'
    const result = decodeWebSocketMessage('2', 'inbound');
    expect(result).toBeNull();
  });

  it('returns null for pong packets', () => {
    // Engine.IO pong is type '3'
    const result = decodeWebSocketMessage('3', 'inbound');
    expect(result).toBeNull();
  });

  it('returns null for malformed data', () => {
    const result = decodeWebSocketMessage('invalid-garbage', 'inbound');
    expect(result).toBeNull();
  });

  it('includes timestamp and rawSize', () => {
    const encoded = encodeGameMessage('TEST_MESSAGE');
    const before = Date.now();
    const result = decodeWebSocketMessage(encoded, 'inbound');
    const after = Date.now();

    expect(result).not.toBeNull();
    expect(result!.timestamp).toBeGreaterThanOrEqual(before);
    expect(result!.timestamp).toBeLessThanOrEqual(after);
    expect(result!.rawSize).toBe(encoded.length);
  });
});

describe('decodeXHRPayload', () => {
  it('decodes batched packets', () => {
    const packets: EIOPacket[] = [
      { type: 'message', data: encodeGameMessage('MSG_ONE').slice(1) },
      { type: 'message', data: encodeGameMessage('MSG_TWO').slice(1) },
    ];
    // For XHR, we need to encode the full payload
    const encoded = encodeBatchedPayload([
      { type: 'message', data: encodeGameMessage('MSG_ONE').slice(1) },
      { type: 'message', data: encodeGameMessage('MSG_TWO').slice(1) },
    ]);

    const results = decodeXHRPayload(encoded, 'inbound');

    expect(results.length).toBe(2);
    expect(results[0].messageType).toBe('MSG_ONE');
    expect(results[1].messageType).toBe('MSG_TWO');
  });

  it('filters out non-message packets', () => {
    const encoded = encodeBatchedPayload([
      { type: 'ping' },
      { type: 'message', data: encodeGameMessage('REAL_MSG').slice(1) },
      { type: 'pong' },
    ]);

    const results = decodeXHRPayload(encoded, 'inbound');

    expect(results.length).toBe(1);
    expect(results[0].messageType).toBe('REAL_MSG');
  });

  it('returns empty array for malformed payload', () => {
    const results = decodeXHRPayload('totally-invalid', 'inbound');
    expect(results).toEqual([]);
  });
});

describe('isConnectionMessage', () => {
  it('returns true for CLIENT_CONNECTION_OPENED', () => {
    expect(isConnectionMessage('CLIENT_CONNECTION_OPENED')).toBe(true);
  });

  it('returns false for other message types', () => {
    expect(isConnectionMessage('SITE_SITES')).toBe(false);
    expect(isConnectionMessage('STORAGE_STORAGES')).toBe(false);
    expect(isConnectionMessage('')).toBe(false);
  });
});
