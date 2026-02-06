import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { ProcessedMessage } from '../../lib/socket-io/types';
import { initMessageHandlers } from '../message-handlers';
import { useConnectionStore } from '../connection';
import {
  useSitesStore,
  useStorageStore,
  useWorkforceStore,
  useProductionStore,
  useShipsStore,
  useFlightsStore,
  useContractsStore,
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
  createProductionOrder,
} from '../../__tests__/fixtures/factories';

// Mock the message bus
const mockHandlers = new Map<string, ((msg: ProcessedMessage) => void)[]>();

vi.mock('../../lib/message-bus/content-bridge', () => ({
  onMessageType: (type: string, handler: (msg: ProcessedMessage) => void) => {
    if (!mockHandlers.has(type)) {
      mockHandlers.set(type, []);
    }
    mockHandlers.get(type)!.push(handler);
    return () => {
      const handlers = mockHandlers.get(type);
      if (handlers) {
        const idx = handlers.indexOf(handler);
        if (idx >= 0) handlers.splice(idx, 1);
      }
    };
  },
  dispatchToTypeHandlers: (msg: ProcessedMessage) => {
    const handlers = mockHandlers.get(msg.messageType);
    if (handlers) {
      for (const handler of handlers) {
        handler(msg);
      }
    }
  },
}));

function dispatchMessage(messageType: string, payload: unknown): void {
  const handlers = mockHandlers.get(messageType);
  if (handlers) {
    const msg: ProcessedMessage = {
      messageType,
      payload,
      timestamp: Date.now(),
      direction: 'inbound',
      rawSize: 100,
    };
    for (const handler of handlers) {
      handler(msg);
    }
  }
}

describe('message-handlers', () => {
  beforeEach(() => {
    mockHandlers.clear();
    clearAllEntityStores();
    useConnectionStore.setState({
      connected: false,
      lastMessageTimestamp: null,
      messageCount: 0,
      reconnectCount: 0,
      discardedMessages: 0,
      unknownMessageTypes: [],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('registers handlers and returns unsubscribe functions', () => {
      const unsubscribers = initMessageHandlers();

      expect(unsubscribers.length).toBeGreaterThan(0);
      expect(mockHandlers.size).toBeGreaterThan(0);
    });
  });

  describe('CLIENT_CONNECTION_OPENED', () => {
    beforeEach(() => {
      initMessageHandlers();
    });

    it('clears all entity stores on reconnect', () => {
      // Populate stores with data
      useSitesStore.getState().setAll([createTestSite()]);
      useStorageStore.getState().setAll([createTestStorage()]);
      useShipsStore.getState().setAll([createTestShip()]);

      expect(useSitesStore.getState().entities.size).toBe(1);
      expect(useStorageStore.getState().entities.size).toBe(1);
      expect(useShipsStore.getState().entities.size).toBe(1);

      // Simulate reconnect
      dispatchMessage('CLIENT_CONNECTION_OPENED', {});

      expect(useSitesStore.getState().entities.size).toBe(0);
      expect(useStorageStore.getState().entities.size).toBe(0);
      expect(useShipsStore.getState().entities.size).toBe(0);
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
    beforeEach(() => {
      initMessageHandlers();
    });

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
    beforeEach(() => {
      initMessageHandlers();
    });

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
  });

  describe('SITE_SITE', () => {
    beforeEach(() => {
      initMessageHandlers();
    });

    it('updates a single site', () => {
      const site = createTestSite({ siteId: 'site-1' });
      dispatchMessage('SITE_SITES', { sites: [site] });

      const updatedSite = { ...site, area: 999 };
      dispatchMessage('SITE_SITE', updatedSite);

      expect(useSitesStore.getState().getById('site-1')?.area).toBe(999);
    });
  });

  describe('STORAGE_STORAGES', () => {
    beforeEach(() => {
      initMessageHandlers();
    });

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
    beforeEach(() => {
      initMessageHandlers();
    });

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
    beforeEach(() => {
      initMessageHandlers();
    });

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
    beforeEach(() => {
      initMessageHandlers();
    });

    it('stores workforce data by site', () => {
      const workforce = createTestWorkforce({ siteId: 'site-1' });

      dispatchMessage('WORKFORCE_WORKFORCES', workforce);

      expect(useWorkforceStore.getState().entities.size).toBe(1);
      expect(useWorkforceStore.getState().getById('site-1')).toBeDefined();
    });
  });

  describe('PRODUCTION_SITE_PRODUCTION_LINES', () => {
    beforeEach(() => {
      initMessageHandlers();
    });

    it('populates production store', () => {
      const productionLines = [
        createTestProductionLine({ id: 'prod-1' }),
        createTestProductionLine({ id: 'prod-2' }),
      ];

      dispatchMessage('PRODUCTION_SITE_PRODUCTION_LINES', { productionLines });

      expect(useProductionStore.getState().entities.size).toBe(2);
    });
  });

  describe('PRODUCTION_ORDER_ADDED', () => {
    beforeEach(() => {
      initMessageHandlers();
    });

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
    beforeEach(() => {
      initMessageHandlers();
    });

    it('removes order from production line', () => {
      const order1 = createProductionOrder({ id: 'order-1' });
      const order2 = createProductionOrder({ id: 'order-2' });
      const line = createTestProductionLine({ id: 'prod-1', orders: [order1, order2] });
      dispatchMessage('PRODUCTION_SITE_PRODUCTION_LINES', { productionLines: [line] });

      dispatchMessage('PRODUCTION_ORDER_REMOVED', createProductionOrder({ id: 'order-1', productionLineId: 'prod-1' }));

      const updatedLine = useProductionStore.getState().getById('prod-1');
      expect(updatedLine?.orders).toHaveLength(1);
      expect(updatedLine?.orders[0].id).toBe('order-2');
    });
  });

  describe('SHIP_SHIPS', () => {
    beforeEach(() => {
      initMessageHandlers();
    });

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
    beforeEach(() => {
      initMessageHandlers();
    });

    it('populates flights store', () => {
      const flights = [createTestFlight({ id: 'flight-1' })];

      dispatchMessage('SHIP_FLIGHT_FLIGHTS', { flights });

      expect(useFlightsStore.getState().entities.size).toBe(1);
    });
  });

  describe('SHIP_FLIGHT_ENDED', () => {
    beforeEach(() => {
      initMessageHandlers();
    });

    it('removes flight on completion', () => {
      const flight = createTestFlight({ id: 'flight-1' });
      dispatchMessage('SHIP_FLIGHT_FLIGHTS', { flights: [flight] });

      dispatchMessage('SHIP_FLIGHT_ENDED', { flightId: 'flight-1' });

      expect(useFlightsStore.getState().entities.size).toBe(0);
    });
  });

  describe('CONTRACTS_CONTRACTS', () => {
    beforeEach(() => {
      initMessageHandlers();
    });

    it('populates contracts store', () => {
      const contracts = [
        createTestContract({ id: 'contract-1' }),
        createTestContract({ id: 'contract-2' }),
      ];

      dispatchMessage('CONTRACTS_CONTRACTS', { contracts });

      expect(useContractsStore.getState().entities.size).toBe(2);
    });
  });

  describe('malformed payload handling', () => {
    beforeEach(() => {
      initMessageHandlers();
    });

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
        '[APXM] SITE_SITE: unexpected payload structure',
        expect.anything()
      );

      warnSpy.mockRestore();
    });
  });
});
