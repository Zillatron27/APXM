import { useState } from 'react';
import type { SiteBurnSummary, BurnRate } from '../../core/burn';
import { BurnBadge } from './BurnBadge';
import { BurnRow } from './BurnRow';

interface SiteBurnCardProps {
  summary: SiteBurnSummary;
  /** Start expanded */
  defaultExpanded?: boolean;
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
    // Consuming items first
    const aConsuming = a.dailyAmount < 0;
    const bConsuming = b.dailyAmount < 0;

    if (aConsuming && !bConsuming) return -1;
    if (!aConsuming && bConsuming) return 1;

    // Within consuming: by days remaining
    if (aConsuming && bConsuming) {
      return a.daysRemaining - b.daysRemaining;
    }

    // Within surplus: alphabetical by ticker
    return a.materialTicker.localeCompare(b.materialTicker);
  });
}

/**
 * Card showing burn summary for a single site.
 * Collapsible with header showing site name and most urgent item.
 */
export function SiteBurnCard({ summary, defaultExpanded = false }: SiteBurnCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const { siteName, burns, mostUrgent } = summary;

  const sortedBurns = sortBurns(burns);
  const consumingCount = burns.filter((b) => b.dailyAmount < 0).length;
  const criticalCount = burns.filter((b) => b.urgency === 'critical').length;
  const warningCount = burns.filter((b) => b.urgency === 'warning').length;

  return (
    <div className="bg-apxm-surface overflow-hidden">
      {/* Header - always visible, clickable */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between gap-2 p-3 text-left hover:bg-apxm-accent/30 min-h-[44px]"
      >
        <div className="flex items-center gap-2">
          {/* Expand/collapse indicator */}
          <span className="text-apxm-text/50 text-xs w-4">
            {expanded ? '▼' : '▶'}
          </span>

          {/* Site name */}
          <span className="font-semibold text-apxm-text">{siteName}</span>

          {/* Quick counts */}
          {criticalCount > 0 && (
            <span className="text-xs px-1.5 py-0.5 bg-red-500/20 text-red-400">
              {criticalCount}
            </span>
          )}
          {warningCount > 0 && (
            <span className="text-xs px-1.5 py-0.5 bg-amber-500/20 text-amber-400">
              {warningCount}
            </span>
          )}
        </div>

        {/* Most urgent item preview */}
        {mostUrgent && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-apxm-text/70">{mostUrgent.materialTicker}</span>
            <BurnBadge urgency={mostUrgent.urgency} daysRemaining={mostUrgent.daysRemaining} />
          </div>
        )}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-3 pb-3 border-t border-apxm-bg">
          {sortedBurns.length === 0 ? (
            <p className="text-sm text-apxm-text/50 py-2">Awaiting data — open BS buffers</p>
          ) : (
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
          )}
        </div>
      )}
    </div>
  );
}
