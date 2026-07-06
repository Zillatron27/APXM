// Material bill math: resupply (burn-based) and repair (age-prorated),
// driven through populated APXM stores — the numbers the user will act on.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { computeResupplyBill } from '../material-groups/resupply/bill';
import '../material-groups/repair/repair'; // side-effect: registers the Repair group
import { act } from '../act-registry';
import { Logger } from '../runner/logger';
import { useSitesStore } from '../../../stores/entities/sites';
import { useStorageStore } from '../../../stores/entities/storage';
import { useWorkforceStore } from '../../../stores/entities/workforce';
import { useProductionStore } from '../../../stores/entities/production';
import {
  resetIdCounter,
  createTestSite,
  createTestWorkforce,
  createWorkforce,
  createNeed,
  createMaterial,
  createMaterialAmount,
  createTestProductionLine,
  createOrderWithIO,
  createStorageWithItems,
  createPlatform,
  createPlatformModule,
  createDateTime,
} from '../../../__tests__/fixtures/factories';

const DAY_MS = 86_400_000;
const SITE = 'site-r';

beforeEach(() => {
  resetIdCounter();
  useSitesStore.getState().clear();
  useStorageStore.getState().clear();
  useWorkforceStore.getState().clear();
  useProductionStore.getState().clear();
});

describe('resupply bill (computeResupplyBill)', () => {
  // Fixture: workforce eats 4 DW + 4 RAT per day; production consumes
  // 10 H2O/day and produces 20 RAT/day; base inventory holds 5 DW.
  // Net daily: RAT +16 (surplus, never billed), DW −4, H2O −10.
  function seedSite() {
    useSitesStore.getState().setAll([createTestSite({ siteId: SITE })]);
    useWorkforceStore.getState().setAll([
      createTestWorkforce({
        siteId: SITE,
        workforces: [
          createWorkforce({
            needs: [
              createNeed({ material: createMaterial({ ticker: 'DW' }), unitsPerInterval: 4 }),
              createNeed({ material: createMaterial({ ticker: 'RAT' }), unitsPerInterval: 4 }),
            ],
          }),
        ],
      }),
    ]);
    useProductionStore.getState().setAll([
      createTestProductionLine({
        siteId: SITE,
        capacity: 1,
        orders: [
          createOrderWithIO([{ ticker: 'H2O', amount: 10 }], [{ ticker: 'RAT', amount: 20 }], DAY_MS),
        ],
      }),
    ]);
    useStorageStore.getState().setAll([createStorageWithItems(SITE, [{ ticker: 'DW', amount: 5 }])]);
  }

  it('bills deficit materials for N days: ceil(consumed − inventory + 1)', () => {
    seedSite();
    const bill = computeResupplyBill({ type: 'Resupply' }, 'MONTEM', 10);
    // DW: 10d × 4 = 40 consumed, 5 in stock → ceil(40 − 5 + 1) = 36.
    // H2O: 10d × 10 = 100, none in stock → 101. RAT is net-positive → absent.
    expect(bill).toEqual({ DW: 36, H2O: 101 });
  });

  it('consumablesOnly filters to workforce-demanded materials', () => {
    seedSite();
    const bill = computeResupplyBill({ type: 'Resupply', consumablesOnly: true }, 'MONTEM', 10);
    expect(bill).toEqual({ DW: 36 });
  });

  it('exclusions drop tickers from the bill', () => {
    seedSite();
    const bill = computeResupplyBill({ type: 'Resupply', exclusions: ['DW'] }, 'MONTEM', 10);
    expect(bill).toEqual({ H2O: 101 });
  });

  it('useBaseInv: false ignores base inventory', () => {
    seedSite();
    const bill = computeResupplyBill({ type: 'Resupply', useBaseInv: false }, 'MONTEM', 10);
    expect(bill?.DW).toBe(41); // ceil(40 − 0 + 1)
  });

  it('returns undefined when the site or its workforce data is missing', () => {
    expect(computeResupplyBill({ type: 'Resupply' }, 'MONTEM', 10)).toBeUndefined();
    useSitesStore.getState().setAll([createTestSite({ siteId: SITE })]);
    expect(computeResupplyBill({ type: 'Resupply' }, 'MONTEM', 10)).toBeUndefined();
  });
});

describe('repair bill (Repair material group)', () => {
  const NOW = new Date('2026-07-06T00:00:00Z').getTime();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function seedPlatform(overrides: {
    ageDays: number;
    lastRepairAgeDays?: number;
    moduleType?: 'PRODUCTION' | 'CORE';
  }) {
    const platform = createPlatform({
      module: createPlatformModule({ type: overrides.moduleType ?? 'PRODUCTION' }),
      creationTime: createDateTime(NOW - overrides.ageDays * DAY_MS),
      lastRepair:
        overrides.lastRepairAgeDays === undefined
          ? null
          : createDateTime(NOW - overrides.lastRepairAgeDays * DAY_MS),
      // 10 reclaimable + 20 repair = 30 BSE at full (180-day) proration.
      reclaimableMaterials: [
        createMaterialAmount({ material: createMaterial({ ticker: 'BSE' }), amount: 10 }),
      ],
      repairMaterials: [
        createMaterialAmount({ material: createMaterial({ ticker: 'BSE' }), amount: 20 }),
      ],
    });
    useSitesStore.getState().setAll([createTestSite({ siteId: SITE, platforms: [platform] })]);
  }

  async function repairBill(data: Partial<UserData.MaterialGroupData> = {}) {
    const info = act.getMaterialGroupInfo('Repair');
    expect(info).toBeDefined();
    return info!.generateMaterialBill({
      data: { type: 'Repair', planet: 'MONTEM', days: 60, advanceDays: 0, ...data },
      config: {},
      log: new Logger(() => {}),
      setStatus: () => {},
      setPrices: () => {},
    });
  }

  it('prorates materials by age/180: a 90-day-old building needs half', async () => {
    seedPlatform({ ageDays: 90 });
    expect(await repairBill()).toEqual({ BSE: 15 }); // ceil(30 × 90 / 180)
  });

  it('caps at the full amount past 180 days', async () => {
    seedPlatform({ ageDays: 200 });
    expect(await repairBill()).toEqual({ BSE: 30 });
  });

  it('advanceDays shifts the age forward for both threshold and proration', async () => {
    seedPlatform({ ageDays: 50 });
    // 50 + 20 = 70 ≥ threshold 60 → included, prorated at 70/180.
    expect(await repairBill({ advanceDays: 20 })).toEqual({ BSE: 12 }); // ceil(30 × 70 / 180)
  });

  it('skips buildings younger than the day threshold', async () => {
    seedPlatform({ ageDays: 30 });
    expect(await repairBill()).toEqual({});
  });

  it('skips non-repairable building types (CORE/HAB/STORAGE never repair)', async () => {
    seedPlatform({ ageDays: 200, moduleType: 'CORE' });
    expect(await repairBill()).toEqual({});
  });

  it('ages from lastRepair when the building has been repaired', async () => {
    seedPlatform({ ageDays: 200, lastRepairAgeDays: 90 });
    expect(await repairBill()).toEqual({ BSE: 15 }); // 90 days since repair, not 200
  });
});
