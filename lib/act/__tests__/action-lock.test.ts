import { describe, it, expect, beforeEach } from 'vitest';
import { acquireActionLock, releaseActionLock, isActionInFlight } from '../action-lock';
import { useGameState } from '../../../stores/gameState';

beforeEach(() => {
  releaseActionLock();
});

describe('action lock', () => {
  it('is exclusive: a second acquire is refused until release', () => {
    expect(acquireActionLock()).toBe(true);
    expect(acquireActionLock()).toBe(false);
    releaseActionLock();
    expect(acquireActionLock()).toBe(true);
  });

  it('mirrors its state into gameState.actionInFlight for the UI', () => {
    expect(useGameState.getState().actionInFlight).toBe(false);
    acquireActionLock();
    expect(isActionInFlight()).toBe(true);
    expect(useGameState.getState().actionInFlight).toBe(true);
    releaseActionLock();
    expect(useGameState.getState().actionInFlight).toBe(false);
  });
});
