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
 * One condition block. Indicator + party on the top line, the description
 * beneath, and a dependency/mid-action hint. The per-condition FULFILL action
 * is intentionally NOT rendered yet — game-state-changing commands stay hidden
 * until the CONT-buffer action passthrough is built (no dead buttons shipped).
 */
function ConditionBlock({ cond }: { cond: ContractConditionDetail }) {
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
    </div>
  );
}

/**
 * Read-only contract drill-down for the slide-up sheet: partner, timing,
 * acceptance status, and the full condition list with dependency-aware states.
 * Game actions (FULFILL / ACCEPT / REJECT) are not rendered until the
 * CONT-buffer action passthrough is built — the view ships read-only.
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

      {/* Acceptance status (informational). ACCEPT/REJECT are contract-level
          game commands — not shown until the CONT-buffer action passthrough
          exists, so no dead buttons ship. */}
      {contract.acceptance === 'awaiting-mine' && (
        <p className="text-xs text-status-warning">Awaiting your acceptance.</p>
      )}
      {contract.acceptance === 'awaiting-partner' && (
        <p className="text-xs text-apxm-muted">Awaiting partner acceptance.</p>
      )}

      {/* Conditions */}
      <div>
        <p className="text-[10px] uppercase tracking-wide text-apxm-text/40 mb-1">Conditions</p>
        {contract.conditions.map((cond) => (
          <ConditionBlock key={cond.id} cond={cond} />
        ))}
      </div>
    </div>
  );
}
