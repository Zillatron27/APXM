import { useCallback, useState } from 'react';
import { FilterBar, type FilterOption, DataGate, type RequiredStore } from '../shared';
import { SiteBurnCard } from '../burn/SiteBurnCard';
import { useFilteredBurns, type BurnFilter } from './hooks';
import { useSitesStore } from '../../stores/entities/sites';
import { useWorkforceStore } from '../../stores/entities/workforce';
import { useProductionStore } from '../../stores/entities/production';
import { useStorageStore } from '../../stores/entities/storage';

// UI label mapping: internal type → display
const filterLabels: Record<BurnFilter, string> = {
  critical: 'RED',
  warning: 'YELLOW',
  ok: 'GREEN',
  all: 'ALL',
};

// Non-ALL filter values for revert logic
const individualFilters: BurnFilter[] = ['critical', 'warning', 'ok'];

/**
 * Full burn view showing all sites with filtering by urgency.
 * BURN tab content.
 */
export function BasesView() {
  const [activeFilters, setActiveFilters] = useState<Set<BurnFilter>>(new Set(['all']));
  const { summaries, counts } = useFilteredBurns(activeFilters);

  const handleFilterToggle = useCallback((filter: BurnFilter) => {
    setActiveFilters((prev) => {
      // Selecting ALL resets to show everything
      if (filter === 'all') return new Set(['all']);

      const next = new Set(prev);
      next.delete('all');

      if (next.has(filter)) {
        next.delete(filter);
      } else {
        next.add(filter);
      }

      // If nothing selected, revert to ALL
      if (next.size === 0) return new Set(['all']);

      // If all individual filters selected, collapse to ALL
      if (individualFilters.every((f) => next.has(f))) return new Set(['all']);

      return next;
    });
  }, []);

  const sitesFetched = useSitesStore((s) => s.fetched);
  const workforceFetched = useWorkforceStore((s) => s.fetched);
  const productionFetched = useProductionStore((s) => s.fetched);
  const storageFetched = useStorageStore((s) => s.fetched);

  const requiredStores: RequiredStore[] = [
    { fetched: sitesFetched, name: 'bases', canFio: true },
    { fetched: workforceFetched, name: 'workforce', canFio: true },
    { fetched: productionFetched, name: 'production', canFio: true },
    { fetched: storageFetched, name: 'storage', canFio: true },
  ];

  // Build filter options from counts
  const filterOptions: FilterOption<BurnFilter>[] = [
    { id: 'critical', label: filterLabels.critical, count: counts.critical },
    { id: 'warning', label: filterLabels.warning, count: counts.warning },
    { id: 'ok', label: filterLabels.ok, count: counts.ok },
    { id: 'all', label: filterLabels.all, count: counts.all },
  ];

  return (
    <DataGate requiredStores={requiredStores}>
      <div className="space-y-3">
        <FilterBar options={filterOptions} activeFilters={activeFilters} onChange={handleFilterToggle} />

        {summaries.length === 0 ? (
          <p className="text-sm text-apxm-muted py-4 text-center">
            No bases match the selected filter
          </p>
        ) : (
          <div className="space-y-2">
            {summaries.map((summary) => (
              <SiteBurnCard
                key={summary.siteId}
                summary={summary}
                defaultExpanded={false}
              />
            ))}
          </div>
        )}
      </div>
    </DataGate>
  );
}
