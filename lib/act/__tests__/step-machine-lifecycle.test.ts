// StepMachine run lifecycle (#2): once a run is cancelled or failed, or a step
// is skipped from the UI, the abandoned step's execute() must not be able to
// start further steps, and onEnd must fire exactly once per run. The CX-buy
// and MTRA primitives run through this machine — a stray extra step spends
// money or moves cargo.

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

vi.mock('../../mobile-buffer-navigator', () => ({
  openMobileBuffer: vi.fn(async () => true),
  closeMobileBuffer: vi.fn(async () => {}),
}));

import { StepMachine } from '../runner/step-machine';
import { act } from '../act-registry';
import { setupActGlobals } from '../globals-setup';
import { C } from '../prun-css';
import { Logger } from '../runner/logger';
import { openMobileBuffer, closeMobileBuffer } from '../../mobile-buffer-navigator';
import { abandonManualConfirmWait } from '../action-feedback';
import { acquireActionLock, isActionInFlight, releaseActionLock } from '../action-lock';
import { useGameState } from '../../../stores/gameState';
import type { ActionStep } from '../shared-types';

beforeAll(() => {
  setupActGlobals();
  Object.assign(C, {
    ActionFeedback: {
      overlay: 'af-overlay',
      progress: 'af-progress',
      success: 'af-success',
      error: 'af-error',
      message: 'af-message',
      dismiss: 'af-dismiss',
    },
    ActionConfirmationOverlay: { container: 'aco-container' },
    Button: { btn: 'apex-btn' },
  });
});

let executed: string[];
const gates = new Map<string, () => void>();

/** Resolves when the test opens the named gate. */
function gate(name: string): Promise<void> {
  return new Promise((resolve) => gates.set(name, resolve));
}

function open(name: string): void {
  const release = gates.get(name);
  if (!release) throw new Error(`gate ${name} not reached`);
  release();
}

async function flush(): Promise<void> {
  for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0));
}

/** A step that records its start, waits on a gate (not waitAct), then completes. */
const makeSlowStep = act.addActionStep<{ name: string }>({
  type: 'LIFECYCLE_SLOW',
  description: (data) => `slow ${data.name}`,
  execute: async (ctx) => {
    executed.push(ctx.data.name);
    await gate(ctx.data.name);
    executed.push(`${ctx.data.name}:after-wait`);
    ctx.complete();
  },
});

const makeInstantStep = act.addActionStep<{ name: string }>({
  type: 'LIFECYCLE_INSTANT',
  description: (data) => `instant ${data.name}`,
  execute: async (ctx) => {
    executed.push(ctx.data.name);
    ctx.complete();
  },
});

let anchorEl: HTMLElement;
/** Waits for APEX feedback, then — as CXPO_BUY does — carries on and completes. */
const makeFeedbackStep = act.addActionStep<{ name: string }>({
  type: 'LIFECYCLE_FEEDBACK',
  description: (data) => `feedback ${data.name}`,
  execute: async (ctx) => {
    executed.push(ctx.data.name);
    await ctx.waitActionFeedback({ anchor: anchorEl });
    executed.push(`${ctx.data.name}:after-feedback`);
    ctx.complete();
  },
});

/** Opens a buffer, then carries on whether or not it got one. */
const makeBufferStep = act.addActionStep<{ name: string }>({
  type: 'LIFECYCLE_BUFFER',
  description: (data) => `buffer ${data.name}`,
  execute: async (ctx) => {
    executed.push(ctx.data.name);
    await ctx.requestTile('BS X');
    executed.push(`${ctx.data.name}:after-request`);
    ctx.complete();
  },
});

function runMachine(steps: ActionStep[]) {
  let ends = 0;
  const machine: StepMachine = new StepMachine(steps, {
    log: new Logger(() => {}),
    onBufferSplit: () => {},
    onStart: () => {},
    onEnd: () => ends++,
    onStatusChanged: () => {},
    // Auto-tap ACT so requestTile's waitAct gate passes.
    onActReady: () => queueMicrotask(() => machine.act()),
  });
  machine.start();
  return { machine, ends: () => ends };
}

beforeEach(() => {
  executed = [];
  gates.clear();
  document.body.innerHTML = '';
  vi.mocked(openMobileBuffer).mockResolvedValue(true);
  vi.mocked(closeMobileBuffer).mockClear();
  releaseActionLock();
  useGameState.getState().setActConfirmPending(false);
});

