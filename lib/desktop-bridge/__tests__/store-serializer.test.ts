import { describe, it, expect } from 'vitest';
import type { PrunApi } from '../../../types/prun-api';
import { extractPlanetInfo, extractSystemNaturalId } from '../store-serializer';

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
