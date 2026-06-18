import { useMemo } from 'react';
import { useSiteBurns } from '../../burn/useSiteBurns';
import { aggregateEmpireBurn, type BurnRate } from '../../../core/burn';
import { useSettingsStore } from '../../../stores/settings';
import { getFilterForUrgency } from './useFilteredBurns';
import type { BurnFilter } from '../../../stores/gameState';

export interface EmpireBurnResult {
  /** Aggregated material rows, filtered and sorted for display. */
  rows: BurnRate[];
}

/**
 * Drops inactive rows (no stock, no rate, no need) and sorts consuming
 * materials first by days remaining, then surplus alphabetically — the
 * same ordering as the per-site card, so both BASES modes read alike.
 */
export function sortEmpireRows(rows: BurnRate[]): BurnRate[] {
  return rows
    .filter((r) => r.inventoryAmount > 0 || r.dailyAmount !== 0 || r.need > 0)
    .sort((a, b) => {
      const aConsuming = a.dailyAmount < 0;
      const bConsuming = b.dailyAmount < 0;
      if (aConsuming !== bConsuming) return aConsuming ? -1 : 1;
      if (aConsuming && bConsuming) return a.daysRemaining - b.daysRemaining;
      return a.materialTicker.localeCompare(b.materialTicker);
    });
}

/**
 * Empire-wide burn rollup for the Status tab's collapsible Empire panel: one row
 * per material across all sites, filtered by the given urgency selection.
 */
export function useEmpireBurn(
  activeFilters: ReadonlySet<BurnFilter>
): EmpireBurnResult {
  const summaries = useSiteBurns();
  const thresholds = useSettingsStore((s) => s.burnThresholds);

  return useMemo(() => {
    const sorted = sortEmpireRows(aggregateEmpireBurn(summaries, thresholds));

    const rows = activeFilters.has('all')
      ? sorted
      : sorted.filter((r) => activeFilters.has(getFilterForUrgency(r.urgency)));

    return { rows };
  }, [summaries, thresholds, activeFilters]);
}
