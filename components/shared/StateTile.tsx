export type TileVariant = 'neutral' | 'success' | 'warning' | 'danger' | 'muted';

interface StateTileProps {
  label: string;
  variant?: TileVariant;
}

const variantStyles: Record<TileVariant, string> = {
  neutral: 'bg-apxm-surface text-apxm-text/70',
  success: 'bg-status-ok/20 text-status-ok',
  warning: 'bg-status-warning/20 text-status-warning',
  danger: 'bg-status-critical/20 text-status-critical',
  muted: 'bg-apxm-surface text-apxm-muted',
};

/**
 * Compact state indicator tile.
 * Used for fleet states (IDL, ARR, TRN, DEP, ORB) and contract states.
 */
export function StateTile({ label, variant = 'neutral' }: StateTileProps) {
  return (
    <span
      className={`px-1.5 py-0.5 text-xs font-mono rounded ${variantStyles[variant]}`}
    >
      {label}
    </span>
  );
}
