import { useMemo } from 'react';
import { useSiteBurns, sortByUrgency } from '../../burn/useSiteBurns';
import type { SiteBurnSummary, Urgency } from '../../../core/burn';
import type { BurnFilter } from '../../../stores/gameState';

export type { BurnFilter };

export interface FilteredBurnsResult {
  summaries: SiteBurnSummary[];
  counts: Record<BurnFilter, number>;
}

/**
 * Maps internal urgency to display filter.
 * Sites with no burn data land in 'ok' — "nothing burning" is not surplus.
 */
export function getFilterForUrgency(urgency: Urgency | undefined): BurnFilter {
  return urgency ?? 'ok';
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
      surplus: 0,
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
