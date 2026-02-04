/**
 * FIO Store Population Coordinator
 *
 * Fetches all FIO data and populates the entity stores.
 */

import {
  fetchSites,
  fetchWorkforce,
  fetchStorage,
  fetchProduction,
} from './client';
import {
  transformAllWorkforce,
  transformAllProduction,
  transformAllStorage,
  transformAllSites,
} from './transforms';
import type { FioConfig, FioError } from './types';
import { useSitesStore } from '../../stores/entities/sites';
import { useStorageStore } from '../../stores/entities/storage';
import { useWorkforceStore } from '../../stores/entities/workforce';
import { useProductionStore } from '../../stores/entities/production';

export type FioProgressStep = 'sites' | 'workforce' | 'storage' | 'production';

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

export interface PopulateOptions {
  onProgress?: (step: FioProgressStep) => void;
}

function formatError(endpoint: string, error: FioError): string {
  return `${endpoint}: ${error.message}`;
}

/**
 * Fetches all FIO data and populates the entity stores.
 *
 * Sequential fetches to avoid rate limiting.
 * Returns partial success if some endpoints fail.
 * FIO data replaces (not merges with) existing data.
 */
export async function populateStoresFromFio(
  config: FioConfig,
  options?: PopulateOptions
): Promise<PopulateResult> {
  const result: PopulateResult = {
    success: true,
    errors: [],
    populated: { sites: 0, storage: 0, workforce: 0, production: 0 },
  };

  const onProgress = options?.onProgress;

  // Fetch and process sites
  onProgress?.('sites');
  const sitesData = await fetchSites(config);
  if (sitesData.ok) {
    const sites = transformAllSites(sitesData.data);
    useSitesStore.getState().setAll(sites);
    useSitesStore.getState().setFetched('fio');
    result.populated.sites = sites.length;
  } else {
    result.success = false;
    result.errors.push(formatError('Sites', sitesData.error));
  }

  // Fetch and process workforce
  onProgress?.('workforce');
  const workforceData = await fetchWorkforce(config);
  if (workforceData.ok) {
    const workforce = transformAllWorkforce(workforceData.data);
    useWorkforceStore.getState().setAll(workforce);
    useWorkforceStore.getState().setFetched('fio');
    result.populated.workforce = workforce.length;
  } else {
    result.success = false;
    result.errors.push(formatError('Workforce', workforceData.error));
  }

  // Fetch and process storage
  onProgress?.('storage');
  const storageData = await fetchStorage(config);
  if (storageData.ok) {
    const storage = transformAllStorage(storageData.data);
    useStorageStore.getState().setAll(storage);
    useStorageStore.getState().setFetched('fio');
    result.populated.storage = storage.length;
  } else {
    result.success = false;
    result.errors.push(formatError('Storage', storageData.error));
  }

  // Fetch and process production
  onProgress?.('production');
  const productionData = await fetchProduction(config);
  if (productionData.ok) {
    const production = transformAllProduction(productionData.data);
    useProductionStore.getState().setAll(production);
    useProductionStore.getState().setFetched('fio');
    result.populated.production = production.length;
  } else {
    result.success = false;
    result.errors.push(formatError('Production', productionData.error));
  }

  return result;
}
