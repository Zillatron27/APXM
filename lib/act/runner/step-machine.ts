// Ported from refined-prun src/features/XIT/ACT/runner/step-machine.ts.
// Promises only. TileAllocator is replaced by the mobile buffer navigator:
// requestBuffer() opens an APEX buffer via openMobileBuffer() and hands the
// action step an anchor (#container) to scope its DOM queries against.

import { act } from '../act-registry';
import { ActionStep } from '../shared-types';
import { Logger } from './logger';
import { clickElement, sleep } from '../_compat';
import type { PrunTile } from '../runtime-types';
import { openMobileBuffer, closeMobileBuffer } from '../../mobile-buffer-navigator';
import { clearMtraBufferCache } from '../action-steps/MTRA_TRANSFER';
import { useSettingsStore } from '../../../stores/settings';

interface StepMachineOptions {
  log: Logger;
  onBufferSplit: () => void;
  onStart: () => void;
  onEnd: () => void;
  onStatusChanged: (status: string, keepReady?: boolean) => void;
  onActReady: () => void;
}

const AssertionError = new Error('Assertion failed');

export class StepMachine {
  private next?: ActionStep;
  private nextAct?: () => void;

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
    this.next = undefined;
    this.nextAct = undefined;
    // Reset the MTRA buffer cache so a fresh run never skips the open step.
    clearMtraBufferCache();
    // Close any open buffer and restore APEX before signalling the end.
    void closeMobileBuffer();
    this.options.onEnd();
  }

  private async startNext() {
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
    try {
      await info.execute({
        data: next,
        log,
        setStatus: status => this.options.onStatusChanged(status),
        waitAct: async status => {
          status ??= description ?? info.description(next);
          await this.waitAct(status);
        },
        waitActionFeedback: async tile => {
          // Read at use time so a settings change mid-run takes effect on the
          // next step. Default false: the user taps APEX's CONFIRM themselves
          // (action-authorisation rule); auto-click is opt-in.
          const autoConfirm = useSettingsStore.getState().autoConfirm;
          this.options.onStatusChanged(
            autoConfirm
              ? 'Waiting for action feedback...'
              : 'Waiting for action feedback (confirm in APEX if prompted)...',
          );
          const error = await waitActionFeedback(tile, autoConfirm);
          if (error) {
            log.error(error);
            log.error(description ?? info.description(next));
            log.error('Action Package execution failed');
            this.stop();
            return;
          }
        },
        cacheDescription: () => {
          description = info.description(next);
          this.options.onStatusChanged(description, true);
        },
        complete: async () => {
          // Wait a moment to allow data to update.
          await sleep(0);
          log.success(description ?? info.description(next));
          void this.startNext();
        },
        skip: () => this.skip(),
        fail: message => {
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
        requestTile: async command => await this.requestBuffer(command),
      });
    } catch (e) {
      if (e !== AssertionError) {
        log.runtimeError(e);
      }
      this.stop();
    }
  }

  private async requestBuffer(command: string): Promise<PrunTile | undefined> {
    await this.waitAct(`Open ${command}`);
    this.options.onStatusChanged(`Opening ${command}...`);
    const opened = await openMobileBuffer(command);
    const anchor = document.getElementById('container');
    if (!opened || !anchor) {
      this.log.error(`Failed to open ${command}`);
      this.stop();
      return undefined;
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

async function waitActionFeedback(
  tile: PrunTile,
  autoConfirm: boolean,
): Promise<string | undefined> {
  const overlay = await $(tile.anchor, C.ActionFeedback.overlay);
  if (!overlay) {
    return 'Action feedback overlay did not appear';
  }
  await waitActionProgress(overlay);
  if (overlay.classList.contains(C.ActionConfirmationOverlay.container)) {
    if (autoConfirm) {
      const confirm = _$$(overlay, C.Button.btn)[1];
      if (confirm === undefined) {
        return 'Confirmation overlay is missing confirm button';
      }
      await clickElement(confirm);
    } else {
      // Manual confirm (the default): the user must tap APEX's CONFIRM
      // themselves. The buffer may be parked off-screen (openMobileBuffer
      // hides #container — CXPO leaves it hidden), so bring it on-screen for
      // the tap and restore afterwards. MTRA already shows the container, in
      // which case this save/restore is a no-op.
      const anchor = tile.anchor;
      const prev = { visibility: anchor.style.visibility, left: anchor.style.left };
      anchor.style.visibility = 'visible';
      anchor.style.left = '0px';
      try {
        await waitConfirmationResolved(overlay);
      } finally {
        anchor.style.left = prev.left;
        anchor.style.visibility = prev.visibility;
      }
    }
    await waitActionProgress(overlay);
  }
  if (overlay.classList.contains(C.ActionFeedback.success)) {
    await clickElement(overlay);
    return;
  }
  if (overlay.classList.contains(C.ActionFeedback.error)) {
    const message = _$(overlay, C.ActionFeedback.message)?.textContent;
    const dismiss = _$(overlay, C.ActionFeedback.dismiss)?.textContent;
    return dismiss ? message?.replace(dismiss, '') ?? undefined : message ?? undefined;
  }

  return 'Unknown action feedback overlay';
}

// Manual-confirm wait: resolves when the overlay leaves the confirmation
// state. Two exits: (a) the overlay's own classList changes — after the user
// taps CONFIRM, APEX transitions the same element through progress to
// success/error, exactly the transition the auto-click path observes; or
// (b) the overlay is detached — the user tapped CANCEL or APEX dismissed it
// (a cancel then falls through the success/error checks and fails the step).
// No timeout: like waitAct(), a human decision is unbounded.
function waitConfirmationResolved(overlay: HTMLElement): Promise<void> {
  if (!overlay.classList.contains(C.ActionConfirmationOverlay.container) || !overlay.isConnected) {
    return Promise.resolve();
  }
  return new Promise<void>(resolve => {
    const done = () => {
      attrObserver.disconnect();
      removalObserver.disconnect();
      resolve();
    };
    const attrObserver = new MutationObserver(() => {
      if (!overlay.classList.contains(C.ActionConfirmationOverlay.container)) {
        done();
      }
    });
    attrObserver.observe(overlay, { attributes: true, attributeFilter: ['class'] });
    // A class observer never fires on node removal — watch the parent tree.
    const removalObserver = new MutationObserver(() => {
      if (!overlay.isConnected) {
        done();
      }
    });
    removalObserver.observe(overlay.parentElement ?? document.body, {
      childList: true,
      subtree: true,
    });
  });
}

async function waitActionProgress(overlay: HTMLElement) {
  if (!overlay.classList.contains(C.ActionFeedback.progress)) {
    return;
  }
  await new Promise<void>(resolve => {
    const mutationObserver = new MutationObserver(() => {
      if (!overlay.classList.contains(C.ActionFeedback.progress)) {
        mutationObserver.disconnect();
        resolve();
      }
    });
    mutationObserver.observe(overlay, { attributes: true });
  });
}
