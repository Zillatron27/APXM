import { describe, it, expect, beforeEach } from 'vitest';
import {
  billTotals,
  calculateRepairBill,
  calculateResupplyBill,
  calculateStorageFit,
  FIT_DAYS_MAX,
  getBaseWarehouseStock,
  getSiteResupplyBill,
  maxFittingDays,
  netAgainstCxWarehouse,
  type MaterialBill,
} from '../resupply';
import type { BurnRate } from '../burn';
import { useSettingsStore } from '../../stores/settings';
import { useSitesStore } from '../../stores/entities/sites';
import { useWorkforceStore } from '../../stores/entities/workforce';
import { useStorageStore } from '../../stores/entities/storage';
import {
  createAddress,
  createMaterial,
  createMaterialAmount,
  createNeed,
  createPlatform,
  createPlatformModule,
  createStorageWithItems,
  createTestSite,
  createWorkforce,
  resetIdCounter,
} from '../../__tests__/fixtures/factories';

/** A net consumer of `perDay`/day holding `inventoryAmount` (store + allocation + inbound). */
function consumer(ticker: string, perDay: number, inventoryAmount = 0): BurnRate {
  return {
    materialTicker: ticker,
    dailyAmount: -perDay,
    type: 'workforce',
    productionInput: 0,
    productionOutput: 0,
    workforceConsumption: perDay,
    inventoryAmount,
    inboundAmount: 0,
    daysRemaining: perDay === 0 ? Infinity : inventoryAmount / perDay,
    need: 0,
    urgency: 'ok',
  };
}

const noStock = new Map<string, number>();
const qty = (bill: MaterialBill) =>
  Object.fromEntries(Object.entries(bill).map(([t, e]) => [t, e.quantity]));

describe('calculateResupplyBill', () => {
  it('bills days x consumption less inventory and warehouse, rounded up', () => {
    // 10 days x 4.5 = 45; 20 held + 5 in warehouse -> 20
    const bill = calculateResupplyBill([consumer('RAT', 4.5, 20)], 10, new Map([['RAT', 5]]));
    expect(qty(bill)).toEqual({ RAT: 20 });
  });

  it('rounds a fractional shortfall up to the next whole unit', () => {
    // 3 x 1.5 = 4.5 needed, none held -> 5
    expect(qty(calculateResupplyBill([consumer('RAT', 1.5)], 3, noStock))).toEqual({ RAT: 5 });
  });

  it('bills nothing when stock exactly covers the days', () => {
    expect(calculateResupplyBill([consumer('RAT', 2, 15)], 10, new Map([['RAT', 5]]))).toEqual({});
  });

  it('clamps to zero when stock exceeds the need', () => {
    expect(calculateResupplyBill([consumer('RAT', 1, 500)], 10, noStock)).toEqual({});
  });

  it('skips net producers and balanced chains', () => {
    const producer: BurnRate = { ...consumer('H2O', 0), dailyAmount: 6 };
    const noise: BurnRate = { ...consumer('DW', 0), dailyAmount: -0.0001 };
    expect(calculateResupplyBill([producer, noise], 10, noStock)).toEqual({});
  });

  it('leaves price unknown', () => {
    expect(calculateResupplyBill([consumer('RAT', 1)], 2, noStock).RAT.price).toBeNull();
  });

  it('bills more when inbound is excluded, because inventoryAmount is smaller', () => {
    const withInbound = consumer('RAT', 10, 80); // 80 = 30 store + 50 inbound
    const withoutInbound = consumer('RAT', 10, 30);
    expect(qty(calculateResupplyBill([withInbound], 10, noStock))).toEqual({ RAT: 20 });
    expect(qty(calculateResupplyBill([withoutInbound], 10, noStock))).toEqual({ RAT: 70 });
  });
});

describe('netAgainstCxWarehouse', () => {
  const bill: MaterialBill = {
    RAT: { quantity: 100, price: null },
    DW: { quantity: 40, price: 12 },
    PE: { quantity: 10, price: null },
  };

  it('subtracts CX warehouse stock and drops covered tickers', () => {
    const buy = netAgainstCxWarehouse(bill, new Map([['RAT', 30], ['DW', 40], ['PE', 99]]));
    expect(qty(buy)).toEqual({ RAT: 70 });
  });

  it('keeps an attached price on partially covered tickers', () => {
    expect(netAgainstCxWarehouse(bill, new Map([['DW', 10]])).DW).toEqual({
      quantity: 30,
      price: 12,
    });
  });
});

describe('calculateRepairBill', () => {
  const mats = (ticker: string, amount: number) => [
    createMaterialAmount({ material: createMaterial({ ticker }), amount }),
  ];
  const building = (type: 'PRODUCTION' | 'RESOURCES' | 'CORE' | 'HABITATION' | 'STORAGE') =>
    createPlatform({
      module: createPlatformModule({ type }),
      repairMaterials: mats('MCG', 10),
      repairMaterials24: mats('MCG', 12),
      repairMaterials48: mats('MCG', 15),
    });

  it('sums PRODUCTION and RESOURCES buildings only', () => {
    const platforms = [
      building('PRODUCTION'),
      building('RESOURCES'),
      building('CORE'),
      building('HABITATION'),
      building('STORAGE'),
    ];
    expect(qty(calculateRepairBill(platforms, 'now', noStock, noStock))).toEqual({ MCG: 20 });
  });

  it('reads the chosen horizon', () => {
    const platforms = [building('PRODUCTION')];
    expect(qty(calculateRepairBill(platforms, '24h', noStock, noStock))).toEqual({ MCG: 12 });
    expect(qty(calculateRepairBill(platforms, '48h', noStock, noStock))).toEqual({ MCG: 15 });
  });

  it('nets store and warehouse, floored at zero', () => {
    const platforms = [building('PRODUCTION'), building('PRODUCTION')];
    expect(
      qty(calculateRepairBill(platforms, 'now', new Map([['MCG', 5]]), new Map([['MCG', 7]])))
    ).toEqual({ MCG: 8 });
    expect(calculateRepairBill(platforms, 'now', new Map([['MCG', 50]]), noStock)).toEqual({});
  });
});

