import type { ProdStatus } from './useProdStatus';

/**
 * Production status badge: ✓ all lines running, ∅ stopped/idle, ? unknown.
 * Distinct symbols (not colour alone) keep the states legible under CVD.
 */
export function ProdStatusBadge({ status }: { status: ProdStatus }) {
  if (status === null) {
    return <span className="px-2 py-0.5 text-xs font-medium bg-apxm-bg text-apxm-muted">?</span>;
  }
  return status ? (
    <span className="px-2 py-0.5 text-xs font-medium bg-status-ok/20 text-status-ok">✓</span>
  ) : (
    <span className="px-2 py-0.5 text-xs font-medium bg-status-critical/20 text-status-critical">∅</span>
  );
}
