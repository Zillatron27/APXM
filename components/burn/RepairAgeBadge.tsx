import { useSettingsStore } from '../../stores/settings';
import { classifyRepairUrgency, type RepairUrgency } from '../../core/repair';

const urgencyColors: Record<RepairUrgency, string> = {
  critical: 'bg-status-critical/20 text-status-critical',
  warning: 'bg-status-warning/20 text-status-warning',
  ok: 'bg-status-ok/20 text-status-ok',
};

/**
 * Days-since-last-repair badge, coloured by the user's repair thresholds.
 * Null age (no repairable buildings on the site) renders a muted dash.
 */
export function RepairAgeBadge({ ageDays }: { ageDays: number | null }) {
  const thresholds = useSettingsStore((s) => s.repairThresholds);

  if (ageDays === null) {
    return (
      <span className="block w-full text-center py-0.5 text-xs font-medium bg-apxm-bg text-apxm-muted">
        —
      </span>
    );
  }

  const urgency = classifyRepairUrgency(ageDays, thresholds);
  return (
    <span className={`block w-full text-center py-0.5 text-xs font-medium ${urgencyColors[urgency]}`}>
      {Math.floor(ageDays)}d
    </span>
  );
}
