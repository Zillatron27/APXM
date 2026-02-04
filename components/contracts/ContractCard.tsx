import { useState } from 'react';
import { StateTile, type TileVariant } from '../shared';
import type { ContractDetail, ContractStateLabel } from '../views/hooks';

interface ContractCardProps {
  contract: ContractDetail;
  defaultExpanded?: boolean;
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

// Display labels for states (lowercase full words for CONTRACTS screen)
const stateDisplayLabels: Record<ContractStateLabel, string> = {
  open: 'open',
  partial: 'partial',
  closed: 'closed',
  fulfilled: 'fulfilled',
  breached: 'breached',
  rejected: 'rejected',
};

/**
 * Formats time remaining to deadline.
 */
function formatDeadline(dueDateMs: number | null): string {
  if (!dueDateMs) return '--';
  const now = Date.now();
  const diffMs = dueDateMs - now;

  if (diffMs < 0) return 'Overdue';

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;

  if (days === 0) {
    return hours < 1 ? '<1h' : `${hours}h`;
  }
  if (days < 7 && remainingHours > 0) {
    return `${days}d ${remainingHours}h`;
  }
  return `${days}d`;
}

/**
 * Formats creation time as relative.
 */
function formatCreated(createdMs: number): string {
  const now = Date.now();
  const diffMs = now - createdMs;
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (days === 0) {
    return hours < 1 ? '<1h ago' : `${hours}h ago`;
  }
  return `${days}d ago`;
}

/**
 * Collapsible card showing contract status and conditions.
 * Collapsed: two lines - code + status + deadline, partner name
 * Expanded: partner details, created/due, condition list
 */
export function ContractCard({ contract, defaultExpanded = false }: ContractCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const deadlineText = formatDeadline(contract.dueDateMs);
  const deadlineColor =
    contract.dueDateMs && contract.dueDateMs - Date.now() < 3 * 24 * 60 * 60 * 1000
      ? 'text-status-warning'
      : 'text-apxm-text/70';

  return (
    <div className="bg-apxm-surface overflow-hidden">
      {/* Header - clickable, two lines */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-3 text-left hover:bg-apxm-accent/30 min-h-[44px]"
      >
        {/* Line 1: Code, State, Deadline */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {/* Expand/collapse indicator */}
            <span className="text-apxm-text/50 text-xs w-4 shrink-0">
              {expanded ? '▼' : '▶'}
            </span>

            {/* Contract code */}
            <span className="font-mono text-sm text-apxm-text">
              {contract.localId}
            </span>

            {/* State tile */}
            <StateTile
              label={stateDisplayLabels[contract.stateLabel]}
              variant={stateVariants[contract.stateLabel]}
            />
          </div>

          {/* Deadline */}
          <span className={`text-xs font-mono ${deadlineColor}`}>
            {deadlineText}
          </span>
        </div>

        {/* Line 2: Partner name */}
        <div className="ml-6 mt-1 text-xs text-apxm-text/70 truncate">
          {contract.partnerName}
          {contract.partnerCode && (
            <span className="text-apxm-muted"> ({contract.partnerCode})</span>
          )}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-3 pb-3 border-t border-apxm-bg">
          {/* Meta info */}
          <div className="flex justify-between text-xs text-apxm-text/70 py-2">
            <span>Created: {formatCreated(contract.createdMs)}</span>
            <span>Due: {deadlineText}</span>
          </div>

          {/* Conditions list */}
          <div className="space-y-1.5">
            {contract.conditions.map((cond) => (
              <div
                key={cond.index}
                className="flex items-start gap-2 text-xs"
              >
                {/* Index prefix */}
                <span className="shrink-0 w-5 text-apxm-muted font-mono">
                  #{cond.index + 1}
                </span>

                {/* Condition indicator */}
                <span
                  className={`shrink-0 w-4 text-center ${
                    cond.breached
                      ? 'text-status-critical'
                      : cond.fulfilled
                        ? 'text-status-ok'
                        : 'text-apxm-muted'
                  }`}
                >
                  {cond.breached ? '!' : cond.fulfilled ? '✓' : '✗'}
                </span>

                {/* Party indicator (company name for partner, Self for self) */}
                <span
                  className={`shrink-0 w-20 truncate ${
                    cond.party === 'self' ? 'text-apxm-text' : 'text-apxm-muted'
                  }`}
                >
                  {cond.party === 'self' ? 'Self' : cond.partnerName}
                </span>

                {/* Description */}
                <span className="flex-1 text-apxm-text/70 truncate">
                  {cond.description}
                </span>

                {/* Deadline if not fulfilled */}
                {!cond.fulfilled && cond.deadline && (
                  <span className="shrink-0 text-apxm-muted">
                    {cond.deadline}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
