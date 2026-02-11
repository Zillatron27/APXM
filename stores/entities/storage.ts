import { createEntityStore, type EntityStore } from '../create-entity-store';
import type { PrunApi } from '../../types/prun-api';

export type StorageStore = EntityStore<PrunApi.Store>;

export const useStorageStore = createEntityStore<PrunApi.Store>(
  'storage',
  (store) => store.id,
  { key: 'apxm_cache_storage' }
);

/**
 * Get all storages associated with a specific site (by addressableId).
 * This includes base stores, warehouse stores, construction stores, etc.
 */
export function getStorageByAddressableId(addressableId: string): PrunApi.Store[] {
  return useStorageStore
    .getState()
    .getAll()
    .filter((store) => store.addressableId === addressableId);
}
