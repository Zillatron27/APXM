import { FilterBar, type FilterOption, DataGate, type RequiredStore } from '../shared';
import { ContractRow } from '../contracts';
import { useContractDetails, type ContractFilter } from './hooks';
import { useContractsStore } from '../../stores/entities/contracts';
import { useGameState } from '../../stores/gameState';

// UI labels for filter options
const filterLabels: Record<ContractFilter, string> = {
  all: 'ALL',
  active: 'ACTIVE',
  fulfilled: 'FULFILLED',
};

/**
 * Full contracts view showing all contracts with filtering.
 * CONTRACTS tab content.
 */
export function ContractsView() {
  // Filter selection lives in gameState so it survives tab switches
  const activeFilters = useGameState((s) => s.contractFilters);
  const toggleContractFilter = useGameState((s) => s.toggleContractFilter);
  const { contracts, counts } = useContractDetails(activeFilters);

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
        <FilterBar options={filterOptions} activeFilters={activeFilters} onChange={toggleContractFilter} />

        {contracts.length === 0 ? (
          <p className="text-sm text-apxm-muted py-4 text-center">
            {counts.all === 0
              ? 'No contract data available'
              : 'No contracts match the selected filter'}
          </p>
        ) : (
          <div className="space-y-2">
            {contracts.map((contract) => (
              <ContractRow key={contract.id} contract={contract} />
            ))}
          </div>
        )}
      </div>
    </DataGate>
  );
}
