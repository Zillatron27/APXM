// isApexButtonDisabled (#95: colocated with lib/act/apex-button.ts, its
// implementation — was previously re-exported and tested from
// lib/__tests__/contract-actions.test.ts).
//
// Device capture 2026-08-13: APEX gates buttons with a Button__disabled
// class, NOT the disabled attribute — clicking one is a silent no-op.

import { describe, it, expect, beforeAll } from 'vitest';
import { isApexButtonDisabled } from '../apex-button';
import { C } from '../prun-css';

function makeButton(label: string): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.textContent = label;
  return btn;
}

beforeAll(() => {
  Object.assign(C, { Button: { btn: 'apex-btn', disabled: 'apex-btn-disabled' } });
});

describe('isApexButtonDisabled', () => {
  it('detects the parsed C.Button.disabled class', () => {
    const btn = makeButton('fulfill');
    btn.className = 'apex-btn-disabled apex-btn';
    expect(isApexButtonDisabled(btn)).toBe(true);
  });

  it('detects the raw BEM prefix when stylesheet parsing is unavailable', () => {
    const btn = makeButton('fulfill');
    btn.className = 'Button__disabled___x8i7XF Button__btn___UJGZ1b7';
    expect(isApexButtonDisabled(btn)).toBe(true);
  });

  it('detects the standard disabled attribute', () => {
    const btn = makeButton('fulfill');
    btn.disabled = true;
    expect(isApexButtonDisabled(btn)).toBe(true);
  });

  it('an enabled button is not disabled', () => {
    const btn = makeButton('fulfill');
    btn.className = 'apex-btn';
    expect(isApexButtonDisabled(btn)).toBe(false);
  });
});
