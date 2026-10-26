// Ported from refined-prun src/features/XIT/ACT/runner/step-machine.ts.
// Promises only. TileAllocator is replaced by the mobile buffer navigator:
// requestBuffer() opens an APEX buffer via openMobileBuffer() and hands the
// action step an anchor (#container) to scope its DOM queries against.

import { act } from '../act-registry';
import { ActionStep } from '../shared-types';
import { Logger } from './logger';
import { sleep } from '../_compat';
import type { PrunTile } from '../runtime-types';
import { waitActionFeedback } from '../action-feedback';
import { openMobileBuffer, closeMobileBuffer } from '../../mobile-buffer-navigator';
import { clearMtraBufferCache } from '../action-steps/MTRA_TRANSFER';
import { useSettingsStore } from '../../../stores/settings';
import { useGameState } from '../../../stores/gameState';
import { releaseActionLock } from '../action-lock';

// Lock contract: ActionRunner acquires the shared action lock before start();
// stop() releases it, once per run (stop() is idempotent), after the buffer
// has finished closing. Construct a StepMachine only through ActionRunner.
interface StepMachineOptions {
  log: Logger;
  onBufferSplit: () => void;
  onStart: () => void;
  onEnd: () => void;
  onStatusChanged: (status: string, keepReady?: boolean) => void;
  onActReady: () => void;
}

const AssertionError = new Error('Assertion failed');
// Thrown into a step's execute() when the machine has stopped (APEX error
// feedback, buffer open failure) or moved on without it (cancel, UI skip),
// so the step unwinds instead of carrying on against a run that is no longer
// its own. Swallowed by startNext's catch, like AssertionError.
const StepAbandoned = new Error('Step abandoned');

export class StepMachine {
  private next?: ActionStep;
  private nextAct?: () => void;
  // Bumped by every startNext() and stop(). A step's ctx callbacks capture
  // the value current when that step started, and go inert once it moves on
  // — so a cancelled or UI-skipped step that is still mid-await can't
  // complete() its way into running another step.
  private generation = 0;
  // True from start() until the first stop(): onEnd fires exactly once per
  // run, however many paths reach stop().
  private active = false;

  constructor(
    private steps: ActionStep[],
    private options: StepMachineOptions,
  ) {}

  get isRunning() {
    return this.next !== undefined;
  }

  get log() {
    return this.options.log;
  }

  start() {
    this.active = true;
    this.options.onStart();
    void this.startNext();
  }

  act() {
    if (!this.ensureRunning()) {
      return;
    }
    const nextAct = this.nextAct;
    this.nextAct = undefined;
    nextAct?.();
  }

  skip() {
    if (!this.ensureRunning()) {
      return;
    }
    const next = this.next;
    if (!next) {
      return;
    }
    const info = act.getActionStepInfo(next.type);
    this.log.skip(info.description(next));
    this.nextAct = undefined;
    void this.startNext();
  }

  cancel() {
    if (!this.ensureRunning()) {
      return;
    }
    this.log.cancel('Action Package execution canceled');
    this.stop();
  }

  stop() {
    if (!this.active) {
      return;
    }
    this.active = false;
    this.generation++;
    this.steps = [];
    this.next = undefined;
    this.nextAct = undefined;
    // Reset the MTRA buffer cache so a fresh run never skips the open step.
    clearMtraBufferCache();
    // Close any open buffer and restore APEX before signalling the end. The
    // lock is freed only once the close settles: releasing it now would let
    // another driver start while APEX is still being navigated back.
    void closeMobileBuffer().finally(releaseActionLock);
    this.options.onEnd();
  }

  private async startNext() {
    const token = ++this.generation;
    if (this.steps.length === 0) {
      this.log.success('Action Package execution completed');
      this.stop();
      return;
    }
    const next = this.steps.shift()!;
    this.next = next;
    const info = act.getActionStepInfo(next.type);
    let description: string | undefined;
    const log = this.options.log;
    const isCurrent = () => token === this.generation;
    // For awaits: a step whose run moved on mid-await must not continue.
    const ensureCurrent = () => {
      if (!isCurrent()) {
        throw StepAbandoned;
      }
    };
    try {
      await info.execute({
        data: next,
        log,
        setStatus: status => {
          if (isCurrent()) {
            this.options.onStatusChanged(status);
          }
        },
        waitAct: async status => {
          ensureCurrent();
          status ??= description ?? info.description(next);
          await this.waitAct(status);
          ensureCurrent();
        },
        waitActionFeedback: async tile => {
          ensureCurrent();
          // Read at use time so a settings change mid-run takes effect on the
          // next step. Default false: the user taps APEX's CONFIRM themselves
          // (action-authorisation rule); auto-click is opt-in.
          const autoConfirm = useSettingsStore.getState().autoConfirm;
          this.options.onStatusChanged(
            autoConfirm
              ? 'Waiting for action feedback...'
              : 'Waiting for action feedback (confirm in APEX if prompted)...',
          );
          // actConfirmPending raises the ConfirmBar over APEX's dialog, and
          // with it STOP WAITING: abandoning returns an error, which fails
          // this step below like any APEX error.
          const error = await waitActionFeedback(tile, autoConfirm, pending =>
            useGameState.getState().setActConfirmPending(pending),
          );
          ensureCurrent();
          if (error) {
            log.error(error);
            log.error(description ?? info.description(next));
            log.error('Action Package execution failed');
            this.stop();
            throw StepAbandoned;
          }
        },
        cacheDescription: () => {
          if (!isCurrent()) {
            return;
          }
          description = info.description(next);
          this.options.onStatusChanged(description, true);
        },
        complete: async () => {
          if (!isCurrent()) {
            return;
          }
          // Wait a moment to allow data to update.
          await sleep(0);
          if (!isCurrent()) {
            return;
          }
          log.success(description ?? info.description(next));
          void this.startNext();
        },
        skip: () => {
          if (isCurrent()) {
            this.skip();
          }
        },
        fail: message => {
          if (!isCurrent()) {
            return;
          }
          if (message) {
            log.error(message);
          }
          log.error('Action Package execution failed');
          this.stop();
          return;
        },
        assert: (condition, message) => {
          if (!condition) {
            log.error(message);
            throw AssertionError;
          }
        },
        requestTile: async command => await this.requestBuffer(command, ensureCurrent),
      });
    } catch (e) {
      if (e !== AssertionError && e !== StepAbandoned) {
        log.runtimeError(e);
      }
      // An abandoned step's run has already moved on: stopping here would
      // end whatever the machine is doing now.
      if (isCurrent()) {
        this.stop();
      }
    }
  }

  private async requestBuffer(
    command: string,
    ensureCurrent: () => void,
  ): Promise<PrunTile> {
    ensureCurrent();
    await this.waitAct(`Open ${command}`);
    ensureCurrent();
    this.options.onStatusChanged(`Opening ${command}...`);
    const opened = await openMobileBuffer(command);
    ensureCurrent();
    const anchor = document.getElementById('container');
    if (!opened || !anchor) {
      this.log.error(`Failed to open ${command}`);
      this.stop();
      throw StepAbandoned;
    }
    return { anchor };
  }

  private async waitAct(status: string) {
    this.options.onStatusChanged(status);
    this.options.onActReady();
    await new Promise<void>(resolve => (this.nextAct = resolve));
  }

  private ensureRunning() {
    if (!this.isRunning) {
      this.log.error('Action Package is not running');
    }
    return this.isRunning;
  }
}

