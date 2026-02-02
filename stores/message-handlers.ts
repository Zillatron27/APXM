import { onMessageType } from '../lib/message-bus/content-bridge';
import type { ProcessedMessage } from '../lib/socket-io/types';
import type { PrunApi } from '../types/prun-api';
import { useConnectionStore } from './connection';
import {
  useSitesStore,
  useStorageStore,
  useWorkforceStore,
  useProductionStore,
  useShipsStore,
  useFlightsStore,
  useContractsStore,
  clearAllEntityStores,
  type WorkforceEntity,
} from './entities';

/**
 * Extract the actual payload from a message.
 * The wire format wraps data as { messageType, payload } so we need to unwrap it.
 */
function extractPayload(msg: ProcessedMessage): unknown {
  const outer = msg.payload as { payload?: unknown };
  // If payload has a nested payload property, use that (wire format)
  // Otherwise use the payload directly (for backwards compatibility)
  return outer?.payload !== undefined ? outer.payload : msg.payload;
}

/**
 * Process an inner message extracted from ACTION_COMPLETED.
 * Routes the message to the appropriate entity store.
 */
function processInnerMessage(messageType: string, payload: unknown): void {
  const data = payload as Record<string, unknown>;

  switch (messageType) {
    // Sites
    case 'SITE_SITES': {
      const sites = data?.sites as PrunApi.Site[] | undefined;
      if (Array.isArray(sites)) {
        useSitesStore.getState().setAll(sites);
        useSitesStore.getState().setFetched('websocket');
      }
      break;
    }

    // Storage
    case 'STORAGE_STORAGES': {
      const stores = data?.stores as PrunApi.Store[] | undefined;
      if (Array.isArray(stores)) {
        useStorageStore.getState().setMany(stores);
        useStorageStore.getState().setFetched('websocket');
      }
      break;
    }

    // Warehouse storage (separate from regular storage)
    case 'WAREHOUSE_STORAGES': {
      const storages = data?.storages as PrunApi.Store[] | undefined;
      if (Array.isArray(storages)) {
        useStorageStore.getState().setMany(storages);
      }
      break;
    }

    // Workforce
    case 'WORKFORCE_WORKFORCES': {
      const wfData = data as unknown as WorkforceEntity | undefined;
      if (wfData?.siteId) {
        useWorkforceStore.getState().setOne(wfData);
        useWorkforceStore.getState().setFetched('websocket');
      }
      break;
    }

    // Production
    case 'PRODUCTION_SITE_PRODUCTION_LINES': {
      const lines = data?.productionLines as PrunApi.ProductionLine[] | undefined;
      if (Array.isArray(lines)) {
        useProductionStore.getState().setMany(lines);
        useProductionStore.getState().setFetched('websocket');
      }
      break;
    }

    // Ships
    case 'SHIP_SHIPS': {
      const ships = data?.ships as PrunApi.Ship[] | undefined;
      if (Array.isArray(ships)) {
        useShipsStore.getState().setAll(ships);
        useShipsStore.getState().setFetched('websocket');
      }
      break;
    }

    // Flights
    case 'SHIP_FLIGHT_FLIGHTS': {
      const flights = data?.flights as PrunApi.Flight[] | undefined;
      if (Array.isArray(flights)) {
        useFlightsStore.getState().setAll(flights);
        useFlightsStore.getState().setFetched('websocket');
      }
      break;
    }

    // Contracts
    case 'CONTRACTS_CONTRACTS': {
      const contracts = data?.contracts as PrunApi.Contract[] | undefined;
      if (Array.isArray(contracts)) {
        useContractsStore.getState().setAll(contracts);
        useContractsStore.getState().setFetched('websocket');
      }
      break;
    }
  }
}

/**
 * Initialize all message handlers for populating entity stores.
 * Call this once after initMessageBridge() in the content script.
 *
 * Returns an array of unsubscribe functions for cleanup.
 */
