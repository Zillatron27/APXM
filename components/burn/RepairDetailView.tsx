import { useSettingsStore } from '../../stores/settings';
import { classifyRepairUrgency, type RepairUrgency } from '../../core/repair';
import { useSiteRepairBuildings } from './useRepairStatus';

interface RepairDetailViewProps {
  siteId: string;
}

const urgencyText: Record<RepairUrgency, string> = {
  critical: 'text-status-critical',
  warning: 'text-status-warning',
  ok: 'text-status-ok',
};

const urgencyBar: Record<RepairUrgency, string> = {
  critical: 'bg-status-critical',
  warning: 'bg-status-warning',
  ok: 'bg-status-ok',
};

function formatDays(days: number): string {
  return days < 1 ? '<1d' : `${Math.floor(days)}d`;
}

/**
 * Per-building repair drill-down: every repairable building (PRODUCTION /
 * RESOURCES) on the site, oldest-since-repair first. Each row is an age gauge —
 * the fill builds up from empty toward the repair threshold and is tinted by
 * the current zone (green → yellow → red), with tick marks at the user's yellow
 * (threshold − offset) and red (threshold) day settings. Read-only: opening the
 * BRA buffer to actually repair is deferred to the action-passthrough work.
 */
export function RepairDetailView({ siteId }: RepairDetailViewProps) {
  const buildings = useSiteRepairBuildings(siteId);
  const { threshold, offset } = useSettingsStore((s) => s.repairThresholds);

  if (buildings.length === 0) {
    return <p className="text-sm text-apxm-muted">No repairable buildings on this site.</p>;
  }

  const yellowDay = threshold - offset;
  // Tick positions as a % of the gauge, whose full width represents the red
  // threshold (ages at/past it read as a full, red bar).
  const yellowAt = (yellowDay / threshold) * 100;

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="font-mono text-[10px] uppercase tracking-wide text-apxm-text/40">
          {buildings.length} repairable {buildings.length === 1 ? 'building' : 'buildings'} · oldest{' '}
          {formatDays(buildings[0].ageDays)}
        </p>
        {/* Threshold legend — what the gauge zones mean, in the user's day settings. */}
        <p className="font-mono text-[10px] text-apxm-muted">
          <span className="text-status-ok">▮</span> &lt;{yellowDay}d{'  '}
          <span className="text-status-warning">▮</span> ≥{yellowDay}d{'  '}
          <span className="text-status-critical">▮</span> ≥{threshold}d
        </p>
      </div>

      <div className="space-y-1.5">
        {buildings.map((b) => {
          const urgency = classifyRepairUrgency(b.ageDays, { threshold, offset });
          const fillPct = Math.min(b.ageDays / threshold, 1) * 100;
          return (
            <div key={b.id} className="flex items-center gap-2">
              <span
                title={b.name}
                className="shrink-0 w-12 py-0.5 text-center font-mono text-xs font-bold text-apxm-text bg-apxm-accent/50 border border-apxm-accent"
              >
                {b.ticker}
              </span>
              {/* Age gauge — fills toward the red threshold; ticks mark the zones. */}
              <div
                className="relative flex-1 h-1.5 bg-apxm-bg"
                role="meter"
                aria-label={`${b.name} ${formatDays(b.ageDays)} since repair`}
              >
                <div className={`h-full ${urgencyBar[urgency]}`} style={{ width: `${fillPct}%` }} />
                <span
                  aria-hidden
                  className="absolute inset-y-0 w-px bg-status-warning"
                  style={{ left: `${yellowAt}%` }}
                />
                <span aria-hidden className="absolute inset-y-0 right-0 w-px bg-status-critical" />
              </div>
              <span className={`shrink-0 w-10 text-right font-mono text-xs tabular-nums ${urgencyText[urgency]}`}>
                {formatDays(b.ageDays)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
