import { useSettingsStore } from '../../stores/settings';
import { getCategoryColors } from '../../lib/material-colors';
import { getMaterialCategory } from '../../lib/material-lookup';

interface MaterialTileProps {
  ticker: string;
  /** Optional category override (skips lookup) */
  category?: string;
  size?: 'sm' | 'md';
}

const sizeClasses = {
  sm: 'py-0.5 text-xs',
  md: 'py-1 text-sm',
};

// Fixed width to fit 3-character tickers
const sizeWidths = {
  sm: 'w-8',   // ~32px
  md: 'w-10',  // ~40px
};

/**
 * Colored material ticker tile.
 * Sharp corners, solid background based on category and theme.
 */
export function MaterialTile({ ticker, category, size = 'md' }: MaterialTileProps) {
  const theme = useSettingsStore((s) => s.materialTheme);
  const categorySlug = category ?? getMaterialCategory(ticker);
  const colors = getCategoryColors(categorySlug, theme);

  return (
    <span
      className={`font-mono font-semibold inline-block text-center ${sizeClasses[size]} ${sizeWidths[size]}`}
      style={{
        backgroundColor: colors.bg,
        color: colors.text,
        textShadow: '1px 1px 1px rgba(0, 0, 0, 0.7)',
      }}
    >
      {ticker}
    </span>
  );
}
