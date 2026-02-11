import { useMemo } from 'react';
import { Card, SectionHeader } from '../shared';
import { useBalancesStore } from '../../stores/entities/balances';

function formatAmount(amount: number): string {
  return Math.round(amount).toLocaleString('en-US');
}

export function CashBalancePane() {
  const fetched = useBalancesStore((s) => s.fetched);
  const entities = useBalancesStore((s) => s.entities);
  const balances = useMemo(
    () => Array.from(entities.values())
      .filter((b) => b.currency !== 'ECD')
      .sort((a, b) => a.currency.localeCompare(b.currency)),
    [entities]
  );

  return (
    <Card>
      <SectionHeader title="Cash" />
      {!fetched ? (
        <p className="text-xs text-apxm-muted animate-pulse">Loading balances...</p>
      ) : (
        <div>
          {balances.map((bal) => (
            <div key={bal.currency} className="flex items-center justify-between">
              <span className="text-xs text-apxm-text">{bal.currency}</span>
              <span className="text-xs text-apxm-text tabular-nums">
                {formatAmount(bal.amount)}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
