import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ShipDetailView } from '../ShipDetailView';
import { useShipsStore, useFlightsStore, useStorageStore } from '../../../stores/entities';
import {
  createTestShip,
  createTestFlight,
  createTestStorage,
} from '../../../__tests__/fixtures/factories';

// The unload run drives the real APEX DOM — stub it; this suite only covers
// the button's client-side gating (UX; the act-time disabled check is the
// real gate, covered in lib/__tests__/ship-actions.test.ts).
vi.mock('../../../lib/ship-actions', () => ({
  runShipUnload: vi.fn(async () => ({ ok: true })),
}));

// Client-rendered (createRoot + act), NOT renderToString: zustand v4 pins
// server renders to the store's creation-time state via getServerState.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

function renderSheet(shipId: string): string {
  act(() => {
    root.render(<ShipDetailView shipId={shipId} />);
  });
  return container.innerHTML;
}

function unloadButton(): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll('button')).find((b) =>
    /unload/i.test(b.textContent ?? '')
  );
}

beforeEach(() => {
  useShipsStore.getState().clear();
  useFlightsStore.getState().clear();
  useStorageStore.getState().clear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function seedShip(opts: { cargoLoad: number; inTransit?: boolean }): string {
  const ship = createTestShip({ id: 'ship-1', registration: 'AVI-063I6', flightId: null });
  useShipsStore.getState().setAll([ship]);
  useStorageStore.getState().setAll([
    createTestStorage({
      id: ship.idShipStore,
      addressableId: ship.id,
      weightLoad: opts.cargoLoad,
      volumeLoad: opts.cargoLoad,
    }),
  ]);
  if (opts.inTransit) {
    useFlightsStore
      .getState()
      .setAll([createTestFlight({ shipId: ship.id, arrival: { timestamp: Date.now() + 3600000 } })]);
  }
  return ship.id;
}

describe('ShipDetailView unload gating', () => {
  it('enables unload for a stationary ship with cargo', () => {
    const id = seedShip({ cargoLoad: 120 });
    renderSheet(id);
    expect(unloadButton()?.disabled).toBe(false);
  });

  it('disables unload when the hold is empty', () => {
    const id = seedShip({ cargoLoad: 0 });
    renderSheet(id);
    expect(unloadButton()?.disabled).toBe(true);
  });

  it('disables unload while the ship is in transit', () => {
    const id = seedShip({ cargoLoad: 120, inTransit: true });
    renderSheet(id);
    expect(unloadButton()?.disabled).toBe(true);
  });
});
