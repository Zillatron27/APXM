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
import { runShipUnload, runShipRefuel, findShipUnloadButton } from '../ship-actions';
import { runContractAction } from '../contract-actions';
import { setupActGlobals } from '../act/globals-setup';
import { C } from '../act/prun-css';
import { useSettingsStore } from '../../stores/settings';
import { useGameState } from '../../stores/gameState';
import { useShipsStore, useSitesStore, useStorageStore } from '../../stores/entities';
import { useMaterialsStore } from '../../stores/reference';
import {
  createTestShip,
  createTestSite,
  createTestStorage,
  createAddress,
} from '../../__tests__/fixtures/factories';
import type { PrunApi } from '../../types/prun-api';

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

    expect(openMobileBuffer).toHaveBeenCalledWith('FLT', expect.any(Function));
    expect(clicks).toEqual(['AVI-063I6:unload']);
    expect(result).toEqual({ ok: true });
    expect(closeMobileBuffer).toHaveBeenCalledTimes(1);
  });

  it('passes a fleet-content sentinel (FLT is a list buffer, no form)', async () => {
    const { container, clicks } = buildContainer('af-overlay af-success');
    buildShipBlock(container, 'AVI-063I6', clicks);
    // Device finding 2026-08-14: the navigator's form default times out on
    // FLT. The sentinel must match the fleet header, not a FormComponent.
    const header = container.querySelector('header') as HTMLElement;
    header.className = 'Fleet__fleetHeader___qHugg0k';

    await runShipUnload('AVI-063I6');

    const sentinel = vi.mocked(openMobileBuffer).mock.calls[0][1] as () => HTMLElement | null;
    expect(sentinel()).toBe(header);
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

// ---------------------------------------------------------------------------
// Refuel: drives the transfer wizard inside the source store's INV buffer.
// Fixture mirrors the device-captured modal (2026-08-14): selection modal
// (Material + Target DropDownBoxes, Continue) then MobileMaterialTransferModal
// (number input pre-filled by APEX, "transfer selected amount"). The commit is
// silent — success is the modal closing + the tank's WS volume delta, which
// the fixture simulates in the commit handler.
// ---------------------------------------------------------------------------

const SF_MATERIAL = {
  ticker: 'SF',
  name: 'stlFuel',
  category: 'fuels',
  weight: 0.06,
  volume: 0.06,
};

function fuelItem(ticker: string, amount: number): PrunApi.StoreItem {
  return {
    id: `item-${ticker}-${amount}`,
    type: 'INVENTORY',
    quantity: {
      material: { ticker, name: ticker, id: ticker, category: 'c', weight: 0.06, volume: 0.06 },
      amount,
      weight: amount * 0.06,
      volume: amount * 0.06,
    },
    weight: amount * 0.06,
    volume: amount * 0.06,
  } as unknown as PrunApi.StoreItem;
}

function seedRefuelWorld() {
  const address = createAddress({ planetName: 'Montem' });
  const ship = createTestShip({ id: 'ship-r1', address });
  const site = createTestSite({ siteId: 'site-r1', address });
  const tank = createTestStorage({
    id: ship.idStlFuelStore,
    addressableId: ship.id,
    type: 'STL_FUEL_STORE',
    volumeLoad: 78.72,
    volumeCapacity: 90, // deficit 188 units of 0.06
    items: [fuelItem('SF', 1312)],
  });
  const source = createTestStorage({
    id: 'store-src',
    addressableId: site.siteId,
    type: 'STORE',
    items: [fuelItem('SF', 20000)],
  });
  useShipsStore.getState().setAll([ship]);
  useSitesStore.getState().setAll([site]);
  useStorageStore.getState().setAll([tank, source]);
  useMaterialsStore.getState().setAll([SF_MATERIAL]);
  return { ship, tank, source };
}

function buildDropDownBox(labels: string[], values?: unknown[]): HTMLElement {
  const box = document.createElement('div');
  box.className = 'DropDownBox__container___h';
  const toggle = document.createElement('div');
  toggle.className = 'DropDownBox__toggle___h';
  box.appendChild(toggle);
  const ul = document.createElement('ul');
  labels.forEach((label, i) => {
    const li = document.createElement('li');
    const name = document.createElement('div');
    name.className = 'DropDownBox__itemName___h';
    name.textContent = label;
    li.appendChild(name);
    if (values) {
      (li as unknown as Record<string, unknown>)['__reactFiber$t'] = {
        memoizedProps: { className: 'x' },
        return: { memoizedProps: { values: { toJS: () => values } }, return: null },
      };
    }
    void i;
    ul.appendChild(li);
  });
  box.appendChild(ul);
  return box;
}

/** The INV buffer + full wizard fixture. Commit removes the modals and bumps
 *  the tank store's volumeLoad (the simulated WS delta). */
function buildRefuelBuffer(opts: {
  tankStoreId: string;
  targetValues: unknown[];
  commitDelta?: boolean;
  amountRecorder?: { value?: string };
}): { container: HTMLElement } {
  const container = document.createElement('div');
  container.id = 'container';
  document.body.appendChild(container);

  const start = document.createElement('button');
  start.textContent = 'Start transfer';
  container.appendChild(start);

  const modal = document.createElement('div');
  modal.className = 'MobileTransferStoreAndItemSelectionModal___h';
  modal.appendChild(buildDropDownBox(['--', 'STL Fuel', 'Flux']));
  modal.appendChild(
    buildDropDownBox(['--', 'Ship  STL fuel store', 'Ship  cargo hold'], opts.targetValues)
  );
  const cont = document.createElement('button');
  cont.textContent = 'Continue';
  cont.className = 'apex-btn';
  modal.appendChild(cont);
  const dismiss = document.createElement('button');
  dismiss.className = 'Modal__btnDismiss___h';
  dismiss.textContent = '× Dismiss';
  dismiss.addEventListener('click', () => modal.remove());
  modal.appendChild(dismiss);
  container.appendChild(modal);

  const amount = document.createElement('div');
  amount.className = 'MobileMaterialTransferModal___h';
  const inputWrap = document.createElement('div');
  inputWrap.className = 'MobileMaterialTransferModal__numberInput___h';
  const input = document.createElement('input');
  input.type = 'number';
  input.value = '188';
  inputWrap.appendChild(input);
  amount.appendChild(inputWrap);
  const commit = document.createElement('button');
  commit.textContent = 'transfer selected amount';
  commit.className = 'apex-btn';
  commit.addEventListener('click', () => {
    if (opts.amountRecorder) opts.amountRecorder.value = input.value;
    modal.remove();
    amount.remove();
    if (opts.commitDelta !== false) {
      const tank = useStorageStore.getState().getById(opts.tankStoreId);
      if (tank) {
        useStorageStore.getState().setAll([
          ...useStorageStore.getState().getAll().filter((s) => s.id !== tank.id),
          { ...tank, volumeLoad: tank.volumeCapacity },
        ]);
      }
    }
  });
  amount.appendChild(commit);
  container.appendChild(amount);
  return { container };
}

describe('runShipRefuel', () => {
  it('drives the wizard by GUID and commits the planned amount', async () => {
    const { ship, tank } = seedRefuelWorld();
    const amountRecorder: { value?: string } = {};
    buildRefuelBuffer({
      tankStoreId: tank.id,
      targetValues: [null, tank.id, 'other-guid'],
      amountRecorder,
    });

    const result = await runShipRefuel(ship.id, 'stl');

    expect(openMobileBuffer).toHaveBeenCalledWith('INV store-src', expect.any(Function));
    expect(amountRecorder.value).toBe('188');
    expect(result).toEqual({ ok: true });
    expect(closeMobileBuffer).toHaveBeenCalledTimes(1);
  });

  it("refuses when the tank's GUID is not in the target list (never guesses)", async () => {
    const { ship, tank } = seedRefuelWorld();
    buildRefuelBuffer({
      tankStoreId: tank.id,
      targetValues: [null, 'someone-elses-tank'],
    });

    const result = await runShipRefuel(ship.id, 'stl');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/could not be identified/);
    // The wizard was dismissed (its × removes the modal) and the buffer restored.
    expect(document.querySelector('[class*="MobileTransferStoreAndItemSelectionModal"]')).toBeNull();
    expect(closeMobileBuffer).toHaveBeenCalledTimes(1);
  });

  it('reports an unconfirmed transfer when no store delta arrives', async () => {
    const { ship, tank } = seedRefuelWorld();
    buildRefuelBuffer({
      tankStoreId: tank.id,
      targetValues: [null, tank.id],
      commitDelta: false,
    });

    const result = await runShipRefuel(ship.id, 'stl');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/not confirmed/);
  }, 20000);

  it('maps plan failures to user-readable errors without opening a buffer', async () => {
    const { ship, tank, source } = seedRefuelWorld();
    useStorageStore.getState().setAll([{ ...tank, volumeLoad: tank.volumeCapacity }, source]);

    const result = await runShipRefuel(ship.id, 'stl');

    expect(result).toEqual({ ok: false, error: 'Tank is already full' });
    expect(openMobileBuffer).not.toHaveBeenCalled();
  });
});
