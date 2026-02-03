import type { BurnRate } from '../../core/burn';
import { BurnBadge, getUrgencyTextColor } from './BurnBadge';

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
    <div className="flex items-center justify-between gap-2 py-1">
      <div className="flex items-center gap-2">
        {/* Ticker */}
        <span className={`font-mono font-semibold ${getUrgencyTextColor(urgency)}`}>
          {materialTicker}
        </span>

        {/* Type indicator */}
        <span className="text-xs text-apxm-text/50">
          {type === 'input' ? 'IN' : type === 'output' ? 'OUT' : 'WF'}
        </span>
      </div>

      <div className="flex items-center gap-3 text-right">
        {/* Inventory */}
        <span className="text-xs text-apxm-text/70">
          {Math.floor(inventoryAmount)}
        </span>

        {/* Daily rate */}
        <span className={`font-mono text-xs ${isConsuming ? 'text-red-400' : 'text-green-400'}`}>
          {dailyDisplay}/d
        </span>

        {/* Days remaining */}
        <BurnBadge urgency={urgency} daysRemaining={daysRemaining} />

        {/* Need amount (only if consuming and has need) */}
        {isConsuming && need > 0 && (
          <span className="text-xs text-amber-400">
            +{Math.ceil(need)}
          </span>
        )}
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
      <span className={`font-mono text-sm ${getUrgencyTextColor(burn.urgency)}`}>
        {burn.materialTicker}
      </span>
      <BurnBadge urgency={burn.urgency} daysRemaining={burn.daysRemaining} size="sm" />
    </div>
  );
}
