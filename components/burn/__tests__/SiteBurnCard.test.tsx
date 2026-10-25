import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { renderToString } from 'react-dom/server';
import { createRoot, type Root } from 'react-dom/client';
import { SiteBurnCard } from '../SiteBurnCard';
import type { SiteBurnSummary, BurnRate } from '../../../core/burn';
import { useGameState } from '../../../stores/gameState';
import { useRefreshState } from '../../../stores/refreshState';
import { isActionInFlight, releaseActionLock } from '../../../lib/act/action-lock';

// #75 regression: the base card formatted mostUrgent.daysRemaining with an
// unguarded `${days}d`, so a site whose burns are all net-positive rendered
// the literal string "Infinityd" on its BURN tile.

function burnRate(overrides: Partial<BurnRate>): BurnRate {
  return {
    materialTicker: 'RAT',
    dailyAmount: 0,
    type: 'workforce',
    productionInput: 0,
    productionOutput: 0,
    workforceConsumption: 0,
    inventoryAmount: 100,
    inboundAmount: 0,
    daysRemaining: Infinity,
    need: 0,
    urgency: 'ok',
    ...overrides,
  };
}

function summaryWith(mostUrgent: BurnRate | null): SiteBurnSummary {
  return {
    siteId: 'site-1',
    siteName: 'Montem Base',
    burns: mostUrgent ? [mostUrgent] : [],
    mostUrgent,
    hasInboundShips: false,
    lastCalculated: 1_700_000_000_000,
  };
}

describe('SiteBurnCard burn tile (#75)', () => {
  it('renders ∞, not "Infinityd", when the most urgent burn has infinite days remaining', () => {
    const html = renderToString(
      <SiteBurnCard
        summary={summaryWith(burnRate({ daysRemaining: Infinity }))}
        repairAgeDays={null}
        prodStatus={null}
      />
    );
    expect(html).not.toContain('Infinity');
    expect(html).toContain('∞');
  });

  it('still renders floored finite days with the d suffix', () => {
    const html = renderToString(
      <SiteBurnCard
        summary={summaryWith(burnRate({ daysRemaining: 4.6, urgency: 'warning' }))}
        repairAgeDays={12}
        prodStatus={null}
      />
    );
    expect(html).toContain('4d');
    expect(html).toContain('12d');
  });
});

// Client-rendered (createRoot + act): the disabled state comes from a store
// change, which renderToString can't see (see AlertsPanel.test.tsx).
describe('SiteBurnCard refresh button while an action is running (#1)', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    releaseActionLock();
    useRefreshState.setState({ mode: 'manual', siteStatus: new Map() });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    useGameState.getState().setActionInFlight(false);
  });

  function refreshButton(): HTMLElement {
    const el = container.querySelector<HTMLElement>('[aria-label="Refresh Montem Base"]');
    if (!el) throw new Error('refresh button not rendered');
    return el;
  }

  it('is disabled and ignores taps while actionInFlight is set', () => {
    act(() => {
      root.render(
        <SiteBurnCard summary={summaryWith(null)} repairAgeDays={null} prodStatus={null} />
      );
    });
    expect(refreshButton().getAttribute('aria-disabled')).toBe('false');

    act(() => useGameState.getState().setActionInFlight(true));
    expect(refreshButton().getAttribute('aria-disabled')).toBe('true');

    act(() => {
      refreshButton().dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    // A refresh that started would have taken the lock synchronously.
    expect(isActionInFlight()).toBe(false);
  });
});
