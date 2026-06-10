import { create } from 'zustand';
import type { Urgency } from '../core/burn';

/**
 * UI-related game state.
 * Connection state has been moved to stores/connection.ts.
 * Entity data is in stores/entities/*.ts.
 */

export type TabId = 'status' | 'fleet' | 'bases' | 'contracts' | 'settings';

/** Burn view filter: one of the four urgency tiers, or 'all'. */
export type BurnFilter = Urgency | 'all';

// Non-ALL filter values, used by the toggle collapse/revert rules
const individualBurnFilters: BurnFilter[] = ['critical', 'warning', 'ok', 'surplus'];

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
