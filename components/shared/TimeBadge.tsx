import type { Urgency } from '../../core/burn';

interface TimeBadgeProps {
  daysRemaining: number;
  urgency: Urgency;
}

const urgencyBgColors: Record<Urgency, string> = {
  critical: 'bg-status-critical/20 text-status-critical',
  warning: 'bg-status-warning/20 text-status-warning',
  ok: 'bg-status-ok/20 text-status-ok',
  surplus: 'bg-apxm-surface text-apxm-muted',
};

export function TimeBadge({ daysRemaining, urgency }: TimeBadgeProps) {
  const displayText =
    daysRemaining === Infinity
      ? 'OK'
      : daysRemaining < 1
        ? '<1d'
        : `${Math.floor(daysRemaining)}d`;

  return (
    <span className={`px-2 py-0.5 text-xs font-medium ${urgencyBgColors[urgency]}`}>
      {displayText}
    </span>
  );
}
