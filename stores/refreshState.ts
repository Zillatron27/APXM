import { create } from 'zustand';
import type { RefreshMode, SiteRefreshStatus } from '../lib/buffer-refresh/types';

interface RefreshState {
  isRefreshing: boolean;
  mode: RefreshMode;
  completedCount: number;
  totalCount: number;
  siteStatus: Map<string, SiteRefreshStatus>;

  startRefresh: (siteIds: string[]) => void;
  updateSiteStatus: (siteId: string, status: SiteRefreshStatus) => void;
  completeRefresh: () => void;
  setMode: (mode: RefreshMode) => void;
}

export const useRefreshState = create<RefreshState>((set, get) => ({
  isRefreshing: false,
  mode: 'manual',
  completedCount: 0,
  totalCount: 0,
  siteStatus: new Map(),

  startRefresh: (siteIds: string[]) => {
    const status = new Map<string, SiteRefreshStatus>();
    for (const id of siteIds) {
      status.set(id, 'pending');
    }
    set({
      isRefreshing: true,
      completedCount: 0,
      totalCount: siteIds.length,
      siteStatus: status,
    });
  },

  updateSiteStatus: (siteId: string, status: SiteRefreshStatus) => {
    const current = new Map(get().siteStatus);
    current.set(siteId, status);
    const completedCount = Array.from(current.values()).filter(
      (s) => s === 'success' || s === 'error'
    ).length;
    set({ siteStatus: current, completedCount });
  },

  completeRefresh: () => {
    set({ isRefreshing: false });
  },

  setMode: (mode: RefreshMode) => {
    set({ mode });
  },
}));
