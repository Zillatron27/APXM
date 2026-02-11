import { create } from 'zustand';
import type { DataSource } from './create-entity-store';

export interface SiteSourceEntry {
  source: DataSource;
  updatedAt: number;
}

interface SiteDataSourceState {
  entries: Map<string, SiteSourceEntry>;
  markSite: (siteId: string, source: DataSource, updatedAt?: number) => void;
  markAllSites: (siteIds: string[], source: DataSource, updatedAt?: number) => void;
  clear: () => void;
}

export const useSiteSourceStore = create<SiteDataSourceState>((set) => ({
  entries: new Map(),

  markSite: (siteId, source, updatedAt = Date.now()) => {
    set((state) => {
      const entries = new Map(state.entries);
      entries.set(siteId, { source, updatedAt });
      return { entries };
    });
  },

  markAllSites: (siteIds, source, updatedAt = Date.now()) => {
    set((state) => {
      const entries = new Map(state.entries);
      for (const id of siteIds) {
        entries.set(id, { source, updatedAt });
      }
      return { entries };
    });
  },

  clear: () => {
    set({ entries: new Map() });
  },
}));
