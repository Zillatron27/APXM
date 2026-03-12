/**
 * Panel Manager — shared positioning, dismissal, one-at-a-time constraint
 *
 * Extracted from ship-panel.ts so all panel types (ship, base, future)
 * share the same placement and lifecycle logic.
 */

export interface PanelHandle {
  container: HTMLDivElement;
  onClose: () => void;
}

const PANEL_OFFSET = 20;
const VIEWPORT_MARGIN = 10;

let activePanel: PanelHandle | null = null;
let clickOutsideHandler: ((e: MouseEvent) => void) | null = null;

function positionPanel(container: HTMLDivElement, anchorX: number, anchorY: number): void {
  let x = anchorX + PANEL_OFFSET;
  let y = anchorY - 40;

  const w = container.offsetWidth || 380;
  const h = container.offsetHeight || 400;

  if (x + w > window.innerWidth - VIEWPORT_MARGIN) {
    x = anchorX - PANEL_OFFSET - w;
  }
  if (x < VIEWPORT_MARGIN) x = VIEWPORT_MARGIN;

  if (y + h > window.innerHeight - VIEWPORT_MARGIN) {
    y = window.innerHeight - VIEWPORT_MARGIN - h;
  }
  if (y < VIEWPORT_MARGIN) y = VIEWPORT_MARGIN;

  container.style.left = `${x}px`;
  container.style.top = `${y}px`;
}

/**
 * Shows a managed panel, closing any existing one first.
 * Handles positioning and click-outside dismissal.
 */
export function showManagedPanel(
  container: HTMLDivElement,
  anchorX: number,
  anchorY: number,
  onClose: () => void,
): void {
  // Close any existing panel before opening a new one (one-at-a-time)
  if (activePanel) {
    hideManagedPanel();
  }

  activePanel = { container, onClose };
  positionPanel(container, anchorX, anchorY);

  // Click-outside-to-dismiss (delay to avoid the opening click itself)
  if (clickOutsideHandler) {
    document.removeEventListener('pointerdown', clickOutsideHandler);
  }
  clickOutsideHandler = (e: MouseEvent) => {
    if (container && !container.contains(e.target as Node)) {
      hideManagedPanel();
    }
  };
  setTimeout(() => {
    if (clickOutsideHandler) {
      document.addEventListener('pointerdown', clickOutsideHandler);
    }
  }, 0);
}

/** Hides the currently active managed panel (if any). */
export function hideManagedPanel(): void {
  if (clickOutsideHandler) {
    document.removeEventListener('pointerdown', clickOutsideHandler);
    clickOutsideHandler = null;
  }
  if (activePanel) {
    const panel = activePanel;
    activePanel = null;
    panel.onClose();
  }
}

/** Returns true if any managed panel is currently active. */
export function isManagedPanelVisible(): boolean {
  return activePanel !== null;
}

/** Returns true if the given container is the currently active managed panel. */
export function isManagedPanelActive(container: HTMLDivElement): boolean {
  return activePanel?.container === container;
}
