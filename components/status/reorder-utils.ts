import { STATUS_PANEL_IDS, type StatusPanelId } from '../../stores/settings';

function move<T>(arr: T[], from: number, to: number): T[] {
  const next = arr.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/**
 * Reconciles a stored (untrusted) panel order against the known panel set:
 * keeps known ids in their saved order, drops unknown ids, and appends any
 * known panels the saved order predates. Self-heals when a panel is added,
 * removed, or renamed.
 */
export function reconcileOrder(stored: string[]): StatusPanelId[] {
  const known = stored.filter((id): id is StatusPanelId =>
    (STATUS_PANEL_IDS as string[]).includes(id)
  );
  const missing = STATUS_PANEL_IDS.filter((id) => !known.includes(id));
  return [...known, ...missing];
}

/**
 * Applies a drag-reorder. `insertAt` is the insertion slot (0..length) under
 * the pointer, counting the dragged panel's own slot — collapse it to the
 * post-removal target before moving. No-op slots (dropping back into the same
 * gap) return the input array unchanged.
 */
export function applyReorder<T>(order: T[], fromIndex: number, insertAt: number): T[] {
  const to = insertAt > fromIndex ? insertAt - 1 : insertAt;
  if (to === fromIndex) return order;
  return move(order, fromIndex, to);
}
