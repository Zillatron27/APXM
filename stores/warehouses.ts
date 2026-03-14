import { create } from 'zustand';

export interface WarehouseLocation {
  warehouseId: string;
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
}

export const useWarehouseStore = create<WarehouseState>((set, get) => ({
  warehouses: [],
  setWarehouses: (warehouses) => set({ warehouses }),
  addWarehouse: (warehouse) =>
    set((state) => {
      const existing = state.warehouses.findIndex((w) => w.warehouseId === warehouse.warehouseId);
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
}));
