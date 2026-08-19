import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { arrivalClock, formatEta, parseApexDuration } from '../fleet-utils';

describe('parseApexDuration', () => {
  it('parses h/m/s durations', () => {
    expect(parseApexDuration('2h 54m 25s')).toBe(
      (2 * 3600 + 54 * 60 + 25) * 1000
    );
  });

  it('parses durations with days', () => {
    expect(parseApexDuration('1d 3h 10m')).toBe(
      (24 * 3600 + 3 * 3600 + 10 * 60) * 1000
    );
  });

  it('returns null when no duration tokens are present', () => {
    expect(parseApexDuration('--')).toBeNull();
    expect(parseApexDuration('')).toBeNull();
  });
});

describe('arrivalClock', () => {
  beforeEach(() => {
    // Fixed instant: 2026-08-19 10:00:00 local time.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 19, 10, 0, 0));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows a bare HH:MM clock under 24h out', () => {
    expect(arrivalClock(2 * 3600 * 1000 + 54 * 60 * 1000)).toBe('12:54');
  });

  it('prefixes the day name at 24h or more out', () => {
    // 2026-08-19 is a Wednesday; +25h lands Thursday 11:00.
    expect(arrivalClock(25 * 3600 * 1000)).toBe('Thu 11:00');
  });

  it('matches the clock formatEta renders for the same ETA', () => {
    const etaMs = 2 * 3600 * 1000 + 20 * 60 * 1000;
    expect(formatEta(etaMs)).toBe(`2h 20m (${arrivalClock(etaMs)})`);
  });
});
