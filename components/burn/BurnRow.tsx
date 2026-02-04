import type { BurnRate } from '../../core/burn';
import { BurnBadge } from './BurnBadge';
import { MaterialTile } from '../shared';

interface BurnRowProps {
  burn: BurnRate;
  /** Show detailed breakdown (production in/out, workforce) */
  detailed?: boolean;
}

/**
 * Single material burn row showing ticker, days remaining, and optionally need.
 */
export function BurnRow({ burn, detailed = false }: BurnRowProps) {
  const {
    materialTicker,
    dailyAmount,
    type,
    urgency,
    inventoryAmount,
    daysRemaining,
    need,
    productionInput,
    productionOutput,
    workforceConsumption,
  } = burn;

  const isConsuming = dailyAmount < 0;
  const dailyDisplay = dailyAmount >= 0 ? `+${dailyAmount.toFixed(1)}` : dailyAmount.toFixed(1);

  return (
    <div className="flex items-center justify-between gap-1 py-1">
      {/* Ticker */}
      <MaterialTile ticker={materialTicker} />

      <div className="flex items-center">
        {/* Inventory */}
        <span className="w-12 text-right font-mono text-xs text-apxm-text/70">
          {Math.floor(inventoryAmount)}
        </span>

        {/* Daily rate */}
        <span className={`w-20 text-right font-mono text-xs ${isConsuming ? 'text-red-400' : 'text-green-400'}`}>
          {dailyDisplay}/d
        </span>

        {/* Days remaining */}
        <span className="w-14 text-right">
          <BurnBadge urgency={urgency} daysRemaining={daysRemaining} />
        </span>

        {/* Need amount (only if consuming and has need) */}
        <span className="w-12 text-right text-xs text-amber-400">
          {isConsuming && need > 0 ? `+${Math.ceil(need)}` : ''}
        </span>
      </div>
    </div>
  );
}

/**
 * Compact version for tight spaces - just ticker and days.
 */
export function BurnRowCompact({ burn }: { burn: BurnRate }) {
  return (
    <div className="flex items-center gap-2">
      <MaterialTile ticker={burn.materialTicker} size="sm" />
      <BurnBadge urgency={burn.urgency} daysRemaining={burn.daysRemaining} size="sm" />
    </div>
  );
}
