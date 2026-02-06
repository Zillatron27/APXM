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
 * Skips any store already populated by websocket (checked before AND after fetch).
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

  // Fetch and process sites — skip if websocket already populated
  onProgress?.('sites');
  if (useSitesStore.getState().dataSource !== 'websocket') {
    const sitesData = await fetchSites(config);
    if (sitesData.ok && useSitesStore.getState().dataSource !== 'websocket') {
      const sites = transformAllSites(sitesData.data);
      useSitesStore.getState().setAll(sites);
      useSitesStore.getState().setFetched('fio');
      result.populated.sites = sites.length;
    } else if (!sitesData.ok) {
      result.success = false;
      result.errors.push(formatError('Sites', sitesData.error));
    }
  }

  // Fetch and process workforce — skip if websocket already populated
  onProgress?.('workforce');
  if (useWorkforceStore.getState().dataSource !== 'websocket') {
    const workforceData = await fetchWorkforce(config);
    if (workforceData.ok && useWorkforceStore.getState().dataSource !== 'websocket') {
      const workforce = transformAllWorkforce(workforceData.data);
      useWorkforceStore.getState().setAll(workforce);
      useWorkforceStore.getState().setFetched('fio');
      result.populated.workforce = workforce.length;
    } else if (!workforceData.ok) {
      result.success = false;
      result.errors.push(formatError('Workforce', workforceData.error));
    }
  }

  // Fetch and process storage — skip if websocket already populated
  onProgress?.('storage');
  if (useStorageStore.getState().dataSource !== 'websocket') {
    const storageData = await fetchStorage(config);
    if (storageData.ok && useStorageStore.getState().dataSource !== 'websocket') {
      const storage = transformAllStorage(storageData.data);
      useStorageStore.getState().setAll(storage);
      useStorageStore.getState().setFetched('fio');
      result.populated.storage = storage.length;
    } else if (!storageData.ok) {
      result.success = false;
      result.errors.push(formatError('Storage', storageData.error));
    }
  }

  // Fetch and process production — skip if websocket already populated
  onProgress?.('production');
  if (useProductionStore.getState().dataSource !== 'websocket') {
    const productionData = await fetchProduction(config);
    if (productionData.ok && useProductionStore.getState().dataSource !== 'websocket') {
      const production = transformAllProduction(productionData.data);
      useProductionStore.getState().setAll(production);
      useProductionStore.getState().setFetched('fio');
      result.populated.production = production.length;
    } else if (!productionData.ok) {
      result.success = false;
      result.errors.push(formatError('Production', productionData.error));
    }
  }

  return result;
}
