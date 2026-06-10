import type { PrunApi } from '../types/prun-api';

/**
 * Faction countryId → primary currency.
 * Lifted from the archived desktop bridge (desktop-view-archive-20260606).
 * The countryId keys are unverified against live WS data (issue #26) — an
 * unmapped countryId returns null, which degrades to alphabetical ordering.
 */
const COUNTRY_CURRENCY: Record<string, string> = {
  AI: 'AIC',
  CI: 'CIS',
  IC: 'ICA',
  NC: 'NCC',
};

export function primaryCurrencyFor(countryId: string): string | null {
  return COUNTRY_CURRENCY[countryId] ?? null;
}

/**
 * Display order for the liquidity list: ECD filtered out (legacy currency,
 * not spendable), the company's primary currency first, remaining
 * currencies alphabetical.
 */
export function sortBalances(
  balances: PrunApi.CurrencyAmount[],
  primaryCurrency: string | null
): PrunApi.CurrencyAmount[] {
  return balances
    .filter((b) => b.currency !== 'ECD')
    .sort((a, b) => {
      if (a.currency === primaryCurrency) return -1;
      if (b.currency === primaryCurrency) return 1;
      return a.currency.localeCompare(b.currency);
    });
}
