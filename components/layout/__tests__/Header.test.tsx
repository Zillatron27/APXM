import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Header, formatUnreadBadge } from '../Header';
import { useAlertsStore } from '../../../stores/entities';
import { useUserStore } from '../../../stores/user';
import { useGameState } from '../../../stores/gameState';
import { createTestAlert } from '../../../__tests__/fixtures/factories';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

function bell(): HTMLButtonElement {
  const el = container.querySelector('button[aria-label*="otifications"]');
  expect(el).not.toBeNull();
  return el as HTMLButtonElement;
}

beforeEach(() => {
  useAlertsStore.getState().clear();
  useUserStore.getState().clear();
  useGameState.setState({ alertsViewOpen: false });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(<Header />));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('formatUnreadBadge', () => {
  it('shows the count up to 9 and 9+ beyond', () => {
    expect(formatUnreadBadge(1)).toBe('1');
    expect(formatUnreadBadge(9)).toBe('9');
    expect(formatUnreadBadge(10)).toBe('9+');
  });
});

describe('Header bell', () => {
  it('has no badge with nothing unread', () => {
    expect(bell().textContent).toBe('');
  });

  it('badges the own-context unread count only', () => {
    useUserStore.getState().setUser([
      { id: 'company-1', type: 'COMPANY' },
      { id: 'corp-1', type: 'CORPORATION' },
    ]);
    act(() => {
      useAlertsStore.getState().setAll([
        createTestAlert({ id: 'own-1', contextId: 'company-1', read: false }),
        createTestAlert({ id: 'own-2', contextId: 'company-1', read: false }),
        createTestAlert({ id: 'corp', contextId: 'corp-1', read: false }),
        createTestAlert({ id: 'read', contextId: 'company-1', read: true }),
      ]);
    });
    expect(bell().textContent).toBe('2');
  });

  it('toggles the Notifications view', () => {
    act(() => bell().click());
    expect(useGameState.getState().alertsViewOpen).toBe(true);
    expect(bell().getAttribute('aria-pressed')).toBe('true');
    act(() => bell().click());
    expect(useGameState.getState().alertsViewOpen).toBe(false);
  });
});
