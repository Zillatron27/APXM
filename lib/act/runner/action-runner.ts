// Ported from refined-prun src/features/XIT/ACT/runner/action-runner.ts.
// refined-prun's desktop TileAllocator is replaced by the mobile buffer
// navigator: the step machine opens each buffer through openMobileBuffer()
// directly, so the runner no longer threads a tile allocator or stub.

import { act } from '../act-registry';
import { deepToRaw, fixed02, materialsStore } from '../_compat';
import { Logger, type LogPart } from './logger';
import { StepMachine } from './step-machine';
import { StepGenerator } from './step-generator';
import { ActionPackageConfig, ActionStep } from '../shared-types';

interface ActionRunnerOptions {
  log: Logger;
  onBufferSplit: () => void;
  onStart: () => void;
  onEnd: () => void;
  onStatusChanged: (status: string, keepReady?: boolean) => void;
  onActReady: () => void;
}

export class ActionRunner {
  private readonly stepGenerator: StepGenerator;
  private stepMachine?: StepMachine;

  constructor(private options: ActionRunnerOptions) {
    this.stepGenerator = new StepGenerator(options);
  }

  get log() {
    return this.options.log;
  }

  get isRunning() {
    return this.stepMachine?.isRunning ?? false;
  }

  async preview(pkg: UserData.ActionPackageData, config: ActionPackageConfig) {
    if (this.isRunning) {
      this.log.error('Action Package is already running');
      return;
    }
    // Create a copy to prevent changes during execution.
    const copy = structuredClone(deepToRaw(pkg));
    const { steps, fail } = await this.stepGenerator.generateSteps(copy, config);
    if (steps.length === 0) {
      return;
    }
    this.log.info(formatTotals(steps));
    if (fail) {
      this.log.info('Generated steps for valid actions:');
    }
    for (const step of steps) {
      const stepInfo = act.getActionStepInfo(step.type);
      this.log.action(stepInfo.description(step));
    }
  }

  async execute(pkg: UserData.ActionPackageData, config: ActionPackageConfig) {
    if (this.isRunning) {
      this.log.error('Action Package is already running');
      return;
    }
    // Create a copy to prevent changes during execution.
    const copy = structuredClone(deepToRaw(pkg));
    const { steps, fail } = await this.stepGenerator.generateSteps(copy, config);
    if (fail) {
      this.log.error('Action Package execution failed');
      return;
    }
    this.log.info('Action Package execution started');
    this.log.info(formatTotals(steps));
    this.stepMachine = new StepMachine(steps, this.options);
    this.stepMachine.start();
  }

  act() {
    this.stepMachine?.act();
    if (!this.stepMachine?.isRunning) {
      this.stepMachine = undefined;
    }
  }

  skip() {
    this.stepMachine?.skip();
    if (!this.stepMachine?.isRunning) {
      this.stepMachine = undefined;
    }
  }

  cancel() {
    this.stepMachine?.cancel();
    this.stepMachine = undefined;
  }
}

function formatTotals(steps: ActionStep[]): LogPart[] {
  const aggregated: Record<string, number> = {};
  for (const step of steps) {
    const info = act.getActionStepInfo(step.type);
    const mats = info.totalMaterials?.(step);
    if (mats) {
      for (const [ticker, amount] of Object.entries(mats)) {
        aggregated[ticker] = (aggregated[ticker] ?? 0) + amount;
      }
    }
  }
  let totalWeight = 0;
  let totalVolume = 0;
  for (const [ticker, amount] of Object.entries(aggregated)) {
    const mat = materialsStore.getByTicker(ticker);
    if (mat) {
      totalWeight += mat.weight * amount;
      totalVolume += mat.volume * amount;
    }
  }
  return [
    { text: 'Total Weight ' },
    { text: `${fixed02(totalWeight)}t`, yellow: true },
    { text: ', Total Volume ' },
    { text: `${fixed02(totalVolume)}m³`, yellow: true },
  ];
}
