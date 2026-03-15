/**
 * Panel Drag & Resize Utilities
 *
 * Shared pointer-event based drag and vertical resize for floating panels.
 */

const EDGE_MARGIN = 10;
const MIN_VISIBLE_HEIGHT = 80; // at least header + resize handle visible

export interface DragOptions {
  onDragEnd?(x: number, y: number): void;
}

/**
 * Ensures a panel + body fit within the viewport.
 * Adjusts body height if the panel extends past the bottom edge.
 * Clamps panel position to stay within visible area.
 */
export function constrainToViewport(panelEl: HTMLElement, bodyEl: HTMLElement): void {
  const rect = panelEl.getBoundingClientRect();

  // Clamp position
  if (rect.top < EDGE_MARGIN) {
    panelEl.style.top = `${EDGE_MARGIN}px`;
  }
  if (rect.left < EDGE_MARGIN) {
    panelEl.style.left = `${EDGE_MARGIN}px`;
  }
  const maxLeft = window.innerWidth - panelEl.offsetWidth - EDGE_MARGIN;
  if (rect.left > maxLeft) {
    panelEl.style.left = `${Math.max(EDGE_MARGIN, maxLeft)}px`;
  }

  // Clamp body height so panel fits in viewport
  const freshRect = panelEl.getBoundingClientRect();
  const nonBodyHeight = freshRect.height - bodyEl.offsetHeight;
  const maxBodyHeight = window.innerHeight - freshRect.top - nonBodyHeight - EDGE_MARGIN;
  if (bodyEl.offsetHeight > maxBodyHeight && maxBodyHeight > 100) {
    bodyEl.style.height = `${Math.floor(maxBodyHeight)}px`;
  }
}

/**
 * Makes a panel draggable by its header handle.
 * Returns a cleanup function to remove all listeners.
 */
export function makeDraggable(
  panelEl: HTMLElement,
  handleEl: HTMLElement,
  opts?: DragOptions,
): () => void {
  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;

  function onPointerDown(e: PointerEvent): void {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button')) return;

    const rect = panelEl.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    dragging = true;

    handleEl.setPointerCapture(e.pointerId);
    handleEl.style.cursor = 'grabbing';
    panelEl.style.userSelect = 'none';
    e.preventDefault();
  }

  function onPointerMove(e: PointerEvent): void {
    if (!dragging) return;

    const maxX = window.innerWidth - panelEl.offsetWidth - EDGE_MARGIN;
    const maxY = window.innerHeight - panelEl.offsetHeight - EDGE_MARGIN;

    const x = Math.max(EDGE_MARGIN, Math.min(e.clientX - offsetX, maxX));
    const y = Math.max(EDGE_MARGIN, Math.min(e.clientY - offsetY, maxY));

    panelEl.style.left = `${x}px`;
    panelEl.style.top = `${y}px`;
  }

  function onPointerUp(): void {
    if (!dragging) return;
    dragging = false;
    handleEl.style.cursor = '';
    panelEl.style.userSelect = '';

    if (opts?.onDragEnd) {
      opts.onDragEnd(panelEl.offsetLeft, panelEl.offsetTop);
    }
  }

  handleEl.addEventListener('pointerdown', onPointerDown);
  handleEl.addEventListener('pointermove', onPointerMove);
  handleEl.addEventListener('pointerup', onPointerUp);

  return () => {
    handleEl.removeEventListener('pointerdown', onPointerDown);
    handleEl.removeEventListener('pointermove', onPointerMove);
    handleEl.removeEventListener('pointerup', onPointerUp);
  };
}

export interface ResizeOptions {
  minHeight?: number;
  onResizeEnd?(height: number): void;
}

/**
 * Adds a vertical resize handle to the bottom of a panel.
 * Resizes the body element's height. Returns cleanup function.
 */
export function makeResizable(
  panelEl: HTMLElement,
  bodyEl: HTMLElement,
  opts?: ResizeOptions,
): () => void {
  const minH = opts?.minHeight ?? 200;

  const handle = document.createElement('div');
  handle.className = 'panel-resize-handle';
  panelEl.appendChild(handle);

  let resizing = false;
  let startY = 0;
  let startHeight = 0;

  function onPointerDown(e: PointerEvent): void {
    if (e.button !== 0) return;
    resizing = true;
    startY = e.clientY;
    startHeight = bodyEl.offsetHeight;
    handle.setPointerCapture(e.pointerId);
    panelEl.style.userSelect = 'none';
    e.preventDefault();
  }

  function onPointerMove(e: PointerEvent): void {
    if (!resizing) return;
    const nonBodyHeight = panelEl.offsetHeight - bodyEl.offsetHeight;
    const maxH = window.innerHeight - panelEl.offsetTop - nonBodyHeight - EDGE_MARGIN;
    const newH = Math.max(minH, Math.min(startHeight + (e.clientY - startY), maxH));
    bodyEl.style.height = `${newH}px`;
  }

  function onPointerUp(): void {
    if (!resizing) return;
    resizing = false;
    panelEl.style.userSelect = '';

    if (opts?.onResizeEnd) {
      opts.onResizeEnd(bodyEl.offsetHeight);
    }
  }

  handle.addEventListener('pointerdown', onPointerDown);
  handle.addEventListener('pointermove', onPointerMove);
  handle.addEventListener('pointerup', onPointerUp);

  return () => {
    handle.removeEventListener('pointerdown', onPointerDown);
    handle.removeEventListener('pointermove', onPointerMove);
    handle.removeEventListener('pointerup', onPointerUp);
    handle.remove();
  };
}

// ============================================================================
// Layout Persistence
// ============================================================================

export interface PanelLayout {
  x: number;
  y: number;
  height: number;
  pinned: boolean;
}

export function loadLayout(key: string): PanelLayout | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const layout = JSON.parse(raw) as PanelLayout;
    // Validate against current viewport
    const maxX = window.innerWidth - EDGE_MARGIN;
    const maxY = window.innerHeight - EDGE_MARGIN;
    layout.x = Math.max(EDGE_MARGIN, Math.min(layout.x, maxX - 100));
    layout.y = Math.max(EDGE_MARGIN, Math.min(layout.y, maxY - 100));
    // Clamp height to what fits below the restored Y position
    const availableHeight = window.innerHeight - layout.y - MIN_VISIBLE_HEIGHT;
    layout.height = Math.max(200, Math.min(layout.height, availableHeight));
    return layout;
  } catch {
    return null;
  }
}

let saveTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function saveLayout(key: string, layout: PanelLayout): void {
  const existing = saveTimers.get(key);
  if (existing) clearTimeout(existing);
  saveTimers.set(key, setTimeout(() => {
    try {
      localStorage.setItem(key, JSON.stringify(layout));
    } catch { /* localStorage unavailable */ }
    saveTimers.delete(key);
  }, 500));
}
