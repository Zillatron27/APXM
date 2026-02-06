import { onMessageType, dispatchToTypeHandlers } from '@prun/link/message-bus/content-bridge';
import type { ProcessedMessage } from '@prun/link';
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
 * Initialize all message handlers for populating entity stores.
 * Call this once after initMessageBridge() in the content script.
 *
 * Returns an array of unsubscribe functions for cleanup.
 */
export function initMessageHandlers(): (() => void)[] {
  const unsubscribers: (() => void)[] = [];

  // ACTION_COMPLETED wraps game data in { actionId, status, message }.
  // The inner message can be ANY type (SITE_SITES, STORAGE_CHANGE, etc.).
  // Instead of duplicating handler logic, dispatch the inner message through
  // the same type handler registry so all handlers work uniformly regardless
  // of whether the message arrives as a top-level event or inside ACTION_COMPLETED.
  unsubscribers.push(
    onMessageType('ACTION_COMPLETED', (msg: ProcessedMessage) => {
      const payload = extractPayload(msg) as {
        actionId?: string;
        status?: string;
        message?: { messageType?: string; payload?: unknown }
      };

      const inner = payload?.message;
      if (inner?.messageType) {
        // Create a synthetic ProcessedMessage matching the wire format the
        // type handlers expect: { messageType, payload: { messageType, payload: data } }
        const syntheticMsg: ProcessedMessage = {
          messageType: inner.messageType,
          payload: inner,
          timestamp: msg.timestamp,
          direction: msg.direction,
          rawSize: msg.rawSize,
        };
        dispatchToTypeHandlers(syntheticMsg);
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
      } else {
        console.warn('[APXM] SITE_SITE: unexpected payload structure', site);
        useConnectionStore.getState().incrementDiscarded();
      }
    })
  );

  // Platform updates (construction, demolition)
  unsubscribers.push(
    onMessageType('SITE_PLATFORM_BUILT', (msg: ProcessedMessage) => {
      const payload = extractPayload(msg) as {
        siteId?: string;
        platform?: PrunApi.Platform;
      };
      const { siteId, platform } = payload;
      if (siteId && platform) {
        const site = useSitesStore.getState().getById(siteId);
        if (site) {
          useSitesStore.getState().setOne({
            ...site,
            platforms: [...site.platforms, platform],
          });
        }
      } else {
        console.warn('[APXM] SITE_PLATFORM_BUILT: unexpected payload structure', payload);
        useConnectionStore.getState().incrementDiscarded();
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
      } else {
        console.warn('[APXM] STORAGE_CHANGE: unexpected payload structure', payload);
        useConnectionStore.getState().incrementDiscarded();
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
      } else {
        console.warn('[APXM] STORAGE_REMOVED: unexpected payload structure', payload);
        useConnectionStore.getState().incrementDiscarded();
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
      } else {
        console.warn('[APXM] WORKFORCE_WORKFORCES_UPDATED: unexpected payload structure', data);
        useConnectionStore.getState().incrementDiscarded();
      }
    })
  );

  // ============================================================================
  // Production
  // ============================================================================

  unsubscribers.push(
    onMessageType('PRODUCTION_PRODUCTION_LINES', (msg: ProcessedMessage) => {
      const payload = extractPayload(msg) as { productionLines?: PrunApi.ProductionLine[] };
      if (Array.isArray(payload?.productionLines)) {
        useProductionStore.getState().setAll(payload.productionLines);
        useProductionStore.getState().setFetched('websocket');
      } else {
        console.warn('[APXM] PRODUCTION_PRODUCTION_LINES: unexpected payload structure', payload);
      }
    })
  );

  unsubscribers.push(
    onMessageType('PRODUCTION_SITE_PRODUCTION_LINES', (msg: ProcessedMessage) => {
      const payload = extractPayload(msg) as { productionLines?: PrunApi.ProductionLine[] };
      if (Array.isArray(payload?.productionLines)) {
        // This is a per-site message — replace ALL lines for this site.
        // setMany only merges, so stale lines from FIO would linger.
        // Extract siteId from incoming lines, remove old lines for that site, then add new.
        const siteIds = new Set(payload.productionLines.map((l) => l.siteId).filter(Boolean));
        if (siteIds.size > 0) {
          const store = useProductionStore.getState();
          const staleIds = store.getAll()
            .filter((line) => siteIds.has(line.siteId))
            .map((line) => line.id);
          for (const id of staleIds) {
            useProductionStore.getState().removeOne(id);
          }
        }
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
      } else {
        console.warn('[APXM] PRODUCTION_PRODUCTION_LINE: unexpected payload structure', productionLine);
        useConnectionStore.getState().incrementDiscarded();
      }
    })
  );

  unsubscribers.push(
    onMessageType('PRODUCTION_PRODUCTION_LINE_UPDATED', (msg: ProcessedMessage) => {
      const productionLine = extractPayload(msg) as PrunApi.ProductionLine;
      if (productionLine?.id) {
        useProductionStore.getState().setOne(productionLine);
      } else {
        console.warn('[APXM] PRODUCTION_PRODUCTION_LINE_UPDATED: unexpected payload structure', productionLine);
        useConnectionStore.getState().incrementDiscarded();
      }
    })
  );

  // Production order messages send the order object directly as the payload,
  // with productionLineId as a field on the order (not a sibling wrapper).
  unsubscribers.push(
    onMessageType('PRODUCTION_ORDER_ADDED', (msg: ProcessedMessage) => {
      const order = extractPayload(msg) as PrunApi.ProductionOrder;
      if (order?.id && order?.productionLineId) {
        const line = useProductionStore.getState().getById(order.productionLineId);
        if (line) {
          useProductionStore.getState().setOne({
            ...line,
            orders: [...line.orders, order],
          });
        }
      } else {
        console.warn('[APXM] PRODUCTION_ORDER_ADDED: unexpected payload structure', order);
        useConnectionStore.getState().incrementDiscarded();
      }
    })
  );

  unsubscribers.push(
    onMessageType('PRODUCTION_ORDER_REMOVED', (msg: ProcessedMessage) => {
      // Removal messages send { orderId, productionLineId }, not a full order object
      const payload = extractPayload(msg) as { orderId?: string; productionLineId?: string };
      const orderId = payload?.orderId;
      const lineId = payload?.productionLineId;
      if (orderId && lineId) {
        const line = useProductionStore.getState().getById(lineId);
        if (line) {
          useProductionStore.getState().setOne({
            ...line,
            orders: line.orders.filter((o) => o.id !== orderId),
          });
        }
      } else {
        console.warn('[APXM] PRODUCTION_ORDER_REMOVED: unexpected payload structure', payload);
        useConnectionStore.getState().incrementDiscarded();
      }
    })
  );

  unsubscribers.push(
    onMessageType('PRODUCTION_ORDER_UPDATED', (msg: ProcessedMessage) => {
      const order = extractPayload(msg) as PrunApi.ProductionOrder;
      if (order?.id && order?.productionLineId) {
        const line = useProductionStore.getState().getById(order.productionLineId);
        if (line) {
          useProductionStore.getState().setOne({
            ...line,
            orders: line.orders.map((o) => (o.id === order.id ? order : o)),
          });
        }
      } else {
        console.warn('[APXM] PRODUCTION_ORDER_UPDATED: unexpected payload structure', order);
        useConnectionStore.getState().incrementDiscarded();
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
      } else {
        console.warn('[APXM] SHIP_DATA: unexpected payload structure', ship);
        useConnectionStore.getState().incrementDiscarded();
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
      } else {
        console.warn('[APXM] SHIP_FLIGHT_STARTED: unexpected payload structure', flight);
        useConnectionStore.getState().incrementDiscarded();
      }
    })
  );

  unsubscribers.push(
    onMessageType('SHIP_FLIGHT_ENDED', (msg: ProcessedMessage) => {
      const payload = extractPayload(msg) as { flightId?: string };
      if (payload?.flightId) {
        useFlightsStore.getState().removeOne(payload.flightId);
      } else {
        console.warn('[APXM] SHIP_FLIGHT_ENDED: unexpected payload structure', payload);
        useConnectionStore.getState().incrementDiscarded();
      }
    })
  );

  unsubscribers.push(
    onMessageType('SHIP_FLIGHT_SEGMENT', (msg: ProcessedMessage) => {
      const payload = extractPayload(msg) as {
        flightId?: string;
        currentSegmentIndex?: number;
      };
      const { flightId, currentSegmentIndex } = payload;
      if (flightId && currentSegmentIndex !== undefined) {
        const flight = useFlightsStore.getState().getById(flightId);
        if (flight) {
          useFlightsStore.getState().setOne({
            ...flight,
            currentSegmentIndex,
          });
        }
      } else {
        console.warn('[APXM] SHIP_FLIGHT_SEGMENT: unexpected payload structure', payload);
        useConnectionStore.getState().incrementDiscarded();
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
      } else {
        console.warn('[APXM] CONTRACTS_CONTRACT: unexpected payload structure', contract);
        useConnectionStore.getState().incrementDiscarded();
      }
    })
  );

  return unsubscribers;
}
