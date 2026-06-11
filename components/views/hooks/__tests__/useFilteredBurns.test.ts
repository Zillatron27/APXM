import { describe, it, expect } from 'vitest';
import { getFilterForUrgency, getSiteIndicatorTier } from '../useFilteredBurns';
import type { ProdStatus } from '../../../../core/prod';

describe('getFilterForUrgency', () => {
  it('maps red/yellow/green urgencies to their own filter', () => {
    expect(getFilterForUrgency('critical')).toBe('critical');
    expect(getFilterForUrgency('warning')).toBe('warning');
    expect(getFilterForUrgency('ok')).toBe('ok');
  });

  it("folds surplus into 'ok' — per-site mostUrgent never lands on surplus, so INF gets no tier (#24)", () => {
    expect(getFilterForUrgency('surplus')).toBe('ok');
  });

  it("maps missing burn data to 'ok'", () => {
    expect(getFilterForUrgency(undefined)).toBe('ok');
  });
});

describe('getSiteIndicatorTier (#37 — worst of burn/repair/prod)', () => {
  const THRESHOLDS = { threshold: 60, offset: 10 };
  const prodFull: ProdStatus = { tier: 'full', active: 4, capacity: 4 };
  const prodPartial: ProdStatus = { tier: 'partial', active: 2, capacity: 4 };
  const prodStopped: ProdStatus = { tier: 'stopped', active: 0, capacity: 4 };

  it('is ok when every indicator is healthy', () => {
    expect(getSiteIndicatorTier('ok', 10, prodFull, THRESHOLDS)).toBe('ok');
  });

  it('burn urgency alone sets the tier', () => {
    expect(getSiteIndicatorTier('critical', 10, prodFull, THRESHOLDS)).toBe('critical');
    expect(getSiteIndicatorTier('warning', 10, prodFull, THRESHOLDS)).toBe('warning');
  });

  it('repair age alone elevates an otherwise-green site', () => {
    expect(getSiteIndicatorTier('ok', 75, prodFull, THRESHOLDS)).toBe('critical');
    expect(getSiteIndicatorTier('ok', 55, prodFull, THRESHOLDS)).toBe('warning');
  });

  it('production status alone elevates an otherwise-green site', () => {
    expect(getSiteIndicatorTier('ok', 10, prodStopped, THRESHOLDS)).toBe('critical');
    expect(getSiteIndicatorTier('ok', 10, prodPartial, THRESHOLDS)).toBe('warning');
  });

  it('the worst indicator wins across mixed states', () => {
    expect(getSiteIndicatorTier('warning', 55, prodStopped, THRESHOLDS)).toBe('critical');
    expect(getSiteIndicatorTier('ok', 75, prodPartial, THRESHOLDS)).toBe('critical');
  });

  it('unknown indicators never worsen a site — tier comes from what is known', () => {
    // prod ? (null) and no repairable buildings (null) contribute nothing
    expect(getSiteIndicatorTier('ok', null, null, THRESHOLDS)).toBe('ok');
    expect(getSiteIndicatorTier('critical', null, null, THRESHOLDS)).toBe('critical');
    expect(getSiteIndicatorTier('ok', 75, null, THRESHOLDS)).toBe('critical');
  });
});
