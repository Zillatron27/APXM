import { createEntityStore, type EntityStore } from '../create-entity-store';
import type { PrunApi } from '../../types/prun-api';

export type ContractsStore = EntityStore<PrunApi.Contract>;

export const useContractsStore = createEntityStore<PrunApi.Contract>(
  'contracts',
  (contract) => contract.id,
  { key: 'apxm_cache_contracts' }
);
