import { describe, it, expect } from 'vitest';
import { getFilterForUrgency } from '../useFilteredBurns';

describe('getFilterForUrgency', () => {
  it('maps each urgency tier to its own filter', () => {
    expect(getFilterForUrgency('critical')).toBe('critical');
    expect(getFilterForUrgency('warning')).toBe('warning');
    expect(getFilterForUrgency('ok')).toBe('ok');
    // Regression: surplus used to collapse into 'ok' (issue #24)
    expect(getFilterForUrgency('surplus')).toBe('surplus');
  });

  it("maps missing burn data to 'ok' — nothing burning is not surplus", () => {
    expect(getFilterForUrgency(undefined)).toBe('ok');
  });
});
