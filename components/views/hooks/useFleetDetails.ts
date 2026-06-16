import { useMemo } from 'react';
import { useShipsStore } from '../../../stores/entities/ships';
import { useFlightsStore, getFlightByShipId } from '../../../stores/entities/flights';
import { useStorageStore } from '../../../stores/entities/storage';
import { getDestinationName, formatEta, getCurrentLocation } from '../../../lib/fleet-utils';
import { segmentStatus, STATIONARY, type ShipDisplayStatus } from '../../../lib/ship-status';
import { useTick } from '../../../lib/use-tick';
import type { PrunApi } from '../../../types/prun-api';

import type { FleetFilter } from '../../../stores/gameState';

export type { FleetFilter };
export type { ShipDisplayStatus };

export interface ShipDetail {
  id: string;
  name: string;
  registration: string;
  location: string;
  destination: string | null;
  /** Current flight phase (Helm/rPrun vocabulary), or STATIONARY when parked. */
  phase: ShipDisplayStatus;
  /** True when the ship is parked (no active flight) — drives idle filter/sort. */
  stationary: boolean;
  etaMs: number | null;
  condition: number;
  cargo: {
    current: number;
    max: number;
  };
  cargoVolume: {
    current: number;
    max: number;
  };
  stlFuel: {
    current: number;
    max: number;
  };
  ftlFuel: {
    current: number;
    max: number;
  };
}

/**
 * A ship's current flight phase, mirroring PrUn's FLT "Status" column: the live
 * segment phase while flying, STATIONARY when parked or already arrived.
 * `stationary` drives the idle filter/sort; `phase` is what we display.
 */
function getShipPhase(flight: PrunApi.Flight | undefined): {
  phase: ShipDisplayStatus;
  stationary: boolean;
} {
  if (!flight) return { phase: STATIONARY, stationary: true };

  // Arrival already passed — the ship is parked at its destination.
  if (flight.arrival.timestamp - Date.now() <= 0) {
    return { phase: STATIONARY, stationary: true };
  }

  const segment = flight.segments[flight.currentSegmentIndex];
  return { phase: segment ? segmentStatus(segment.type) : STATIONARY, stationary: false };
}

interface StoreLoad {
  weight: { current: number; max: number };
  volume: { current: number; max: number };
}

/**
 * Gets cargo/fuel amounts from a store.
 */
function getStoreLoad(storeId: string, stores: PrunApi.Store[]): StoreLoad {
  const store = stores.find((s) => s.id === storeId);
  if (!store) {
    return {
      weight: { current: 0, max: 0 },
      volume: { current: 0, max: 0 },
    };
  }

  return {
    weight: { current: store.weightLoad, max: store.weightCapacity },
    volume: { current: store.volumeLoad, max: store.volumeCapacity },
  };
}

export interface FleetDetailsResult {
  ships: ShipDetail[];
  counts: Record<FleetFilter, number>;
}

/**
 * Hook that assembles ship details with cargo, fuel, and flight info.
 */
export function useFleetDetails(activeFilters: ReadonlySet<FleetFilter>): FleetDetailsResult {
  const shipsLastUpdated = useShipsStore((s) => s.lastUpdated);
  const flightsLastUpdated = useFlightsStore((s) => s.lastUpdated);
  const storageLastUpdated = useStorageStore((s) => s.lastUpdated);
  // Tick every minute to update ETAs
  const tick = useTick(60000);

  return useMemo(() => {
    const ships = useShipsStore.getState().getAll();
    const stores = useStorageStore.getState().getAll();
    const now = Date.now();

    const details: ShipDetail[] = ships.map((ship) => {
      const flight = getFlightByShipId(ship.id);
      const { phase, stationary } = getShipPhase(flight);

      const destination = flight ? getDestinationName(flight.destination) : null;
      const etaMs = flight ? flight.arrival.timestamp - now : null;

      const cargoStore = getStoreLoad(ship.idShipStore, stores);
      const stlFuelStore = getStoreLoad(ship.idStlFuelStore, stores);
      const ftlFuelStore = getStoreLoad(ship.idFtlFuelStore, stores);

      return {
        id: ship.id,
        name: ship.name || ship.registration,
        registration: ship.registration,
        location: flight ? getDestinationName(flight.origin) : getCurrentLocation(ship),
        destination,
        phase,
        stationary,
        etaMs: etaMs && etaMs > 0 ? etaMs : null,
        condition: ship.condition,
        cargo: cargoStore.weight,
        cargoVolume: cargoStore.volume,
        stlFuel: stlFuelStore.volume,
        ftlFuel: ftlFuelStore.volume,
      };
    });

    // Sort: stationary (idle) first, then by ETA (soonest first)
    details.sort((a, b) => {
      if (a.stationary && !b.stationary) return -1;
      if (!a.stationary && b.stationary) return 1;

      const etaA = a.etaMs ?? Infinity;
      const etaB = b.etaMs ?? Infinity;
      return etaA - etaB;
    });

    // Count by filter category
    const counts: Record<FleetFilter, number> = {
      all: details.length,
      idle: details.filter((s) => s.stationary).length,
      'in-transit': details.filter((s) => !s.stationary).length,
    };

    // Apply filter
    const filtered = activeFilters.has('all')
      ? details
      : details.filter((s) => {
          const category: FleetFilter = s.stationary ? 'idle' : 'in-transit';
          return activeFilters.has(category);
        });

    return { ships: filtered, counts };
  }, [shipsLastUpdated, flightsLastUpdated, storageLastUpdated, activeFilters, tick]);
}
