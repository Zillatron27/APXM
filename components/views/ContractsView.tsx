import { useCallback, useState } from 'react';
import { FilterBar, type FilterOption, DataGate, type RequiredStore } from '../shared';
import { ContractCard } from '../contracts';
import { useContractDetails, type ContractFilter } from './hooks';
import { useContractsStore } from '../../stores/entities/contracts';

// UI labels for filter options
const filterLabels: Record<ContractFilter, string> = {
  all: 'ALL',
  active: 'ACTIVE',
  fulfilled: 'FULFILLED',
};

// Non-ALL filter values for revert logic
const individualFilters: ContractFilter[] = ['active', 'fulfilled'];

/**
 * Full contracts view showing all contracts with filtering.
 * CONTRACTS tab content.
 */
export function ContractsView() {
  const [activeFilters, setActiveFilters] = useState<Set<ContractFilter>>(new Set(['active']));
  const { contracts, counts } = useContractDetails(activeFilters);

  const handleFilterToggle = useCallback((filter: ContractFilter) => {
    setActiveFilters((prev) => {
      if (filter === 'all') return new Set(['all']);

      const next = new Set(prev);
      next.delete('all');

      if (next.has(filter)) {
        next.delete(filter);
      } else {
        next.add(filter);
      }

      if (next.size === 0) return new Set(['all']);
      if (individualFilters.every((f) => next.has(f))) return new Set(['all']);

      return next;
    });
  }, []);

  const contractsFetched = useContractsStore((s) => s.fetched);

  const requiredStores: RequiredStore[] = [
    { fetched: contractsFetched, name: 'contracts', canFio: false },
  ];

  // Build filter options from counts
  const filterOptions: FilterOption<ContractFilter>[] = [
    { id: 'active', label: filterLabels.active, count: counts.active },
    { id: 'fulfilled', label: filterLabels.fulfilled, count: counts.fulfilled },
    { id: 'all', label: filterLabels.all, count: counts.all },
  ];

  return (
    <DataGate requiredStores={requiredStores}>
      <div className="space-y-3">
        <FilterBar options={filterOptions} activeFilters={activeFilters} onChange={handleFilterToggle} />

        {contracts.length === 0 ? (
          <p className="text-sm text-apxm-muted py-4 text-center">
            {counts.all === 0
              ? 'No contract data available'
              : 'No contracts match the selected filter'}
          </p>
        ) : (
          <div className="space-y-2">
            {contracts.map((contract) => (
              <ContractCard
                key={contract.id}
                contract={contract}
                defaultExpanded={false}
              />
            ))}
          </div>
        )}
      </div>
    </DataGate>
  );
}
