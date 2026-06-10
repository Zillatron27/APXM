/**
 * Adapted from jackinabox86's APXM fork (https://github.com/jackinabox86/APXM),
 * MIT licensed — credit jackinabox86.
 */
import { useMemo } from 'react';
import { useSitesStore } from '../../stores/entities/sites';
import { calculateAllRepairStatuses, type RepairStatusSummary } from '../../core/repair';

export type { RepairStatusSummary };

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
