import { useMemo, useState } from 'react';
import { Card, SectionHeader } from '../shared';
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
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2">
        <span className="text-apxm-text/50 text-xs w-4 shrink-0">{indicator ?? ''}</span>
        <span className="text-xs text-apxm-text">{currency}</span>
      </span>
      <span className="flex items-center gap-2">
        {hiddenCount !== undefined && hiddenCount > 0 && (
          <span className="text-xs text-apxm-muted">+{hiddenCount}</span>
        )}
        <span className="text-xs text-apxm-text tabular-nums">{formatAmount(amount)}</span>
      </span>
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
  const visible = expanded ? balances : balances.slice(0, 1);
  const hiddenCount = balances.length - visible.length;

  return (
    <Card>
      <SectionHeader title={title} />
      {!fetched ? (
        <p className="text-xs text-apxm-muted animate-pulse">Loading balances...</p>
      ) : balances.length === 0 ? (
        <p className="text-xs text-apxm-muted">No balances</p>
      ) : balances.length === 1 ? (
        // Single currency — nothing to expand, render a plain row
        <BalanceRow currency={balances[0].currency} amount={balances[0].amount} />
      ) : (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full min-h-[44px] text-left hover:bg-apxm-accent/30"
        >
          {visible.map((bal, i) => (
            <BalanceRow
              key={bal.currency}
              currency={bal.currency}
              amount={bal.amount}
              indicator={i === 0 ? (expanded ? '▼' : '▶') : undefined}
              hiddenCount={i === 0 && !expanded ? hiddenCount : undefined}
            />
          ))}
        </button>
      )}
    </Card>
  );
}
