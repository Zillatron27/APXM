import { useMemo } from 'react';
import { useShipsStore, useStorageStore } from '../../stores/entities';

export interface HoldItem {
  ticker: string;
  amount: number;
}

/**
 * What's physically in the ship's cargo hold, aggregated by ticker and sorted
 * largest-first. Includes SHIPMENT (contract) items — they occupy the hold
 * even though they aren't free stock — unlike the loadable/stock maths which
 * filters to INVENTORY.
 */
export function useHoldContents(shipId: string): HoldItem[] {
  const shipsUpdated = useShipsStore((s) => s.lastUpdated);
  const storageUpdated = useStorageStore((s) => s.lastUpdated);

  return useMemo(() => {
    const ship = useShipsStore.getState().getById(shipId);
    if (!ship) return [];
    const hold = useStorageStore.getState().getById(ship.idShipStore);
    if (!hold) return [];

    const byTicker = new Map<string, number>();
    for (const item of hold.items) {
      const q = item.quantity;
      if (!q) continue;
      byTicker.set(q.material.ticker, (byTicker.get(q.material.ticker) ?? 0) + q.amount);
    }
    return [...byTicker.entries()]
      .map(([ticker, amount]) => ({ ticker, amount }))
      .sort((a, b) => b.amount - a.amount);
    // lastUpdated timestamps are the reactivity keys, not inputs
  }, [shipId, shipsUpdated, storageUpdated]);
}
