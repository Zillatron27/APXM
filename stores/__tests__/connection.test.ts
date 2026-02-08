import { describe, it, expect, beforeEach } from 'vitest';
import { useConnectionStore } from '../connection';

describe('connection store', () => {
  beforeEach(() => {
    useConnectionStore.setState({
      connected: false,
      lastMessageTimestamp: null,
      messageCount: 0,
      reconnectCount: 0,
      discardedMessages: 0,
      unknownMessageTypes: [],
      apexUnresponsive: false,
    });
  });

  describe('initial state', () => {
    it('starts disconnected', () => {
      expect(useConnectionStore.getState().connected).toBe(false);
    });

    it('starts with null lastMessageTimestamp', () => {
      expect(useConnectionStore.getState().lastMessageTimestamp).toBeNull();
    });

    it('starts with zero messageCount', () => {
      expect(useConnectionStore.getState().messageCount).toBe(0);
    });

    it('starts with zero reconnectCount', () => {
      expect(useConnectionStore.getState().reconnectCount).toBe(0);
    });

    it('starts with zero discardedMessages', () => {
      expect(useConnectionStore.getState().discardedMessages).toBe(0);
    });

    it('starts with empty unknownMessageTypes', () => {
      expect(useConnectionStore.getState().unknownMessageTypes).toEqual([]);
    });

    it('starts with apexUnresponsive false', () => {
      expect(useConnectionStore.getState().apexUnresponsive).toBe(false);
    });
  });

  describe('setConnected', () => {
    it('updates connected state', () => {
      useConnectionStore.getState().setConnected(true);
      expect(useConnectionStore.getState().connected).toBe(true);

      useConnectionStore.getState().setConnected(false);
      expect(useConnectionStore.getState().connected).toBe(false);
    });
  });

  describe('setLastMessageTimestamp', () => {
    it('updates timestamp', () => {
      const timestamp = Date.now();
      useConnectionStore.getState().setLastMessageTimestamp(timestamp);
      expect(useConnectionStore.getState().lastMessageTimestamp).toBe(timestamp);
    });
  });

  describe('incrementMessageCount', () => {
    it('increments the count', () => {
      useConnectionStore.getState().incrementMessageCount();
      expect(useConnectionStore.getState().messageCount).toBe(1);

      useConnectionStore.getState().incrementMessageCount();
      expect(useConnectionStore.getState().messageCount).toBe(2);
    });
  });

  describe('incrementReconnectCount', () => {
    it('increments the reconnect count', () => {
      useConnectionStore.getState().incrementReconnectCount();
      expect(useConnectionStore.getState().reconnectCount).toBe(1);

      useConnectionStore.getState().incrementReconnectCount();
      expect(useConnectionStore.getState().reconnectCount).toBe(2);
    });
  });

  describe('incrementDiscarded', () => {
    it('tracks discarded message count', () => {
      useConnectionStore.getState().incrementDiscarded();
      expect(useConnectionStore.getState().discardedMessages).toBe(1);

      useConnectionStore.getState().incrementDiscarded();
      expect(useConnectionStore.getState().discardedMessages).toBe(2);
    });
  });

  describe('addUnknownMessageType', () => {
    it('tracks unknown message types with deduplication', () => {
      useConnectionStore.getState().addUnknownMessageType('UNKNOWN_FOO');
      useConnectionStore.getState().addUnknownMessageType('UNKNOWN_BAR');
      useConnectionStore.getState().addUnknownMessageType('UNKNOWN_FOO'); // duplicate

      const types = useConnectionStore.getState().unknownMessageTypes;
      expect(types).toHaveLength(2);
      expect(types).toContain('UNKNOWN_FOO');
      expect(types).toContain('UNKNOWN_BAR');
    });

    it('caps unknown message types at 20', () => {
      for (let i = 0; i < 25; i++) {
        useConnectionStore.getState().addUnknownMessageType(`TYPE_${i}`);
      }

      expect(useConnectionStore.getState().unknownMessageTypes).toHaveLength(20);
      expect(useConnectionStore.getState().unknownMessageTypes).toContain('TYPE_0');
      expect(useConnectionStore.getState().unknownMessageTypes).toContain('TYPE_19');
      expect(useConnectionStore.getState().unknownMessageTypes).not.toContain('TYPE_20');
    });
  });

  describe('setApexUnresponsive', () => {
    it('updates apexUnresponsive state', () => {
      useConnectionStore.getState().setApexUnresponsive(true);
      expect(useConnectionStore.getState().apexUnresponsive).toBe(true);

      useConnectionStore.getState().setApexUnresponsive(false);
      expect(useConnectionStore.getState().apexUnresponsive).toBe(false);
    });
  });

  describe('reset', () => {
    it('resets all state to initial values', () => {
      useConnectionStore.getState().setConnected(true);
      useConnectionStore.getState().setLastMessageTimestamp(12345);
      useConnectionStore.getState().incrementMessageCount();
      useConnectionStore.getState().incrementReconnectCount();
      useConnectionStore.getState().setApexUnresponsive(true);

      useConnectionStore.getState().reset();

      expect(useConnectionStore.getState().connected).toBe(false);
      expect(useConnectionStore.getState().lastMessageTimestamp).toBeNull();
      expect(useConnectionStore.getState().messageCount).toBe(0);
      expect(useConnectionStore.getState().reconnectCount).toBe(0);
      expect(useConnectionStore.getState().apexUnresponsive).toBe(false);
    });

    it('resets diagnostic counters on reconnect', () => {
      useConnectionStore.getState().incrementDiscarded();
      useConnectionStore.getState().incrementDiscarded();
      useConnectionStore.getState().addUnknownMessageType('UNKNOWN_FOO');
      useConnectionStore.getState().addUnknownMessageType('UNKNOWN_BAR');

      expect(useConnectionStore.getState().discardedMessages).toBe(2);
      expect(useConnectionStore.getState().unknownMessageTypes).toHaveLength(2);

      useConnectionStore.getState().reset();

      expect(useConnectionStore.getState().discardedMessages).toBe(0);
      expect(useConnectionStore.getState().unknownMessageTypes).toEqual([]);
    });
  });
});
