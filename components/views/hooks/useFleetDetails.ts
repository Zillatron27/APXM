import { useMemo } from 'react';
import { useShipsStore } from '../../../stores/entities/ships';
import { useFlightsStore, getFlightByShipId } from '../../../stores/entities/flights';
import { useStorageStore } from '../../../stores/entities/storage';
import { getDestinationName, formatEta, getCurrentLocation } from '../../../lib/fleet-utils';
import type { PrunApi } from '../../../types/prun-api';

export type FleetFilter = 'all' | 'idle' | 'in-transit';

export type FlightState = 'IDL' | 'ARR' | 'TRN' | 'DEP' | 'ORB';

export interface ShipDetail {
  id: string;
  name: string;
  registration: string;
  location: string;
  destination: string | null;
  state: FlightState;
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
 * Determines the flight state abbreviation for a ship.
 * IDL = Idle, ARR = Arriving (<2h), TRN = Transit, DEP = Departing, ORB = Orbiting
 */
function getFlightState(ship: PrunApi.Ship, flight: PrunApi.Flight | undefined): FlightState {
  if (!flight) return 'IDL';

  const now = Date.now();
  const etaMs = flight.arrival.timestamp - now;

  // Already arrived?
  if (etaMs <= 0) return 'IDL';

  // Within 2 hours of arrival
  const twoHoursMs = 2 * 60 * 60 * 1000;
  if (etaMs <= twoHoursMs) return 'ARR';

  // Check current segment for more specific state
  const segment = flight.segments[flight.currentSegmentIndex];
  if (segment) {
    switch (segment.type) {
      case 'TAKE_OFF':
      case 'DEPARTURE':
        return 'DEP';
      case 'APPROACH':
      case 'LANDING':
        return 'ARR';
      case 'FLOAT':
      case 'LOCK':
        return 'ORB';
      default:
        return 'TRN';
    }
  }

  return 'TRN';
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
export function useFleetDetails(filter: FleetFilter): FleetDetailsResult {
  const shipsLastUpdated = useShipsStore((s) => s.lastUpdated);
  const flightsLastUpdated = useFlightsStore((s) => s.lastUpdated);
  const storageLastUpdated = useStorageStore((s) => s.lastUpdated);

  return useMemo(() => {
    const ships = useShipsStore.getState().getAll();
    const stores = useStorageStore.getState().getAll();
    const now = Date.now();

    const details: ShipDetail[] = ships.map((ship) => {
      const flight = getFlightByShipId(ship.id);
      const state = getFlightState(ship, flight);

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
        state,
        etaMs: etaMs && etaMs > 0 ? etaMs : null,
        condition: ship.condition,
        cargo: cargoStore.weight,
        cargoVolume: cargoStore.volume,
        stlFuel: stlFuelStore.volume,
        ftlFuel: ftlFuelStore.volume,
      };
    });

    // Sort: idle first, then by ETA (soonest first)
    details.sort((a, b) => {
      const aIdle = a.state === 'IDL';
      const bIdle = b.state === 'IDL';
      if (aIdle && !bIdle) return -1;
      if (!aIdle && bIdle) return 1;

      const etaA = a.etaMs ?? Infinity;
      const etaB = b.etaMs ?? Infinity;
      return etaA - etaB;
    });

    // Count by filter category
    const counts: Record<FleetFilter, number> = {
      all: details.length,
      idle: details.filter((s) => s.state === 'IDL').length,
      'in-transit': details.filter((s) => s.state !== 'IDL').length,
    };

    // Apply filter
    const filtered =
      filter === 'all'
        ? details
        : filter === 'idle'
          ? details.filter((s) => s.state === 'IDL')
          : details.filter((s) => s.state !== 'IDL');

    return { ships: filtered, counts };
  }, [shipsLastUpdated, flightsLastUpdated, storageLastUpdated, filter]);
}
