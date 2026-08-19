import { useMemo } from 'react';
import { listOwnDestinations, type SendDestination } from '../../core/send-ship';
import { useShipsStore, useSitesStore } from '../../stores/entities';

/** Reactive own-destinations list for one ship (bases + CX stations, minus
 *  the current location). */
export function useOwnDestinations(shipId: string): SendDestination[] {
  const shipsUpdated = useShipsStore((s) => s.lastUpdated);
  const sitesUpdated = useSitesStore((s) => s.lastUpdated);

  return useMemo(() => {
    const ship = useShipsStore.getState().getById(shipId);
    if (!ship) return [];
    return listOwnDestinations(ship, useSitesStore.getState().getAll());
  }, [shipId, shipsUpdated, sitesUpdated]);
}
