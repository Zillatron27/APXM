import { create } from 'zustand';
import { createEntityStore, type EntityStore } from '../create-entity-store';
import type { PrunApi } from '../../types/prun-api';

export type ProductionStore = EntityStore<PrunApi.ProductionLine>;

export const useProductionStore = createEntityStore<PrunApi.ProductionLine>(
  'production',
  (line) => line.id,
  { key: 'apxm_cache_production' }
);

/**
 * Tracks which sites have received production data this session.
 * Production arrives per-site, so "no lines in the store" is ambiguous:
 * either the site genuinely has no production lines, or its data simply
 * hasn't arrived yet. This set disambiguates so the UI can show an honest
 * "unknown" instead of a false "stopped". Session-scoped — cleared on
 * reconnect; cache-rehydrated lines self-evidence as loaded via their presence.
 */
interface ProductionLoadedState {
  loadedSiteIds: ReadonlySet<string>;
  markSitesLoaded: (siteIds: Iterable<string>) => void;
  clear: () => void;
}

export const useProductionLoadedStore = create<ProductionLoadedState>((set) => ({
  loadedSiteIds: new Set<string>(),
  markSitesLoaded: (siteIds) =>
    set((state) => {
      const next = new Set(state.loadedSiteIds);
      for (const id of siteIds) next.add(id);
      return { loadedSiteIds: next };
    }),
  clear: () => set({ loadedSiteIds: new Set<string>() }),
}));

/**
 * Get all production lines for a specific site.
 */
export function getProductionBySiteId(siteId: string): PrunApi.ProductionLine[] {
  return useProductionStore
    .getState()
    .getAll()
    .filter((line) => line.siteId === siteId);
}
