import {
  useCallback,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { applyReorder } from './reorder-utils';

interface DragState {
  id: string;
  /** Index of the dragged panel in the order at drag start (order is stable
   *  during a drag — we only commit on release). */
  fromIndex: number;
  /** Live vertical offset applied to the dragged panel so it tracks the finger. */
  dy: number;
  /** Insertion slot (0..length) in the visible list under the pointer. */
  insertAt: number;
}

/**
 * Hand-rolled vertical drag-reorder for the Status panels. Touch-first, no
 * dependency. Drag starts only on the panel's titlebar handle (which sets
 * `touch-action: none`), so list scrolling elsewhere is unaffected. Sibling
 * centres are measured once at drag start, so the dragged panel just tracks the
 * finger and the target slot is derived from the static geometry — no
 * re-measuring or live array churn. The order is committed once, on release.
 */
export function useStatusReorder(order: string[], onCommit: (next: string[]) => void) {
  const itemEls = useRef(new Map<string, HTMLElement>());
  const centers = useRef<number[]>([]);
  const [drag, setDrag] = useState<DragState | null>(null);

  const setItemRef = useCallback(
    (id: string) => (el: HTMLElement | null) => {
      if (el) itemEls.current.set(id, el);
      else itemEls.current.delete(id);
    },
    []
  );

  const onPointerDown = (id: string) => (e: ReactPointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const fromIndex = order.indexOf(id);
    centers.current = order.map((pid) => {
      const r = itemEls.current.get(pid)?.getBoundingClientRect();
      return r ? r.top + r.height / 2 : 0;
    });
    setDrag({ id, fromIndex, dy: 0, insertAt: fromIndex });
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    const y = e.clientY;
    setDrag((d) => {
      if (!d) return d;
      let insertAt = 0;
      for (let i = 0; i < centers.current.length; i++) {
        if (y > centers.current[i]) insertAt = i + 1;
      }
      return { ...d, dy: y - centers.current[d.fromIndex], insertAt };
    });
  };

  const end = (e: ReactPointerEvent) => {
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    setDrag((d) => {
      if (d) {
        const next = applyReorder(order, d.fromIndex, d.insertAt);
        if (next !== order) onCommit(next);
      }
      return null;
    });
  };

  const getHandleProps = (id: string) => ({
    onPointerDown: onPointerDown(id),
    onPointerMove,
    onPointerUp: end,
    onPointerCancel: end,
    style: { touchAction: 'none' as const },
  });

  const itemStyle = (id: string): CSSProperties =>
    drag?.id === id
      ? { transform: `translateY(${drag.dy}px)`, position: 'relative', zIndex: 50 }
      : {};

  /** A real move target between visible indices — not the dragged panel's own
   *  current slot (insertAt === fromIndex or fromIndex + 1 are no-ops). */
  const showLineAt = (visibleIndex: number): boolean =>
    drag !== null &&
    drag.insertAt === visibleIndex &&
    visibleIndex !== drag.fromIndex &&
    visibleIndex !== drag.fromIndex + 1;

  return { setItemRef, getHandleProps, itemStyle, showLineAt, draggingId: drag?.id ?? null };
}
