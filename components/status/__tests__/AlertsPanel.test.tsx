import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { AlertsPanel } from '../AlertsPanel';
import { useAlertsStore } from '../../../stores/entities';
import { useUserStore } from '../../../stores/user';
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
  useUserStore.getState().clear();
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
    // The read alert's label must not render (SHIP_FLIGHT_ENDED is the only
    // ARRIVAL row in this fixture set).
    expect(html).toContain('PRODUCED');
    expect(html).not.toContain('ARRIVAL');
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

  it('appends the corp count when other-context unread alerts exist', () => {
    useUserStore.getState().setUser([
      { id: 'company-1', type: 'COMPANY' },
      { id: 'corp-1', type: 'CORPORATION' },
    ]);
    useAlertsStore.getState().setAll([
      createTestAlert({ id: 'own', contextId: 'company-1', read: false }),
      createTestAlert({ id: 'corp', contextId: 'corp-1', read: false }),
    ]);
    useAlertsStore.getState().setFetched('websocket');

    const html = renderPanel();
    expect(html).toContain('1 unread · 1 corp');
  });

  it('omits the corp suffix when there is no other-context unread', () => {
    useUserStore.getState().setUser([{ id: 'company-1', type: 'COMPANY' }]);
    useAlertsStore.getState().setAll([
      createTestAlert({ id: 'own', contextId: 'company-1', read: false }),
    ]);
    useAlertsStore.getState().setFetched('websocket');

    const html = renderPanel();
    expect(html).toContain('1 unread');
    expect(html).not.toContain('corp');
  });

  describe('MARK ALL READ', () => {
    function findMarkAllButton(): HTMLButtonElement {
      const button = Array.from(container.querySelectorAll('button')).find(
        (el) => el.textContent === 'MARK ALL READ'
      );
      expect(button).not.toBeUndefined();
      return button as HTMLButtonElement;
    }

    it('is disabled when there are no own unread alerts', () => {
      useAlertsStore.getState().setAll([createTestAlert({ id: 'a-read', read: true })]);
      useAlertsStore.getState().setFetched('websocket');

      renderPanel();

      expect(findMarkAllButton().disabled).toBe(true);
    });

    it('is enabled when there are own unread alerts', () => {
      useAlertsStore.getState().setAll([
        createTestAlert({ id: 'a-unread', read: false }),
      ]);
      useAlertsStore.getState().setFetched('websocket');

      renderPanel();

      expect(findMarkAllButton().disabled).toBe(false);
    });
  });
});
