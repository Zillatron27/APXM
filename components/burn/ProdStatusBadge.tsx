import { classifyProdUrgency, prodStatusLabel } from '../../core/prod';
import type { ProdStatus } from './useProdStatus';

const tierClasses = {
  ok: 'bg-status-ok/20 text-status-ok',
  warning: 'bg-status-warning/20 text-status-warning',
  critical: 'bg-status-critical/20 text-status-critical',
} as const;

/**
 * Production status badge: ✓ all running, fraction (e.g. 21/24) partially
 * running, ∅ stopped, ? unknown. Distinct glyphs (not colour alone) keep the
 * states legible under CVD.
 */
export function ProdStatusBadge({ status }: { status: ProdStatus }) {
  if (status === null) {
    return (
      <span className="block w-full text-center py-0.5 text-xs font-medium bg-apxm-bg text-apxm-muted">
        ?
      </span>
    );
  }
  return (
    <span
      className={`block w-full text-center py-0.5 text-xs font-medium whitespace-nowrap ${tierClasses[classifyProdUrgency(status.tier)]}`}
    >
      {prodStatusLabel(status)}
    </span>
  );
}
