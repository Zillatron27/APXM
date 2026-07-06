// The dead-code keeper: until the Phase D views import the engine, this test
// is what keeps the whole registration graph executed under vitest. A refactor
// that breaks any self-registration fails here, not on a device.

import { describe, it, expect } from 'vitest';
import '../register-all';
import { act } from '../act-registry';

describe('register-all', () => {
  it('registers both actions', () => {
    expect(act.getActionTypes()).toContain('CX Buy');
    expect(act.getActionTypes()).toContain('MTRA');
  });

  it('registers both material groups', () => {
    expect(act.getMaterialGroupTypes()).toContain('Resupply');
    expect(act.getMaterialGroupTypes()).toContain('Repair');
  });

  it('registers all three action steps', () => {
    expect(act.getActionStepInfo('CXPO_BUY')).toBeDefined();
    expect(act.getActionStepInfo('MTRA_TRANSFER')).toBeDefined();
    expect(act.getActionStepInfo('OPEN_SFC')).toBeDefined();
  });
});
