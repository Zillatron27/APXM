/**
 * Resupply / Repair Bill Calculation
 *
 * Pure bill maths for the RESUPPLY and REPAIR sheets, plus thin entry points
 * that read the stores. Spec: v1.4-resupply-repair (rulings 3-6).
 *
 * Bill netting is a PURCHASING rule: it counts warehouse stock, which the burn
 * days figure deliberately does not (the game cannot consume from a warehouse).
 *
 * Bill shape, fit-to-ship and storage fit are ported from refined-prun (MIT):
 * XIT ACT material-bill.ts and resupply/fit-days.ts, core/storage-analysis.ts
 * (storage fit: rPrun PR #206 by @erendrake).
 */

import type { PrunApi } from '../types/prun-api';
import {
  calculateSiteBurn,
  getInventoryFromStores,
  NET_RATE_EPSILON,
  type BurnRate,
} from './burn';
import { isRepairableBuilding } from './repair';
import { useSettingsStore } from '../stores/settings';
import { useSitesStore } from '../stores/entities/sites';
import { getStorageByAddressableId, useStorageStore } from '../stores/entities/storage';
import { useMaterialsStore } from '../stores/reference';
import { exchangesStore, warehousesStore } from '../lib/act/_compat';

// ============================================================================
// Types
// ============================================================================

/** Price is per unit; null until a CX quote is attached. */
export interface BillEntry {
  quantity: number;
  price: number | null;
}

export type MaterialBill = Record<string, BillEntry>;

export type RepairHorizon = 'now' | '24h' | '48h';

export interface MaterialDimensions {
  weight: number; // t per unit
  volume: number; // m³ per unit
}

export type MaterialDimensionsLookup = (ticker: string) => MaterialDimensions | undefined;

/** Weight in t, volume in m³. */
export interface BillTotals {
  weight: number;
  volume: number;
}

export interface StoreCapacity {
  weightLoad: number;
  weightCapacity: number;
  volumeLoad: number;
  volumeCapacity: number;
}

export type StorageFit =
  | { fits: true }
  | {
      fits: false;
      overflowWeight: number; // t over capacity, 0 if weight fits
      overflowVolume: number; // m³ over capacity, 0 if volume fits
      /** The dimension with the higher projected fill, i.e. the one that fills first. */
      bindingLimit: 't' | 'm³';
    };

/** Whole days; 999 matches rPrun's cap for "effectively unlimited". */
export const FIT_DAYS_MAX = 999;

// ============================================================================
// Pure calculations (exported for testing)
// ============================================================================

/**
 * Resupply bill for `days` of consumption (ruling 6):
 * ceil(max(0, days × |net daily| − (inventoryAmount + warehouse))).
 *
 * `BurnRate.inventoryAmount` is already store + remainingAllocation + inbound
 * and honours the per-site exclude-inbound toggle. Only consuming tickers are
 * billed; there is no +1 over-buy (unlike rPrun's ACT bill).
 */
export function calculateResupplyBill(
  burns: BurnRate[],
  days: number,
  warehouse: ReadonlyMap<string, number>
): MaterialBill {
  const bill: MaterialBill = {};
  for (const burn of burns) {
    if (burn.dailyAmount >= 0 || Math.abs(burn.dailyAmount) < NET_RATE_EPSILON) continue;
    const available = burn.inventoryAmount + (warehouse.get(burn.materialTicker) ?? 0);
    const quantity = Math.ceil(Math.max(0, days * -burn.dailyAmount - available));
    if (quantity > 0) bill[burn.materialTicker] = { quantity, price: null };
  }
  return bill;
}

/**
 * Repair bill: Σ of the server-authoritative repair materials for the horizon
 * over PRODUCTION/RESOURCES buildings (ruling 4), less base store and
 * warehouse stock (ruling 3). No allocation or inbound terms.
 */
export function calculateRepairBill(
  platforms: PrunApi.Platform[],
  horizon: RepairHorizon,
  store: ReadonlyMap<string, number>,
  warehouse: ReadonlyMap<string, number>
): MaterialBill {
  const needed = new Map<string, number>();
  for (const platform of platforms.filter(isRepairableBuilding)) {
    const materials =
      horizon === 'now'
        ? platform.repairMaterials
        : horizon === '24h'
          ? platform.repairMaterials24
          : platform.repairMaterials48;
    for (const { material, amount } of materials) {
      needed.set(material.ticker, (needed.get(material.ticker) ?? 0) + amount);
    }
  }

  const bill: MaterialBill = {};
  for (const [ticker, amount] of needed) {
    const quantity = Math.max(0, amount - (store.get(ticker) ?? 0) - (warehouse.get(ticker) ?? 0));
    if (quantity > 0) bill[ticker] = { quantity, price: null };
  }
  return bill;
}

/**
 * What to actually buy at an exchange: the bill less what the player's
 * warehouse there already holds (ruling 3; rPrun useCXInv behaviour).
 */
export function netAgainstCxWarehouse(
  bill: MaterialBill,
  cxWarehouse: ReadonlyMap<string, number>
): MaterialBill {
  const buy: MaterialBill = {};
  for (const [ticker, entry] of Object.entries(bill)) {
    const quantity = Math.max(0, entry.quantity - (cxWarehouse.get(ticker) ?? 0));
    if (quantity > 0) buy[ticker] = { ...entry, quantity };
  }
  return buy;
}

