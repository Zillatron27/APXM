import type { BurnRate } from '../../core/burn';
import { useSiteStaleness } from '../../hooks/useSiteStaleness';
import { useSiteBurns } from './useSiteBurns';
import { BurnRow } from './BurnRow';

interface BurnDetailViewProps {
  siteId: string;
}

/**
 * Filters out materials with no activity (0 stock, 0 burn, 0 need).
 */
function filterActiveBurns(burns: BurnRate[]): BurnRate[] {
  return burns.filter(
    (b) => b.inventoryAmount > 0 || b.dailyAmount !== 0 || b.need > 0
  );
}

/**
 * Sorts burns: consuming items first (by days remaining), then surplus.
 */
function sortBurns(burns: BurnRate[]): BurnRate[] {
  return [...filterActiveBurns(burns)].sort((a, b) => {
    const aConsuming = a.dailyAmount < 0;
    const bConsuming = b.dailyAmount < 0;

    if (aConsuming && !bConsuming) return -1;
    if (!aConsuming && bConsuming) return 1;

    if (aConsuming && bConsuming) {
      return a.daysRemaining - b.daysRemaining;
    }

    return a.materialTicker.localeCompare(b.materialTicker);
  });
}

/**
 * Full material burn breakdown for a single base — the rows that used to live
 * in the expanded SiteBurnCard, now reached by tapping the BURN tile. Read-only;
 * the refresh control stays on the base card.
 */
export function BurnDetailView({ siteId }: BurnDetailViewProps) {
  const summary = useSiteBurns().find((s) => s.siteId === siteId);
  const { text: stalenessText, colorClass: stalenessColor } = useSiteStaleness(siteId);

  const sortedBurns = summary ? sortBurns(summary.burns) : [];

  if (sortedBurns.length === 0) {
    return (
      <p className="px-1 py-4 text-sm text-apxm-text/50">
        Awaiting data — refresh this base from the Bases tab or open its BS buffer in APEX.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className={`text-[11px] ${stalenessColor}`}>{stalenessText}</p>
      <div className="divide-y divide-apxm-bg/50">
        {/* Column headers */}
        <div className="flex items-center justify-between gap-1 py-1 text-[10px] text-apxm-text/40 uppercase tracking-wide">
          <span className="w-10">Mat</span>
          <div className="flex items-center">
            <span className="w-12 text-right">Inv</span>
            <span className="w-20 text-right">Rate</span>
            <span className="w-14 text-right">Days</span>
            <span className="w-12 text-right">Need</span>
          </div>
        </div>
        {sortedBurns.map((burn) => (
          <BurnRow key={burn.materialTicker} burn={burn} />
        ))}
      </div>
    </div>
  );
}
