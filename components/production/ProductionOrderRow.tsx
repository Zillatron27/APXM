import type { PrunApi } from '../../types/prun-api';
import { classifyOrderState, orderProgressPct } from '../../core/prod';
import { formatCountdown } from '../../lib/format-time';
import { MaterialTile } from '../shared';

interface ProductionOrderRowProps {
  order: PrunApi.ProductionOrder;
  /** Current time in ms; passed from the parent so all rows share one tick. */
  nowMs: number;
}

/**
 * One production order, mirroring an APEX buffer row: output material(s) and
 * quantity on the left, run state on the right, and a live progress bar for
 * orders currently producing.
 */
export function ProductionOrderRow({ order, nowMs }: ProductionOrderRowProps) {
  const state = classifyOrderState(order);
  const pct = orderProgressPct(order, nowMs);

  // Primary output anchors the fixed left columns so tiles line up across rows
  // regardless of quantity width (5× vs 20×). Extra outputs (byproducts) are
  // rare; they trail in the flexible middle and don't disturb the alignment.
  const [primary, ...extraOutputs] = order.outputs;

  return (
    <div className="py-2">
      <div className="flex items-center gap-2">
        {/* Fixed columns: tile, then quantity — kept left-most and width-stable */}
        {primary ? (
          <MaterialTile ticker={primary.material.ticker} size="sm" />
        ) : (
          <span className="w-8 text-center text-apxm-muted">—</span>
        )}
        <span className="w-10 shrink-0 text-xs tabular-nums text-apxm-text/70">
          {primary ? `${primary.amount}×` : ''}
        </span>

        {/* Flexible middle: byproduct tiles, and the recurring marker (queue
            only — a recurring order that's currently producing just shows its
            ETA; its recurrence matters while it waits in the queue). */}
        <div className="flex-1 flex items-center gap-1.5 min-w-0">
          {extraOutputs.map((output) => (
            <MaterialTile key={output.material.ticker} ticker={output.material.ticker} size="sm" />
          ))}
          {state === 'queued' && order.recurring && (
            <span className="text-[10px] uppercase tracking-wide text-apxm-text/40">
              recurring
            </span>
          )}
        </div>

        {/* Run state — right-aligned so ETAs stack in a column */}
        <span className="shrink-0 text-xs font-mono text-right">
          {state === 'halted' ? (
            <span className="font-semibold text-status-critical">HALTED</span>
          ) : state === 'queued' ? (
            <span className="text-apxm-muted">queued</span>
          ) : order.completion ? (
            <span className="text-apxm-text/70">
              in {formatCountdown(order.completion.timestamp - nowMs)}
            </span>
          ) : (
            <span className="text-apxm-text/70">running</span>
          )}
        </span>
      </div>

      {/* Live progress for producing orders */}
      {state === 'running' && pct !== null && (
        <div className="mt-1 flex items-center gap-2">
          <div className="flex-1 h-1 bg-apxm-bg overflow-hidden">
            <div className="h-full bg-status-ok" style={{ width: `${pct}%` }} />
          </div>
          <span className="w-14 text-right text-[10px] tabular-nums text-apxm-text/60">
            {Math.floor(pct)}% done
          </span>
        </div>
      )}
    </div>
  );
}
