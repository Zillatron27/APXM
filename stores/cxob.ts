/**
 * CX order books keyed by full CX ticker (e.g. "RAT.CI1"), from
 * COMEX_BROKER_DATA. Gives the ACT engine price/depth for CX Buy steps.
 * Not persisted — order books go stale in minutes; cleared on reconnect.
 *
 * Adapted from jackinabox86's APXM fork (https://github.com/jackinabox86/APXM).
 */

import { create } from 'zustand';
import type { PrunApi } from '../types/prun-api';

/** A book stamped with when it arrived (epoch ms). Books outlive the buffer
 *  that requested them, so a consumer needing a live book checks receivedAt. */
export type CxobEntry = PrunApi.CXOrderBook & { receivedAt: number };

interface CxobState {
  orderBooks: Map<string, CxobEntry>;
  getByTicker: (cxTicker: string) => CxobEntry | undefined;
  setOrderBook: (cxTicker: string, book: PrunApi.CXOrderBook) => void;
  clear: () => void;
}

export const useCxobStore = create<CxobState>((set, get) => ({
  orderBooks: new Map(),

  getByTicker: (cxTicker) => get().orderBooks.get(cxTicker),

  setOrderBook: (cxTicker, book) => {
    const orderBooks = new Map(get().orderBooks);
    orderBooks.set(cxTicker, { ...book, receivedAt: Date.now() });
    set({ orderBooks });
  },

  clear: () => set({ orderBooks: new Map() }),
}));
