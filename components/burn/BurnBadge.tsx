import type { Urgency } from '../../core/burn';

interface BurnBadgeProps {
  urgency: Urgency;
  daysRemaining: number;
}

const urgencyTextColors: Record<Urgency, string> = {
  critical: 'text-status-critical',
  warning: 'text-status-warning',
  ok: 'text-status-ok',
  surplus: 'text-status-surplus',
};

/**
 * Days remaining, coloured by burn urgency.
 */
export function BurnBadge({ urgency, daysRemaining }: BurnBadgeProps) {
  // Infinity = surplus (∞), zero shows as 0d, otherwise X.Xd
  if (daysRemaining === Infinity) {
    return (
      <span className={`font-mono text-sm ${urgencyTextColors[urgency]}`}>
        ∞
      </span>
    );
  }

  const displayDays = daysRemaining === 0 ? '0' : daysRemaining.toFixed(1);

  return (
    <span className={`font-mono text-sm ${urgencyTextColors[urgency]}`}>
      {displayDays}d
    </span>
  );
}
