import { browser } from 'wxt/browser';
import { persistedStores } from './create-entity-store';
import { warn } from '../lib/debug/logger';

function isContextInvalidated(error: unknown): boolean {
  return String(error).includes('Extension context invalidated');
}

/**
 * Rehydrates all persisted entity stores from browser.storage.local.
 * Runs in parallel since stores are independent.
 */
export async function rehydrateAllStores(): Promise<void> {
  await Promise.all(persistedStores.map((s) => s.rehydrate()));
}

/**
 * Clears all APXM cache entries from browser.storage.local.
 */
export async function clearAllCache(): Promise<void> {
  const keys = persistedStores.map((s) => s.key);
  if (keys.length === 0) return;

  try {
    await browser.storage.local.remove(keys);
  } catch (err) {
    if (!isContextInvalidated(err)) {
      warn('Failed to clear all cache keys:', err);
    }
  }
}
