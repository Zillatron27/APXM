// One-tap contract passthrough (#73): drive the CONT buffer off-screen,
// click APEX's own button, observe the feedback overlay. The navigator is
// device-validated separately — stubbed here; the fixtures model APEX's
// overlay state machine like step-machine-gate.test.ts does.

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

vi.mock('../mobile-buffer-navigator', () => ({
  openMobileBuffer: vi.fn(async () => true),
  closeMobileBuffer: vi.fn(async () => {}),
}));

import { openMobileBuffer, closeMobileBuffer } from '../mobile-buffer-navigator';
import {
  runContractAction,
  findContractActionButton,
  type ContractActionTarget,
} from '../contract-actions';
import { setupActGlobals } from '../act/globals-setup';
import { C } from '../act/prun-css';
import { useSettingsStore } from '../../stores/settings';
import { useGameState } from '../../stores/gameState';

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

function makeButton(label: string): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.textContent = label;
  return btn;
}

/** A minimal CONT buffer inside #container: action buttons + an overlay. */
function buildContainer(buttons: string[], overlayClass: string): {
  container: HTMLElement;
  overlay: HTMLElement;
  clicks: string[];
} {
  const container = document.createElement('div');
  container.id = 'container';
  document.body.appendChild(container);
  const clicks: string[] = [];
  for (const label of buttons) {
    const btn = makeButton(label);
    btn.addEventListener('click', () => clicks.push(label));
    container.appendChild(btn);
  }
  const overlay = document.createElement('div');
  overlay.className = overlayClass;
  container.appendChild(overlay);
  return { container, overlay, clicks };
}

beforeEach(() => {
  document.body.innerHTML = '';
  vi.mocked(openMobileBuffer).mockClear();
  vi.mocked(closeMobileBuffer).mockClear();
  useSettingsStore.getState().setAutoConfirm(false);
  useGameState.getState().setActConfirmPending(false);
});

describe('findContractActionButton', () => {
  it('matches labels case-insensitively (APEX uppercases via CSS)', () => {
    const { container } = buildContainer(['ACCEPT', 'Reject'], 'af-overlay');
    expect(findContractActionButton(container, { kind: 'accept' })?.textContent).toBe('ACCEPT');
    expect(findContractActionButton(container, { kind: 'reject' })?.textContent).toBe('Reject');
  });

  it('picks the Nth fulfill button by available-ordinal', () => {
    const { container } = buildContainer(['Fulfill', 'Fulfill'], 'af-overlay');
    const target: ContractActionTarget = { kind: 'fulfill', conditionIndex: 1 };
    const buttons = container.getElementsByTagName('button');
    expect(findContractActionButton(container, target)).toBe(buttons[1]);
  });

  it('a single fulfill match is used regardless of ordinal', () => {
    const { container } = buildContainer(['Pay'], 'af-overlay');
    expect(
      findContractActionButton(container, { kind: 'fulfill', conditionIndex: 3 })?.textContent
    ).toBe('Pay');
  });

  it('returns undefined when nothing matches', () => {
    const { container } = buildContainer(['Cancel'], 'af-overlay');
    expect(findContractActionButton(container, { kind: 'accept' })).toBeUndefined();
  });
});

describe('runContractAction', () => {
  it('opens the CONT buffer, clicks the button, and reports success', async () => {
    const { clicks } = buildContainer(['Accept', 'Reject'], 'af-overlay af-success');

    const result = await runContractAction('ABC123', { kind: 'accept' });

    expect(openMobileBuffer).toHaveBeenCalledWith('CONT ABC123');
    expect(clicks).toEqual(['Accept']);
    expect(result).toEqual({ ok: true });
    expect(closeMobileBuffer).toHaveBeenCalledTimes(1);
  });

  it('reports APEX error text and still restores the buffer', async () => {
    const { overlay } = buildContainer(['Accept'], 'af-overlay af-error');
    const message = document.createElement('span');
    message.className = 'af-message';
    message.textContent = 'Insufficient funds';
    overlay.appendChild(message);

    const result = await runContractAction('ABC123', { kind: 'accept' });

    expect(result).toEqual({ ok: false, error: 'Insufficient funds' });
    expect(closeMobileBuffer).toHaveBeenCalledTimes(1);
  });

  it('fails cleanly (buffer restored) when the button is missing', async () => {
    buildContainer(['Cancel'], 'af-overlay af-success');

    const result = await runContractAction('ABC123', { kind: 'reject' });

    expect(result.ok).toBe(false);
    expect(closeMobileBuffer).toHaveBeenCalledTimes(1);
  });

  it('drives actConfirmPending true→false around the manual-confirm window', async () => {
    const { overlay } = buildContainer(['Accept'], 'af-overlay aco-container');
    const pendingSeen: boolean[] = [];
    const unsubscribe = useGameState.subscribe((s) => {
      pendingSeen.push(s.actConfirmPending);
    });
    // User taps CONFIRM in APEX a beat later.
    setTimeout(() => {
      overlay.classList.remove('aco-container');
      overlay.classList.add('af-success');
    }, 20);

    const result = await runContractAction('ABC123', { kind: 'accept' });
    unsubscribe();

    expect(result).toEqual({ ok: true });
    expect(pendingSeen).toContain(true);
    expect(useGameState.getState().actConfirmPending).toBe(false);
  });

  it('rejects a second tap while an action is in flight', async () => {
    const { overlay } = buildContainer(['Accept'], 'af-overlay aco-container');
    setTimeout(() => {
      overlay.classList.remove('aco-container');
      overlay.classList.add('af-success');
    }, 30);

    const first = runContractAction('ABC123', { kind: 'accept' });
    const second = await runContractAction('ABC123', { kind: 'accept' });

    expect(second).toEqual({ ok: false, error: 'Another action is already running' });
    expect(await first).toEqual({ ok: true });
    // Only the first action opened a buffer.
    expect(openMobileBuffer).toHaveBeenCalledTimes(1);
  });

  it('fails without clicking anything when the buffer cannot be opened', async () => {
    buildContainer(['Accept'], 'af-overlay af-success');
    vi.mocked(openMobileBuffer).mockResolvedValueOnce(false);

    const result = await runContractAction('ABC123', { kind: 'accept' });

    expect(result.ok).toBe(false);
    expect(closeMobileBuffer).not.toHaveBeenCalled();
  });
});
