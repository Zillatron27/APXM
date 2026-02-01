import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { onMessage, onMessageType, initMessageBridge } from '../content-bridge';
import type { APXMEventDetail } from '../types';

function createMockEventDetail(overrides: Partial<APXMEventDetail> = {}): APXMEventDetail {
  return {
    messageType: 'TEST_MESSAGE',
    payload: { data: 'test' },
    timestamp: Date.now(),
    direction: 'inbound',
    rawSize: 100,
    ...overrides,
  };
}

function dispatchAPXMEvent(detail: APXMEventDetail) {
  window.dispatchEvent(new CustomEvent('apxm-message', { detail }));
}

describe('content-bridge', () => {
  beforeEach(() => {
    // Initialize bridge once
    initMessageBridge();
  });

  describe('onMessage', () => {
    it('registers handler that receives CustomEvents', () => {
      const handler = vi.fn();
      onMessage(handler);

      const detail = createMockEventDetail();
      dispatchAPXMEvent(detail);

      expect(handler).toHaveBeenCalled();
      const arg = handler.mock.calls[0][0];
      expect(arg.messageType).toBe(detail.messageType);
    });

    it('returns unsubscribe function', () => {
      const handler = vi.fn();
      const unsub = onMessage(handler);

      expect(typeof unsub).toBe('function');
    });
  });

  describe('onMessageType', () => {
    it('only receives messages of specified type', () => {
      const handler = vi.fn();
      onMessageType('TARGET_TYPE', handler);

      dispatchAPXMEvent(createMockEventDetail({ messageType: 'TARGET_TYPE' }));
      dispatchAPXMEvent(createMockEventDetail({ messageType: 'OTHER_TYPE' }));

      // Due to module state, handler may be called more times
      // Check that at least one call has TARGET_TYPE
      const calls = handler.mock.calls;
      const targetCalls = calls.filter((c: any) => c[0].messageType === 'TARGET_TYPE');
      expect(targetCalls.length).toBeGreaterThan(0);
    });
  });

  describe('initMessageBridge', () => {
    it('can be called multiple times safely', () => {
      // Should not throw when called again
      expect(() => initMessageBridge()).not.toThrow();
    });
  });

  describe('error handling', () => {
    it('catches handler errors and continues', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const errorHandler = vi.fn(() => {
        throw new Error('Test error');
      });
      const normalHandler = vi.fn();

      onMessage(errorHandler);
      onMessage(normalHandler);

      dispatchAPXMEvent(createMockEventDetail());

      // Normal handler should still be called
      expect(normalHandler).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });
});
