import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { AlertRow } from '../AlertRow';
import { useGameState } from '../../../stores/gameState';
import { useShipsStore } from '../../../stores/entities/ships';
import { createTestAlert, createTestShip } from '../../../__tests__/fixtures/factories';

vi.mock('../../../lib/alert-actions', () => ({
  markAlertRead: vi.fn(async () => ({ ok: true })),
}));
import { markAlertRead } from '../../../lib/alert-actions';

// Client-rendered (createRoot + act), not renderToString: the component
// reads zustand stores and renders a real click handler — see the note in
// AlertsPanel.test.tsx for why SSR output can't be trusted here.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  useShipsStore.getState().clear();
  useGameState.getState().setDetailView(null);
  vi.mocked(markAlertRead).mockClear();
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
    // Tap-through button + the READ button.
    expect(buttons.length).toBe(2);
    expect(buttons[0].textContent).toContain('SHIP ›');

    act(() => {
      buttons[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(useGameState.getState().detailView).toEqual({
      type: 'ship',
      shipId: ship.id,
      shipName: 'Wanderer',
    });
  });

  it('renders a plain row with no target keycap for an unresolvable alert, but still has a READ button', () => {
    const alert = createTestAlert({ type: 'COMEX_TRADE', data: [] });

    act(() => {
      root.render(<AlertRow alert={alert} />);
    });

    // No tap-through button, but the READ button is always present.
    expect(container.querySelectorAll('button').length).toBe(1);
    expect(container.innerHTML).not.toContain('›');
    expect(useGameState.getState().detailView).toBeNull();
  });

  it('has a READ button with an accessible label, and calls markAlertRead with the alert id', () => {
    const alert = createTestAlert({ type: 'COMEX_TRADE', data: [] });

    act(() => {
      root.render(<AlertRow alert={alert} />);
    });

    const readButton = container.querySelector('button[aria-label^="Mark read:"]');
    expect(readButton).not.toBeNull();

    act(() => {
      readButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(markAlertRead).toHaveBeenCalledWith(alert.id);
  });

  it('still shows a READ button for a resolvable alert (tap-through row)', () => {
    const ship = createTestShip({ name: 'Wanderer' });
    useShipsStore.getState().setOne(ship);
    const alert = createTestAlert({
      type: 'SHIP_FLIGHT_ENDED',
      data: [{ key: 'shipId', value: ship.id }],
    });

    act(() => {
      root.render(<AlertRow alert={alert} />);
    });

    expect(container.querySelector('button[aria-label^="Mark read:"]')).not.toBeNull();
  });
});
