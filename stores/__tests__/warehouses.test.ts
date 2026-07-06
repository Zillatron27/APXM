import { describe, it, expect, beforeEach } from 'vitest';
import { useWarehouseStore } from '../warehouses';

beforeEach(() => {
  useWarehouseStore.getState().clear();
});

describe('warehouse store', () => {
  it('finds a warehouse by stationNaturalId (CX code)', () => {
    useWarehouseStore.getState().setWarehouses([
      { warehouseId: 'w1', storeId: 's1', systemNaturalId: 'CI', stationNaturalId: 'CI1' },
      { warehouseId: 'w2', storeId: 's2', systemNaturalId: 'NC', stationNaturalId: 'NC1' },
    ]);

    expect(useWarehouseStore.getState().getByEntityNaturalId('CI1')?.storeId).toBe('s1');
    expect(useWarehouseStore.getState().getByEntityNaturalId('NC1')?.storeId).toBe('s2');
  });

  it('falls back to systemNaturalId when stationNaturalId is null', () => {
    useWarehouseStore.getState().setWarehouses([
      { warehouseId: 'w3', storeId: 's3', systemNaturalId: 'IC', stationNaturalId: null },
    ]);

    expect(useWarehouseStore.getState().getByEntityNaturalId('IC')?.storeId).toBe('s3');
  });

  it('returns undefined for an unknown naturalId', () => {
    expect(useWarehouseStore.getState().getByEntityNaturalId('UNKNOWN')).toBeUndefined();
  });

  it('getBySystem finds a warehouse by systemNaturalId', () => {
    useWarehouseStore.getState().setWarehouses([
      { warehouseId: 'w1', storeId: 's1', systemNaturalId: 'CI', stationNaturalId: 'CI1' },
      { warehouseId: 'w2', storeId: 's2', systemNaturalId: 'NC', stationNaturalId: 'NC1' },
    ]);

    expect(useWarehouseStore.getState().getBySystem('NC')?.warehouseId).toBe('w2');
    expect(useWarehouseStore.getState().getBySystem('ZZ')).toBeUndefined();
  });

  it('station match wins over system match for the same naturalId', () => {
    // The system-matching warehouse is listed FIRST: a naive first-match-in-
    // list lookup would return it. The contract is station-before-system,
    // because an exchange code is a station naturalId.
    useWarehouseStore.getState().setWarehouses([
      { warehouseId: 'wB', storeId: 'sB', systemNaturalId: 'X', stationNaturalId: null },
      { warehouseId: 'wA', storeId: 'sA', systemNaturalId: 'OTHER', stationNaturalId: 'X' },
    ]);

    expect(useWarehouseStore.getState().getByEntityNaturalId('X')?.warehouseId).toBe('wA');
  });

  it('addWarehouse replaces an existing entry with the same warehouseId', () => {
    const store = useWarehouseStore.getState();
    store.addWarehouse({ warehouseId: 'w1', storeId: 's1', systemNaturalId: 'CI', stationNaturalId: 'CI1' });
    store.addWarehouse({ warehouseId: 'w1', storeId: 's9', systemNaturalId: 'CI', stationNaturalId: 'CI1' });

    expect(useWarehouseStore.getState().warehouses).toHaveLength(1);
    expect(useWarehouseStore.getState().getByEntityNaturalId('CI1')?.storeId).toBe('s9');
  });

  it('removeWarehouse drops the entry', () => {
    const store = useWarehouseStore.getState();
    store.setWarehouses([
      { warehouseId: 'w1', storeId: 's1', systemNaturalId: 'CI', stationNaturalId: 'CI1' },
    ]);
    store.removeWarehouse('w1');

    expect(useWarehouseStore.getState().warehouses).toHaveLength(0);
  });
});
