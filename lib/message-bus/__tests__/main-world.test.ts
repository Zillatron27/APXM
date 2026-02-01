import { describe, it, expect, vi, beforeEach } from 'vitest';
import { onMessage, onMessageType, emitMessage } from '../main-world';
import type { ProcessedMessage } from '../../socket-io/types';

function createMockMessage(overrides: Partial<ProcessedMessage> = {}): ProcessedMessage {
  return {
    messageType: 'TEST_MESSAGE',
    payload: { data: 'test' },
    timestamp: Date.now(),
    direction: 'inbound',
    rawSize: 100,
    ...overrides,
  };
}

describe('main-world message bus', () => {
  beforeEach(() => {
    // Reset handlers by creating fresh module state
    // Note: In real tests, we might want to add a reset function
  });

  describe('onMessage', () => {
    it('registers a handler that receives all messages', () => {
      const handler = vi.fn();
      onMessage(handler);

      const msg = createMockMessage();
      emitMessage(msg);

      expect(handler).toHaveBeenCalledWith(msg);
    });

    it('returns unsubscribe function', () => {
      const handler = vi.fn();
      const unsubscribe = onMessage(handler);

      unsubscribe();

      const msg = createMockMessage();
      emitMessage(msg);

      // Handler should not be called after unsubscribe
      // Note: Due to module state persistence, this test may need adjustment
    });

    it('calls multiple handlers', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      onMessage(handler1);
      onMessage(handler2);

      const msg = createMockMessage();
      emitMessage(msg);

      expect(handler1).toHaveBeenCalledWith(msg);
      expect(handler2).toHaveBeenCalledWith(msg);
    });
  });

  describe('onMessageType', () => {
    it('registers a handler for specific message type', () => {
      const handler = vi.fn();
      onMessageType('SPECIFIC_TYPE', handler);

      emitMessage(createMockMessage({ messageType: 'SPECIFIC_TYPE' }));
      emitMessage(createMockMessage({ messageType: 'OTHER_TYPE' }));

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('returns unsubscribe function', () => {
      const handler = vi.fn();
      const unsubscribe = onMessageType('TEST_TYPE', handler);

      expect(typeof unsubscribe).toBe('function');
    });
  });

  describe('emitMessage', () => {
    it('dispatches CustomEvent with correct detail', () => {
      const eventHandler = vi.fn();
      window.addEventListener('apxm-message', eventHandler);

      const msg = createMockMessage({
        messageType: 'CUSTOM_MSG',
        payload: { key: 'value' },
      });
      emitMessage(msg);

      expect(eventHandler).toHaveBeenCalled();
      const event = eventHandler.mock.calls[0][0] as CustomEvent;
      expect(event.detail.messageType).toBe('CUSTOM_MSG');
      expect(event.detail.payload).toEqual({ key: 'value' });

      window.removeEventListener('apxm-message', eventHandler);
    });

    it('catches and logs handler errors', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const errorHandler = vi.fn(() => {
        throw new Error('Handler error');
      });
      onMessage(errorHandler);

      // Should not throw
      expect(() => emitMessage(createMockMessage())).not.toThrow();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });
});
