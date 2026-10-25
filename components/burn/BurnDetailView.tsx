import type { BurnRate } from '../../core/burn';
import { useSiteStaleness } from '../../hooks/useSiteStaleness';
import { useSettingsStore } from '../../stores/settings';
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
  const inboundExcluded = useSettingsStore((s) => s.excludeInboundSiteIds.includes(siteId));
  const toggleExcludeInbound = useSettingsStore((s) => s.toggleExcludeInbound);

  const sortedBurns = summary ? sortBurns(summary.burns) : [];

  if (sortedBurns.length === 0) {
    return (
      <p className="px-1 py-4 text-sm text-apxm-text/55">
        Awaiting data — refresh this base from the Bases tab or open its BS buffer in APEX.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className={`text-[11px] ${stalenessColor}`}>{stalenessText}</p>
        {/* rPrun's BURN header control: rocket lit = inbound cargo counted, dim = excluded */}
        {summary?.hasInboundShips && (
          <button
            onClick={() => toggleExcludeInbound(siteId)}
            aria-pressed={!inboundExcluded}
            aria-label={
              inboundExcluded
                ? 'Excludes inbound cargo. Tap to include it.'
                : 'Includes inbound cargo. Tap to exclude it.'
            }
            className={`min-h-touch min-w-touch flex items-center justify-center ${
              inboundExcluded ? 'text-apxm-text/30' : 'text-apxm-text'
            }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M12 2c3 2.5 4 6 4 10v5H8v-5c0-4 1-7.5 4-10z" />
              <path d="M8 12l-3 3v4h3" />
              <path d="M16 12l3 3v4h-3" />
              <circle cx="12" cy="9" r="1.5" />
              <path d="M10 20v2M14 20v2" />
            </svg>
          </button>
        )}
      </div>
      <div className="divide-y divide-apxm-bg/50">
        {/* Column headers */}
        <div className="flex items-center justify-between gap-1 py-1 text-[10px] text-apxm-text/55 uppercase tracking-wide">
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
