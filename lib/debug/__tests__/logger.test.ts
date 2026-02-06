import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logMessage } from '../logger';
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
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    delete (window as any).__APXM_DEBUG__;
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('logs inbound messages with left arrow', () => {
    logMessage(createMockMessage({ direction: 'inbound' }));

    expect(consoleSpy).toHaveBeenCalled();
    const logCall = consoleSpy.mock.calls[0][0];
    expect(logCall).toContain('←');
  });

  it('logs outbound messages with right arrow', () => {
    logMessage(createMockMessage({ direction: 'outbound' }));

    expect(consoleSpy).toHaveBeenCalled();
    const logCall = consoleSpy.mock.calls[0][0];
    expect(logCall).toContain('→');
  });

  it('includes message type in log', () => {
    logMessage(createMockMessage({ messageType: 'SITE_SITES' }));

    const logCall = consoleSpy.mock.calls[0][0];
    expect(logCall).toContain('SITE_SITES');
  });

  it('includes size in KB', () => {
    logMessage(createMockMessage({ rawSize: 2048 }));

    const logCall = consoleSpy.mock.calls[0][0];
    expect(logCall).toContain('2.0KB');
  });

  it('includes APXM prefix', () => {
    logMessage(createMockMessage());

    const logCall = consoleSpy.mock.calls[0][0];
    expect(logCall).toContain('[APXM]');
  });

  it('does not log payload by default', () => {
    logMessage(createMockMessage({ payload: { secret: 'data' } }));

    // Should only have one console.log call (the summary)
    expect(consoleSpy).toHaveBeenCalledTimes(1);
  });

  it('logs payload when __APXM_DEBUG__ is true', () => {
    (window as any).__APXM_DEBUG__ = true;

    logMessage(createMockMessage({ payload: { secret: 'data' } }));

    // Should have two calls: summary + payload
    expect(consoleSpy).toHaveBeenCalledTimes(2);
    expect(consoleSpy.mock.calls[1][0]).toContain('Payload');
  });

  it('includes ISO timestamp', () => {
    const timestamp = new Date('2026-02-01T10:30:00Z').getTime();
    logMessage(createMockMessage({ timestamp }));

    const logCall = consoleSpy.mock.calls[0][0];
    expect(logCall).toContain('2026-02-01');
  });
});
