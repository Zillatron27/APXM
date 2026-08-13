import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { AlertsPanel } from '../AlertsPanel';
import { useAlertsStore } from '../../../stores/entities';
import { createTestAlert } from '../../../__tests__/fixtures/factories';

// Unread-only panel: the login snapshot carries the full NOTS history, so an
// unfiltered panel opens on several screens of already-read noise. Read
// alerts belong to APEX's NOTS buffer.
//
// Client-rendered (createRoot + act), NOT renderToString: zustand v4 pins
// server renders to the store's creation-time state via getServerState, so
// SSR output never reflects test mutations of a store.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

function renderPanel(): string {
  act(() => {
    root.render(<AlertsPanel />);
  });
  return container.innerHTML;
}

beforeEach(() => {
  useAlertsStore.getState().clear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('AlertsPanel (unread only)', () => {
  it('shows unread alerts and hides read ones', () => {
    useAlertsStore.getState().setAll([
      createTestAlert({ id: 'a-unread', type: 'PRODUCTION_ORDER_FINISHED', read: false }),
      createTestAlert({ id: 'a-read', type: 'SHIP_FLIGHT_ENDED', read: true }),
    ]);
    useAlertsStore.getState().setFetched('websocket');

    const html = renderPanel();
    expect(html).toContain('1 unread');
    // The read alert's category must not render (SHIP alerts are the only
    // fleet-category row in this fixture set).
    expect(html).toContain('production');
    expect(html).not.toContain('fleet');
  });

  it('reads "No unread notifications" when everything is read', () => {
    useAlertsStore.getState().setAll([createTestAlert({ id: 'a-read', read: true })]);
    useAlertsStore.getState().setFetched('websocket');

    const html = renderPanel();
    expect(html).toContain('0 unread');
    expect(html).toContain('No unread notifications');
  });

  it('caps rows at 50 and counts only unread in the overflow line', () => {
    const alerts = Array.from({ length: 55 }, (_, i) =>
      createTestAlert({ id: `a-${i}`, read: false })
    ).concat(Array.from({ length: 20 }, (_, i) => createTestAlert({ id: `r-${i}`, read: true })));
    useAlertsStore.getState().setAll(alerts);
    useAlertsStore.getState().setFetched('websocket');

    const html = renderPanel();
    expect(html).toContain('55 unread');
    // 55 unread − 50 shown = 5; the 20 read alerts must not inflate this.
    expect(html).toContain('+5 more unread');
  });
});
