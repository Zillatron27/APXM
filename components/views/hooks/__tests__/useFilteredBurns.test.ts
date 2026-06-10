import { describe, it, expect } from 'vitest';
import { getFilterForUrgency } from '../useFilteredBurns';

describe('getFilterForUrgency', () => {
  it('maps red/yellow/green urgencies to their own filter', () => {
    expect(getFilterForUrgency('critical')).toBe('critical');
    expect(getFilterForUrgency('warning')).toBe('warning');
    expect(getFilterForUrgency('ok')).toBe('ok');
  });

  it("folds surplus into 'ok' — per-site mostUrgent never lands on surplus, so INF gets no tier (#24)", () => {
    expect(getFilterForUrgency('surplus')).toBe('ok');
  });

  it("maps missing burn data to 'ok'", () => {
    expect(getFilterForUrgency(undefined)).toBe('ok');
  });
});
