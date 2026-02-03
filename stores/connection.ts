import { create } from 'zustand';

interface ConnectionState {
  connected: boolean;
  lastMessageTimestamp: number | null;
  messageCount: number;
  reconnectCount: number;
  /** Count of messages discarded due to malformed payload shape */
  discardedMessages: number;
  /** First 20 unique message types seen that have no registered handler */
  unknownMessageTypes: string[];
}

interface ConnectionActions {
  setConnected: (connected: boolean) => void;
  setLastMessageTimestamp: (timestamp: number) => void;
  incrementMessageCount: () => void;
  incrementReconnectCount: () => void;
  incrementDiscarded: () => void;
  addUnknownMessageType: (type: string) => void;
  reset: () => void;
}

type ConnectionStore = ConnectionState & ConnectionActions;

const initialState: ConnectionState = {
  connected: false,
  lastMessageTimestamp: null,
  messageCount: 0,
  reconnectCount: 0,
  discardedMessages: 0,
  unknownMessageTypes: [],
};

export const useConnectionStore = create<ConnectionStore>((set) => ({
  ...initialState,

  setConnected: (connected) => set({ connected }),

  setLastMessageTimestamp: (lastMessageTimestamp) => set({ lastMessageTimestamp }),

  incrementMessageCount: () =>
    set((state) => ({ messageCount: state.messageCount + 1 })),

  incrementReconnectCount: () =>
    set((state) => ({ reconnectCount: state.reconnectCount + 1 })),

  incrementDiscarded: () =>
    set((state) => ({ discardedMessages: state.discardedMessages + 1 })),

  addUnknownMessageType: (type: string) =>
    set((state) => {
      if (state.unknownMessageTypes.includes(type)) return state;
      if (state.unknownMessageTypes.length >= 20) return state;
      return { unknownMessageTypes: [...state.unknownMessageTypes, type] };
    }),

  reset: () => set(initialState),
}));
