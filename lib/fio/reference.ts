/**
 * FIO Public Reference Data Coordinator
 *
 * Populates the materials and CX reference stores from FIO's public
 * (no-auth) endpoints at startup.
 */

import { fetchAllMaterials, fetchExchangeAll } from './client';
import { transformAllMaterials, transformAllExchange } from './transforms';
import { useMaterialsStore, useCxStore } from '../../stores/reference';
import { warn } from '../debug/logger';

/**
 * Fetches public reference data for any store not already populated — a
 * fresh cache rehydration counts as populated, so within TTL this is a
 * no-op. Fetches run sequentially (rate-limit politeness, mirroring
 * populateStoresFromFio) and the function is fire-and-forget safe: a
 * failed endpoint is logged and skipped, never thrown, and one endpoint
 * failing doesn't block the other.
 */
export async function ensureReferenceData(): Promise<void> {
  if (!useMaterialsStore.getState().fetched) {
    const result = await fetchAllMaterials();
    if (result.ok) {
      useMaterialsStore.getState().setAll(transformAllMaterials(result.data));
      useMaterialsStore.getState().setFetched('fio');
    } else {
      warn('FIO materials reference fetch failed:', result.error.message);
    }
  }

  if (!useCxStore.getState().fetched) {
    const result = await fetchExchangeAll();
    if (result.ok) {
      useCxStore.getState().setAll(transformAllExchange(result.data));
      useCxStore.getState().setFetched('fio');
    } else {
      warn('FIO exchange reference fetch failed:', result.error.message);
    }
  }
}
