// Ported from refined-prun src/features/XIT/ACT/actions/utils.ts.
// Import paths and store calls adapted for APXM.

import type { PrunApi } from '../../../types/prun-api';
import { useSitesStore } from '../../../stores/entities/sites';
import { useShipsStore } from '../../../stores/entities/ships';
import { useWarehouseStore } from '../../../stores/warehouses';
import { storagesStore, sitesStore } from '../_compat';
import { getEntityDisplayName } from '../../address';

// ---------------------------------------------------------------------------
// serializeStorage — human-readable name for a Store
// ---------------------------------------------------------------------------

export function serializeStorage(storage: PrunApi.Store): string {
  switch (storage.type) {
    case 'STL_FUEL_STORE':
      return (storage.name ?? storage.id) + ' STL Store';
    case 'FTL_FUEL_STORE':
      return (storage.name ?? storage.id) + ' FTL Store';
    case 'SHIP_STORE':
      return (storage.name ?? storage.id) + ' Cargo';
    case 'STORE': {
      const site = useSitesStore.getState().getAll().find(
        (s) => s.siteId === storage.addressableId,
      );
      const label = site
        ? getEntityDisplayName(site.address)
        : (storage.name ?? storage.addressableId);
      return label + ' Base';
    }
    case 'WAREHOUSE_STORE': {
      const wh = useWarehouseStore.getState().warehouses.find(
        (w) => w.warehouseId === storage.addressableId,
      );
      const label = wh?.stationNaturalId ?? wh?.systemNaturalId ?? storage.name ?? storage.addressableId;
      return label + ' Warehouse';
    }
    default:
      return storage.name ?? storage.id;
  }
}

// ---------------------------------------------------------------------------
// deserializeStorage — reverse of serializeStorage
// ---------------------------------------------------------------------------

function extractName(name: string, suffix: string): string | undefined {
  return name.endsWith(' ' + suffix) ? name.slice(0, -(suffix.length + 1)) : undefined;
}

export function deserializeStorage(serializedName: string | undefined): PrunApi.Store | undefined {
  if (!serializedName) return undefined;

  let name: string | undefined;

  name = extractName(serializedName, 'Base');
  if (name) {
    const site = sitesStore.getByPlanetNaturalIdOrName(name);
    return storagesStore.getByAddressableId(site?.siteId).find((x) => x.type === 'STORE');
  }

  name = extractName(serializedName, 'Warehouse');
  if (name) {
    const wh = useWarehouseStore.getState().getByEntityNaturalId(name);
    if (!wh) return undefined;
    return storagesStore.getByAddressableId(wh.warehouseId).find((s) => s.type === 'WAREHOUSE_STORE');
  }

  name = extractName(serializedName, 'Cargo');
  if (name) {
    return storagesStore.getByNameAndType(name, 'SHIP_STORE');
  }

  name = extractName(serializedName, 'FTL Store');
  if (name) {
    return storagesStore.getByNameAndType(name, 'FTL_FUEL_STORE');
  }

  name = extractName(serializedName, 'STL Store');
  if (name) {
    return storagesStore.getByNameAndType(name, 'STL_FUEL_STORE');
  }

  return undefined;
}

// ---------------------------------------------------------------------------
// Address comparison — used by atSameLocation
// ---------------------------------------------------------------------------

function getStoreAddress(store: PrunApi.Store): PrunApi.Address | undefined {
  switch (store.type) {
    case 'STORE': {
      const site = useSitesStore.getState().getById(store.addressableId);
      return site?.address;
    }
    case 'WAREHOUSE_STORE': {
      const wh = useWarehouseStore.getState().warehouses.find(
        (w) => w.warehouseId === store.addressableId,
      );
      if (!wh) return undefined;
      const naturalId = wh.stationNaturalId ?? wh.systemNaturalId;
      if (!naturalId) return undefined;
      const lineType = wh.stationNaturalId ? 'STATION' : 'SYSTEM';
      return {
        lines: [{ type: lineType, entity: { id: naturalId, naturalId, name: naturalId } }],
      } as PrunApi.Address;
    }
    case 'SHIP_STORE':
    case 'STL_FUEL_STORE':
    case 'FTL_FUEL_STORE': {
      const ship = useShipsStore.getState().getById(store.addressableId);
      return ship?.address ?? undefined;
    }
    default:
      return undefined;
  }
}

function isSameAddress(
  a: PrunApi.Address | undefined,
  b: PrunApi.Address | undefined,
): boolean {
  if (!a || !b) return false;
  for (const lineA of a.lines) {
    if (lineA.type !== 'PLANET' && lineA.type !== 'STATION') continue;
    const entityA = (lineA as PrunApi.PlanetAddressLine | PrunApi.StationAddressLine).entity;
    if (!entityA) continue;
    for (const lineB of b.lines) {
      if (lineB.type !== 'PLANET' && lineB.type !== 'STATION') continue;
      const entityB = (lineB as PrunApi.PlanetAddressLine | PrunApi.StationAddressLine).entity;
      if (!entityB) continue;
      if (entityA.naturalId === entityB.naturalId) return true;
    }
  }
  return false;
}

export function atSameLocation(storageA: PrunApi.Store, storageB: PrunApi.Store): boolean {
  if (storageA === storageB) return false;
  return isSameAddress(getStoreAddress(storageA), getStoreAddress(storageB));
}
