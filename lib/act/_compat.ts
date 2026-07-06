// Compatibility shims for refined-prun primitives that the ported ACT runner
// expects. Stage 1 ports the runner verbatim; APXM does not yet have all of
// the prun-api stores, DOM helpers, or utility functions that rprun pulls in,
// so this module collects the missing pieces in one place. Each shim is either
// adapted to an existing APXM equivalent or stubbed to a safe default for
// later stages to wire up.

import type { PrunApi } from '../../types/prun-api';

// ---------------------------------------------------------------------------
// Stores — adapt APXM's entity stores to the rprun-style singleton API used by
// the runner. The methods exposed here are exactly the ones the ported files
// call; anything else can be added incrementally.
// ---------------------------------------------------------------------------

import { useSitesStore } from '../../stores/entities/sites';
import {
  getStorageByAddressableId as apxmGetStorageByAddressableId,
  useStorageStore,
} from '../../stores/entities/storage';
import { getWorkforceBySiteId } from '../../stores/entities/workforce';
import { getProductionBySiteId } from '../../stores/entities/production';
import { getEntityDisplayName } from '../address';
import {
  calculateProductionRates,
  calculateWorkforceConsumption,
  getInventoryFromStores,
} from '../../core/burn';
import { useWarehouseStore, type WarehouseLocation } from '../../stores/warehouses';
import { useExchangeStore } from '../../stores/exchanges';
import { useMaterialsStore, type MaterialInfo } from '../../stores/reference';
import { useCxobStore } from '../../stores/cxob';
import { warn } from '../debug/logger';

export const sitesStore = {
  getByPlanetNaturalIdOrName(query: string | undefined): PrunApi.Site | undefined {
    if (!query) return undefined;
    const all = useSitesStore.getState().getAll();
    return (
      all.find((s) => s.address?.lines?.some((l) => l.entity?.naturalId === query)) ??
      all.find((s) => s.siteId === query) ??
      all.find((s) => getEntityDisplayName(s.address) === query)
    );
  },
};

export const workforcesStore = {
  getById(siteId: string | undefined) {
    if (!siteId) return undefined;
    const wf = getWorkforceBySiteId(siteId);
    return wf ? { workforces: wf.workforces } : undefined;
  },
};

export const productionStore = {
  getBySiteId(siteId: string | undefined) {
    if (!siteId) return undefined;
    return getProductionBySiteId(siteId);
  },
};

export const storagesStore = {
  getByAddressableId(addressableId: string | undefined): PrunApi.Store[] {
    if (!addressableId) return [];
    return apxmGetStorageByAddressableId(addressableId);
  },
  getById(_id: string | undefined): PrunApi.Store | undefined {
    if (!_id) return undefined;
    return useStorageStore.getState().getById(_id);
  },
  getByName(name: string | null | undefined): PrunApi.Store | undefined {
    if (!name) return undefined;
    return useStorageStore.getState().getAll().find((s) => s.name === name);
  },
  getByNameAndType(name: string, type: PrunApi.StoreType): PrunApi.Store | undefined {
    return useStorageStore.getState().getAll().find((s) => s.name === name && s.type === type);
  },
};

// Derive the system natural ID from a CX exchange code, e.g. "AI1" → "AI".
function deriveSystemCode(exchangeCode: string): string | undefined {
  const m = exchangeCode.match(/^([A-Z]+)\d+$/);
  return m ? m[1] : undefined;
}

