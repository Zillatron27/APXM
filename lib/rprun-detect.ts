/**
 * rprun Detection
 *
 * Detects whether the rprun (Refined PrUn) community extension is present
 * by looking for its version label in the APEX footer bar.
 */

let detected = false;
let checked = false;
let observer: MutationObserver | null = null;
let fallbackTimeout: ReturnType<typeof setTimeout> | null = null;
const listeners: Array<() => void> = [];

const RPRUN_SELECTOR = '[data-tooltip="Refined PrUn version."]';

function check(): boolean {
  return document.querySelector(RPRUN_SELECTOR) !== null;
}

function notifyDetected(): void {
  detected = true;
  if (observer) { observer.disconnect(); observer = null; }
  if (fallbackTimeout !== null) { clearTimeout(fallbackTimeout); fallbackTimeout = null; }
  for (const cb of listeners) cb();
}

/** Returns current detection state. */
export function isRprunDetected(): boolean {
  return detected;
}

/** Subscribe to detection state changes. Returns unsubscribe function.
 *  If already detected, fires callback immediately. */
export function onRprunDetected(callback: () => void): () => void {
  if (detected) {
    callback();
  }
  listeners.push(callback);
  return () => {
    const idx = listeners.indexOf(callback);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

/**
 * Run initial detection check. Call after first WebSocket data arrives
 * (APEX and rprun are both loaded by then).
 *
 * If not found immediately, sets up a MutationObserver to catch late loading.
 */
export function initRprunDetection(): void {
  if (checked) return;
  checked = true;

  if (check()) {
    notifyDetected();
    return;
  }

  // rprun may load slightly after APEX — watch for it
  observer = new MutationObserver(() => {
    if (check()) notifyDetected();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Stop watching after 30 seconds — rprun won't load this late
  fallbackTimeout = setTimeout(() => {
    fallbackTimeout = null;
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  }, 30000);
}
