import { createEntityStore, type EntityStore } from '../create-entity-store';
import type { PrunApi } from '../../types/prun-api';

export type SitesStore = EntityStore<PrunApi.Site>;

export const useSitesStore = createEntityStore<PrunApi.Site>(
  'sites',
  (site) => site.siteId,
  { key: 'apxm_cache_sites' }
);
