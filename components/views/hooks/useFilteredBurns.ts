import { useMemo } from 'react';
import { useSiteBurns, sortByUrgency } from '../../burn/useSiteBurns';
import type { SiteBurnSummary, Urgency } from '../../../core/burn';
import { classifyRepairUrgency } from '../../../core/repair';
import { classifyProdUrgency, type ProdStatus } from '../../../core/prod';
import type { RepairStatusSummary } from '../../burn/useRepairStatus';
import { useSettingsStore } from '../../../stores/settings';
import type { RepairThresholds } from '../../../stores/settings';
import type { BurnFilter } from '../../../stores/gameState';

export type { BurnFilter };

/** A site's filter tier — BurnFilter minus the 'all' pseudo-filter. */
export type SiteTier = Exclude<BurnFilter, 'all'>;

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
export function getFilterForUrgency(urgency: Urgency | undefined): SiteTier {
  if (!urgency || urgency === 'surplus') return 'ok';
  return urgency;
}

const tierRank: Record<SiteTier, number> = { ok: 0, warning: 1, critical: 2 };

/**
 * Worst-of-three tier for a site (#37): RED/YELLOW match any indicator —
 * burn urgency, repair age, or production status — so the filter answers
 * "which bases need attention for any reason", not just burn. GREEN means
 * every known indicator is ok. Unknown indicators (prod ?, no repairable
 * buildings) don't contribute: they never worsen a site, so its tier comes
 * from whatever is known.
 */
export function getSiteIndicatorTier(
  burnUrgency: Urgency | undefined,
  repairAgeDays: number | null,
  prodStatus: ProdStatus,
  repairThresholds: RepairThresholds
): SiteTier {
  let worst: SiteTier = getFilterForUrgency(burnUrgency);
  if (repairAgeDays !== null) {
    const repair = classifyRepairUrgency(repairAgeDays, repairThresholds);
    if (tierRank[repair] > tierRank[worst]) worst = repair;
  }
  if (prodStatus !== null) {
    const prod = classifyProdUrgency(prodStatus.tier);
    if (tierRank[prod] > tierRank[worst]) worst = prod;
  }
  return worst;
}

/**
 * Hook that filters burn summaries by indicator tier (worst of burn,
 * repair, prod). Returns filtered summaries and counts per filter category;
 * a site counts once, under its worst tier.
 */
export function useFilteredBurns(
  activeFilters: ReadonlySet<BurnFilter>,
  repairBySite: ReadonlyMap<string, RepairStatusSummary>,
  prodStatuses: ReadonlyMap<string, ProdStatus>
): FilteredBurnsResult {
  const allBurns = useSiteBurns();
  const repairThresholds = useSettingsStore((s) => s.repairThresholds);
  const sorted = sortByUrgency(allBurns);

  return useMemo(() => {
    const counts: Record<BurnFilter, number> = {
      all: sorted.length,
      critical: 0,
      warning: 0,
      ok: 0,
    };

    const tierBySite = new Map<string, SiteTier>();
    for (const summary of sorted) {
      const tier = getSiteIndicatorTier(
        summary.mostUrgent?.urgency,
        repairBySite.get(summary.siteId)?.oldestBuildingAgeDays ?? null,
        prodStatuses.get(summary.siteId) ?? null,
        repairThresholds
      );
      tierBySite.set(summary.siteId, tier);
      counts[tier]++;
    }

    // Show all when 'all' is selected
    const summaries = activeFilters.has('all')
      ? sorted
      : sorted.filter((s) => activeFilters.has(tierBySite.get(s.siteId) ?? 'ok'));

    return { summaries, counts };
  }, [sorted, activeFilters, repairBySite, prodStatuses, repairThresholds]);
}
