import type { ProcessedMessage } from '@prun/link';
import type { PrunApi } from '../types/prun-api';
import { warn } from '../lib/debug/logger';
import { useConnectionStore } from './connection';
import {
  useSitesStore,
  useStorageStore,
  useWorkforceStore,
  useProductionStore,
  useShipsStore,
  useFlightsStore,
  useContractsStore,
  useBalancesStore,
  useAlertsStore,
  useProductionLoadedStore,
  clearAllEntityStores,
  type WorkforceEntity,
} from './entities';
import { useSiteSourceStore } from './site-data-sources';
import { useCompanyStore } from './company';
import { useWarehouseStore, type WarehouseLocation } from './warehouses';
import { useExchangeStore } from './exchanges';
import { useCxobStore } from './cxob';

type MessageHandler = (msg: ProcessedMessage) => void;
const typeHandlers = new Map<string, MessageHandler>();

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
 * Dispatch a single message to its registered type handler.
 * Called from the batched message processor in content.tsx.
 */
export function processMessage(msg: ProcessedMessage): void {
  const handler = typeHandlers.get(msg.messageType);
  if (handler) {
    handler(msg);
  } else {
    // No registered handler — record the type so the diagnostic overlay can
    // surface it. A silently-dropped message type is an invisible blind spot:
    // new game features won't display until we notice and add a handler.
    useConnectionStore.getState().addUnknownMessageType(msg.messageType);
  }
}

/**
 * Build the type handler map for all game message types.
 * Call this once during content script initialization.
 *
 * Handlers are stored in a local Map instead of registering on the
 * @prun/link bridge. This allows content.tsx to batch all message
 * processing in a microtask, preventing React error #185 during
 * PrUn's login burst (dozens of synchronous Zustand setState calls
 * cascading into recursive React re-renders).
 */
