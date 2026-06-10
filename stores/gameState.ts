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
export type FleetFilter = 'idle' | 'in-transit' | 'all';
export type ContractFilter = 'active' | 'fulfilled' | 'all';

// Non-ALL filter values per view, used by the toggle collapse/revert rules
const individualBurnFilters: readonly BurnFilter[] = ['critical', 'warning', 'ok'];
const individualFleetFilters: readonly FleetFilter[] = ['idle', 'in-transit'];
const individualContractFilters: readonly ContractFilter[] = ['active', 'fulfilled'];

/**
 * Shared filter-toggle rules for all view filter bars:
 * selecting ALL resets; deselecting the last filter reverts to ALL;
 * selecting every individual filter collapses to ALL.
 */
function toggleFilterSelection<T extends string>(
  current: ReadonlySet<T | 'all'>,
  filter: T | 'all',
  individualFilters: readonly T[]
): ReadonlySet<T | 'all'> {
  if (filter === 'all') return new Set<T | 'all'>(['all']);

  const next = new Set(current);
  next.delete('all');

  if (next.has(filter)) {
    next.delete(filter);
  } else {
    next.add(filter);
  }

  if (next.size === 0) return new Set<T | 'all'>(['all']);
  if (individualFilters.every((f) => next.has(f))) return new Set<T | 'all'>(['all']);

  return next;
}

interface GameState {
  overlayVisible: boolean;
  debugMode: boolean;
  apexVisible: boolean;
  activeTab: TabId;
  // Filter selections are session-scoped (not persisted): they survive tab
  // switches but reset on reload. A filter that stuck across days would
  // silently hide bases/ships/contracts.
  burnFilters: ReadonlySet<BurnFilter>;
  fleetFilters: ReadonlySet<FleetFilter>;
  contractFilters: ReadonlySet<ContractFilter>;
  setOverlayVisible: (visible: boolean) => void;
  setDebugMode: (debug: boolean) => void;
  setApexVisible: (visible: boolean) => void;
  setActiveTab: (tab: TabId) => void;
  toggleBurnFilter: (filter: BurnFilter) => void;
  toggleFleetFilter: (filter: FleetFilter) => void;
  toggleContractFilter: (filter: ContractFilter) => void;
}

export const useGameState = create<GameState>((set) => ({
  overlayVisible: true,
  debugMode: false,
  apexVisible: false,
  activeTab: 'status',
  burnFilters: new Set<BurnFilter>(['all']),
  fleetFilters: new Set<FleetFilter>(['all']),
  // Contracts default to ACTIVE — fulfilled contracts are history
  contractFilters: new Set<ContractFilter>(['active']),
  setOverlayVisible: (overlayVisible) => set({ overlayVisible }),
  setDebugMode: (debugMode) => set({ debugMode }),
  setApexVisible: (apexVisible) => set({ apexVisible }),
  setActiveTab: (activeTab) => set({ activeTab }),
  toggleBurnFilter: (filter) =>
    set((state) => ({
      burnFilters: toggleFilterSelection(state.burnFilters, filter, individualBurnFilters),
    })),
  toggleFleetFilter: (filter) =>
    set((state) => ({
      fleetFilters: toggleFilterSelection(state.fleetFilters, filter, individualFleetFilters),
    })),
  toggleContractFilter: (filter) =>
    set((state) => ({
      contractFilters: toggleFilterSelection(state.contractFilters, filter, individualContractFilters),
    })),
}));
