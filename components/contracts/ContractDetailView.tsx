import { MaterialTile } from '../shared';
import { useContractDetail, type ConditionPart, type ContractConditionDetail } from '../views/hooks';
import { formatCreated, formatDeadline } from './format';

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

/**
 * One condition block. Left column: indicator + party on the top line, the
 * description beneath, and a dependency/mid-action hint. Right column ("Cmds",
 * mirroring rPrun): a small FULFILL button on self conditions — accent when the
 * condition is actionable now, muted when it's still blocked. The button is a
 * disabled placeholder: the layout is real but the buffer action is the
 * deferred next piece (blocked on the live APEX CONT buffer DOM) and APXM never
 * commits a game action without explicit human authorisation.
 */
function ConditionBlock({ cond, accepted }: { cond: ContractConditionDetail; accepted: boolean }) {
  const glyph = cond.breached ? '!' : cond.fulfilled ? '✓' : cond.available ? '●' : '✗';
  const glyphColor = cond.breached
    ? 'text-status-critical'
    : cond.fulfilled
      ? 'text-status-ok'
      : cond.available
        ? 'text-status-warning'
        : 'text-apxm-muted';

  // FULFILL is a self-condition command (you can't fulfil the partner's
  // obligations), and only once the contract is accepted — an unaccepted OPEN
  // contract's action is ACCEPT, not fulfil. Hidden once done or violated.
  const showFulfill = accepted && cond.party === 'self' && !cond.fulfilled && !cond.breached;

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

      {/* Cmds column: FULFILL (disabled placeholder until buffer wiring) */}
      {showFulfill && (
        <button
          type="button"
          disabled
          aria-label="Fulfil this condition (coming soon)"
          className={`shrink-0 min-h-touch px-3 text-xs font-mono uppercase tracking-wide rounded border cursor-not-allowed ${
            cond.available
              ? 'border-status-warning/50 text-status-warning/70'
              : 'border-apxm-muted/30 text-apxm-muted/50'
          }`}
        >
          Fulfill
        </button>
      )}
    </div>
  );
}

/**
 * Read-only contract drill-down for the slide-up sheet: partner, timing, and
 * the full condition list with dependency-aware states. The FULFILL action on
 * available conditions is a disabled placeholder pending the CONT buffer work.
 */
export function ContractDetailView({ contractId }: ContractDetailViewProps) {
  const contract = useContractDetail(contractId);

  // The contract vanished (store cleared on reconnect). The sheet keeps its
  // title from the payload; just say the live detail is gone.
  if (!contract) {
    return <p className="text-sm text-apxm-muted">Contract data unavailable.</p>;
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

      {/* Acceptance: a contract is accepted before its conditions can be
          fulfilled. ACCEPT/REJECT are contract-level commands; disabled
          placeholders for now (wiring deferred to the CONT buffer piece). */}
      {contract.acceptance === 'awaiting-mine' && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled
            aria-label="Accept this contract (coming soon)"
            className="min-h-touch flex-1 text-xs font-mono uppercase tracking-wide rounded border border-status-warning/50 text-status-warning/70 cursor-not-allowed"
          >
            Accept
          </button>
          <button
            type="button"
            disabled
            aria-label="Reject this contract (coming soon)"
            className="min-h-touch flex-1 text-xs font-mono uppercase tracking-wide rounded border border-status-critical/40 text-status-critical/60 cursor-not-allowed"
          >
            Reject
          </button>
        </div>
      )}
      {contract.acceptance === 'awaiting-partner' && (
        <p className="text-xs text-apxm-muted">Awaiting partner acceptance.</p>
      )}

      {/* Conditions */}
      <div>
        <p className="text-[10px] uppercase tracking-wide text-apxm-text/40 mb-1">Conditions</p>
        {contract.conditions.map((cond) => (
          <ConditionBlock key={cond.id} cond={cond} accepted={contract.accepted} />
        ))}
      </div>
    </div>
  );
}
