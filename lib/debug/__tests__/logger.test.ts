import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logMessage, log, warn, error } from '../logger';
import type { ProcessedMessage } from '@prun/link';

function createMockMessage(overrides: Partial<ProcessedMessage> = {}): ProcessedMessage {
  return {
    messageType: 'TEST_MESSAGE',
    payload: { data: 'test' },
    timestamp: Date.now(),
    direction: 'inbound',
    rawSize: 1024,
    ...overrides,
  };
}

describe('logMessage', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    delete (window as any).__APXM_DEBUG__;
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('logs inbound messages with left arrow', () => {
    logMessage(createMockMessage({ direction: 'inbound' }));

    expect(logSpy).toHaveBeenCalled();
    const logCall = logSpy.mock.calls[0][0];
    expect(logCall).toContain('←');
  });

  it('logs outbound messages with right arrow', () => {
    logMessage(createMockMessage({ direction: 'outbound' }));

    expect(logSpy).toHaveBeenCalled();
    const logCall = logSpy.mock.calls[0][0];
    expect(logCall).toContain('→');
  });

  it('includes message type in log', () => {
    logMessage(createMockMessage({ messageType: 'SITE_SITES' }));

    const logCall = logSpy.mock.calls[0][0];
    expect(logCall).toContain('SITE_SITES');
  });

  it('includes size in KB', () => {
    logMessage(createMockMessage({ rawSize: 2048 }));

    const logCall = logSpy.mock.calls[0][0];
    expect(logCall).toContain('2.0KB');
  });

  it('includes APXM prefix', () => {
    logMessage(createMockMessage());

    const logCall = logSpy.mock.calls[0][0];
    expect(logCall).toContain('[APXM]');
  });

  it('does not log payload by default', () => {
    logMessage(createMockMessage({ payload: { secret: 'data' } }));

    // Should only have one console.log call (the summary)
    expect(logSpy).toHaveBeenCalledTimes(1);
  });

  it('logs payload when __APXM_DEBUG__ is true', () => {
    (window as any).__APXM_DEBUG__ = true;

    logMessage(createMockMessage({ payload: { secret: 'data' } }));

    // Should have two calls: summary + payload
    expect(logSpy).toHaveBeenCalledTimes(2);
    expect(logSpy.mock.calls[1][0]).toContain('Payload');
  });

  it('includes ISO timestamp', () => {
    const timestamp = new Date('2026-02-01T10:30:00Z').getTime();
    logMessage(createMockMessage({ timestamp }));

    const logCall = logSpy.mock.calls[0][0];
    expect(logCall).toContain('2026-02-01');
  });
});

describe('log', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('logs with [APXM] prefix', () => {
    log('test message');

    expect(logSpy).toHaveBeenCalledWith('[APXM]', 'test message');
  });

  it('passes multiple arguments', () => {
    log('key:', 'value', 123);

    expect(logSpy).toHaveBeenCalledWith('[APXM]', 'key:', 'value', 123);
  });
});

describe('warn', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('warns with [APXM] prefix', () => {
    warn('something unexpected');

    expect(warnSpy).toHaveBeenCalledWith('[APXM]', 'something unexpected');
  });
});

describe('error', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('errors with [APXM] prefix', () => {
    error('something broke');

    expect(errorSpy).toHaveBeenCalledWith('[APXM]', 'something broke');
  });
});
