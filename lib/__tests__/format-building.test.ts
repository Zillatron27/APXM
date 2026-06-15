import { describe, it, expect } from 'vitest';
import { formatBuildingName } from '../format-building';

describe('formatBuildingName', () => {
  it('matches APEX friendly names from the camelCase type key', () => {
    expect(formatBuildingName('smallComponentsAssembly')).toBe('Small Components Assembly');
    expect(formatBuildingName('advancedAppliancesFactory')).toBe('Advanced Appliances Factory');
    expect(formatBuildingName('energyComponentAssembly')).toBe('Energy Component Assembly');
  });

  it('handles a single word and an already-capitalised key', () => {
    expect(formatBuildingName('farm')).toBe('Farm');
    expect(formatBuildingName('Refinery')).toBe('Refinery');
  });

  it('returns empty input unchanged', () => {
    expect(formatBuildingName('')).toBe('');
  });
});
