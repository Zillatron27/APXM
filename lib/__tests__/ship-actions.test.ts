// One-tap ship unload: drive the FLT buffer off-screen, click the ship's own
// unload button, observe the feedback overlay. The navigator is
// device-validated separately — stubbed here; fixtures model the mobile FLT
// card shape captured 2026-08-14 (one block per ship: header with the
// registration in a plain span, then the fly/cargo/fuel/unload buttons).

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

vi.mock('../mobile-buffer-navigator', () => ({
  openMobileBuffer: vi.fn(async () => true),
  closeMobileBuffer: vi.fn(async () => {}),
}));

import { openMobileBuffer, closeMobileBuffer } from '../mobile-buffer-navigator';
import { runShipUnload, findShipUnloadButton } from '../ship-actions';
import { runContractAction } from '../contract-actions';
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

/** One mobile-FLT ship block: header (name + registration span + status),
 *  then the command buttons — as device-captured 2026-08-14. */
function buildShipBlock(
  host: HTMLElement,
  registration: string,
  clicks: string[],
  opts: { unloadDisabledClass?: string } = {}
): void {
  const block = document.createElement('div');
  const header = document.createElement('header');
  const regSpan = document.createElement('span');
  regSpan.textContent = registration;
  header.appendChild(regSpan);
  block.appendChild(header);
  for (const label of ['fly', 'cargo', 'fuel', 'unload']) {
    const btn = document.createElement('button');
    btn.textContent = label;
    if (label === 'unload' && opts.unloadDisabledClass) {
      btn.className = opts.unloadDisabledClass;
    }
    btn.addEventListener('click', () => clicks.push(`${registration}:${label}`));
    block.appendChild(btn);
  }
  host.appendChild(block);
}

function buildContainer(overlayClass: string): {
  container: HTMLElement;
  overlay: HTMLElement;
  clicks: string[];
} {
  const container = document.createElement('div');
  container.id = 'container';
  document.body.appendChild(container);
  const overlay = document.createElement('div');
  overlay.className = overlayClass;
  container.appendChild(overlay);
  return { container, overlay, clicks: [] };
}

beforeEach(() => {
  document.body.innerHTML = '';
  vi.mocked(openMobileBuffer).mockClear();
  vi.mocked(closeMobileBuffer).mockClear();
  useSettingsStore.getState().setAutoConfirm(false);
  useGameState.getState().setActConfirmPending(false);
});

describe('findShipUnloadButton', () => {
  it('picks the unload button from the matching ship block, not the first ship', () => {
    const { container, clicks } = buildContainer('af-overlay');
    buildShipBlock(container, 'AVI-05M38', clicks);
    buildShipBlock(container, 'AVI-063I6', clicks);
    const btn = findShipUnloadButton(container, 'AVI-063I6');
    btn?.click();
    expect(clicks).toEqual(['AVI-063I6:unload']);
  });

  it('matches the registration case-insensitively (APEX uppercases via CSS)', () => {
    const { container } = buildContainer('af-overlay');
    buildShipBlock(container, 'avi-063i6', []);
    expect(findShipUnloadButton(container, 'AVI-063I6')).toBeDefined();
  });

  it('works on the desktop FLT table shape (registration in a td)', () => {
    const { container, clicks } = buildContainer('af-overlay');
    const table = document.createElement('table');
    for (const reg of ['AVI-05M38', 'AVI-063I6']) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.textContent = reg;
      tr.appendChild(td);
      const cmdCell = document.createElement('td');
      const btn = document.createElement('button');
      btn.textContent = 'unload';
      btn.addEventListener('click', () => clicks.push(reg));
      cmdCell.appendChild(btn);
      tr.appendChild(cmdCell);
      table.appendChild(tr);
    }
    container.appendChild(table);
    findShipUnloadButton(container, 'AVI-063I6')?.click();
    expect(clicks).toEqual(['AVI-063I6']);
  });

  it('returns undefined for an unknown registration', () => {
    const { container } = buildContainer('af-overlay');
    buildShipBlock(container, 'AVI-05M38', []);
    expect(findShipUnloadButton(container, 'AVI-99999')).toBeUndefined();
  });

  it('refuses to guess when the ship block has no unload button of its own', () => {
    const { container } = buildContainer('af-overlay');
    // A registration leaf with no sibling buttons: the ancestor walk reaches
    // the container, which holds ANOTHER ship's unload — must not take it.
    buildShipBlock(container, 'AVI-05M38', []);
    const stray = document.createElement('div');
    const span = document.createElement('span');
    span.textContent = 'AVI-063I6';
    stray.appendChild(span);
    container.appendChild(stray);
    expect(findShipUnloadButton(container, 'AVI-063I6')).toBeUndefined();
  });
});

