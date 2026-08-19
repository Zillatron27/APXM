// Content-script half of the input bridge (see input-bridge-main.ts for
// why): request an input sequence to be performed in the MAIN world, where
// APEX's React actually reacts to it. Request/ack via shared DOM attributes.

import {
  INPUT_DRIVE_EVENT,
  INPUT_REQUEST_ATTR,
  INPUT_DONE_ATTR,
} from './input-bridge-main';

async function drive(
  el: HTMLElement,
  request:
    | { kind: 'type'; text: string }
    | { kind: 'key'; key: string }
    | { kind: 'click' }
    | { kind: 'clickAt'; xFrac: number },
  timeoutMs: number
): Promise<boolean> {
  el.removeAttribute(INPUT_DONE_ATTR);
  el.setAttribute(INPUT_REQUEST_ATTR, JSON.stringify(request));
  el.dispatchEvent(new Event(INPUT_DRIVE_EVENT, { bubbles: true }));
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const done = el.getAttribute(INPUT_DONE_ATTR);
    if (done !== null) {
      el.removeAttribute(INPUT_DONE_ATTR);
      return done === 'ok';
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  return false;
}

/** Types `text` into the input in the main world (clears any stale value). */
export function driveType(el: HTMLInputElement, text: string, timeoutMs = 8000): Promise<boolean> {
  return drive(el, { kind: 'type', text }, timeoutMs);
}

/** A single key press (e.g. ArrowDown, Enter) in the main world. */
export function driveKey(el: HTMLElement, key: string, timeoutMs = 3000): Promise<boolean> {
  return drive(el, { kind: 'key', key }, timeoutMs);
}

/** mousedown+mouseup+click in the main world. */
export function driveClick(el: HTMLElement, timeoutMs = 3000): Promise<boolean> {
  return drive(el, { kind: 'click' }, timeoutMs);
}

/** Positioned click at a horizontal fraction of the element (rc-slider rail). */
export function driveClickAt(el: HTMLElement, xFrac: number, timeoutMs = 3000): Promise<boolean> {
  return drive(el, { kind: 'clickAt', xFrac }, timeoutMs);
}
