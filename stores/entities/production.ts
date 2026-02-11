import { createEntityStore, type EntityStore } from '../create-entity-store';
import type { PrunApi } from '../../types/prun-api';

export type ProductionStore = EntityStore<PrunApi.ProductionLine>;

export const useProductionStore = createEntityStore<PrunApi.ProductionLine>(
  'production',
  (line) => line.id,
  { key: 'apxm_cache_production' }
);

/**
 * Get all production lines for a specific site.
 */
export function getProductionBySiteId(siteId: string): PrunApi.ProductionLine[] {
  return useProductionStore
    .getState()
    .getAll()
    .filter((line) => line.siteId === siteId);
}
