import { useConnectionStore } from '../stores/connection';
import { useSettingsStore } from '../stores/settings';
import {
  useSiteSourceStore,
  deriveWeakestSource,
  deriveOldestUpdate,
} from '../stores/site-data-sources';

export type DataTone = 'live' | 'fio' | 'cached' | 'connecting';

export interface DataStatus {
  tone: DataTone;
  /** Source word shown in the header chip. */
  label: string;
  /** Timestamp of the stalest on-screen data, or null when unknown. */
  since: number | null;
}

/**
 * Unifies connection state and data freshness into one indicator for the
 * header chip: where the data on screen came from, and how stale its oldest
 * piece is. Connection liveness and data age are two halves of the same
 * "can I trust these numbers" question, so they share one control.
 *
 * The age is the weakest-link across bases (the oldest base update), since
 * burn figures are the most staleness-sensitive data; it is shown on every
 * tab because the header is always visible.
 */
export function useDataStatus(): DataStatus {
  const connected = useConnectionStore((s) => s.connected);
  const lastMessageTimestamp = useConnectionStore((s) => s.lastMessageTimestamp);
  const fioLastFetch = useSettingsStore((s) => s.fio.lastFetch);
  const siteEntries = useSiteSourceStore((s) => s.entries);

  const oldestUpdate = deriveOldestUpdate(siteEntries);
  const weakestSource = deriveWeakestSource(siteEntries);

  // Live: the game connection is up and a message arrived in the last minute
  if (connected && lastMessageTimestamp && Date.now() - lastMessageTimestamp < 60000) {
    return { tone: 'live', label: 'Live', since: oldestUpdate };
  }
  // FIO snapshot — no live connection, but a REST fetch succeeded
  if (fioLastFetch) {
    return { tone: 'fio', label: 'FIO', since: fioLastFetch };
  }
  // Cached data rehydrated from a previous session
  if (weakestSource === 'cache' && oldestUpdate !== null) {
    return { tone: 'cached', label: 'Cached', since: oldestUpdate };
  }
  return { tone: 'connecting', label: 'Connecting', since: null };
}
