// Refuel planning: source pick + amount arithmetic. atSameLocation resolves
// store locations through the sites/warehouses/ships stores, so fixtures
// populate those (planet-based: site address vs ship address by naturalId).

import { describe, it, expect, beforeEach } from 'vitest';
import { planRefuel } from '../refuel';
import type { MaterialInfo } from '../../stores/reference';
import { useSitesStore, useShipsStore } from '../../stores/entities';
import {
  createTestShip,
  createTestSite,
  createTestStorage,
  createAddress,
} from '../../__tests__/fixtures/factories';
import type { PrunApi } from '../../types/prun-api';

const SF: MaterialInfo = {
  ticker: 'SF',
  name: 'stlFuel',
  category: 'fuels',
  weight: 0.06,
  volume: 0.06,
};

function fuelItem(ticker: string, amount: number): PrunApi.StoreItem {
  return {
    id: `item-${ticker}-${amount}`,
    type: 'INVENTORY',
    quantity: {
      material: { ticker, name: ticker, id: ticker, category: 'c', weight: 0.06, volume: 0.06 },
      amount,
      weight: amount * 0.06,
      volume: amount * 0.06,
    },
    weight: amount * 0.06,
    volume: amount * 0.06,
  } as unknown as PrunApi.StoreItem;
}

/** A ship docked at a planet with a base whose storage holds SF. */
function seed(opts: { tankLoad?: number; sourceSF?: number } = {}) {
  const address = createAddress({ planetName: 'Montem' });
  const ship = createTestShip({ id: 'ship-1', address });
  const site = createTestSite({ siteId: 'site-1', address });
  useShipsStore.getState().setAll([ship]);
  useSitesStore.getState().setAll([site]);

  const tank = createTestStorage({
    id: ship.idStlFuelStore,
    addressableId: ship.id,
    type: 'STL_FUEL_STORE',
    volumeLoad: opts.tankLoad ?? 78.72, // 1312 units of 0.06
    volumeCapacity: 90, // 1500 units
    items: [fuelItem('SF', (opts.tankLoad ?? 78.72) / 0.06)],
  });
  const source = createTestStorage({
    id: 'store-base',
    addressableId: site.siteId,
    type: 'STORE',
    items: [fuelItem('SF', opts.sourceSF ?? 20000)],
  });
  return { ship, site, tank, source };
}

beforeEach(() => {
  useShipsStore.getState().clear();
  useSitesStore.getState().clear();
});

describe('planRefuel', () => {
  it('fills the tank from the local store, capped by deficit', () => {
    const { ship, tank, source } = seed();
    const plan = planRefuel(ship, [tank, source], SF, 'stl');
    expect(plan).toMatchObject({ available: true, units: 188 }); // (90-78.72)/0.06
    expect(plan.available && plan.sourceStore.id).toBe('store-base');
  });

  it('caps the amount at the source stock', () => {
    const { ship, tank, source } = seed({ sourceSF: 50 });
    const plan = planRefuel(ship, [tank, source], SF, 'stl');
    expect(plan).toMatchObject({ available: true, units: 50 });
  });

  it('largest stock wins among multiple sources', () => {
    const { ship, site, tank, source } = seed({ sourceSF: 100 });
    const bigger = createTestStorage({
      id: 'store-big',
      addressableId: site.siteId,
      type: 'STORE',
      items: [fuelItem('SF', 500)],
    });
    const plan = planRefuel(ship, [tank, source, bigger], SF, 'stl');
    expect(plan.available && plan.sourceStore.id).toBe('store-big');
  });

  it('ignores stores at other locations', () => {
    const { ship, tank } = seed();
    const elsewhereSite = createTestSite({
      siteId: 'site-2',
      address: createAddress({ planetName: 'Promitor' }),
    });
    useSitesStore.getState().setAll([...useSitesStore.getState().getAll(), elsewhereSite]);
    const farStore = createTestStorage({
      id: 'store-far',
      addressableId: 'site-2',
      type: 'STORE',
      items: [fuelItem('SF', 9999)],
    });
    const plan = planRefuel(ship, [tank, farStore], SF, 'stl');
    expect(plan).toMatchObject({ available: false, reason: 'no-fuel-here' });
  });

  it("never sources from the ship's own stores", () => {
    const { ship, tank } = seed();
    // A cargo hold full of SF is not a refuel source (game mechanic: fuel
    // moves via the transfer wizard, but self-transfer is what APEX's own
    // flow covers; the one-tap only pulls from location stores).
    const hold = createTestStorage({
      id: ship.idShipStore,
      addressableId: ship.id,
      type: 'SHIP_STORE',
      items: [fuelItem('SF', 400)],
    });
    const plan = planRefuel(ship, [tank, hold], SF, 'stl');
    expect(plan).toMatchObject({ available: false, reason: 'no-fuel-here' });
  });

  it('reports tank-full when there is no deficit', () => {
    const { ship, tank, source } = seed({ tankLoad: 90 });
    const plan = planRefuel(ship, [tank, source], SF, 'stl');
    expect(plan).toMatchObject({ available: false, reason: 'tank-full' });
  });

  it('reports no-reference-data without the material record', () => {
    const { ship, tank, source } = seed();
    const plan = planRefuel(ship, [tank, source], undefined, 'stl');
    expect(plan).toMatchObject({ available: false, reason: 'no-reference-data' });
  });
});
