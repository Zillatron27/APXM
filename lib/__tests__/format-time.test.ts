import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatCountdown, formatRelativeTime } from '../format-time';

describe('formatRelativeTime', () => {
  // Staleness display primitive: single largest unit, floored.
  // Boundaries per source: <1 minute → '<1m', <60 minutes → 'Nm',
  // <24 hours → 'Nh', otherwise 'Nd'.
  const NOW = 1_700_000_000_000;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reads "<1m" up to the minute boundary, then "1m"', () => {
    expect(formatRelativeTime(NOW)).toBe('<1m'); // 0ms ago
    expect(formatRelativeTime(NOW - 59_999)).toBe('<1m'); // 59.999s ago
    expect(formatRelativeTime(NOW - 60_000)).toBe('1m'); // exactly 1 minute
  });

  it('shows floored minutes mid-range', () => {
    expect(formatRelativeTime(NOW - 5 * 60_000)).toBe('5m');
  });

  it('rolls over from 59m to 1h at the hour boundary', () => {
    expect(formatRelativeTime(NOW - 59 * 60_000)).toBe('59m');
    expect(formatRelativeTime(NOW - 60 * 60_000)).toBe('1h'); // exactly 60 minutes
  });

  it('shows floored hours mid-range', () => {
    expect(formatRelativeTime(NOW - 5 * 3_600_000)).toBe('5h');
  });

  it('rolls over from 23h to 1d at the day boundary', () => {
    expect(formatRelativeTime(NOW - 23 * 3_600_000)).toBe('23h');
    expect(formatRelativeTime(NOW - 24 * 3_600_000)).toBe('1d'); // exactly 24 hours
  });

  it('shows floored days mid-range', () => {
    expect(formatRelativeTime(NOW - 3 * 86_400_000)).toBe('3d');
  });
});

describe('formatCountdown', () => {
  it('shows two units, dropping the smallest once days appear', () => {
    expect(formatCountdown(85_380_000)).toBe('23h 43m'); // 23h43m
    expect(formatCountdown(126_000_000)).toBe('1d 11h'); // 1d11h
  });

  it('shows minutes alone under an hour', () => {
    expect(formatCountdown(300_000)).toBe('5m');
  });

  it('reads "done" once the deadline has passed', () => {
    expect(formatCountdown(0)).toBe('done');
    expect(formatCountdown(-1000)).toBe('done');
  });
});
