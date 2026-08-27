import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { ProcessedMessage } from '@prun/link';
import { initMessageHandlers, processMessage } from '../message-handlers';
import { useConnectionStore } from '../connection';
import {
  useSitesStore,
  useStorageStore,
  useWorkforceStore,
  useProductionStore,
  useShipsStore,
  useFlightsStore,
  useContractsStore,
  useAlertsStore,
  useProductionLoadedStore,
  clearAllEntityStores,
} from '../entities';
import {
  createTestSite,
  createTestStorage,
  createTestWorkforce,
  createTestProductionLine,
  createTestShip,
  createTestFlight,
  createTestContract,
  createTestAlert,
  createProductionOrder,
} from '../../__tests__/fixtures/factories';
import { useSiteSourceStore } from '../site-data-sources';
import { useCompanyStore } from '../company';
import { useUserStore } from '../user';
import { useWarehouseStore } from '../warehouses';
import { useExchangeStore } from '../exchanges';
import { useCxobStore } from '../cxob';

// Dispatch using the REAL wire shape: the decoded game message wraps its data
// as { messageType, payload }, so ProcessedMessage.payload carries that whole
// envelope and extractPayload must unwrap it. Testing with a flat payload
// would only exercise the backwards-compat fallback and leave the production
// unwrapping path unguarded.
function dispatchMessage(messageType: string, payload: unknown): void {
  const msg: ProcessedMessage = {
    messageType,
    payload: { messageType, payload },
    timestamp: Date.now(),
    direction: 'inbound',
    rawSize: 100,
  };
  processMessage(msg);
}

// Legacy flat shape (no envelope) — extractPayload's documented fallback.
function dispatchFlatMessage(messageType: string, payload: unknown): void {
  const msg: ProcessedMessage = {
    messageType,
    payload,
    timestamp: Date.now(),
    direction: 'inbound',
    rawSize: 100,
  };
  processMessage(msg);
}

