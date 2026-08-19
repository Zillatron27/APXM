import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { SendShipView, usageChipLabels } from '../SendShipView';
import { useShipsStore, useSitesStore } from '../../../stores/entities';
import { createTestShip, createTestSite, createAddress } from '../../../__tests__/fixtures/factories';
import type { SfcSnapshot } from '../../../lib/act/sfc-driver';

const closeSpy = vi.fn(async () => {});
let snapshot: SfcSnapshot;

vi.mock('../../../lib/act/sfc-driver', () => ({
  openSendSession: vi.fn(async () => ({
    ok: true,
    session: {
      setDestination: vi.fn(async () => ({ ok: true })),
      readSnapshot: () => snapshot,
      commitStart: vi.fn(async () => ({ ok: true })),
      close: closeSpy,
    },
  })),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

function baseSnapshot(overrides: Partial<SfcSnapshot> = {}): SfcSnapshot {
  return {
    status: 'valid',
    totals: {
      index: '',
      type: '',
      destination: 'Benten Station',
      duration: '1 day 2h',
      distance: '656m km',
      damage: '0.198%',
      fees: '12,000 AIC',
      consumption: '165 units',
    },
    segments: [],
    reactor: { valuePct: 53, posFrac: 0.53, minPct: 1, maxPct: 100 },
    fuel: { valuePct: 5, posFrac: 0.04, minPct: 1, maxPct: 100 },
    routePref: 'LEAST_JUMPS',
    surfaceLanding: true,
    useGateways: true,
    unloadOnArrival: false,
    startEnabled: true,
    ...overrides,
  };
}

beforeEach(() => {
  useShipsStore.getState().clear();
  useSitesStore.getState().clear();
  closeSpy.mockClear();
  snapshot = baseSnapshot();
  const ship = createTestShip({ id: 'ship-1', address: createAddress({ planetName: 'Zebra' }) });
  useShipsStore.getState().setAll([ship]);
  useSitesStore.getState().setAll([createTestSite({ address: createAddress({ planetName: 'Montem' }) })]);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

async function render(onClose = () => {}) {
  await act(async () => {
    root.render(<SendShipView shipId="ship-1" registration="AVI-063I6" onClose={onClose} />);
  });
}

async function pickFirstDestination() {
  const btn = Array.from(container.querySelectorAll('button')).find((b) =>
    /Montem/.test(b.textContent ?? '')
  );
  await act(async () => {
    btn!.click();
  });
}

describe('SendShipView', () => {
  it('lists own destinations (bases then stations)', async () => {
    await render();
    const html = container.innerHTML;
    expect(html).toContain('Montem');
    expect(html).toContain('Benten Station (Benten)');
  });

  it('picking a destination opens the session and shows the route with SEND enabled', async () => {
    await render();
    await pickFirstDestination();
    const html = container.innerHTML;
    expect(html).toContain('1 day 2h');
    expect(html).toContain('12,000 AIC');
    const send = Array.from(container.querySelectorAll('button')).find((b) =>
      /send ship/i.test(b.textContent ?? '')
    );
    expect(send?.disabled).toBe(false);
  });

  it('disables SEND and shows APEX status text when the route is not valid', async () => {
    snapshot = baseSnapshot({ status: 'insufficient fuel', startEnabled: false });
    await render();
    await pickFirstDestination();
    const send = Array.from(container.querySelectorAll('button')).find((b) =>
      /send ship/i.test(b.textContent ?? '')
    );
    expect(send?.disabled).toBe(true);
    expect(container.innerHTML).toContain('insufficient fuel');
  });

  it('cancel closes the session (the disarm rule)', async () => {
    await render();
    await pickFirstDestination();
    const cancel = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Cancel'
    );
    await act(async () => {
      cancel!.click();
    });
    expect(closeSpy).toHaveBeenCalled();
  });

  it('unmount closes the session (armed buffer never outlives the view)', async () => {
    await render();
    await pickFirstDestination();
    act(() => root.unmount());
    expect(closeSpy).toHaveBeenCalled();
    root = createRoot(container); // for afterEach symmetry
  });
});

describe('usageChipLabels', () => {
  it('labels chips with the actual percent each position resolves to', () => {
    // A Sprinter-style band: 5–100%.
    expect(usageChipLabels(5, 100)).toEqual(['5%', '29%', '53%', '76%', '100%']);
  });

  it('falls back to one decimal when whole percents collide on a narrow band', () => {
    // Picard's reactor: 97.5–100% — whole percents would repeat.
    expect(usageChipLabels(97.5, 100)).toEqual(['97.5%', '98.1%', '98.8%', '99.4%', '100%']);
  });
});
