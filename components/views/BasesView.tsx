import { useState } from 'react';
import { FilterBar, type FilterOption } from '../shared';
import { SiteBurnCard } from '../burn/SiteBurnCard';
import { useFilteredBurns, type BurnFilter } from './hooks';
import { useRefreshState } from '../../stores/refreshState';
import { executeBatchRefresh } from '../../lib/buffer-refresh';
import { useSitesStore } from '../../stores/entities';



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

  const mode = useRefreshState((s) => s.mode);
  const isRefreshing = useRefreshState((s) => s.isRefreshing);
  const completedCount = useRefreshState((s) => s.completedCount);
  const totalCount = useRefreshState((s) => s.totalCount);

  function handleBatchRefresh(): void {
    if (isRefreshing) return;
    // Read imperatively on click — subscribing to getAll() in render
    // creates a new array each time, causing infinite re-render loop (#185)
    const siteIds = useSitesStore.getState().getAll().map((s) => s.siteId);
    executeBatchRefresh({ siteIds });
  }

  // Build filter options from counts
  const filterOptions: FilterOption<BurnFilter>[] = [
    { id: 'critical', label: filterLabels.critical, count: counts.critical },
    { id: 'warning', label: filterLabels.warning, count: counts.warning },
    { id: 'ok', label: filterLabels.ok, count: counts.ok },
    { id: 'all', label: filterLabels.all, count: counts.all },
  ];

  return (
    <div className="space-y-3">
      {mode === 'batch' && (
        <button
          onClick={handleBatchRefresh}
          disabled={isRefreshing}
          className={`w-full px-3 min-h-touch flex items-center justify-center text-xs font-medium border ${
            isRefreshing
              ? 'text-apxm-muted border-apxm-surface cursor-wait'
              : 'text-apxm-text border-apxm-surface hover:border-prun-yellow hover:text-prun-yellow'
          }`}
        >
          {isRefreshing
            ? `Refreshing ${completedCount}/${totalCount}...`
            : 'REFRESH ALL'}
        </button>
      )}

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
