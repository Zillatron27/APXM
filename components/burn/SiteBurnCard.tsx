import type { ReactNode } from 'react';
import type { SiteBurnSummary } from '../../core/burn';
import { classifyRepairUrgency } from '../../core/repair';
import { classifyProdUrgency, prodStatusLabel } from '../../core/prod';
import { useRefreshState } from '../../stores/refreshState';
import { useSettingsStore } from '../../stores/settings';
import { useGameState } from '../../stores/gameState';
import { executeBufferRefresh, buildBufferCommand } from '../../lib/buffer-refresh';
import { useSiteStaleness } from '../../hooks/useSiteStaleness';
import { BaseStatusTile, type TileTone } from './BaseStatusTile';
import type { ProdStatus } from './useProdStatus';

interface SiteBurnCardProps {
  summary: SiteBurnSummary;
  /** Days since last repair on the site's oldest production building (null = none) */
  repairAgeDays: number | null;
  /** Capacity-aware production status (null = data not yet received) */
  prodStatus: ProdStatus;
}

function formatDays(days: number): string {
  return days < 1 ? '<1d' : `${Math.floor(days)}d`;
}

/**
 * A status tile that drills into its dimension's detail sheet. The keycap
 * affordance lives on the tile; this wraps it with the button semantics.
 */
function DrillTile({
  label,
  value,
  tone,
  ariaLabel,
  onActivate,
}: {
  label: string;
  value: ReactNode;
  tone: TileTone;
  ariaLabel: string;
  onActivate: () => void;
}) {
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={onActivate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onActivate();
      }}
      aria-label={ariaLabel}
      className="flex min-h-touch items-center"
    >
      <BaseStatusTile label={label} value={value} tone={tone} interactive />
    </span>
  );
}

/**
 * Card for a single site: name, staleness, refresh, and the BURN / REPAIR /
 * PROD status tiles. Each tile is a keycap that drills into its detail sheet
 * (the burn breakdown that used to expand inline now lives in the burn sheet).
 */
export function SiteBurnCard({ summary, repairAgeDays, prodStatus }: SiteBurnCardProps) {
  const { siteId, siteName, burns, mostUrgent } = summary;

  const { text: stalenessText, colorClass: stalenessColor } = useSiteStaleness(siteId);
  const repairThresholds = useSettingsStore((s) => s.repairThresholds);

  const mode = useRefreshState((s) => s.mode);
  const siteStatus = useRefreshState((s) => s.siteStatus.get(siteId));
  const setDetailView = useGameState((s) => s.setDetailView);

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

  function handleRefresh(): void {
    if (isLoading) return;
    executeBufferRefresh({ siteId, command: buildBufferCommand(siteId) });
  }

  return (
    <div className="bg-apxm-surface border border-apxm-accent overflow-hidden">
      <div className="w-full flex items-center justify-between gap-2 p-3">
        {/* Site name + staleness */}
        <div className="min-w-0">
          <span className="font-semibold text-apxm-text">{siteName}</span>
          {burns.length > 0 && (
            <p className={`text-[11px] mt-0.5 ${stalenessColor}`}>{stalenessText}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Refresh button */}
          {showRefreshButton && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleRefresh}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRefresh();
              }}
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

          {/* BURN / REPAIR / PROD — each drills into its detail sheet */}
          <DrillTile
            label="Burn"
            value={mostUrgent ? formatDays(mostUrgent.daysRemaining) : '—'}
            tone={burnTone}
            ariaLabel={`Burn detail for ${siteName}`}
            onActivate={() => setDetailView({ type: 'burn', siteId, siteName })}
          />
          <DrillTile
            label="Repair"
            value={repairAgeDays === null ? '—' : formatDays(repairAgeDays)}
            tone={repairTone}
            ariaLabel={`Repair detail for ${siteName}`}
            onActivate={() => setDetailView({ type: 'repair', siteId, siteName })}
          />
          <DrillTile
            label="Prod"
            value={prodStatusLabel(prodStatus)}
            tone={prodTone}
            ariaLabel={`Production detail for ${siteName}`}
            onActivate={() => setDetailView({ type: 'production', siteId, siteName })}
          />
        </div>
      </div>
    </div>
  );
}
