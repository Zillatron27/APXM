import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useAlertCounts } from '../useAlertCounts';
import { useAlertsStore } from '../../stores/entities';
import { useUserStore } from '../../stores/user';
import { createTestAlert } from '../../__tests__/fixtures/factories';

// Client-rendered (createRoot + act), same reason as AlertsPanel.test.tsx:
// zustand v4's getServerState pins renderToString to creation-time state.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let latest: { ownUnread: number; otherUnread: number } | undefined;

function Probe() {
  latest = useAlertCounts();
  return null;
}

function render(): void {
  act(() => {
    root.render(<Probe />);
  });
}

beforeEach(() => {
  useAlertsStore.getState().clear();
  useUserStore.getState().clear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  latest = undefined;
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('useAlertCounts', () => {
  it('reflects the alerts store contents', () => {
    useAlertsStore.getState().setAll([
      createTestAlert({ id: 'a1', read: false }),
      createTestAlert({ id: 'a2', read: true }),
    ]);
    render();

    expect(latest).toEqual({ ownUnread: 1, otherUnread: 0 });
  });

  it('updates counts when USER_DATA lands after alerts', () => {
    useAlertsStore.getState().setAll([
      createTestAlert({ id: 'own', contextId: 'company-1', read: false }),
      createTestAlert({ id: 'corp', contextId: 'corp-1', read: false }),
    ]);
    render();

    // Before USER_DATA: degraded mode, both counted as own.
    expect(latest).toEqual({ ownUnread: 2, otherUnread: 0 });

    act(() => {
      useUserStore.getState().setUser([
        { id: 'company-1', type: 'COMPANY' },
        { id: 'corp-1', type: 'CORPORATION' },
      ]);
    });
    render();

    expect(latest).toEqual({ ownUnread: 1, otherUnread: 1 });
  });
});
