// Entity stores - re-exports for convenient importing

import { useSitesStore } from './sites';
import { useStorageStore } from './storage';
import { useWorkforceStore } from './workforce';
import { useProductionStore } from './production';
import { useShipsStore } from './ships';
import { useFlightsStore } from './flights';
import { useContractsStore } from './contracts';

export { useSitesStore, type SitesStore } from './sites';

export {
  useStorageStore,
  getStorageByAddressableId,
  type StorageStore,
} from './storage';

export {
  useWorkforceStore,
  getWorkforceBySiteId,
  type WorkforceEntity,
  type WorkforceStore,
} from './workforce';

export {
  useProductionStore,
  getProductionBySiteId,
  type ProductionStore,
} from './production';

export { useShipsStore, type ShipsStore } from './ships';

export {
  useFlightsStore,
  getFlightByShipId,
  type FlightsStore,
} from './flights';

export { useContractsStore, type ContractsStore } from './contracts';

// Utility to clear all entity stores (used on reconnect)
export function clearAllEntityStores(): void {
  useSitesStore.getState().clear();
  useStorageStore.getState().clear();
  useWorkforceStore.getState().clear();
  useProductionStore.getState().clear();
  useShipsStore.getState().clear();
  useFlightsStore.getState().clear();
  useContractsStore.getState().clear();
}

// Batch mode — suppresses Zustand listener notifications during bulk
// message processing. Mutations accumulate in shadow state; one set()
// per store at endEntityBatch() prevents React error #185.
const allStores = [
  useSitesStore, useStorageStore, useWorkforceStore,
  useProductionStore, useShipsStore, useFlightsStore, useContractsStore,
];

export function beginEntityBatch(): void {
  for (const store of allStores) store.beginBatch();
}

export function endEntityBatch(): void {
  for (const store of allStores) store.endBatch();
}
