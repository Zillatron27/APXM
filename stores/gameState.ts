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

/**
 * A drill-down detail screen presented over the current tab as a slide-up
 * sheet. Session-scoped (not persisted) — a sheet that reopened on reload
 * would be a surprise. The entity name travels in the payload so the sheet
 * needs no store lookup for its title. This is the shared primitive for all
 * drill-downs: base status tiles (BURN / REPAIR / PROD) and fleet ship rows
 * each open their detail through it. New drill-downs add a union variant, not
 * a new navigation mechanism.
 */
export type SiteDetailType = 'production' | 'burn' | 'repair';
export type DetailView =
  | { type: SiteDetailType; siteId: string; siteName: string }
  | { type: 'ship'; shipId: string; shipName: string }
  | { type: 'contract'; contractId: string; contractName: string };

// Non-ALL filter values per view, used by the toggle collapse/revert rules

/**
 * Shared filter-toggle rules for all view filter bars:
 * selecting ALL resets; deselecting the last filter reverts to ALL.
 * Selecting every individual filter does NOT collapse to ALL — on a
 * two-filter bar (contracts, fleet) that collapse made the second tap
 * light up ALL instead of the tapped filter, reading as "my tap didn't
 * take" (#81, tester report). Both chips lit is the honest state.
 */
function toggleFilterSelection<T extends string>(
  current: ReadonlySet<T | 'all'>,
  filter: T | 'all'
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
  // The active drill-down sheet, or null when none is open. Session-scoped.
  detailView: DetailView | null;
  /** True while a driven APEX action waits for the user's CONFIRM tap in
   *  APEX's own dialog. AppShell hides the (opaque) shell and drops the
   *  shadow host's background so the dialog is visible and tappable; a slim
   *  ConfirmBar is the only APXM chrome. Set from the action-feedback
   *  onManualConfirm signal. Session-scoped. */
  actConfirmPending: boolean;
  /** True while the full Notifications view (#94) replaces the active tab's
   *  content. A view, not a DetailSheet: the single detailView slot must stay
   *  free so an alert's tap-through can open its target sheet over the list.
   *  Session-scoped. */
  alertsViewOpen: boolean;
  setOverlayVisible: (visible: boolean) => void;
  setDebugMode: (debug: boolean) => void;
  setApexVisible: (visible: boolean) => void;
  setActiveTab: (tab: TabId) => void;
  setDetailView: (view: DetailView | null) => void;
  setActConfirmPending: (pending: boolean) => void;
  setAlertsViewOpen: (open: boolean) => void;
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
  detailView: null,
  actConfirmPending: false,
  alertsViewOpen: false,
  setOverlayVisible: (overlayVisible) => set({ overlayVisible }),
  setDebugMode: (debugMode) => set({ debugMode }),
  setApexVisible: (apexVisible) => set({ apexVisible }),
  // A tab tap is also the way out of the Notifications view: the tab bar
  // stays visible beneath it, so leaving it open would show a tab lit for
  // content that isn't on screen.
  setActiveTab: (activeTab) => set({ activeTab, alertsViewOpen: false }),
  setDetailView: (detailView) => set({ detailView }),
  setActConfirmPending: (actConfirmPending) => set({ actConfirmPending }),
  setAlertsViewOpen: (alertsViewOpen) => set({ alertsViewOpen }),
  toggleBurnFilter: (filter) =>
    set((state) => ({
      burnFilters: toggleFilterSelection(state.burnFilters, filter),
    })),
  toggleFleetFilter: (filter) =>
    set((state) => ({
      fleetFilters: toggleFilterSelection(state.fleetFilters, filter),
    })),
  toggleContractFilter: (filter) =>
    set((state) => ({
      contractFilters: toggleFilterSelection(state.contractFilters, filter),
    })),
}));
