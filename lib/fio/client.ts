/**
 * FIO REST API Client
 *
 * Fetches data from rest.fnar.net with proper error handling.
 */

import type {
  FioConfig,
  FioResult,
  FioError,
  FioWorkforce,
  FioProductionLine,
  FioStorage,
  FioSite,
} from './types';

const FIO_BASE_URL = 'https://rest.fnar.net';

/**
 * Converts HTTP response to FioResult with appropriate error categorization.
 */
async function handleResponse<T>(response: Response): Promise<FioResult<T>> {
  if (response.ok) {
    // 204 No Content - valid empty response
    if (response.status === 204) {
      return { ok: true, data: [] as unknown as T };
    }
    const data = await response.json();
    return { ok: true, data };
  }

  let error: FioError;

  if (response.status === 401) {
    error = { type: 'unauthorized', message: 'Invalid API key or access denied' };
  } else if (response.status === 404) {
    error = { type: 'not_found', message: 'User not found or no data available' };
  } else {
    error = { type: 'unknown', message: `HTTP ${response.status}: ${response.statusText}` };
  }

  return { ok: false, error };
}

/**
 * Makes an authenticated GET request to the FIO API.
 */
async function fioFetch<T>(
  endpoint: string,
  apiKey: string
): Promise<FioResult<T>> {
  try {
    const response = await fetch(`${FIO_BASE_URL}${endpoint}`, {
      method: 'GET',
      headers: {
        Authorization: apiKey,
        Accept: 'application/json',
      },
    });
    return handleResponse<T>(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown network error';
    return { ok: false, error: { type: 'network', message } };
  }
}

/**
 * Fetches workforce data for a user.
 */
export async function fetchWorkforce(
  config: FioConfig
): Promise<FioResult<FioWorkforce[]>> {
  return fioFetch<FioWorkforce[]>(`/workforce/${config.username}`, config.apiKey);
}

/**
 * Fetches production data for a user.
 */
export async function fetchProduction(
  config: FioConfig
): Promise<FioResult<FioProductionLine[]>> {
  return fioFetch<FioProductionLine[]>(`/production/${config.username}`, config.apiKey);
}

/**
 * Fetches storage data for a user.
 */
export async function fetchStorage(
  config: FioConfig
): Promise<FioResult<FioStorage[]>> {
  return fioFetch<FioStorage[]>(`/storage/${config.username}`, config.apiKey);
}

/**
 * Fetches sites data for a user.
 */
export async function fetchSites(
  config: FioConfig
): Promise<FioResult<FioSite[]>> {
  return fioFetch<FioSite[]>(`/sites/${config.username}`, config.apiKey);
}

/**
 * Tests API connection by making a lightweight request.
 *
 * Uses /sites/{username} endpoint - returns unauthorized on bad key,
 * or the sites data on success.
 */
export async function testConnection(
  config: FioConfig
): Promise<FioResult<true>> {
  const result = await fioFetch<FioSite[]>(
    `/sites/${config.username}`,
    config.apiKey
  );
  if (result.ok) {
    return { ok: true, data: true };
  }
  return { ok: false, error: result.error };
}

