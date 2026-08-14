// One driven action at a time, across ALL action modules — contract actions,
// ship actions, and future ACT runs all drive the same #container, so two
// concurrent runs would fight over the buffer stack. A per-module flag can't
// see the other modules' runs; this shared lock can.

let inFlight = false;

/** Take the lock. Returns false (and takes nothing) if an action is running. */
export function acquireActionLock(): boolean {
  if (inFlight) return false;
  inFlight = true;
  return true;
}

export function releaseActionLock(): void {
  inFlight = false;
}

export function isActionInFlight(): boolean {
  return inFlight;
}