describe('billTotals', () => {
  const dims = (ticker: string) =>
    ticker === 'RAT'
      ? { weight: 0.21, volume: 0.1 }
      : ticker === 'MCG'
        ? { weight: 0.5, volume: 0.4 }
        : undefined;

  it('sums weight and volume, ignoring tickers without reference data', () => {
    const bill: MaterialBill = {
      RAT: { quantity: 100, price: null },
      MCG: { quantity: 10, price: null },
      ZZZ: { quantity: 999, price: null },
    };
    const totals = billTotals(bill, dims);
    expect(totals.weight).toBeCloseTo(26);
    expect(totals.volume).toBeCloseTo(14);
  });

  it('is zero for an empty bill', () => {
    expect(billTotals({}, dims)).toEqual({ weight: 0, volume: 0 });
  });
});

describe('maxFittingDays', () => {
  // 1 t and 1 m³ per unit, so capacity is directly in units.
  const unit = () => ({ weight: 1, volume: 1 });

  it('returns the largest whole day count whose bill fits', () => {
    // 10/day, 25 held: day d needs 10d-25; capacity 85 -> d=11 needs 85, d=12 needs 95
    const capacity = { weight: 85, volume: 1000 };
    expect(maxFittingDays([consumer('RAT', 10, 25)], noStock, capacity, unit)).toBe(11);
  });

  it('is limited by whichever dimension is tighter', () => {
    const lookup = () => ({ weight: 1, volume: 2 });
    // volume: 2 per unit and 10 m³ -> 5 units a day; weight alone would allow 100
    const capacity = { weight: 100, volume: 10 };
    expect(maxFittingDays([consumer('RAT', 1)], noStock, capacity, lookup)).toBe(5);
  });

  it('counts warehouse stock toward fitting more days', () => {
    const capacity = { weight: 50, volume: 50 };
    expect(maxFittingDays([consumer('RAT', 10)], new Map([['RAT', 50]]), capacity, unit)).toBe(10);
  });

  it('returns 0 when capacity is smaller than one day', () => {
    const capacity = { weight: 9, volume: 1000 };
    expect(maxFittingDays([consumer('RAT', 10)], noStock, capacity, unit)).toBe(0);
  });

  it('caps at the maximum when nothing is consumed', () => {
    expect(maxFittingDays([], noStock, { weight: 1, volume: 1 }, unit)).toBe(FIT_DAYS_MAX);
  });
});

describe('calculateStorageFit', () => {
  const store = { weightLoad: 400, weightCapacity: 1000, volumeLoad: 200, volumeCapacity: 500 };

  it('fits when both projections stay within capacity, including exactly full', () => {
    expect(calculateStorageFit(store, { weight: 100, volume: 100 })).toEqual({ fits: true });
    expect(calculateStorageFit(store, { weight: 600, volume: 300 })).toEqual({ fits: true });
  });

  it('names weight as binding when only weight overflows', () => {
    expect(calculateStorageFit(store, { weight: 700, volume: 100 })).toEqual({
      fits: false,
      overflowWeight: 100,
      overflowVolume: 0,
      bindingLimit: 't',
    });
  });

  it('names volume as binding when only volume overflows', () => {
    expect(calculateStorageFit(store, { weight: 100, volume: 400 })).toEqual({
      fits: false,
      overflowWeight: 0,
      overflowVolume: 100,
      bindingLimit: 'm³',
    });
  });

  it('names the fuller dimension when both overflow', () => {
    // weight 1100/1000 = 1.1, volume 650/500 = 1.3
    expect(calculateStorageFit(store, { weight: 700, volume: 450 })).toMatchObject({
      fits: false,
      overflowWeight: 100,
      overflowVolume: 150,
      bindingLimit: 'm³',
    });
  });
});

describe('store-reading entry points', () => {
  const siteId = 'resupply-site';

  beforeEach(() => {
    resetIdCounter();
    useSettingsStore.getState().reset();
    useSitesStore.getState().clear();
    useWorkforceStore.getState().clear();
    useStorageStore.getState().clear();
    useSitesStore
      .getState()
      .setOne(createTestSite({ siteId, address: createAddress({ planetName: 'Test' }) }));
    useWorkforceStore.getState().setOne({
      siteId,
      address: createAddress({ planetName: 'Test' }),
      workforces: [
        createWorkforce({
          needs: [
            createNeed({ material: createMaterial({ ticker: 'RAT' }), unitsPerInterval: 10 }),
          ],
        }),
      ],
    });
    useStorageStore
      .getState()
      .setOne(createStorageWithItems(siteId, [{ ticker: 'RAT', amount: 30 }]));
    useStorageStore
      .getState()
      .setOne(createStorageWithItems(siteId, [{ ticker: 'RAT', amount: 25 }], 'WAREHOUSE_STORE'));
  });

  it('reads the base warehouse, not the base store, as warehouse stock', () => {
    expect(getBaseWarehouseStock(siteId).get('RAT')).toBe(25);
  });

  it('nets store and warehouse stock off the site bill', () => {
    // 10 days x 10 = 100 - 30 store - 25 warehouse
    expect(qty(getSiteResupplyBill(siteId, 10))).toEqual({ RAT: 45 });
  });
});
