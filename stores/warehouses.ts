/**
 * CX warehouse locations, from WAREHOUSE_STORAGES / WAREHOUSE_STORAGE.
 *
 * A warehouse is where CX-bought goods land, so the ACT engine needs to map
 * an exchange (station or system naturalId) to the warehouse's storage id.
 * Not persisted — repopulated by the login dump, cleared on reconnect.
 *
 * Adapted from jackinabox86's APXM fork (https://github.com/jackinabox86/APXM).
 */

import { create } from 'zustand';

export interface WarehouseLocation {
  warehouseId: string;
  /** May be '' when the wire message carried no resolvable store id — the
   *  consumer must then cross-reference via Store.addressableId. */
  storeId: string;
  systemNaturalId: string;
  stationNaturalId: string | null;
}

interface WarehouseState {
  warehouses: WarehouseLocation[];
  setWarehouses: (warehouses: WarehouseLocation[]) => void;
  addWarehouse: (warehouse: WarehouseLocation) => void;
  removeWarehouse: (warehouseId: string) => void;
  getBySystem: (systemNaturalId: string) => WarehouseLocation | undefined;
  getByEntityNaturalId: (naturalId: string) => WarehouseLocation | undefined;
  clear: () => void;
}

export const useWarehouseStore = create<WarehouseState>((set, get) => ({
  warehouses: [],

  setWarehouses: (warehouses) => set({ warehouses }),

  addWarehouse: (warehouse) =>
    set((state) => {
      const existing = state.warehouses.findIndex(
        (w) => w.warehouseId === warehouse.warehouseId
      );
      if (existing >= 0) {
        const updated = [...state.warehouses];
        updated[existing] = warehouse;
        return { warehouses: updated };
      }
      return { warehouses: [...state.warehouses, warehouse] };
    }),

  removeWarehouse: (warehouseId) =>
    set((state) => ({
      warehouses: state.warehouses.filter((w) => w.warehouseId !== warehouseId),
    })),

  getBySystem: (systemNaturalId) =>
    get().warehouses.find((w) => w.systemNaturalId === systemNaturalId),

  // Station match first (exchange code == station naturalId), then system.
  getByEntityNaturalId: (naturalId) =>
    get().warehouses.find((w) => w.stationNaturalId === naturalId) ??
    get().warehouses.find((w) => w.systemNaturalId === naturalId),

  clear: () => set({ warehouses: [] }),
}));
