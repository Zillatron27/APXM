/**
 * Adapted from jackinabox86's APXM fork (https://github.com/jackinabox86/APXM),
 * MIT licensed — credit jackinabox86.
 */
import { useMemo } from 'react';
import { useSitesStore } from '../../stores/entities/sites';
import {
  calculateAllRepairStatuses,
  calculateSiteRepairBuildings,
  type RepairStatusSummary,
  type BuildingRepairStatus,
} from '../../core/repair';

export type { RepairStatusSummary, BuildingRepairStatus };

/**
 * Hook that calculates repair status for all sites.
 * Re-calculates when site/platform data changes (platforms are part of site entities).
 */
export function useRepairStatus(): RepairStatusSummary[] {
  const sitesLastUpdated = useSitesStore((s) => s.lastUpdated);

  return useMemo(() => {
    return calculateAllRepairStatuses();
    // sitesLastUpdated is the recompute trigger; the data is read from the store
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sitesLastUpdated]);
}

/** Per-building repair detail for one site (oldest-since-repair first). */
export function useSiteRepairBuildings(siteId: string): BuildingRepairStatus[] {
  const sitesLastUpdated = useSitesStore((s) => s.lastUpdated);

  return useMemo(() => {
    return calculateSiteRepairBuildings(siteId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId, sitesLastUpdated]);
}
