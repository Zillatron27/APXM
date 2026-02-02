import { describe, it, expect, beforeEach } from 'vitest';
import { useConnectionStore } from '../connection';

describe('connection store', () => {
  beforeEach(() => {
    useConnectionStore.setState({
      connected: false,
      lastMessageTimestamp: null,
      messageCount: 0,
      reconnectCount: 0,
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

  describe('reset', () => {
    it('resets all state to initial values', () => {
      useConnectionStore.getState().setConnected(true);
      useConnectionStore.getState().setLastMessageTimestamp(12345);
      useConnectionStore.getState().incrementMessageCount();
      useConnectionStore.getState().incrementReconnectCount();

      useConnectionStore.getState().reset();

      expect(useConnectionStore.getState().connected).toBe(false);
      expect(useConnectionStore.getState().lastMessageTimestamp).toBeNull();
      expect(useConnectionStore.getState().messageCount).toBe(0);
      expect(useConnectionStore.getState().reconnectCount).toBe(0);
    });
  });
});
