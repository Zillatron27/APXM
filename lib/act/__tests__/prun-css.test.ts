// prun-css: parses APEX's <style data-source="prun"> CSS-module selectors
// into the C lookup (C.Button.btn → 'Button__btn___HASH').

import { describe, it, expect, beforeAll } from 'vitest';
import { C, loadPrunCss } from '../prun-css';

function injectStyle(css: string, source?: string): HTMLStyleElement {
  const style = document.createElement('style');
  if (source) style.dataset.source = source;
  style.textContent = css;
  document.head.appendChild(style);
  return style;
}

beforeAll(() => {
  injectStyle('.Button__btn___UJGZ1b7 { color: red; }', 'prun');
  injectStyle('.action-feedback__overlay-message___Xy12ab { display: none; }', 'prun');
  injectStyle(
    '.ComExPlaceOrderForm__form___Aa1 input, .MaterialSelector__suggestions-list___Bb2 { margin: 0; }',
    'prun',
  );
  // Non-prun stylesheet must be ignored even with a matching selector shape.
  injectStyle('.NotPrun__thing___Zz9 { color: blue; }');
  // loadPrunCss installs a head MutationObserver — call it once per file.
  loadPrunCss();
});

describe('loadPrunCss', () => {
  it('maps Block__element___HASH selectors onto C', () => {
    expect(C.Button.btn).toBe('Button__btn___UJGZ1b7');
  });

  it('camelizes dashed block and element names', () => {
    expect(C.actionFeedback.overlayMessage).toBe('action-feedback__overlay-message___Xy12ab');
  });

  it('extracts every module class from compound selectors', () => {
    expect(C.ComExPlaceOrderForm.form).toBe('ComExPlaceOrderForm__form___Aa1');
    expect(C.MaterialSelector.suggestionsList).toBe('MaterialSelector__suggestions-list___Bb2');
  });

  it('ignores stylesheets without data-source="prun"', () => {
    expect(C.NotPrun).toBeUndefined();
  });
});
