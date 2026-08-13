import { useState } from 'react';
import { MaterialTile, btnPrimary, btnSecondary } from '../shared';
import { useContractDetail, type ConditionPart, type ContractConditionDetail } from '../views/hooks';
import { formatCreated, formatDeadline } from './format';
import { runContractAction, type ContractActionTarget } from '../../lib/contract-actions';

interface ContractDetailViewProps {
  contractId: string;
}

/**
 * Renders one structured condition part (material tiles, amounts, destinations).
 */
function ConditionPartDisplay({ part }: { part: ConditionPart }) {
  switch (part.type) {
    case 'material':
      // Don't pass category - it's a hash ID from FIO, let MaterialTile use static lookup
      return <MaterialTile ticker={part.value} size="sm" />;
    case 'amount':
      return <span className="text-apxm-text">{part.value}</span>;
    case 'destination':
      return <span className="text-apxm-muted">→ {part.value}</span>;
    default:
      return <span>{part.value}</span>;
  }
}

// Short human label for the self-condition states that are mid-action — neither
// ready (available) nor waiting (blocked), so the glyph alone doesn't say much.
const midActionLabels: Partial<Record<ContractConditionDetail['status'], string>> = {
  IN_PROGRESS: 'in progress',
  PARTLY_FULFILLED: 'partly fulfilled',
  FULFILLMENT_ATTEMPTED: 'attempted',
};

interface ConditionBlockProps {
  cond: ContractConditionDetail;
  /** Fires the one-tap FULFILL passthrough for this condition (#73). */
  onFulfill: () => void;
  actionRunning: boolean;
}

/**
 * One condition block. Indicator + party on the top line, the description
 * beneath, a dependency/mid-action hint, and — when the condition is
 * available (self + pending + dependencies fulfilled) — the FULFILL button.
 * The tap IS the commit: APXM drives the CONT buffer off-screen and clicks
 * APEX's own fulfill control (action-authorisation rule).
 */
