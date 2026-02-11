import { createEntityStore, type EntityStore } from '../create-entity-store';
import type { PrunApi } from '../../types/prun-api';

/**
 * Workforce data arrives per-site, not as a bulk array.
 * This wrapper type groups the workforce array with its site context.
 */
export interface WorkforceEntity {
  address: PrunApi.Address;
  siteId: string;
  workforces: PrunApi.Workforce[];
}

export type WorkforceStore = EntityStore<WorkforceEntity>;

export const useWorkforceStore = createEntityStore<WorkforceEntity>(
  'workforce',
  (entity) => entity.siteId,
  { key: 'apxm_cache_workforce' }
);

/**
 * Get workforce data for a specific site.
 */
export function getWorkforceBySiteId(siteId: string): WorkforceEntity | undefined {
  return useWorkforceStore.getState().getById(siteId);
}
