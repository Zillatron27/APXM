import { describe, it, expect, beforeEach } from 'vitest';
import {
  useMaterialsStore,
  useCxStore,
  getCxEntry,
} from '../reference';

describe('reference stores', () => {
  beforeEach(() => {
    useMaterialsStore.getState().clear();
    useCxStore.getState().clear();
  });

  describe('getCxEntry', () => {
    beforeEach(() => {
      useCxStore.getState().setAll([
        {
          ticker: 'RAT',
          exchangeCode: 'AI1',
          bid: 101,
          ask: 110,
          priceAverage: 105.5,
          supply: 5000,
          demand: 3200,
          mmBuy: null,
          mmSell: null,
        },
        {
          ticker: 'RAT',
          exchangeCode: 'CI1',
          bid: 95,
          ask: 99,
          priceAverage: 97,
          supply: 800,
          demand: 1200,
          mmBuy: null,
          mmSell: null,
        },
      ]);
    });

    it('looks up by the composite ticker + exchange key', () => {
      expect(getCxEntry('RAT', 'AI1')?.priceAverage).toBe(105.5);
      expect(getCxEntry('RAT', 'CI1')?.priceAverage).toBe(97);
    });

    it('is case-insensitive on both parts', () => {
      expect(getCxEntry('rat', 'ai1')?.ask).toBe(110);
    });

    it('returns undefined for an unknown pair', () => {
      expect(getCxEntry('RAT', 'NC1')).toBeUndefined();
    });
  });
});
