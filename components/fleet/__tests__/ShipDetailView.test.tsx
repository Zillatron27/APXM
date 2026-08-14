import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ShipDetailView } from '../ShipDetailView';
import {
  useShipsStore,
  useFlightsStore,
  useStorageStore,
  useSitesStore,
} from '../../../stores/entities';
import { useMaterialsStore } from '../../../stores/reference';
import {
  createTestShip,
  createTestFlight,
  createTestStorage,
  createTestSite,
  createAddress,
} from '../../../__tests__/fixtures/factories';
import type { PrunApi } from '../../../types/prun-api';

// The action runs drive the real APEX DOM — stub them; this suite only covers
// the buttons' client-side gating (UX; the act-time checks are the real gate,
// covered in lib/__tests__/ship-actions.test.ts).
vi.mock('../../../lib/ship-actions', () => ({
  runShipUnload: vi.fn(async () => ({ ok: true })),
  runShipRefuel: vi.fn(async () => ({ ok: true })),
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
  useSitesStore.getState().clear();
  useMaterialsStore.getState().clear();
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

  it('disables unload when the hold is empty and says why', () => {
    const id = seedShip({ cargoLoad: 0 });
    const html = renderSheet(id);
    expect(unloadButton()?.disabled).toBe(true);
    expect(html).toContain('Hold is empty');
  });

  it('disables unload while the ship is in transit and says why', () => {
    const id = seedShip({ cargoLoad: 120, inTransit: true });
    const html = renderSheet(id);
    expect(unloadButton()?.disabled).toBe(true);
    expect(html).toContain('In transit');
  });
});

function fuelItem(ticker: string, amount: number): PrunApi.StoreItem {
  return {
    id: `item-${ticker}`,
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

function refuelButton(ticker: string): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll('button')).find((b) =>
    new RegExp(`refuel\\s+${ticker}`, 'i').test(b.textContent ?? '')
  );
}

/** Ship docked at a base with SF stock; FTL side left dry. */
function seedRefuelableShip(opts: { tankFull?: boolean } = {}): string {
  const address = createAddress({ planetName: 'Montem' });
  const ship = createTestShip({ id: 'ship-2', registration: 'AVI-063I6', address, flightId: null });
  const site = createTestSite({ siteId: 'site-1', address });
  useShipsStore.getState().setAll([ship]);
  useSitesStore.getState().setAll([site]);
  useMaterialsStore
    .getState()
    .setAll([
      { ticker: 'SF', name: 'stlFuel', category: 'fuels', weight: 0.06, volume: 0.06 },
      { ticker: 'FF', name: 'ftlFuel', category: 'fuels', weight: 0.05, volume: 0.05 },
    ]);
  useStorageStore.getState().setAll([
    createTestStorage({ id: ship.idShipStore, addressableId: ship.id, weightLoad: 0, volumeLoad: 0 }),
    createTestStorage({
      id: ship.idStlFuelStore,
      addressableId: ship.id,
      type: 'STL_FUEL_STORE',
      volumeLoad: opts.tankFull ? 90 : 78.72,
      volumeCapacity: 90,
      items: [],
    }),
    createTestStorage({
      id: ship.idFtlFuelStore,
      addressableId: ship.id,
      type: 'FTL_FUEL_STORE',
      volumeLoad: 10,
      volumeCapacity: 20,
      items: [],
    }),
    createTestStorage({
      id: 'store-base',
      addressableId: site.siteId,
      type: 'STORE',
      items: [fuelItem('SF', 20000)],
    }),
  ]);
  return ship.id;
}

describe('ShipDetailView refuel gating', () => {
  it('enables Refuel SF with the plan preview when fuel is available locally', () => {
    const id = seedRefuelableShip();
    const html = renderSheet(id);
    expect(refuelButton('SF')?.disabled).toBe(false);
    expect(html).toContain('188');
    expect(html).toContain('base storage');
  });

  it('disables Refuel FF and says why when no FF is at the location', () => {
    const id = seedRefuelableShip();
    const html = renderSheet(id);
    expect(refuelButton('FF')?.disabled).toBe(true);
    expect(html).toContain('None at this location');
  });

  it('disables Refuel SF with a tank-full reason', () => {
    const id = seedRefuelableShip({ tankFull: true });
    const html = renderSheet(id);
    expect(refuelButton('SF')?.disabled).toBe(true);
    expect(html).toContain('Tank is full');
  });
});
