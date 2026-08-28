import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { AlertRow } from '../AlertRow';
import { useGameState } from '../../../stores/gameState';
import { useShipsStore } from '../../../stores/entities/ships';
import { createTestAlert, createTestShip } from '../../../__tests__/fixtures/factories';

// Client-rendered (createRoot + act), not renderToString: the component
// reads zustand stores and renders a real click handler — see the note in
// AlertsPanel.test.tsx for why SSR output can't be trusted here.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  useShipsStore.getState().clear();
  useGameState.getState().setDetailView(null);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('AlertRow', () => {
  it('renders a button with a target keycap for a resolvable alert and opens the detail sheet on tap', () => {
    const ship = createTestShip({ name: 'Wanderer' });
    useShipsStore.getState().setOne(ship);
    const alert = createTestAlert({
      type: 'SHIP_FLIGHT_ENDED',
      data: [{ key: 'shipId', value: ship.id }],
    });

    act(() => {
      root.render(<AlertRow alert={alert} />);
    });

    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBe(1);
    expect(buttons[0].textContent).toContain('SHIP ›');
    // Resolved name replaces the registration in the row text.
    expect(buttons[0].textContent).toContain('Wanderer arrived');

    act(() => {
      buttons[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(useGameState.getState().detailView).toEqual({
      type: 'ship',
      shipId: ship.id,
      shipName: 'Wanderer',
    });
  });

});
