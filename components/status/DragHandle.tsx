import type { CSSProperties, PointerEventHandler } from 'react';

interface DragHandleProps {
  onPointerDown: PointerEventHandler;
  onPointerMove: PointerEventHandler;
  onPointerUp: PointerEventHandler;
  onPointerCancel: PointerEventHandler;
  style: CSSProperties;
}

/**
 * Titlebar drag affordance for reordering Status panels (the ☰ glyph from the
 * style guide). Lives in the Panel's `handle` slot; all pointer wiring comes
 * from useStatusReorder via getHandleProps.
 */
export function DragHandle(props: DragHandleProps) {
  return (
    <button
      type="button"
      aria-label="Drag to reorder panel"
      className="flex items-center justify-center h-9 px-2 -mr-1 leading-none text-apxm-muted hover:text-apxm-text cursor-grab active:cursor-grabbing select-none"
      {...props}
    >
      <span aria-hidden className="text-base">☰</span>
    </button>
  );
}
