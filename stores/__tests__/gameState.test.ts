import { describe, it, expect, beforeEach } from 'vitest';
import { useGameState } from '../gameState';

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
});
