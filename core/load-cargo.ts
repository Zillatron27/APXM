// Load-cargo planning: which local materials can go into the ship's hold,
// from where, and how many fit. Pure decision logic — the transfers are
// driven by lib/ship-actions.ts. Unlike fuel (volume-only), the hold is
// constrained by BOTH weight and volume.
//
// Same accepted location gap as core/refuel.ts: atSameLocation compares
// PLANET/STATION lines only, so deep-space (system-only) warehouses never
// match.

import type { PrunApi } from '../types/prun-api';
import { atSameLocation } from '../lib/act/actions/utils';
import type { MaterialInfo } from '../stores/reference';
import { stockOf } from './refuel';

export interface LoadableMaterial {
  ticker: string;
  /** FIO camelCase name — display via toDisplayName / material lookup. */
  name: string;
  sourceStoreId: string;
  sourceLabel: string;
  stock: number;
  /** Units that fit the hold ALONE (per-row cap; the combined fit across a
   *  multi-material pick is validated separately). */
  maxUnits: number;
}

export interface LoadPick {
  ticker: string;
  amount: number;
}

export type ValidatedLoad =
  | { ok: true; picks: { ticker: string; name: string; amount: number; sourceStoreId: string }[] }
  | { ok: false; reason: string };

export type LoadableList =
  | { available: true; materials: LoadableMaterial[]; freeWeight: number; freeVolume: number }
  | { available: false; reason: 'no-hold' | 'hold-full' | 'nothing-loadable' | 'no-reference-data' };

function storeLabel(store: PrunApi.Store): string {
  if (store.name) return store.name;
  return store.type === 'WAREHOUSE_STORE' ? 'warehouse' : 'base storage';
}

function localSourceStores(ship: PrunApi.Ship, allStores: PrunApi.Store[]): PrunApi.Store[] {
  const own = new Set([ship.idShipStore, ship.idStlFuelStore, ship.idFtlFuelStore]);
  const hold = allStores.find((s) => s.id === ship.idShipStore);
  if (!hold) return [];
  return allStores.filter((s) => !own.has(s.id) && atSameLocation(s, hold));
}

/**
 * Every material available to load: per ticker, the local store with the
 * largest stock wins (the refuel source rule), and maxUnits is the fit of
 * that material alone — min(stock, weight fit, volume fit).
 */
export function listLoadableMaterials(
  ship: PrunApi.Ship,
  allStores: PrunApi.Store[],
  getMaterial: (ticker: string) => MaterialInfo | undefined
): LoadableList {
  const hold = allStores.find((s) => s.id === ship.idShipStore);
  if (!hold) return { available: false, reason: 'no-hold' };
  const freeWeight = hold.weightCapacity - hold.weightLoad;
  const freeVolume = hold.volumeCapacity - hold.volumeLoad;
  if (freeWeight <= 0 || freeVolume <= 0) return { available: false, reason: 'hold-full' };

  // Best source per ticker: largest stock wins.
  const bestByTicker = new Map<string, { store: PrunApi.Store; stock: number }>();
  let sawAnyStock = false;
  let sawUnknownMaterial = false;
  for (const store of localSourceStores(ship, allStores)) {
    for (const item of store.items) {
      if (item.type !== 'INVENTORY' || !item.quantity) continue;
      const ticker = item.quantity.material.ticker;
      const stock = stockOf(store, ticker);
      if (stock <= 0) continue;
      sawAnyStock = true;
      const best = bestByTicker.get(ticker);
      if (!best || stock > best.stock) bestByTicker.set(ticker, { store, stock });
    }
  }
  if (!sawAnyStock) return { available: false, reason: 'nothing-loadable' };

  const materials: LoadableMaterial[] = [];
  for (const [ticker, { store, stock }] of bestByTicker) {
    const mat = getMaterial(ticker);
    if (!mat) {
      sawUnknownMaterial = true;
      continue;
    }
    const maxUnits = Math.min(
      stock,
      Math.floor(freeWeight / mat.weight),
      Math.floor(freeVolume / mat.volume)
    );
    if (maxUnits <= 0) continue;
    materials.push({
      ticker,
      name: mat.name,
      sourceStoreId: store.id,
      sourceLabel: storeLabel(store),
      stock,
      maxUnits,
    });
  }
  if (materials.length === 0) {
    // Stock existed but nothing made the list: either reference data is
    // missing (can't compute fit) or nothing fits the remaining space.
    return { available: false, reason: sawUnknownMaterial ? 'no-reference-data' : 'hold-full' };
  }
  materials.sort((a, b) => a.ticker.localeCompare(b.ticker));
  return { available: true, materials, freeWeight, freeVolume };
}

/**
 * Act-time recheck of the user's picks against live data: every pick must
 * still source (refuse the whole run otherwise — no silent substitution),
 * amounts are re-capped to current stock (a clamp is visible in the returned
 * amounts), and the COMBINED weight+volume of the batch must fit the hold.
 */
export function validateLoadPicks(
  picks: LoadPick[],
  ship: PrunApi.Ship,
  allStores: PrunApi.Store[],
  getMaterial: (ticker: string) => MaterialInfo | undefined
): ValidatedLoad {
  const active = picks.filter((p) => p.amount > 0);
  if (active.length === 0) return { ok: false, reason: 'Nothing selected' };

  const list = listLoadableMaterials(ship, allStores, getMaterial);
  if (!list.available) return { ok: false, reason: 'Nothing loadable here any more' };

  let weight = 0;
  let volume = 0;
  const validated: { ticker: string; name: string; amount: number; sourceStoreId: string }[] = [];
  for (const pick of active) {
    const row = list.materials.find((m) => m.ticker === pick.ticker);
    const mat = getMaterial(pick.ticker);
    if (!row || !mat) return { ok: false, reason: `${pick.ticker} is no longer available here` };
    const amount = Math.min(pick.amount, row.stock);
    weight += amount * mat.weight;
    volume += amount * mat.volume;
    validated.push({ ticker: pick.ticker, name: row.name, amount, sourceStoreId: row.sourceStoreId });
  }
  if (weight > list.freeWeight || volume > list.freeVolume) {
    return { ok: false, reason: 'Selection exceeds the hold capacity' };
  }
  return { ok: true, picks: validated };
}
