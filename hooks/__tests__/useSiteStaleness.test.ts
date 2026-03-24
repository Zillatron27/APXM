import { describe, it, expect, vi, afterEach } from 'vitest';
import { deriveStaleness, STALE_THRESHOLD_MS } from '../useSiteStaleness';
import type { SiteSourceEntry } from '../../stores/site-data-sources';

describe('deriveStaleness', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns awaiting state when entry is undefined', () => {
    const result = deriveStaleness(undefined);

    expect(result.text).toBe('awaiting burn data');
    expect(result.isStale).toBe(true);
    expect(result.colorClass).toBe('text-apxm-text/40');
  });

  it('returns awaiting state when entry has null source', () => {
    const entry: SiteSourceEntry = { source: null, updatedAt: 0 };
    const result = deriveStaleness(entry);

    expect(result.text).toBe('awaiting burn data');
    expect(result.isStale).toBe(true);
  });

  it('returns cache state with stale flag and text', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-24T12:00:00Z'));

    const entry: SiteSourceEntry = {
      source: 'cache',
      updatedAt: Date.now() - 60_000,
    };
    const result = deriveStaleness(entry);

    expect(result.isStale).toBe(true);
    expect(result.colorClass).toBe('text-apxm-text/50');
    expect(result.text).toMatch(/^cached/);
    expect(result.text).toContain('ago');
  });

  it('returns FIO state with amber color', () => {
    const entry: SiteSourceEntry = { source: 'fio', updatedAt: 5000 };
    const result = deriveStaleness(entry);

    expect(result.text).toBe('FIO data \u00B7 no live update');
    expect(result.isStale).toBe(true);
    expect(result.colorClass).toBe('text-amber-600/70');
  });

  it('returns fresh websocket state when recently updated', () => {
    const entry: SiteSourceEntry = {
      source: 'websocket',
      updatedAt: Date.now() - 60_000,
    };
    const result = deriveStaleness(entry);

    expect(result.isStale).toBe(false);
    expect(result.colorClass).toBe('text-apxm-text/50');
    expect(result.text).toMatch(/^updated/);
    expect(result.text).toContain('ago');
  });

  it('returns stale websocket state after 5 hours', () => {
    const entry: SiteSourceEntry = {
      source: 'websocket',
      updatedAt: Date.now() - STALE_THRESHOLD_MS - 1,
    };
    const result = deriveStaleness(entry);

    expect(result.isStale).toBe(true);
    expect(result.colorClass).toBe('text-apxm-text/40');
  });

  it('returns independent results for different entries', () => {
    const fioEntry: SiteSourceEntry = { source: 'fio', updatedAt: 1000 };
    const wsEntry: SiteSourceEntry = { source: 'websocket', updatedAt: Date.now() };

    const result1 = deriveStaleness(fioEntry);
    const result2 = deriveStaleness(wsEntry);

    expect(result1.isStale).toBe(true);
    expect(result1.colorClass).toBe('text-amber-600/70');
    expect(result2.isStale).toBe(false);
    expect(result2.colorClass).toBe('text-apxm-text/50');
  });
});
