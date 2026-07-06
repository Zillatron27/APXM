// Ported from refined-prun src/features/XIT/ACT/runner/step-generator.ts.
// Pure async; no Vue. Import paths updated for APXM; missing stores are
// adapted via ../_compat.

import {
  ActionPackageConfig,
  ActionStep,
  configurableValue,
} from '../shared-types';
import { Logger } from './logger';
import {
  warehousesStore,
  exchangesStore,
  storagesStore,
} from '../_compat';
import { act } from '../act-registry';

interface StepGeneratorOptions {
  log: Logger;
  onStatusChanged: (status: string) => void;
}

const AssertionError = new Error('Assertion failed');

export class StepGenerator {
  constructor(private options: StepGeneratorOptions) {}

  get log() {
    return this.options.log;
  }

  private groupPrices = new Map<string, Record<string, number>>();

  async generateSteps(pkg: UserData.ActionPackageData, config: ActionPackageConfig) {
    this.groupPrices.clear();
    const state = generateState();
    const steps = [] as ActionStep[];
    let fail = false;
    for (const action of pkg.actions) {
      const info = act.getActionInfo(action.type);
      if (!info) {
        continue;
      }
      const actionConfig = (config.actions as unknown as Record<string, unknown>)[action.name!] ?? {};
      const log = new Logger((tag, message) =>
        this.log.logMessage(
          tag,
          typeof message === 'string' ? `[${action.name}] ${message}` : message,
        ),
      );
      try {
        await info.generateSteps({
          data: action,
          config: actionConfig,
          packageName: pkg.global.name,
          log,
          fail: message => {
            if (message) {
              log.error(message);
            }
            fail = true;
          },
          assert: (condition, message) => {
            if (!condition) {
              log.error(message);
              throw AssertionError;
            }
          },
          emitStep: step => steps.push(step),
          getMaterialGroup: async name => await this.getMaterialGroup(pkg, config, name),
          getMaterialGroupPrices: name => (name ? this.groupPrices.get(name) : undefined),
          getMaterialGroupPlanet: name => this.getMaterialGroupPlanet(pkg, config, name),
          state,
        });
      } catch (e) {
        if (e !== AssertionError) {
          this.log.runtimeError(e);
        }
        fail = true;
      }

      if (fail) {
        break;
      }
    }
    if (steps.length === 0) {
      this.log.error('No actions were generated');
      fail = true;
    }
    return { steps, fail };
  }

  private getMaterialGroupPlanet(
    pkg: UserData.ActionPackageData,
    config: ActionPackageConfig,
    name: string | undefined,
  ): string | undefined {
    if (!name) {
      this.log.error('Missing material group');
      return undefined;
    }
    const group = pkg.groups.find(x => x.name === name);
    if (!group) {
      this.log.error('Unrecognized material group');
      return undefined;
    }
    const planet = group.planet;
    if (!planet) {
      this.log.warning(`Material group [${name}] has no planet configured; auto SFC will not run`);
      return undefined;
    }
    if (planet === configurableValue) {
      const groupConfig = (config.materialGroups as unknown as Record<string, unknown>)[name] ?? {};
      const configuredPlanet = (groupConfig as { planet?: string }).planet;
      if (!configuredPlanet) {
        this.log.error(`Material group [${name}] planet not configured`);
        return undefined;
      }
      return configuredPlanet;
    }
    return planet;
  }

  private async getMaterialGroup(
    pkg: UserData.ActionPackageData,
    config: ActionPackageConfig,
    name: string | undefined,
  ) {
    if (!name) {
      this.log.error('Missing material group');
      return undefined;
    }
    const group = pkg.groups.find(x => x.name === name);
    if (!group) {
      this.log.error('Unrecognized material group');
      return undefined;
    }

    const info = act.getMaterialGroupInfo(group.type);
    if (!info) {
      this.log.error('Unrecognized material group type');
      return undefined;
    }

    this.options.onStatusChanged(`Generating material bill for ${group.name}...`);
    const groupConfig = (config.materialGroups as unknown as Record<string, unknown>)[name!] ?? {};
    return await info.generateMaterialBill({
      data: group,
      config: groupConfig,
      log: new Logger((tag, message) =>
        this.log.logMessage(
          tag,
          typeof message === 'string' ? `[${group.name}] ${message}` : message,
        ),
      ),
      setStatus: status => this.options.onStatusChanged(status),
      setPrices: prices => this.groupPrices.set(name!, prices),
    });
  }
}

function generateState() {
  const war = {} as Record<string, Record<string, number>>;
  for (const ticker of ['AI1', 'CI1', 'IC1', 'NC1']) {
    war[ticker] = {};
    const naturalId = exchangesStore.getNaturalIdFromCode(ticker);
    const warehouse = warehousesStore.getByEntityNaturalId(naturalId);
    const inv = storagesStore.getById(warehouse?.storeId);

    if (inv) {
      for (const mat of inv.items) {
        const quantity = mat.quantity;
        if (quantity) {
          war[ticker][quantity.material.ticker] = quantity.amount;
        }
      }
    }
  }
  return {
    WAR: war,
  };
}
