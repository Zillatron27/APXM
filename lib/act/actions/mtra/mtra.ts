// Ported from refined-prun src/features/XIT/ACT/actions/mtra/mtra.ts.
// Edit.vue and Configure.vue omitted — desktop-only UI, not needed to run.
// generateSteps is pure TypeScript with no Vue; no changes needed there.

import { act } from '../../act-registry';
import { MTRA_TRANSFER } from '../../action-steps/MTRA_TRANSFER';
import { OPEN_SFC } from '../../action-steps/OPEN_SFC';
import { atSameLocation, deserializeStorage } from '../utils';
import type { Config } from './config';
import type { AssertFn } from '../../shared-types';
import { configurableValue } from '../../shared-types';

act.addAction<Config>({
  type: 'MTRA',
  shortDescription: 'Transfer materials between storages at the same location',
  description: (action, config) => {
    if (!action.group || !action.origin || !action.dest) {
      return '--';
    }
    const origin =
      action.origin === configurableValue
        ? (config?.origin ?? 'configured location')
        : action.origin;
    const dest =
      action.dest === configurableValue
        ? (config?.destination ?? 'configured location')
        : action.dest;
    return `Transfer group [${action.group}] from ${origin} to ${dest}`;
  },
  editComponent: undefined,
  configureComponent: undefined,
  needsConfigure: data =>
    data.origin === configurableValue || data.dest === configurableValue,
  isValidConfig: (data, config) =>
    (data.origin !== configurableValue || config.origin !== undefined) &&
    (data.dest !== configurableValue || config.destination !== undefined),
  generateSteps: async ctx => {
    const { data, config, packageName, getMaterialGroup, getMaterialGroupPlanet, emitStep } = ctx;
    const assert: AssertFn = ctx.assert;

    const PRUNPLANNER_PACKAGES = [
      'PRUNplanner Supply Cart',
      'PRUNplanner Construct',
      'PRUNplanner Transfer',
      'PRUNplanner Burn Supply',
    ];

    const materials = await getMaterialGroup(data.group);
    assert(materials, 'Invalid material group');

    const serializedOrigin = data.origin === configurableValue ? config?.origin : data.origin;
    const origin = deserializeStorage(serializedOrigin);
    assert(origin, 'Invalid origin');

    const serializedDest = data.dest === configurableValue ? config?.destination : data.dest;
    const dest = deserializeStorage(serializedDest);
    assert(dest, 'Invalid destination');

    const isSameLocation = atSameLocation(origin, dest);
    assert(isSameLocation, 'Origin and destination are not at the same location');

    for (const ticker of Object.keys(materials)) {
      emitStep(
        MTRA_TRANSFER({
          from: origin.id,
          to: dest.id,
          ticker,
          amount: materials[ticker],
        }),
      );
    }

    if (dest.type === 'SHIP_STORE' && !PRUNPLANNER_PACKAGES.includes(packageName)) {
      const planet = getMaterialGroupPlanet(data.group);
      const label = packageName.startsWith('Repair') ? 'Repair' : 'Resupply';
      emitStep(OPEN_SFC({ shipId: dest.addressableId, destination: planet, label }));
    }
  },
});
