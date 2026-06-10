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
 * Surplus folds into 'ok': per-site mostUrgent never lands on surplus
 * (workforce consumables always burn), so it gets no tier of its own.
 * Sites with no burn data also land in 'ok'.
 */
export function getFilterForUrgency(urgency: Urgency | undefined): BurnFilter {
  if (!urgency || urgency === 'surplus') return 'ok';
  return urgency;
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
