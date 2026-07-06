/**
 * Dynamic CX exchange code → station naturalId mapping, learned from
 * COMEX_BROKER_DATA (which only arrives when a CX buffer is opened).
 * Consumers should fall back to the static CX constant map for login-time
 * lookups. Not persisted — cleared on reconnect.
 *
 * Adapted from jackinabox86's APXM fork (https://github.com/jackinabox86/APXM).
 */

import { create } from 'zustand';

interface ExchangeEntry {
  /** Exchange code, e.g. "AI1". */
  code: string;
  /** Station entity naturalId, e.g. "ANT". */
  naturalId: string;
}

interface ExchangeState {
  exchanges: ExchangeEntry[];
  setExchange: (code: string, naturalId: string) => void;
  getNaturalIdFromCode: (code: string) => string | undefined;
  getCodeFromNaturalId: (naturalId: string) => string | undefined;
  clear: () => void;
}

export const useExchangeStore = create<ExchangeState>((set, get) => ({
  exchanges: [],

  setExchange: (code, naturalId) =>
    set((state) => {
      const idx = state.exchanges.findIndex((e) => e.code === code);
      if (idx >= 0) {
        if (state.exchanges[idx].naturalId === naturalId) return state;
        const updated = [...state.exchanges];
        updated[idx] = { code, naturalId };
        return { exchanges: updated };
      }
      return { exchanges: [...state.exchanges, { code, naturalId }] };
    }),

  getNaturalIdFromCode: (code) =>
    get().exchanges.find((e) => e.code === code)?.naturalId,

  getCodeFromNaturalId: (naturalId) =>
    get().exchanges.find((e) => e.naturalId === naturalId)?.code,

  clear: () => set({ exchanges: [] }),
}));
