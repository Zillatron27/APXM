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
  /** When set, the titlebar gains a chevron that toggles the body via onToggleCollapse. */
  collapsible?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  /** Optional titlebar summary (e.g. a collapsed-state count), right-aligned. */
  summary?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Body padding override; defaults to the standard panel inset. */
  bodyClassName?: string;
}

/**
 * Window panel — the Retro Terminal screen-style container: square corners, a
 * 1px border, and a titlebar bar carrying a mono highlight label plus an
 * optional dim buffer-code suffix. The single container used across every
 * screen; on the Status tab the titlebar also hosts the drag handle for panel
 * reordering. (Superseded the blueprint-bracket Card, now retired.)
 */
export function Panel({
  title,
  code,
  onViewAll,
  handle,
  collapsible = false,
  collapsed = false,
  onToggleCollapse,
  summary,
  children,
  className = '',
  bodyClassName = 'p-3',
}: PanelProps) {
  return (
    <div className={`border border-apxm-accent bg-apxm-surface ${className}`}>
      <div
        className={`flex items-center gap-2 h-9 px-3 bg-apxm-accent/40 border-b ${
          collapsible && collapsed ? 'border-transparent' : 'border-apxm-accent'
        }`}
      >
        {collapsible && (
          <button
            onClick={onToggleCollapse}
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Expand panel' : 'Collapse panel'}
            className="-ml-1 px-1 text-apxm-muted hover:text-apxm-text leading-none"
          >
            <span aria-hidden className="text-xs">{collapsed ? '▶' : '▼'}</span>
          </button>
        )}
        <span className="font-mono text-[13px] font-bold tracking-wider uppercase text-prun-yellow leading-none">
          {title}
        </span>
        {code && (
          <span className="font-mono text-[10px] tracking-wider uppercase text-prun-yellow/50 leading-none">
            {code}
          </span>
        )}
        <div className="flex-1" />
        {summary && (
          <span className="font-mono text-[10px] tracking-wide uppercase text-apxm-muted leading-none">
            {summary}
          </span>
        )}
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
      {collapsible ? (
        // grid-rows 0fr→1fr animates to natural height (height:auto isn't
        // transitionable); the visible titlebar anchors, body grows downward.
        <div
          className={`grid transition-[grid-template-rows] duration-150 ease-out motion-reduce:transition-none ${
            collapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]'
          }`}
        >
          <div className="overflow-hidden">
            <div className={bodyClassName}>{children}</div>
          </div>
        </div>
      ) : (
        <div className={bodyClassName}>{children}</div>
      )}
    </div>
  );
}
