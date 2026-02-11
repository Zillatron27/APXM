export type BarColor = 'orange' | 'yellow' | 'blue';

interface ProgressBarProps {
  current: number;
  max: number;
  color: BarColor;
  label?: string;
}

const colorStyles: Record<BarColor, string> = {
  orange: 'bg-orange-500',
  yellow: 'bg-yellow-500',
  blue: 'bg-blue-500',
};

/**
 * Compact progress bar for cargo and fuel displays.
 * Uses: Cargo (orange), SF/STL fuel (yellow), FF/FTL fuel (blue)
 */
export function ProgressBar({ current, max, color, label }: ProgressBarProps) {
  const percentage = max > 0 ? Math.min(100, (current / max) * 100) : 0;

  return (
    <div className="flex items-center gap-2">
      {label && (
        <span className="text-xs text-apxm-text/70 w-10 shrink-0">{label}</span>
      )}
      <div className="flex-1" />
      <div className="w-20 h-2 bg-apxm-bg rounded-sm overflow-hidden shrink-0">
        <div
          className={`h-full ${colorStyles[color]} transition-all`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-xs text-apxm-text/70 font-mono shrink-0 w-20 text-right">
        {formatNumber(current)} / {formatNumber(max)}
      </span>
    </div>
  );
}

function formatNumber(n: number): string {
  if (n >= 1000) {
    return `${(n / 1000).toFixed(1)}k`;
  }
  return n.toLocaleString();
}
