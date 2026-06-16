import { useMemo } from 'react';
import { useContractsStore } from '../../../stores/entities/contracts';
import type { PrunApi } from '../../../types/prun-api';

import type { ContractFilter } from '../../../stores/gameState';

export type { ContractFilter };

// Contract statuses considered "active" (need attention)
const ACTIVE_STATUSES: PrunApi.ContractStatus[] = ['OPEN', 'CLOSED', 'PARTIALLY_FULFILLED'];

// Contract statuses considered "fulfilled/done"
const FULFILLED_STATUSES: PrunApi.ContractStatus[] = ['FULFILLED'];

export type ContractStateLabel = 'open' | 'partial' | 'closed' | 'fulfilled' | 'breached' | 'rejected';

export interface ConditionPart {
  type: 'text' | 'material' | 'amount' | 'destination';
  value: string;
  category?: string;
}

export interface ContractConditionDetail {
  index: number;
  id: string;
  party: 'self' | 'partner';
  partnerName: string;
  type: string;
  description: string;
  descriptionParts: ConditionPart[];
  /** Full wire status, the source of truth for all derived flags below. */
  status: PrunApi.ContractConditionStatus;
  /** Convenience: status === 'FULFILLED'. */
  fulfilled: boolean;
  /**
   * Convenience: status === 'VIOLATED'. This is the *condition* failing —
   * distinct from the contract-level BREACHED/DEADLINE_EXCEEDED status
   * (which drives the card's `stateLabel`). A condition is never BREACHED;
   * its failure value is VIOLATED.
   */
  breached: boolean;
  /** Self ∧ PENDING ∧ every dependency FULFILLED — your move now. */
  available: boolean;
  /** Self ∧ not-fulfilled ∧ some dependency not yet FULFILLED — waiting. */
  blocked: boolean;
  /** Resolved dependency ids → their 0-based condition index (card renders +1). */
  dependencyIndexes: number[];
  deadline: string | null;
}

export interface ContractDetail {
  id: string;
  localId: string;
  partnerName: string;
  partnerCode: string | null;
  status: PrunApi.ContractStatus;
  stateLabel: ContractStateLabel;
  dueDateMs: number | null;
  createdMs: number;
  conditions: ContractConditionDetail[];
  /** Any condition is `available` — drives the future "your move" pill / filter. */
  actionable: boolean;
}

/**
 * Maps contract status to display label.
 */
function getStateLabel(status: PrunApi.ContractStatus): ContractStateLabel {
  switch (status) {
    case 'OPEN':
      return 'open';
    case 'PARTIALLY_FULFILLED':
      return 'partial';
    case 'CLOSED':
      return 'closed';
    case 'FULFILLED':
      return 'fulfilled';
    case 'BREACHED':
    case 'DEADLINE_EXCEEDED':
      return 'breached';
    case 'REJECTED':
    case 'CANCELLED':
    case 'TERMINATED':
      return 'rejected';
    default:
      return 'closed';
  }
}

/**
 * Formats a condition type to human-readable string.
 */
function formatConditionType(type: PrunApi.ContractConditionType): string {
  const labels: Partial<Record<PrunApi.ContractConditionType, string>> = {
    DELIVERY: 'Delivery',
    DELIVERY_SHIPMENT: 'Shipment',
    PAYMENT: 'Payment',
    PROVISION: 'Provision',
    PICKUP_SHIPMENT: 'Pickup',
    PRODUCTION_RUN: 'Production',
    LOAN_INSTALLMENT: 'Loan',
    FINISH_FLIGHT: 'Flight',
  };
  return labels[type] ?? type.toLowerCase().replace(/_/g, ' ');
}

interface ConditionDescriptionResult {
  description: string;
  parts: ConditionPart[];
}

/**
 * Builds a description string and structured parts for a condition.
 */
function buildConditionDescription(condition: PrunApi.ContractCondition): ConditionDescriptionResult {
  const type = formatConditionType(condition.type);
  const parts: ConditionPart[] = [];

  // Payment condition
  if (condition.amount) {
    const description = `${type} ${condition.amount.amount.toLocaleString()} ${condition.amount.currency}`;
    parts.push({ type: 'text', value: type });
    parts.push({ type: 'amount', value: `${condition.amount.amount.toLocaleString()} ${condition.amount.currency}` });
    return { description, parts };
  }

  // Delivery condition with material
  if (condition.quantity) {
    const ticker = condition.quantity.material.ticker;
    const category = condition.quantity.material.category;
    const amount = condition.quantity.amount;

    parts.push({ type: 'text', value: type });
    parts.push({ type: 'material', value: ticker, category });
    parts.push({ type: 'amount', value: String(amount) });

    let dest = '';
    if (condition.destination) {
      for (const line of condition.destination.lines) {
        if ((line.type === 'PLANET' || line.type === 'STATION') && line.entity) {
          dest = line.entity.name || line.entity.naturalId;
          parts.push({ type: 'destination', value: dest });
          break;
        }
      }
    }

    const description = `${type} [${ticker}] ${amount}${dest ? ` → ${dest}` : ''}`;
    return { description, parts };
  }

  parts.push({ type: 'text', value: type });
  return { description: type, parts };
}

/**
 * Formats relative time for deadline/creation.
 */
