import { describe, it, expect } from 'vitest';
import type { PrunApi } from '../../../types/prun-api';
import { extractPlanetInfo, extractSystemNaturalId, deriveCargoItems } from '../store-serializer';

function makeAddress(...lines: PrunApi.AddressLine[]): PrunApi.Address {
  return { lines };
}

function makeSystemLine(naturalId: string, name?: string): PrunApi.SystemAddressLine {
  return {
    type: 'SYSTEM',
    entity: { id: `sys-${naturalId}`, naturalId, name: name ?? naturalId },
  };
}

function makePlanetLine(naturalId: string, name: string): PrunApi.PlanetAddressLine {
  return {
    type: 'PLANET',
    entity: { id: `planet-${naturalId}`, naturalId, name },
  };
}

function makeStationLine(naturalId: string, name: string): PrunApi.StationAddressLine {
  return {
    type: 'STATION',
    entity: { id: `station-${naturalId}`, naturalId, name },
  };
}

describe('extractPlanetInfo', () => {
  it('returns planet info from a standard site address', () => {
    const address = makeAddress(
      makeSystemLine('UV-351'),
      makePlanetLine('UV-351a', 'Montem'),
    );
    const result = extractPlanetInfo(address);
    expect(result).toEqual({ name: 'Montem', naturalId: 'UV-351a' });
  });

  it('returns null when no PLANET line exists', () => {
    const address = makeAddress(makeSystemLine('UV-351'));
    expect(extractPlanetInfo(address)).toBeNull();
  });

  it('returns null for empty address', () => {
    const address = makeAddress();
    expect(extractPlanetInfo(address)).toBeNull();
  });

  it('returns planet info even without a SYSTEM line (FIO-only)', () => {
    const address = makeAddress(makePlanetLine('YI-215b', 'Verdant'));
    const result = extractPlanetInfo(address);
    expect(result).toEqual({ name: 'Verdant', naturalId: 'YI-215b' });
  });
});

describe('extractSystemNaturalId', () => {
  it('returns system naturalId from a standard address', () => {
    const address = makeAddress(
      makeSystemLine('UV-351'),
      makePlanetLine('UV-351a', 'Montem'),
    );
    expect(extractSystemNaturalId(address)).toBe('UV-351');
  });

  it('returns null when no SYSTEM line exists', () => {
    const address = makeAddress(makePlanetLine('UV-351a', 'Montem'));
    expect(extractSystemNaturalId(address)).toBeNull();
  });

  it('returns null for empty address', () => {
    expect(extractSystemNaturalId(makeAddress())).toBeNull();
  });

  it('handles station addresses with system', () => {
    const address = makeAddress(
      makeSystemLine('AI-228'),
      makeStationLine('AI-228-STN', 'Antares Station'),
    );
    expect(extractSystemNaturalId(address)).toBe('AI-228');
  });
});

function makeStoreItem(overrides: Partial<PrunApi.StoreItem> = {}): PrunApi.StoreItem {
  return {
    id: 'item-1',
    type: 'INVENTORY',
    weight: 10,
    volume: 5,
    quantity: {
      value: { currency: 'AIC', amount: 100 },
      material: {
        id: 'mat-1',
        ticker: 'RAT',
        name: 'Rations',
        category: 'consumables (basic)',
        weight: 0.21,
        volume: 0.1,
        resource: false,
      },
      amount: 50,
    },
    ...overrides,
  };
}

describe('deriveCargoItems', () => {
  it('maps valid items to CargoItem[]', () => {
    const items = [makeStoreItem()];
    const result = deriveCargoItems(items);
    expect(result).toEqual([
      { ticker: 'RAT', category: 'consumables (basic)', amount: 50, weight: 10, volume: 5 },
    ]);
  });

  it('filters out items with null quantity', () => {
    const items = [
      makeStoreItem(),
      makeStoreItem({ id: 'item-2', quantity: null }),
    ];
    const result = deriveCargoItems(items);
    expect(result).toHaveLength(1);
    expect(result[0].ticker).toBe('RAT');
  });

  it('filters out items with undefined quantity', () => {
    const items = [
      makeStoreItem({ id: 'item-3', quantity: undefined }),
    ];
    expect(deriveCargoItems(items)).toEqual([]);
  });

  it('returns empty array for empty input', () => {
    expect(deriveCargoItems([])).toEqual([]);
  });

  it('maps multiple items correctly', () => {
    const items = [
      makeStoreItem(),
      makeStoreItem({
        id: 'item-4',
        weight: 20,
        volume: 15,
        quantity: {
          value: { currency: 'AIC', amount: 200 },
          material: {
            id: 'mat-2',
            ticker: 'DW',
            name: 'Drinking Water',
            category: 'consumables (basic)',
            weight: 0.1,
            volume: 0.1,
            resource: false,
          },
          amount: 100,
        },
      }),
    ];
    const result = deriveCargoItems(items);
    expect(result).toHaveLength(2);
    expect(result[0].ticker).toBe('RAT');
    expect(result[1].ticker).toBe('DW');
    expect(result[1].amount).toBe(100);
    expect(result[1].weight).toBe(20);
  });
});
