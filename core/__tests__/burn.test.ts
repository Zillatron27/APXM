import { describe, it, expect, beforeEach } from 'vitest';
import type { PrunApi } from '../../types/prun-api';
import {
  getOrdersForCalculation,
  calculateProductionRates,
  calculateWorkforceConsumption,
  getInventoryFromStores,
  classifyBurnType,
  classifyBurnStatus,
  classifyUrgency,
  calculateNeed,
  getSiteNameFromAddress,
  findMostUrgent,
  calculateSiteBurn,
  calculateAllBurns,
  type BurnRate,
  type BurnThresholds,
} from '../burn';
import { useSettingsStore } from '../../stores/settings';
import { useSitesStore } from '../../stores/entities/sites';
import { useProductionStore } from '../../stores/entities/production';
import { useWorkforceStore } from '../../stores/entities/workforce';
import { useStorageStore } from '../../stores/entities/storage';
import {
  createProductionOrder,
  createTestProductionLine,
  createWorkforce,
  createNeed,
  createMaterial,
  createMaterialAmountValue,
  createTestStorage,
  createStoreItem,
  createAddress,
  createTestSite,
  createTimeSpan,
  resetIdCounter,
  createStorageWithItems,
  createOrderWithIO,
} from '../../__tests__/fixtures/factories';
import type { WorkforceEntity } from '../../stores/entities/workforce';

const MS_PER_DAY = 86400000;

