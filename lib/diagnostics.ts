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

// Module-level reference so ensureDiagnosticsVisible() can access the panel
let diagPanel: HTMLElement | null = null;

/**
 * Create the fixed-position diagnostic overlay.
 * Self-healing via MutationObserver: re-appends to body whenever removed
 * (HTML parser foster-parents, app framework DOM wipes, shadow host mount).
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

  diagPanel = panel;

  // Append now (body may not exist yet at document_start)
  const target = document.body || document.documentElement;
  target.appendChild(panel);
  console.log('[APXM Diag] Overlay created, appended to', target.tagName);

  // Move to body once it exists, and re-append if anything removes it.
  // Uses MutationObserver instead of a timer so it persists for the full
  // page lifetime — the old 15-second setInterval expired too early.
  function ensureInBody(): void {
    if (document.body && panel.parentNode !== document.body) {
      document.body.appendChild(panel);
      console.log('[APXM Diag] Panel moved/re-appended to body');
    }
  }

  document.addEventListener('DOMContentLoaded', ensureInBody);

  const observer = new MutationObserver(() => {
    if (!document.contains(panel)) {
      ensureInBody();
    }
  });

  // Start observing once body exists; if it doesn't yet, wait for DOMContentLoaded
  function startObserver(): void {
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  if (document.body) {
    startObserver();
  } else {
    document.addEventListener('DOMContentLoaded', startObserver);
  }

  return panel;
}

/**
 * Force the diagnostic panel to the end of body.
 * Call after shadow host mount to guarantee it renders on top.
 */
export function ensureDiagnosticsVisible(): void {
  if (!diagPanel) return;
  if (document.body && diagPanel.parentNode !== document.body) {
    document.body.appendChild(diagPanel);
    console.log('[APXM Diag] ensureDiagnosticsVisible: re-appended to body');
  } else if (document.body) {
    // Already in body — move to end so it's the last fixed-position sibling
    document.body.appendChild(diagPanel);
    console.log('[APXM Diag] ensureDiagnosticsVisible: moved to end of body');
  }
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
