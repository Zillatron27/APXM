// Load-cargo planning: per-ticker source pick, both-axes fit arithmetic,
// combined-batch validation. Fixtures mirror core/__tests__/refuel.test.ts.

import { describe, it, expect, beforeEach } from 'vitest';
import { listLoadableMaterials, validateLoadPicks } from '../load-cargo';
import type { MaterialInfo } from '../../stores/reference';
import { useSitesStore, useShipsStore } from '../../stores/entities';
import {
  createTestShip,
  createTestSite,
  createTestStorage,
  createAddress,
} from '../../__tests__/fixtures/factories';
import type { PrunApi } from '../../types/prun-api';

// A dense material (weight-bound) and a bulky one (volume-bound).
const MATERIALS: Record<string, MaterialInfo> = {
  FE: { ticker: 'FE', name: 'iron', category: 'metals', weight: 7.8, volume: 1 },
  RAT: { ticker: 'RAT', name: 'basicRations', category: 'foods', weight: 0.2, volume: 1 },
};
const getMaterial = (t: string) => MATERIALS[t];

function item(ticker: string, amount: number, type = 'INVENTORY'): PrunApi.StoreItem {
  return {
    id: `item-${ticker}-${type}`,
    type,
    quantity: {
      material: { ticker, name: ticker, id: ticker, category: 'c', weight: 1, volume: 1 },
      amount,
      weight: amount,
      volume: amount,
    },
    weight: amount,
    volume: amount,
  } as unknown as PrunApi.StoreItem;
}

function seed(opts: { holdFreeWeight?: number; holdFreeVolume?: number } = {}) {
  const address = createAddress({ planetName: 'Montem' });
  const ship = createTestShip({ id: 'ship-1', address });
  const site = createTestSite({ siteId: 'site-1', address });
  useShipsStore.getState().setAll([ship]);
  useSitesStore.getState().setAll([site]);
  const freeW = opts.holdFreeWeight ?? 100;
  const freeV = opts.holdFreeVolume ?? 100;
  const hold = createTestStorage({
    id: ship.idShipStore,
    addressableId: ship.id,
    type: 'SHIP_STORE',
    weightLoad: 0,
    weightCapacity: freeW,
    volumeLoad: 0,
    volumeCapacity: freeV,
    items: [],
  });
  return { ship, site, hold };
}

beforeEach(() => {
  useShipsStore.getState().clear();
  useSitesStore.getState().clear();
});

describe('listLoadableMaterials', () => {
  it('lists local materials with per-row fit caps (weight- and volume-bound)', () => {
    const { ship, site, hold } = seed();
    const base = createTestStorage({
      id: 'store-base',
      addressableId: site.siteId,
      type: 'STORE',
      items: [item('FE', 1000), item('RAT', 1000)],
    });
    const list = listLoadableMaterials(ship, [hold, base], getMaterial);
    expect(list.available).toBe(true);
    if (!list.available) return;
    const fe = list.materials.find((m) => m.ticker === 'FE');
    const rat = list.materials.find((m) => m.ticker === 'RAT');
    expect(fe?.maxUnits).toBe(12); // weight-bound: floor(100/7.8)
    expect(rat?.maxUnits).toBe(100); // volume-bound: floor(100/1)
  });

  it('per ticker, the largest local stock wins as the source', () => {
    const { ship, site, hold } = seed();
    const small = createTestStorage({
      id: 'store-small',
      addressableId: site.siteId,
      type: 'STORE',
      items: [item('RAT', 50)],
    });
    const big = createTestStorage({
      id: 'store-big',
      addressableId: site.siteId,
      type: 'STORE',
      items: [item('RAT', 500)],
    });
    const list = listLoadableMaterials(ship, [hold, small, big], getMaterial);
    expect(list.available && list.materials[0].sourceStoreId).toBe('store-big');
  });

  it('excludes SHIPMENT items (contract goods are not free stock)', () => {
    const { ship, site, hold } = seed();
    const base = createTestStorage({
      id: 'store-base',
      addressableId: site.siteId,
      type: 'STORE',
      items: [item('RAT', 500, 'SHIPMENT')],
    });
    const list = listLoadableMaterials(ship, [hold, base], getMaterial);
    expect(list).toMatchObject({ available: false, reason: 'nothing-loadable' });
  });

  it('reports hold-full when no free space remains', () => {
    const { ship, site } = seed();
    const fullHold = createTestStorage({
      id: ship.idShipStore,
      addressableId: ship.id,
      type: 'SHIP_STORE',
      weightLoad: 100,
      weightCapacity: 100,
      volumeLoad: 50,
      volumeCapacity: 100,
      items: [],
    });
    const base = createTestStorage({
      id: 'store-base',
      addressableId: site.siteId,
      type: 'STORE',
      items: [item('RAT', 500)],
    });
    const list = listLoadableMaterials(ship, [fullHold, base], getMaterial);
    expect(list).toMatchObject({ available: false, reason: 'hold-full' });
  });
});

describe('validateLoadPicks', () => {
  it('accepts a fitting batch and resolves names + sources', () => {
    const { ship, site, hold } = seed();
    const base = createTestStorage({
      id: 'store-base',
      addressableId: site.siteId,
      type: 'STORE',
      items: [item('FE', 1000), item('RAT', 1000)],
    });
    const result = validateLoadPicks(
      [
        { ticker: 'FE', amount: 5 },
        { ticker: 'RAT', amount: 30 },
      ],
      ship,
      [hold, base],
      getMaterial
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.picks).toHaveLength(2);
      expect(result.picks[0]).toMatchObject({ sourceStoreId: 'store-base' });
    }
  });

  it('refuses a batch whose COMBINED weight exceeds the hold (each alone fits)', () => {
    const { ship, site, hold } = seed();
    const base = createTestStorage({
      id: 'store-base',
      addressableId: site.siteId,
      type: 'STORE',
      items: [item('FE', 1000), item('RAT', 1000)],
    });
    // 10 FE = 78kg... 78 weight; 60 RAT = 12 weight + 60 vol → weight 90 fits,
    // volume 70 fits. Use amounts that individually fit but jointly bust
    // weight: 12 FE (93.6) + 40 RAT (8) = 101.6 > 100.
    const result = validateLoadPicks(
      [
        { ticker: 'FE', amount: 12 },
        { ticker: 'RAT', amount: 40 },
      ],
      ship,
      [hold, base],
      getMaterial
    );
    expect(result).toMatchObject({ ok: false, reason: 'Selection exceeds the hold capacity' });
  });

  it('refuses when a picked material is no longer available (no substitution)', () => {
    const { ship, site, hold } = seed();
    const base = createTestStorage({
      id: 'store-base',
      addressableId: site.siteId,
      type: 'STORE',
      items: [item('RAT', 100)],
    });
    const result = validateLoadPicks(
      [{ ticker: 'FE', amount: 5 }],
      ship,
      [hold, base],
      getMaterial
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('FE');
  });

  it('re-caps amounts to current stock (visible clamp, not a silent one)', () => {
    const { ship, site, hold } = seed();
    const base = createTestStorage({
      id: 'store-base',
      addressableId: site.siteId,
      type: 'STORE',
      items: [item('RAT', 25)],
    });
    const result = validateLoadPicks(
      [{ ticker: 'RAT', amount: 80 }],
      ship,
      [hold, base],
      getMaterial
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.picks[0].amount).toBe(25);
  });
});
