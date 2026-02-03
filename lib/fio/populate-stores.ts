/**
 * FIO Store Population Coordinator
 *
 * Fetches all FIO data and populates the entity stores.
 */

import { fetchAllFioData } from './client';
import {
  transformAllWorkforce,
  transformAllProduction,
  transformAllStorage,
  transformAllSites,
} from './transforms';
import type { FioConfig, FioAllData, FioError } from './types';
import { useSitesStore } from '../../stores/entities/sites';
import { useStorageStore } from '../../stores/entities/storage';
import { useWorkforceStore } from '../../stores/entities/workforce';
import { useProductionStore } from '../../stores/entities/production';

export interface PopulateResult {
  success: boolean;
  errors: string[];
  populated: {
    sites: number;
    storage: number;
    workforce: number;
    production: number;
  };
}

function formatError(endpoint: string, error: FioError): string {
  return `${endpoint}: ${error.message}`;
}

/**
 * Fetches all FIO data and populates the entity stores.
 *
 * Returns partial success if some endpoints fail.
 * FIO data replaces (not merges with) existing data.
 */
export async function populateStoresFromFio(
  config: FioConfig
): Promise<PopulateResult> {
  const result: PopulateResult = {
    success: true,
    errors: [],
    populated: { sites: 0, storage: 0, workforce: 0, production: 0 },
  };

  // Fetch all data in parallel
  const data: FioAllData = await fetchAllFioData(config);

  // Process sites
  if (data.sites.ok) {
    const sites = transformAllSites(data.sites.data);
    useSitesStore.getState().setAll(sites);
    useSitesStore.getState().setFetched('fio');
    result.populated.sites = sites.length;
  } else {
    result.success = false;
    result.errors.push(formatError('Sites', data.sites.error));
  }

  // Process storage
  if (data.storage.ok) {
    const storage = transformAllStorage(data.storage.data);
    useStorageStore.getState().setAll(storage);
    useStorageStore.getState().setFetched('fio');
    result.populated.storage = storage.length;
  } else {
    result.success = false;
    result.errors.push(formatError('Storage', data.storage.error));
  }

  // Process workforce
  if (data.workforce.ok) {
    const workforce = transformAllWorkforce(data.workforce.data);
    useWorkforceStore.getState().setAll(workforce);
    useWorkforceStore.getState().setFetched('fio');
    result.populated.workforce = workforce.length;
  } else {
    result.success = false;
    result.errors.push(formatError('Workforce', data.workforce.error));
  }

  // Process production
  if (data.production.ok) {
    const production = transformAllProduction(data.production.data);
    useProductionStore.getState().setAll(production);
    useProductionStore.getState().setFetched('fio');
    result.populated.production = production.length;
  } else {
    result.success = false;
    result.errors.push(formatError('Production', data.production.error));
  }

  return result;
}
