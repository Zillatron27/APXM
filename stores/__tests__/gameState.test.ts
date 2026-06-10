import { describe, it, expect, beforeEach } from 'vitest';
import { useGameState, type BurnFilter } from '../gameState';

/**
 * gameState store tests.
 * Note: Connection state (connected, lastMessageTimestamp, messageCount)
 * has been moved to stores/connection.ts as of Chunk 2.
 */
describe('gameState store', () => {
  beforeEach(() => {
    // Reset store to initial state
    useGameState.setState({
      overlayVisible: true,
      debugMode: false,
      burnFilters: new Set<BurnFilter>(['all']),
    });
  });

  describe('initial state', () => {
    it('overlay is visible by default', () => {
      expect(useGameState.getState().overlayVisible).toBe(true);
    });

    it('debug mode is off by default', () => {
      expect(useGameState.getState().debugMode).toBe(false);
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
});
