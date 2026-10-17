import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { AttentionPanel } from '../AttentionPanel';
import { useShipsStore } from '../../../stores/entities/ships';
import { useFlightsStore } from '../../../stores/entities/flights';
import { createTestShip, createTestFlight } from '../../../__tests__/fixtures/factories';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

function transitCount(): string | undefined {
  const tile = Array.from(container.querySelectorAll('button')).find((b) =>
    /IN TRANSIT/.test(b.textContent ?? '')
  );
  return tile?.querySelector('span')?.textContent ?? undefined;
}

beforeEach(() => {
  useShipsStore.getState().clear();
  useFlightsStore.getState().clear();
  useShipsStore.getState().setAll([createTestShip({ id: 'ship-1' })]);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('AttentionPanel', () => {
  it('IN TRANSIT count follows flight changes when ships are untouched', async () => {
    await act(async () => {
      root.render(<AttentionPanel />);
    });
    expect(transitCount()).toBe('0');

    await act(async () => {
      useFlightsStore.getState().setAll([createTestFlight({ shipId: 'ship-1' })]);
    });
    expect(transitCount()).toBe('1');
  });
});
