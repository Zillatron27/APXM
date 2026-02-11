import { useMemo } from 'react';
import { useContractsStore } from '../../../stores/entities/contracts';
import type { PrunApi } from '../../../types/prun-api';

export type ContractFilter = 'all' | 'active' | 'fulfilled';

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
  party: 'self' | 'partner';
  partnerName: string;
  type: string;
  description: string;
  descriptionParts: ConditionPart[];
  fulfilled: boolean;
  breached: boolean;
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

    const details: ContractDetail[] = contracts.map((contract) => {
      const conditions: ContractConditionDetail[] = contract.conditions.map((cond) => {
        const { description, parts } = buildConditionDescription(cond);
        return {
          index: cond.index,
          party: cond.party === contract.party ? 'self' : 'partner',
          partnerName: contract.partner.name,
          type: formatConditionType(cond.type),
          description,
          descriptionParts: parts,
          fulfilled: cond.status === 'FULFILLED',
          breached: cond.status === 'VIOLATED',
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
      };
    });

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