describe('message-handlers', () => {
  beforeEach(() => {
    clearAllEntityStores();
    useSiteSourceStore.getState().clear();
    useCompanyStore.getState().clear();
    useUserStore.getState().clear();
    useProductionLoadedStore.getState().clear();
    useWarehouseStore.getState().clear();
    useExchangeStore.getState().clear();
    useCxobStore.getState().clear();
    useConnectionStore.setState({
      connected: false,
      lastMessageTimestamp: null,
      messageCount: 0,
      reconnectCount: 0,
      discardedMessages: 0,
      unknownMessageTypes: [],
    });
    initMessageHandlers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('registers handlers that processMessage can dispatch to', () => {
      // Verify a known message type is handled
      const sites = [createTestSite({ siteId: 'site-1' })];
      dispatchMessage('SITE_SITES', { sites });
      expect(useSitesStore.getState().entities.size).toBe(1);
    });

    it('still handles the legacy flat payload shape (no envelope)', () => {
      const sites = [createTestSite({ siteId: 'site-flat' })];
      dispatchFlatMessage('SITE_SITES', { sites });
      expect(useSitesStore.getState().getById('site-flat')?.siteId).toBe('site-flat');
    });
  });

  describe('unregistered message types', () => {
    it('records unhandled types via addUnknownMessageType', () => {
      dispatchMessage('SOME_UNHANDLED_TYPE', {});

      expect(useConnectionStore.getState().unknownMessageTypes).toContain(
        'SOME_UNHANDLED_TYPE'
      );
      // Unknown ≠ malformed: an unhandled type is a blind spot, not a discard
      expect(useConnectionStore.getState().discardedMessages).toBe(0);
    });
  });

  describe('CLIENT_CONNECTION_OPENED', () => {
    // Populate the three ACT-engine stores (not covered by clearAllEntityStores).
    function populateActStores(): void {
      useWarehouseStore.getState().setWarehouses([
        { warehouseId: 'w1', storeId: 's1', systemNaturalId: 'CI', stationNaturalId: 'CI1' },
      ]);
      useExchangeStore.getState().setExchange('CI1', 'BEN');
      useCxobStore.getState().setOrderBook('RAT.CI1', {
        sellingOrders: [{ amount: 10, limit: { amount: 100 } }],
        buyingOrders: [],
      });
    }

    it('preserves entity stores on first connection', () => {
      // Populate stores with cache/FIO data
      useSitesStore.getState().setAll([createTestSite()]);
      useStorageStore.getState().setAll([createTestStorage()]);
      useShipsStore.getState().setAll([createTestShip()]);
      populateActStores();

      expect(useSitesStore.getState().entities.size).toBe(1);
      expect(useStorageStore.getState().entities.size).toBe(1);
      expect(useShipsStore.getState().entities.size).toBe(1);

      // First connection (reconnectCount=0) — should NOT clear
      dispatchMessage('CLIENT_CONNECTION_OPENED', {});

      expect(useSitesStore.getState().entities.size).toBe(1);
      expect(useStorageStore.getState().entities.size).toBe(1);
      expect(useShipsStore.getState().entities.size).toBe(1);
      expect(useWarehouseStore.getState().warehouses).toHaveLength(1);
      expect(useExchangeStore.getState().getNaturalIdFromCode('CI1')).toBe('BEN');
      expect(useCxobStore.getState().getByTicker('RAT.CI1')).toBeDefined();
    });

    it('clears all entity stores on reconnection', () => {
      // First connection increments reconnectCount to 1
      dispatchMessage('CLIENT_CONNECTION_OPENED', {});

      // Populate stores with data
      useSitesStore.getState().setAll([createTestSite()]);
      useStorageStore.getState().setAll([createTestStorage()]);
      useShipsStore.getState().setAll([createTestShip()]);
      populateActStores();

      expect(useSitesStore.getState().entities.size).toBe(1);
      expect(useStorageStore.getState().entities.size).toBe(1);
      expect(useShipsStore.getState().entities.size).toBe(1);

      useAlertsStore.getState().setAll([createTestAlert()]);
      expect(useAlertsStore.getState().entities.size).toBe(1);

      // Reconnection (reconnectCount=1) — should clear
      dispatchMessage('CLIENT_CONNECTION_OPENED', {});

      expect(useSitesStore.getState().entities.size).toBe(0);
      expect(useStorageStore.getState().entities.size).toBe(0);
      expect(useShipsStore.getState().entities.size).toBe(0);
      // Stale notifications after a WS gap must not linger either.
      expect(useAlertsStore.getState().entities.size).toBe(0);
      // Stale ACT data after a WS gap is exactly the staleness hazard —
      // order books especially must not survive a reconnect.
      expect(useWarehouseStore.getState().warehouses).toHaveLength(0);
      expect(useExchangeStore.getState().getNaturalIdFromCode('CI1')).toBeUndefined();
      expect(useCxobStore.getState().getByTicker('RAT.CI1')).toBeUndefined();
    });

    it('clears per-site sources on reconnection', () => {
      // First connection
      dispatchMessage('CLIENT_CONNECTION_OPENED', {});

      // Populate per-site sources
      useSiteSourceStore.getState().markAllSites(['site-1', 'site-2'], 'websocket');
      expect(useSiteSourceStore.getState().entries.size).toBe(2);

      // Reconnection — should clear per-site sources
      dispatchMessage('CLIENT_CONNECTION_OPENED', {});

      expect(useSiteSourceStore.getState().entries.size).toBe(0);
    });

    it('clears company identity on reconnection', () => {
      // First connection
      dispatchMessage('CLIENT_CONNECTION_OPENED', {});

      useCompanyStore.getState().setCompany({ name: 'Test Co', code: 'TST', countryId: 'NC' });
      expect(useCompanyStore.getState().company).not.toBeNull();

      // Reconnection — company re-arrives via COMPANY_DATA, so clear is safe
      dispatchMessage('CLIENT_CONNECTION_OPENED', {});

      expect(useCompanyStore.getState().company).toBeNull();
    });

    it('clears user contexts on reconnection', () => {
      // First connection
      dispatchMessage('CLIENT_CONNECTION_OPENED', {});

      useUserStore.getState().setUser([{ id: 'company-1', type: 'COMPANY' }]);
      expect(useUserStore.getState().contexts).toHaveLength(1);
      expect(useUserStore.getState().companyContextId).toBe('company-1');

      // Reconnection — contexts re-arrive via USER_DATA, so clear is safe
      dispatchMessage('CLIENT_CONNECTION_OPENED', {});

      expect(useUserStore.getState().contexts).toHaveLength(0);
      expect(useUserStore.getState().companyContextId).toBeUndefined();
    });

    it('increments reconnect count', () => {
      expect(useConnectionStore.getState().reconnectCount).toBe(0);

      dispatchMessage('CLIENT_CONNECTION_OPENED', {});
      expect(useConnectionStore.getState().reconnectCount).toBe(1);

      dispatchMessage('CLIENT_CONNECTION_OPENED', {});
      expect(useConnectionStore.getState().reconnectCount).toBe(2);
    });

    it('sets connected to true', () => {
      expect(useConnectionStore.getState().connected).toBe(false);

      dispatchMessage('CLIENT_CONNECTION_OPENED', {});

      expect(useConnectionStore.getState().connected).toBe(true);
    });
  });

  describe('ACTION_COMPLETED', () => {
    it('routes inner messages to type handlers', () => {
      const sites = [
        createTestSite({ siteId: 'site-1' }),
        createTestSite({ siteId: 'site-2' }),
      ];

      // ACTION_COMPLETED wraps the inner message in { message: { messageType, payload } }
      dispatchMessage('ACTION_COMPLETED', {
        actionId: 'action-1',
        status: 'COMPLETED',
        message: { messageType: 'SITE_SITES', payload: { sites } },
      });

      expect(useSitesStore.getState().entities.size).toBe(2);
    });

    it('routes incremental updates through ACTION_COMPLETED', () => {
      // First populate via direct message
      const store1 = createTestStorage({ id: 'store-1', weightLoad: 100 });
      dispatchMessage('STORAGE_STORAGES', { stores: [store1] });

      // Then update via ACTION_COMPLETED with STORAGE_CHANGE
      const updatedStore = { ...store1, weightLoad: 200 };
      dispatchMessage('ACTION_COMPLETED', {
        actionId: 'action-2',
        status: 'COMPLETED',
        message: { messageType: 'STORAGE_CHANGE', payload: { stores: [updatedStore] } },
      });

      expect(useStorageStore.getState().getById('store-1')?.weightLoad).toBe(200);
    });
  });

  describe('SITE_SITES', () => {
    it('populates sites store', () => {
      const sites = [
        createTestSite({ siteId: 'site-1' }),
        createTestSite({ siteId: 'site-2' }),
      ];

      dispatchMessage('SITE_SITES', { sites });

      expect(useSitesStore.getState().entities.size).toBe(2);
      expect(useSitesStore.getState().getById('site-1')).toBeDefined();
      expect(useSitesStore.getState().getById('site-2')).toBeDefined();
    });

    it('marks store as fetched from websocket', () => {
      dispatchMessage('SITE_SITES', { sites: [] });

      expect(useSitesStore.getState().fetched).toBe(true);
      expect(useSitesStore.getState().dataSource).toBe('websocket');
    });

    it('marks per-site sources as websocket', () => {
      const sites = [
        createTestSite({ siteId: 'site-1' }),
        createTestSite({ siteId: 'site-2' }),
      ];
      dispatchMessage('SITE_SITES', { sites });

      const entries = useSiteSourceStore.getState().entries;
      expect(entries.size).toBe(2);
      expect(entries.get('site-1')?.source).toBe('websocket');
      expect(entries.get('site-2')?.source).toBe('websocket');
    });
  });

  describe('SITE_SITE', () => {
    it('updates a single site', () => {
      const site = createTestSite({ siteId: 'site-1' });
      dispatchMessage('SITE_SITES', { sites: [site] });

      const updatedSite = { ...site, area: 999 };
      dispatchMessage('SITE_SITE', updatedSite);

      expect(useSitesStore.getState().getById('site-1')?.area).toBe(999);
    });
  });

  describe('STORAGE_STORAGES', () => {
    it('populates storage store', () => {
      const stores = [
        createTestStorage({ id: 'store-1' }),
        createTestStorage({ id: 'store-2' }),
      ];

      dispatchMessage('STORAGE_STORAGES', { stores });

      expect(useStorageStore.getState().entities.size).toBe(2);
    });
  });

  describe('STORAGE_CHANGE', () => {
    it('updates existing storages without clearing', () => {
      const store1 = createTestStorage({ id: 'store-1', weightLoad: 100 });
      const store2 = createTestStorage({ id: 'store-2' });
      dispatchMessage('STORAGE_STORAGES', { stores: [store1, store2] });

      const updatedStore1 = { ...store1, weightLoad: 200 };
      dispatchMessage('STORAGE_CHANGE', { stores: [updatedStore1] });

      expect(useStorageStore.getState().entities.size).toBe(2);
      expect(useStorageStore.getState().getById('store-1')?.weightLoad).toBe(200);
    });
  });

  describe('STORAGE_REMOVED', () => {
    it('removes storages by id', () => {
      const stores = [
        createTestStorage({ id: 'store-1' }),
        createTestStorage({ id: 'store-2' }),
        createTestStorage({ id: 'store-3' }),
      ];
      dispatchMessage('STORAGE_STORAGES', { stores });

      dispatchMessage('STORAGE_REMOVED', { storeIds: ['store-1', 'store-3'] });

      expect(useStorageStore.getState().entities.size).toBe(1);
      expect(useStorageStore.getState().getById('store-2')).toBeDefined();
    });
  });

  describe('WORKFORCE_WORKFORCES', () => {
    it('stores workforce data by site', () => {
      const workforce = createTestWorkforce({ siteId: 'site-1' });

      dispatchMessage('WORKFORCE_WORKFORCES', workforce);

      expect(useWorkforceStore.getState().entities.size).toBe(1);
      expect(useWorkforceStore.getState().getById('site-1')).toBeDefined();
    });
  });

  describe('production loaded tracking', () => {
    it('marks sites loaded on per-site production data', () => {
      dispatchMessage('PRODUCTION_SITE_PRODUCTION_LINES', {
        productionLines: [createTestProductionLine({ siteId: 'site-A' })],
      });

      expect(useProductionLoadedStore.getState().loadedSiteIds.has('site-A')).toBe(true);
      expect(useProductionLoadedStore.getState().loadedSiteIds.has('site-B')).toBe(false);
    });

    it('marks sites loaded on bulk production data', () => {
      dispatchMessage('PRODUCTION_PRODUCTION_LINES', {
        productionLines: [
          createTestProductionLine({ siteId: 'site-A' }),
          createTestProductionLine({ siteId: 'site-B' }),
        ],
      });

      expect(useProductionLoadedStore.getState().loadedSiteIds.has('site-A')).toBe(true);
      expect(useProductionLoadedStore.getState().loadedSiteIds.has('site-B')).toBe(true);
    });

    it('clears loaded markers on reconnection', () => {
      dispatchMessage('CLIENT_CONNECTION_OPENED', {});
      useProductionLoadedStore.getState().markSitesLoaded(['site-A']);

      dispatchMessage('CLIENT_CONNECTION_OPENED', {});

      expect(useProductionLoadedStore.getState().loadedSiteIds.size).toBe(0);
    });
  });

  describe('PRODUCTION_SITE_PRODUCTION_LINES', () => {
    it('populates production store', () => {
      const productionLines = [
        createTestProductionLine({ id: 'prod-1' }),
        createTestProductionLine({ id: 'prod-2' }),
      ];

      dispatchMessage('PRODUCTION_SITE_PRODUCTION_LINES', { productionLines });

      expect(useProductionStore.getState().entities.size).toBe(2);
    });

    it('removes stale lines for the same site before adding new ones', () => {
      // FIO loads 3 lines for site-A (including a stale smelter line)
      dispatchMessage('PRODUCTION_SITE_PRODUCTION_LINES', {
        productionLines: [
          createTestProductionLine({ id: 'stale-smelter', siteId: 'site-A' }),
          createTestProductionLine({ id: 'stale-refinery', siteId: 'site-A' }),
          createTestProductionLine({ id: 'current-line', siteId: 'site-A' }),
        ],
      });
      expect(useProductionStore.getState().entities.size).toBe(3);

      // Websocket sends current data for site-A (smelter was demolished)
      dispatchMessage('PRODUCTION_SITE_PRODUCTION_LINES', {
        productionLines: [
          createTestProductionLine({ id: 'current-line', siteId: 'site-A' }),
        ],
      });

      // Only the current line should remain — stale lines removed
      expect(useProductionStore.getState().entities.size).toBe(1);
      expect(useProductionStore.getState().getById('current-line')).toBeDefined();
      expect(useProductionStore.getState().getById('stale-smelter')).toBeUndefined();
    });

    it('does not remove lines for other sites', () => {
      // Lines for two different sites
      dispatchMessage('PRODUCTION_SITE_PRODUCTION_LINES', {
        productionLines: [
          createTestProductionLine({ id: 'line-A', siteId: 'site-A' }),
          createTestProductionLine({ id: 'line-B', siteId: 'site-B' }),
        ],
      });
      expect(useProductionStore.getState().entities.size).toBe(2);

      // Websocket updates only site-A
      dispatchMessage('PRODUCTION_SITE_PRODUCTION_LINES', {
        productionLines: [
          createTestProductionLine({ id: 'line-A-new', siteId: 'site-A' }),
        ],
      });

      // site-A replaced, site-B untouched
      expect(useProductionStore.getState().entities.size).toBe(2);
      expect(useProductionStore.getState().getById('line-A')).toBeUndefined();
      expect(useProductionStore.getState().getById('line-A-new')).toBeDefined();
      expect(useProductionStore.getState().getById('line-B')).toBeDefined();
    });
  });

  describe('PRODUCTION_ORDER_ADDED', () => {
    it('adds order to existing production line', () => {
      const line = createTestProductionLine({ id: 'prod-1', orders: [] });
      dispatchMessage('PRODUCTION_SITE_PRODUCTION_LINES', { productionLines: [line] });

      const order = createProductionOrder({ id: 'order-1', productionLineId: 'prod-1' });
      dispatchMessage('PRODUCTION_ORDER_ADDED', order);

      const updatedLine = useProductionStore.getState().getById('prod-1');
      expect(updatedLine?.orders).toHaveLength(1);
      expect(updatedLine?.orders[0].id).toBe('order-1');
    });
  });

  describe('PRODUCTION_ORDER_REMOVED', () => {
    it('removes order from production line', () => {
      const order1 = createProductionOrder({ id: 'order-1' });
      const order2 = createProductionOrder({ id: 'order-2' });
      const line = createTestProductionLine({ id: 'prod-1', orders: [order1, order2] });
      dispatchMessage('PRODUCTION_SITE_PRODUCTION_LINES', { productionLines: [line] });

      dispatchMessage('PRODUCTION_ORDER_REMOVED', { orderId: 'order-1', productionLineId: 'prod-1' });

      const updatedLine = useProductionStore.getState().getById('prod-1');
      expect(updatedLine?.orders).toHaveLength(1);
      expect(updatedLine?.orders[0].id).toBe('order-2');
    });
  });

  describe('SHIP_SHIPS', () => {
    it('populates ships store', () => {
      const ships = [
        createTestShip({ id: 'ship-1' }),
        createTestShip({ id: 'ship-2' }),
      ];

      dispatchMessage('SHIP_SHIPS', { ships });

      expect(useShipsStore.getState().entities.size).toBe(2);
    });
  });

  describe('SHIP_FLIGHT_FLIGHTS', () => {
    it('populates flights store', () => {
      const flights = [createTestFlight({ id: 'flight-1' })];

      dispatchMessage('SHIP_FLIGHT_FLIGHTS', { flights });

      expect(useFlightsStore.getState().entities.size).toBe(1);
    });
  });

  describe('SHIP_FLIGHT_ENDED', () => {
    it('removes flight on completion', () => {
      const flight = createTestFlight({ id: 'flight-1' });
      dispatchMessage('SHIP_FLIGHT_FLIGHTS', { flights: [flight] });

      dispatchMessage('SHIP_FLIGHT_ENDED', { flightId: 'flight-1' });

      expect(useFlightsStore.getState().entities.size).toBe(0);
    });
  });

  describe('CONTRACTS_CONTRACTS', () => {
    it('populates contracts store', () => {
      const contracts = [
        createTestContract({ id: 'contract-1' }),
        createTestContract({ id: 'contract-2' }),
      ];

      dispatchMessage('CONTRACTS_CONTRACTS', { contracts });

      expect(useContractsStore.getState().entities.size).toBe(2);
    });
  });

  describe('ALERTS_* (the NOTS data)', () => {
    it('ALERTS_ALERTS populates the store and marks it fetched', () => {
      dispatchMessage('ALERTS_ALERTS', {
        alerts: [createTestAlert({ id: 'a-1' }), createTestAlert({ id: 'a-2' })],
      });

      expect(useAlertsStore.getState().entities.size).toBe(2);
      expect(useAlertsStore.getState().fetched).toBe(true);
      expect(useAlertsStore.getState().dataSource).toBe('websocket');
    });

    it('ALERTS_ALERT upserts a single alert (delta)', () => {
      dispatchMessage('ALERTS_ALERT', createTestAlert({ id: 'a-1', read: false }));
      dispatchMessage('ALERTS_ALERT', createTestAlert({ id: 'a-1', read: true }));

      expect(useAlertsStore.getState().entities.size).toBe(1);
      expect(useAlertsStore.getState().getById('a-1')?.read).toBe(true);
    });

    it('ALERTS_ALERTS_DELETED removes only the listed ids', () => {
      dispatchMessage('ALERTS_ALERTS', {
        alerts: [createTestAlert({ id: 'a-1' }), createTestAlert({ id: 'a-2' })],
      });

      dispatchMessage('ALERTS_ALERTS_DELETED', { alertIds: ['a-1'] });

      expect(useAlertsStore.getState().getById('a-1')).toBeUndefined();
      expect(useAlertsStore.getState().getById('a-2')).toBeDefined();
    });

    it('discards malformed alert deltas without touching the store', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      dispatchMessage('ALERTS_ALERT', { nonsense: true });

      expect(useAlertsStore.getState().entities.size).toBe(0);
      expect(useConnectionStore.getState().discardedMessages).toBe(1);
      warnSpy.mockRestore();
    });
  });

  describe('COMPANY_DATA', () => {
    it('populates the company store', () => {
      dispatchMessage('COMPANY_DATA', { name: 'Test Co', code: 'TST', countryId: 'NC' });

      expect(useCompanyStore.getState().company).toEqual({
        name: 'Test Co',
        code: 'TST',
        countryId: 'NC',
      });
    });

    it('defaults missing code and countryId to empty strings', () => {
      dispatchMessage('COMPANY_DATA', { name: 'Test Co' });

      expect(useCompanyStore.getState().company).toEqual({
        name: 'Test Co',
        code: '',
        countryId: '',
      });
    });

    it('discards payloads without a name and leaves the store untouched', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      dispatchMessage('COMPANY_DATA', { code: 'TST' });

      expect(useCompanyStore.getState().company).toBeNull();
      expect(useConnectionStore.getState().discardedMessages).toBe(1);
      expect(warnSpy).toHaveBeenCalledWith(
        '[APXM]',
        'COMPANY_DATA: unexpected payload structure',
        expect.anything()
      );

      warnSpy.mockRestore();
    });
  });

  describe('USER_DATA', () => {
    it('populates contexts and derives companyContextId', () => {
      dispatchMessage('USER_DATA', {
        contexts: [
          { id: 'company-1', type: 'COMPANY' },
          { id: 'corp-1', type: 'CORPORATION' },
        ],
      });

      expect(useUserStore.getState().contexts).toEqual([
        { id: 'company-1', type: 'COMPANY' },
        { id: 'corp-1', type: 'CORPORATION' },
      ]);
      expect(useUserStore.getState().companyContextId).toBe('company-1');
    });

    it('skips context entries missing id or type', () => {
      dispatchMessage('USER_DATA', {
        contexts: [
          { id: 'company-1', type: 'COMPANY' },
          { id: 'no-type' },
          { type: 'CORPORATION' },
        ],
      });

      expect(useUserStore.getState().contexts).toEqual([{ id: 'company-1', type: 'COMPANY' }]);
    });

    it('discards a non-array payload and increments discarded', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      dispatchMessage('USER_DATA', { contexts: 'nonsense' });

      expect(useUserStore.getState().contexts).toEqual([]);
      expect(useConnectionStore.getState().discardedMessages).toBe(1);
      expect(warnSpy).toHaveBeenCalledWith(
        '[APXM]',
        'USER_DATA: unexpected payload structure',
        expect.anything()
      );

      warnSpy.mockRestore();
    });
  });

  describe('WAREHOUSE_STORAGES', () => {
    // The game folds warehouse/store data together in three observed shapes;
    // the handler must tolerate all of them (see extractWarehouse).
    const address = {
      lines: [
        { type: 'SYSTEM', entity: { naturalId: 'CI' } },
        { type: 'STATION', entity: { naturalId: 'CI1' } },
      ],
    };

    it('shape 1: top-level storeId', () => {
      dispatchMessage('WAREHOUSE_STORAGES', {
        storages: [{ warehouseId: 'w1', storeId: 'store-1', address }],
      });

      const loc = useWarehouseStore.getState().getByEntityNaturalId('CI1');
      expect(loc).toEqual({
        warehouseId: 'w1',
        storeId: 'store-1',
        systemNaturalId: 'CI',
        stationNaturalId: 'CI1',
      });
    });

    it('shape 2: embedded store object — storeId taken from it AND the store lands in the storage store', () => {
      const embedded = createTestStorage({ id: 'store-2', type: 'WAREHOUSE_STORE' });
      dispatchMessage('WAREHOUSE_STORAGES', {
        storages: [{ warehouseId: 'w2', store: embedded, address }],
      });

      expect(useWarehouseStore.getState().getByEntityNaturalId('CI1')?.storeId).toBe('store-2');
      expect(useStorageStore.getState().getById('store-2')?.type).toBe('WAREHOUSE_STORE');
    });

    it('shape 3: entry is itself a Store object — id used as storeId, inventory reaches the storage store', () => {
      const storeEntry = {
        ...createTestStorage({ id: 'store-3', type: 'WAREHOUSE_STORE' }),
        warehouseId: 'w3',
        address,
      };
      dispatchMessage('WAREHOUSE_STORAGES', { storages: [storeEntry] });

      expect(useWarehouseStore.getState().getByEntityNaturalId('CI1')?.storeId).toBe('store-3');
      expect(useStorageStore.getState().getById('store-3')).toBeDefined();
    });

    it('missing storeId everywhere yields the documented "" sentinel, not a bogus id', () => {
      dispatchMessage('WAREHOUSE_STORAGES', {
        storages: [{ warehouseId: 'w4', address }],
      });

      expect(useWarehouseStore.getState().getByEntityNaturalId('CI1')?.storeId).toBe('');
    });

    it('accepts "warehouses" as the array field name', () => {
      dispatchMessage('WAREHOUSE_STORAGES', {
        warehouses: [{ warehouseId: 'w5', storeId: 's5', address }],
      });

      expect(useWarehouseStore.getState().warehouses).toHaveLength(1);
    });

    it('malformed payload increments discardedMessages and stores nothing', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      dispatchMessage('WAREHOUSE_STORAGES', { nope: true });

      expect(useWarehouseStore.getState().warehouses).toHaveLength(0);
      expect(useConnectionStore.getState().discardedMessages).toBe(1);
      warnSpy.mockRestore();
    });

    it('WAREHOUSE_STORAGE upserts a single warehouse; WAREHOUSE_STORAGE_REMOVED drops it', () => {
      dispatchMessage('WAREHOUSE_STORAGE', { warehouseId: 'w6', storeId: 's6', address });
      expect(useWarehouseStore.getState().warehouses).toHaveLength(1);

      dispatchMessage('WAREHOUSE_STORAGE_REMOVED', { warehouseId: 'w6' });
      expect(useWarehouseStore.getState().warehouses).toHaveLength(0);
    });
  });

  describe('malformed payload handling', () => {
    it('increments discardedMessages on malformed SITE_SITE payload', () => {
      expect(useConnectionStore.getState().discardedMessages).toBe(0);

      // Dispatch with missing siteId
      dispatchMessage('SITE_SITE', { name: 'no-site-id' });

      expect(useConnectionStore.getState().discardedMessages).toBe(1);
    });

    it('logs warning on malformed payload', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      dispatchMessage('SITE_SITE', { name: 'no-site-id' });

      expect(warnSpy).toHaveBeenCalledWith(
        '[APXM]',
        'SITE_SITE: unexpected payload structure',
        expect.anything()
      );

      warnSpy.mockRestore();
    });

    it('malformed SITE_SITES warns but does NOT increment discardedMessages', () => {
      // Pins the bulk-handler contract: bulk handlers (SITE_SITES et al.)
      // only warn on a malformed payload, unlike the singular handlers
      // (SITE_SITE does incrementDiscarded). This asymmetry is current
      // intended behavior — visibility comes from the warn. A change to
      // either side of it should be deliberate, not accidental.
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      dispatchMessage('SITE_SITES', { notSites: true });

      expect(warnSpy).toHaveBeenCalledWith(
        '[APXM]',
        'SITE_SITES: unexpected payload structure',
        expect.anything()
      );
      expect(useConnectionStore.getState().discardedMessages).toBe(0);
      expect(useSitesStore.getState().entities.size).toBe(0);

      warnSpy.mockRestore();
    });
  });
});
