interface SectionHeaderProps {
  title: string;
  onViewAll?: () => void;
}

export function SectionHeader({ title, onViewAll }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-0.5">
      <h3 className="text-sm font-semibold text-prun-yellow uppercase">{title}</h3>
      {onViewAll && (
        <button
          onClick={onViewAll}
          className="text-xs text-apxm-muted hover:text-apxm-text min-h-touch flex items-center"
        >
          View all
        </button>
      )}
    </div>
  );
}
