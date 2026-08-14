import { useMemo } from 'react';
import { planRefuel, FUEL_TICKER, type FuelTank, type RefuelPlan } from '../../core/refuel';
import { useShipsStore, useStorageStore } from '../../stores/entities';
import { useMaterialsStore } from '../../stores/reference';
import type { PrunApi } from '../../types/prun-api';

export interface RefuelPlanView {
  plan: RefuelPlan;
  ticker: string;
  /** Short source description for the pre-tap preview ("warehouse", "base
   *  storage", or the store's own name). The location needs no naming — it's
   *  the ship's own location. */
  sourceLabel: string | null;
}

function labelFor(store: PrunApi.Store): string {
  if (store.name) return store.name;
  return store.type === 'WAREHOUSE_STORE' ? 'warehouse' : 'base storage';
}

/** Reactive refuel plan for one ship + tank (mirrors useSiteRepairBuildings:
 *  thin store subscription around the pure core/refuel planner). */
export function useRefuelPlan(shipId: string, tank: FuelTank): RefuelPlanView {
  const shipsUpdated = useShipsStore((s) => s.lastUpdated);
  const storageUpdated = useStorageStore((s) => s.lastUpdated);
  const materialsUpdated = useMaterialsStore((s) => s.lastUpdated);

  return useMemo(() => {
    const ticker = FUEL_TICKER[tank];
    const ship = useShipsStore.getState().getById(shipId);
    if (!ship) {
      return { plan: { available: false, reason: 'no-tank' } as RefuelPlan, ticker, sourceLabel: null };
    }
    const plan = planRefuel(
      ship,
      useStorageStore.getState().getAll(),
      useMaterialsStore.getState().getById(ticker),
      tank
    );
    return {
      plan,
      ticker,
      sourceLabel: plan.available ? labelFor(plan.sourceStore) : null,
    };
  }, [shipId, tank, shipsUpdated, storageUpdated, materialsUpdated]);
}