describe('StepMachine lifecycle (#2)', () => {
  it('cancel during a non-waitAct await: the step goes no further and no later step runs', async () => {
    const { machine, ends } = runMachine([
      makeSlowStep({ name: 'A' }),
      makeInstantStep({ name: 'B' }),
      makeInstantStep({ name: 'C' }),
    ]);
    await flush();
    machine.cancel();
    open('A');
    await flush();

    expect(executed).toEqual(['A', 'A:after-wait']);
    expect(ends()).toBe(1);
    expect(machine.isRunning).toBe(false);
  });

  it('APEX error feedback: the step unwinds, no later step runs, onEnd fires once', async () => {
    anchorEl = document.createElement('div');
    const overlay = document.createElement('div');
    overlay.className = 'af-overlay af-error';
    const message = document.createElement('span');
    message.className = 'af-message';
    message.textContent = 'Insufficient funds';
    overlay.appendChild(message);
    anchorEl.appendChild(overlay);
    document.body.appendChild(anchorEl);

    const { ends } = runMachine([
      makeFeedbackStep({ name: 'A' }),
      makeInstantStep({ name: 'B' }),
    ]);
    await flush();

    expect(executed).toEqual(['A']);
    expect(ends()).toBe(1);
  });

  it('buffer open failure: the step unwinds instead of carrying on without a tile', async () => {
    vi.mocked(openMobileBuffer).mockResolvedValue(false);
    const { ends } = runMachine([
      makeBufferStep({ name: 'A' }),
      makeInstantStep({ name: 'B' }),
    ]);
    await flush();

    expect(executed).toEqual(['A']);
    expect(ends()).toBe(1);
  });

  it('UI skip while a step is in flight: exactly one subsequent step runs', async () => {
    const { machine, ends } = runMachine([
      makeSlowStep({ name: 'A' }),
      makeSlowStep({ name: 'B' }),
      makeInstantStep({ name: 'C' }),
    ]);
    await flush();

    machine.skip(); // A is still mid-execute; B starts
    await flush();
    expect(executed).toEqual(['A', 'B']);

    // The skipped step finishing must not start C alongside B.
    open('A');
    await flush();
    expect(executed).toEqual(['A', 'B', 'A:after-wait']);

    open('B');
    await flush();
    expect(executed).toEqual(['A', 'B', 'A:after-wait', 'B:after-wait', 'C']);
    expect(ends()).toBe(1);
  });

  it('STOP WAITING during a manual confirm (#114): APEX cancel tapped, run ends once, lock freed', async () => {
    anchorEl = document.createElement('div');
    const overlay = document.createElement('div');
    overlay.className = 'af-overlay aco-container';
    let cancelClicks = 0;
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'apex-btn';
    cancelBtn.textContent = 'cancel';
    cancelBtn.addEventListener('click', () => cancelClicks++);
    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'apex-btn';
    confirmBtn.textContent = 'confirm';
    overlay.append(cancelBtn, confirmBtn);
    anchorEl.appendChild(overlay);
    document.body.appendChild(anchorEl);

    // ActionRunner takes the lock before start(); the machine owns releasing it.
    expect(acquireActionLock()).toBe(true);
    const { ends } = runMachine([
      makeFeedbackStep({ name: 'A' }),
      makeInstantStep({ name: 'B' }),
    ]);
    await flush();
    // autoConfirm defaults off: the run waits on the user, with the ConfirmBar up.
    expect(useGameState.getState().actConfirmPending).toBe(true);

    abandonManualConfirmWait();
    await flush();

    expect(cancelClicks).toBe(1);
    expect(executed).toEqual(['A']);
    expect(ends()).toBe(1);
    expect(useGameState.getState().actConfirmPending).toBe(false);
    expect(closeMobileBuffer).toHaveBeenCalledTimes(1);
    expect(isActionInFlight()).toBe(false);
  });

  it('a normal run still executes every step and ends once', async () => {
    const { ends } = runMachine([
      makeInstantStep({ name: 'A' }),
      makeInstantStep({ name: 'B' }),
    ]);
    await flush();
    expect(executed).toEqual(['A', 'B']);
    expect(ends()).toBe(1);
  });
});
