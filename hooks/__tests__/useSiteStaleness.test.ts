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

  it('returns cache state with stale flag and the exact display text', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-24T12:00:00Z'));

    const entry: SiteSourceEntry = {
      source: 'cache',
      updatedAt: Date.now() - 60_000,
    };
    const result = deriveStaleness(entry);

    expect(result.isStale).toBe(true);
    expect(result.colorClass).toBe('text-apxm-text/50');
    // Fake timers make this fully deterministic — pin the whole string so a
    // mangled middle ("cached · NaN ago", wrong unit) can't slip through.
    expect(result.text).toBe('cached · 1m ago');
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

  it('the staleness threshold is 5 hours — the requirement, not whatever the constant says', () => {
    // Deriving the boundary from STALE_THRESHOLD_MS alone would pass even if
    // the constant were fat-fingered to 5 minutes. Pin the value itself.
    expect(STALE_THRESHOLD_MS).toBe(5 * 60 * 60 * 1000);
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

  it('session staleness (#7) forces the stale presentation on fresh websocket data', () => {
    // The heartbeat flag means message flow has stopped: a recent per-site
    // timestamp can't be trusted as current. Text keeps reporting true age.
    const entry: SiteSourceEntry = {
      source: 'websocket',
      updatedAt: Date.now() - 60_000,
    };
    const result = deriveStaleness(entry, true);

    expect(result.isStale).toBe(true);
    expect(result.colorClass).toBe('text-apxm-text/40');
    expect(result.text).toMatch(/^updated/);
  });

  it('exactly at the threshold is still fresh (source uses strict >)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-24T12:00:00Z'));

    const entry: SiteSourceEntry = {
      source: 'websocket',
      updatedAt: Date.now() - STALE_THRESHOLD_MS,
    };

    expect(deriveStaleness(entry).isStale).toBe(false);
  });
});
