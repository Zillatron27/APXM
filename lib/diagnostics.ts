/**
 * Diagnostic overlay for APXM interception pipeline.
 *
 * Triggered by ?apxm_debug in the URL query string. Shows which pipeline
 * steps succeeded or failed — critical for debugging on mobile browsers
 * (Orion) where there's no developer console.
 */

type StepStatus = 'ok' | 'fail';

const STEP_LABELS: Record<number, string> = {
  1: 'Content script loaded',
  2: 'Mobile check',
  3: 'Interceptor injected',
  4: 'Interceptor ran',
  5: 'Bridge initialized',
  6: 'First message received',
  7: 'UI mounted',
};

const STEP_COUNT = 7;

/** Check whether debug mode is enabled via URL query string. */
export function isDebugEnabled(): boolean {
  return location.search.includes('apxm_debug');
}

/**
 * Create the fixed-position diagnostic overlay.
 * Self-healing: re-appends to body if removed (HTML parser foster-parents
 * elements from <html> into <body>, then app frameworks can wipe body content).
 */
export function createOverlay(): HTMLElement {
  const panel = document.createElement('div');
  panel.id = 'apxm-diag';
  panel.setAttribute('style', [
    'position:fixed',
    'bottom:12px',
    'right:12px',
    'z-index:2147483647',
    'pointer-events:none',
    'background:rgba(10,10,10,0.92)',
    'border:1px solid #333',
    'border-radius:4px',
    'padding:8px 12px',
    'font-family:monospace',
    'font-size:11px',
    'color:#999',
    'line-height:1.6',
    'white-space:pre-wrap',
    'max-width:375px',
    'word-break:break-word',
  ].join(';'));

  const header = document.createElement('div');
  header.setAttribute('style', 'color:#ff8c00;font-weight:bold;margin-bottom:4px');
  header.textContent = 'APXM Diagnostics';
  panel.appendChild(header);

  for (let i = 1; i <= STEP_COUNT; i++) {
    const row = document.createElement('div');
    row.id = `apxm-diag-step-${i}`;
    row.textContent = `[ -- ] ${STEP_LABELS[i]}`;
    panel.appendChild(row);
  }

  // Append now (body may not exist yet at document_start)
  (document.body || document.documentElement).appendChild(panel);

  // Re-append if removed — HTML parsing or app frameworks can displace it
  function ensureAttached(): void {
    if (!document.contains(panel)) {
      (document.body || document.documentElement).appendChild(panel);
    }
  }

  document.addEventListener('DOMContentLoaded', ensureAttached);
  const interval = setInterval(ensureAttached, 500);
  setTimeout(() => clearInterval(interval), 15_000);

  return panel;
}

/** Mark a step as OK or failed with a timestamp. */
export function markStep(step: number, status: StepStatus, detail?: string): void {
  const row = document.getElementById(`apxm-diag-step-${step}`);
  if (!row) return;

  const ts = new Date().toLocaleTimeString('en-GB', { hour12: false });
  const icon = status === 'ok' ? 'OK' : '!!';
  const color = status === 'ok' ? '#5cb85c' : '#d9534f';
  const suffix = detail ? ` — ${detail}` : '';

  row.textContent = `[ ${icon} ] ${STEP_LABELS[step]}  ${ts}${suffix}`;
  row.setAttribute('style', `color:${color}`);
}

/** Convenience: mark a step as failed with an error message. */
export function markFailed(step: number, error: string): void {
  markStep(step, 'fail', error);
}

/**
 * Poll for a dataset attribute on documentElement.
 * Resolves true if the attribute matches within the timeout, false otherwise.
 */
export function pollForAttribute(attr: string, value: string, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const deadline = performance.now() + timeoutMs;

    function check(): void {
      if (document.documentElement.dataset[attr] === value) {
        resolve(true);
        return;
      }
      if (performance.now() >= deadline) {
        resolve(false);
        return;
      }
      requestAnimationFrame(check);
    }

    requestAnimationFrame(check);
  });
}
