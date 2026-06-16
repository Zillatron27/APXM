import type { PrunApi } from '../types/prun-api';

/**
 * Faction countryId → primary currency.
 *
 * COMPANY_DATA's `countryId` is a GUID (e.g. AI = 18419e6f…), NOT the 2-letter
 * faction code — and no countryCode field travels alongside it, so the GUID is
 * the only faction identifier available (issue #57). The earlier 2-letter keys
 * never matched, leaving every company on the alphabetical fallback; it only
 * looked correct for AI because AIC sorts first alphabetically anyway.
 *
 * Keys verified against FIO `GET /global/countries` (the country registry —
 * CountryRegistryCountryId → CurrencyCode). Faction IDs are immutable game
 * constants, so this stays a static map. An unmapped countryId returns null,
 * which degrades to alphabetical ordering.
 */
const COUNTRY_CURRENCY: Record<string, string> = {
  '18419e6fd11b5af8bf0d0a996ad1a622': 'AIC', // Antares Initiative (AI)
  '981c095a8ddc128232a149e109448ed8': 'CIS', // Castillo-Ito Mercantile (CI)
  '4a2fe1ae3e1ca07dcfebbdf25c4b8d6a': 'ICA', // Insitor Cooperative (IC)
  'a6d40e12e79f0b2d644bfe0880fd219d': 'NCC', // NEO Charter Exploration (NC)
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