// Multi-strategy CX warehouse lookup:
//   1. Exact stationNaturalId match (exchange code == station entity naturalId)
//   2. Cross-reference via WAREHOUSE_STORE.addressableId when storeId not in storage store
//   3. System-code fallback (exchange "AI1" → systemNaturalId "AI")
// Each strategy also tries to find the PrunApi.Store via addressableId if getById misses.
function resolveWarehouseStore(exchangeCode: string): { storeId: string } | undefined {
  const warehouseState = useWarehouseStore.getState();
  const storageState = useStorageStore.getState();

  function storeIdFromWarehouseId(warehouseId: string): string | undefined {
    const wh = warehouseState.warehouses.find(w => w.warehouseId === warehouseId);
    if (!wh) return undefined;
    // Primary: cross-reference via addressableId === warehouseId. Per rprun,
    // Store.addressableId for a CX warehouse always points to the warehouse
    // entity itself, so this match is authoritative regardless of how storeId
    // was parsed from the original message.
    const byAddr = storageState.getAll()
      .find(s => s.type === 'WAREHOUSE_STORE' && s.addressableId === warehouseId);
    if (byAddr) return byAddr.id;
    // Secondary: the recorded storeId if it's already present in the storage store.
    // Treat "" as a sentinel (extractWarehouse fell back to empty — no top-level field).
    if (wh.storeId && storageState.getById(wh.storeId)) return wh.storeId;
    // Both strategies failed — the Store is not in the storage store yet.
    // Return undefined so resolveWarehouseStore logs the full diagnostic rather
    // than silently returning a storeId that getById() will reject later.
    console.warn(
      `[APXM] _compat: warehouse ${warehouseId.slice(0, 8)} storeId=${wh.storeId ? wh.storeId.slice(0, 8) : '(empty)'} not found in storage store — STORAGE_STORAGES may not include WAREHOUSE_STORE entries`,
    );
    return undefined;
  }

  // Strategy 1: stationNaturalId or systemNaturalId exact match
  const loc = warehouseState.getByEntityNaturalId(exchangeCode);
  if (loc) {
    const sid = storeIdFromWarehouseId(loc.warehouseId);
    if (sid) return { storeId: sid };
  }

  // Strategy 2: system-code fallback
  const systemCode = deriveSystemCode(exchangeCode);
  if (systemCode) {
    const bySystem = warehouseState.getBySystem(systemCode);
    if (bySystem) {
      const sid = storeIdFromWarehouseId(bySystem.warehouseId);
      if (sid) {
        warn(`_compat: warehouse for '${exchangeCode}' matched by system '${systemCode}' — may be ambiguous if you have warehouses at two ${systemCode} exchanges`);
        return { storeId: sid };
      }
    }
  }

  // Nothing found — always-visible diagnostics (not gated by ?apxm_debug).
  const whSnapshot = warehouseState.warehouses.map(w =>
    `[${w.warehouseId.slice(0, 8)} sys=${w.systemNaturalId} sta=${w.stationNaturalId ?? 'null'} storeId=${w.storeId ? w.storeId.slice(0, 8) : '(empty)'}]`
  ).join(', ');
  // Also dump every WAREHOUSE_STORE entry in the storage store — if these exist
  // but the warehouse store is empty, STORAGE_STORAGES has the inventory but
  // WAREHOUSE_STORAGES never populated the location lookup table.
  const storageWhEntries = storageState.getAll()
    .filter(s => s.type === 'WAREHOUSE_STORE')
    .map(s => `[id=${s.id.slice(0, 8)} addr=${s.addressableId.slice(0, 8)} name=${s.name ?? 'null'}]`)
    .join(', ');
  console.warn(
    `[APXM] CX warehouse not found for '${exchangeCode}'.` +
    `\n  useWarehouseStore entries: ${whSnapshot || '(empty — WAREHOUSE_STORAGES not processed?)'}` +
    `\n  storageStore WAREHOUSE_STORE entries: ${storageWhEntries || '(none — not in STORAGE_STORAGES either)'}`,
  );
  return undefined;
}

export const warehousesStore = {
  getByEntityNaturalId(naturalId: string | undefined): WarehouseLocation | undefined {
    if (!naturalId) return undefined;
    return useWarehouseStore.getState().getByEntityNaturalId(naturalId);
  },
  resolveStoreId(naturalId: string | undefined): { storeId: string } | undefined {
    if (!naturalId) return undefined;
    return resolveWarehouseStore(naturalId);
  },
};

// Static mapping of CX exchange codes to their station entity naturalIds.
// These are fundamental game constants — the 4 commodity exchanges in PrUn.
const CX_STATION_NATURAL_IDS: Record<string, string> = {
  AI1: 'ANT',  // Antares Industrial Exchange
  CI1: 'BEN',  // Benten Commodity Exchange
  NC1: 'MOR',  // Moria Transit Exchange
  IC1: 'HRT',  // Hort Trade Center
};

