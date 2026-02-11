import { createEntityStore, type EntityStore } from '../create-entity-store';
import type { PrunApi } from '../../types/prun-api';

export type FlightsStore = EntityStore<PrunApi.Flight>;

export const useFlightsStore = createEntityStore<PrunApi.Flight>(
  'flights',
  (flight) => flight.id,
  { key: 'apxm_cache_flights' }
);

/**
 * Get the active flight for a specific ship.
 * A ship can only have one active flight at a time.
 */
export function getFlightByShipId(shipId: string): PrunApi.Flight | undefined {
  return useFlightsStore
    .getState()
    .getAll()
    .find((flight) => flight.shipId === shipId);
}
