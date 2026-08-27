// NOTS mark-as-read passthrough (#93): drive the NOTS buffer off-screen,
// click APEX's own row or "mark all as read" button, observe the feedback
// overlay. Mirrors contract-actions.test.ts — the navigator is
// device-validated separately and stubbed here.

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

vi.mock('../mobile-buffer-navigator', () => ({
  openMobileBuffer: vi.fn(async () => true),
  closeMobileBuffer: vi.fn(async () => {}),
}));

import { openMobileBuffer, closeMobileBuffer } from '../mobile-buffer-navigator';
import {
  markAlertRead,
  markAllAlertsRead,
  findAlertRow,
  findMarkAllReadButton,
} from '../alert-actions';
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

/** A minimal NOTS buffer inside #container: rows + a bulk button + overlay. */
function buildContainer(
  rowIds: string[],
  overlayClass: string,
  markAllLabel: string | null = 'mark all as read',
  markAllDisabled = false
): { container: HTMLElement; overlay: HTMLElement; clicks: string[] } {
  const container = document.createElement('div');
  container.id = 'container';
  document.body.appendChild(container);
  const clicks: string[] = [];
  for (const id of rowIds) {
    const row = document.createElement('div');
    row.className = 'AlertListItem__container___x8i7XF';
    row.setAttribute('data-prun-id', id);
    row.addEventListener('click', () => clicks.push(id));
    container.appendChild(row);
  }
  if (markAllLabel) {
    const btn = document.createElement('button');
    btn.textContent = markAllLabel;
    if (markAllDisabled) btn.className = 'apex-btn-disabled';
    btn.addEventListener('click', () => clicks.push('mark-all'));
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

describe('findAlertRow', () => {
  it('finds a row by data-prun-id', () => {
    const { container } = buildContainer(['a-1', 'a-2'], 'af-overlay');
    expect(findAlertRow(container, 'a-2')).not.toBeUndefined();
    expect(findAlertRow(container, 'a-2')?.getAttribute('data-prun-id')).toBe('a-2');
  });

  it('returns undefined when the id is not present', () => {
    const { container } = buildContainer(['a-1'], 'af-overlay');
    expect(findAlertRow(container, 'missing')).toBeUndefined();
  });
});

describe('findMarkAllReadButton', () => {
  it('matches case-insensitively (APEX uppercases via CSS)', () => {
    const { container } = buildContainer([], 'af-overlay', 'MARK ALL AS READ');
    expect(findMarkAllReadButton(container)?.textContent).toBe('MARK ALL AS READ');
  });

  it('returns undefined when no such button exists', () => {
    const { container } = buildContainer([], 'af-overlay', null);
    expect(findMarkAllReadButton(container)).toBeUndefined();
  });
});

describe('markAlertRead', () => {
  it('opens NOTS, clicks the matching row, and reports success', async () => {
    const { clicks } = buildContainer(['a-1', 'a-2'], 'af-overlay af-success');

    const result = await markAlertRead('a-2');

    expect(openMobileBuffer).toHaveBeenCalledWith('NOTS');
    expect(clicks).toEqual(['a-2']);
    expect(result).toEqual({ ok: true });
    expect(closeMobileBuffer).toHaveBeenCalledTimes(1);
  });

  it('fails without retrying when the row is missing, and still restores the buffer', async () => {
    const { clicks } = buildContainer(['a-1'], 'af-overlay af-success');

    const result = await markAlertRead('missing');

    expect(result).toEqual({
      ok: false,
      error: 'Alert not found in NOTS — already read or removed',
    });
    expect(clicks).toEqual([]);
    expect(closeMobileBuffer).toHaveBeenCalledTimes(1);
  });

  it('reports APEX error text and still restores the buffer', async () => {
    const { overlay } = buildContainer(['a-1'], 'af-overlay af-error');
    const message = document.createElement('span');
    message.className = 'af-message';
    message.textContent = 'Something went wrong';
    overlay.appendChild(message);

    const result = await markAlertRead('a-1');

    expect(result).toEqual({ ok: false, error: 'Something went wrong' });
    expect(closeMobileBuffer).toHaveBeenCalledTimes(1);
  });

  it('fails cleanly when the buffer cannot be opened, without clicking anything', async () => {
    const { clicks } = buildContainer(['a-1'], 'af-overlay af-success');
    vi.mocked(openMobileBuffer).mockResolvedValueOnce(false);

    const result = await markAlertRead('a-1');

    expect(result.ok).toBe(false);
    expect(clicks).toEqual([]);
    expect(closeMobileBuffer).not.toHaveBeenCalled();
  });

  it('rejects a second tap while an action is in flight', async () => {
    const { overlay } = buildContainer(['a-1'], 'af-overlay aco-container');
    setTimeout(() => {
      overlay.classList.remove('aco-container');
      overlay.classList.add('af-success');
    }, 20);

    const first = markAlertRead('a-1');
    const second = await markAlertRead('a-1');

    expect(second).toEqual({ ok: false, error: 'Another action is already running' });
    expect(await first).toEqual({ ok: true });
    expect(openMobileBuffer).toHaveBeenCalledTimes(1);
  });

  it('always releases the action lock, even on failure', async () => {
    buildContainer(['a-1'], 'af-overlay af-success');
    const result = await markAlertRead('missing');
    expect(result.ok).toBe(false);

    // Lock released: a following call can still open a buffer.
    document.body.innerHTML = '';
    buildContainer(['a-2'], 'af-overlay af-success');
    const second = await markAlertRead('a-2');
    expect(second).toEqual({ ok: true });
  });
});

describe('markAllAlertsRead', () => {
  it('opens NOTS, clicks the mark-all button, and reports success', async () => {
    const { clicks } = buildContainer([], 'af-overlay af-success');

    const result = await markAllAlertsRead();

    expect(openMobileBuffer).toHaveBeenCalledWith('NOTS');
    expect(clicks).toEqual(['mark-all']);
    expect(result).toEqual({ ok: true });
    expect(closeMobileBuffer).toHaveBeenCalledTimes(1);
  });

  it('reports disabledInApex without clicking when APEX gates the button', async () => {
    const { clicks } = buildContainer([], 'af-overlay af-success', 'mark all as read', true);

    const result = await markAllAlertsRead();

    expect(result).toEqual({
      ok: false,
      disabledInApex: true,
      error: 'Nothing unread in APEX',
    });
    expect(clicks).toEqual([]);
    expect(closeMobileBuffer).toHaveBeenCalledTimes(1);
  });

  it('fails cleanly (buffer restored) when the button is missing', async () => {
    buildContainer([], 'af-overlay af-success', null);

    const result = await markAllAlertsRead();

    expect(result.ok).toBe(false);
    expect(closeMobileBuffer).toHaveBeenCalledTimes(1);
  });

  it('fails without clicking anything when the buffer cannot be opened', async () => {
    buildContainer([], 'af-overlay af-success');
    vi.mocked(openMobileBuffer).mockResolvedValueOnce(false);

    const result = await markAllAlertsRead();

    expect(result.ok).toBe(false);
    expect(closeMobileBuffer).not.toHaveBeenCalled();
  });
});
