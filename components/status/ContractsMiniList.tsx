import { useMemo } from 'react';
import { useContractsStore } from '../../stores/entities/contracts';
import { Card, SectionHeader, StateTile, type TileVariant } from '../shared';
import { useGameState } from '../../stores/gameState';
import type { PrunApi } from '../../types/prun-api';

// Active statuses that need attention
const ACTIVE_STATUSES: PrunApi.ContractStatus[] = ['OPEN', 'CLOSED', 'PARTIALLY_FULFILLED'];

// Map contract status to StateTile props (3-letter abbreviations for STATUS screen)
const statusTileConfig: Record<PrunApi.ContractStatus, { label: string; variant: TileVariant }> = {
  OPEN: { label: 'OPN', variant: 'success' },
  PARTIALLY_FULFILLED: { label: 'PAR', variant: 'warning' },
  CLOSED: { label: 'CLS', variant: 'muted' },
  FULFILLED: { label: 'FUL', variant: 'success' },
  BREACHED: { label: 'BRH', variant: 'danger' },
  DEADLINE_EXCEEDED: { label: 'LAT', variant: 'danger' },
  REJECTED: { label: 'REJ', variant: 'danger' },
  CANCELLED: { label: 'CNC', variant: 'muted' },
  TERMINATED: { label: 'TRM', variant: 'danger' },
};

interface ContractSummary {
  id: string;
  localId: string;
  partnerName: string;
  conditionType: string;
  dueDate: number | null;
  status: PrunApi.ContractStatus;
}

function getConditionTypeLabel(type: PrunApi.ContractConditionType): string {
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

function formatDeadline(dueDate: number): string {
  const now = Date.now();
  const diffMs = dueDate - now;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'Overdue';
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return '1d';
  return `${diffDays}d`;
}

function getDeadlineColor(dueDate: number | null): string {
  if (dueDate === null) return 'text-apxm-muted';
  const now = Date.now();
  const diffMs = dueDate - now;
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays < 0) return 'text-status-critical';
  if (diffDays < 3) return 'text-status-warning';
  return 'text-apxm-muted';
}

export function ContractsMiniList() {
  const { setActiveTab } = useGameState();
  const contractsLastUpdated = useContractsStore((s) => s.lastUpdated);

  const topContracts = useMemo(() => {
    const contracts = useContractsStore.getState().getAll();
    // Filter to active contracts
    const active = contracts.filter((c) => ACTIVE_STATUSES.includes(c.status));

    // Map to summaries
    const summaries: ContractSummary[] = active.map((contract) => {
      // Get first non-fulfilled condition type as representative
      const pendingCondition = contract.conditions.find(
        (c) => c.status !== 'FULFILLED'
      );

      return {
        id: contract.id,
        localId: contract.localId,
        partnerName: contract.partner.name,
        conditionType: pendingCondition
          ? getConditionTypeLabel(pendingCondition.type)
          : 'Contract',
        dueDate: contract.dueDate?.timestamp ?? null,
        status: contract.status,
      };
    });

    // Sort: OPEN first (needs attention), then by due date
    summaries.sort((a, b) => {
      // OPEN contracts first
      if (a.status === 'OPEN' && b.status !== 'OPEN') return -1;
      if (a.status !== 'OPEN' && b.status === 'OPEN') return 1;

      // Then by due date (earliest first, null last)
      const dateA = a.dueDate ?? Infinity;
      const dateB = b.dueDate ?? Infinity;
      return dateA - dateB;
    });

    return summaries.slice(0, 5);
  }, [contractsLastUpdated]);

  if (topContracts.length === 0) {
    return (
      <Card>
        <SectionHeader title="Contracts" onViewAll={() => setActiveTab('contracts')} />
        <p className="text-xs text-apxm-muted">No active contracts</p>
      </Card>
    );
  }

  return (
    <Card>
      <SectionHeader title="Contracts" onViewAll={() => setActiveTab('contracts')} />
      <div className="space-y-1">
        {topContracts.map((contract) => {
          const tileConfig = statusTileConfig[contract.status];
          return (
            <div key={contract.id} className="flex items-center justify-between min-h-touch">
              <div className="flex-1 min-w-0 mr-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-apxm-text/70">{contract.localId}</span>
                  <StateTile label={tileConfig.label} variant={tileConfig.variant} />
                </div>
                <div className="text-sm text-apxm-text truncate">{contract.partnerName}</div>
              </div>
              <span className={`text-xs whitespace-nowrap ${getDeadlineColor(contract.dueDate)}`}>
                {contract.dueDate ? formatDeadline(contract.dueDate) : '--'}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
