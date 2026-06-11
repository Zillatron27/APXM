import { useMemo } from 'react';
import { FilterBar, type FilterOption, DataGate, type RequiredStore } from '../shared';
import { SiteBurnCard } from '../burn/SiteBurnCard';
import { useRepairStatus, useProdStatuses } from '../burn';
import { useFilteredBurns, type BurnFilter } from './hooks';
import { useSitesStore } from '../../stores/entities/sites';
import { useGameState } from '../../stores/gameState';

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
  // Filter selection lives in gameState so it survives tab switches;
  // the toggle rules (ALL reset, empty→ALL, full-set→ALL) live with it.
  const activeFilters = useGameState((s) => s.burnFilters);
  const toggleBurnFilter = useGameState((s) => s.toggleBurnFilter);
  const repairStatuses = useRepairStatus();
  const prodStatuses = useProdStatuses();
  const repairBySite = useMemo(
    () => new Map(repairStatuses.map((r) => [r.siteId, r])),
    [repairStatuses]
  );
  // Filter tiers are worst-of-three (burn/repair/prod, #37), so the maps
  // feeding the card indicators also feed the filter classification.
  const { summaries, counts } = useFilteredBurns(activeFilters, repairBySite, prodStatuses);

  const sitesFetched = useSitesStore((s) => s.fetched);

  // Only gate on sites — workforce, production, and storage populate
  // incrementally via buffer refresh or APEX navigation. The burn cards
  // handle missing data gracefully (empty state + refresh button).
  const requiredStores: RequiredStore[] = [
    { fetched: sitesFetched, name: 'bases', canFio: true },
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
        <FilterBar options={filterOptions} activeFilters={activeFilters} onChange={toggleBurnFilter} />

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
                repairAgeDays={repairBySite.get(summary.siteId)?.oldestBuildingAgeDays ?? null}
                prodStatus={prodStatuses.get(summary.siteId) ?? null}
                defaultExpanded={false}
              />
            ))}
          </div>
        )}
      </div>
    </DataGate>
  );
}