function ConditionBlock({ cond, onFulfill, actionRunning }: ConditionBlockProps) {
  const glyph = cond.breached ? '!' : cond.fulfilled ? '✓' : cond.available ? '●' : '✗';
  const glyphColor = cond.breached
    ? 'text-status-critical'
    : cond.fulfilled
      ? 'text-status-ok'
      : cond.available
        ? 'text-status-warning'
        : 'text-apxm-muted';

  return (
    <div className="flex items-center gap-2 py-2 border-b border-apxm-surface last:border-b-0">
      <div className="flex-1 min-w-0">
        {/* Top line: index, indicator, party, deadline */}
        <div className="flex items-center gap-2 text-xs">
          <span className="shrink-0 w-5 text-apxm-muted font-mono">#{cond.index + 1}</span>
          <span aria-hidden className={`shrink-0 w-4 text-center ${glyphColor}`}>
            {glyph}
          </span>
          <span
            className={`truncate ${cond.party === 'self' ? 'text-apxm-text' : 'text-apxm-muted'}`}
          >
            {cond.party === 'self' ? 'Self' : cond.partnerName}
          </span>
          {!cond.fulfilled && cond.deadline && (
            <span className="shrink-0 text-apxm-muted font-mono ml-auto">{cond.deadline}</span>
          )}
        </div>

        {/* Description: type + material + amount + destination */}
        <div className="flex items-center flex-wrap gap-1 text-xs mt-1 ml-11">
          {cond.descriptionParts.map((part, i) => (
            <ConditionPartDisplay key={i} part={part} />
          ))}
        </div>

        {/* Dependency / mid-action hint */}
        {cond.blocked && cond.dependencyIndexes.length > 0 ? (
          <div className="mt-1 ml-11 text-xs text-apxm-muted">
            waits on {cond.dependencyIndexes.map((i) => `#${i + 1}`).join(', ')}
          </div>
        ) : cond.party === 'self' && midActionLabels[cond.status] ? (
          <div className="mt-1 ml-11 text-xs text-apxm-muted">{midActionLabels[cond.status]}</div>
        ) : null}
      </div>

      {cond.available && (
        <button
          onClick={onFulfill}
          disabled={actionRunning}
          className={`shrink-0 min-h-touch px-3 ${btnSecondary} disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          Fulfill
        </button>
      )}
    </div>
  );
}

/**
 * Contract drill-down for the slide-up sheet: partner, timing, acceptance,
 * and the full condition list with dependency-aware states. Game actions
 * (ACCEPT / REJECT / per-condition FULFILL) run as one-tap passthroughs —
 * APXM drives the CONT buffer off-screen and clicks APEX's own control; the
 * user's tap is the commit (#73). Success needs no manual refresh: the
 * CONTRACTS_CONTRACT delta updates the store and this view re-renders.
 */
export function ContractDetailView({ contractId }: ContractDetailViewProps) {
  const contract = useContractDetail(contractId);
  const [actionRunning, setActionRunning] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // The contract vanished (store cleared on reconnect). The sheet keeps its
  // title from the payload; just say the live detail is gone.
  if (!contract) {
    return <p className="text-sm text-apxm-muted">Contract data unavailable.</p>;
  }

  async function handleAction(target: ContractActionTarget): Promise<void> {
    if (actionRunning || !contract) return;
    setActionRunning(true);
    setActionError(null);
    const result = await runContractAction(contract.localId, target);
    setActionRunning(false);
    if (!result.ok) {
      setActionError(result.error);
    }
  }

  return (
    <div className="space-y-3">
      {/* Partner */}
      <div className="text-sm text-apxm-text">
        {contract.partnerName}
        {contract.partnerCode && <span className="text-apxm-muted"> ({contract.partnerCode})</span>}
      </div>

      {/* Timing */}
      <div className="flex items-center justify-between text-xs text-apxm-text/70">
        <span>Created {formatCreated(contract.createdMs)}</span>
        <span>Due {formatDeadline(contract.dueDateMs)}</span>
      </div>

      {/* Acceptance: contract-level ACCEPT/REJECT run as one-tap passthroughs. */}
      {contract.acceptance === 'awaiting-mine' && (
        <div className="space-y-2">
          <p className="text-xs text-status-warning">Awaiting your acceptance.</p>
          <div className="flex gap-2">
            <button
              onClick={() => handleAction({ kind: 'accept' })}
              disabled={actionRunning}
              className={`flex-1 min-h-touch px-4 py-2 ${btnPrimary} disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              Accept
            </button>
            <button
              onClick={() => handleAction({ kind: 'reject' })}
              disabled={actionRunning}
              className={`flex-1 min-h-touch px-4 py-2 ${btnSecondary} disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              Reject
            </button>
          </div>
        </div>
      )}
      {contract.acceptance === 'awaiting-partner' && (
        <p className="text-xs text-apxm-muted">Awaiting partner acceptance.</p>
      )}

      {/* In-flight / error line for whichever action ran last */}
      {actionRunning && (
        <p className="text-xs text-apxm-muted animate-pulse">Working in APEX buffer...</p>
      )}
      {actionError && (
        <p className="text-xs text-status-critical">
          <span aria-hidden>! </span>
          {actionError}
        </p>
      )}

      {/* Conditions. Fulfill targets are addressed by the game-displayed
          condition number — the CONT buffer's rows carry it, and APEX renders
          (disabled) buttons even on rows APXM doesn't consider available, so
          ordinal counting would misalign. */}
      <div>
        <p className="text-[10px] uppercase tracking-wide text-apxm-text/40 mb-1">Conditions</p>
        {contract.conditions.map((cond) => (
          <ConditionBlock
            key={cond.id}
            cond={cond}
            onFulfill={() =>
              handleAction({ kind: 'fulfill', conditionNumber: cond.index + 1 })
            }
            actionRunning={actionRunning}
          />
        ))}
      </div>
    </div>
  );
}
