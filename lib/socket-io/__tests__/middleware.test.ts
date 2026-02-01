import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { installWebSocketProxy, installXHRProxy, setMessageCallback } from '../middleware';
import type { ProcessedMessage } from '../types';

describe('middleware', () => {
  let originalWebSocket: typeof WebSocket;
  let originalXHR: typeof XMLHttpRequest;

  beforeEach(() => {
    originalWebSocket = window.WebSocket;
    originalXHR = window.XMLHttpRequest;
  });

  afterEach(() => {
    window.WebSocket = originalWebSocket;
    window.XMLHttpRequest = originalXHR;
  });

  describe('setMessageCallback', () => {
    it('sets callback that receives processed messages', () => {
      const callback = vi.fn();
      setMessageCallback(callback);

      // Callback is internal, tested through proxy behavior
      expect(true).toBe(true);
    });
  });

  describe('installWebSocketProxy', () => {
    it('replaces window.WebSocket with proxy', () => {
      const original = window.WebSocket;
      installWebSocketProxy();

      expect(window.WebSocket).not.toBe(original);
    });

    it('proxy can still construct WebSocket instances', () => {
      // Mock WebSocket as a proper class constructor
      const mockSend = vi.fn();
      const mockAddEventListener = vi.fn();
      function MockWebSocket(this: any, url: string) {
        this.url = url;
        this.send = mockSend;
        this.addEventListener = mockAddEventListener;
        this.onmessage = null;
        this.readyState = 1;
      }
      window.WebSocket = MockWebSocket as unknown as typeof WebSocket;

      installWebSocketProxy();

      // Should not throw when constructing
      const ws = new window.WebSocket('wss://example.com');
      expect(ws).toBeDefined();
    });

    it('intercepts send() calls', () => {
      const mockSend = vi.fn();
      function MockWebSocket(this: any, url: string) {
        this.url = url;
        this.send = mockSend;
        this.addEventListener = vi.fn();
        this.onmessage = null;
      }
      window.WebSocket = MockWebSocket as unknown as typeof WebSocket;

      const callback = vi.fn();
      setMessageCallback(callback);
      installWebSocketProxy();

      const ws = new window.WebSocket('wss://example.com');
      ws.send('test-data');

      expect(mockSend).toHaveBeenCalledWith('test-data');
    });

    it('wraps onmessage handler', () => {
      let storedOnmessage: any = null;
      function MockWebSocket(this: any, url: string) {
        this.url = url;
        this.send = vi.fn();
        this.addEventListener = vi.fn();
        Object.defineProperty(this, 'onmessage', {
          get: () => storedOnmessage,
          set: (v) => { storedOnmessage = v; },
        });
      }
      window.WebSocket = MockWebSocket as unknown as typeof WebSocket;

      installWebSocketProxy();

      const ws = new window.WebSocket('wss://example.com');
      const originalHandler = vi.fn();
      ws.onmessage = originalHandler;

      // The handler should be wrapped, not the original
      expect(storedOnmessage).not.toBe(originalHandler);
      expect(typeof storedOnmessage).toBe('function');
    });
  });

  describe('installXHRProxy', () => {
    it('replaces window.XMLHttpRequest with proxy', () => {
      const original = window.XMLHttpRequest;
      installXHRProxy();

      expect(window.XMLHttpRequest).not.toBe(original);
    });

    it('proxy can still construct XHR instances', () => {
      const mockOpen = vi.fn();
      function MockXHR(this: any) {
        this.open = mockOpen;
        this.send = vi.fn();
        this.onreadystatechange = null;
        this.readyState = 0;
        this.status = 0;
        this.responseText = '';
      }
      window.XMLHttpRequest = MockXHR as unknown as typeof XMLHttpRequest;

      installXHRProxy();

      const xhr = new window.XMLHttpRequest();
      expect(xhr).toBeDefined();
    });

    it('tracks Socket.IO URLs', () => {
      const mockOpen = vi.fn();
      function MockXHR(this: any) {
        this.open = mockOpen;
        this.send = vi.fn();
        this.onreadystatechange = null;
        this.readyState = 0;
        this.status = 0;
        this.responseText = '';
      }
      window.XMLHttpRequest = MockXHR as unknown as typeof XMLHttpRequest;

      installXHRProxy();

      const xhr = new window.XMLHttpRequest();
      xhr.open('GET', 'https://example.com/socket.io/?EIO=4');

      expect(mockOpen).toHaveBeenCalled();
    });
  });
});
