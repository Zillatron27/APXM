import type { Urgency } from '../../core/burn';

interface BurnBadgeProps {
  urgency: Urgency;
  /** Optional: show days remaining instead of just color */
  daysRemaining?: number;
  /** Size variant */
  size?: 'sm' | 'md';
}

const urgencyColors: Record<Urgency, string> = {
  critical: 'bg-red-500',
  warning: 'bg-amber-500',
  ok: 'bg-green-500',
  surplus: 'bg-blue-500',
};

const urgencyTextColors: Record<Urgency, string> = {
  critical: 'text-red-500',
  warning: 'text-amber-500',
  ok: 'text-green-500',
  surplus: 'text-blue-500',
};

/**
 * Visual indicator for burn urgency.
 * Shows a colored dot, optionally with days remaining.
 */
export function BurnBadge({ urgency, daysRemaining, size = 'md' }: BurnBadgeProps) {
  const dotSize = size === 'sm' ? 'h-2 w-2' : 'h-3 w-3';

  if (daysRemaining === undefined) {
    return (
      <span
        className={`inline-block rounded-full ${dotSize} ${urgencyColors[urgency]}`}
        title={urgency}
      />
    );
  }

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

/**
 * Returns the urgency color class for custom styling.
 */
export function getUrgencyColor(urgency: Urgency): string {
  return urgencyColors[urgency];
}

export function getUrgencyTextColor(urgency: Urgency): string {
  return urgencyTextColors[urgency];
}
