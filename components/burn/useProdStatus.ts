/**
 * Adapted from jackinabox86's APXM fork (https://github.com/jackinabox86/APXM),
 * MIT licensed — credit jackinabox86.
 */
import { useMemo } from 'react';
import { useSitesStore } from '../../stores/entities/sites';
import {
  useProductionStore,
  useProductionLoadedStore,
  getProductionBySiteId,
} from '../../stores/entities/production';

/**
 * Production status per site:
 * null  = no data for this site yet → show ?
 * true  = every production line has a running order → show ✓
 * false = any line idle, or no lines at all → show ∅
 */
export type ProdStatus = boolean | null;

export function useProdStatuses(): Map<string, ProdStatus> {
  const sitesLastUpdated = useSitesStore((s) => s.lastUpdated);
  const productionLastUpdated = useProductionStore((s) => s.lastUpdated);
  const loadedSiteIds = useProductionLoadedStore((s) => s.loadedSiteIds);

  return useMemo(() => {
    const map = new Map<string, ProdStatus>();
    for (const site of useSitesStore.getState().getAll()) {
      const lines = getProductionBySiteId(site.siteId);
      if (lines.length === 0 && !loadedSiteIds.has(site.siteId)) {
        // Cache-rehydrated or FIO lines self-evidence as loaded by being
        // present; only a site with no lines AND no load marker is unknown.
        map.set(site.siteId, null);
      } else {
        map.set(
          site.siteId,
          lines.length > 0 &&
            lines.every((line) => line.orders.some((o) => o.started !== null && !o.halted))
        );
      }
    }
    return map;
    // lastUpdated values are the recompute triggers; data is read from stores
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sitesLastUpdated, productionLastUpdated, loadedSiteIds]);
}
