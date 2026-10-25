// One driven action at a time, across ALL action modules — contract actions,
// ship actions, and future ACT runs all drive the same #container, so two
// concurrent runs would fight over the buffer stack. A per-module flag can't
// see the other modules' runs; this shared lock can.
//
// The module variable is the lock itself (synchronous test-and-set). The
// gameState.actionInFlight mirror exists only so the UI can re-render when
// the lock changes hands, e.g. to disable refresh buttons.

import { useGameState } from '../../stores/gameState';

let inFlight = false;

/** Take the lock. Returns false (and takes nothing) if an action is running. */
export function acquireActionLock(): boolean {
  if (inFlight) return false;
  inFlight = true;
  useGameState.getState().setActionInFlight(true);
  return true;
}

export function releaseActionLock(): void {
  inFlight = false;
  useGameState.getState().setActionInFlight(false);
}

export function isActionInFlight(): boolean {
  return inFlight;
}
