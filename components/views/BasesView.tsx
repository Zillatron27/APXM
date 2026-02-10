import { useState } from 'react';
import { FilterBar, type FilterOption } from '../shared';
import { SiteBurnCard } from '../burn/SiteBurnCard';
import { useFilteredBurns, type BurnFilter } from './hooks';

// UI label mapping: internal type → display
const filterLabels: Record<BurnFilter, string> = {
  critical: 'RED',
  warning: 'YELLOW',
  ok: 'GREEN',
  all: 'ALL',
};

/**
 * Full burn view showing all sites with filtering by urgency.
 * BURN tab content.
 */
export function BasesView() {
  const [filter, setFilter] = useState<BurnFilter>('all');
  const { summaries, counts } = useFilteredBurns(filter);

  // Build filter options from counts
  const filterOptions: FilterOption<BurnFilter>[] = [
    { id: 'critical', label: filterLabels.critical, count: counts.critical },
    { id: 'warning', label: filterLabels.warning, count: counts.warning },
    { id: 'ok', label: filterLabels.ok, count: counts.ok },
    { id: 'all', label: filterLabels.all, count: counts.all },
  ];

  return (
    <div className="space-y-3">
      <FilterBar options={filterOptions} active={filter} onChange={setFilter} />

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
  );
}
