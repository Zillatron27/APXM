import { useMemo, useState } from 'react';
import { Panel } from '../shared';
import { useBalancesStore } from '../../stores/entities/balances';
import { useCompanyStore } from '../../stores/company';
import { primaryCurrencyFor, sortBalances } from '../../lib/currency';

function formatAmount(amount: number): string {
  return Math.round(amount).toLocaleString('en-US');
}

interface BalanceRowProps {
  currency: string;
  amount: number;
  /** Expand indicator slot — only the first row carries one. */
  indicator?: string;
  /** Collapsed-state hint that more currencies exist. */
  hiddenCount?: number;
}

function BalanceRow({ currency, amount, indicator, hiddenCount }: BalanceRowProps) {
  // Ledger layout: fixed-width right-aligned amount column directly beside
  // the code column, so amounts share one right edge near their labels
  // instead of stretching to the card edge.
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="text-apxm-text/50 text-xs w-4 shrink-0">{indicator ?? ''}</span>
      <span className="font-mono text-xs text-apxm-text/70 w-9 shrink-0">{currency}</span>
      <span className="font-mono text-xs text-apxm-text tabular-nums w-28 shrink-0 text-right">
        {formatAmount(amount)}
      </span>
      {hiddenCount !== undefined && hiddenCount > 0 && (
        <span className="text-xs text-apxm-muted">+{hiddenCount}</span>
      )}
    </div>
  );
}

/**
 * Company identity + liquidity pane.
 * Header: company name + code (falls back to "Cash" until COMPANY_DATA arrives).
 * Collapsed: primary-currency balance on one line with a +N hint.
 * Expanded (tap): full list — ECD filtered, primary currency first, rest alphabetical.
 */
export function CashBalancePane() {
  const fetched = useBalancesStore((s) => s.fetched);
  const entities = useBalancesStore((s) => s.entities);
  const company = useCompanyStore((s) => s.company);
  const [expanded, setExpanded] = useState(false);

  const balances = useMemo(
    () =>
      sortBalances(
        Array.from(entities.values()),
        company ? primaryCurrencyFor(company.countryId) : null
      ),
    [entities, company]
  );

  const title = company
    ? company.code
      ? `${company.name} (${company.code})`
      : company.name
    : 'Cash';
  const [primary, ...rest] = balances;

  return (
    <Panel title={title}>
      {!fetched ? (
        <p className="text-xs text-apxm-muted animate-pulse">Loading balances...</p>
      ) : balances.length === 0 ? (
        <p className="text-xs text-apxm-muted">No balances</p>
      ) : balances.length === 1 ? (
        // Single currency — nothing to expand, render a plain row
        <BalanceRow currency={balances[0].currency} amount={balances[0].amount} />
      ) : (
        // flex-col overrides the browser's default vertical centring of
        // button content: the first row keeps the same offset below the
        // title in both states, so expanding only grows the list downward.
        <button
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          className="w-full min-h-[44px] flex flex-col items-stretch justify-start text-left hover:bg-apxm-accent/30"
        >
          <BalanceRow
            currency={primary.currency}
            amount={primary.amount}
            indicator={expanded ? '▼' : '▶'}
            hiddenCount={!expanded ? rest.length : undefined}
          />
          {/* grid-rows 0fr→1fr animates to the list's natural height
              (height:auto isn't transitionable); motion-reduce disables it */}
          <div
            className={`grid transition-[grid-template-rows,opacity] duration-150 ease-out motion-reduce:transition-none ${
              expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
            }`}
          >
            <div className="overflow-hidden">
              {rest.map((bal) => (
                <BalanceRow key={bal.currency} currency={bal.currency} amount={bal.amount} />
              ))}
            </div>
          </div>
        </button>
      )}
    </Panel>
  );
}
