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
