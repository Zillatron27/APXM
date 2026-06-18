import { useSettingsStore } from '../../stores/settings';
import { classifyRepairUrgency, type RepairUrgency } from '../../core/repair';
import { keycapClasses } from '../shared';

const urgencyColors: Record<RepairUrgency, string> = {
  critical: 'bg-status-critical/20 text-status-critical',
  warning: 'bg-status-warning/20 text-status-warning',
  ok: 'bg-status-ok/20 text-status-ok',
};

/**
 * Days-since-last-repair badge, coloured by the user's repair thresholds.
 * Null age (no repairable buildings on the site) renders a muted dash. Pass
 * `interactive` when the badge drills into the repair sheet — gains the keycap
 * affordance (tap handler lives on the wrapper).
 */
export function RepairAgeBadge({
  ageDays,
  interactive = false,
}: {
  ageDays: number | null;
  interactive?: boolean;
}) {
  const thresholds = useSettingsStore((s) => s.repairThresholds);
  const keycap = interactive ? ` ${keycapClasses}` : '';

  if (ageDays === null) {
    return (
      <span className={`block w-full text-center py-0.5 text-xs font-medium bg-apxm-bg text-apxm-muted${keycap}`}>
        —
      </span>
    );
  }

  const urgency = classifyRepairUrgency(ageDays, thresholds);
  return (
    <span className={`block w-full text-center py-0.5 text-xs font-medium ${urgencyColors[urgency]}${keycap}`}>
      {Math.floor(ageDays)}d
    </span>
  );
}
