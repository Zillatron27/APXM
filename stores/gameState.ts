import { create } from 'zustand';

interface GameState {
  connected: boolean;
  lastMessageTimestamp: number | null;
  overlayVisible: boolean;
  debugMode: boolean;
  messageCount: number;
  setConnected: (connected: boolean) => void;
  setLastMessageTimestamp: (timestamp: number | null) => void;
  setOverlayVisible: (visible: boolean) => void;
  setDebugMode: (debug: boolean) => void;
  incrementMessageCount: () => void;
}

export const useGameState = create<GameState>((set) => ({
  connected: false,
  lastMessageTimestamp: null,
  overlayVisible: true,
  debugMode: false,
  messageCount: 0,
  setConnected: (connected) => set({ connected }),
  setLastMessageTimestamp: (lastMessageTimestamp) => set({ lastMessageTimestamp }),
  setOverlayVisible: (overlayVisible) => set({ overlayVisible }),
  setDebugMode: (debugMode) => set({ debugMode }),
  incrementMessageCount: () => set((state) => ({ messageCount: state.messageCount + 1 })),
}));
