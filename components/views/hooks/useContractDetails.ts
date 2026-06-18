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

/**
 * Whose acceptance an OPEN contract is waiting on, or null once it's been
 * accepted (or is otherwise not awaiting acceptance). 'awaiting-mine' means
 * the action is yours: ACCEPT or REJECT. Mirrors rPrun's canAcceptContract /
 * canPartnerAcceptContract.
 */
export type ContractAcceptance = 'awaiting-mine' | 'awaiting-partner' | null;

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
  /** Any condition is `available` — drives a future filter ("contracts to fulfil"). */
  actionable: boolean;
  /**
   * Whose acceptance is pending (OPEN). 'awaiting-mine' → you can ACCEPT/REJECT.
   * null once accepted/terminal.
   */
  acceptance: ContractAcceptance;
  /** Accepted & active (CLOSED / PARTIALLY_FULFILLED): conditions are fulfillable. */
  accepted: boolean;
  /** Faction/agent contract (partner carries a countryCode). */
  isFaction: boolean;
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
 * Statuses where the contract has been accepted and is being worked — its
 * conditions are fulfillable. Distinct from ACTIVE_STATUSES (which also
 * includes OPEN, i.e. awaiting acceptance) and from the "shown in the ACTIVE
 * tab" set. Mirrors the rPrun rule that OPEN means awaiting acceptance, not
 * in-progress.
 */
const ACCEPTED_STATUSES: PrunApi.ContractStatus[] = ['CLOSED', 'PARTIALLY_FULFILLED'];

/** Accepted & active: conditions can be fulfilled. */
function isContractAccepted(contract: PrunApi.Contract): boolean {
  return ACCEPTED_STATUSES.includes(contract.status);
}

/**
 * Whose acceptance an OPEN contract is waiting on. Ported verbatim from rPrun's
 * canAcceptContract / canPartnerAcceptContract: you accept the contracts where
 * you are the CUSTOMER; the partner accepts the ones where you are the PROVIDER.
 */
function deriveAcceptance(contract: PrunApi.Contract): ContractAcceptance {
  if (contract.status !== 'OPEN') return null;
  if (contract.party === 'CUSTOMER') return 'awaiting-mine';
  return 'awaiting-partner'; // party === 'PROVIDER'
}

/** Faction/agent contract — rPrun's isFactionContract (partner has a countryCode). */
function isFactionContract(contract: PrunApi.Contract): boolean {
  return !!contract.partner.countryCode;
}

/**
 * A self condition is "available" (ready to fulfil now) only once the contract
 * is accepted, the condition is still PENDING, and every dependency is
 * FULFILLED. A fresh OPEN contract is NOT fulfillable — its action is ACCEPT —
 * so the accepted gate excludes it (and all terminal states). Dependency ids
 * that don't resolve in `byId` count as not-fulfilled (fail-safe, enforced by
 * the `=== 'FULFILLED'` check).
 */
function isAvailable(
  cond: PrunApi.ContractCondition,
  contract: PrunApi.Contract,
  byId: Map<string, PrunApi.ContractCondition>,
): boolean {
  if (!isContractAccepted(contract)) return false; // not accepted → accept first, can't fulfil
  if (cond.party !== contract.party) return false; // not yours
  if (cond.status !== 'PENDING') return false; // already moving / done / failed
  return cond.dependencies.every((depId) => byId.get(depId)?.status === 'FULFILLED');
}

/**
 * A self condition is "blocked" when the contract is accepted, the condition is
 * not yet fulfilled, and at least one dependency is not FULFILLED. An
 * unresolvable dependency id counts as blocking (`?.status !== 'FULFILLED'` is
 * true for `undefined`).
 */
function isBlocked(
  cond: PrunApi.ContractCondition,
  contract: PrunApi.Contract,
  byId: Map<string, PrunApi.ContractCondition>,
): boolean {
  if (!isContractAccepted(contract)) return false; // not accepted → nothing to block yet
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
    acceptance: deriveAcceptance(contract),
    accepted: isContractAccepted(contract),
    isFaction: isFactionContract(contract),
  };
}

/**
 * A single contract's detail for the drill-down sheet, or null if the contract
 * is gone (e.g. store cleared on reconnect — the sheet should then close
 * itself). Mirrors useShipDetail.
 */
export function useContractDetail(contractId: string): ContractDetail | null {
  const contractsLastUpdated = useContractsStore((s) => s.lastUpdated);

  return useMemo(() => {
    const contract = useContractsStore.getState().getById(contractId);
    return contract ? buildContractDetail(contract) : null;
    // contractsLastUpdated re-derives when the contract's data changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractId, contractsLastUpdated]);
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
