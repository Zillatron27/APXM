import { useState } from 'react';
import { FilterBar, type FilterOption } from '../shared';
import { ShipCard } from '../fleet';
import { useFleetDetails, type FleetFilter } from './hooks';

// UI labels for filter options
const filterLabels: Record<FleetFilter, string> = {
  all: 'ALL',
  idle: 'IDLE',
  'in-transit': 'IN TRANSIT',
};

/**
 * Full fleet view showing all ships with filtering.
 * FLEET tab content.
 */
export function FleetView() {
  const [filter, setFilter] = useState<FleetFilter>('all');
  const { ships, counts } = useFleetDetails(filter);

  // Build filter options from counts
  const filterOptions: FilterOption<FleetFilter>[] = [
    { id: 'idle', label: filterLabels.idle, count: counts.idle },
    { id: 'in-transit', label: filterLabels['in-transit'], count: counts['in-transit'] },
    { id: 'all', label: filterLabels.all, count: counts.all },
  ];

  return (
    <div className="space-y-3">
      <FilterBar options={filterOptions} active={filter} onChange={setFilter} />

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
  );
}
