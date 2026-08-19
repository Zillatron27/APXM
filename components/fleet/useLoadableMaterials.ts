import { useMemo } from 'react';
import { listLoadableMaterials, type LoadableList } from '../../core/load-cargo';
import { useShipsStore, useStorageStore } from '../../stores/entities';
import { useMaterialsStore } from '../../stores/reference';

/** Reactive loadable-materials list for one ship (thin store subscription
 *  around the pure core/load-cargo lister, like useRefuelPlan). */
export function useLoadableMaterials(shipId: string): LoadableList {
  const shipsUpdated = useShipsStore((s) => s.lastUpdated);
  const storageUpdated = useStorageStore((s) => s.lastUpdated);
  const materialsUpdated = useMaterialsStore((s) => s.lastUpdated);

  return useMemo(() => {
    const ship = useShipsStore.getState().getById(shipId);
    if (!ship) return { available: false, reason: 'no-hold' } as LoadableList;
    return listLoadableMaterials(ship, useStorageStore.getState().getAll(), (ticker) =>
      useMaterialsStore.getState().getById(ticker)
    );
  }, [shipId, shipsUpdated, storageUpdated, materialsUpdated]);
}

/** User-facing copy for each unavailable reason, shared by the ship sheet and the picker. */
export const LOADABLE_REASON_TEXT: Record<string, string> = {
  'no-hold': 'Hold data unavailable',
  'hold-full': 'Hold is full',
  'nothing-loadable': 'Nothing loadable at this location',
  'no-reference-data': 'Material data loading',
};
