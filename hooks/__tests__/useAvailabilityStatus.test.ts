import { describe, it, expect } from 'vitest';
import { deriveAvailability } from '../useAvailabilityStatus';

describe('deriveAvailability', () => {
  const base = {
    messageCount: 0,
    apexErrorBanner: false,
    elapsedMs: 0,
    interceptorConflict: false,
  };

  it('is ok whenever messages are flowing, regardless of anything else', () => {
    expect(deriveAvailability({ ...base, messageCount: 1 })).toBe('ok');
    // An error banner does not override live data
    expect(
      deriveAvailability({ ...base, messageCount: 5, apexErrorBanner: true })
    ).toBe('ok');
  });

  it('reports maintenance only when the APEX error banner is present and no data', () => {
    expect(deriveAvailability({ ...base, apexErrorBanner: true })).toBe('maintenance');
  });

  it('stays ok while still within the startup grace', () => {
    expect(deriveAvailability({ ...base, elapsedMs: 19_000 })).toBe('ok');
  });

  it('reports starved after the 20s timeout with no data and no banner', () => {
    expect(deriveAvailability({ ...base, elapsedMs: 20_000 })).toBe('starved');
  });

  it('shortens the grace to 5s once a competing interceptor is confirmed', () => {
    // Before 5s: still ok
    expect(
      deriveAvailability({ ...base, interceptorConflict: true, elapsedMs: 4_000 })
    ).toBe('ok');
    // At/after 5s: starved (without conflict, 5s would still be ok)
    expect(
      deriveAvailability({ ...base, interceptorConflict: true, elapsedMs: 5_000 })
    ).toBe('starved');
    expect(deriveAvailability({ ...base, elapsedMs: 5_000 })).toBe('ok');
  });

  it('prefers the genuine maintenance signal over a starvation timeout', () => {
    // Both conditions met — the confirmed banner wins
    expect(
      deriveAvailability({ ...base, apexErrorBanner: true, elapsedMs: 30_000 })
    ).toBe('maintenance');
  });
});
