/**
 * Public FIO reference data stores: materials database and CX prices.
 *
 * Reference data is static/slow-changing, so unlike the game-state entity
 * stores these are deliberately NOT cleared on CLIENT_CONNECTION_OPENED
 * reconnects (a reconnect doesn't invalidate what a material is called) —
 * they are simply never listed in clearAllEntityStores. The persist TTLs
 * control freshness instead, and the createEntityStore version check
 * refetches automatically after an extension update.
 */

import { createEntityStore } from './create-entity-store';

export interface MaterialInfo {
  ticker: string;
  name: string;
  /** FIO CategoryName, raw — the static MATERIAL_CATEGORIES map stays the
   *  primary source for category display/colour lookups. */
  category: string;
  weight: number;
  volume: number;
}

export interface CxEntry {
  ticker: string;
  exchangeCode: string;
  bid: number | null;
  ask: number | null;
  priceAverage: number;
  supply: number;
  demand: number;
  mmBuy: number | null;
  mmSell: number | null;
}

/** Materials are effectively static — a week-old name is still correct. */
export const MATERIALS_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** FIO caches /exchange/all server-side for ~15 minutes; an hour keeps us
 *  to at most one fetch per page load without hammering the endpoint. */
export const CX_CACHE_TTL_MS = 60 * 60 * 1000;

export const useMaterialsStore = createEntityStore<MaterialInfo>(
  'materials',
  (m) => m.ticker,
  { key: 'apxm_cache_materials', ttlMs: MATERIALS_CACHE_TTL_MS }
);

export const useCxStore = createEntityStore<CxEntry>(
  'cx',
  (e) => `${e.ticker}.${e.exchangeCode}`,
  { key: 'apxm_cache_cx', ttlMs: CX_CACHE_TTL_MS }
);

/**
 * Full display name for a material ticker, if the materials database has
 * been fetched. Callers must degrade to the ticker when undefined.
 */
export function getMaterialName(ticker: string): string | undefined {
  return useMaterialsStore.getState().getById(ticker.toUpperCase())?.name;
}

/**
 * Market entry for a material on a specific exchange (e.g. 'RAT', 'AI1').
 */
export function getCxEntry(
  ticker: string,
  exchangeCode: string
): CxEntry | undefined {
  return useCxStore
    .getState()
    .getById(`${ticker.toUpperCase()}.${exchangeCode.toUpperCase()}`);
}
