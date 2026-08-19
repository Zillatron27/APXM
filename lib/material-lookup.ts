/**
 * Material ticker → category lookup, backed by the static category map
 * (FIO storage payloads carry category ids, not names, so the static map is
 * the authoritative source).
 */

import { MATERIAL_CATEGORIES } from './material-categories';

/**
 * Returns the category for a material ticker.
 * Uses static map which has correct category names.
 *
 * Note: FIO storage returns category ID (hash), not category name,
 * so static map is the primary source for category lookups.
 */
export function getMaterialCategory(ticker: string): string {
  // Ensure uppercase for consistent lookup
  const normalizedTicker = ticker.toUpperCase();
  return MATERIAL_CATEGORIES[normalizedTicker] ?? '';
}

