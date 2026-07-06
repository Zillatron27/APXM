// Ported from refined-prun src/features/XIT/ACT/material-groups/resupply/resupply.ts.
// Edit.vue and Configure.vue omitted — desktop-only UI.
//
// Vue adaptation:
//   computed(() => workforcesStore.getById(...))  → direct getter call
//   computed(() => productionStore.getBySiteId(...)) → direct getter call
//   watchWhile(toRef(() => ... === undefined))    → await waitUntil(() => ... !== undefined)
//
// In APXM the production store always returns an array (never undefined), so
// the wait only needs to gate on workforce data arriving.

import { act } from '../../act-registry';
import type { Config } from './config';
import { sitesStore, workforcesStore } from '../../_compat';
import { configurableValue } from '../../shared-types';
import { computeResupplyBill } from './bill';
import { waitUntil } from '../../_compat';
import { getEntityDisplayName } from '../../../address';

act.addMaterialGroup<Config>({
  type: 'Resupply',
  shortDescription: 'Calculate consumables needed based on burn rate',
  description: data => {
    if (!data.planet || data.days === undefined) {
      return '--';
    }
    const daysLabel = data.days === configurableValue ? '?' : data.days;
    return `Resupply ${data.planet} with ${daysLabel} day${data.days == 1 ? '' : 's'} of supplies`;
  },
  editComponent: undefined,
  configureComponent: undefined,
  needsConfigure: data =>
    data.planet === configurableValue || data.days === configurableValue,
  isValidConfig: (data, config) =>
    (data.planet !== configurableValue || config.planet !== undefined) &&
    (data.days !== configurableValue || config.days !== undefined),
  generateMaterialBill: async ({ data, config, log, setStatus }) => {
    if (!data.planet) {
      log.error('Missing resupply planet');
    }
    if (data.days === undefined) {
      log.error('Missing resupply days');
    }

    const planet = data.planet === configurableValue ? config.planet : data.planet;
    const days =
      data.days === configurableValue
        ? (config.days ?? 10)
        : typeof data.days === 'number'
          ? data.days
          : parseFloat(data.days as string);

    const site = sitesStore.getByPlanetNaturalIdOrName(planet);
    if (!site) {
      log.error(`Base is not present on ${data.planet}`);
    }

    if (!site || days === undefined || isNaN(days)) {
      return undefined;
    }

    // Wait for live workforce data if it hasn't arrived from the game server yet.
    if (workforcesStore.getById(site.siteId) === undefined) {
      const name = getEntityDisplayName(site.address);
      setStatus(`Loading ${name} burn data...`);
      await waitUntil(() => workforcesStore.getById(site.siteId) !== undefined);
    }

    return computeResupplyBill(data, planet, days, config.materialFilter);
  },
});
