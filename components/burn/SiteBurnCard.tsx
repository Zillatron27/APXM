import { useState } from 'react';
import type { SiteBurnSummary, BurnRate } from '../../core/burn';
import { classifyRepairUrgency } from '../../core/repair';
import { classifyProdUrgency, prodStatusLabel } from '../../core/prod';
import { useRefreshState } from '../../stores/refreshState';
import { useSettingsStore } from '../../stores/settings';
import { executeBufferRefresh, buildBufferCommand } from '../../lib/buffer-refresh';
import { useSiteStaleness } from '../../hooks/useSiteStaleness';
import { BurnRow } from './BurnRow';
import { BaseStatusTile, type TileTone } from './BaseStatusTile';
import type { ProdStatus } from './useProdStatus';

interface SiteBurnCardProps {
  summary: SiteBurnSummary;
  /** Days since last repair on the site's oldest production building (null = none) */
  repairAgeDays: number | null;
  /** Capacity-aware production status (null = data not yet received) */
  prodStatus: ProdStatus;
  /** Start expanded */
  defaultExpanded?: boolean;
}

function formatDays(days: number): string {
  return days < 1 ? '<1d' : `${Math.floor(days)}d`;
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
export function SiteBurnCard({
  summary,
  repairAgeDays,
  prodStatus,
  defaultExpanded = false,
}: SiteBurnCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const { siteId, siteName, burns, mostUrgent } = summary;

  const { text: stalenessText, colorClass: stalenessColor } = useSiteStaleness(siteId);
  const repairThresholds = useSettingsStore((s) => s.repairThresholds);

  const mode = useRefreshState((s) => s.mode);
  const siteStatus = useRefreshState((s) => s.siteStatus.get(siteId));

  const sortedBurns = sortBurns(burns);

  // Tile tones: burn from mostUrgent urgency (surplus folds into ok),
  // repair from the user's threshold/offset settings
  const burnTone: TileTone = mostUrgent
    ? mostUrgent.urgency === 'surplus'
      ? 'ok'
      : mostUrgent.urgency
    : 'muted';
  const repairTone: TileTone =
    repairAgeDays === null ? 'muted' : classifyRepairUrgency(repairAgeDays, repairThresholds);
  const prodTone: TileTone =
    prodStatus === null ? 'muted' : classifyProdUrgency(prodStatus.tier);

  const showRefreshButton = mode === 'manual' || mode === 'batch';
  const isLoading = siteStatus === 'loading';

  function handleRefresh(e: React.MouseEvent): void {
    e.stopPropagation();
    if (isLoading) return;
    executeBufferRefresh({ siteId, command: buildBufferCommand(siteId) });
  }

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

          {/* Site name + staleness (only when site has burn data) */}
          <div>
            <span className="font-semibold text-apxm-text">{siteName}</span>
            {sortedBurns.length > 0 && (
              <p className={`text-[11px] mt-0.5 ${stalenessColor}`}>
                {stalenessText}
              </p>
            )}
          </div>

        </div>

        <div className="flex items-center gap-2">
          {/* Refresh button */}
          {showRefreshButton && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleRefresh}
              onKeyDown={(e) => { if (e.key === 'Enter') handleRefresh(e as unknown as React.MouseEvent); }}
              className={`min-h-touch w-8 flex items-center justify-center text-sm ${
                isLoading
                  ? 'text-apxm-muted cursor-wait'
                  : siteStatus === 'success'
                    ? 'text-status-ok'
                    : siteStatus === 'error'
                      ? 'text-status-critical'
                      : 'text-apxm-text/50 hover:text-prun-yellow'
              }`}
              aria-label={`Refresh ${siteName}`}
            >
              {isLoading ? (
                <span className="animate-spin">↻</span>
              ) : siteStatus === 'success' ? (
                '✓'
              ) : siteStatus === 'error' ? (
                '✗'
              ) : (
                '↻'
              )}
            </span>
          )}

          {/* BURN / REPAIR / PROD status tiles */}
          <BaseStatusTile
            label="Burn"
            value={mostUrgent ? formatDays(mostUrgent.daysRemaining) : '—'}
            tone={burnTone}
          />
          <BaseStatusTile
            label="Repair"
            value={repairAgeDays === null ? '—' : formatDays(repairAgeDays)}
            tone={repairTone}
          />
          <BaseStatusTile
            label="Prod"
            value={prodStatusLabel(prodStatus)}
            tone={prodTone}
          />
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-3 pb-3 border-t border-apxm-bg">
          {sortedBurns.length === 0 ? (
            <p className="text-sm text-apxm-text/50 py-2">Awaiting data — tap refresh or open BS buffer in APEX</p>
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
