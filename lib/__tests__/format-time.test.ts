import { describe, it, expect } from 'vitest';
import { formatCountdown } from '../format-time';

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
