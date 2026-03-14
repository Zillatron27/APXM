/**
 * Store Subscriptions
 *
 * After handshake, subscribes to all entity stores and dispatches
 * apxm-init (full snapshot) and apxm-update (incremental) messages
 * to the shell page via postMessage.
 */

import type { BridgeEntityType, ApxmInitMessage, ApxmUpdateMessage } from '../../types/bridge';
import {
  createSnapshot,
  deriveSiteSummaries,
  deriveShipSummaries,
  deriveFlightSummaries,
  deriveStorageSummaries,
  deriveProductionSummaries,
  deriveWorkforceSummaries,
  deriveContractSummaries,
  deriveBalances,
  deriveScreens,
  deriveBurnThresholds,
  deriveWarehouses,
} from './store-serializer';
import { useSitesStore } from '../../stores/entities/sites';
import { useShipsStore } from '../../stores/entities/ships';
import { useFlightsStore } from '../../stores/entities/flights';
import { useStorageStore } from '../../stores/entities/storage';
import { useProductionStore } from '../../stores/entities/production';
import { useWorkforceStore } from '../../stores/entities/workforce';
import { useContractsStore } from '../../stores/entities/contracts';
import { useBalancesStore } from '../../stores/entities/balances';
import { useScreensStore } from '../../stores/screens';
import { useConnectionStore } from '../../stores/connection';
import { useSettingsStore } from '../../stores/settings';
import { useCompanyStore } from '../../stores/company';
import { useWarehouseStore } from '../../stores/warehouses';

type PostFn = (message: ApxmInitMessage | ApxmUpdateMessage) => void;

const DEBOUNCE_MS = 200;

interface StoreBinding {
  entityType: BridgeEntityType;
  store: { subscribe: (listener: () => void) => () => void };
  derive: () => unknown[];
}

const STORE_BINDINGS: StoreBinding[] = [
  { entityType: 'sites', store: useSitesStore, derive: deriveSiteSummaries },
  { entityType: 'ships', store: useShipsStore, derive: deriveShipSummaries },
  { entityType: 'flights', store: useFlightsStore, derive: deriveFlightSummaries },
  { entityType: 'storage', store: useStorageStore, derive: deriveStorageSummaries },
  { entityType: 'production', store: useProductionStore, derive: deriveProductionSummaries },
  { entityType: 'workforce', store: useWorkforceStore, derive: deriveWorkforceSummaries },
  { entityType: 'contracts', store: useContractsStore, derive: deriveContractSummaries },
  { entityType: 'balances', store: useBalancesStore, derive: deriveBalances },
  { entityType: 'screens', store: useScreensStore, derive: deriveScreens },
  { entityType: 'warehouses', store: useWarehouseStore, derive: deriveWarehouses },
];

/**
 * Sends initial snapshot then subscribes to all entity stores.
 * Returns a cleanup function that unsubscribes all listeners and clears timers.
 */
export function subscribeToStores(post: PostFn): () => void {
  // Send full snapshot immediately
  const snapshot = createSnapshot();
  post({ type: 'apxm-init', snapshot });
  console.log('[APXM Bridge] Sent apxm-init with', {
    sites: snapshot.sites.length,
    ships: snapshot.ships.length,
    flights: snapshot.flights.length,
    storage: snapshot.storage.length,
    production: snapshot.production.length,
    workforce: snapshot.workforce.length,
    contracts: snapshot.contracts.length,
    screens: snapshot.screens.length,
    balances: snapshot.balances.length,
  });

  const unsubscribers: Array<() => void> = [];
  const timers: Array<ReturnType<typeof setTimeout>> = [];

  // Per-store debounced subscription
  for (const binding of STORE_BINDINGS) {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const unsub = binding.store.subscribe(() => {
      if (timer !== null) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => {
        timer = null;
        const data = binding.derive();
        post({
          type: 'apxm-update',
          update: {
            entityType: binding.entityType,
            data: data as ApxmUpdateMessage['update']['data'],
            timestamp: Date.now(),
          },
        });
        // Ship cargo/fuel comes from storage — cross-trigger ships update
        if (binding.entityType === 'storage') {
          post({
            type: 'apxm-update',
            update: {
              entityType: 'ships',
              data: deriveShipSummaries() as ApxmUpdateMessage['update']['data'],
              timestamp: Date.now(),
            },
          });
        }
      }, DEBOUNCE_MS);
    });

    unsubscribers.push(unsub);
    // Track timer for cleanup — store ref so we can clear on teardown
    unsubscribers.push(() => {
      if (timer !== null) clearTimeout(timer);
    });
  }

  // Watch for settings changes (e.g. burn thresholds changed on mobile UI)
  {
    let settingsTimer: ReturnType<typeof setTimeout> | null = null;
    const unsubSettings = useSettingsStore.subscribe(() => {
      if (settingsTimer !== null) clearTimeout(settingsTimer);
      settingsTimer = setTimeout(() => {
        settingsTimer = null;
        const freshSnapshot = createSnapshot();
        post({ type: 'apxm-init', snapshot: freshSnapshot });
        console.log('[APXM Bridge] Sent apxm-init after settings change');
      }, DEBOUNCE_MS);
    });
    unsubscribers.push(unsubSettings);
    unsubscribers.push(() => {
      if (settingsTimer !== null) clearTimeout(settingsTimer);
    });
  }

  // Watch for company data (arrives once on login, triggers snapshot re-send)
  {
    let companyTimer: ReturnType<typeof setTimeout> | null = null;
    const unsubCompany = useCompanyStore.subscribe(() => {
      if (companyTimer !== null) clearTimeout(companyTimer);
      companyTimer = setTimeout(() => {
        companyTimer = null;
        const freshSnapshot = createSnapshot();
        post({ type: 'apxm-init', snapshot: freshSnapshot });
        console.log('[APXM Bridge] Sent apxm-init after company data');
      }, DEBOUNCE_MS);
    });
    unsubscribers.push(unsubCompany);
    unsubscribers.push(() => {
      if (companyTimer !== null) clearTimeout(companyTimer);
    });
  }

  // Watch for reconnect — re-send full snapshot when stores repopulate
  let lastReconnectCount = useConnectionStore.getState().reconnectCount;
  const unsubConnection = useConnectionStore.subscribe((state) => {
    if (state.reconnectCount > lastReconnectCount) {
      lastReconnectCount = state.reconnectCount;
      // Delay to let stores repopulate after reconnect clear
      const reconnectTimer = setTimeout(() => {
        const freshSnapshot = createSnapshot();
        post({ type: 'apxm-init', snapshot: freshSnapshot });
        console.log('[APXM Bridge] Sent apxm-init after reconnect');
      }, 2000);
      timers.push(reconnectTimer);
    }
  });
  unsubscribers.push(unsubConnection);

  return () => {
    for (const unsub of unsubscribers) unsub();
    for (const t of timers) clearTimeout(t);
  };
}
