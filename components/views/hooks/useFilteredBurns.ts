import { useMemo } from 'react';
import { useSiteBurns, sortByUrgency } from '../../burn/useSiteBurns';
import type { SiteBurnSummary, Urgency } from '../../../core/burn';

export type BurnFilter = 'all' | 'critical' | 'warning' | 'ok';

export interface FilteredBurnsResult {
  summaries: SiteBurnSummary[];
  counts: Record<BurnFilter, number>;
}

/**
 * Maps internal urgency to display filter.
 * Sites with mostUrgent of that urgency level.
 */
function getFilterForUrgency(urgency: Urgency | undefined): BurnFilter {
  if (!urgency) return 'ok';
  if (urgency === 'critical') return 'critical';
  if (urgency === 'warning') return 'warning';
  return 'ok'; // 'ok' and 'surplus' both map to 'ok' filter
}

/**
 * Hook that filters burn summaries by urgency level.
 * Returns filtered summaries and counts per filter category.
 */
export function useFilteredBurns(activeFilters: ReadonlySet<BurnFilter>): FilteredBurnsResult {
  const allBurns = useSiteBurns();
  const sorted = sortByUrgency(allBurns);

  return useMemo(() => {
    // Count sites per filter category
    const counts: Record<BurnFilter, number> = {
      all: sorted.length,
      critical: 0,
      warning: 0,
      ok: 0,
    };

    for (const summary of sorted) {
      const category = getFilterForUrgency(summary.mostUrgent?.urgency);
      counts[category]++;
    }

    // Show all when 'all' is selected
    const summaries = activeFilters.has('all')
      ? sorted
      : sorted.filter(
          (s) => activeFilters.has(getFilterForUrgency(s.mostUrgent?.urgency))
        );

    return { summaries, counts };
  }, [sorted, activeFilters]);
}
