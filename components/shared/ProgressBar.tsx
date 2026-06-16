export type BarColor = 'orange' | 'yellow' | 'blue';

interface ProgressBarProps {
  current: number;
  max: number;
  color: BarColor;
  /** Left label (e.g. "Cargo", "SF"). Omit to align a row under a labelled one. */
  label?: string;
  /** Optional unit suffix on the value (e.g. "t", "m³"). */
  unit?: string;
}

const colorStyles: Record<BarColor, string> = {
  orange: 'bg-orange-500',
  yellow: 'bg-yellow-500',
  blue: 'bg-blue-500',
};

/**
 * Dense ledger bar row: fixed label on the left, the bar fills the middle, and
 * the value sits right-aligned in a fixed column (so every row shares one right
 * edge). Used for ship cargo + fuel in the detail sheet.
 */
export function ProgressBar({ current, max, color, label, unit }: ProgressBarProps) {
  const percentage = max > 0 ? Math.min(100, (current / max) * 100) : 0;

  return (
    <div className="flex items-center gap-2">
      <span className="w-14 shrink-0 text-xs text-apxm-text/70">{label}</span>
      <div className="flex-1 h-2 bg-apxm-bg rounded-sm overflow-hidden">
        <div
          className={`h-full ${colorStyles[color]} transition-all motion-reduce:transition-none`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="w-28 shrink-0 text-right text-xs font-mono text-apxm-text/70 tabular-nums whitespace-nowrap">
        {formatQty(current)} / {formatQty(max)}
        {unit && <span className="text-apxm-text/40"> {unit}</span>}
      </span>
    </div>
  );
}

/** Compact quantity: k-suffix ≥1000, one decimal for fractions, else integer. */
function formatQty(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  if (Number.isInteger(n)) return `${n}`;
  return n.toFixed(1);
}
