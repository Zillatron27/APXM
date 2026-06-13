import { describe, it, expect, beforeEach } from 'vitest';
import {
  useMaterialsStore,
  useCxStore,
  getMaterialName,
  getCxEntry,
} from '../reference';

describe('reference stores', () => {
  beforeEach(() => {
    useMaterialsStore.getState().clear();
    useCxStore.getState().clear();
  });

  describe('getMaterialName', () => {
    beforeEach(() => {
      useMaterialsStore.getState().setAll([
        { ticker: 'RAT', name: 'Rations', category: 'consumables (basic)', weight: 0.21, volume: 0.1 },
        { ticker: 'DW', name: 'Drinking Water', category: 'consumables (basic)', weight: 0.1, volume: 0.1 },
      ]);
    });

    it('returns the name for a known ticker', () => {
      expect(getMaterialName('RAT')).toBe('Rations');
    });

    it('is case-insensitive on the ticker', () => {
      expect(getMaterialName('dw')).toBe('Drinking Water');
    });

    it('returns undefined for an unknown ticker', () => {
      expect(getMaterialName('XYZ')).toBeUndefined();
    });

    it('returns undefined when the store is empty', () => {
      useMaterialsStore.getState().clear();
      expect(getMaterialName('RAT')).toBeUndefined();
    });
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
