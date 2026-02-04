/**
 * Material Ticker to Category Lookup
 *
 * Builds an index from storage store items (which include MaterialCategory from FIO)
 * and provides ticker-to-category lookups. Falls back to static map for known materials.
 */

import { useStorageStore } from '../stores/entities/storage';
import { MATERIAL_CATEGORIES } from './material-categories';

// Memoization state
let cachedLastUpdated: number | null = null;
let categoryIndex: Map<string, string> = new Map();

/**
 * Rebuilds the ticker-to-category index from storage data.
 */
function rebuildIndex(): void {
  const stores = useStorageStore.getState().getAll();
  categoryIndex = new Map();

  for (const store of stores) {
    if (!store.items) continue;
    for (const item of store.items) {
      if (item.quantity?.material) {
        const { ticker, category } = item.quantity.material;
        if (ticker && category) {
          categoryIndex.set(ticker, category);
        }
      }
    }
  }
}

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

/**
 * Clears the cached category index.
 * Call this on store clear/reconnect events.
 */
export function clearMaterialCategoryCache(): void {
  cachedLastUpdated = null;
  categoryIndex = new Map();
}
