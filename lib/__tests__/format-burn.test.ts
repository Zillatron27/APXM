import { describe, it, expect } from 'vitest';
import { formatInventory, formatDailyRate } from '../format-burn';

describe('formatInventory', () => {
  it('shows one decimal for fractional sub-10 stock instead of truncating to 0', () => {
    expect(formatInventory(0.59)).toBe('0.6');
    expect(formatInventory(1.23)).toBe('1.2');
  });
  it('shows whole units for integers and larger stacks', () => {
    expect(formatInventory(0)).toBe('0');
    expect(formatInventory(7)).toBe('7');
    expect(formatInventory(1234.7)).toBe('1234');
  });
});

describe('formatDailyRate', () => {
  it('never shows a non-zero rate as 0.0', () => {
    expect(formatDailyRate(-0.01)).toBe('-0.01');
    expect(formatDailyRate(-0.04)).toBe('-0.04');
  });
  it('keeps one decimal otherwise, signed', () => {
    expect(formatDailyRate(-0.1)).toBe('-0.1');
    expect(formatDailyRate(-12.34)).toBe('-12.3');
    expect(formatDailyRate(3)).toBe('+3.0');
    expect(formatDailyRate(0)).toBe('+0.0');
  });
});
