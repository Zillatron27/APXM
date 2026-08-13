import { formatRelativeTime } from '../lib/format-time';
import { useTick } from './useTick';
import { useSiteSourceStore, type SiteSourceEntry } from '../stores/site-data-sources';
import { useConnectionStore } from '../stores/connection';

export interface StalenessResult {
  text: string;
  isStale: boolean;
  colorClass: string;
}

export const STALE_THRESHOLD_MS = 5 * 60 * 60 * 1000;

/**
 * Pure derivation of staleness state from a site source entry.
 * Extracted for testability — no React hooks, no store access.
 *
 * sessionStale (#7) is the session-level heartbeat flag: message flow has
 * stopped on an open connection, so live-sourced data can't be trusted as
 * current even though its own timestamp is recent. It forces the stale
 * presentation on websocket-sourced entries; the per-site timestamps stay
 * untouched underneath (the text keeps telling the truth about age).
 */
export function deriveStaleness(
  entry: SiteSourceEntry | undefined,
  sessionStale = false
): StalenessResult {
  if (!entry || !entry.source) {
    return { text: 'awaiting burn data', isStale: true, colorClass: 'text-apxm-text/40' };
  }

  const { source, updatedAt } = entry;

  if (source === 'cache') {
    return {
      text: `cached \u00B7 ${formatRelativeTime(updatedAt)} ago`,
      isStale: true,
      colorClass: 'text-apxm-text/50',
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
  const stale = sessionStale || ageMs > STALE_THRESHOLD_MS;
  return {
    text: `updated ${formatRelativeTime(updatedAt)} ago`,
    isStale: stale,
    colorClass: stale ? 'text-apxm-text/40' : 'text-apxm-text/50',
  };
}

/**
 * Derives staleness text and state for a specific site from the per-site
 * source tracking store. Each site independently tracks its data provenance
 * (cache → FIO → websocket) so a buffer refresh for one site doesn't affect
 * the indicator for other sites.
 */
export function useSiteStaleness(siteId: string): StalenessResult {
  const entry = useSiteSourceStore((s) => s.entries.get(siteId));
  const sessionStale = useConnectionStore((s) => s.sessionStale);

  // Re-render every 30s to keep relative time fresh
  useTick(30000);

  return deriveStaleness(entry, sessionStale);
}
