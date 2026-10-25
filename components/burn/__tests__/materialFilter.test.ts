import { describe, expect, it } from 'vitest';
import type { BurnRate, Urgency } from '../../../core/burn';
import {
  countMaterialsByFilter,
  filterMaterials,
  type MaterialFilter,
} from '../materialFilter';

function burn(materialTicker: string, urgency: Urgency): BurnRate {
  return {
    materialTicker,
    dailyAmount: -1,
    type: 'input',
    productionInput: 0,
    productionOutput: 0,
    workforceConsumption: 1,
    inventoryAmount: 10,
    inboundAmount: 0,
    daysRemaining: 10,
    need: 0,
    urgency,
  };
}

const burns = [
  burn('RAT', 'critical'),
  burn('DW', 'warning'),
  burn('OVE', 'ok'),
  burn('H2O', 'ok'),
  burn('FE', 'surplus'),
];

const select = (...ids: MaterialFilter[]) => new Set<MaterialFilter>(ids);
const tickers = (rows: BurnRate[]) => rows.map((b) => b.materialTicker);

describe('countMaterialsByFilter', () => {
  it('counts each urgency and the total', () => {
    expect(countMaterialsByFilter(burns)).toEqual({
      critical: 1,
      warning: 1,
      ok: 2,
      surplus: 1,
      all: 5,
    });
  });
});

describe('filterMaterials', () => {
  it('ALL shows every row', () => {
    expect(filterMaterials(burns, select('all'))).toHaveLength(5);
  });

  it('INF shows only surplus rows', () => {
    expect(tickers(filterMaterials(burns, select('surplus')))).toEqual(['FE']);
  });

  it('GREEN shows only ok rows', () => {
    expect(tickers(filterMaterials(burns, select('ok')))).toEqual(['OVE', 'H2O']);
  });

  it('multi-select is a union', () => {
    expect(tickers(filterMaterials(burns, select('critical', 'warning')))).toEqual(['RAT', 'DW']);
  });

  it('returns nothing when no row matches', () => {
    expect(filterMaterials([burn('RAT', 'critical')], select('surplus'))).toEqual([]);
  });
});
