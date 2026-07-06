// Ported from refined-prun src/features/XIT/ACT/material-groups/repair/repair.ts.
// Edit.vue and Configure.vue omitted — desktop-only UI.
// Synchronous calculation; no Vue in generateMaterialBill.
//
// Store adaptations:
//   sitesStore.getByPlanetNaturalIdOrName  → sitesStore from _compat
//   getBuildingLastRepair(building)        → inlined (building.lastRepair?.timestamp ?? building.creationTime.timestamp)
//   isRepairableBuilding(building)         → inlined (module.type === 'RESOURCES' || 'PRODUCTION')

import { act } from '../../act-registry';
import type { Config } from './config';
import { sitesStore } from '../../_compat';
import { configurableValue } from '../../shared-types';
import type { PrunApi } from '../../../../types/prun-api';

function getBuildingLastRepair(building: PrunApi.Platform): number {
  return building.lastRepair?.timestamp ?? building.creationTime.timestamp;
}

function isRepairableBuilding(building: PrunApi.Platform): boolean {
  return building.module.type === 'RESOURCES' || building.module.type === 'PRODUCTION';
}

act.addMaterialGroup<Config>({
  type: 'Repair',
  shortDescription: 'Calculate repair materials for aging buildings',
  description: data => {
    if (!data.planet) {
      return '--';
    }
    const days = data.days;
    const daysLabel = days === configurableValue ? '?' : days;
    const daysPart = days !== undefined ? `older than ${daysLabel} day${days == 1 ? '' : 's'}` : '';
    const advanceDays = data.advanceDays ?? 0;
    const advanceLabel = advanceDays === configurableValue ? '?' : advanceDays;
    return `Repair buildings on ${data.planet} ${daysPart} in ${advanceLabel} day${advanceDays == 1 ? '' : 's'}`;
  },
  editComponent: undefined,
  configureComponent: undefined,
  needsConfigure: data =>
    data.planet === configurableValue ||
    data.days === configurableValue ||
    data.advanceDays === configurableValue,
  isValidConfig: (data, config) =>
    (data.planet !== configurableValue || config.planet !== undefined) &&
    (data.days !== configurableValue || config.days !== undefined) &&
    (data.advanceDays !== configurableValue || config.advanceDays !== undefined),
  generateMaterialBill: async ({ data, config, log }) => {
    if (!data.planet) {
      log.error('Resupply planet is not configured');
      return undefined;
    }

    const planet = data.planet === configurableValue ? config.planet : data.planet;
    const site = sitesStore.getByPlanetNaturalIdOrName(planet);
    if (!site?.platforms) {
      log.error('Missing data on repair planet');
      return undefined;
    }

    const rawDays = data.days === configurableValue ? config.days : data.days;
    const rawAdvanceDays =
      data.advanceDays === configurableValue ? config.advanceDays : data.advanceDays;
    const days = typeof rawDays === 'number' ? rawDays : parseFloat(rawDays as string);
    let advanceDays =
      typeof rawAdvanceDays === 'number' ? rawAdvanceDays : parseFloat(rawAdvanceDays as string);
    const threshold = isNaN(days) ? 0 : days;
    advanceDays = isNaN(advanceDays) ? 0 : advanceDays;

    const parsedGroup: Record<string, number> = {};
    for (const building of site.platforms) {
      if (!isRepairableBuilding(building)) {
        continue;
      }

      const lastRepair = getBuildingLastRepair(building);
      const date = (Date.now() - lastRepair) / 86400000;

      if (date + advanceDays < threshold) {
        continue;
      }

      const buildingMaterials: Record<string, number> = {};
      for (const mat of building.reclaimableMaterials) {
        buildingMaterials[mat.material.ticker] =
          (buildingMaterials[mat.material.ticker] ?? 0) + mat.amount;
      }
      for (const mat of building.repairMaterials) {
        buildingMaterials[mat.material.ticker] =
          (buildingMaterials[mat.material.ticker] ?? 0) + mat.amount;
      }

      const adjustedDate = date + advanceDays;
      for (const ticker of Object.keys(buildingMaterials)) {
        const amount =
          adjustedDate > 180
            ? buildingMaterials[ticker]
            : Math.ceil((buildingMaterials[ticker] * adjustedDate) / 180);
        parsedGroup[ticker] = (parsedGroup[ticker] ?? 0) + amount;
      }
    }
    return parsedGroup;
  },
});
