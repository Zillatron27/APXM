import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { DetailSheet } from '../DetailSheet';
import { useGameState } from '../../../stores/gameState';

vi.mock('../../production', () => ({ ProductionView: () => null }));
vi.mock('../../burn', () => ({ BurnDetailView: () => null, RepairDetailView: () => null }));
vi.mock('../../fleet', () => ({ ShipDetailView: () => null }));
vi.mock('../../contracts', () => ({
  ContractDetailView: () => null,
  ContractTerminateButton: () => null,
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.useFakeTimers();
  useGameState.getState().setDetailView(null);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
  useGameState.getState().setDetailView(null);
});

function pressBackdropClose() {
  const backdrop = container.querySelector<HTMLButtonElement>('button[aria-label="Close"]');
  act(() => backdrop!.click());
}

describe('DetailSheet', () => {
  it('a detail opened right after closing stays open', () => {
    act(() => {
      root.render(<DetailSheet />);
      useGameState.getState().setDetailView({ type: 'burn', siteId: 's1', siteName: 'Alpha' });
    });
    pressBackdropClose();

    act(() => {
      vi.advanceTimersByTime(100);
      useGameState.getState().setDetailView({ type: 'repair', siteId: 's2', siteName: 'Beta' });
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(useGameState.getState().detailView).toMatchObject({ type: 'repair', siteId: 's2' });
  });

  it('closing still clears the detail after the transition', () => {
    act(() => {
      root.render(<DetailSheet />);
      useGameState.getState().setDetailView({ type: 'burn', siteId: 's1', siteName: 'Alpha' });
    });
    pressBackdropClose();
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(useGameState.getState().detailView).toBeNull();
  });
});
