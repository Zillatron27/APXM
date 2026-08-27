// NOTS mark-as-read passthrough (#93): drive the NOTS buffer off-screen,
// click APEX's own row or "mark all as read" button, confirm via the alerts
// store. Mirrors contract-actions.test.ts — the navigator is
// device-validated separately and stubbed here.

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';

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
  waitForAlertsRead,
} from '../alert-actions';
import { setupActGlobals } from '../act/globals-setup';
import { C } from '../act/prun-css';
import { useAlertsStore } from '../../stores/entities';
import type { PrunApi } from '../../types/prun-api';

beforeAll(() => {
  setupActGlobals();
  Object.assign(C, {
    Button: { btn: 'apex-btn', disabled: 'apex-btn-disabled' },
  });
});

function makeAlert(id: string, read: boolean): PrunApi.Alert {
  return {
    id,
    type: 'ADMIN_CENTER_ELECTION_REMINDER',
    contextId: '',
    naturalId: '',
    time: 0,
    data: [],
    seen: true,
    read,
  } as unknown as PrunApi.Alert;
}

/** A minimal NOTS buffer inside #container: rows + a bulk button. */
function buildContainer(
  rowIds: string[],
  markAllLabel: string | null = 'mark all as read',
  markAllDisabled = false
): { container: HTMLElement; clicks: string[] } {
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
  return { container, clicks };
}

