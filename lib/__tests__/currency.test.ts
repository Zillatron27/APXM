import { describe, it, expect } from 'vitest';
import { primaryCurrencyFor, sortBalances } from '../currency';
import type { PrunApi } from '../../types/prun-api';

function balance(currency: string, amount = 1000): PrunApi.CurrencyAmount {
  return { currency, amount };
}

describe('primaryCurrencyFor', () => {
  it('maps known faction countryIds to their currency', () => {
    expect(primaryCurrencyFor('AI')).toBe('AIC');
    expect(primaryCurrencyFor('CI')).toBe('CIS');
    expect(primaryCurrencyFor('IC')).toBe('ICA');
    expect(primaryCurrencyFor('NC')).toBe('NCC');
  });

  it('returns null for unknown countryIds', () => {
    expect(primaryCurrencyFor('XX')).toBeNull();
    expect(primaryCurrencyFor('')).toBeNull();
  });
});

describe('sortBalances', () => {
  it('filters out ECD', () => {
    const result = sortBalances([balance('ECD'), balance('AIC')], null);
    expect(result.map((b) => b.currency)).toEqual(['AIC']);
  });

  it('puts the primary currency first, rest alphabetical', () => {
    const result = sortBalances(
      [balance('AIC'), balance('NCC'), balance('CIS'), balance('ICA')],
      'NCC'
    );
    expect(result.map((b) => b.currency)).toEqual(['NCC', 'AIC', 'CIS', 'ICA']);
  });

  it('falls back to alphabetical when primary is null (unresolved countryId)', () => {
    const result = sortBalances(
      [balance('NCC'), balance('AIC'), balance('ICA')],
      null
    );
    expect(result.map((b) => b.currency)).toEqual(['AIC', 'ICA', 'NCC']);
  });

  it('falls back to alphabetical when the primary currency has no balance', () => {
    const result = sortBalances([balance('NCC'), balance('CIS')], 'AIC');
    expect(result.map((b) => b.currency)).toEqual(['CIS', 'NCC']);
  });

  it('does not mutate the input array', () => {
    const input = [balance('NCC'), balance('AIC')];
    sortBalances(input, null);
    expect(input.map((b) => b.currency)).toEqual(['NCC', 'AIC']);
  });
});
