import { StateTile, type TileVariant } from '../shared';
import { useGameState } from '../../stores/gameState';
import type { ContractDetail, ContractStateLabel } from '../views/hooks';
import { formatDeadline } from './format';

interface ContractRowProps {
  contract: ContractDetail;
}

// Map state labels to tile variants
const stateVariants: Record<ContractStateLabel, TileVariant> = {
  open: 'success',
  partial: 'warning',
  closed: 'muted',
  fulfilled: 'success',
  breached: 'danger',
  rejected: 'danger',
};

/**
 * Dense contract row, mirroring the fleet ship row: contract id + state on the
 * left, deadline on the right, partner name beneath. The whole row drills into
 * the contract detail sheet (same flyover primitive as ships and base tiles).
 */
export function ContractRow({ contract }: ContractRowProps) {
  const setDetailView = useGameState((s) => s.setDetailView);

  const deadlineText = formatDeadline(contract.dueDateMs);
  const dueSoon =
    contract.dueDateMs !== null && contract.dueDateMs - Date.now() < 3 * 24 * 60 * 60 * 1000;

  return (
    <button
      onClick={() =>
        setDetailView({ type: 'contract', contractId: contract.id, contractName: contract.localId })
      }
      aria-label={`Contract ${contract.localId}, ${contract.stateLabel}. Open detail.`}
      className="w-full min-h-touch flex items-center justify-between gap-2 px-3 py-2 text-left bg-apxm-surface hover:bg-apxm-accent/30 active:bg-apxm-accent/50 transition-colors motion-reduce:transition-none"
    >
      {/* Identity + partner */}
      <div className="min-w-0">
        <span className="flex items-center gap-2 min-w-0">
          <span className="font-mono text-sm text-apxm-text shrink-0">{contract.localId}</span>
          <StateTile label={contract.stateLabel} variant={stateVariants[contract.stateLabel]} />
        </span>
        <span className="text-xs text-apxm-muted truncate block mt-0.5">
          {contract.partnerName}
          {contract.partnerCode && <span> ({contract.partnerCode})</span>}
        </span>
      </div>

      {/* Deadline — fixed right column (ledger alignment) */}
      <span
        className={`shrink-0 text-xs font-mono ${
          dueSoon ? 'text-status-warning' : 'text-apxm-text/70'
        }`}
      >
        {deadlineText}
      </span>
    </button>
  );
}
