/**
 * Production Status Calculation Engine
 *
 * Classifies per-site production utilisation from production lines (#36).
 * A ProductionLine represents a building *type* at a site: `capacity` is the
 * building count, and a building counts as active when it has a started,
 * non-halted order. Any idle building makes the site 'partial' — idle
 * production buildings are idle CapEx, which is exactly what the indicator
 * exists to surface.
 *
 * Supersedes the binary any-order-running check adapted from jackinabox86's
 * APXM fork (https://github.com/jackinabox86/APXM), MIT licensed — credit
 * jackinabox86.
 */

import type { PrunApi } from '../types/prun-api';

// ============================================================================
// Types
// ============================================================================

export type ProdTier = 'full' | 'partial' | 'stopped';

export interface ProdStatusSummary {
  tier: ProdTier;
  /** Buildings with a started, non-halted order, capped at capacity per line. */
  active: number;
  /** Total building count across the site's production lines. */
  capacity: number;
}

/** Production status per site. Null = production data not yet received. */
export type ProdStatus = ProdStatusSummary | null;

export type ProdUrgency = 'critical' | 'warning' | 'ok';

// ============================================================================
// Classification
// ============================================================================

/**
 * Aggregates active buildings vs capacity across a site's production lines.
 * A site with no lines classifies as 'stopped' (0/0) — same signal the
 * binary indicator gave, and a base without working production is the
 * condition the red tier exists to flag.
 */
export function classifyProdStatus(lines: PrunApi.ProductionLine[]): ProdStatusSummary {
  let active = 0;
  let capacity = 0;

  for (const line of lines) {
    const running = line.orders.filter((o) => o.started !== null && !o.halted).length;
    // Recurring/queued orders can briefly leave more started orders than
    // buildings; cap per line so utilisation never reads above 100%.
    active += Math.min(running, line.capacity);
    capacity += line.capacity;
  }

  const tier: ProdTier = active === 0 ? 'stopped' : active >= capacity ? 'full' : 'partial';
  return { tier, active, capacity };
}

/**
 * Maps a production tier onto the shared urgency scale used by the base
 * filters and status tiles: stopped output is the loudest alarm, partial
 * utilisation is wasted capacity worth a look, full is healthy.
 */
export function classifyProdUrgency(tier: ProdTier): ProdUrgency {
  switch (tier) {
    case 'stopped':
      return 'critical';
    case 'partial':
      return 'warning';
    case 'full':
      return 'ok';
  }
}

/**
 * Display label shared by the PROD badge and base-card tile so the two
 * surfaces cannot drift: ✓ full / "21/24" partial / ∅ stopped / ? unknown.
 * Distinct glyph shapes keep the states legible under CVD — colour is
 * reinforcement, not the only signal.
 */
export function prodStatusLabel(status: ProdStatus): string {
  if (status === null) return '?';
  switch (status.tier) {
    case 'full':
      return '✓';
    case 'partial':
      return `${status.active}/${status.capacity}`;
    case 'stopped':
      return '∅';
  }
}

// ============================================================================
// Order-level detail (production drill-down view)
// ============================================================================

/**
 * An order's running state, matching the three things the PROD buffer shows:
 * actively producing, waiting in the queue, or paused by the player.
 * 'halted' takes precedence over 'running' — a halted order may still carry a
 * `started` timestamp from before it was paused, but it is not producing.
 */
export type OrderState = 'running' | 'queued' | 'halted';

export function classifyOrderState(order: PrunApi.ProductionOrder): OrderState {
  if (order.halted) return 'halted';
  return order.started !== null ? 'running' : 'queued';
}

/**
 * Time-based completion percentage for a running order, 0–100. Mirrors the
 * APEX buffer's "34% done": progress is elapsed wall-clock against the order's
 * total duration, not units completed. Returns null when progress is
 * undefined — a queued order hasn't started, and without started/duration
 * there is nothing to measure. Clamped so a finished-but-not-cleared order
 * never reads above 100 or (on clock skew) below 0.
 */
export function orderProgressPct(
  order: PrunApi.ProductionOrder,
  nowMs: number
): number | null {
  if (order.started === null || order.duration === null) return null;
  const elapsed = nowMs - order.started.timestamp;
  const total = order.duration.millis;
  if (total <= 0) return null;
  return Math.max(0, Math.min(100, (elapsed / total) * 100));
}

/**
 * Orders in the same display order the buffer uses: running first (soonest to
 * finish at the top, by completion ETA), then everything queued in its
 * existing queue order. Halted orders sink to the bottom — they need
 * attention but aren't time-pressing. Stable within each group so the list
 * doesn't churn between ticks. Does not mutate the input.
 */
export function sortOrders(
  orders: PrunApi.ProductionOrder[]
): PrunApi.ProductionOrder[] {
  const rank: Record<OrderState, number> = { running: 0, queued: 1, halted: 2 };
  return [...orders]
    .map((order, index) => ({ order, index }))
    .sort((a, b) => {
      const stateDelta = rank[classifyOrderState(a.order)] - rank[classifyOrderState(b.order)];
      if (stateDelta !== 0) return stateDelta;
      // Within running, soonest completion first; null completion sorts last.
      const aState = classifyOrderState(a.order);
      if (aState === 'running') {
        const aEnd = a.order.completion?.timestamp ?? Infinity;
        const bEnd = b.order.completion?.timestamp ?? Infinity;
        if (aEnd !== bEnd) return aEnd - bEnd;
      }
      // Otherwise preserve original (queue) order.
      return a.index - b.index;
    })
    .map((entry) => entry.order);
}
