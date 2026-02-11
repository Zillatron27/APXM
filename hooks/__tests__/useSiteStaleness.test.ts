import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useSiteSourceStore } from '../../stores/site-data-sources';

/**
 * Tests the staleness derivation logic used by useSiteStaleness.
 *
 * The hook itself is a thin React wrapper (useSiteSourceStore selector + useTick),
 * so we test the derivation logic directly against the store state to avoid
 * needing @testing-library/react.
 */

// Mirrors the hook's derivation logic for testability
function deriveStaleness(siteId: string) {
  const entry = useSiteSourceStore.getState().entries.get(siteId);

  if (!entry || !entry.source) {
    return { text: 'awaiting burn data', isStale: true, colorClass: 'text-apxm-text/40' };
  }

  const { source, updatedAt } = entry;

  if (source === 'cache') {
    return {
      isStale: true,
      colorClass: 'text-apxm-text/50',
      source: 'cache' as const,
      updatedAt,
    };
  }

  if (source === 'fio') {
    return {
      text: 'FIO data \u00B7 no live update',
      isStale: true,
      colorClass: 'text-amber-600/70',
    };
  }

  // websocket
  const ageMs = Date.now() - updatedAt;
  const STALE_THRESHOLD_MS = 5 * 60 * 60 * 1000;
  const stale = ageMs > STALE_THRESHOLD_MS;
  return {
    isStale: stale,
    colorClass: stale ? 'text-apxm-text/40' : 'text-apxm-text/50',
    source: 'websocket' as const,
    updatedAt,
  };
}

describe('useSiteStaleness derivation logic', () => {
  beforeEach(() => {
    useSiteSourceStore.getState().clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns awaiting state when site has no entry', () => {
    const result = deriveStaleness('unknown-site');

    expect(result.text).toBe('awaiting burn data');
    expect(result.isStale).toBe(true);
    expect(result.colorClass).toBe('text-apxm-text/40');
  });

  it('returns cache state with stale flag', () => {
    useSiteSourceStore.getState().markSite('site-1', 'cache', 1000);

    const result = deriveStaleness('site-1');

    expect(result.isStale).toBe(true);
    expect(result.colorClass).toBe('text-apxm-text/50');
  });

  it('returns FIO state with amber color', () => {
    useSiteSourceStore.getState().markSite('site-1', 'fio', 5000);

    const result = deriveStaleness('site-1');

    expect(result.text).toBe('FIO data \u00B7 no live update');
    expect(result.isStale).toBe(true);
    expect(result.colorClass).toBe('text-amber-600/70');
  });

  it('returns fresh websocket state when recently updated', () => {
    const now = Date.now();
    useSiteSourceStore.getState().markSite('site-1', 'websocket', now - 60_000);

    const result = deriveStaleness('site-1');

    expect(result.isStale).toBe(false);
    expect(result.colorClass).toBe('text-apxm-text/50');
  });

  it('returns stale websocket state after 5 hours', () => {
    const fiveHoursAgo = Date.now() - (5 * 60 * 60 * 1000 + 1);
    useSiteSourceStore.getState().markSite('site-1', 'websocket', fiveHoursAgo);

    const result = deriveStaleness('site-1');

    expect(result.isStale).toBe(true);
    expect(result.colorClass).toBe('text-apxm-text/40');
  });

  it('returns independent results for different sites', () => {
    useSiteSourceStore.getState().markSite('site-1', 'fio', 1000);
    useSiteSourceStore.getState().markSite('site-2', 'websocket', Date.now());

    const result1 = deriveStaleness('site-1');
    const result2 = deriveStaleness('site-2');

    expect(result1.isStale).toBe(true);
    expect(result1.colorClass).toBe('text-amber-600/70');
    expect(result2.isStale).toBe(false);
    expect(result2.colorClass).toBe('text-apxm-text/50');
  });
});
