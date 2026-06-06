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

/**
 * Weakest-link data source across all sites: cache < fio < websocket.
 * If any site is showing cached data, the whole summary is "cache".
 */
export function deriveWeakestSource(entries: Map<string, SiteSourceEntry>): DataSource {
  if (entries.size === 0) return null;
  let hasCache = false;
  let hasFio = false;
  for (const entry of entries.values()) {
    if (entry.source === 'cache') hasCache = true;
    else if (entry.source === 'fio') hasFio = true;
  }
  if (hasCache) return 'cache';
  if (hasFio) return 'fio';
  return 'websocket';
}

/**
 * Oldest update timestamp across all sites — the most pessimistic age to
 * surface in a staleness badge. Returns null when there are no entries.
 */
export function deriveOldestUpdate(entries: Map<string, SiteSourceEntry>): number | null {
  if (entries.size === 0) return null;
  let oldest = Infinity;
  for (const entry of entries.values()) {
    if (entry.updatedAt < oldest) oldest = entry.updatedAt;
  }
  return oldest === Infinity ? null : oldest;
}
