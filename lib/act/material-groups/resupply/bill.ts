// Ported verbatim from refined-prun
// src/features/XIT/ACT/material-groups/resupply/bill.ts.
// Imports adapted to APXM layout via ../../_compat.

import {
  calculatePlanetBurn,
  sitesStore,
  workforcesStore,
  productionStore,
  storagesStore,
} from '../../_compat';
import type { MaterialFilter } from './config';

// Computes the resupply material bill for a given planet and day count.
// Returns undefined when inputs are missing or when the site's burn data is
// not yet loaded. Kept synchronous so it can be driven reactively from the
// Configure window.
export function computeResupplyBill(
  data: UserData.MaterialGroupData,
  planet: string | undefined,
  days: number | undefined,
  materialFilter?: MaterialFilter,
): Record<string, number> | undefined {
  if (!planet || days === undefined || isNaN(days)) {
    return undefined;
  }
  const site = sitesStore.getByPlanetNaturalIdOrName(planet);
  if (!site) {
    return undefined;
  }
  const workforce = workforcesStore.getById(site.siteId)?.workforces;
  const production = productionStore.getBySiteId(site.siteId);
  if (workforce === undefined || production === undefined) {
    return undefined;
  }
  const stores = storagesStore.getByAddressableId(site.siteId);

  const filter = materialFilter ?? (data.consumablesOnly ? 'Workforce' : 'All');
  const planetBurn = calculatePlanetBurn(
    production,
    workforce,
    (data.useBaseInv ?? true) ? stores : undefined,
  );

  const exclusions = data.exclusions ?? [];
  const bill: Record<string, number> = {};
  for (const ticker of Object.keys(planetBurn)) {
    if (exclusions.includes(ticker)) {
      continue;
    }
    const matBurn = planetBurn[ticker];
    // For filtered modes, only include materials with primary demand type.
    // Still use full dailyAmount so cross-demand (e.g. a workforce consumable
    // that is also a production input) is fully accounted for.
    if (filter === 'Workforce' && matBurn.workforce === 0) {
      continue;
    }
    if (filter === 'Production' && matBurn.input === 0) {
      continue;
    }
    if (matBurn.dailyAmount >= 0) {
      continue;
    }
    const consumed = days * -matBurn.dailyAmount;
    const need = Math.max(0, Math.ceil(consumed - matBurn.inventory + 1));
    if (need > 0) {
      bill[ticker] = need;
    }
  }
  return bill;
}
