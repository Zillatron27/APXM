// The autoConfirm gate: APEX's post-ACT confirmation overlay is auto-clicked
// ONLY when settings.autoConfirm is on. The default (false) waits for the
// user to tap CONFIRM in APEX themselves — the action-authorisation rule —
// and must bring the hidden buffer on-screen so that tap is possible.

import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';

// stop() closes the mobile buffer; that drives APEX Stack DOM jsdom doesn't
// have. The navigator is device-validated in Phase D — stub it out here.
vi.mock('../../mobile-buffer-navigator', () => ({
  openMobileBuffer: vi.fn(async () => true),
  closeMobileBuffer: vi.fn(async () => {}),
}));

import { StepMachine } from '../runner/step-machine';
import { act } from '../act-registry';
import { setupActGlobals } from '../globals-setup';
import { C } from '../prun-css';
import { Logger, type LogTag, type LogContent } from '../runner/logger';
import { useSettingsStore } from '../../../stores/settings';

// Synthetic APEX class names for the overlay state machine.
beforeAll(() => {
  setupActGlobals();
  Object.assign(C, {
    ActionFeedback: {
      overlay: 'af-overlay',
      progress: 'af-progress',
      success: 'af-success',
      error: 'af-error',
      message: 'af-message',
      dismiss: 'af-dismiss',
    },
    ActionConfirmationOverlay: { container: 'aco-container' },
    Button: { btn: 'apex-btn' },
  });
});

// Test step: runs waitActionFeedback against the fixture anchor, then completes.
let anchorEl: HTMLElement;
const makeGateStep = act.addActionStep<Record<string, never>>({
  type: 'GATE_TEST',
  description: () => 'gate test step',
  execute: async (ctx) => {
    await ctx.waitActionFeedback({ anchor: anchorEl });
    ctx.complete();
  },
});

interface Fixture {
  anchor: HTMLElement;
  overlay: HTMLElement;
  confirmBtn: HTMLElement;
  confirmClicks: () => number;
}

// Overlay starts in the confirmation state, inside an off-screen anchor
// (the state openMobileBuffer leaves #container in).
function buildConfirmationOverlay(): Fixture {
  const anchor = document.createElement('div');
  anchor.style.visibility = 'hidden';
  anchor.style.left = '-9999px';
  document.body.appendChild(anchor);
  anchorEl = anchor;

  const overlay = document.createElement('div');
  overlay.className = 'af-overlay aco-container';
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'apex-btn';
  const confirmBtn = document.createElement('button');
  confirmBtn.className = 'apex-btn';
  let clicks = 0;
  confirmBtn.addEventListener('click', () => {
    clicks++;
    // APEX transitions the same element: confirmation → success.
    overlay.classList.remove('aco-container');
    overlay.classList.add('af-success');
  });
  overlay.append(cancelBtn, confirmBtn);
  anchor.appendChild(overlay);
  return { anchor, overlay, confirmBtn, confirmClicks: () => clicks };
}

function runMachine() {
  const logs: { tag: LogTag; msg: LogContent }[] = [];
  let resolveEnd!: () => void;
  const done = new Promise<void>((r) => (resolveEnd = r));
  const machine = new StepMachine([makeGateStep({})], {
    log: new Logger((tag, msg) => logs.push({ tag, msg })),
    onBufferSplit: () => {},
    onStart: () => {},
    onEnd: () => resolveEnd(),
    onStatusChanged: () => {},
    onActReady: () => {},
  });
  machine.start();
  const errors = () => logs.filter((l) => l.tag === 'ERROR').map((l) => l.msg);
  return { done, errors };
}

beforeEach(() => {
  document.body.innerHTML = '';
  useSettingsStore.getState().setAutoConfirm(false);
});

describe('settings default', () => {
  it('autoConfirm defaults to false (manual confirm is the shipped behaviour)', () => {
    expect(useSettingsStore.getInitialState().autoConfirm).toBe(false);
  });
});

describe('waitActionFeedback confirmation gate', () => {
  it('autoConfirm ON: clicks the confirm button (second APEX button) itself', async () => {
    useSettingsStore.getState().setAutoConfirm(true);
    const fixture = buildConfirmationOverlay();
    const { done, errors } = runMachine();
    await done;
    expect(fixture.confirmClicks()).toBe(1);
    expect(errors()).toEqual([]);
  });

  it('autoConfirm OFF: never clicks, un-hides the buffer for the user tap, and restores it after', async () => {
    const fixture = buildConfirmationOverlay();
    let visibilityDuringWait: string | undefined;
    let leftDuringWait: string | undefined;
    // Simulate the user tapping CONFIRM in APEX a beat later.
    setTimeout(() => {
      visibilityDuringWait = fixture.anchor.style.visibility;
      leftDuringWait = fixture.anchor.style.left;
      fixture.overlay.classList.remove('aco-container');
      fixture.overlay.classList.add('af-success');
    }, 20);

    const { done, errors } = runMachine();
    await done;

    expect(fixture.confirmClicks()).toBe(0);
    // The gate brought the off-screen buffer on-screen so the tap was possible…
    expect(visibilityDuringWait).toBe('visible');
    expect(leftDuringWait).toBe('0px');
    // …and put it back afterwards.
    expect(fixture.anchor.style.visibility).toBe('hidden');
    expect(fixture.anchor.style.left).toBe('-9999px');
    expect(errors()).toEqual([]);
  });

  it('autoConfirm OFF: overlay removal (user cancelled in APEX) fails the step instead of hanging', async () => {
    const fixture = buildConfirmationOverlay();
    setTimeout(() => fixture.overlay.remove(), 20);

    const { done, errors } = runMachine();
    await done;

    expect(fixture.confirmClicks()).toBe(0);
    expect(errors()).toContain('Unknown action feedback overlay');
    // Styles restored even on the failure path.
    expect(fixture.anchor.style.visibility).toBe('hidden');
    expect(fixture.anchor.style.left).toBe('-9999px');
  });

  it('skips the gate entirely when the overlay is already past confirmation', async () => {
    const fixture = buildConfirmationOverlay();
    fixture.overlay.classList.remove('aco-container');
    fixture.overlay.classList.add('af-success');

    const { done, errors } = runMachine();
    await done;

    expect(fixture.confirmClicks()).toBe(0);
    expect(errors()).toEqual([]);
  });
});
