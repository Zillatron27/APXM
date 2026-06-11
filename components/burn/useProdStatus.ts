/**
 * Adapted from jackinabox86's APXM fork (https://github.com/jackinabox86/APXM),
 * MIT licensed — credit jackinabox86. Capacity-aware classification (#36)
 * lives in core/prod.ts; this hook handles the unknown-data case and store
 * subscription.
 */
import { useMemo } from 'react';
import { useSitesStore } from '../../stores/entities/sites';
import {
  useProductionStore,
  useProductionLoadedStore,
  getProductionBySiteId,
} from '../../stores/entities/production';
import { classifyProdStatus, type ProdStatus } from '../../core/prod';

export type { ProdStatus };

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
        map.set(site.siteId, classifyProdStatus(lines));
      }
    }
    return map;
    // lastUpdated values are the recompute triggers; data is read from stores
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sitesLastUpdated, productionLastUpdated, loadedSiteIds]);
}
