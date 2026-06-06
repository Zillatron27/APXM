import type { ReactNode } from 'react';

interface SectionHeaderProps {
  title: string;
  onViewAll?: () => void;
  /** Optional trailing element (e.g. a data-source/staleness badge). */
  accessory?: ReactNode;
}

export function SectionHeader({ title, onViewAll, accessory }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-0.5">
      <h3 className="text-sm font-semibold text-prun-yellow uppercase">{title}</h3>
      <div className="flex items-center gap-2">
        {accessory}
        {onViewAll && (
          <button
            onClick={onViewAll}
            className="text-xs text-apxm-muted hover:text-apxm-text"
          >
            View all
          </button>
        )}
      </div>
    </div>
  );
}
