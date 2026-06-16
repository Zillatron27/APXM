import { describe, it, expect } from 'vitest';
import { primaryCurrencyFor, sortBalances } from '../currency';
import type { PrunApi } from '../../types/prun-api';

function balance(currency: string, amount = 1000): PrunApi.CurrencyAmount {
  return { currency, amount };
}

describe('primaryCurrencyFor', () => {
  // GUID keys from FIO GET /global/countries (CountryRegistryCountryId).
  // COMPANY_DATA delivers these GUIDs as countryId, not the 2-letter code.
  it('maps known faction countryId GUIDs to their currency', () => {
    expect(primaryCurrencyFor('18419e6fd11b5af8bf0d0a996ad1a622')).toBe('AIC');
    expect(primaryCurrencyFor('981c095a8ddc128232a149e109448ed8')).toBe('CIS');
    expect(primaryCurrencyFor('4a2fe1ae3e1ca07dcfebbdf25c4b8d6a')).toBe('ICA');
    expect(primaryCurrencyFor('a6d40e12e79f0b2d644bfe0880fd219d')).toBe('NCC');
  });

  it('returns null for unknown countryIds', () => {
    // 2-letter codes are the pre-#57 bug: they must NOT resolve.
    expect(primaryCurrencyFor('AI')).toBeNull();
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
