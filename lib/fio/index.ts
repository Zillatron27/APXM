// FIO API module exports

export { fetchWorkforce, fetchProduction, fetchStorage, fetchSites, fetchAllMaterials, fetchExchangeAll, testConnection } from './client';
export { populateStoresFromFio, type PopulateResult, type FioProgressStep } from './populate-stores';
export { ensureReferenceData } from './reference';
export type { FioConfig, FioResult, FioError, FioErrorType } from './types';
