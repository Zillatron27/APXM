export interface FilterOption<T extends string> {
  id: T;
  label: string;
  count: number;
}

interface FilterBarProps<T extends string> {
  options: FilterOption<T>[];
  activeFilters: ReadonlySet<T>;
  onChange: (filter: T) => void;
}

/**
 * Horizontal filter bar for views.
 * Format: LABEL (count) with active indicator.
 * Supports multi-select: tapping toggles individual filters,
 * "ALL" resets to show everything.
 * Dense display - NOT touch target sized.
 */
export function FilterBar<T extends string>({
  options,
  activeFilters,
  onChange,
}: FilterBarProps<T>) {
  return (
    <div className="flex gap-4 text-xs font-mono mb-3">
      {options.map((option) => (
        <button
          key={option.id}
          onClick={() => onChange(option.id)}
          className={`pb-1 transition-colors ${
            activeFilters.has(option.id)
              ? 'text-prun-yellow border-b border-prun-yellow'
              : 'text-apxm-text/70 hover:text-apxm-text'
          }`}
        >
          {option.label} ({option.count})
        </button>
      ))}
    </div>
  );
}
