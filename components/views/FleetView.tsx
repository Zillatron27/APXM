import { useCallback, useState } from 'react';
import { FilterBar, type FilterOption, DataGate, type RequiredStore } from '../shared';
import { ShipCard } from '../fleet';
import { useFleetDetails, type FleetFilter } from './hooks';
import { useShipsStore } from '../../stores/entities/ships';

// UI labels for filter options
const filterLabels: Record<FleetFilter, string> = {
  all: 'ALL',
  idle: 'IDLE',
  'in-transit': 'IN TRANSIT',
};

// Non-ALL filter values for revert logic
const individualFilters: FleetFilter[] = ['idle', 'in-transit'];

/**
 * Full fleet view showing all ships with filtering.
 * FLEET tab content.
 */
export function FleetView() {
  const [activeFilters, setActiveFilters] = useState<Set<FleetFilter>>(new Set(['all']));
  const { ships, counts } = useFleetDetails(activeFilters);

  const handleFilterToggle = useCallback((filter: FleetFilter) => {
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

  const shipsFetched = useShipsStore((s) => s.fetched);

  const requiredStores: RequiredStore[] = [
    { fetched: shipsFetched, name: 'fleet', canFio: false },
  ];

  // Build filter options from counts
  const filterOptions: FilterOption<FleetFilter>[] = [
    { id: 'idle', label: filterLabels.idle, count: counts.idle },
    { id: 'in-transit', label: filterLabels['in-transit'], count: counts['in-transit'] },
    { id: 'all', label: filterLabels.all, count: counts.all },
  ];

  return (
    <DataGate requiredStores={requiredStores}>
      <div className="space-y-3">
        <FilterBar options={filterOptions} activeFilters={activeFilters} onChange={handleFilterToggle} />

        {ships.length === 0 ? (
          <p className="text-sm text-apxm-muted py-4 text-center">
            {counts.all === 0
              ? 'No ship data available'
              : 'No ships match the selected filter'}
          </p>
        ) : (
          <div className="space-y-2">
            {ships.map((ship) => (
              <ShipCard key={ship.id} ship={ship} defaultExpanded={false} />
            ))}
          </div>
        )}
      </div>
    </DataGate>
  );
}