export function initMessageHandlers(): void {

  // ACTION_COMPLETED wraps game data in { actionId, status, message }.
  // The inner message can be ANY type (SITE_SITES, STORAGE_CHANGE, etc.).
  // Instead of duplicating handler logic, dispatch the inner message through
  // the same type handler map so all handlers work uniformly regardless
  // of whether the message arrives as a top-level event or inside ACTION_COMPLETED.
  typeHandlers.set('ACTION_COMPLETED', (msg: ProcessedMessage) => {
    const payload = extractPayload(msg) as {
      actionId?: string;
      status?: string;
      message?: { messageType?: string; payload?: unknown }
    };

    const inner = payload?.message;
    if (inner?.messageType && inner.messageType !== 'ACTION_COMPLETED') {
      // Create a synthetic ProcessedMessage matching the wire format the
      // type handlers expect: { messageType, payload: { messageType, payload: data } }
      const syntheticMsg: ProcessedMessage = {
        messageType: inner.messageType,
        payload: inner,
        timestamp: msg.timestamp,
        direction: msg.direction,
        rawSize: msg.rawSize,
      };
      processMessage(syntheticMsg);
    }
  });

  // ============================================================================
  // Connection Events
  // ============================================================================

  typeHandlers.set('CLIENT_CONNECTION_OPENED', () => {
    // Skip clear on first connection — cache/FIO data is fresh and WS dump
    // will replace it via setAll(). On reconnection, delta updates may have
    // been missed while disconnected, so clear is necessary.
    const { reconnectCount } = useConnectionStore.getState();
    if (reconnectCount > 0) {
      clearAllEntityStores();
      useSiteSourceStore.getState().clear();
      // Not entity stores, so clearAllEntityStores doesn't cover them.
      // COMPANY_DATA re-arrives with the login dump; production loaded
      // markers re-accumulate as per-site data arrives.
      useCompanyStore.getState().clear();
      useProductionLoadedStore.getState().clear();
      // ACT-engine stores: warehouses re-arrive with the login dump;
      // exchange mappings and order books re-learn from CX buffers.
      // Order books especially must not survive a gap in observation.
      useWarehouseStore.getState().clear();
      useExchangeStore.getState().clear();
      useCxobStore.getState().clear();
    }
    useConnectionStore.getState().incrementReconnectCount();
    useConnectionStore.getState().setConnected(true);
  });

  // ============================================================================
  // Sites
  // ============================================================================

  typeHandlers.set('SITE_SITES', (msg: ProcessedMessage) => {
    const payload = extractPayload(msg) as { sites?: PrunApi.Site[] };
    if (Array.isArray(payload?.sites)) {
      useSitesStore.getState().setAll(payload.sites);
      useSitesStore.getState().setFetched('websocket');
      // Mark all sites as websocket-sourced (login dump only — BS buffer
      // doesn't trigger SITE_SITES, so this won't fire during buffer refresh)
      const siteIds = payload.sites.map((s) => s.siteId);
      useSiteSourceStore.getState().markAllSites(siteIds, 'websocket');
    } else {
      warn('SITE_SITES: unexpected payload structure', payload);
    }
  });

  // Single site update (e.g., after building)
  typeHandlers.set('SITE_SITE', (msg: ProcessedMessage) => {
    const site = extractPayload(msg) as PrunApi.Site;
    if (site?.siteId) {
      useSitesStore.getState().setOne(site);
    } else {
      warn('SITE_SITE: unexpected payload structure', site);
      useConnectionStore.getState().incrementDiscarded();
    }
  });

  // Platform updates (construction, demolition)
  typeHandlers.set('SITE_PLATFORM_BUILT', (msg: ProcessedMessage) => {
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
      warn('SITE_PLATFORM_BUILT: unexpected payload structure', payload);
      useConnectionStore.getState().incrementDiscarded();
    }
  });

  // ============================================================================
  // Storage
  // ============================================================================

  typeHandlers.set('STORAGE_STORAGES', (msg: ProcessedMessage) => {
    const payload = extractPayload(msg) as { stores?: PrunApi.Store[] };
    if (Array.isArray(payload?.stores)) {
      useStorageStore.getState().setAll(payload.stores);
      useStorageStore.getState().setFetched('websocket');
    } else {
      warn('STORAGE_STORAGES: unexpected payload structure', payload);
    }
  });

  typeHandlers.set('STORAGE_CHANGE', (msg: ProcessedMessage) => {
    const payload = extractPayload(msg) as { stores?: PrunApi.Store[] };
    if (Array.isArray(payload?.stores)) {
      useStorageStore.getState().setMany(payload.stores);
    } else {
      warn('STORAGE_CHANGE: unexpected payload structure', payload);
      useConnectionStore.getState().incrementDiscarded();
    }
  });

  typeHandlers.set('STORAGE_REMOVED', (msg: ProcessedMessage) => {
    const payload = extractPayload(msg) as { storeIds?: string[] };
    if (Array.isArray(payload?.storeIds)) {
      const store = useStorageStore.getState();
      for (const id of payload.storeIds) {
        store.removeOne(id);
      }
    } else {
      warn('STORAGE_REMOVED: unexpected payload structure', payload);
      useConnectionStore.getState().incrementDiscarded();
    }
  });

  // ============================================================================
  // Workforce
  // ============================================================================

  // Workforce arrives per-site, not as a bulk array
  typeHandlers.set('WORKFORCE_WORKFORCES', (msg: ProcessedMessage) => {
    const data = extractPayload(msg) as WorkforceEntity;
    if (data?.siteId) {
      useWorkforceStore.getState().setOne(data);
      useWorkforceStore.getState().setFetched('websocket');
    } else {
      warn('WORKFORCE_WORKFORCES: unexpected payload structure', data);
    }
  });

  typeHandlers.set('WORKFORCE_WORKFORCES_UPDATED', (msg: ProcessedMessage) => {
    const data = extractPayload(msg) as WorkforceEntity;
    if (data?.siteId) {
      useWorkforceStore.getState().setOne(data);
    } else {
      warn('WORKFORCE_WORKFORCES_UPDATED: unexpected payload structure', data);
      useConnectionStore.getState().incrementDiscarded();
    }
  });

  // ============================================================================
  // Production
  // ============================================================================

  typeHandlers.set('PRODUCTION_PRODUCTION_LINES', (msg: ProcessedMessage) => {
    const payload = extractPayload(msg) as { productionLines?: PrunApi.ProductionLine[] };
    if (Array.isArray(payload?.productionLines)) {
      useProductionStore.getState().setAll(payload.productionLines);
      useProductionStore.getState().setFetched('websocket');
      useProductionLoadedStore.getState().markSitesLoaded(
        payload.productionLines.map((l) => l.siteId).filter(Boolean)
      );
    } else {
      warn('PRODUCTION_PRODUCTION_LINES: unexpected payload structure', payload);
    }
  });

  typeHandlers.set('PRODUCTION_SITE_PRODUCTION_LINES', (msg: ProcessedMessage) => {
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
      useProductionLoadedStore.getState().markSitesLoaded(siteIds);
    } else {
      warn('PRODUCTION_SITE_PRODUCTION_LINES: unexpected payload structure', payload);
    }
  });

  typeHandlers.set('PRODUCTION_PRODUCTION_LINE', (msg: ProcessedMessage) => {
    const productionLine = extractPayload(msg) as PrunApi.ProductionLine;
    if (productionLine?.id) {
      useProductionStore.getState().setOne(productionLine);
    } else {
      warn('PRODUCTION_PRODUCTION_LINE: unexpected payload structure', productionLine);
      useConnectionStore.getState().incrementDiscarded();
    }
  });

  typeHandlers.set('PRODUCTION_PRODUCTION_LINE_UPDATED', (msg: ProcessedMessage) => {
    const productionLine = extractPayload(msg) as PrunApi.ProductionLine;
    if (productionLine?.id) {
      useProductionStore.getState().setOne(productionLine);
    } else {
      warn('PRODUCTION_PRODUCTION_LINE_UPDATED: unexpected payload structure', productionLine);
      useConnectionStore.getState().incrementDiscarded();
    }
  });

  // Production order messages send the order object directly as the payload,
  // with productionLineId as a field on the order (not a sibling wrapper).
  typeHandlers.set('PRODUCTION_ORDER_ADDED', (msg: ProcessedMessage) => {
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
      warn('PRODUCTION_ORDER_ADDED: unexpected payload structure', order);
      useConnectionStore.getState().incrementDiscarded();
    }
  });

  typeHandlers.set('PRODUCTION_ORDER_REMOVED', (msg: ProcessedMessage) => {
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
      warn('PRODUCTION_ORDER_REMOVED: unexpected payload structure', payload);
      useConnectionStore.getState().incrementDiscarded();
    }
  });

  typeHandlers.set('PRODUCTION_ORDER_UPDATED', (msg: ProcessedMessage) => {
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
      warn('PRODUCTION_ORDER_UPDATED: unexpected payload structure', order);
      useConnectionStore.getState().incrementDiscarded();
    }
  });

  // ============================================================================
  // Ships
  // ============================================================================

  typeHandlers.set('SHIP_SHIPS', (msg: ProcessedMessage) => {
    const payload = extractPayload(msg) as { ships?: PrunApi.Ship[] };
    if (Array.isArray(payload?.ships)) {
      useShipsStore.getState().setAll(payload.ships);
      useShipsStore.getState().setFetched('websocket');
    } else {
      warn('SHIP_SHIPS: unexpected payload structure', payload);
    }
  });

  typeHandlers.set('SHIP_DATA', (msg: ProcessedMessage) => {
    const ship = extractPayload(msg) as PrunApi.Ship;
    if (ship?.id) {
      useShipsStore.getState().setOne(ship);
    } else {
      warn('SHIP_DATA: unexpected payload structure', ship);
      useConnectionStore.getState().incrementDiscarded();
    }
  });

  // ============================================================================
  // Flights
  // ============================================================================

  typeHandlers.set('SHIP_FLIGHT_FLIGHTS', (msg: ProcessedMessage) => {
    const payload = extractPayload(msg) as { flights?: PrunApi.Flight[] };
    if (Array.isArray(payload?.flights)) {
      useFlightsStore.getState().setAll(payload.flights);
      useFlightsStore.getState().setFetched('websocket');
    } else {
      warn('SHIP_FLIGHT_FLIGHTS: unexpected payload structure', payload);
    }
  });

  typeHandlers.set('SHIP_FLIGHT_STARTED', (msg: ProcessedMessage) => {
    const flight = extractPayload(msg) as PrunApi.Flight;
    if (flight?.id) {
      useFlightsStore.getState().setOne(flight);
    } else {
      warn('SHIP_FLIGHT_STARTED: unexpected payload structure', flight);
      useConnectionStore.getState().incrementDiscarded();
    }
  });

  typeHandlers.set('SHIP_FLIGHT_ENDED', (msg: ProcessedMessage) => {
    const payload = extractPayload(msg) as { flightId?: string };
    if (payload?.flightId) {
      useFlightsStore.getState().removeOne(payload.flightId);
    } else {
      warn('SHIP_FLIGHT_ENDED: unexpected payload structure', payload);
      useConnectionStore.getState().incrementDiscarded();
    }
  });

  typeHandlers.set('SHIP_FLIGHT_SEGMENT', (msg: ProcessedMessage) => {
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
      warn('SHIP_FLIGHT_SEGMENT: unexpected payload structure', payload);
      useConnectionStore.getState().incrementDiscarded();
    }
  });

  // ============================================================================
  // Contracts
  // ============================================================================

  typeHandlers.set('CONTRACTS_CONTRACTS', (msg: ProcessedMessage) => {
    const payload = extractPayload(msg) as { contracts?: PrunApi.Contract[] };
    if (Array.isArray(payload?.contracts)) {
      useContractsStore.getState().setAll(payload.contracts);
      useContractsStore.getState().setFetched('websocket');
    } else {
      warn('CONTRACTS_CONTRACTS: unexpected payload structure', payload);
    }
  });

  typeHandlers.set('CONTRACTS_CONTRACT', (msg: ProcessedMessage) => {
    const contract = extractPayload(msg) as PrunApi.Contract;
    if (contract?.id) {
      useContractsStore.getState().setOne(contract);
    } else {
      warn('CONTRACTS_CONTRACT: unexpected payload structure', contract);
      useConnectionStore.getState().incrementDiscarded();
    }
  });

  // ============================================================================
  // Alerts (the NOTS buffer's data) — bulk snapshot on login, then singleton
  // deltas as things happen, plus explicit deletion notices.
  // ============================================================================

  typeHandlers.set('ALERTS_ALERTS', (msg: ProcessedMessage) => {
    const payload = extractPayload(msg) as { alerts?: PrunApi.Alert[] };
    if (Array.isArray(payload?.alerts)) {
      // Upsert, never replace: the login snapshot lands in a store that
      // CLIENT_CONNECTION_OPENED has already cleared (so upsert == replace
      // there anyway), removals arrive via ALERTS_ALERTS_DELETED, and this
      // same messageType also arrives as a PARTIAL list wrapped inside
      // ACTION_COMPLETED after a mark-as-read (only the changed alerts are
      // included). setAll would wipe the rest of the alert list in that case.
      useAlertsStore.getState().setMany(payload.alerts);
      useAlertsStore.getState().setFetched('websocket');
    } else {
      warn('ALERTS_ALERTS: unexpected payload structure', payload);
    }
  });

  typeHandlers.set('ALERTS_ALERT', (msg: ProcessedMessage) => {
    const alert = extractPayload(msg) as PrunApi.Alert;
    if (alert?.id) {
      useAlertsStore.getState().setOne(alert);
    } else {
      warn('ALERTS_ALERT: unexpected payload structure', alert);
      useConnectionStore.getState().incrementDiscarded();
    }
  });

  typeHandlers.set('ALERTS_ALERTS_DELETED', (msg: ProcessedMessage) => {
    const payload = extractPayload(msg) as { alertIds?: string[] };
    if (Array.isArray(payload?.alertIds)) {
      for (const id of payload.alertIds) {
        useAlertsStore.getState().removeOne(id);
      }
    } else {
      warn('ALERTS_ALERTS_DELETED: unexpected payload structure', payload);
      useConnectionStore.getState().incrementDiscarded();
    }
  });

  // ============================================================================
  // Accounting
  // ============================================================================

  // Bulk balance snapshot sent on login
  typeHandlers.set('ACCOUNTING_CASH_BALANCES', (msg: ProcessedMessage) => {
    const payload = extractPayload(msg) as { currencyAccounts?: PrunApi.CurrencyAccount[] };
    if (Array.isArray(payload?.currencyAccounts)) {
      const balances = payload.currencyAccounts.map((a) => a.currencyBalance);
      useBalancesStore.getState().setAll(balances);
      useBalancesStore.getState().setFetched('websocket');
    } else {
      warn('ACCOUNTING_CASH_BALANCES: unexpected payload structure', payload);
    }
  });

  // Delta updates from transactions — only liquid asset accounts are cash
  typeHandlers.set('ACCOUNTING_BOOKINGS', (msg: ProcessedMessage) => {
    const payload = extractPayload(msg) as { items?: PrunApi.BookingItem[] };
    if (Array.isArray(payload?.items)) {
      for (const item of payload.items) {
        if (item.accountCategory === 'LIQUID_ASSETS') {
          useBalancesStore.getState().setOne(item.balance);
        }
      }
    } else {
      warn('ACCOUNTING_BOOKINGS: unexpected payload structure', payload);
      useConnectionStore.getState().incrementDiscarded();
    }
  });

  // ============================================================================
  // Company
  // ============================================================================

  // Company identity sent on login. name is the only field the UI cannot
  // degrade without; code/countryId fall back to '' (no code suffix shown,
  // alphabetical currency ordering).
  typeHandlers.set('COMPANY_DATA', (msg: ProcessedMessage) => {
    const payload = extractPayload(msg) as {
      name?: string;
      code?: string;
      countryId?: string;
    };
    if (typeof payload?.name === 'string') {
      useCompanyStore.getState().setCompany({
        name: payload.name,
        code: typeof payload.code === 'string' ? payload.code : '',
        countryId: typeof payload.countryId === 'string' ? payload.countryId : '',
      });
    } else {
      warn('COMPANY_DATA: unexpected payload structure', payload);
      useConnectionStore.getState().incrementDiscarded();
    }
  });

  // ============================================================================
  // Warehouses (CX storage locations — ACT engine foundation)
  // ============================================================================
  // Extraction logic adapted from jackinabox86's APXM fork: the game folds
  // warehouse and store data together inconsistently, so both parsers below
  // tolerate the three observed shapes.

  // Parse one warehouse wire entry into a WarehouseLocation, or null if the
  // required identity/address fields are missing.
  function extractWarehouse(wh: Record<string, unknown>): WarehouseLocation | null {
    const warehouseId = wh.warehouseId;
    if (typeof warehouseId !== 'string') return null;

    // storeId may live at the top level ("storeId"/"storageId"), be embedded
    // in a "store"/"storage" sub-object, or be absent entirely (inventory
    // sent separately via STORAGE_STORAGES). '' is the documented sentinel —
    // consumers cross-reference via Store.addressableId instead.
    const embeddedStoreObj = (wh.store ?? wh.storage) as
      | Record<string, unknown>
      | undefined;
    // wh.id is a fallback for when the entry is itself a Store object; the
    // same UUID as warehouseId means it's the warehouse id, not a store id.
    const whId = typeof wh.id === 'string' && wh.id !== warehouseId ? wh.id : undefined;
    const storeId = (wh.storeId ??
      wh.storageId ??
      embeddedStoreObj?.id ??
      whId ??
      '') as string;

    const address = wh.address as
      | { lines?: Array<{ type?: string; entity?: { naturalId?: string } }> }
      | undefined;
    const systemNaturalId = address?.lines?.find((l) => l.type === 'SYSTEM')?.entity
      ?.naturalId;
    if (typeof systemNaturalId !== 'string') return null;
    const stationEntity = address?.lines?.find((l) => l.type === 'STATION')?.entity;
    const stationNaturalId =
      typeof stationEntity?.naturalId === 'string' ? stationEntity.naturalId : null;

    return { warehouseId, storeId, systemNaturalId, stationNaturalId };
  }

  // Extract an embedded PrunApi.Store from a warehouse entry if present, so
  // warehouse inventory reaches the storage store even when STORAGE_STORAGES
  // doesn't carry it separately.
  function extractEmbeddedStore(wh: Record<string, unknown>): PrunApi.Store | null {
    // Shape 1: store data nested in a "store"/"storage" sub-object.
    const s = (wh.store ?? wh.storage) as Record<string, unknown> | undefined;
    if (s && typeof s.id === 'string' && typeof s.type === 'string') {
      return s as unknown as PrunApi.Store;
    }
    // Shape 2: the entry is itself a Store object — identified by a top-level
    // "items" array (inventory) alongside "warehouseId".
    if (
      typeof wh.id === 'string' &&
      typeof wh.type === 'string' &&
      Array.isArray(wh.items)
    ) {
      return wh as unknown as PrunApi.Store;
    }
    return null;
  }

  typeHandlers.set('WAREHOUSE_STORAGES', (msg: ProcessedMessage) => {
    const payload = extractPayload(msg) as Record<string, unknown> | null;
    // The game uses "storages" or "warehouses" as the array field name.
    const raw = payload?.storages ?? payload?.warehouses;
    if (!Array.isArray(raw)) {
      warn('WAREHOUSE_STORAGES: unexpected payload structure', payload);
      useConnectionStore.getState().incrementDiscarded();
      return;
    }
    const locations: WarehouseLocation[] = [];
    const embeddedStores: PrunApi.Store[] = [];
    for (const wh of raw as unknown[]) {
      if (!wh || typeof wh !== 'object') continue;
      const loc = extractWarehouse(wh as Record<string, unknown>);
      if (loc) locations.push(loc);
      const embedded = extractEmbeddedStore(wh as Record<string, unknown>);
      if (embedded) embeddedStores.push(embedded);
    }
    useWarehouseStore.getState().setWarehouses(locations);
    if (embeddedStores.length > 0) {
      useStorageStore.getState().setMany(embeddedStores);
    }
  });

  typeHandlers.set('WAREHOUSE_STORAGE', (msg: ProcessedMessage) => {
    const payload = extractPayload(msg) as Record<string, unknown> | null;
    if (payload && typeof payload === 'object') {
      const loc = extractWarehouse(payload);
      if (loc) {
        useWarehouseStore.getState().addWarehouse(loc);
        const embedded = extractEmbeddedStore(payload);
        if (embedded) useStorageStore.getState().setOne(embedded);
        return;
      }
    }
    warn('WAREHOUSE_STORAGE: unexpected payload structure', payload);
    useConnectionStore.getState().incrementDiscarded();
  });

  typeHandlers.set('WAREHOUSE_STORAGE_REMOVED', (msg: ProcessedMessage) => {
    const payload = extractPayload(msg) as { warehouseId?: string };
    if (typeof payload?.warehouseId === 'string') {
      useWarehouseStore.getState().removeWarehouse(payload.warehouseId);
    } else {
      warn('WAREHOUSE_STORAGE_REMOVED: unexpected payload structure', payload);
      useConnectionStore.getState().incrementDiscarded();
    }
  });

  // ============================================================================
  // Commodity Exchange — order books (ACT engine foundation)
  // ============================================================================
  // Arrives when a CX buffer is open. Also teaches the dynamic exchange
  // code → station naturalId mapping. Parsing adapted from jackinabox86's fork.

  typeHandlers.set('COMEX_BROKER_DATA', (msg: ProcessedMessage) => {
    const payload = extractPayload(msg) as Record<string, unknown> | null;
    if (!payload || typeof payload !== 'object') {
      warn('COMEX_BROKER_DATA: unexpected payload structure', payload);
      useConnectionStore.getState().incrementDiscarded();
      return;
    }

    // Exchange code from the exchange sub-object or the flat field.
    let exchangeCode: string | undefined;
    if (typeof payload.exchangeCode === 'string') {
      exchangeCode = payload.exchangeCode;
    } else if (payload.exchange && typeof payload.exchange === 'object') {
      const code = (payload.exchange as Record<string, unknown>).code;
      if (typeof code === 'string') exchangeCode = code;
    }

    // Full CX ticker ("RAT.CI1"): payload.ticker may already be full, or be
    // the material part only; payload.material.ticker is always material-only.
    let cxTicker: string | undefined;
    if (typeof payload.ticker === 'string') {
      if (payload.ticker.includes('.')) {
        cxTicker = payload.ticker;
        if (!exchangeCode) {
          const dot = payload.ticker.lastIndexOf('.');
          if (dot > 0) exchangeCode = payload.ticker.slice(dot + 1);
        }
      } else if (exchangeCode) {
        cxTicker = `${payload.ticker}.${exchangeCode}`;
      }
    } else if (payload.material && typeof payload.material === 'object') {
      const ticker = (payload.material as Record<string, unknown>).ticker;
      if (typeof ticker === 'string' && exchangeCode) {
        cxTicker = `${ticker}.${exchangeCode}`;
      }
    }

    if (!cxTicker || !exchangeCode) {
      warn('COMEX_BROKER_DATA: could not parse ticker/exchange', payload);
      useConnectionStore.getState().incrementDiscarded();
      return;
    }

    // The exchange object carries no naturalId, but the address always has a
    // STATION line — feed the dynamic code→naturalId mapping from it.
    const address = payload.address as
      | { lines?: Array<{ type?: string; entity?: { naturalId?: string } }> }
      | undefined;
    const stationNaturalId = address?.lines?.find((l) => l.type === 'STATION')?.entity
      ?.naturalId;
    if (typeof stationNaturalId === 'string') {
      useExchangeStore.getState().setExchange(exchangeCode, stationNaturalId);
    }

    function parseOrders(raw: unknown): PrunApi.CXOrder[] {
      if (!Array.isArray(raw)) return [];
      return raw.flatMap((o) => {
        if (!o || typeof o !== 'object') return [];
        const order = o as Record<string, unknown>;
        const limit = order.limit as Record<string, unknown> | undefined;
        if (typeof limit?.amount !== 'number') return [];
        const rawAmount = order.amount ?? order.itemCount ?? null;
        const amount = typeof rawAmount === 'number' ? rawAmount : null;
        return [{ amount, limit: { amount: limit.amount } }];
      });
    }

    useCxobStore.getState().setOrderBook(cxTicker, {
      sellingOrders: parseOrders(payload.sellingOrders),
      buyingOrders: parseOrders(payload.buyingOrders),
    });
  });

}
