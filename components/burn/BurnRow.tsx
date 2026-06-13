import { useState } from 'react';
import type { BurnRate } from '../../core/burn';
import { BurnBadge } from './BurnBadge';
import { MaterialTile } from '../shared';

interface BurnRowProps {
  burn: BurnRate;
}

/**
 * Single material burn row showing ticker, inventory, daily rate, days
 * remaining, and need. Tapping expands a detail line with the full
 * material name and the in/out/workforce rate breakdown.
 */
export function BurnRow({ burn }: BurnRowProps) {
  const [expanded, setExpanded] = useState(false);
  const {
    materialTicker,
    materialName,
    dailyAmount,
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

  // Only the active components — a zero line in the breakdown is noise
  const breakdown = [
    productionInput > 0 && `in ${productionInput.toFixed(1)}`,
    productionOutput > 0 && `out ${productionOutput.toFixed(1)}`,
    workforceConsumption > 0 && `wf ${workforceConsumption.toFixed(1)}`,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    // flex-col overrides the browser's default vertical centring of button
    // content, so the visible row keeps its position and expanding only
    // grows the detail line downward.
    <button
      onClick={() => setExpanded(!expanded)}
      aria-expanded={expanded}
      className="w-full flex flex-col items-stretch justify-start text-left hover:bg-apxm-accent/30"
    >
      <div className="flex items-center justify-between gap-1 py-1">
        {/* Ticker */}
        <MaterialTile ticker={materialTicker} />

        <div className="flex items-center">
          {/* Inventory */}
          <span className="w-12 text-right font-mono text-xs text-apxm-text/70">
            {Math.floor(inventoryAmount)}
          </span>

          {/* Daily rate */}
          <span className={`w-20 text-right font-mono text-xs ${isConsuming ? 'text-status-critical' : 'text-status-ok'}`}>
            {dailyDisplay}/d
          </span>

          {/* Days remaining */}
          <span className="w-14 text-right">
            <BurnBadge urgency={urgency} daysRemaining={daysRemaining} />
          </span>

          {/* Need amount (only if consuming and has need) */}
          <span className="w-12 text-right text-xs text-status-warning">
            {isConsuming && need > 0 ? `+${Math.ceil(need)}` : ''}
          </span>
        </div>
      </div>

      {/* grid-rows 0fr→1fr animates to natural height (height:auto isn't
          transitionable); motion-reduce disables it */}
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-150 ease-out motion-reduce:transition-none ${
          expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden">
          <div className="flex items-center justify-between gap-2 pb-1 text-[11px] text-apxm-text/50">
            <span className="truncate">{materialName ?? materialTicker}</span>
            {breakdown && (
              <span className="font-mono shrink-0">{breakdown} /d</span>
            )}
          </div>
        </div>
      </div>
    </button>
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
