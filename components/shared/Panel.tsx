import type { ReactNode } from 'react';

interface PanelProps {
  /** Titlebar label, e.g. "BASES". Rendered uppercase mono in the highlight colour. */
  title: string;
  /** Optional dim buffer-code suffix, e.g. "BS". */
  code?: string;
  /** Optional "view all" drill action, rendered as a mono link at the titlebar's right. */
  onViewAll?: () => void;
  /** Optional drag handle, rendered at the titlebar's right edge (Status tab only). */
  handle?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Body padding override; defaults to the standard panel inset. */
  bodyClassName?: string;
}

/**
 * Window panel — the Retro Terminal screen-style container: square corners, a
 * 1px border, and a titlebar bar carrying a mono highlight label plus an
 * optional dim buffer-code suffix. Used on the Status tab, where the titlebar
 * also hosts the drag handle for panel reordering. The blueprint-bracket `Card`
 * stays in use on the other screens.
 */
export function Panel({
  title,
  code,
  onViewAll,
  handle,
  children,
  className = '',
  bodyClassName = 'p-3',
}: PanelProps) {
  return (
    <div className={`border border-apxm-accent bg-apxm-surface ${className}`}>
      <div className="flex items-center gap-2 h-9 px-3 bg-apxm-accent/40 border-b border-apxm-accent">
        <span className="font-mono text-[13px] font-bold tracking-wider uppercase text-prun-yellow leading-none">
          {title}
        </span>
        {code && (
          <span className="font-mono text-[10px] tracking-wider uppercase text-prun-yellow/50 leading-none">
            {code}
          </span>
        )}
        <div className="flex-1" />
        {onViewAll && (
          <button
            onClick={onViewAll}
            className="font-mono text-[10px] tracking-wider uppercase text-apxm-muted hover:text-apxm-text px-1"
          >
            View&nbsp;all
          </button>
        )}
        {handle}
      </div>
      <div className={bodyClassName}>{children}</div>
    </div>
  );
}
