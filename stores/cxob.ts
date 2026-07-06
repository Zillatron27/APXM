/**
 * CX order books keyed by full CX ticker (e.g. "RAT.CI1"), from
 * COMEX_BROKER_DATA. Gives the ACT engine price/depth for CX Buy steps.
 * Not persisted — order books go stale in minutes; cleared on reconnect.
 *
 * Adapted from jackinabox86's APXM fork (https://github.com/jackinabox86/APXM).
 */

import { create } from 'zustand';
import type { PrunApi } from '../types/prun-api';

interface CxobState {
  orderBooks: Map<string, PrunApi.CXOrderBook>;
  getByTicker: (cxTicker: string) => PrunApi.CXOrderBook | undefined;
  setOrderBook: (cxTicker: string, book: PrunApi.CXOrderBook) => void;
  clear: () => void;
}

export const useCxobStore = create<CxobState>((set, get) => ({
  orderBooks: new Map(),

  getByTicker: (cxTicker) => get().orderBooks.get(cxTicker),

  setOrderBook: (cxTicker, book) => {
    const orderBooks = new Map(get().orderBooks);
    orderBooks.set(cxTicker, book);
    set({ orderBooks });
  },

  clear: () => set({ orderBooks: new Map() }),
}));
