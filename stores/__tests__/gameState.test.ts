import { describe, it, expect, beforeEach } from 'vitest';
import { useGameState } from '../gameState';

describe('gameState store', () => {
  beforeEach(() => {
    // Reset store to initial state
    useGameState.setState({
      connected: false,
      lastMessageTimestamp: null,
      overlayVisible: true,
      debugMode: false,
      messageCount: 0,
    });
  });

  describe('initial state', () => {
    it('starts disconnected', () => {
      expect(useGameState.getState().connected).toBe(false);
    });

    it('has null lastMessageTimestamp', () => {
      expect(useGameState.getState().lastMessageTimestamp).toBeNull();
    });

    it('overlay is visible by default', () => {
      expect(useGameState.getState().overlayVisible).toBe(true);
    });

    it('debug mode is off by default', () => {
      expect(useGameState.getState().debugMode).toBe(false);
    });

    it('message count starts at 0', () => {
      expect(useGameState.getState().messageCount).toBe(0);
    });
  });

  describe('setConnected', () => {
    it('updates connected state', () => {
      useGameState.getState().setConnected(true);
      expect(useGameState.getState().connected).toBe(true);

      useGameState.getState().setConnected(false);
      expect(useGameState.getState().connected).toBe(false);
    });
  });

  describe('setLastMessageTimestamp', () => {
    it('updates timestamp', () => {
      const now = Date.now();
      useGameState.getState().setLastMessageTimestamp(now);
      expect(useGameState.getState().lastMessageTimestamp).toBe(now);
    });

    it('can set to null', () => {
      useGameState.getState().setLastMessageTimestamp(123);
      useGameState.getState().setLastMessageTimestamp(null);
      expect(useGameState.getState().lastMessageTimestamp).toBeNull();
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

  describe('incrementMessageCount', () => {
    it('increments count by 1', () => {
      expect(useGameState.getState().messageCount).toBe(0);

      useGameState.getState().incrementMessageCount();
      expect(useGameState.getState().messageCount).toBe(1);

      useGameState.getState().incrementMessageCount();
      expect(useGameState.getState().messageCount).toBe(2);
    });
  });
});
