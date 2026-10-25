import { abandonManualConfirmWait } from '../../lib/act/action-feedback';

/**
 * The only APXM chrome shown during a manual-confirm window: a driven APEX
 * action hit the game's confirmation dialog and settings.autoConfirm is off,
 * so the user must tap CONFIRM (or cancel) in APEX itself — the commit stays
 * theirs. AppShell hides the opaque shell and drops the host background while
 * this bar is up (see :host(.act-confirm) in styles.css).
 *
 * Top placement keeps clear of the dialog, which APEX renders over the buffer
 * body — but that is device-validated, not guaranteed (#73 checklist).
 *
 * STOP WAITING is the escape when the dialog can't be reached (wrong place on
 * screen, APEX wedged): it taps APEX's cancel if the dialog is still asking,
 * ends APXM's wait, and the action fails, the buffer closes and the action
 * lock is released. It never confirms.
 */
export function ConfirmBar() {
  return (
    <div className="fixed top-0 left-0 right-0 z-[999999] h-11 min-h-touch px-4 bg-apxm-bg text-apxm-text font-mono text-[11px] font-semibold tracking-wider uppercase flex items-center justify-between border-b border-prun-yellow pointer-events-auto">
      <span>
        <span className="text-prun-yellow">▼</span>
        <span className="ml-2">Confirm or cancel in APEX below</span>
      </span>
      <button
        type="button"
        onClick={abandonManualConfirmWait}
        className="min-h-touch px-2 text-apxm-muted uppercase tracking-wider"
      >
        Stop waiting
      </button>
    </div>
  );
}
