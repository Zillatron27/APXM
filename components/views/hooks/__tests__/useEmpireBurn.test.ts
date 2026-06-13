import { describe, it, expect } from 'vitest';
import { sortEmpireRows } from '../useEmpireBurn';
import type { BurnRate } from '../../../../core/burn';

function makeRate(
  overrides: Partial<BurnRate> & { materialTicker: string }
): BurnRate {
  return {
    dailyAmount: 0,
    type: 'workforce',
    productionInput: 0,
    productionOutput: 0,
    workforceConsumption: 0,
    inventoryAmount: 0,
    daysRemaining: Infinity,
    need: 0,
    urgency: 'ok',
    ...overrides,
  };
}

describe('sortEmpireRows', () => {
  it('sorts consuming materials first by days remaining, then surplus alphabetically', () => {
    const rows = sortEmpireRows([
      makeRate({ materialTicker: 'ZZZ', dailyAmount: 5, inventoryAmount: 1 }),
      makeRate({ materialTicker: 'DW', dailyAmount: -2, daysRemaining: 10, inventoryAmount: 20 }),
      makeRate({ materialTicker: 'AAA', dailyAmount: 3, inventoryAmount: 1 }),
      makeRate({ materialTicker: 'RAT', dailyAmount: -4, daysRemaining: 2, inventoryAmount: 8 }),
    ]);

    expect(rows.map((r) => r.materialTicker)).toEqual(['RAT', 'DW', 'AAA', 'ZZZ']);
  });

  it('drops inactive rows (no stock, no rate, no need)', () => {
    const rows = sortEmpireRows([
      makeRate({ materialTicker: 'IDLE' }),
      makeRate({ materialTicker: 'STOCKED', inventoryAmount: 5 }),
      makeRate({ materialTicker: 'NEEDED', need: 12 }),
    ]);

    expect(rows.map((r) => r.materialTicker)).toEqual(['NEEDED', 'STOCKED']);
  });

  it('does not mutate its input', () => {
    const input = [
      makeRate({ materialTicker: 'B', dailyAmount: -1, daysRemaining: 1, inventoryAmount: 1 }),
      makeRate({ materialTicker: 'A', dailyAmount: -1, daysRemaining: 0.5, inventoryAmount: 1 }),
    ];
    sortEmpireRows(input);
    expect(input.map((r) => r.materialTicker)).toEqual(['B', 'A']);
  });
});