describe('burn.ts', () => {
  beforeEach(() => {
    resetIdCounter();
    // Clear all stores
    useSettingsStore.getState().reset();
    useSitesStore.getState().clear();
    useProductionStore.getState().clear();
    useWorkforceStore.getState().clear();
    useStorageStore.getState().clear();
  });

  // ==========================================================================
  // Unit Tests: Pure Helper Functions
  // ==========================================================================

  describe('getOrdersForCalculation', () => {
    it('returns empty array for empty input', () => {
      expect(getOrdersForCalculation([])).toEqual([]);
    });

    it('returns all orders when none are recurring', () => {
      const orders = [
        createProductionOrder({ recurring: false }),
        createProductionOrder({ recurring: false }),
      ];
      expect(getOrdersForCalculation(orders)).toHaveLength(2);
    });

    it('returns only recurring orders when some are recurring', () => {
      const recurring1 = createProductionOrder({ recurring: true });
      const nonRecurring = createProductionOrder({ recurring: false });
      const recurring2 = createProductionOrder({ recurring: true });
      const orders = [recurring1, nonRecurring, recurring2];

      const result = getOrdersForCalculation(orders);
      expect(result).toHaveLength(2);
      expect(result.every((o) => o.recurring)).toBe(true);
    });

    it('returns all recurring orders when all are recurring', () => {
      const orders = [
        createProductionOrder({ recurring: true }),
        createProductionOrder({ recurring: true }),
      ];
      expect(getOrdersForCalculation(orders)).toHaveLength(2);
    });
  });

  describe('calculateProductionRates', () => {
    it('returns empty map for no lines', () => {
      const rates = calculateProductionRates([]);
      expect(rates.size).toBe(0);
    });

    it('returns empty map for lines with no orders', () => {
      const line = createTestProductionLine({ orders: [] });
      const rates = calculateProductionRates([line]);
      expect(rates.size).toBe(0);
    });

    it('calculates input rate correctly for single line', () => {
      const order = createOrderWithIO(
        [{ ticker: 'H2O', amount: 4 }],
        [{ ticker: 'RAT', amount: 10 }],
        MS_PER_DAY // 1 day duration
      );
      const line = createTestProductionLine({ orders: [order], capacity: 1 });

      const rates = calculateProductionRates([line]);

      expect(rates.get('H2O')?.input).toBe(4); // 4 per day
      expect(rates.get('RAT')?.output).toBe(10); // 10 per day
    });

    it('applies capacity multiplier correctly', () => {
      const order = createOrderWithIO(
        [{ ticker: 'H2O', amount: 4 }],
        [{ ticker: 'RAT', amount: 10 }],
        MS_PER_DAY
      );
      const line = createTestProductionLine({ orders: [order], capacity: 3 });

      const rates = calculateProductionRates([line]);

      expect(rates.get('H2O')?.input).toBe(12); // 4 × 3
      expect(rates.get('RAT')?.output).toBe(30); // 10 × 3
    });

    it('handles multiple orders in queue (totals duration)', () => {
      const order1 = createOrderWithIO(
        [{ ticker: 'H2O', amount: 4 }],
        [{ ticker: 'RAT', amount: 10 }],
        MS_PER_DAY / 2 // 12 hours
      );
      const order2 = createOrderWithIO(
        [{ ticker: 'H2O', amount: 2 }],
        [{ ticker: 'RAT', amount: 5 }],
        MS_PER_DAY / 2 // 12 hours
      );
      const line = createTestProductionLine({
        orders: [order1, order2],
        capacity: 1,
      });

      const rates = calculateProductionRates([line]);

      // Total duration = 1 day, total input = 6, total output = 15
      expect(rates.get('H2O')?.input).toBe(6);
      expect(rates.get('RAT')?.output).toBe(15);
    });

    it('handles null duration gracefully', () => {
      const order = createProductionOrder({ duration: null });
      const line = createTestProductionLine({ orders: [order] });

      const rates = calculateProductionRates([line]);
      expect(rates.size).toBe(0);
    });

    it('handles zero duration gracefully', () => {
      const order = createOrderWithIO(
        [{ ticker: 'H2O', amount: 4 }],
        [{ ticker: 'RAT', amount: 10 }],
        0
      );
      const line = createTestProductionLine({ orders: [order] });

      const rates = calculateProductionRates([line]);
      expect(rates.size).toBe(0);
    });

    it('accumulates rates across multiple lines', () => {
      const order1 = createOrderWithIO(
        [{ ticker: 'H2O', amount: 4 }],
        [{ ticker: 'RAT', amount: 10 }],
        MS_PER_DAY
      );
      const order2 = createOrderWithIO(
        [{ ticker: 'H2O', amount: 2 }],
        [{ ticker: 'RAT', amount: 5 }],
        MS_PER_DAY
      );
      const line1 = createTestProductionLine({
        orders: [order1],
        capacity: 1,
      });
      const line2 = createTestProductionLine({
        orders: [order2],
        capacity: 1,
      });

      const rates = calculateProductionRates([line1, line2]);

      expect(rates.get('H2O')?.input).toBe(6); // 4 + 2
      expect(rates.get('RAT')?.output).toBe(15); // 10 + 5
    });

    it('preserves material name', () => {
      const order = createOrderWithIO(
        [{ ticker: 'H2O', name: 'Water', amount: 4 }],
        [{ ticker: 'RAT', name: 'Basic Rations', amount: 10 }],
        MS_PER_DAY
      );
      const line = createTestProductionLine({ orders: [order] });

      const rates = calculateProductionRates([line]);

      expect(rates.get('H2O')?.name).toBe('Water');
      expect(rates.get('RAT')?.name).toBe('Basic Rations');
    });
  });

  describe('calculateWorkforceConsumption', () => {
    it('returns empty map for no workforces', () => {
      const rates = calculateWorkforceConsumption([]);
      expect(rates.size).toBe(0);
    });

    it('calculates consumption from single workforce tier', () => {
      const workforce = createWorkforce({
        needs: [
          createNeed({
            material: createMaterial({ ticker: 'RAT' }),
            unitsPerInterval: 4,
          }),
          createNeed({
            material: createMaterial({ ticker: 'DW' }),
            unitsPerInterval: 5,
          }),
        ],
      });

      const rates = calculateWorkforceConsumption([workforce]);

      expect(rates.get('RAT')?.consumption).toBe(4);
      expect(rates.get('DW')?.consumption).toBe(5);
    });

    it('accumulates consumption from multiple tiers', () => {
      const pioneers = createWorkforce({
        level: 'PIONEER',
        needs: [
          createNeed({
            material: createMaterial({ ticker: 'RAT' }),
            unitsPerInterval: 4,
          }),
        ],
      });
      const settlers = createWorkforce({
        level: 'SETTLER',
        needs: [
          createNeed({
            material: createMaterial({ ticker: 'RAT' }),
            unitsPerInterval: 3,
          }),
        ],
      });

      const rates = calculateWorkforceConsumption([pioneers, settlers]);

      expect(rates.get('RAT')?.consumption).toBe(7); // 4 + 3
    });

    it('handles same material from different tiers', () => {
      const pioneers = createWorkforce({
        needs: [
          createNeed({
            material: createMaterial({ ticker: 'DW', name: 'Drinking Water' }),
            unitsPerInterval: 5,
          }),
        ],
      });
      const settlers = createWorkforce({
        needs: [
          createNeed({
            material: createMaterial({ ticker: 'DW', name: 'Drinking Water' }),
            unitsPerInterval: 8,
          }),
        ],
      });

      const rates = calculateWorkforceConsumption([pioneers, settlers]);

      expect(rates.get('DW')?.consumption).toBe(13);
      expect(rates.get('DW')?.name).toBe('Drinking Water');
    });
  });

  describe('getInventoryFromStores', () => {
    it('returns empty map for no stores', () => {
      const inventory = getInventoryFromStores([]);
      expect(inventory.size).toBe(0);
    });

    it('extracts inventory from STORE type only', () => {
      const baseStore = createStorageWithItems(
        'site-1',
        [{ ticker: 'RAT', amount: 100 }],
        'STORE'
      );
      const shipStore = createStorageWithItems(
        'site-1',
        [{ ticker: 'RAT', amount: 50 }],
        'SHIP_STORE'
      );

      const inventory = getInventoryFromStores([baseStore, shipStore]);

      expect(inventory.get('RAT')).toBe(100); // Only base store counts
    });

    it('ignores WAREHOUSE_STORE', () => {
      const warehouseStore = createStorageWithItems(
        'site-1',
        [{ ticker: 'RAT', amount: 200 }],
        'WAREHOUSE_STORE'
      );

      const inventory = getInventoryFromStores([warehouseStore]);

      expect(inventory.size).toBe(0);
    });

    it('excludes WAREHOUSE_STORE when combined with STORE', () => {
      // STORE has 100 RAT, WAREHOUSE_STORE has 1000 RAT
      // Only the STORE's 100 should count for burn calculations
      const baseStore = createStorageWithItems(
        'site-1',
        [{ ticker: 'RAT', amount: 100 }],
        'STORE'
      );
      const warehouseStore = createStorageWithItems(
        'site-1',
        [{ ticker: 'RAT', amount: 1000 }],
        'WAREHOUSE_STORE'
      );

      const inventory = getInventoryFromStores([baseStore, warehouseStore]);

      expect(inventory.get('RAT')).toBe(100);
    });

    it('accumulates from multiple base stores', () => {
      const store1 = createStorageWithItems(
        'site-1',
        [{ ticker: 'RAT', amount: 100 }],
        'STORE'
      );
      const store2 = createStorageWithItems(
        'site-1',
        [{ ticker: 'RAT', amount: 50 }],
        'STORE'
      );

      const inventory = getInventoryFromStores([store1, store2]);

      expect(inventory.get('RAT')).toBe(150);
    });

    it('handles null quantity gracefully', () => {
      const store = createTestStorage({
        type: 'STORE',
        items: [createStoreItem({ quantity: null })],
      });

      const inventory = getInventoryFromStores([store]);

      expect(inventory.size).toBe(0);
    });
  });

  describe('classifyBurnType', () => {
    it('returns output when net positive', () => {
      // net = output - input - workforce = 10 - 3 - 0 = 7 > 0
      expect(classifyBurnType(3, 10, 0)).toBe('output');
    });

    it('returns input when consuming and has production input', () => {
      // net = 5 - 10 - 0 = -5 < 0, has production input
      expect(classifyBurnType(10, 5, 0)).toBe('input');
    });

    it('returns workforce when consuming without production input', () => {
      // net = 0 - 0 - 5 = -5 < 0, no production input
      expect(classifyBurnType(0, 0, 5)).toBe('workforce');
    });

    it('prioritizes input over workforce when both present', () => {
      // net = 0 - 5 - 3 = -8 < 0, has production input
      expect(classifyBurnType(5, 0, 3)).toBe('input');
    });
  });

  describe('classifyUrgency', () => {
    const thresholds: BurnThresholds = { critical: 3, warning: 5, resupply: 30 };

    it('returns surplus when net positive', () => {
      expect(classifyUrgency(Infinity, 5, thresholds)).toBe('surplus');
    });

    it('returns critical when days remaining <= critical threshold', () => {
      expect(classifyUrgency(0, -10, thresholds)).toBe('critical');
      expect(classifyUrgency(2, -10, thresholds)).toBe('critical');
      expect(classifyUrgency(3, -10, thresholds)).toBe('critical');
    });

    it('returns warning when days remaining <= warning threshold', () => {
      expect(classifyUrgency(3.01, -10, thresholds)).toBe('warning');
      expect(classifyUrgency(4, -10, thresholds)).toBe('warning');
      expect(classifyUrgency(5, -10, thresholds)).toBe('warning');
    });

    it('returns ok when days remaining > warning threshold', () => {
      expect(classifyUrgency(5.01, -10, thresholds)).toBe('ok');
      expect(classifyUrgency(10, -10, thresholds)).toBe('ok');
    });

    it('handles exact boundary values', () => {
      expect(classifyUrgency(3, -10, thresholds)).toBe('critical');
      expect(classifyUrgency(5, -10, thresholds)).toBe('warning');
    });
  });

  describe('calculateNeed', () => {
    it('returns 0 when not consuming', () => {
      expect(calculateNeed(5, 100, 5)).toBe(0);
      expect(calculateNeed(0, 100, 5)).toBe(0);
    });

    it('calculates need to reach warning threshold', () => {
      // threshold = 5 days, consumption = 10/day, target = 50
      // current = 20, need = 30
      expect(calculateNeed(-10, 20, 5)).toBe(30);
    });

    it('returns 0 when inventory already above threshold', () => {
      // threshold = 5 days, consumption = 10/day, target = 50
      // current = 60, need = 0
      expect(calculateNeed(-10, 60, 5)).toBe(0);
    });

    it('calculates full need when inventory is 0', () => {
      // threshold = 5 days, consumption = 10/day, target = 50
      expect(calculateNeed(-10, 0, 5)).toBe(50);
    });
  });

  describe('getSiteNameFromAddress', () => {
    it('extracts planet name', () => {
      const address = createAddress({ planetName: 'Montem' });
      expect(getSiteNameFromAddress(address)).toBe('Montem');
    });

    it('falls back to naturalId when name is missing', () => {
      const address: PrunApi.Address = {
        lines: [
          {
            type: 'PLANET',
            entity: { id: 'p1', naturalId: 'MONT', name: '' },
          },
        ],
      };
      expect(getSiteNameFromAddress(address)).toBe('MONT');
    });

    it('uses station when no planet', () => {
      const address: PrunApi.Address = {
        lines: [
          {
            type: 'STATION',
            entity: { id: 's1', naturalId: 'STN', name: 'Station Alpha' },
          },
        ],
      };
      expect(getSiteNameFromAddress(address)).toBe('Station Alpha');
    });

    it('returns Unknown for empty address', () => {
      const address: PrunApi.Address = { lines: [] };
      expect(getSiteNameFromAddress(address)).toBe('Unknown');
    });
  });

  describe('findMostUrgent', () => {
    it('returns null for empty burns', () => {
      expect(findMostUrgent([])).toBeNull();
    });

    it('returns null when all burns are output/surplus', () => {
      const burns: BurnRate[] = [
        {
          materialTicker: 'RAT',
          dailyAmount: 5,
          type: 'output',
          productionInput: 0,
          productionOutput: 10,
          workforceConsumption: 5,
          inventoryAmount: 100,
          daysRemaining: Infinity,
          need: 0,
          urgency: 'surplus',
        },
      ];
      expect(findMostUrgent(burns)).toBeNull();
    });

    it('returns burn with lowest daysRemaining', () => {
      const burns: BurnRate[] = [
        {
          materialTicker: 'RAT',
          dailyAmount: -5,
          type: 'input',
          productionInput: 5,
          productionOutput: 0,
          workforceConsumption: 0,
          inventoryAmount: 50,
          daysRemaining: 10,
          need: 0,
          urgency: 'ok',
        },
        {
          materialTicker: 'DW',
          dailyAmount: -10,
          type: 'workforce',
          productionInput: 0,
          productionOutput: 0,
          workforceConsumption: 10,
          inventoryAmount: 20,
          daysRemaining: 2,
          need: 30,
          urgency: 'critical',
        },
      ];

      const result = findMostUrgent(burns);
      expect(result?.materialTicker).toBe('DW');
    });

    it('prioritizes input over workforce when daysRemaining is tied', () => {
      const burns: BurnRate[] = [
        {
          materialTicker: 'DW',
          dailyAmount: -10,
          type: 'workforce',
          productionInput: 0,
          productionOutput: 0,
          workforceConsumption: 10,
          inventoryAmount: 50,
          daysRemaining: 5,
          need: 0,
          urgency: 'warning',
        },
        {
          materialTicker: 'H2O',
          dailyAmount: -10,
          type: 'input',
          productionInput: 10,
          productionOutput: 0,
          workforceConsumption: 0,
          inventoryAmount: 50,
          daysRemaining: 5,
          need: 0,
          urgency: 'warning',
        },
      ];

      const result = findMostUrgent(burns);
      expect(result?.materialTicker).toBe('H2O');
    });
  });

  // ==========================================================================
  // NaN Invariant Tests
  // ==========================================================================

  describe('NaN invariant (daysRemaining is never NaN)', () => {
    it('handles zero-duration order gracefully', () => {
      // Zero duration should not produce NaN - calculateProductionRates
      // guards against this by continuing when totalDurationMs === 0
      const order = createOrderWithIO(
        [{ ticker: 'H2O', amount: 4 }],
        [{ ticker: 'RAT', amount: 10 }],
        0 // zero duration
      );
      const line = createTestProductionLine({ orders: [order] });

      const rates = calculateProductionRates([line]);

      // Should have no rates (guarded by zero duration check)
      expect(rates.size).toBe(0);
    });

    it('handles zero unitsPerInterval workforce need gracefully', () => {
      // Zero consumption is valid - worker doesn't need that material
      const workforce = createWorkforce({
        needs: [
          createNeed({
            material: createMaterial({ ticker: 'RAT' }),
            unitsPerInterval: 0,
          }),
        ],
      });

      const rates = calculateWorkforceConsumption([workforce]);

      const ratRate = rates.get('RAT');
      expect(ratRate?.consumption).toBe(0);
      expect(Number.isFinite(ratRate?.consumption)).toBe(true);
    });

    it('handles zero inventory for consumed material (returns 0, not NaN)', () => {
      // When inventory is 0 and consuming, daysRemaining should be 0
      const workforce = createWorkforce({
        needs: [
          createNeed({
            material: createMaterial({ ticker: 'RAT' }),
            unitsPerInterval: 10,
          }),
        ],
      });

      const wfRates = calculateWorkforceConsumption([workforce]);
      const inventory = new Map<string, number>();
      // No RAT in inventory

      const consumption = wfRates.get('RAT')?.consumption ?? 0;
      const dailyAmount = -consumption;
      const inventoryAmount = inventory.get('RAT') ?? 0;

      // Replicate daysRemaining calculation from calculateSiteBurn
      const daysRemaining =
        dailyAmount >= 0
          ? Infinity
          : inventoryAmount === 0
            ? 0
            : inventoryAmount / Math.abs(dailyAmount);

      expect(Number.isNaN(daysRemaining)).toBe(false);
      expect(daysRemaining).toBe(0);
    });

    it('all burn calculations return finite or Infinity daysRemaining, never NaN', () => {
      // Set up a site with workforce consuming materials with zero inventory
      const siteId = 'nan-test-site';
      const site = createTestSite({
        siteId,
        address: createAddress({ planetName: 'Test' }),
      });
      useSitesStore.getState().setOne(site);

      const workforce: WorkforceEntity = {
        siteId,
        address: createAddress({ planetName: 'Test' }),
        workforces: [
          createWorkforce({
            needs: [
              createNeed({
                material: createMaterial({ ticker: 'RAT' }),
                unitsPerInterval: 10,
              }),
            ],
          }),
        ],
      };
      useWorkforceStore.getState().setOne(workforce);

      // No storage → zero inventory
      const result = calculateSiteBurn(siteId);

      for (const burn of result.burns) {
        expect(Number.isNaN(burn.daysRemaining)).toBe(false);
        expect(
          burn.daysRemaining === Infinity || Number.isFinite(burn.daysRemaining)
        ).toBe(true);
      }
    });
  });

  // ==========================================================================
  // Integration Tests: With Store Setup
  // ==========================================================================

  describe('calculateSiteBurn (integration)', () => {
    const siteId = 'test-site';

    beforeEach(() => {
      // Set up a test site
      const site = createTestSite({
        siteId,
        address: createAddress({ planetName: 'Montem' }),
      });
      useSitesStore.getState().setOne(site);
    });

    it('calculates pioneers-only consumption correctly', () => {
      // Pioneers consuming RAT (4/day) and DW (5/day)
      const workforce: WorkforceEntity = {
        siteId,
        address: createAddress({ planetName: 'Montem' }),
        workforces: [
          createWorkforce({
            level: 'PIONEER',
            needs: [
              createNeed({
                material: createMaterial({ ticker: 'RAT' }),
                unitsPerInterval: 4,
              }),
              createNeed({
                material: createMaterial({ ticker: 'DW' }),
                unitsPerInterval: 5,
              }),
            ],
          }),
        ],
      };
      useWorkforceStore.getState().setOne(workforce);

      // Inventory: 20 RAT, 25 DW
      const store = createStorageWithItems(siteId, [
        { ticker: 'RAT', amount: 20 },
        { ticker: 'DW', amount: 25 },
      ]);
      useStorageStore.getState().setOne(store);

      const result = calculateSiteBurn(siteId);

      expect(result.siteName).toBe('Montem');
      expect(result.burns).toHaveLength(2);

      const ratBurn = result.burns.find((b) => b.materialTicker === 'RAT');
      expect(ratBurn?.dailyAmount).toBe(-4);
      expect(ratBurn?.type).toBe('workforce');
      expect(ratBurn?.daysRemaining).toBe(5); // 20 / 4
      expect(ratBurn?.urgency).toBe('warning'); // exactly at warning threshold

      const dwBurn = result.burns.find((b) => b.materialTicker === 'DW');
      expect(dwBurn?.dailyAmount).toBe(-5);
      expect(dwBurn?.daysRemaining).toBe(5); // 25 / 5
    });

    it('handles FRM producing RAT while pioneers consume RAT', () => {
      // FRM producing 10 RAT/day, consuming 4 H2O/day
      const order = createOrderWithIO(
        [{ ticker: 'H2O', amount: 4 }],
        [{ ticker: 'RAT', amount: 10 }],
        MS_PER_DAY
      );
      const prodLine = createTestProductionLine({
        siteId,
        orders: [order],
        capacity: 1,
      });
      useProductionStore.getState().setOne(prodLine);

      // Pioneers consuming 4 RAT/day
      const workforce: WorkforceEntity = {
        siteId,
        address: createAddress({ planetName: 'Montem' }),
        workforces: [
          createWorkforce({
            needs: [
              createNeed({
                material: createMaterial({ ticker: 'RAT' }),
                unitsPerInterval: 4,
              }),
            ],
          }),
        ],
      };
      useWorkforceStore.getState().setOne(workforce);

      const store = createStorageWithItems(siteId, [
        { ticker: 'RAT', amount: 100 },
        { ticker: 'H2O', amount: 40 },
      ]);
      useStorageStore.getState().setOne(store);

      const result = calculateSiteBurn(siteId);

      // RAT: +10 (production) - 4 (workforce) = +6 net
      const ratBurn = result.burns.find((b) => b.materialTicker === 'RAT');
      expect(ratBurn?.dailyAmount).toBe(6);
      expect(ratBurn?.type).toBe('output');
      expect(ratBurn?.daysRemaining).toBe(Infinity);
      expect(ratBurn?.urgency).toBe('surplus');

      // H2O: -4 (production input)
      const h2oBurn = result.burns.find((b) => b.materialTicker === 'H2O');
      expect(h2oBurn?.dailyAmount).toBe(-4);
      expect(h2oBurn?.type).toBe('input');
      expect(h2oBurn?.daysRemaining).toBe(10); // 40 / 4
    });

    it('sums DW consumed by both workforce AND production', () => {
      // Production consuming 2 DW/day
      const order = createOrderWithIO(
        [{ ticker: 'DW', amount: 2 }],
        [{ ticker: 'RAT', amount: 5 }],
        MS_PER_DAY
      );
      const prodLine = createTestProductionLine({
        siteId,
        orders: [order],
        capacity: 1,
      });
      useProductionStore.getState().setOne(prodLine);

      // Workforce consuming 5 DW/day
      const workforce: WorkforceEntity = {
        siteId,
        address: createAddress({ planetName: 'Montem' }),
        workforces: [
          createWorkforce({
            needs: [
              createNeed({
                material: createMaterial({ ticker: 'DW' }),
                unitsPerInterval: 5,
              }),
            ],
          }),
        ],
      };
      useWorkforceStore.getState().setOne(workforce);

      const store = createStorageWithItems(siteId, [{ ticker: 'DW', amount: 70 }]);
      useStorageStore.getState().setOne(store);

      const result = calculateSiteBurn(siteId);

      const dwBurn = result.burns.find((b) => b.materialTicker === 'DW');
      // Net: -2 (prod input) - 5 (workforce) = -7
      expect(dwBurn?.dailyAmount).toBe(-7);
      expect(dwBurn?.productionInput).toBe(2);
      expect(dwBurn?.workforceConsumption).toBe(5);
      expect(dwBurn?.type).toBe('input'); // production input takes priority
      expect(dwBurn?.daysRemaining).toBe(10); // 70 / 7
    });

    it('handles multiple workforce tiers (Pioneer + Settler)', () => {
      const workforce: WorkforceEntity = {
        siteId,
        address: createAddress({ planetName: 'Montem' }),
        workforces: [
          createWorkforce({
            level: 'PIONEER',
            needs: [
              createNeed({
                material: createMaterial({ ticker: 'RAT' }),
                unitsPerInterval: 4,
              }),
            ],
          }),
          createWorkforce({
            level: 'SETTLER',
            needs: [
              createNeed({
                material: createMaterial({ ticker: 'RAT' }),
                unitsPerInterval: 3,
              }),
            ],
          }),
        ],
      };
      useWorkforceStore.getState().setOne(workforce);

      const store = createStorageWithItems(siteId, [{ ticker: 'RAT', amount: 35 }]);
      useStorageStore.getState().setOne(store);

      const result = calculateSiteBurn(siteId);

      const ratBurn = result.burns.find((b) => b.materialTicker === 'RAT');
      expect(ratBurn?.workforceConsumption).toBe(7); // 4 + 3
      expect(ratBurn?.daysRemaining).toBe(5); // 35 / 7
    });

    it('returns 0 daysRemaining when inventory is 0', () => {
      const workforce: WorkforceEntity = {
        siteId,
        address: createAddress({ planetName: 'Montem' }),
        workforces: [
          createWorkforce({
            needs: [
              createNeed({
                material: createMaterial({ ticker: 'RAT' }),
                unitsPerInterval: 4,
              }),
            ],
          }),
        ],
      };
      useWorkforceStore.getState().setOne(workforce);

      // No storage or empty storage
      const store = createStorageWithItems(siteId, []);
      useStorageStore.getState().setOne(store);

      const result = calculateSiteBurn(siteId);

      const ratBurn = result.burns.find((b) => b.materialTicker === 'RAT');
      expect(ratBurn?.daysRemaining).toBe(0);
      expect(ratBurn?.urgency).toBe('critical');
    });

    it('returns Infinity daysRemaining for net positive production', () => {
      const order = createOrderWithIO(
        [],
        [{ ticker: 'LSE', amount: 10 }],
        MS_PER_DAY
      );
      const prodLine = createTestProductionLine({
        siteId,
        orders: [order],
        capacity: 1,
      });
      useProductionStore.getState().setOne(prodLine);

      const store = createStorageWithItems(siteId, [{ ticker: 'LSE', amount: 50 }]);
      useStorageStore.getState().setOne(store);

      const result = calculateSiteBurn(siteId);

      const lseBurn = result.burns.find((b) => b.materialTicker === 'LSE');
      expect(lseBurn?.daysRemaining).toBe(Infinity);
      expect(lseBurn?.urgency).toBe('surplus');
    });

    it('handles empty production queue (no contribution)', () => {
      const prodLine = createTestProductionLine({ siteId, orders: [] });
      useProductionStore.getState().setOne(prodLine);

      const workforce: WorkforceEntity = {
        siteId,
        address: createAddress({ planetName: 'Montem' }),
        workforces: [
          createWorkforce({
            needs: [
              createNeed({
                material: createMaterial({ ticker: 'RAT' }),
                unitsPerInterval: 4,
              }),
            ],
          }),
        ],
      };
      useWorkforceStore.getState().setOne(workforce);

      const result = calculateSiteBurn(siteId);

      // Only workforce consumption, no production
      const ratBurn = result.burns.find((b) => b.materialTicker === 'RAT');
      expect(ratBurn?.productionInput).toBe(0);
      expect(ratBurn?.productionOutput).toBe(0);
      expect(ratBurn?.workforceConsumption).toBe(4);
    });

    it('uses only recurring orders when present (mixed queue)', () => {
      // Non-recurring order: 10 output
      const nonRecurring = createOrderWithIO(
        [],
        [{ ticker: 'RAT', amount: 10 }],
        MS_PER_DAY,
        false
      );
      // Recurring order: 5 output
      const recurring = createOrderWithIO(
        [],
        [{ ticker: 'RAT', amount: 5 }],
        MS_PER_DAY,
        true
      );
      const prodLine = createTestProductionLine({
        siteId,
        orders: [nonRecurring, recurring],
        capacity: 1,
      });
      useProductionStore.getState().setOne(prodLine);

      const result = calculateSiteBurn(siteId);

      // Should only use recurring order (5 per day)
      const ratBurn = result.burns.find((b) => b.materialTicker === 'RAT');
      expect(ratBurn?.productionOutput).toBe(5);
    });

    it('calculates need using resupply target (not warning threshold)', () => {
      const workforce: WorkforceEntity = {
        siteId,
        address: createAddress({ planetName: 'Montem' }),
        workforces: [
          createWorkforce({
            needs: [
              createNeed({
                material: createMaterial({ ticker: 'RAT' }),
                unitsPerInterval: 10,
              }),
            ],
          }),
        ],
      };
      useWorkforceStore.getState().setOne(workforce);

      // Default resupply = 30 days, consumption = 10/day
      // target = 30 × 10 = 300, inventory = 20, need = 280
      const store = createStorageWithItems(siteId, [{ ticker: 'RAT', amount: 20 }]);
      useStorageStore.getState().setOne(store);

      const result = calculateSiteBurn(siteId);

      const ratBurn = result.burns.find((b) => b.materialTicker === 'RAT');
      expect(ratBurn?.need).toBe(280);
    });

    it('uses custom resupply threshold for need calculation', () => {
      useSettingsStore.getState().setBurnThresholds({ resupply: 14 });

      const workforce: WorkforceEntity = {
        siteId,
        address: createAddress({ planetName: 'Montem' }),
        workforces: [
          createWorkforce({
            needs: [
              createNeed({
                material: createMaterial({ ticker: 'RAT' }),
                unitsPerInterval: 10,
              }),
            ],
          }),
        ],
      };
      useWorkforceStore.getState().setOne(workforce);

      // resupply = 14, consumption = 10/day
      // target = 14 × 10 = 140, inventory = 20, need = 120
      const store = createStorageWithItems(siteId, [{ ticker: 'RAT', amount: 20 }]);
      useStorageStore.getState().setOne(store);

      const result = calculateSiteBurn(siteId);

      const ratBurn = result.burns.find((b) => b.materialTicker === 'RAT');
      expect(ratBurn?.need).toBe(120);
    });

    it('handles missing workforce gracefully (production burns only)', () => {
      // Site with production but no workforce entry
      const order = createOrderWithIO(
        [{ ticker: 'H2O', amount: 4 }],
        [{ ticker: 'RAT', amount: 10 }],
        MS_PER_DAY
      );
      const prodLine = createTestProductionLine({
        siteId,
        orders: [order],
        capacity: 1,
      });
      useProductionStore.getState().setOne(prodLine);

      const store = createStorageWithItems(siteId, [{ ticker: 'H2O', amount: 40 }]);
      useStorageStore.getState().setOne(store);

      // No workforce set for this site
      const result = calculateSiteBurn(siteId);

      // Should have production burns without crashing
      expect(result.burns.length).toBeGreaterThan(0);
      const h2oBurn = result.burns.find((b) => b.materialTicker === 'H2O');
      expect(h2oBurn?.productionInput).toBe(4);
      expect(h2oBurn?.workforceConsumption).toBe(0);
    });

    it('handles missing production gracefully (workforce burns only)', () => {
      // Site with workforce but no production entry
      const workforce: WorkforceEntity = {
        siteId,
        address: createAddress({ planetName: 'Montem' }),
        workforces: [
          createWorkforce({
            needs: [
              createNeed({
                material: createMaterial({ ticker: 'RAT' }),
                unitsPerInterval: 4,
              }),
            ],
          }),
        ],
      };
      useWorkforceStore.getState().setOne(workforce);

      const store = createStorageWithItems(siteId, [{ ticker: 'RAT', amount: 20 }]);
      useStorageStore.getState().setOne(store);

      // No production set for this site
      const result = calculateSiteBurn(siteId);

      // Should have workforce burns without crashing
      expect(result.burns.length).toBeGreaterThan(0);
      const ratBurn = result.burns.find((b) => b.materialTicker === 'RAT');
      expect(ratBurn?.workforceConsumption).toBe(4);
      expect(ratBurn?.productionInput).toBe(0);
      expect(ratBurn?.productionOutput).toBe(0);
    });

    it('handles missing storage gracefully (inventory treated as 0)', () => {
      // Site with workforce but no storage entry
      const workforce: WorkforceEntity = {
        siteId,
        address: createAddress({ planetName: 'Montem' }),
        workforces: [
          createWorkforce({
            needs: [
              createNeed({
                material: createMaterial({ ticker: 'RAT' }),
                unitsPerInterval: 4,
              }),
            ],
          }),
        ],
      };
      useWorkforceStore.getState().setOne(workforce);

      // No storage set for this site
      const result = calculateSiteBurn(siteId);

      // Should calculate burns with inventory = 0
      const ratBurn = result.burns.find((b) => b.materialTicker === 'RAT');
      expect(ratBurn?.inventoryAmount).toBe(0);
      expect(ratBurn?.daysRemaining).toBe(0);
      expect(ratBurn?.urgency).toBe('critical');
    });

    it('identifies mostUrgent correctly', () => {
      const workforce: WorkforceEntity = {
        siteId,
        address: createAddress({ planetName: 'Montem' }),
        workforces: [
          createWorkforce({
            needs: [
              createNeed({
                material: createMaterial({ ticker: 'RAT' }),
                unitsPerInterval: 10,
              }),
              createNeed({
                material: createMaterial({ ticker: 'DW' }),
                unitsPerInterval: 5,
              }),
            ],
          }),
        ],
      };
      useWorkforceStore.getState().setOne(workforce);

      // RAT: 20 / 10 = 2 days (critical)
      // DW: 30 / 5 = 6 days (ok)
      const store = createStorageWithItems(siteId, [
        { ticker: 'RAT', amount: 20 },
        { ticker: 'DW', amount: 30 },
      ]);
      useStorageStore.getState().setOne(store);

      const result = calculateSiteBurn(siteId);

      expect(result.mostUrgent?.materialTicker).toBe('RAT');
      expect(result.mostUrgent?.daysRemaining).toBe(2);
    });

    it('changing thresholds changes urgency classification', () => {
      const workforce: WorkforceEntity = {
        siteId,
        address: createAddress({ planetName: 'Montem' }),
        workforces: [
          createWorkforce({
            needs: [
              createNeed({
                material: createMaterial({ ticker: 'RAT' }),
                unitsPerInterval: 10,
              }),
            ],
          }),
        ],
      };
      useWorkforceStore.getState().setOne(workforce);

      // 40 RAT / 10 per day = 4 days remaining
      const store = createStorageWithItems(siteId, [{ ticker: 'RAT', amount: 40 }]);
      useStorageStore.getState().setOne(store);

      // Default thresholds: critical=3, warning=5
      // 4 days → warning (between critical and warning)
      const result1 = calculateSiteBurn(siteId);
      expect(result1.burns.find((b) => b.materialTicker === 'RAT')?.urgency).toBe('warning');

      // Raise warning to 3 (same as critical) — 4 days is now "ok"
      useSettingsStore.getState().setBurnThresholds({ critical: 2, warning: 3 });
      const result2 = calculateSiteBurn(siteId);
      expect(result2.burns.find((b) => b.materialTicker === 'RAT')?.urgency).toBe('ok');
    });
  });

  describe('calculateAllBurns', () => {
    it('calculates burns for all sites', () => {
      const site1 = createTestSite({
        siteId: 'site-1',
        address: createAddress({ planetName: 'Montem' }),
      });
      const site2 = createTestSite({
        siteId: 'site-2',
        address: createAddress({ planetName: 'Promitor' }),
      });
      useSitesStore.getState().setAll([site1, site2]);

      const results = calculateAllBurns();

      expect(results).toHaveLength(2);
      expect(results.map((r) => r.siteId).sort()).toEqual(['site-1', 'site-2']);
    });

    it('returns empty array when no sites exist', () => {
      const results = calculateAllBurns();
      expect(results).toEqual([]);
    });
  });

  describe('classifyBurnStatus', () => {
    const thresholds: BurnThresholds = { critical: 3, warning: 5, resupply: 30 };

    it('returns unknown when no consuming burns', () => {
      const result = classifyBurnStatus([], thresholds);
      expect(result).toEqual({ burnStatus: 'unknown', lowestBurnDays: null });
    });

    it('returns unknown when only output burns', () => {
      const result = classifyBurnStatus(
        [{ type: 'output', daysRemaining: 10 }],
        thresholds,
      );
      expect(result).toEqual({ burnStatus: 'unknown', lowestBurnDays: null });
    });

    it('returns ok with null days when all consuming burns are Infinity', () => {
      const result = classifyBurnStatus(
        [
          { type: 'workforce', daysRemaining: Infinity },
          { type: 'input', daysRemaining: Infinity },
        ],
        thresholds,
      );
      expect(result).toEqual({ burnStatus: 'ok', lowestBurnDays: null });
    });

    it('returns critical when lowest days <= critical threshold', () => {
      const result = classifyBurnStatus(
        [
          { type: 'workforce', daysRemaining: 2 },
          { type: 'input', daysRemaining: 10 },
        ],
        thresholds,
      );
      expect(result).toEqual({ burnStatus: 'critical', lowestBurnDays: 2 });
    });

    it('returns critical at exactly the critical threshold', () => {
      const result = classifyBurnStatus(
        [{ type: 'workforce', daysRemaining: 3 }],
        thresholds,
      );
      expect(result).toEqual({ burnStatus: 'critical', lowestBurnDays: 3 });
    });

    it('returns warning when lowest days > critical but <= warning', () => {
      const result = classifyBurnStatus(
        [{ type: 'input', daysRemaining: 4 }],
        thresholds,
      );
      expect(result).toEqual({ burnStatus: 'warning', lowestBurnDays: 4 });
    });

    it('returns warning at exactly the warning threshold', () => {
      const result = classifyBurnStatus(
        [{ type: 'workforce', daysRemaining: 5 }],
        thresholds,
      );
      expect(result).toEqual({ burnStatus: 'warning', lowestBurnDays: 5 });
    });

    it('returns ok when lowest days > warning threshold', () => {
      const result = classifyBurnStatus(
        [{ type: 'workforce', daysRemaining: 6 }],
        thresholds,
      );
      expect(result).toEqual({ burnStatus: 'ok', lowestBurnDays: 6 });
    });

    it('picks lowest across mixed workforce and input types', () => {
      const result = classifyBurnStatus(
        [
          { type: 'workforce', daysRemaining: 10 },
          { type: 'input', daysRemaining: 2 },
          { type: 'output', daysRemaining: 1 }, // output ignored
        ],
        thresholds,
      );
      expect(result).toEqual({ burnStatus: 'critical', lowestBurnDays: 2 });
    });

    it('ignores output type when determining status', () => {
      const result = classifyBurnStatus(
        [
          { type: 'output', daysRemaining: 0 },
          { type: 'workforce', daysRemaining: 10 },
        ],
        thresholds,
      );
      expect(result).toEqual({ burnStatus: 'ok', lowestBurnDays: 10 });
    });
  });
});
