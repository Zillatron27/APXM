import { describe, it, expect } from 'vitest';
import { listOwnDestinations, CX_STATIONS } from '../send-ship';
import { createTestShip, createTestSite, createAddress } from '../../__tests__/fixtures/factories';
import type { PrunApi } from '../../types/prun-api';

function stationAddress(naturalId: string, name: string): PrunApi.Address {
  return {
    lines: [
      { type: 'SYSTEM', entity: { id: 's', naturalId: 'SYS', name: 'Sys' } },
      { type: 'STATION', entity: { id: 'st', naturalId, name } },
    ],
  } as PrunApi.Address;
}

describe('listOwnDestinations', () => {
  it('lists bases (label = "name (naturalId)") then stations, A–Z', () => {
    const ship = createTestShip({ address: createAddress({ planetName: 'Zebra' }) });
    const sites = [
      createTestSite({ address: createAddress({ planetName: 'Montem' }) }),
      createTestSite({ address: createAddress({ planetName: 'Antares I - Bober' }) }),
    ];
    const list = listOwnDestinations(ship, sites);
    expect(list[0].label).toMatch(/^Antares I - Bober \(/);
    expect(list[1].label).toMatch(/^Montem \(/);
    expect(list.slice(2)).toEqual(CX_STATIONS);
  });

  it("excludes the ship's current planet", () => {
    const here = createAddress({ planetName: 'Montem' });
    const ship = createTestShip({ address: here });
    const sites = [createTestSite({ address: here })];
    const list = listOwnDestinations(ship, sites);
    expect(list.every((d) => !d.label.startsWith('Montem'))).toBe(true);
  });

  it("excludes the ship's current station", () => {
    const ship = createTestShip({ address: stationAddress('ANT', 'Antares Station') });
    const list = listOwnDestinations(ship, []);
    expect(list.some((d) => d.naturalId === 'ANT')).toBe(false);
    expect(list.some((d) => d.naturalId === 'BEN')).toBe(true);
  });
});
