import type { PrunApi } from '../../types/prun-api';
import {
  classifyProdStatus,
  classifyProdUrgency,
  classifyOrderState,
  sortOrders,
} from '../../core/prod';
import { formatBuildingName } from '../../lib/format-building';
import { ProductionOrderRow } from './ProductionOrderRow';

interface ProductionLineSectionProps {
  line: PrunApi.ProductionLine;
  /** Current time in ms; threaded down so every row shares one tick. */
  nowMs: number;
}

const fractionTone = {
  ok: 'text-status-ok',
  warning: 'text-status-warning',
  critical: 'text-status-critical',
} as const;

/**
 * One production building (an APEX buffer column): the building ticker and its
 * running/capacity fraction, then its orders — producing first, then a "Queue"
 * divider, then everything waiting. The fraction is tinted by the same urgency
 * scale as the PROD badge so an idle building reads the same here as on the
 * base card.
 */
export function ProductionLineSection({ line, nowMs }: ProductionLineSectionProps) {
  const { active, capacity, tier } = classifyProdStatus([line]);
  const orders = sortOrders(line.orders);

  // The Queue divider marks where producing ends and waiting (queued/halted)
  // begins. sortOrders groups running first, so the first non-running order is
  // the queue head; -1 means everything is producing.
  const queueStart = orders.findIndex((o) => classifyOrderState(o) !== 'running');

  return (
    <div className="bg-apxm-surface">
      {/* Building header */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-apxm-bg">
        <span className="font-semibold text-sm text-apxm-text">{formatBuildingName(line.type)}</span>
        <span className={`text-xs font-mono tabular-nums ${fractionTone[classifyProdUrgency(tier)]}`}>
          {active}/{capacity}
        </span>
      </div>

      {/* Orders */}
      {orders.length === 0 ? (
        <p className="px-3 py-2 text-xs text-apxm-muted">Idle — no orders</p>
      ) : (
        <div className="px-3 pb-2">
          {orders.map((order, index) => (
            <div key={order.id}>
              {/* A thin rule separates every order (native PROD buffer look);
                  at the producing→waiting boundary it carries the QUEUE label
                  instead. Skipped above the first row — nothing to divide. */}
              {index > 0 &&
                (index === queueStart ? (
                  <div className="my-1 flex items-center gap-2 text-[10px] uppercase tracking-wide text-apxm-text/40">
                    <span>Queue</span>
                    <span className="flex-1 h-px bg-apxm-bg" />
                  </div>
                ) : (
                  <div className="h-px bg-apxm-bg/60" />
                ))}
              <ProductionOrderRow order={order} nowMs={nowMs} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
