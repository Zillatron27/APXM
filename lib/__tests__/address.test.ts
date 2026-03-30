import { describe, it, expect } from 'vitest';
import type { PrunApi } from '../../types/prun-api';
import {
  getEntityDisplayName,
  extractPlanetNaturalId,
  extractSystemNaturalId,
} from '../address';

function makeAddress(...lines: PrunApi.AddressLine[]): PrunApi.Address {
  return { lines };
}

function planet(name: string, naturalId: string): PrunApi.PlanetAddressLine {
  return { type: 'PLANET', entity: { id: 'p1', naturalId, name } };
}

function system(name: string, naturalId: string): PrunApi.SystemAddressLine {
  return { type: 'SYSTEM', entity: { id: 's1', naturalId, name } };
}

function station(name: string, naturalId: string): PrunApi.StationAddressLine {
  return { type: 'STATION', entity: { id: 'st1', naturalId, name } };
}

describe('getEntityDisplayName', () => {
  it('returns planet name for named planets', () => {
    const address = makeAddress(
      system('Moria', 'OT-580'),
      planet('Montem', 'OT-580b')
    );
    expect(getEntityDisplayName(address)).toBe('Montem');
  });

  it('derives name for unnamed planet in named system', () => {
    const address = makeAddress(
      system('Metis', 'LS-014'),
      planet('LS-014b', 'LS-014b')
    );
    expect(getEntityDisplayName(address)).toBe('Metis b');
  });

  it('returns naturalId for unnamed planet in unnamed system', () => {
    const address = makeAddress(
      system('XK-745', 'XK-745'),
      planet('XK-745c', 'XK-745c')
    );
    expect(getEntityDisplayName(address)).toBe('XK-745c');
  });

  it('returns naturalId for unnamed planet with no system line', () => {
    const address = makeAddress(planet('LS-014b', 'LS-014b'));
    expect(getEntityDisplayName(address)).toBe('LS-014b');
  });

  it('returns station name for station address', () => {
    const address = makeAddress(station('Antares Station', 'ANT'));
    expect(getEntityDisplayName(address)).toBe('Antares Station');
  });

  it('returns Unknown for empty address', () => {
    expect(getEntityDisplayName(makeAddress())).toBe('Unknown');
  });

  it('falls through to system derivation when planet name is empty', () => {
    const address = makeAddress(
      system('Moria', 'OT-580'),
      planet('', 'OT-580b')
    );
    expect(getEntityDisplayName(address)).toBe('Moria b');
  });

  it('handles multi-letter planet suffix', () => {
    const address = makeAddress(
      system('Romulan', 'ZV-759'),
      planet('ZV-759d', 'ZV-759d')
    );
    expect(getEntityDisplayName(address)).toBe('Romulan d');
  });
});

describe('extractPlanetNaturalId', () => {
  it('returns planet naturalId when present', () => {
    const address = makeAddress(planet('Montem', 'OT-580b'));
    expect(extractPlanetNaturalId(address)).toBe('OT-580b');
  });

  it('returns null when no planet line', () => {
    const address = makeAddress(station('ANT', 'ANT'));
    expect(extractPlanetNaturalId(address)).toBeNull();
  });
});

describe('extractSystemNaturalId', () => {
  it('returns system naturalId when present', () => {
    const address = makeAddress(system('Moria', 'OT-580'));
    expect(extractSystemNaturalId(address)).toBe('OT-580');
  });

  it('returns null when no system line', () => {
    const address = makeAddress(planet('Montem', 'OT-580b'));
    expect(extractSystemNaturalId(address)).toBeNull();
  });
});
