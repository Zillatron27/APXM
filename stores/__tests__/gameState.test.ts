import { describe, it, expect, beforeEach } from 'vitest';
import { useGameState, type BurnFilter } from '../gameState';

/**
 * gameState store tests.
 * Note: Connection state (connected, lastMessageTimestamp, messageCount)
 * has been moved to stores/connection.ts as of Chunk 2.
 */
// Pristine state captured at import time, before any test touches the store.
// beforeEach restores from this snapshot instead of hand-writing the expected
// values — so the "initial state" tests assert the SOURCE defaults and fail
// if one ever flips. Safe to share: the filter toggles always build new Sets,
// never mutate the ones in state.
const pristineState = useGameState.getState();

describe('gameState store', () => {
  beforeEach(() => {
    useGameState.setState(pristineState, true);
  });

  describe('initial state', () => {
    it('overlay is visible by default', () => {
      expect(useGameState.getState().overlayVisible).toBe(true);
    });

    it('debug mode is off by default', () => {
      expect(useGameState.getState().debugMode).toBe(false);
    });

    it('APEX is hidden by default — the overlay covers it', () => {
      expect(useGameState.getState().apexVisible).toBe(false);
    });

    it('starts on the status tab', () => {
      expect(useGameState.getState().activeTab).toBe('status');
    });

    it('starts with no drill-down sheet open', () => {
      expect(useGameState.getState().detailView).toBeNull();
    });

    it('starts with no manual-confirm window pending', () => {
      expect(useGameState.getState().actConfirmPending).toBe(false);
    });
  });

  describe('setActConfirmPending', () => {
    it('round-trips the manual-confirm window flag', () => {
      useGameState.getState().setActConfirmPending(true);
      expect(useGameState.getState().actConfirmPending).toBe(true);
      useGameState.getState().setActConfirmPending(false);
      expect(useGameState.getState().actConfirmPending).toBe(false);
    });
  });

  describe('setOverlayVisible', () => {
    it('updates overlay visibility', () => {
      useGameState.getState().setOverlayVisible(false);
      expect(useGameState.getState().overlayVisible).toBe(false);
    });
  });

  describe('setDebugMode', () => {
    it('updates debug mode', () => {
      useGameState.getState().setDebugMode(true);
      expect(useGameState.getState().debugMode).toBe(true);
    });
  });

  describe('setApexVisible', () => {
    it('toggles APEX visibility', () => {
      useGameState.getState().setApexVisible(true);
      expect(useGameState.getState().apexVisible).toBe(true);

      useGameState.getState().setApexVisible(false);
      expect(useGameState.getState().apexVisible).toBe(false);
    });
  });

  describe('setActiveTab', () => {
    it('switches the active tab', () => {
      useGameState.getState().setActiveTab('fleet');
      expect(useGameState.getState().activeTab).toBe('fleet');

      useGameState.getState().setActiveTab('bases');
      expect(useGameState.getState().activeTab).toBe('bases');
    });
  });

  describe('setDetailView', () => {
    it('opens a site drill-down sheet with the full payload', () => {
      useGameState.getState().setDetailView({
        type: 'burn',
        siteId: 'site-1',
        siteName: 'Montem Base',
      });

      expect(useGameState.getState().detailView).toEqual({
        type: 'burn',
        siteId: 'site-1',
        siteName: 'Montem Base',
      });
    });

    it('closes the sheet when set to null', () => {
      useGameState.getState().setDetailView({
        type: 'production',
        siteId: 'site-1',
        siteName: 'Montem Base',
      });

      useGameState.getState().setDetailView(null);

      expect(useGameState.getState().detailView).toBeNull();
    });
  });

  describe('toggleBurnFilter', () => {
    const filters = () => [...useGameState.getState().burnFilters].sort();
    const toggle = (f: BurnFilter) => useGameState.getState().toggleBurnFilter(f);

    it('defaults to ALL', () => {
      expect(filters()).toEqual(['all']);
    });

    it('selecting a tier replaces ALL with that tier', () => {
      toggle('critical');
      expect(filters()).toEqual(['critical']);
    });

    it('supports multi-select of tiers', () => {
      toggle('critical');
      toggle('ok');
      expect(filters()).toEqual(['critical', 'ok']);
    });

    it('deselecting the last tier reverts to ALL', () => {
      toggle('warning');
      toggle('warning');
      expect(filters()).toEqual(['all']);
    });

    it('selecting all three tiers collapses to ALL', () => {
      toggle('critical');
      toggle('warning');
      toggle('ok');
      expect(filters()).toEqual(['all']);
    });

    it('selecting ALL resets any tier selection', () => {
      toggle('critical');
      toggle('ok');
      toggle('all');
      expect(filters()).toEqual(['all']);
    });
  });

  describe('toggleFleetFilter', () => {
    const filters = () => [...useGameState.getState().fleetFilters].sort();

    it('defaults to ALL', () => {
      expect(filters()).toEqual(['all']);
    });

    it('applies the shared toggle rules', () => {
      useGameState.getState().toggleFleetFilter('idle');
      expect(filters()).toEqual(['idle']);

      // Selecting both individual filters collapses to ALL
      useGameState.getState().toggleFleetFilter('in-transit');
      expect(filters()).toEqual(['all']);
    });
  });

  describe('toggleContractFilter', () => {
    const filters = () => [...useGameState.getState().contractFilters].sort();

    it('defaults to ACTIVE — fulfilled contracts are history', () => {
      expect(filters()).toEqual(['active']);
    });

    it('applies the shared toggle rules', () => {
      // Deselecting the default reverts to ALL
      useGameState.getState().toggleContractFilter('active');
      expect(filters()).toEqual(['all']);

      useGameState.getState().toggleContractFilter('fulfilled');
      expect(filters()).toEqual(['fulfilled']);
    });
  });
});
