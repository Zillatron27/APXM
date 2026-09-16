// The shared #container action lock (#95): every DOM driver of APEX's
// buffer stack (contract/ship/alert/buffer-card actions, the SFC driver,
// buffer-refresh, and now the ACT runner) must hold this before touching
// #container, since a per-module flag can't see another module's run.

import { describe, it, expect, afterEach } from 'vitest';
import { acquireActionLock, releaseActionLock, isActionInFlight } from '../action-lock';

afterEach(() => {
  releaseActionLock();
});

describe('action-lock', () => {
  it('acquire succeeds when nothing is running', () => {
    expect(acquireActionLock()).toBe(true);
  });

  it('a second acquire is refused while the first is held', () => {
    expect(acquireActionLock()).toBe(true);
    expect(acquireActionLock()).toBe(false);
  });

  it('release lets a subsequent acquire succeed again', () => {
    acquireActionLock();
    releaseActionLock();
    expect(acquireActionLock()).toBe(true);
  });

  it('isActionInFlight reflects the held/released state', () => {
    expect(isActionInFlight()).toBe(false);
    acquireActionLock();
    expect(isActionInFlight()).toBe(true);
    releaseActionLock();
    expect(isActionInFlight()).toBe(false);
  });
});