export function initMessageHandlers(): (() => void)[] {
  const unsubscribers: (() => void)[] = [];

  // ACTION_COMPLETED wraps bulk data in { actionId, status, message }
  // The 'message' field contains the actual game data
  unsubscribers.push(
    onMessageType('ACTION_COMPLETED', (msg: ProcessedMessage) => {
      const payload = extractPayload(msg) as {
        actionId?: string;
        status?: string;
        message?: { messageType?: string; payload?: unknown }
      };

      const inner = payload?.message;
      if (inner?.messageType) {
        // Process the inner message - route to appropriate handlers
        processInnerMessage(inner.messageType, inner.payload);
      }
    })
  );

  // ============================================================================
  // Connection Events
  // ============================================================================

  // On reconnect: clear all stores to prevent stale data
  unsubscribers.push(
    onMessageType('CLIENT_CONNECTION_OPENED', () => {
      clearAllEntityStores();
      useConnectionStore.getState().incrementReconnectCount();
      useConnectionStore.getState().setConnected(true);
    })
  );

  // ============================================================================
  // Sites
  // ============================================================================

  unsubscribers.push(
    onMessageType('SITE_SITES', (msg: ProcessedMessage) => {
      const payload = extractPayload(msg) as { sites?: PrunApi.Site[] };
      if (Array.isArray(payload?.sites)) {
        useSitesStore.getState().setAll(payload.sites);
        useSitesStore.getState().setFetched('websocket');
      } else {
        console.warn('[APXM] SITE_SITES: unexpected payload structure', payload);
      }
    })
  );

  // Single site update (e.g., after building)
  unsubscribers.push(
    onMessageType('SITE_SITE', (msg: ProcessedMessage) => {
      const site = extractPayload(msg) as PrunApi.Site;
      if (site?.siteId) {
        useSitesStore.getState().setOne(site);
      }
    })
  );

  // Platform updates (construction, demolition)
  unsubscribers.push(
    onMessageType('SITE_PLATFORM_BUILT', (msg: ProcessedMessage) => {
      const { siteId, platform } = extractPayload(msg) as {
        siteId: string;
        platform: PrunApi.Platform;
      };
      const site = useSitesStore.getState().getById(siteId);
      if (site) {
        useSitesStore.getState().setOne({
          ...site,
          platforms: [...site.platforms, platform],
        });
      }
    })
  );

  // ============================================================================
  // Storage
  // ============================================================================

  unsubscribers.push(
    onMessageType('STORAGE_STORAGES', (msg: ProcessedMessage) => {
      const payload = extractPayload(msg) as { stores?: PrunApi.Store[] };
      if (Array.isArray(payload?.stores)) {
        useStorageStore.getState().setMany(payload.stores);
        useStorageStore.getState().setFetched('websocket');
      } else {
        console.warn('[APXM] STORAGE_STORAGES: unexpected payload structure', payload);
      }
    })
  );

  unsubscribers.push(
    onMessageType('STORAGE_CHANGE', (msg: ProcessedMessage) => {
      const payload = extractPayload(msg) as { stores?: PrunApi.Store[] };
      if (Array.isArray(payload?.stores)) {
        useStorageStore.getState().setMany(payload.stores);
      }
    })
  );

  unsubscribers.push(
    onMessageType('STORAGE_REMOVED', (msg: ProcessedMessage) => {
      const payload = extractPayload(msg) as { storeIds?: string[] };
      if (Array.isArray(payload?.storeIds)) {
        const store = useStorageStore.getState();
        for (const id of payload.storeIds) {
          store.removeOne(id);
        }
      }
    })
  );

  // ============================================================================
  // Workforce
  // ============================================================================

  // Workforce arrives per-site, not as a bulk array
  unsubscribers.push(
    onMessageType('WORKFORCE_WORKFORCES', (msg: ProcessedMessage) => {
      const data = extractPayload(msg) as WorkforceEntity;
      if (data?.siteId) {
        useWorkforceStore.getState().setOne(data);
        useWorkforceStore.getState().setFetched('websocket');
      } else {
        console.warn('[APXM] WORKFORCE_WORKFORCES: unexpected payload structure', data);
      }
    })
  );

  unsubscribers.push(
    onMessageType('WORKFORCE_WORKFORCES_UPDATED', (msg: ProcessedMessage) => {
      const data = extractPayload(msg) as WorkforceEntity;
      if (data?.siteId) {
        useWorkforceStore.getState().setOne(data);
      }
    })
  );

  // ============================================================================
  // Production
  // ============================================================================

  unsubscribers.push(
    onMessageType('PRODUCTION_SITE_PRODUCTION_LINES', (msg: ProcessedMessage) => {
      const payload = extractPayload(msg) as { productionLines?: PrunApi.ProductionLine[] };
      if (Array.isArray(payload?.productionLines)) {
        useProductionStore.getState().setMany(payload.productionLines);
        useProductionStore.getState().setFetched('websocket');
      } else {
        console.warn('[APXM] PRODUCTION_SITE_PRODUCTION_LINES: unexpected payload structure', payload);
      }
    })
  );

  unsubscribers.push(
    onMessageType('PRODUCTION_PRODUCTION_LINE', (msg: ProcessedMessage) => {
      const productionLine = extractPayload(msg) as PrunApi.ProductionLine;
      if (productionLine?.id) {
        useProductionStore.getState().setOne(productionLine);
      }
    })
  );

  unsubscribers.push(
    onMessageType('PRODUCTION_PRODUCTION_LINE_UPDATED', (msg: ProcessedMessage) => {
      const productionLine = extractPayload(msg) as PrunApi.ProductionLine;
      if (productionLine?.id) {
        useProductionStore.getState().setOne(productionLine);
      }
    })
  );

  unsubscribers.push(
    onMessageType('PRODUCTION_ORDER_ADDED', (msg: ProcessedMessage) => {
      const { productionLineId, order } = extractPayload(msg) as {
        productionLineId: string;
        order: PrunApi.ProductionOrder;
      };
      const line = useProductionStore.getState().getById(productionLineId);
      if (line) {
        useProductionStore.getState().setOne({
          ...line,
          orders: [...line.orders, order],
        });
      }
    })
  );

  unsubscribers.push(
    onMessageType('PRODUCTION_ORDER_REMOVED', (msg: ProcessedMessage) => {
      const { productionLineId, orderId } = extractPayload(msg) as {
        productionLineId: string;
        orderId: string;
      };
      const line = useProductionStore.getState().getById(productionLineId);
      if (line) {
        useProductionStore.getState().setOne({
          ...line,
          orders: line.orders.filter((o) => o.id !== orderId),
        });
      }
    })
  );

  unsubscribers.push(
    onMessageType('PRODUCTION_ORDER_UPDATED', (msg: ProcessedMessage) => {
      const { productionLineId, order } = extractPayload(msg) as {
        productionLineId: string;
        order: PrunApi.ProductionOrder;
      };
      const line = useProductionStore.getState().getById(productionLineId);
      if (line) {
        useProductionStore.getState().setOne({
          ...line,
          orders: line.orders.map((o) => (o.id === order.id ? order : o)),
        });
      }
    })
  );

  // ============================================================================
  // Ships
  // ============================================================================

  unsubscribers.push(
    onMessageType('SHIP_SHIPS', (msg: ProcessedMessage) => {
      const payload = extractPayload(msg) as { ships?: PrunApi.Ship[] };
      if (Array.isArray(payload?.ships)) {
        useShipsStore.getState().setAll(payload.ships);
        useShipsStore.getState().setFetched('websocket');
      } else {
        console.warn('[APXM] SHIP_SHIPS: unexpected payload structure', payload);
      }
    })
  );

  unsubscribers.push(
    onMessageType('SHIP_DATA', (msg: ProcessedMessage) => {
      const ship = extractPayload(msg) as PrunApi.Ship;
      if (ship?.id) {
        useShipsStore.getState().setOne(ship);
      }
    })
  );

  // ============================================================================
  // Flights
  // ============================================================================

  unsubscribers.push(
    onMessageType('SHIP_FLIGHT_FLIGHTS', (msg: ProcessedMessage) => {
      const payload = extractPayload(msg) as { flights?: PrunApi.Flight[] };
      if (Array.isArray(payload?.flights)) {
        useFlightsStore.getState().setAll(payload.flights);
        useFlightsStore.getState().setFetched('websocket');
      } else {
        console.warn('[APXM] SHIP_FLIGHT_FLIGHTS: unexpected payload structure', payload);
      }
    })
  );

  unsubscribers.push(
    onMessageType('SHIP_FLIGHT_STARTED', (msg: ProcessedMessage) => {
      const flight = extractPayload(msg) as PrunApi.Flight;
      if (flight?.id) {
        useFlightsStore.getState().setOne(flight);
      }
    })
  );

  unsubscribers.push(
    onMessageType('SHIP_FLIGHT_ENDED', (msg: ProcessedMessage) => {
      const { flightId } = extractPayload(msg) as { flightId: string };
      if (flightId) {
        useFlightsStore.getState().removeOne(flightId);
      }
    })
  );

  unsubscribers.push(
    onMessageType('SHIP_FLIGHT_SEGMENT', (msg: ProcessedMessage) => {
      const { flightId, currentSegmentIndex } = extractPayload(msg) as {
        flightId: string;
        currentSegmentIndex: number;
      };
      const flight = useFlightsStore.getState().getById(flightId);
      if (flight) {
        useFlightsStore.getState().setOne({
          ...flight,
          currentSegmentIndex,
        });
      }
    })
  );

  // ============================================================================
  // Contracts
  // ============================================================================

  unsubscribers.push(
    onMessageType('CONTRACTS_CONTRACTS', (msg: ProcessedMessage) => {
      const payload = extractPayload(msg) as { contracts?: PrunApi.Contract[] };
      if (Array.isArray(payload?.contracts)) {
        useContractsStore.getState().setAll(payload.contracts);
        useContractsStore.getState().setFetched('websocket');
      } else {
        console.warn('[APXM] CONTRACTS_CONTRACTS: unexpected payload structure', payload);
      }
    })
  );

  unsubscribers.push(
    onMessageType('CONTRACTS_CONTRACT', (msg: ProcessedMessage) => {
      const contract = extractPayload(msg) as PrunApi.Contract;
      if (contract?.id) {
        useContractsStore.getState().setOne(contract);
      }
    })
  );

  return unsubscribers;
}
