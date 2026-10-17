import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { FleetMiniList } from '../FleetMiniList';
import { useShipsStore } from '../../../stores/entities/ships';
import { useFlightsStore } from '../../../stores/entities/flights';
import { createTestShip, createTestFlight } from '../../../__tests__/fixtures/factories';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  useShipsStore.getState().clear();
  useFlightsStore.getState().clear();
  useShipsStore.getState().setAll([createTestShip({ id: 'ship-1', name: 'Hauler' })]);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('FleetMiniList', () => {
  it('shows a ship as in transit when only the flights store changes', async () => {
    await act(async () => {
      root.render(<FleetMiniList />);
    });
    expect(container.textContent).toContain('Stationary');

    await act(async () => {
      useFlightsStore.getState().setAll([createTestFlight({ shipId: 'ship-1' })]);
    });
    expect(container.textContent).toContain('In transit');
    expect(container.textContent).not.toContain('Stationary');
  });
});
