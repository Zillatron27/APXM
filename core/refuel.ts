// Refuel planning: which store at the ship's location supplies the fuel, and
// how many units fill the tank. Pure decision logic — the transfer itself is
// driven by lib/ship-actions.ts + lib/act/transfer-modal.ts.
//
// Known gap (accepted): location matching via atSameLocation compares only
// PLANET/STATION address lines, so a deep-space (system-only) warehouse never
// matches — refuel is unavailable there.

import type { PrunApi } from '../types/prun-api';
import { atSameLocation } from '../lib/act/actions/utils';
import type { MaterialInfo } from '../stores/reference';

export type FuelTank = 'stl' | 'ftl';

export const FUEL_TICKER: Record<FuelTank, string> = { stl: 'SF', ftl: 'FF' };

export type RefuelPlan =
  | {
      available: true;
      sourceStore: PrunApi.Store;
      /** Units that fill the tank, capped by what the source holds. */
      units: number;
      /** Units the source holds (for the UI preview). */
      sourceStock: number;
    }
  | { available: false; reason: 'tank-full' | 'no-fuel-here' | 'no-reference-data' | 'no-tank' };

/** Units of a ticker held as loadable INVENTORY (SHIPMENT items are contract
 *  goods, not free stock). Shared with core/load-cargo.ts. */
export function stockOf(store: PrunApi.Store, ticker: string): number {
  return store.items.reduce(
    (sum, item) =>
      sum +
      (item.type === 'INVENTORY' && item.quantity?.material.ticker === ticker
        ? item.quantity.amount
        : 0),
    0
  );
}

/**
 * Picks the refuel source and amount for one tank. Candidates are stores at
 * the same location as the tank holding the fuel, excluding the ship's own
 * stores; the largest stock wins (user ruling 2026-08-14 — fuel lives in one
 * place in practice, and the chosen source is named in the UI before the tap).
 */
export function planRefuel(
  ship: PrunApi.Ship,
  allStores: PrunApi.Store[],
  material: MaterialInfo | undefined,
  tank: FuelTank
): RefuelPlan {
  if (!material) return { available: false, reason: 'no-reference-data' };

  const tankStoreId = tank === 'stl' ? ship.idStlFuelStore : ship.idFtlFuelStore;
  const tankStore = allStores.find((s) => s.id === tankStoreId);
  if (!tankStore) return { available: false, reason: 'no-tank' };

  const ticker = FUEL_TICKER[tank];
  const deficitUnits = Math.floor(
    (tankStore.volumeCapacity - tankStore.volumeLoad) / material.volume
  );
  if (deficitUnits <= 0) return { available: false, reason: 'tank-full' };

  const ownStoreIds = new Set([ship.idShipStore, ship.idStlFuelStore, ship.idFtlFuelStore]);
  const candidates = allStores.filter(
    (s) => !ownStoreIds.has(s.id) && stockOf(s, ticker) > 0 && atSameLocation(s, tankStore)
  );
  if (candidates.length === 0) return { available: false, reason: 'no-fuel-here' };

  const sourceStore = candidates.reduce((best, s) =>
    stockOf(s, ticker) > stockOf(best, ticker) ? s : best
  );
  const sourceStock = stockOf(sourceStore, ticker);

  return {
    available: true,
    sourceStore,
    units: Math.min(deficitUnits, sourceStock),
    sourceStock,
  };
}