/** Total weight and volume of a bill. Tickers with no reference data count as zero. */
export function billTotals(bill: MaterialBill, lookup: MaterialDimensionsLookup): BillTotals {
  let weight = 0;
  let volume = 0;
  for (const [ticker, { quantity }] of Object.entries(bill)) {
    const dimensions = lookup(ticker);
    if (!dimensions) continue;
    weight += dimensions.weight * quantity;
    volume += dimensions.volume * quantity;
  }
  return { weight, volume };
}

/**
 * Largest whole number of days (0 to FIT_DAYS_MAX) whose resupply bill fits
 * the cargo capacity, weight and volume checked independently. 0 means even
 * one day does not fit. Binary search is valid because the bill only grows
 * with days. Ported from rPrun resupply/fit-days.ts, in whole days.
 */
export function maxFittingDays(
  burns: BurnRate[],
  warehouse: ReadonlyMap<string, number>,
  capacity: { weight: number; volume: number },
  lookup: MaterialDimensionsLookup
): number {
  const fits = (days: number) => {
    const totals = billTotals(calculateResupplyBill(burns, days, warehouse), lookup);
    return totals.weight <= capacity.weight && totals.volume <= capacity.volume;
  };
  let lo = 0;
  let hi = FIT_DAYS_MAX;
  while (lo < hi) {
    const mid = lo + Math.ceil((hi - lo) / 2);
    if (fits(mid)) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/**
 * Projects the base store's load plus the bill against its capacity.
 * Binding dimension = higher projected fill ratio, as in rPrun's
 * storage-analysis (a zero-capacity dimension counts as ratio 0 there; here a
 * non-empty projection against zero capacity is infinitely full).
 */
export function calculateStorageFit(store: StoreCapacity, added: BillTotals): StorageFit {
  const projectedWeight = store.weightLoad + added.weight;
  const projectedVolume = store.volumeLoad + added.volume;
  const overflowWeight = Math.max(0, projectedWeight - store.weightCapacity);
  const overflowVolume = Math.max(0, projectedVolume - store.volumeCapacity);
  if (overflowWeight === 0 && overflowVolume === 0) return { fits: true };

  const weightFill = projectedWeight / store.weightCapacity;
  const volumeFill = projectedVolume / store.volumeCapacity;
  return {
    fits: false,
    overflowWeight,
    overflowVolume,
    bindingLimit: weightFill >= volumeFill ? 't' : 'm³',
  };
}

// ============================================================================
// Store-reading entry points
// ============================================================================

function inventoryOfType(
  stores: PrunApi.Store[],
  type: PrunApi.StoreType
): Map<string, number> {
  const inventory = new Map<string, number>();
  for (const store of stores.filter((s) => s.type === type)) {
    for (const item of store.items) {
      if (item.quantity?.material?.ticker) {
        const ticker = item.quantity.material.ticker;
        inventory.set(ticker, (inventory.get(ticker) ?? 0) + item.quantity.amount);
      }
    }
  }
  return inventory;
}

/** Stock in the site's WAREHOUSE_STORE stores (keyed on the site id). */
export function getBaseWarehouseStock(siteId: string): Map<string, number> {
  return inventoryOfType(getStorageByAddressableId(siteId), 'WAREHOUSE_STORE');
}

/** Stock in the player's warehouse at an exchange (code such as "AI1"); empty if none is known. */
export function getCxWarehouseStock(exchangeCode: string): Map<string, number> {
  const resolved = warehousesStore.resolveStoreId(
    exchangesStore.getNaturalIdFromCode(exchangeCode)
  );
  const store = resolved && useStorageStore.getState().getById(resolved.storeId);
  return store ? inventoryOfType([store], 'WAREHOUSE_STORE') : new Map();
}

export function materialDimensionsLookup(): MaterialDimensionsLookup {
  const materials = useMaterialsStore.getState();
  return (ticker) => materials.getById(ticker.toUpperCase());
}

/** Resupply bill for a site; `days` defaults to the user's resupply threshold. */
export function getSiteResupplyBill(
  siteId: string,
  days: number = useSettingsStore.getState().burnThresholds.resupply
): MaterialBill {
  return calculateResupplyBill(
    calculateSiteBurn(siteId).burns,
    days,
    getBaseWarehouseStock(siteId)
  );
}

export function getSiteRepairBill(siteId: string, horizon: RepairHorizon): MaterialBill {
  return calculateRepairBill(
    useSitesStore.getState().getById(siteId)?.platforms ?? [],
    horizon,
    getInventoryFromStores(getStorageByAddressableId(siteId)),
    getBaseWarehouseStock(siteId)
  );
}

/** Whether `bill` fits the site's base STORE; null when the store is not loaded. */
export function getSiteStorageFit(siteId: string, bill: MaterialBill): StorageFit | null {
  const store = getStorageByAddressableId(siteId).find((s) => s.type === 'STORE');
  return store ? calculateStorageFit(store, billTotals(bill, materialDimensionsLookup())) : null;
}
