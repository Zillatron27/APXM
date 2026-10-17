import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useRepairStatus } from '../useRepairStatus';
import { useSitesStore } from '../../../stores/entities/sites';
import {
  createTestSite,
  createPlatform,
  createDateTime,
} from '../../../__tests__/fixtures/factories';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const DAY_MS = 86_400_000;

let container: HTMLDivElement;
let root: Root;

function AgeProbe() {
  const [status] = useRepairStatus();
  return <span>{status.oldestBuildingAgeDays?.toFixed(2)}</span>;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-10T00:00:00Z'));
  useSitesStore.getState().clear();
  const siteId = 'site-1';
  useSitesStore.getState().setAll([
    createTestSite({
      siteId,
      platforms: [createPlatform({ siteId, creationTime: createDateTime(Date.now()) })],
    }),
  ]);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe('useRepairStatus', () => {
  it('repair age keeps growing as time passes without any store update', async () => {
    await act(async () => {
      root.render(<AgeProbe />);
    });
    expect(container.textContent).toBe('0.00');

    await act(async () => {
      vi.advanceTimersByTime(DAY_MS);
    });
    expect(container.textContent).toBe('1.00');
  });
});
