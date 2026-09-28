// ActionRunner's shared action lock (#95): ActionRunner drives #container
// through StepMachine the same way contract/ship actions and the SFC driver
// do, but never took the shared lock — a second run (or a contract/ship
// action mid-flight) could fight it for the buffer stack. ActionRunner
// acquires; StepMachine.stop() releases, exactly once per run.

import { describe, it, expect, beforeEach, vi } from 'vitest';

// StepMachine.stop() closes the mobile buffer; that drives APEX Stack DOM
// jsdom doesn't have (same stub as step-machine-gate.test.ts).
vi.mock('../../mobile-buffer-navigator', () => ({
  openMobileBuffer: vi.fn(async () => true),
  closeMobileBuffer: vi.fn(async () => {}),
}));

import { act } from '../act-registry';
import { ActionRunner } from '../runner/action-runner';
import { Logger, type LogTag, type LogContent } from '../runner/logger';
import { acquireActionLock, releaseActionLock, isActionInFlight } from '../action-lock';
import { closeMobileBuffer } from '../../mobile-buffer-navigator';
import { useGameState } from '../../../stores/gameState';
import type { ActionPackageConfig } from '../shared-types';

// 'Refuel' is a real UserData.ActionType with no shipped implementation —
// safe to claim as this file's probe registration (vitest isolates the
// registry per test file; pattern matches step-generator.test.ts).
act.addAction({
  type: 'Refuel',
  description: () => 'probe action',
  editComponent: null,
  generateSteps: async (ctx) => {
    ctx.emitStep({ type: 'RUNNER_LOCK_OK' });
  },
});
act.addActionStep<Record<string, never>>({
  type: 'RUNNER_LOCK_OK',
  description: () => 'completes immediately, no DOM',
  execute: async (ctx) => {
    ctx.complete();
  },
});

// A second probe action whose step fails immediately after starting — used
// to reach StepMachine's failure exit (as opposed to the success exit).
act.addAction({
  type: 'CX Buy',
  description: () => 'probe action (fails)',
  editComponent: null,
  generateSteps: async (ctx) => {
    ctx.emitStep({ type: 'RUNNER_LOCK_FAIL' });
  },
});
act.addActionStep<Record<string, never>>({
  type: 'RUNNER_LOCK_FAIL',
  description: () => 'fails immediately, no DOM',
  execute: async (ctx) => {
    ctx.fail('boom');
  },
});

// A step parked on a gate the test opens — lets a cancelled step finish late.
let releaseSlowStep: () => void = () => {};
act.addAction({
  type: 'CONT Trade',
  description: () => 'probe action (slow)',
  editComponent: null,
  generateSteps: async (ctx) => {
    ctx.emitStep({ type: 'RUNNER_LOCK_SLOW' });
  },
});
act.addActionStep<Record<string, never>>({
  type: 'RUNNER_LOCK_SLOW',
  description: () => 'waits on a gate, then fails',
  execute: async (ctx) => {
    await new Promise<void>((r) => (releaseSlowStep = r));
    ctx.fail('late failure');
  },
});

const EMPTY_CONFIG = { materialGroups: {}, actions: {} } as unknown as ActionPackageConfig;
const OK_PKG = { global: { name: 'pkg' }, groups: [], actions: [{ type: 'Refuel' as const, name: 'a1' }] };
const FAIL_PKG = { global: { name: 'pkg' }, groups: [], actions: [{ type: 'CX Buy' as const, name: 'a1' }] };
const SLOW_PKG = { global: { name: 'pkg' }, groups: [], actions: [{ type: 'CONT Trade' as const, name: 'a1' }] };

async function flush(): Promise<void> {
  for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0));
}

/** Counts lock releases through the gameState mirror (true → false edges). */
function countReleases(): () => number {
  let releases = 0;
  useGameState.subscribe((state, prev) => {
    if (prev.actionInFlight && !state.actionInFlight) releases++;
  });
  return () => releases;
}

function makeRunner() {
  const lines: { tag: LogTag; msg: LogContent }[] = [];
  let resolveEnd!: () => void;
  const ended = new Promise<void>((r) => (resolveEnd = r));
  const runner = new ActionRunner({
    log: new Logger((tag, msg) => lines.push({ tag, msg })),
    onBufferSplit: () => {},
    onStart: () => {},
    onEnd: () => resolveEnd(),
    onStatusChanged: () => {},
    onActReady: () => {},
  });
  return { runner, lines, ended };
}

beforeEach(() => {
  releaseActionLock();
  vi.mocked(closeMobileBuffer).mockImplementation(async () => {});
});

describe('ActionRunner shared action lock (#95)', () => {
  it('refuses to execute while the lock is held elsewhere', async () => {
    acquireActionLock();
    try {
      const { runner, lines } = makeRunner();
      await runner.execute(OK_PKG, EMPTY_CONFIG);
      expect(lines).toContainEqual({ tag: 'ERROR', msg: 'Another action is already running' });
      expect(runner.isRunning).toBe(false);
    } finally {
      releaseActionLock();
    }
  });

  it('releases the lock after a completed run', async () => {
    const { runner, ended } = makeRunner();
    await runner.execute(OK_PKG, EMPTY_CONFIG);
    await ended;
    expect(isActionInFlight()).toBe(false);
  });

  it('releases the lock after a failed run', async () => {
    const { runner, ended, lines } = makeRunner();
    await runner.execute(FAIL_PKG, EMPTY_CONFIG);
    await ended;
    expect(lines).toContainEqual({ tag: 'ERROR', msg: 'boom' });
    expect(isActionInFlight()).toBe(false);
  });

  it('releases exactly once per run', async () => {
    const releases = countReleases();
    const { runner, ended } = makeRunner();
    await runner.execute(OK_PKG, EMPTY_CONFIG);
    await ended;
    await flush();
    expect(releases()).toBe(1);
  });

  it("a cancelled run's late step never frees a lock another action has since taken", async () => {
    const releases = countReleases();
    const { runner } = makeRunner();
    await runner.execute(SLOW_PKG, EMPTY_CONFIG);
    await flush();
    expect(isActionInFlight()).toBe(true);

    runner.cancel();
    await flush();
    expect(isActionInFlight()).toBe(false);

    // Another driver takes the lock; then the abandoned step fails late.
    expect(acquireActionLock()).toBe(true);
    releaseSlowStep();
    await flush();

    expect(isActionInFlight()).toBe(true);
    expect(releases()).toBe(1);
  });

  it('holds the lock until the buffer close has settled', async () => {
    let finishClose!: () => void;
    vi.mocked(closeMobileBuffer).mockImplementation(
      () => new Promise<void>((r) => (finishClose = r))
    );
    const { runner, ended } = makeRunner();
    await runner.execute(OK_PKG, EMPTY_CONFIG);
    await ended;
    // The run has ended, but APEX is still being navigated back.
    expect(isActionInFlight()).toBe(true);

    finishClose();
    await flush();
    expect(isActionInFlight()).toBe(false);
  });
});
