import { create } from 'zustand';
import type { Urgency } from '../core/burn';

/**
 * UI-related game state.
 * Connection state has been moved to stores/connection.ts.
 * Entity data is in stores/entities/*.ts.
 */

export type TabId = 'status' | 'fleet' | 'bases' | 'contracts' | 'settings';

/**
 * Burn view filter tiers. 'surplus' is deliberately excluded: a site's
 * mostUrgent can never be surplus because workforce consumables always
 * burn on every base, so an INF tier matches nothing (tried and removed
 * 2026-06-10, see #24). Surplus exists per-material, not per-site.
 */
export type BurnFilter = Exclude<Urgency, 'surplus'> | 'all';

// Non-ALL filter values, used by the toggle collapse/revert rules
const individualBurnFilters: BurnFilter[] = ['critical', 'warning', 'ok'];

interface GameState {
  overlayVisible: boolean;
  debugMode: boolean;
  apexVisible: boolean;
  activeTab: TabId;
  // Session-scoped (not persisted): survives tab switches, resets on reload.
  // A filter that stuck across days would silently hide bases.
  burnFilters: ReadonlySet<BurnFilter>;
  setOverlayVisible: (visible: boolean) => void;
  setDebugMode: (debug: boolean) => void;
  setApexVisible: (visible: boolean) => void;
  setActiveTab: (tab: TabId) => void;
  toggleBurnFilter: (filter: BurnFilter) => void;
}

export const useGameState = create<GameState>((set) => ({
  overlayVisible: true,
  debugMode: false,
  apexVisible: false,
  activeTab: 'status',
  burnFilters: new Set<BurnFilter>(['all']),
  setOverlayVisible: (overlayVisible) => set({ overlayVisible }),
  setDebugMode: (debugMode) => set({ debugMode }),
  setApexVisible: (apexVisible) => set({ apexVisible }),
  setActiveTab: (activeTab) => set({ activeTab }),
  toggleBurnFilter: (filter) =>
    set((state) => {
      // Selecting ALL resets to show everything
      if (filter === 'all') return { burnFilters: new Set<BurnFilter>(['all']) };

      const next = new Set(state.burnFilters);
      next.delete('all');

      if (next.has(filter)) {
        next.delete(filter);
      } else {
        next.add(filter);
      }

      // If nothing selected, revert to ALL
      if (next.size === 0) return { burnFilters: new Set<BurnFilter>(['all']) };

      // If all individual filters selected, collapse to ALL
      if (individualBurnFilters.every((f) => next.has(f))) {
        return { burnFilters: new Set<BurnFilter>(['all']) };
      }

      return { burnFilters: next };
    }),
}));