beforeEach(() => {
  document.body.innerHTML = '';
  vi.mocked(openMobileBuffer).mockClear();
  vi.mocked(closeMobileBuffer).mockClear();
  useAlertsStore.getState().clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('findAlertRow', () => {
  it('finds a row by data-prun-id', () => {
    const { container } = buildContainer(['a-1', 'a-2']);
    expect(findAlertRow(container, 'a-2')).not.toBeUndefined();
    expect(findAlertRow(container, 'a-2')?.getAttribute('data-prun-id')).toBe('a-2');
  });

  it('returns undefined when the id is not present', () => {
    const { container } = buildContainer(['a-1']);
    expect(findAlertRow(container, 'missing')).toBeUndefined();
  });
});

describe('findMarkAllReadButton', () => {
  it('matches case-insensitively (APEX uppercases via CSS)', () => {
    const { container } = buildContainer([], 'MARK ALL AS READ');
    expect(findMarkAllReadButton(container)?.textContent).toBe('MARK ALL AS READ');
  });

  it('returns undefined when no such button exists', () => {
    const { container } = buildContainer([], null);
    expect(findMarkAllReadButton(container)).toBeUndefined();
  });
});

describe('waitForAlertsRead', () => {
  it('resolves true immediately when every id is already read or absent', async () => {
    useAlertsStore.getState().setOne(makeAlert('a-1', true));
    await expect(waitForAlertsRead(['a-1', 'missing'])).resolves.toBe(true);
  });

  it('resolves true once the store catches up, and unsubscribes', async () => {
    useAlertsStore.getState().setOne(makeAlert('a-1', false));
    const promise = waitForAlertsRead(['a-1']);
    useAlertsStore.getState().setOne(makeAlert('a-1', true));
    await expect(promise).resolves.toBe(true);
  });

  it('resolves false on timeout when the store never confirms', async () => {
    vi.useFakeTimers();
    useAlertsStore.getState().setOne(makeAlert('a-1', false));
    const promise = waitForAlertsRead(['a-1'], 5000);
    await vi.advanceTimersByTimeAsync(5000);
    await expect(promise).resolves.toBe(false);
  });
});

describe('markAlertRead', () => {
  it('opens NOTS with a sentinel function, clicks the matching row, and reports success', async () => {
    useAlertsStore.getState().setOne(makeAlert('a-2', false));
    const { clicks } = buildContainer(['a-1', 'a-2']);

    const promise = markAlertRead('a-2');
    // Simulate the server confirming the read shortly after the click.
    useAlertsStore.getState().setOne(makeAlert('a-2', true));
    const result = await promise;

    expect(openMobileBuffer).toHaveBeenCalledWith('NOTS', expect.any(Function));
    expect(clicks).toEqual(['a-2']);
    expect(result).toEqual({ ok: true });
    expect(closeMobileBuffer).toHaveBeenCalledWith({ sweepAppended: true });
  });

  it('fails without retrying when the row is missing, and still restores the buffer', async () => {
    const { clicks } = buildContainer(['a-1']);

    const result = await markAlertRead('missing');

    expect(result).toEqual({
      ok: false,
      error: 'Alert not found in NOTS — already read or removed',
    });
    expect(clicks).toEqual([]);
    expect(closeMobileBuffer).toHaveBeenCalledWith({ sweepAppended: true });
  });

  it('reports the confirm error when the store never shows the alert read', async () => {
    vi.useFakeTimers();
    useAlertsStore.getState().setOne(makeAlert('a-1', false));
    buildContainer(['a-1']);

    const promise = markAlertRead('a-1');
    await vi.advanceTimersByTimeAsync(5000);
    const result = await promise;

    expect(result).toEqual({ ok: false, error: 'APEX did not confirm the read' });
    expect(closeMobileBuffer).toHaveBeenCalledWith({ sweepAppended: true });
  });

  it('fails cleanly when the buffer cannot be opened, without clicking anything', async () => {
    const { clicks } = buildContainer(['a-1']);
    vi.mocked(openMobileBuffer).mockResolvedValueOnce(false);

    const result = await markAlertRead('a-1');

    expect(result.ok).toBe(false);
    expect(clicks).toEqual([]);
    expect(closeMobileBuffer).not.toHaveBeenCalled();
  });

  it('rejects a second tap while an action is in flight', async () => {
    useAlertsStore.getState().setOne(makeAlert('a-1', false));
    buildContainer(['a-1']);

    const first = markAlertRead('a-1');
    const second = await markAlertRead('a-1');
    expect(second).toEqual({ ok: false, error: 'Another action is already running' });

    useAlertsStore.getState().setOne(makeAlert('a-1', true));
    expect(await first).toEqual({ ok: true });
    expect(openMobileBuffer).toHaveBeenCalledTimes(1);
  });

  it('always releases the action lock, even on failure', async () => {
    buildContainer(['a-1']);
    const result = await markAlertRead('missing');
    expect(result.ok).toBe(false);

    // Lock released: a following call can still open a buffer.
    document.body.innerHTML = '';
    useAlertsStore.getState().setOne(makeAlert('a-2', true));
    buildContainer(['a-2']);
    const second = await markAlertRead('a-2');
    expect(second).toEqual({ ok: true });
  });
});

describe('markAllAlertsRead', () => {
  it('opens NOTS with a sentinel function, clicks mark-all, and confirms via the store', async () => {
    useAlertsStore.getState().setOne(makeAlert('a-1', false));
    useAlertsStore.getState().setOne(makeAlert('a-2', false));
    const { clicks } = buildContainer([]);

    const promise = markAllAlertsRead();
    useAlertsStore.getState().setOne(makeAlert('a-1', true));
    useAlertsStore.getState().setOne(makeAlert('a-2', true));
    const result = await promise;

    expect(openMobileBuffer).toHaveBeenCalledWith('NOTS', expect.any(Function));
    expect(clicks).toEqual(['mark-all']);
    expect(result).toEqual({ ok: true });
    expect(closeMobileBuffer).toHaveBeenCalledWith();
  });

  it('resolves immediately when nothing is unread in the store', async () => {
    const { clicks } = buildContainer([]);

    const result = await markAllAlertsRead();

    expect(clicks).toEqual(['mark-all']);
    expect(result).toEqual({ ok: true });
  });

  it('reports disabledInApex without clicking when APEX gates the button', async () => {
    const { clicks } = buildContainer([], 'mark all as read', true);

    const result = await markAllAlertsRead();

    expect(result).toEqual({
      ok: false,
      disabledInApex: true,
      error: 'Nothing unread in APEX',
    });
    expect(clicks).toEqual([]);
    expect(closeMobileBuffer).toHaveBeenCalledWith();
  });

  it('fails cleanly (buffer restored) when the button is missing', async () => {
    buildContainer([], null);

    const result = await markAllAlertsRead();

    expect(result.ok).toBe(false);
    expect(closeMobileBuffer).toHaveBeenCalledWith();
  });

  it('fails without clicking anything when the buffer cannot be opened', async () => {
    buildContainer([]);
    vi.mocked(openMobileBuffer).mockResolvedValueOnce(false);

    const result = await markAllAlertsRead();

    expect(result.ok).toBe(false);
    expect(closeMobileBuffer).not.toHaveBeenCalled();
  });
});
