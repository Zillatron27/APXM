// The _compat seam contract (#31): these tests pin the adapter surface the
// ported ACT engine reads, against APXM's real store shapes. If a store
// refactor breaks the seam, this file fails before any device testing does.

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  sitesStore,
  warehousesStore,
  exchangesStore,
  materialsStore,
  isFiniteOrder,
  calculatePlanetBurn,
} from '../_compat';
import { useSitesStore } from '../../../stores/entities/sites';
import { useStorageStore } from '../../../stores/entities/storage';
import { useWarehouseStore } from '../../../stores/warehouses';
import { useExchangeStore } from '../../../stores/exchanges';
import { useMaterialsStore } from '../../../stores/reference';
import { getEntityDisplayName } from '../../address';
import {
  resetIdCounter,
  createTestSite,
  createTestStorage,
  createTestProductionLine,
  createOrderWithIO,
  createWorkforce,
  createNeed,
  createMaterial,
  createStoreItem,
  createMaterialAmountValue,
  createStorageWithItems,
} from '../../../__tests__/fixtures/factories';

const DAY_MS = 86_400_000;

beforeEach(() => {
  resetIdCounter();
  useSitesStore.getState().clear();
  useStorageStore.getState().clear();
  useMaterialsStore.getState().clear();
  useWarehouseStore.getState().clear();
  useExchangeStore.getState().clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('_compat materialsStore (FIO reference store adapter)', () => {
  it('resolves weight/volume case-insensitively via the uppercase-keyed reference store', () => {
    useMaterialsStore.getState().setAll([
      { ticker: 'RAT', name: 'Rations', category: 'consumables (basic)', weight: 0.21, volume: 0.1 },
    ]);

    const lower = materialsStore.getByTicker('rat');
    const upper = materialsStore.getByTicker('RAT');
    expect(lower).toBeDefined();
    expect(lower).toBe(upper);
    // The engine's only material reads: cargo-fit checks and totals.
    expect(lower!.weight).toBe(0.21);
    expect(lower!.volume).toBe(0.1);
    expect(lower!.weight * 100).toBeCloseTo(21);
  });

  it('returns undefined for unknown tickers (engine asserts on this)', () => {
    expect(materialsStore.getByTicker('XYZ')).toBeUndefined();
  });
});

describe('_compat sitesStore.getByPlanetNaturalIdOrName', () => {
  it('finds a site by planet naturalId, siteId, and display name', () => {
    const site = createTestSite({ siteId: 'site-x' });
    useSitesStore.getState().setAll([site]);

    expect(sitesStore.getByPlanetNaturalIdOrName('MONTEM')?.siteId).toBe('site-x');
    expect(sitesStore.getByPlanetNaturalIdOrName('site-x')?.siteId).toBe('site-x');
    // Display-name lookup must agree with whatever getEntityDisplayName renders.
    const displayName = getEntityDisplayName(site.address);
    expect(sitesStore.getByPlanetNaturalIdOrName(displayName)?.siteId).toBe('site-x');
    expect(sitesStore.getByPlanetNaturalIdOrName('NOWHERE')).toBeUndefined();
    expect(sitesStore.getByPlanetNaturalIdOrName(undefined)).toBeUndefined();
  });
});

describe('_compat calculatePlanetBurn', () => {
  it('composes core/burn rates into dailyAmount = output − input − workforce with inventory pass-through', () => {
    // One queued 1-day order: 10 H2O in → 5 RAT out. Workforce eats 4 RAT/day.
    const line = createTestProductionLine({
      capacity: 1,
      orders: [createOrderWithIO([{ ticker: 'H2O', amount: 10 }], [{ ticker: 'RAT', amount: 5 }], DAY_MS)],
    });
    const workforce = [
      createWorkforce({
        needs: [createNeed({ material: createMaterial({ ticker: 'RAT' }), unitsPerInterval: 4 })],
      }),
    ];
    const stores = [createStorageWithItems('s1', [{ ticker: 'RAT', amount: 100 }])];

    const burn = calculatePlanetBurn([line], workforce, stores);

    expect(burn.RAT).toEqual({ dailyAmount: 1, inventory: 100, workforce: 4, input: 0, output: 5 });
    expect(burn.H2O).toEqual({ dailyAmount: -10, inventory: 0, workforce: 0, input: 10, output: 0 });
  });

  it('treats undefined workforce/stores as empty', () => {
    const line = createTestProductionLine({
      capacity: 1,
      orders: [createOrderWithIO([{ ticker: 'H2O', amount: 10 }], [], DAY_MS)],
    });
    const burn = calculatePlanetBurn([line], undefined, undefined);
    expect(burn.H2O.dailyAmount).toBe(-10);
    expect(burn.H2O.inventory).toBe(0);
  });
});

describe('_compat warehousesStore.resolveStoreId strategy chain', () => {
  it('resolves via WAREHOUSE_STORE.addressableId cross-reference when storeId is the empty sentinel', () => {
    useWarehouseStore.getState().setWarehouses([
      { warehouseId: 'wh-1', storeId: '', systemNaturalId: 'AI', stationNaturalId: 'ANT' },
    ]);
    useStorageStore.getState().setAll([
      createTestStorage({ id: 'st-1', type: 'WAREHOUSE_STORE', addressableId: 'wh-1' }),
    ]);

    expect(warehousesStore.resolveStoreId('ANT')).toEqual({ storeId: 'st-1' });
  });

  it('falls back to the recorded storeId when it exists in the storage store', () => {
    useWarehouseStore.getState().setWarehouses([
      { warehouseId: 'wh-2', storeId: 'st-2', systemNaturalId: 'CI', stationNaturalId: 'BEN' },
    ]);
    useStorageStore.getState().setAll([
      // addressableId does NOT point back at the warehouse — forces the storeId path.
      createTestStorage({ id: 'st-2', type: 'WAREHOUSE_STORE', addressableId: 'elsewhere' }),
    ]);

    expect(warehousesStore.resolveStoreId('BEN')).toEqual({ storeId: 'st-2' });
  });

  it('falls back to the system code when the exchange code matches no station ("AI1" → "AI")', () => {
    useWarehouseStore.getState().setWarehouses([
      { warehouseId: 'wh-1', storeId: '', systemNaturalId: 'AI', stationNaturalId: 'ANT' },
    ]);
    useStorageStore.getState().setAll([
      createTestStorage({ id: 'st-1', type: 'WAREHOUSE_STORE', addressableId: 'wh-1' }),
    ]);

    expect(warehousesStore.resolveStoreId('AI1')).toEqual({ storeId: 'st-1' });
  });

  it('returns undefined (with a diagnostic warn) when nothing matches', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(warehousesStore.resolveStoreId('NC1')).toBeUndefined();
    expect(warnSpy).toHaveBeenCalled();
  });

  it('returns undefined (with a diagnostic warn) when the warehouse exists but its store was never received', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    useWarehouseStore.getState().setWarehouses([
      { warehouseId: 'wh-3', storeId: '', systemNaturalId: 'IC', stationNaturalId: 'HRT' },
    ]);
    expect(warehousesStore.resolveStoreId('HRT')).toBeUndefined();
    expect(warnSpy).toHaveBeenCalled();
  });
});

