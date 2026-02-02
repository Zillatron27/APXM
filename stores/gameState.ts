import { create } from 'zustand';

/**
 * UI-related game state.
 * Connection state has been moved to stores/connection.ts.
 * Entity data is in stores/entities/*.ts.
 */
interface GameState {
  overlayVisible: boolean;
  debugMode: boolean;
  setOverlayVisible: (visible: boolean) => void;
  setDebugMode: (debug: boolean) => void;
}

export const useGameState = create<GameState>((set) => ({
  overlayVisible: true,
  debugMode: false,
  setOverlayVisible: (overlayVisible) => set({ overlayVisible }),
  setDebugMode: (debugMode) => set({ debugMode }),
}));
