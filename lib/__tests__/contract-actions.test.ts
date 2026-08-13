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
  isApexButtonDisabled,
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
    Button: { btn: 'apex-btn', disabled: 'apex-btn-disabled' },
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

/** The CONT conditions table, as device-captured 2026-08-13: one row per
 *  condition, index cell first ("#3"), the (possibly disabled) action button
 *  in the last cell. */
function buildConditionsTable(
  host: HTMLElement,
  rows: { n: number; label?: string; disabledClass?: string }[]
): void {
  const table = document.createElement('table');
  for (const row of rows) {
    const tr = document.createElement('tr');
    const indexCell = document.createElement('td');
    indexCell.textContent = `#${row.n}`;
    tr.appendChild(indexCell);
    const cmdCell = document.createElement('td');
    if (row.label) {
      const btn = makeButton(row.label);
      if (row.disabledClass) btn.className = row.disabledClass;
      cmdCell.appendChild(btn);
    }
    tr.appendChild(cmdCell);
    table.appendChild(tr);
  }
  host.appendChild(table);
}

describe('findContractActionButton', () => {
  it('matches labels case-insensitively (APEX uppercases via CSS)', () => {
    const { container } = buildContainer(['ACCEPT', 'Reject'], 'af-overlay');
    expect(findContractActionButton(container, { kind: 'accept' })?.textContent).toBe('ACCEPT');
    expect(findContractActionButton(container, { kind: 'reject' })?.textContent).toBe('Reject');
  });

  it('fulfill picks the button from the row whose index cell matches', () => {
    const { container } = buildContainer([], 'af-overlay');
    // Device-observed shape: APEX renders buttons on BOTH self rows (#3 deps
    // met but game-gated, #5 deps unmet) — row addressing must not count.
    buildConditionsTable(container, [
      { n: 3, label: 'fulfill' },
      { n: 4 },
      { n: 5, label: 'fulfill' },
    ]);
    const target: ContractActionTarget = { kind: 'fulfill', conditionNumber: 5 };
    const found = findContractActionButton(container, target);
    expect(found).toBe(container.getElementsByTagName('button')[1]);
  });

  it('falls back to a single unambiguous label match when no row matches', () => {
    const { container } = buildContainer(['Pay'], 'af-overlay');
    expect(
      findContractActionButton(container, { kind: 'fulfill', conditionNumber: 3 })?.textContent
    ).toBe('Pay');
  });

  it('refuses to guess among multiple matches when no row matches', () => {
    const { container } = buildContainer(['Fulfill', 'Fulfill'], 'af-overlay');
    expect(
      findContractActionButton(container, { kind: 'fulfill', conditionNumber: 2 })
    ).toBeUndefined();
  });

  it('returns undefined when nothing matches', () => {
    const { container } = buildContainer(['Cancel'], 'af-overlay');
    expect(findContractActionButton(container, { kind: 'accept' })).toBeUndefined();
  });

  it('matches the request-termination command (device-captured label)', () => {
    const { container } = buildContainer(['request termination'], 'af-overlay');
    expect(findContractActionButton(container, { kind: 'terminate' })?.textContent).toBe(
      'request termination'
    );
  });
});

describe('isApexButtonDisabled', () => {
  // Device capture 2026-08-13: APEX gates buttons with a Button__disabled
  // class, NOT the disabled attribute — clicking one is a silent no-op.
  it('detects the parsed C.Button.disabled class', () => {
    const btn = makeButton('fulfill');
    btn.className = 'apex-btn-disabled apex-btn';
    expect(isApexButtonDisabled(btn)).toBe(true);
  });

  it('detects the raw BEM prefix when stylesheet parsing is unavailable', () => {
    const btn = makeButton('fulfill');
    btn.className = 'Button__disabled___x8i7XF Button__btn___UJGZ1b7';
    expect(isApexButtonDisabled(btn)).toBe(true);
  });

  it('detects the standard disabled attribute', () => {
    const btn = makeButton('fulfill');
    btn.disabled = true;
    expect(isApexButtonDisabled(btn)).toBe(true);
  });

  it('an enabled button is not disabled', () => {
    const btn = makeButton('fulfill');
    btn.className = 'apex-btn';
    expect(isApexButtonDisabled(btn)).toBe(false);
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

  it('reports disabledInApex without clicking when APEX gates the button', async () => {
    const { container, clicks } = buildContainer([], 'af-overlay af-success');
    buildConditionsTable(container, [
      { n: 3, label: 'fulfill', disabledClass: 'Button__disabled___x8i7XF Button__btn___UJGZ1b7' },
    ]);

    const result = await runContractAction('ABC123', { kind: 'fulfill', conditionNumber: 3 });

    expect(result).toEqual({
      ok: false,
      disabledInApex: true,
      error: 'Not yet enabled in APEX',
    });
    expect(clicks).toEqual([]);
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
