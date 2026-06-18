import { describe, it, expect } from 'vitest';
import { reconcileOrder, applyReorder } from '../reorder-utils';

describe('reconcileOrder', () => {
  it('returns the canonical order for an empty/default input', () => {
    expect(reconcileOrder([])).toEqual(['bases', 'fleet', 'contracts']);
  });

  it('preserves a valid saved order', () => {
    const saved = ['fleet', 'contracts', 'bases'];
    expect(reconcileOrder(saved)).toEqual(saved);
  });

  it('drops unknown ids (e.g. the now-pinned cash panel)', () => {
    expect(reconcileOrder(['fleet', 'cash', 'bases'])).toEqual([
      'fleet',
      'bases',
      // appended in canonical order
      'contracts',
    ]);
  });

  it('appends known panels missing from a stale saved order', () => {
    // Saved order predates 'contracts' being added.
    expect(reconcileOrder(['fleet', 'bases'])).toEqual(['fleet', 'bases', 'contracts']);
  });
});

describe('applyReorder', () => {
  const order = ['a', 'b', 'c', 'd'];

  it('moves an item down (insertAt past its origin collapses by one)', () => {
    // Drag 'a' (index 0) to the slot after 'c' (insertAt 3) → a lands at index 2.
    expect(applyReorder(order, 0, 3)).toEqual(['b', 'c', 'a', 'd']);
  });

  it('moves an item up', () => {
    // Drag 'd' (index 3) to slot 1 → ['a', 'd', 'b', 'c'].
    expect(applyReorder(order, 3, 1)).toEqual(['a', 'd', 'b', 'c']);
  });

  it('moves to the very end', () => {
    expect(applyReorder(order, 1, 4)).toEqual(['a', 'c', 'd', 'b']);
  });

  it('moves to the very start', () => {
    expect(applyReorder(order, 2, 0)).toEqual(['c', 'a', 'b', 'd']);
  });

  it('is a no-op when dropped into its own slot', () => {
    expect(applyReorder(order, 1, 1)).toBe(order);
    expect(applyReorder(order, 1, 2)).toBe(order);
  });
});