describe('_compat exchangesStore.getNaturalIdFromCode', () => {
  it('prefers the dynamic store, falls back to the static CX map, then passes through', () => {
    // Static fallback first (dynamic store empty after reconnect clear).
    expect(exchangesStore.getNaturalIdFromCode('AI1')).toBe('ANT');
    // Dynamic entry (from COMEX_BROKER_DATA) wins over the static map.
    useExchangeStore.getState().setExchange('AI1', 'ZZZ');
    expect(exchangesStore.getNaturalIdFromCode('AI1')).toBe('ZZZ');
    // Unknown codes pass through unchanged.
    expect(exchangesStore.getNaturalIdFromCode('QQ9')).toBe('QQ9');
    expect(exchangesStore.getNaturalIdFromCode(undefined)).toBeUndefined();
  });
});

describe('_compat isFiniteOrder', () => {
  it('treats null-amount orders as market-maker (infinite) orders', () => {
    expect(isFiniteOrder({ amount: null, limit: { amount: 100 } })).toBe(false);
    expect(isFiniteOrder({ amount: 50, limit: { amount: 100 } })).toBe(true);
  });
});

describe('_compat storage adapters used by generateState', () => {
  it('getById returns the warehouse store with its items intact', () => {
    useStorageStore.getState().setAll([
      createTestStorage({
        id: 'ws-1',
        type: 'WAREHOUSE_STORE',
        addressableId: 'wh-ai',
        items: [
          createStoreItem({
            quantity: createMaterialAmountValue({
              material: createMaterial({ ticker: 'RAT' }),
              amount: 500,
            }),
          }),
        ],
      }),
    ]);
    const store = useStorageStore.getState().getById('ws-1');
    expect(store?.items[0]?.quantity?.amount).toBe(500);
  });
});