function formatRelativeTime(ms: number): string {
  const now = Date.now();
  const diffMs = ms - now;
  const absMs = Math.abs(diffMs);

  const hours = Math.floor(absMs / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;

  let text: string;
  if (days === 0) {
    text = hours < 1 ? '<1h' : `${hours}h`;
  } else if (days < 7 && remainingHours > 0) {
    text = `${days}d ${remainingHours}h`;
  } else {
    text = `${days}d`;
  }

  return diffMs < 0 ? `${text} ago` : text;
}

/**
 * A self condition is "available" (ready to action now) when it is still
 * PENDING and every condition it depends on is FULFILLED. Dependency ids that
 * don't resolve in `byId` are treated as not-fulfilled (fail-safe — we never
 * mark a condition actionable off a dependency we can't see), which the
 * `=== 'FULFILLED'` check enforces.
 */
function isAvailable(
  cond: PrunApi.ContractCondition,
  contract: PrunApi.Contract,
  byId: Map<string, PrunApi.ContractCondition>,
): boolean {
  if (cond.party !== contract.party) return false; // not yours
  if (cond.status !== 'PENDING') return false; // already moving / done / failed
  return cond.dependencies.every((depId) => byId.get(depId)?.status === 'FULFILLED');
}

/**
 * A self condition is "blocked" when it is not yet fulfilled and at least one
 * dependency is not FULFILLED. An unresolvable dependency id counts as blocking
 * (`?.status !== 'FULFILLED'` is true for `undefined`).
 */
function isBlocked(
  cond: PrunApi.ContractCondition,
  contract: PrunApi.Contract,
  byId: Map<string, PrunApi.ContractCondition>,
): boolean {
  if (cond.party !== contract.party) return false;
  if (cond.status === 'FULFILLED') return false;
  return cond.dependencies.some((depId) => byId.get(depId)?.status !== 'FULFILLED');
}

/**
 * Pure assembly of a single contract's display detail, including the derived
 * dependency-aware condition flags. Kept separate from the hook so it is
 * testable without a React renderer or store population.
 */
export function buildContractDetail(contract: PrunApi.Contract): ContractDetail {
  const byId = new Map(contract.conditions.map((c) => [c.id, c]));

  const conditions: ContractConditionDetail[] = contract.conditions.map((cond) => {
    const { description, parts } = buildConditionDescription(cond);
    return {
      index: cond.index,
      id: cond.id,
      party: cond.party === contract.party ? 'self' : 'partner',
      partnerName: contract.partner.name,
      type: formatConditionType(cond.type),
      description,
      descriptionParts: parts,
      status: cond.status,
      fulfilled: cond.status === 'FULFILLED',
      breached: cond.status === 'VIOLATED',
      available: isAvailable(cond, contract, byId),
      blocked: isBlocked(cond, contract, byId),
      dependencyIndexes: cond.dependencies
        .map((depId) => byId.get(depId)?.index)
        .filter((idx): idx is number => idx !== undefined),
      deadline: cond.deadline ? formatRelativeTime(cond.deadline.timestamp) : null,
    };
  });

  // Sort conditions by index
  conditions.sort((a, b) => a.index - b.index);

  return {
    id: contract.id,
    localId: contract.localId,
    partnerName: contract.partner.name,
    partnerCode: contract.partner.code ?? null,
    status: contract.status,
    stateLabel: getStateLabel(contract.status),
    dueDateMs: contract.dueDate?.timestamp ?? null,
    createdMs: contract.date.timestamp,
    conditions,
    actionable: conditions.some((c) => c.available),
  };
}

export interface ContractDetailsResult {
  contracts: ContractDetail[];
  counts: Record<ContractFilter, number>;
}

/**
 * Hook that assembles contract details with conditions.
 */
export function useContractDetails(activeFilters: ReadonlySet<ContractFilter>): ContractDetailsResult {
  const contractsLastUpdated = useContractsStore((s) => s.lastUpdated);

  return useMemo(() => {
    const contracts = useContractsStore.getState().getAll();

    const details: ContractDetail[] = contracts.map(buildContractDetail);

    // Sort: OPEN first, then by due date
    details.sort((a, b) => {
      if (a.status === 'OPEN' && b.status !== 'OPEN') return -1;
      if (a.status !== 'OPEN' && b.status === 'OPEN') return 1;

      const dateA = a.dueDateMs ?? Infinity;
      const dateB = b.dueDateMs ?? Infinity;
      return dateA - dateB;
    });

    // Count by filter category
    const activeCount = details.filter((c) => ACTIVE_STATUSES.includes(c.status)).length;
    const fulfilledCount = details.filter((c) => FULFILLED_STATUSES.includes(c.status)).length;

    const counts: Record<ContractFilter, number> = {
      all: details.length,
      active: activeCount,
      fulfilled: fulfilledCount,
    };

    // Apply filter
    const filtered = activeFilters.has('all')
      ? details
      : details.filter((c) => {
          if (activeFilters.has('active') && ACTIVE_STATUSES.includes(c.status)) return true;
          if (activeFilters.has('fulfilled') && FULFILLED_STATUSES.includes(c.status)) return true;
          return false;
        });

    return { contracts: filtered, counts };
  }, [contractsLastUpdated, activeFilters]);
}