export const exchangesStore = {
  getNaturalIdFromCode(code: string | undefined): string | undefined {
    if (!code) return undefined;
    // Dynamic store (populated from COMEX_BROKER_DATA when a CX buffer is opened)
    // takes priority; static map is the reliable fallback for login-time lookups.
    return useExchangeStore.getState().getNaturalIdFromCode(code)
      ?? CX_STATION_NATURAL_IDS[code]
      ?? code;
  },
};

// The engine only reads ticker/weight/volume (cargo-fit checks and totals).
// Main sources materials from the FIO reference store rather than the fork's
// WS-derived store; MaterialInfo carries exactly the fields the engine needs.
export type Material = MaterialInfo;

export const materialsStore = {
  getByTicker(ticker: string): Material | undefined {
    // Reference store keys are uppercase tickers.
    return useMaterialsStore.getState().getById(ticker.toUpperCase());
  },
};

export type CXOrder = import('../../types/prun-api').PrunApi.CXOrder;
export type CXOrderBook = import('../../types/prun-api').PrunApi.CXOrderBook;

export const cxobStore = {
  getByTicker(cxTicker: string): CXOrderBook | undefined {
    return useCxobStore.getState().getByTicker(cxTicker);
  },
};

export function isFiniteOrder(order: CXOrder): boolean {
  return order.amount !== null && Number.isFinite(order.amount);
}

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

export function fixed0(value: number): string {
  return Math.round(value).toString();
}

export function fixed02(value: number): string {
  return value.toFixed(2);
}

export function fixed1(value: number): string {
  return value.toFixed(1).replace(/\.0$/, '');
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wait until condition() returns true, polling every intervalMs.
 * Rejects with an Error after timeoutMs if condition never becomes true.
 *
 * Replaces Vue's watchWhile(cond) pattern: watchWhile(() => x) waits while x
 * is truthy, so the APXM equivalent is waitUntil(() => !x).
 */
export function waitUntil(
  condition: () => boolean,
  intervalMs = 100,
  timeoutMs = 15000,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (condition()) {
      resolve();
      return;
    }
    const interval = setInterval(() => {
      if (condition()) {
        clearInterval(interval);
        resolve();
      }
    }, intervalMs);
    setTimeout(() => {
      clearInterval(interval);
      reject(new Error('waitUntil timed out'));
    }, timeoutMs);
  });
}

export function focusElement(el: Element): void {
  (el as HTMLElement).focus();
}

// `deepToRaw` in rprun strips Vue reactivity wrappers. In APXM the data is
// already plain so this is identity.
export function deepToRaw<T>(value: T): T {
  return value;
}

// `clickElement` in rprun dispatches a mouse click via a small helper. On
// mobile WebKit a synthetic click on the element is sufficient.
export async function clickElement(el: Element): Promise<void> {
  (el as HTMLElement).click();
}

// ---------------------------------------------------------------------------
// Burn calculation — APXM currently exposes per-site burn through
// core/burn.ts, not a planet-level function. Stub to undefined-friendly shape
// until later stages port the equivalent of rprun's calculatePlanetBurn.
// ---------------------------------------------------------------------------

export interface MaterialBurn {
  dailyAmount: number;
  inventory: number;
  workforce: number;
  input: number;
  output: number;
}

export type PlanetBurn = Record<string, MaterialBurn>;

export function calculatePlanetBurn(
  production: PrunApi.ProductionLine[],
  workforce: PrunApi.Workforce[] | undefined,
  stores: PrunApi.Store[] | undefined,
): PlanetBurn {
  const prodRates = calculateProductionRates(production);
  const wfRates = calculateWorkforceConsumption(workforce ?? []);
  const inventory = getInventoryFromStores(stores ?? []);

  const tickers = new Set([...prodRates.keys(), ...wfRates.keys()]);
  const result: PlanetBurn = {};
  for (const ticker of tickers) {
    const prod = prodRates.get(ticker);
    const wf = wfRates.get(ticker)?.consumption ?? 0;
    const inv = inventory.get(ticker) ?? 0;
    const input = prod?.input ?? 0;
    const output = prod?.output ?? 0;
    result[ticker] = {
      dailyAmount: output - input - wf,
      inventory: inv,
      workforce: wf,
      input,
      output,
    };
  }
  return result;
}
