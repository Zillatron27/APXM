// Ship-store labels in the ACT engine: MTRA names its origin/destination with
// serializeStorage and resolves them back with deserializeStorage. An unnamed
// ship has no name, so it must go by its registration and still round-trip.

import { describe, it, expect, beforeEach } from 'vitest';
import { serializeStorage, deserializeStorage } from '../actions/utils';
import { useShipsStore } from '../../../stores/entities/ships';
import { useStorageStore } from '../../../stores/entities/storage';
import type { PrunApi } from '../../../types/prun-api';

function ship(id: string, name: string | null, registration: string): PrunApi.Ship {
  return {
    id,
    name,
    registration,
    idShipStore: `${id}-hold`,
    idStlFuelStore: `${id}-stl`,
    idFtlFuelStore: `${id}-ftl`,
  } as unknown as PrunApi.Ship;
}

function store(id: string, addressableId: string, type: PrunApi.StoreType): PrunApi.Store {
  return { id, addressableId, name: null, type, items: [] } as unknown as PrunApi.Store;
}

const unnamedHold = store('u-hold', 'u', 'SHIP_STORE');
const unnamedFtl = store('u-ftl', 'u', 'FTL_FUEL_STORE');
const namedHold = store('n-hold', 'n', 'SHIP_STORE');

beforeEach(() => {
  useShipsStore.getState().setAll([ship('u', null, 'AVI-05432'), ship('n', 'Hauler', 'AVI-01234')]);
  useStorageStore.getState().setAll([unnamedHold, unnamedFtl, namedHold]);
});

describe('ship store labels', () => {
  it('an unnamed ship is labelled by its registration, not "null" or a store id', () => {
    expect(serializeStorage(unnamedHold)).toBe('AVI-05432 Cargo');
    expect(serializeStorage(unnamedFtl)).toBe('AVI-05432 FTL Store');
  });

  it('a named ship is labelled by its name', () => {
    expect(serializeStorage(namedHold)).toBe('Hauler Cargo');
  });

  it('labels round-trip back to the same store', () => {
    for (const s of [unnamedHold, unnamedFtl, namedHold]) {
      expect(deserializeStorage(serializeStorage(s))).toBe(s);
    }
  });

  it('a bare suffix (empty name) resolves to nothing', () => {
    expect(deserializeStorage(' Cargo')).toBeUndefined();
  });
});
