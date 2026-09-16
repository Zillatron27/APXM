// ActionRunner's shared action lock (#95): ActionRunner drives #container
// through StepMachine the same way contract/ship actions and the SFC driver
// do, but never took the shared lock — a second run (or a contract/ship
// action mid-flight) could fight it for the buffer stack.

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

const EMPTY_CONFIG = { materialGroups: {}, actions: {} } as unknown as ActionPackageConfig;
const OK_PKG = { global: { name: 'pkg' }, groups: [], actions: [{ type: 'Refuel' as const, name: 'a1' }] };
const FAIL_PKG = { global: { name: 'pkg' }, groups: [], actions: [{ type: 'CX Buy' as const, name: 'a1' }] };

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
});