describe('runShipUnload', () => {
  it('opens FLT, clicks the ship\'s unload, and reports success', async () => {
    const { container, clicks } = buildContainer('af-overlay af-success');
    buildShipBlock(container, 'AVI-063I6', clicks);

    const result = await runShipUnload('AVI-063I6');

    expect(openMobileBuffer).toHaveBeenCalledWith('FLT');
    expect(clicks).toEqual(['AVI-063I6:unload']);
    expect(result).toEqual({ ok: true });
    expect(closeMobileBuffer).toHaveBeenCalledTimes(1);
  });

  it('reports APEX error text (the empty-hold rejection) and still restores', async () => {
    const { container, overlay, clicks } = buildContainer('af-overlay af-error');
    buildShipBlock(container, 'AVI-063I6', clicks);
    const message = document.createElement('span');
    message.className = 'af-message';
    message.textContent = 'Illegal arguments.';
    overlay.appendChild(message);

    const result = await runShipUnload('AVI-063I6');

    expect(result).toEqual({ ok: false, error: 'Illegal arguments.' });
    expect(closeMobileBuffer).toHaveBeenCalledTimes(1);
  });

  it('reports disabledInApex without clicking when the ship is in transit', async () => {
    const { container, clicks } = buildContainer('af-overlay af-success');
    buildShipBlock(container, 'AVI-063I6', clicks, {
      unloadDisabledClass: 'Button__disabledInlineMobile___kCwbIYR Button__disabled____x8i7XF',
    });

    const result = await runShipUnload('AVI-063I6');

    expect(result).toEqual({
      ok: false,
      disabledInApex: true,
      error: 'Not available in APEX',
    });
    expect(clicks).toEqual([]);
    expect(closeMobileBuffer).toHaveBeenCalledTimes(1);
  });

  it('fails cleanly (buffer restored) when the ship is not in the buffer', async () => {
    const { container, clicks } = buildContainer('af-overlay af-success');
    buildShipBlock(container, 'AVI-05M38', clicks);

    const result = await runShipUnload('AVI-063I6');

    expect(result.ok).toBe(false);
    expect(clicks).toEqual([]);
    expect(closeMobileBuffer).toHaveBeenCalledTimes(1);
  });

  it('fails without clicking anything when the buffer cannot be opened', async () => {
    const { container, clicks } = buildContainer('af-overlay af-success');
    buildShipBlock(container, 'AVI-063I6', clicks);
    vi.mocked(openMobileBuffer).mockResolvedValueOnce(false);

    const result = await runShipUnload('AVI-063I6');

    expect(result.ok).toBe(false);
    expect(clicks).toEqual([]);
    expect(closeMobileBuffer).not.toHaveBeenCalled();
  });

  it('shares the action lock with contract actions (cross-module concurrency)', async () => {
    const { container, overlay, clicks } = buildContainer('af-overlay aco-container');
    buildShipBlock(container, 'AVI-063I6', clicks);
    const accept = document.createElement('button');
    accept.textContent = 'accept';
    container.appendChild(accept);
    // The unload run holds the lock until the user's confirm resolves.
    setTimeout(() => {
      overlay.classList.remove('aco-container');
      overlay.classList.add('af-success');
    }, 30);

    const unload = runShipUnload('AVI-063I6');
    const contract = await runContractAction('ABC123', { kind: 'accept' });

    expect(contract).toEqual({ ok: false, error: 'Another action is already running' });
    expect(await unload).toEqual({ ok: true });
    expect(openMobileBuffer).toHaveBeenCalledTimes(1);
  });
});
