import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { SiteBurnCard } from '../SiteBurnCard';
import type { SiteBurnSummary, BurnRate } from '../../../core/burn';

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
