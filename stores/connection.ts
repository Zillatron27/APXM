import { create } from 'zustand';

interface ConnectionState {
  connected: boolean;
  lastMessageTimestamp: number | null;
  messageCount: number;
  reconnectCount: number;
}

interface ConnectionActions {
  setConnected: (connected: boolean) => void;
  setLastMessageTimestamp: (timestamp: number) => void;
  incrementMessageCount: () => void;
  incrementReconnectCount: () => void;
  reset: () => void;
}

type ConnectionStore = ConnectionState & ConnectionActions;

const initialState: ConnectionState = {
  connected: false,
  lastMessageTimestamp: null,
  messageCount: 0,
  reconnectCount: 0,
};

export const useConnectionStore = create<ConnectionStore>((set) => ({
  ...initialState,

  setConnected: (connected) => set({ connected }),

  setLastMessageTimestamp: (lastMessageTimestamp) => set({ lastMessageTimestamp }),

  incrementMessageCount: () =>
    set((state) => ({ messageCount: state.messageCount + 1 })),

  incrementReconnectCount: () =>
    set((state) => ({ reconnectCount: state.reconnectCount + 1 })),

  reset: () => set(initialState),
}));
